from __future__ import annotations

from typing import Any

from app.agents.base import Agent, AgentContext
from app.core.errors import CommerceError, NotFound
from app.domain.models import ActionType, ContentStatus, Script


class Scriptwriter(Agent[Script]):
    key = "scriptwriter"
    name = "Roteirista"
    description = "Gera roteiros de vídeos curtos e lives usando apenas fatos verificados do produto."
    responsibilities = [
        "Escrever gancho, desenvolvimento e chamada para ação",
        "Incluir divulgação clara de conteúdo de afiliado",
        "Listar exatamente as alegações usadas (claims_used) para auditoria",
    ]
    allowed_actions = [ActionType.read, ActionType.internal_write]
    output_model = Script
    instructions = (
        "Escreva um roteiro curto (até 45 segundos) para o conteúdo informado. "
        "Use SOMENTE alegações presentes em verified_claims e copie-as literalmente em claims_used. "
        "Se sample_received=false, não descreva uso pessoal, teste ou demonstração do produto. "
        "Se media_rights_confirmed=false, não sugira usar vídeos/imagens do vendedor. "
        "Proibido: depoimentos inventados, promessas de resultado, urgência falsa, comparações sem prova. "
        "O campo disclosure deve conter '#publi' e mencionar link de afiliado."
    )

    def build_context(self, ctx: AgentContext, params: dict[str, Any]) -> dict[str, Any]:
        cid = params.get("content_id")
        content = ctx.store.content.get(cid) if cid else None
        if not content:
            raise NotFound("content_id inválido ou ausente")
        if content.status in (ContentStatus.approved, ContentStatus.published_manual):
            raise CommerceError("Conteúdo já aprovado/publicado; não será reescrito")
        p = ctx.store.products[content.product_id]
        return {
            "content": {"title": content.title, "format": content.format.value, "angle": content.angle},
            "product": {"name": p.name, "category": p.category, "price_brl": p.price_brl,
                        "verified_claims": p.verified_claims, "sample_received": p.sample_received,
                        "media_rights_confirmed": p.media_rights_confirmed, "data_source": p.data_source.value},
        }

    def simulate(self, ctx, context, params) -> Script:
        p = context["product"]
        claims = p["verified_claims"][:2]
        body = [f"Um ponto objetivo: {c.lower()}." for c in claims] or ["Confira as especificações na página do produto."]
        if p["sample_received"]:
            shots = ["Plano aberto mostrando o produto real", "Close nos detalhes", "Mostrar o link na tela"]
        else:
            shots = ["Texto na tela com as especificações oficiais", "Mostrar o link na tela"]
        return Script(
            hook=f"Você conhece o {p['name']}? Vou te mostrar o que ele oferece, sem exagero.",
            body=body + ["Preço e condições podem mudar; confira na página antes de comprar."],
            call_to_action="Se fizer sentido para você, o link está no carrinho do vídeo.",
            disclosure="#publi — este vídeo contém link de afiliado; posso receber comissão por compras.",
            claims_used=claims,
            shot_list=shots,
        )

    def apply(self, ctx, output, params) -> dict[str, Any]:
        content = ctx.store.content[params["content_id"]]
        content.script = output
        content.status = ContentStatus.scripted
        content.compliance_passed = None
        content.compliance_issues = []
        ctx.store.upsert_content(content)
        return {"content_id": content.id, "status": content.status.value}
