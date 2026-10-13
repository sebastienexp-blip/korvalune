"""hair_geo — coiffures et barbes modélisées (mèches, coques, nattes, boucles, dreadlocks…) pour les têtes de head_geo.
Chaque style = un module « town » unique (matériau 'cheveux', rôle 0.6 = couleur des cheveux fixée à l'exécution).
Repère = celui de head_geo (centre du crâne, +Z devant, +Y haut). Construit sur la tête homme/ovale ; le jeu met le module à l'échelle de la forme du crâne/mâchoire."""
import numpy as np
from glbkit import Mesh, concat, normals, smoothpath
import head_geo as H

HAIR = 0.6
sm = H.sm
_surf, _levels, _f, _fem, _s = H.surface_fn('homme', 'ovale')

# ----------------------------------------------------------------------------------------------- surface du crâne
def sp(t, phi, off=0.0):
    """Point du cuir chevelu (t : 0 menton → 1 sommet ; phi : 0 devant, + vers la gauche) décalé de `off` selon la normale."""
    t = np.asarray(t, float); phi = np.asarray(phi, float)
    def P(tt, pp):
        x, y, z, _ = _surf(np.clip(tt, 0, 1), pp)
        z = z + H.relief(x, y, False, 1.0) * sm(np.cos(pp), 0.12, 0.8)
        return np.stack([x, y, z], -1)
    p = P(t, phi); e = 1e-3
    du = P(t, phi + 2 * e) - P(t, phi - 2 * e); dv = P(np.minimum(t + e, 1), phi) - P(np.maximum(t - e, 0), phi)
    n = np.cross(du, dv)
    ln = np.linalg.norm(n, axis=-1, keepdims=True)
    fall = (ln < 1e-9)[..., 0]
    n = n / np.maximum(ln, 1e-12)
    # sommet : normale = vers le haut
    n = np.where(fall[..., None], np.array([0, 1.0, 0]), n)
    cen = np.array([0, 0.0, -0.005]); out = ((p - cen) * n).sum(-1) < 0
    n = np.where(out[..., None], -n, n)
    off = np.asarray(off, float)
    return p + n * off[..., None] if off.ndim else p + n * off, n

def hairline(phi, front=0.80, side=0.62, ear=0.56, back=0.36):
    a = np.abs(((np.asarray(phi, float) + np.pi) % (2 * np.pi)) - np.pi)
    return np.interp(a, [0, .45, .9, 1.4, 1.8, 2.4, np.pi], [front, front - 0.01, side, ear, ear - 0.06, back + 0.05, back])

def vn(x, seed=0, freqs=(1.0, 2.3, 5.1)):
    r = np.random.default_rng(seed); out = 0
    for k, f in enumerate(freqs): out = out + np.sin(np.asarray(x, float) * f + r.uniform(0, 6.28)) / (k + 1)
    return out / 1.6

def noise3(p, seed=0, scale=1.0):
    r = np.random.default_rng(seed); out = 0
    for k in range(3):
        d = r.normal(size=3); d /= np.linalg.norm(d)
        out = out + np.sin((p @ d) * scale * (2.3 ** k) + r.uniform(0, 6.28))
    return out / 3

def mesh_from(P, F, br=None, role=HAIR):
    P = np.asarray(P, float).reshape(-1, 3)
    m = Mesh(P, np.asarray(F, int), np.zeros((len(P), 2)))
    b = np.ones(len(P)) if br is None else np.clip(np.broadcast_to(np.asarray(br, float).reshape(-1) if np.size(br) > 1 else np.asarray(br, float), (len(P),)) if np.size(br) == 1 else np.asarray(br, float).reshape(-1), 0, 1)
    m.C = np.stack([b, b, b, np.full(len(P), role)], 1)
    m.N = normals(m, weld=False)
    return m

# ----------------------------------------------------------------------------------------------- coque (cheveux collés au crâne, volume, barbe courte)
def shell(offfn, nv=36, nu=60, thr=0.0005, streak=0.2, seed=1, lump=None, dark=0.0, tlo=0.15, bright=0.86, hl=None, thi=1.0, prange=None, skin_fade=0.0):
    full = prange is None
    phi = np.linspace(-np.pi, np.pi, nu, endpoint=False) if full else np.linspace(prange[0], prange[1], nu)
    if hl is None:
        t = np.linspace(tlo, thi, nv); T, PH = np.meshgrid(t, phi, indexing='ij')
    else:      # la première rangée suit exactement la ligne d'implantation (pas de crénelage)
        u = np.linspace(0, 1, nv); PH = np.tile(phi, (nv, 1)); T = hl(PH) + (1 - hl(PH)) * u[:, None]
    off = offfn(T, PH)
    P0, N0 = sp(T, PH)
    if lump is not None:
        off = off + lump(P0, T, PH) * (off > 0.002)
    P = P0 + N0 * (np.maximum(off, 0)[..., None] + 0.0006)
    F = []
    for i in range(nv - 1):
        for j in range(nu if full else nu - 1):
            a, b = i * nu + j, i * nu + (j + 1) % nu; c, d = (i + 1) * nu + (j + 1) % nu, (i + 1) * nu + j
            if max(off[i, j], off[i, (j + 1) % nu], off[i + 1, (j + 1) % nu], off[i + 1, j]) > thr: F += [(a, b, c), (a, c, d)]
    s = vn(PH * 14, seed) * 0.4 + vn(PH * 41 + T * 9, seed + 3) * 0.3 + vn(PH * 97 + T * 3, seed + 5) * 0.3
    br = bright + streak * s - dark * (1 - sm(off, 0, 0.012))
    m = mesh_from(P, F, br)
    if skin_fade:
        rel = (np.maximum(off, 0) / max(float(off.max()), 1e-9)).reshape(-1)
        edge = rel < skin_fade
        m.C[edge, 3] = 0.8; m.C[edge, :3] = 0.86
    m.N = normals(m, weld=False)
    return _compact(m)

def _compact(m):
    used = np.unique(m.F); rm = -np.ones(len(m.V), int); rm[used] = np.arange(len(used))
    n = Mesh(m.V[used], rm[m.F], m.UV[used], None, None, m.C[used]); n.N = m.N[used]; return n

# ----------------------------------------------------------------------------------------------- mèches (tubes aplatis le long d'une courbe)
def _frames(path, hint):
    n = len(path); T = np.gradient(path, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-12
    hint = np.asarray(hint, float)
    if hint.ndim == 1: hint = np.tile(hint, (n, 1))
    S = np.cross(T, hint); bad = np.linalg.norm(S, axis=1) < 1e-6
    S[bad] = np.cross(T[bad], np.array([1.0, 0, 0])); S /= np.linalg.norm(S, axis=1, keepdims=True) + 1e-12
    U = np.cross(S, T); U /= np.linalg.norm(U, axis=1, keepdims=True) + 1e-12
    return T, S, U

def lock(path, w, th, hint=(0, 0, 1), taper=0.25, root=1.0, seg=6, br=0.9, twist=0.0, tw_amp=0.0, lobes=3, seed=0, n=14, close=True, rgrad=0.3, wprof=None):
    """Mèche : section elliptique (w = demi-largeur selon S, th = demi-épaisseur selon U), effilée vers la pointe. hint = direction de face (normale)."""
    path = smoothpath(np.asarray(path, float), n) if len(path) != n else np.asarray(path, float)
    T, S, U = _frames(path, hint)
    s = np.linspace(0, 1, n)
    prof = (root + (taper - root) * s ** 1.4) if wprof is None else wprof(s)
    if close: prof = prof * np.where(s > 0.9, 1 - (s - 0.9) / 0.1 * 0.8, 1)
    ang = np.linspace(0, 2 * np.pi, seg, endpoint=False)
    rng = np.random.default_rng(seed)
    P = np.zeros((n, seg, 3)); Bc = np.zeros((n, seg))
    for i in range(n):
        for k, a in enumerate(ang):
            bump = 1 + tw_amp * np.sin(lobes * a + twist * s[i] * 2 * np.pi)
            P[i, k] = path[i] + S[i] * w * prof[i] * np.cos(a) * bump + U[i] * th * prof[i] * np.sin(a) * bump
            Bc[i, k] = br * (1 - rgrad * (1 - s[i]) * 0 - rgrad * 0.5 * (1 - s[i])) * (0.9 + 0.1 * np.cos(a - 0.6)) * (0.9 + 0.1 * np.sin(s[i] * 40 + seed))
    F = []
    for i in range(n - 1):
        for k in range(seg):
            a_, b_ = i * seg + k, i * seg + (k + 1) % seg; c_, d_ = (i + 1) * seg + (k + 1) % seg, (i + 1) * seg + k
            F += [(a_, c_, b_), (a_, d_, c_)]
    m = mesh_from(P, F, Bc)
    # orientation vers l'extérieur
    cen = path.mean(0); fn = np.cross(m.V[m.F[:, 1]] - m.V[m.F[:, 0]], m.V[m.F[:, 2]] - m.V[m.F[:, 0]])
    ctr = P.mean(1); rad = (P - ctr[:, None, :]).reshape(-1, 3)
    if (fn * rad[m.F[:, 0]]).sum() < 0: m.F = m.F[:, ::-1].copy()
    m.N = normals(m, weld=True)
    return m

def blob(c, r, rot=0.0, sq=(1, 1, 1), seg=10, rings=6, br=0.9, lumpy=0.0, seed=0):
    """Ellipsoïde bosselé (boucles, chignon, extrémités)."""
    th = np.linspace(0, np.pi, rings + 1); ph = np.linspace(0, 2 * np.pi, seg, endpoint=False)
    TH, PH = np.meshgrid(th, ph, indexing='ij')
    d = np.stack([np.sin(TH) * np.cos(PH), np.cos(TH), np.sin(TH) * np.sin(PH)], -1)
    rr = r * (1 + lumpy * noise3(d * 3, seed, 2.0))[..., None]
    P = d * rr * np.asarray(sq) + np.asarray(c)
    F = []
    for i in range(rings):
        for k in range(seg):
            a_, b_ = i * seg + k, i * seg + (k + 1) % seg; c_, d_ = (i + 1) * seg + (k + 1) % seg, (i + 1) * seg + k
            F += [(a_, b_, c_), (a_, c_, d_)]
    b = br * (0.85 + 0.15 * np.clip((d[..., 1] + 1) / 2, 0, 1))
    m = mesh_from(P, F, b)
    fn = np.cross(m.V[m.F[:, 1]] - m.V[m.F[:, 0]], m.V[m.F[:, 2]] - m.V[m.F[:, 0]])
    if (fn * (m.V[m.F[:, 0]] - np.asarray(c))).sum() < 0: m.F = m.F[:, ::-1].copy()
    m.N = normals(m, weld=True); return m

def band(c, r, tube, axis='y', tilt=(0, 0), br=0.35):
    """Lien (anneau fin) autour d'un faisceau : torus de rayon r, section tube."""
    n, k = 14, 5; ps = []
    for i in range(n):
        a = 2 * np.pi * i / n; ps.append(np.array([np.cos(a) * r, 0, np.sin(a) * r]))
    path = np.array(ps + [ps[0]])
    # tube le long du cercle
    T, S, U = _frames(path, (0, 1, 0))
    ang = np.linspace(0, 2 * np.pi, k, endpoint=False); P = np.zeros((len(path), k, 3))
    for i in range(len(path)):
        for j, a in enumerate(ang): P[i, j] = path[i] + S[i] * tube * np.cos(a) + U[i] * tube * np.sin(a)
    F = []
    for i in range(len(path) - 1):
        for j in range(k):
            a_, b_ = i * k + j, i * k + (j + 1) % k; c_, d_ = (i + 1) * k + (j + 1) % k, (i + 1) * k + j
            F += [(a_, c_, b_), (a_, d_, c_)]
    m = mesh_from(P, F, br)
    if axis == 'z':
        m.V = np.stack([m.V[:, 0], -m.V[:, 2], m.V[:, 1]], 1)
    if tilt != (0, 0):
        rx, rz = tilt; cx, sx = np.cos(rx), np.sin(rx); cz, sz = np.cos(rz), np.sin(rz)
        R = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]) @ np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]); m.V = m.V @ R.T
    m.V = m.V + np.asarray(c); m.N = normals(m, weld=True); return m

# ----------------------------------------------------------------------------------------------- trajectoires
DOWN = np.array([0, -1.0, 0])

def surf_path(pts):
    """pts : liste (t, phi, off) → points 3D le long du cuir chevelu."""
    out = []
    for t, ph, off in pts: out.append(sp(t, ph, off)[0])
    return np.array(out)

def hang(t, phi, length, off=0.004, lead=0.012, flare=0.012, wave=0.0, waves=1.5, ph0=0.0, back=0.0, front=0.0, to_y=None):
    """Mèche qui part du cuir chevelu (t, phi) et retombe en s'écartant du crâne ; renvoie les points."""
    p0, n0 = sp(t, phi, off); n0 = np.asarray(n0)
    h = np.array([p0[0], 0, p0[2] + 0.005]); hn = h / (np.linalg.norm(h) + 1e-9)
    tang = np.array([hn[2], 0, -hn[0]])
    y_end = p0[1] - length if to_y is None else to_y
    pts = [p0, p0 + n0 * lead * 0.6]
    for s in np.linspace(0.12, 1, 9):
        y = p0[1] + (y_end - p0[1]) * s
        out = (lead + flare * np.sin(np.pi * min(1, s * 1.2)) + 0.004 * s) * 1.0
        base = np.array([p0[0], 0, p0[2]]) + hn * out + (n0 * np.array([1, 0, 1])) * lead * 0.5 * (1 - s)
        base = base + np.array([0, 0, -back * s ** 1.5 + front * s ** 1.5])
        base = base + tang * wave * np.sin(2 * np.pi * waves * s + ph0) * s
        pts.append(np.array([base[0], y, base[2]]))
    return np.array(pts)

def comb_back(ph0, t0=0.80, t1=0.45, off=0.010, conv=0.35, over=0.004, bulge=0.0):
    """Mèche peignée vers l'arrière : part du front (phi0), passe par le sommet puis redescend derrière en convergeant vers l'axe."""
    pts = [(t0, ph0 * 0.8, off - 0.002), (0.5 * (t0 + 1), ph0 * 0.6, off + over), (0.995, ph0 * 0.3, off + over + 0.0015)]
    back = np.pi * np.sign(ph0 if ph0 != 0 else 1.0)
    pts += [(0.93, back - (back - ph0 * 0.3) * 0.0 - ph0 * conv * 0.5, off + over + bulge), (0.5 * (t1 + 0.93), back - ph0 * conv * 0.75, off + bulge), (t1, back - ph0 * conv, off - 0.001 + bulge)]
    return surf_path(pts)

def rng_(seed): return np.random.default_rng(seed)

def phis(n, lo=-np.pi, hi=np.pi, jit=0.0, seed=0):
    r = rng_(seed); a = np.linspace(lo, hi, n, endpoint=False) + (hi - lo) / n * 0.5
    return a + r.uniform(-jit, jit, n) * (hi - lo) / n

def cap(th=0.007, front=0.80, side=0.62, ear=0.56, back=0.36, crown=0.4, lump_a=0.0, **kw):
    def off(T, PH):
        hl = hairline(PH, front, side, ear, back)
        o = th * (1 + crown * sm(T, 0.8, 1.0)) * sm(T - hl, 0.0, 0.05)
        return o
    lump = None
    if lump_a:
        lump = lambda P, T, PH: lump_a * noise3(P * 100, 5, 1.0)
    return shell(off, lump=lump, hl=lambda PH: hairline(PH, front, side, ear, back), **kw)


# ----------------------------------------------------------------------------------------------- rideau (cheveux longs d'un seul tenant : crâne + chute)
def curtain(yend, lo=-np.pi, hi=np.pi, nu=88, th=0.0072, crown=0.4, hlk=(0.80, 0.60, 0.52, 0.36), flare=0.012, corr=0.0032, ncorr=30,
            wave=0.0, waves=1.5, gate=(0.35, 0.8), rag=0.012, seed=1, back=0.0, nvs=11, nvh=14, bright=0.86, streak=0.2, tail=0.0):
    """Nappe de cheveux : suit le crâne depuis le sommet jusqu'à la ligne d'implantation puis retombe jusqu'à yend(phi). Fente devant (gate) pour dégager le visage."""
    full = (hi - lo) > 2 * np.pi - 1e-6
    phi = np.linspace(lo, hi, nu, endpoint=not full)
    rg = np.random.default_rng(seed)
    cols = []
    rows_total = nvs + nvh
    P = np.zeros((rows_total, nu, 3)); B = np.zeros((rows_total, nu))
    tj = [float(hairline(p_, *hlk)) for p_ in phi]
    for j, ph in enumerate(phi):
        a = abs(((ph + np.pi) % (2 * np.pi)) - np.pi)
        hlj = tj[j]
        g = sm(a, gate[0], gate[1])
        ts = np.linspace(0.992, hlj, nvs)
        # épaisseur : couverture du crâne
        for i, t in enumerate(ts):
            thick = th * (1 + crown * sm(t, 0.8, 1.0)) * sm(i, 0, 1.5) * (1.0 if i > 0 else 0.3)
            pt, n = sp(t, ph, max(thick, 0.0008))
            P[i, j] = pt; B[i, j] = bright
        base, nb = sp(hlj, ph, th)
        d = np.array([base[0], 0, base[2] + 0.005]); d /= np.linalg.norm(d) + 1e-9
        tang = np.array([d[2], 0, -d[0]])
        y0 = base[1]
        L = (y0 - yend(ph)) * g
        rag_j = rag * (0.5 * np.sin(j * 2.7 + seed) + 0.5 * np.sin(j * 6.1)) * (L > 0.02)
        L = max(0.0, L + rag_j)
        for k in range(nvh):
            s_ = (k + 1) / nvh
            y = y0 - L * s_
            out = flare * sm(s_, 0.0, 0.6) + 0.0
            cr = corr * np.sin(ncorr * ph + 1.7 * np.sin(s_ * 2.0 + j * 0.3)) * sm(s_, 0.0, 0.25)
            w = wave * np.sin(2 * np.pi * waves * s_ + ph * 3.0) * sm(s_, 0.05, 0.5)
            pos = base + d * (out + cr) + tang * w + np.array([0, 0, -back * s_ * (1 if np.cos(ph) < 0.3 else 0)])
            pos[1] = y
            P[nvs + k, j] = pos
            B[nvs + k, j] = bright * (1 - 0.1 * s_ * 0)
    # couleurs : traînées de mèches (colonnes) + extrémités un peu plus claires
    cs = np.arange(nu)
    st = vn(cs * 0.9, seed) * 0.5 + vn(cs * 2.9, seed + 2) * 0.5
    B = B + streak * st[None, :] * 0.8
    F = []
    ju = nu if full else nu - 1
    for i in range(rows_total - 1):
        for j in range(ju):
            a_, b_ = i * nu + j, i * nu + (j + 1) % nu; c_, d_ = (i + 1) * nu + (j + 1) % nu, (i + 1) * nu + j
            if np.allclose(P[i, j], P[i + 1, j]) and np.allclose(P[i, (j + 1) % nu], P[i + 1, (j + 1) % nu]): continue
            F += [(a_, b_, c_), (a_, c_, d_)]
    m = mesh_from(P, F, B)
    fn = np.cross(m.V[m.F[:, 1]] - m.V[m.F[:, 0]], m.V[m.F[:, 2]] - m.V[m.F[:, 0]])
    if (fn * (m.V[m.F[:, 0]] - np.array([0, 0, -0.005]))).sum() < 0: m.F = m.F[:, ::-1].copy()
    m.N = normals(m, weld=full)
    return _compact(m)

# ----------------------------------------------------------------------------------------------- coiffures
def h_classique():
    ms = [cap(0.0065, front=0.79, side=0.64, ear=0.58, back=0.42, crown=0.5, seed=3)]
    for i, ph in enumerate(np.linspace(-0.55, 0.45, 9)):          # mèches qui retombent sur le front, raie à gauche
        L = 0.012 + 0.006 * np.cos(i)
        pts = surf_path([(0.93, ph * 0.5 + 0.1, 0.007), (0.86, ph * 0.8 + 0.1, 0.0085), (0.79, ph + 0.15, 0.0075), (0.75, ph * 1.1 + 0.25, 0.0045)])
        ms.append(lock(pts, 0.0058, 0.003, hint=sp(0.85, ph, 0)[1], taper=0.15, seed=i, n=10))
    return ms

def h_crane_rase(): return [cap(0.0016, front=0.78, side=0.62, ear=0.56, back=0.36, crown=0.1, streak=0.1, bright=0.55, seed=4)]

def h_coupe_courte():
    ms = [cap(0.010, front=0.80, side=0.66, ear=0.60, back=0.45, crown=0.55, seed=5)]
    for i, ph in enumerate(np.linspace(-0.7, 0.7, 12)):
        pts = surf_path([(0.97, ph * 0.3, 0.012), (0.90, ph * 0.6, 0.016), (0.82, ph * 0.9, 0.0135), (0.77, ph * 1.0, 0.008)])
        ms.append(lock(pts, 0.0062, 0.0042, hint=sp(0.86, ph, 0)[1], taper=0.1, seed=10 + i, n=9))
    return ms

def h_undercut():
    stub = cap(0.0016, front=0.78, side=0.60, ear=0.55, back=0.34, crown=0.0, streak=0.1, bright=0.55, seed=6)
    def off(T, PH):
        a = np.abs(((PH + np.pi) % (2 * np.pi)) - np.pi)
        zone = sm(T - (0.80 - 0.0 * a), 0, 0.05) * (1 - sm(a, 1.9, 2.5)) * sm(T, 0.73, 0.78)
        top = 0.012 + 0.014 * sm(T, 0.8, 1.0)
        return top * sm(T - np.interp(a, [0, 1, 1.9, 2.5], [0.80, 0.77, 0.76, 0.74]), 0, 0.04) * (1 - sm(a, 1.9, 2.4))
    body = shell(off, seed=7)
    ms = [stub, body]
    for i, ph in enumerate(np.linspace(-0.9, 0.9, 13)):           # mèches plaquées en arrière
        pts = surf_path([(0.80 + 0.01 * np.cos(i), ph * 0.9, 0.012), (0.9, ph * 0.7, 0.0245), (0.98, ph * 0.3, 0.0295), (0.92, ph * 0.25 + np.sign(ph) * 0.1 + 3.14 * 0, 0.0)])
        pts = surf_path([(0.79, ph * 0.9, 0.015), (0.88, ph * 0.75, 0.024), (0.96, ph * 0.5, 0.03), (0.93, np.sign(ph + 1e-6) * (2.2 + 0.2 * abs(ph)), 0.026)])
        ms.append(lock(pts, 0.0058, 0.004, hint=sp(0.9, ph, 0)[1], taper=0.2, seed=20 + i, n=12))
    return ms

def h_iroquoise():
    stub = cap(0.0016, front=0.77, side=0.60, ear=0.55, back=0.32, crown=0.0, streak=0.1, bright=0.5, seed=8)
    ms = [stub]
    N = 26
    for i in range(N):
        u = i / (N - 1)
        if u < 0.5: t = 0.80 + 0.2 * (u / 0.5); ph = 0.0
        else: t = 1.0 - 0.60 * ((u - 0.5) / 0.5) ** 1.2; ph = np.pi
        base, n0 = sp(t, ph, 0.001)
        h = 0.030 + 0.060 * np.sin(np.pi * min(1, u * 0.92 + 0.05)) ** 0.8
        lean = np.array([0, 0, 0.012 if u < 0.35 else -0.014 * (u - 0.35)]) * (h / 0.06)
        up = np.array([0, 1.0, 0]) * 0.8 + np.asarray(n0) * 0.35
        up = up / np.linalg.norm(up)
        pts = [base, base + up * h * 0.5 + lean * 0.4, base + up * h + lean]
        ms.append(lock(pts, 0.0105, 0.0036, hint=(1, 0, 0), taper=0.2, root=1.0, seed=30 + i, n=9, seg=5, br=0.9))
        ms.append(lock([base + np.array([0.0035, 0, 0]), base + np.array([0.0035, 0, 0]) + up * h * 0.5, base + up * h * 0.85 + np.array([0.0035, 0, 0]) + lean * 0.8], 0.009, 0.0034, hint=(1, 0, 0), taper=0.2, seed=60 + i, n=9, seg=5, br=0.8))
    return ms

def _curl_field(ms, n, ph_lo, ph_hi, tlo, tup, r, seed, off=0.0, thmax=0.01):
    rg = rng_(seed)
    for i in range(n):
        ph = rg.uniform(ph_lo, ph_hi); t = rg.uniform(tlo, tup)
        hl = float(hairline(ph, 0.78, 0.62, 0.56, 0.38))
        if t < hl + 0.02: t = hl + 0.02 + rg.uniform(0, 0.08)
        p, n = sp(min(t, 0.995), ph, 0.0)
        ms.append(blob(p + n * (r * 0.55 + off), r * rg.uniform(0.8, 1.15), sq=(1, 0.85, 1), seg=8, rings=5, br=rg.uniform(0.72, 0.95), lumpy=0.12, seed=i))

def h_boucles_courtes():
    return [lumpy_volume(0.010, 0.008, 22, front=0.79, side=0.62, ear=0.56, back=0.40, amp=0.0052, fr=230)]

def lumpy_volume(extra, extra_top, seed, front=0.82, side=0.64, ear=0.50, back=0.30, amp=0.006, fr=100):
    def off(T, PH):
        hl = hairline(PH, front, side, ear, back)
        return (extra + extra_top * sm(T, 0.7, 1.0)) * sm(T - hl, 0, 0.12) ** 0.6
    lump = lambda P, T, PH: amp * noise3(P * fr, seed, 1.0) + amp * 0.6 * noise3(P * fr * 2.1, seed + 1, 1.0)
    return shell(off, nv=44, nu=72, lump=lump, seed=seed, streak=0.16, bright=0.74, hl=lambda PH: hairline(PH, front, side, ear, back))

def h_afro(): return [lumpy_volume(0.034, 0.030, 20, amp=0.0075)]

def h_dreadlocks():
    ms = [cap(0.0075, front=0.80, side=0.66, ear=0.58, back=0.42, crown=0.3, seed=14, bright=0.7)]
    rg = rng_(15)
    k = 0
    for ph in phis(46, jit=0.5, seed=15):
        t = float(hairline(ph, 0.80, 0.62, 0.52, 0.36)) + rg.uniform(0.02, 0.30)
        L = rg.uniform(0.17, 0.30) * (0.55 if abs(ph) < 0.6 else 1.0)
        pts = hang(t, ph, L, off=0.004, lead=0.014, flare=0.012, wave=0.012, waves=rg.uniform(1, 2.2), ph0=rg.uniform(0, 6), back=0.0)
        ms.append(lock(pts, 0.0072, 0.0072, hint=(0, 1, 0), taper=0.7, seed=k, n=16, seg=6, tw_amp=0.14, lobes=1, twist=rg.uniform(3, 6), close=True, br=0.84)); k += 1
    return ms

def h_catogan():
    ms = [cap(0.007, front=0.78, side=0.62, ear=0.58, back=0.50, crown=0.2, seed=16)]
    ctr = np.array([0, 0.045, -0.112])
    for i in range(10):                                        # chignon de combattant : mèches ramenées en arrière puis enroulées
        ph = np.linspace(-0.8, 0.8, 10)[i]
        ms.append(lock(comb_back(ph, 0.80, 0.62, 0.0085, 0.3), 0.0062, 0.0036, hint=sp(0.9, ph, 0)[1], taper=0.7, seed=40 + i, n=16))
    ms.append(blob(np.array([0, 0.060, -0.118]), 0.036, sq=(1.0, 1.15, 1.0), seg=12, rings=8, lumpy=0.1, seed=3, br=0.8))
    ms.append(band(np.array([0, 0.052, -0.098]), 0.022, 0.0034, axis='z', tilt=(0.0, 0.0)))
    return ms

def h_mi_longs():
    ms = [curtain(lambda ph: -0.150 - 0.012 * np.sin(ph * 3), hlk=(0.80, 0.62, 0.52, 0.38), seed=17, flare=0.011, wave=0.003, th=0.0072)]
    for i, ph in enumerate(np.linspace(-0.5, 0.5, 6)):
        pts = surf_path([(0.96, ph * 0.2 + 0.1, 0.011), (0.88, ph * 0.8 + 0.2, 0.0115), (0.80, ph * 1.0 + 0.4, 0.0095), (0.72, ph * 1.0 + 0.55, 0.0065)])
        ms.append(lock(pts, 0.0072, 0.0034, hint=sp(0.85, ph, 0)[1], taper=0.3, seed=500 + i, n=10))
    return ms

def _plait_line(t0, t1, ph, off, N, nseg=14):
    return surf_path([(t0 + (t1 - t0) * s, ph, off) for s in np.linspace(0, 1, nseg)])

def h_tresses_plaquees():
    ms = [cap(0.0028, front=0.79, side=0.63, ear=0.56, back=0.36, crown=0.1, seed=19, bright=0.5, streak=0.1)]
    rows = np.linspace(-1.05, 1.05, 9)
    for i, ph in enumerate(rows):
        a = abs(ph); t0 = float(hairline(ph, 0.80, 0.62, 0.56, 0.4)) + 0.02
        pts = [(t0, ph * 0.85, 0.0045)]
        for s in np.linspace(0.1, 1, 11):
            tt = t0 + (1.0 - t0) * s
            pts.append((min(tt, 0.999), ph * 0.85 * (1 - s * 0.9), 0.0045))
        up = surf_path(pts)
        ms.append(lock(up, 0.0042, 0.0042, hint=(0, 1, 0), taper=0.9, seed=60 + i, n=22, seg=6, tw_amp=0.22, lobes=3, twist=9, close=False, br=0.8))
        # sur l'arrière du crâne : la natte redescend jusqu'à la nuque
        pts2 = [(0.999, 0.0, 0.0045)]
    for i, ph in enumerate(np.linspace(-2.6, 2.6, 9)):
        pts = []
        for s in np.linspace(0, 1, 12): pts.append((0.97 - 0.5 * s, np.pi + (ph - np.sign(ph) * np.pi) * 0 + ph * 0 + (np.pi - abs(ph)) * np.sign(ph) * 0 + (ph / 2.6) * 0.5 * np.pi * (0.6 + 0.4 * s) + 0 * ph, 0.0045))
        ms.append(lock(surf_path(pts), 0.0042, 0.0042, hint=(0, 1, 0), taper=0.9, seed=80 + i, n=18, seg=6, tw_amp=0.22, lobes=3, twist=8, close=False, br=0.8))
    return ms

def h_carre():
    ms = [curtain(lambda ph: -0.097 - 0.006 * np.cos(ph * 2), hlk=(0.80, 0.62, 0.56, 0.42), seed=22, flare=0.014, th=0.0074, gate=(0.3, 0.7), rag=0.003, corr=0.0026)]
    for i, ph in enumerate(np.linspace(-0.5, 0.5, 6)):          # frange droite
        pts = surf_path([(0.95, ph * 0.3, 0.012), (0.87, ph * 0.7, 0.0115), (0.79, ph * 0.9, 0.01), (0.745, ph * 0.9, 0.0075)])
        ms.append(lock(pts, 0.0085, 0.0036, hint=sp(0.85, ph, 0)[1], taper=0.5, seed=140 + i, n=10))
    return ms

def h_pixie():
    ms = [curtain(lambda ph: -0.0 - 0.01 * np.cos(ph * 2), hlk=(0.80, 0.66, 0.60, 0.45), seed=23, flare=0.004, th=0.0075, gate=(0.4, 0.9), rag=0.012, corr=0.002, nvh=8, crown=0.55)]
    for i, ph in enumerate(np.linspace(-0.8, 0.8, 11)):          # longue frange en biais
        sw = 0.35
        pts = surf_path([(0.97, ph * 0.3 - sw * 0.2, 0.012), (0.88, ph * 0.6 + sw * 0.5, 0.014), (0.79, ph * 0.9 + sw, 0.0125), (0.70, ph * 1.0 + sw * 1.4 + 0.1, 0.0085)])
        ms.append(lock(pts, 0.0065, 0.0036, hint=sp(0.85, ph, 0)[1], taper=0.1, seed=150 + i, n=10))
    return ms

def _tail(ms, root, n, L, spread, seed, w=0.0072, curl=0.0, outx=0.0):
    rg = rng_(seed)
    for i in range(n):
        o = np.array([rg.uniform(-spread, spread), rg.uniform(-spread, spread), rg.uniform(-spread, spread) * 0.6])
        p0 = root + o * 0.5
        ln = L * rg.uniform(0.85, 1.1)
        pts = [p0, p0 + np.array([outx * 0.3, -0.004, -0.014]) + o * 0.2, p0 + np.array([outx * 0.6 + o[0], -0.05 - 0.0, -0.030 + o[2]]),
               p0 + np.array([outx + o[0] * 1.4 + curl * np.sin(i), -ln * 0.65, -0.026]), p0 + np.array([outx * 1.1 + o[0] * 1.6 + curl * np.cos(i), -ln, -0.014])]
        ms.append(lock(pts, w, w * 0.55, hint=(0, 0, 1), taper=0.2, seed=seed + i, n=16, br=0.88))

def h_queue_de_cheval():
    ms = [cap(0.0065, front=0.78, side=0.62, ear=0.57, back=0.50, crown=0.2, seed=24)]
    for i, ph in enumerate(np.linspace(-1.0, 1.0, 9)):
        ms.append(lock(comb_back(ph, 0.80, 0.60, 0.0085, 0.45), 0.0065, 0.0036, hint=sp(0.9, ph, 0)[1], taper=0.7, seed=160 + i, n=16))
    root = np.array([0, 0.052, -0.108]); _tail(ms, root, 11, 0.30, 0.012, 170, outx=0.0)
    ms.append(band(root + np.array([0, -0.01, -0.004]), 0.018, 0.0036, axis='z', tilt=(0.5, 0)))
    return ms

def h_longs_lisses():
    ms = [curtain(lambda ph: -0.32 - 0.03 * np.cos(ph * 1.5 + 1), hlk=(0.80, 0.60, 0.52, 0.36), seed=26, flare=0.013, th=0.0074, back=0.012, gate=(0.35, 0.8), rag=0.02, wave=0.003)]
    for i, ph in enumerate(np.linspace(-0.4, 0.4, 5)):          # raie au milieu
        pts = surf_path([(0.96, ph * 0.2, 0.012), (0.87, ph * 0.8 + np.sign(ph + 1e-6) * 0.5, 0.0115), (0.78, ph * 1.2 + np.sign(ph + 1e-6) * 0.9, 0.009), (0.70, ph * 1.0 + np.sign(ph + 1e-6) * 1.15, 0.006)])
        ms.append(lock(pts, 0.0075, 0.0036, hint=sp(0.85, ph, 0)[1], taper=0.4, seed=230 + i, n=10))
    return ms

def h_tresse():
    ms = [cap(0.0065, front=0.78, side=0.62, ear=0.57, back=0.46, crown=0.2, seed=27)]
    for i, ph in enumerate(np.linspace(-1.0, 1.0, 9)):
        ms.append(lock(comb_back(ph, 0.80, 0.55, 0.0085, 0.6), 0.0065, 0.0036, hint=sp(0.9, ph, 0)[1], taper=0.7, seed=240 + i, n=16))
    start = np.array([0, 0.012, -0.108])
    path = [start, start + np.array([0, -0.03, -0.014]), start + np.array([0, -0.10, -0.022]), start + np.array([0.004, -0.20, -0.02]), start + np.array([0.0, -0.30, -0.012]), start + np.array([-0.002, -0.37, -0.006])]
    ms.append(lock(path, 0.0175, 0.0175, hint=(1, 0, 0), taper=0.35, seed=250, n=44, seg=12, tw_amp=0.2, lobes=3, twist=17, br=0.85))
    ms.append(band(start + np.array([0, -0.37, -0.006]), 0.0075, 0.003, axis='y'))
    return ms

def h_chignon():
    ms = [cap(0.0065, front=0.78, side=0.62, ear=0.57, back=0.46, crown=0.3, seed=28)]
    for i, ph in enumerate(np.linspace(-1.0, 1.0, 9)):
        ms.append(lock(comb_back(ph, 0.80, 0.80, 0.0085, 0.2, bulge=0.012), 0.0065, 0.0036, hint=sp(0.9, ph, 0)[1], taper=0.7, seed=260 + i, n=16))
    ms.append(blob(np.array([0, 0.098, -0.066]), 0.052, sq=(1.0, 0.88, 1.0), seg=16, rings=10, lumpy=0.05, seed=7, br=0.82))
    ms.append(band(np.array([0, 0.090, -0.062]), 0.047, 0.0034, axis='y', br=0.4, tilt=(0.0, 0.0)))
    for k in range(4):                                                  # volutes du chignon (mèches enroulées)
        a = 0.8 + k * 1.1
        c = np.array([np.cos(a) * 0.036, 0.098 + 0.014 * np.sin(a * 1.3), -0.066 + np.sin(a) * 0.036])
        ms.append(lock([c + np.array([0, 0.012, 0]), c + np.array([np.cos(a + 0.9) * 0.02, 0.016, np.sin(a + 0.9) * 0.02]), c + np.array([np.cos(a + 1.8) * 0.034, 0.004, np.sin(a + 1.8) * 0.034])], 0.011, 0.007, hint=(0, 1, 0), taper=0.4, seed=k, n=12, br=0.88))
    return ms

def h_couettes():
    ms = [cap(0.0065, front=0.79, side=0.64, ear=0.58, back=0.44, crown=0.3, seed=29)]
    for i, ph in enumerate(np.linspace(-0.5, 0.5, 5)):
        pts = surf_path([(0.96, ph * 0.2, 0.012), (0.87, ph * 0.8 + np.sign(ph + 1e-6) * 0.3, 0.011), (0.78, ph * 1.2 + np.sign(ph + 1e-6) * 0.6, 0.009), (0.72, ph * 1.0 + np.sign(ph + 1e-6) * 0.8, 0.006)])
        ms.append(lock(pts, 0.0075, 0.0036, hint=sp(0.85, ph, 0)[1], taper=0.4, seed=270 + i, n=10))
    for sg in (-1, 1):
        root = np.array([sg * 0.062, 0.062, -0.050])
        _tail(ms, root, 12, 0.22, 0.010, 280 + (sg + 1) * 10, w=0.0090, outx=sg * 0.03)
        ms.append(band(root + np.array([sg * 0.004, -0.008, -0.004]), 0.014, 0.0032, axis='y', tilt=(0, -sg * 0.5)))
    return ms

def h_boucles_longues():
    ms = [curtain(lambda ph: -0.27 - 0.03 * np.cos(ph * 2 + 1), hlk=(0.80, 0.60, 0.50, 0.34), seed=30, flare=0.02, th=0.0085, back=0.008, gate=(0.35, 0.8), rag=0.03, wave=0.016, waves=3.2, corr=0.006, ncorr=22, bright=0.74)]
    rg = rng_(31); k = 0
    for ph in phis(16, jit=0.4, seed=31):
        if abs(ph) < 0.5: continue
        t = float(hairline(ph, 0.80, 0.60, 0.52, 0.38)) + rg.uniform(0, 0.04)
        p = hang(t, ph, 0.3, off=0.008, lead=0.02, flare=0.02, to_y=rg.uniform(-0.30, -0.22), back=0.005)
        path = smoothpath(p, 36); T, S, U = _frames(path, (0, 0, 1)); s_ = np.linspace(0, 1, 36)
        rr = 0.013 * (0.35 + 0.65 * s_); turns = 4.0
        helix = path + S * (rr * np.cos(2 * np.pi * turns * s_ + k))[:, None] + U * (rr * np.sin(2 * np.pi * turns * s_ + k))[:, None]
        ms.append(lock(helix, 0.0075, 0.0075, hint=(0, 1, 0), taper=0.4, seed=300 + k, n=36, seg=6, br=0.72)); k += 1
    return ms

def h_afro_volumineux(): return [lumpy_volume(0.052, 0.046, 21, front=0.84, side=0.66, ear=0.46, back=0.22, amp=0.009)]

def h_tresses_box():
    ms = [cap(0.0045, front=0.79, side=0.62, ear=0.52, back=0.32, crown=0.15, seed=32, bright=0.55, streak=0.1)]
    rg = rng_(33); k = 0
    for ph in phis(30, jit=0.3, seed=33):
        for row in (0, 1):
            t = float(hairline(ph, 0.80, 0.62, 0.53, 0.40)) + (0.0 if row == 0 else 0.10) + rg.uniform(0, 0.02)
            if row == 1 and abs(ph) < 0.8: continue
            if abs(ph) < 0.3 and row == 0: continue
            L = rg.uniform(0.28, 0.36) * (0.8 if abs(ph) < 1.0 else 1.0)
            pts = hang(t, ph, L, off=0.004, lead=0.014, flare=0.014, back=0.004, to_y=-0.22 - rg.uniform(0, 0.14) * (1 if abs(ph) > 1.0 else 0.4))
            ms.append(lock(pts, 0.0058, 0.0058, hint=(0, 1, 0), taper=0.85, seed=330 + k, n=22, seg=5, tw_amp=0.22, lobes=3, twist=12, br=0.8)); k += 1
    return ms

def h_rase_cote():
    base_hl = lambda PH: np.where(np.asarray(PH) > 0.3, hairline(PH, 0.80, 0.80, 0.74, 0.62), hairline(PH, 0.80, 0.62, 0.52, 0.36))
    stub = shell(lambda T, PH: 0.0016 * sm(T - hairline(PH, 0.78, 0.60, 0.55, 0.36), 0, 0.06) * sm(PH, -0.2, 0.3), bright=0.55, streak=0.1, seed=34, hl=lambda PH: hairline(PH, 0.78, 0.60, 0.55, 0.36))
    top = shell(lambda T, PH: 0.0078 * (1 + 0.5 * sm(T, 0.8, 1)) * sm(T - base_hl(PH), 0, 0.05) * (1 - sm(PH, 0.3, 0.9) * (1 - sm(np.abs(PH), 2.6, 3.1))), hl=base_hl, seed=35)
    ms = [stub, top, curtain(lambda ph: -0.23 - 0.04 * np.cos(ph), lo=-np.pi * 0.98, hi=-0.25, hlk=(0.80, 0.60, 0.50, 0.34), seed=35, flare=0.012, th=0.0078, gate=(0.4, 0.9), rag=0.02, back=0.006, wave=0.003)]
    for i, ph in enumerate(np.linspace(-0.5, 0.2, 6)):               # grande frange rabattue sur le côté droit
        pts = surf_path([(0.97, ph * 0.4 + 0.5, 0.012), (0.88, ph * 0.8, 0.0125), (0.79, ph * 1.1 - 0.5, 0.012), (0.68, ph * 1.0 - 1.1, 0.008)])
        ms.append(lock(pts, 0.0085, 0.0038, hint=sp(0.85, ph, 0)[1], taper=0.3, seed=400 + i, n=12))
    return ms

HAIR_STYLES = {
    'classique': h_classique, 'crane-rase': h_crane_rase, 'coupe-courte': h_coupe_courte, 'undercut': h_undercut, 'iroquoise': h_iroquoise,
    'boucles-courtes': h_boucles_courtes, 'afro': h_afro, 'dreadlocks': h_dreadlocks, 'catogan': h_catogan, 'mi-longs': h_mi_longs,
    'tresses-plaquees': h_tresses_plaquees, 'carre': h_carre, 'pixie': h_pixie, 'queue-de-cheval': h_queue_de_cheval, 'longs-lisses': h_longs_lisses,
    'tresse': h_tresse, 'chignon': h_chignon, 'couettes': h_couettes, 'boucles-longues': h_boucles_longues, 'afro-volumineux': h_afro_volumineux,
    'tresses-box': h_tresses_box, 'rase-cote': h_rase_cote,
}

# ----------------------------------------------------------------------------------------------- barbes
def _face_mask_beard(kind):
    """Épaisseur de poils (m) selon (t, phi) sur le bas du visage ; trou pour la bouche."""
    def off(T, PH):
        x, y, z, _ = _surf(T, PH)
        a = np.abs(PH); front = np.cos(PH)
        jaw = sm(front, -0.2, 0.2)
        # zone : sous la ligne de la pommette et jusqu'au menton ; contour libre sur la joue (pattes)
        cheek_line = -0.015 + 0.02 * sm(a, 0.8, 1.6)
        zone = sm(cheek_line - y, 0.0, 0.03)
        zone = zone * sm(y + 0.125, 0.0, 0.01) * (1 - sm(a, 2.0, 2.4))
        # trou de la bouche et de la lèvre : x ∈ ±0.03, y ∈ [-0.083, -0.05]
        mouth = 1 - sm(0.034 - np.abs(x), 0, 0.012) * sm(y + 0.083, 0, 0.006) * sm(-0.052 - y, 0, 0.006) * (front > 0)
        return zone * mouth * jaw
    return off

def b_trois_jours():
    off = _face_mask_beard('3j')
    return [shell(lambda T, PH: 0.0017 * off(T, PH) ** 0.7, nv=70, nu=100, tlo=0.0, thi=0.62, prange=(-2.4, 2.4), bright=0.5, streak=0.1, seed=40, thr=0.0003, skin_fade=0.45)]

def b_courte():
    off = _face_mask_beard('c')
    ms = [shell(lambda T, PH: 0.0072 * off(T, PH) ** 0.8, nv=70, nu=100, tlo=0.0, thi=0.62, prange=(-2.4, 2.4), bright=0.8, streak=0.2, seed=41, thr=0.0004, skin_fade=0.25, lump=lambda P, T, PH: 0.0012 * noise3(P * 160, 3, 1.0))]
    ms += _moustache(0.0065)
    return ms

def _moustache(w):
    ms = []
    for sg in (-1, 1):
        z = float(H.face_z('homme', 'ovale', 0.012, -0.052)) + 0.0035
        pts = [np.array([sg * 0.002, -0.0475, z + 0.002]), np.array([sg * 0.014, -0.0535, z - 0.0005]), np.array([sg * 0.027, -0.0605, z - 0.011]), np.array([sg * 0.034, -0.073, z - 0.022])]
        ms.append(lock(pts, 0.0058, 0.0042, hint=(0, 0, 1), taper=0.35, root=0.8, seed=410 + sg, n=14, close=True, br=0.8))
    return ms

def b_moustache():
    ms = _moustache(0.0065)
    z = float(H.face_z('homme', 'ovale', 0.0, -0.05))
    return ms + [shell(lambda T, PH: 0.0016 * sm(0.03 - np.abs(_surf(T, PH)[0]), 0, 0.01) * sm(_surf(T, PH)[1] + 0.062, 0, 0.004) * sm(-0.044 - _surf(T, PH)[1], 0, 0.004) * (np.cos(PH) > 0), nv=40, nu=60, tlo=0.2, thi=0.5, prange=(-0.9, 0.9), bright=0.5, streak=0.1, seed=43, thr=0.0003, skin_fade=0.4)]

def b_bouc():
    def off(T, PH):
        x, y, z, _ = _surf(T, PH)
        return 0.0095 * sm(0.022 - np.abs(x), 0, 0.012) * sm(-0.082 - y, 0, 0.006) * sm(y + 0.125, 0, 0.008) * (np.cos(PH) > 0.2)
    ms = [shell(off, nv=70, nu=100, tlo=0.0, thi=0.62, prange=(-2.4, 2.4), bright=0.78, streak=0.2, seed=44, thr=0.0004, skin_fade=0.25)]
    z0 = float(H.face_z('homme', 'ovale', 0.0, -0.112)) + 0.003
    ms.append(lock([np.array([0, -0.10, z0 + 0.004]), np.array([0, -0.125, z0 + 0.006]), np.array([0.0, -0.152, z0 - 0.004]), np.array([0.0, -0.170, z0 - 0.012])], 0.013, 0.011, hint=(1, 0, 0), taper=0.1, root=0.9, seed=45, n=12))
    return ms + _moustache(0.006)

def b_longue():
    off = _face_mask_beard('l')
    ms = [shell(lambda T, PH: 0.011 * off(T, PH) ** 0.8, nv=70, nu=100, tlo=0.0, thi=0.62, prange=(-2.4, 2.4), bright=0.8, streak=0.22, seed=46, thr=0.0004, skin_fade=0.25, lump=lambda P, T, PH: 0.0018 * noise3(P * 140, 3, 1.0))]
    ms += _moustache(0.007)
    rg = rng_(47)
    for i in range(16):                                              # masse de poils sous le menton
        u = (i - 7.5) / 7.5
        ph = u * 1.9
        x0 = np.sin(ph) * 0.052 * (1 - 0.3 * abs(u)); z0 = 0.068 * np.cos(ph) * (1 - 0.1 * abs(u)) + 0.002
        y0 = -0.095 - 0.022 * (1 - abs(u))
        L = 0.12 + 0.08 * (1 - abs(u)) + rg.uniform(-0.015, 0.015)
        pts = [np.array([x0, y0, z0 + 0.003]), np.array([x0 * 0.85, y0 - 0.03, z0 + 0.012]), np.array([x0 * 0.55, y0 - L * 0.6, z0 + 0.016 - 0.002 * abs(u)]), np.array([x0 * 0.2 + rg.uniform(-0.004, 0.004), y0 - L, z0 + 0.012])]
        ms.append(lock(pts, 0.0085, 0.0075, hint=(1, 0, 0), taper=0.12, seed=470 + i, n=14, br=0.82))
    return ms

BEARDS = {'barbe-3-jours': b_trois_jours, 'moustache': b_moustache, 'bouc': b_bouc, 'barbe-courte': b_courte, 'barbe-longue': b_longue}

def build(name):
    fn = HAIR_STYLES.get(name) or BEARDS[name]
    return concat([x for x in fn() if x is not None and len(x.V)])
