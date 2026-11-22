import Link from "next/link";
import { Suspense } from "react";

import { ErrorPanel, load } from "@/components/BackendError";
import { Badge, Card, Empty, Kpi, PageHeader, Skeleton, statusTone, Table, Td } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { AGENT_NAMES, fmtDateTime, fmtInt, fmtUSD } from "@/lib/format";
import type { AuditLog, Costs } from "@/lib/types";

const LEVELS = ["all", "info", "warning", "error", "security"];

export default function Page({ searchParams }: PageProps<"/logs">) {
  return (
    <>
      <PageHeader title="Logs e custos" subtitle="Trilha de auditoria de todas as ações (agentes, operadores, sistema) e custo de IA por agente." />
      <Suspense fallback={<Skeleton rows={6} />}>
        <LogsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LogsContent({ searchParams }: { searchParams: PageProps<"/logs">["searchParams"] }) {
  const sp = await searchParams;
  const level = LEVELS.includes(String(sp.level)) ? String(sp.level) : "all";
  const [[logs, err], [costs]] = await Promise.all([
    load(apiGet<AuditLog[]>(`/logs?limit=300${level !== "all" ? `&level=${level}` : ""}`)),
    load(apiGet<Costs>("/costs")),
  ]);
  if (err || !logs) return <ErrorPanel error={err} />;
  return (
    <div className="space-y-6">
      {costs && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Kpi label="Gasto de IA hoje" value={fmtUSD(costs.today_usd)} hint={`Orçamento diário: US$ ${costs.daily_budget_usd.toFixed(2)}`} />
            <Kpi label="Execuções" value={fmtInt(Object.values(costs.by_agent).reduce((s, a) => s + a.runs, 0))} />
            <Kpi label="Execuções com IA real" value={fmtInt(Object.values(costs.by_agent).reduce((s, a) => s + a.live_runs, 0))} />
          </div>
          <Card title="Custo por agente">
            {Object.keys(costs.by_agent).length === 0 ? (
              <Empty>Nenhuma execução ainda.</Empty>
            ) : (
              <Table head={["Agente", "Execuções", "Com IA real", "Tokens entrada", "Tokens saída", "Custo"]}>
                {Object.entries(costs.by_agent).map(([k, a]) => (
                  <tr key={k} className="tabular">
                    <Td className="font-sans">{AGENT_NAMES[k] ?? k}</Td>
                    <Td>{a.runs}</Td>
                    <Td>{a.live_runs}</Td>
                    <Td>{fmtInt(a.input_tokens)}</Td>
                    <Td>{fmtInt(a.output_tokens)}</Td>
                    <Td>{fmtUSD(a.cost_usd)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}
      <Card
        title="Auditoria"
        actions={
          <div className="flex flex-wrap gap-1 text-xs">
            {LEVELS.map((l) => (
              <Link key={l} href={l === "all" ? "/logs" : `/logs?level=${l}`} className={`rounded border px-2 py-0.5 ${l === level ? "border-accent bg-accent/15" : "border-border text-muted"}`}>
                {l}
              </Link>
            ))}
          </div>
        }
      >
        {logs.length === 0 ? (
          <Empty>Sem registros.</Empty>
        ) : (
          <Table head={["Quando", "Nível", "Ator", "Ação", "Detalhes"]}>
            {logs.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(l.ts)}</Td>
                <Td>
                  <Badge tone={l.level === "info" ? "neutral" : l.level === "security" ? "accent" : statusTone(l.level === "error" ? "failed" : "warning")}>{l.level}</Badge>
                </Td>
                <Td className="whitespace-nowrap">{AGENT_NAMES[l.actor] ?? l.actor}</Td>
                <Td className="font-mono text-xs">{l.action}</Td>
                <Td className="max-w-md truncate font-mono text-xs text-muted">{Object.keys(l.details).length ? JSON.stringify(l.details) : "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
