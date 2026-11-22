import { Suspense } from "react";

import { ErrorPanel, load } from "@/components/BackendError";
import { ApprovalForm } from "@/components/forms";
import { Badge, Card, Empty, PageHeader, Skeleton, SourceBadge, statusTone } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { ACTION_TYPES, AGENT_NAMES, fmtDateTime } from "@/lib/format";
import type { Approval } from "@/lib/types";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Aprovações"
        subtitle="Toda ação externa (publicar, alterar vitrine, contatar vendedor) e toda operação financeira exige decisão humana. Operações financeiras nunca são executadas pelo sistema."
      />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Approvals />
      </Suspense>
    </>
  );
}

async function Approvals() {
  const [items, err] = await load(apiGet<Approval[]>("/approvals"));
  if (err || !items) return <ErrorPanel error={err} />;
  const pending = items.filter((a) => a.status === "pending");
  const done = items.filter((a) => a.status !== "pending");
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">Pendentes ({pending.length})</h2>
        {pending.length === 0 ? (
          <Empty>Nada aguardando decisão.</Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((a) => (
              <Card
                key={a.id}
                title={a.title}
                actions={
                  <span className="flex gap-1.5">
                    <SourceBadge source={a.data_source} />
                    <Badge tone={a.risk_level === "critical" || a.risk_level === "high" ? "danger" : "warn"}>risco {a.risk_level}</Badge>
                  </span>
                }
              >
                <div className="text-xs text-muted">
                  {ACTION_TYPES[a.action_type] ?? a.action_type} · solicitado por {AGENT_NAMES[a.agent_key] ?? a.agent_key} · {fmtDateTime(a.requested_at)}
                </div>
                <p className="mt-2 text-sm">{a.summary}</p>
                {Object.keys(a.payload).length > 0 && <pre className="mt-2 overflow-auto rounded bg-bg p-2 text-xs text-muted">{JSON.stringify(a.payload, null, 2)}</pre>}
                <ApprovalForm id={a.id} critical={a.action_type === "financial"} />
              </Card>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">Histórico</h2>
        {done.length === 0 ? (
          <Empty>Sem decisões registradas.</Empty>
        ) : (
          <div className="space-y-2">
            {done.map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.title}</span>
                  <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                  <Badge tone={statusTone(a.execution_status)}>{a.execution_status}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted">
                  {a.decided_by} · {fmtDateTime(a.decided_at)} {a.decision_reason && `· “${a.decision_reason}”`}
                </div>
                {a.execution_note && <p className="mt-1 text-xs text-warn">{a.execution_note}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
