# Progresso do projeto

Regra: nenhuma etapa é marcada como concluída sem os testes correspondentes executados.

## Sprint 1 — Infraestrutura ✅ (entregue, pendente de validação no Windows)
- [x] Estrutura de diretórios conforme a especificação
- [x] `docker-compose.yml` (Redis 8.6.8, n8n 2.48.8) com portas em 127.0.0.1 e healthchecks
- [x] Supabase local (`supabase/config.toml`, CLI 2.122.1 fixado em `package.json`)
- [x] Migrações `0001` (especificação) e `0002` (endurecimento) + `seed.sql`
- [x] API FastAPI: saúde de todos os serviços, agentes, tarefas, aprovações, produtos, custos, auditoria, emergência, agendador
- [x] Core: config, db, claude_client, agent_registry, task_manager, permissions, cost_control, scheduler, emergency, audit
- [x] Sete agentes registrados (registry.yaml + system_prompt.md + agent.py)
- [x] Dashboard básico (8 telas) com dados reais do banco
- [x] Scripts PowerShell: setup, start, stop, backup, health
- [x] 5 workflows n8n
- [x] 37 testes (17 unitários + 20 de integração com Postgres real), também em Python 3.11

**Validado no Windows do operador (23/11/2026):** `setup.ps1` e `start.ps1` concluíram; verificação de saúde com
todos os serviços obrigatórios ok (Postgres 17 com migrações e 7 agentes, Supabase API, Redis, n8n, API, dashboard).
Problemas encontrados no Windows e corrigidos: erro do PowerShell 5.1 com stderr de programas externos, Python
instalado pelo uv, porta 6379 ocupada (escolha automática de porta) e faixa de portas reservada pelo Hyper-V
(Supabase movido para 443xx).

## Decisão de escopo (23/11/2026)
Operação **assistida pelo Claude Cowork**, incluído no plano Claude do operador. Os agentes **não** chamam a
Claude API nem outro provedor de IA: não há custo de API. O sistema organiza a operação (produtos, tarefas,
aprovações, auditoria, agendamentos) e o Cowork faz a análise e a escrita. A Sprint 2 abaixo **não será feita**;
o código do `core/claude_client.py` permanece desligado (sem `ANTHROPIC_API_KEY`) e pode ser reativado no futuro.

## Sprint 2 — Inteligência automática (não será feita)
- [ ] Worker da fila (processo Python nativo no Windows) com limite de paralelismo do orquestrador
- [ ] Execução dos agentes com `ClaudeClient` e schemas Pydantic por tarefa
- [ ] Ferramentas autorizadas (product_score, save_product, trend_analysis…) com auditoria
- [ ] Orquestrador planejando o dia a partir de `daily_operations`
- [ ] Caçador de Produtos: normalização, pontuação, ranking (fontes autorizadas / relatórios importados)
- [ ] Uso do Redis para locks e limite de taxa

## Sprint 3 — Fábrica audiovisual (a decidir)
- [ ] Roteiros com três variações; regras de conformidade (reaproveitar Fase 1)
- [ ] TTS local, legendas, templates Remotion, montagem FFmpeg 9:16
- [ ] Auditoria de vídeo e fila de aprovação

## Sprint 4 — Gestão (a decidir)
- [ ] Relatórios, financeiro (estimada × confirmada × paga × estornada), conciliação, alertas
- [ ] Monitoramento de custos com projeção mensal

## Sprint 5 — TikTok
- [ ] Importação de relatórios oficiais (reaproveitar importador CSV/XLSX da Fase 1)
- [ ] Integração oficial somente após aprovação e validação das permissões
- [ ] Publicação autorizada ou manual; coleta de métricas
