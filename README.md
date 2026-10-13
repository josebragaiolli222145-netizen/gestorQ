# GestorQ

Sistema de gestão de qualidade e perdas para supermercados (HACCP, auditorias, vencidos, recebimento, perdas e BI), entregue como **um único arquivo**: `GestorQ.html`.

Basta abrir o arquivo no navegador ou hospedá-lo em qualquer servidor estático.

## Primeiro acesso

- Usuário `admin`, senha inicial `1234`, função **Administrador**.
- No primeiro login o app mostra um **código de recuperação**. Guarde-o fora do aparelho: é a única forma de redefinir a senha do admin se ela for esquecida (botão **🔑 Recuperar acesso** na tela de login).
- Enquanto a senha padrão estiver em uso, aparece um aviso pedindo a troca (Config → Segurança do ADM).

## Testes

```bash
npm install
npm test      # abre o app no Chromium, faz login e percorre todas as páginas
```

O teste falha se houver erro de JavaScript, texto solto na página, página em branco após o login ou documento fora do modo padrão.

## Correções da versão v50

Veja [CHANGELOG.md](CHANGELOG.md). O script `tools/build.py` registra (e consegue reaplicar) as correções estruturais feitas sobre o arquivo original. As melhorias novas ficam no bloco `gestorq-v50` no fim do `GestorQ.html` (fonte: `tools/gestorq-v50.html`).

## Versão para computador (GestorQ Desktop)

Pacote instalável com servidor local e banco de dados SQLite, que funciona sem internet.

```bash
npm install
npm run desktop          # gera dist/GestorQ-Desktop-Windows-v*.zip e dist/GestorQ-Desktop-Linux-v*.tar.gz
npm run test:desktop     # instala o pacote Linux num HOME temporário e testa de ponta a ponta
```

- `desktop/server/`: back-end (Node.js, só módulos nativos). Usa `node:sqlite`, uma API com token e backups.
- `desktop/frontend/`: a ponte que espelha o armazenamento do app no banco e o painel "Banco de dados" em Configurações.
- `desktop/windows/` e `desktop/linux/`: instaladores e lançadores. Leia o `LEIA-ME.txt` de cada pacote.
