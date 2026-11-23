import { Suspense } from "react";

import { ActionButton } from "@/components/ActionButton";
import { ErrorPanel, load } from "@/components/BackendError";
import { EmergencyForm } from "@/components/forms";
import { Card, PageHeader, Skeleton, Table, Td } from "@/components/ui";
import { testClaude } from "@/lib/actions";
import { apiGet } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { Overview, Schedule } from "@/lib/types";

export default function Page() {
  return (
    <>
      <PageHeader title="Sistema" subtitle="Parada de emergência, agendamentos do n8n e configuração pública (sem segredos)." />
      <Suspense fallback={<Skeleton rows={4} />}>
        <SystemContent />
      </Suspense>
    </>
  );
}

async function SystemContent() {
  const [[o, err], [schedules]] = await Promise.all([load(apiGet<Overview>("/overview")), load(apiGet<Schedule[]>("/system/schedules"))]);
  if (err || !o) return <ErrorPanel error={err} />;
  const e = o.emergency;
  return (
    <div className="space-y-6">
      <Card title="Parada de emergência" className={e.active ? "border-danger" : ""}>
        <p className="mb-3 text-sm text-muted">
          Bloqueia imediatamente chamadas à Claude API, criação e execução de tarefas (as pendentes ficam “bloqueadas”), disparos do n8n e decisões de aprovação.
          Também pode ser ativada no boot com <code>EMERGENCY_STOP=true</code> no .env.
        </p>
        {e.active && (
          <p className="mb-3 text-sm text-danger">
            Ativa{e.changed_at ? ` desde ${fmtDateTime(e.changed_at)}` : ""}
            {e.changed_by ? ` por ${e.changed_by}` : ""}: {e.reason}
          </p>
        )}
        <EmergencyForm active={e.active} forcedByEnv={e.forced_by_env} />
      </Card>

      <Card title="Claude API">
        <p className="text-sm text-muted">
          Modelo configurado: <span className="font-mono text-text">{String(o.settings.claude_model ?? "—")}</span> · esforço {String(o.settings.claude_effort)}.
          {o.settings.anthropic_api_key_configured ? " A chave está no servidor." : " Defina ANTHROPIC_API_KEY no .env."}
        </p>
        {o.settings.anthropic_api_key_configured === true && (
          <div className="mt-3">
            <ActionButton label="Testar conexão (chamada real de poucos tokens)" action={testClaude} />
          </div>
        )}
      </Card>

      <Card title="Agendamentos (n8n → API)">
        <p className="mb-3 text-xs text-muted">
          Os workflows em <code>workflows/</code> chamam <code>POST /api/v1/scheduler/trigger/&lt;rotina&gt;</code> com o header <code>X-Scheduler-Token</code>.
          Disparos repetidos na mesma janela não duplicam tarefas.
        </p>
        <Table head={["Rotina", "Chave", "Cron (São Paulo)", "Workflow"]}>
          {(schedules ?? []).map((s) => (
            <tr key={s.key}>
              <Td>{s.name}</Td>
              <Td className="font-mono text-xs">{s.key}</Td>
              <Td className="font-mono text-xs">{s.cron}</Td>
              <Td className="font-mono text-xs">{s.workflow_file}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Configuração pública">
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {Object.entries(o.settings).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-border/50 py-1">
              <dt className="font-mono text-xs text-muted">{k}</dt>
              <dd className="text-right text-xs">{String(v)}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
