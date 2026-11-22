"""Política de ações e fluxo de aprovação humana.

Regras:
- `read` e `internal_write` podem ser executadas pelos agentes automaticamente.
- Ações externas (publicar, alterar vitrine, contatar vendedor) exigem aprovação humana.
- Ações `financial` exigem aprovação e NUNCA são executadas automaticamente pelo sistema:
  mesmo aprovadas, ficam como "execução manual pelo operador".
- Na Fase 1 não existe integração de publicação: aprovações viram tarefas manuais.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.errors import ApprovalRequired, CommerceError, KillSwitchActive, NotFound
from app.domain.models import (
    ActionType,
    ApprovalDecision,
    ApprovalRequest,
    ApprovalStatus,
    LogLevel,
    RiskLevel,
)
from app.store.memory import MemoryStore

AUTO_ALLOWED = {ActionType.read, ActionType.internal_write}

DEFAULT_RISK = {
    ActionType.read: RiskLevel.low,
    ActionType.internal_write: RiskLevel.low,
    ActionType.publish_content: RiskLevel.medium,
    ActionType.change_listing: RiskLevel.high,
    ActionType.contact_seller: RiskLevel.medium,
    ActionType.financial: RiskLevel.critical,
}


def ensure_auto_allowed(action: ActionType) -> None:
    if action not in AUTO_ALLOWED:
        raise ApprovalRequired(f"A ação '{action}' exige aprovação humana")


def request_approval(
    store: MemoryStore,
    *,
    agent_key: str,
    action_type: ActionType,
    title: str,
    summary: str,
    payload: dict | None = None,
) -> ApprovalRequest:
    if action_type in AUTO_ALLOWED:
        raise CommerceError("Ações internas não precisam de aprovação")
    req = ApprovalRequest(
        agent_key=agent_key,
        action_type=action_type,
        risk_level=DEFAULT_RISK[action_type],
        title=title,
        summary=summary,
        payload=payload or {},
    )
    store.save_approval(req)
    store.log(agent_key, "approval.requested", entity_type="approval", entity_id=req.id,
              details={"action_type": action_type, "risk": req.risk_level})
    return req


def decide(store: MemoryStore, approval_id: str, decision: ApprovalDecision) -> ApprovalRequest:
    if store.system.kill_switch_active:
        raise KillSwitchActive("Kill switch ativo: decisões e execuções estão suspensas")
    req = store.approvals.get(approval_id)
    if not req:
        raise NotFound("Solicitação de aprovação não encontrada")
    if req.status != ApprovalStatus.pending:
        raise CommerceError(f"Solicitação já decidida ({req.status})")

    req.status = ApprovalStatus.approved if decision.approve else ApprovalStatus.rejected
    req.decided_at = datetime.now(timezone.utc)
    req.decided_by = decision.decided_by
    req.decision_reason = decision.reason

    if req.status == ApprovalStatus.approved:
        if req.action_type == ActionType.financial:
            req.execution_status = "manual_required"
            req.execution_note = (
                "Operação financeira aprovada. O sistema não executa pagamentos/investimentos: "
                "realize manualmente na plataforma oficial e registre o comprovante."
            )
        else:
            # Fase 1: nenhuma integração de publicação/alteração está ativa.
            req.execution_status = "manual_required"
            req.execution_note = (
                "Aprovado. Integração de execução não disponível na Fase 1 — execute manualmente "
                "no TikTok Shop/TikTok e marque como concluído."
            )
    else:
        req.execution_status = "cancelled"

    store.save_approval(req)
    store.log(
        decision.decided_by,
        f"approval.{req.status}",
        entity_type="approval",
        entity_id=req.id,
        level=LogLevel.security if req.action_type == ActionType.financial else LogLevel.info,
        details={"action_type": req.action_type, "reason": decision.reason},
    )
    return req
