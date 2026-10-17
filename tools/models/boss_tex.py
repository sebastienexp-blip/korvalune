"""Textures PBR procédurales (512 px, tuilables) des boss mondiaux. Chaque générateur renvoie (albedo, normale, orm, émissive|None) en uint8."""
import numpy as np
from scipy.ndimage import gaussian_filter
from textures import fbm, norm01, to_normal, voronoi_cells, srgb, scratches

S = 512


def _col(a, c): return np.array(c, float)[None, None, :] * a[..., None]


def _mix(a, b, t): return a * (1 - t[..., None]) + b * t[..., None]


def finish(col, h, rough, metal=0.0, ao=None, emis=None, ns=3.0):
    if ao is None: ao = np.ones_like(h)
    orm = np.stack([np.clip(ao, 0, 1), np.clip(rough, 0.05, 1), np.clip(metal, 0, 1) * 0.38 * np.ones_like(h)], -1)   # métal atténué : le jeu n'a pas de carte d'environnement
    return srgb(col), to_normal(h, ns), srgb(orm), (None if emis is None else srgb(emis))


def stone(seed, dark, light, crack=None, cells=90, rough=0.82, relief=12.0, moss=None, metal=0.0):
    """Roche / grès / basalte fracturé ; crack = couleur émissive dans les fissures."""
    r = np.random.default_rng(seed)
    big = fbm(S, r, octaves=((3, 1.0), (6, .6), (12, .4), (24, .25), (48, .15)))
    fine = fbm(S, r, octaves=((48, 1.0), (96, .6), (192, .3)))
    cl = voronoi_cells(S, r, n=cells)
    ck = np.clip(1 - cl / 0.09, 0, 1) ** 1.5
    ck2 = np.clip(1 - voronoi_cells(S, r, n=cells * 4) / 0.05, 0, 1) ** 2
    facet = gaussian_filter(np.kron(np.random.default_rng(seed + 1).uniform(0, 1, (S // 64, S // 64)), np.ones((64, 64))), 5, mode='wrap')
    h = 0.5 * norm01(big) + 0.22 * norm01(fine) + 0.28 * facet - 1.0 * ck - 0.3 * ck2
    v = norm01(h)
    col = _mix(_col(np.ones((S, S)), dark), _col(np.ones((S, S)), light), v) * (0.8 + 0.4 * norm01(fine))[..., None]
    col = col * (1 - 0.5 * ck[..., None])
    if moss is not None:
        mm = np.clip((norm01(fbm(S, r, octaves=((4, 1), (8, .6), (16, .4)))) - .55) * 3.5, 0, 1) * (1 - v * .4)
        col = _mix(col, _col(np.ones((S, S)), moss) * (0.7 + 0.5 * norm01(fine))[..., None], mm)
    glow = np.clip(ck * .9 + ck2 * .3, 0, 1)
    emis = None
    if crack is not None:
        modul = 0.65 + 0.5 * norm01(gaussian_filter(r.standard_normal((S, S)), 9, mode='wrap'))
        emis = (glow ** 1.3 * modul)[..., None] * np.array(crack)[None, None, :]
        col = _mix(col, _col(np.ones((S, S)), crack) * .35, glow * .6)
    ao = 1 - 0.7 * ck - 0.25 * ck2 - 0.12 * (1 - norm01(big))
    return finish(col, h, rough - 0.3 * glow + 0.12 * norm01(fine) - 0.2 * np.clip(v - .65, 0, 1), metal, ao, emis, ns=relief * 0.35)


def fibers(seed, c1, c2, aniso=(0.12, 1.0), weave=False, rough=0.9, relief=3.0, dirt=0.35, emis_col=None, metal=0.0):
    """Fibres / paille / écorce / sac de toile / pelage : bruit étiré le long de V."""
    r = np.random.default_rng(seed)
    st = fbm(S, r, octaves=((8, 1.0), (16, .8), (32, .6), (64, .4), (128, .3)), aniso=aniso)
    st2 = fbm(S, r, octaves=((3, 1.0), (6, .6), (12, .3)))
    h = 0.5 * norm01(st) + 0.2 * norm01(st2)
    if weave:
        x = np.arange(S); th = 64
        wx = np.sin(x[None, :] * 2 * np.pi * th / S); wy = np.sin(x[:, None] * 2 * np.pi * th / S)
        over = ((np.arange(S)[:, None] // (S // th) + np.arange(S)[None, :] // (S // th)) % 2) == 0
        wv = np.where(over, .5 + .5 * wx, .5 + .5 * wy)
        h = h * 0.5 + 0.5 * wv * 0.5
    t = norm01(st)
    col = _mix(_col(np.ones((S, S)), c1), _col(np.ones((S, S)), c2), t) * (0.8 + 0.4 * norm01(st2))[..., None]
    dm = np.clip((norm01(fbm(S, r, octaves=((3, 1), (6, .7), (12, .4), (24, .3)))) - (1 - dirt)) * 3, 0, 1)
    col = col * (1 - 0.55 * dm[..., None])
    emis = None
    if emis_col is not None:
        vein = np.clip(1 - np.abs(norm01(st2) - 0.5) / 0.04, 0, 1) ** 2
        emis = vein[..., None] * np.array(emis_col)[None, None, :]
    return finish(col, h, rough - 0.2 * t, metal, 0.85 + 0.15 * t - 0.3 * dm, emis, ns=relief)


def metal(seed, base, rust=(0.35, 0.16, 0.06), rust_amt=0.4, panels=6, rough=0.5, edge=None, glow=None, relief=5.0, rivets=True):
    """Plaques métalliques rivetées, rayées, rouillées ; glow = couleur émissive des joints."""
    r = np.random.default_rng(seed)
    big = fbm(S, r, octaves=((3, 1.0), (6, .6), (12, .3)))
    grain = fbm(S, r, octaves=((64, 1), (128, .7), (256, .4)))
    brush = fbm(S, r, octaves=((8, 1), (16, .8), (32, .5)), aniso=(0.2, 1.6))
    sc = gaussian_filter(scratches(S, r, 220), .6, mode='wrap')
    u = np.arange(S) / S
    gx = np.abs(((u[None, :] * panels) % 1) - .5) * 2; gy = np.abs(((u[:, None] * panels) % 1) - .5) * 2
    seam = np.clip((np.maximum(gx, gy) - 0.94) / 0.06, 0, 1)
    h = 0.5 + 0.05 * big + 0.01 * grain - 0.25 * seam - 0.15 * sc
    if rivets:
        cx = (u[None, :] * panels) % 1 - .5; cy = (u[:, None] * panels) % 1 - .5
        for sx in (-.4, .4):
            for sy in (-.4, .4):
                d = np.hypot(cx - sx, cy - sy); h += 0.35 * np.clip(1 - d / 0.035, 0, 1) ** 0.7
    rm = np.clip((norm01(fbm(S, r, octaves=((4, 1), (8, .7), (16, .5), (32, .4)))) - (1 - rust_amt)) * 4, 0, 1)
    col = _col(np.ones((S, S)), base) * (0.8 + 0.3 * norm01(brush) + 0.2 * norm01(big))[..., None]
    col = col * (1 + 0.8 * sc[..., None] * .5) * (1 - 0.6 * seam[..., None])
    col = _mix(col, _col(np.ones((S, S)), rust) * (0.6 + 0.6 * norm01(grain))[..., None], rm)
    if edge is not None:
        col = _mix(col, _col(np.ones((S, S)), edge), np.clip(norm01(h) - .75, 0, 1) * 2)
    emis = None
    if glow is not None:
        emis = (seam ** 2 * (0.6 + 0.6 * norm01(big)))[..., None] * np.array(glow)[None, None, :]
    return finish(col, h, rough + 0.3 * rm + 0.1 * norm01(grain) - 0.15 * sc, np.clip(1 - rm * 0.85, 0.1, 1) * (0.9), 1 - 0.5 * seam - 0.3 * rm, emis, ns=relief)


def skin(seed, c1, c2, spots=None, vein=None, wet=True, bumps=0.5, relief=4.0, cells=260):
    """Peau / chair / chitine : cellules en relief, taches, veines lumineuses."""
    r = np.random.default_rng(seed)
    cl = voronoi_cells(S, r, n=cells)
    big = fbm(S, r, octaves=((3, 1.0), (6, .6), (12, .4), (24, .3)))
    fine = fbm(S, r, octaves=((64, 1.0), (128, .5)))
    cell = 1 - np.exp(-cl * 8)
    h = 0.5 + 0.12 * cell * bumps + 0.1 * norm01(big) + 0.02 * fine
    t = norm01(big)
    col = _mix(_col(np.ones((S, S)), c1), _col(np.ones((S, S)), c2), t) * (0.85 + 0.3 * cell[..., None][..., 0])[..., None]
    if spots is not None:
        sp = np.clip((norm01(fbm(S, r, octaves=((10, 1), (20, .7), (40, .4)))) - .66) * 6, 0, 1)
        col = _mix(col, _col(np.ones((S, S)), spots), sp)
    emis = None
    if vein is not None:
        e = np.abs(norm01(fbm(S, r, octaves=((5, 1), (10, .7), (20, .4)))) - .5)
        vv = np.clip(1 - e / 0.025, 0, 1) ** 1.5
        emis = (vv * (0.6 + 0.6 * norm01(big)))[..., None] * np.array(vein)[None, None, :]
    return finish(col, h, (0.35 if wet else 0.75) + 0.2 * cell, 0.0, 0.85 + 0.15 * cell, emis, ns=relief)


def scales(seed, c1, c2, edge=None, cells=160, rough=0.45, metal=0.5, glow=None, relief=5.0):
    """Écailles / plumes / plaques organiques : cellules bombées avec liseré."""
    r = np.random.default_rng(seed)
    cl = voronoi_cells(S, r, n=cells)
    fine = fbm(S, r, octaves=((32, 1.0), (64, .6), (128, .3)))
    big = fbm(S, r, octaves=((3, 1.0), (6, .6)))
    dome = np.clip(cl / 0.28, 0, 1) ** 0.6
    h = 0.35 + 0.5 * dome + 0.02 * fine
    shade = np.random.default_rng(seed + 3).uniform(0.8, 1.2, (S // 16, S // 16))
    shade = gaussian_filter(np.kron(shade, np.ones((16, 16))), 3, mode='wrap')
    t = norm01(big)
    col = _mix(_col(np.ones((S, S)), c1), _col(np.ones((S, S)), c2), t) * (0.55 + 0.6 * dome)[..., None] * shade[..., None]
    if edge is not None:
        col = _mix(col, _col(np.ones((S, S)), edge), np.clip(1 - cl / 0.08, 0, 1) * 0.8)
    emis = None
    if glow is not None:
        emis = (np.clip(1 - cl / 0.06, 0, 1) ** 2 * (0.5 + 0.7 * norm01(big)))[..., None] * np.array(glow)[None, None, :]
    return finish(col, h, rough + 0.2 * (1 - dome) + 0.1 * norm01(fine), metal, 0.6 + 0.4 * dome, emis, ns=relief)


def void(seed, base=(0.02, 0.01, 0.04), nebula=(0.35, 0.1, 0.8), stars=True):
    r = np.random.default_rng(seed)
    neb = norm01(fbm(S, r, octaves=((2, 1.0), (4, .8), (8, .5), (16, .3))))
    neb2 = norm01(fbm(S, r, octaves=((3, 1.0), (6, .7), (12, .4))))
    fine = fbm(S, r, octaves=((64, 1), (128, .5)))
    col = _col(np.ones((S, S)), base) * (1 + 1.5 * neb[..., None]) + np.array(nebula)[None, None, :] * (np.clip(neb - .55, 0, 1) * 1.6)[..., None] * 0.35
    emis = (np.clip(neb - .5, 0, 1) ** 1.5 * 1.4)[..., None] * np.array(nebula)[None, None, :] * 0.8
    if stars:
        st = (r.uniform(0, 1, (S, S)) > 0.9965).astype(float)
        st = gaussian_filter(st, 0.8) * 9
        emis = emis + st[..., None] * np.array([0.9, 0.85, 1.0])[None, None, :]
    # fissures de vide
    cl = voronoi_cells(S, r, n=60)
    ck = np.clip(1 - cl / 0.05, 0, 1) ** 2
    emis = emis + ck[..., None] * np.array(nebula)[None, None, :] * 1.0
    h = 0.5 + 0.1 * neb2 + 0.02 * fine - 0.3 * ck
    return finish(col, h, 0.4 + 0.3 * neb2, 0.2, 1 - 0.5 * ck, np.clip(emis, 0, 1), ns=3.0)
