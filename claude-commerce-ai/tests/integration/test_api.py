import pytest

from tests.conftest import AUTH, SCHED

pytestmark = pytest.mark.integration


def test_overview_and_agents(client):
    r = client.get("/api/v1/overview", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["agents"] == 7 and body["emergency"]["active"] is False
    assert body["products"] == {"real": 0, "simulated": 0}  # nenhum dado fictício é semeado
    agents = client.get("/api/v1/agents", headers=AUTH).json()["agents"]
    assert len(agents) == 7 and all(a["prompt_file"] for a in agents)


def test_health_services_reports_database_ok(client):
    r = client.get("/health/services", headers=AUTH)
    status = {s["key"]: s["status"] for s in r.json()["services"]}
    assert status["database"] == "ok"
    assert r.status_code == 503  # Redis/n8n/Supabase API apontam para portas inválidas nos testes


def test_product_endpoint_deduplicates(client):
    body = {"name": "Fone Bluetooth", "external_id": "TT-9", "price": "99.90", "commission_rate": "0.1"}
    first = client.post("/api/v1/products", headers=AUTH, json=body).json()
    second = client.post("/api/v1/products", headers=AUTH, json=body).json()
    assert first["created"] is True and second["created"] is False
    assert len(client.get("/api/v1/products", headers=AUTH).json()) == 1
    assert client.post("/api/v1/products", headers=AUTH, json={"name": "x", "commission_rate": 2}).status_code == 422


def test_scheduler_trigger_is_idempotent(client):
    a = client.post("/api/v1/scheduler/trigger/financial_report", headers=SCHED)
    b = client.post("/api/v1/scheduler/trigger/financial_report", headers=SCHED)
    assert a.status_code == 200 and b.status_code == 200
    assert a.json()["task_id"] == b.json()["task_id"] and b.json()["deduplicated"] is True
    assert client.post("/api/v1/scheduler/trigger/nao_existe", headers=SCHED).status_code == 404
    # token do dashboard não serve para o agendador
    assert client.post("/api/v1/scheduler/trigger/financial_report", headers={"X-Scheduler-Token": "test-api-token"}).status_code == 401


def test_emergency_stop_via_api(client):
    r = client.post("/api/v1/system/emergency", headers=AUTH, json={"active": True, "reason": "teste", "changed_by": "qa"})
    assert r.status_code == 200 and r.json()["active"] is True
    assert client.post("/api/v1/scheduler/trigger/daily_operations", headers=SCHED).status_code == 423
    assert client.post("/api/v1/tasks", headers=AUTH, json={"agent_key": "product_hunter", "task_type": "rank"}).status_code == 423
    assert client.post("/api/v1/integrations/claude/test", headers=AUTH).status_code == 423
    logs = client.get("/api/v1/audit?level=security", headers=AUTH).json()
    assert logs[0]["action"] == "emergency_stop.on"
    client.post("/api/v1/system/emergency", headers=AUTH, json={"active": False, "reason": "liberado", "changed_by": "qa"})
    assert client.post("/api/v1/tasks", headers=AUTH, json={"agent_key": "product_hunter", "task_type": "rank"}).status_code == 201


def test_approval_flow_via_api(client, conn):
    from core import approvals

    appr = approvals.request(conn, action_type="publish_content", description="Publicar vídeo")
    conn.commit()
    r = client.post(f"/api/v1/approvals/{appr['id']}/decision", headers=AUTH,
                    json={"approve": False, "decided_by": "gestor", "reason": "ajustar gancho"})
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    assert client.get("/api/v1/approvals?status=pending", headers=AUTH).json() == []


def test_costs_endpoint(client):
    body = client.get("/api/v1/costs", headers=AUTH).json()
    assert body["budget"]["daily_limit_brl"] == 1.0 and body["budget"]["today_brl"] == 0
