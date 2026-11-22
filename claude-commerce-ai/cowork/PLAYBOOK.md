# Playbook de operação assistida (Claude Cowork)

O Claude Cowork apoia o operador em tarefas que exigem julgamento humano ou acesso a painéis oficiais.
Ele **não** recebe tokens do backend nem executa operações financeiras.

## Rotina diária (≈ 20 min)
1. Abrir o dashboard → **Visão geral**. Conferir se o selo é “Simulado” ou dados reais.
2. **Importação**: exportar do painel oficial do TikTok Shop o relatório do dia anterior e importar.
   O Cowork pode ajudar a conferir se as colunas batem com `docs/templates/`.
3. **Aprovações**: revisar cada pendência. Para conteúdo, ler o roteiro e os problemas de conformidade.
   Para operações financeiras: aprovar só após checar valor, produto e saldo; executar manualmente na plataforma oficial.
4. **Roteiros aprovados**: gravar com o produto real (quando houver amostra), publicar manualmente e marcar “publicado”.
5. **Sistema**: verificar kill switch, gasto de IA e último disparo do n8n.

## Rotina semanal
- Rodar/conferir o **Planejamento semanal**; ajustar ângulos e horários.
- Revisar a lista de `verified_claims` dos produtos ativos com base na página oficial do produto.
- Exportar logs de auditoria e custos para arquivo.

## Pedidos úteis ao Cowork
- “Compare as colunas deste relatório exportado com o modelo de importação e liste diferenças.”
- “Revise este roteiro contra as regras de `docs/SECURITY.md` e aponte riscos.”
- “Resuma as aprovações pendentes por risco.”

## Limites
- Não usar o Cowork para coletar dados por scraping nem para logar em contas de terceiros.
- Não colar tokens/chaves em conversas.
