"""Atlas de texture « nature » (1024×512, 8 cases de 256) : écorces, roche, bois mort, frondes de pin, feuillage, herbe, champignon.
RGBA ; le feuillage et l'herbe sont en niveaux de gris (teinte donnée par les couleurs de sommets, donc par essence/saison)."""
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter
import textures as T

CELL = 256
COLS, ROWS = 4, 2
NAMES = ['ecorce', 'bouleau', 'roche', 'bois_mort', 'pin', 'feuillage', 'herbe', 'champignon']

def _cell_bark(rng):
    h = T.fbm(CELL, rng, octaves=((3, 1.0), (6, .6), (12, .3), (24, .15)), aniso=(6, 0.7))
    h = T.norm01(h)
    ridge = T.norm01(np.abs(T.fbm(CELL, rng, octaves=((4, 1.0), (10, .5)), aniso=(8, 0.6))))
    v = 0.25 + 0.55 * h * (0.5 + 0.5 * ridge)
    col = np.stack([v * 1.0, v * 0.78, v * 0.58], -1)
    return np.clip(col, 0, 1)

def _cell_birch(rng):
    h = T.norm01(T.fbm(CELL, rng, octaves=((4, 1.0), (10, .5), (20, .2)), aniso=(1.5, 2)))
    base = 0.78 + 0.18 * h
    col = np.stack([base, base * 0.98, base * 0.93], -1)
    for _ in range(46):   # lenticelles sombres horizontales
        y = rng.integers(0, CELL); x = rng.integers(0, CELL); w = rng.integers(14, 70); t = rng.integers(2, 5)
        a = rng.uniform(0.25, 0.7)
        for dx in range(w):
            xx = (x + dx) % CELL
            col[y:y + t, xx] *= (1 - a * (1 - abs(dx / w * 2 - 1) ** 2))[None, None] if False else (1 - a * (1 - abs(dx / w * 2 - 1) ** 2))
    return np.clip(col, 0, 1)

def _cell_rock(rng):
    h = T.norm01(T.fbm(CELL, rng, octaves=((2, 1.0), (5, .7), (11, .4), (24, .2), (48, .1))))
    cr = T.norm01(np.abs(T.fbm(CELL, rng, octaves=((3, 1.0), (8, .6)))))
    crack = np.clip(1 - cr * 8, 0, 1) ** 2
    v = 0.30 + 0.50 * h - 0.10 * crack
    return np.clip(np.stack([v * 1.0, v * 0.98, v * 0.95], -1), 0, 1)

def _cell_dead(rng):
    h = T.norm01(T.fbm(CELL, rng, octaves=((3, 1.0), (7, .5), (14, .3), (28, .15)), aniso=(7, 0.6)))
    v = 0.30 + 0.45 * h
    return np.clip(np.stack([v * 0.96, v * 0.92, v * 0.86], -1), 0, 1)

def _draw_cell(draw_fn, ss=2):
    im = Image.new('RGBA', (CELL * ss, CELL * ss), (150, 150, 150, 0))
    d = ImageDraw.Draw(im); draw_fn(d, CELL * ss)
    return np.asarray(im.resize((CELL, CELL), Image.LANCZOS)).astype(np.float64) / 255

def _cell_pine(rng):
    def draw(d, S):
        cx = S * 0.5
        d.line([(cx, S), (cx, S * 0.02)], fill=(95, 95, 95, 255), width=int(S * 0.018))
        for i in range(120):
            f = i / 119; y = S * (0.98 - 0.94 * f)
            ln = S * (0.46 * (1 - 0.8 * f ** 1.4) + 0.03)
            for sd in (-1, 1):
                a = np.deg2rad(rng.uniform(38, 62))
                x2 = cx + sd * np.sin(a) * ln; y2 = y - np.cos(a) * ln * 0.55 - rng.uniform(0, 6)
                lum = int(rng.uniform(95, 235))
                d.line([(cx + sd * 2, y), (x2, y2)], fill=(lum, lum, lum, 255), width=max(2, int(S * 0.012)))
    return _draw_cell(draw)[..., :]

def _cell_leaf(rng):
    def draw(d, S):
        for i in range(70):   # rameaux
            pass
        pts = []
        for i in range(52):
            cx, cy = rng.uniform(0.12, 0.88) * S, rng.uniform(0.12, 0.88) * S
            ang = rng.uniform(0, 2 * np.pi); L = S * rng.uniform(0.17, 0.27); W = L * rng.uniform(0.38, 0.55)
            t = np.linspace(0, 1, 14)
            wid = np.sin(np.pi * t ** 0.8) * W / 2
            ux, uy = np.cos(ang), np.sin(ang); vx, vy = -uy, ux
            poly = [(cx + ux * L * ti + vx * w, cy + uy * L * ti + vy * w) for ti, w in zip(t, wid)]
            poly += [(cx + ux * L * ti - vx * w, cy + uy * L * ti - vy * w) for ti, w in zip(t[::-1], wid[::-1])]
            lum = int(rng.uniform(120, 250))
            d.polygon(poly, fill=(lum, lum, lum, 255))
            d.line([(cx, cy), (cx + ux * L, cy + uy * L)], fill=(int(lum * .62),) * 3 + (255,), width=max(1, int(S * .005)))
    return _draw_cell(draw)

def _cell_grass(rng):
    def draw(d, S):
        for i in range(15):
            x0 = rng.uniform(0.1, 0.9) * S; h = S * rng.uniform(0.55, 0.98); lean = rng.uniform(-0.18, 0.18) * S
            w = S * rng.uniform(0.022, 0.04)
            n = 14
            L = [(x0 - w * (1 - k / n) + lean * (k / n) ** 2, S - h * k / n) for k in range(n + 1)]
            R = [(x0 + w * (1 - k / n) + lean * (k / n) ** 2, S - h * k / n) for k in range(n, -1, -1)]
            lum = int(rng.uniform(150, 240))
            d.polygon(L + R, fill=(lum, lum, lum, 255))
    im = _draw_cell(draw)
    g = np.linspace(0.55, 1.0, CELL)[::-1][:, None]    # plus sombre au pied
    im[..., :3] *= (0.55 + 0.45 * (1 - g))[..., None] if False else np.linspace(1.0, 0.55, CELL)[:, None, None]
    return im

def _cell_mush(rng):
    h = T.norm01(T.fbm(CELL, rng, octaves=((3, 1.0), (8, .5), (16, .3))))
    v = 0.62 + 0.3 * h
    im = np.dstack([v, v, v, np.ones_like(v)])
    d = Image.fromarray((im * 255).astype(np.uint8)); dr = ImageDraw.Draw(d)
    for _ in range(26):
        x, y = rng.uniform(10, 246), rng.uniform(10, 150); r = rng.uniform(3, 9)
        dr.ellipse([x - r, y - r * .8, x + r, y + r * .8], fill=(255, 255, 255, 255))
    arr = np.asarray(d).astype(np.float64) / 255
    arr[190:, :, :3] = 0.92       # zone unie (pied)
    return arr

def build_atlas(seed=5):
    rng = np.random.default_rng(seed)
    gens = [_cell_bark, _cell_birch, _cell_rock, _cell_dead, _cell_pine, _cell_leaf, _cell_grass, _cell_mush]
    atlas = np.zeros((CELL * ROWS, CELL * COLS, 4))
    for i, g in enumerate(gens):
        c = g(rng)
        if c.shape[-1] == 3: c = np.dstack([c, np.ones(c.shape[:2])])
        # fond transparent : couleur moyenne (évite les liserés sombres)
        a = c[..., 3:4]
        if (a < 0.99).any():
            m = (c[..., :3] * a).sum((0, 1)) / max(a.sum(), 1)
            c[..., :3] = c[..., :3] * a + m * (1 - a)
        r, k = divmod(i, COLS)
        atlas[r * CELL:(r + 1) * CELL, k * CELL:(k + 1) * CELL] = c
    return (np.clip(atlas, 0, 1) * 255 + .5).astype(np.uint8)

if __name__ == '__main__':
    import sys
    Image.fromarray(build_atlas()).save(sys.argv[1] if len(sys.argv) > 1 else 'atlas.png')
