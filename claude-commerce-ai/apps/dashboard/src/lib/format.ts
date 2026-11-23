const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const int = new Intl.NumberFormat("pt-BR");
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

export const fmtBRL = (v: number | null | undefined) => (v == null ? "—" : brl.format(Number(v)));
export const fmtInt = (v: number | null | undefined) => int.format(Number(v ?? 0));
export const fmtPct = (v: number | null | undefined) => (v == null ? "—" : pct.format(Number(v)));

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

export const TASK_STATUS: Record<string, string> = {
  queued: "Na fila",
  running: "Executando",
  succeeded: "Concluída",
  failed: "Falhou",
  blocked: "Bloqueada",
  cancelled: "Cancelada",
};

export const SERVICE_STATUS: Record<string, string> = {
  ok: "ok",
  down: "fora do ar",
  not_configured: "não configurado",
  warning: "atenção",
};

export const PRODUCT_STATUS: Record<string, string> = {
  candidate: "Candidato",
  approved: "Aprovado",
  active: "Ativo",
  paused: "Pausado",
  rejected: "Rejeitado",
};

export const ACTION_TYPES: Record<string, string> = {
  publish_content: "Publicar conteúdo",
  change_listing: "Alterar vitrine",
  contact_seller: "Contatar vendedor",
  external_message: "Mensagem externa",
  spend_money: "Gasto",
  financial: "Operação financeira",
};
