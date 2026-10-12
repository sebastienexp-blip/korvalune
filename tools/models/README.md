# Modèles 3D de Korvalune (GLB) — outils de fabrication

Ce dossier contient la **chaîne de fabrication** des modèles `.glb` : tout est reproductible par script, sans Blender ni logiciel externe
(Python 3 + numpy + scipy + Pillow suffisent).

| Fichier | Rôle |
|---|---|
| `glbkit.py` | boîte à outils : lofts (surfaces balayées), coques d'armure qui épousent le corps, skinning, quaternions, écriture du `.glb` |
| `textures.py` | textures PBR procédurales : acier sombre patiné, cuir, drap, argent lunaire gravé (couleur + normales + occlusion/rugosité/métal) |
| `hero_geo.py` | le **Veilleur de Corvalune** : squelette de 27 os, corps, armure, casque à bec de corbeau, croissant de lune, cape |
| `hero_anim.py` | animations : `idle`, `walk`, `run`, `attack`, `attack2`, `hit`, `death`, `jump` (30 images/s) |
| `build_hero.py` | assemble le tout et écrit le `.glb` |
| `check_glb.py` | vérifie un `.glb` indépendamment du moteur (structure, poids de peau, animations, dimensions) |
| `viewer.html` | page de contrôle (captures d'écran des modèles, utilisée pendant le développement) |

## Régénérer le héros
```
python3 tools/models/build_hero.py public/models_proto/corvalune_veilleur.glb   # ~45 s (textures en 1024)
python3 tools/models/build_hero.py /tmp/test.glb --quick                        # rapide, textures 256 (essais)
python3 tools/models/check_glb.py public/models_proto/corvalune_veilleur.glb
```

## Conventions du modèle
- Unités : mètres. Y vers le haut. Le personnage regarde **+Z**, sa gauche est +X. Pivot entre les pieds, pieds à y = 0. Taille ≈ 1,9 m (casque et croissant compris ; le moteur le normalise à 1,8 m).
- Os dont les rotations de repos sont nulles (axes du monde), noms : `Root, Hips, Spine, Chest, Neck, Head, Shoulder_L/R, UpperArm_L/R, LowerArm_L/R, Hand_L/R, UpperLeg_L/R, LowerLeg_L/R, Foot_L/R, Toe_L/R, Cape_1..3`.
- Points d'attache sans déformation : `Socket_Weapon_R` (main droite) et `Socket_Back` (dos) — pour poser armes et boucliers.
- Matériaux : `steel`, `leather`, `cloth`, `trim` (argent), `cloak`, `glow` (yeux) = 6 appels de dessin, textures 512–1024 px.

## Ce que ce modèle est, et n'est pas
Modélisé **par script** (formes balayées, plaques qui épousent le corps, textures procédurales) : de vrais maillages, un vrai squelette, de vraies
animations, de vraies textures PBR — mais ce n'est pas de la sculpture à la main : le rendu est stylisé, un peu massif. Un artiste 3D peut
l'ouvrir dans Blender (Fichier › Importer › glTF) pour le retoucher, ou le remplacer en gardant les mêmes noms d'os et d'animations.
