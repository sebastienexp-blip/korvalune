# Korvalune — Audit graphique et stratégie de migration vers de vraies ressources 3D (GLB)

*Étapes 1 et 2 du plan de refonte. Aucune donnée de jeu n'est touchée ; version de référence sauvegardée : commit `e4c80b2` (V10.40) sur `main`, tag local `sauvegarde-V10.40`.*

## 1. Inventaire : ce qui est aujourd'hui dessiné par code

Mesuré dans `src/` (≈ 25 600 lignes) : **plus de 500 constructions de formes** (`BoxGeometry`, `SphereGeometry`, `CylinderGeometry`…) réparties dans 40 fichiers.

| Domaine | Fichiers principaux (constructions de formes) | Ce qui est affiché | À remplacer par |
|---|---|---|---|
| Personnages jouables + PNJ | `entities/HumanoidModel.js` (90), `HumanoidLegacy.js` (32), `visual/HairStyles.js` (13), `ui/CharPreview.js` | humanoïde assemblé de formes, 5 classes, 29 PNJ, coiffures | modèles animés + squelette commun, coiffures et tenues en pièces séparées |
| Équipement / apparences | `visual/Cosmetics.js` (83), `entities/Staff.js` (12), `Bow.js` (14), `visual/WeaponAura.js` | armes, ailes, auras, traînées, anneaux, coiffes | armes/armures en GLB séparés, accrochés aux points d'attache de la main/du dos |
| Monstres et boss | `entities/CreatureModel.js` (13), `CreatureLegacy.js` (5), `Boss.js`, `Enemy.js` | **97 monstres** répartis en 14 espèces (loup, sanglier, bandit, élite, ours, brute, gobelin, rôdeur, alpha, garde, fanatique, troll, archer, mage) + variantes corrompues/abyssales/Halloween, 1 boss principal + boss de faille | un modèle de base par espèce animé, variantes par teinte/accessoires |
| Montures | `visual/MountModel.js`, `data/mounts.js` | 3 chevaux, 2 griffons | 2 modèles animés (cheval, griffon) + variantes de couleur |
| Ville de Korvalune | `world/Town.js` (121), `TownPortal.js`, `Portals.js`, `BarberDecor.js`, `Caravan.js` | château, 4 portes, quartiers, maisons, marché, fontaine, décor | bâtiments modulaires |
| Nature et monde | `visual/Foliage.js` (27), `world/World.js` (30), `GrassField.js` | pins, chênes, bouleaux, arbres morts, rochers, buissons, herbes, fleurs, champignons, souches, roseaux | arbres/rochers/plantes en GLB instanciés |
| Points d'intérêt | `world/Landmarks.js` (23), `Monolith.js` (16), `DungeonRuins.js` (7), `WorldChests.js`, `rift/RiftStatue.js` (17), `RiftLayout.js` (15) | monolithes, ruines, coffres, statues, arène de faille | pièces de donjon/ruines + statues |
| Halloween | `world/Halloween.js` (13) | citrouilles, décors saisonniers | pack Halloween |
| Effets de sorts | `visual/Fx.js`, `combat/SkillEffects.js`, `Arrows.js`, `EnemyProjectiles.js`, `GroundHazards.js`, `effects/*` | particules, projectiles, zones au sol | **conservés** (effets visuels dynamiques) mais avec textures réelles |
| Cinématique d'intro | `ui/IntroCinematic.js` (23) | scène 3D de lancement | refaite en dernier avec les nouveaux modèles |
| Terrain, ciel, météo | `world/World.js`, `DayNight.js`, `effects/Weather.js` | terrain par bruit, cycle jour/nuit, pluie/neige | **conservés** (logique technique) ; textures de sol réelles à ajouter |

**Données de jeu à ne pas casser** (lues telles quelles par le moteur) : 97 monstres (`enemies.json`, champ `species`), 29 PNJ (`npcs.json`, champ `look`), 92 objets, 194 compétences, 5 montures, ~47 apparences.

## 2. Architecture 3D retenue

- **Moteur : on garde Three.js.** Pas de migration vers Babylon.js : le jeu repose déjà sur Three.js (terrain, combat, multijoueur, tactile). Changer de moteur obligerait à réécrire les ≈ 25 000 lignes sans bénéfice.
- **Le chargeur GLB existe déjà** (`visual/ModelLibrary.js`, V3) : association rôle → fichier, squelette + clips, repli automatique sur le modèle procédural si un fichier manque. La migration consiste donc à **fournir des fichiers et des tables d'association**, pas à réécrire le moteur — ce qui garde le gameplay intact.
- **Lacunes du chargeur à combler** (petits chantiers) :
  1. équipement : un modèle GLB n'affiche aujourd'hui ni arme, ni armure, ni cape, ni coiffure → ajouter les points d'attache (main droite/gauche, dos) et le montage de pièces GLB ;
  2. instanciation (`InstancedMesh`) pour arbres, rochers, bâtiments répétés ;
  3. niveaux de détail (LOD) : version allégée des personnages pour les foules ;
  4. chargement progressif par zone + libération mémoire ; textures compressées (KTX2/Basis) en dernière étape d'optimisation ;
  5. correspondance de noms d'animations (les packs ont leurs propres noms).
- **Organisation des fichiers** : `public/models/{characters,creatures,mounts,weapons,armor,buildings,nature,props,dungeon}/` + `public/models/registry.json` (provenance, licence, auteur, conditions de chaque fichier — comme pour l'audio).
- **Migration en lots, jamais d'un bloc** : chaque lot est activé par mapping ; en cas de problème, retirer une ligne rétablit l'ancien rendu.

## 3. Sources de ressources — ce qui est réellement disponible ici

L'environnement n'a ni Blender, ni accès général à Internet, mais **GitHub est accessible**. Deux voies, combinables :

**A. Générateur maison** (`tools/models/`, déjà fonctionnel) — 100 % original, identité « dark fantasy corbeau & lune », tout reproductible. Limite : modélisation par script, donc stylisée et lente à produire en quantité (un personnage ≈ une journée de réglages).

**B. Packs CC0 (domaine public, usage commercial autorisé, licence vérifiée dans les fichiers livrés)** de Kay Lousberg (KayKit), clonés depuis GitHub :

| Pack | Contenu réel vérifié | Licence |
|---|---|---|
| Character Pack Adventures 1.0 | 5 personnages (Knight, Barbarian, Mage, Rogue, Rogue_Hooded), 7 000 triangles chacun, squelette 41 os, **76 animations** partagées (marche, course, attaques 1M/2M/double, lancer de sorts, blocage, esquive, mort, coup reçu, saut, assis…), armes/boucliers séparés | CC0 |
| Character Pack Skeletons 1.0 | 4 squelettes animés (Warrior, Mage, Rogue, Minion) | CC0 |
| Dungeon Remastered 1.0 | 203 pièces de donjon (murs, sols, colonnes, escaliers, torches, coffres, mobilier…) | CC0 |
| Medieval Hexagon Pack 1.0 | 221 pièces (châteaux, maisons, taverne, forge, église, tours, moulins, arbres…) | CC0 |
| Halloween Bits 1.0 | 63 pièces (tombes, citrouilles, crypte, arbres morts, lanternes…) | CC0 |

**Lacunes que ces packs ne couvrent pas** : loups, sangliers, ours, trolls, gobelins, araignées, chevaux, griffons, dragons et boss. Ceux-là devraient être modélisés avec le générateur maison (voie A) ou cherchés dans d'autres packs CC0 (non encore vérifiés).

## 4. Décision de direction artistique (bloquante pour la suite)

Les packs KayKit sont de vrais modèles propres et animés, mais en style **cartoon « chibi »** (grosses têtes, couleurs vives, formes arrondies). Le Veilleur déjà produit est en proportions réalistes et sombres. **Mélanger les deux casserait la cohérence demandée.** Trois voies :

1. **Tout original, style sombre réaliste** (génération maison) : cohérence totale, 100 % à Korvalune, mais production plus lente et rendu plus brut.
2. **Hybride cartoon sombre** : packs CC0 retexturés en palette dark fantasy pour tout ce qui est décor/bâtiments/donjons (peu sensible au style), et générateur maison pour personnages/monstres/montures avec proportions réalistes.
3. **Packs CC0 tels quels pour tout ce qui existe** (rapide, mais look cartoon, pas dark fantasy).

## 4 bis. Décision prise : tout original, sombre réaliste
Les packs CC0 ne sont donc **pas** utilisés pour les personnages ni les monstres. Ils restent une option pour les décors si tu le décides plus tard. Toutes les ressources du Lot 1 sont générées par `tools/models/` (aucune ressource externe, aucune licence tierce).

## 5. Lots de migration proposés (après la décision ci-dessus)

1. **Lot 0 (fait)** : prototype d'un personnage animé dans une zone de test (`modeltest.html`).
2. **Lot 1** : équipement séparé (points d'attache) + arme + armure + chargement progressif ; monstre de base (loup) animé ; zone de test avec collisions.
3. **Lot 2** : les 5 classes jouables + coiffures + tenues.
4. **Lot 3** : espèces de monstres (14) + variantes ; boss.
5. **Lot 4** : montures.
6. **Lot 5** : nature (arbres, rochers, plantes) instanciée.
7. **Lot 6** : ville de Korvalune, puis donjons/failles, ruines, statues, Halloween.
8. **Lot 7** : textures de terrain, effets de sorts, cinématique, optimisation finale (LOD, KTX2).

Chaque lot : test des systèmes (combat, collisions, quêtes, inventaire, montures, multijoueur), mesure de performance, puis seulement activation.

## 6. État d'avancement

**Lot 0 (fait)** — Veilleur de Corvalune (humanoïde), 27 os, 8 animations.
**Lot 1 (fait, en prototype, non branché au jeu principal)** :
- *Loup des Cendres* (`creatures/loup_des_cendres.glb`) : 29 os, 6 animations (idle, walk, run, attack, hit, death), ~12 000 triangles, 1,6 Mo.
- *Lame de la Veille* (`armes/lame_de_la_veille.glb`) : arme statique, ~3 300 triangles, 0,6 Mo, métadonnées d'accroche (`Socket_Weapon_R`).
- *Armure en pièces séparées* (`veilleur/veilleur_{casque,epaules,torse,bras,jambes,cape}.glb`) + corps animé (`veilleur_corps.glb`) : même squelette, textures partagées (`veilleur/tex/`, 1,9 Mo), 0,1 à 0,4 Mo par pièce.
- Moteur : `visual/GlbEquipment.js` (poser une arme, lier une pièce au squelette, retirer), `ModelLibrary` lit la hauteur de référence du corps.
- Zone de test `modeltest.html` : héros équipé contre le loup (IA minimale), collisions, retrait/remise des pièces en direct.

**Mesures** (rendu logiciel dans Chromium, donc non représentatif d'un téléphone) : 28 appels de dessin et ~59 000 triangles pour héros + loup + décor de test ; chargement des 11 fichiers en 5,8 s en local.

**Reste à faire avant d'activer dans le jeu** : (1) brancher l'équipement réel (`Player`/inventaire) sur `GlbEquipment` ; (2) version allégée du héros (LOD) — 43 000 triangles est trop pour une foule ; (3) correspondance des 97 monstres (variantes de teinte/échelle du loup) ; (4) tester sur téléphone.
