# Operação assistida com Claude Cowork

O Cowork apoia o operador; ele **não** recebe tokens da API nem acesso direto ao banco, e não executa gastos.

## Rotina diária (Sprint 1)
1. `.\scripts\start.ps1` e conferir a **Visão geral** (saúde dos serviços, orçamento, parada de emergência).
2. **Aprovações**: decidir pendências com nome do responsável e motivo.
3. **Tarefas**: verificar falhas e tarefas bloqueadas.
4. **Auditoria**: revisar eventos `security` e `error`.
5. Ao final do dia: `.\scripts\backup.ps1`.

## Pedidos úteis ao Cowork
- "Revise este roteiro contra `docs/SECURITY.md` (seção Conteúdo) e aponte riscos."
- "Compare as colunas deste relatório exportado do TikTok Shop com o que o sistema espera."
- "Resuma as aprovações pendentes por risco."
- "Ajude a corrigir o erro em `logs/api.err.log`."

## Ponte de integração (futuro)
Um servidor MCP local poderá expor ao Cowork apenas operações permitidas da API (consultar status, listar tarefas,
registrar decisões com identificação), nunca o banco ou os segredos.

## Limites
- Não usar o Cowork para scraping nem para entrar em contas de terceiros.
- Não colar tokens ou chaves em conversas.
