# Roteiro de operação com o Claude Cowork

**Modo escolhido:** toda análise e escrita (pesquisa de produtos, roteiros, revisão de conformidade, relatórios) é
feita no **Claude Cowork**, incluído no seu plano Claude. O sistema local não chama nenhuma API de IA.

**Divisão de papéis:**

| Quem | Faz |
|---|---|
| **Você** | baixa relatórios oficiais, decide, aprova, grava e publica os vídeos |
| **Cowork** | lê os arquivos que você entrega, analisa, escreve roteiros e revisa |
| **Sistema (dashboard)** | guarda o registro oficial: produtos, aprovações, tarefas, auditoria, backups |

---

## 1. Configuração (uma vez)

1. Abra o app **Claude** para desktop e entre no **Cowork**.
2. Dê acesso a **uma única pasta**: `C:\Claude-Commerce-AI-repo\claude-commerce-ai\cowork`.
   Não dê acesso à pasta inteira do projeto: ela tem o `.env` com senhas.
3. Dentro dela (criadas pelo `setup.ps1`; se não existirem, rode `.\scripts\cowork-sync.ps1`):
   - `cowork\entrada\` — você coloca aqui o que o Cowork deve ler (relatórios, listas, fotos do produto);
   - `cowork\saida\` — o Cowork salva aqui o que produziu (análises, roteiros, relatórios);
   - `cowork\instrucoes\` — as instruções de cada função (copiadas dos agentes do sistema).
4. Nada disso vai para o Git: o conteúdo das pastas é ignorado, porque pode ter dados do seu negócio.

> Se o Cowork pedir acesso a outra pasta, ao navegador ou a contas, recuse, a menos que você saiba exatamente
> por quê. Ele não precisa de nenhum acesso ao TikTok para este roteiro.

---

## 2. Rotina diária (~20 min)

| # | Passo | Onde |
|---|---|---|
| 1 | Ligar: `powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1` | PowerShell |
| 2 | Conferir **Visão geral**: serviços ok, sem parada de emergência | http://localhost:3000 |
| 3 | Exportar do painel oficial do TikTok Shop o relatório do dia anterior e salvar em `cowork\entrada\` | navegador → pasta |
| 4 | Pedir ao Cowork a análise do dia (pedido A) | Cowork |
| 5 | Cadastrar os produtos recomendados em **Produtos** (o sistema impede duplicados) | dashboard |
| 6 | Pedir roteiros (pedido B) e a revisão de conformidade (pedido C) | Cowork |
| 7 | Gravar e publicar **manualmente** só o que passou na revisão | celular / TikTok |
| 8 | Fechar o dia: `.\scripts\backup.ps1` e, se quiser, `.\scripts\stop.ps1` | PowerShell |

**Regras que valem sempre:**
- Sem scraping: o Cowork não entra no TikTok Shop para coletar dados. Os dados vêm só dos relatórios que **você** exporta.
- Demonstração ou "testei" só com produto físico em mãos.
- Toda publicação comercial leva divulgação (#publi / link de afiliado).
- Gastos (impulsionamento, compra de amostras) são decisão sua, feita fora do sistema.

---

## 3. Pedidos prontos para o Cowork

Copie, cole e ajuste o que estiver entre colchetes.

### A. Análise diária de produtos
```
Leia as instruções em instrucoes/product_hunter.md e siga as regras delas.
Analise o relatório em entrada/[nome-do-arquivo].
Para cada produto, dê uma pontuação de 0 a 100 com os componentes (demanda, comissão,
reputação, potencial de conteúdo, concorrência), uma justificativa curta e os riscos.
Use somente os dados do arquivo; marque o que estiver faltando.
Salve o resultado em saida/AAAA-MM-DD-produtos.md com uma tabela:
nome | ID do produto | preço | comissão % | pontuação | recomendação (priorizar/testar/evitar).
```

### B. Roteiros de vídeo sem rosto
```
Leia instrucoes/creative_director.md e siga todas as regras.
Produto: [nome]. Fatos verificados (use só estes): [lista dos fatos da página oficial].
Tenho amostra física? [sim/não]. Tenho direito de uso das imagens do vendedor? [sim/não].
Crie três variações de roteiro (9:16, até 45 segundos) e salve em
saida/AAAA-MM-DD-roteiro-[produto].md.
```

### C. Revisão de conformidade (antes de gravar)
```
Leia instrucoes/compliance_auditor.md.
Revise o arquivo saida/[arquivo-do-roteiro].md.
Liste cada problema com severidade (baixa/média/alta), o trecho e a correção sugerida.
No fim, diga APROVADO ou BLOQUEADO. Na dúvida, bloqueie.
Salve em saida/AAAA-MM-DD-revisao-[produto].md.
```

### D. Fechamento semanal (financeiro)
```
Leia instrucoes/finance_controller.md.
Use os relatórios de pedidos e comissões em entrada/ desta semana.
Separe comissão estimada, confirmada, paga e estornada.
Some meus custos: [lista de custos da semana].
Salve em saida/AAAA-semana-NN-financeiro.md, com as divergências encontradas.
```

### E. Ideias de conteúdo a partir do desempenho
```
Leia instrucoes/trend_intelligence.md.
Analise as métricas dos meus vídeos em entrada/[arquivo de métricas exportado].
Quais ganchos e formatos tiveram melhor retenção e cliques? Indique o tamanho da amostra.
Sugira 5 hipóteses de teste para a próxima semana.
Salve em saida/AAAA-MM-DD-tendencias.md.
```

---

## 4. Onde registrar os resultados no dashboard

| Resultado do Cowork | Onde registrar | Observação |
|---|---|---|
| Produtos recomendados | **Produtos → Cadastrar produto** | Use o ID do produto do relatório em "ID externo": evita duplicar |
| Produto descartado | **Produtos → Rejeitar** | Fica no histórico |
| Decisões importantes | **Aprovações** (quando houver pedido pendente) | Sempre com seu nome e motivo |
| Problemas ou incidentes | **Sistema → Parada de emergência** se algo sair do controle | Bloqueia tudo até você liberar |
| Tudo o que acontece | **Auditoria** | Registro automático, não pode ser alterado |

**Limitação atual:** o dashboard ainda não tem telas para roteiros, publicações e comissões. As tabelas existem no
banco, mas, por enquanto, roteiros, revisões e relatórios financeiros ficam como arquivos em `cowork\saida\`
(incluídos no backup com `.\scripts\backup.ps1 -IncludeCowork`). Se quiser, essas telas podem ser adicionadas depois.

---

## 5. Boas práticas
- Um arquivo por dia ou por produto, com a data no nome (`2026-11-24-...`): fica fácil achar e comparar.
- Revise sempre o que o Cowork escreveu antes de gravar: a responsabilidade pela publicação é sua.
- Não cole senhas, tokens ou o conteúdo do `.env` em conversas.
- Se mudar alguma regra de conteúdo, edite o arquivo em `agents\<função>\system_prompt.md` e rode
  `.\scripts\cowork-sync.ps1` para atualizar as instruções que o Cowork lê.
