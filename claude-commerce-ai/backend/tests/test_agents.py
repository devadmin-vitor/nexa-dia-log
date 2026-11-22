import json
from types import SimpleNamespace

from app.agents.base import AgentContext
from app.agents.orchestrator import AGENTS, Orchestrator
from app.api import deps
from app.domain.models import ActionType, ApprovalDecision, ApprovalStatus, ContentStatus, Script
from app.services import approvals, compliance_rules
from app.services.llm import ClaudeClient, _strict_schema, estimate_cost_usd
from tests.conftest import AUTH


def _ctx(store):
    return AgentContext(store=store, llm=ClaudeClient(store))


def test_seven_specialized_agents():
    assert len(AGENTS) == 7


def test_each_agent_runs_in_simulated_mode(store):
    ctx = _ctx(store)
    content_id = next(c.id for c in store.list_content() if c.status == ContentStatus.idea)
    for key, agent in AGENTS.items():
        params = {"content_id": content_id} if key in ("scriptwriter", "compliance_reviewer") else {}
        run = agent.run(ctx, params)
        assert run.status == "succeeded", (key, run.error)
        assert run.mode == "simulated" and run.cost_usd == 0


def test_daily_pipeline(store):
    pr = Orchestrator(_ctx(store)).run_pipeline("daily_cycle")
    assert pr["status"] == "succeeded"
    assert [r["agent_key"] for r in pr["runs"]] == ["performance_monitor", "commission_analyst", "product_researcher", "operations_guardian"]
    assert all(p.classification for p in store.products.values())


def test_content_pipeline_creates_approval_request(store):
    content = next(c for c in store.list_content() if store.products[c.product_id].sample_received and c.status == ContentStatus.idea)
    pr = Orchestrator(_ctx(store)).run_pipeline("content_pipeline", {"content_id": content.id})
    assert pr["status"] == "succeeded", pr
    c = store.content[content.id]
    assert c.compliance_passed is True and c.status == ContentStatus.in_review
    pending = [a for a in store.approvals.values() if a.payload.get("content_id") == c.id]
    assert pending and pending[0].action_type == ActionType.publish_content


def test_compliance_rules_block_misleading_script(store):
    p = next(p for p in store.products.values() if not p.sample_received)
    bad = Script(
        hook="Resultado garantido! Minha amiga usou e amou",
        body=["Testei e é o melhor do mundo", "Só hoje!"],
        call_to_action="Compre já",
        disclosure="",
        claims_used=["Aprovado pela Anvisa"],
    )
    rules = {i.rule for i in compliance_rules.check_script(bad, p)}
    assert {"promessa_absoluta", "depoimento_nao_verificavel", "sem_divulgacao_afiliado",
            "alegacao_nao_verificada", "demonstracao_sem_amostra", "superlativo_nao_comprovado", "urgencia_falsa"} <= rules


def test_ai_cannot_override_deterministic_compliance(store):
    """Mesmo que a IA aprove, a regra determinística bloqueia."""
    content = next(c for c in store.list_content() if c.status == ContentStatus.idea)
    content.script = Script(hook="100% garantido", body=["x"], call_to_action="y", disclosure="#publi link de afiliado")
    content.status = ContentStatus.scripted
    fake = _FakeSDK({"approved": True, "issues": [], "suggestions": []})
    ctx = AgentContext(store=store, llm=ClaudeClient(store, sdk_client=fake))
    run = AGENTS["compliance_reviewer"].run(ctx, {"content_id": content.id})
    assert run.status == "succeeded" and run.mode == "live"
    assert store.content[content.id].status == ContentStatus.blocked


def test_financial_approval_never_auto_executes(store):
    fin = next(a for a in store.approvals.values() if a.action_type == ActionType.financial)
    res = approvals.decide(store, fin.id, ApprovalDecision(approve=True, decided_by="gestor"))
    assert res.status == ApprovalStatus.approved
    assert res.execution_status == "manual_required"


def test_policy_requires_approval_for_external_actions():
    import pytest

    from app.core.errors import ApprovalRequired

    approvals.ensure_auto_allowed(ActionType.internal_write)
    for a in (ActionType.publish_content, ActionType.change_listing, ActionType.financial, ActionType.contact_seller):
        with pytest.raises(ApprovalRequired):
            approvals.ensure_auto_allowed(a)


# ------------------------------------------------------------------ modo live com SDK falso
class _FakeSDK:
    def __init__(self, payload, model="claude-opus-5-5", stop_reason="end_turn"):
        self.payload, self.model, self.stop_reason = payload, model, stop_reason
        self.calls = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kw):
        self.calls.append(kw)
        return SimpleNamespace(
            model=self.model, stop_reason=self.stop_reason,
            usage=SimpleNamespace(input_tokens=1000, output_tokens=500),
            content=[SimpleNamespace(type="text", text=json.dumps(self.payload))],
        )


def test_live_mode_records_cost_and_drops_hallucinated_ids(store):
    real_id = next(iter(store.products))
    fake = _FakeSDK({
        "summary": "ok", "missing_information": [],
        "evaluations": [
            {"product_id": real_id, "classification": "A", "score": 90, "rationale": "r", "risks": []},
            {"product_id": "inventado", "classification": "A", "score": 99, "rationale": "r", "risks": []},
        ],
    })
    ctx = AgentContext(store=store, llm=ClaudeClient(store, sdk_client=fake))
    run = AGENTS["product_researcher"].run(ctx)
    assert run.status == "succeeded" and run.mode == "live"
    assert run.cost_usd == estimate_cost_usd("claude-opus-5-5", 1000, 500) == 0.014
    assert run.output["effects"]["products_classified"] == 1
    call = fake.calls[0]
    assert call["model"] == "claude-opus-5-5" and call["fallbacks"] == "default"
    assert call["output_config"]["format"]["type"] == "json_schema"
    assert "thinking" not in call  # Opus 5.5: thinking adaptativo por padrão; não enviar disabled/budget


def test_budget_blocks_live_calls(store):
    fake = _FakeSDK({"status": "ok", "summary": "s", "findings": [], "recommend_kill_switch": False})
    ctx = AgentContext(store=store, llm=ClaudeClient(store, sdk_client=fake))
    from app.domain.models import AgentRun

    store.save_run(AgentRun(agent_key="x", mode="live", cost_usd=5.0, status="succeeded"))  # orçamento de teste = 1.0
    run = AGENTS["operations_guardian"].run(ctx)
    assert run.status == "blocked" and "Orçamento" in run.error
    assert fake.calls == []


def test_refusal_is_reported_as_failure(store):
    fake = _FakeSDK({}, stop_reason="refusal")
    ctx = AgentContext(store=store, llm=ClaudeClient(store, sdk_client=fake))
    run = AGENTS["operations_guardian"].run(ctx)
    assert run.status == "failed" and "recusou" in run.error


def test_invalid_ai_output_fails_safely(store):
    fake = _FakeSDK({"unexpected": True})
    ctx = AgentContext(store=store, llm=ClaudeClient(store, sdk_client=fake))
    run = AGENTS["performance_monitor"].run(ctx)
    assert run.status == "failed"


def test_strict_schema_shape():
    from app.agents.product_researcher import ProductResearchOutput

    s = _strict_schema(ProductResearchOutput)
    ev = s["$defs"]["ProductEvaluation"]
    assert ev["additionalProperties"] is False and set(ev["required"]) == set(ev["properties"])
    assert "minimum" not in json.dumps(s)


def test_run_agent_endpoint_with_live_override(client, store):
    fake = _FakeSDK({"summary": "s", "highlights": [], "alerts": []})
    deps.set_llm_override(ClaudeClient(store, sdk_client=fake))
    r = client.post("/api/v1/agents/performance_monitor/run", headers=AUTH)
    assert r.status_code == 200 and r.json()["mode"] == "live"
    costs = client.get("/api/v1/costs", headers=AUTH).json()
    assert costs["today_usd"] > 0
