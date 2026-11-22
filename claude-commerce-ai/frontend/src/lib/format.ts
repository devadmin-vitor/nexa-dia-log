const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const int = new Intl.NumberFormat("pt-BR");
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

export const fmtBRL = (v: number) => brl.format(v ?? 0);
export const fmtInt = (v: number) => int.format(v ?? 0);
export const fmtPct = (v: number) => pct.format(v ?? 0);
export const fmtUSD = (v: number) => `US$ ${(v ?? 0).toFixed(4)}`;

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

export function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

export const AGENT_NAMES: Record<string, string> = {
  product_researcher: "Pesquisador de Produtos",
  commission_analyst: "Analista de Comissões",
  content_planner: "Planejador Editorial",
  scriptwriter: "Roteirista",
  compliance_reviewer: "Revisor de Conformidade",
  performance_monitor: "Monitor de Desempenho",
  operations_guardian: "Guardião de Operações",
  orchestrator: "Orquestrador Central",
};

export const CONTENT_STATUS: Record<string, string> = {
  idea: "Ideia",
  scripted: "Roteirizado",
  in_review: "Aguardando aprovação",
  blocked: "Bloqueado (conformidade)",
  approved: "Aprovado",
  published_manual: "Publicado (manual)",
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
  financial: "Operação financeira",
};

export const SOURCE_LABEL: Record<string, string> = {
  simulated: "Simulado",
  manual: "Manual",
  csv_import: "Importado",
  tiktok_api: "API TikTok",
};
