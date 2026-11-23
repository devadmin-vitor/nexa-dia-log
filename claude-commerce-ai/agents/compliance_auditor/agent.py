"""Agente compliance_auditor.

Fase atual (Sprint 1 — infraestrutura): o agente está registrado, com prompt, ferramentas
permitidas e limites. A lógica de execução com a Claude API entra na Sprint 2.
"""

from core.agent_registry import BaseAgent


class Agent(BaseAgent):
    agent_key = "compliance_auditor"
