from tests.conftest import AUTH


def test_health_is_public(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_api_requires_token(client):
    assert client.get("/api/v1/products").status_code == 401
    assert client.get("/api/v1/products", headers={"X-API-Key": "errado"}).status_code == 401
    assert client.get("/api/v1/products", headers=AUTH).status_code == 200


def test_scheduler_uses_separate_token(client):
    # token do frontend NÃO serve para o agendador
    r = client.post("/api/v1/scheduler/trigger/ops_check", headers={"X-Scheduler-Token": "test-api-token"})
    assert r.status_code == 401
    r = client.post("/api/v1/scheduler/trigger/ops_check", headers={"X-Scheduler-Token": "test-scheduler-token"})
    assert r.status_code == 200
    assert r.json()["status"] == "succeeded"


def test_overview_marks_simulated(client):
    r = client.get("/api/v1/dashboard/overview", headers=AUTH)
    body = r.json()
    assert r.status_code == 200
    assert body["ai_mode"] == "simulated"
    assert body["data_sources_present"] == ["simulated"]
    assert body["kpis"]["orders"] > 0
    real = client.get("/api/v1/dashboard/overview?source=real", headers=AUTH).json()
    assert real["kpis"]["orders"] == 0  # nenhuma métrica real existe


def test_secrets_not_exposed(client):
    body = client.get("/api/v1/system/status", headers=AUTH).text
    assert "test-api-token" not in body
    assert "test-scheduler-token" not in body


def test_integrations_are_not_claimed_working(client):
    integ = {i["key"]: i for i in client.get("/api/v1/system/status", headers=AUTH).json()["integrations"]}
    assert integ["tiktok_shop"]["verified"] is False
    assert integ["tiktok_shop"]["state"] == "not_configured"
    assert integ["claude"]["verified"] is False
    assert integ["supabase"]["verified"] is False


def test_kill_switch_blocks_agents_and_pipelines(client):
    r = client.post("/api/v1/system/kill-switch", headers=AUTH,
                    json={"active": True, "reason": "teste de emergência", "changed_by": "qa"})
    assert r.status_code == 200
    assert client.post("/api/v1/agents/performance_monitor/run", headers=AUTH).status_code == 423
    assert client.post("/api/v1/pipelines/daily_cycle/run", headers=AUTH).status_code == 423
    r = client.post("/api/v1/scheduler/trigger/daily_cycle", headers={"X-Scheduler-Token": "test-scheduler-token"})
    assert r.status_code == 423
    approval_id = client.get("/api/v1/approvals", headers=AUTH).json()[0]["id"]
    r = client.post(f"/api/v1/approvals/{approval_id}/decision", headers=AUTH,
                    json={"approve": True, "decided_by": "qa"})
    assert r.status_code == 423
    client.post("/api/v1/system/kill-switch", headers=AUTH, json={"active": False, "reason": "liberado", "changed_by": "qa"})
    assert client.post("/api/v1/agents/performance_monitor/run", headers=AUTH).status_code == 200


def test_create_product_and_validation(client):
    r = client.post("/api/v1/products", headers=AUTH, json={"name": "Produto X", "category": "Casa", "price_brl": 10, "commission_rate": 0.1})
    assert r.status_code == 201
    assert r.json()["data_source"] == "manual"
    r = client.post("/api/v1/products", headers=AUTH, json={"name": "Y", "category": "Casa", "price_brl": -1, "commission_rate": 2})
    assert r.status_code == 422


def test_import_csv_products_and_metrics(client):
    csv_p = "Nome;Categoria;Preço;Comissão;SKU\nCaneca Térmica;Casa;R$ 39,90;12%;REAL-1\nSem preço;Casa;;10;REAL-2\n"
    r = client.post("/api/v1/imports/products", headers=AUTH, files={"file": ("produtos.csv", csv_p.encode(), "text/csv")})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["rows_ok"] == 2 and b["data_source"] == "csv_import"
    csv_m = "data,sku,visualizacoes,cliques,pedidos,gmv,comissao_brl\n2026-11-01,REAL-1,1000,50,3,119.7,14.36\n01/13/2026,REAL-1,1,1,1,1,1\n"
    r = client.post("/api/v1/imports/metrics", headers=AUTH, files={"file": ("m.csv", csv_m.encode(), "text/csv")})
    b = r.json()
    assert b["rows_ok"] == 1 and b["rows_error"] == 1
    real = client.get("/api/v1/dashboard/metrics?source=real&days=365", headers=AUTH).json()
    assert real["kpis"]["orders"] == 3


def test_import_xlsx(client):
    import io

    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(["name", "category", "price", "commission_rate"])
    ws.append(["Toalha", "Casa", 29.9, 0.15])
    buf = io.BytesIO()
    wb.save(buf)
    r = client.post("/api/v1/imports/products", headers=AUTH,
                    files={"file": ("p.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert r.status_code == 200 and r.json()["rows_ok"] == 1


def test_import_rejects_missing_columns_and_bad_type(client):
    r = client.post("/api/v1/imports/products", headers=AUTH, files={"file": ("p.csv", b"foo,bar\n1,2\n", "text/csv")})
    assert r.status_code == 422
    r = client.post("/api/v1/imports/products", headers=AUTH, files={"file": ("p.txt", b"x", "text/plain")})
    assert r.status_code == 422
