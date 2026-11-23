from __future__ import annotations

from typing import Iterator

import psycopg

from core import db


def get_conn() -> Iterator[psycopg.Connection]:
    """Uma transação por requisição: commit no sucesso, rollback em erro."""
    with db.connection() as conn:
        yield conn
