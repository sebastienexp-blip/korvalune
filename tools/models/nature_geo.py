"""Géométries de nature (statiques, un seul matériau « nature » + atlas partagé). Y haut, pieds à y=0.
Dimensions calquées sur le rendu procédural du jeu (pin ≈ 7 m, chêne ≈ 5,5 m, bouleau ≈ 4,8 m…) pour garder le même placement/collisions."""
import numpy as np
from glbkit import Mesh, concat, normals
import nature_tex as NT

C_BARK, C_BIRCH, C_ROCK, C_DEAD, C_PINE, C_LEAF, C_GRASS, C_MUSH = range(8)

def uvc(c, u, v, pad=0.025):
    col, row = c % NT.COLS, c // NT.COLS
    return np.stack([(col + pad + np.asarray(u) * (1 - 2 * pad)) / NT.COLS, (row + pad + np.asarray(v) * (1 - 2 * pad)) / NT.ROWS], -1)

def unit(v):
    v = np.asarray(v, float); n = np.linalg.norm(v); return v / n if n > 1e-9 else np.array([0, 1.0, 0])

def frame(t):
    t = unit(t); ref = np.array([1.0, 0, 0]) if abs(t[1]) > 0.9 else np.array([0, 1.0, 0])
    a = unit(np.cross(t, ref)); b = unit(np.cross(t, a)); return a, b

def tube(pts, radii, sides=8, cell=C_BARK, rng=None, noise=0.0, color=(1, 1, 1), cap=False, flare=None):
    pts = np.asarray(pts, float); n = len(pts); radii = np.asarray(radii, float)
    rng = rng or np.random.default_rng(1)
    jit = 1 + noise * (rng.random((n, sides)) - 0.5) * 2
    V, UV = [], []
    for i in range(n):
        t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        a, b = frame(t)
        for k in range(sides + 1):
            ang = 2 * np.pi * k / sides
            V.append(pts[i] + radii[i] * jit[i, k % sides] * (np.cos(ang) * a + np.sin(ang) * b))
            UV.append((k / sides, 1 - i / (n - 1)))
    V = np.array(V); UV = uvc(cell, *np.array(UV).T)
    F = []
    w = sides + 1
    for i in range(n - 1):
        for k in range(sides):
            p, q, r, s = i * w + k, i * w + k + 1, (i + 1) * w + k, (i + 1) * w + k + 1
            F += [(p, r, q), (q, r, s)]
    m = Mesh(V, F, UV)
    m.C = np.tile(list(color) + [1.0], (len(V), 1))
    # orientation : normales vers l'extérieur
    fn = np.cross(V[m.F[:, 1]] - V[m.F[:, 0]], V[m.F[:, 2]] - V[m.F[:, 0]])
    ctr = V[m.F].mean(1); axis = np.array([pts[min(int(f // (2 * sides)), n - 1)] for f in range(len(m.F))])
    if (fn * (ctr - axis)).sum() < 0: m.F = m.F[:, ::-1].copy()
    if cap:
        c0 = len(m.V); top = pts[-1] + unit(pts[-1] - pts[-2]) * 0.0
        ring = V[(n - 1) * w:(n - 1) * w + sides]
        cv = np.vstack([ring, top[None]]); cuv = uvc(cell, 0.5 + 0.0 * np.arange(sides + 1), 0.5 + 0.0 * np.arange(sides + 1))
        cf = [(k, (k + 1) % sides, sides) for k in range(sides)]
        cm = Mesh(cv, cf, cuv); cm.C = np.tile(list(color) + [1.0], (len(cv), 1))
        up = unit(pts[-1] - pts[-2])
        if np.cross(cv[cf[0][1]] - cv[cf[0][0]], cv[cf[0][2]] - cv[cf[0][0]]) @ up < 0: cm.F = cm.F[:, ::-1].copy()
        m = concat([m, cm])
    return m

def card(origin, dirv, upv, L, W, cell, droop=0.0, rows=2, fold=0.0, color=(1, 1, 1), rng=None, jitter=0.0, vflip=False):
    """Carte (quad subdivisé) partant de `origin` vers `dirv` (longueur L), large de W selon dirv×upv. Image : bas = pied de la carte."""
    d = unit(dirv); side = unit(np.cross(d, upv)); 
    V, UV = [], []
    for i in range(rows + 1):
        t = i / rows
        for j in range(3):
            s = (j - 1)
            p = origin + d * L * t + side * (W * 0.5 * s) + np.array([0, 1.0, 0]) * (-droop * t * t) + np.cross(side, d) * 0 
            p = p + unit(np.cross(d, side)) * fold * W * (1 - abs(s)) * (0.4 + t)
            V.append(p); UV.append((0.5 + 0.5 * s, 1 - t))
    F = []
    for i in range(rows):
        for j in range(2):
            a, b, c, e = i * 3 + j, i * 3 + j + 1, (i + 1) * 3 + j, (i + 1) * 3 + j + 1
            F += [(a, b, c), (b, e, c)]
    m = Mesh(np.array(V), F, uvc(cell, *np.array(UV).T))
    m.C = np.tile(list(color) + [1.0], (len(V), 1))
    return m

def round_normals(m, center, up=0.6, axis_only=False):
    c = np.asarray(center, float).copy()
    d = m.V - c
    if axis_only: d[:, 1] = 0
    n = d / (np.linalg.norm(d, axis=1, keepdims=True) + 1e-9)
    n = n + np.array([0, up, 0])
    m.N = n / np.linalg.norm(n, axis=1, keepdims=True)
    return m

def tinted(m, base, var=0.12, rng=None, ao=None):
    rng = rng or np.random.default_rng(0)
    k = 1 + var * (rng.random() * 2 - 1)
    c = np.array(base) * k
    if ao is not None: c = c * ao
    m.C[:, :3] = np.clip(c, 0, 1)
    return m

PAL = {'green': [(0.20, 0.42, 0.14), (0.24, 0.48, 0.16), (0.17, 0.38, 0.12)],
       'light': [(0.42, 0.62, 0.2), (0.5, 0.68, 0.22), (0.36, 0.56, 0.18)],
       'autumn': [(0.78, 0.33, 0.08), (0.85, 0.52, 0.1), (0.62, 0.2, 0.07), (0.82, 0.62, 0.14)],
       'birch': [(0.46, 0.62, 0.2), (0.55, 0.68, 0.22), (0.4, 0.55, 0.16)],
       'bush': [(0.22, 0.42, 0.14), (0.3, 0.5, 0.17), (0.18, 0.36, 0.12)],
       'pine': [(0.13, 0.30, 0.15), (0.16, 0.36, 0.17), (0.11, 0.26, 0.13)]}

def cluster(center, size, cell, pal, rng, ao_c=None, ao_r=1.0, n=3, droop=0.1):
    """Touffe de feuillage : cartes croisées centrées sur `center`."""
    ms = []
    base = PAL[pal][rng.integers(len(PAL[pal]))]
    ao = 1.0
    if ao_c is not None:
        ao = 0.62 + 0.38 * np.clip(np.linalg.norm(center - ao_c) / ao_r, 0, 1)
        ao *= 0.8 + 0.2 * np.clip((center[1] - ao_c[1]) / ao_r + 0.5, 0, 1)
    for k in range(n):
        yaw = rng.uniform(0, np.pi) + k * np.pi / n
        tilt = rng.uniform(-0.5, 0.5) if k < n - 1 else rng.uniform(1.0, 1.4)   # dernière carte presque horizontale
        d = np.array([np.cos(yaw) * np.cos(tilt), np.sin(tilt) * (1 if k < n - 1 else 1), np.sin(yaw) * np.cos(tilt)])
        if k == n - 1: d = np.array([np.cos(yaw) * 0.25, 0.97, np.sin(yaw) * 0.25])
        L = size * rng.uniform(0.9, 1.1)
        up = np.array([0, 1.0, 0]) if abs(d[1]) < 0.8 else np.array([1.0, 0, 0])
        o = center - unit(d) * L * 0.5
        m = card(o, d, up, L, L, cell, droop=droop * size, rows=2, fold=0.05)
        ms.append(round_normals(tinted(m, base, 0.15, rng, ao), ao_c if ao_c is not None else center - np.array([0, 0.3, 0]), 0.5))
    return ms

# ------------------------------------------------------------------------------------------- essences
def pine(lod='hi', seed=1):
    rng = np.random.default_rng(seed); hi = lod == 'hi'
    ys = np.linspace(0, 6.9, 9); rad = 0.27 - 0.23 * (ys / 6.9) ** 1.1
    wob = np.stack([0.04 * np.sin(ys * 1.3), ys, 0.04 * np.cos(ys * 1.1)], 1)
    parts = [tube(wob, rad, 8 if hi else 6, C_BARK, rng, 0.06, color=(0.85, 0.85, 0.85))]
    nt = 7 if hi else 5
    for t in range(nt):
        f = t / (nt - 1); y = 1.6 + 4.7 * f
        L = 2.0 * (1 - f) + 0.7
        na = max(3, int(round((7 if hi else 5) - 3.5 * f)))
        for k in range(na):
            a = 2 * np.pi * k / na + t * 0.8 + rng.uniform(-0.2, 0.2)
            for pitch, Lk, off in ((0.30, L, 0.0), (0.75, L * 0.62, np.pi / na)):
                if not hi and off: continue
                aa = a + off
                d = np.array([np.cos(aa) * np.cos(pitch), -np.sin(pitch), np.sin(aa) * np.cos(pitch)])
                roll = (1 if k % 2 else -1) * 0.7
                up = np.array([0, 1.0, 0]); side = unit(np.cross(d, up)); up2 = unit(up * np.cos(roll) + side * np.sin(roll))
                m = card(np.array([0, y, 0]) + np.array([np.cos(aa), 0, np.sin(aa)]) * 0.1, d, up2, Lk, Lk * 0.95, C_PINE, droop=0.25 * Lk, rows=2, fold=0.04)
                ao = 0.7 + 0.3 * (1 - f * 0.4)
                parts.append(round_normals(tinted(m, PAL['pine'][rng.integers(3)], 0.18, rng, ao * (0.8 + 0.2 * (y / 6.5))), (0, y - 0.8, 0), 0.9, True))
    # cime
    for k in range(2):
        d = np.array([0, 1.0, 0]); yaw = k * np.pi / 2
        side = np.array([np.cos(yaw), 0, np.sin(yaw)])
        m = card(np.array([0, 6.0, 0]), d, np.cross(d, side), 1.5, 0.9, C_PINE, rows=2)
        parts.append(round_normals(tinted(m, PAL['pine'][1], 0.1, rng, 1.0), (0, 5.2, 0), 0.9, True))
    return concat(parts)

def oak(lod='hi', pal='green', seed=2):
    rng = np.random.default_rng(seed); hi = lod == 'hi'
    ys = np.linspace(0, 2.7, 7); rad = np.array([.42, .34, .3, .28, .26, .24, .2])
    wob = np.stack([0.06 * np.sin(ys * 2.1), ys, 0.05 * np.cos(ys * 1.7)], 1)
    parts = [tube(wob, rad, 9 if hi else 6, C_BARK, rng, 0.08)]
    cc = np.array([0, 4.0, 0]); R = np.array([2.2, 1.95, 2.2])
    for k in range(3):   # grosses branches
        a = 2 * np.pi * k / 3 + 0.5
        end = cc + np.array([np.cos(a) * 1.3, -0.2, np.sin(a) * 1.3])
        pts = np.array([[0, 2.2, 0], [np.cos(a) * 0.5, 2.9, np.sin(a) * 0.5], end * 0.85 + np.array([0, 0.1, 0])])
        pts = np.array([wob[-3] + [0, 0, 0], (wob[-1] + end) * 0.5 + [0, 0.15, 0], end])
        parts.append(tube(pts, [0.17, 0.11, 0.05], 6, C_BARK, rng, 0.05))
    n = 40 if hi else 18
    for i in range(n):
        while True:
            p = rng.uniform(-1, 1, 3)
            if np.linalg.norm(p) <= 1 and p[1] > -0.55: break
        c = cc + p * R
        parts += cluster(c, rng.uniform(1.7, 2.3) * (1 if hi else 1.2), C_LEAF, pal, rng, cc, 2.0, n=3 if hi else 2)
    return concat(parts)

def birch(lod='hi', seed=3):
    rng = np.random.default_rng(seed); hi = lod == 'hi'
    ys = np.linspace(0, 4.9, 8); rad = 0.15 - 0.10 * (ys / 4.9)
    wob = np.stack([0.12 * np.sin(ys * 0.9), ys, 0.07 * np.cos(ys * 1.2)], 1)
    parts = [tube(wob, rad, 7 if hi else 5, C_BIRCH, rng, 0.04)]
    cc = np.array([0.05, 3.9, 0]); R = np.array([1.15, 1.5, 1.15])
    for i in range(24 if hi else 10):
        while True:
            p = rng.uniform(-1, 1, 3)
            if np.linalg.norm(p) <= 1 and p[1] > -0.8: break
        parts += cluster(cc + p * R, rng.uniform(1.1, 1.5) * (1 if hi else 1.25), C_LEAF, 'birch', rng, cc, 1.6, n=3 if hi else 2, droop=0.25)
    return concat(parts)

def dead(seed=4):
    rng = np.random.default_rng(seed)
    ys = np.linspace(0, 4.2, 9); rad = 0.24 - 0.2 * (ys / 4.2) ** 0.9
    wob = np.stack([0.18 * np.sin(ys * 1.1), ys, 0.14 * np.cos(ys * 0.9)], 1)
    parts = [tube(wob, rad, 7, C_DEAD, rng, 0.14)]
    for k, (y, a, ln) in enumerate([(1.8, 0.4, 1.4), (2.5, 2.4, 1.5), (3.1, 4.4, 1.2), (3.7, 1.2, 0.9), (2.1, 3.6, 1.0)]):
        i = int(y / 4.2 * 8); o = wob[min(i, 8)]
        d = np.array([np.cos(a), 0.9, np.sin(a)]); d = unit(d)
        pts = [o, o + d * ln * 0.5 + [0, 0.05, 0], o + d * ln + [0.1 * np.cos(a + 1), 0.15, 0.1 * np.sin(a + 1)]]
        parts.append(tube(pts, [0.075, 0.05, 0.012], 5, C_DEAD, rng, 0.1))
        e = pts[1]; d2 = unit(d + np.array([np.cos(a + 1.2), 0.2, np.sin(a + 1.2)]))
        parts.append(tube([e, e + d2 * ln * 0.35, e + d2 * ln * 0.6], [0.04, 0.025, 0.008], 4, C_DEAD, rng, 0.1))
    return concat(parts)

def old_oak(seed=21):
    """Vieux chêne monumental (repères) : tronc massif ≈ 12 m, racines apparentes, grosses branches, couronne ≈ 17 m."""
    rng = np.random.default_rng(seed)
    ys = np.linspace(-0.3, 12, 11); rad = 2.9 - 1.3 * np.clip(ys / 12, 0, 1) ** 0.9
    wob = np.stack([0.35 * np.sin(ys * 0.5), ys, 0.3 * np.cos(ys * 0.45)], 1)
    parts = [tube(wob, rad, 12, C_BARK, rng, 0.1)]
    for k in range(6):
        a = 2 * np.pi * k / 6 + 0.3
        pts = [[np.cos(a) * 1.4, 1.4, np.sin(a) * 1.4], [np.cos(a) * 2.8, 0.45, np.sin(a) * 2.8], [np.cos(a) * 4.4, -0.15, np.sin(a) * 4.4]]
        parts.append(tube(pts, [0.7, 0.45, 0.18], 6, C_BARK, rng, 0.1))
    cc = np.array([0, 14.5, 0]); R = np.array([8.8, 5.2, 8.8])
    for k in range(5):
        a = 2 * np.pi * k / 5 + 0.2
        end = cc + np.array([np.cos(a) * 5.5, -2.0, np.sin(a) * 5.5])
        pts = [wob[-3], (wob[-1] + end) * 0.5 + [0, 0.8, 0], end]
        parts.append(tube(pts, [0.75, 0.45, 0.2], 7, C_BARK, rng, 0.06))
    for i in range(70):
        while True:
            p = rng.uniform(-1, 1, 3)
            if np.linalg.norm(p) <= 1 and p[1] > -0.5: break
        parts += cluster(cc + p * R, rng.uniform(3.8, 5.4), C_LEAF, 'green', rng, cc, 8.0, n=3, droop=0.12)
    return concat(parts)

# ------------------------------------------------------------------------------------------- roches
def _rock_blob(rng, n=110, rough=0.28, flat=0.72, rad=1.0):
    from scipy.spatial import ConvexHull
    i = np.arange(n) + 0.5
    phi = np.arccos(1 - 2 * i / n); th = np.pi * (1 + 5 ** 0.5) * i
    d = np.stack([np.cos(th) * np.sin(phi), np.cos(phi), np.sin(th) * np.sin(phi)], 1)
    k = rng.standard_normal((3, 3)); freq = rng.uniform(1.0, 2.2, 3)
    r = 1 + rough * (np.sin(d @ k[0] * freq[0] * 2) + 0.6 * np.sin(d @ k[1] * freq[1] * 3.1) + 0.3 * rng.standard_normal(n)) * 0.5
    P = d * r[:, None] * rad
    P[:, 1] = np.maximum(P[:, 1] * flat, -0.5 * rad * flat)
    P[:, 1] += 0.5 * rad * flat
    hull = ConvexHull(P)
    return P, hull.simplices

def rock(seed=1, rad=1.0, n=110, rough=0.28, flat=0.72, offset=(0, 0, 0), rot=0.0):
    rng = np.random.default_rng(seed)
    P, S = _rock_blob(rng, n, rough, flat, rad)
    c, s = np.cos(rot), np.sin(rot); P = P @ np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]]).T + np.array(offset)
    ctr = P.mean(0)
    V, F, UV, C = [], [], [], []
    for tri in S:
        a, b, cc = P[tri]
        if np.cross(b - a, cc - a) @ ((a + b + cc) / 3 - ctr) < 0: a, b, cc = a, cc, b
        nrm = unit(np.cross(b - a, cc - a)); ax = np.argmax(np.abs(nrm))
        k = len(V); V += [a, b, cc]; F.append((k, k + 1, k + 2))
        for p in (a, b, cc):
            uvp = [(p[2], p[1]), (p[0], p[2]), (p[0], p[1])][ax]
            UV.append((0.5 + uvp[0] / (3.0 * rad), 0.5 - uvp[1] / (3.0 * rad)))
        up = np.clip(nrm[1], 0, 1); y = (a[1] + b[1] + cc[1]) / 3
        shade = 0.62 + 0.38 * np.clip(y / (1.4 * rad * flat), 0, 1)
        moss = np.clip((nrm[1] - 0.55) * 2.2, 0, 1) * 0.8
        col = np.array([shade * (1 - 0.35 * moss), shade * (1 - 0.05 * moss) , shade * (1 - 0.4 * moss)])
        C += [list(np.clip(col, 0, 1)) + [1]] * 3
    m = Mesh(np.array(V), F, uvc(C_ROCK, *np.array(UV).clip(0, 1).T))
    m.C = np.array(C); return m

def boulder(seed): return rock(seed, 1.0, 110, 0.3, 0.8)

def rock_cluster():
    return concat([rock(11, 0.75, 70, 0.28, 0.8, (0, 0, 0), 0.2), rock(12, 0.5, 60, 0.3, 0.75, (0.85, 0, 0.35), 1.1), rock(13, 0.4, 50, 0.3, 0.7, (-0.5, 0, 0.7), 2.0), rock(14, 0.28, 40, 0.3, 0.7, (0.2, 0, -0.75), 0.6)])

# ------------------------------------------------------------------------------------------- petits éléments
def bush(lod='hi', seed=5):
    rng = np.random.default_rng(seed); parts = []
    cc = np.array([0, 0.55, 0])
    for i in range(10 if lod == 'hi' else 6):
        a = 2 * np.pi * i / 10 + rng.uniform(-0.3, 0.3); r = rng.uniform(0.15, 0.55)
        c = np.array([np.cos(a) * r, rng.uniform(0.3, 0.85), np.sin(a) * r])
        parts += cluster(c, rng.uniform(0.75, 1.05), C_LEAF, 'bush', rng, cc, 0.9, n=2, droop=0.08)
    return concat(parts)

def stump(seed=6):
    rng = np.random.default_rng(seed)
    pts = np.array([[0, -0.05, 0], [0, 0.2, 0], [0.01, 0.52, 0.01]])
    parts = [tube(pts, [0.42, 0.33, 0.30], 9, C_BARK, rng, 0.1, cap=True)]
    for k in range(4):
        a = 1.57 * k + 0.4
        parts.append(tube([[np.cos(a) * 0.15, 0.26, np.sin(a) * 0.15], [np.cos(a) * 0.42, 0.1, np.sin(a) * 0.42], [np.cos(a) * 0.66, -0.04, np.sin(a) * 0.66]], [0.12, 0.08, 0.04], 5, C_BARK, rng, 0.1))
    cap = parts[0]; 
    return concat(parts)

def log(seed=7):
    rng = np.random.default_rng(seed)
    pts = np.array([[-1.35, 0.27, 0], [-0.7, 0.28, 0.02], [0, 0.29, 0], [0.7, 0.28, -0.02], [1.35, 0.26, 0]])
    parts = [tube(pts, [0.2, 0.28, 0.29, 0.28, 0.21], 8, C_BARK, rng, 0.08, cap=True)]
    parts.append(tube([[-0.2, 0.5, 0], [-0.3, 0.75, 0.15], [-0.35, 0.95, 0.3]], [0.07, 0.045, 0.02], 5, C_BARK, rng))
    m = parts[0]
    return concat(parts)

def mushroom(seed=8):
    rng = np.random.default_rng(seed); parts = []
    for (ox, oz, s, hue) in ((0, 0, 1.0, (0.78, 0.24, 0.16)), (0.17, 0.08, 0.6, (0.7, 0.45, 0.22)), (-0.12, 0.14, 0.45, (0.8, 0.3, 0.18))):
        stem = tube([[ox, 0, oz], [ox, 0.1 * s, oz], [ox, 0.2 * s, oz]], [0.04 * s, 0.032 * s, 0.03 * s], 6, C_MUSH, rng, color=(0.95, 0.9, 0.78))
        stem.UV[:] = uvc(C_MUSH, 0.5, 0.92)
        prof = [(0, 0.27), (0.07, 0.265), (0.13, 0.24), (0.18, 0.2), (0.19, 0.17), (0.12, 0.165), (0, 0.17)]
        V, UV = [], []
        for i, (r, y) in enumerate(prof):
            for k in range(9):
                a = 2 * np.pi * k / 8
                V.append((ox + r * s * np.cos(a), y * s, oz + r * s * np.sin(a))); UV.append((k / 8, 0.4 * (1 - i / 6)))
        F = []
        for i in range(len(prof) - 1):
            for k in range(8):
                p, q, r_, t = i * 9 + k, i * 9 + k + 1, (i + 1) * 9 + k, (i + 1) * 9 + k + 1
                F += [(p, q, r_), (q, t, r_)]
        cap = Mesh(np.array(V), F, uvc(C_MUSH, *np.array(UV).T)); cap.C = np.tile(list(hue) + [1], (len(V), 1))
        fn = np.cross(cap.V[cap.F[:, 1]] - cap.V[cap.F[:, 0]], cap.V[cap.F[:, 2]] - cap.V[cap.F[:, 0]])
        if (fn[:, 1] * (cap.V[cap.F].mean(1)[:, 1] - 0.1 * s) ).sum() < 0 : cap.F = cap.F[:, ::-1].copy()
        parts += [stem, cap]
    return concat(parts)

def reed(seed=9):
    rng = np.random.default_rng(seed); parts = []
    for k in range(5):
        yaw = k * np.pi / 5 + rng.uniform(-0.2, 0.2)
        side = np.array([np.cos(yaw), 0, np.sin(yaw)])
        h = rng.uniform(1.1, 1.5)
        m = card(np.array([rng.uniform(-.1, .1), -0.02, rng.uniform(-.1, .1)]), np.array([0.12 * np.cos(yaw + 1.2), 1, 0.12 * np.sin(yaw + 1.2)]), np.cross([0, 1.0, 0], side), h, 0.7, C_GRASS, droop=0.25, rows=3)
        parts.append(round_normals(tinted(m, (0.42, 0.55, 0.25), 0.2, rng, 1.0), (0, -0.5, 0), 0.8, True))
    return concat(parts)

def grass_tuft(seed=10):
    rng = np.random.default_rng(seed); parts = []
    for k in range(3):
        yaw = k * np.pi / 3 + rng.uniform(-0.2, 0.2)
        side = np.array([np.cos(yaw), 0, np.sin(yaw)])
        m = card(np.array([0, 0, 0]), np.array([0.05 * np.cos(yaw + 1), 1, 0.05 * np.sin(yaw + 1)]), np.cross([0, 1.0, 0], side), 0.5, 0.55, C_GRASS, droop=0.1, rows=2)
        parts.append(round_normals(tinted(m, (0.5, 0.62, 0.28), 0.15, rng, 1.0), (0, -0.4, 0), 0.8, True))
    return concat(parts)

# nom → (fabrique, métadonnées)
def catalog():
    items = {}
    for lod in ('hi', 'lo'):
        suf = '' if lod == 'hi' else '_lo'
        items['pin' + suf] = (pine(lod), 'pine', lod)
        for pal, nm in (('green', 'chene'), ('light', 'chene_clair'), ('autumn', 'chene_automne')):
            items[nm + suf] = (oak(lod, pal, 2 + len(nm)), 'oak_' + pal, lod)
        items['bouleau' + suf] = (birch(lod), 'birch', lod)
        items['buisson' + suf] = (bush(lod), 'bush', lod)
    items['arbre_mort'] = (dead(), 'dead', 'hi')
    items['vieux_chene'] = (old_oak(), 'oldoak', 'hi')
    items['rocher_1'] = (boulder(1), 'boulder1', 'hi')
    items['rocher_7'] = (boulder(7), 'boulder7', 'hi')
    items['rocher_amas'] = (rock_cluster(), 'cluster', 'hi')
    items['souche'] = (stump(), 'stump', 'hi')
    items['tronc_couche'] = (log(), 'log', 'hi')
    items['champignon'] = (mushroom(), 'mushroom', 'hi')
    items['roseau'] = (reed(), 'reed', 'hi')
    items['herbe'] = (grass_tuft(), 'grass', 'hi')
    return items
