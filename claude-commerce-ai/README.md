# Claude Commerce AI — Fase 1

Plataforma de gestão para uma operação de afiliados do **TikTok Shop Brasil**: sete agentes especializados de IA
coordenados por um orquestrador central, dashboard escuro responsivo, aprovações humanas, auditoria,
controle de custos e kill switch.

> **Status da Fase 1:** o dashboard funciona com **dados simulados** (marcados em roxo como “Simulado”).
> A Claude API está integrada no código, mas **não foi testada com uma chave real** neste ambiente.
> A integração oficial com o TikTok Shop **não está implementada** e depende de aprovação externa.

```
claude-commerce-ai/
├── backend/            FastAPI + agentes (Python 3.11+)
│   ├── app/agents/     7 agentes + orquestrador
│   ├── app/services/   cliente Claude, conformidade, aprovações, importador, analytics
│   ├── app/integrations/  status honesto das integrações (TikTok, Claude, Supabase, n8n)
│   ├── app/store/      repositório em memória + seed simulado
│   └── tests/          26 testes (pytest)
├── frontend/           Next.js 16 + TypeScript + Tailwind 4 (dashboard)
├── supabase/migrations/0001_initial_schema.sql
├── n8n/workflows/      3 workflows agendados (importáveis no n8n)
├── cowork/PLAYBOOK.md  rotina de operação assistida (Claude Cowork)
└── docs/               ARCHITECTURE, SECURITY, INTEGRATIONS, templates CSV
```

## O que foi construído

| Requisito | Fase 1 |
|---|---|
| Dashboard responsivo, tema escuro | ✅ 10 telas: visão geral, produtos, calendário, roteiros, métricas, agentes, aprovações, importação, logs/custos, sistema |
| 7 agentes + orquestrador | ✅ Pesquisador de Produtos, Analista de Comissões, Planejador Editorial, Roteirista, Revisor de Conformidade, Monitor de Desempenho, Guardião de Operações; orquestrador determinístico com 4 pipelines |
| Cadastro e classificação de produtos | ✅ cadastro manual + classificação A/B/C com score |
| Calendário editorial e roteiros | ✅ planejamento de 7 dias; roteiros só com fatos verificados; revisão de conformidade obrigatória |
| Métricas e comissões | ✅ KPIs, EPC, conversão, série diária, alertas semana × semana |
| Ações e aprovações | ✅ ações externas e financeiras exigem decisão humana; financeiras nunca são executadas pelo sistema |
| TikTok Shop oficial | ⏳ **não implementado** — aguardando aprovação (status exibido como “não configurado”) |
| Importação CSV/XLSX | ✅ produtos e métricas, com aliases de colunas e relatório de erros por linha |
| Tarefas agendadas | ✅ endpoint com token próprio + workflows n8n (JSON gerado, **não importado/testado em uma instância n8n**) |
| Custos, erros, segurança | ✅ custo por execução, orçamento diário, logs JSON com mascaramento, auditoria, kill switch, tokens só no servidor |
| Banco de dados | ✅ esquema Supabase/PostgreSQL validado em PostgreSQL 16; ⏳ backend ainda usa repositório em memória |

### Separação real × simulado
Toda entidade tem `data_source` (`simulated`, `manual`, `csv_import`, `tiktok_api`). O dashboard filtra por fonte,
exibe selos e um aviso quando todos os números são simulados. Agentes recebem a fonte no contexto e são instruídos
a sinalizá-la. Cada execução de agente registra `mode: live | simulated`.

## Como executar localmente

Pré-requisitos: Python 3.11+ e Node.js 20.9+.

**1. Backend**
```bash
cd claude-commerce-ai/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # preencha BACKEND_API_TOKEN e SCHEDULER_TOKEN
set -a && source .env && set +a
uvicorn app.main:app --reload --port 8000
# docs da API: http://localhost:8000/docs   | testes: pytest
```

**2. Frontend**
```bash
cd claude-commerce-ai/frontend
npm install
cp .env.example .env.local      # BACKEND_URL e o MESMO BACKEND_API_TOKEN do backend
npm run dev                     # http://localhost:3000
```

Sem `ANTHROPIC_API_KEY` tudo funciona em **modo simulado** (heurísticas determinísticas, custo zero).
Com a chave: defina `ANTHROPIC_API_KEY`, reinicie o backend e use **Sistema → Testar conexão** — só então a
integração aparece como “verificado”.

**3. Banco (opcional nesta fase)** — `supabase db push` ou `psql -f supabase/migrations/0001_initial_schema.sql`.

**4. n8n (opcional)** — importe `n8n/workflows/*.json`, crie uma credencial *Header Auth*
(`X-Scheduler-Token: <SCHEDULER_TOKEN>`) e defina a variável `CLAUDE_COMMERCE_API_URL`. Veja `n8n/README.md`.

### Verificações executadas nesta entrega
- `pytest`: 26 testes passando (API, autenticação, kill switch, 7 agentes, pipelines, conformidade, aprovações, orçamento, recusa da IA, importação CSV/XLSX, mascaramento de segredos). O modo “live” é testado com um **SDK falso**, não com a API real.
- `next build`, `tsc` e `eslint` sem erros; navegação de todas as telas com Playwright em desktop e 390 px, sem erros de console e sem rolagem horizontal.
- Migração SQL aplicada em PostgreSQL 16 local (com stub de `auth.users`); restrições de auditoria e financeira verificadas.

## Credenciais necessárias

| Variável | Onde | Obrigatória | Para quê |
|---|---|---|---|
| `BACKEND_API_TOKEN` | backend + frontend (servidor) | sim em produção | autentica o Next.js no FastAPI |
| `SCHEDULER_TOKEN` | backend + credencial do n8n | sim em produção | autentica disparos agendados |
| `ANTHROPIC_API_KEY` | backend | para IA real | Claude API ([console.anthropic.com](https://console.anthropic.com)) |
| `DASHBOARD_USER` / `DASHBOARD_PASSWORD` | frontend | sim se exposto fora do localhost | Basic Auth provisório |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | backend | Fase 2 | persistência |
| `TIKTOK_SHOP_APP_KEY` / `TIKTOK_SHOP_APP_SECRET` | backend | após aprovação | API oficial (conector ainda não existe) |

Nenhuma credencial usa prefixo `NEXT_PUBLIC_`; nenhuma chega ao navegador. Detalhes em `docs/SECURITY.md`.

## O que depende de aprovação ou ação externa

1. **TikTok Shop Partner Center** — cadastro do app, aprovação, escopos de afiliado/pedidos/produtos e confirmação de que os endpoints de afiliado estão disponíveis para o Brasil. Até lá: importação CSV/XLSX dos relatórios oficiais. Veja `docs/INTEGRATIONS.md`.
2. **Conta e chave da Claude API** — e um teste real de conexão.
3. **Projeto Supabase** — criar o projeto, aplicar a migração e implementar o repositório Supabase (Fase 2).
4. **Instância n8n** — importar e ativar os workflows; confirmar o primeiro disparo em *Sistema*.
5. **Conferência dos relatórios reais** — confirmar nomes de colunas dos CSV/XLSX exportados do TikTok Shop e ajustar os aliases do importador.
6. **Validação jurídica** — revisar regras de conformidade (publicidade, CDC, diretrizes do TikTok) com assessoria.

## Próximas fases (sugestão)
- **Fase 2:** repositório Supabase, Supabase Auth com papéis (operador/gestor), deploy (backend em container com HTTPS; frontend na Vercel ou similar).
- **Fase 3:** conector TikTok Shop após aprovação, com testes contra o sandbox oficial.
- **Fase 4:** avaliações (evals) dos agentes com dados reais e ajuste de prompts/esforço/custos.
