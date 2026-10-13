"""Texture de détail du sol (1024², carrelable) : niveau de gris clair multiplié par les couleurs de sommets du terrain + carte de normales.
Sortie : <out>/terrain_detail.jpg, <out>/terrain_normal.png   usage : python3 terrain_tex.py <dossier_tex>"""
import sys, os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
import textures as T

def build(S=1024, seed=71):
    rng = np.random.default_rng(seed)
    big = T.norm01(T.fbm(S, rng, octaves=((2, 1.0), (4, .6), (8, .35))))                       # grandes taches
    mid = T.norm01(T.fbm(S, rng, octaves=((16, 1.0), (32, .6), (64, .35))))                    # grain moyen
    fine = T.norm01(T.fbm(S, rng, octaves=((128, 1.0), (256, .6))))                            # grain fin
    # cailloux : cellules de Voronoï arrondies
    vc = T.voronoi_cells(S, rng, n=900)
    pebble = T.norm01(gaussian_filter(vc, 1.2)) if vc is not None else mid
    # brins : stries courtes verticales
    blades = T.scratches(S, rng, n=5200, length=(0.004, 0.02), width=1)
    blades = gaussian_filter(blades.astype(float), 0.6)
    h = 0.5 * mid + 0.3 * fine + 0.3 * pebble + 0.1 * blades / (blades.max() + 1e-6)
    h = T.norm01(h)
    alb = 0.66 + 0.10 * (big - 0.5) + 0.34 * (mid - 0.5) + 0.22 * (fine - 0.5) - 0.12 * pebble * (pebble > 0.7)
    alb = np.clip(alb, 0.35, 1.0)
    return alb, h

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    alb, h = build()
    Image.fromarray(T.srgb(np.stack([alb] * 3, -1))).save(os.path.join(out, 'terrain_detail.jpg'), quality=88)
    Image.fromarray(T.to_normal(h, 3.0)).resize((512, 512), Image.LANCZOS).save(os.path.join(out, 'terrain_normal.png'), optimize=True)
    print('ok', round(float(alb.mean()), 3), os.path.getsize(os.path.join(out, 'terrain_detail.jpg')) // 1024, 'Ko', os.path.getsize(os.path.join(out, 'terrain_normal.png')) // 1024, 'Ko')
