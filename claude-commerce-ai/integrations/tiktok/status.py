"""Integração oficial TikTok Shop — NÃO implementada.

Depende de cadastro no TikTok Shop Partner Center, aprovação do app e dos escopos necessários
(afiliados, pedidos, produtos) e da confirmação de disponibilidade desses endpoints para o Brasil.
Nenhuma chamada é feita; nenhum scraping é usado. Até lá: importação manual de relatórios oficiais.
"""

from __future__ import annotations

from core.config import get_settings
from core.errors import NotConfigured


def status() -> dict:
    s = get_settings()
    has_creds = bool(s.tiktok_shop_app_key.get_secret_value()) and bool(s.tiktok_shop_app_secret.get_secret_value())
    return {
        "implemented": False,
        "credentials_present": has_creds,
        "note": (
            "Credenciais presentes, mas o conector ainda não foi implementado nem testado."
            if has_creds
            else "Aguardando aprovação no TikTok Shop Partner Center; use importação de relatórios oficiais."
        ),
    }


def call(*_args, **_kwargs):
    raise NotConfigured("Integração TikTok Shop indisponível: aguardando aprovação e implementação (Sprint 5).")
