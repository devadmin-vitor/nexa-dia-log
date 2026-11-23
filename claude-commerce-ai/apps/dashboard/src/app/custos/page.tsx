import { Suspense } from "react";

import { ErrorPanel, load } from "@/components/BackendError";
import { Card, Empty, Kpi, PageHeader, Skeleton, Table, Td } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { fmtBRL, fmtInt } from "@/lib/format";
import type { Costs } from "@/lib/types";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Custos"
        subtitle="Consumo de API registrado em cost_usage. Chamadas são bloqueadas antes de ultrapassar o limite diário ou mensal."
      />
      <Suspense fallback={<Skeleton rows={4} />}>
        <CostsContent />
      </Suspense>
    </>
  );
}

async function CostsContent() {
  const [c, err] = await load(apiGet<Costs>("/costs"));
  if (err || !c) return <ErrorPanel error={err} />;
  const b = c.budget;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Hoje" value={fmtBRL(b.today_brl)} hint={`restam ${fmtBRL(b.daily_remaining_brl)}`} />
        <Kpi label="Limite diário" value={fmtBRL(b.daily_limit_brl)} />
        <Kpi label="Mês" value={fmtBRL(b.month_brl)} hint={`restam ${fmtBRL(b.monthly_remaining_brl)}`} />
        <Kpi label="Cotação USD" value={b.usd_brl_rate ? `R$ ${b.usd_brl_rate.toFixed(2)}` : "não definida"} />
      </div>
      <Card title="Por agente e modelo">
        {c.by_agent.length === 0 ? (
          <Empty>Nenhuma chamada paga registrada.</Empty>
        ) : (
          <Table head={["Agente", "Modelo", "Chamadas", "Tokens entrada", "Tokens saída", "Custo"]}>
            {c.by_agent.map((r, i) => (
              <tr key={i} className="tabular">
                <Td className="font-mono text-xs">{r.agent_key ?? "—"}</Td>
                <Td className="font-mono text-xs">{r.model}</Td>
                <Td>{fmtInt(r.calls)}</Td>
                <Td>{fmtInt(r.input_tokens)}</Td>
                <Td>{fmtInt(r.output_tokens)}</Td>
                <Td>{fmtBRL(r.cost_brl)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card title="Por dia (últimos 31)">
        {c.daily.length === 0 ? (
          <Empty>Sem consumo registrado.</Empty>
        ) : (
          <Table head={["Dia", "Provedor", "Chamadas", "Custo"]}>
            {c.daily.map((r) => (
              <tr key={`${r.day}-${r.provider}`} className="tabular">
                <Td>{new Date(r.day + "T12:00:00").toLocaleDateString("pt-BR")}</Td>
                <Td>{r.provider}</Td>
                <Td>{fmtInt(r.calls)}</Td>
                <Td>{fmtBRL(r.cost_brl)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
