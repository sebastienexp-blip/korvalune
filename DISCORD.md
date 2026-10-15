# Serveur Discord Korvalune

Un outil construit tout le serveur d'un coup : 11 rôles (créateur, modérateur, guide, testeur, mécène, 5 classes, joueur), 8 catégories et 32 salons (infos, communauté, jeu, avis et support, vocal, testeurs, mécènes, équipe), permissions, règlement, messages d'accueil, liens utiles et modération automatique (spam de mentions, liens d'invitation). Il peut être relancé sans risque : il ne supprime rien et ne recrée pas ce qui existe.

## 1. Ce que tu fais (≈ 10 minutes, rien à payer)
1. **Créer le serveur** : Discord → « + » → Créer le mien → « Pour moi et mes amis » → nom *Korvalune*. Ajoute l'icône `docs/play/icon-512.png`.
2. **Créer le bot** : https://discord.com/developers/applications → New Application (« Korvalune Installateur ») → onglet *Bot* → *Reset Token* → copie le jeton. **Ne le colle jamais dans un chat.**
3. **Inviter le bot** : onglet *OAuth2 → URL Generator* → coche `bot`, puis la permission **Administrator** → ouvre l'adresse générée et choisis ton serveur.
4. **Récupérer l'identifiant du serveur** : Discord → Paramètres → Avancés → active *Mode développeur* ; puis clic droit sur l'icône du serveur → *Copier l'identifiant du serveur*.
5. **GitHub** → ton dépôt → Settings → Secrets and variables → Actions → *New repository secret* : crée `DISCORD_BOT_TOKEN` (le jeton) et `DISCORD_GUILD_ID` (l'identifiant).
6. **GitHub → Actions → « Construire le serveur Discord » → Run workflow.** En une ou deux minutes, tout est créé.
7. **Retire ensuite le jeton** : retourne sur la page du bot et fais *Reset Token* (l'ancien devient inutile), puis expulse le bot du serveur ou retire-lui le rôle Administrator.

## 2. Réglages à faire à la main (Discord ne les permet pas via l'outil)
- **Paramètres du serveur → Activer la Communauté** (règlement = #règlement, mises à jour = #annonces). Ensuite, clic droit sur #annonces et #nouveautés-du-jeu → *Modifier → Type : Annonces*.
- **Sécurité** : niveau de vérification *Moyen*, filtre de contenu explicite *Tous les membres*.
- **Onboarding (Accueil)** : question « Quelle est ta classe ? » (Guerrier, Paladin, Mage, Archer, Assassin → rôles correspondants) et attribue automatiquement le rôle 🌙 Joueur aux nouveaux membres.
- **Ordre des rôles** : place le rôle du bot au-dessus des autres le temps de l'installation, puis 👑 Créateur et 🛡️ Modérateur en haut.
- **Donne-toi le rôle 👑 Créateur** (clic droit sur ton nom → Rôles).
- **Lien d'invitation permanent** : clic droit sur #bienvenue → *Inviter des gens* → *Modifier le lien* → Expire jamais. Donne-moi ce lien : je l'ajoute au site et au jeu.

## 3. Au quotidien
- Annonces de mise à jour : copie les notes de la version dans #nouveautés-du-jeu.
- Testeurs Play Store : donne-leur le rôle 🧪 Testeur, ils voient les salons dédiés.
- Pour changer la structure, modifie `tools/discord/blueprint.mjs` puis relance le workflow.
