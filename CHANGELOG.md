# Changelog

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
