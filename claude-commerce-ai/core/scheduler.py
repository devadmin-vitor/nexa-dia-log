"""Rotinas agendadas.

O n8n é o relógio (Schedule Trigger) e chama POST /api/v1/scheduler/trigger/{job}.
O backend transforma o disparo em uma tarefa do orquestrador, com chave de idempotência
por janela de tempo — disparos repetidos na mesma janela não duplicam trabalho.

Sprint 1: as tarefas são enfileiradas e auditadas. O worker que as executa chega na Sprint 2.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

import psycopg

from core import task_manager
from core.errors import NotFound

TZ = ZoneInfo("America/Sao_Paulo")


@dataclass(frozen=True)
class Job:
    key: str
    name: str
    cron: str  # horário de São Paulo (configurado no n8n)
    window: str  # granularidade da idempotência: "day" | "hour"
    workflow_file: str


JOBS: dict[str, Job] = {
    j.key: j
    for j in (
        Job("daily_operations", "Operação diária", "0 7 * * *", "day", "workflows/daily_operations.json"),
        Job("product_research", "Pesquisa de produtos", "15 7 * * *", "day", "workflows/product_research.json"),
        Job("content_factory", "Fábrica de conteúdo", "0 9 * * *", "day", "workflows/content_factory.json"),
        Job("publishing_queue", "Fila de publicação", "0 */2 * * *", "hour", "workflows/publishing_queue.json"),
        Job("financial_report", "Relatório financeiro", "30 20 * * *", "day", "workflows/financial_report.json"),
    )
}


def idempotency_key(job: Job, now: datetime | None = None) -> str:
    now = (now or datetime.now(TZ)).astimezone(TZ)
    stamp = now.strftime("%Y-%m-%d") if job.window == "day" else now.strftime("%Y-%m-%dT%H")
    return f"schedule:{job.key}:{stamp}"


def trigger(conn: psycopg.Connection, job_key: str, *, now: datetime | None = None) -> dict:
    job = JOBS.get(job_key)
    if not job:
        raise NotFound(f"Rotina '{job_key}' não existe")
    task = task_manager.enqueue(
        conn,
        agent_key="operations_director",
        task_type=f"scheduled.{job.key}",
        payload={"job": job.key},
        priority=3,
        idempotency_key=idempotency_key(job, now),
        requested_by="scheduler",
    )
    return {"job": job.key, "task_id": str(task["id"]), "deduplicated": task["deduplicated"],
            "status": task["status"], "note": "Tarefa enfileirada; execução automática disponível a partir da Sprint 2."}
