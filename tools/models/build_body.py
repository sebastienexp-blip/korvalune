"""Corps humain nu (tenue civile) pour les personnages joueurs — même squelette, mêmes animations et mêmes emplacements d'équipement que le Veilleur.
Remplace `veilleur_corps.glb` (qui n'était qu'une combinaison sombre sans mains ni tête). Matériaux recolorables à l'exécution :
  skin (teint de la race), tunic (couleur de classe), trousers (pantalon, plus sombre), leather (bottes, ceinture).
La tête n'est pas dans ce fichier : le jeu y pose la tête personnalisable (visage, yeux, cheveux, barbe).
  python3 tools/models/build_body.py public/models_proto/veilleur"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from glbkit import *
import hero_geo as G, hero_anim as A, build_hero as BH

def subset(m, mask_faces):
    F = m.F[mask_faces]
    used = np.unique(F); remap = -np.ones(len(m.V), int); remap[used] = np.arange(len(used))
    n = Mesh(m.V[used], remap[F], m.UV[used], m.J[used], m.W[used], m.C[used])
    n.N = None if m.N is None else m.N[used]
    return n

def split_y(m, y):
    c = m.V[m.F][:, :, 1].mean(1)
    return subset(m, c > y), subset(m, c <= y)

by = {n: (mm, mat) for n, mm, mat in G.parts}
parts = []
def add(name, mesh, mat): parts.append((name, mesh, mat))

add('tunique', by['torse'][0], 'tunic')
add('cou', by['cou'][0], 'skin')
for sfx in ('', '_R'):
    sleeve, fore = split_y(by['bras' + sfx][0], 1.20)      # manche courte / avant-bras nu
    add('manche' + sfx, sleeve, 'tunic'); add('avantbras' + sfx, fore, 'skin')
    add('jambe' + sfx, by['jambe' + sfx][0], 'trousers')
    add('botte' + sfx, by['botte' + sfx][0], 'leather')
    add('main' + sfx, by['main' + sfx][0], 'skin')
# ceinture de cuir (un peu plus fine que celle de l'armure pour ne pas la traverser)
belt = G.sh(G.torso, 'Hips', **G.wrap(0.5), t_lo=0.09, t_hi=0.17, offset=0.009, thick=0.008, bevel=0.008, na=44, nt=6, tile=0.2)
add('ceinture_corps', belt, 'leather')
hem = G.sh(G.skirt, 'Hips', **G.wrap(0.5), t_lo=0.0, t_hi=lambda a: 0.50 + 0.04 * np.cos(a * 2 * np.pi * 8), offset=-0.003, thick=0.007, bevel=0.006, na=48, nt=8, tile=0.3)
add('tunique_basse', G.skin_skirt(hem), 'tunic')

mats = BH.materials()
keep = [m for m in mats if m.name == 'leather']
flat = lambda n, r=0.62: Material(n, factor=(1, 1, 1, 1), metal=0.0, rough=r)
used = keep + [flat('skin', 0.55), flat('tunic', 0.85), flat('trousers', 0.9)]
if __name__ == '__main__':
    out = sys.argv[1]
    ref = round(max(float(m.V[:, 1].max()) for _, m, _ in G.parts), 3)
    extras = {'korvalune': {'type': 'body', 'slot': 'corps', 'skeleton': 'veilleur', 'humanHead': True, 'refHeight': ref, 'note': 'corps humain nu ; matériaux skin/tunic/trousers recolorés par le jeu ; la tête est posée par le jeu'}}
    fn = os.path.join(out, 'veilleur_corps.glb')
    st = write_glb(fn, parts, G.SK, used, A.build(), extras=extras, tex_dir=os.path.join(out, 'tex'), mesh_name='corps')
    print(fn, os.path.getsize(fn) // 1024, 'Ko', sum(v[1] for v in st.values()), 'tri', 'refHeight', ref)
