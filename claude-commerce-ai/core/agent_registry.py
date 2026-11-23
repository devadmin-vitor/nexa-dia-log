"""Registro central dos agentes.

Fonte da verdade: agents/registry.yaml + agents/<pasta>/system_prompt.md + prompts/master.md.
`sync_agents` grava/atualiza a tabela public.agents (sem apagar históricos).
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import psycopg
import yaml

from core.config import ROOT_DIR, get_settings
from core.db import Jsonb, fetch_all

AGENTS_DIR = ROOT_DIR / "agents"
PROMPTS_DIR = ROOT_DIR / "prompts"
EXPECTED_AGENT_COUNT = 7


@dataclass(frozen=True)
class AgentSpec:
    key: str
    folder: str
    name: str
    role: str
    enabled: bool
    tools: tuple[str, ...]
    approval_required: bool
    is_orchestrator: bool = False
    limits: dict = field(default_factory=dict)

    @property
    def prompt_path(self) -> Path:
        return AGENTS_DIR / self.folder / "system_prompt.md"

    def system_prompt(self) -> str:
        master = (PROMPTS_DIR / "master.md").read_text(encoding="utf-8")
        master = master.replace("{BRAND_NAME}", get_settings().brand_name)
        return master.strip() + "\n\n---\n\n" + self.prompt_path.read_text(encoding="utf-8").strip()


def _expand(value: str) -> str:
    return re.sub(r"\$\{(\w+)\}", lambda m: os.environ.get(m.group(1), get_settings().brand_name if m.group(1) == "BRAND_NAME" else m.group(0)), value)


@lru_cache
def load_registry(path: str | None = None) -> dict:
    raw = yaml.safe_load(Path(path or AGENTS_DIR / "registry.yaml").read_text(encoding="utf-8"))
    orch = raw["orchestrator"]
    specs = [
        AgentSpec(
            key=orch["id"], folder=orch["folder"], name=orch["name"], role=orch["role"],
            enabled=orch.get("enabled", True), tools=tuple(orch.get("tools", [])),
            approval_required=orch.get("approval_required", False), is_orchestrator=True,
            limits={"max_parallel_agents": orch.get("max_parallel_agents", 1), "daily_task_limit": orch.get("daily_task_limit", 0)},
        )
    ]
    for a in raw["agents"]:
        specs.append(AgentSpec(
            key=a["id"], folder=a["folder"], name=a["name"], role=a["role"], enabled=a.get("enabled", True),
            tools=tuple(a.get("tools", [])), approval_required=a.get("approval_required", False),
        ))
    project = {k: _expand(v) if isinstance(v, str) else v for k, v in raw.get("project", {}).items()}
    return {"project": project, "agents": {s.key: s for s in specs}, "security": raw.get("security", {}),
            "orchestrator": specs[0]}


def get_spec(agent_key: str) -> AgentSpec | None:
    return load_registry()["agents"].get(agent_key)


def validate_registry() -> list[str]:
    """Problemas de configuração (lista vazia = ok)."""
    reg = load_registry()
    problems = []
    if len(reg["agents"]) != EXPECTED_AGENT_COUNT:
        problems.append(f"Esperados {EXPECTED_AGENT_COUNT} agentes, encontrados {len(reg['agents'])}")
    for spec in reg["agents"].values():
        if not spec.prompt_path.is_file():
            problems.append(f"Prompt ausente: {spec.prompt_path.relative_to(ROOT_DIR)}")
        if not (AGENTS_DIR / spec.folder / "agent.py").is_file():
            problems.append(f"agent.py ausente em agents/{spec.folder}")
    return problems


def sync_agents(conn: psycopg.Connection) -> int:
    reg = load_registry()
    for spec in reg["agents"].values():
        config = {"tools": list(spec.tools), "approval_required": spec.approval_required,
                  "is_orchestrator": spec.is_orchestrator, "folder": spec.folder, **spec.limits}
        conn.execute(
            """
            insert into public.agents (agent_key, name, role, system_prompt, enabled, config)
            values (%s, %s, %s, %s, %s, %s)
            on conflict (agent_key) do update set
              name = excluded.name, role = excluded.role, system_prompt = excluded.system_prompt,
              enabled = excluded.enabled, config = excluded.config
            """,
            (spec.key, spec.name, spec.role, spec.system_prompt(), spec.enabled, Jsonb(config)),
        )
    return len(reg["agents"])


def list_agents(conn: psycopg.Connection) -> list[dict]:
    return fetch_all(
        conn,
        """
        select a.id, a.agent_key, a.name, a.role, a.enabled, a.config, a.created_at,
               count(t.id) filter (where t.status = 'queued') as queued,
               count(t.id) filter (where t.status = 'running') as running,
               count(t.id) filter (where t.status = 'failed') as failed,
               max(t.created_at) as last_task_at,
               coalesce((select sum(c.estimated_cost_brl) from public.cost_usage c where c.agent_key = a.agent_key), 0) as cost_brl
        from public.agents a left join public.agent_tasks t on t.agent_id = a.id
        group by a.id order by (a.config->>'is_orchestrator')::boolean desc nulls last, a.agent_key
        """,
    )


class BaseAgent:
    """Base dos agentes. Lógica de execução (Claude API + ferramentas) entra na Sprint 2."""

    agent_key: str = ""

    @property
    def spec(self) -> AgentSpec:
        spec = get_spec(self.agent_key)
        if spec is None:
            raise KeyError(f"Agente '{self.agent_key}' não está em agents/registry.yaml")
        return spec

    def handle(self, task: dict) -> dict:
        raise NotImplementedError(f"Execução do agente '{self.agent_key}' será implementada na Sprint 2")
