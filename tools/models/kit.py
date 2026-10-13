"""kit — primitives « dur » (boîtes, cylindres, cônes, toits, sphères…) avec UV métriques (texture tuilée), normales plates/lisses explicites
et couleurs de sommets (RGB = teinte, A = rôle : 1 fixe, 0.8 mur, 0.6 toit, 0.4 volets/ornements de la couleur du toit)."""
import numpy as np
from glbkit import Mesh, concat

ROLE_FIXED, ROLE_WALL, ROLE_ROOF, ROLE_TRIM = 1.0, 0.8, 0.6, 0.4
TILE = {'plaster': 3.0, 'tuile': 2.0, 'pierre': 3.0, 'bois': 1.5, 'cloth': 1.0, 'metal': 2.0, 'window': 1.0, 'glow': 1.0, 'water': 4.0}

def T_(t=(0, 0, 0), ry=0.0, rx=0.0, rz=0.0, s=1.0):
    def R(ax, a):
        c, s_ = np.cos(a), np.sin(a)
        return {'x': np.array([[1, 0, 0], [0, c, -s_], [0, s_, c]]), 'y': np.array([[c, 0, s_], [0, 1, 0], [-s_, 0, c]]), 'z': np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]])}[ax]
    M = np.eye(4); M[:3, :3] = R('y', ry) @ R('x', rx) @ R('z', rz) * s; M[:3, 3] = t
    return M

def place(m, M):
    if M is None: return m
    M = np.asarray(M, float); A = M[:3, :3]
    m.V = m.V @ A.T + M[:3, 3]
    if m.N is not None:
        nm = np.linalg.inv(A).T; n = m.N @ nm.T
        m.N = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)
    if np.linalg.det(A) < 0: m.F = m.F[:, ::-1].copy()
    return m

def _mk(V, UV, N, F, color, role):
    m = Mesh(np.array(V, float), np.array(F, int), np.array(UV, float))
    m.N = np.array(N, float)
    m.C = np.tile(list(color) + [role], (len(m.V), 1))
    return m

def box(size, mat, color=(1, 1, 1), role=1.0, M=None, uv=None, uvoff=(0, 0)):
    w, h, d = np.asarray(size, float) / 2
    t = uv or TILE[mat]
    faces = [((1, 0, 0), [(w, -h, d), (w, -h, -d), (w, h, -d), (w, h, d)], lambda p: (p[2], p[1])),
             ((-1, 0, 0), [(-w, -h, -d), (-w, -h, d), (-w, h, d), (-w, h, -d)], lambda p: (p[2], p[1])),
             ((0, 1, 0), [(-w, h, d), (w, h, d), (w, h, -d), (-w, h, -d)], lambda p: (p[0], p[2])),
             ((0, -1, 0), [(-w, -h, -d), (w, -h, -d), (w, -h, d), (-w, -h, d)], lambda p: (p[0], p[2])),
             ((0, 0, 1), [(-w, -h, d), (w, -h, d), (w, h, d), (-w, h, d)], lambda p: (p[0], p[1])),
             ((0, 0, -1), [(w, -h, -d), (-w, -h, -d), (-w, h, -d), (w, h, -d)], lambda p: (p[0], p[1]))]
    V, UV, N, F = [], [], [], []
    for n, cs, f in faces:
        k = len(V)
        for c in cs:
            V.append(c); u = f(c); UV.append((u[0] / t + uvoff[0], -u[1] / t + uvoff[1])); N.append(n)
        F += [(k, k + 1, k + 2), (k, k + 2, k + 3)]
    return place(_mk(V, UV, N, F, color, role), M)

def cyl(r0, r1, h, seg, mat, color=(1, 1, 1), role=1.0, M=None, caps=(True, True), smooth=True, arc=2 * np.pi, a0=0.0):
    """Cylindre/cône tronqué, base en y=0 (centre), sommet en y=h. arc<2π → portion (voûte)."""
    t = TILE[mat]; V, UV, N, F = [], [], [], []
    slope = (r0 - r1) / h
    full = abs(arc - 2 * np.pi) < 1e-6
    for k in range(seg + 1):
        a = a0 + arc * k / seg; ca, sa = np.cos(a), np.sin(a)
        nn = np.array([ca, slope, sa]); nn /= np.linalg.norm(nn)
        u = a * (r0 + r1) / 2 / t
        V += [(r0 * ca, 0, r0 * sa), (r1 * ca, h, r1 * sa)]; UV += [(u, 0), (u, -h / t)]; N += [nn, nn]
    for k in range(seg):
        i = k * 2
        F += [(i, i + 2, i + 3), (i, i + 3, i + 1)]
    if not smooth:   # facettes plates (pyramides, tours à pans)
        for k in range(seg):
            i = k * 2; a = a0 + arc * (k + 0.5) / seg
            nn = np.array([np.cos(a), slope, np.sin(a)]); nn /= np.linalg.norm(nn)
            for j in range(4): N[i + [0, 2, 3, 1][j]] = nn   # approximation : normale de la facette sur ses sommets (coutures dupliquées ci-dessous)
    m = _mk(V, UV, N, F, color, role)
    # orientation vers l'extérieur
    fn = np.cross(m.V[m.F[:, 1]] - m.V[m.F[:, 0]], m.V[m.F[:, 2]] - m.V[m.F[:, 0]])
    c = m.V[m.F].mean(1) - np.array([0, h / 2, 0]); c[:, 1] = 0
    if (fn * c).sum() < 0: m.F = m.F[:, ::-1].copy()
    parts = [m]
    if full and caps[1] and r1 > 1e-6:
        k0 = 0; V2 = [(0, h, 0)] + [(r1 * np.cos(a0 + arc * k / seg), h, r1 * np.sin(a0 + arc * k / seg)) for k in range(seg)]
        UV2 = [(v[0] / t, v[2] / t) for v in V2]; F2 = [(0, 1 + (k + 1) % seg, 1 + k) for k in range(seg)]
        parts.append(_mk(V2, UV2, [(0, 1, 0)] * len(V2), F2, color, role))
    if full and caps[0] and r0 > 1e-6:
        V2 = [(0, 0, 0)] + [(r0 * np.cos(a0 + arc * k / seg), 0, r0 * np.sin(a0 + arc * k / seg)) for k in range(seg)]
        UV2 = [(v[0] / t, v[2] / t) for v in V2]; F2 = [(0, 1 + k, 1 + (k + 1) % seg) for k in range(seg)]
        parts.append(_mk(V2, UV2, [(0, -1, 0)] * len(V2), F2, color, role))
    return place(concat(parts), M)

def cone(r, h, seg, mat, color=(1, 1, 1), role=1.0, M=None, smooth=True):
    return cyl(r, 0.0, h, seg, mat, color, role, M, caps=(True, False), smooth=smooth)

def facet_pyramid(r, h, seg, mat, color=(1, 1, 1), role=1.0, M=None, a0=0.0):
    """Pyramide/cône à facettes plates (normales par facette), base y=0."""
    t = TILE[mat]; ms = []
    for k in range(seg):
        a, b = a0 + 2 * np.pi * k / seg, a0 + 2 * np.pi * (k + 1) / seg
        p0 = np.array([r * np.cos(a), 0, r * np.sin(a)]); p1 = np.array([r * np.cos(b), 0, r * np.sin(b)]); ap = np.array([0, h, 0])
        n = np.cross(p1 - p0, ap - p0)
        if n[1] < 0 or True:
            n = np.cross(ap - p0, p1 - p0) if np.dot(np.cross(p1 - p0, ap - p0), (p0 + p1) / 2) < 0 else n
        n /= np.linalg.norm(n)
        V = [p0, p1, ap]; UV = [(0, 0), (np.linalg.norm(p1 - p0) / t, 0), (np.linalg.norm(p1 - p0) / 2 / t, -np.linalg.norm(ap - (p0 + p1) / 2) / t)]
        F = [(0, 1, 2)] if np.dot(np.cross(p1 - p0, ap - p0), (p0 + p1) / 2) >= 0 else [(0, 2, 1)]
        ms.append(_mk(V, UV, [n] * 3, F, color, role))
    return place(concat(ms), M)

def sphere(r, mat='metal', color=(1, 1, 1), role=1.0, M=None, seg=8, rings=5):
    V, UV, N, F = [], [], [], []
    for i in range(rings + 1):
        th = np.pi * i / rings
        for k in range(seg + 1):
            a = 2 * np.pi * k / seg
            n = np.array([np.sin(th) * np.cos(a), np.cos(th), np.sin(th) * np.sin(a)])
            V.append(n * r); N.append(n); UV.append((k / seg, i / rings))
    for i in range(rings):
        for k in range(seg):
            a, b, c, d = i * (seg + 1) + k, i * (seg + 1) + k + 1, (i + 1) * (seg + 1) + k, (i + 1) * (seg + 1) + k + 1
            F += [(a, c, b), (b, c, d)]
    m = _mk(V, UV, N, F, color, role)
    fn = np.cross(m.V[m.F[:, 1]] - m.V[m.F[:, 0]], m.V[m.F[:, 2]] - m.V[m.F[:, 0]])
    if (fn * m.V[m.F].mean(1)).sum() < 0: m.F = m.F[:, ::-1].copy()
    return place(m, M)

def octa(r, mat='glow', color=(1, 1, 1), role=1.0, M=None, sy=1.0):
    P = np.array([(r, 0, 0), (-r, 0, 0), (0, r * sy, 0), (0, -r * sy, 0), (0, 0, r), (0, 0, -r)])
    tris = [(0, 2, 4), (4, 2, 1), (1, 2, 5), (5, 2, 0), (4, 3, 0), (1, 3, 4), (5, 3, 1), (0, 3, 5)]
    ms = []
    for a, b, c in tris:
        p = P[[a, b, c]]; n = np.cross(p[1] - p[0], p[2] - p[0])
        if np.dot(n, p.mean(0)) < 0: p = p[[0, 2, 1]]; n = -n
        n = n / np.linalg.norm(n)
        ms.append(_mk(p, [(0, 0), (1, 0), (0.5, 1)], [n] * 3, [(0, 1, 2)], color, role))
    return place(concat(ms), M)

def quad(w, h, mat, color=(1, 1, 1), role=1.0, M=None, uv=None):
    """Plan vertical (normal +Z), centré, double face assuré par le matériau."""
    t = uv or TILE[mat]; x, y = w / 2, h / 2
    return place(_mk([(-x, -y, 0), (x, -y, 0), (x, y, 0), (-x, y, 0)], [(-x / t, y / t), (x / t, y / t), (x / t, -y / t), (-x / t, -y / t)] if False else [(0, 1), (1, 1), (1, 0), (0, 0)], [(0, 0, 1)] * 4, [(0, 1, 2), (0, 2, 3)], color, role), M)

def gable(span, rise, mat, color=(1, 1, 1), role=ROLE_WALL, M=None):
    """Triangle de pignon (normal +Z), base centrée en y=0, largeur span."""
    t = TILE[mat]; x = span / 2
    return place(_mk([(-x, 0, 0), (x, 0, 0), (0, rise, 0)], [(-x / t, 0), (x / t, 0), (0, -rise / t)], [(0, 0, 1)] * 3, [(0, 1, 2)], color, role), M)

def halfdisc(r, seg, mat, color=(1, 1, 1), role=1.0, M=None, a0=0.0, arc=np.pi):
    """Secteur plein dans le plan XY (normale +Z), centre à l'origine."""
    t = TILE[mat]
    V = [(0, 0, 0)] + [(r * np.cos(a0 + arc * k / seg), r * np.sin(a0 + arc * k / seg), 0) for k in range(seg + 1)]
    UV = [(v[0] / t, -v[1] / t) for v in V]
    F = [(0, 1 + k, 2 + k) for k in range(seg)]
    return place(_mk(V, UV, [(0, 0, 1)] * len(V), F, color, role), M)

def torus(R, r, seg=20, tseg=6, mat='pierre', color=(1, 1, 1), role=1.0, M=None):
    t = TILE[mat]; V, UV, N, F = [], [], [], []
    for i in range(seg + 1):
        a = 2 * np.pi * i / seg
        for j in range(tseg + 1):
            b = 2 * np.pi * j / tseg
            n = np.array([np.cos(a) * np.cos(b), np.sin(b), np.sin(a) * np.cos(b)])
            V.append(np.array([np.cos(a) * R, 0, np.sin(a) * R]) + n * r); N.append(n); UV.append((i / seg * R * 2 * np.pi / t, j / tseg * r * 2 * np.pi / t))
    for i in range(seg):
        for j in range(tseg):
            a, b, c, d = i * (tseg + 1) + j, i * (tseg + 1) + j + 1, (i + 1) * (tseg + 1) + j, (i + 1) * (tseg + 1) + j + 1
            F += [(a, b, c), (b, d, c)]
    m = _mk(V, UV, N, F, color, role)
    fn = np.cross(m.V[m.F[:, 1]] - m.V[m.F[:, 0]], m.V[m.F[:, 2]] - m.V[m.F[:, 0]])
    ctr = np.array([np.cos(np.arctan2(m.V[m.F][:, :, 2].mean(1), m.V[m.F][:, :, 0].mean(1))) * R, 0 * m.V[m.F][:, :, 1].mean(1), np.sin(np.arctan2(m.V[m.F][:, :, 2].mean(1), m.V[m.F][:, :, 0].mean(1))) * R]) if False else None
    cen = m.V[m.F].mean(1); a = np.arctan2(cen[:, 2], cen[:, 0]); c0 = np.stack([np.cos(a) * R, np.zeros(len(a)), np.sin(a) * R], 1)
    if (fn * (cen - c0)).sum() < 0: m.F = m.F[:, ::-1].copy()
    return place(m, M)

class Kit:
    def __init__(self): self.parts = []
    def add(self, mat, mesh, name=None):
        self.parts.append((name or f'p{len(self.parts)}', mesh, mat)); return mesh
    def addm(self, mat, meshes):
        for m in meshes: self.add(mat, m)
