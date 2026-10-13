import sys, os
from glbkit import *
import hero_geo as G, hero_anim as A, build_hero as BH
from lod import cluster_decimate
out = sys.argv[1]; cell = float(sys.argv[2]) if len(sys.argv) > 2 else 0.03
rel = float(sys.argv[sys.argv.index('--rel') + 1]) if '--rel' in sys.argv else 0
lodn = 2 if rel else 1
mats = BH.materials('--quick' in sys.argv)
parts = []; t0 = t1 = 0
for n, m, mat in G.parts:
    c = max(cell, float((m.V.max(0) - m.V.min(0)).max()) * rel)
    d = cluster_decimate(m, c) if len(m.F) > 120 else m
    t0 += len(m.F); t1 += len(d.F); parts.append((n, d, mat))
extras = {'korvalune': {'type': 'body', 'lod': lodn, 'skeleton': 'veilleur_lod', 'refHeight': round(max(float(m.V[:, 1].max()) for _, m, _ in G.parts), 3),
                        'note': 'LOD 1 du Veilleur (foules, loin) — mêmes animations, armure incluse dans le maillage'}}
st = write_glb(out, parts, G.SK, mats, A.build(), extras=extras, tex_dir=os.path.join(os.path.dirname(out), 'tex'))
print(t0, '->', t1, 'triangles;', os.path.getsize(out), 'octets')
