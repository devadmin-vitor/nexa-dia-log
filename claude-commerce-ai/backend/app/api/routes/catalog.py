from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.api.deps import store_dep
from app.core.errors import NotFound
from app.domain.models import (
    ContentFormat,
    ContentItem,
    ContentStatus,
    DataSource,
    Product,
    ProductCreate,
    ProductStatus,
)
from app.services import importer
from app.store.memory import MemoryStore

router = APIRouter(tags=["catalog"])


@router.get("/products")
def list_products(store: MemoryStore = Depends(store_dep)):
    return [p.model_dump(mode="json") for p in store.list_products()]


@router.post("/products", status_code=201)
def create_product(body: ProductCreate, store: MemoryStore = Depends(store_dep)):
    p = store.upsert_product(Product(**body.model_dump(), data_source=DataSource.manual))
    store.log("operator", "product.created", entity_type="product", entity_id=p.id)
    return p.model_dump(mode="json")


class ProductStatusUpdate(BaseModel):
    status: ProductStatus


@router.patch("/products/{product_id}/status")
def update_product_status(product_id: str, body: ProductStatusUpdate, store: MemoryStore = Depends(store_dep)):
    p = store.products.get(product_id)
    if not p:
        raise NotFound("Produto não encontrado")
    p.status = body.status
    store.upsert_product(p)
    store.log("operator", "product.status_changed", entity_type="product", entity_id=p.id, details={"status": body.status})
    return p.model_dump(mode="json")


@router.get("/content")
def list_content(store: MemoryStore = Depends(store_dep)):
    out = []
    for c in store.list_content():
        d = c.model_dump(mode="json")
        p = store.products.get(c.product_id)
        d["product_name"] = p.name if p else None
        out.append(d)
    return out


class ContentCreate(BaseModel):
    product_id: str
    title: str = Field(min_length=3, max_length=200)
    format: ContentFormat = ContentFormat.short_video
    angle: str | None = None
    scheduled_for: datetime


@router.post("/content", status_code=201)
def create_content(body: ContentCreate, store: MemoryStore = Depends(store_dep)):
    if body.product_id not in store.products:
        raise NotFound("Produto não encontrado")
    c = store.upsert_content(ContentItem(**body.model_dump(), data_source=DataSource.manual))
    store.log("operator", "content.created", entity_type="content", entity_id=c.id)
    return c.model_dump(mode="json")


@router.post("/content/{content_id}/mark-published")
def mark_published(content_id: str, store: MemoryStore = Depends(store_dep)):
    c = store.content.get(content_id)
    if not c:
        raise NotFound("Conteúdo não encontrado")
    if c.status != ContentStatus.approved:
        raise HTTPException(409, "Somente conteúdo aprovado pode ser marcado como publicado")
    c.status = ContentStatus.published_manual
    store.upsert_content(c)
    store.log("operator", "content.marked_published", entity_type="content", entity_id=c.id)
    return c.model_dump(mode="json")


@router.post("/imports/{kind}")
async def import_file(kind: str, file: UploadFile = File(...), store: MemoryStore = Depends(store_dep)):
    if kind not in ("products", "metrics"):
        raise HTTPException(404, "Tipo de importação inválido (products|metrics)")
    content = await file.read(importer.MAX_BYTES + 1)
    try:
        fn = importer.import_products if kind == "products" else importer.import_metrics
        batch = fn(store, file.filename or "arquivo", content)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    return batch.model_dump(mode="json")


@router.get("/imports")
def list_imports(store: MemoryStore = Depends(store_dep)):
    return [b.model_dump(mode="json") for b in sorted(store.imports.values(), key=lambda b: b.created_at, reverse=True)]
