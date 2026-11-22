from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.agents.base import Agent, AgentContext
from app.core.errors import CommerceError, NotFound
from app.domain.models import ActionType, ComplianceIssue, ContentStatus
from app.services import compliance_rules
from app.services.approvals import request_approval


class ComplianceReviewOutput(BaseModel):
    approved: bool
    issues: list[ComplianceIssue]
    suggestions: list[str]


class ComplianceReviewer(Agent[ComplianceReviewOutput]):
    key = "compliance_reviewer"
    name = "Revisor de Conformidade"
    description = "Revisa roteiros contra regras de publicidade honesta, direitos de mídia e divulgação de afiliado."
    responsibilities = [
        "Aplicar regras determinísticas obrigatórias (sempre)",
        "Complementar com análise da IA para nuances",
        "Bloquear conteúdo com problema grave; aprovado segue para aprovação humana de publicação",
    ]
    allowed_actions = [ActionType.read, ActionType.internal_write, ActionType.publish_content]
    output_model = ComplianceReviewOutput
    instructions = (
        "Revise o roteiro. Aponte alegações enganosas, ausência de divulgação, depoimentos não verificáveis, "
        "demonstrações sem amostra física e uso de mídia sem direitos. Severidade: low, medium ou high. "
        "Seja rigoroso: na dúvida, sinalize."
    )

    def build_context(self, ctx: AgentContext, params: dict[str, Any]) -> dict[str, Any]:
        content = ctx.store.content.get(params.get("content_id", ""))
        if not content:
            raise NotFound("content_id inválido ou ausente")
        if not content.script:
            raise CommerceError("Conteúdo sem roteiro para revisar")
        p = ctx.store.products[content.product_id]
        return {
            "script": content.script.model_dump(),
            "product": {"name": p.name, "verified_claims": p.verified_claims, "sample_received": p.sample_received,
                        "media_rights_confirmed": p.media_rights_confirmed},
        }

    def simulate(self, ctx, context, params) -> ComplianceReviewOutput:
        return ComplianceReviewOutput(approved=True, issues=[], suggestions=["Revisão por IA não executada (modo simulado); apenas regras determinísticas."])

    def postprocess(self, ctx, output, context, params):
        content = ctx.store.content[params["content_id"]]
        product = ctx.store.products[content.product_id]
        rule_issues = compliance_rules.check_script(content.script, product)
        seen = {(i.rule, i.detail) for i in output.issues}
        output.issues.extend(i for i in rule_issues if (i.rule, i.detail) not in seen)
        # Regras determinísticas prevalecem sobre a opinião da IA.
        output.approved = output.approved and not compliance_rules.blocking(output.issues)
        return output

    def apply(self, ctx, output, params) -> dict[str, Any]:
        content = ctx.store.content[params["content_id"]]
        content.compliance_issues = output.issues
        content.compliance_passed = output.approved
        effects: dict[str, Any] = {"content_id": content.id}
        if output.approved:
            content.status = ContentStatus.in_review
            req = request_approval(
                ctx.store, agent_key=self.key, action_type=ActionType.publish_content,
                title=f"Publicar: {content.title}",
                summary="Roteiro passou na revisão de conformidade. Requer aprovação humana; publicação é manual na Fase 1.",
                payload={"content_id": content.id, "scheduled_for": content.scheduled_for.isoformat()},
            )
            effects["approval_id"] = req.id
        else:
            content.status = ContentStatus.blocked
        ctx.store.upsert_content(content)
        effects["status"] = content.status.value
        return effects
