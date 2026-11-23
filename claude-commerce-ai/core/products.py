"""Cadastro de produtos com deduplicação (external_id e URL)."""

from __future__ import annotations

from decimal import Decimal

import psycopg
from pydantic import BaseModel, Field, HttpUrl, field_validator

from core.audit import audit
from core.db import fetch_all, fetch_one

STATUSES = ("candidate", "approved", "active", "paused", "rejected")


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    category: str | None = Field(default=None, max_length=80)
    seller_name: str | None = Field(default=None, max_length=120)
    external_id: str | None = Field(default=None, max_length=120)
    product_url: HttpUrl | None = None
    price: Decimal | None = Field(default=None, ge=0)
    commission_rate: Decimal | None = Field(default=None, ge=0, le=1, description="0.12 = 12%")
    source: str = Field(default="manual", max_length=60)
    is_simulated: bool = False

    @field_validator("name", "category", "seller_name", "external_id")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return v.strip() if isinstance(v, str) else v


def save(conn: psycopg.Connection, product: ProductIn, *, actor: str) -> tuple[dict, bool]:
    """Insere o produto ou devolve o existente. Retorna (produto, criado?)."""
    url = str(product.product_url) if product.product_url else None
    existing = None
    if product.external_id:
        existing = fetch_one(conn, "select * from public.products where external_id = %s", (product.external_id,))
    if existing is None and url:
        existing = fetch_one(conn, "select * from public.products where lower(product_url) = lower(%s)", (url,))
    if existing:
        return existing, False
    row = fetch_one(
        conn,
        """
        insert into public.products (name, category, seller_name, external_id, product_url, price,
                                     commission_rate, commission_value, source, source_updated_at, is_simulated)
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, now(), %s)
        returning *
        """,
        (product.name, product.category, product.seller_name, product.external_id, url, product.price,
         product.commission_rate,
         (product.price * product.commission_rate).quantize(Decimal("0.01"))
         if product.price is not None and product.commission_rate is not None else None,
         product.source, product.is_simulated),
    )
    audit(conn, actor, "product.created", details={"product_id": str(row["id"]), "source": product.source})
    return row, True


def list_products(conn: psycopg.Connection, limit: int = 200) -> list[dict]:
    return fetch_all(conn, "select * from public.products order by score desc nulls last, created_at desc limit %s", (limit,))


def set_status(conn: psycopg.Connection, product_id: str, status: str, *, actor: str) -> dict | None:
    row = fetch_one(conn, "update public.products set status = %s where id = %s returning *", (status, product_id))
    if row:
        audit(conn, actor, "product.status_changed", details={"product_id": product_id, "status": status})
    return row
