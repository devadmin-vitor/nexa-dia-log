import { Suspense } from "react";

import { ErrorPanel, load } from "@/components/BackendError";
import { Badge, Card, PageHeader, Skeleton } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { fmtBRL, fmtDateTime } from "@/lib/format";
import type { Agent } from "@/lib/types";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Agentes"
        subtitle="Um orquestrador e seis agentes especializados, sincronizados de agents/registry.yaml. A execução com a Claude API chega na Sprint 2."
      />
      <Suspense fallback={<Skeleton rows={6} />}>
        <Agents />
      </Suspense>
    </>
  );
}

async function Agents() {
  const [data, err] = await load(apiGet<{ agents: Agent[]; security: Record<string, boolean> }>("/agents"));
  if (err || !data) return <ErrorPanel error={err} />;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.agents.map((a) => (
          <Card
            key={a.agent_key}
            title={a.name}
            actions={
              <span className="flex gap-1.5">
                {a.config.is_orchestrator && <Badge tone="accent">orquestrador</Badge>}
                <Badge tone={a.enabled ? "ok" : "neutral"}>{a.enabled ? "ativo" : "desativado"}</Badge>
              </span>
            }
          >
            <p className="font-mono text-xs text-muted">{a.agent_key}</p>
            <p className="mt-2 text-sm">{a.role}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {a.config.tools.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
            {a.config.approval_required && <p className="mt-2 text-xs text-warn">Ações deste agente exigem aprovação humana.</p>}
            {a.config.is_orchestrator && (
              <p className="mt-2 text-xs text-muted">
                Até {a.config.max_parallel_agents} agentes em paralelo · {a.config.daily_task_limit} tarefas/dia
              </p>
            )}
            <div className="mt-3 text-xs text-muted">
              Fila {a.queued} · executando {a.running} · falhas {a.failed} · custo {fmtBRL(a.cost_brl)}
              <br />
              Última tarefa: {fmtDateTime(a.last_task_at)}
            </div>
            {a.prompt_file && <p className="mt-2 font-mono text-[11px] text-muted">{a.prompt_file}</p>}
          </Card>
        ))}
      </div>
      <Card title="Política de segurança (registry.yaml)">
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {Object.entries(data.security).map(([k, v]) => (
            <li key={k} className="flex justify-between gap-3 border-b border-border/50 py-1">
              <span className="font-mono text-xs text-muted">{k}</span>
              <Badge tone={v ? "ok" : "danger"}>{v ? "ativo" : "inativo"}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
