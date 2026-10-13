"""Textures PBR procédurales (tuilables) pour le Veilleur : acier sombre patiné, cuir, drap, ornement argenté lunaire."""
import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates
from PIL import Image, ImageDraw

SZ = 1024


def fbm(size, rng, octaves=((4, 1.0), (8, .5), (16, .25), (32, .12), (64, .06)), aniso=(1, 1)):
    out = np.zeros((size, size))
    for cells, amp in octaves:
        n = rng.standard_normal((size, size))
        sig = size / cells / 2.2
        out += amp * gaussian_filter(n, (sig * aniso[0], sig * aniso[1]), mode='wrap') * (sig ** 1.0) ** 1
    out -= out.mean(); out /= (out.std() + 1e-9)
    return out


def norm01(a):
    a = a - a.min(); return a / (a.max() + 1e-9)


def to_normal(h, strength=2.0):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    n = np.stack([-gx * strength, gy * strength, np.ones_like(h)], -1)  # +Y vers le haut (convention glTF/OpenGL)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def srgb(a):
    return (np.clip(a, 0, 1) * 255 + .5).astype(np.uint8)


def scratches(size, rng, n=260, length=(0.03, 0.22), width=1, wrap=True):
    im = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(im)
    for _ in range(n):
        x, y = rng.uniform(0, size, 2)
        L = rng.uniform(*length) * size; ang = rng.normal(0, 0.35) + (np.pi / 2 if rng.random() < .25 else 0)
        dx, dy = np.cos(ang) * L, np.sin(ang) * L
        v = int(rng.uniform(80, 255))
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                d.line([(x + ox, y + oy), (x + dx + ox, y + dy + oy)], fill=v, width=width)
    return np.asarray(im, float) / 255.


def voronoi_cells(size, rng, n=420):
    pts = rng.uniform(0, size, (n, 2))
    yy, xx = np.mgrid[0:size:4, 0:size:4]
    best = np.full(yy.shape, 1e9); second = np.full(yy.shape, 1e9)
    for p in pts:
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                d = np.hypot(xx - (p[0] + ox), yy - (p[1] + oy))
                m = d < best
                second = np.where(m, best, np.where(d < second, d, second)); best = np.where(m, d, best)
    edge = second - best
    e = np.kron(edge, np.ones((4, 4)))
    return e / e.max()


def steel(seed=1):
    rng = np.random.default_rng(seed)
    S = SZ
    brushed = fbm(S, rng, octaves=((6, 1), (12, .8), (24, .5), (48, .3)), aniso=(0.25, 1.6))
    dents = fbm(S, rng, octaves=((3, 1.0), (6, .6), (12, .3)))
    grain = fbm(S, rng, octaves=((48, 1), (96, .7), (192, .4)))
    sc = gaussian_filter(scratches(S, rng, 330), .6, mode='wrap')
    wear_mask = norm01(fbm(S, rng, octaves=((2, 1), (4, .8), (8, .4))))
    rust = np.clip((wear_mask - 0.64) * 4.5, 0, 1) * np.clip(norm01(fbm(S, rng, octaves=((10, 1), (20, .6), (40, .5)))) * 1.4 - .2, 0, 1)
    h = 0.5 + 0.07 * dents + 0.012 * brushed + 0.012 * grain - 0.20 * sc
    base = np.array([.21, .215, .235])
    col = base[None, None, :] * (1 + 0.10 * brushed[..., None] + .10 * dents[..., None])
    col = col * (1 + 1.2 * sc[..., None] * .6)                       # rayures plus claires
    col = col * (1 - 0.35 * np.clip(dents, 0, 3)[..., None] * 0.0)
    rustc = np.array([.34, .15, .06]) * (0.6 + .6 * norm01(grain)[..., None])
    col = col * (1 - rust[..., None]) + rustc * rust[..., None]
    # reflets violets très discrets (lune)
    col += np.array([.02, .005, .035]) * np.clip(norm01(dents), 0, 1)[..., None] ** 3
    rough = np.clip(0.42 + 0.16 * brushed * .5 + .25 * rust + .1 * norm01(grain) - .18 * sc, .2, .95)
    metal = np.clip(1 - rust * .85, .05, 1)
    ao = np.clip(.82 + .1 * dents * .4 - .35 * rust, .3, 1)
    orm = np.stack([ao, rough, metal], -1)
    return srgb(col ** (1 / 1.0)), to_normal(h, 5.0), srgb(orm), h


def leather(seed=2):
    rng = np.random.default_rng(seed)
    S = SZ
    cells = voronoi_cells(S, rng, 900)
    wr = fbm(S, rng, octaves=((6, 1), (12, .6), (24, .4), (96, .25)))
    pore = fbm(S, rng, octaves=((128, 1), (256, .6)))
    creases = gaussian_filter(scratches(S, rng, 120, (0.05, .3), 2), 1.2, mode='wrap')
    h = 0.5 + 0.09 * (1 - np.exp(-cells * 9)) * 1.4 + 0.03 * wr + .01 * pore - .18 * creases
    base = np.array([.16, .10, .065])
    col = base * (1 + .35 * wr[..., None] * .4) * (1 - .35 * (1 - np.exp(-cells * 9))[..., None] * 0 )
    col = col * (0.82 + .36 * norm01(h)[..., None])
    col = col * (1 - .5 * creases[..., None])
    wornp = np.clip((norm01(fbm(S, rng, octaves=((3, 1), (7, .6)))) - .62) * 4, 0, 1)
    col = col * (1 - wornp[..., None]) + np.array([.2, .15, .11]) * wornp[..., None]
    rough = np.clip(.62 + .2 * pore * .3 - .15 * wornp, .35, .95)
    orm = np.stack([np.clip(.9 - .25 * creases, 0, 1), rough, np.zeros_like(rough)], -1)
    return srgb(col), to_normal(h, 4.0), srgb(orm), h


def cloth(seed=3):
    rng = np.random.default_rng(seed)
    S = SZ
    x = np.arange(S)
    th = 128  # fils par tuile
    wx = np.sin(x[None, :] * 2 * np.pi * th / S)
    wy = np.sin(x[:, None] * 2 * np.pi * th / S)
    over = ((np.arange(S)[:, None] // (S // th) + np.arange(S)[None, :] // (S // th)) % 2) == 0
    weave = np.where(over, .5 + .5 * wx, .5 + .5 * wy)
    fib = fbm(S, rng, octaves=((64, 1), (128, .7), (256, .5)))
    mott = fbm(S, rng, octaves=((3, 1), (6, .6), (12, .3)))
    h = .5 + .08 * weave + .02 * fib
    base = np.array([.12, .075, .16])
    col = base * (.78 + .5 * weave[..., None]) * (1 + .22 * mott[..., None] * .5) * (1 + .12 * fib[..., None] * .5)
    rough = np.full((S, S), .93) - .08 * weave
    orm = np.stack([.85 + .1 * weave, rough, np.zeros((S, S))], -1)
    return srgb(col), to_normal(h, 3.0), srgb(orm), h


def trim(seed=4):
    """Ornement argent vieilli gravé de croissants de lune et de plumes."""
    rng = np.random.default_rng(seed)
    S = SZ
    dents = fbm(S, rng, octaves=((4, 1), (8, .6), (16, .3)))
    grain = fbm(S, rng, octaves=((64, 1), (128, .6)))
    sc = gaussian_filter(scratches(S, rng, 160), .6, mode='wrap')
    eng = Image.new('L', (S, S), 0); d = ImageDraw.Draw(eng)
    cell = 128
    for gy in range(S // cell):
        for gx in range(S // cell):
            cx, cy = gx * cell + cell / 2, gy * cell + cell / 2
            r = cell * .30
            if (gx + gy) % 2 == 0:
                # croissant : disque moins disque décalé
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
                d.ellipse([cx - r * .62, cy - r * 1.0, cx + r * 1.28, cy + r * .95], fill=0)
            else:
                # plume : fuseau + nervure
                pts = [(cx, cy - r * 1.2), (cx + r * .55, cy - r * .1), (cx + r * .15, cy + r * 1.2), (cx - r * .15, cy + r * 1.2), (cx - r * .55, cy - r * .1)]
                d.polygon(pts, fill=255)
                d.line([(cx, cy - r), (cx, cy + r * 1.25)], fill=0, width=3)
    eng = gaussian_filter(np.asarray(eng, float) / 255, 1.3, mode='wrap')
    frame = np.zeros((S, S))
    frame[::cell] = 1; frame[:, ::cell] = 1
    frame = gaussian_filter(frame, 1.5, mode='wrap')
    h = .5 + .06 * dents + .02 * grain - .35 * eng - .2 * frame - .15 * sc
    base = np.array([.50, .47, .43])
    col = base * (.78 + .3 * norm01(dents)[..., None]) * (1 + .1 * grain[..., None] * .3)
    col = col * (1 - .62 * eng[..., None]) * (1 - .35 * frame[..., None]) * (1 + .6 * sc[..., None] * .5)
    patina = np.clip((norm01(fbm(S, rng, octaves=((5, 1), (10, .6)))) - .6) * 3.5, 0, 1)
    col = col * (1 - .6 * patina[..., None]) + np.array([.05, .09, .08]) * patina[..., None]
    rough = np.clip(.32 + .2 * eng + .25 * patina - .1 * sc, .15, .9)
    orm = np.stack([np.clip(1 - .5 * eng, 0, 1), rough, np.clip(1 - .7 * patina, .1, 1)], -1)
    return srgb(col), to_normal(h, 6.0), srgb(orm), h


def shrink(arr, size):
    return np.asarray(Image.fromarray(arr).resize((size, size), Image.LANCZOS))


def fur(seed=7):
    """Pelage : brins fins orientés selon V (le long du corps), mèches plus sombres/claires."""
    rng = np.random.default_rng(seed)
    S = SZ
    # brins : bruit étiré dans la direction des lignes (axe 0)
    strands = fbm(S, rng, octaves=((128, 1), (256, .8), (512, .5)), aniso=(2.6, 0.35))
    clumps = fbm(S, rng, octaves=((24, 1), (48, .7)), aniso=(1.6, 0.5))
    patches = fbm(S, rng, octaves=((3, 1), (6, .6), (12, .4)))
    h = 0.5 + 0.06 * strands + 0.04 * clumps
    base = np.array([.34, .30, .26])
    tone = 0.75 + 0.22 * norm01(strands)[..., None] + 0.2 * (norm01(patches) - .5)[..., None]
    col = base * tone * (0.85 + 0.3 * norm01(clumps)[..., None])
    # pointes plus claires, racines plus sombres
    col = col * (0.9 + 0.2 * np.clip(strands, -1.5, 1.5)[..., None] * 0.3)
    rough = np.clip(0.82 + 0.1 * strands * 0.3, .6, 1.0)
    ao = np.clip(0.8 + 0.12 * norm01(strands) , 0, 1)
    orm = np.stack([ao, rough, np.zeros_like(rough)], -1)
    return srgb(col), to_normal(h, 2.2), srgb(orm), h


def bone(seed=8):
    rng = np.random.default_rng(seed)
    S = SZ
    cracks = gaussian_filter(scratches(S, rng, 80, (0.05, .35), 2), 1.0, mode='wrap')
    grain = fbm(S, rng, octaves=((10, 1), (20, .6), (60, .4)), aniso=(1.0, 0.4))
    stain = norm01(fbm(S, rng, octaves=((3, 1), (6, .7), (12, .4))))
    h = 0.5 + 0.03 * grain - 0.2 * cracks
    base = np.array([.62, .57, .47])
    col = base * (0.8 + 0.25 * norm01(grain)[..., None]) * (1 - .35 * stain[..., None] ** 2) * (1 - .6 * cracks[..., None])
    rough = np.clip(.55 + .2 * norm01(grain), .3, .95)
    orm = np.stack([np.clip(.9 - .4 * cracks, 0, 1), rough, np.zeros_like(rough)], -1)
    return srgb(col), to_normal(h, 3.0), srgb(orm), h


def skin(seed=11, tone=(0.42, 0.27, 0.20), warty=0.0):
    """Peau : teinte de base (linéaire), marbrures, pores, veines ; warty > 0 → peau épaisse/granuleuse (troll, gobelin)."""
    rng = np.random.default_rng(seed)
    S = SZ
    low = fbm(S, rng, octaves=((3, 1), (6, .6), (12, .3)))
    pore = fbm(S, rng, octaves=((96, 1), (192, .7), (320, .4)))
    cells = voronoi_cells(S, rng, 700)
    veins = gaussian_filter(scratches(S, rng, 70, (0.08, .4), 1), 1.6, mode='wrap')
    bump = (1 - np.exp(-cells * 11)) * warty
    h = 0.5 + 0.02 * pore + 0.05 * bump + 0.015 * low
    t = np.array(tone)
    col = t * (0.88 + 0.14 * low[..., None] * .5) * (0.94 + 0.06 * pore[..., None])
    col = col + np.array([.05, -.01, -.01]) * norm01(low)[..., None] * 0.6      # rougeurs
    col = col * (1 - 0.18 * veins[..., None]) + np.array([.02, .03, .07]) * veins[..., None] * .5
    col = col * (1 - 0.25 * bump[..., None])
    rough = np.clip(.58 + .12 * pore * .3 + .1 * bump, .4, .9)
    orm = np.stack([np.clip(.92 - .2 * bump, 0, 1), rough, np.zeros_like(rough)], -1)
    return srgb(col), to_normal(h, 3.0 + 3 * warty), srgb(orm), h
