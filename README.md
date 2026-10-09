# Korvalune — Prototype (Étape 6 — toutes les étapes prévues)

MMORPG fantasy 3D jouable dans le navigateur, en **HTML5 / Three.js / JavaScript ES2022**,
optimisé pour PC **et pour mobile** (contrôles tactiles, jauges adaptatives de qualité).

Ce prototype couvre les **6 étapes** du cahier des charges d'origine : monde 3D avec terrain
procédural, ville de Korvalune, PNJ, ennemis variés avec IA, combat en temps réel, XP/niveaux,
HUD, mini-carte, cycle jour/nuit, météo dynamique, inventaire, équipement, butin, deux zones
explorables, marchands, un point d'intérêt façon donjon, un boss à phases, un serveur
multijoueur Node.js/WebSocket (présence des autres joueurs, chat, groupes), **et maintenant des
comptes avec mot de passe (haché, jamais stocké en clair), une sauvegarde persistante côté
serveur liée au compte, et des garde-fous de sécurité côté serveur.**

**Portée exacte de ces deux dernières étapes** (à lire avant de considérer le jeu comme
"sécurisé") :

- **Multijoueur (étape 5)** : chaque joueur connecté voit les autres se déplacer, combattre
  (visuellement) et discuter en temps réel. Le monde de jeu lui-même (ennemis, butin, quêtes)
  reste calculé **indépendamment par chaque client** — il n'est pas synchronisé entre joueurs.
  Deux joueurs dans la même zone se voient et se parlent, mais chacun combat "ses propres"
  loups dans sa propre simulation.
- **Comptes et sécurité (étape 6)** : le serveur authentifie les comptes (mots de passe hachés
  avec `scrypt`, jamais en clair), et devient la source de vérité pour la sauvegarde d'un
  personnage connecté (au lieu du seul stockage local du navigateur). Il applique aussi des
  garde-fous : limites de débit (anti-flood chat/mouvement), et des bornes de plausibilité sur
  les sauvegardes (le niveau ne peut jamais redescendre, l'or ne peut pas exploser d'un coup,
  les formes de données malformées sont rejetées). **Ce n'est pas un système anti-triche
  complet** : le serveur ne rejoue pas chaque coup de combat et ne recalcule pas les dégâts
  lui-même — cela demanderait de dupliquer tout le moteur de jeu côté serveur, un chantier bien
  plus vaste qu'un prototype. Un joueur déterminé pourrait donc encore tricher dans une certaine
  mesure ; les garde-fous limitent l'ampleur des dégâts possibles, ils ne l'éliminent pas.

## 1. Installer Node.js
Installez Node.js 18 ou plus récent : https://nodejs.org (choisissez la version "LTS").
Vérifiez avec :
```
node -v
```

## 2. Installer les dépendances
Depuis le dossier du projet :
```
npm install
```

## 3. Lancer le serveur de développement
```
npm run dev
```
Le terminal affiche deux adresses :
- `Local:   http://localhost:5173`  → à utiliser sur le PC qui lance la commande.
- `Network: http://192.168.x.x:5173` → à ouvrir dans le navigateur du **téléphone**,
  à condition que le téléphone soit connecté au **même réseau Wi-Fi** que l'ordinateur.

Sur le téléphone : ouvrez cette adresse `http://192.168.x.x:5173` dans Chrome/Safari,
puis (optionnel) « Ajouter à l'écran d'accueil » pour un lancement en plein écran façon app.

Si le téléphone n'arrive pas à se connecter : vérifiez que le pare-feu Windows/macOS
n'bloque pas le port 5173, et que les deux appareils sont bien sur le même réseau
(pas de VPN, pas d'« isolation des clients » activée sur le routeur/box).

## 4. Commandes disponibles
- `npm run dev` — serveur de développement avec rechargement à chaud
- `npm run build` — build de production dans `dist/`
- `npm run preview` — sert le build de production (utile pour tester les perfs mobiles réelles)
- `npm run server` — lance le serveur multijoueur (voir ci-dessous)

## 5. Multijoueur (optionnel)
Le jeu fonctionne très bien en solo sans rien faire de plus. Pour voir d'autres joueurs
connectés, discuter et former un groupe, lancez le serveur **dans un deuxième terminal**,
en parallèle de `npm run dev` :
```
npm run server
```
Il écoute sur le port `8787`. Le client s'y connecte automatiquement (même adresse que la
page web, juste un port différent) — rien à configurer. Si le serveur n'est pas lancé, le
jeu continue de fonctionner normalement en solo ; un petit bandeau "Mode solo" apparaît en
haut de l'écran, et il retente la connexion tout seul en arrière-plan.

Pour que votre téléphone y accède aussi via le Wi-Fi, le pare-feu doit autoriser le port
`8787` en plus du `5173` déjà nécessaire pour `npm run dev`.

**Chat** : bouton 💬 (ou touche `Entrée` pour ouvrir le champ). Commandes :
- `/help` — rappel des commandes
- `/who` — liste des joueurs en ligne
- `/invite <nom>` — inviter quelqu'un dans votre groupe (jusqu'à 5)
- `/group` — affiche les membres actuels ; `/group accept` pour rejoindre une invitation
  reçue ; `/group leave` pour quitter
- `/whisper <nom> <message>` (ou `/w`) — message privé

## 6. Comptes et sauvegarde serveur (optionnel)
Toujours avec `npm run server` lancé, un bouton **🔐 Compte** apparaît dans le menu principal.
Créer un compte (identifiant + mot de passe, 6 caractères minimum) permet de retrouver votre
personnage depuis n'importe quel appareil, au lieu d'une sauvegarde coincée dans le navigateur
d'un seul téléphone/PC. C'est entièrement facultatif — "Jouer en invité" (ne pas se connecter)
fonctionne exactement comme avant, avec une sauvegarde locale.

Une fois connecté, la sauvegarde (manuelle via le menu pause, ou automatique toutes les 60
secondes en jeu) part vers le serveur en plus de la sauvegarde locale. Les mots de passe sont
hachés (`scrypt`, le même genre de fonction que pour un vrai site) et jamais stockés en clair.
Les comptes sont conservés dans `data/accounts.json`, créé automatiquement au premier lancement
du serveur — **ne partagez pas ce fichier**, et pensez à l'exclure d'un dépôt Git si vous en
créez un (il n'y a pas de `.gitignore` ici puisque le projet ne suppose pas l'usage de Git).

Pour une utilisation au-delà d'un prototype local, un vrai serveur de production voudrait aussi :
HTTPS/WSS (le `ws://` actuel n'est pas chiffré), une vraie base de données plutôt qu'un fichier
JSON, et une limite de tentatives de connexion plus robuste contre le bruteforce.

## Contrôles

**PC (clavier/souris)**
- Toutes les touches sont réassignables dans Options → Clavier & souris. Par défaut : `WASD` déplacement, `Shift` sprint, `Espace` roulade, `V` potion de vie, `B` potion de mana, `C` s'accroupir
- Clic gauche = verrouille le pointeur pour la caméra ; `E` interagir avec un PNJ
- `1`-`9` puis `0` pour les 10 emplacements de compétences, `I` inventaire, `P` personnage/équipement,
  `K` compétences, `M` carte du monde, `Échap` pause
- `E` interagir (parler à un PNJ, ouvrir un coffre, cibler un ennemi proche)

**Mobile (tactile)**
- Joystick virtuel en bas à gauche = déplacement
- Glisser sur le reste de l'écran = caméra
- Bouton ⚔ = attaque, 🌀 = roulade, ⚡ = sprint, ⬇ = s'accroupir, ✋ = interagir, 🔒 = verrouiller/libérer la caméra
- Boutons 🎒 (inventaire) et 🧍 (personnage) en haut de l'écran

**Inventaire** : toucher/cliquer un objet ouvre une fiche avec Équiper / Utiliser / Vendre / Jeter
(interactions tactiles simples — pas de glisser-déposer, plus fiable sur mobile).
**Personnage** : toucher un emplacement équipé le déséquipe (retourne dans l'inventaire).

## Architecture
```
src/
  core/       Game.js (orchestrateur), boucle, config, input, sauvegarde
  world/      Terrain procédural (bruit), rivière, ville de Korvalune, zones, donjon, météo
  player/     Personnage jouable, caméra troisième personne
  entities/   Modèles procéduraux (humanoïde, créature), PNJ, ennemis, boss
  combat/     Classes de personnage, résolution des dégâts/compétences
  inventory/  Objets, inventaire, équipement, butin
  quests/     Journal de quêtes piloté par événements
  network/    Client multijoueur (NetworkManager, joueurs distants)
  effects/    Particules et météo (pooled, peu de draw calls)
  audio/      Sons synthétisés (Web Audio), aucun fichier requis
  ui/         HUD, mini-carte, chat, contrôles tactiles
  data/       skills/enemies/npcs/items.json — modifiables sans toucher au code
server.js     Serveur multijoueur (Node.js + WebSocket, voir sections 5-6 plus haut)
server/       Comptes (hachage de mot de passe, persistance JSON), limiteur de débit
```

Aucun asset externe n'est requis : personnages, créatures, terrain et bâtiments sont générés
procéduralement avec des primitives Three.js (voir `entities/HumanoidModel.js` et
`entities/CreatureModel.js`). Remplacer ces modèles temporaires par de vrais fichiers GLB/GLTF
est possible sans toucher à la logique de jeu (IA, combat, réseau...), mais demanderait de
modifier directement ces deux fichiers de création de modèle — il n'y a pas encore de module
de chargement d'assets dédié qui ferait ce remplacement automatiquement.

## Météo et ambiance
Le temps change dynamiquement (ciel dégagé, nuageux, pluie, orage, neige en montagne), avec
une notification discrète à chaque changement. Pendant un orage : éclairs et tonnerre
synthétisé, ambiance sonore de pluie. La neige n'apparaît que dans la zone « Montagnes de Fer ».

## Notes de performance (mobiles puissants)
- Qualité graphique réglable (Très faible → Ultra) dans Paramètres, avec pixel-ratio,
  ombres, distance de brouillard et densité de particules/arbres ajustés dynamiquement.
- Arbres/rochers/buissons en `InstancedMesh` (quelques draw calls pour des milliers
  d'objets), terrain en un seul mesh, particules et nuages en un seul système chacun.
- Cible 60 FPS sur mobile haut de gamme ; repli automatique recommandé vers "Moyenne"
  sur mobile milieu de gamme (menu Paramètres).
- Les ennemis trop éloignés du joueur suspendent leur IA (mais gardent leur minuteur de
  réapparition) pour économiser du CPU.
- Un panneau de statistiques (FPS, appels de rendu, triangles, mémoire GPU) est visible
  dans Paramètres pour du débogage.

## 7. Application Android (.apk)

### V10.11 — APK prêt à télécharger (méthode simple)
Le dossier `android-app/` contient une petite application Android (WebView plein écran) qui
ouvre le jeu en ligne (`https://legends-of-aetheria-mxaq.onrender.com/`). GitHub la compile
tout seul (workflow `.github/workflows/android-apk.yml`) à chaque modification du dossier, ou à
la demande (onglet *Actions* → *Construire l'APK Android* → *Run workflow*). Le fichier est
ensuite disponible dans *Releases* (« Korvalune — APK Android », fichier `Korvalune.apk`).
Si l'adresse du site change, modifier `GAME_URL` dans `android-app/.../MainActivity.java`.
L'APK est signé en mode « debug » : installable directement (autoriser les sources inconnues),
mais pas publiable tel quel sur le Play Store.

### Ancienne méthode (Capacitor, sur PC)
Les fichiers sont prêts (`capacitor.config.json`, scripts `cap:*` dans `package.json`), mais
la génération elle-même doit se faire sur un PC avec internet et le SDK Android installé —
ça ne peut pas se faire depuis ce chat ni depuis votre téléphone sans PC. Le jour où vous êtes
devant un PC (Windows/Mac/Linux, peu importe) :

1. Installez [Android Studio](https://developer.android.com/studio) (il installe le SDK Android
   avec) — à faire une seule fois.
2. Dans le dossier du projet :
   ```
   npm install
   npm run cap:init
   ```
   Ça construit le jeu, crée le dossier `android/`, et copie le jeu dedans.
3. Pour un `.apk` installable directement (débogage, pas besoin du Play Store) :
   ```
   npm run cap:apk
   ```
   Le fichier apparaît dans `android/app/build/outputs/apk/debug/app-debug.apk`. Copiez-le sur
   le téléphone (câble, e-mail, Drive...) et ouvrez-le pour l'installer (il faudra autoriser
   "sources inconnues" dans les réglages Android la première fois).
   — Ou bien ouvrez le dossier `android/` dans Android Studio et cliquez sur ▶ pour lancer
   directement sur un téléphone branché en USB.

Le multijoueur (`server.js`) ne tourne pas dans l'app — il faudrait l'héberger quelque part
avec une adresse fixe (un sujet à part, dites-moi si ça vous intéresse). L'app fonctionnera en
solo, exactement comme dans le navigateur.

## 8. Tester maintenant, depuis votre téléphone, sans PC du tout
C'est possible : **Termux** transforme votre téléphone Android en son propre petit "PC" — il
fait tourner Node.js directement dessus, et vous ouvrez le jeu dans le navigateur du même
téléphone (pas besoin de Wi-Fi partagé avec un PC, puisqu'il n'y a qu'un seul appareil).

1. Installez **Termux** — préférez [F-Droid](https://f-droid.org/en/packages/com.termux/)
   (la version Play Store est ancienne et mal maintenue).
2. Ouvrez Termux et lancez :
   ```
   termux-setup-storage
   pkg update -y && pkg install nodejs git unzip -y
   ```
   (Acceptez la demande d'autorisation de stockage.)
3. Téléchargez le fichier `legends-of-aetheria-etape6.zip` de ce chat directement sur le
   téléphone (comme n'importe quel fichier), puis dans Termux :
   ```
   cd ~/storage/downloads
   unzip legends-of-aetheria-etape6.zip -d ~/
   cd ~/aetheria
   npm install
   ```
   (Le tout premier `npm install` peut prendre quelques minutes.)
4. Lancez le jeu :
   ```
   npm run dev
   ```
   puis ouvrez l'adresse `http://localhost:5173` affichée, dans Chrome/Firefox sur le même
   téléphone. C'est tout — vous jouez.
5. (Optionnel, multijoueur) Dans Termux, glissez depuis le bord gauche pour ouvrir une
   nouvelle session, et lancez `cd ~/aetheria && npm run server` en parallèle.

Ceci fait tourner le jeu complet, exactement le même que sur PC — aucune fonctionnalité en
moins, juste via le terminal Android à la place d'un ordinateur.

## Corrections suite au premier test réel sur téléphone
Un premier essai sur téléphone (via Termux) a révélé plusieurs bugs réels, corrigés :
- **Joystick** : il existait en fait deux systèmes de contrôle tactile séparés qui ne se
  parlaient pas — le joystick visuel ne faisait bouger que son propre dessin, sans jamais
  faire avancer le personnage. Unifié : le joystick pilote maintenant vraiment le déplacement.
- **Minicarte qui se superposait aux boutons** : les deux étaient positionnés au même endroit
  (bas-droite) par erreur. La minicarte est maintenant en haut à droite.
- **Impossible de fermer l'inventaire / ouvrir personnage / ouvrir un marchand** : ces trois
  écrans avaient été oubliés dans la règle CSS qui les affiche en plein écran — ils
  s'"ouvraient" techniquement mais restaient invisibles ou mal positionnés. Corrigé.
- **Combat peu précis** : en plus des problèmes de déplacement ci-dessus, l'angle du
  personnage pouvait dériver après plusieurs rotations et fausser la détection des coups ;
  corrigé, et la zone de frappe a été élargie pour être plus tolérante au tactile.
- **Butin** : les objets des ennemis tombent maintenant au sol (petit objet flottant coloré
  selon sa rareté) et se ramassent en s'approchant et en appuyant sur interagir (`E` /
  bouton ✋), au lieu d'être ajoutés automatiquement.
- **Musique** : il n'y en avait vraiment aucune (seulement des bruitages). Une ambiance
  musicale procédurale en boucle a été ajoutée.
- **Aperçu du personnage** : un petit rendu 3D du personnage (couleurs selon race/classe
  choisies) a été ajouté à l'écran de création.

## Quêtes (v7)

**Quêtes principales** : 4 PNJ en ville — **Hugo** (monde de départ), **Sébastien** (Terres Corrompues),
**Morgane** (Royaume Céleste) et **Laurine** (Néant Primordial, boss final inclus) — donnent chacun une
chaîne de 2 quêtes (8 au total). Parlez-leur (✋ / `E`) : ils proposent la quête suivante si votre niveau
suffit (sinon ils indiquent le niveau à atteindre), rappellent l'objectif en cours, puis remettent la
récompense quand vous revenez les voir.

**Quêtes secondaires** : 30 contrats de chasse par monde (150 au total), via le bouton 📜 (« Tableau des
contrats »), un onglet par monde (grisé tant que le niveau n'est pas atteint). 6 contrats actifs maximum.
Les compteurs (ex. 3/8 loups) sont sauvegardés, en local comme sur le serveur.

**Dépannage** : le numéro de version s'affiche en bas du menu principal (« Version v7 »). S'il n'est pas
visible, vous lancez une ancienne copie : supprimez les anciens zips du dossier Téléchargements, retéléchargez
`legends-of-aetheria-v7.zip`, puis refaites `rm -rf ~/aetheria` et le dézippage.

## Plus de variété de créatures, et le lutin pillard

**Deux nouvelles familles d'ennemis** en plus des loups/sangliers/bandits existants : des
**ours** (très résistants, lents) et des **brutes** humanoïdes (cognent fort). Chaque monde
(départ + les 4 accessibles par portail) a maintenant 4 créatures régulières différentes
plus son élite, au lieu de 3 — recolorées/thématisées pour chaque monde (corrompu, céleste,
abyssal, primordial), comme les espèces déjà existantes.

**Le lutin pillard** : apparaît au hasard à proximité (environ une chance sur
15 toutes les 15 secondes qu'aucun ne soit déjà présent — en moyenne un peu moins de 4
minutes entre deux apparitions), prévient par une notification. Il fuit sans arrêt dès qu'il
vous repère — plus rapide qu'en course — et n'attaque quasiment jamais. Une fois rattrapé et
tué : 3 à 5 objets garantis, avec une rareté nettement meilleure qu'un boss normal. S'il n'est
pas attrapé en 55 secondes, il s'enfuit pour de bon. Grâce au ciblage automatique, pas besoin
de viser parfaitement en le poursuivant — juste être à portée d'une compétence au bon moment.

## Ennemis répartis sur toute la carte
Auparavant, les ennemis n'occupaient que deux petites zones près de la ville — le reste de
la carte était vide. Ce n'est plus le cas : environ 230 points de spawn couvrent maintenant
tout le territoire du monde de départ (ville, eau et donjon exclus), et ~75 par monde
accessible par portail. Le niveau suit toujours la même logique qu'avant : faible près de la
ville (ou de l'entrée du portail), plus élevé en s'éloignant.

Pour que ça reste fluide sur mobile malgré une carte entièrement peuplée : les ennemis ne
sont de vrais objets 3D que lorsqu'ils sont assez proches du joueur (seuil qui s'adapte à la
qualité graphique choisie) — ceux trop loin sont proprement retirés et réapparaissent si on
y retourne. Au plus fort, 18 à 48 ennemis existent réellement en même temps selon la qualité
réglée, jamais plus, quelle que soit l'étendue déjà explorée.

## Ciblage automatique
Viser avec la caméra pour attaquer n'est plus nécessaire : le personnage se verrouille tout
seul sur l'ennemi le plus proche à portée (~11 unités), reste dessus tant qu'il est vivant
et à portée, et se tourne automatiquement vers lui au moment d'attaquer. Les compétences de
zone (AoE) touchent toujours tout ce qui est à portée, comme avant. Un tap manuel sur un
ennemi précis fonctionne toujours et reste prioritaire tant qu'il reste valide.

## Audit complet et équilibrage 1-200

Un audit du jeu dans son ensemble, avec un objectif précis : une progression cohérente du
niveau 1 au niveau 200, sans palier trop facile ni trop dur.

**Le diagnostic** : en simulant mathématiquement le jeu tel qu'il était, un combat qui
prenait 3 coups à résoudre au niveau 1 en prenait 51 au niveau 200 — la difficulté empirait
fortement en progressant, l'inverse de ce qu'il faut. Deux statistiques (critique, esquive)
plafonnaient dès le niveau ~70 avec une répartition équilibrée des points, rendant tout
investissement ultérieur dans la chance ou l'agilité inutile. Et surtout : les ennemis
s'arrêtaient au niveau 6. Un personnage niveau 50, 100 ou 200 n'avait tout simplement rien
à combattre d'adapté à sa puissance.

**Deux vrais bugs trouvés en auditant**, pas de simples ajustements de confort :
- La défense des ennemis n'avait jamais été appliquée aux dégâts qu'ils reçoivent, depuis
  le tout début du projet — un stat mort. Corrigé, et pris en compte dans le nouvel
  équilibrage.
- La minicarte utilisait une taille de monde codée en dur (400) au lieu de la vraie taille —
  invisible jusqu'ici, mais aurait cassé la minicarte avec le monde agrandi pour cette mise
  à jour.

**La correction** : les ennemis ont maintenant une vraie échelle de niveau
(`src/data/enemyScaling.js`) — leurs PV/dégâts/défense/XP se calculent à partir de leur
niveau avec une formule, au lieu de chiffres fixes. Testé par simulation : un combat prend
toujours ~5-6 coups à résoudre, et ~17 ennemis de son niveau pour monter d'un niveau, que ce
soit au niveau 5 ou au niveau 200. Les coefficients de critique/esquive ont été réduits pour
ne plus plafonner avant la fin du jeu avec une répartition équilibrée des points.

**5 mondes accessibles par portail**, pour donner un vrai contenu sur toute la plage :

| Monde | Niveau requis | Tranche de niveau |
|---|---|---|
| Prairies de Korvalune (départ) | — | 1-30 |
| Terres Corrompues | 22 | 22-70 |
| Royaume Céleste | 60 | 60-115 |
| Abysses Oubliées | 100 | 100-160 |
| Néant Primordial | 145 | 145-200 |

Les 4 portails (arches de pierre lumineuses) se trouvent à l'est de la ville, à côté du
puits. Marcher dessus et appuyer sur interagir téléporte directement vers le monde (`E` /
bouton ✋) — ou affiche le niveau requis si ce n'est pas encore débloqué. À l'intérieur de
chaque monde, le niveau des ennemis augmente progressivement à mesure qu'on s'éloigne du
point d'arrivée (donc pas d'ennemi de fin de zone collé à l'entrée), avec 2 élites plus
costaudes dans la moitié profonde. 16 nouveaux ennemis (recolorations thématiques des
espèces existantes : corrompu, céleste, abyssal, primordial) peuplent ces mondes, plus un
boss final — Le Souverain du Néant — niveau 195, dans le dernier monde. Le Gardien des
Ruines (étape 1) reste le boss du monde de départ, maintenant niveau 28.

**Compétences** : chaque classe avait plus aucune compétence à débloquer après le niveau
13 — 187 niveaux sans rien de nouveau. 6 compétences supplémentaires par classe ont été
ajoutées (niveaux 20/40/70/100/140/180), soit 11 compétences par classe au total, réparties
sur toute la plage 1-200.

Rien de l'existant n'a été supprimé : déplacements, joystick, combat, inventaire, coffre,
boutiques, loot à 25 raretés, multijoueur, sauvegardes — tout reste fonctionnel, juste mieux
équilibré.

## Refonte complète du système de loot (25 raretés)

Le butin (ennemis, boss, coffres) est maintenant généré procéduralement, en plus des objets
statiques déjà existants (boutiques, équipement de départ) qui continuent de fonctionner
à l'identique.

**25 niveaux de rareté**, de Commun à Absolu, chacun avec son propre nom, sa propre couleur
(25 couleurs bien distinctes — testé), un multiplicateur de stats/valeur, un nombre
d'affixes et d'effets possibles. Les probabilités suivent une courbe lissée, facilement
réajustable dans `src/data/rarities.js` (une poignée de constantes) ; testée sur 100 000
tirages : les raretés 1 à 5 sont fréquentes, 20+ extrêmement rares, 23-25 de véritables
événements. Les boss ont une courbe décalée (meilleures chances aux hauts paliers), et le
Gardien des Ruines (boss majeur) a en plus une chance dédiée de toucher directement un
objet 23-25.

**Objets générés** : armes (épée/hache/masse/lance/poignard/arc/bâton/orbe magique),
armures (casque/plastron/gants/pantalon/bottes), accessoires (anneau/amulette) — chacun
avec un niveau d'objet, un niveau requis (objet grisé et "Niveau insuffisant" affiché si
le personnage n'a pas le niveau), des statistiques principales ET secondaires (vitesse
d'attaque, dégâts critiques, résistances feu/glace/foudre, réduction de dégâts,
régénération de PV/mana — toutes réellement appliquées au personnage), des affixes, et des
effets spéciaux.

**Les effets spéciaux fonctionnent vraiment en combat** (pas juste affichés) : chaque
effet a un vrai pourcentage de déclenchement et un vrai temps de recharge, et inflige de
vrais dégâts (ou soigne) quand il se déclenche — Boule de feu, Nova de glace, Météore,
Explosion de flammes et une douzaine d'autres, débloqués progressivement selon la rareté
(petits effets dès le tier 8, sorts puissants à partir du tier 16, effets uniques réservés
aux tiers 23-25).

**Fiche détaillée** complète au clic sur n'importe quel objet (sol, inventaire, coffre,
équipé) : nom coloré selon la rareté, niveau/niveau requis, stats, affixes, effets avec
leur %, valeur, description — plus une **comparaison automatique** avec l'objet
actuellement équipé dans le même emplacement (différences en vert/rouge).

**Loot au sol** : couleur par rareté, aura et particules qui s'intensifient avec la
rareté (à partir du palier 8 pour l'aura, 20 pour les particules), lumière uniquement à
partir du palier 4 et désactivée en qualité "Très faible" — pour ne jamais ralentir un
téléphone modeste même avec beaucoup de butin au sol (plafonné à 40 objets simultanés).

**Sécurité** : un nouveau validateur serveur (`server/itemValidate.js`) borne strictement
tout objet généré envoyé en sauvegarde (rareté, niveau, stats, nombre d'affixes/effets) —
testé avec un payload volontairement falsifié, les valeurs aberrantes sont bien écrêtées.

Rien d'existant n'a été supprimé : déplacements, joystick, caméra, combat, compétences,
quêtes, minicarte, interface mobile, sauvegardes — tout reste fonctionnel. Un bug a été
trouvé et corrigé en testant réellement ce système avant de le livrer (un arrondi qui
effaçait le bonus de critique inhérent à certaines armes lors de la sauvegarde serveur).

## Nouvelles fonctionnalités

**Coffre de banque** : près du puits, au centre de Korvalune. S'approcher et appuyer sur
interagir (`E` / ✋) ouvre un coffre à 4 pages de 30 emplacements chacune (120 au total),
séparé de l'inventaire personnel. Touchez un objet d'un côté pour le faire passer de
l'autre côté (inventaire ↔ coffre). Sauvegardé comme le reste.

**Téléportation vers Korvalune** : bouton dans le menu pause. Gratuite si vous êtes déjà
en ville, sinon le coût dépend de la distance (20 à 300 pièces). Le bouton affiche le prix
et se désactive si vous n'avez pas assez d'or.

**Compétences par classe** : chaque classe a maintenant 6 compétences qui se débloquent en
montant de niveau (en plus de "Frappe", commune à tous). Bouton ✨ (ou touche `K`) pour
ouvrir l'écran des compétences : la barre d'action (10 emplacements, touches `1`-`9` puis
`0`) est entièrement configurable — touchez une compétence débloquée pour l'ajouter au
premier emplacement libre, touchez un emplacement de la barre pour le vider.

**Arme de départ par classe** : Guerrier/Paladin commencent avec une épée, Mage avec un
bâton, Archer avec un arc, Assassin avec une dague — réellement équipée dès le début.

**Équipement visible sur le personnage** : arme en main (épée/bâton/arc/dague selon ce qui
est équipé), bouclier, casque, épaulières, plastron et cape apparaissent et disparaissent
en temps réel selon ce qui est équipé ou déséquipé, teintés selon la rareté de l'objet.
Les gants/jambières/bottes/anneaux/collier restent des bonus de statistiques sans
représentation visuelle distincte (simplification du prototype).

## Deuxième round de corrections (après le joystick qui fonctionnait enfin)
- **Les ennemis devenaient "invincibles" après 2-3 kills** : bug sérieux — un indicateur
  interne destiné à éviter qu'un coup touche deux fois restait "collé" sur la compétence
  elle-même (partagée entre toutes les utilisations) au lieu d'être propre à chaque attaque.
  Résultat : après la toute première utilisation réussie d'une compétence, cette compétence
  ne pouvait plus jamais toucher personne. Comme le bouton tactile d'attaque utilise toujours
  la même compétence, ça expliquait exactement le symptôme. Corrigé.
- **Pas moyen de distribuer les points de compétence en montant de niveau** : les stats
  augmentaient automatiquement sans choix. Chaque niveau donne maintenant 5 points à
  distribuer soi-même, dans l'écran Personnage (bouton 🧍, qui s'illumine quand des points
  sont disponibles).
- **Joystick inversé gauche/droite** : corrigé (le calcul de direction tactile avait un signe
  inversé sur l'axe horizontal).


## V2.5 — Qualité visuelle (aucune fonctionnalité retirée, contrôles inchangés)
Tout est généré par le code (aucun fichier externe à télécharger), donc ça marche hors ligne
dans Termux. Réglage : **Pause → Paramètres → « Effets visuels V2.5 »** (activé par défaut).

- **Terrain** : texture de détail (herbe/grain/cailloux) à deux échelles pour casser la
  répétition, sous-bois plus sombres, prairies sèches, berges humides, ombrage des creux.
- **Végétation** : 6 espèces d'arbres (conifères, chênes, feuillus clairs, arbres d'automne,
  bouleaux, arbres morts) avec troncs ramifiés et feuillage en volumes lissés ; rochers
  déformés avec mousse ; buissons ; **herbe et fleurs** qui suivent le joueur (très léger) ;
  souches, troncs couchés, champignons, roseaux. Les arbres, l'herbe et les buissons
  ondulent dans le vent.
- **Village** : maisons à colombages avec toits à pignons texturés, cheminées (fumée), portes
  voûtées, volets, jardinières, enseigne de l'auberge, lampadaires lumineux la nuit,
  tonneaux, caisses, bottes de foin, bannières.
- **Personnages / PNJ / ennemis humanoïdes** : visage (yeux, nez, sourcils, oreilles), cheveux,
  gants, bottes, ceinture, tabard, genouillères, armes plus détaillées, cape à 2 segments.
  Animations : balancement au repos, contre-rotation en course, fentes d'attaque, tête stabilisée.
- **Monstres** : pelage nuancé, crinière, crocs, gueule qui s'ouvre à l'attaque, oreilles et
  queue articulées, griffes, yeux lumineux.
- **Ciel** : halo solaire, brume d'horizon, lune lumineuse, étoiles scintillantes, nuages
  cotonneux ; rendu « cinéma » (tonemapping ACES), reflets d'environnement (métaux et eau
  enfin brillants), léger vignettage.
- **Combat** : arcs de lame, ondes de choc, flashs d'impact, traînées magiques/flèches,
  cercles runiques, colonnes de soin, explosion de niveau supérieur, mort des monstres.
  Couleurs selon la classe et l'élément de la compétence.
- **Ombres blob** sous les personnages quand les ombres dynamiques sont coupées (qualité faible).

### Sécurités
- Chaque amélioration est protégée : en cas d'erreur, le jeu retombe sur l'apparence précédente
  (modèles V2, végétation V2, etc.) au lieu de planter.
- Si un shader V2.5 n'est pas compatible avec ton téléphone, le jeu le détecte, affiche un
  message et active le **mode compatible** au prochain lancement (shaders personnalisés coupés).
  Pour réessayer : effacer les données du site, ou en console `localStorage.removeItem('aetheria.v25.safe')`.
- Qualité « Très faible » : pas d'herbe dynamique, arbres allégés ; les effets de combat
  sont réduits automatiquement.
- Le changement du réglage V2.5 en jeu coupe tonemapping, reflets, effets, herbe et vignettage
  immédiatement ; terrain, arbres et village demandent un relancement de la page.



## V6.1 — Caméra façon Diablo 3, décor translucide, sons et torches retirés

- **Caméra fixe** (mode « Vue aérienne », par défaut) : angle et inclinaison verrouillés, plus aucune rotation ; le zoom (molette / pincement) reste possible dans une plage resserrée. Le mode « Libre (3ᵉ personne) » existe toujours dans les paramètres.
- **Décor translucide** : arbres, rochers, murs et toits qui se trouvent entre la caméra et le personnage s'estompent (tramage dans le shader, sans doublon ni coût notable) ; les ombres restent. Le héros, les PNJ et les monstres restent toujours visibles.
- **Bruits de pas supprimés.**
- **Torches supprimées** (ville et spires) : plus de flammes, de lumière vacillante ni de fumée.

## V6.0 — Multijoueur : amis, groupes, monstres partagés, spires à plusieurs

**Amis** (bouton 👥 ou `/friend add <compte>`) : demande d'ami par nom de COMPTE, acceptation/refus, liste avec présence (en ligne / hors ligne, personnage et niveau), invitation de groupe en un clic. Les amis sont enregistrés sur le serveur.

**Groupes** (jusqu'à 5) : invitation par ami, par joueur proche ou `/invite`; fenêtre Accepter/Refuser ; le chef (👑) peut exclure un membre ; chat de groupe et cadre de groupe inchangés.

**Monde partagé** : dans un groupe, vous combattez les MÊMES monstres et les MÊMES boss (monde ouvert, donjon, Gardien des Ruines, Souverain du Néant).
- Un membre « hôte » (le chef, ou le premier présent dans la zone) simule les monstres ; les autres voient des copies synchronisées (8 fois/s) et lui envoient leurs dégâts, états (étourdissement, poison…) et compétences.
- Les monstres choisissent la cible la plus proche ; flèches, sorts et attaques au sol des boss touchent chaque joueur chez lui.
- **Butin, or, XP et quêtes sont individuels** : chacun reçoit les siens (si on est à moins de 90 m), et ne voit que ses propres objets au sol.

**Failles / spires à plusieurs** : quand un membre entre dans une spire, les autres reçoivent « Rejoindre ? » (ou bouton dans 👥) et entrent dans la MÊME spire (même graine = même plan, mêmes packs, mêmes affixes). L'hôte de la spire simule les monstres ; le Gardien apparaît pour tous ; la progression et la victoire comptent pour tout le monde. Chacun garde ses coffres, sa chronologie et ses récompenses.

**Reste personnel** (volontairement) : coffres du monde, caravane, pluie d'astres, lutin trésor, banque, boutique.

**Serveur** : salons par groupe et par « salle » (monde ouvert / chaque spire), relais borné (types autorisés, taille et débit limités, hôte seul pour les instantanés), vérification de distance pour les dégâts reçus.

## V5.3 — Mise en ligne gratuite

- `npm run online` (Termux) : build + serveur + tunnel Cloudflare gratuit avec adresse HTTPS publique, sans compte ni hébergeur. Voir `DEPLOIEMENT.md`.

## V5.2 — Jeu en ligne

- Le jeu se joue sur un site : `npm run build` puis `npm start` sert le jeu **et** les comptes sur un seul port (WebSocket sur la même adresse).
- Sur un vrai domaine, un compte (identifiant + mot de passe ≥ 8 caractères) est obligatoire ; reconnexion automatique par jeton signé (14 jours).
- Sécurité : limites anti-abus, verrouillage après échecs, noms insensibles à la casse, entêtes CSP/HSTS, écriture atomique avec sauvegarde `.bak`.
- Fichiers de déploiement : `Dockerfile`, `render.yaml`, `fly.toml`, et le guide `DEPLOIEMENT.md` (HTTPS, disque persistant, variables).
- En développement (`npm run dev`, localhost) rien ne change : jeu sans compte obligatoire.

## V5.1 — Sons des compétences

- **151 compétences, chacune avec son identité sonore** (synthétisée, aucun fichier audio). Chaque compétence est classée par **élément** (feu, glace, foudre, arcane, néant, sacré, poison, sang, acier, terre, nature) et par **type** (mêlée, flèche, sort, soutien, bouclier, cri, déplacement, furtivité, téléportation) : 44 combinaisons de sons.
- **Au lancement** : frappes lourdes plus graves, coups multiples en rafale (Mille entailles, Tir rapide…), salves de flèches (Averse, Tempête…), sorts propres à chaque élément (rugissement du feu, carillon cristallin de la glace, crépitement de la foudre, chœur sacré, gouffre du néant, bouillonnement du poison), cris de guerre, boucliers et auras, bonds et téléportation.
- **À l'impact**, à l'endroit visé : explosion du feu, éclatement de verre de la glace, coup de tonnerre, onde sacrée, grondement de la terre, éclaboussure de poison… plus puissants pour les compétences de zone.
- L'attaque de base garde ses sons habituels.

## V5.0 — Qualité audio

- **Chaîne de sortie refaite** : filtre anti-infra-graves, légère chaleur dans les graves, compresseur plus doux puis **limiteur final** (plus de saturation quand beaucoup de sons se superposent).
- **Réverbération plus réaliste** : pré-délai, premières réflexions, queue stéréo décorrélée. Deux salles : **plein air** et **grande salle sombre** (donjon et Spires), avec fondu enchaîné automatique.
- **Écho de musique** (croche pointée, filtré) sur la harpe et la flûte : plus de profondeur.
- **Ducking** : la musique et les ambiances baissent brièvement sous les sons importants (niveau supérieur, quête, boss, fin de Spire, mort).
- **Vie basse (< 30 %)** : le son s'étouffe (filtre passe-bas) en plus des battements de cœur.
- **Coups plus nets** : transitoire sec + corps grave sur les coups et les critiques ; léger désaccord aléatoire pour que deux coups identiques ne sonnent jamais pareil.
- **Orages** : tonnerre lointain pendant les fortes pluies.

## V4.9 — Caravane en danger

- **Événement aléatoire** (toutes les 7 à 10 min en terrain découvert, hors ville / Spire) : une **caravane marchande** apparaît à ~40 m. Elle est signalée par un « ! » sur la mini-carte et un message.
- Elle **n'avance que si vous êtes à moins de 24 m et qu'aucun brigand ne rôde** près d'elle. **3 embuscades** (3, 4 puis 5 ennemis, adaptés au monde) se déclenchent à 25 %, 50 % et 75 % du trajet.
- Arrivée à bon port : XP, or et 2 objets au sol. Si vous vous éloignez de plus de 85 m pendant 35 s, elle repart sans vous (sans pénalité).
- Nouveaux succès (Escorteur, Garde de convoi) et défi **Escorte marchande** au Tableau des contrats.

## V4.8 — Succès

- **24 succès** (bouton 🏆 à côté du journal de quêtes) : monstres, champions, boss, coffres, pluies d'astres, roulades, consommables, butin, équipement, quêtes, niveaux. Chacun a une barre de progression et donne **XP + or** une seule fois.
- Les compteurs sont gardés **dans le navigateur, par personnage** (pas dans la sauvegarde serveur). Les succès de niveau déjà atteints à l'ouverture sont validés sans récompense.
- **Indication « E — Ouvrir le coffre »** (selon votre touche d'interaction) quand vous êtes à côté d'un coffre caché.

## V4.7 — Coffres au trésor

- **42 coffres cachés** dans le monde (22 dans les Prairies, 5 par monde corrompu / céleste / abyssal / primordial). Ils émettent des **étincelles dorées** quand vous êtes à moins de 30 m. Appuyez sur la touche d'interaction (E) à côté pour les ouvrir.
- Butin : 1 à 3 objets déposés au sol (rareté et niveau selon la zone), de l'or et de l'XP. **15 % sont piégés** : un cercle de danger apparaît sous vos pieds, écartez-vous (ou roulez).
- Les coffres ouverts le restent (sauvegardés, y compris sur le serveur).
- Nouveau défi au Tableau des contrats : **Chasseur de trésors**.

## V4.6 — Boss, météores et champions

- **Boss à zones de danger** : les boss (Gardien des Ruines, Souverain du Néant, gardiens de Spire) lancent des **cercles rouges au sol** qui explosent après ~1,5 s. Un pas de côté ou la roulade suffit à les éviter. Phase 1 : 1 cercle ; phase 2 : 3 ; phase 3 : 5 + une grande onde autour du boss.
- **Pluie d'astres** (événement) : toutes les 4 à 7 minutes en terrain découvert (pas en ville ni en Spire), des météores tombent autour de vous pendant ~15 s. Survivre **sans être touché** donne de l'XP, de l'or et un objet déposé au sol. Un message vous prévient.
- **Champions ★** (~6 % des monstres, titre doré) : Rapide, Colossal, Vampirique (se soigne en vous frappant) ou Blindé. Bien plus de PV, 3× l'XP, 2× l'or et 2,5× plus de chances de butin.
- Deux nouveaux défis au Tableau des contrats (par monde) : **Briseur de champions** et **Chasseur d'étoiles**.

## V4.5 — Monstres à distance

- **Archers** (flèches rapides) et **mages** (orbes lents, plus puissants) : ils s'arrêtent à distance, **reculent si vous approchez** et tirent des projectiles visibles. Les projectiles se **voient et s'esquivent** : en vous déplaçant, ou avec la **roulade** (invulnérable pendant la roulade).
- 10 nouveaux types : Archer des routes, Mage renégat (monde 1) et leurs versions corrompues / célestes / abyssales / primordiales (mondes 2 à 5, Spires comprises).
- Nouveaux contrats de chasse pour chacun (6 paliers), à prendre au Tableau des contrats.
- Maximum 24 projectiles simultanés pour rester fluide sur mobile.

## V4.4 — Bestiaire, butin et ambiance

**Monstres (17 nouveaux)** — chaque monde a désormais ses variantes, avec un comportement propre :
- **Rat géant** (petit, rapide, fragile — attaque en nuée) ;
- **Fanatique incendiaire** : **explose à sa mort** (dégâts si vous êtes à moins de ~3 m) ;
- **Troll des collines** : **régénère** ses PV s'il n'est pas touché pendant 3 s ;
- **Garde-route blindé** (monde 1) : **-30 % de dégâts subis** ;
- **Loup alpha** (monde 1, rare) : **entre en fureur** sous 35 % de PV (plus rapide, attaque plus vite).
Les rats, fanatiques et trolls existent en version corrompue / céleste / abyssale / primordiale (mondes 2 à 5) et apparaissent aussi dans les Spires.

**Butin**
- Nouvelles armes : hallebarde, cimeterre, marteau de guerre, arbalète, grimoire. Nouveaux accessoires : chevalière, talisman. **Épaulières et capes** peuvent maintenant tomber (ces emplacements n'avaient aucun butin).
- 4 nouveaux bonus d'objets : **vitesse de déplacement, expérience gagnée, or trouvé, récupération d'endurance**.
- 6 nouveaux effets spéciaux : Second souffle, Entraves de givre (ralentit), Siphon de mana, Nuée venimeuse (poison), Coup de tonnerre (étourdit), Lumière protectrice (brève invulnérabilité + soin).
- Plus de noms d'objets. Le serveur valide ces nouveautés (aucune perte à la sauvegarde).

**Quêtes secondaires** : un contrat de chasse par nouveau monstre (6 niveaux de difficulté chacun) + **25 défis** (5 par monde, Tableau des contrats) : roulades, consommables, butin ramassé, équipement, chasse aux élites.

**Graphismes** : poussière à chaque roulade, effet de gorgée (vert = vie, bleu = mana), **vignette rouge pulsée sous 30 % de PV** (suit l'option vignettage), explosion des fanatiques.
**Audio** : sons dédiés pour la roulade, la potion, les battements de cœur (vie basse), l'explosion, la fureur d'un monstre.

## V4.3 — Finitions

- **Repères sur la mini-carte** : un « ! » doré indique où aller pour l'étape en cours (PNJ à voir pour le tutoriel et pour remettre une quête, coffre de la ville, Statue de la Spire, marchand, objet à ramasser). Il reste accroché au bord de la carte quand la cible est loin.
- **Textes du tutoriel dynamiques** : les touches citées suivent vos réglages (« ZQSD », votre touche de roulade, de potion…).
- **Journal de quêtes** : la zone est plus haute, les textes d'étape ne sont plus coupés.
- **Options → Interface & jeu → « Revoir le tutoriel »** relance les 3 quêtes d'initiation (utile pour une ancienne sauvegarde).

## V4.2 — Menu Options complet et commandes personnalisables

Le menu **Options** (menu principal ou pause → Paramètres) passe en 5 onglets :
- **🎨 Graphismes** : préréglage de qualité (comme avant), **résolution de rendu** 40–100 %, **limiteur d'images/seconde** (30 / 45 / 60 / illimité), **distance de vue**, ombres, effets visuels, **herbe animée**, **densité des particules**, **luminosité**, **champ de vision**, **secousses d'écran**, vignettage, nombres de dégâts flottants, résolution adaptative, **compteur d'images/seconde**, plein écran au lancement, et le diagnostic (FPS, draw calls…).
- **🔊 Son** : couper tout le son, volume général, musique, effets, **ambiance** et **interface** (curseurs séparés).
- **⌨️ Clavier & souris** : **toutes les touches sont réassignables** (déplacements, roulade, sprint, accroupi, interagir, potions, les 10 compétences, inventaire, personnage, compétences, carte, chat, zoom, recentrage caméra) avec **2 touches par action**. Touchez une case puis appuyez sur la touche voulue (Échap annule, Retour arrière efface ; une touche déjà prise est reprise à l'autre action). Les lettres affichées suivent votre clavier (AZERTY, QWERTY…). Côté souris : bouton de rotation de la caméra (clic droit ou molette), **sensibilité**, inversion de l'axe vertical, **vitesse et sens du zoom**, type de caméra.
- **👆 Tactile** : contrôles Automatique / Toujours / Masqués, **taille du joystick**, **taille et opacité des boutons**, zone morte du joystick, **sensibilité** de la caméra et du pincement, **mode gaucher**, vibration, et **« Modifier la disposition »** : en jeu (menu pause → Paramètres), faites **glisser chaque bouton** (joystick, attaque, roulade, sprint, accroupi, interagir, caméra, potions) où vous voulez ; « Rétablir » remet la disposition d'origine.
- **🧭 Interface & jeu** : afficher/masquer le journal de quêtes, la mini-carte, les indications « E — … » et les notifications d'information ; ciblage automatique ; fréquence de la sauvegarde automatique ; **tout réinitialiser**.

Tous les réglages s'appliquent immédiatement et sont sauvegardés sur l'appareil. Les touches par défaut sont inchangées (ZQSD/WASD, Espace = roulade, V / B = potions, 1–0 = compétences…).

## V4.1 — Roulade et raccourcis de potions

- **Roulade à la place du saut** (Espace ou bouton 🌀) : esquive en avant (ou dans la direction où vous poussez le joystick / ZQSD), environ 5 m en 0,5 s, avec un tour complet du corps animé, **0,4 s d'invulnérabilité**, coût 10 d'endurance et 0,9 s de récupération. Elle se déclenche à l'appui (rester appuyé ne répète pas). Le tutoriel a une étape « roulade » au lieu du saut.
- **Deux boutons raccourcis** au-dessus de la barre de compétences : 🧪 **potion de vie** (touche **V**) et 🔷 **potion de mana** (touche **B**), avec le nombre de potions restantes. Le jeu choisit la potion la plus adaptée (la plus petite qui suffit, sinon la plus grosse), refuse si PV / mana déjà pleins, et applique 0,9 s de délai entre deux potions.

## V4.0 — Tutoriel, départ minimaliste, objets au sol, équipement visible

- **Départ minimaliste** : un nouveau personnage commence avec **sa seule arme de classe, équipée** (plus de bouclier ni de potions d'office). Correction au passage : à la création, l'équipement de départ n'était en réalité jamais donné.
- **3 quêtes de tutoriel** qui s'enchaînent toutes seules à la création du personnage (« Initiation : premiers pas », « le combat », « la ville de Korvalune ») : marcher, caméra, roulade, parler au garde (il offre 3 potions et pose une armure au sol), ramasser, inventaire, équiper, fiche du personnage, compétences, lancer un sort, tuer des loups, boire une potion, jeter / ramasser un objet, carte du monde, marchand, coffre, Statue de la Spire, parler à Hugo. Chaque étape est validée quand vous faites l'action ; récompenses d'XP et d'or à la fin de chaque quête, puis « Le commencement » prend le relais. Les anciennes sauvegardes ne reçoivent pas le tutoriel.
- **Panneau « Équipé »** dans l'**inventaire** et dans le **coffre** : les 11 emplacements d'équipement sont toujours visibles ; toucher un objet équipé le remet dans l'inventaire.
- **« Jeter » pose réellement l'objet par terre**, devant vous (modèle, lueur et nom visibles) ; on le ramasse avec E. Les objets jetés ne disparaissent pas avec la limite de butin et sont **conservés dans la sauvegarde locale**. Ramasser avec un inventaire plein laisse maintenant l'objet au sol au lieu de le perdre.

## V3.9 — Coffre réparé et noms 100 % originaux

- **Coffre de la ville** : les objets générés (équipement à affixes) déposés dans le coffre disparaissaient au lieu d'apparaître ; le transfert coffre ⇄ inventaire fonctionne maintenant pour tous les objets, avec gestion des cas « inventaire plein » / « coffre plein » (rien n'est perdu).
- **Propriété intellectuelle** : tout le vocabulaire qui rappelait de trop près un autre jeu a été remplacé par des noms propres à Korvalune — *Failles de Nephalem* → **Spires d'Éther** (modes **Ascension** et **Zénith**), pylônes → **obélisques**, sanctuaires → **totems**, gemmes → **cristaux**, Gloire → **Ferveur d'éther**, éclats de sang → **poussière d'éther**, gobelin au trésor → **lutin pillard**, coffre maudit → **coffre piégé**, « Vue Diablo » → **Vue aérienne**, affixes d'élites et quelques noms de compétences (Blizzard, Singularité, Vengeance, Consécration, Météore…) renommés. Les mécaniques de jeu restent les mêmes.
- Les anciennes sauvegardes (V3.7/V3.8) sont converties automatiquement (clés, cristaux, records, spire ouverte, réglage de caméra).
- Note : ce nettoyage porte sur les noms et textes. Pour une commercialisation, faites aussi vérifier le jeu par un professionnel (recherche de marques, textes, musiques, ressources externes) : je ne suis pas juriste.

## V3.8 — Caméra aérienne, 30 compétences par classe, course corrigée

**Caméra aérienne (par défaut)** : vue de dessus inclinée, centrée sur le héros.
- **Zoom / dézoom** : molette de la souris, **pincement à deux doigts** sur mobile, ou touches `+` / `−`.
- **Pivoter la vue** : clic droit + glisser (PC) ou glisser un doigt sur l'écran (mobile) ; le bouton 🔒 remet l'angle et le zoom par défaut.
- Réglage **Paramètres → Caméra** : « Vue aérienne » ou « Libre (3ᵉ personne) ». La caméra libre a été corrigée (elle était placée sous la tête du personnage et son verrouillage tournait dans le mauvais sens).
- Les déplacements (ZQSD / joystick) et les autres commandes ne changent pas.

**Course corrigée** : sur les pentes, le personnage passait brièvement en « pose de saut » à chaque pas (course saccadée / bizarre) ; il reste maintenant collé au sol et la pose en l'air n'apparaît qu'après un vrai saut. Le verrouillage de caméra ne fait plus tourner en rond quand on se déplace sur le côté.

**30 compétences par classe** (Guerrier, Paladin, Mage, Archer, Assassin), du niveau 1 au niveau 200 — 95 nouvelles compétences avec de vrais effets :
étourdissement, ralentissement, poison / brûlure / saignement, vulnérabilité, vol de vie, exécution (bonus sous un seuil de PV), coups multiples, repoussement / attraction, bonds et charges, téléportation, boucliers, invulnérabilité, régénération, **améliorations temporaires (buffs)** affichées au-dessus de la barre de compétences, et **zones persistantes au sol** (terre bénie, tourmente glaciale, pluie de feu, piège enflammé, peste noire…). Certaines compétences existantes gagnent aussi un effet (Coup de bouclier étourdit, Lame empoisonnée empoisonne, Séisme étourdit, Nova de givre ralentit…).
L'écran **Compétences (K)** détaille les effets de chacune ; la barre reste à 10 emplacements (touches 1 à 0) : choisissez votre équipement de compétences. Une notification annonce chaque nouvelle compétence débloquée.

## V3.7 — Les Spires d'Éther

**Où ?** Sur la place de Korvalune, côté ouest près de l'entrée sud : la **Statue de la Spire**. Approche-toi et appuie sur **E** (même bouton d'interaction qu'avant) pour ouvrir l'écran de la spire. Les contrôles ne changent pas.

**Modes**
- **Ascension** (coûte 1 sceau de spire) : pas de limite de temps, remplis la jauge de progression.
- **Zénith** (coûte 1 sceau du zénith) : **15:00** de chrono, monstres plus durs, meilleures récompenses, pas de totems. Sert à améliorer tes cristaux.
- **Entraînement** (gratuit) : chrono, sans récompense, pour tester un niveau.

**Niveaux 1 à 200** au choix (−10 / −1 / +1 / +10, curseur, préréglages). Le niveau des monstres = niveau de la spire ; l'ambiance change selon la profondeur.

**Mécaniques**
- Donjon généré au hasard à chaque ouverture, salle du gardien la plus éloignée.
- **Jauge de progression** : monstres normaux, champions, chefs et sbires comptent différemment ; à 100 % apparaît le **Gardien de la spire**.
- Packs élites avec affixes partagés (véloce, titanesque, sangsue, ardent, hérissé, enragé).
- Perles de vie, **orbes de Ferveur d'éther** (cumul jusqu'à 5, 30 s), 5 **obélisques** (force, foudre, focalisation, égide, vélocité), 4 **totems** (rage, garde, savoir, opulence), coffre piégé, lutin pillard, points de contrôle et compteur de morts.
- **Sceaux** : drops en monde (élites et lutins surtout), achat chez la statue, forge de 3 sceaux de spire → 1 sceau du zénith.
- **5 cristaux permanents** (Force, Vigueur, Célérité, Férocité, Savoir) améliorés après un Zénith selon ta rapidité (≤5 min +3, ≤10 min +2, ≤15 min +1).
- **Poussière d'éther** et jeu de hasard chez la marchande de la statue ; records et historique.
- Une spire ouverte reste sauvegardée ; quitter la spire te ramène en ville.

## V3.6 — Audio immersif

Tout est synthétisé en direct (aucun fichier son) :
- **Moteur** : bus séparés (effets, interface, ambiance, musique), compresseur, réverbération générée, sons **spatialisés** (un ennemi à gauche s'entend à gauche, le volume baisse avec la distance).
- **Combat** : épée, arc (corde + flèche), sort de mage, coups critiques, impacts propres à chaque arme, cris et attaques des monstres, mort, soin.
- **Monde** : pas selon le sol (pierre/herbe), saut/atterrissage, tonnerre lié aux éclairs, ambiances vent / pluie / fontaine / jour / nuit (oiseaux, grillons, hibou, loup, cloche).
- **Musique générative** : ambiance différente en ville, de jour, de nuit et en combat (percussions), qui se fond automatiquement quand on approche des ennemis.
- **Interface** : sons de clic, ouverture/fermeture des menus, butin, pièces, équipement, portails, zones.
- **Options** : curseurs Volume général, Musique et Effets sonores.
- Le son se débloque au premier toucher (exigence des navigateurs) : la musique démarre dès le menu.

## V3.5 — Plein écran et fluidité

- **Plein écran** : bouton ⛶ en haut à droite du menu principal, bouton « Plein écran » dans le menu pause, et réglage « Plein écran au lancement » (activé par défaut sur téléphone : le jeu passe en plein écran en touchant Nouvelle partie / Continuer, et verrouille le mode paysage quand le navigateur le permet).
- **Fluidité** : qualité « Moyenne » par défaut sur téléphone (au lieu d'Élevée), **résolution adaptative** (le jeu baisse tout seul la résolution de rendu si les images par seconde chutent, puis la remonte quand ça va mieux ; en dernier recours il coupe les ombres), HUD mis à jour ~15 fois par seconde au lieu de 60. Réglable dans Paramètres.

## V3.4 — Mini-carte, menus refaits, aperçu du personnage

- **Mini-carte** : la flèche pointait à l'envers, c'est corrigé. La carte tourne maintenant avec vous (la flèche regarde toujours en haut) avec cône de vision, points cardinaux N/E/S/O, lunette de laiton, nom de la zone, PNJ (losanges dorés), ennemis (points rouges) et portails (accrochés au bord quand ils sont loin). Bouton 🧭 : carte fixe (nord en haut). Toucher la carte : zoom 45 / 70 / 110 m. Dessin limité à ~30 images/s pour ménager le téléphone.
- **Création du personnage** : l'aperçu 3D est enfin visible (reflets d'environnement pour les armures métalliques, éclairage à 3 points, socle lumineux), on peut le faire tourner au doigt. Choix de teint (5 nuances par race), conservé dans la sauvegarde (locale et serveur) et appliqué au personnage en jeu. Le bouton « Commencer » est toujours visible.
- **Tous les menus** redessinés : menu de lancement (ciel étoilé, montagnes, sigil d'éther), compte, crédits, pause, paramètres, mort, inventaire, personnage (équipement + statistiques en deux blocs), boutique, coffre, contrats, fiche d'objet, carte du monde (zones des mondes, ville, flèche du joueur).
- **Compétences** : cartes avec icône, description, recharge / coût / dégâts, et état (Dans la barre, Disponible, Niveau requis). Barre d'aperçu plus lisible.
- **HUD** : panneaux plus lisibles sans flou (plus fluide sur Android), quêtes à gauche pour libérer le côté des boutons tactiles, horloge/pièces compactes. Les contrôles ne changent pas.

## V3.3 — Bâton de mage, grande ville, loups niveau 1, portails

**Bâton de mage (même traitement que l'arc)**
- Nouveau modèle : fût noueux effilé, poignée en cuir à bagues dorées, embout d'acier, collier doré à 4 griffes courbes enserrant un **cristal allongé** ; 3 orbes en orbite, 2 anneaux d'énergie et halo lumineux.
- En course ou au repos le bâton se porte **à la verticale**. En incantation, il se lève vers la cible, le cristal **se charge** (orbes plus rapides, halo qui grossit) jusqu'au lâcher ; pour les sorts de zone, bâton levé au-dessus de la tête puis abaissé vers la cible.
- **Vrais projectiles magiques** : orbes en comète (noyau, halo, traînée) tirées depuis le cristal, dégâts à l'arrivée. Météore et Tempête élémentaire font tomber des boules depuis le ciel, Éclair en chaîne saute de cible en cible, Nova de givre projette des éclats en cercle, Oubli lance une grosse sphère du néant avec colonne de lumière à l'impact.
- Portées augmentées : Trait de feu 13, Vague arcanique 14, Trait du néant 15, Dévastation arcanique 16 ; zones : Nova 6, Météore 9, Éclair en chaîne 9, Tempête 10, Oubli 11. Un sort ciblé ne touche qu'une cible (la verrouillée). Le verrouillage automatique du mage passe à 17 m.

**Ville agrandie (Korvalune)**
- Rayon plat de la ville : 24 → 52 m. Enceinte de **remparts** crénelés avec 4 tours d'angle, **porte sud** avec bannières et torches, **grande place pavée** autour du puits.
- 10 nouvelles maisons (quartiers ouest et est, rue du sud, deux bâtiments de guilde), tonneaux, caisses, plus de lampadaires.
- Le **quartier des portails** est au nord : une plateforme pavée avec les 4 portails alignés (étiquette « nom du monde — niv. requis » au-dessus de chacun), au lieu d'être alignés sur le côté.
- PNJ mieux répartis : le garde à la porte sud, Hugo à l'accueil, Sébastien dans le quartier ouest, Morgane dans le quartier est, Laurine devant l'auberge ; marchands autour de la place, banque près du puits. La route devient droite dans la ville.

**Loups niveau 1 autour de la ville**
- 34 loups niveau 1 répartis en couronne à 58–92 m du centre ; les autres ennemis commencent plus loin (au-delà de 64 m) et leur niveau grimpe progressivement avec la distance.

## V3.2 — Arc réaliste, flèches de loin, finitions

**Arc (archer)**
- Nouveau modèle d'arc : branches courbes effilées avec pointes recourbées, poignée en cuir avec bagues dorées, repose-flèche, corde avec pontage. La corde et les branches **se déforment réellement** quand l'arc est bandé.
- L'arc se tient désormais dans la **main gauche** (bras tendu), la **main droite tend la corde** jusqu'à la joue, comme un vrai archer droitier. Les poses des bras sont calculées par cinématique inverse ; l'arc s'oriente toujours de la main gauche vers la main droite, donc la corde suit toujours la main.
- Flèche encochée visible pendant la tension (fût, pointe en acier, plumes, encoche), vibration de la corde au lâcher, léger recul du bras d'arc, tête tournée vers la cible.
- Au repos ou en course l'arc est porté verticalement le long du bras. Le bouclier est masqué quand un arc est porté.

**Flèches de plus loin**
- Portées des compétences d'archer fortement augmentées : Tir rapide 15, Tir puissant 17, Flèche perforante 19, Marque du chasseur 17, Œil de la mort 21 ; compétences de zone (rayon autour de l'archer) : Tir multiple 8, Pluie de flèches 9, Barrage 9, Volée du ciel déchu 11. Une flèche ciblée ne touche plus qu'un seul ennemi (la cible verrouillée) pour garder l'équilibre ; seule la Flèche perforante en traverse jusqu'à 4.
- Le verrouillage automatique de cible de l'archer passe de 11 à 20 mètres (les autres classes ne changent pas).
- **De vraies flèches** volent maintenant de l'arc à la cible (trajectoire balistique, traînée lumineuse, flèche plantée un instant) ; les dégâts sont appliqués **à l'arrivée de la flèche**. Tir multiple = éventail de 5 flèches, Flèche perforante traverse la cible, Barrage = salve rapide, Pluie de flèches / Volée céleste = une flèche monte puis une pluie retombe sur chaque ennemi.
- Si les effets V2.5 sont désactivés (Options), les flèches visibles disparaissent et les dégâts redeviennent instantanés (comportement d'avant).

**Finitions**
- Faisceau de lumière + cercle au sol sur le butin rare (rareté 6 et plus) pour le repérer de loin.
- Âmes lumineuses qui s'élèvent à la mort des ennemis (plus nombreuses et dorées pour les boss).
- Le champ de vision s'élargit légèrement en course (sensation de vitesse).

## V3.1 — Animations et effets (sans aucun téléchargement)
- **Animations à articulations** : coudes et genoux (cycle de course naturel, pied toujours posé au sol),
  attaques propres à chaque arme (épée en diagonale, dague en double estoc, bâton qui lance un sort,
  arc qui se bande puis relâche), frappes lourdes avec impact au sol, buffs bras écartés, atterrissage
  qui écrase, inclinaison dans les virages, coup reçu qui secoue, mort en deux temps (genoux puis chute).
- **Monstres** : se cabrent avant de mordre, reniflent au repos, reculent quand on les frappe.
- **Impact** : traînée lumineuse de l'arme, arrêt sur image très bref, léger zoom de caméra,
  recul des ennemis touchés.
- **Ambiance** : lucioles la nuit, poussières de lumière le jour, poussière de course, éclaboussures dans l'eau.
- **Portails** : vortex tournant, anneaux d'énergie, étincelles en orbite.
Les modèles GLB (V3) restent optionnels : sans fichier dans public/models, rien ne change.

## V3 — Modèles 3D animés (GLB)
Pour de vrais personnages et monstres modélisés avec squelette, dépose des fichiers `.glb`
dans `public/models/` (voir `public/models/LISEZMOI.txt` : packs gratuits CC0 KayKit et
Quaternius, mots-clés de nom de fichier, `mapping.json`). Le jeu les détecte au lancement
et joue les animations du pack : repos, marche, course (cadence liée à la vitesse), attaque
(durée calée sur la compétence), réaction aux coups, mort. Sans fichier, ou si un modèle
échoue, le jeu garde les modèles procéduraux V2.5.
- Import rapide dans Termux : `bash tools/import-models.sh ~/storage/downloads` (décompresse
  les zip trouvés et copie tous les .glb).
- Les modèles GLB ne montrent pas l'équipement changeant (le personnage garde son apparence).

## Les 6 étapes prévues sont maintenant toutes là
Si vous voulez aller plus loin, quelques pistes qui n'étaient pas dans le découpage en 6 étapes
d'origine mais qui figurent dans le cahier des charges complet, ou qui renforceraient le
prototype :
- **Artisanat** (forge/alchimie/cuisine) — pas implémenté, dites-moi si vous le voulez
- **Combat réellement sécurisé côté serveur** : aujourd'hui chaque client calcule ses propres
  dégâts/XP/butin (voir la note de sécurité en haut) ; les rendre autoritaires côté serveur
  demanderait de dupliquer une bonne partie du moteur de jeu là-bas — un chantier conséquent
- **Monde vraiment partagé** : ennemis, butin et événements synchronisés entre tous les
  joueurs d'une même zone (aujourd'hui, seule la présence des joueurs est partagée)
- Davantage de zones/donjons/quêtes, vrais modèles 3D (GLB/GLTF) à la place des modèles
  procéduraux, fichiers audio réels à la place des sons synthétisés
- HTTPS/WSS et vraie base de données pour un déploiement au-delà d'un usage local (voir
  section 6)

Dites-moi ce qui vous intéresse et on continue.

## V6.2 — Armes attitrées, archer à la mana, tirs plus longs, moins de pluie
- **Archer** : toutes ses compétences consomment désormais de la **mana** (réserve de base 120 au lieu de 60, + 3,5 mana/s de régénération en plus).
- **Frappe de base à l'arc / à l'arbalète** : portée de 16 m (au lieu de ~4 m).
- **Armes attitrées** : les compétences personnelles d'une classe ne fonctionnent qu'avec une arme de sa famille ; sinon un message « Arme requise : … » s'affiche. La frappe de base reste utilisable avec n'importe quelle arme.
  - Guerrier : épée, hache, masse, lance, hallebarde, cimeterre, marteau de guerre
  - Paladin : épée, masse, marteau de guerre, lance, hallebarde
  - Mage : bâton, baguette, grimoire
  - Archer : arc, arbalète
  - Assassin : dague, cimeterre
- Les flèches / projectiles magiques dépendent de l'arme réellement tenue (plus de flèches avec une baguette).
- **Météo** : pluie bien plus rare (≈7 % des changements contre 28 %), moins intense, jamais deux fois de suite, et changements de météo plus espacés.
- Le script `npm run online` écrit son journal dans `~/aetheria-tunnel.log` (Termux n'a pas accès à /tmp).

## V6.3 — Joueurs sur les cartes, ciblage au plus proche, jours longs, musiques variées, drops
- **Cartes** : les joueurs connectés apparaissent sur la mini-carte et la carte du monde (nom + niveau) ; les membres du groupe en vert (toujours visibles, accrochés au bord de la mini-carte), les autres en bleu clair.
- **Ciblage auto** : l'ennemi le plus proche est toujours ciblé, même si tu avais commencé à en attaquer un lointain (un tap manuel garde la cible 2,5 s).
- **Jour/nuit** : cycle de 13 min ; le jour dure environ 7 min et la nuit passe ~2,6x plus vite (≈2 min 15).
- **Musique** : 4 à 6 variantes par ambiance (tonalité, gamme, tempo, progression, timbre), tirées au hasard à chaque nouveau morceau (16 à 28 mesures), jamais deux fois la même d'affilée.
- **Drops** : la rareté 25 (Absolu) a 1 % de chance par objet généré ; les 24 autres décroissent proportionnellement (rareté 1 ≈ 10 %, rareté 13 ≈ 3 %). Les boss gardent un bonus de rareté. Réglage : `TOP_TIER_CHANCE` dans `src/data/rarities.js`.

## V6.4 — Courbe de butin façon Diablo 3
- Nouvelle courbe de rareté (sans décalage) : raretés 1-3 ≈ 53 %, 4-7 ≈ 22 %, 8-12 ≈ 10 %, 13-24 ≈ 13 % (≈ 1,0 à 1,25 % chacune), 25 (Absolu) = 1 %. Commun ≈ 25 %, Épique ≈ 1,6 %.
- Les boss / coffres / lutin trésor gardent leur bonus de rareté (courbe décalée vers le haut).
- Réglage : tableau `BASE_PCT` dans `src/data/rarities.js`.

## V6.5 — 6 raretés façon Diablo 3/4, nouvelles failles, butin plus spectaculaire
- **Raretés réduites à 6** : Commun (gris/blanc), Magique (bleu), Rare (jaune), Légendaire (orange), Mythique (violet), Absolu (arc-en-ciel). Chance par objet (ennemi normal) : 48 / 30 / 15 / 4,5 / 1,5 / 1 %. Les boss, coffres, lutin trésor et gardiens de faille décalent la courbe vers le haut.
- Les anciens objets des sauvegardes (ancien système 1-25) sont **convertis automatiquement** dans la classe correspondante, leurs statistiques ne changent pas.
- Chaque rareté : plus de bonus aléatoires ; Légendaire / Mythique / Absolu ont toujours au moins 1 / 2 / 3 effets spéciaux.
- Butin au sol : faisceau lumineux plus haut et à deux couleurs pour le Légendaire et au-dessus, faisceau arc-en-ciel animé pour l'Absolu, annonce à l'écran + alerte sonore reconnaissable (fanfare légendaire / fanfare absolue), lueur colorée dans l'inventaire.
- **Failles (spires) refaites** : 5 environnements — Crypte, Ruines à ciel ouvert, Caverne, Cimetière hanté, Fournaise (lave) — choisis selon le monde et la graine (identiques pour tout le groupe). Grille 6×6, couloirs sinueux et culs-de-sac, salles variées (anneau de colonnes, rangées, gravats), brèches dans les ruines, plus de salles (18 en Ascension, 15 en Zénith).

## V7.0 — Le continent (plus de portails, une seule grande carte)

- **Un seul continent** : les petits portails de la ville sont supprimés. Chaque région se rejoint à pied par de vraies **routes** qui partent de Korvalune (sud → Montagnes de Fer → Royaume Céleste, ouest → Forêt des Ombres → Abysses Oubliées, est → Terres Corrompues, sud-est → Néant Primordial).
- **Relief et décor propres à chaque région** : prairies vallonnées, forêt dense sombre, montagnes enneigées, terres corrompues (cristaux violets), royaume céleste (colonnes de marbre dorées), abysses (lave, obsidienne), néant (pylônes de basalte, roches flottantes).
- **18 points d'intérêt** (moulin, menhirs, forteresse naine, tour de guet, obélisque corrompu, arche dorée, temple en ruine, gueule de lave, monolithe du Néant…), visibles sur la carte du monde.
- **Niveaux recommandés** par région affichés à l'entrée, avec un avertissement si vous êtes trop faible.
- Faune par biome dans les régions de départ. La ville est conservée. Les sauvegardes et comptes (dossier `data/`) ne sont pas touchés.

## V7.1 — Sets d'équipement par classe

- **15 sets** (3 par classe : Guerrier, Paladin, Mage, Archer, Assassin), **6 pièces** chacun : arme, casque, épaulières, plastron, gants, bottes. Niveaux d'accès 6 / 35 / 90.
- **Bonus à 2, 4 et 6 pièces** portées (pièces distinctes). Le bonus à 6 pièces ajoute un **effet spécial** propre à la classe (ex. Fracas du Titan, Châtiment sacré, Pluie d'étoiles, Volée perçante, Lame muette).
- Les pièces de set sont **vertes** (rareté « Set », faisceau vert) et ne tombent que pour **votre classe** : environ 4 objets Légendaire ou mieux sur 10. La fiche d'objet affiche les pièces portées et les bonus actifs.
- Correctif : les affixes en pourcentage (critique, réduction des dégâts…) étaient arrondis à +100 % ; ils ont maintenant leur vraie valeur (les anciens objets sont recalculés).

## V7.2 — Butin adapté à la classe, critique non augmentable par les points

- La **Chance** (points de stats) n'augmente plus la chance de coup critique : elle ne fait plus monter que les dégâts critiques. Le critique vient de l'équipement et des effets.
- **Butin adapté à votre classe** : ~90 % des armes qui tombent sont de votre famille (mage : bâton, orbe, grimoire…), les accessoires favorisent les stats utiles, et les affixes de stats principales inutiles à votre classe n'apparaissent plus.

## V7.3 — Un attribut principal par classe

- Chaque classe a un **attribut principal** qui augmente ses dégâts : Guerrier et Paladin → Force, Mage → Intelligence, Archer et Assassin → Agilité. Les deux autres attributs offensifs comptent 4× moins.
- Sous chaque attribut de la fiche personnage, une ligne dit à quoi il sert et pour quelles classes ; l'attribut principal de votre classe est marqué ⭐.

## V7.4 — Butin 100 % de votre classe, fin des à-coups à la mort d'un monstre

- **100 % de butin de votre classe** : armes uniquement de vos familles, accessoires uniquement avec des attributs utiles à votre classe, et plus aucun bonus de Force/Agilité/Intelligence d'une autre classe sur les objets.
- **Fluidité** : les objets au sol n'ajoutent plus de lumière dynamique (cause des saccades à chaque drop/ramassage : three.js recompilait tous les shaders de la scène) ; les étiquettes de noms sont mises en cache ; les shaders et textures du butin et des effets de combat sont pré-chauffés au chargement.

## V10.10 — Écurie : chevaux et griffons

- Catalogue partagé `src/data/mounts.js` (5 montures, prix en **pièces d'or**, niveau requis, vitesse). Modèles 3D en boîtes (`src/visual/MountModel.js`).
- PNJ « Maître d'écurie Bram » en (20, 18) avec un cheval et un griffon en exposition ; achat et choix de la monture active dans l'écran Écurie.
- Bouton 🐎 (et touche H, réassignable dans Options) : monter/descendre. Vitesse = course × 0,8 × multiplicateur de la monture. Cheval : au sol (on en descend pour attaquer). Griffon : altitude de croisière (4,8 m), survole eau/falaises/obstacles, atterrissage progressif refusé au-dessus de l'eau ; compétences bloquées en vol ; roulade désactivée à cheval ; interdit dans les spires.
- Persistance par personnage (`mounts`, `mountSel` dans la sauvegarde, identifiants validés côté serveur) ; la monture en cours (`mnt`) est diffusée aux autres joueurs.
- Limite : comme les pièces, la possession est gérée par la sauvegarde du client (le serveur ne valide que les identifiants).

## V10.9 — Échanges d'objets

- Protocole (serveur = chef d'orchestre) : `trade:invite` → `trade:invited` → `trade:accept` → `trade:open`/`trade:state` ; offres `trade:offer` (6 objets max, validés par `sanitizeItemSlots`), `trade:confirm` ; quand les deux ont confirmé : `trade:exec` → chaque client vérifie qu'il possède ses objets et a la place (`trade:ack`) → `trade:final` (les deux appliquent). Un seul refus ou une déconnexion annule tout (`trade:end`).
- Toute modification d'offre annule les confirmations ; échange expiré après 10 min d'inactivité ; les deux joueurs doivent être connectés à un compte.
- Objets uniquement (jamais de pièces, de Lunes ni de cosmétiques). L'inventaire reste géré côté client (comme le reste du jeu) : le serveur valide la forme des objets, pas leur provenance.

## V10.8 — Messages entre amis

- La liste d'amis (par compte, avec statut en ligne) existait déjà ; ajout des **messages privés** : `friend:msg` / `friend:history` (client→serveur), `dm` / `dmHistory` (serveur→client).
- Stockage dans `acc.dm` (40 derniers messages par ami, compteur de non lus), réservé aux amis réciproques, limité en débit, supprimé quand on retire l'ami.
- Interface : bouton « ✉️ Message » (avec badge) dans le menu Amis, écran `#dm-screen`, pastille rouge sur 👥.
- Correctif : un message de chat reçu depuis le menu principal (avant la partie) ne provoque plus d'erreur.

## V10.7 — Affichage, son, réglages sur le compte

- Mise en page téléphone paysage (`max-height: 460px`) : menu principal compact, bouton plein écran en haut à gauche, rangée de boutons de jeu limitée avant la mini-carte (2 lignes si besoin), barre de boss et verrou de caméra décalés.
- Son : bus d'ambiance 0,8 → 0,4, vent/oiseaux/grillons plus discrets, réglage « Ambiance » par défaut 60 %, et surtout `ambVol`/`uiVol` appliqués dès le démarrage (avant, seuls musique et effets l'étaient).
- Réglages : sauvegardés aussi sur le compte (`settings:save` / message `settings`, 12 Ko max, limité en débit) — les réglages du compte priment à la connexion ; sans réglages serveur, ceux de l'appareil sont envoyés.

## V10.6 — Mises à jour automatiques

- `src/core/UpdateCheck.js` : toutes les 3 min (et au retour sur l'onglet), le jeu relit `index.html` et compare le nom du fichier `assets/index-XXXX.js` avec celui chargé. S'ils diffèrent, un bandeau « Mettre à jour » apparaît ; le clic sauvegarde la partie puis recharge. Rien n'est rechargé de force.
- `index.html` est servi en `no-cache` : un simple rechargement récupère toujours la dernière version. Inactif en mode développement.

## V10.5 — Menu de la boutique

- Bouton « 🌙 Boutique des Lunes » dans le **menu principal** (connexion requise) et dans le **menu pause**, en plus de la pastille violette « Boutique » (🌙 + libellé) sur l'écran de jeu.
- Ouverte depuis le menu principal, la boutique se referme vers le menu principal ; l'aperçu « Essayer » est masqué (pas de personnage en jeu).

## V10.4 — Lunes plus rares

- Gains réduits : **15 Lunes** à la création du compte (avant 50), **3 par jour** (avant 20), **2 Lunes tous les 5 niveaux** (avant 3 par niveau). Un joueur gratuit gagne environ 90 Lunes par mois ; les objets coûtent de 30 à 400 Lunes, les ailes et auras prismatiques demandent plusieurs mois.
- Réglages dans `src/data/shopCatalog.js` (`LUNES`) ; les prix du catalogue sont inchangés.
- Les soldes et achats déjà faits sont conservés.

## V10.3 — Nouveautés en jeu + pages légales

- **Page « Nouveautés »** (notes de mise à jour) accessible depuis le menu principal (carte avec pastille « Nouveau ») et depuis la page de connexion. Contenu : `src/data/patchNotes.js` — pour publier une nouveauté, ajouter une entrée **en haut** de la liste.
- **CGV réécrites** selon votre choix : pas de droit de rétractation (consentement exprès à la livraison immédiate, art. L221-28 13° du Code de la consommation) et achats ni échangeables ni remboursables. Elles réservent les droits que la loi ne permet pas d'écarter (non-livraison, double débit, défaut de conformité).
- Les pages `public/legal/*.html` gardent des champs jaunes `[À COMPLÉTER]` pour vos informations personnelles (nom, SIRET, adresse, e-mail, médiateur…) : je ne peux pas les inventer. **À faire relire avant d'ouvrir les paiements.**
- Case de consentement du paiement mise à jour (lien vers les CGV, « ni échangeables ni remboursables »).

## V10.2 — Paiements préparés (désactivés par défaut)

- **Achat de Lunes par carte** via Stripe Checkout (page de paiement hébergée par Stripe : le jeu ne voit jamais la carte). Section « Acheter des Lunes » dans la boutique 🌙, visible **uniquement** si le serveur a `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et `PUBLIC_URL`.
- Crédit **uniquement** par webhook signé, vérification pack/devise/montant, idempotent, journal par compte, consentement exprès (case obligatoire) avec renoncement au droit de rétractation.
- Modèles de **CGV, confidentialité et mentions légales** dans `public/legal/` (champs jaunes à compléter, à faire relire).
- **Guide complet** : `STRIPE.md`. Prix des packs = exemples dans `server/payments.js`.
- Testé avec un faux serveur Stripe local et des événements signés simulés ; **pas** avec un vrai compte Stripe.

## V10.1 — Boutique des Lunes (cosmétiques + confort, sans argent réel)

Nouveau bouton 🌙 dans la barre latérale du jeu (connexion à un compte requise).

- **Monnaie : les Lunes.** 50 offertes à la création du compte, **+20 par jour** (récompense du jour), **+3 par nouveau niveau** (record du compte : créer d'autres personnages ne rapporte rien de plus).
- **Catalogue (22 objets)** : 5 auras d'arme (visibles même sur une arme commune), 4 cercles au sol, 4 traînées, 3 ailes, 4 titres (affichés au-dessus du nom pour les autres joueurs), 4 onglets de coffre supplémentaires (+30 emplacements chacun, jusqu'à 240).
- **Aucune puissance vendue** : tout est visuel ou confort.
- **Essayer** : aperçu temporaire sur votre personnage avant d'acheter (annulé à la fermeture).
- **Visible par les autres joueurs** : cercle, traînée, ailes et titre sont diffusés par le serveur (jamais envoyés par le client).
- **Sécurité** : le serveur est la seule source de vérité (solde, achats, prix, prérequis, équipement). Les identifiants sont validés contre le catalogue ; la taille du coffre est plafonnée côté serveur selon les onglets réellement achetés.
- Fichiers : `src/data/shopCatalog.js` (catalogue partagé), `server/shop.js`, `src/visual/Cosmetics.js`, écran dans `src/ui/HUD.js`.

**Pas encore fait (volontairement)** : aucun paiement en argent réel. Pour vendre des Lunes il faudra un prestataire de paiement (ex. Stripe) avec validation côté serveur par webhook, des CGU/CGV, la politique de confidentialité (RGPD), le droit de rétractation pour biens numériques et un statut d'entrepreneur. À faire avec un juriste/expert-comptable avant d'ouvrir les achats.

## V10.0 — Nouveau nom : Korvalune

- Le jeu s'appelle désormais **Korvalune** (nom inventé : aucune occurrence trouvée dans mes recherches web de jeux, studios et marques — ce n'est PAS une garantie juridique : fais une recherche officielle et envisage un dépôt de marque avant toute commercialisation).
- Remplacé partout où le joueur le voit : titre, écran d'accueil, crédits, ville, région « Prairies de Korvalune », quêtes, PNJ, succès, objets, messages serveur, titre de la page.
- Retiré toute mention d'autres jeux dans l'interface (« façon Diablo ») et dans les commentaires du code.
- Conservés volontairement (invisibles pour les joueurs) : clés internes de sauvegarde du navigateur (`aetheria.*`), dossier `aetheria/` du zip, noms du service et du disque sur Render/Fly (renommer demanderait de recréer le service). Les sauvegardes existantes restent donc lisibles.
- Reste à faire de ton côté : renommer le dépôt GitHub et recréer le service Render si tu veux une adresse `…korvalune…onrender.com`.


## V9.5 — Mise en ligne permanente (Fly.io)

- `npm run deploy` (ou `bash tools/deploy-fly.sh`) : installe l'outil Fly.io, te connecte, crée l'app, le disque de sauvegarde et le secret, construit à distance (pas de Docker nécessaire, marche depuis Termux) et affiche l'adresse fixe `https://<nom>.fly.dev` à donner aux joueurs. Comptes et personnages sont conservés d'une mise à jour à l'autre.
- Prérequis : un compte Fly.io avec carte bancaire (≈ 2-5 $ / mois). Même procédure pour mettre à jour : relancer la commande.
- **Non testé** : je n'ai pas accès à Fly.io depuis mon environnement ; le script a seulement été vérifié syntaxiquement. Si une étape échoue, envoie-moi le message d'erreur.
- Alternative : `render.yaml` (Render, plan payant pour le disque persistant) ou n'importe quel serveur avec le `Dockerfile`.


## V9.4 — Auras d'armes selon la rareté

L'arme tenue (épée, dague, bâton, arc) s'entoure d'une aura qui dépend de sa rareté :
- Commun : aucune · **Magique** : lueur bleue discrète, quelques étincelles · **Rare** : lueur jaune plus vive · **Légendaire** : lueur ambrée, braises qui montent · **Mythique** : aura violette pulsante, étincelles en spirale · **Absolu** : aura prismatique aux couleurs changeantes, la plus grande.
- Aucune lumière dynamique (matériaux additifs + quelques étincelles) : coût négligeable sur mobile. L'aura change en direct quand tu équipes une autre arme.
- Testé (headless) : les 6 raretés s'affichent et se distinguent, aucune erreur. Non testé : rendu sur ton téléphone. Les auras ne sont visibles que sur ton personnage (les autres joueurs ne partagent pas encore leur arme équipée).


## V9.3 — Rendu réaliste (première passe)

Nouvelle option **Options → Rendu réaliste** (activée par défaut) :
- soleil plus bas et plus doré → ombres plus longues et plus marquées, ciel moins plat ;
- contre-jour bleuté sans ombre (détache les silhouettes des personnages) et rebond de lumière chaude du sol ;
- étalonnage des couleurs (contraste, saturation) à partir de la qualité Moyenne ; désactivé en Faible/Très faible pour garder la fluidité ;
- détails au sol : ~1 500 cailloux, ~600 brindilles sèches, quelques ossements (petits objets instanciés, sans collision, par blocs masqués hors champ).
Aucune nouvelle source de lumière dynamique (pas de PointLight) pour rester fluide sur mobile. Décocher l'option rend l'ancien rendu à l'identique.
- Testé (headless, rendu logiciel) : aucune erreur, captures avant/après cohérentes. Non testé : fluidité sur ton téléphone — dis-moi si ça ralentit, je règle l'intensité.


## V9.2 — Structures reliées au sol

- Mesure automatique de toutes les structures (repères, portiques de frontière, ville, coffres, portails) : chaque structure repose maintenant sur le point le plus bas de son emprise, rien ne flotte.
- Corrigés : toit de la ferme qui flottait au-dessus de la maison, cristal central des obélisques décollé du sol, faisceaux lumineux des repères qui démarraient 8 m au-dessus du sol, forteresse construite au bord de l'eau (déplacée sur terre ferme, les repères ne sont plus placés au bord de l'eau).
- Restent volontairement suspendus : orbes et flammes animées, marqueur de quête du PNJ, bannières accrochées aux portiques.
- Non testé : rendu sur appareil réel.

## V9.1 — Terrain plat

- Le relief du continent est aplati (variation < 0,5 m, pente max sur terre ≈ 0,2 hors rivage) : fini les falaises, marches et blocages de collision liés au terrain. L'océan, les lacs, rivières et le littoral sont conservés, ainsi que tous les décors, régions, portails et monstres.
- Réversible : `CONFIG.world.flat` dans `src/core/config.js` (mettre `false` pour retrouver l'ancien relief).
- Testé (headless) : les 10 régions se chargent sans erreur, niveaux des monstres corrects, joueur posé au sol partout.
- Non testé : ressenti sur appareil réel.

## V9.0 — Ramassage automatique

- Nouvelle option **Options → Ramassage automatique du butin** : Désactivé (par défaut, touche d'interaction comme avant), Consommables seulement, ou Tout le butin proche. Un objet toutes les ~0,35 s dans un rayon de 2 m, jamais pendant un menu ou un dialogue, et rien n'est tenté si l'inventaire est plein (pas de messages en rafale).
- Testé en conditions réelles (headless) : 25 monstres tués → butin → ramassage auto → 14 objets en inventaire, aucun objet invalide ; sauvegarde → rechargement → « Continuer » : données identiques, aucune erreur.
- Non testé : confort sur appareil tactile réel.

## V8.9 — Audit complet

Audit du code (analyse statique), du jeu lancé pour de vrai (démarrage, régions, menus, caméras, qualités graphiques), des données (drops, quêtes, PNJ) et de la validation serveur.

- **Correctif serveur** : en ligne, les pièces de set perdaient `setId`/`setPiece` à la sauvegarde (donc plus de bonus de set). Corrigé.
- **Correctif serveur** : les affixes en % étaient plafonnés à 1 alors que le générateur peut dépasser 3 aux hauts niveaux → les objets étaient silencieusement affaiblis. Plafond relevé.
- Vérifié : 7 860 objets générés passent la validation serveur sans aucune modification.
- Non testé ici : `server.js` (module `ws` indisponible dans l'environnement de test), performances sur appareil réel.

## V8.8 — Collisions complètes
- **Audit objet par objet** : chaque objet solide visible (bâtiments, piliers, stèles, poteaux, bancs…) est comparé à ses collisions. Résultat : 21 éléments que l'on traversait (piliers des cercles de pierre, poteaux d'autels, bancs de temples…) → **corrigés** (collision automatique) ; 0 mur invisible.
- **Corps contre corps** : on ne traverse plus les monstres, les boss ni les PNJ ; les monstres ne s'empilent plus les uns sur les autres. La roulade et la ruée passent toujours à travers.
- Vérifié par simulation : routes, régions et ville toujours entièrement praticables après ces changements.

## V8.7 — Anti-blocage et audit de la carte
- **Anti-blocage** : si le joueur se retrouve dans l'eau ou hors du terrain (ancienne sauvegarde posée en mer, téléportation, bug), il est automatiquement remis sur la terre ferme la plus proche.
- **Apparition des monstres** : plus de monstres dans un arbre, un rocher, l'eau ou sur une falaise.
- Audit par simulation : tous les PNJ, la banque, le portail, la statue des spires et l'apparition sont accessibles en ville (0 zone isolée) ; les 4 routes qui sortent de la ville sont ouvertes.

## V8.6 — Collisions corrigées
- **Sol = maillage affiché** : la hauteur du sol suit exactement le terrain visible (interpolation triangle par triangle). Avant, la hauteur « analytique » différait du relief affiché et formait des **marches** le long des routes : pieds qui flottent/s'enfoncent, saccades, accrochages. (Plus rapide aussi.)
- **Eau, bord du monde et falaises** bloquent désormais le joueur (il pouvait marcher dans l'océan et escalader les parois quasi verticales) ; il **glisse** le long de l'obstacle au lieu de s'arrêter net.
- **Arbres invisibles** : en qualité Moyenne/Faible, les arbres masqués gardaient leur collision (murs invisibles). Un arbre masqué n'a plus de collision.
- **Rochers et décors de région** : le rayon de collision est maintenant proportionnel à la taille réelle de chaque élément (gros rochers, piliers, cristaux…).
- **Obstacles** : résolution en plusieurs passes (plus de tremblement quand plusieurs obstacles se touchent) ; les **ennemis** contournent au lieu de rester coincés contre un arbre.
- Vérifié par simulation : les 7 routes sont praticables de bout en bout et les 10 régions sont accessibles à pied.

## V8.5 — Faisceaux de loot distincts
- Les halos de lumière ne se confondent plus : **Légendaire** = fine colonne marron clair ; **Mythique** = large colonne violette avec cœur lumineux ; **Absolu** = colonne arc-en-ciel épaisse et très haute. (Le mélange additif saturait tout en blanc.)

## V8.4 — 5 personnages par compte, coffre partagé, visage amélioré
- **Compte** : jusqu'à **5 personnages** par compte. « Continuer » / « Nouvelle partie » (une fois connecté) ouvre l'écran **Tes personnages** : Jouer, Supprimer (avec confirmation) ou créer dans un emplacement libre. Pour changer de personnage : menu pause → Quitter (la partie est sauvegardée), puis choisir un autre emplacement.
- **Coffre partagé** : le coffre de la banque est commun à tous les personnages du compte (échange d'objets entre personnages).
- **Migration automatique** : ton personnage existant devient le personnage n°1 et son coffre devient le coffre partagé. Rien n'est perdu.
- **Création** : choix de la couleur des cheveux (9) et des yeux (6).
- **Visage et cheveux** : yeux (anneau d'iris, reflets, cils, paupières), sourcils arqués, nez, lèvres avec arc de Cupidon et léger sourire ; cheveux en mèches texturées avec frange balayée, volume et mèches latérales.
- **Légendaire** : couleur marron clair (étiquettes, rayons de loot).
- Si deux appareils jouent en même temps sur le même compte, le dernier enregistrement du coffre l'emporte : joue un personnage à la fois.

## V8.3 — Caméras, rotation et visage détaillé
- **Options → Clavier & souris → Caméra** : 5 modes — Aérienne fixe (défaut), Libre, Épaule (3ᵉ personne rapprochée), Tactique (aérienne haute) et Vue de dessus.
- **Rotation de la caméra** : Auto (comportement habituel de chaque caméra), Activée (clic droit / glisser pour tourner, y compris sur les vues aériennes) ou Désactivée (caméra figée).
- **Personnage** : visage détaillé (yeux avec iris, pupille, reflet, paupières et cils, sourcils, nez, narines, lèvres, joues, pommettes, menton, oreilles), coiffure en mèches, col, bretelles de cuir, gants plus détaillés. Valable pour le joueur, les PNJ et les humanoïdes.

## V8.2 — Portail des régions
- Un **portail unique** au quartier des portails (nord de la ville). En interagissant, un menu liste les 10 régions avec le niveau des monstres (ex. Prairies niv. 1–12 … Néant niv. 150–200).
- Voyage **gratuit**, sans niveau requis. Les routes restent utilisables à pied.

## V8.0 — Le grand continent

- **Un vrai continent** entouré d'océan, au littoral irrégulier, découpé en **10 régions aux frontières irrégulières** (plus de ronds) : Prairies de Korvalune (1-12), Forêt des Ombres (10-24), Montagnes de Fer (15-32), Désert d'Ambre (28-50), Marais de Brume (40-65), Toundra de Givre (55-80), Terres Corrompues (75-105), Royaume Céleste (100-130), Abysses Oubliées (125-160), Néant Primordial (150-200).
- Chaque région a son relief, ses couleurs, son décor et sa faune propre (3 nouvelles familles de monstres : sables, marais, givre). Dans une région, plus on s'éloigne de Korvalune, plus les monstres montent en niveau.
- **Portiques de frontière** sur les routes : le nom de la nouvelle région et sa tranche de niveaux. Les frontières sont aussi tracées sur la carte du monde.
- **34 lieux remarquables** : ils apparaissent sur la carte (avec leur nom) une fois découverts (« Lieu découvert »).
- Les anciennes sauvegardes posées en mer repartent de Korvalune.
- **Objets limités au niveau 200.**
- **Raretés vraiment rares** (par objet, hors bonus de boss) : Commun 66 %, Magique 27 %, Rare 5,8 %, Légendaire 1 %, Mythique 0,1 %, Absolu 0,006 % (≈ 1 pour 16 000 objets). Les effets visuels des raretés basses sont calmés : pas de faisceau sous Rare, faisceau fin pour Rare, gros faisceau et halo seulement à partir de Légendaire.

## V10.11 — Application Android (APK)
- Nouveau dossier `android-app/` (WebView plein écran, écran toujours allumé, paysage, retour = Échap).
- Compilation automatique par GitHub Actions, APK publié dans *Releases* (`apk-latest`).
- Non testé sur un vrai téléphone au moment de l'écriture ; l'APK n'a pas pu être compilé dans le bac à sable.

## V10.13 — Événement Halloween
Un événement saisonnier (du 9 octobre au 1er novembre 2026 ; boutique de Jack ouverte jusqu'au 4 novembre). Les dates sont dans `src/data/halloween.js` (`EVENT`) : l'événement démarre et s'arrête tout seul, rien à faire.
- **Ambiance** : ciel violet/orange et lune orangée (`DayNight.mood`), ~90 citrouilles lumineuses (instances), fantômes et chauves-souris (`src/world/Halloween.js`).
- **Jack Tête-de-Citrouille** (PNJ à côté du puits, tête de citrouille sculptée en 3D) : boutique en **bonbons**. 11 cosmétiques d'événement (aura, cercle, traînée, ailes, titre) ; ils sont dans `CATALOG_BY_ID` mais pas dans la boutique des Lunes, et restent possédés après l'événement.
- **Bonbons, côté serveur** (`server/event.js`, messages `event:*`) : 14 bonbons cachés (2 🍬, distance vérifiée par le serveur, renouvelés chaque jour UTC, +10 si tous), sac quotidien (+8), monstres de l'événement (plafond de 120 🍬/jour, 1 victoire déclarée max toutes les 0,7 s), défi « 25 monstres » (+10), Roi Citrouille (+30, hors plafond), classement top 10.
- **Monstres** (`enemies.json`, préfixe `hw_`) : squelette, citrouille rampante, spectre, loup-garou, sorcière (à distance), Roi Citrouille. Générés autour du joueur connecté (3 à 5 à la fois, une horde de 7 toutes les 6 min, le Roi 3 min après la connexion puis toutes les 12 min). Ils sont locaux à chaque joueur (non partagés en groupe).
- Le puits de la place : l'eau était cachée sous le rebord, elle est maintenant visible.
- Limites connues : les monstres d'événement ne sont pas synchronisés entre joueurs ; le serveur ne peut pas vérifier qu'un monstre a vraiment été tué (d'où les plafonds) ; modèles en géométrie procédurale (pas de modèles 3D réalistes).

## V10.14 — Ville sûre, boutique de Jack qui défile, mini-carte illustrée
- Les monstres d'Halloween n'apparaissent jamais en ville (zone ±38 m, apparition interdite à ±42 m) et disparaissent quand le joueur y entre (`inTown` dans `src/world/Halloween.js`).
- `#halloween-screen` avait été oublié dans la liste des écrans de `style.css` (pas de défilement) : corrigé.
- Mini-carte : petites images (`extra.icons`, construit par `Game._mapIcons()`) pour armes, armures, potions, écurie, barbier, banque, statue des spires, Jack, coffres non ouverts, boss, gobelin trésor (pulsant, accroché au bord), Roi Citrouille ; bonbons en petits points. La grande carte montre coffres/boss/gobelin/événement et une légende.
- Les emoji dépendent de la police du téléphone (Android : Noto Color Emoji, aucun souci attendu) ; non vérifié sur un vrai téléphone.

## V10.15 — Garde-robe : cosmétiques liés au compte

- Les cosmétiques (Lunes et Halloween) ne sont pas des objets d'inventaire : ils sont liés au compte, ni vendables, ni échangeables.
- Le serveur retire tout identifiant cosmétique des sauvegardes d'inventaire/banque et des offres d'échange (`noCosmetics` dans `server.js`).
- Inventaire : section « 🎨 Cosmétiques », un toucher équipe, un second retire (message `shop:equip` existant).

## V10.16 — Musiques d'Halloween et affiche de l'événement

- Nouvelle ambiance `halloween` dans `AudioManager` (5 variantes + base, gammes harmonique/phrygienne, cloches, grave, vent) ; active pendant l'événement hors combat (`setEnvironment({ hw })`).
- Affiche SVG + dates (calculées depuis `EVENT` dans `src/data/halloween.js`) sur le menu principal ; disparaît après la fin de la boutique.

## V10.20 — Compétences en mouvement, potions, équilibrage

- `Player.update` : pendant un lancer de compétence (`casting`), le déplacement reste actif (direction de visée conservée, `_moveAng`) ; la roulade et les ruées imposent toujours l'immobilité.
- Potions : temps de recharge réduit à 120 ms, répétition de touche autorisée.
- Équilibrage : `hpScale = 1 + (L/80)·0,8`, `dmgScale = 1 + L/400`, défense en pourcentage `def / (def + 6·niveau + 60)` (plafond 75 %).
- Runes : 6 % par monstre, coffres du monde (60 % de rune + matériaux).

## V10.19 — Forge, Monolithe des Métamorphoses, mystique

- **Données** (`src/data/crafting.js`, partagées client/serveur) : 5 matériaux, 14 runes (bonus arme/armure/bijou), 10 litanies, plafonds d'emplacements par pièce, durabilité par rareté, tous les coûts.
- **Logique** (`src/crafting/Crafting.js`) : fonctions pures sur `{player, inventory, equipment, bus}`, **transactionnelles** (inventaire plein → tout est annulé). Réparation, emplacements, sertissage, démantèlement, enchantement (tirage puis choix), apparence (teinte/forme), refonte, élévation, panoplie, libération de niveau, pouvoirs liés (`player.cubePowers`, sauvegardés dans `cube`), fusion/gravure de runes, distillation, usure en jeu (`wearGear`).
- **Objets générés** : champs optionnels `sockets`, `gems`, `dur`, `ench`, `free`, `tmog` (validés et bornés par `server/itemValidate.js`; pouvoirs liés par `sanitizeCubePowers`). Un objet brisé (`dur` = 0) n'apporte plus de bonus (`Equipment.apply`).
- **PNJ** : forgeronne Helga (`workshop: 'forge'`), Monolithe (`model: 'monolith'`, `src/world/Monolith.js`), mystique Vaelis. Interface : `src/ui/Workshop.js`.
- **Butin** : runes (rang selon le niveau) et matériaux sur monstres, boss, coffres et lutin trésor.
- **Halloween** : les monstres d'événement apparaissent autour du joueur partout hors ville (plus de limite de 90 m autour de la ville).

## V10.18 — Difficulté, équilibrage, eau et lignes de vue

- **Difficulté** (`src/data/difficulty.js`, partagé client/serveur) : 8 paliers (Normal → Tourment IV) avec multiplicateurs de PV/dégâts des monstres et d'or/XP/chance de drop/rareté du butin. Changement en ville uniquement ; enregistré dans la sauvegarde (`difficulty`, validé 0..7 par `sanitizeSave`).
- **Eau** : `World.terrainOk/canStep(…, mode)` ; `Player.moveMode` = `'fly'` (griffons), `'swim'` (chevaux sur l'eau, vitesse ×0.7) ; `_ensureOnLand` respecte le mode.
- **Lignes de vue** : `World.losBlocked` (boîtes uniquement, les arbres/rochers ne bloquent pas) utilisée par l'auto-ciblage, les attaques du joueur et des monstres et les projectiles.
- **Équilibrage** : `scaledEnemyStats` (durcissement par niveau × difficulté), défense en pourcentage plafonnée à 80 %.
- **Butin** : niveau d'objet = niveau du joueur + 0..5 (`setLootLevel`, `rollItemLevel`).
- **Quêtes** : `src/data/discoveryQuests.js` (quêtes de découverte), panneau de quêtes défilant.
- **Performance** : en caméra libre/proche, `Game._cullFar` masque les groupes lointains et le brouillard est raccourci (≈ 780 appels de dessin au lieu de 1650 sur le point de mesure).

## V10.17 — Compagnons, skins, boutiques élargies

- Nouveaux emplacements cosmétiques `pet` et `skin` (`COSMETIC_SLOTS`), visibles des autres joueurs via `publicCos`. Rendu dans `src/visual/Cosmetics.js` (`buildPet`/`updatePet`, `applySkin`/`restoreSkin`, accessoires de tête).
- Catalogue Lunes : 25 → 91 objets ; Halloween : 11 → 38. `unlock: { level }` / `{ hwBoss }` : offerts automatiquement par `ensureShop` (jamais achetables : refusés par `shop:buy` et `event:buy`).
- Correctif : la boutique partageait la limite de messages d'amis (8 / 10 s) et ignorait des équipements rapides ; elle a sa propre limite (30 / 10 s).
