import Link from "next/link";

import { apiGet } from "@/lib/api";
import type { SystemStatus } from "@/lib/types";

/** Barra de status global: modo de IA, kill switch e aviso de dados simulados. */
export async function StatusBar() {
  let status: SystemStatus | null = null;
  try {
    status = await apiGet<SystemStatus>("/system/status");
  } catch {
    return (
      <div className="border-b border-danger/40 bg-danger/10 px-4 py-2 text-xs text-danger sm:px-8">
        Backend indisponível — os dados não podem ser carregados.
      </div>
    );
  }
  const live = status.settings.ai_live_enabled === true;
  const ks = status.kill_switch;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-surface/60 px-4 py-2 text-xs sm:px-8">
      {ks.kill_switch_active ? (
        <Link href="/sistema" className="font-semibold text-danger">
          ⛔ KILL SWITCH ATIVO — {ks.kill_switch_reason}
        </Link>
      ) : (
        <span className="text-ok">● Operação normal</span>
      )}
      <span className={live ? "text-accent" : "text-sim"}>IA: {live ? `ao vivo (${status.settings.claude_model})` : "modo simulado"}</span>
      <span className="text-muted">Armazenamento: memória (Fase 1)</span>
      <span className="text-sim">Itens com selo “Simulado” são fictícios e não devem orientar decisões reais.</span>
    </div>
  );
}
