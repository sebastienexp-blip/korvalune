"""head_geo — tête humaine modélisée (visage, yeux, nez, lèvres, sourcils, oreilles) pour les personnages joueurs.
Tout est de la vraie géométrie (aucune génération au lancement) : 12 têtes (homme/femme × 6 formes de visage), 5 yeux, 5 nez, lèvres, sourcils, 3 types d'oreilles.
Repère : origine = centre du crâne, +Z = devant, +Y = haut, +X = gauche du personnage ; mètres à l'échelle du Veilleur (menton ≈ -0.118, sommet ≈ +0.118).
Teintes à l'exécution (rôle de sommet = alpha) : 0.8 = couleur « principale » du module (peau, ou cheveux pour les poils), 0.4 = couleur secondaire (iris), 1.0 = fixe."""
import numpy as np
from glbkit import Mesh, concat, normals, dn, dgrid, KD

SKIN, ACC, FIX = 0.8, 0.4, 1.0

def sm(x, a, b):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def gau(x, y, cx, cy, sx, sy):
    return np.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2))

def grid(P, wrap=False, flip=False, color=None, role=SKIN, uv=None):
    """Maillage en grille : P[i][j] (i = haut, j = tour). Normales lissées."""
    P = np.asarray(P, float); nv, nu = P.shape[:2]
    V = P.reshape(-1, 3); F = []
    ju = nu if wrap else nu - 1
    for i in range(nv - 1):
        for j in range(ju):
            a, b = i * nu + j, i * nu + (j + 1) % nu
            c, d = (i + 1) * nu + (j + 1) % nu, (i + 1) * nu + j
            F += [(a, c, b), (a, d, c)] if flip else [(a, b, c), (a, c, d)]
    UV = np.stack(np.meshgrid(np.linspace(0, 1, nu), np.linspace(0, 1, nv)), -1).reshape(-1, 2)
    m = Mesh(V, np.array(F), UV)
    col = np.ones((len(V), 3)) if color is None else np.asarray(color, float).reshape(-1, 3)
    m.C = np.concatenate([col, np.full((len(V), 1), role)], 1)
    m.N = normals(m, weld=False) if not wrap else normals(m, weld=True)
    return m

# ----------------------------------------------------------------------------------------------- crâne
FACES = {   # multiplicateurs (largeur, hauteur) comme src/data/looks.js
    'ovale': dict(skull=(1, 1), jaw=(1, 1), chin=(1, 1), cheek=1.0),
    'rond': dict(skull=(1.06, .96), jaw=(1.1, .95), chin=(1.12, .85), cheek=1.0),
    'carre': dict(skull=(1.04, .99), jaw=(1.16, 1.06), chin=(1.3, .95), cheek=1.0),
    'long': dict(skull=(.94, 1.08), jaw=(.92, 1.14), chin=(.95, 1.2), cheek=1.0),
    'coeur': dict(skull=(1.05, 1.02), jaw=(.85, 1.02), chin=(.75, 1.05), cheek=1.0),
    'anguleux': dict(skull=(.97, 1.04), jaw=(1.05, 1.0), chin=(.85, 1.15), cheek=1.35),
}
TK = np.array([0, .03, .08, .16, .26, .38, .5, .62, .72, .82, .9, .96, .99, 1.0])
KA = np.array([.010, .020, .034, .050, .062, .069, .073, .075, .076, .0745, .068, .053, .030, 0.0])
KF = np.array([.030, .060, .068, .067, .072, .077, .086, .088, .084, .077, .062, .042, .022, 0.0])
KB = np.array([.030, .040, .052, .068, .082, .093, .099, .101, .099, .092, .075, .052, .026, 0.0])
Y0, HH = -0.118, 0.236

def _interp(k, t):
    # interpolation lissée (PCHIP simplifié par moyenne glissante sur une grille dense)
    tt = np.linspace(0, 1, 400); v = np.interp(tt, TK, k)
    ker = np.ones(15) / 15; vv = np.convolve(np.pad(v, 7, mode='edge'), ker, mode='valid')
    return np.interp(t, tt, vv)

def face_params(sex, shape):
    f = FACES[shape]; fem = sex == 'femme'
    s = 0.955 if fem else 1.0
    return f, fem, s

def surface_fn(sex, shape):
    """Renvoie (fonction (t, φ) → points, fonction z_visage(x, y)) pour la tête demandée."""
    f, fem, s = face_params(sex, shape)
    def levels(t):
        t = np.asarray(t, float)
        a = _interp(KA, t) * s; zf = _interp(KF, t) * s; zb = _interp(KB, t) * s
        low = 1 - sm(t, 0.28, 0.55); hi = sm(t, 0.45, 0.8); chin = 1 - sm(t, 0.06, 0.2)
        a = a * (1 + (f['jaw'][0] - 1) * low) * (1 + (f['chin'][0] - 1) * 0.7 * chin) * (1 + (f['skull'][0] - 1) * hi)
        zb = zb * (1 + (f['skull'][0] - 1) * hi * 0.6)
        if fem: a = a * (1 - 0.06 * low)
        # hauteur : mâchoire/menton allongent le bas du visage, le crâne le haut
        y = Y0 + HH * t
        ym = Y0 + HH * 0.52
        y = np.where(t < 0.52, ym + (y - ym) * (f['jaw'][1] * (1 + (f['chin'][1] - 1) * chin * 0.8)) * (0.97 if fem else 1),
                     ym + (y - ym) * f['skull'][1] * (0.97 if fem else 1))
        return a, zf, zb, y
    def surf(t, phi, nexp=None):
        a, zf, zb, y = levels(t)
        n = (2.1 + 0.7 * (1 - sm(t, 0.25, 0.55))) if nexp is None else nexp
        sn, cs = np.sin(phi), np.cos(phi)
        x = a * np.sign(sn) * np.abs(sn) ** (2 / n)
        z = np.where(cs >= 0, zf, zb) * np.sign(cs) * np.abs(cs) ** (2 / n)
        return x, y, z, a
    return surf, levels, f, fem, s

def relief(x, y, fem, cheek=1.0):
    """Déplacement du visage en z (m) au point (x, y) de la face."""
    d = 0.0
    for sg in (-1, 1):
        d += gau(x, y, sg * .030, .033, .030, .0085) * (0.0035 if fem else 0.0085)       # arcade sourcilière
        d -= gau(x, y, sg * .031, .010, .019, .0135) * (0.0030 if fem else 0.0038)        # orbite
        d += gau(x, y, sg * .052, -.026, .020, .024) * (0.0075 if fem else 0.0055) * cheek  # pommette
        d += gau(x, y, sg * .016, -.075, .018, .014) * (0.003)                             # joue / commissure
        d -= gau(x, y, sg * .066, -.06, .02, .028) * 0.004 * (1 if not fem else 0.5)       # creux sous pommette
    d += gau(x, y, 0, .003, .012, .028) * 0.005                                        # racine du nez
    d += gau(x, y, 0, .060, .06, .04) * 0.002                                          # front bombé
    d -= gau(x, y, 0, -.041, .018, .005) * 0.004                                       # sous-nez
    d += gau(x, y, 0, -.060, .026, .008) * 0.0012                                       # bourrelet des lèvres
    d -= gau(x, y, 0, -.0805, .022, .0045) * 0.004                                     # sillon labio-mentonnier
    d += gau(x, y, 0, -.099, .021, .015) * (0.0045 if fem else 0.0075)                   # menton
    return d

def skin_col(x, y, mask=1.0, T=None):
    """Nuances de peau (joues rosées, contour des yeux, ombre sous le menton) — communes à la tête et aux pièces posées dessus."""
    cheeks = sum(gau(x, y, sg * .048, -.03, .022, .022) for sg in (-1, 1)) * mask
    eyes = sum(gau(x, y, sg * .031, .014, .022, .014) for sg in (-1, 1)) * mask
    col = np.ones(np.shape(x) + (3,))
    col = col * ((1 - 0.07 * cheeks)[..., None]) * np.array([1, .93, .93])[None, None, :] ** cheeks[..., None]
    col = col * (1 - 0.1 * eyes)[..., None]
    if T is not None: col = col * (1 - 0.12 * (1 - sm(T, 0.0, 0.12)))[..., None]
    return col

def build_head(sex='homme', shape='ovale', nv=46, nu=56):
    nv, nu = dn(nv), dn(nu)            # finesse (KV_DETAIL)
    surf, levels, f, fem, s = surface_fn(sex, shape)
    t = np.linspace(0, 1, nv); phi = np.linspace(0, 2 * np.pi, nu, endpoint=False)
    T, PH = np.meshgrid(t, phi, indexing='ij')
    x, y, z, a = surf(T, PH)
    mask = sm(np.cos(PH), 0.12, 0.8)
    z = z + relief(x, y, fem, f['cheek']) * mask
    P = np.stack([x, y, z], -1)
    col = skin_col(x, y, mask, T)
    m = grid(P, wrap=True, color=col, role=SKIN)
    return m

def face_z(sex, shape, X, Y):
    """Altitude z de la surface du visage en (x, y), identique au maillage de la tête (pour poser nez, lèvres, sourcils)."""
    surf, levels, f, fem, s = surface_fn(sex, shape)
    tt = np.linspace(0, 1, 1200); a, zf, zb, yy = levels(tt)
    X = np.asarray(X, float); Y = np.asarray(Y, float)
    t = np.interp(Y, yy, tt)
    a2, zf2, zb2, _ = levels(t)
    n = 2.1 + 0.7 * (1 - sm(t, 0.25, 0.55))
    sn = np.clip(np.abs(X) / np.maximum(a2, 1e-4), 0, 1) ** (n / 2); sn = np.clip(sn, 0, 0.999)
    cs = np.sqrt(1 - sn * sn)
    z = zf2 * cs ** (2 / n)
    return z + relief(X, Y, fem, f['cheek']) * sm(cs, 0.12, 0.8)

# ----------------------------------------------------------------------------------------------- patch sur le visage
def cull(m, hv, thr):
    """Retire les facettes entièrement sous la peau (hauteur < thr)."""
    keep = hv[m.F].max(1) > thr
    F = m.F[keep]; used = np.unique(F); rm = -np.ones(len(m.V), int); rm[used] = np.arange(len(used))
    n = Mesh(m.V[used], rm[F], m.UV[used], None, None, m.C[used]); n.N = m.N[used]; return n

def patch(sex, shape, xs, ys, height, color=None, role=SKIN, sink=0.0015, edge=None):
    """Grille (x, y) posée sur la surface du visage + hauteur(x, y) ; les bords s'enfoncent de `sink` pour se fondre dans la peau."""
    X, Y = np.meshgrid(xs, ys); h = height(X, Y)
    z = face_z(sex, shape, X, Y) + h
    if edge is None:
        e = sm(np.minimum(np.minimum(np.arange(len(xs))[None, :], len(xs) - 1 - np.arange(len(xs))[None, :]) / (4.0 * KD),
                          np.minimum(np.arange(len(ys))[:, None], len(ys) - 1 - np.arange(len(ys))[:, None]) / (4.0 * KD)), 0, 1)
    else: e = edge
    z = z - 0.0013 - sink * (1 - e)
    P = np.stack([X, Y, z], -1)
    c = skin_col(X, Y, 1.0) if role == SKIN else np.ones(X.shape + (3,))
    if color is not None: c = c * color(X, Y, h)
    m = grid(P, color=c, role=role)
    hv = (h + 0.0013 - sink * (1 - e))
    _, levels, _, _, _ = surface_fn(sex, shape)
    tt = np.linspace(0, 1, 800); aa, _, _, yy = levels(tt)
    amax = np.interp(Y, yy, aa)
    hv = np.where(np.abs(X) > amax * 0.88, -1.0, hv)       # hors de la face (menton étroit) : rien
    return cull(m, hv.reshape(-1), 0.0002)

# ----------------------------------------------------------------------------------------------- nez
NOSES = {'droit': (1, 1, 1), 'fin': (.78, .95, .9), 'retrousse': (.92, .8, 1.1), 'large': (1.4, .95, 1), 'aquilin': (.95, 1.22, 1.25)}

def build_nose(sex, kind):
    w, l, d = NOSES[kind]; fem = sex == 'femme'
    k = 0.92 if fem else 1.0
    xs = np.linspace(-.036, .036, dgrid(29)); ys = np.linspace(-.062, .036, dgrid(40))
    tipy = -0.031 - 0.004 * (l - 1) * 4 + (0.006 if kind == 'retrousse' else 0)
    def hgt(X, Y):
        h = 0.0
        # dos du nez : crête qui s'avance vers le bout
        along = sm(Y, tipy, .02)
        dorsum = (0.006 + 0.012 * (1 - along)) * d * k
        if kind == 'aquilin': dorsum = dorsum + 0.006 * gau(Y, 0, .0, 0.0, 1, 1) * 0 + 0.0045 * gau(X * 0, Y, 0, 0.002, 1, 0.011)
        wid = (0.0085 + 0.0045 * (1 - along)) * w * k
        h += dorsum * np.exp(-(X / wid) ** 2) * sm(Y, -0.062, tipy + 0.01) * (1 - 0.0 * along) * sm(0.036 - Y, 0, .03)
        # bout
        h += 0.0085 * d * k * gau(X, Y, 0, tipy + 0.003, .0085 * w * k, .0075 * l)
        # ailes
        for sg in (-1, 1):
            h += 0.0075 * d * k * gau(X, Y, sg * .0135 * w * k, tipy - 0.0035, .0075 * w * k, .0075)
        # sous du nez : replat
        h -= 0.002 * gau(X, Y, 0, tipy - 0.012, .012, .004)
        return h
    def colr(X, Y, h):
        c = np.ones(X.shape + (3,))
        nost = sum(gau(X, Y, sg * .0085 * w * k, tipy - 0.0085, .0042, .0028) for sg in (-1, 1))
        c *= (1 - 0.55 * nost)[..., None] * np.array([1, .72, .72])[None, None, :] ** nost[..., None]
        tip = gau(X, Y, 0, tipy + .003, .01, .008)
        c *= np.array([1, .95, .95])[None, None, :] ** tip[..., None]
        return c
    return patch(sex, 'ovale', xs, ys, hgt, color=colr, sink=0.006)

# ----------------------------------------------------------------------------------------------- lèvres
def build_lips(sex):
    fem = sex == 'femme'; up = 1.0 if not fem else 1.2; lo = 1.0 if not fem else 1.25
    xs = np.linspace(-.032, .032, dgrid(37)); ys = np.linspace(-.088, -.050, dgrid(26))
    cy = -0.0665
    def hgt(X, Y):
        wup = 0.0235 * (1 + (0.1 if fem else 0)); wlo = 0.020 * (1 + (0.08 if fem else 0))
        cup = np.maximum(0, 1 - (X / wup) ** 2) ** 0.7
        bow = 1 + 0.35 * np.exp(-(X / 0.007) ** 2) - 0.25 * np.exp(-(X / 0.0012) ** 2)    # arc de Cupidon
        hu = 0.0058 * up * cup * np.exp(-((Y - (cy + 0.0065)) / (0.0044 * bow)) ** 2)
        clo = np.maximum(0, 1 - (X / wlo) ** 2) ** 0.7
        hl = 0.0072 * lo * clo * np.exp(-((Y - (cy - 0.0078)) / 0.0058) ** 2)
        gap = -0.0035 * np.exp(-((Y - cy) / 0.0013) ** 2) * np.maximum(0, 1 - (X / 0.0275) ** 2) ** 0.4
        return hu + hl + gap
    def colr(X, Y, h):
        inside = sm(h, 0.0004, 0.0028)
        near = np.exp(-((Y - cy) / 0.0012) ** 2) * np.maximum(0, 1 - (X / 0.0275) ** 2) ** 0.4
        c = np.ones(X.shape + (3,))
        lipc = np.array([.92, .62, .62])
        c = c * (1 - inside[..., None]) + lipc[None, None, :] * inside[..., None]
        c *= (1 - 0.6 * near)[..., None]
        return c
    return patch(sex, 'ovale', xs, ys, hgt, color=colr, sink=0.005)

# ----------------------------------------------------------------------------------------------- sourcils (rôle 0.8 = couleur de cheveux)
def build_brow(sex, style=0):
    """Sourcil gauche (x > 0) ; le droit = miroir. Ruban de poils posé sur l'arcade, couleur des cheveux (rôle 0.6)."""
    fem = sex == 'femme'
    nx, nv_ = dgrid(36), dgrid(7)
    xs = np.linspace(.009, .056, nx)
    u = np.clip((xs - .009) / .047, 0, 1)
    cy = .0345 + (0.0105 if fem else 0.0055) * np.sin(u * np.pi * 0.9) - (0.004 if fem else 0.0) * u ** 2
    th = (0.0033 if fem else 0.0050) * (0.55 + 0.45 * np.sin(np.clip(u * 1.05 + 0.1, 0, 1) * np.pi)) * (1 - 0.35 * u ** 3)
    hb = (0.0026 if fem else 0.0034) * (1 - 0.7 * u ** 3)
    P = np.zeros((nv_, nx, 3)); C = np.ones((nv_, nx, 3))
    for k, v in enumerate(np.linspace(-1, 1, nv_)):
        y = cy + v * th
        z = face_z(sex, 'ovale', xs, y) + hb * np.maximum(0, 1 - v * v) ** 0.6 * sm(u * 0 + 1, 0, 1) - 0.0009 * (abs(v) > 0.99)
        P[k, :, 0] = xs; P[k, :, 1] = y; P[k, :, 2] = z
        C[k] = (0.78 + 0.22 * np.sin(xs * 900 + v * 3.0))[:, None] * (0.7 + 0.3 * (1 - abs(v)))
    m = grid(P, color=C.reshape(-1, 3), role=SKIN)
    return m

# ----------------------------------------------------------------------------------------------- yeux (œil gauche, x > 0 ; le droit = miroir)
EYES = {'normaux': (1, 1), 'amande': (1.12, .8), 'ronds': (1.05, 1.12), 'etroits': (1.12, .62), 'grands': (1.2, 1.18)}
EYE_R = 0.0150

def build_eye(sex, style):
    sw, sh = EYES[style]; fem = sex == 'femme'
    R = EYE_R * (1.04 if fem else 1.0)
    # globe : anneaux resserrés autour de l'iris
    th = np.array([0, .07, .14, .20, .26, .34, .42, .50, .55, .62, .78, 1.0, 1.3, 1.65, 2.0, 2.4, 2.8, np.pi])
    th = np.interp(np.linspace(0, len(th) - 1, dgrid(len(th))), np.arange(len(th)), th)   # finesse (KV_DETAIL)
    nu = dn(20); ph = np.linspace(0, 2 * np.pi, nu, endpoint=False)
    TH, PH = np.meshgrid(th, ph, indexing='ij')
    dirs = np.stack([np.sin(TH) * np.cos(PH), np.sin(TH) * np.sin(PH), np.cos(TH)], -1)   # axe du regard = +Z
    rad = R * (1 + 0.1 * sm(0.62 - TH, 0, 0.6))            # cornée légèrement bombée
    P = dirs * rad[..., None]
    pup, ir = 0.20, 0.52
    col = np.ones(TH.shape + (3,)); role = np.full(TH.shape, FIX)
    scl = np.array([.93, .9, .88]) * (0.8 + 0.2 * sm(TH, 0.55, 1.2))[..., None]     # blanc de l'œil légèrement ombré vers les bords
    col[:] = scl
    inir = TH <= ir + 0.01
    ring = sm(TH, ir - 0.1, ir)                                                  # anneau limbique plus sombre
    shade = (1 - 0.55 * ring) * (0.75 + 0.25 * sm(TH, pup, 0.4))               # iris : plus clair près de la pupille
    rays = 0.88 + 0.12 * np.sin(PH * 22)
    col = np.where(inir[..., None], (np.array([1.0, 1.0, 1.0]) * (shade * rays)[..., None]), col)
    role = np.where(inir, ACC, FIX)
    pupil = TH <= pup
    col = np.where(pupil[..., None], 0.02, col); role = np.where(pupil, FIX, role)
    eye = grid(P, wrap=True, flip=True, color=col.reshape(-1, 3), role=FIX)
    eye.C[:, 3] = role.reshape(-1)
    # le grid est (i = anneaux, j = tour) ; orientation : normales vers l'extérieur
    eye.N = normals(eye, weld=True)
    # paupières : calottes un peu plus grandes que le globe, bord = ligne de cils sombre
    aw = 0.98 * sw; oh = 0.56 * sh * (1.08 if fem else 1.0); ol = 0.40 * sh        # ouverture (rad)
    nuz = dn(26); az = np.linspace(-aw, aw, nuz)
    def lid(sign, h0):
        rows = []
        nr = dn(8)
        for r in range(nr):
            u = r / (nr - 1)
            row = []
            for a_ in az:
                edge = sign * h0 * np.sqrt(max(0.0, 1 - (a_ / aw) ** 2))
                if sign > 0: el = edge + (1.35 - edge) * u ** 0.9          # jusqu'au haut de l'orbite
                else: el = edge - (0.95 + edge) * u ** 0.9
                rr = R * (1.13 + 0.05 * u ** 2) * (1 + 0.02 * (1 - u) * 0)
                row.append([rr * np.cos(el) * np.sin(a_), rr * np.sin(el), rr * np.cos(el) * np.cos(a_)])
            rows.append(row)
        P = np.array(rows)
        c = np.ones(P.shape[:2] + (3,)); c[0] = 0.07                              # ligne de cils
        c[1] = 0.55; c[2] = np.array([0.9, 0.82, 0.82])
        rl = np.full(P.shape[:2], SKIN); rl[0] = FIX; rl[1] = FIX if sign > 0 else SKIN
        m = grid(P, flip=(sign < 0), color=c.reshape(-1, 3), role=SKIN); m.C[:, 3] = rl.reshape(-1)
        return m
    up = lid(+1, oh); lo = lid(-1, ol)
    # caroncule (coin interne rosé) : petite sphère aplatie côté nez (x < 0 dans le repère de l'œil gauche)
    th2 = np.linspace(0, np.pi, dn(6)); ph2 = np.linspace(0, 2 * np.pi, dn(8), endpoint=False)
    T2, P2 = np.meshgrid(th2, ph2, indexing='ij')
    S = np.stack([np.sin(T2) * np.cos(P2) * .0022, np.sin(T2) * np.sin(P2) * .0016, np.cos(T2) * .0016], -1) + np.array([-R * 0.80 * sw * 0.9, -R * .05, R * 0.58])
    car = grid(S, wrap=True, color=np.tile([.88, .52, .52], (S.shape[0] * S.shape[1], 1)), role=SKIN)
    m = concat([eye, up, lo, car]); m.N = np.vstack([eye.N, up.N, lo.N, car.N])
    return m

# ----------------------------------------------------------------------------------------------- oreilles (gauche, x > 0)
def build_ear(kind):
    """kind : 'humaine', 'elfe', 'orque'. Origine = attache de l'oreille sur le crâne, x vers l'extérieur."""
    nr, nt = dn(9), dn(40)
    if kind == 'humaine': h, w, tip, tilt, thick = .032, .0185, 0.0, 0.30, 0.0075
    elif kind == 'elfe': h, w, tip, tilt, thick = .034, .0165, 0.75, 0.45, 0.0055
    else: h, w, tip, tilt, thick = .040, .021, 0.55, 0.60, 0.0085
    th = np.linspace(0, 2 * np.pi, nt, endpoint=False); rr = np.linspace(0, 1, nr)
    R, TH = np.meshgrid(rr, th, indexing='ij')
    # contour : ovale + pointe en haut (θ ≈ π/2, un peu vers l'arrière)
    rho = 1 + tip * np.exp(-((TH - 1.75) / 0.34) ** 2) * (2.0 if kind == 'elfe' else 1.0)
    if kind == 'humaine': rho = rho * (1 + 0.08 * np.cos(TH - 1.4)) * (1 - 0.1 * np.exp(-((TH - 3.3) / 0.5) ** 2))
    lobe = np.exp(-((TH + 1.57) / 0.5) ** 2)
    u = np.cos(TH) * rho * R * w * (1 - 0.22 * lobe)       # vers l'arrière (−z) pour u > 0
    v = np.sin(TH) * rho * R * h * (1 - 0.0 * lobe)
    # profil : conque (creux), hélix (bourrelet) au bord, bord extérieur qui retombe sur le crâne
    helix = np.exp(-((R - 0.86) / 0.12) ** 2); anti = np.exp(-((R - 0.55) / 0.12) ** 2) * 0.35
    out = thick * (0.45 + 0.9 * helix + 0.5 * anti - 0.35 * np.exp(-(R / 0.35) ** 2)) * (1 - sm(R, 0.93, 1.0) * 0.9)
    x = out; y = v; z = -u
    P = np.stack([x, y, z], -1)
    ear_front = grid(P, wrap=True, flip=False)
    # dos : même contour, plaqué contre le crâne (x ≈ 0.0 → 0.0025)
    back = P.copy(); back[..., 0] = 0.0015 + 0.0022 * (1 - R) ;
    ear_back = grid(back, wrap=True, flip=True)
    m = concat([ear_front, ear_back]); m.N = np.vstack([ear_front.N, ear_back.N])
    # orientation : bascule vers l'arrière et vers l'extérieur
    c, s_ = np.cos(-tilt * 0.5), np.sin(-tilt * 0.5)
    Rz = np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]]); m.V = m.V @ Rz.T; m.N = m.N @ Rz.T
    c, s_ = np.cos(-0.28), np.sin(-0.28)
    Ry = np.array([[c, 0, s_], [0, 1, 0], [-s_, 0, c]]); m.V = m.V @ Ry.T; m.N = m.N @ Ry.T
    return m
