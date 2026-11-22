"use server";

import { refresh } from "next/cache";

import { apiSend, apiUpload, BackendError } from "@/lib/api";
import type { ActionResult } from "@/lib/types";

async function wrap(fn: () => Promise<unknown>, ok: string): Promise<ActionResult> {
  try {
    await fn();
    refresh();
    return { ok: true, message: ok };
  } catch (e) {
    const msg = e instanceof BackendError ? e.message : "Erro inesperado";
    return { ok: false, message: msg };
  }
}

const safeKey = (s: string) => /^[a-z_]{2,40}$/.test(s);
const safeId = (s: string) => /^[0-9a-f-]{36}$/.test(s);

export async function runAgent(agentKey: string, params: Record<string, string> = {}): Promise<ActionResult> {
  if (!safeKey(agentKey)) return { ok: false, message: "Agente inválido" };
  return wrap(() => apiSend(`/agents/${agentKey}/run`, "POST", { params }), "Agente executado");
}

export async function runPipeline(pipelineKey: string, params: Record<string, string> = {}): Promise<ActionResult> {
  if (!safeKey(pipelineKey)) return { ok: false, message: "Pipeline inválido" };
  try {
    const res = await apiSend<{ status: string }>(`/pipelines/${pipelineKey}/run`, "POST", { params });
    refresh();
    return { ok: res.status === "succeeded", message: `Pipeline finalizado: ${res.status}` };
  } catch (e) {
    return { ok: false, message: e instanceof BackendError ? e.message : "Erro inesperado" };
  }
}

export async function decideApproval(id: string, approve: boolean, decidedBy: string, reason: string): Promise<ActionResult> {
  if (!safeId(id)) return { ok: false, message: "ID inválido" };
  if (decidedBy.trim().length < 2) return { ok: false, message: "Informe quem está decidindo" };
  return wrap(
    () => apiSend(`/approvals/${id}/decision`, "POST", { approve, decided_by: decidedBy.trim(), reason: reason || null }),
    approve ? "Aprovado" : "Rejeitado",
  );
}

export async function setKillSwitch(active: boolean, reason: string, changedBy: string): Promise<ActionResult> {
  if (reason.trim().length < 3 || changedBy.trim().length < 2) return { ok: false, message: "Informe motivo e responsável" };
  return wrap(
    () => apiSend("/system/kill-switch", "POST", { active, reason: reason.trim(), changed_by: changedBy.trim() }),
    active ? "Kill switch ATIVADO" : "Kill switch desativado",
  );
}

export async function toggleTask(key: string, enabled: boolean): Promise<ActionResult> {
  if (!safeKey(key)) return { ok: false, message: "Tarefa inválida" };
  return wrap(() => apiSend(`/scheduled-tasks/${key}`, "PATCH", { enabled }), enabled ? "Tarefa ativada" : "Tarefa pausada");
}

export async function testClaude(): Promise<ActionResult> {
  try {
    const r = await apiSend<{ ok: boolean; error?: string; model?: string }>("/integrations/claude/test", "POST");
    refresh();
    return r.ok ? { ok: true, message: `Conexão verificada (${r.model})` } : { ok: false, message: `Falhou: ${r.error}` };
  } catch (e) {
    return { ok: false, message: e instanceof BackendError ? e.message : "Erro inesperado" };
  }
}

export async function markPublished(contentId: string): Promise<ActionResult> {
  if (!safeId(contentId)) return { ok: false, message: "ID inválido" };
  return wrap(() => apiSend(`/content/${contentId}/mark-published`, "POST"), "Marcado como publicado");
}

export async function updateProductStatus(productId: string, status: string): Promise<ActionResult> {
  if (!safeId(productId)) return { ok: false, message: "ID inválido" };
  return wrap(() => apiSend(`/products/${productId}/status`, "PATCH", { status }), "Status atualizado");
}

export async function createProduct(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const claims = String(form.get("verified_claims") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const rate = Number(String(form.get("commission_rate") ?? "0").replace(",", "."));
  const body = {
    name: String(form.get("name") ?? ""),
    category: String(form.get("category") ?? ""),
    price_brl: Number(String(form.get("price_brl") ?? "0").replace(",", ".")),
    commission_rate: rate > 1 ? rate / 100 : rate,
    seller_name: String(form.get("seller_name") ?? "") || null,
    external_product_id: String(form.get("external_product_id") ?? "") || null,
    verified_claims: claims,
    media_rights_confirmed: form.get("media_rights_confirmed") === "on",
    sample_received: form.get("sample_received") === "on",
  };
  return wrap(() => apiSend("/products", "POST", body), "Produto cadastrado");
}

export async function importFile(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const kind = String(form.get("kind"));
  const file = form.get("file");
  if (!["products", "metrics"].includes(kind)) return { ok: false, message: "Tipo inválido" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Selecione um arquivo" };
  try {
    const b = await apiUpload<{ rows_ok: number; rows_error: number }>(`/imports/${kind}`, file);
    refresh();
    return { ok: b.rows_error === 0, message: `${b.rows_ok} linhas importadas, ${b.rows_error} com erro` };
  } catch (e) {
    return { ok: false, message: e instanceof BackendError ? e.message : "Erro inesperado" };
  }
}
