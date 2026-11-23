# Dashboard — Claude Commerce AI

Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind 4. Instalação e execução: `../../README.md`.

- `src/lib/api.ts` — cliente da API, somente servidor (`server-only`); o token nunca chega ao navegador.
- `src/lib/actions.ts` — Server Actions para mutações (aprovações, emergência, produtos, tarefas).
- `src/proxy.ts` — Basic Auth opcional (`DASHBOARD_USER` / `DASHBOARD_PASSWORD`).

Telas: Visão geral (saúde dos serviços, orçamento, plano), Agentes, Tarefas, Aprovações, Produtos, Custos, Auditoria, Sistema.
