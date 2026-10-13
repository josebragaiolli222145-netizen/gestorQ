#!/usr/bin/env bash
# GestorQ Desktop - inicia o servidor local (se preciso) e abre o app
BASE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
DADOS="${GESTORQ_DADOS:-$HOME/.local/share/gestorq/dados}"
mkdir -p "$DADOS"
porta() { cat "$DADOS/porta.txt" 2>/dev/null || echo 8741; }
saudavel() { "$BASE/runtime/node" -e "require('http').get({host:'127.0.0.1',port:$1,path:'/api/health',timeout:600},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>process.exit(/\"gestorq\"/.test(b)?0:1))}).on('error',()=>process.exit(1))" 2>/dev/null; }
P=$(porta)
if ! saudavel "$P"; then
  nohup "$BASE/runtime/node" --no-warnings "$BASE/server/server.js" --dados "$DADOS" >/dev/null 2>&1 &
  for _ in $(seq 1 80); do sleep 0.25; P=$(porta); saudavel "$P" && break; done
fi
saudavel "$P" || { (command -v zenity >/dev/null && zenity --error --text="Não foi possível iniciar o GestorQ. Veja $DADOS/logs/servidor.log") || echo "Falha ao iniciar. Veja $DADOS/logs/servidor.log"; exit 1; }
URL="http://127.0.0.1:$P/"
[ "${GESTORQ_SEM_JANELA:-0}" = "1" ] && { echo "$URL"; exit 0; }
for nav in microsoft-edge google-chrome chromium chromium-browser; do
  if command -v "$nav" >/dev/null 2>&1; then exec "$nav" --app="$URL" --user-data-dir="$DADOS/navegador" --no-first-run --window-size=1366,860; fi
done
xdg-open "$URL"
