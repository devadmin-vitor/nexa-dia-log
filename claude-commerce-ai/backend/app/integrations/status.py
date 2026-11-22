"""Status honesto das integrações externas.

Nenhuma integração é declarada "ativa" sem um teste real bem-sucedido nesta execução.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.config import Settings
from app.core.errors import IntegrationNotAvailable

_last_claude_test: dict | None = None


def tiktok_shop_status(settings: Settings) -> dict:
    """Integração oficial TikTok Shop (Partner Center / Open API).

    Não implementada na Fase 1: depende de cadastro como parceiro/app, aprovação dos escopos
    (ex.: dados de afiliado, pedidos, produtos) e confirmação de que os endpoints de afiliado
    estão disponíveis para contas no Brasil. Nenhuma chamada é feita.
    """
    if settings.tiktok_app_key_present and settings.tiktok_app_secret_present:
        state = "credentials_present_not_implemented"
        note = "Credenciais detectadas no servidor, mas o conector ainda não foi implementado nem testado."
    else:
        state = "not_configured"
        note = "Aguardando aprovação do app no TikTok Shop Partner Center e liberação de escopos."
    return {"key": "tiktok_shop", "name": "TikTok Shop (API oficial)", "state": state, "verified": False, "note": note,
            "fallback": "Importação manual de relatórios CSV/XLSX"}


def tiktok_shop_call(*_args, **_kwargs):
    raise IntegrationNotAvailable("Integração TikTok Shop indisponível: aguardando aprovação e implementação.")


def claude_status(settings: Settings) -> dict:
    if settings.ai_mode == "simulated":
        state, note = "simulated", "AI_MODE=simulated: nenhuma chamada à Claude API."
    elif not settings.anthropic_api_key_present:
        state, note = "not_configured", "ANTHROPIC_API_KEY ausente: agentes rodam em modo simulado."
    elif _last_claude_test and _last_claude_test.get("ok"):
        state, note = "verified", f"Teste bem-sucedido em {_last_claude_test['at']}."
    else:
        state, note = "configured_unverified", "Chave presente; execute o teste de conexão para verificar."
    return {"key": "claude", "name": "Claude API", "state": state, "verified": state == "verified", "note": note,
            "model": settings.claude_model, "last_test": _last_claude_test}


def test_claude(settings: Settings) -> dict:
    """Faz uma chamada mínima real (poucos tokens) para verificar a chave."""
    global _last_claude_test
    if not settings.anthropic_api_key_present:
        raise IntegrationNotAvailable("ANTHROPIC_API_KEY não configurada no servidor")
    import anthropic

    at = datetime.now(timezone.utc).isoformat()
    try:
        client = anthropic.Anthropic(max_retries=0, timeout=30.0)
        resp = client.messages.create(
            model=settings.claude_model, max_tokens=256,
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": "Responda apenas: ok"}],
        )
        _last_claude_test = {"ok": True, "at": at, "model": resp.model, "stop_reason": resp.stop_reason}
    except anthropic.APIStatusError as e:
        _last_claude_test = {"ok": False, "at": at, "error": f"HTTP {e.status_code}"}
    except anthropic.APIConnectionError:
        _last_claude_test = {"ok": False, "at": at, "error": "sem conexão"}
    return _last_claude_test


def supabase_status(settings: Settings) -> dict:
    configured = bool(settings.supabase_url) and settings.supabase_service_role_key_present
    return {"key": "supabase", "name": "Supabase / PostgreSQL",
            "state": "configured_not_connected" if configured else "not_configured", "verified": False,
            "note": "Fase 1 usa repositório em memória. Esquema pronto em supabase/migrations; conexão na Fase 2."}


def n8n_status(settings: Settings, last_trigger_at: str | None) -> dict:
    return {"key": "n8n", "name": "n8n (agendamentos)",
            "state": "receiving" if last_trigger_at else ("token_configured" if settings.scheduler_token else "not_configured"),
            "verified": bool(last_trigger_at),
            "note": f"Último disparo recebido: {last_trigger_at}" if last_trigger_at else "Nenhum disparo recebido do n8n nesta execução.",
            }
