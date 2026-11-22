import { Suspense } from "react";

import { ActionButton } from "@/components/ActionButton";
import { ErrorPanel, load } from "@/components/BackendError";
import { Badge, Card, PageHeader, Skeleton, statusTone } from "@/components/ui";
import { runAgent, runPipeline } from "@/lib/actions";
import { apiGet } from "@/lib/api";
import { AGENT_NAMES, fmtDateTime, fmtUSD } from "@/lib/format";
import type { AgentRun, Architecture } from "@/lib/types";

// Agentes que exigem um conteúdo específico rodam pela página de Roteiros.
const NEEDS_CONTENT = new Set(["scriptwriter", "compliance_reviewer"]);

export default function Page() {
  return (
    <>
      <PageHeader
        title="Agentes"
        subtitle="Sete agentes especializados coordenados por um orquestrador central com roteamento determinístico, kill switch, orçamento de IA e política de aprovação."
      />
      <Suspense fallback={<Skeleton rows={6} />}>
        <Agents />
      </Suspense>
    </>
  );
}

async function Agents() {
  const [[arch, err], [runs]] = await Promise.all([load(apiGet<Architecture>("/agents")), load(apiGet<AgentRun[]>("/runs?limit=30"))]);
  if (err || !arch) return <ErrorPanel error={err} />;
  return (
    <div className="space-y-6">
      <Card title={arch.orchestrator.name}>
        <p className="text-sm text-muted">
          Roteamento: {arch.orchestrator.routing}. Proteções: {arch.orchestrator.guards.join(", ")}.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {arch.pipelines.map((p) => (
            <div key={p.key} className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{p.name}</div>
                {p.key !== "content_pipeline" && <ActionButton label="Executar" action={runPipeline.bind(null, p.key, {})} />}
              </div>
              <p className="mt-1 text-xs text-muted">{p.description}</p>
              <p className="mt-2 text-xs">{p.steps.map((s) => AGENT_NAMES[s] ?? s).join(" → ")}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {arch.agents.map((a) => (
          <Card key={a.key} title={a.name} actions={a.last_run ? <Badge tone={statusTone(a.last_run.status)}>{a.last_run.status}</Badge> : <Badge>nunca executado</Badge>}>
            <p className="text-sm text-muted">{a.description}</p>
            <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs">
              {a.responsibilities.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-1">
              {a.allowed_actions.map((x) => (
                <Badge key={x} tone={x === "read" || x === "internal_write" ? "neutral" : "warn"}>
                  {x}
                </Badge>
              ))}
            </div>
            <div className="mt-3 text-xs text-muted">
              {a.runs_total} execuções · custo total {fmtUSD(a.cost_usd_total)}
              {a.last_run && <> · última {fmtDateTime(a.last_run.started_at)}</>}
            </div>
            {a.last_run?.error && <p className="mt-2 text-xs text-danger">{a.last_run.error}</p>}
            <div className="mt-3">
              {NEEDS_CONTENT.has(a.key) ? (
                <span className="text-xs text-muted">Executado a partir da página Roteiros.</span>
              ) : (
                <ActionButton label="Executar agora" variant="primary" action={runAgent.bind(null, a.key, {})} />
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card title="Últimas execuções (saída estruturada)">
        <div className="space-y-2">
          {(runs ?? []).map((r) => (
            <details key={r.id} className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <span className="font-medium">{AGENT_NAMES[r.agent_key] ?? r.agent_key}</span>
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                <Badge tone={r.mode === "live" ? "accent" : "sim"}>{r.mode}</Badge>
                <span className="text-xs text-muted">
                  {fmtDateTime(r.started_at)} · {r.trigger} · {fmtUSD(r.cost_usd)}
                </span>
              </summary>
              {r.error && <p className="mt-2 text-danger">{r.error}</p>}
              {r.output && <pre className="mt-2 max-h-80 overflow-auto rounded bg-bg p-3 text-xs text-muted">{JSON.stringify(r.output, null, 2)}</pre>}
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
