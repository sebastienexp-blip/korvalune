"""Armes supplémentaires du Veilleur (V10.44) : hache, masse, lance, hallebarde, cimeterre, marteau de guerre, arbalète, grimoire, baguette.
Même repère que weapons_geo : origine = prise en main, axe long = +Y, lame/tête aplatie dans le plan YZ (épaisseur selon X), face avant = +Z.
Chaque fonction renvoie une liste (nom, Mesh, matériau) ; matériaux : steel, blade, trim, leather, wood, cord, glow."""
import numpy as np
from glbkit import *
from weapons_geo import P, line, tube, blade_section, _grid_mesh

def _orient(m, axis, sign=1):
    """Retourne les facettes si la normale moyenne ne regarde pas dans le sens `sign` de l'axe."""
    fn = np.cross(m.V[m.F[:, 1]] - m.V[m.F[:, 0]], m.V[m.F[:, 2]] - m.V[m.F[:, 0]])
    if fn[:, axis].mean() * sign < 0: m.F = m.F[:, ::-1].copy()
    return m

def plate(zs, yc, H0, Wmax, T0, nu=10, nv=18, beard=0.15, hookn=0.0, grow=0.9, edge_pow=0.6):
    """Plaque de hache : de la douille (z = zs) jusqu'au tranchant ; deux faces (x > 0, x < 0) qui se rejoignent au tranchant."""
    u = np.linspace(0, 1, nu)[None, :]; v = np.linspace(0, 1, nv)[:, None]
    Hh = H0 * (0.45 + 0.55 * u ** grow)
    ze = zs + Wmax * np.clip(1 - (2 * v - 1) ** 2, 0, 1) ** edge_pow * (1 + beard * (1 - v) * 2 - 0.1)
    Y = yc + (v - 0.5) * Hh + hookn * Wmax * u ** 2 * (v - 0.5)
    Z = zs + u * (ze - zs)
    T = T0 * (1 - u) ** 1.1 * (0.30 + 0.70 * np.sin(np.pi * np.clip(v, 0, 1)) ** 0.6) + 0.0007
    fr = _orient(_grid_mesh(T, Y, Z), 0, 1); bk = _orient(_grid_mesh(-T, Y, Z), 0, -1)
    return fr, bk, Z[:, -1], Y[:, -1]

def box(c, size, M=None):
    w, h, d = np.asarray(size, float) / 2; c = np.asarray(c, float)
    V = np.array([[-w, -h, -d], [w, -h, -d], [w, h, -d], [-w, h, -d], [-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d]]) + c
    F = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4), (2, 3, 7), (2, 7, 6), (1, 2, 6), (1, 6, 5), (3, 0, 4), (3, 4, 7)]
    m = Mesh(V, np.array(F), np.zeros((8, 2)))
    return m

def wrapped_grip(y0, y1, r=0.0215, bands=5):
    parts = [('prise', tube(line(P(0, y0, 0), P(0, y1, 0), 10), r, r, mid=r * 1.08, tile=0.1).mesh(), 'leather')]
    for k in range(bands):
        yy = y0 + (y1 - y0) * (k + 0.5) / bands
        parts.append((f'cordon{k}', tube(line(P(0, yy, 0), P(0, yy + 0.006, 0), 3), r * 1.1, tile=0.05).mesh(), 'cord'))
    return parts

def pommel(y, r=0.02):
    return ('pommeau', Loft(line(P(0, y - 0.035, 0), P(0, y + 0.005, 0), 6), prof([(0, r * 0.4), (.45, r), (1, r * 0.8)], 6), prof([(0, r * 0.4), (.45, r), (1, r * 0.8)], 6), p=2.1, segs=12, cap0=2, cap1=1, tile=.1).mesh(), 'trim')

def haft(y0, y1, r=0.0175, taper=0.85, waves=0.004, mat='wood'):
    n = 30; y = np.linspace(y0, y1, n)
    path = np.stack([waves * np.sin(y * 4.0), y, waves * np.sin(y * 2.7 + 1.0)], 1)
    rad = r * (1 + 0.04 * np.sin(y * 11.0)) * (1 - (1 - taper) * np.clip((y - y0) / (y1 - y0), 0, 1))
    return ('fut', Loft(path, rad, rad, p=2.2, segs=12, cap0=1, cap1=1, tile=0.15, ref=(1, 0, 0)).mesh(), mat)

def collar(y, r=0.026, h=0.03):
    return Loft(line(P(0, y - h / 2, 0), P(0, y + h / 2, 0), 4), r, r, p=2.2, segs=14, cap0=2, cap1=2, tile=.1).mesh()

# --------------------------------------------------------------------------------------------- hache
def axe():
    parts = [haft(-0.24, 0.74, 0.0175), *wrapped_grip(-0.14, 0.13), pommel(-0.24, 0.022)]
    fr, bk, ze, ye = plate(0.012, 0.58, 0.30, 0.20, 0.02)
    parts += [('tete_f', fr, 'blade'), ('tete_b', bk, 'blade')]
    parts.append(('douille', collar(0.58, 0.027, 0.22), 'steel'))
    # pointe du dessus + croc arrière (contrepoids)
    parts.append(('pointe', Loft(line(P(0, 0.70, 0), P(0, 0.84, 0), 8), prof([(0, .019), (.6, .012), (1, .0015)], 8), prof([(0, .019), (.6, .012), (1, .0015)], 8), p=2.2, segs=10, cap1=1, tile=.1).mesh(), 'trim'))
    parts.append(('croc', Loft(smoothpath([P(0, 0.58, -0.02), P(0, 0.60, -0.1), P(0, 0.66, -0.15)], 8), prof([(0, .02), (1, .002)], 8), prof([(0, .012), (1, .002)], 8), p=2.3, segs=8, cap1=1, tile=.1, ref=(1, 0, 0)).mesh(), 'steel'))
    # croissant gravé sur la lame
    cn = 14; th = np.linspace(np.deg2rad(210), np.deg2rad(330), cn)
    for s in (1, -1):
        gp = np.stack([np.full(cn, s * 0.0105), 0.58 + 0.07 * np.sin(th) + 0.05, 0.1 + 0.05 * np.cos(th)], 1)
        parts.append((f'gravure{s}', Loft(gp, 0.0022, 0.005 * np.sin(np.linspace(0, np.pi, cn)) ** .7 + 0.0015, p=2.2, segs=6, cap0=1, cap1=1, tile=.05, ref=(1, 0, 0)).mesh(), 'trim'))
    for k, yy in enumerate((0.4, 0.66)):                       # lames de renfort le long du manche
        parts.append((f'langet{k}', tube(line(P(0.019, yy, 0), P(0.019, yy + 0.22, 0), 6), 0.0045, tile=.05).mesh(), 'steel'))
    return parts

# --------------------------------------------------------------------------------------------- masse
def mace():
    parts = [haft(-0.22, 0.56, 0.0175, 0.9, 0.002), *wrapped_grip(-0.13, 0.12), pommel(-0.22, 0.022)]
    cy = 0.66                                                  # tête : noyau renflé + 6 ailettes + pointe
    parts.append(('noyau', Loft(line(P(0, cy - 0.085, 0), P(0, cy + 0.085, 0), 12), prof([(0, .03), (.35, .052), (.7, .052), (1, .028)], 12), prof([(0, .03), (.35, .052), (.7, .052), (1, .028)], 12), p=2.4, segs=14, cap0=2, cap1=2, tile=.1).mesh(), 'steel'))
    for k in range(6):
        a = k * np.pi / 3 + np.pi / 6
        d = P(np.cos(a), 0, np.sin(a)); up = P(0, 1, 0)
        side = np.cross(d, up)
        pts = [P(0, cy - 0.065, 0) + d * 0.04, P(0, cy - 0.04, 0) + d * 0.108, P(0, cy + 0.02, 0) + d * 0.122, P(0, cy + 0.075, 0) + d * 0.052]
        pth = np.array([pts[0], pts[1], pts[2], pts[3]])
        w = prof([(0, .004), (.3, .012), (.7, .011), (1, .004)], 4)
        parts.append((f'ailette{k}', Loft(smoothpath(pth, 12), 0.004, prof([(0, .002), (.35, .0125), (.7, .011), (1, .0015)], 12), p=2.3, segs=8, cap0=1, cap1=1, tile=.05, ref=tuple(np.cross(d, up))).mesh(), 'blade'))
    parts.append(('pointe', Loft(line(P(0, cy + 0.075, 0), P(0, cy + 0.19, 0), 7), prof([(0, .02), (.5, .011), (1, .0015)], 7), prof([(0, .02), (.5, .011), (1, .0015)], 7), p=2.2, segs=10, cap1=1, tile=.1).mesh(), 'trim'))
    parts.append(('collier', collar(cy - 0.09, 0.034, 0.03), 'trim'))
    return parts

# --------------------------------------------------------------------------------------------- marteau de guerre
def warhammer():
    parts = [haft(-0.30, 0.86, 0.0185, 0.88, 0.003), *wrapped_grip(-0.16, 0.15), pommel(-0.30, 0.024)]
    cy = 0.88
    head = box(P(0, cy, 0.0), (0.075, 0.10, 0.075))
    parts.append(('tete', Loft(line(P(0, cy - 0.06, 0), P(0, cy + 0.06, 0), 6), 0.052, 0.052, p=3.2, segs=14, cap0=2, cap1=2, tile=.1).mesh(), 'steel'))
    # face de frappe (cylindre horizontal vers l'avant, +Z) et panne (pointe) à l'arrière
    parts.append(('masse', Loft(line(P(0, cy, 0.0), P(0, cy, 0.17), 6), prof([(0, .052), (.2, .062), (1, .058)], 6), prof([(0, .052), (.2, .062), (1, .058)], 6), p=2.4, segs=16, cap1=2, tile=.1, ref=(1, 0, 0)).mesh(), 'blade'))
    for k in range(8):                                         # clous sur la face
        a = k * np.pi / 4
        parts.append((f'clou{k}', Loft(line(P(0.032 * np.cos(a), cy + 0.032 * np.sin(a), 0.165), P(0.032 * np.cos(a), cy + 0.032 * np.sin(a), 0.178), 3), 0.0065, 0.0065, p=2.1, segs=8, cap1=2, tile=.05, ref=(1, 0, 0)).mesh(), 'trim'))
    parts.append(('panne', Loft(smoothpath([P(0, cy, 0.0), P(0, cy + 0.01, -0.1), P(0, cy + 0.03, -0.2)], 9), prof([(0, .028), (1, .0015)], 9), prof([(0, .03), (1, .0015)], 9), p=2.2, segs=10, cap1=1, tile=.1, ref=(1, 0, 0)).mesh(), 'steel'))
    parts.append(('pointe', Loft(line(P(0, cy + 0.05, 0), P(0, cy + 0.22, 0), 7), prof([(0, .02), (.5, .011), (1, .0015)], 7), prof([(0, .02), (.5, .011), (1, .0015)], 7), p=2.2, segs=10, cap1=1, tile=.1).mesh(), 'trim'))
    parts.append(('collier', collar(cy - 0.07, 0.034, 0.05), 'trim'))
    for s in (1, -1):                                          # cordons de fer le long du manche
        parts.append((f'langet{s}', tube(line(P(s * 0.019, cy - 0.5, 0), P(s * 0.019, cy - 0.07, 0), 8), 0.0045, tile=.05).mesh(), 'steel'))
    return parts

# --------------------------------------------------------------------------------------------- lance
def spear():
    parts = [haft(-0.55, 1.42, 0.0175, 0.88, 0.006), *wrapped_grip(-0.15, 0.14), ('talon', Loft(line(P(0, -0.60, 0), P(0, -0.53, 0), 5), prof([(0, .004), (.5, .024), (1, .02)], 5), prof([(0, .004), (.5, .024), (1, .02)], 5), p=2.2, segs=12, cap0=2, tile=.1).mesh(), 'steel')]
    # fer de lance en feuille
    N = 24; y = np.linspace(1.36, 1.88, N); t = np.linspace(0, 1, N)
    width = 0.048 * np.sin(np.pi * np.clip(t ** 0.7, 0, 1)) ** 0.9 * (1 - 0.1 * t) + 0.0005
    thick = 0.0085 * (1 - 0.5 * t) * np.where(t > 0.9, np.clip((1 - t) / 0.1, 0, 1), 1.0) + 0.0003
    parts.append(('fer', Loft(np.stack([np.zeros(N), y, np.zeros(N)], 1), thick, width, segs=20, section=blade_section, ref=(0, 0, 1), tile=0.2).mesh(), 'blade'))
    parts.append(('douille', Loft(line(P(0, 1.28, 0), P(0, 1.40, 0), 6), prof([(0, .02), (.6, .026), (1, .014)], 6), prof([(0, .02), (.6, .026), (1, .014)], 6), p=2.2, segs=14, cap0=1, tile=.1).mesh(), 'trim'))
    for s in (1, -1):                                          # ailerons (croisillon) en croissant
        gp = smoothpath([P(0, 1.33, s * 0.015), P(0, 1.31, s * 0.05), P(0, 1.35, s * 0.075)], 8)
        parts.append((f'aileron{s}', Loft(gp, prof([(0, .007), (1, .002)], 8), prof([(0, .012), (1, .003)], 8), p=2.3, segs=8, cap1=2, tile=.1, ref=(1, 0, 0)).mesh(), 'steel'))
    # fanion de tissu sombre sous le fer
    for k in range(3):
        pth = smoothpath([P(0.02, 1.22, 0), P(0.1 + 0.02 * k, 1.17 - 0.03 * k, -0.04 * k), P(0.2 + 0.03 * k, 1.1 - 0.06 * k, -0.07 * k)], 9)
        parts.append((f'fanion{k}', Loft(pth, 0.0012, prof([(0, .02), (.4, .028), (1, .004)], 9), p=2.0, segs=6, cap1=1, tile=.1, ref=(0, 0, 1)).mesh(), 'leather'))
    return parts

# --------------------------------------------------------------------------------------------- hallebarde
def halberd():
    parts = [haft(-0.50, 1.28, 0.0185, 0.9, 0.004), *wrapped_grip(-0.15, 0.14), pommel(-0.5, 0.022)]
    fr, bk, ze, ye = plate(0.014, 1.14, 0.34, 0.2, 0.019, grow=0.8)
    parts += [('hache_f', fr, 'blade'), ('hache_b', bk, 'blade')]
    parts.append(('douille', collar(1.14, 0.028, 0.26), 'steel'))
    # pointe de lance au sommet
    N = 18; y = np.linspace(1.26, 1.66, N); t = np.linspace(0, 1, N)
    width = 0.028 * np.sin(np.pi * np.clip(t ** 0.65, 0, 1)) ** 0.9 + 0.0005
    thick = 0.007 * (1 - 0.5 * t) * np.where(t > 0.9, np.clip((1 - t) / 0.1, 0, 1), 1.0) + 0.0003
    parts.append(('pointe', Loft(np.stack([np.zeros(N), y, np.zeros(N)], 1), thick, width, segs=16, section=blade_section, ref=(1, 0, 0), tile=0.2).mesh(), 'blade'))
    parts.append(('manchon', Loft(line(P(0, 1.2, 0), P(0, 1.3, 0), 5), prof([(0, .022), (1, .014)], 5), prof([(0, .022), (1, .014)], 5), p=2.2, segs=12, cap0=1, tile=.1).mesh(), 'trim'))
    # crochet arrière
    parts.append(('crochet', Loft(smoothpath([P(0, 1.14, -0.02), P(0, 1.15, -0.11), P(0, 1.06, -0.18)], 9), prof([(0, .02), (1, .002)], 9), prof([(0, .012), (1, .002)], 9), p=2.3, segs=8, cap1=1, tile=.1, ref=(1, 0, 0)).mesh(), 'steel'))
    for s in (1, -1):
        parts.append((f'langet{s}', tube(line(P(s * 0.02, 0.76, 0), P(s * 0.02, 1.12, 0), 8), 0.0048, tile=.05).mesh(), 'steel'))
    return parts

# --------------------------------------------------------------------------------------------- cimeterre
def scimitar():
    parts = []
    N = 30; t = np.linspace(0, 1, N)
    y = 0.07 + 0.78 * t
    z = 0.13 * t ** 1.8                                        # lame courbée vers l'avant
    path = np.stack([np.zeros(N), y, z], 1)
    width = 0.0275 * (1 + 0.55 * np.sin(np.pi * np.clip(t * 1.1, 0, 1)) ** 0.8) * np.where(t > 0.88, np.clip((1 - t) / 0.12, 0, 1) ** 0.6, 1.0) + 0.0004
    thick = 0.0058 * (1 - 0.45 * t) * np.where(t > 0.93, np.clip((1 - t) / 0.07, 0, 1), 1.0) + 0.0002
    parts.append(('lame', Loft(path, thick, width, segs=22, section=blade_section, ref=(1, 0, 0), tile=0.2).mesh(), 'blade'))
    for s in (1, -1):                                          # garde : quillons en croissant
        gp = smoothpath([P(0, 0.07, s * 0.012), P(0, 0.085, s * 0.045), P(0, 0.115, s * 0.065)], 8)
        parts.append((f'garde{s}', Loft(gp, prof([(0, .007), (1, .003)], 8), prof([(0, .011), (1, .004)], 8), p=2.4, segs=10, cap1=2, tile=.1, ref=(1, 0, 0)).mesh(), 'trim'))
    parts.append(('arceau', Loft(smoothpath([P(0, 0.065, 0.0), P(0.0, 0.03, 0.05), P(0, -0.04, 0.062), P(0, -0.1, 0.03)], 12), 0.0045, 0.0045, p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(1, 0, 0)).mesh(), 'trim'))
    parts.append(('poignee', tube(smoothpath([P(0, -0.1, 0), P(0, -0.015, 0.006), P(0, 0.07, 0)], 10), 0.0155, 0.0155, mid=0.0135, tile=.1).mesh(), 'leather'))
    for k in range(4):
        yy = -0.085 + k * 0.038
        parts.append((f'bague{k}', tube(line(P(0, yy, 0.003), P(0, yy + 0.004, 0.003), 3), 0.0165, tile=.05).mesh(), 'trim'))
    parts.append(pommel(-0.1, 0.02))
    parts.append(('gouttiere', Loft(path[3:-4] + np.array([0.0062, 0, 0]) * 0, 0.0009, 0.0035, p=2.0, segs=6, cap0=1, cap1=1, tile=.1, ref=(1, 0, 0)).mesh(), 'steel'))
    return parts

# --------------------------------------------------------------------------------------------- arbalète
def crossbow():
    """Repère de l'arc : poignée au centre, la flèche part vers +Z, le fût s'étend de -Z (côté archer) à +Z ; arc (prod) selon ±Y."""
    parts = []
    # fût en bois : crosse (épaule), poignée, rail
    sp = smoothpath([P(0, -0.035, -0.28), P(0, -0.012, -0.12), P(0, 0.0, 0.05), P(0, 0.012, 0.28)], 20)
    rad_x = prof([(0, .016), (.3, .014), (.6, .017), (1, .014)], 20); rad_y = prof([(0, .04), (.3, .022), (.6, .024), (1, .018)], 20)
    parts.append(('fut', Loft(sp, rad_x, rad_y, p=2.3, segs=12, cap0=2, cap1=2, tile=.15, ref=(1, 0, 0)).mesh(), 'wood'))
    parts.append(('poignee', Loft(smoothpath([P(0, 0.015, -0.01), P(0, -0.06, -0.02), P(0, -0.12, -0.035)], 8), 0.0135, 0.0165, p=2.3, segs=10, cap1=2, tile=.1, ref=(1, 0, 0)).mesh(), 'leather'))
    parts.append(('rail', Loft(line(P(0, 0.025, -0.02), P(0, 0.025, 0.36), 8), 0.0125, 0.007, p=2.4, segs=10, cap0=1, cap1=1, tile=.1, ref=(1, 0, 0)).mesh(), 'steel'))
    # arc d'acier recourbé monté devant, perpendiculaire (axe Y)
    ys = [-0.34, -0.24, -0.12, 0.0, 0.12, 0.24, 0.34]; zs = [0.17, 0.30, 0.368, 0.38, 0.368, 0.30, 0.17]
    pth = smoothpath([P(0, y, z) for y, z in zip(ys, zs)], 36)
    t = np.linspace(0, 1, 36); m = 1 - np.abs(2 * t - 1)
    parts.append(('arc', Loft(pth, 0.006 + 0.007 * m ** 0.5, 0.011 + 0.006 * m ** 0.5, p=2.4, segs=10, cap0=2, cap1=2, tile=.2, ref=(1, 0, 0)).mesh(), 'steel'))
    # étrier + cordage
    parts.append(('etrier', Loft(smoothpath([P(0, -0.02, 0.35), P(0, -0.03, 0.42), P(0, 0.02, 0.45), P(0, 0.04, 0.37)], 12), 0.0045, 0.0045, p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(1, 0, 0)).mesh(), 'trim'))
    parts.append(('corde', Loft(smoothpath([pth[0], P(0, 0, 0.06), pth[-1]], 16), 0.0016, 0.0016, p=2.0, segs=6, tile=.1, ref=(1, 0, 0)).mesh(), 'cord'))
    parts.append(('carreau', Loft(line(P(0, 0.04, 0.0), P(0, 0.04, 0.4), 6), 0.0045, 0.0045, p=2.1, segs=6, cap1=1, tile=.05, ref=(1, 0, 0)).mesh(), 'wood'))
    parts.append(('pointe', Loft(line(P(0, 0.04, 0.4), P(0, 0.04, 0.455), 4), prof([(0, .009), (1, .0008)], 4), prof([(0, .009), (1, .0008)], 4), p=2.1, segs=6, cap1=1, tile=.05, ref=(1, 0, 0)).mesh(), 'blade'))
    parts.append(('noix', Loft(line(P(-0.012, 0.03, 0.045), P(0.012, 0.03, 0.045), 3), 0.017, 0.017, p=2.2, segs=10, cap0=2, cap1=2, tile=.05, ref=(0, 1, 0)).mesh(), 'trim'))
    # croissant sur la crosse
    cn = 12; th = np.linspace(np.deg2rad(200), np.deg2rad(340), cn)
    gp = np.stack([np.full(cn, 0.0175), -0.03 + 0.03 * np.sin(th), -0.2 + 0.03 * np.cos(th)], 1)
    parts.append(('croissant', Loft(gp, 0.002, 0.004 * np.sin(np.linspace(0, np.pi, cn)) ** .7 + 0.0012, p=2.2, segs=6, cap0=1, cap1=1, tile=.05, ref=(1, 0, 0)).mesh(), 'trim'))
    return parts

# --------------------------------------------------------------------------------------------- grimoire
def tome():
    """Grimoire fermé, tenu par la tranche (la prise de la main est au bas du dos). Origine = prise ; couverture face à +Z, dos vers -X."""
    parts = []
    W, H, D = 0.17, 0.24, 0.05
    cy = 0.14
    parts.append(('livre', box(P(0, cy, 0), (D, H, W)), 'leather'))
    # pages (tranche claire) : légèrement en retrait
    parts.append(('pages', box(P(0.003, cy, 0.0), (D - 0.012, H - 0.012, W - 0.006)), 'cord'))
    for sx in (1, -1):
        parts.append((f'plat{sx}', box(P(sx * (D / 2 + 0.004), cy, 0.0), (0.008, H + 0.008, W + 0.008)), 'leather'))
    # coins métalliques + nervures de reliure sur le dos
    for sy in (-1, 1):
        for sz in (-1, 1):
            parts.append((f'coin{sy}{sz}', box(P(0.0, cy + sy * (H / 2 - 0.01), sz * (W / 2 - 0.01)), (D + 0.02, 0.026, 0.026)), 'trim'))
    for k in range(4):
        parts.append((f'nervure{k}', box(P(-D / 2 - 0.012, cy - 0.08 + k * 0.053, 0.0), (0.008, 0.008, W + 0.01)), 'trim'))
    # fermoir en croissant sur la couverture (+X est la face de dessus de l'objet une fois tenu : on met le motif sur les deux plats)
    for sx in (1, -1):
        cn = 16; th = np.linspace(np.deg2rad(200), np.deg2rad(340), cn)
        gp = np.stack([np.full(cn, sx * (D / 2 + 0.011)), cy + 0.03 * np.sin(th) * 1.0 + 0.0, 0.045 * np.cos(th)], 1)
        parts.append((f'croissant{sx}', Loft(gp, 0.003, 0.007 * np.sin(np.linspace(0, np.pi, cn)) ** .7 + 0.002, p=2.2, segs=6, cap0=1, cap1=1, tile=.05, ref=(1, 0, 0)).mesh(), 'trim'))
        parts.append((f'sceau{sx}', Loft(line(P(sx * (D / 2 + 0.008), cy - 0.025, 0), P(sx * (D / 2 + 0.02), cy - 0.025, 0), 3), 0.014, 0.014, p=2.3, segs=7, cap1=1, tile=.05, ref=(0, 1, 0)).mesh(), 'glow'))
    # sangle de prise (cuir) au bas du livre
    parts.append(('sangle', box(P(-D / 2 - 0.002, 0.02, 0.0), (0.012, 0.05, W + 0.01)), 'leather'))
    return parts

# --------------------------------------------------------------------------------------------- baguette (orbe magique)
def wand():
    parts = []
    n = 24; y = np.linspace(-0.12, 0.40, n)
    path = np.stack([0.004 * np.sin(y * 9), y, 0.004 * np.cos(y * 7)], 1)
    rad = 0.0125 * (1 - 0.45 * np.clip((y + 0.1) / 0.5, 0, 1)) * (1 + 0.1 * np.sin(y * 28))
    parts.append(('fut', Loft(path, rad, rad, p=2.2, segs=10, cap0=1, cap1=1, tile=.1, ref=(1, 0, 0)).mesh(), 'wood'))
    parts += wrapped_grip(-0.1, 0.08, 0.0165, 3)
    parts.append(pommel(-0.12, 0.016))
    cp = P(0, 0.47, 0)
    parts.append(('cristal', Loft(line(cp + P(0, -0.055, 0), cp + P(0, 0.07, 0), 9), prof([(0, .002), (.25, .024), (.6, .03), (1, .002)], 9), prof([(0, .002), (.25, .024), (.6, .03), (1, .002)], 9), p=2.6, segs=6, cap0=1, cap1=1, tile=.05).mesh(), 'glow'))
    for k in range(3):
        a = k * 2 * np.pi / 3 + 0.4
        pp = smoothpath([P(0.005 * np.cos(a), 0.385, 0.005 * np.sin(a)), P(0.03 * np.cos(a), 0.43, 0.03 * np.sin(a)), P(0.024 * np.cos(a), 0.52, 0.024 * np.sin(a))], 10)
        parts.append((f'griffe{k}', tube(pp, 0.0055, 0.002, cap=1, segs=6, tile=.05).mesh(), 'steel'))
    parts.append(('collier', tube(line(P(0, 0.375, 0), P(0, 0.392, 0), 3), 0.019, tile=.05).mesh(), 'trim'))
    return parts

NEW = {'axe': axe, 'mace': mace, 'warhammer': warhammer, 'spear': spear, 'halberd': halberd, 'scimitar': scimitar, 'crossbow': crossbow, 'tome': tome, 'wand': wand}
