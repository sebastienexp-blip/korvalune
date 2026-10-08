#!/data/data/com.termux/files/usr/bin/bash
# Usage : bash tools/import-models.sh ~/storage/downloads/MonDossier
# Décompresse les .zip du dossier donné et copie tous les .glb dans public/models.
set -e
SRC="${1:-$HOME/storage/downloads}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/public/models"
TMP="$(mktemp -d)"
mkdir -p "$DEST"
find "$SRC" -maxdepth 2 -iname "*.zip" | while read -r z; do
  case "$(basename "$z")" in *aetheria*) continue;; esac
  unzip -o -q "$z" -d "$TMP/$(basename "$z" .zip)" 2>/dev/null || true
done
N=0
while IFS= read -r f; do cp -f "$f" "$DEST/"; N=$((N+1)); done < <(find "$SRC" "$TMP" -iname "*.glb" -not -path "*/aetheria/*")
rm -rf "$TMP"
echo "$N fichier(s) .glb copié(s) dans $DEST"
ls "$DEST" | head -50
