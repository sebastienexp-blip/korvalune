"""Briques communes de modélisation des boss mondiaux (grandes pièces détaillées)."""
import numpy as np
from glbkit import *
from skel_geo import shaft, tube, revolve, open_loft, dent, line, unit, P_
import boss_tex as T

PI = np.pi
RNG = np.random.RandomState(5)


def qmat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def xf(m, t=(0, 0, 0), rx=0, ry=0, rz=0, s=1.0):
    M = np.eye(4); M[:3, :3] = qmat(qeuler(rx, ry, rz)) * (np.asarray(s) if np.ndim(s) == 0 else np.diag(s)); M[:3, 3] = t
    return m.transform(M)


def align(m, a, b):
    """Oriente un mesh construit le long de +Y (de 0 à 1 unité) pour aller de a à b (échelle sur Y = longueur)."""
    a = np.asarray(a, float); b = np.asarray(b, float); d = b - a; L = np.linalg.norm(d); d /= L
    y = np.array([0, 1.0, 0]); ax = np.cross(y, d); s = np.linalg.norm(ax); c = float(np.dot(y, d))
    if s < 1e-8: R = np.eye(3) if c > 0 else np.diag([1, -1, 1])
    else:
        ax /= s; K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]]); R = np.eye(3) + s * K + (1 - c) * K @ K
    m.V = (m.V * np.array([1, L, 1])) @ R.T + a
    return m


def ell(c, r, sq=(1, 1, 1), segs=12, n=11, tile=0.9, rot=None):
    """Ellipsoïde (rayon r, écrasements sq) avec tuile UV en mètres."""
    t = np.linspace(0, 1, n)
    rr = r * np.sqrt(np.clip(1 - (2 * t - 1) ** 2, 0, 1)) + 1e-4
    path = np.stack([np.zeros(n), (t - .5) * 2 * r * sq[1], np.zeros(n)], 1)
    m = Loft(path, rr * sq[2], rr * sq[0], p=2.0, segs=segs, tile=tile, ref=(0, 0, 1)).mesh()
    if rot is not None: xf(m, rx=rot[0], ry=rot[1], rz=rot[2])
    m.V += np.asarray(c, float)
    return m


def cone(base, tip, r, segs=8, ratio=1.0, tile=.4, n=6, curve=0.0, bow=None, cap=1, p=2.2):
    base = np.asarray(base, float); tip = np.asarray(tip, float)
    mid = (base + tip) / 2 + (np.zeros(3) if bow is None else np.asarray(bow, float))
    path = smoothpath([base, mid, tip], n)
    t = np.linspace(0, 1, n)
    rr = r * (1 - t) ** (1.0 + curve) + 1e-4
    d = unit(tip - base); ref = np.cross(d, (0, 0, 1)) if abs(d[2]) < .9 else (1, 0, 0)
    return Loft(path, rr, rr * ratio, p=p, segs=segs, cap0=cap, cap1=0, tile=tile, ref=ref).mesh()


def rod(path_pts, r0, r1=None, segs=8, n=None, tile=.5, ref=(1, 0, 0), cap=1, ratio=1.0, p=2.2, prof_k=None):
    path = smoothpath(path_pts, n or max(6, len(path_pts) * 4))
    nn = len(path); r1 = r0 if r1 is None else r1
    rr = prof(prof_k or [(0, r0), (1, r1)], nn)
    return Loft(path, rr, rr * ratio, p=p, segs=segs, cap0=cap, cap1=cap, tile=tile, ref=ref).mesh()


def torus(R, r, axis='y', segs=24, rs=10, tile=.5):
    a = np.linspace(0, 2 * PI, rs + 1)
    pr = np.stack([R + r * np.cos(a), r * np.sin(a)], 1)
    m = revolve(pr, segs=segs, tile=tile)
    if axis == 'y': xf(m, rx=-PI / 2)
    elif axis == 'x': xf(m, ry=PI / 2)
    return m


def band(c, axis, R, h, th=.04, segs=20, tile=.4):
    m = revolve([(R, -h / 2), (R + th, -h / 2 + .005), (R + th, h / 2 - .005), (R, h / 2)], segs=segs, tile=tile)
    return orient_z(m, axis, c)


def orient_z(m, axis, c):
    """Bascule un mesh d'axe Z vers `axis` ('x','y','z' ou vecteur), puis le place en c."""
    if isinstance(axis, str):
        if axis == 'y': xf(m, rx=-PI / 2)
        elif axis == 'x': xf(m, ry=PI / 2)
    else:
        d = unit(np.asarray(axis, float)); z = np.array([0, 0, 1.0]); ax = np.cross(z, d); s = np.linalg.norm(ax); cc = float(np.dot(z, d))
        if s > 1e-8:
            ax /= s; K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]]); R = np.eye(3) + s * K + (1 - cc) * K @ K
            m.V = m.V @ R.T
        elif cc < 0: m.V[:, 2] *= -1
    m.V += np.asarray(c, float)
    return m


def helix(a, b, R, turns, r, segs=6, n=None, tile=.3, p=2.0):
    a = np.asarray(a, float); b = np.asarray(b, float); d = b - a; L = np.linalg.norm(d); d /= L
    u = np.cross(d, (0, 0, 1)) if abs(d[2]) < .9 else np.cross(d, (1, 0, 0)); u /= np.linalg.norm(u); v = np.cross(d, u)
    n = n or int(14 * turns + 4); t = np.linspace(0, 1, n)
    pts = a + np.outer(t, d * L) + np.outer(R * np.cos(2 * PI * turns * t), u) + np.outer(R * np.sin(2 * PI * turns * t), v)
    rr = np.full(n, r)
    return Loft(pts, rr, rr, p=p, segs=segs, cap0=1, cap1=1, tile=tile, ref=(0, 1, 0)).mesh()


def lobed(c, r, lobes=10, depth=.09, sq=(1, 1, 1), n=14, segs=40, tile=1.0):
    """Citrouille / bulbe à côtes : ellipsoïde dont le rayon est modulé par des lobes."""
    t = np.linspace(0, 1, n)
    rr = r * np.sqrt(np.clip(1 - (2 * t - 1) ** 2, 0, 1)) + 1e-4
    path = np.stack([np.zeros(n), (t - .5) * 2 * r * sq[1], np.zeros(n)], 1)

    def sec(i, a, rf, rs):
        k = 1 + depth * np.cos(lobes * a)
        return rf * np.cos(a) * k, rs * np.sin(a) * k
    m = Loft(path, rr * sq[2], rr * sq[0], p=2.0, segs=segs, tile=tile, ref=(0, 0, 1), section=sec, cap0=0, cap1=0).mesh()
    m.V += np.asarray(c, float)
    return m


def plate(c, w, h, th=.05, bend=0.0, segs=10, tile=.8, rot=(0, 0, 0), bevel=3.2):
    """Plaque épaisse rectangulaire arrondie (armure, planche) dans le plan XY, normale +Z ; bend courbe en Z."""
    n = 8; t = np.linspace(-1, 1, n)
    path = np.stack([np.zeros(n), t * h / 2, bend * (1 - t ** 2)], 1)
    m = Loft(path, np.full(n, th / 2), np.full(n, w / 2), p=bevel, segs=segs * 2, cap0=1, cap1=1, tile=tile, ref=(0, 0, 1)).mesh()
    xf(m, rx=rot[0], ry=rot[1], rz=rot[2]); m.V += np.asarray(c, float)
    return m


def tuft(c, d, n=14, L=.7, spread=.5, r=.02, rng=None, droop=.2, tile=.3):
    rng = rng or RNG; out = []; d = unit(np.asarray(d, float)); c = np.asarray(c, float)
    for _ in range(n):
        dd = unit(d + rng.normal(0, spread, 3)); l = L * rng.uniform(.6, 1.2)
        b = c + rng.normal(0, .03, 3); tip = b + dd * l + np.array([0, -droop * l, 0])
        out.append(shaft(b, tip, r * rng.uniform(.7, 1.3), ends=(1.3, .25), n=5, segs=4, bow=(rng.normal(0, .05 * l), -droop * .3 * l, rng.normal(0, .05 * l)), tile=tile, cap=0))
    return concat(out)


def jag_profile(n, amp, rng=None, seed=1):
    r = np.random.RandomState(seed)
    return 1 + amp * (r.uniform(-1, 1, n))


def mat(name, gen, key, ns=1.0, emissive=False, metal=1.0, rough=1.0, ds=False, factor=(1, 1, 1, 1)):
    b, n, o, e = gen
    m = Material(name, base=b, normal=n, orm=o, emissive=(1, 1, 1) if (emissive and e is not None) else (0, 0, 0), emissive_tex=e if emissive else None,
                 metal=metal, rough=rough, normal_scale=ns, texkey=key, base_fmt='JPEG', pack_fmt='JPEG', double_sided=ds, factor=factor)
    return m


def gear(c, R, teeth=12, depth=.14, thick=.3, axis='x', tile=.5, hub=0.3):
    """Engrenage plein (dents carrées) d'axe `axis`, centré en c."""
    n = 6; path = np.stack([np.zeros(n), np.zeros(n), np.linspace(-thick / 2, thick / 2, n)], 1)

    def sec(i, a, rf, rs):
        k = 1 + depth * np.tanh(6 * np.cos(teeth * a))
        return rf * np.cos(a) * k, rs * np.sin(a) * k
    m = Loft(path, np.full(n, R), np.full(n, R), p=2.0, segs=teeth * 6, tile=tile, ref=(1, 0, 0), section=sec, cap0=1, cap1=1).mesh()
    return orient_z(m, axis, c)


def box(c, w, h, d, bevel=4.0, tile=.8, segs=8, rot=(0, 0, 0)):
    """Bloc à angles arrondis (largeur x, hauteur y, profondeur z)."""
    n = 6; t = np.linspace(-1, 1, n)
    path = np.stack([np.zeros(n), t * h / 2, np.zeros(n)], 1)
    m = Loft(path, np.full(n, d / 2), np.full(n, w / 2), p=bevel, segs=segs * 3, cap0=1, cap1=1, tile=tile, ref=(0, 0, 1)).mesh()
    xf(m, rx=rot[0], ry=rot[1], rz=rot[2]); m.V += np.asarray(c, float)
    return m


def membrane(root, tips, sag=.35, rows=6, tile=1.2, bulge=0.0):
    """Membrane d'aile : bandes triangulaires entre `root` et la suite de pointes `tips` (liste de points), avec affaissement."""
    root = np.asarray(root, float); tips = [np.asarray(t, float) for t in tips]
    V = []; F = []; UV = []
    cols = len(tips)
    for r in range(rows + 1):
        u = r / rows
        for c in range(cols):
            p = root + (tips[c] - root) * u
            p = p + np.array([0, -sag * np.sin(PI * u) * (0.4 + .6 * (c % 2)) * 0, 0])
            V.append(p); UV.append((p[0] / tile, p[1] / tile))
    # sous-division entre colonnes
    sub = 5
    V = []; UV = []; F = []
    for c in range(cols - 1):
        base = len(V)
        for r in range(rows + 1):
            u = r / rows
            a = root + (tips[c] - root) * u; b = root + (tips[c + 1] - root) * u
            for k in range(sub + 1):
                v = k / sub
                p = a + (b - a) * v
                p = p + np.array([0, -sag * np.sin(PI * v) * u + bulge * np.sin(PI * v) * u, 0]) + np.array([0, 0, -sag * .3 * np.sin(PI * v) * u])
                V.append(p); UV.append((p[0] / tile, p[1] / tile))
        for r in range(rows):
            for k in range(sub):
                i0 = base + r * (sub + 1) + k; i1 = i0 + 1; i2 = i0 + sub + 1; i3 = i2 + 1
                F += [(i0, i2, i1), (i1, i2, i3)]
    return Mesh(np.array(V), np.array(F), np.array(UV))
