"""Cliente da Claude API com guardas de emergência, orçamento e registro de custo.

- Modelo configurável por CLAUDE_MODEL (sem versão fixa no código).
- Respostas estruturadas: `output_config.format` com JSON Schema gerado de um modelo Pydantic,
  validado novamente no retorno.
- Fallback no servidor (`fallbacks="default"`) só para modelos que o suportam.
- Todo uso é gravado em cost_usage (BRL e USD) antes de devolver o resultado.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, TypeVar

import psycopg
from pydantic import BaseModel, ValidationError

from core import cost_control, emergency
from core.config import Settings, get_settings
from core.errors import AIError, AIRefused, NotConfigured
from core.logging import get_logger, log_event

log = get_logger(__name__)
T = TypeVar("T", bound=BaseModel)

FALLBACK_BETA = "server-side-fallback-2026-07-01"
FALLBACK_MODELS = {"claude-fable-5-2", "claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"}
_UNSUPPORTED_KEYS = ("title", "default", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
                     "minLength", "maxLength", "minItems", "maxItems", "pattern", "format")


def strict_schema(model_cls: type[BaseModel]) -> dict[str, Any]:
    """JSON Schema compatível com saída estruturada estrita (validação fina fica com o Pydantic)."""
    schema = model_cls.model_json_schema()

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("type") == "object" and "properties" in node:
                node["additionalProperties"] = False
                node["required"] = list(node["properties"].keys())
            for key in _UNSUPPORTED_KEYS:
                node.pop(key, None)
            for v in list(node.values()):
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(schema)
    return schema


@dataclass
class ClaudeResult:
    data: BaseModel
    model: str
    input_tokens: int
    output_tokens: int
    cost_brl: float
    cost_usd: float


class ClaudeClient:
    def __init__(self, settings: Settings | None = None, sdk_client: Any | None = None):
        self.settings = settings or get_settings()
        self._sdk = sdk_client

    @property
    def configured(self) -> bool:
        return self._sdk is not None or self.settings.claude_configured

    def _client(self) -> Any:
        if self._sdk is None:
            if not self.settings.claude_configured:
                raise NotConfigured("Claude API não configurada (ANTHROPIC_API_KEY e CLAUDE_MODEL)")
            import anthropic

            self._sdk = anthropic.Anthropic(
                api_key=self.settings.anthropic_api_key.get_secret_value(), max_retries=2, timeout=120.0
            )
        return self._sdk

    def generate(
        self,
        conn: psycopg.Connection,
        *,
        agent_key: str,
        system: str,
        user: str,
        schema: type[T],
        task_id: str | None = None,
        max_tokens: int | None = None,
    ) -> ClaudeResult:
        # Guardas antes de qualquer gasto.
        emergency.ensure_not_stopped(conn)
        cost_control.ensure_within_budget(conn)
        if not self.settings.claude_model and self._sdk is None:
            raise NotConfigured("CLAUDE_MODEL não configurado")

        import anthropic

        model = self.settings.claude_model
        params: dict[str, Any] = dict(
            model=model,
            max_tokens=max_tokens or self.settings.claude_max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_config={
                "effort": self.settings.claude_effort,
                "format": {"type": "json_schema", "schema": strict_schema(schema)},
            },
        )
        try:
            if self.settings.claude_use_fallbacks and model in FALLBACK_MODELS:
                resp = self._client().beta.messages.create(betas=[FALLBACK_BETA], fallbacks="default", **params)
            else:
                resp = self._client().messages.create(**params)
        except anthropic.AuthenticationError as e:
            raise AIError("Falha de autenticação na Claude API (verifique ANTHROPIC_API_KEY)") from e
        except anthropic.NotFoundError as e:
            raise AIError(f"Modelo '{model}' não encontrado na Claude API") from e
        except anthropic.RateLimitError as e:
            raise AIError("Limite de requisições da Claude API atingido") from e
        except anthropic.APIStatusError as e:
            raise AIError(f"Erro da Claude API (HTTP {e.status_code})") from e
        except anthropic.APIConnectionError as e:
            raise AIError("Sem conexão com a Claude API") from e

        model_used = getattr(resp, "model", None) or model
        in_tok = int(getattr(resp.usage, "input_tokens", 0) or 0)
        out_tok = int(getattr(resp.usage, "output_tokens", 0) or 0)
        # Registra o custo mesmo se a resposta for inválida: a chamada foi cobrada.
        cost = cost_control.record_usage(conn, provider="anthropic", model=model_used, input_tokens=in_tok,
                                         output_tokens=out_tok, agent_key=agent_key, task_id=task_id)
        log_event(log, "claude.call", agent=agent_key, model=model_used, input_tokens=in_tok,
                  output_tokens=out_tok, cost_brl=cost["brl"])

        if resp.stop_reason == "refusal":
            raise AIRefused("A Claude API recusou a solicitação por política de segurança")
        if resp.stop_reason == "max_tokens":
            raise AIError("Resposta truncada (max_tokens); aumente CLAUDE_MAX_TOKENS")
        text = next((b.text for b in resp.content if getattr(b, "type", None) == "text"), None)
        if not text:
            raise AIError("Resposta sem conteúdo de texto")
        try:
            data = schema.model_validate(json.loads(text))
        except (json.JSONDecodeError, ValidationError) as e:
            raise AIError("Resposta da IA fora do formato esperado") from e
        return ClaudeResult(data=data, model=model_used, input_tokens=in_tok, output_tokens=out_tok,
                            cost_brl=cost["brl"], cost_usd=cost["usd"])


def connection_test(settings: Settings | None = None) -> dict:
    """Chamada real mínima para verificar chave e modelo (custo de poucos tokens; não passa pelo orçamento)."""
    s = settings or get_settings()
    if not s.claude_configured:
        raise NotConfigured("Configure ANTHROPIC_API_KEY e CLAUDE_MODEL")
    import anthropic

    try:
        client = anthropic.Anthropic(api_key=s.anthropic_api_key.get_secret_value(), max_retries=0, timeout=30.0)
        resp = client.messages.create(model=s.claude_model, max_tokens=256, output_config={"effort": "low"},
                                      messages=[{"role": "user", "content": "Responda apenas: ok"}])
        return {"ok": True, "model": resp.model, "stop_reason": resp.stop_reason,
                "input_tokens": resp.usage.input_tokens, "output_tokens": resp.usage.output_tokens}
    except anthropic.APIStatusError as e:
        return {"ok": False, "error": f"HTTP {e.status_code}"}
    except anthropic.APIConnectionError:
        return {"ok": False, "error": "sem conexão"}
