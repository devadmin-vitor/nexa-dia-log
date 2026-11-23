"use server";

import { refresh } from "next/cache";

import { apiSend, BackendError } from "@/lib/api";
import type { ActionResult } from "@/lib/types";

const uuid = /^[0-9a-f-]{36}$/;

async function wrap(fn: () => Promise<unknown>, ok: string): Promise<ActionResult> {
  try {
    await fn();
    refresh();
    return { ok: true, message: ok };
  } catch (e) {
    return { ok: false, message: e instanceof BackendError ? e.message : "Erro inesperado" };
  }
}

export async function setEmergency(active: boolean, reason: string, changedBy: string): Promise<ActionResult> {
  if (reason.trim().length < 3 || changedBy.trim().length < 2) return { ok: false, message: "Informe motivo e responsável" };
  return wrap(
    () => apiSend("/system/emergency", "POST", { active, reason: reason.trim(), changed_by: changedBy.trim() }),
    active ? "Parada de emergência ATIVADA" : "Operação liberada",
  );
}

export async function decideApproval(id: string, approve: boolean, decidedBy: string, reason: string): Promise<ActionResult> {
  if (!uuid.test(id)) return { ok: false, message: "ID inválido" };
  if (decidedBy.trim().length < 2) return { ok: false, message: "Informe quem está decidindo" };
  return wrap(
    () => apiSend(`/approvals/${id}/decision`, "POST", { approve, decided_by: decidedBy.trim(), reason: reason || null }),
    approve ? "Aprovado" : "Rejeitado",
  );
}

export async function cancelTask(id: string): Promise<ActionResult> {
  if (!uuid.test(id)) return { ok: false, message: "ID inválido" };
  return wrap(() => apiSend(`/tasks/${id}/cancel`, "POST"), "Tarefa cancelada");
}

export async function updateProductStatus(id: string, status: string): Promise<ActionResult> {
  if (!uuid.test(id)) return { ok: false, message: "ID inválido" };
  return wrap(() => apiSend(`/products/${id}/status`, "PATCH", { status }), "Status atualizado");
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

export async function createProduct(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const num = (k: string) => {
    const raw = String(form.get(k) ?? "").replace(",", ".").trim();
    return raw === "" ? null : Number(raw);
  };
  const rate = num("commission_rate");
  const text = (k: string) => String(form.get(k) ?? "").trim() || null;
  const body = {
    name: String(form.get("name") ?? "").trim(),
    category: text("category"),
    seller_name: text("seller_name"),
    external_id: text("external_id"),
    product_url: text("product_url"),
    price: num("price"),
    commission_rate: rate != null && rate > 1 ? rate / 100 : rate,
    source: "manual",
  };
  try {
    const r = await apiSend<{ created: boolean; message: string }>("/products", "POST", body);
    refresh();
    return { ok: r.created, message: r.message };
  } catch (e) {
    return { ok: false, message: e instanceof BackendError ? e.message : "Erro inesperado" };
  }
}
