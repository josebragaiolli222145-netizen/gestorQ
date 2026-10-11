# Instruções para o Claude

- **Sempre gere e entregue o arquivo `GestorQ.html` completo** ao final de qualquer alteração: envie o arquivo ao usuário (SendUserFile) além de fazer commit/push.
- O app é um arquivo único (`GestorQ.html`); não divida em vários arquivos sem pedido explícito.
- Antes de entregar, rode `npm test` (teste de fumaça) e confirme que não há erros de JavaScript.
- Responda em português.

## Equipe de prontidão
Agentes em `.claude/agents/` — acione os relevantes para cada pedido:

| Agente | Papel |
|---|---|
| `designer-ui` | Layout, contraste, responsividade, acessibilidade |
| `frontend` | Telas, navegação, gráficos, exportações, erros de JS |
| `backend-firebase` | Firebase, sincronização, localStorage, autenticação |
| `analista-dados` | KPIs, importação XLSX, Pareto, relatórios |
| `seguranca` | Revisão de autenticação, permissões, XSS, LGPD (só reporta) |
| `qa-testes` | `npm test` + testes no navegador antes de entregar (só reporta) |

Fluxo padrão: entender o pedido → especialistas implementam → `seguranca` revisa mudanças sensíveis → `qa-testes` valida → entregar o `GestorQ.html`.
