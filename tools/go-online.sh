#!/data/data/com.termux/files/usr/bin/bash
# Met le jeu en ligne GRATUITEMENT depuis ce téléphone (Termux) via un tunnel Cloudflare (HTTPS, sans compte).
# Usage : bash tools/go-online.sh        (ou : npm run online)
set -e
cd "$(dirname "$0")/.."

command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock || true

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "▶ Installation de cloudflared…"
  if command -v pkg >/dev/null 2>&1; then pkg install -y cloudflared
  else echo "cloudflared introuvable : installe-le (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)"; exit 1; fi
fi

[ -d node_modules ] || { echo "▶ npm install…"; npm install; }
echo "▶ Construction du jeu…"
npm run build

export PORT="${PORT:-8787}" TRUST_PROXY=1 DATA_DIR="${DATA_DIR:-$PWD/data}"
echo "▶ Démarrage du serveur sur le port $PORT…"
node server.js &
SRV=$!
trap 'kill $SRV 2>/dev/null; kill $TUN 2>/dev/null' EXIT INT TERM
sleep 2

echo "▶ Ouverture du tunnel HTTPS… (l'adresse https://….trycloudflare.com apparaît ci-dessous)"
echo "  Donne cette adresse à tes amis. Laisse Termux ouvert ; Ctrl+C pour arrêter."
cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" 2>&1 | tee $HOME/aetheria-tunnel.log &
TUN=$!
wait $TUN
