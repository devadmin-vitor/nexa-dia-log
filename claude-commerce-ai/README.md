# Claude Commerce AI

Operação **local-first** de afiliados TikTok Shop Brasil (tecnologia e acessórios, conteúdo sem rosto):
uma única aplicação com um **orquestrador** e **seis agentes especializados**, banco compartilhado (Supabase local),
automação (n8n) e dashboard (Next.js). Tudo roda no seu computador; a internet só é usada para serviços externos
autorizados (Claude API e, após aprovação, TikTok).

> **Estado atual: Sprint 1 — Infraestrutura.** Os serviços sobem, o banco está migrado, os sete agentes estão
> registrados e o dashboard mostra dados reais do banco (sem dados fictícios). Os agentes ainda **não executam**
> tarefas com a Claude API — isso é a Sprint 2. Progresso detalhado em [`docs/PROGRESS.md`](docs/PROGRESS.md).

```
claude-commerce-ai/
├── apps/
│   ├── api/                 FastAPI (uvicorn apps.api.main:app)
│   └── dashboard/           Next.js 16 + TypeScript + Tailwind
├── agents/                  registry.yaml + 7 pastas (agent.py, system_prompt.md)
├── core/                    config, db, claude_client, agent_registry, task_manager,
│                            permissions, cost_control, scheduler, emergency, approvals, health
├── integrations/            tiktok (não implementado), research, supabase, notifications
├── media/                   assets, voiceovers, templates, renders, published
├── workflows/               5 workflows n8n
├── supabase/                config.toml, migrations/0001-0002, seed.sql
├── prompts/                 master.md + modelos de tarefa por agente
├── scripts/                 setup, start, stop, backup, health (PowerShell)
├── tests/                   unit/ e integration/ (pytest)
├── storage/  logs/
├── .env.example  docker-compose.yml  package.json  requirements*.txt
```

## Arquitetura em uma frase
O **n8n agenda**, a **API decide e controla** (permissões, orçamento, parada de emergência, auditoria), o
**Postgres registra** tudo e a **Claude API analisa e escreve**. Agentes nunca acessam o banco diretamente:
toda leitura/gravação passa pelas funções do `core/`. Detalhes em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

| Serviço | Onde roda | Endereço |
|---|---|---|
| Dashboard (Next.js) | nativo (Node) | http://localhost:3000 |
| API (FastAPI) | nativo (Python .venv) | http://127.0.0.1:8000 · docs em `/docs` |
| Supabase (Postgres 17 + Auth + Studio) | Docker, via Supabase CLI | API :54321 · DB :54322 · Studio :54323 |
| n8n | Docker Compose | http://localhost:5678 |
| Redis | Docker Compose | 127.0.0.1:6379 (com senha) |

Todas as portas ficam presas a `127.0.0.1`. **Não exponha** Supabase, n8n, Redis ou a API à internet.

## Instalação no Windows

### 1. Programas
| Programa | Versão | Instalação sugerida |
|---|---|---|
| Git | recente | `winget install Git.Git` |
| Python | **3.11+** | `winget install Python.Python.3.11` |
| Node.js | **20.9+** (LTS) | `winget install OpenJS.NodeJS.LTS` |
| Docker Desktop | recente, WSL 2 | `winget install Docker.DockerDesktop` |
| FFmpeg | opcional agora (Sprint 3) | `winget install Gyan.FFmpeg` |
| VS Code | — | `winget install Microsoft.VisualStudioCode` |

O Supabase local precisa de cerca de **7 GB de RAM livres** para a stack completa; este projeto desativa Realtime,
Storage, Edge Functions, Analytics e SMTP local em `supabase/config.toml` para reduzir o consumo.

### 2. Projeto
```powershell
git clone <url-do-repositorio> C:\Claude-Commerce-AI-repo
cd C:\Claude-Commerce-AI-repo\claude-commerce-ai
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```
O `setup.ps1` verifica os pré-requisitos, cria o `.env` com tokens e senhas aleatórios, cria o `.venv`,
instala as dependências (Python, Supabase CLI e dashboard), gera `apps/dashboard/.env.local` e baixa as imagens Docker.
Pode ser executado de novo sem sobrescrever valores existentes.

### 3. Subir tudo
```powershell
.\scripts\start.ps1     # Docker (Redis, n8n) → Supabase → API → dashboard → verificação de saúde
.\scripts\health.ps1    # verificação de saúde a qualquer momento (código de saída 0/1)
.\scripts\stop.ps1      # para tudo, preservando os dados
.\scripts\backup.ps1    # banco + n8n + storage em backups\AAAAMMDD-HHmmss\
```

### 4. Configurar o n8n (uma vez)
1. Abra http://localhost:5678 e crie a conta *owner* (o n8n atual não usa `N8N_USER`/`N8N_PASSWORD`).
2. Crie uma credencial **Header Auth** chamada `Claude Commerce Scheduler`: *Name* `X-Scheduler-Token`,
   *Value* = `SCHEDULER_TOKEN` do seu `.env`.
3. Importe os workflows: `docker compose exec n8n n8n import:workflow --separate --input=/workflows`
   (a pasta `workflows/` é montada somente-leitura no container).
4. Em cada workflow, selecione a credencial no nó **Disparar no backend**, use **Executar manualmente** para testar e ative.

Os workflows chamam `http://host.docker.internal:8000`. Se o container não alcançar a API (raro no Docker Desktop),
inicie com `.\scripts\start.ps1 -ApiHost 0.0.0.0` e mantenha o Firewall do Windows bloqueando a porta 8000 para a rede.

### 5. Claude API (opcional nesta sprint)
Preencha no `.env`: `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` (padrão `claude-opus-5-5`) e **`USD_BRL_RATE`** — sem a cotação
o controle de custos não consegue medir o gasto em reais e bloqueia chamadas pagas. Reinicie a API e use
**Sistema → Testar conexão**. Só então a integração conta como verificada.

## Testes
```powershell
.\.venv\Scripts\python -m pytest                          # unitários (integração é pulada sem banco)
$env:TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
.\.venv\Scripts\python -m pytest                          # + integração (cria e remove um banco temporário)
```
Dashboard: `cd apps\dashboard; npm run lint; npm run typecheck; npm run build`.

### O que foi verificado nesta entrega (em Linux, com Docker)
| Critério | Resultado |
|---|---|
| Inicialização | `supabase start` aplicou 0001 + 0002 + seed no Postgres 17; Redis e n8n *healthy*; `/health/services` = ok |
| Banco | 13 tabelas + 2 views, RLS em todas; migrações também validadas no pytest |
| Agentes | 7 registrados e sincronizados (`registry.yaml` + prompts) |
| Pesquisa | produtos não duplicam (ID externo/URL) — backend e índice único |
| Auditoria | `audit_logs` somente-inserção; ações registradas |
| Aprovação | publicação bloqueada pelo banco sem aprovação aprovada e divulgação comercial |
| Financeiro | comissão estimada/confirmada/paga/estornada separadas; gasto aprovado nunca vira "executado" |
| Custos | custo gravado em BRL; chamada bloqueada ao atingir o limite diário (SDK simulado nos testes) |
| Segurança | segredos fora das respostas e do frontend; tokens separados para dashboard e n8n |
| Emergência | bloqueia tarefas, agendador, aprovações e Claude (HTTP 423) e marca pendentes como bloqueadas |
| n8n | 5 workflows importados; um executado de verdade chamou a API com Header Auth e criou a tarefa |
| Python 3.11 | suíte completa (37 testes) passou em `python:3.11-slim` |
| PowerShell | todos os scripts analisados pelo parser do PowerShell 7; `health.ps1` e funções do `.env` executados |

**Não verificado:** execução dos scripts no **Windows** real (taskkill, `py` launcher, `npm.cmd`, Docker Desktop),
Windows PowerShell 5.1, chamada real à Claude API (não há chave neste ambiente) e `-ApiHost` no Docker Desktop.
`scripts/backup.ps1` não foi executado inteiro (seus comandos de dump e export foram testados individualmente).

## Credenciais
| Variável | Gerada pelo setup? | Para quê |
|---|---|---|
| `BACKEND_API_TOKEN` | sim | servidor do dashboard → API |
| `SCHEDULER_TOKEN` | sim | n8n → API (`X-Scheduler-Token`) |
| `REDIS_PASSWORD` / `REDIS_URL` | sim | Redis local |
| `N8N_ENCRYPTION_KEY` | sim | criptografia das credenciais do n8n (não troque depois) |
| `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | preenchidas pelo `start.ps1` | chaves locais do Supabase |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `USD_BRL_RATE` | não | Claude API e controle de custo |
| `TIKTOK_SHOP_APP_KEY` / `_SECRET` | não | só após aprovação (conector ainda não existe) |

O `.env` nunca vai para o Git, para os prompts ou para o navegador. Veja [`docs/SECURITY.md`](docs/SECURITY.md).

## Orçamento (R$ 150/mês)
Stack local sem custo de hospedagem. A Claude API é o principal custo variável e é limitada por
`DAILY_API_BUDGET_BRL` (R$ 4/dia) e `MONTHLY_BUDGET_BRL`. Referência com `claude-opus-5-5` (US$ 4 / US$ 20 por milhão
de tokens de entrada/saída): uma tarefa típica de agente com ~6 mil tokens de entrada e ~2 mil de saída custa cerca de
US$ 0,064 — em torno de **R$ 0,35** com cotação de R$ 5,40, ou ~11 tarefas por dia dentro de R$ 4. A escolha do modelo
(`CLAUDE_MODEL`) é sua; o sistema bloqueia chamadas quando o limite é atingido.

## Depende de aprovação ou ação externa
1. **TikTok Shop Partner Center** — app aprovado, escopos de afiliado/pedidos/produtos e confirmação de disponibilidade no Brasil. Até lá: importação de relatórios oficiais (Sprint 5).
2. **Publicação automatizada** — só se houver endpoint oficial autorizado para a sua conta; caso contrário, publicação manual após aprovação.
3. **Fontes de pesquisa** — cada fonte precisa de autorização/licença antes de ser ligada em `integrations/research`.
4. **Conta e chave da Claude API** e a cotação `USD_BRL_RATE`.
5. **Nome da marca** — hoje `BRAND_NAME` (variável no `.env`).
6. **Revisão jurídica** das regras de conformidade (CDC, CONAR, diretrizes do TikTok).

## Código da Fase 1 anterior
A versão anterior (backend com dados simulados em memória, conteúdo, métricas e importação CSV) foi substituída
por esta arquitetura. Ela continua no histórico do Git (commit `7585d8c`) e partes serão reaproveitadas:
regras de conformidade (Sprint 3) e importação de relatórios (Sprint 5).
