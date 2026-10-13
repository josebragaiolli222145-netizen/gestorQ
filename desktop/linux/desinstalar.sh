#!/usr/bin/env bash
# Desinstalador do GestorQ Desktop para Ubuntu/Linux
set -u
G="$HOME/.local/share/gestorq"
echo "Isto remove o programa GestorQ deste computador."
read -r -p "Deseja continuar? [s/N] " r; [[ "$r" =~ ^[sS]$ ]] || exit 0
echo "Os DADOS (banco, backups e perfil do navegador do app) ficam em: $G/dados"
read -r -p "Apagar também os dados de forma definitiva? [s/N] " apagar
pkill -f "$G/programa/runtime/node" 2>/dev/null || true
pkill -f -- "--user-data-dir=$G/dados/navegador" 2>/dev/null || true
sleep 1
DESK_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
rm -f "$HOME/.local/share/applications/gestorq.desktop" "$DESK_DIR/gestorq.desktop"
rm -rf "$G/programa"
if [[ "$apagar" =~ ^[sS]$ ]]; then
  rm -rf "$G"
  if [ -e "$G" ]; then echo "ATENÇÃO: não foi possível apagar tudo em $G. Apague manualmente."; exit 2; fi
  echo "GestorQ e todos os dados foram removidos."
else
  echo "GestorQ removido. Seus dados continuam em: $G/dados"
fi
