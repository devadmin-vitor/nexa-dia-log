from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from app.api.deps import store_dep
from app.core.config import get_settings
from app.domain.models import AgentRunStatus, ApprovalStatus, DataSource, LogLevel
from app.services import analytics
from app.store.memory import MemoryStore

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _sources(source: str) -> set[DataSource] | None:
    if source == "real":
        return {DataSource.manual, DataSource.csv_import, DataSource.tiktok_api}
    if source == "simulated":
        return {DataSource.simulated}
    return None


@router.get("/overview")
def overview(days: int = Query(30, ge=1, le=365), source: str = Query("all", pattern="^(all|real|simulated)$"),
             store: MemoryStore = Depends(store_dep)):
    srcs = _sources(source)
    runs = store.list_runs(20)
    now = datetime.now(timezone.utc)
    settings = get_settings()
    return {
        "kpis": analytics.kpis(store, days, srcs),
        "series": analytics.daily_series(store, days, srcs),
        "top_products": analytics.by_product(store, days, srcs)[:5],
        "anomalies": analytics.detect_anomalies(store),
        "pending_approvals": sum(a.status == ApprovalStatus.pending for a in store.approvals.values()),
        "content_next_7d": sum(1 for c in store.list_content() if now <= c.scheduled_for <= now + timedelta(days=7)),
        "recent_runs": [r.model_dump(mode="json", exclude={"output"}) for r in runs[:8]],
        "failed_runs_recent": sum(r.status == AgentRunStatus.failed for r in runs),
        "recent_errors": [log.model_dump(mode="json") for log in store.list_logs(200) if log.level in (LogLevel.error, LogLevel.security)][:5],
        "ai_spend_today_usd": store.ai_spend_today_usd(),
        "daily_ai_budget_usd": settings.daily_ai_budget_usd,
        "ai_mode": "live" if settings.ai_live_enabled else "simulated",
        "kill_switch": store.system.model_dump(mode="json"),
        "data_sources_present": sorted({m.data_source.value for m in store.metrics} | {p.data_source.value for p in store.products.values()}),
    }


@router.get("/metrics")
def metrics(days: int = Query(30, ge=1, le=365), source: str = Query("all", pattern="^(all|real|simulated)$"),
            store: MemoryStore = Depends(store_dep)):
    srcs = _sources(source)
    return {"kpis": analytics.kpis(store, days, srcs), "series": analytics.daily_series(store, days, srcs),
            "by_product": analytics.by_product(store, days, srcs), "anomalies": analytics.detect_anomalies(store)}
