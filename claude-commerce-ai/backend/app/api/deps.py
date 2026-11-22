from __future__ import annotations

from app.agents.base import AgentContext
from app.agents.orchestrator import Orchestrator
from app.core.config import get_settings
from app.services.llm import ClaudeClient
from app.store.memory import MemoryStore, get_store

_llm_override: ClaudeClient | None = None


def set_llm_override(client: ClaudeClient | None) -> None:
    """Usado nos testes para injetar um cliente Claude falso."""
    global _llm_override
    _llm_override = client


def store_dep() -> MemoryStore:
    return get_store()


def ctx_dep() -> AgentContext:
    store = get_store()
    llm = _llm_override or ClaudeClient(store, get_settings())
    return AgentContext(store=store, llm=llm, settings=get_settings())


def orchestrator_dep() -> Orchestrator:
    return Orchestrator(ctx_dep())
