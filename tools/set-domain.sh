#!/bin/sh
# Usage : tools/set-domain.sh korvalune.fr
# Remplace l'adresse du site dans les pages publiques (lien canonique, aperçu réseaux, plan du site).
set -e
[ -n "$1" ] || { echo "Usage : $0 nom-de-domaine"; exit 1; }
OLD="legends-of-aetheria-mxaq.onrender.com"
for f in public/bienvenue/index.html public/sitemap.xml public/robots.txt; do sed -i "s#$OLD#$1#g" "$f"; done
echo "Adresses remplacées par $1"
