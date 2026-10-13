#!/usr/bin/env bash
# GestorQ Desktop - inicia o servidor local (se preciso) e abre o app
BASE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
DADOS="${GESTORQ_DADOS:-$HOME/.local/share/gestorq/dados}"
mkdir -p "$DADOS"
umask 077
chmod 700 "$DADOS" 2>/dev/null || true
porta() { local p; p=$(cat "$DADOS/porta.txt" 2>/dev/null); [[ "$p" =~ ^[0-9]{2,5}$ ]] && echo "$p" || echo 8741; }
# precisa ser o GestorQ DESTE usuário (outro usuário pode ter o seu na mesma porta)
saudavel() { GQ_PORTA="$1" GQ_DONO="$(id -un)" "$BASE/runtime/node" -e "require('http').get({host:'127.0.0.1',port:+process.env.GQ_PORTA,path:'/api/health',timeout:600},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{const j=JSON.parse(b);process.exit(j.app==='gestorq'&&String(j.dono).toLowerCase()===process.env.GQ_DONO.toLowerCase()?0:1)}catch(e){process.exit(1)}})}).on('error',()=>process.exit(1))" 2>/dev/null; }
P=$(porta)
if ! saudavel "$P"; then
  nohup "$BASE/runtime/node" --no-warnings "$BASE/server/server.js" --dados "$DADOS" >/dev/null 2>&1 &
  for _ in $(seq 1 80); do sleep 0.25; P=$(porta); saudavel "$P" && break; done
fi
saudavel "$P" || { (command -v zenity >/dev/null && zenity --error --text="Não foi possível iniciar o GestorQ. Veja $DADOS/logs/servidor.log") || echo "Falha ao iniciar. Veja $DADOS/logs/servidor.log"; exit 1; }
URL="http://127.0.0.1:$P/#t=$(cat "$DADOS/token" 2>/dev/null)"
[ "${GESTORQ_SEM_JANELA:-0}" = "1" ] && { echo "$URL"; exit 0; }
for nav in microsoft-edge google-chrome chromium chromium-browser; do
  if command -v "$nav" >/dev/null 2>&1; then exec "$nav" --app="$URL" --user-data-dir="$DADOS/navegador" --no-first-run --window-size=1366,860; fi
done
xdg-open "$URL"
