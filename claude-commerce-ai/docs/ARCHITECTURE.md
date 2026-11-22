# Arquitetura

```
 Navegador ──HTTPS──▶ Next.js (servidor)  ──X-API-Key──▶  FastAPI  ──▶ Repositório (memória → Supabase)
   (sem segredos)      Server Components                    │
                       Server Actions                       ├─▶ Orquestrador ─▶ 7 agentes ─▶ Claude API
                                                            │        (kill switch, orçamento, política)
 n8n (cron) ───────────X-Scheduler-Token──────────────────▶ /api/v1/scheduler/trigger/<tarefa>
 Operador ──CSV/XLSX──▶ /importacao ──────────────────────▶ importador (sem scraping)
```

## Agentes

| Agente | Lê | Escreve (interno) | Pede aprovação para |
|---|---|---|---|
| Pesquisador de Produtos | produtos + desempenho 30d | classe A/B/C e score | — |
| Analista de Comissões | KPIs calculados | — (recomendações) | — |
| Planejador Editorial | produtos classificados, horários ocupados | itens de calendário em “ideia” | — |
| Roteirista | conteúdo + fatos verificados do produto | roteiro | — |
| Revisor de Conformidade | roteiro + flags do produto | resultado da revisão | publicação do conteúdo |
| Monitor de Desempenho | KPIs e anomalias (semana × semana) | — (alertas) | — |
| Guardião de Operações | custos, falhas, pendências, eventos | log de recomendação de kill switch | — |

Ciclo de cada agente (`app/agents/base.py`):
1. `build_context` monta fatos a partir do repositório (números já calculados de forma determinística);
2. **modo live**: chamada à Claude API com saída estruturada (`output_config.format` JSON Schema) validada por Pydantic;
   **modo simulado**: heurística determinística;
3. `postprocess` aplica regras obrigatórias (ex.: descarta IDs inexistentes; regras de conformidade prevalecem sobre a IA);
4. `apply` executa apenas efeitos `internal_write` ou abre solicitações de aprovação;
5. a execução é registrada com modo, modelo, tokens, custo, erro e log de auditoria.

### Por que o orquestrador é determinístico
O roteamento entre agentes é código (pipelines fixos), não decisão do modelo: custo previsível, auditoria simples
e interrupção imediata. A IA é usada onde agrega — interpretar dados, escrever e revisar texto.

| Pipeline | Passos | Agendamento sugerido |
|---|---|---|
| `daily_cycle` | Monitor → Analista → Pesquisador → Guardião | diário 07:00 BRT |
| `weekly_planning` | Pesquisador → Planejador | segunda 08:00 BRT |
| `content_pipeline` | Roteirista → Revisor (exige `content_id`) | manual |
| `ops_check` | Guardião | a cada 6 h |

## Claude API
- Modelo padrão `claude-opus-5-5`, esforço `medium` (configuráveis). Pensamento adaptativo é o padrão desse modelo; o código não envia `thinking`.
- Saída estruturada via JSON Schema estrito gerado dos modelos Pydantic.
- `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`): se o modelo recusar por política, a API tenta um modelo de fallback; o custo é calculado pelo modelo que respondeu. Desative com `CLAUDE_USE_FALLBACKS=false`.
- Recusa (`stop_reason=refusal`), truncamento, erro de autenticação, limite de taxa e falha de rede viram falhas registradas — nunca derrubam o pipeline.
- Custos estimados pela tabela em `app/services/llm.py` (atualize se os preços mudarem).

## Persistência
Fase 1: `MemoryStore` (dados somem ao reiniciar). O esquema `supabase/migrations/0001_initial_schema.sql` espelha os
modelos; a Fase 2 implementa um repositório Supabase com a mesma interface.
