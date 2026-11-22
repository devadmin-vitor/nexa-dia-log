# Integrações externas — status real

Nada aqui é declarado funcionando sem teste. A tela **Sistema** mostra o mesmo status em tempo real.

| Integração | Status na Fase 1 | Como verificar |
|---|---|---|
| Claude API | Implementada; **não testada com chave real** neste ambiente. Testes usam SDK falso. | Configure `ANTHROPIC_API_KEY` → Sistema → “Testar conexão” |
| TikTok Shop (API oficial) | **Não implementada.** Nenhuma chamada é feita; `tiktok_shop_call()` lança `IntegrationNotAvailable`. | — |
| Supabase | Esquema pronto e validado em PostgreSQL 16; backend ainda não conecta. | Fase 2 |
| n8n | Endpoint e workflows prontos; workflows **não importados** em uma instância real. | Primeiro disparo aparece em Sistema → n8n “recebendo disparos” |
| Importação CSV/XLSX | Funcional e testada com arquivos de exemplo. Colunas dos relatórios oficiais **precisam ser conferidas**. | Importação → enviar relatório real |

## TikTok Shop — passos pendentes (externos)
1. Cadastro como desenvolvedor/parceiro no **TikTok Shop Partner Center** e criação do app.
2. Solicitação e aprovação dos escopos necessários (dados de afiliado/criador, pedidos, produtos, comissões).
3. Confirmar na documentação oficial vigente quais endpoints de **afiliado** estão disponíveis para contas do **Brasil**
   — não assumimos disponibilidade.
4. Fluxo OAuth de autorização da conta do operador; armazenamento dos tokens no Supabase Vault.
5. Implementar o conector em `backend/app/integrations/`, com testes contra o ambiente de testes oficial,
   gravando dados com `data_source=tiktok_api`.
6. Respeitar limites de taxa e termos de uso da plataforma.

Até lá, o caminho oficial é exportar relatórios no painel do TikTok Shop e importar em **Importação**.

## Claude Cowork
Usado para operação assistida, não como integração de código. Veja `cowork/PLAYBOOK.md`.
