import Link from "next/link";
import { Suspense } from "react";

import { ErrorPanel, load } from "@/components/BackendError";
import { Badge, Card, Empty, PageHeader, Skeleton, Table, Td } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";

const LEVELS = ["all", "info", "warning", "error", "security"];
const TONE = { info: "neutral", warning: "warn", error: "danger", security: "accent" } as const;

export default function Page({ searchParams }: PageProps<"/auditoria">) {
  return (
    <>
      <PageHeader title="Auditoria" subtitle="Registro somente-inserção de todas as ações (sistema, operadores, agendador e agentes)." />
      <Suspense fallback={<Skeleton rows={6} />}>
        <AuditContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AuditContent({ searchParams }: { searchParams: PageProps<"/auditoria">["searchParams"] }) {
  const sp = await searchParams;
  const level = LEVELS.includes(String(sp.level)) ? String(sp.level) : "all";
  const [logs, err] = await load(apiGet<AuditEntry[]>(`/audit?limit=300${level !== "all" ? `&level=${level}` : ""}`));
  if (err || !logs) return <ErrorPanel error={err} />;
  return (
    <Card
      actions={
        <div className="flex flex-wrap gap-1 text-xs">
          {LEVELS.map((l) => (
            <Link key={l} href={l === "all" ? "/auditoria" : `/auditoria?level=${l}`} className={`rounded border px-2 py-0.5 ${l === level ? "border-accent bg-accent/15" : "border-border text-muted"}`}>
              {l === "all" ? "todos" : l}
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
              <Td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(l.created_at)}</Td>
              <Td>
                <Badge tone={TONE[l.level]}>{l.level}</Badge>
              </Td>
              <Td className="whitespace-nowrap">{l.agent_key ?? l.actor}</Td>
              <Td className="font-mono text-xs">
                {l.action}
                {!l.success && <span className="ml-1 text-danger">✕</span>}
              </Td>
              <Td className="max-w-md truncate font-mono text-xs text-muted">{Object.keys(l.details ?? {}).length ? JSON.stringify(l.details) : "—"}</Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
