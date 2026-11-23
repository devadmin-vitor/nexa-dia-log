"""Acesso ao PostgreSQL (Supabase local) via psycopg 3.

Agentes não usam este módulo diretamente: toda leitura/gravação passa por funções do
backend (core/*) que validam permissões e registram auditoria.
"""

from __future__ import annotations

import atexit
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from core.config import get_settings

_pool: ConnectionPool | None = None


def init_pool(url: str | None = None, *, min_size: int = 1, max_size: int = 5) -> ConnectionPool:
    global _pool
    if _pool is None:
        conninfo = url or get_settings().database_url.get_secret_value()
        _pool = ConnectionPool(
            conninfo,
            min_size=min_size,
            max_size=max_size,
            kwargs={"row_factory": dict_row, "autocommit": False},
            open=False,
        )
        _pool.open(wait=False)
        atexit.register(close_pool)
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def connection() -> Iterator[psycopg.Connection]:
    """Conexão transacional: commit ao sair sem erro, rollback em exceção."""
    pool = init_pool()
    with pool.connection(timeout=5) as conn:
        yield conn


def fetch_all(conn: psycopg.Connection, sql: str, params: Any = None) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def fetch_one(conn: psycopg.Connection, sql: str, params: Any = None) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def execute(conn: psycopg.Connection, sql: str, params: Any = None) -> int:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.rowcount


def ping(url: str | None = None, timeout: int = 3) -> dict:
    """Verificação de saúde independente do pool."""
    conninfo = url or get_settings().database_url.get_secret_value()
    with psycopg.connect(conninfo, connect_timeout=timeout, row_factory=dict_row) as conn:
        row = conn.execute(
            "select version() as version, "
            "(select count(*) from information_schema.tables where table_schema = 'public') as public_tables"
        ).fetchone()
        return dict(row)


__all__ = ["Jsonb", "connection", "fetch_all", "fetch_one", "execute", "ping", "init_pool", "close_pool"]
