import { Suspense } from "react";

import { ActionButton } from "@/components/ActionButton";
import { ErrorPanel, load } from "@/components/BackendError";
import { Badge, Card, Empty, PageHeader, Skeleton, SourceBadge, statusTone } from "@/components/ui";
import { markPublished, runPipeline } from "@/lib/actions";
import { apiGet } from "@/lib/api";
import { CONTENT_STATUS, fmtDateTime } from "@/lib/format";
import type { ContentItem } from "@/lib/types";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Roteiros"
        subtitle="O Roteirista usa somente fatos verificados; o Revisor de Conformidade aplica regras obrigatórias (divulgação #publi, sem promessas, sem depoimentos inventados, sem demonstração sem amostra)."
      />
      <Suspense fallback={<Skeleton rows={5} />}>
        <Scripts />
      </Suspense>
    </>
  );
}

async function Scripts() {
  const [items, err] = await load(apiGet<ContentItem[]>("/content"));
  if (err || !items) return <ErrorPanel error={err} />;
  if (!items.length) return <Empty>Nenhum conteúdo no calendário.</Empty>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map((c) => (
        <Card
          key={c.id}
          title={c.title}
          actions={
            <span className="flex items-center gap-1.5">
              <SourceBadge source={c.data_source} />
              <Badge tone={statusTone(c.status)}>{CONTENT_STATUS[c.status]}</Badge>
            </span>
          }
        >
          <div className="text-xs text-muted">
            {c.product_name} · {fmtDateTime(c.scheduled_for)}
          </div>
          {c.script ? (
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <span className="text-muted">Gancho: </span>
                {c.script.hook}
              </p>
              <ul className="list-disc space-y-0.5 pl-5">
                {c.script.body.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              <p>
                <span className="text-muted">CTA: </span>
                {c.script.call_to_action}
              </p>
              <p className="text-accent-2">{c.script.disclosure}</p>
              {c.script.shot_list.length > 0 && <p className="text-xs text-muted">Cenas: {c.script.shot_list.join(" · ")}</p>}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Sem roteiro ainda.</p>
          )}
          {c.compliance_issues.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs">
              {c.compliance_issues.map((i, n) => (
                <li key={n}>
                  <Badge tone={statusTone(i.severity)}>{i.severity}</Badge> <span className="font-mono">{i.rule}</span> — {i.detail}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {["idea", "scripted", "blocked"].includes(c.status) && (
              <ActionButton
                label={c.script ? "Reescrever e revisar" : "Gerar roteiro + revisão"}
                variant="primary"
                action={runPipeline.bind(null, "content_pipeline", { content_id: c.id })}
              />
            )}
            {c.status === "approved" && <ActionButton label="Marcar como publicado (manual)" action={markPublished.bind(null, c.id)} />}
          </div>
        </Card>
      ))}
    </div>
  );
}
