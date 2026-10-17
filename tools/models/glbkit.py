"""glbkit — mini boîte à outils de modélisation 3D → GLB (numpy + Pillow, aucune dépendance externe).

Fournit : maillages (lofts, coques d'armure), skinning, squelette, animations, matériaux PBR avec textures,
écriture d'un fichier glTF 2.0 binaire (.glb) et relecture/validation.
Repère : Y vers le haut, le personnage regarde +Z, sa gauche est +X. Unités : mètres.
"""
import io, json, struct
import numpy as np
from PIL import Image
import os as _os
# Finesse des maillages : multiplicateur du NOMBRE DE TRIANGLES (1 = historique, 5 = cinq fois plus fin).
# La densité de grille (anneaux × segments) est multipliée par sqrt(DETAIL) dans les deux sens : N triangles x DETAIL.
DETAIL = float(_os.environ.get('KV_DETAIL', '1'))
KD = DETAIL ** 0.5
def dn(n, lo=0):
    """Nombre de divisions ajusté à la finesse demandée (jamais inférieur à n)."""
    return int(max(n, round(n * KD), lo))
def dgrid(n):
    """Nombre de points d'une grille de n points (n-1 intervalles x KD)."""
    return int(max(n, round((n - 1) * KD) + 1))

# ---------------------------------------------------------------------------------------------- maillage
class Mesh:
    def __init__(self, V, F, UV=None, J=None, W=None, C=None):
        self.V = np.asarray(V, np.float64).reshape(-1, 3)
        self.F = np.asarray(F, np.int64).reshape(-1, 3)
        self.UV = np.zeros((len(self.V), 2)) if UV is None else np.asarray(UV, np.float64).reshape(-1, 2)
        self.J = np.zeros((len(self.V), 4), np.int64) if J is None else J
        self.W = np.tile([1.0, 0, 0, 0], (len(self.V), 1)) if W is None else W
        self.C = np.ones((len(self.V), 4)) if C is None else np.asarray(C, np.float64).reshape(-1, 4)
        self.N = None   # normales imposées (facultatif) : feuillage à normales « arrondies »

    def copy(self):
        return Mesh(self.V.copy(), self.F.copy(), self.UV.copy(), self.J.copy(), self.W.copy(), self.C.copy())

    def transform(self, M):
        """M : matrice 4x4 (appliquée aux positions)."""
        M = np.asarray(M, np.float64)
        self.V = self.V @ M[:3, :3].T + M[:3, 3]
        if np.linalg.det(M[:3, :3]) < 0:
            self.F = self.F[:, ::-1].copy()
        return self


def concat(meshes):
    meshes = [m for m in meshes if m is not None and len(m.V)]
    off = np.cumsum([0] + [len(m.V) for m in meshes])[:-1]
    anyN = any(getattr(m, 'N', None) is not None for m in meshes)
    out = Mesh(np.vstack([m.V for m in meshes]),
                np.vstack([m.F + o for m, o in zip(meshes, off)]),
                np.vstack([m.UV for m in meshes]),
                np.vstack([m.J for m in meshes]),
                np.vstack([m.W for m in meshes]), np.vstack([m.C for m in meshes]))
    if anyN:
        out.N = np.vstack([m.N if getattr(m, 'N', None) is not None else normals(m) for m in meshes])
    return out


def mirror_x(mesh, bone_swap):
    """Copie symétrique X → -X. bone_swap : dict indice d'os → indice de l'os opposé."""
    m = mesh.copy()
    m.V[:, 0] *= -1
    m.F = m.F[:, ::-1].copy()
    if bone_swap:
        lut = np.arange(256)
        for a_, b_ in bone_swap.items():
            lut[a_] = b_
        m.J = lut[m.J]
    return m


def normals(mesh, weld=True):
    """Normales lissées ; les sommets en double (coutures UV) partagent leur normale."""
    V, F = mesh.V, mesh.F
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    acc = np.zeros_like(V)
    if weld:
        key = np.round(V * 1e5).astype(np.int64)
        _, inv = np.unique(key, axis=0, return_inverse=True)
        inv = inv.reshape(-1)
        wacc = np.zeros((inv.max() + 1, 3))
        for k in range(3):
            np.add.at(wacc, inv[F[:, k]], fn)
        acc = wacc[inv]
    else:
        for k in range(3):
            np.add.at(acc, F[:, k], fn)
    n = np.linalg.norm(acc, axis=1, keepdims=True)
    n[n < 1e-12] = 1
    return acc / n


# ---------------------------------------------------------------------------------------------- lofts
def _unit(v):
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    n[n < 1e-12] = 1
    return v / n


def smoothpath(pts, n):
    """Interpolation Catmull-Rom d'une polyligne → n points."""
    pts = np.asarray(pts, float)
    if len(pts) == 2:
        t = np.linspace(0, 1, n)[:, None]
        return pts[0] * (1 - t) + pts[1] * t
    P = np.vstack([2 * pts[0] - pts[1], pts, 2 * pts[-1] - pts[-2]])
    out = []
    segs = len(pts) - 1
    for i in range(n):
        u = i / (n - 1) * segs
        k = min(int(u), segs - 1)
        t = u - k
        p0, p1, p2, p3 = P[k], P[k + 1], P[k + 2], P[k + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return np.array(out)


def prof(keys, n):
    """Courbe de profil : keys = [(t, valeur)…], t∈[0,1] → tableau de n valeurs (interpolation douce)."""
    keys = sorted(keys)
    t = np.array([k[0] for k in keys]); v = np.array([k[1] for k in keys])
    x = np.linspace(0, 1, n)
    # lissage « smoothstep » entre les clés
    out = np.empty(n)
    for i, xi in enumerate(x):
        j = np.searchsorted(t, xi, side='right') - 1
        j = min(max(j, 0), len(t) - 2)
        s = 0 if t[j + 1] == t[j] else (xi - t[j]) / (t[j + 1] - t[j])
        s = min(max(s, 0), 1); s = s * s * (3 - 2 * s)
        out[i] = v[j] * (1 - s) + v[j + 1] * s
    return out


class Loft:
    """Surface balayée : anneaux (sections superelliptiques) le long d'un chemin.
    rf : demi-épaisseur avant/arrière, rs : demi-largeur latérale, p : exposant (2 = ellipse, 4 = carré arrondi),
    of/os : décalage du centre de la section (avant / côté)."""

    def __init__(self, path, rf, rs, p=2.5, of=0.0, os_=0.0, segs=20, ref=(0, 0, 1), cap0=0, cap1=0, tile=0.5,
                 twist=None, section=None):
        path = np.asarray(path, float)
        n = len(path)
        rf = np.broadcast_to(rf, (n,)).astype(float); rs = np.broadcast_to(rs, (n,)).astype(float)
        p = np.broadcast_to(p, (n,)).astype(float)
        of = np.broadcast_to(of, (n,)).astype(float); os_ = np.broadcast_to(os_, (n,)).astype(float)
        if KD > 1.001 and section is None and n >= 3:   # finesse : plus d'anneaux le long du chemin (interpolation douce), plus de segments par anneau
            from scipy.interpolate import CubicSpline, PchipInterpolator
            n2 = dgrid(n); x0 = np.arange(n); x1 = np.linspace(0, n - 1, n2)
            path = CubicSpline(x0, path, axis=0)(x1)
            rf, rs, p, of, os_ = [PchipInterpolator(x0, v)(x1) for v in (rf, rs, p, of, os_)]
            n = n2; segs = dn(segs); cap0 = int(round(cap0 * KD)); cap1 = int(round(cap1 * KD))
        T = np.gradient(path, axis=0); T = _unit(T)
        # repère par transport parallèle
        ref = np.asarray(ref, float)
        Nf = np.zeros((n, 3)); Sd = np.zeros((n, 3))
        r = ref - T[0] * np.dot(ref, T[0])
        if np.linalg.norm(r) < 1e-6:
            r = np.array([1.0, 0, 0]) - T[0] * T[0][0]
        Nf[0] = _unit(r)
        for i in range(1, n):
            r = Nf[i - 1] - T[i] * np.dot(Nf[i - 1], T[i])
            if np.linalg.norm(r) < 1e-9:
                r = Nf[i - 1]
            Nf[i] = _unit(r)
        Sd = np.cross(T, Nf)  # côté
        a = np.linspace(0, 2 * np.pi, segs + 1)
        ca, sa = np.cos(a), np.sin(a)
        rings = []
        for i in range(n):
            if section is None:
                e = 2.0 / p[i]
                x = rf[i] * np.sign(ca) * np.abs(ca) ** e
                z = rs[i] * np.sign(sa) * np.abs(sa) ** e
            else:
                x, z = section(i, a, rf[i], rs[i])
            c = path[i] + Nf[i] * of[i] + Sd[i] * os_[i]
            rings.append(c + np.outer(x, Nf[i]) + np.outer(z, Sd[i]))
        rings = np.array(rings)  # n × (segs+1) × 3
        # arrondis aux extrémités
        extra0, extra1 = [], []
        for cap, end in ((cap0, 0), (cap1, 1)):
            for k in range(1, cap + 1):
                ang = k / cap * np.pi / 2
                s = np.cos(ang); h = np.sin(ang)
                base = rings[0] if end == 0 else rings[-1]
                ctr = base.mean(axis=0)
                tdir = -T[0] if end == 0 else T[-1]
                ring = ctr + (base - ctr) * s + tdir * h * max(0.5 * (rf[end * (n - 1)] + rs[end * (n - 1)]) * 0.9, 0.004)
                (extra0 if end == 0 else extra1).append(ring)
        allr = (extra0[::-1] + list(rings) + extra1)
        self.grid = np.array(allr)
        self.rows = len(allr); self.cols = segs + 1
        self.segs = segs
        self.cap0, self.cap1 = len(extra0), len(extra1)
        self.n_core = n
        self.tile = tile
        # indices des anneaux « corps » dans la grille
        self.core0 = len(extra0)

    def mesh(self, uv_scale=1.0, flip=False):
        R, C = self.rows, self.cols
        G = self.grid
        V = G.reshape(-1, 3)
        # UV : u = tour (m), v = longueur (m)
        seg_len = np.linalg.norm(np.diff(G, axis=0), axis=2).mean(axis=1)
        vlen = np.concatenate([[0], np.cumsum(seg_len)])
        circ = np.linalg.norm(np.diff(G[R // 2], axis=0), axis=1).sum()
        u = np.linspace(0, circ, C)
        UV = np.stack(np.meshgrid(u, vlen), -1).reshape(-1, 2) / self.tile * uv_scale
        idx = np.arange(R * C).reshape(R, C)
        a = idx[:-1, :-1].ravel(); b = idx[:-1, 1:].ravel(); c = idx[1:, :-1].ravel(); d = idx[1:, 1:].ravel()
        F = np.concatenate([np.stack([a, c, b], 1), np.stack([b, c, d], 1)])
        # orientation : normales vers l'extérieur
        m = Mesh(V, F, UV)
        ctr = G.reshape(-1, 3).mean(axis=0)
        fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
        fc = V[F].mean(axis=1) - ctr
        # test sur les facettes de l'anneau médian pour décider du sens
        mid = (R // 2) * (C - 1) * 2
        sample = slice(mid, mid + 2 * (C - 1))
        if np.sum(np.einsum('ij,ij->i', fn[sample], fc[sample])) < 0:
            m.F = m.F[:, ::-1].copy()
        if flip:
            m.F = m.F[:, ::-1].copy()
        return m

    # point/normale interpolés sur la surface : t ∈ [0,1] sur les anneaux « corps », a ∈ [0,1] tour
    def sample(self, t, a):
        R0, R1 = self.core0, self.core0 + self.n_core - 1
        r = R0 + np.clip(t, 0, 1) * (R1 - R0)
        c = (np.asarray(a, float) % 1.0) * (self.cols - 1)
        r0 = np.clip(np.floor(r).astype(int), 0, self.rows - 2); c0 = np.clip(np.floor(c).astype(int), 0, self.cols - 2)
        fr = (r - r0)[..., None]; fc = (c - c0)[..., None]
        G = self.grid
        P = (G[r0, c0] * (1 - fr) * (1 - fc) + G[r0 + 1, c0] * fr * (1 - fc) + G[r0, c0 + 1] * (1 - fr) * fc + G[r0 + 1, c0 + 1] * fr * fc)
        # normale par différences finies
        e = 1e-3
        Pt = self._pt(t + e, a) - self._pt(t - e, a)
        Pa = self._pt(t, a + e) - self._pt(t, a - e)
        N = _unit(np.cross(Pa, Pt))
        return P, N

    def _pt(self, t, a):
        R0, R1 = self.core0, self.core0 + self.n_core - 1
        r = R0 + np.clip(t, 0, 1) * (R1 - R0)
        c = (np.asarray(a, float) % 1.0) * (self.cols - 1)
        r0 = np.clip(np.floor(r).astype(int), 0, self.rows - 2); c0 = np.clip(np.floor(c).astype(int), 0, self.cols - 2)
        fr = (r - r0)[..., None]; fc = (c - c0)[..., None]
        G = self.grid
        return (G[r0, c0] * (1 - fr) * (1 - fc) + G[r0 + 1, c0] * fr * (1 - fc) + G[r0, c0 + 1] * (1 - fr) * fc + G[r0 + 1, c0 + 1] * fr * fc)


def shell(loft, a0, a1, t_lo, t_hi, offset=0.004, thick=0.012, bevel=0.012, na=18, nt=10, dome=0.0, tile=0.35, outward=None, rim_rows=4, under_face=False):
    """Plaque d'armure qui épouse la surface d'un loft : portion d'angles [a0,a1], hauteurs t_lo(a)…t_hi(a)
    (fonctions de a∈[0,1]→t∈[0,1] ou constantes), épaisseur réelle avec chant arrondi."""
    f_lo = t_lo if callable(t_lo) else (lambda a, v=t_lo: np.full_like(a, v))
    f_hi = t_hi if callable(t_hi) else (lambda a, v=t_hi: np.full_like(a, v))
    qa = np.linspace(0, 1, na)
    # échantillonnage non uniforme : on resserre près des bords pour le chant
    def edge_dense(n):
        s = np.linspace(0, 1, n)
        return s
    rr = np.linspace(0, 1, nt)
    # lignes de chant : on insère des rangées supplémentaires aux deux bords
    ramp = (1 - np.cos(np.linspace(0, np.pi / 2, rim_rows))) * 0.5 / 1.0
    def dense(n):
        base = np.linspace(0, 1, n)
        return np.unique(np.concatenate([base, [0.05, 0.95]]))
    na, nt = dn(na), dn(nt)
    qa = dense(na); rr = dense(nt)
    A = np.broadcast_to(a0 + qa * (a1 - a0), (len(rr), len(qa))).copy()
    lo = f_lo(a0 + qa * (a1 - a0)); hi = f_hi(a0 + qa * (a1 - a0))
    T = lo[None, :] + rr[:, None] * (hi - lo)[None, :]
    P, N = loft.sample(T, A)
    # étendue métrique pour le chant
    La = np.linalg.norm(np.diff(P[len(rr) // 2], axis=0), axis=1).sum()
    Lt = np.linalg.norm(np.diff(P[:, len(qa) // 2], axis=0), axis=1).sum()
    ea = np.minimum(qa, 1 - qa) * La
    et = np.minimum(rr, 1 - rr) * Lt
    e = np.minimum(ea[None, :], et[:, None])
    x = np.clip(e / max(bevel, 1e-6), 0, 1)
    prof_e = np.sqrt(1 - (1 - x) ** 2)
    ctrx = (qa - 0.5) * 2; ctry = (rr - 0.5) * 2
    domef = dome * np.clip(1 - (ctrx[None, :] ** 2 + ctry[:, None] ** 2) / 2, 0, 1)
    H = offset + thick * prof_e + domef * prof_e
    S = P + N * H[..., None]
    R, C = S.shape[:2]
    V = S.reshape(-1, 3)
    # UV : en mètres
    dv = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P[:, 0], axis=0), axis=1))])
    du = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P[0], axis=0), axis=1))])
    UV = np.stack(np.meshgrid(du, dv), -1).reshape(-1, 2) / tile
    idx = np.arange(R * C).reshape(R, C)
    a_ = idx[:-1, :-1].ravel(); b_ = idx[:-1, 1:].ravel(); c_ = idx[1:, :-1].ravel(); d_ = idx[1:, 1:].ravel()
    F = np.concatenate([np.stack([a_, c_, b_], 1), np.stack([b_, c_, d_], 1)])
    m = Mesh(V, F, UV)
    # sens : normales dans la direction N moyenne
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    nf = N.reshape(-1, 3)[F[:, 0]]
    if np.sum(np.einsum('ij,ij->i', fn, nf)) < 0:
        m.F = m.F[:, ::-1].copy()
    # dessous de la plaque (cache le vide, visible par les trous du chant)
    under = Mesh(P.reshape(-1, 3) + N.reshape(-1, 3) * (offset * 0.2), m.F[:, ::-1].copy(), UV.copy())
    return m if not under_face else concat([m, under])


# ---------------------------------------------------------------------------------------------- skinning
def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def skin_chain(mesh, joints, bones, blend=0.25):
    """Poids le long d'une chaîne d'os : joints[i] = position du joint de l'os bones[i]."""
    P = np.asarray(joints, float)
    n = len(P)
    V = mesh.V
    best = np.full(len(V), 1e9); seg = np.zeros(len(V), int); sv = np.zeros(len(V))
    for i in range(n - 1):
        a, b = P[i], P[i + 1]
        d = b - a; L2 = np.dot(d, d)
        s = np.clip(((V - a) @ d) / L2, 0, 1)
        dist = np.linalg.norm(V - (a + s[:, None] * d), axis=1)
        better = dist < best - 1e-9
        best = np.where(better, dist, best); seg = np.where(better, i, seg); sv = np.where(better, s, sv)
    J = np.zeros((len(V), 4), np.int64); W = np.zeros((len(V), 4))
    for k in range(len(V)):
        i, s = seg[k], sv[k]
        w = {}
        L = np.linalg.norm(P[i + 1] - P[i])
        bw = min(blend / max(L, 1e-6), 0.5)
        if s < bw and i > 0:
            f = smoothstep(0.5 + 0.5 * s / bw)
            w[bones[i]] = f; w[bones[i - 1]] = 1 - f
        elif s > 1 - bw and i < n - 2:
            f = smoothstep(0.5 + 0.5 * (1 - s) / bw)
            w[bones[i]] = f; w[bones[i + 1]] = 1 - f
        else:
            w[bones[i]] = 1.0
        items = sorted(w.items(), key=lambda kv: -kv[1])[:4]
        for q, (bi, wi) in enumerate(items):
            J[k, q] = bi; W[k, q] = wi
    mesh.J, mesh.W = J, W
    return mesh


def skin_rigid(mesh, bone):
    mesh.J = np.zeros((len(mesh.V), 4), np.int64); mesh.J[:, 0] = bone
    mesh.W = np.zeros((len(mesh.V), 4)); mesh.W[:, 0] = 1
    return mesh


# ---------------------------------------------------------------------------------------------- rotations
def qmul(a, b):
    x1, y1, z1, w1 = a; x2, y2, z2, w2 = b
    return np.array([w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2, w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
                     w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2, w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2])


def qaxis(axis, ang):
    axis = np.asarray(axis, float); axis = axis / np.linalg.norm(axis)
    s = np.sin(ang / 2)
    return np.array([axis[0] * s, axis[1] * s, axis[2] * s, np.cos(ang / 2)])


def qeuler(rx=0, ry=0, rz=0):
    """Rotation Z·Y·X (radians) en quaternion (x,y,z,w)."""
    return qmul(qmul(qaxis((0, 0, 1), rz), qaxis((0, 1, 0), ry)), qaxis((1, 0, 0), rx))


def qnorm(q):
    return q / np.linalg.norm(q)


# ---------------------------------------------------------------------------------------------- écriture glTF
class Skeleton:
    def __init__(self):
        self.names, self.parents, self.pos = [], [], []

    def add(self, name, parent, pos):
        self.names.append(name); self.parents.append(-1 if parent is None else self.names.index(parent)); self.pos.append(np.asarray(pos, float))
        return len(self.names) - 1

    def idx(self, name):
        return self.names.index(name)


def _img_bytes(arr, fmt='PNG', quality=90):
    im = Image.fromarray(arr)
    b = io.BytesIO()
    if fmt == 'JPEG':
        im.convert('RGB').save(b, 'JPEG', quality=quality, optimize=True, subsampling=0)
    else:
        im.save(b, 'PNG', optimize=True)
    return b.getvalue()


class Material:
    def __init__(self, name, base=None, normal=None, orm=None, factor=(1, 1, 1, 1), metal=1.0, rough=1.0,
                 emissive=(0, 0, 0), emissive_tex=None, normal_scale=1.0, double_sided=False, alpha_mode=None, cutoff=0.5, texkey=None, base_fmt='JPEG', pack_fmt='PNG'):
        self.__dict__.update(locals())
        self.texkey = texkey or name


def write_glb(path, parts, skeleton, materials, animations=None, extras=None, tex_format=None, mesh_name='Corps', tex_dir=None):
    """parts : liste de (nom, Mesh, nom_matériau). animations : {nom: {'fps':int, 'channels': {os: {'rot': array(n,4), 'pos': array(n,3)|None}}, 'n': n}}."""
    animations = animations or {}
    bin_chunks = []
    buffer_views, accessors = [], []

    def add_view(data, target=None, stride=None):
        pad = (-sum(len(c) for c in bin_chunks)) % 4
        if pad:
            bin_chunks.append(b'\0' * pad)
        off = sum(len(c) for c in bin_chunks)
        bin_chunks.append(bytes(data))
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target: v['target'] = target
        if stride: v['byteStride'] = stride
        buffer_views.append(v)
        return len(buffer_views) - 1

    def add_acc(arr, ctype, target=None, minmax=False, normalized=False):
        arr = np.ascontiguousarray(arr)
        comp = {np.dtype('float32'): 5126, np.dtype('uint16'): 5123, np.dtype('uint32'): 5125, np.dtype('uint8'): 5121}[arr.dtype]
        n = arr.shape[0]
        bv = add_view(arr.tobytes(), target)
        a = {'bufferView': bv, 'componentType': comp, 'count': n, 'type': ctype}
        if normalized: a['normalized'] = True
        if minmax:
            a['min'] = arr.min(axis=0).astype(float).tolist(); a['max'] = arr.max(axis=0).astype(float).tolist()
        accessors.append(a)
        return len(accessors) - 1

    images, textures, gl_materials = [], [], []
    tex_cache = {}

    def add_tex(arr, key, fmt):
        if key in tex_cache:
            return tex_cache[key]
        data = _img_bytes(arr, fmt)
        if tex_dir:
            import os
            os.makedirs(tex_dir, exist_ok=True)
            fn = key + ('.jpg' if fmt == 'JPEG' else '.png')
            open(os.path.join(tex_dir, fn), 'wb').write(data)
            images.append({'uri': os.path.basename(os.path.normpath(tex_dir)) + '/' + fn, 'name': key})
        else:
            bv = add_view(data)
            images.append({'bufferView': bv, 'mimeType': 'image/jpeg' if fmt == 'JPEG' else 'image/png', 'name': key})
        textures.append({'sampler': 0, 'source': len(images) - 1})
        tex_cache[key] = len(textures) - 1
        return tex_cache[key]

    mat_index = {}
    for m in materials:
        pbr = {'baseColorFactor': list(m.factor), 'metallicFactor': m.metal, 'roughnessFactor': m.rough}
        g = {'name': m.name, 'pbrMetallicRoughness': pbr}
        if m.base is not None:
            pbr['baseColorTexture'] = {'index': add_tex(m.base, m.texkey + '_basecolor', m.base_fmt)}
        if m.orm is not None:
            pbr['metallicRoughnessTexture'] = {'index': add_tex(m.orm, m.texkey + '_metalrough', m.pack_fmt)}
            g['occlusionTexture'] = {'index': tex_cache[m.texkey + '_metalrough'], 'strength': 1.0}
        if m.normal is not None:
            g['normalTexture'] = {'index': add_tex(m.normal, m.texkey + '_normal', m.pack_fmt), 'scale': m.normal_scale}
        if any(m.emissive):
            g['emissiveFactor'] = list(m.emissive)
        if m.emissive_tex is not None:
            g['emissiveTexture'] = {'index': add_tex(m.emissive_tex, m.texkey + '_emissive', 'JPEG')}
        if m.double_sided: g['doubleSided'] = True
        if m.alpha_mode: g['alphaMode'] = m.alpha_mode; g['alphaCutoff'] = m.cutoff
        gl_materials.append(g); mat_index[m.name] = len(gl_materials) - 1

    # nœuds : os
    static = skeleton is None
    if static:
        skeleton = Skeleton()
    nodes = []
    for i, nm in enumerate(skeleton.names):
        par = skeleton.parents[i]
        local = skeleton.pos[i] - (skeleton.pos[par] if par >= 0 else 0)
        nodes.append({'name': nm, 'translation': [float(x) for x in local]})
    for i, par in enumerate(skeleton.parents):
        if par >= 0:
            nodes[par].setdefault('children', []).append(i)
    roots = [i for i, p in enumerate(skeleton.parents) if p < 0]
    nb = len(nodes)
    ibm = np.zeros((nb, 16), np.float32)
    for i in range(nb):
        M = np.eye(4); M[:3, 3] = -skeleton.pos[i]
        ibm[i] = M.T.reshape(-1)
    if not static:
        ibm_acc = add_acc(ibm.reshape(nb, 16), 'MAT4')
        accessors[ibm_acc]['type'] = 'MAT4'

    # maillage unique, une primitive par matériau
    by_mat = {}
    for name, mesh, mat in parts:
        by_mat.setdefault(mat, []).append(mesh)
    prims = []
    stats = {}
    for mat, ms in by_mat.items():
        m = concat(ms)
        # nettoyage : facettes dégénérées
        F = m.F
        area = np.linalg.norm(np.cross(m.V[F[:, 1]] - m.V[F[:, 0]], m.V[F[:, 2]] - m.V[F[:, 0]]), axis=1)
        m.F = F[area > 1e-12]
        N = m.N if getattr(m, 'N', None) is not None else normals(m)
        s = m.W.sum(axis=1, keepdims=True); s[s == 0] = 1
        W = (m.W / s).astype(np.float32)
        attrs = {
            'POSITION': add_acc(m.V.astype(np.float32), 'VEC3', 34962, True),
            'NORMAL': add_acc(N.astype(np.float32), 'VEC3', 34962),
            'TEXCOORD_0': add_acc(m.UV.astype(np.float32), 'VEC2', 34962),
        }
        if not static:
            attrs['JOINTS_0'] = add_acc(m.J.astype(np.uint16), 'VEC4', 34962)
            attrs['WEIGHTS_0'] = add_acc(W, 'VEC4', 34962)
        if np.abs(m.C - 1).max() > 1e-3:
            attrs['COLOR_0'] = add_acc((np.clip(m.C, 0, 1) * 255 + .5).astype(np.uint8), 'VEC4', 34962, normalized=True)
        idx = add_acc(m.F.astype(np.uint32).reshape(-1), 'SCALAR', 34963)
        accessors[idx]['count'] = int(m.F.size)
        prims.append({'attributes': attrs, 'indices': idx, 'material': mat_index[mat], 'mode': 4})
        stats[mat] = (len(m.V), len(m.F))
    mesh_node = nb
    nodes.append({'name': mesh_name, 'mesh': 0, **({} if static else {'skin': 0})})
    skins = [] if static else [{'name': 'Armature', 'inverseBindMatrices': ibm_acc, 'joints': list(range(nb)), 'skeleton': roots[0]}]

    # animations
    gl_anims = []
    for aname, A in animations.items():
        fps, n = A['fps'], A['n']
        times = (np.arange(n) / fps).astype(np.float32)
        tacc = add_acc(times, 'SCALAR', minmax=True)
        samplers, channels = [], []
        for bone, ch in A['channels'].items():
            ni = skeleton.idx(bone)
            if ch.get('rot') is not None:
                q = np.asarray(ch['rot'], np.float32)
                # continuité du signe
                for k in range(1, len(q)):
                    if np.dot(q[k], q[k - 1]) < 0: q[k] = -q[k]
                samplers.append({'input': tacc, 'output': add_acc(q, 'VEC4'), 'interpolation': 'LINEAR'})
                channels.append({'sampler': len(samplers) - 1, 'target': {'node': ni, 'path': 'rotation'}})
            if ch.get('pos') is not None:
                base = skeleton.pos[ni] - (skeleton.pos[skeleton.parents[ni]] if skeleton.parents[ni] >= 0 else 0)
                p = (np.asarray(ch['pos'], np.float32) + base.astype(np.float32))
                samplers.append({'input': tacc, 'output': add_acc(p, 'VEC3'), 'interpolation': 'LINEAR'})
                channels.append({'sampler': len(samplers) - 1, 'target': {'node': ni, 'path': 'translation'}})
        gl_anims.append({'name': aname, 'samplers': samplers, 'channels': channels})

    gltf = {
        'asset': {'version': '2.0', 'generator': 'glbkit (Korvalune)', **({'extras': extras} if extras else {})},
        'scene': 0, 'scenes': [{'name': 'Scene', 'nodes': roots + [mesh_node]}],
        'nodes': nodes, 'meshes': [{'name': mesh_name, 'primitives': prims}],
        'materials': gl_materials, 'accessors': accessors, 'bufferViews': buffer_views,
        'buffers': [{'byteLength': sum(len(c) for c in bin_chunks)}],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
    }
    if skins: gltf['skins'] = skins
    if images: gltf['images'] = images; gltf['textures'] = textures
    if gl_anims: gltf['animations'] = gl_anims
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    bn = b''.join(bin_chunks)
    bn += b'\0' * ((-len(bn)) % 4)
    gltf['buffers'][0]['byteLength'] = len(bn)
    js = json.dumps(gltf, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(bn)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(js), b'JSON')); f.write(js)
        f.write(struct.pack('<I4s', len(bn), b'BIN\0')); f.write(bn)
    return stats
