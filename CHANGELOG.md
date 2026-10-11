# Changelog

## v51: melhorias da análise de mercado

Todas as mudanças ficam numa camada nova (`gestorq-v51`), separada do código antigo. Ela usa os mesmos dados do app (vencidos, plano de ação 5W2H, temperatura e perdas) e guarda o que é novo em chaves `gq51_*`.

### Fase 1: impacto rápido
- **Painel de hoje** no Dashboard, no lugar dos banners de texto:
  - 4 indicadores que levam a uma ação: perdas do mês (em R$ e em % do faturamento, contra a meta), R$ vencendo em até 3 dias, pendências abertas e atrasadas, e temperaturas fora da faixa hoje;
  - faixa **"R$ recuperados no mês"** com rebaixas, devoluções e doações.
- **Barra do topo enxuta:** busca, tema e o menu do usuário (perfil, busca, tema, modo chão de loja, salvar, novidades, BI Enterprise, Central, Comandos, código de recuperação, diagnóstico, sair). Os botões duplicados (duas buscas e dois de tema) saíram.
- **Marca única "GestorQ"** em telas, relatórios impressos, PDFs, mensagens e manifesto (antes aparecia "Qualtrix").
- **Paleta unificada no tema escuro:** cartões brancos e textos escuros soltos passam a seguir as cores do tema.
- **Agir antes de vencer** (página Vencidos):
  - lista dos produtos que vencem em até 7 dias, com desconto sugerido (≤1 dia 50%, ≤3 dias 35%, ≤5 dias 25%, ≤7 dias 15%; dá para ajustar);
  - etiqueta de rebaixa pronta para imprimir;
  - registro do destino de cada produto: vendido, doado, devolvido ou descartado, com quantidade parcial;
  - descarte e doação entram como perda (motivos "Vencido" e "Doação"); venda e devolução contam como R$ recuperado;
  - produto vencido nunca recebe sugestão de venda.

### Fase 2: diferenciação
- **Página Indicadores** (nova no menu, grupo Gestão):
  - **Perda x faturamento:** índice do mês contra a meta e contra a média do mercado por formato de loja (9ª Pesquisa Abrappe, 2025: vizinhança 3,30%, convencional 2,79%, hiper 2,11%, atacarejo 1,85%), mais o índice por setor e o histórico dos últimos meses;
  - **Motivos (Pareto):** gráfico com % acumulado, classificação em lote ou um a um dos lançamentos importados sem motivo, e registro manual de perda;
  - **Relatório para Compras:** produtos que vencem ou são descartados repetidamente, com sugestão de reduzir o pedido; exporta para Excel e imprime;
  - **Pendências:** usa o mesmo cadastro do Plano de ação 5W2H, com responsável, prazo, prioridade, fotos de evidência "antes" e "depois" e alerta de atraso;
  - **Destinos:** histórico e totais do que foi feito com cada produto; exporta para Excel.

### Fase 3: escala
- **Leitura de código GS1** (DataMatrix, GS1-128 e EAN) pela câmera, por leitor USB/Bluetooth ou digitando. Preenche código, validade e lote, e reaproveita o nome e o preço de produtos já conhecidos. Botão **Escanear** no centro da barra inferior do celular, em "Agir antes de vencer" e na tela de Vencidos vazia.
- **Temperatura fora da faixa exige ação corretiva:**
  - o app pede a ação, com sugestões prontas para tocar;
  - salva a ação no registro;
  - cria uma pendência de verificação.
  - **Correção:** o campo de ação corretiva que já existia nunca era salvo.
- **Minha lista de hoje** por função: retirar vencidos, rebaixar, registrar temperaturas, ações corretivas, pendências do usuário e, para a gestão, informar o faturamento e revisar Compras. Os itens podem ser marcados como feitos.
- **Navegação agrupada** (Operação, Gestão e Sistema) no desktop. No celular, a barra inferior tem 5 itens (Início, Vencidos, Escanear, Perdas e Mais); o resto fica no menu "Mais" e no menu do usuário.
- **Modo chão de loja:** botões e campos maiores e mais contraste.
- **Integrações por planilha:**
  - importação de faturamento (mês, setor e valor) e de leituras de sensores de temperatura;
  - leituras fora da faixa geram uma pendência por equipamento e dia;
  - backup JSON dos dados novos.
- **Sincronização com o Firebase** (modo nuvem): destinos, motivos, faturamento e ajustes. As fotos ficam só no aparelho.

### Segurança (revisão da equipe)
- **Plano de ação (5W2H) e log de auditoria:** passaram a escapar os textos. Antes, uma pendência com código HTML executava esse código na tela de quem a abrisse. O problema já existia e as pendências novas o tornariam mais exposto.
- **Fotos de evidência:** só são aceitas imagens válidas.
- **Meta, faixas de desconto e backup:** são validados.
- **Dados vindos do Firebase:** passam pela mesma validação.
- **Backup no modo nuvem:** a importação pede confirmação antes de enviar para a filial.
- **Indicadores e valores em R$ de perdas:** só para gestão (admin, gerente, subgerente, supervisor, diretor) e prevenção de perdas. As demais funções veem só as próprias pendências.

### Correções apontadas pelo QA
- **Tema claro:** os textos novos ficavam quase brancos sobre fundo branco. O corretor de contraste antigo deixou de mexer nos componentes novos.
- **Sair:** o botão deixava a tela em branco, porque o formulário de login não voltava. O problema já existia.
- **Aviso de senha padrão:** saiu do topo, onde tampava as abas de Temperatura, e foi para o canto inferior. Também não aparece mais na tela de login.
- **Temperatura:** a página abria sem nenhuma aba de conteúdo. Agora abre direto no registro.

### Layout
- Removido o espaço vazio de cerca de 90px no topo de todas as páginas.
- Barra lateral mais compacta e com rolagem.
- Margem para a coluna de botões flutuantes.
- No celular, só o botão "+" flutua.

## v50 — correções e melhorias

### Segurança
- **Porta dos fundos removida:** o login do admin aceitava sempre as senhas `1234`, `admin` e `1798`, mesmo depois da troca de senha, e ainda revertia a senha para `1234`. Isso acontecia em dois lugares (login local e fallback do login online). Agora vale só a senha cadastrada.
- **Botão "🆘 Resetar acesso admin" removido:** qualquer pessoa na tela de login redefinia o admin para `admin/1234`. O botão também gravava a filial fixa `STOCK_STOCK_CASCAVEL_F81`.
- A caixa "Acesso padrão: admin / 1234" e a dica "Tente: admin ou 1234" na mensagem de senha incorreta foram removidas.
- **Recuperação de acesso segura:** "Redefinir admin" e "Desbloquear tentativas" viraram um único botão, **🔑 Recuperar acesso**, que exige o código de recuperação gerado no primeiro login do admin. O código é de uso único; um novo é gerado no login seguinte.
- Aviso quando o admin ainda usa uma senha padrão.
- Instalação nova: a senha inicial do admin era `1798`, mas a tela informava `1234`. Agora é `1234`, e o app pede a troca.

### Erros corrigidos
- **Página renderizava em "quirks mode"** porque o `<!DOCTYPE html>` estava na linha 181. Agora está na primeira linha.
- **Texto de código aparecia na página** (`'); w.document.close(); }` etc.). Blocos de patch tinham sido injetados no meio de strings JavaScript.
- **Botão "📊 Relatório Excel" de Vencidos não funcionava** (`exportarRelatorioVencidosExcel is not defined`). A função tinha virado texto solto. Ela foi religada, junto com a exportação Excel de perdas por setor e a impressão automática dos relatórios PDF.
- **Erro `Identifier 'D' has already been declared`:** o script "GestorQ FINAL — Perdas" nunca executava e carregava cerca de 1 MB de dados fixos embutidos. A página dele já tinha sido substituída pelo painel de Perdas atual, então o script foi removido.
- **Tela em branco após o login:** o app abria `pagedashboard` (um placeholder vazio) em vez do Dashboard.
- **Celular:** o conteúdo ficava espremido em cerca de 170px de largura, por causa de um recuo de 200px reservado para um menu flutuante. Agora ocupa a tela inteira.
- Blocos de script e CSS duplicados (até 4 cópias idênticas de cada) foram removidos.

### Interface
- O menu flutuante "🔍 Menu" duplicado, que cobria a barra lateral, foi removido. Os atalhos continuam em **Ctrl+K**.
- Os botões flutuantes ficam organizados em uma única coluna, sem sobreposição. Os atalhos secundários (BI Enterprise, Workspace, Central) aparecem só no Dashboard.
- O segundo botão "+" de atalhos, que ficava sobre o botão de comandos, foi removido. O "+" principal já oferece as mesmas ações.
- Nenhum botão flutuante aparece na tela de login. O botão de diagnóstico 🔧 aparece só para administradores.
- Na barra lateral do desktop, ícone e rótulo agora ficam alinhados, e o conteúdo começa logo após a barra.
- O selo de debug "GestorQ V4.1 BI" foi removido.

### Tamanho
- O arquivo passou de 4,4 MB / 58.580 linhas para 3,0 MB / 53.231 linhas.
