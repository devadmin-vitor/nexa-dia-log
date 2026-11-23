"""Permissões de ferramentas e política de ações.

- Um agente só usa ferramentas listadas para ele em agents/registry.yaml.
- Ferramentas que dependem de integrações não autorizadas ficam bloqueadas mesmo se listadas.
- Ações externas exigem aprovação humana; financeiras nunca são executadas pelo sistema.
"""

from __future__ import annotations

from core.agent_registry import get_spec
from core.errors import ApprovalRequired, PermissionDenied

# Ferramentas cuja integração ainda não existe/não foi autorizada.
UNAVAILABLE_TOOLS: dict[str, str] = {
    "web_research": "Nenhuma fonte de pesquisa autorizada configurada (integrations/research).",
    "product_search": "Fonte oficial de produtos (TikTok Shop) não autorizada; use importação de relatórios.",
    "generate_voiceover": "TTS local será configurado na Sprint 3.",
    "render_video": "Renderização (FFmpeg/Remotion) será implementada na Sprint 3.",
    "create_publication": "Publicação depende de integração oficial autorizada; até lá, publicação manual.",
}

# Ações que exigem aprovação humana e risco padrão
APPROVAL_ACTIONS: dict[str, str] = {
    "publish_content": "medium",
    "change_listing": "high",
    "contact_seller": "medium",
    "external_message": "medium",
    "spend_money": "critical",
    "financial": "critical",
}
NEVER_AUTO_EXECUTE = {"spend_money", "financial"}


def authorize_tool(agent_key: str, tool: str) -> None:
    spec = get_spec(agent_key)
    if spec is None:
        raise PermissionDenied(f"Agente desconhecido: {agent_key}")
    if not spec.enabled:
        raise PermissionDenied(f"Agente desativado: {agent_key}")
    if tool not in spec.tools:
        raise PermissionDenied(f"Ferramenta '{tool}' não permitida para '{agent_key}'")
    if tool in UNAVAILABLE_TOOLS:
        raise PermissionDenied(f"Ferramenta '{tool}' indisponível: {UNAVAILABLE_TOOLS[tool]}")


def requires_approval(action_type: str) -> bool:
    return action_type in APPROVAL_ACTIONS


def ensure_can_execute_without_approval(action_type: str) -> None:
    if requires_approval(action_type):
        raise ApprovalRequired(f"A ação '{action_type}' exige aprovação humana")
