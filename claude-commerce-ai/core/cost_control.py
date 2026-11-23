"""Controle de custos de API (orçamento em BRL).

- Preços da Claude API em USD por 1M tokens (atualize se a tabela oficial mudar).
- Conversão USD→BRL pela variável USD_BRL_RATE (obrigatória para chamadas reais: sem ela
  o sistema não consegue medir o orçamento e bloqueia as chamadas).
- Limites: DAILY_API_BUDGET_BRL (por dia, fuso America/Sao_Paulo) e MONTHLY_BUDGET_BRL (mês corrente).
"""

from __future__ import annotations

from decimal import Decimal

import psycopg

from core.config import get_settings
from core.db import fetch_one
from core.errors import BudgetExceeded, NotConfigured

# (entrada, saída) em USD por 1M tokens
PRICING_USD_PER_MTOK: dict[str, tuple[float, float]] = {
    "claude-fable-5-2": (8.0, 40.0),
    "claude-opus-5-5": (4.0, 20.0),
    "claude-opus-5": (5.0, 25.0),
    "claude-opus-4-8": (5.0, 25.0),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-haiku-5-5": (0.10, 0.50),
}
UNKNOWN_MODEL_PRICE = (8.0, 40.0)  # conservador: superestima para não estourar o orçamento


def estimate_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    pin, pout = PRICING_USD_PER_MTOK.get(model, UNKNOWN_MODEL_PRICE)
    return round(input_tokens / 1e6 * pin + output_tokens / 1e6 * pout, 6)


def usd_to_brl(usd: float) -> float:
    rate = get_settings().usd_brl_rate
    if rate <= 0:
        raise NotConfigured("USD_BRL_RATE não configurada: impossível controlar o orçamento em reais")
    return round(usd * rate, 4)


def spend_brl(conn: psycopg.Connection) -> dict:
    row = fetch_one(
        conn,
        """
        select
          coalesce(sum(estimated_cost_brl) filter (
            where (created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date), 0) as today,
          coalesce(sum(estimated_cost_brl) filter (
            where date_trunc('month', created_at at time zone 'America/Sao_Paulo')
                = date_trunc('month', now() at time zone 'America/Sao_Paulo')), 0) as month
        from public.cost_usage
        """,
    )
    return {"today_brl": float(row["today"]), "month_brl": float(row["month"])}


def budget_status(conn: psycopg.Connection) -> dict:
    s = get_settings()
    spent = spend_brl(conn)
    return {
        **spent,
        "daily_limit_brl": s.daily_api_budget_brl,
        "monthly_limit_brl": s.monthly_budget_brl,
        "daily_remaining_brl": round(max(0.0, s.daily_api_budget_brl - spent["today_brl"]), 4),
        "monthly_remaining_brl": round(max(0.0, s.monthly_budget_brl - spent["month_brl"]), 4),
        "usd_brl_rate": s.usd_brl_rate or None,
    }


def ensure_within_budget(conn: psycopg.Connection) -> None:
    s = get_settings()
    if s.usd_brl_rate <= 0:
        raise NotConfigured("USD_BRL_RATE não configurada: chamadas pagas bloqueadas")
    spent = spend_brl(conn)
    if spent["today_brl"] >= s.daily_api_budget_brl:
        raise BudgetExceeded(f"Limite diário de API atingido (R$ {spent['today_brl']:.2f} / R$ {s.daily_api_budget_brl:.2f})")
    if spent["month_brl"] >= s.monthly_budget_brl:
        raise BudgetExceeded(f"Orçamento mensal atingido (R$ {spent['month_brl']:.2f} / R$ {s.monthly_budget_brl:.2f})")


def record_usage(
    conn: psycopg.Connection,
    *,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    agent_key: str | None = None,
    task_id: str | None = None,
) -> dict:
    usd = estimate_usd(model, input_tokens, output_tokens)
    brl = usd_to_brl(usd)
    conn.execute(
        "insert into public.cost_usage (provider, model, task_id, agent_key, input_tokens, output_tokens, "
        "estimated_cost_usd, estimated_cost_brl) values (%s, %s, %s, %s, %s, %s, %s, %s)",
        (provider, model, task_id, agent_key, input_tokens, output_tokens, Decimal(str(usd)), Decimal(str(brl))),
    )
    return {"usd": usd, "brl": brl}
