import { Suspense } from "react";

import { ActionButton } from "@/components/ActionButton";
import { ErrorPanel, load } from "@/components/BackendError";
import { Badge, PageHeader, Skeleton, SourceBadge, statusTone } from "@/components/ui";
import { runPipeline } from "@/lib/actions";
import { apiGet } from "@/lib/api";
import { CONTENT_STATUS, fmtDay } from "@/lib/format";
import type { ContentItem } from "@/lib/types";

const FORMAT = { short_video: "Vídeo curto", live: "Live", carousel: "Carrossel" } as const;

export default function Page() {
  return (
    <>
      <PageHeader
        title="Calendário editorial"
        subtitle="Planejamento dos próximos dias. O Planejador cria itens como “ideia”; nada é publicado sem aprovação humana."
        actions={<ActionButton label="Planejar semana" variant="primary" action={runPipeline.bind(null, "weekly_planning", {})} />}
      />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Calendar />
      </Suspense>
    </>
  );
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

async function Calendar() {
  const [items, err] = await load(apiGet<ContentItem[]>("/content"));
  if (err || !items) return <ErrorPanel error={err} />;
  const groups = new Map<string, ContentItem[]>();
  for (const it of items) {
    const k = dayKey(it.scheduled_for);
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const days = [...groups.keys()].sort();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {days.map((d) => (
        <section key={d} className="rounded-xl border border-border bg-surface p-3">
          <h2 className="mb-2 text-sm font-semibold capitalize">{fmtDay(groups.get(d)![0].scheduled_for)}</h2>
          <ul className="space-y-2">
            {groups.get(d)!.map((c) => (
              <li key={c.id} className="rounded-lg border border-border/70 bg-surface-2 p-2.5 text-sm">
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="tabular">
                    {new Date(c.scheduled_for).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} · {FORMAT[c.format]}
                  </span>
                  <SourceBadge source={c.data_source} />
                </div>
                <div className="mt-1 font-medium leading-snug">{c.title}</div>
                <div className="mt-1.5">
                  <Badge tone={statusTone(c.status)}>{CONTENT_STATUS[c.status]}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
