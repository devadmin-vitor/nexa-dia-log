import Link from "next/link";
import { Suspense } from "react";

import { ActionButton } from "@/components/ActionButton";
import { ErrorPanel, load } from "@/components/BackendError";
import { CommissionChart } from "@/components/BarChart";
import { Card, Empty, Kpi, PageHeader, Skeleton, SourceBadge, Table, Td } from "@/components/ui";
import { runAgent } from "@/lib/actions";
import { apiGet } from "@/lib/api";
import { fmtBRL, fmtInt, fmtPct } from "@/lib/format";
import type { Anomaly, Kpis, ProductPerf, SeriesPoint } from "@/lib/types";

interface Metrics {
  kpis: Kpis;
  series: SeriesPoint[];
  by_product: ProductPerf[];
  anomalies: Anomaly[];
}

const RANGES = [7, 30, 90];

export default function Page({ searchParams }: PageProps<"/metricas">) {
  return (
    <>
      <PageHeader
        title="Métricas e comissões"
        subtitle="Cálculos determinísticos (sem IA). EPC = comissão ÷ cliques."
        actions={
          <div className="flex gap-2">
            <ActionButton label="Analisar comissões" action={runAgent.bind(null, "commission_analyst", {})} />
            <ActionButton label="Monitorar desempenho" variant="primary" action={runAgent.bind(null, "performance_monitor", {})} />
          </div>
        }
      />
      <Suspense fallback={<Skeleton rows={5} />}>
        <MetricsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function MetricsContent({ searchParams }: { searchParams: PageProps<"/metricas">["searchParams"] }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const source = ["all", "real", "simulated"].includes(String(sp.source)) ? String(sp.source) : "all";
  const [m, err] = await load(apiGet<Metrics>(`/dashboard/metrics?days=${days}&source=${source}`));
  if (err || !m) return <ErrorPanel error={err} />;
  const q = (d: number, s: string) => `/metricas?days=${d}&source=${s}`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 text-sm">
        {RANGES.map((d) => (
          <Link key={d} href={q(d, source)} className={`rounded-md border px-2.5 py-1 ${d === days ? "border-accent bg-accent/15" : "border-border text-muted"}`}>
            {d} dias
          </Link>
        ))}
        <span className="mx-2 text-border">|</span>
        {[
          ["all", "Todos"],
          ["real", "Reais"],
          ["simulated", "Simulados"],
        ].map(([s, l]) => (
          <Link key={s} href={q(days, s)} className={`rounded-md border px-2.5 py-1 ${s === source ? "border-accent bg-accent/15" : "border-border text-muted"}`}>
            {l}
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Comissão" value={fmtBRL(m.kpis.commission_brl)} />
        <Kpi label="Ticket médio" value={fmtBRL(m.kpis.avg_order_brl)} />
        <Kpi label="Visualizações" value={fmtInt(m.kpis.views)} />
        <Kpi label="EPC" value={fmtBRL(m.kpis.epc_brl)} />
      </div>
      <Card title={`Comissão diária — ${days} dias`}>
        <CommissionChart data={m.series} />
      </Card>
      <Card title="Desempenho por produto">
        {m.by_product.length === 0 ? (
          <Empty>Sem dados para este filtro.</Empty>
        ) : (
          <Table head={["Produto", "Fonte", "Visualiz.", "Cliques", "CTR", "Pedidos", "Conv.", "GMV", "Comissão", "EPC"]}>
            {m.by_product.map((p) => (
              <tr key={p.product_id} className="tabular">
                <Td className="min-w-48 font-sans">{p.product_name}</Td>
                <Td>
                  <SourceBadge source={p.data_source} />
                </Td>
                <Td>{fmtInt(p.views)}</Td>
                <Td>{fmtInt(p.clicks)}</Td>
                <Td>{fmtPct(p.ctr)}</Td>
                <Td>{fmtInt(p.orders)}</Td>
                <Td>{fmtPct(p.conversion_rate)}</Td>
                <Td className="whitespace-nowrap">{fmtBRL(p.gmv_brl)}</Td>
                <Td className="whitespace-nowrap font-medium">{fmtBRL(p.commission_brl)}</Td>
                <Td className="whitespace-nowrap">{fmtBRL(p.epc_brl)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
