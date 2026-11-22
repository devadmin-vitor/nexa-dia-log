"""Cliente Claude com controle de custos, orçamento diário e kill switch.

Modos:
- live      → chama a Claude API (exige ANTHROPIC_API_KEY no servidor).
- simulated → não chama a API; o agente produz saída determinística marcada como simulada.

A resposta estruturada usa `output_config.format` (JSON Schema) e é validada com Pydantic.
Fallback no servidor (`fallbacks="default"`) fica habilitado: se o modelo recusar por política,
a API reexecuta com um modelo de fallback e o custo é calculado pelo modelo que respondeu.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.core.config import Settings, get_settings
from app.core.errors import AIError, AIRefused, BudgetExceeded, KillSwitchActive
from app.core.logging import get_logger
from app.store.memory import MemoryStore

log = get_logger(__name__)

T = TypeVar("T", bound=BaseModel)

# US$ por 1M tokens (input, output). Atualize conforme a tabela oficial de preços.
PRICING_USD_PER_MTOK: dict[str, tuple[float, float]] = {
    "claude-opus-5-5": (4.0, 20.0),
    "claude-opus-5": (5.0, 25.0),
    "claude-opus-4-8": (5.0, 25.0),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-haiku-5-5": (0.10, 0.50),
    "claude-fable-5-2": (8.0, 40.0),
}
_DEFAULT_PRICE = (8.0, 40.0)  # conservador para modelos desconhecidos

FALLBACK_BETA = "server-side-fallback-2026-07-01"


def estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    pin, pout = PRICING_USD_PER_MTOK.get(model, _DEFAULT_PRICE)
    return round(input_tokens / 1e6 * pin + output_tokens / 1e6 * pout, 6)


def _strict_schema(model_cls: type[BaseModel]) -> dict[str, Any]:
    """Gera JSON Schema compatível com structured outputs (additionalProperties=false, todos required)."""
    schema = model_cls.model_json_schema()

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("type") == "object" and "properties" in node:
                node["additionalProperties"] = False
                node["required"] = list(node["properties"].keys())
            # Restrições não suportadas no modo estrito são removidas; o Pydantic valida depois.
            for key in ("title", "default", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
                        "minLength", "maxLength", "minItems", "maxItems", "pattern", "format"):
                node.pop(key, None)
            for v in list(node.values()):
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(schema)
    return schema


@dataclass
class LLMResult:
    data: BaseModel
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float


class ClaudeClient:
    def __init__(self, store: MemoryStore, settings: Settings | None = None, sdk_client: Any | None = None):
        self.store = store
        self.settings = settings or get_settings()
        self._sdk = sdk_client

    @property
    def live(self) -> bool:
        return self.settings.ai_live_enabled or self._sdk is not None

    def _client(self) -> Any:
        if self._sdk is None:
            import anthropic  # import tardio: modo simulado não precisa do SDK

            self._sdk = anthropic.Anthropic(max_retries=2, timeout=120.0)
        return self._sdk

    def check_guards(self) -> None:
        if self.store.system.kill_switch_active:
            raise KillSwitchActive(f"Kill switch ativo: {self.store.system.kill_switch_reason}")
        spent = self.store.ai_spend_today_usd()
        if spent >= self.settings.daily_ai_budget_usd:
            raise BudgetExceeded(
                f"Orçamento diário de IA atingido (US$ {spent:.4f} / US$ {self.settings.daily_ai_budget_usd:.2f})"
            )

    def generate_structured(self, *, system: str, user: str, schema: type[T], max_tokens: int | None = None) -> LLMResult:
        self.check_guards()
        import anthropic

        params: dict[str, Any] = dict(
            model=self.settings.claude_model,
            max_tokens=max_tokens or self.settings.per_run_max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_config={
                "effort": self.settings.claude_effort,
                "format": {"type": "json_schema", "schema": _strict_schema(schema)},
            },
        )
        try:
            if self.settings.claude_use_fallbacks:
                resp = self._client().beta.messages.create(betas=[FALLBACK_BETA], fallbacks="default", **params)
            else:
                resp = self._client().messages.create(**params)
        except anthropic.AuthenticationError as e:
            raise AIError("Falha de autenticação na Claude API (verifique ANTHROPIC_API_KEY)") from e
        except anthropic.RateLimitError as e:
            raise AIError("Limite de requisições da Claude API atingido; tente mais tarde") from e
        except anthropic.APIStatusError as e:
            raise AIError(f"Erro da Claude API ({e.status_code})") from e
        except anthropic.APIConnectionError as e:
            raise AIError("Sem conexão com a Claude API") from e

        model_used = getattr(resp, "model", self.settings.claude_model)
        in_tok = getattr(resp.usage, "input_tokens", 0) or 0
        out_tok = getattr(resp.usage, "output_tokens", 0) or 0
        cost = estimate_cost_usd(model_used, in_tok, out_tok)

        if resp.stop_reason == "refusal":
            raise AIRefused("O modelo recusou a solicitação por política de segurança")
        if resp.stop_reason == "max_tokens":
            raise AIError("Resposta truncada (max_tokens). Aumente PER_RUN_MAX_TOKENS.")

        text = next((b.text for b in resp.content if getattr(b, "type", None) == "text"), None)
        if not text:
            raise AIError("Resposta sem conteúdo de texto")
        try:
            data = schema.model_validate(json.loads(text))
        except (json.JSONDecodeError, ValidationError) as e:
            raise AIError("Resposta da IA fora do formato esperado") from e

        log.info("llm.call", extra={"extra_fields": {"model": model_used, "in": in_tok, "out": out_tok, "cost_usd": cost}})
        return LLMResult(data=data, model=model_used, input_tokens=in_tok, output_tokens=out_tok, cost_usd=cost)
