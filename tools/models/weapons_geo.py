"""Armes et objets secondaires du Veilleur : dague, bâton, arc, bouclier, orbe, carquois.
Chaque fonction renvoie une liste (nom, Mesh, matériau). Repère local : origine à la prise en main, axe long = +Y,
face avant (ce qui regarde l'ennemi) = +Z. Unités : mètres. Toutes les formes sont des balayages (lofts) ou des surfaces paramétriques."""
import numpy as np
from glbkit import *

def P(*pts): return np.array(pts, float)
def line(a, b, n=6): return smoothpath([a, b], n)
def tube(path, r0, r1=None, p=2.2, segs=12, cap=1, tile=0.1, ref=(1, 0, 0), mid=None):
    n = len(path); r1 = r0 if r1 is None else r1
    rr = prof([(0, r0), (1, r1)] if mid is None else [(0, r0), (0.5, mid), (1, r1)], n)
    return Loft(path, rr, rr, p=p, segs=segs, cap0=cap, cap1=cap, tile=tile, ref=ref)

# ------------------------------------------------------------------------------------------------ dague
def blade_section(i, a, rf, rs):
    z = rs * np.cos(a); s = np.sign(np.sin(a)); w = np.abs(z) / max(rs, 1e-9)
    t = rf * (1 - w) ** 0.8
    return s * np.maximum(t - 0.4 * rf * np.exp(-(z / (0.3 * rs + 1e-9)) ** 2) * (1 - w), 0.0003), z

def dagger():
    parts = []
    N = 22; y = np.linspace(0.07, 0.40, N); t = np.linspace(0, 1, N)
    width = 0.021 * (1 - 0.35 * t) * np.where(t > 0.8, np.clip((1 - t) / 0.2, 0, 1) ** 0.7, 1.0) + 0.0004
    thick = 0.0052 * (1 - 0.4 * t) * np.where(t > 0.9, np.clip((1 - t) / 0.1, 0, 1), 1.0) + 0.0002
    # lame légèrement recourbée vers l'avant
    bp = np.stack([np.zeros(N), y, 0.012 * t ** 2.2], 1)
    parts.append(('lame', Loft(bp, thick, width, segs=20, section=blade_section, ref=(0, 0, 1), tile=0.2).mesh(), 'blade'))
    # garde : deux ailes de corbeau inclinées
    for s in (1, -1):
        gp = smoothpath([P(0, 0.07, 0), P(s * 0.03, 0.062, 0), P(s * 0.058, 0.074, 0)], 8)
        parts.append((f'garde{s}', Loft(gp, prof([(0, .008), (1, .003)], 8), prof([(0, .012), (1, .004)], 8), p=2.4, segs=10, cap1=2, tile=.1, ref=(0, 0, 1)).mesh(), 'trim'))
    parts.append(('poignee', tube(line(P(0, -0.075, 0), P(0, 0.07, 0), 8), 0.0155, 0.0155, mid=0.0135, tile=0.1).mesh(), 'leather'))
    for k in range(4):
        yy = -0.055 + k * 0.034
        parts.append((f'bague{k}', tube(line(P(0, yy, 0), P(0, yy + 0.004, 0), 3), 0.0168, tile=0.05).mesh(), 'trim'))
    pm = Loft(line(P(0, -0.1, 0), P(0, -0.07, 0), 6), prof([(0, .008), (.5, .019), (1, .015)], 6), prof([(0, .008), (.5, .019), (1, .015)], 6), p=2.1, segs=12, cap0=2, tile=.1)
    parts.append(('pommeau', pm.mesh(), 'trim'))
    return parts

# ------------------------------------------------------------------------------------------------ bâton
def staff():
    parts = []
    # fût en bois noueux, légèrement ondulé ; prise au centre de la partie cuir
    n = 40; y = np.linspace(-0.62, 1.12, n)
    path = np.stack([0.012 * np.sin(y * 5.0), y, 0.010 * np.sin(y * 3.3 + 1.0)], 1)
    rad = 0.0175 + 0.0035 * np.sin(y * 9.0) ** 2 - 0.004 * np.clip((y - 0.6) / 0.5, 0, 1)
    parts.append(('fut', Loft(path, rad, rad, p=2.2, segs=12, cap0=1, tile=0.15, ref=(1, 0, 0)).mesh(), 'wood'))
    parts.append(('prise', tube(line(P(0.0, -0.15, 0), P(0.0, 0.15, 0), 10), 0.0215, 0.0215, mid=0.0235, tile=0.1).mesh(), 'leather'))
    for yy in (-0.16, 0.16):
        parts.append((f'collier{yy}', tube(line(P(0, yy, 0), P(0, yy + 0.012, 0), 3), 0.0245, tile=0.05).mesh(), 'trim'))
    # sabot d'acier au pied
    parts.append(('sabot', Loft(line(P(0.012 * np.sin(-0.62 * 5), -0.64, 0), P(0.012 * np.sin(-0.62 * 5), -0.50, 0), 6), prof([(0, .006), (.3, .02), (1, .022)], 6), prof([(0, .006), (.3, .02), (1, .022)], 6), p=2.2, segs=12, cap0=2, tile=.1).mesh(), 'steel'))
    # tête : deux cornes en croissant (ailes de corbeau) enserrant une pierre de lune
    top = P(0.012 * np.sin(1.12 * 5), 1.12, 0.010 * np.sin(1.12 * 3.3 + 1.0))
    for s in (1, -1):
        hp = smoothpath([top + P(0, -0.02, 0), top + P(s * 0.05, 0.05, 0), top + P(s * 0.075, 0.15, 0), top + P(s * 0.04, 0.26, 0), top + P(s * 0.005, 0.30, 0)], 18)
        r = prof([(0, .017), (.5, .013), (1, .0025)], 18)
        parts.append((f'corne{s}', Loft(hp, r, r * 1.15, p=2.3, segs=10, cap1=2, tile=.1, ref=(0, 0, 1)).mesh(), 'trim'))
    cp = top + P(0, 0.165, 0)
    cr = Loft(line(cp + P(0, -0.075, 0), cp + P(0, 0.085, 0), 9), prof([(0, .002), (.22, .029), (.7, .031), (1, .002)], 9), prof([(0, .002), (.22, .029), (.7, .031), (1, .002)], 9), p=2.6, segs=6, cap0=1, cap1=1, tile=.05)
    parts.append(('pierre', cr.mesh(), 'glow'))
    for k in range(3):                                     # griffes de retenue
        a = k * 2 * np.pi / 3 + 0.5
        pp = smoothpath([cp + P(0.0, -0.085, 0), cp + P(0.042 * np.cos(a), -0.03, 0.042 * np.sin(a)), cp + P(0.03 * np.cos(a), 0.085, 0.03 * np.sin(a))], 10)
        parts.append((f'griffe{k}', tube(pp, 0.007, 0.0025, cap=1, segs=8, tile=.05).mesh(), 'steel'))
    # plumes pendantes
    for s, (dx, dz) in enumerate(((0.03, 0.0), (-0.03, 0.01))):
        pth = smoothpath([top + P(dx, 0.0, dz), top + P(dx * 1.8, -0.08, dz + 0.03), top + P(dx * 2.4, -0.2, dz + 0.04)], 10)
        parts.append((f'plume{s}', Loft(pth, 0.0012, prof([(0, .004), (.3, .016), (1, .002)], 10), p=2.0, segs=6, cap1=1, tile=.1, ref=(0, 0, 1)).mesh(), 'leather'))
    return parts

# ------------------------------------------------------------------------------------------------ arc
def bow():
    parts = []
    ys = [-0.64, -0.48, -0.26, -0.08, 0.0, 0.08, 0.26, 0.48, 0.64]
    zs = [-0.20, -0.105, -0.028, -0.002, 0.0, -0.002, -0.028, -0.105, -0.20]
    # les pointes se recourbent vers l'avant (+Z) : recurve
    zs[0] = zs[-1] = -0.17
    path = smoothpath([P(0, y, z) for y, z in zip(ys, zs)], 48)
    t = np.linspace(0, 1, 48); m = 1 - np.abs(2 * t - 1)
    rf = 0.007 + 0.009 * (m ** 0.6); rs = 0.012 + 0.010 * (m ** 0.5)
    parts.append(('branches', Loft(path, rf, rs, p=2.4, segs=10, cap0=2, cap1=2, tile=.2, ref=(0, 0, 1)).mesh(), 'wood'))
    # poignée cuir + manchon
    parts.append(('poignee', tube(line(P(0, -0.1, 0.0), P(0, 0.1, 0.0), 10), 0.0195, 0.0195, mid=0.0225, tile=.1).mesh(), 'leather'))
    # arrêts métalliques aux pointes (têtes de corbeau stylisées)
    for s in (1, -1):
        tip = path[0] if s < 0 else path[-1]
        d = (path[1] - path[0]) if s < 0 else (path[-2] - path[-1])
        d = d / np.linalg.norm(d)
        cap = Loft(smoothpath([tip + d * 0.06, tip, tip - d * 0.012], 7), prof([(0, .0125), (.8, .0075), (1, .003)], 7), prof([(0, .016), (.8, .01), (1, .004)], 7), p=2.4, segs=10, cap1=2, tile=.1, ref=(1, 0, 0))
        parts.append((f'pointe{s}', cap.mesh(), 'trim'))
    # croissant de lune sur le haut de poignée
    cn = 16; th = np.linspace(np.deg2rad(200), np.deg2rad(340), cn)
    gp = np.stack([np.zeros(cn), 0.135 + 0.05 * np.sin(th) + 0.05, 0.05 * np.cos(th)], 1)
    parts.append(('croissant', Loft(gp, 0.006, 0.0075 * np.sin(np.linspace(0, np.pi, cn)) ** .7 + .0025, p=2.2, segs=8, cap0=2, cap1=2, tile=.1, ref=(1, 0, 0)).mesh(), 'trim'))
    # corde
    a, b = path[0] - np.array([0, 0, 0.0]), path[-1]
    cord = Loft(smoothpath([a, P(0, 0, -0.205), b], 14) if False else line(a, b, 14), 0.0016, 0.0016, p=2.0, segs=6, tile=.1, ref=(1, 0, 0))
    parts.append(('corde', cord.mesh(), 'cord'))
    return parts

# ------------------------------------------------------------------------------------------------ bouclier
def _grid_mesh(X, Y, Z, flip=False):
    R, C = X.shape
    V = np.stack([X, Y, Z], -1).reshape(-1, 3)
    UV = np.stack([X.ravel() / 0.4, Y.ravel() / 0.4], 1)
    idx = np.arange(R * C).reshape(R, C)
    a, b, c, d = idx[:-1, :-1].ravel(), idx[:-1, 1:].ravel(), idx[1:, :-1].ravel(), idx[1:, 1:].ravel()
    F = np.concatenate([np.stack([a, c, b], 1), np.stack([b, c, d], 1)])
    if flip: F = F[:, ::-1]
    return Mesh(V, F, UV)

def shield():
    """Écu en amande (kite), bombé, avec bordure, ombilic et croissant de lune. Origine = centre de l'écu, face vers +Z."""
    parts = []
    H, nv, nx = 0.56, 26, 15
    v = np.linspace(0, 1, nv)                       # 0 = haut, 1 = pointe
    w = 0.205 * np.where(v < 0.32, np.sin(np.clip(v / 0.32, 0, 1) * np.pi / 2) ** 0.55 * 0.2 + 0.8 + 0.2 * (v / 0.32), 1.0) * (1 - np.clip((v - 0.3) / 0.7, 0, 1) ** 1.35) + 0.0
    w = np.maximum(w, 0.0012)
    u = np.linspace(-1, 1, nx)
    X = np.outer(w, u); Y = np.tile((0.18 - v * H)[:, None], (1, nx))
    # bombé : plus haut au centre et sur l'axe vertical
    Z = 0.045 * (1 - u[None, :] ** 2) * (1 - 0.5 * v[:, None] ** 1.5) + 0.012 * (1 - v[:, None])
    front = _grid_mesh(X, Y, Z)
    back = _grid_mesh(X * 0.985, Y, Z - 0.014, flip=True)
    # tranche : relie le contour avant/arrière
    def contour(M_X, M_Y, M_Z):
        L = [(M_X[i, 0], M_Y[i, 0], M_Z[i, 0]) for i in range(nv)]
        Rr = [(M_X[i, -1], M_Y[i, -1], M_Z[i, -1]) for i in range(nv - 1, -1, -1)]
        T = [(M_X[0, j], M_Y[0, j], M_Z[0, j]) for j in range(nx - 1, -1, -1)]
        return np.array(L[:] + T[1:] if False else L + Rr[1:])
    cf = contour(X, Y, Z); cb = contour(X * 0.985, Y, Z - 0.014)
    n = len(cf)
    V = np.vstack([cf, cb]); UV = np.zeros((2 * n, 2))
    F = []
    for i in range(n - 1):
        F += [[i, i + n, i + 1], [i + 1, i + n, i + n + 1]]
    edge = Mesh(V, np.array(F), UV)
    body = concat([front, back, edge])
    # orientation : la face avant doit regarder +Z
    fn = np.cross(front.V[front.F[:, 1]] - front.V[front.F[:, 0]], front.V[front.F[:, 2]] - front.V[front.F[:, 0]])
    if fn[:, 2].mean() < 0:
        front.F = front.F[:, ::-1].copy(); back.F = back.F[:, ::-1].copy(); edge.F = edge.F[:, ::-1].copy()
        body = concat([front, back, edge])
    parts.append(('ecu', body, 'steel'))
    # bordure en métal sombre : balayage le long du contour (ouvert à la pointe)
    ring = np.array([(x, y, z + 0.004) for (x, y, z) in cf])
    ring = ring[2:-2]
    parts.append(('bordure', Loft(ring, 0.0085, 0.0095, p=2.2, segs=8, tile=.1, ref=(0, 0, 1)).mesh(), 'trim'))
    # ombilic central
    parts.append(('ombilic', Loft(line(P(0, 0.02, 0.05), P(0, 0.02, 0.075), 6), prof([(0, .045), (.5, .036), (1, .008)], 6), prof([(0, .045), (.5, .036), (1, .008)], 6), p=2.1, segs=14, cap1=2, tile=.1, ref=(1, 0, 0)).mesh(), 'trim'))
    # croissant de lune en relief au-dessus de l'ombilic
    cn = 22; th = np.linspace(np.deg2rad(205), np.deg2rad(335), cn)
    gp = np.stack([0.085 * np.cos(th), 0.115 + 0.085 * np.sin(th) + 0.06, np.full(cn, 0.058)], 1)
    parts.append(('croissant', Loft(gp, 0.005, 0.011 * np.sin(np.linspace(0, np.pi, cn)) ** .7 + 0.003, p=2.2, segs=8, cap0=2, cap1=2, tile=.1, ref=(0, 0, 1)).mesh(), 'trim'))
    # clous de bordure
    for k in range(10):
        yy = 0.17 - k * 0.048; i = int(round((0.17 - yy) / H * (nv - 1)))
        for s in (-1, 1):
            xx = s * (w[i] * 0.86); zz = Z[i, 0 if s < 0 else -1] * 0.35 + 0.0
            zz = 0.045 * (1 - 0.86 ** 2) * (1 - 0.5 * v[i] ** 1.5) + 0.012 * (1 - v[i]) + 0.005
            parts.append((f'clou{k}_{s}', Loft(line(P(xx, yy, zz), P(xx, yy, zz + 0.012), 3), 0.007, 0.007, p=2.1, segs=8, cap1=2, tile=.05, ref=(1, 0, 0)).mesh(), 'steel'))
    # poignée / sangle côté intérieur (visible de côté)
    parts.append(('sangle', Loft(line(P(0, 0.07, -0.05), P(0, -0.08, -0.05), 8), 0.012, 0.03, p=3.0, segs=10, cap0=1, cap1=1, tile=.1, ref=(0, 0, 1)).mesh(), 'leather'))
    return parts

# ------------------------------------------------------------------------------------------------ orbe
def orb():
    """Cristal de lune à facettes dans une cage de griffes d'acier, tenu dans la paume. Origine = centre du cristal."""
    parts = []
    parts.append(('cristal', Loft(line(P(0, -0.085, 0), P(0, 0.085, 0), 11), prof([(0, .002), (.2, .042), (.55, .05), (.85, .028), (1, .002)], 11), prof([(0, .002), (.2, .042), (.55, .05), (.85, .028), (1, .002)], 11), p=2.5, segs=7, cap0=1, cap1=1, tile=.05).mesh(), 'glow'))
    for k in range(4):
        a = k * np.pi / 2 + 0.4
        pp = smoothpath([P(0.012 * np.cos(a), -0.1, 0.012 * np.sin(a)), P(0.062 * np.cos(a), -0.03, 0.062 * np.sin(a)), P(0.065 * np.cos(a), 0.05, 0.065 * np.sin(a)), P(0.022 * np.cos(a), 0.11, 0.022 * np.sin(a))], 14)
        parts.append((f'griffe{k}', tube(pp, 0.0085, 0.003, cap=1, segs=8, tile=.05).mesh(), 'steel'))
    parts.append(('socle', Loft(line(P(0, -0.125, 0), P(0, -0.095, 0), 5), prof([(0, .012), (.6, .032), (1, .022)], 5), prof([(0, .012), (.6, .032), (1, .022)], 5), p=2.2, segs=12, cap0=2, tile=.1).mesh(), 'trim'))
    return parts

# ------------------------------------------------------------------------------------------------ carquois
def quiver():
    """Carquois de cuir avec flèches empennées. Origine = centre du tube, ouverture vers +Y."""
    parts = []
    parts.append(('tube', Loft(line(P(0, -0.3, 0), P(0, 0.26, 0), 12), prof([(0, .032), (.6, .05), (1, .056)], 12), prof([(0, .032), (.6, .05), (1, .056)], 12), p=2.3, segs=14, cap0=2, tile=.15, ref=(1, 0, 0)).mesh(), 'leather'))
    parts.append(('bord', tube(line(P(0, 0.245, 0), P(0, 0.275, 0), 4), 0.0605, tile=.1, segs=14, cap=0).mesh(), 'trim'))
    parts.append(('bande', tube(line(P(0, -0.06, 0), P(0, -0.035, 0), 4), 0.0535, tile=.1, segs=14, cap=0).mesh(), 'trim'))
    rng = np.random.RandomState(7)
    for k in range(6):
        a = k * 2 * np.pi / 6 + 0.3; r = 0.02 + 0.012 * (k % 2)
        x, z = r * np.cos(a), r * np.sin(a); lean = 0.05 * (k % 3 - 1)
        sh = smoothpath([P(x, 0.2, z), P(x + lean * 0.5, 0.33, z), P(x + lean, 0.45, z)], 8)
        parts.append((f'fleche{k}', tube(sh, 0.0042, 0.0042, cap=1, segs=6, tile=.05).mesh(), 'wood'))
        fl = smoothpath([P(x + lean * 0.78, 0.38, z), P(x + lean * 0.92, 0.42, z), P(x + lean, 0.465, z)], 6)
        for s in (0, 1):
            ang = s * np.pi / 2
            parts.append((f'plume{k}_{s}', Loft(fl, 0.0008, prof([(0, .003), (.4, .011), (1, .004)], 6), p=2.0, segs=6, cap1=1, tile=.05, ref=(np.cos(ang), 0, np.sin(ang))).mesh(), 'leather'))
    return parts

# ------------------------------------------------------------------------------------------------ massue (ennemis)
def club(big=1.0):
    """Massue de bois cloutée. Origine = prise ; tête vers +Y."""
    parts = []
    n = 20; y = np.linspace(-0.12, 0.78 * big, n); t = np.linspace(0, 1, n)
    r = 0.018 + 0.05 * big * np.clip((t - 0.35) / 0.65, 0, 1) ** 1.5 * (1 - 0.25 * np.clip((t - 0.9) / 0.1, 0, 1))
    path = np.stack([0.006 * np.sin(y * 7), y, 0.006 * np.cos(y * 5)], 1)
    parts.append(('massue', Loft(path, r, r * 0.95, p=2.2, segs=12, cap0=1, cap1=2, tile=0.2, ref=(1, 0, 0)).mesh(), 'wood'))
    parts.append(('prise', tube(line(P(0, -0.1, 0), P(0, 0.1, 0), 8), 0.0225, 0.0225, mid=0.0245, tile=.1).mesh(), 'leather'))
    for k in range(7):
        a = k * 2.4; yy = (0.5 + 0.045 * (k % 4)) * big
        rr = (0.018 + 0.05 * big * np.clip(((yy + 0.12) / (0.9 * big) - 0.35) / 0.65, 0, 1) ** 1.5) * 0.95 + 0.002
        base = P(rr * np.cos(a), yy, rr * np.sin(a)); tip = P((rr + 0.03) * np.cos(a), yy + 0.006, (rr + 0.03) * np.sin(a))
        parts.append((f'clou{k}', tube(line(base, tip, 4), 0.011, 0.002, cap=0, segs=6, tile=.05).mesh(), 'steel'))
    return parts
