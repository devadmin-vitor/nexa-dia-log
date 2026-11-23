"""A API deve subir e responder com clareza mesmo sem banco, Redis ou n8n."""

import pytest
from fastapi.testclient import TestClient

from tests.conftest import AUTH


@pytest.fixture
def offline_client(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:1/postgres")
    from apps.api.main import create_app

    with TestClient(create_app()) as c:
        yield c


def test_liveness_is_public(offline_client):
    r = offline_client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "online"


def test_services_requires_token(offline_client):
    assert offline_client.get("/health/services").status_code == 401
    assert offline_client.get("/health/services", headers={"X-API-Key": "errado"}).status_code == 401


def test_services_report_down_without_crashing(offline_client):
    r = offline_client.get("/health/services", headers=AUTH)
    assert r.status_code == 503
    body = r.json()
    status = {s["key"]: s["status"] for s in body["services"]}
    assert body["ok"] is False
    assert status["database"] == "down"
    assert status["redis"] == "down"
    assert status["n8n"] == "down"
    assert status["supabase_api"] == "down"
    assert status["agents_registry"] == "ok"
    assert status["tiktok"] == "not_configured"
    assert status["claude"] == "not_configured"
    assert "test-api-token" not in r.text and "postgres:postgres" not in r.text


def test_scheduler_rejects_wrong_token(offline_client):
    r = offline_client.post("/api/v1/scheduler/trigger/daily_operations", headers={"X-Scheduler-Token": "test-api-token"})
    assert r.status_code == 401
