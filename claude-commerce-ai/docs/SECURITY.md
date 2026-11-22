# Segurança e conformidade

## Credenciais
- Segredos apenas em variáveis de ambiente do **servidor** (backend e servidor Next.js). Nenhum `NEXT_PUBLIC_*`.
- O navegador nunca fala com o FastAPI: Server Components/Actions do Next.js chamam o backend com `X-API-Key`.
- O n8n usa um token **diferente** (`X-Scheduler-Token`), guardado como credencial no próprio n8n.
- Em `APP_ENV=production` o backend não inicia sem tokens de ≥ 32 caracteres; `/docs` é desabilitado.
- Comparação de tokens em tempo constante (`hmac.compare_digest`).
- Logs JSON mascaram chaves `sk-ant-…`, JWTs e pares `token=`/`authorization:`.
- `/system/status` expõe somente *se* uma credencial existe, nunca o valor (testado).
- Tokens OAuth futuros do TikTok Shop: Supabase Vault, nunca em colunas comuns.

## Acesso ao dashboard
Fase 1 não tem login de usuários. **Não exponha o frontend publicamente** sem `DASHBOARD_USER`/`DASHBOARD_PASSWORD`
(Basic Auth em `src/proxy.ts`) atrás de HTTPS. Fase 2: Supabase Auth com papéis e RLS por usuário.

## Mecanismo de interrupção (kill switch)
- Ativado pelo dashboard (com responsável e motivo, log `security`) ou no boot com `KILL_SWITCH=1`.
- Bloqueia: execução de agentes, pipelines, disparos do agendador e decisões de aprovação (HTTP 423).
- O Guardião de Operações **recomenda**, mas não aciona; a decisão é humana.
- Orçamento diário de IA (`DAILY_AI_BUDGET_USD`) bloqueia novas chamadas quando atingido.

## Política de ações
| Tipo | Execução |
|---|---|
| `read`, `internal_write` | automática |
| `publish_content`, `change_listing`, `contact_seller` | aprovação humana; na Fase 1 a execução é manual |
| `financial` | aprovação humana **e** execução sempre manual (também garantido por constraint no banco) |

## Regras de conteúdo (aplicadas em código, `app/services/compliance_rules.py`)
- Divulgação obrigatória (`#publi` / link de afiliado).
- Alegações somente da lista `verified_claims` do produto.
- Proibidos: promessas absolutas/de cura/peso/renda, urgência falsa, prova social não verificada, depoimentos de terceiros, superlativos sem prova.
- Sem amostra física registrada → sem roteiro de uso/teste/demonstração.
- Sem direitos confirmados → sem uso de mídia do vendedor.
- A IA pode acrescentar problemas, mas **não pode aprovar** o que as regras bloqueiam (testado).

Estas regras são um ponto de partida técnico e não substituem revisão jurídica (CDC, CONAR, diretrizes do TikTok Shop).

## Dados
- Sem scraping: entradas são cadastro manual, relatórios exportados pelo operador ou (futuro) API oficial.
- Importação limitada a 5 MB / 20 000 linhas, `.csv`/`.xlsx`, com erros reportados por linha.
- `audit_logs` é somente-inserção no banco (trigger).
