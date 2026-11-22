"""Regras determinísticas de conformidade aplicadas a TODO roteiro (com ou sem IA).

Objetivo: impedir conteúdo enganoso, avaliações falsas, demonstrações fabricadas e uso de
mídia de terceiros sem direitos. O revisor com IA complementa — nunca substitui — estas regras.
"""

from __future__ import annotations

import re
import unicodedata

from app.domain.models import ComplianceIssue, Product, Script


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in text if not unicodedata.combining(c))


# (regex sobre texto normalizado, regra, severidade, detalhe)
_FORBIDDEN = [
    (r"\b(cura|curou|tratamento definitivo|elimina (a )?doenca)\b", "alegacao_saude", "high", "Alegação de saúde/cura não permitida."),
    (r"\b(garantid[oa]s?|100% (eficaz|garantido)|resultado imediato|milagr\w*)\b", "promessa_absoluta", "high", "Promessa absoluta ou de resultado garantido."),
    (r"\b(emagrec\w+ \d+ ?kg|perca \d+ ?kg)\b", "alegacao_peso", "high", "Alegação de perda de peso quantificada."),
    (r"\b(fique rico|renda garantida|dinheiro facil)\b", "promessa_financeira", "high", "Promessa financeira enganosa."),
    (r"\b(ultimas? unidades|so hoje|acaba em \d+ ?min)\b", "urgencia_falsa", "medium", "Urgência/escassez não comprovada."),
    (r"\b(milhares de clientes|todo mundo esta comprando|nota 5 estrelas de todos)\b", "prova_social_nao_verificada", "medium", "Prova social não verificada."),
    (r"\b(depoimento de cliente|cliente disse|minha amiga (usou|comprou))\b", "depoimento_nao_verificavel", "high", "Depoimento/avaliação não verificável (risco de avaliação falsa)."),
    (r"\b(melhor do (mundo|brasil)|o unico do mercado)\b", "superlativo_nao_comprovado", "medium", "Superlativo comparativo sem comprovação."),
]

_DISCLOSURE_MARKERS = ("publi", "link de afiliado", "parceria", "comissao", "afiliad")
_DEMO_MARKERS = ("testando", "testei", "estou usando", "uso todo dia", "unboxing", "demonstr")


def check_script(script: Script, product: Product) -> list[ComplianceIssue]:
    issues: list[ComplianceIssue] = []
    full = " ".join([script.hook, *script.body, script.call_to_action, script.disclosure, *script.shot_list])
    text = _norm(full)

    for pattern, rule, sev, detail in _FORBIDDEN:
        if re.search(pattern, text):
            issues.append(ComplianceIssue(severity=sev, rule=rule, detail=detail))

    if not any(m in _norm(script.disclosure) for m in _DISCLOSURE_MARKERS):
        issues.append(
            ComplianceIssue(
                severity="high",
                rule="sem_divulgacao_afiliado",
                detail="Roteiro precisa declarar claramente que é conteúdo de afiliado/publicidade.",
            )
        )

    verified = {_norm(c) for c in product.verified_claims}
    for claim in script.claims_used:
        if _norm(claim) not in verified:
            issues.append(
                ComplianceIssue(
                    severity="high",
                    rule="alegacao_nao_verificada",
                    detail=f"Alegação fora da lista de fatos verificados do produto: '{claim}'.",
                )
            )

    if not product.sample_received and any(m in text for m in _DEMO_MARKERS):
        issues.append(
            ComplianceIssue(
                severity="high",
                rule="demonstracao_sem_amostra",
                detail="Roteiro sugere uso/demonstração real, mas não há amostra física registrada.",
            )
        )

    uses_seller_media = any(k in text for k in ("video do vendedor", "imagens do vendedor", "midia do vendedor"))
    if uses_seller_media and not product.media_rights_confirmed:
        issues.append(
            ComplianceIssue(
                severity="high",
                rule="midia_sem_direitos",
                detail="Uso de mídia do vendedor sem confirmação de direitos de uso.",
            )
        )

    return issues


def blocking(issues: list[ComplianceIssue]) -> bool:
    return any(i.severity == "high" for i in issues)
