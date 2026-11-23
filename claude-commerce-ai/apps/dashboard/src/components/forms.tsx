"use client";

import { useActionState, useState, useTransition } from "react";

import { createProduct, decideApproval, setEmergency } from "@/lib/actions";
import type { ActionResult } from "@/lib/types";

function Result({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-ok" : "text-warn"}`}>
      {state.message}
    </p>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => <span className="mb-1 block text-xs text-muted">{children}</span>;

export function ProductForm() {
  const [state, action, pending] = useActionState(createProduct, null);
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <Label>Nome *</Label>
        <input name="name" required minLength={2} className="w-full" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <Label>Categoria</Label>
          <input name="category" className="w-full" />
        </label>
        <label className="block">
          <Label>ID externo</Label>
          <input name="external_id" className="w-full" />
        </label>
        <label className="block">
          <Label>Preço (R$)</Label>
          <input name="price" inputMode="decimal" className="w-full" />
        </label>
        <label className="block">
          <Label>Comissão (%)</Label>
          <input name="commission_rate" inputMode="decimal" placeholder="12" className="w-full" />
        </label>
      </div>
      <label className="block">
        <Label>URL do produto</Label>
        <input name="product_url" type="url" className="w-full" placeholder="https://" />
      </label>
      <label className="block">
        <Label>Vendedor</Label>
        <input name="seller_name" className="w-full" />
      </label>
      <p className="text-xs text-muted">Produtos com o mesmo ID externo ou a mesma URL não são duplicados.</p>
      <button disabled={pending} className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Salvando…" : "Cadastrar"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function ApprovalForm({ id, critical }: { id: string; critical: boolean }) {
  const [by, setBy] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionResult | null>(null);
  const decide = (approve: boolean) => {
    if (approve && critical && !window.confirm("Ação CRÍTICA (gasto/financeira). Confirma? A execução continuará manual.")) return;
    start(async () => setState(await decideApproval(id, approve, by, reason)));
  };
  return (
    <div className="mt-3 space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input aria-label="Responsável" placeholder="Seu nome (responsável) *" value={by} onChange={(e) => setBy(e.target.value)} />
        <input aria-label="Motivo" placeholder="Motivo / observação" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button disabled={pending} onClick={() => decide(true)} className="rounded-lg bg-ok px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50">
          Aprovar
        </button>
        <button disabled={pending} onClick={() => decide(false)} className="rounded-lg border border-danger px-3 py-1.5 text-sm text-danger disabled:opacity-50">
          Rejeitar
        </button>
      </div>
      <Result state={state} />
    </div>
  );
}

export function EmergencyForm({ active, forcedByEnv }: { active: boolean; forcedByEnv: boolean }) {
  const [by, setBy] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionResult | null>(null);
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input aria-label="Responsável" placeholder="Responsável *" value={by} onChange={(e) => setBy(e.target.value)} />
        <input aria-label="Motivo" placeholder="Motivo *" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <button
        disabled={pending}
        onClick={() => start(async () => setState(await setEmergency(!active, reason, by)))}
        className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${active ? "bg-ok text-black" : "bg-danger text-white"}`}
      >
        {active ? "Liberar operação" : "PARADA DE EMERGÊNCIA (bloquear tudo)"}
      </button>
      {forcedByEnv && <p className="text-xs text-warn">EMERGENCY_STOP=true no .env mantém a parada ativa até ser alterado e a API reiniciada.</p>}
      <Result state={state} />
    </div>
  );
}
