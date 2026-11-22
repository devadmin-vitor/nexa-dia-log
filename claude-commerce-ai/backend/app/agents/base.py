"""Base dos agentes especializados.

Cada agente:
1. monta um contexto factual a partir do repositório (nunca da internet/scraping);
2. obtém uma saída estruturada — via Claude (modo live) ou via heurística determinística (modo simulado);
3. aplica somente efeitos internos permitidos (`internal_write`) ou abre solicitações de aprovação;
4. registra a execução (custo, tokens, modo, erro) e um log de auditoria.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, ClassVar, Generic, TypeVar

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.errors import AIError, AIRefused, BudgetExceeded, CommerceError, KillSwitchActive
from app.core.logging import get_logger
from app.domain.models import ActionType, AgentRun, AgentRunStatus, LogLevel
from app.services.llm import ClaudeClient
from app.store.memory import MemoryStore

log = get_logger(__name__)

O = TypeVar("O", bound=BaseModel)

BASE_RULES = """Você é um agente da plataforma Claude Commerce AI, que apoia uma operação de afiliados do TikTok Shop Brasil.
Regras obrigatórias:
- Use SOMENTE os dados fornecidos no contexto. Não invente métricas, preços, avaliações, depoimentos ou integrações.
- Se faltar informação, diga explicitamente o que falta em vez de supor.
- Dados com data_source="simulated" são de demonstração: deixe isso claro nas conclusões.
- Nunca proponha conteúdo enganoso, avaliações falsas, demonstrações fabricadas ou uso de mídia de terceiros sem direitos.
- Nunca execute nem prometa operações financeiras; no máximo sugira, para aprovação humana.
- Responda em português do Brasil, de forma objetiva, no formato JSON solicitado."""


@dataclass
class AgentContext:
    store: MemoryStore
    llm: ClaudeClient
    settings: Settings = field(default_factory=get_settings)


class Agent(ABC, Generic[O]):
    key: ClassVar[str]
    name: ClassVar[str]
    description: ClassVar[str]
    responsibilities: ClassVar[list[str]]
    allowed_actions: ClassVar[list[ActionType]]
    output_model: ClassVar[type[BaseModel]]
    instructions: ClassVar[str]

    def system_prompt(self) -> str:
        return f"{BASE_RULES}\n\nSeu papel: {self.name}.\n{self.instructions}"

    @abstractmethod
    def build_context(self, ctx: AgentContext, params: dict[str, Any]) -> dict[str, Any]: ...

    @abstractmethod
    def simulate(self, ctx: AgentContext, context: dict[str, Any], params: dict[str, Any]) -> O: ...

    def postprocess(self, ctx: AgentContext, output: O, context: dict[str, Any], params: dict[str, Any]) -> O:
        """Ajustes determinísticos obrigatórios após a saída (ex.: regras de conformidade)."""
        return output

    def apply(self, ctx: AgentContext, output: O, params: dict[str, Any]) -> dict[str, Any]:
        """Efeitos internos. Padrão: nenhum."""
        return {}

    def describe(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "responsibilities": self.responsibilities,
            "allowed_actions": [a.value for a in self.allowed_actions],
            "output_schema": self.output_model.__name__,
        }

    def run(
        self,
        ctx: AgentContext,
        params: dict[str, Any] | None = None,
        *,
        trigger: str = "manual",
        pipeline_run_id: str | None = None,
    ) -> AgentRun:
        params = params or {}
        run = AgentRun(agent_key=self.key, trigger=trigger, pipeline_run_id=pipeline_run_id,
                       mode="live" if ctx.llm.live else "simulated")
        ctx.store.save_run(run)

        try:
            if ctx.store.system.kill_switch_active:
                raise KillSwitchActive(f"Kill switch ativo: {ctx.store.system.kill_switch_reason}")
            context = self.build_context(ctx, params)
            run.input_summary = _summarize(context)

            if ctx.llm.live:
                result = ctx.llm.generate_structured(
                    system=self.system_prompt(),
                    user="Contexto (JSON):\n" + json.dumps(context, ensure_ascii=False, default=str),
                    schema=self.output_model,
                )
                output = result.data
                run.model = result.model
                run.input_tokens, run.output_tokens, run.cost_usd = result.input_tokens, result.output_tokens, result.cost_usd
            else:
                output = self.simulate(ctx, context, params)
                run.model = "simulated"

            output = self.postprocess(ctx, output, context, params)
            effects = self.apply(ctx, output, params)
            run.output = {"result": output.model_dump(mode="json"), "effects": effects, "mode": run.mode}
            run.status = AgentRunStatus.succeeded
            ctx.store.log(self.key, "agent.run.succeeded", entity_type="agent_run", entity_id=run.id,
                          details={"mode": run.mode, "cost_usd": run.cost_usd, "trigger": trigger})
        except (KillSwitchActive, BudgetExceeded) as e:
            run.status = AgentRunStatus.blocked
            run.error = e.message
            ctx.store.log(self.key, "agent.run.blocked", entity_type="agent_run", entity_id=run.id,
                          level=LogLevel.warning, details={"reason": e.message})
        except (AIRefused, AIError, CommerceError) as e:
            run.status = AgentRunStatus.failed
            run.error = e.message
            ctx.store.log(self.key, "agent.run.failed", entity_type="agent_run", entity_id=run.id,
                          level=LogLevel.error, details={"error": e.message})
        except Exception as e:  # noqa: BLE001 — falha inesperada nunca derruba o orquestrador
            log.exception("agent.unexpected_error")
            run.status = AgentRunStatus.failed
            run.error = f"Erro inesperado: {type(e).__name__}"
            ctx.store.log(self.key, "agent.run.failed", entity_type="agent_run", entity_id=run.id,
                          level=LogLevel.error, details={"error": run.error})
        finally:
            run.finished_at = datetime.now(timezone.utc)
            ctx.store.save_run(run)
        return run


def _summarize(context: dict[str, Any]) -> str:
    parts = []
    for k, v in context.items():
        if isinstance(v, list):
            parts.append(f"{k}: {len(v)} itens")
        elif isinstance(v, dict):
            parts.append(f"{k}: {len(v)} campos")
        else:
            parts.append(f"{k}: {str(v)[:60]}")
    return "; ".join(parts)[:500]
