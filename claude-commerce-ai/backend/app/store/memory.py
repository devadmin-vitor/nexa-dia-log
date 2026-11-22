"""Repositório em memória (Fase 1).

A interface é mínima de propósito: na Fase 2 uma implementação Supabase/PostgreSQL
substitui esta classe mantendo os mesmos métodos. Dados em memória são perdidos ao reiniciar.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Iterable

from app.domain.models import (
    AgentRun,
    ApprovalRequest,
    AuditLog,
    ContentItem,
    ImportBatch,
    LogLevel,
    MetricSnapshot,
    Product,
    ScheduledTask,
    SystemState,
)


class MemoryStore:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.products: dict[str, Product] = {}
        self.content: dict[str, ContentItem] = {}
        self.metrics: list[MetricSnapshot] = []
        self.agent_runs: dict[str, AgentRun] = {}
        self.approvals: dict[str, ApprovalRequest] = {}
        self.logs: list[AuditLog] = []
        self.tasks: dict[str, ScheduledTask] = {}
        self.imports: dict[str, ImportBatch] = {}
        self.system = SystemState()
        self.pipeline_runs: dict[str, dict] = {}

    @property
    def lock(self) -> threading.RLock:
        return self._lock

    # ---- produtos
    def upsert_product(self, p: Product) -> Product:
        with self._lock:
            p.updated_at = datetime.now(timezone.utc)
            self.products[p.id] = p
            return p

    def list_products(self) -> list[Product]:
        return sorted(self.products.values(), key=lambda p: (p.score is None, -(p.score or 0), p.name))

    # ---- conteúdo
    def upsert_content(self, c: ContentItem) -> ContentItem:
        with self._lock:
            c.updated_at = datetime.now(timezone.utc)
            self.content[c.id] = c
            return c

    def list_content(self) -> list[ContentItem]:
        return sorted(self.content.values(), key=lambda c: c.scheduled_for)

    # ---- métricas
    def add_metrics(self, items: Iterable[MetricSnapshot]) -> int:
        with self._lock:
            items = list(items)
            self.metrics.extend(items)
            return len(items)

    # ---- execuções
    def save_run(self, run: AgentRun) -> AgentRun:
        with self._lock:
            self.agent_runs[run.id] = run
            return run

    def list_runs(self, limit: int = 100) -> list[AgentRun]:
        return sorted(self.agent_runs.values(), key=lambda r: r.started_at, reverse=True)[:limit]

    def ai_spend_today_usd(self) -> float:
        today = datetime.now(timezone.utc).date()
        return round(
            sum(r.cost_usd for r in self.agent_runs.values() if r.started_at.date() == today and r.mode == "live"),
            6,
        )

    # ---- aprovações
    def save_approval(self, a: ApprovalRequest) -> ApprovalRequest:
        with self._lock:
            self.approvals[a.id] = a
            return a

    def list_approvals(self) -> list[ApprovalRequest]:
        return sorted(self.approvals.values(), key=lambda a: a.requested_at, reverse=True)

    # ---- logs
    def log(
        self,
        actor: str,
        action: str,
        *,
        entity_type: str | None = None,
        entity_id: str | None = None,
        level: LogLevel = LogLevel.info,
        details: dict | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            level=level,
            details=details or {},
        )
        with self._lock:
            self.logs.append(entry)
            if len(self.logs) > 5000:
                self.logs = self.logs[-5000:]
        return entry

    def list_logs(self, limit: int = 200) -> list[AuditLog]:
        return list(reversed(self.logs[-limit:]))


_store: MemoryStore | None = None


def get_store() -> MemoryStore:
    global _store
    if _store is None:
        _store = MemoryStore()
    return _store


def reset_store() -> MemoryStore:
    global _store
    _store = MemoryStore()
    return _store
