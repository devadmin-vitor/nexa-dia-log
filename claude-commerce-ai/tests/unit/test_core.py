import json
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from core import agent_registry, cost_control, permissions, scheduler
from core.claude_client import strict_schema
from core.config import ROOT_DIR, get_settings
from core.errors import ApprovalRequired, PermissionDenied
from core.logging import mask_secrets


def test_seven_agents_registered_with_prompts():
    reg = agent_registry.load_registry()
    assert len(reg["agents"]) == 7
    assert agent_registry.validate_registry() == []
    assert reg["orchestrator"].key == "operations_director"
    assert set(reg["agents"]) == {
        "operations_director", "product_hunter", "trend_intelligence", "creative_director",
        "publishing_manager", "finance_controller", "compliance_auditor",
    }
    prompt = reg["agents"]["creative_director"].system_prompt()
    assert "REGRAS MESTRAS" in prompt and "CREATIVE DIRECTOR" in prompt
    assert "{BRAND_NAME}" not in prompt


def test_agent_classes_match_registry():
    import importlib

    for spec in agent_registry.load_registry()["agents"].values():
        mod = importlib.import_module(f"agents.{spec.folder}.agent")
        agent = mod.Agent()
        assert agent.spec.key == spec.key
        with pytest.raises(NotImplementedError):
            agent.handle({})


def test_tool_permissions():
    permissions.authorize_tool("finance_controller", "read_commissions")
    with pytest.raises(PermissionDenied):
        permissions.authorize_tool("finance_controller", "render_video")  # não é ferramenta dele
    with pytest.raises(PermissionDenied):
        permissions.authorize_tool("trend_intelligence", "web_research")  # sem fonte autorizada
    with pytest.raises(PermissionDenied):
        permissions.authorize_tool("ghost", "anything")


def test_external_actions_need_approval():
    for action in ("publish_content", "spend_money", "financial", "change_listing"):
        with pytest.raises(ApprovalRequired):
            permissions.ensure_can_execute_without_approval(action)
    assert reg_publisher_requires_approval()


def reg_publisher_requires_approval() -> bool:
    return agent_registry.get_spec("publishing_manager").approval_required is True


def test_cost_estimates_and_brl_conversion():
    assert cost_control.estimate_usd("claude-opus-5-5", 1_000_000, 0) == 4.0
    assert cost_control.estimate_usd("claude-opus-5-5", 1000, 500) == 0.014
    assert cost_control.estimate_usd("modelo-desconhecido", 1_000_000, 0) == 8.0  # conservador
    assert cost_control.usd_to_brl(1.0) == 5.0  # USD_BRL_RATE=5.0 nos testes


def test_strict_schema():
    from pydantic import BaseModel, Field

    class Item(BaseModel):
        name: str = Field(min_length=2)
        score: int = Field(ge=0, le=100)

    class Out(BaseModel):
        items: list[Item]

    s = strict_schema(Out)
    item = s["$defs"]["Item"]
    assert item["additionalProperties"] is False and set(item["required"]) == {"name", "score"}
    assert "minimum" not in json.dumps(s) and "minLength" not in json.dumps(s)


def test_scheduler_idempotency_windows():
    tz = ZoneInfo("America/Sao_Paulo")
    daily = scheduler.JOBS["financial_report"]
    hourly = scheduler.JOBS["publishing_queue"]
    a = datetime(2026, 11, 23, 9, 5, tzinfo=tz)
    b = datetime(2026, 11, 23, 9, 55, tzinfo=tz)
    c = datetime(2026, 11, 23, 10, 1, tzinfo=tz)
    assert scheduler.idempotency_key(daily, a) == scheduler.idempotency_key(daily, c)
    assert scheduler.idempotency_key(hourly, a) == scheduler.idempotency_key(hourly, b)
    assert scheduler.idempotency_key(hourly, a) != scheduler.idempotency_key(hourly, c)


def test_n8n_workflows_match_scheduler_jobs():
    for job in scheduler.JOBS.values():
        wf = json.loads((ROOT_DIR / job.workflow_file).read_text(encoding="utf-8"))
        urls = [n["parameters"].get("url", "") for n in wf["nodes"] if n["type"] == "n8n-nodes-base.httpRequest"]
        assert any(u.endswith(f"/api/v1/scheduler/trigger/{job.key}") for u in urls), job.key
        # Nenhum segredo embutido no workflow
        assert "test-scheduler-token" not in json.dumps(wf) and "sk-ant" not in json.dumps(wf)


def test_mask_secrets():
    s = mask_secrets("key sk-ant-api03-abcDEF token=abc123 postgresql://postgres:senha@127.0.0.1:54322/db")
    assert "abcDEF" not in s and "abc123" not in s and "senha" not in s


def test_secrets_never_in_public_view():
    view = json.dumps(get_settings().public_view())
    assert "test-api-token" not in view and "test-scheduler-token" not in view


def test_env_example_has_no_real_secrets():
    text = (ROOT_DIR / ".env.example").read_text(encoding="utf-8")
    for key in ("ANTHROPIC_API_KEY", "BACKEND_API_TOKEN", "SCHEDULER_TOKEN", "N8N_ENCRYPTION_KEY", "SUPABASE_SERVICE_ROLE_KEY"):
        line = next(l for l in text.splitlines() if l.startswith(key + "="))
        assert line.split("=", 1)[1].split("#")[0].strip() == "", key


def test_dashboard_has_no_public_secret_env():
    """Credenciais nunca podem ir para o bundle do navegador (prefixo NEXT_PUBLIC_)."""
    src = ROOT_DIR / "apps" / "dashboard" / "src"
    offenders = [p for p in src.rglob("*.ts*") if "NEXT_PUBLIC_" in p.read_text(encoding="utf-8")]
    assert offenders == []


def test_env_example_loads_as_is(monkeypatch):
    """O .env.example (com campos vazios) deve carregar sem erro."""
    from core.config import Settings

    for key in ("USD_BRL_RATE", "DAILY_API_BUDGET_BRL", "MONTHLY_BUDGET_BRL", "CLAUDE_MODEL", "REDIS_URL"):
        monkeypatch.delenv(key, raising=False)
    s = Settings(_env_file=ROOT_DIR / ".env.example")
    assert s.usd_brl_rate == 0 and s.monthly_budget_brl == 150 and s.daily_api_budget_brl == 4
    assert s.claude_model == "claude-opus-5-5"
