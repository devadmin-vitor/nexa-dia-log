"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "@/lib/types";

type Variant = "primary" | "secondary" | "danger";

const STYLES: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent/90",
  secondary: "border border-border bg-surface-2 text-text hover:bg-surface-2/70",
  danger: "bg-danger text-white hover:bg-danger/90",
};

export function ActionButton({
  action,
  label,
  pendingLabel = "Executando…",
  variant = "secondary",
  confirm,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  variant?: Variant;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setResult(await action()));
        }}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${STYLES[variant]}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {result && (
        <span role="status" className={`text-xs ${result.ok ? "text-ok" : "text-danger"}`}>
          {result.message}
        </span>
      )}
    </span>
  );
}
