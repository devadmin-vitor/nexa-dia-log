import Link from "next/link";

import { apiGet } from "@/lib/api";
import { fmtBRL } from "@/lib/format";
import type { Overview } from "@/lib/types";

/** Barra global: parada de emergência, modelo de IA e gasto do dia. */
export async function StatusBar() {
  let o: Overview | null = null;
  try {
    o = await apiGet<Overview>("/overview");
  } catch {
    return (
      <div className="border-b border-danger/40 bg-danger/10 px-4 py-2 text-xs text-danger sm:px-8">
        API ou banco indisponível — rode <code>.\scripts\start.ps1</code> e verifique <code>.\scripts\health.ps1</code>.
      </div>
    );
  }
  const model = o.settings.claude_model as string | null;
  const keyOk = o.settings.anthropic_api_key_configured === true;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-surface/60 px-4 py-2 text-xs sm:px-8">
      {o.emergency.active ? (
        <Link href="/sistema" className="font-semibold text-danger">
          ⛔ PARADA DE EMERGÊNCIA — {o.emergency.reason}
        </Link>
      ) : (
        <span className="text-ok">● Operação liberada</span>
      )}
      <span className={keyOk ? "text-accent" : "text-muted"}>Claude: {keyOk ? model : "não configurada"}</span>
      <span className="text-muted">
        API hoje: {fmtBRL(o.budget.today_brl)} / {fmtBRL(o.budget.daily_limit_brl)}
      </span>
      <span className="text-muted">Marca: {String(o.settings.brand_name)}</span>
    </div>
  );
}
