# Mettre Legends of Aetheria en ligne

Le jeu et le serveur de comptes tournent dans **un seul programme** (`node server.js`), sur **un seul port**.
Les joueurs ouvrent l'adresse du site, créent un compte (identifiant + mot de passe de 8 caractères minimum), puis jouent directement dans le navigateur. Leur personnage est sauvegardé sur le serveur et se retrouve sur n'importe quel appareil.

> Je (Claude) ne peux pas mettre le site en ligne à ta place : il faut un hébergeur et un compte chez lui. Tout est prêt, il ne reste que ces étapes.

# Option gratuite : depuis ton téléphone (Termux) — la plus simple

Aucun compte, aucune carte bancaire, aucun hébergeur. Le téléphone fait office de serveur, et un tunnel Cloudflare gratuit lui donne une adresse HTTPS publique.

```
cd ~/aetheria
npm run online
```

Le script installe `cloudflared` (si besoin), construit le jeu, lance le serveur et affiche une adresse `https://xxxx.trycloudflare.com`. Envoie-la à tes amis : ils créent un compte et jouent dans leur navigateur.

À savoir :
- Le jeu n'est en ligne **tant que Termux tourne** et que le téléphone est allumé avec internet (le script garde l'appareil éveillé).
- L'adresse **change à chaque lancement** (tunnel gratuit sans compte).
- Les comptes et personnages sont gardés dans `aetheria/data/` sur le téléphone : ils survivent aux relances. Copie ce dossier de temps en temps.
- Pour une adresse fixe et un site toujours allumé, passe aux options d'hébergement ci-dessous.

---

## Ce qu'il faut absolument

| Point | Pourquoi |
|---|---|
| **HTTPS** | Obligatoire pour que les mots de passe ne circulent pas en clair (le jeu utilise alors `wss://`). Tous les hébergeurs ci-dessous le fournissent. |
| **Un disque persistant** monté sur `DATA_DIR` | Sinon les comptes disparaissent à chaque redémarrage. |
| **`TRUST_PROXY=1`** | Derrière un hébergeur, pour que les limites anti-abus voient la vraie adresse IP des joueurs. |
| **`SESSION_SECRET`** (texte aléatoire long) | Signe les sessions. Sans lui, un fichier `session.key` est créé dans `DATA_DIR` (aussi OK s'il est sur le disque persistant). |

Variables d'environnement : `PORT` (8787), `HOST` (0.0.0.0), `DATA_DIR` (./data), `DIST_DIR` (./dist), `TRUST_PROXY`, `SESSION_SECRET`, `MAX_CONN_PER_IP` (12).

## Option A — Render (le plus simple)
1. Mets le dossier du jeu sur un dépôt GitHub (privé ou public).
2. Sur render.com : **New + → Blueprint**, choisis le dépôt. Le fichier `render.yaml` crée le service, le disque et le secret.
3. Attends la fin du build : l'adresse `https://legends-of-aetheria.onrender.com` est le site.
(Le disque persistant demande un plan payant ; sans disque, les comptes sont perdus à chaque redéploiement.)

## Option B — Fly.io
Installe `flyctl`, puis dans le dossier du jeu :
```
fly launch --no-deploy --copy-config
fly volumes create aetheria_data --size 1
fly secrets set SESSION_SECRET=$(openssl rand -hex 32)
fly deploy
```

## Option C — Ton propre serveur (VPS) avec Docker + Caddy
```
docker build -t aetheria .
docker run -d --name aetheria --restart unless-stopped -p 127.0.0.1:8787:8787 -v aetheria_data:/data \
  -e SESSION_SECRET=$(openssl rand -hex 32) aetheria
```
Caddy (HTTPS automatique) — fichier `Caddyfile` :
```
jeu.mondomaine.fr {
    reverse_proxy 127.0.0.1:8787
}
```
Sans Docker : `npm install && npm run build && TRUST_PROXY=1 DATA_DIR=/var/aetheria npm start`.

## Nom de domaine
Chez ton registrar, crée un enregistrement DNS (CNAME vers l'hébergeur, ou A vers l'IP du VPS), puis ajoute le domaine dans le tableau de bord de l'hébergeur (ou dans le Caddyfile).

## Tester en local
```
npm run build
npm start        # puis http://localhost:8787
```
En local (localhost / réseau privé), le jeu reste jouable sans compte comme avant. Sur un vrai domaine, le compte est obligatoire.

## Sauvegardes
Tout est dans `DATA_DIR` : `accounts.json` (+ `accounts.json.bak` automatique) et `session.key`. Copie ce dossier régulièrement (un `cron` + `rsync`, ou les snapshots du disque chez l'hébergeur).

## Sécurité déjà en place
- Mots de passe hachés (jamais stockés en clair), sessions signées valables 14 jours.
- Limites : 4 créations de compte / 10 min / IP, 15 tentatives de connexion / min / IP, verrouillage d'un compte 5 min après 6 échecs.
- Noms de compte insensibles à la casse, noms réservés refusés, sauvegardes validées côté serveur.
- Entêtes de sécurité (CSP, nosniff, HSTS derrière HTTPS), fichiers du serveur et données jamais servis.

## Limites à connaître
- **Pas de récupération de mot de passe** (pas d'e-mail collecté) : un mot de passe perdu = compte perdu. Le jeu le dit aux joueurs.
- La logique du jeu s'exécute dans le navigateur : le serveur contrôle les sauvegardes (plafonds, objets valides) mais ne peut pas empêcher toute triche.
- Si tu ouvres le site au public, prévois une page de mentions légales / politique de confidentialité : tu stockes des identifiants et des mots de passe hachés (RGPD si des joueurs sont en Europe).
- Une seule instance du serveur (les comptes sont dans un fichier) : adapté à quelques centaines de joueurs, pas à des milliers.
