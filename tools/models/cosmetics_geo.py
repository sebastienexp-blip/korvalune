"""cosmetics_geo — modèles 3D des cosmétiques de la boutique (ailes, couvre-chefs, familiers).
Modules « town » (extras.korvalune.type = 'town') teintés à l'exécution par les rôles de sommets :
  0.8 = couleur principale (fx.color), 0.6 = couleur secondaire (fx.glow / tip), 0.4 = détails (yeux…), 1.0 = fixe.
Convention ailes : UNE aile dans le plan XY, racine à l'origine, étendue vers +X (l'autre aile = miroir scale.x = -1)."""
import numpy as np
from kit import *
from kit import _mk

W_, R_, T_R = ROLE_WALL, ROLE_ROOF, ROLE_TRIM
LIGHT = np.array([0.35, 0.8, 0.5]); LIGHT /= np.linalg.norm(LIGHT)

def _basis(d):
    """Matrice 3×3 dont la colonne Y est d (unitaire)."""
    d = np.asarray(d, float); d = d / (np.linalg.norm(d) + 1e-12)
    a = np.array([1.0, 0, 0]) if abs(d[0]) < 0.9 else np.array([0, 0, 1.0])
    x = np.cross(d, a); x /= np.linalg.norm(x); z = np.cross(x, d)
    return np.stack([x, d, z], 1)

def tube(a, b, r0, r1, mat='metal', color=(1, 1, 1), role=1.0, seg=6, caps=(False, False)):
    a = np.asarray(a, float); b = np.asarray(b, float); d = b - a; h = np.linalg.norm(d)
    M = np.eye(4); M[:3, :3] = _basis(d); M[:3, 3] = a
    return cyl(r0, r1, h, seg, mat, color, role, M=M, caps=caps)

def ell(c, r, mat='flat', color=(1, 1, 1), role=1.0, rot=(0, 0, 0), seg=8, rings=5):
    """Ellipsoïde de demi-axes r=(rx,ry,rz) centré en c, rotation (ry, rx, rz)."""
    M = T_(c, ry=rot[0], rx=rot[1], rz=rot[2]) @ np.diag([r[0], r[1], r[2], 1.0])
    return sphere(1.0, mat, color, role, M=M, seg=seg, rings=rings)

def poly(P, mat='flat', color=(1, 1, 1), role=1.0, tris=None, shade=None):
    """Facettes planes (normales de face). P : sommets ; tris : indices. shade : (l0,l1) éclaire selon la normale (matériau non éclairé)."""
    P = np.asarray(P, float); V, N, F, C = [], [], [], []
    for (i, j, k) in tris:
        p = P[[i, j, k]]; n = np.cross(p[1] - p[0], p[2] - p[0]); ln = np.linalg.norm(n)
        if ln < 1e-12: continue
        n /= ln; b = len(V)
        for q in p: V.append(q); N.append(n)
        F.append((b, b + 1, b + 2))
    UV = [(v[0] * 0.5, -v[1] * 0.5) for v in V]
    m = _mk(V, UV, N, F, color, role)
    if shade:
        lo, hi = shade; f = lo + (hi - lo) * np.clip(np.abs(m.N @ LIGHT), 0, 1)
        m.C[:, :3] = np.asarray(color)[None, :] * f[:, None]
    return m

def lens(p0, p1, w, t, mat='flat', color=(1, 1, 1), role=1.0, up=(0, 0, 1), peak=0.4, shade=None):
    """Lame/plume pointue de p0 à p1, largeur w (±), épaisseur t (±), maximum à `peak`."""
    p0 = np.asarray(p0, float); p1 = np.asarray(p1, float); d = p1 - p0
    side = np.cross(up, d); side /= np.linalg.norm(side) + 1e-12; upv = np.cross(d, side); upv /= np.linalg.norm(upv) + 1e-12
    st = [(0.0, 0.0), (peak * 0.55, 0.78), (peak, 1.0), (peak + (1 - peak) * 0.5, 0.7), (1.0, 0.0)]
    P = [p0]
    for s, k in st[1:-1]:
        c = p0 + d * s
        P += [c + side * w * k, c + upv * t * k, c - side * w * k, c - upv * t * k]
    P.append(p1)
    tris = []
    rings = [list(range(1 + 4 * i, 5 + 4 * i)) for i in range(3)]
    for q in range(4): tris.append((0, rings[0][q], rings[0][(q + 1) % 4]))
    for i in range(2):
        for q in range(4):
            a, b = rings[i][q], rings[i][(q + 1) % 4]; c, e = rings[i + 1][q], rings[i + 1][(q + 1) % 4]
            tris += [(a, c, b), (b, c, e)]
    last = len(P) - 1
    for q in range(4): tris.append((last, rings[2][(q + 1) % 4], rings[2][q]))
    m = poly(P, mat, color, role, tris, shade)
    # orientation : normales vers l'extérieur
    cen = m.V[m.F].mean(1); ctr = (p0 + p1) / 2
    fn = np.cross(m.V[m.F[:, 1]] - m.V[m.F[:, 0]], m.V[m.F[:, 2]] - m.V[m.F[:, 0]])
    flip = (fn * (cen - ctr)).sum(1) < 0
    m.F[flip] = m.F[flip][:, ::-1]
    return m

# ------------------------------------------------------------------------------------------------------ AILES
def wing_angel():
    k = Kit()
    arm = [np.array(p) for p in ((0.0, 0.0, 0), (0.12, 0.34, 0), (0.38, 0.62, 0), (0.78, 0.78, 0), (1.08, 0.62, 0))]
    for a, b, r0, r1 in zip(arm, arm[1:], (0.035, 0.032, 0.03, 0.026), (0.032, 0.03, 0.026, 0.02)):
        k.add('flat', tube(a, b, r0, r1, 'flat', (0.78, 0.7, 0.55), 1.0, seg=6))
    def at(u):
        f = u * (len(arm) - 1); i = min(int(f), len(arm) - 2); t = f - i
        return arm[i] * (1 - t) + arm[i + 1] * t
    n1 = 11  # grandes rémiges
    for i in range(n1):
        u = 0.14 + 0.86 * i / (n1 - 1)
        ang = np.radians(-100 + 78 * u ** 1.1)
        L = 0.98 - 0.5 * u ** 1.4 if u < 0.9 else 0.42
        rt = at(u); d = np.array([np.cos(ang), np.sin(ang), 0])
        k.add('flat', lens(rt, rt + d * L, 0.085, 0.016, 'flat', (1, 1, 1), W_, peak=0.45))
    n2 = 10  # secondaires, plus courtes, légèrement en avant
    for i in range(n2):
        u = 0.1 + 0.8 * i / (n2 - 1)
        ang = np.radians(-95 + 70 * u)
        L = 0.62 - 0.22 * u
        rt = at(u) + np.array([0, -0.02, 0.018]); d = np.array([np.cos(ang), np.sin(ang), 0])
        k.add('flat', lens(rt, rt + d * L, 0.07, 0.014, 'flat', (0.92, 0.92, 0.92), W_, peak=0.45))
    n3 = 9  # petites couvertures, teinte secondaire
    for i in range(n3):
        u = 0.08 + 0.84 * i / (n3 - 1)
        ang = np.radians(-90 + 55 * u)
        rt = at(u) + np.array([0, -0.01, 0.034]); d = np.array([np.cos(ang), np.sin(ang), 0])
        k.add('flat', lens(rt, rt + d * 0.3, 0.052, 0.012, 'flat', (1, 1, 1), R_, peak=0.4))
    return k, {'wing': 'ange'}

def wing_demon():
    k = Kit()
    S = np.array([0, 0, 0.]); E = np.array([0.38, 0.5, 0]); Wr = np.array([0.95, 0.55, 0])
    T1 = np.array([1.08, 0.06, 0]); T2 = np.array([0.86, -0.4, 0]); T3 = np.array([0.34, -0.5, 0]); Rr = np.array([0.04, -0.2, 0])
    bone = (0.16, 0.1, 0.11)
    k.add('flat', tube(S, E, 0.05, 0.04, 'flat', bone, 1.0, seg=6)); k.add('flat', tube(E, Wr, 0.04, 0.03, 'flat', bone, 1.0, seg=6))
    for tip, r in ((T1, 0.022), (T2, 0.022), (T3, 0.02)):
        k.add('flat', tube(Wr, tip, 0.03, 0.01, 'flat', bone, 1.0, seg=5))
    k.add('flat', tube(S, T3 * 0.5 + Rr * 0.5, 0.03, 0.015, 'flat', bone, 1.0, seg=5))
    # petite griffe au poignet
    k.add('flat', lens(Wr + [0, 0.02, 0], Wr + [0.14, 0.2, 0], 0.03, 0.03, 'flat', (1, 1, 1), R_, up=(0, 0, 1)))
    # membrane festonnée
    P = [S, E, Wr, T1, T2, T3, Rr]
    def scallop(A, B, depth=0.2):
        M = (A + B) / 2; M = M + (Wr - M) * depth; M = M + np.array([0, 0, 0.03]); return M
    pts = list(P); tris = [(0, 1, 2), (0, 2, 6)]
    def add(p): pts.append(p); return len(pts) - 1
    for (ia, ib) in ((3, 4), (4, 5), (5, 6)):
        m = add(scallop(pts[ia], pts[ib], 0.16))
        tris += [(2, ia, m), (2, m, ib)]
    tris.append((2, 3, 3)) if False else None
    k.add('flat', poly(pts, 'flat', (1, 1, 1), W_, tris))
    # nervures secondaires teintées (rôle secondaire)
    for tip in (T1, T2, T3):
        k.add('flat', tube(S + [0.05, 0.0, 0.01], tip * 0.82 + Wr * 0.18, 0.012, 0.006, 'flat', (1, 1, 1), R_, seg=4))
    return k, {'wing': 'demon'}

def wing_cristal():
    k = Kit()
    shards = [  # (x0,y0, x1,y1, largeur)
        ((0.02, 0.02), (0.30, 0.66), 0.12), ((0.05, 0.05), (0.62, 0.78), 0.13), ((0.08, 0.05), (0.98, 0.52), 0.13),
        ((0.10, 0.02), (1.02, 0.18), 0.12), ((0.10, 0.0), (0.92, -0.18), 0.12), ((0.08, -0.04), (0.86, -0.42), 0.11),
        ((0.05, -0.05), (0.52, -0.58), 0.10), ((0.03, -0.04), (0.22, -0.62), 0.09), ((0.0, 0.03), (0.1, 0.48), 0.07)]
    for i, ((x0, y0), (x1, y1), w) in enumerate(shards):
        z = 0.02 * (i % 3 - 1)
        k.add('glow', lens([x0, y0, z], [x1, y1, z], w, 0.035, 'glow', (1, 1, 1), W_, peak=0.55, shade=(0.45, 1.0)))
        # pointe plus claire (couleur secondaire) sur la fin du cristal
        d = np.array([x1 - x0, y1 - y0, 0]); p1 = np.array([x1, y1, z]); p0 = p1 - d * 0.32
        k.add('glow', lens(p0 + [0, 0, 0.005], p1 + [0, 0, 0.005], w * 0.45, 0.02, 'glow', (1, 1, 1), R_, peak=0.2, shade=(0.7, 1.15)))
    for (x, y, s) in ((0.28, 0.2, 0.07), (0.55, 0.3, 0.06), (0.5, -0.05, 0.055)):
        k.add('glow', octa(s, 'glow', (1, 1, 1), R_, M=T_((x, y, 0.05)), sy=1.4))
    return k, {'wing': 'cristal'}


def xform(k, M):
    for _, m, _ in k.parts: place(m, M)
    return k

def scaled(fn, sc, M=None):
    k, ex = fn(); xform(k, T_(s=sc) if M is None else M @ T_(s=sc)); return k, ex

GOLD = (1.0, 0.83, 0.29); DARK = (0.1, 0.06, 0.07); PINK = (1.0, 0.69, 0.75)

# ------------------------------------------------------------------------------------------------------ COUVRE-CHEFS (repère tête, y haut, visage vers +z, fixes)
def hat_crown():
    k = Kit(); y0 = 0.13
    k.add('metal', cyl(0.15, 0.14, 0.06, 18, 'metal', GOLD, M=T_((0, y0 - 0.03, 0)), caps=(False, False)))
    k.add('metal', cyl(0.152, 0.152, 0.012, 18, 'metal', (0.9, 0.7, 0.2), M=T_((0, y0 - 0.03, 0)), caps=(False, False)))
    k.add('metal', cyl(0.152, 0.152, 0.012, 18, 'metal', (0.9, 0.7, 0.2), M=T_((0, y0 + 0.021, 0)), caps=(False, False)))
    for i in range(6):
        a = i / 6 * np.pi * 2; x, z = np.cos(a) * 0.146, np.sin(a) * 0.146
        k.add('metal', lens([x, y0 + 0.02, z], [x * 1.03, y0 + 0.14, z * 1.03], 0.032, 0.012, 'metal', GOLD, peak=0.22, up=(-np.sin(a), 0, np.cos(a))))
        k.add('glow', octa(0.014, 'glow', (1, 0.3, 0.4), M=T_((x * 1.02, y0 + 0.14, z * 1.02)), sy=1.2))
    k.add('glow', octa(0.026, 'glow', (1, 0.23, 0.35), M=T_((0, y0 + 0.0, 0.158)), sy=1.2))
    return k, {}

def hat_halo():
    k = Kit()
    k.add('glow', torus(0.16, 0.014, 28, 8, 'glow', (1, 0.91, 0.63), M=T_((0, 0.3, 0))))
    k.add('glow', torus(0.185, 0.006, 28, 6, 'glow', (1, 0.96, 0.8), M=T_((0, 0.3, 0))))
    return k, {}

def hat_horns():
    k = Kit()
    for sx in (1, -1):
        pts = [np.array(p) for p in ((0.10, 0.13, 0.0), (0.135, 0.19, -0.01), (0.15, 0.27, -0.03), (0.135, 0.34, -0.06), (0.1, 0.39, -0.09))]
        rr = (0.04, 0.034, 0.027, 0.018, 0.004)
        for i in range(4):
            a = pts[i] * [sx, 1, 1]; b = pts[i + 1] * [sx, 1, 1]
            k.add('metal', tube(a, b, rr[i], rr[i + 1], 'metal', (0.13, 0.07, 0.08), 1.0, seg=8))
        for i in range(1, 4):  # anneaux
            c = pts[i] * [sx, 1, 1]
            k.add('metal', ell(c, (rr[i] * 1.18, 0.006, rr[i] * 1.18), 'metal', (0.07, 0.04, 0.05), rot=(0, 0, 0), seg=8, rings=3))
    return k, {}

def _ear(sx, x, y, z, h, w, tilt, col, role, inner, innercol, back=0.0):
    out = []
    p0 = np.array([sx * x, y, z]); p1 = p0 + np.array([sx * np.sin(tilt) * h, np.cos(tilt) * h, -back])
    out.append(lens(p0, p1, w, w * 0.28, 'flat', col, role, peak=0.2))
    if inner:
        q0 = p0 + np.array([0, h * 0.04, 0.012]); q1 = p0 + (p1 - p0) * 0.8 + np.array([0, 0, 0.012])
        out.append(lens(q0, q1, w * 0.55, w * 0.1, 'flat', innercol, 1.0, peak=0.22))
    return out

def hat_catears():
    k = Kit()
    for sx in (-1, 1):
        for m in _ear(sx, 0.085, 0.13, -0.01, 0.13, 0.062, 0.25, (0.91, 0.85, 0.72), 1.0, True, PINK): k.add('flat', m)
    return k, {}

def hat_wolfears():
    k = Kit()
    for sx in (-1, 1):
        for m in _ear(sx, 0.09, 0.14, -0.02, 0.16, 0.058, 0.2, (0.23, 0.18, 0.15), 1.0, True, (0.45, 0.35, 0.3)): k.add('flat', m)
    return k, {}

def hat_witch():
    k = Kit(); y0 = 0.12; P = (0.14, 0.09, 0.18)
    k.add('flat', cyl(0.27, 0.26, 0.02, 24, 'flat', P, M=T_((0, y0 - 0.01, 0))))
    k.add('flat', cyl(0.2, 0.3, 0.012, 24, 'flat', (0.12, 0.07, 0.15), M=T_((0, y0 + 0.008, 0)), caps=(False, False)))
    prev = np.array([0, y0 + 0.01, 0.0]); r = 0.15
    # cône courbé : segments successifs, la pointe retombe vers l'arrière
    for i in range(5):
        t = (i + 1) / 5; nxt = np.array([0.0, y0 + 0.01 + 0.4 * t * (1 - 0.1 * t), -0.16 * t ** 2.2])
        r1 = 0.15 * (1 - t) + 0.005
        k.add('flat', tube(prev, nxt, r, r1, 'flat', P, 1.0, seg=14)); prev = nxt; r = r1
    k.add('flat', tube(np.array([0, y0 + 0.01, 0]), np.array([0, y0 + 0.062, -0.002]), 0.153, 0.151, 'flat', (1.0, 0.54, 0.1), 1.0, seg=14))
    k.add('metal', box((0.07, 0.065, 0.012), 'metal', GOLD, M=T_((0, y0 + 0.036, 0.152))))
    k.add('flat', box((0.044, 0.04, 0.014), 'flat', (0.14, 0.09, 0.18), M=T_((0, y0 + 0.036, 0.153))))
    return k, {}

def hat_pumpkin(rad=0.2):
    k = Kit(); ORG = (0.94, 0.54, 0.13)
    for i in range(6):
        a = i / 6 * np.pi
        k.add('flat', ell((0, 0, 0), (rad * 1.08, rad * 0.9, rad * 0.62), 'flat', ORG, rot=(a, 0, 0), seg=12, rings=8))
    k.add('flat', ell((0, 0, 0), (rad * 0.9, rad * 0.82, rad * 0.9), 'flat', (0.8, 0.4, 0.08), seg=10, rings=6))
    k.add('flat', tube([0, rad * 0.85, 0], [0.012, rad * 1.25, -0.01], 0.034, 0.024, 'flat', (0.29, 0.48, 0.16), 1.0, seg=6))
    z = rad * 0.96
    fire = (1.0, 0.76, 0.23)
    k.add('glow', poly([(-0.11, 0.07, z), (-0.03, 0.01, z), (-0.09, -0.01, z)], 'glow', fire, 1.0, [(0, 1, 2)]))
    k.add('glow', poly([(0.11, 0.07, z), (0.09, -0.01, z), (0.03, 0.01, z)], 'glow', fire, 1.0, [(0, 1, 2)]))
    k.add('glow', poly([(-0.12, -0.05, z), (0.12, -0.05, z), (0.06, -0.12, z), (0, -0.08, z), (-0.06, -0.12, z)], 'glow', fire, 1.0, [(0, 2, 1), (0, 3, 2), (0, 4, 3), (0, 1, 2)][:3] + [(0, 1, 3)] if False else [(0, 1, 2), (0, 2, 3), (0, 3, 4)]))
    return k, {}

def catalog():
    d = {'cos_aile_ange': wing_angel(), 'cos_aile_demon': wing_demon(), 'cos_aile_cristal': wing_cristal(),
         'cos_couronne': hat_crown(), 'cos_halo': hat_halo(), 'cos_cornes': hat_horns(), 'cos_oreilles_chat': hat_catears(),
         'cos_oreilles_loup': hat_wolfears(), 'cos_chapeau_sorciere': hat_witch(), 'cos_citrouille': hat_pumpkin()}
    try:
        import cosmetics_pets as CP
        d.update(CP.catalog())
    except ImportError:
        pass
    for k, _ in d.values():   # couleurs fixes écrites « à l'œil » (sRGB) → linéaire pour glTF ; les rôles teintés restent blancs
        for _, m, _ in k.parts:
            fx = m.C[:, 3] > 0.99
            m.C[fx, :3] = np.clip(m.C[fx, :3], 0, 1) ** 2.2
    return d
