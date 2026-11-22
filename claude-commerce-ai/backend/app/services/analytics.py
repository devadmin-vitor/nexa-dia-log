"""Cálculos determinísticos de métricas e comissões (sem IA)."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from app.domain.models import DataSource, MetricSnapshot
from app.store.memory import MemoryStore


def _filter(store: MemoryStore, days: int, sources: set[DataSource] | None) -> list[MetricSnapshot]:
    start = date.today() - timedelta(days=days)
    return [m for m in store.metrics if m.day >= start and (sources is None or m.data_source in sources)]


def _ratios(views: int, clicks: int, orders: int, gmv: float, commission: float) -> dict:
    return {
        "ctr": round(clicks / views, 4) if views else 0.0,
        "conversion_rate": round(orders / clicks, 4) if clicks else 0.0,
        "epc_brl": round(commission / clicks, 4) if clicks else 0.0,  # ganho por clique
        "avg_order_brl": round(gmv / orders, 2) if orders else 0.0,
    }


def kpis(store: MemoryStore, days: int = 30, sources: set[DataSource] | None = None) -> dict:
    rows = _filter(store, days, sources)
    v = sum(r.views for r in rows)
    c = sum(r.clicks for r in rows)
    o = sum(r.orders for r in rows)
    g = round(sum(r.gmv_brl for r in rows), 2)
    cm = round(sum(r.commission_brl for r in rows), 2)
    return {"days": days, "views": v, "clicks": c, "orders": o, "gmv_brl": g, "commission_brl": cm, **_ratios(v, c, o, g, cm),
            "data_sources": sorted({r.data_source.value for r in rows})}


def daily_series(store: MemoryStore, days: int = 30, sources: set[DataSource] | None = None) -> list[dict]:
    agg: dict[date, dict] = defaultdict(lambda: {"views": 0, "clicks": 0, "orders": 0, "gmv_brl": 0.0, "commission_brl": 0.0})
    for r in _filter(store, days, sources):
        a = agg[r.day]
        a["views"] += r.views
        a["clicks"] += r.clicks
        a["orders"] += r.orders
        a["gmv_brl"] += r.gmv_brl
        a["commission_brl"] += r.commission_brl
    return [{"day": d.isoformat(), **{k: round(v, 2) if isinstance(v, float) else v for k, v in a.items()}} for d, a in sorted(agg.items())]


def by_product(store: MemoryStore, days: int = 30, sources: set[DataSource] | None = None) -> list[dict]:
    agg: dict[str, dict] = defaultdict(lambda: {"views": 0, "clicks": 0, "orders": 0, "gmv_brl": 0.0, "commission_brl": 0.0})
    for r in _filter(store, days, sources):
        if not r.product_id:
            continue
        a = agg[r.product_id]
        a["views"] += r.views
        a["clicks"] += r.clicks
        a["orders"] += r.orders
        a["gmv_brl"] += r.gmv_brl
        a["commission_brl"] += r.commission_brl
    out = []
    for pid, a in agg.items():
        p = store.products.get(pid)
        out.append({
            "product_id": pid,
            "product_name": p.name if p else pid,
            "commission_rate": p.commission_rate if p else None,
            "data_source": p.data_source.value if p else None,
            **{k: round(v, 2) for k, v in a.items()},
            **_ratios(a["views"], a["clicks"], a["orders"], a["gmv_brl"], a["commission_brl"]),
        })
    return sorted(out, key=lambda x: x["commission_brl"], reverse=True)


def detect_anomalies(store: MemoryStore, window: int = 7, drop_threshold: float = 0.3) -> list[dict]:
    """Compara a última janela com a anterior por produto; sinaliza quedas/altas relevantes."""
    today = date.today()
    cur_start, prev_start = today - timedelta(days=window), today - timedelta(days=2 * window)
    cur: dict[str, float] = defaultdict(float)
    prev: dict[str, float] = defaultdict(float)
    for r in store.metrics:
        if not r.product_id:
            continue
        if r.day >= cur_start:
            cur[r.product_id] += r.commission_brl
        elif r.day >= prev_start:
            prev[r.product_id] += r.commission_brl
    alerts = []
    for pid in set(cur) | set(prev):
        p_val, c_val = prev.get(pid, 0.0), cur.get(pid, 0.0)
        if p_val <= 0:
            continue
        change = (c_val - p_val) / p_val
        if change <= -drop_threshold or change >= 0.5:
            p = store.products.get(pid)
            alerts.append({
                "product_id": pid,
                "product_name": p.name if p else pid,
                "previous_brl": round(p_val, 2),
                "current_brl": round(c_val, 2),
                "change_pct": round(change * 100, 1),
                "type": "queda" if change < 0 else "alta",
            })
    return sorted(alerts, key=lambda a: a["change_pct"])
