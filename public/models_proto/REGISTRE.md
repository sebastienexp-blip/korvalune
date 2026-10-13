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
