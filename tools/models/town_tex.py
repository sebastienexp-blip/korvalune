"""Textures « ville » neutres (niveaux de gris, tuilables) : crépi, tuiles, pierre de taille, planches. La teinte vient des couleurs de sommets."""
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
import textures as T

def _g(v): return np.clip(np.stack([v, v, v], -1) * 255 + .5, 0, 255).astype(np.uint8)

def plaster(seed=31, n=256):
    rng = np.random.default_rng(seed)
    h = T.norm01(T.fbm(n, rng, octaves=((2, 1.0), (5, .6), (12, .35), (32, .2), (64, .1))))
    grain = gaussian_filter(rng.standard_normal((n, n)), 0.7, mode='wrap')
    v = 0.80 + 0.14 * (h - 0.5) + 0.03 * grain
    return _g(v), T.to_normal(h, 1.6)

def tuile(seed=32, n=256, rows=8, perrow=8):
    rng = np.random.default_rng(seed)
    th, tw = n // rows, n // perrow
    lum = rng.uniform(0.55, 0.95, (rows, perrow + 1))
    yy, xx = np.mgrid[0:n, 0:n]
    r = yy // th; ly = (yy % th) / th
    xs = xx + np.where(r % 2 == 1, tw // 2, 0)
    c = (xs // tw) % perrow; lx = (xs % tw) / tw
    v = lum[r, c]
    edge = np.minimum(lx, 1 - lx)
    h = np.clip(ly * 1.2, 0, 1) * (0.7 + 0.3 * np.clip(edge * 8, 0, 1))      # tuile bombée, plus haute en bas (recouvrement)
    h = h - np.where(ly < 0.07, 0.5, 0)                                       # ombre sous la rangée du dessus
    v = v * (0.55 + 0.45 * np.clip(ly * 1.3, 0, 1)) * (0.8 + 0.2 * np.clip(edge * 10, 0, 1))
    v = v * (0.9 + 0.1 * gaussian_filter(rng.standard_normal((n, n)), 1.2, mode='wrap') * 3)
    return _g(np.clip(v, 0, 1)), T.to_normal(gaussian_filter(h, 0.8, mode='wrap'), 5.0)

def pierre(seed=33, n=512, rows=8):
    rng = np.random.default_rng(seed)
    th = n // rows
    yy, xx = np.mgrid[0:n, 0:n]
    h = np.zeros((n, n)); v = np.zeros((n, n))
    for r in range(rows):
        x = int(rng.integers(0, 60)); widths = []
        total = 0
        while total < n:
            w = int(rng.integers(100, 190)); w = min(w, n - total) if n - total < 190 else w; widths.append(w); total += w
        if total > n: widths[-1] -= total - n
        x0 = 0
        for w in widths:
            lum = rng.uniform(0.62, 0.95)
            ys = slice(r * th, (r + 1) * th)
            for dx in range(w):
                xi = (x0 + dx + x) % n
                v[ys, xi] = lum
                e = min(dx, w - 1 - dx) / 6.0
                h[ys, xi] = np.clip(e, 0, 1)
            x0 += w
        # joint horizontal
        h[r * th:r * th + 4, :] = 0
    fine = T.norm01(T.fbm(n, rng, octaves=((6, 1.0), (16, .6), (40, .4), (90, .3))))
    mort = (h < 0.5)
    v = np.where(mort, 0.38, v * (0.78 + 0.3 * fine))
    h = h * 0.7 + fine * 0.5
    return _g(np.clip(v, 0, 1)), T.to_normal(gaussian_filter(h, 0.9, mode='wrap'), 4.0)

def bois(seed=34, n=256, planks=8):
    rng = np.random.default_rng(seed)
    pw = n // planks
    grain = T.norm01(T.fbm(n, rng, octaves=((3, 1.0), (8, .5), (20, .3), (50, .2)), aniso=(8, 0.5)))
    yy, xx = np.mgrid[0:n, 0:n]
    p = xx // pw; lx = (xx % pw) / pw
    lum = rng.uniform(0.6, 0.95, planks)[p]
    v = lum * (0.65 + 0.45 * grain)
    gap = (lx < 0.04) | (lx > 0.97)
    v = np.where(gap, 0.18, v)
    h = grain * 0.6 + np.where(gap, -1.0, 0)
    return _g(np.clip(v, 0, 1)), T.to_normal(gaussian_filter(h, 0.7, mode='wrap'), 3.0)

def cloth(seed=35, n=128):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n]
    w = 0.5 + 0.5 * np.sin(xx * np.pi / 2) * np.sin(yy * np.pi / 2)
    v = 0.78 + 0.1 * w + 0.04 * rng.standard_normal((n, n))
    return _g(np.clip(v, 0, 1)), None

TEX = {'plaster': plaster, 'tuile': tuile, 'pierre': pierre, 'bois': bois, 'cloth': cloth}
