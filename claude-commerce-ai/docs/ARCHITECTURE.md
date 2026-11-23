# Arquitetura

```
                          ┌────────────────────────── seu computador (127.0.0.1) ──────────────────────────┐
 Navegador ──▶ Dashboard Next.js (servidor) ──X-API-Key──▶ API FastAPI ──▶ core/* ──▶ PostgreSQL (Supabase)
   (sem segredos)                                            ▲   │                        ▲
                                                             │   ├──▶ Claude API (internet)│
 n8n (Docker) ──Schedule──▶ HTTP ──X-Scheduler-Token─────────┘   └──▶ Redis (Docker)       │
                                                                                           │
 Supabase CLI (Docker): Postgres 17 · Auth · Studio ───────────────────────────────────────┘
```

## Princípios
- **Uma aplicação**, sete agentes (um orquestrador + seis especialistas), um banco compartilhado.
- **O banco é o registro oficial.** Agentes não dependem de memória de conversa.
- **Agentes não tocam no banco.** Toda leitura/gravação passa por funções do `core/` que validam permissão,
  orçamento e parada de emergência e gravam auditoria.
- **Roteamento determinístico.** O orquestrador cria tarefas; a IA analisa e escreve, mas não decide sozinha o fluxo.
- **Nada fictício.** Dados simulados só existem com `is_simulated = true` e aparecem com selo no dashboard.

## Agentes (`agents/registry.yaml`)
| Chave | Papel | Ferramentas | Aprovação |
|---|---|---|---|
| `operations_director` | Orquestrador (3 em paralelo, 40 tarefas/dia) | create_task, read_task_status, request_approval | — |
| `product_hunter` | Pesquisa e pontuação de produtos | product_search*, product_score, save_product | — |
| `trend_intelligence` | Tendências e desempenho | web_research*, trend_analysis, keyword_analysis | — |
| `creative_director` | Roteiros, voz e vídeo 9:16 | generate_script, generate_voiceover*, render_video* | — |
| `publishing_manager` | Validação e publicação | validate_video, create_publication*, update_publication | **sim** |
| `finance_controller` | Comissões, custos e resultado | read_commissions, calculate_profit, generate_report | — |
| `compliance_auditor` | Conformidade e bloqueio | check_content, verify_disclosure, block_publication | — |

\* Ferramentas bloqueadas em `core/permissions.py` até existir integração autorizada (fonte de pesquisa, TikTok) ou
a sprint correspondente (TTS/renderização). Prompt efetivo = `prompts/master.md` + `agents/<pasta>/system_prompt.md`.

## Fila de tarefas (`core/task_manager.py`)
Persistida em `agent_tasks`, com reserva concorrente via `FOR UPDATE SKIP LOCKED`, prioridade (1 = mais urgente),
`idempotency_key`, re-tentativas com atraso exponencial (30 s, 60 s, 120 s…) até `max_attempts`, e limite diário.

**Por que não RQ:** o RQ depende de `fork` e não executa workers nativamente no Windows. A fila no próprio Postgres
funciona em qualquer sistema, sobrevive a reinícios e já é auditável. O Redis permanece na stack para cache,
locks e limites de taxa (Sprint 2+).

## Agendamentos (`core/scheduler.py` + `workflows/`)
| Rotina | Cron (São Paulo) | Idempotência |
|---|---|---|
| `daily_operations` | 07:00 diário | por dia |
| `product_research` | 07:15 diário | por dia |
| `content_factory` | 09:00 diário | por dia |
| `publishing_queue` | a cada 2 h | por hora |
| `financial_report` | 20:30 diário | por dia |

Cada workflow n8n tem *Schedule Trigger* + *Executar manualmente* → *HTTP Request* (Header Auth) para
`/api/v1/scheduler/trigger/<rotina>`. A API cria uma tarefa do orquestrador. A lógica de cada rotina fica no backend
(testável e versionada); o n8n só agenda e re-tenta.

## Banco (`supabase/migrations`)
- `0001_initial_schema.sql` — núcleo da especificação (13 tabelas).
- `0002_hardening.sql` — `is_simulated`, CHECKs de status, deduplicação de produtos, `updated_at` automático,
  aprovações com responsável/risco, publicação exige aprovação + divulgação (trigger), regra financeira manual,
  auditoria somente-inserção, `v_cost_daily`, `v_commission_summary`, RLS em todas as tabelas.

A API conecta direto ao Postgres (`DATABASE_URL`, usuário `postgres`, ignora RLS — adequado ao uso local de um
operador). Sem políticas para `anon`/`authenticated`: nada é acessível pela API REST pública do Supabase.
Quando houver login (Supabase Auth), entram políticas por papel.

## Claude API (`core/claude_client.py`)
- `CLAUDE_MODEL` configurável; esforço `CLAUDE_EFFORT`; thinking adaptativo é o padrão dos modelos atuais.
- Saída estruturada com JSON Schema gerado do modelo Pydantic e validado de novo no retorno.
- Antes de cada chamada: parada de emergência e orçamento (dia e mês). Depois: custo gravado em `cost_usage`
  (USD e BRL), inclusive em recusa ou resposta inválida.
- `fallbacks="default"` (beta `server-side-fallback-2026-07-01`) nos modelos que suportam.

## Fábrica audiovisual (Sprint 3, planejada)
TTS local (ex.: Piper) → cenas e templates (Remotion) → montagem e legendas (FFmpeg) → `media/renders` →
auditoria → aprovação → `media/published`. Sem geração de vídeo por modelos pagos na primeira versão.

## Claude Cowork
Uso assistido: revisar roteiros e relatórios, acompanhar tarefas, ajudar a desenvolver. Opcionalmente, um servidor
MCP local exporá apenas operações permitidas da API (nunca o banco). Ver [`COWORK.md`](COWORK.md).

## Migração futura para VPS
Os componentes já são separados por URL/variável (`DATABASE_URL`, `REDIS_URL`, `N8N_URL`, `BACKEND_URL`).
Para uma VPS: Supabase gerenciado ou Postgres próprio, API e dashboard em containers atrás de HTTPS, login
(Supabase Auth) e políticas RLS por usuário antes de qualquer exposição.
