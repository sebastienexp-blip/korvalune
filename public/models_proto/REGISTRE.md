# Registre des ressources 3D (prototype)

Toutes ces ressources ont été **créées pour Korvalune** par les scripts de `tools/models/` : aucune ressource tierce, aucune licence externe.
Droits : propriété du projet Korvalune.

| Fichier | Contenu | Triangles | Animations | Os |
|---|---|---|---|---|
| `corvalune_veilleur.glb` | héros complet en un seul fichier (équipement intégré) | 43 000 | 8 | 27 |
| `veilleur/veilleur_corps.glb` | corps nu du héros | 6 900 | 8 | 27 |
| `veilleur/veilleur_{casque,epaules,torse,bras,jambes,cape}.glb` | pièces d'armure (même squelette) | 1 900 à 9 600 | – | 27 |
| `veilleur/tex/*` | textures partagées (acier, cuir, drap, argent lunaire) | – | – | – |
| `creatures/loup_des_cendres.glb` | loup hostile | 12 100 | 6 | 29 |
| `armes/lame_de_la_veille.glb` | épée | 3 300 | – | – |
| `armes/dague_du_veilleur.glb`, `dague_gauche.glb` | dague (main droite / gauche) | 1 968 | – | – |
| `armes/baton_de_la_veille.glb` | bâton | 3 232 | – | – |
| `armes/arc_de_la_veille.glb` | arc | 2 064 | – | – |
| `armes/ecu_de_la_veille.glb` | bouclier | 4 292 | – | – |
| `armes/orbe_de_la_veille.glb` | orbe | 1 272 | – | – |
| `armes/carquois.glb` | carquois | 2 044 | – | – |
| `veilleur/veilleur_lod1.glb`, `veilleur_lod2.glb` | héros allégé | 12 629 / 6 129 | oui (8 clips) | 27 os |

Régénération : voir `tools/models/README.md`.

## Ennemis humanoïdes (Lot 3)
Tous originaux, générés par `tools/models/build_foes.py` (aucune ressource tierce). Fichiers : `ennemis/ennemi_{bandit,elite,zealot,mage,archer,brute,troll,goblin}.glb`, textures de peau et d'os dans `ennemis/tex/`, textures d'acier/cuir/drap/argent partagées avec `veilleur/tex/`.

## Bêtes (Lot 3)
Originales, générées par `tools/models/build_beasts.py` : `creatures/bete_{boar,bear,skitter,alpha}.glb`, textures `creatures/tex/` (pelage et os). Le loup (`creatures/loup_des_cendres.glb`) a été régénéré avec les métadonnées d'espèce.

## Montures (Lot 4)
Originales : `montures/monture_cheval.glb` (14 780 tri, 29 os) et `montures/monture_griffon.glb` (17 416 tri, 35 os), textures `montures/tex/` (poil neutre teintable, cuir, drap, argent). Générées par `tools/models/build_horse.py` et `build_griffon.py`. Le héros embarque l'animation `ride`.

## Nature (Lot 5)
Originale, générée par `tools/models/build_nature.py` (géométries `nature_geo.py`, atlas `nature_tex.py`). 21 fichiers `nature/nature_*.glb` statiques (aucun squelette), **un seul matériau « nature » et un seul atlas** `nature/tex/nature_basecolor.png` (1024×512, 8 cases : écorce, bouleau, roche, bois mort, frondes de pin, feuillage, herbe, champignon ; découpe alpha). La teinte vient des couleurs de sommets (essence / saison) ; les feuillages ont des normales « arrondies ».
Pin, chêne (vert / clair / automne), bouleau, buisson : variantes `_lo` (≈ 2× moins de triangles) utilisées quand la qualité des arbres est basse. Total ≈ 0,4 Mo + atlas 0,3 Mo.

## Lot 6 — Repères, ruines, portails, forge, monolithe (V10.41)
Modèles créés par script (glbkit), originaux, sans asset tiers : `lm_*` (moulin, menhirs, ferme, camp, flamme, autels, forteresse, tours, obélisque, arche, fontaine, temple, gueule, monolithe, rune, anneau, portiques), `ruine_*` (murs, gravats, pilier, piédestal), `portail_cadre`, `chariot`, `forge_decor`, `forge_braises`, `statue_*` (monolithe, runes, cristal, anneaux).
Intégration : Landmarks, DungeonRuins, Portals, Caravan, Monolith ; repli procédural conservé. Testé en solo (aucune erreur console). Non testé sur téléphone réel.

## Lot 7a/7b — Décors de biomes et boss (V10.42)
- `ville/ville_biome_*.glb` (12 modules, 3–288 tri) : basalte, débris, obsidienne, cristal, colonne, roches (fer/grès/neige), cactus, souche, roseau, glace. Générés par `tools/models/biome_geo.py` ; mêmes unités que les primitives procédurales, donc échelle/collision inchangées.
- `ennemis/boss_gardien.glb` (9 677 tri, golem de pierre) et `ennemis/boss_seigneur.glb` (24 598 tri, seigneur en armure) : squelette du Veilleur, animations idle/marche/attaque/mort ; déclarés « creature » pour passer par `createCreature`. Utilisés par Gardien des Ruines + gardien de la Flèche (gardien) et Souverain du Néant (seigneur).
Non vu à l'écran dans le vrai jeu (hors champ du test) : seulement dans le visualiseur ; le chemin GLB est confirmé (échelle ×4,4, aucune erreur).

## Empaquetage pour activation
`python3 tools/models/package_models.py public/models_proto <dossier_sortie>` produit l'arborescence plate attendue par le chargeur (`*.glb`, `tex/`, `index.json`) ; textures homonymes de contenu différent renommées par empreinte. Testé en solo dans le vrai jeu : 19 personnages/créatures, 92 modules de ville, 22 de nature chargés, aucune erreur. Poids total : ~23 Mo de GLB + ~6 Mo de textures (à mesurer sur téléphone avant activation). Rien n'est copié dans `public/models` : le site public n'utilise toujours que le procédural.

## Chargement et niveaux de détail (V10.42)
- `ModelLibrary._load` : fichiers triés par priorité (décor/ville, héros et armures, ennemis/bêtes, puis boss/montures), 4 téléchargements en parallèle, barre de progression « Chargement des modèles 3D… n/N » ; coupure seulement si aucun fichier n'aboutit pendant ≥12 s (plafond global 90 s), au lieu d'un délai fixe de 25 s.
- Arbres : version allégée (`*_lo`) affichée au-delà de ~120 m (hystérésis 10 m, sans ombre) — testé : 96 lots sur 138 ont un niveau allégé, 64 passent en lointain à une position donnée. Performance non mesurée sur téléphone.

## Fleur, habitants (V10.42)
- `nature/nature_fleur.glb` (62 tri) : fleur de prairie, utilisée par GrassField (teinte par instance).
- `ennemis/pnj_villageois_{a,b,c}.glb` (~8–10 k tri) : trois corps d'habitants (tunique, robe, tunique) sans arme, cheveux bruns/gris/blonds, sur le squelette du Veilleur. Test en jeu : les 28 PNJ à pied utilisent ces modèles (hors monolithe, resté procédural). Vêtements en couleur unie (pas de texture de tissu), visages simples ; chaque PNJ n'a pas d'apparence propre à son métier.
- Non converti : décor du barbier (enseigne à texte canvas + poteau animé par texture), Halloween (sculpté en code).

## Sol (V10.42)
`terrain/terrain_detail.jpg` (1024², grain/cailloux/brins carrelable) + `terrain_normal.png` (512²), générés par `tools/models/terrain_tex.py` ; déclarés dans `index.json` (`terrain`) par l'outil d'empaquetage. Le terrain les utilise à la place de la texture dessinée par code (relief éclairé via normales). Teinte globale par couleurs de sommets inchangée. Légèrement plus sombre que l'ancien rendu → luminosité ajustée (×1,9), à valider sur téléphone.

## Cinématique d'introduction (V10.42)
`ville/ville_intro_citadelle.glb` (1 998 tri : île flottante, donjon, 5 tours, enceinte, fenêtres allumées) et `ville_intro_rocher.glb` (132 tri, 9 instances en orbite). Remplacent l'île/tours dessinés par code ; lune, aurores, failles, cristal et faisceaux restent générés par code (effets). Test : cinématique jouée en entier dans le jeu avec les modèles, aucune erreur.

## Autres joueurs (V10.42)
Leur équipement n'est pas transmis par le réseau : avec un corps .glb ils recevaient aucune arme. `giveClassGear` leur pose l'arme (et l'objet secondaire) par défaut de leur classe (épée+écu, bâton+orbe, arc+carquois, dagues). Les corps de foule (LOD 1) n'ont que le support d'arme main droite : l'objet secondaire peut manquer. Non testé en multijoueur (serveur indisponible ici) ; syntaxe vérifiée seulement.

## Donjons des Spires (V10.42)
`RiftLayout` : rochers, colonnes, stalagmites/pointes et cristaux utilisent les formes `biome_roche_fer`, `biome_colonne`, `biome_glace`, `biome_cristal` (fusionnées, sans couleurs de sommets via `ModelLibrary.townMergedGeometry`) ; matériaux, textures de pierre, couleurs de thème et effacement par tramage inchangés. Sols (dalles), murs-boîtes, arbres/tombes, torches, estrade et flaques de lave restent des primitives. Test : entrée dans une spire (salle de départ, sans décor) sans erreur ; les salles à décor n'ont pas été visitées à l'écran.

## Cosmétiques de la boutique (V10.43)
Générés par `tools/models/cosmetics_geo.py` (ailes, couvre-chefs) et `cosmetics_pets.py` (familiers), enregistrés dans `build_town.py` ; fichiers `ville/ville_cos_*.glb`. Matériau neutre `flat` (double face) ajouté ; couleurs fixes écrites en sRGB puis converties en linéaire à l'export ; rôles de sommets : 0.8 principale (`fx.color`), 0.6 secondaire (`fx.glow`/`fx.tip`), 0.4 yeux (`fx.eye`), 1.0 fixe ; matériau `glow` = parties lumineuses / prisme.
- **Ailes** (une aile par fichier, plan XY, miroir à l'exécution) : `cos_aile_ange` (768 tri, plumes en 3 rangées sur un os), `cos_aile_demon` (120 tri, os + membrane festonnée), `cos_aile_cristal` (456 tri, éclats facettés). Les 10 ailes du catalogue ne sont que des teintes de ces 3 formes ; le prisme anime la couleur du matériau. Battement conservé.
- **Couvre-chefs** : `cos_couronne`, `cos_halo`, `cos_cornes`, `cos_oreilles_chat`, `cos_oreilles_loup`, `cos_chapeau_sorciere`, `cos_citrouille` (formes fixes, repère tête).
- **Familiers** : quadrupèdes `cos_fam_{chat,renard,loup,lapin,licorne}_{corps,tete,patte,queue}` (tête/pattes/queue = pivots animés comme avant), `cos_fam_{hibou,oiseau,phenix,chauve,dragon,fee,golem,araignee,citrouille}`, pattes `cos_fam_golem_patte` / `cos_fam_araignee_patte`, ailes `cos_fam_aile_{plume,chauve,fee}` (plan XZ, battement par pivot).
- **Restent procéduraux (par nature)** : anneaux au sol, auras, traînées de particules, titres (effets/texte) ; familiers translucides (gelée, feu follet, fantôme) et halo de la fée.
- Correction : sur un héros en modèle .glb, `rig.torso` / `rig.head` n'étaient que des leurres → ailes et couvre-chefs ne pouvaient pas s'attacher. Désormais de vrais points d'ancrage (torse y=1,0 ; tête y=1,7) ; `applySkin` pose les couvre-chefs 3D même sans recoloration (la recoloration des tenues reste réservée au corps procédural).
- Test : solo, ailes ange/démon/cristal + renard/dragonneau/licorne + couronne/tenues en jeu, aucune erreur console. Non testé sur téléphone réel.
