# Workflows n8n

Três workflows (Schedule Trigger → HTTP Request) que disparam pipelines no backend:

| Arquivo | Pipeline | Horário (America/Sao_Paulo) |
|---|---|---|
| `daily_cycle.json` | `daily_cycle` | todo dia 07:00 |
| `weekly_planning.json` | `weekly_planning` | segunda 08:00 |
| `ops_check.json` | `ops_check` | a cada 6 h |

> Os arquivos foram gerados para o formato atual do n8n (`scheduleTrigger` v1.2, `httpRequest` v4.2), mas **não foram
> importados em uma instância n8n real** nesta entrega. Confira após importar.

## Configuração
1. Importe os três JSON (Workflows → Import from file).
2. Crie uma credencial **Header Auth**: Name `X-Scheduler-Token`, Value = `SCHEDULER_TOKEN` do backend.
   Selecione-a no nó “Disparar pipeline” de cada workflow.
3. Defina a variável de ambiente `CLAUDE_COMMERCE_API_URL` no n8n (ex.: `https://api.seudominio.com`).
   Se a sua instância bloquear `$env`, substitua a expressão da URL pelo endereço fixo.
4. Ative os workflows. O primeiro disparo aparece em **Sistema → n8n** no dashboard.

Teste manual equivalente:
```bash
curl -X POST "$API/api/v1/scheduler/trigger/ops_check" -H "X-Scheduler-Token: $SCHEDULER_TOKEN"
```
Com o kill switch ativo o endpoint responde **423** e nada é executado.
