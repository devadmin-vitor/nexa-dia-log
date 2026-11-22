"""Importação alternativa de relatórios CSV/XLSX exportados manualmente pelo operador.

Não há scraping: o operador baixa o relatório no painel oficial e envia o arquivo.
Os nomes das colunas dos relatórios oficiais do TikTok Shop devem ser confirmados no arquivo
real; por isso aceitamos aliases e o modelo em docs/templates/.
"""

from __future__ import annotations

import csv
import io
import unicodedata
from datetime import date, datetime
from typing import Iterable

from app.domain.models import DataSource, ImportBatch, MetricSnapshot, Product
from app.store.memory import MemoryStore

MAX_BYTES = 5 * 1024 * 1024
MAX_ROWS = 20000


def _key(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s).strip().lower())
    return "".join(c for c in s if not unicodedata.combining(c)).replace(" ", "_").replace("-", "_")


PRODUCT_ALIASES = {
    "name": {"name", "nome", "produto", "product_name", "nome_do_produto"},
    "category": {"category", "categoria"},
    "price_brl": {"price", "preco", "price_brl", "preco_brl"},
    "commission_rate": {"commission_rate", "comissao", "taxa_de_comissao", "commission", "comissao_pct"},
    "seller_name": {"seller", "seller_name", "vendedor", "loja"},
    "external_product_id": {"product_id", "id_produto", "external_product_id", "sku"},
}

METRIC_ALIASES = {
    "day": {"day", "date", "data", "dia"},
    "external_product_id": {"product_id", "id_produto", "external_product_id", "sku"},
    "views": {"views", "visualizacoes", "impressions", "impressoes"},
    "clicks": {"clicks", "cliques"},
    "orders": {"orders", "pedidos", "vendas"},
    "gmv_brl": {"gmv", "gmv_brl", "receita", "faturamento"},
    "commission_brl": {"commission_brl", "comissao_brl", "comissao_estimada", "estimated_commission", "comissao"},
}


def _map_headers(headers: list[str], aliases: dict[str, set[str]]) -> dict[str, int]:
    keys = [_key(h) for h in headers]
    mapping: dict[str, int] = {}
    for field, names in aliases.items():
        for i, k in enumerate(keys):
            if k in names:
                mapping[field] = i
                break
    return mapping


def _num(v) -> float:
    if v is None or v == "":
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("R$", "").replace("%", "").replace(" ", "")
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    return float(s)


def _date(v) -> date:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"data inválida: {s}")


def read_rows(filename: str, content: bytes) -> list[list]:
    if len(content) > MAX_BYTES:
        raise ValueError("Arquivo excede 5 MB")
    name = filename.lower()
    if name.endswith(".csv"):
        text = content.decode("utf-8-sig", errors="replace")
        dialect = csv.Sniffer().sniff(text[:2048], delimiters=",;\t") if text.strip() else csv.excel
        return [row for row in csv.reader(io.StringIO(text), dialect)]
    if name.endswith(".xlsx"):
        from openpyxl import load_workbook

        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        return [list(r) for r in ws.iter_rows(values_only=True)]
    raise ValueError("Formato não suportado (use .csv ou .xlsx)")


def _rows(rows: list[list]) -> tuple[list[str], Iterable[tuple[int, list]]]:
    rows = [r for r in rows if r and any(c not in (None, "") for c in r)]
    if not rows:
        raise ValueError("Arquivo vazio")
    if len(rows) - 1 > MAX_ROWS:
        raise ValueError(f"Máximo de {MAX_ROWS} linhas por arquivo")
    return [str(h or "") for h in rows[0]], enumerate(rows[1:], start=2)


def import_products(store: MemoryStore, filename: str, content: bytes) -> ImportBatch:
    batch = ImportBatch(filename=filename, kind="products")
    headers, body = _rows(read_rows(filename, content))
    m = _map_headers(headers, PRODUCT_ALIASES)
    missing = [f for f in ("name", "category", "price_brl", "commission_rate") if f not in m]
    if missing:
        raise ValueError(f"Colunas obrigatórias ausentes: {', '.join(missing)}")
    for line, row in body:
        batch.rows_total += 1
        try:
            get = lambda f: row[m[f]] if f in m and m[f] < len(row) else None  # noqa: E731
            rate = _num(get("commission_rate"))
            if rate > 1:
                rate = rate / 100  # aceita "12" ou "12%"
            p = Product(
                name=str(get("name")).strip(),
                category=str(get("category")).strip(),
                price_brl=_num(get("price_brl")),
                commission_rate=rate,
                seller_name=(str(get("seller_name")).strip() if get("seller_name") else None),
                external_product_id=(str(get("external_product_id")).strip() if get("external_product_id") else None),
                data_source=DataSource.csv_import,
                notes=f"Importado de {filename} (lote {batch.id[:8]})",
            )
            store.upsert_product(p)
            batch.rows_ok += 1
        except Exception as e:  # noqa: BLE001 — erro reportado por linha
            batch.rows_error += 1
            if len(batch.errors) < 50:
                batch.errors.append(f"linha {line}: {e}")
    store.imports[batch.id] = batch
    store.log("operator", "import.products", entity_type="import", entity_id=batch.id,
              details={"ok": batch.rows_ok, "error": batch.rows_error, "file": filename})
    return batch


def import_metrics(store: MemoryStore, filename: str, content: bytes) -> ImportBatch:
    batch = ImportBatch(filename=filename, kind="metrics")
    headers, body = _rows(read_rows(filename, content))
    m = _map_headers(headers, METRIC_ALIASES)
    if "day" not in m:
        raise ValueError("Coluna de data obrigatória ausente (day/data)")
    by_ext = {p.external_product_id: p.id for p in store.products.values() if p.external_product_id}
    snaps: list[MetricSnapshot] = []
    for line, row in body:
        batch.rows_total += 1
        try:
            get = lambda f: row[m[f]] if f in m and m[f] < len(row) else None  # noqa: E731
            ext = str(get("external_product_id")).strip() if get("external_product_id") else None
            snaps.append(MetricSnapshot(
                day=_date(get("day")),
                product_id=by_ext.get(ext) if ext else None,
                views=int(_num(get("views"))),
                clicks=int(_num(get("clicks"))),
                orders=int(_num(get("orders"))),
                gmv_brl=_num(get("gmv_brl")),
                commission_brl=_num(get("commission_brl")),
                data_source=DataSource.csv_import,
                import_batch_id=batch.id,
            ))
            batch.rows_ok += 1
            if ext and ext not in by_ext and len(batch.errors) < 50:
                batch.errors.append(f"linha {line}: produto '{ext}' não cadastrado (métrica gravada sem vínculo)")
        except Exception as e:  # noqa: BLE001
            batch.rows_error += 1
            if len(batch.errors) < 50:
                batch.errors.append(f"linha {line}: {e}")
    store.add_metrics(snaps)
    store.imports[batch.id] = batch
    store.log("operator", "import.metrics", entity_type="import", entity_id=batch.id,
              details={"ok": batch.rows_ok, "error": batch.rows_error, "file": filename})
    return batch
