#!/usr/bin/env bash
# Met le jeu en ligne de façon PERMANENTE sur Fly.io (adresse fixe https://<nom>.fly.dev, comptes et sauvegardes conservés).
# Utilisable depuis Termux (aucun Docker nécessaire : la construction se fait chez Fly) ou depuis un PC.
# Prérequis : un compte Fly.io avec une carte bancaire enregistrée (le jeu coûte environ 2-5 $ / mois).
# Usage : bash tools/deploy-fly.sh [nom-de-l-app]
set -e
cd "$(dirname "$0")/.."

if ! command -v fly >/dev/null 2>&1 && ! command -v flyctl >/dev/null 2>&1; then
  echo "▶ Installation de l'outil Fly.io…"
  curl -L https://fly.io/install.sh | sh
  export FLYCTL_INSTALL="${FLYCTL_INSTALL:-$HOME/.fly}"; export PATH="$FLYCTL_INSTALL/bin:$PATH"
fi
FLY=$(command -v fly || command -v flyctl)

if ! $FLY auth whoami >/dev/null 2>&1; then
  echo "▶ Connexion à Fly.io (crée ton compte si besoin : une page web va s'ouvrir / une adresse s'affiche)…"
  $FLY auth login
fi

APP="${1:-$(sed -n 's/^app = "\(.*\)"/\1/p' fly.toml | head -1)}"
if ! $FLY status -a "$APP" >/dev/null 2>&1; then
  # le nom est peut-être déjà pris : on essaie avec un suffixe aléatoire
  if ! $FLY apps create "$APP" >/dev/null 2>&1; then APP="aetheria-$RANDOM$RANDOM"; echo "▶ Nom pris, nouveau nom : $APP"; $FLY apps create "$APP"; fi
fi
sed -i "s/^app = \".*\"/app = \"$APP\"/" fly.toml

if ! $FLY volumes list -a "$APP" 2>/dev/null | grep -q aetheria_data; then
  echo "▶ Création du disque de sauvegarde (comptes + personnages)…"
  $FLY volumes create aetheria_data --size 1 --region "$(sed -n 's/^primary_region = "\(.*\)"/\1/p' fly.toml)" -a "$APP" --yes
fi
$FLY secrets set SESSION_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')" -a "$APP" --stage >/dev/null 2>&1 || true

echo "▶ Construction et mise en ligne (2 à 5 minutes)…"
$FLY deploy -a "$APP" --remote-only --ha=false
echo
echo "✅ Le jeu est en ligne : https://$APP.fly.dev"
echo "   Donne cette adresse à tes amis. Pour mettre à jour plus tard : bash tools/deploy-fly.sh"
