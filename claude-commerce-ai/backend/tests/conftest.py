import os

import pytest

# Ambiente de teste determinístico: sem chave, IA simulada, tokens definidos.
os.environ.pop("ANTHROPIC_API_KEY", None)
os.environ.update({
    "APP_ENV": "test",
    "AI_MODE": "simulated",
    "BACKEND_API_TOKEN": "test-api-token",
    "SCHEDULER_TOKEN": "test-scheduler-token",
    "DAILY_AI_BUDGET_USD": "1.0",
})

from fastapi.testclient import TestClient  # noqa: E402

from app.api import deps  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.store.memory import reset_store  # noqa: E402
from app.store.seed import seed_simulated  # noqa: E402

AUTH = {"X-API-Key": "test-api-token"}


@pytest.fixture
def store():
    get_settings.cache_clear()
    s = reset_store()
    seed_simulated(s)
    deps.set_llm_override(None)
    yield s
    deps.set_llm_override(None)


@pytest.fixture
def client(store):
    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c
