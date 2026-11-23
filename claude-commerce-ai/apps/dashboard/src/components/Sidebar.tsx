"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Visão geral" },
  { href: "/agentes", label: "Agentes" },
  { href: "/tarefas", label: "Tarefas" },
  { href: "/aprovacoes", label: "Aprovações" },
  { href: "/produtos", label: "Produtos" },
  { href: "/custos", label: "Custos" },
  { href: "/auditoria", label: "Auditoria" },
  { href: "/sistema", label: "Sistema" },
];

export function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const links = (
    <nav className="flex flex-col gap-0.5 p-3" aria-label="Principal">
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-accent/15 font-medium text-text" : "text-muted hover:bg-surface-2 hover:text-text"}`}
            aria-current={active ? "page" : undefined}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Brand />
        <button onClick={() => setOpen((o) => !o)} className="rounded-md border border-border px-3 py-1.5 text-sm" aria-expanded={open}>
          Menu
        </button>
      </div>
      {open && <div className="border-b border-border bg-surface lg:hidden">{links}</div>}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="border-b border-border px-5 py-4">
          <Brand />
        </div>
        {links}
        <div className="mt-auto p-4 text-[11px] leading-relaxed text-muted">Sprint 1 · infraestrutura local. Nenhum dado fictício é exibido como real.</div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-7 w-7 place-items-center rounded-md bg-accent text-xs font-bold text-white">CC</div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">Claude Commerce AI</div>
        <div className="text-[11px] text-muted">Afiliados TikTok Shop BR · local</div>
      </div>
    </div>
  );
}
