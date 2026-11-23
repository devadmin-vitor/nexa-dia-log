import Link from "next/link";
import { Suspense } from "react";

import { ActionButton } from "@/components/ActionButton";
import { ErrorPanel, load } from "@/components/BackendError";
import { Badge, Card, Empty, PageHeader, Skeleton, statusTone, Table, Td } from "@/components/ui";
import { cancelTask } from "@/lib/actions";
import { apiGet } from "@/lib/api";
import { fmtDateTime, TASK_STATUS } from "@/lib/format";
import type { Task, TaskCounts } from "@/lib/types";

const FILTERS = ["all", "queued", "running", "succeeded", "failed", "blocked", "cancelled"];

export default function Page({ searchParams }: PageProps<"/tarefas">) {
  return (
    <>
      <PageHeader
        title="Tarefas"
        subtitle="Fila persistida no banco (agent_tasks) com prioridade, idempotência e re-tentativas. O worker que executa as tarefas chega na Sprint 2."
      />
      <Suspense fallback={<Skeleton rows={5} />}>
        <Tasks searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Tasks({ searchParams }: { searchParams: PageProps<"/tarefas">["searchParams"] }) {
  const sp = await searchParams;
  const status = FILTERS.includes(String(sp.status)) ? String(sp.status) : "all";
  const [data, err] = await load(apiGet<{ tasks: Task[]; counts: TaskCounts }>(`/tasks${status !== "all" ? `?status=${status}` : ""}`));
  if (err || !data) return <ErrorPanel error={err} />;
  return (
    <Card
      actions={
        <div className="flex flex-wrap gap-1 text-xs">
          {FILTERS.map((f) => (
            <Link key={f} href={f === "all" ? "/tarefas" : `/tarefas?status=${f}`} className={`rounded border px-2 py-0.5 ${f === status ? "border-accent bg-accent/15" : "border-border text-muted"}`}>
              {f === "all" ? "todas" : TASK_STATUS[f]} {f !== "all" && `(${data.counts[f as keyof TaskCounts]})`}
            </Link>
          ))}
        </div>
      }
    >
      {data.tasks.length === 0 ? (
        <Empty>Nenhuma tarefa. Elas são criadas pelos agendamentos do n8n ou pela API.</Empty>
      ) : (
        <Table head={["Criada", "Agente", "Tipo", "Prioridade", "Status", "Tentativas", "Origem", ""]}>
          {data.tasks.map((t) => (
            <tr key={t.id}>
              <Td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(t.created_at)}</Td>
              <Td className="font-mono text-xs">{t.agent_key}</Td>
              <Td className="font-mono text-xs">{t.task_type}</Td>
              <Td>{t.priority}</Td>
              <Td>
                <Badge tone={statusTone(t.status)}>{TASK_STATUS[t.status]}</Badge>
                {t.error_message && <div className="mt-1 max-w-xs text-xs text-danger">{t.error_message}</div>}
              </Td>
              <Td>
                {t.attempts}/{t.max_attempts}
              </Td>
              <Td className="text-xs text-muted">{t.requested_by ?? "—"}</Td>
              <Td>{["queued", "blocked"].includes(t.status) && <ActionButton label="Cancelar" action={cancelTask.bind(null, t.id)} />}</Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
