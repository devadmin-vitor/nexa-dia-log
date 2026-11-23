import Link from "next/link";
import { Suspense } from "react";

import { ErrorPanel, load } from "@/components/BackendError";
import { Badge, Card, Kpi, PageHeader, Skeleton, statusTone } from "@/components/ui";
import { apiGet, apiServicesHealth } from "@/lib/api";
import { fmtBRL, fmtInt, SERVICE_STATUS } from "@/lib/format";
import type { Overview, ServicesHealth } from "@/lib/types";

const SPRINTS = [
  { n: 1, name: "Infraestrutura", items: "Docker, Supabase, FastAPI, n8n, Next.js, saúde dos serviços", status: "entregue" },
  { n: 2, name: "Inteligência automática", items: "Agentes executando pela API — fora do escopo: análise e escrita feitas no Cowork", status: "não será feita" },
  { n: 3, name: "Fábrica audiovisual", items: "Roteiros, voz (TTS local), templates, legendas, FFmpeg/Remotion", status: "a decidir" },
  { n: 4, name: "Gestão", items: "Relatórios, financeiro, conciliação, alertas", status: "a decidir" },
  { n: 5, name: "TikTok", items: "Integrações autorizadas, publicação, acompanhamento de afiliados", status: "depende de aprovação" },
];

export default function Page() {
  return (
    <>
      <PageHeader title="Visão geral" subtitle="Saúde da stack local, parada de emergência, orçamento e fila de tarefas." />
      <Suspense fallback={<Skeleton rows={4} />}>
        <OverviewContent />
      </Suspense>
    </>
  );
}

async function OverviewContent() {
  const [[o, err], [health, healthErr]] = await Promise.all([
    load(apiGet<Overview>("/overview")),
    load(apiServicesHealth<ServicesHealth>()),
  ]);
  if (err || !o) return <ErrorPanel error={err ?? healthErr} />;
  const b = o.budget;
  const dailyPct = b.daily_limit_brl ? b.today_brl / b.daily_limit_brl : 0;
  const monthPct = b.monthly_limit_brl ? b.month_brl / b.monthly_limit_brl : 0;

  return (
    <div className="space-y-6">
      {o.emergency.active && (
        <div className="rounded-xl border border-danger bg-danger/10 px-4 py-3 text-sm text-danger">
          Parada de emergência ativa: {o.emergency.reason}. Agentes, tarefas, agendamentos e aprovações estão bloqueados.{" "}
          <Link href="/sistema" className="underline">
            Gerenciar
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Agentes" value={fmtInt(o.agents)} hint="registrados" />
        <Kpi label="Tarefas hoje" value={fmtInt(o.tasks.today)} hint={`${o.tasks.queued} na fila`} />
        <Kpi label="Falhas" value={fmtInt(o.tasks.failed)} />
        <Kpi label="Aprovações" value={fmtInt(o.pending_approvals)} hint="pendentes" />
        <Kpi label="Produtos" value={fmtInt(o.products.real)} hint={o.products.simulated ? `+${o.products.simulated} simulados` : "reais"} />
        <Kpi label="API hoje" value={fmtBRL(b.today_brl)} hint={`limite ${fmtBRL(b.daily_limit_brl)}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          title="Saúde dos serviços"
          className="xl:col-span-2"
          actions={health ? <Badge tone={health.ok ? "ok" : "danger"}>{health.ok ? "obrigatórios ok" : "atenção"}</Badge> : null}
        >
          {!health ? (
            <ErrorPanel error={healthErr} />
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {health.services.map((s) => (
                <li key={s.key} className="flex flex-wrap items-start justify-between gap-2 py-2">
                  <span className="min-w-40 font-medium">{s.name}</span>
                  <span className="min-w-0 flex-1 text-xs text-muted">{s.detail}</span>
                  <Badge tone={statusTone(s.status)}>{SERVICE_STATUS[s.status] ?? s.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Orçamento">
          <Meter label="Hoje (API)" value={b.today_brl} limit={b.daily_limit_brl} pct={dailyPct} />
          <div className="h-4" />
          <Meter label="Mês" value={b.month_brl} limit={b.monthly_limit_brl} pct={monthPct} />
          {!b.usd_brl_rate && (
            <p className="mt-4 text-xs text-warn">USD_BRL_RATE não configurada: chamadas pagas à Claude API ficam bloqueadas.</p>
          )}
        </Card>
      </div>

      <Card title="Plano de construção">
        <ol className="grid gap-3 md:grid-cols-5">
          {SPRINTS.map((s) => (
            <li key={s.n} className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {s.n}. {s.name}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{s.items}</p>
              <div className="mt-2">
                <Badge tone={s.n === 1 ? "ok" : "neutral"}>{s.status}</Badge>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Meter({ label, value, limit, pct }: { label: string; value: number; limit: number; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular text-muted">
          {fmtBRL(value)} / {fmtBRL(limit)}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded bg-surface-2" role="meter" aria-valuenow={value} aria-valuemax={limit} aria-label={label}>
        <div className={`h-full ${pct >= 0.8 ? "bg-danger" : "bg-accent"}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
    </div>
  );
}
