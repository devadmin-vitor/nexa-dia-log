# Segurança

## Rede
- Todas as portas (API 8000, dashboard 3000, n8n 5678, Redis 6379, Supabase 54321-54323) presas a `127.0.0.1`.
- A stack local do Supabase **não é endurecida para produção**: nunca a exponha.
- Se precisar de `-ApiHost 0.0.0.0` para o n8n alcançar a API, bloqueie a porta 8000 no Firewall do Windows para a rede.

## Segredos
- Ficam só no `.env` (raiz) e em `apps/dashboard/.env.local` (servidor do Next.js). Ambos estão no `.gitignore`.
- Nenhuma variável `NEXT_PUBLIC_*` contém segredo (há teste automatizado para isso).
- `core/config.py` usa `SecretStr`; `public_view()` expõe apenas *se* algo está configurado.
- Logs e auditoria mascaram chaves `sk-ant-…`, JWTs, senhas em URLs e pares `token=`/`password=`.
- O token do dashboard (`BACKEND_API_TOKEN`) e o do agendador (`SCHEDULER_TOKEN`) são diferentes; um não serve para o outro.
- Credenciais do n8n ficam criptografadas com `N8N_ENCRYPTION_KEY`; o backup as exporta criptografadas.
- Futuros tokens OAuth do TikTok: Supabase Vault, nunca em colunas comuns.

## Acesso
- Sprint 1 não tem login de usuários: o dashboard é para uso local por um operador.
- `APP_ENV=production` exige tokens com 32+ caracteres e desativa `/docs`.
- Basic Auth opcional do dashboard: `DASHBOARD_USER`/`DASHBOARD_PASSWORD` em `apps/dashboard/.env.local`.

## Controles operacionais
| Controle | Onde | Efeito |
|---|---|---|
| Parada de emergência | `app_settings.emergency_stop` ou `EMERGENCY_STOP=true` | bloqueia Claude, tarefas, agendador e aprovações (423); tarefas pendentes → `blocked` |
| Orçamento | `DAILY_API_BUDGET_BRL`, `MONTHLY_BUDGET_BRL`, `USD_BRL_RATE` | chamada bloqueada antes de gastar |
| Permissões | `agents/registry.yaml` + `core/permissions.py` | ferramenta fora da lista ou sem integração autorizada = negada |
| Aprovação | `approvals` | publicar, gastar, alterar vitrine, contatar terceiros |
| Gasto/financeiro | CHECK no banco | nunca marcado como executado automaticamente |
| Publicação | trigger no banco | exige aprovação aprovada e divulgação comercial |
| Auditoria | trigger no banco | `audit_logs` somente-inserção |

## Conteúdo
Sem scraping não autorizado, sem mídia de terceiros sem direitos, sem testes, avaliações ou demonstrações
inventadas, divulgação comercial obrigatória. As regras automáticas do Auditor de Conformidade entram na Sprint 3
(reaproveitando as regras da Fase 1) e não substituem revisão jurídica.
