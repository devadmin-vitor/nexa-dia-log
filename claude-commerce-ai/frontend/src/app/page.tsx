import Link from "next/link";
import { Suspense } from "react";

import { ActionButton } from "@/components/ActionButton";
import { ErrorPanel, load } from "@/components/BackendError";
import { CommissionChart } from "@/components/BarChart";
import { Badge, Card, Empty, Kpi, PageHeader, Skeleton, SourceBadge, statusTone } from "@/components/ui";
import { runPipeline } from "@/lib/actions";
import { apiGet } from "@/lib/api";
import { AGENT_NAMES, fmtBRL, fmtDateTime, fmtInt, fmtPct, fmtUSD } from "@/lib/format";
import type { Overview } from "@/lib/types";

const SOURCES = { all: "Todos os dados", real: "Somente reais", simulated: "Somente simulados" } as const;

export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle="Resumo dos últimos 30 dias, atividade dos agentes e pendências que exigem decisão humana."
        actions={<ActionButton label="Executar ciclo diário" variant="primary" action={runPipeline.bind(null, "daily_cycle", {})} />}
      />
      <Suspense fallback={<Skeleton rows={4} />}>
        <OverviewContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function OverviewContent({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const source = (typeof sp.source === "string" && sp.source in SOURCES ? sp.source : "all") as keyof typeof SOURCES;
  const [data, err] = await load(apiGet<Overview>(`/dashboard/overview?days=30&source=${source}`));
  if (err || !data) return <ErrorPanel error={err} />;
  const k = data.kpis;
  const budgetPct = data.daily_ai_budget_usd ? data.ai_spend_today_usd / data.daily_ai_budget_usd : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Fonte:</span>
        {Object.entries(SOURCES).map(([key, label]) => (
          <Link
            key={key}
            href={key === "all" ? "/" : `/?source=${key}`}
            className={`rounded-md border px-2.5 py-1 ${source === key ? "border-accent bg-accent/15 text-text" : "border-border text-muted hover:text-text"}`}
          >
            {label}
          </Link>
        ))}
        <span className="ml-auto flex gap-1">
          {k.data_sources.map((s) => (
            <SourceBadge key={s} source={s} />
          ))}
        </span>
      </div>

      {k.data_sources.length === 1 && k.data_sources[0] === "simulated" && (
        <div className="rounded-xl border border-sim/40 bg-sim/10 px-4 py-3 text-sm text-sim">
          Todos os números abaixo são <strong>simulados</strong>. Importe relatórios reais em{" "}
          <Link href="/importacao" className="underline">
            Importação
          </Link>{" "}
          para substituí-los.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Comissão" value={fmtBRL(k.commission_brl)} hint="30 dias" />
        <Kpi label="GMV" value={fmtBRL(k.gmv_brl)} />
        <Kpi label="Pedidos" value={fmtInt(k.orders)} />
        <Kpi label="CTR" value={fmtPct(k.ctr)} hint={`${fmtInt(k.clicks)} cliques`} />
        <Kpi label="Conversão" value={fmtPct(k.conversion_rate)} />
        <Kpi label="EPC" value={fmtBRL(k.epc_brl)} hint="ganho por clique" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Comissão diária" className="xl:col-span-2">
          <CommissionChart data={data.series} />
        </Card>
        <Card title="Pendências e controle">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <Link href="/aprovacoes" className="hover:underline">
                Aprovações pendentes
              </Link>
              <Badge tone={data.pending_approvals ? "warn" : "ok"}>{data.pending_approvals}</Badge>
            </li>
            <li className="flex items-center justify-between">
              <Link href="/calendario" className="hover:underline">
                Conteúdos nos próximos 7 dias
              </Link>
              <Badge>{data.content_next_7d}</Badge>
            </li>
            <li className="flex items-center justify-between">
              <span>Falhas recentes dos agentes</span>
              <Badge tone={data.failed_runs_recent ? "danger" : "ok"}>{data.failed_runs_recent}</Badge>
            </li>
            <li>
              <div className="flex items-center justify-between">
                <span>Gasto de IA hoje</span>
                <span className="tabular text-muted">
                  {fmtUSD(data.ai_spend_today_usd)} / US$ {data.daily_ai_budget_usd.toFixed(2)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-surface-2">
                <div className={`h-full ${budgetPct > 0.8 ? "bg-danger" : "bg-accent"}`} style={{ width: `${Math.min(100, budgetPct * 100)}%` }} />
              </div>
            </li>
            <li className="flex items-center justify-between">
              <span>Modo de IA</span>
              <Badge tone={data.ai_mode === "live" ? "accent" : "sim"}>{data.ai_mode === "live" ? "Ao vivo" : "Simulado"}</Badge>
            </li>
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Top produtos por comissão">
          {data.top_products.length === 0 ? (
            <Empty>Sem vendas no período para esta fonte de dados.</Empty>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {data.top_products.map((p) => (
                <li key={p.product_id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">{p.product_name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <SourceBadge source={p.data_source} />
                    <span className="tabular w-24 text-right">{fmtBRL(p.commission_brl)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Alertas de desempenho (semana × semana anterior)">
          {data.anomalies.length === 0 ? (
            <Empty>Nenhuma variação relevante detectada.</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.anomalies.slice(0, 6).map((a) => (
                <li key={a.product_id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{a.product_name}</span>
                  <Badge tone={a.type === "queda" ? "danger" : "ok"}>
                    {a.change_pct > 0 ? "+" : ""}
                    {a.change_pct}%
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Atividade recente dos agentes" actions={<Link href="/agentes" className="text-xs text-accent hover:underline">Ver agentes</Link>}>
        {data.recent_runs.length === 0 ? (
          <Empty>Nenhum agente executado ainda. Use “Executar ciclo diário”.</Empty>
        ) : (
          <ul className="divide-y divide-border/60 text-sm">
            {data.recent_runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{AGENT_NAMES[r.agent_key] ?? r.agent_key}</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <Badge tone={r.mode === "live" ? "accent" : "sim"}>{r.mode === "live" ? "IA ao vivo" : "Simulado"}</Badge>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  {fmtDateTime(r.started_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
