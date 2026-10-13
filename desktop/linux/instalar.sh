#!/usr/bin/env bash
# Instalador do GestorQ Desktop para Ubuntu/Linux (sem sudo; só para o seu usuário)
set -euo pipefail
ORIGEM="$(cd "$(dirname "$0")" && pwd)/programa"
DESTINO="$HOME/.local/share/gestorq/programa"
DADOS="$HOME/.local/share/gestorq/dados"
[ -x "$ORIGEM/runtime/node" ] || { echo "ERRO: extraia o pacote inteiro antes de instalar."; exit 1; }
echo "Instalando o GestorQ Desktop..."
pkill -f "$DESTINO/runtime/node" 2>/dev/null || true
mkdir -p "$DESTINO" "$DADOS" "$HOME/.local/share/applications"
rm -rf "$DESTINO"; mkdir -p "$DESTINO"
cp -a "$ORIGEM/." "$DESTINO/"
chmod +x "$DESTINO/gestorq.sh" "$DESTINO/runtime/node"
cat > "$HOME/.local/share/applications/gestorq.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=GestorQ
Comment=Gestão de Qualidade e Perdas
Exec=$DESTINO/gestorq.sh
Icon=$DESTINO/gestorq.png
Terminal=false
Categories=Office;
DESK
DESK_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
if [ -d "$DESK_DIR" ]; then cp "$HOME/.local/share/applications/gestorq.desktop" "$DESK_DIR/"; chmod +x "$DESK_DIR/gestorq.desktop"; gio set "$DESK_DIR/gestorq.desktop" metadata::trusted true 2>/dev/null || true; fi
echo "Pronto! Abra o GestorQ pelo menu de aplicativos ou pelo atalho na Área de Trabalho."
echo "Dados em: $DADOS"
"$DESTINO/gestorq.sh" >/dev/null 2>&1 &
