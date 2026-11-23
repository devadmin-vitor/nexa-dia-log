"""Critérios de prontidão verificados contra PostgreSQL real com as migrações aplicadas."""

import json
from decimal import Decimal
from types import SimpleNamespace

import psycopg
import pytest

from core import agent_registry, approvals, cost_control, emergency, products, task_manager
from core.claude_client import ClaudeClient
from core.errors import BudgetExceeded, Conflict, EmergencyStopActive, LimitExceeded, NotConfigured

pytestmark = pytest.mark.integration


def test_migrations_created_expected_tables(conn):
    tables = {r["table_name"] for r in conn.execute(
        "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")}
    assert tables == {"agents", "products", "product_metrics", "content_ideas", "publications", "content_metrics",
                      "affiliate_orders", "commissions", "agent_tasks", "approvals", "audit_logs", "cost_usage",
                      "app_settings"}
    rls = conn.execute("select count(*) as n from pg_tables where schemaname='public' and not rowsecurity").fetchone()
    assert rls["n"] == 0, "todas as tabelas devem ter RLS habilitado"


def test_seven_agents_synced_idempotently(conn):
    assert agent_registry.sync_agents(conn) == 7
    rows = agent_registry.list_agents(conn)
    assert len(rows) == 7
    assert sum(1 for r in rows if r["config"].get("is_orchestrator")) == 1


def test_products_are_not_duplicated(conn):
    p = products.ProductIn(name="Carregador USB-C 20W", external_id="EXT-1", product_url="https://exemplo.com/p/1",
                           price=Decimal("59.90"), commission_rate=Decimal("0.12"))
    first, created = products.save(conn, p, actor="test")
    assert created and first["commission_value"] == Decimal("7.19")
    again, created = products.save(conn, p, actor="test")
    assert not created and again["id"] == first["id"]
    same_url = products.ProductIn(name="Outro nome", product_url="https://EXEMPLO.com/p/1")
    _, created = products.save(conn, same_url, actor="test")
    assert not created
    # O banco também impede duplicidade mesmo fora do backend
    with pytest.raises(psycopg.errors.UniqueViolation):
        conn.execute("insert into public.products (name, external_id) values ('x1', 'EXT-1')")


def test_task_queue_lifecycle(conn):
    t1 = task_manager.enqueue(conn, agent_key="product_hunter", task_type="rank", priority=5, idempotency_key="k1")
    dup = task_manager.enqueue(conn, agent_key="product_hunter", task_type="rank", idempotency_key="k1")
    assert dup["deduplicated"] and dup["id"] == t1["id"]
    t2 = task_manager.enqueue(conn, agent_key="finance_controller", task_type="report", priority=1)
    claimed = task_manager.claim_next(conn)
    assert claimed["id"] == t2["id"] and claimed["status"] == "running"  # prioridade 1 antes da 5
    task_manager.complete(conn, claimed["id"], {"ok": True})
    nxt = task_manager.claim_next(conn)
    failed = task_manager.fail(conn, nxt["id"], "erro temporário")
    assert failed["status"] == "queued" and failed["attempts"] == 1  # re-tentativa agendada
    conn.execute("update public.agent_tasks set scheduled_at = now(), max_attempts = 1 where id = %s", (nxt["id"],))
    again = task_manager.claim_next(conn)
    final = task_manager.fail(conn, again["id"], "erro definitivo")
    assert final["status"] == "failed"
    audit_actions = [r["action"] for r in conn.execute("select action from public.audit_logs")]
    assert "task.enqueued" in audit_actions and "task.failed" in audit_actions


def test_daily_task_limit(conn, monkeypatch):
    reg = agent_registry.load_registry()
    monkeypatch.setitem(reg["orchestrator"].limits, "daily_task_limit", 2)
    task_manager.enqueue(conn, agent_key="product_hunter", task_type="a")
    task_manager.enqueue(conn, agent_key="product_hunter", task_type="b")
    with pytest.raises(LimitExceeded):
        task_manager.enqueue(conn, agent_key="product_hunter", task_type="c")


def test_emergency_stop_blocks_everything(conn):
    queued = task_manager.enqueue(conn, agent_key="product_hunter", task_type="rank")
    appr = approvals.request(conn, action_type="publish_content", description="Publicar vídeo X")
    emergency.set_stop(conn, active=True, reason="teste", changed_by="qa")
    assert conn.execute("select status from public.agent_tasks where id=%s", (queued["id"],)).fetchone()["status"] == "blocked"
    with pytest.raises(EmergencyStopActive):
        task_manager.enqueue(conn, agent_key="product_hunter", task_type="rank")
    with pytest.raises(EmergencyStopActive):
        task_manager.claim_next(conn)
    with pytest.raises(EmergencyStopActive):
        approvals.decide(conn, str(appr["id"]), approve=True, decided_by="qa", reason=None)
    with pytest.raises(EmergencyStopActive):
        ClaudeClient(sdk_client=_FakeSDK({})).generate(conn, agent_key="x", system="s", user="u", schema=_Out)
    emergency.set_stop(conn, active=False, reason="liberado", changed_by="qa")
    task_manager.enqueue(conn, agent_key="product_hunter", task_type="rank")


def test_financial_approval_is_never_executed_automatically(conn):
    appr = approvals.request(conn, action_type="spend_money", description="Impulsionar vídeo R$ 20", agent_key="finance_controller")
    assert appr["risk_level"] == "critical"
    decided = approvals.decide(conn, str(appr["id"]), approve=True, decided_by="gestor", reason="ok")
    assert decided["status"] == "approved" and decided["execution_status"] == "manual_required"
    with pytest.raises(Conflict):
        approvals.decide(conn, str(appr["id"]), approve=False, decided_by="gestor", reason=None)
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute("update public.approvals set execution_status = 'executed' where id = %s", (appr["id"],))


def test_publication_blocked_without_approval(conn):
    idea = conn.execute("insert into public.content_ideas (title) values ('Vídeo 1') returning id").fetchone()
    pub = conn.execute("insert into public.publications (content_id, disclosure_enabled) values (%s, true) returning id",
                       (idea["id"],)).fetchone()
    with pytest.raises(psycopg.errors.RaiseException):
        with conn.transaction():
            conn.execute("update public.publications set status='published_manual' where id=%s", (pub["id"],))
    appr = approvals.request(conn, action_type="publish_content", description="Publicar Vídeo 1")
    # aprovação pendente ainda não autoriza
    with pytest.raises(psycopg.errors.RaiseException):
        with conn.transaction():
            conn.execute("update public.publications set status='published_manual', approval_id=%s where id=%s",
                         (appr["id"], pub["id"]))
    approvals.decide(conn, str(appr["id"]), approve=True, decided_by="gestor", reason=None)
    # sem divulgação comercial também não publica
    with pytest.raises(psycopg.errors.RaiseException):
        with conn.transaction():
            conn.execute("update public.publications set status='published_manual', approval_id=%s, "
                         "disclosure_enabled=false where id=%s", (appr["id"], pub["id"]))
    conn.execute("update public.publications set status='published_manual', approval_id=%s where id=%s",
                 (appr["id"], pub["id"]))


def test_commission_estimated_separate_from_paid(conn):
    order = conn.execute("insert into public.affiliate_orders (external_order_id, sale_value) values ('O1', 100) returning id").fetchone()
    conn.execute("insert into public.commissions (order_id, net_commission, status) values (%s, 10, 'estimated'), "
                 "(%s, 7, 'paid'), (%s, -3, 'reversed')", (order["id"], order["id"], order["id"]))
    summary = {r["status"]: r["net_commission"] for r in conn.execute("select * from public.v_commission_summary")}
    assert summary == {"estimated": Decimal("10.00"), "paid": Decimal("7.00"), "reversed": Decimal("-3.00")}
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute("insert into public.commissions (net_commission, status) values (1, 'talvez')")


def test_audit_log_is_append_only(conn):
    conn.execute("insert into public.audit_logs (action) values ('teste')")
    with pytest.raises(psycopg.errors.RaiseException):
        conn.execute("update public.audit_logs set action = 'alterado'")


# ------------------------------------------------------------------ custos e Claude (SDK falso, sem rede)
from pydantic import BaseModel  # noqa: E402


class _Out(BaseModel):
    summary: str


class _FakeSDK:
    def __init__(self, payload, stop_reason="end_turn", model="claude-opus-5-5", tokens=(100_000, 20_000)):
        self.payload, self.stop_reason, self.model, self.tokens = payload, stop_reason, model, tokens
        self.calls = []
        self.messages = SimpleNamespace(create=self._create)
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kw):
        self.calls.append(kw)
        return SimpleNamespace(model=self.model, stop_reason=self.stop_reason,
                               usage=SimpleNamespace(input_tokens=self.tokens[0], output_tokens=self.tokens[1]),
                               content=[SimpleNamespace(type="text", text=json.dumps(self.payload))])


def test_claude_call_records_cost_and_budget_is_enforced(conn):
    fake = _FakeSDK({"summary": "ok"})
    client = ClaudeClient(sdk_client=fake)
    r = client.generate(conn, agent_key="product_hunter", system="s", user="u", schema=_Out)
    # 100k*4/1M + 20k*20/1M = 0.4 + 0.4 = US$ 0.80 → R$ 4.00 (cotação 5.0)
    assert r.cost_usd == 0.8 and r.cost_brl == 4.0
    assert fake.calls[0]["fallbacks"] == "default" and "thinking" not in fake.calls[0]
    row = conn.execute("select * from public.cost_usage").fetchone()
    assert row["agent_key"] == "product_hunter" and row["estimated_cost_brl"] == Decimal("4.0000")
    # limite diário de teste = R$ 1,00 → próxima chamada é bloqueada antes de chamar a API
    with pytest.raises(BudgetExceeded):
        client.generate(conn, agent_key="product_hunter", system="s", user="u", schema=_Out)
    assert len(fake.calls) == 1
    assert cost_control.budget_status(conn)["daily_remaining_brl"] == 0


def test_claude_blocked_without_exchange_rate(conn, monkeypatch):
    from core.config import get_settings

    monkeypatch.setenv("USD_BRL_RATE", "0")
    get_settings.cache_clear()
    with pytest.raises(NotConfigured):
        ClaudeClient(sdk_client=_FakeSDK({"summary": "x"})).generate(conn, agent_key="a", system="s", user="u", schema=_Out)


def test_claude_refusal_is_recorded_and_raised(conn):
    from core.errors import AIRefused

    with pytest.raises(AIRefused):
        ClaudeClient(sdk_client=_FakeSDK({}, stop_reason="refusal", tokens=(10, 0))).generate(
            conn, agent_key="a", system="s", user="u", schema=_Out)
    assert conn.execute("select count(*) as n from public.cost_usage").fetchone()["n"] == 1
