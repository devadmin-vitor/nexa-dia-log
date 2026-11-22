from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.agents.base import Agent, AgentContext
from app.domain.models import ActionType, ContentFormat, ContentItem, ProductClass, ProductStatus


class PlannedItem(BaseModel):
    product_id: str
    title: str
    format: Literal["short_video", "live", "carousel"]
    angle: str
    day_offset: int = Field(ge=0, le=13)
    hour: int = Field(ge=6, le=23)


class ContentPlanOutput(BaseModel):
    summary: str
    items: list[PlannedItem]


class ContentPlanner(Agent[ContentPlanOutput]):
    key = "content_planner"
    name = "Planejador Editorial"
    description = "Monta o calendário editorial dos próximos dias priorizando produtos classe A/B."
    responsibilities = [
        "Distribuir conteúdos por dia/horário sem conflitos",
        "Escolher formato e ângulo honesto para cada produto",
        "Criar itens de calendário no status 'ideia' (escrita interna)",
    ]
    allowed_actions = [ActionType.read, ActionType.internal_write]
    output_model = ContentPlanOutput
    instructions = (
        "Planeje até 2 conteúdos por dia para os próximos 7 dias (day_offset 0-6), evitando horários já ocupados. "
        "Prefira produtos classe A. Ângulos de demonstração/unboxing só para produtos com sample_received=true. "
        "Use apenas product_id do contexto."
    )

    def build_context(self, ctx: AgentContext, params: dict[str, Any]) -> dict[str, Any]:
        horizon = datetime.now(timezone.utc) + timedelta(days=7)
        return {
            "today": date.today().isoformat(),
            "products": [
                {"product_id": p.id, "name": p.name, "classification": p.classification.value if p.classification else None,
                 "score": p.score, "sample_received": p.sample_received, "data_source": p.data_source.value}
                for p in ctx.store.list_products()
                if p.status in (ProductStatus.active, ProductStatus.approved, ProductStatus.candidate)
                and p.classification != ProductClass.C
            ],
            "occupied_slots": [c.scheduled_for.isoformat() for c in ctx.store.list_content() if c.scheduled_for <= horizon],
        }

    def simulate(self, ctx, context, params) -> ContentPlanOutput:
        occupied = set(context["occupied_slots"])
        prods = sorted(context["products"], key=lambda p: -(p["score"] or 0))[:5]
        items = []
        for i, p in enumerate(prods):
            for d in range(7):
                hour = 21 if i % 2 == 0 else 17
                dt = datetime.combine(date.today() + timedelta(days=d), time(hour), tzinfo=timezone.utc).isoformat()
                if dt not in occupied:
                    occupied.add(dt)
                    angle = "Unboxing com amostra" if p["sample_received"] else "Perguntas frequentes sobre o produto"
                    items.append(PlannedItem(product_id=p["product_id"], title=f"{angle}: {p['name']}",
                                             format="short_video", angle=angle, day_offset=d, hour=hour))
                    break
        return ContentPlanOutput(summary=f"{len(items)} novos conteúdos propostos (modo simulado).", items=items)

    def postprocess(self, ctx, output, context, params):
        valid = {p["product_id"]: p for p in context["products"]}
        kept = []
        for it in output.items:
            p = valid.get(it.product_id)
            if not p:
                continue
            if not p["sample_received"] and any(k in it.angle.lower() for k in ("unboxing", "demonstra", "testando")):
                it.angle = "Perguntas frequentes sobre o produto"  # sem amostra: sem demonstração
            kept.append(it)
        output.items = kept
        return output

    def apply(self, ctx, output, params) -> dict[str, Any]:
        occupied = {c.scheduled_for for c in ctx.store.list_content()}
        created = []
        for it in output.items:
            dt = datetime.combine(date.today() + timedelta(days=it.day_offset), time(it.hour), tzinfo=timezone.utc)
            if dt in occupied:
                continue
            occupied.add(dt)
            c = ctx.store.upsert_content(ContentItem(
                product_id=it.product_id, title=it.title, format=ContentFormat(it.format), angle=it.angle,
                scheduled_for=dt, created_by_agent=self.key,
                data_source=ctx.store.products[it.product_id].data_source,
            ))
            created.append(c.id)
        return {"content_created": len(created), "content_ids": created}
