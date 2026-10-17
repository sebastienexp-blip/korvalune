"""Textures PBR procédurales du golem : roche sombre fracturée (veines violettes lumineuses dans les fissures) et cristal améthyste veiné."""
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image
from textures import fbm, norm01, to_normal, voronoi_cells, srgb

S = 1024


def stone(seed=31):
    rng = np.random.default_rng(seed)
    big = fbm(S, rng, octaves=((3, 1.0), (6, .6), (12, .4), (24, .25), (48, .15), (96, .1)))
    fine = fbm(S, rng, octaves=((64, 1.0), (128, .6), (256, .3)))
    cells = voronoi_cells(S, rng, n=140)           # arêtes ~ 0 au bord des facettes
    cells2 = voronoi_cells(S, rng, n=520)
    crack = np.clip(1 - cells / 0.10, 0, 1) ** 1.5      # fissures larges
    crack2 = np.clip(1 - cells2 / 0.06, 0, 1) ** 2      # micro-fissures
    # fissures principales irrégulières
    wob = gaussian_filter(rng.standard_normal((S, S)), 6, mode='wrap'); wob = wob / wob.std()
    crack = crack * np.clip(0.55 + 0.6 * big, 0, 1)
    # relief : facettes en plateaux, fissures en creux
    facet = np.kron(np.random.default_rng(seed + 1).uniform(0, 1, (S // 64, S // 64)), np.ones((64, 64)))
    facet = gaussian_filter(facet, 6, mode='wrap')
    h = 0.55 * norm01(big) + 0.25 * norm01(fine) + 0.25 * facet - 1.1 * crack - 0.35 * crack2
    nrm = to_normal(gaussian_filter(h, 0.8, mode='wrap') * 14, 1.0)
    # albedo : basalte presque noir, brun-bleu, éclaircissements sur arêtes, voile violet dans les creux
    v = norm01(h)
    base = np.stack([0.060 + 0.050 * v, 0.055 + 0.045 * v, 0.075 + 0.060 * v], -1)
    base *= (0.75 + 0.5 * norm01(fine))[..., None]
    base += (np.clip(v - 0.7, 0, 1) * 0.12)[..., None] * np.array([1, 0.95, 1.1])   # arêtes usées
    glow = np.clip(crack * 0.9 + crack2 * 0.35, 0, 1)
    base = base * (1 - 0.6 * glow[..., None]) + glow[..., None] * np.array([0.22, 0.05, 0.42]) * 0.5
    rough = np.clip(0.80 - 0.25 * np.clip(v - 0.6, 0, 1) + 0.15 * norm01(fine) - 0.3 * glow, 0.35, 1)
    ao = np.clip(1 - 0.75 * crack - 0.3 * crack2 - 0.15 * (1 - norm01(big)), 0, 1)
    orm = np.stack([ao, rough, np.full_like(rough, 0.03)], -1)
    em = (glow ** 1.3)[..., None] * np.array([0.70, 0.22, 1.0])[None, None, :] * 1.0
    em *= (0.7 + 0.5 * norm01(gaussian_filter(rng.standard_normal((S, S)), 10, mode='wrap')))[..., None]
    return srgb(base), nrm, srgb(orm), srgb(em)


def crystal(seed=47):
    rng = np.random.default_rng(seed)
    st = fbm(S, rng, octaves=((2, 1.0), (4, .6), (10, .3)), aniso=(0.15, 1.0))     # veines étirées
    fine = fbm(S, rng, octaves=((32, 1.0), (64, .5)))
    t = norm01(st)
    c0 = np.array([0.30, 0.08, 0.62]); c1 = np.array([0.72, 0.42, 1.0]); c2 = np.array([0.92, 0.80, 1.0])
    col = c0 * (1 - t[..., None]) + c1 * t[..., None]
    col = col * (1 - (np.clip(t - 0.8, 0, 1) * 4)[..., None]) + c2 * (np.clip(t - 0.8, 0, 1) * 4)[..., None]
    col *= (0.9 + 0.2 * norm01(fine))[..., None]
    h = 0.5 * norm01(st) + 0.1 * norm01(fine)
    nrm = to_normal(gaussian_filter(h, 1.2, mode='wrap') * 6, 1.0)
    rough = np.clip(0.18 + 0.2 * norm01(fine), 0, 1)
    orm = np.stack([np.ones_like(rough), rough, np.full_like(rough, 0.0)], -1)
    em = (col * (0.55 + 0.9 * t[..., None]))
    return srgb(col), nrm, srgb(orm), srgb(np.clip(em, 0, 1))
