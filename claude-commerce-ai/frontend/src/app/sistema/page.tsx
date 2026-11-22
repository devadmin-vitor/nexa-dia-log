import { Suspense } from "react";

import { ActionButton } from "@/components/ActionButton";
import { ErrorPanel, load } from "@/components/BackendError";
import { KillSwitchForm } from "@/components/forms";
import { Badge, Card, PageHeader, Skeleton, statusTone, Table, Td } from "@/components/ui";
import { testClaude, toggleTask } from "@/lib/actions";
import { apiGet } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { SystemStatus } from "@/lib/types";

const STATE_LABEL: Record<string, string> = {
  verified: "verificado",
  simulated: "simulado",
  not_configured: "não configurado",
  configured_unverified: "configurado, não verificado",
  configured_not_connected: "configurado, não conectado",
  credentials_present_not_implemented: "credenciais presentes, conector não implementado",
  token_configured: "token configurado, sem disparos",
  receiving: "recebendo disparos",
};

export default function Page() {
  return (
    <>
      <PageHeader title="Sistema e integrações" subtitle="Status real de cada integração — nada aparece como “verificado” sem um teste bem-sucedido." />
      <Suspense fallback={<Skeleton rows={4} />}>
        <SystemContent />
      </Suspense>
    </>
  );
}

async function SystemContent() {
  const [s, err] = await load(apiGet<SystemStatus>("/system/status"));
  if (err || !s) return <ErrorPanel error={err} />;
  const ks = s.kill_switch;
  return (
    <div className="space-y-6">
      <Card title="Mecanismo de interrupção (kill switch)" className={ks.kill_switch_active ? "border-danger" : ""}>
        <p className="mb-3 text-sm text-muted">
          Quando ativo, bloqueia execuções de agentes, pipelines, disparos do agendador e decisões de aprovação. Também pode ser ativado no boot com <code>KILL_SWITCH=1</code>.
        </p>
        {ks.kill_switch_active && (
          <p className="mb-3 text-sm text-danger">
            Ativo desde {fmtDateTime(ks.kill_switch_changed_at)} por {ks.kill_switch_changed_by}: {ks.kill_switch_reason}
          </p>
        )}
        <KillSwitchForm active={ks.kill_switch_active} />
      </Card>

      <Card title="Integrações">
        <div className="grid gap-3 md:grid-cols-2">
          {s.integrations.map((i) => (
            <div key={i.key} className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{i.name}</span>
                <Badge tone={i.verified ? "ok" : statusTone(i.state)}>{STATE_LABEL[i.state] ?? i.state}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">{i.note}</p>
              {typeof i.fallback === "string" && <p className="mt-1 text-xs">Alternativa: {i.fallback}</p>}
              {i.key === "claude" && i.state !== "simulated" && i.state !== "not_configured" && (
                <div className="mt-2">
                  <ActionButton label="Testar conexão (chamada real, poucos tokens)" action={testClaude} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Tarefas agendadas">
        <p className="mb-3 text-xs text-muted">
          Disparadas pelo n8n via <code>POST /api/v1/scheduler/trigger/&lt;tarefa&gt;</code> com o header <code>X-Scheduler-Token</code>. Workflows em <code>n8n/workflows/</code>.
        </p>
        <Table head={["Tarefa", "Pipeline", "Cron (UTC)", "Último disparo", "Status", ""]}>
          {s.scheduled_tasks.map((t) => (
            <tr key={t.key}>
              <Td>{t.name}</Td>
              <Td className="font-mono text-xs">{t.pipeline}</Td>
              <Td className="font-mono text-xs">{t.cron}</Td>
              <Td className="whitespace-nowrap text-xs">{fmtDateTime(t.last_run_at)}</Td>
              <Td>{t.last_status ? <Badge tone={statusTone(t.last_status)}>{t.last_status}</Badge> : "—"}</Td>
              <Td>
                <ActionButton label={t.enabled ? "Pausar" : "Ativar"} action={toggleTask.bind(null, t.key, !t.enabled)} />
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Configuração pública (sem segredos)">
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {Object.entries(s.settings).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-border/50 py-1">
              <dt className="font-mono text-xs text-muted">{k}</dt>
              <dd className="text-xs">{String(v)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-b border-border/50 py-1">
            <dt className="font-mono text-xs text-muted">storage</dt>
            <dd className="text-xs">{s.storage}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
