"""Squelettes ennemis (épéiste + bouclier, archer, arbalétrier, mage) : anatomie complète (crâne avec orbites, dents et mâchoire,
vertèbres, côtes, sternum, clavicules, omoplates, os des bras/mains/doigts, bassin, fémurs, tibias, péronés, pieds) bâtie sur les
27 os du Veilleur (mêmes animations), + casque, armure, armes cuits dans le maillage. build(nom) -> (parts, SK, meta)."""
import copy, re
import numpy as np
from glbkit import *
import hero_geo as G
import weapons_geo as W
import sword_geo as SG
from foe_geo import bake, SWORD_Q, HAND_R_W, HAND_L_W, sin_, cos_, robe as _robe_unused

B = G.B
S = np.array
PI = np.pi
RNG = np.random.RandomState(11)


def P_(*a): return np.array(a, float)
def unit(v): return v / (np.linalg.norm(v) + 1e-12)


def line(a, b, n=8): return smoothpath([a, b], n)


def shaft(a, b, r, ends=(1.5, 1.5), bow=None, n=10, segs=10, ratio=1.0, ref=None, tile=0.08, cap=1):
    a = np.asarray(a, float); b = np.asarray(b, float)
    pts = [a, b] if bow is None else [a, (a + b) / 2 + np.asarray(bow, float), b]
    path = smoothpath(pts, n)
    rr = r * prof([(0, ends[0]), (.1, 1.2 + .1 * (ends[0] - 1.5)), (.28, .9), (.5, .82), (.72, .9), (.9, 1.2 + .1 * (ends[1] - 1.5)), (1, ends[1])], n)
    if ref is None:
        d = unit(b - a); ref = np.cross(d, (0, 0, 1)) if abs(d[2]) < .9 else (1, 0, 0)
    return Loft(path, rr, rr * ratio, p=2.3, segs=segs, cap0=cap, cap1=cap, tile=tile, ref=ref).mesh()


def blob(c, r, sq=(1, 1, 1), segs=8, n=9):
    t = np.linspace(0, 1, n)
    rr = r * np.sqrt(np.clip(1 - (2 * t - 1) ** 2, 0, 1)) + 1e-4
    path = np.stack([np.full(n, c[0]), c[1] + (t - .5) * 2 * r * sq[1], np.full(n, c[2])], 1)
    return Loft(path, rr * sq[2], rr * sq[0], p=2.0, segs=segs, tile=0.05, ref=(0, 0, 1)).mesh()


def tube(path, r0, r1=None, segs=8, cap=1, tile=0.08, ref=(1, 0, 0), p=2.2):
    n = len(path); r1 = r0 if r1 is None else r1
    rr = prof([(0, r0), (1, r1)], n)
    return Loft(path, rr, rr, p=p, segs=segs, cap0=cap, cap1=cap, tile=tile, ref=ref).mesh()


def revolve(profile, segs=32, tile=0.4):
    """Surface de révolution autour de Z : profile = [(r, z), ...]."""
    pr = np.asarray(profile, float); nrow = len(pr)
    a = np.linspace(0, 2 * PI, segs + 1)
    V = np.stack([np.outer(pr[:, 0], np.cos(a)), np.outer(pr[:, 0], np.sin(a)), np.tile(pr[:, 1][:, None], (1, segs + 1))], -1).reshape(-1, 3)
    idx = np.arange(nrow * (segs + 1)).reshape(nrow, segs + 1)
    A, Bq, C, D = idx[:-1, :-1].ravel(), idx[:-1, 1:].ravel(), idx[1:, :-1].ravel(), idx[1:, 1:].ravel()
    F = np.concatenate([np.stack([A, C, Bq], 1), np.stack([Bq, C, D], 1)])
    arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pr, axis=0), axis=1))])
    UV = np.stack(np.meshgrid(a * pr[:, 0].max() / tile, arc / tile), -1).reshape(-1, 2)
    m = Mesh(V, F, UV)
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]); fc = V[F].mean(1)
    cen = np.array([0, 0, pr[:, 1].mean()])
    if np.sum(np.einsum('ij,ij->i', fn, fc - cen)) < 0: m.F = m.F[:, ::-1].copy()
    return m


def open_loft(lf, ang0, ang1):
    """Garde seulement les colonnes d'angle [ang0, ang1] (degrés) d'un loft : coque ouverte (capuche, cape)."""
    m = lf.mesh(); R, C = lf.rows, lf.cols; segs = C - 1
    c0 = int(np.ceil(segs * ang0 / 360)); c1 = int(np.floor(segs * ang1 / 360))
    nq = (R - 1) * (C - 1); col = np.arange(nq) % (C - 1)
    keep = (col >= c0) & (col < c1)
    m.F = np.concatenate([m.F[:nq][keep], m.F[nq:][keep]])
    return m


class Acc:
    def __init__(self): self.parts = []
    def add(self, name, mesh, mat, bone):
        skin_rigid(mesh, B[bone]); self.parts.append((name, mesh, mat))


def sp_bone(y): return 'Hips' if y < 1.07 else 'Spine' if y < 1.22 else 'Chest' if y < 1.50 else 'Neck'


# ---------------------------------------------------------------------------------------------------------- crâne
def dent(m, cx, cy, rx, ry, depth, zmin=0.0):
    """Creuse le maillage (enfoncement vers -Z) autour de (cx, cy) : orbites, cavité nasale."""
    d2 = ((m.V[:, 0] - cx) / rx) ** 2 + ((m.V[:, 1] - cy) / ry) ** 2
    w = np.clip(1 - d2, 0, 1) ** 1.2
    w = np.where(m.V[:, 2] > zmin, w, 0)
    m.V[:, 2] -= depth * w
    return m


def skull(A, jaw_open=0.007, eye_mat='eye'):
    # calotte crânienne (maillage dense pour creuser les orbites)
    n = 26; y0, y1 = 1.625, 1.82
    path = np.stack([np.zeros(n), np.linspace(y0, y1, n), np.full(n, -0.016)], 1)
    rf = prof([(0, .066), (.10, .098), (.40, .106), (.75, .097), (.92, .075), (1, .05)], n)
    rs = prof([(0, .05), (.10, .072), (.40, .081), (.75, .074), (.92, .058), (1, .04)], n)
    cr = Loft(path, rf, rs, p=2.5, segs=48, cap0=1, cap1=1, tile=.2, ref=(0, 0, 1)).mesh()
    # face (maxillaire) : s'arrête sur l'arcade dentaire
    n2 = 16; yy = np.linspace(1.601, 1.668, n2)
    fp = np.stack([np.zeros(n2), yy, np.full(n2, 0.046)], 1)
    fr = prof([(0, .029), (.5, .037), (1, .036)], n2); fs = prof([(0, .033), (.35, .045), (1, .042)], n2)
    mx = Loft(fp, fr, fs, p=2.3, segs=32, cap0=1, cap1=1, tile=.1, ref=(0, 0, 1)).mesh()
    for s_ in (1, -1):
        for mm in (cr, mx):
            dent(mm, s_ * .034, 1.683, .0225, .0255, .038, zmin=.0)
    for mm in (cr, mx): dent(mm, 0, 1.636, .0125, .0215, .04, zmin=.0)
    A.add('crane', cr, 'bone_aged', 'Head')
    A.add('maxillaire', mx, 'bone_aged', 'Head')
    # arcades sourcilières
    br = smoothpath([P_(-.069, 1.708, .052), P_(-.035, 1.716, .088), P_(0, 1.712, .097), P_(.035, 1.716, .088), P_(.069, 1.708, .052)], 16)
    A.add('arcade', Loft(br, .0085, .0075, p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 1, 0)).mesh(), 'bone_aged', 'Head')
    # orbites : fond sombre au fond de la cavité creusée + lueur
    for s in (1, -1):
        cx, cy = s * .034, 1.683
        d = revolve([(0, .0585), (.0205, .0575), (.0225, .045), (.0225, .03)], segs=16); d.V[:, 1] *= 1.12; d.V[:, 0] += cx; d.V[:, 1] += cy * 1 - 0.0 * cy
        d.V[:, 1] -= 1.12 * 0  # centre
        A.add(f'orbite_fond{s}', d, 'dark', 'Head')
        A.add(f'oeil{s}', blob([cx, cy - .003, .056], .0052, sq=(1, 1, .7), segs=6, n=6), eye_mat, 'Head')
    nz = revolve([(0, .052), (.012, .051), (.0125, .04), (.0125, .03)], segs=10); nz.V[:, 1] *= 1.8; nz.V[:, 1] += 1.636
    A.add('nez_cavite', nz, 'dark', 'Head')
    # pommettes + arcade zygomatique + tempes
    for s in (1, -1):
        zy = smoothpath([P_(s * .047, 1.652, .072), P_(s * .074, 1.654, .052), P_(s * .082, 1.66, .01), P_(s * .074, 1.668, -.03)], 12)
        A.add(f'pommette{s}', Loft(zy, prof([(0, .0085), (.3, .0072), (1, .0045)], 12), prof([(0, .0085), (.3, .0072), (1, .0045)], 12), p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 1, 0)).mesh(), 'bone_aged', 'Head')
        A.add(f'mastoide{s}', blob([s * .06, 1.612, -.04], .0125, sq=(1, 1.2, 1), segs=8), 'bone_aged', 'Head')
        # trou auditif sombre
        A.add(f'oreille_trou{s}', blob([s * .0805, 1.652, -.012], .0085, sq=(.5, 1, 1), segs=7), 'dark', 'Head')
    # dents supérieures + inférieures
    for k, th in enumerate(np.linspace(-72, 72, 12)):
        t = np.deg2rad(th); x = .036 * np.sin(t); z = .016 + .056 * np.cos(t)
        L = .019 if abs(th) < 20 else .015 if abs(th) < 50 else .017
        w = .0036 if abs(th) < 20 else .0042
        A.add(f'dent_h{k}', Loft(np.array([[x, 1.606, z], [x, 1.606 - L, z]]), w * .75, w, p=2.2, segs=6, cap1=1, tile=.03, ref=(0, 0, 1)).mesh(), 'bone_light', 'Head')
    # mandibule (ouverte), liée au crâne (pas d'os de mâchoire dans le squelette)
    jo = jaw_open
    for s in (1, -1):
        ra = smoothpath([P_(s * .064, 1.636, -.012), P_(s * .066, 1.598 - jo, -.016), P_(s * .058, 1.560 - jo, -.008)], 8)
        A.add(f'ramus{s}', Loft(ra, .0145, .0042, p=2.3, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 0, 1)).mesh(), 'bone_aged', 'Head')
        A.add(f'condyle{s}', blob([s * .064, 1.638, -.012], .0075, segs=6), 'bone_aged', 'Head')
        A.add(f'coronoide{s}', Loft(np.array([[s * .062, 1.606 - jo * .3, .006], [s * .060, 1.625 - jo * .3, .004]]), .006, .0025, p=2.0, segs=6, cap1=1, tile=.05, ref=(0, 0, 1)).mesh(), 'bone_aged', 'Head')
        bd = smoothpath([P_(s * .058, 1.560 - jo, -.008), P_(s * .052, 1.552 - jo, .022), P_(s * .036, 1.549 - jo, .052), P_(s * .016, 1.552 - jo, .075), P_(0, 1.553 - jo, .081)], 12)
        A.add(f'mandibule{s}', Loft(bd, prof([(0, .0105), (.5, .0095), (1, .0115)], 12), prof([(0, .0058), (.7, .0075), (1, .0085)], 12), p=2.3, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 1, 0)).mesh(), 'bone_aged', 'Head')
    for k, th in enumerate(np.linspace(-70, 70, 12)):
        t = np.deg2rad(th); x = .031 * np.sin(t); z = .012 + .052 * np.cos(t)
        L = .015 if abs(th) < 20 else .013
        w = .0034 if abs(th) < 20 else .004
        A.add(f'dent_b{k}', Loft(np.array([[x, 1.560 - jo, z], [x, 1.560 - jo + L, z]]), w * .75, w, p=2.2, segs=6, cap1=1, tile=.03, ref=(0, 0, 1)).mesh(), 'bone_light', 'Head')


# ---------------------------------------------------------------------------------------------------------- tronc
def spine_z(y):
    return float(np.interp(y, [.95, 1.02, 1.15, 1.30, 1.42, 1.50, 1.57], [-.020, -.032, -.052, -.066, -.052, -.028, -.016]))


def torso(A, ribs=True):
    # vertèbres : 5 lombaires, 12 thoraciques, 7 cervicales
    ys = list(np.linspace(1.03, 1.14, 5)) + list(np.linspace(1.17, 1.43, 12)) + list(np.linspace(1.455, 1.555, 7))
    for k, y in enumerate(ys):
        z = spine_z(y); big = 1.18 if k < 5 else 1.0 if k < 17 else .78
        hh = .0125 if k < 5 else .0108 if k < 17 else .0085
        bd = Loft(np.array([[0, y - hh, z], [0, y + hh, z]]), prof([(0, .0125), (.5, .011), (1, .0125)], 2) * big, prof([(0, .0145), (.5, .0125), (1, .0145)], 2) * big, p=2.4, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 0, 1)) if False else \
            Loft(smoothpath([P_(0, y - hh, z), P_(0, y + hh, z)], 5), prof([(0, .0125), (.5, .0105), (1, .0125)], 5) * big, prof([(0, .0150), (.5, .0125), (1, .0150)], 5) * big, p=2.4, segs=6, cap0=1, cap1=1, tile=.05, ref=(0, 0, 1))
        b = sp_bone(y)
        A.add(f'vertebre{k}', bd.mesh(), 'bone_aged', b)
        sc = .05 if k < 17 else .04 if k < 22 else .028
        A.add(f'epineuse{k}', Loft(smoothpath([P_(0, y + .002, z - .012), P_(0, y - .004 - .006 * (k < 17), z - sc)], 4), prof([(0, .005), (1, .0022)], 4), prof([(0, .0042), (1, .0016)], 4), p=2.2, segs=5, cap1=1, tile=.04, ref=(1, 0, 0)).mesh(), 'bone_aged', b)
        for s in (1, -1):
            if k < 17:
                A.add(f'transv{k}_{s}', Loft(smoothpath([P_(s * .012, y, z - .005), P_(s * (.034 if k < 17 else .028), y + .002, z - .016)], 3), .0045, .0045, p=2.0, segs=6, cap1=1, tile=.04, ref=(0, 1, 0)).mesh(), 'bone_aged', b)
    # disques intervertébraux sombres
    for k in range(len(ys) - 1):
        y = (ys[k] + ys[k + 1]) / 2; z = spine_z(y)
        A.add(f'disque{k}', blob([0, y, z], .0105, sq=(1.2, .3, 1.05), segs=6, n=4), 'bone_dark', sp_bone(y))
    # sacrum + coccyx
    sac = smoothpath([P_(0, 1.012, -.034), P_(0, .965, -.05), P_(0, .915, -.052)], 8)
    A.add('sacrum', Loft(sac, prof([(0, .016), (1, .008)], 8), prof([(0, .052), (1, .016)], 8), p=2.3, segs=12, cap1=1, tile=.1, ref=(0, 0, 1)).mesh(), 'bone_aged', 'Hips')
    A.add('coccyx', tube(smoothpath([P_(0, .915, -.052), P_(0, .88, -.046), P_(0, .86, -.034)], 5), .0075, .0025, segs=6, ref=(1, 0, 0)), 'bone_aged', 'Hips')
    # côtes (10 paires + 2 flottantes courtes) ; cartilage costal plus sombre
    a_ = [.084, .102, .118, .129, .135, .136, .132, .124, .112, .095, .08, .066]
    for k in range(12):
        y = 1.395 - k * .0225; zs = spine_z(y); b = .074 + (.006 if k < 6 else 0)
        zc = zs + b; ph = np.linspace(0.0, 150 if k < 10 else 105, 13); ph = np.deg2rad(ph)
        for s in (1, -1):
            drop = np.where(True, 1, 1) * (.012 + .032 * (k / 11)) * (ph / np.deg2rad(150)) ** 1.4
            pts = np.stack([s * (.016 + (a_[k] - .016) * np.sin(ph)) , y - drop + .004 * np.sin(ph * .5), zc - b * np.cos(ph)], 1)
            if k >= 10: pts[:, 2] = zc - b * np.cos(ph) * .9
            rb = prof([(0, .0072), (.15, .0085), (.8, .0075), (1, .0055)], len(pts))
            cut = 9 if k < 10 else len(pts)
            A.add(f'cote{k}_{s}', Loft(pts[:cut], rb[:cut], prof([(0, .0036), (1, .003)], cut), p=2.2, segs=6, cap0=1, cap1=1, tile=.05, ref=(0, 1, 0)).mesh(), 'bone_aged', 'Chest')
            if k < 10:
                A.add(f'cartilage{k}_{s}', Loft(pts[8:], rb[8:] * .85, prof([(0, .003), (1, .0028)], len(pts) - 8), p=2.2, segs=6, cap0=1, cap1=1, tile=.05, ref=(0, 1, 0)).mesh(), 'bone_dark', 'Chest')
    # sternum : manubrium, corps, xiphoïde
    zf = spine_z(1.30) + .152
    st = smoothpath([P_(0, 1.415, zf - .005), P_(0, 1.34, zf + .004), P_(0, 1.25, zf + .003)], 10)
    A.add('sternum', Loft(st, prof([(0, .0065), (.1, .006), (.5, .0045), (1, .0035)], 10), prof([(0, .026), (.12, .02), (.5, .017), (1, .008)], 10), p=2.4, segs=12, cap0=1, cap1=1, tile=.1, ref=(0, 0, 1)).mesh(), 'bone_aged', 'Chest')
    A.add('xiphoide', tube(smoothpath([P_(0, 1.255, zf + .002), P_(0, 1.225, zf - .004)], 4), .0045, .001, segs=5, ref=(1, 0, 0)), 'bone_aged', 'Chest')
    # clavicules + omoplates
    for s in (1, -1):
        sd = '_L' if s > 0 else '_R'
        cl = smoothpath([P_(s * .016, 1.412, zf - .006), P_(s * .07, 1.428, .062), P_(s * .13, 1.438, .045), P_(s * .188, 1.432, .008)], 14)
        A.add(f'clavicule{s}', Loft(cl, prof([(0, .0092), (.5, .0072), (1, .0085)], 14), prof([(0, .0092), (.5, .0072), (1, .0085)], 14), p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 1, 0)).mesh(), 'bone_aged', 'Shoulder' + sd)
        n3 = 10; c = np.stack([np.linspace(s * .05, s * .092, n3), np.linspace(1.405, 1.285, n3), np.linspace(-.09, -.084, n3)], 1)
        rsb = prof([(0, .056), (.12, .062), (.55, .04), (1, .007)], n3)
        A.add(f'omoplate{s}', Loft(c + np.stack([s * rsb * .55, np.zeros(n3), np.zeros(n3)], 1), .0026, rsb, p=2.6, segs=12, cap0=1, cap1=1, tile=.1, ref=(0, 0, 1), os_=0).mesh(), 'bone_aged', 'Shoulder' + sd)
        ep = smoothpath([P_(s * .06, 1.375, -.096), P_(s * .13, 1.425, -.078), P_(s * .192, 1.438, -.03)], 8)
        A.add(f'acromion{s}', Loft(ep, prof([(0, .005), (.6, .0065), (1, .008)], 8), prof([(0, .006), (1, .01)], 8), p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 1, 0)).mesh(), 'bone_aged', 'Shoulder' + sd)
        A.add(f'glenoide{s}', blob([s * .205, 1.415, -.004], .016, sq=(.7, 1.1, 1), segs=8), 'bone_aged', 'Shoulder' + sd)


# ---------------------------------------------------------------------------------------------------------- bassin
def pelvis(A):
    for s in (1, -1):
        cr = smoothpath([P_(s * .034, 1.004, -.056), P_(s * .12, 1.035, -.058), P_(s * .172, 1.032, -.01), P_(s * .165, 1.0, .05), P_(s * .13, .975, .08)], 16)
        n = 16; hh = prof([(0, .018), (.25, .052), (.55, .056), (.85, .036), (1, .014)], n)
        A.add(f'ilion{s}', Loft(cr + np.array([0, -.0, 0]), hh, prof([(0, .005), (.5, .0042), (1, .0058)], n), p=2.2, segs=10, cap0=1, cap1=1, tile=.1, ref=(0, 1, 0), of=-hh * .5).mesh(), 'bone_aged', 'Hips')
        isc = smoothpath([P_(s * .115, .955, .006), P_(s * .1, .915, -.04), P_(s * .082, .885, -.052)], 8)
        A.add(f'ischion{s}', Loft(isc, prof([(0, .0145), (1, .012)], 8), prof([(0, .011), (1, .014)], 8), p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 0, 1)).mesh(), 'bone_aged', 'Hips')
        pb = smoothpath([P_(s * .12, .948, .052), P_(s * .074, .918, .072), P_(s * .014, .908, .082)], 8)
        A.add(f'pubis{s}', Loft(pb, .0085, .0075, p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 1, 0)).mesh(), 'bone_aged', 'Hips')
        ob = smoothpath([P_(s * .082, .885, -.052), P_(s * .062, .88, -.02), P_(s * .058, .89, .03), P_(s * .074, .918, .072)], 10)
        A.add(f'branche{s}', Loft(ob, .0072, .0066, p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 1, 0)).mesh(), 'bone_aged', 'Hips')
        A.add(f'cotyle{s}', blob([s * .108, .962, .002], .0225, sq=(.55, 1, 1), segs=10), 'bone_aged', 'Hips')


# ---------------------------------------------------------------------------------------------------------- membres
def arm(A, s):
    sd = '_L' if s > 0 else '_R'
    sh = P_(s * .215, 1.42, 0.0); el = P_(s * .262, 1.134, 0.0); wr = P_(s * .328, .872, .02)
    # humérus
    A.add(f'humerus{s}', shaft(sh + P_(0, -.005, 0), el + P_(0, .012, 0), .0135, ends=(1.5, 1.9), bow=(0, 0, .006), segs=12), 'bone_aged', 'UpperArm' + sd)
    A.add(f'humerus_tete{s}', blob(sh + P_(-s * .006, .004, 0), .0235, sq=(1, 1, 1), segs=10), 'bone_aged', 'UpperArm' + sd)
    A.add(f'tubercule{s}', blob(sh + P_(s * .018, -.008, .006), .011, segs=7), 'bone_aged', 'UpperArm' + sd)
    for e in (1, -1):
        A.add(f'epicondyle{s}_{e}', blob(el + P_(e * .016 * 1.0, .018, 0), .0105, segs=7), 'bone_aged', 'UpperArm' + sd)
    # cubitus (arrière) + radius (avant)
    d = unit(wr - el)
    ul0 = el + P_(0, 0, -.012); ul1 = wr + P_(s * .004, .0, -.012)
    A.add(f'cubitus{s}', shaft(ul0 + P_(0, .02, 0), ul1, .0085, ends=(1.75, 1.2), segs=9), 'bone_aged', 'LowerArm' + sd)
    A.add(f'olecrane{s}', blob(el + P_(0, .028, -.017), .0145, sq=(1, 1.1, 1), segs=8), 'bone_aged', 'LowerArm' + sd)
    ra0 = el + P_(-s * .008, -.004, .012); ra1 = wr + P_(-s * .006, .0, .012)
    A.add(f'radius{s}', shaft(ra0, ra1, .0078, ends=(1.3, 1.9), bow=(0, 0, .008), segs=9), 'bone_aged', 'LowerArm' + sd)
    # carpe
    for i, (dx, dz) in enumerate(((-.016, .018), (-.004, .02), (.01, .018), (.014, .004), (-.006, .0), (-.016, .004))):
        A.add(f'carpe{s}_{i}', blob(wr + P_(s * dx, -.012 + .006 * (i % 2), dz - .008), .0078, sq=(1, .8, 1), segs=5, n=5), 'bone_aged', 'Hand' + sd)
    # métacarpiens + phalanges (main pendante, paume contre la cuisse)
    kn_z = [.024, .008, -.008, -.024]; lens = [(.082, .042, .027, .021), (.088, .047, .03, .022), (.084, .044, .028, .021), (.074, .036, .023, .019)]
    for f in range(4):
        base = wr + P_(s * .002, -.018, kn_z[f] - .008)
        pos = base.copy(); r = .0066 - .0005 * f
        for j, L in enumerate(lens[f]):
            curl = np.deg2rad((0, 14, 32, 44)[j] + 4 * f)
            dirv = unit(P_(-s * np.sin(curl), -np.cos(curl), .0))
            nxt = pos + dirv * L
            A.add(f'doigt{s}_{f}_{j}', shaft(pos, nxt, r * (1 - .13 * j), ends=(1.5, 1.4), n=3, segs=5, ratio=.9), 'bone_aged', 'Hand' + sd)
            if j < 3: A.add(f'phal_art{s}_{f}_{j}', blob(nxt, r * 1.15 * (1 - .13 * j), segs=4, n=4), 'bone_aged', 'Hand' + sd)
            pos = nxt
    # pouce
    tp = wr + P_(-s * .016, -.026, .028)
    for j, L in enumerate((.04, .033, .026)):
        ang = np.deg2rad((-35, -10, 15)[j])
        dirv = unit(P_(-s * .25 * (1 - j * .3), -np.cos(ang) * 1.0, .35 - .1 * j))
        nxt = tp + dirv * L
        A.add(f'pouce{s}_{j}', shaft(tp, nxt, .0068 - .0007 * j, ends=(1.4, 1.4), n=4, segs=6, ratio=.9), 'bone_aged', 'Hand' + sd)
        tp = nxt


def leg(A, s):
    sd = '_L' if s > 0 else '_R'
    hip = P_(s * .095, .965, 0.0); kn = P_(s * .1, .52, .012); an = P_(s * .1, .1, -.012)
    # fémur : tête, col, grand trochanter, diaphyse arquée vers l'avant, condyles
    A.add(f'femur_tete{s}', blob(hip + P_(-s * .0, .0, 0), .0285, segs=10), 'bone_aged', 'UpperLeg' + sd)
    nk = smoothpath([hip + P_(0, .004, 0), hip + P_(s * .03, -.012, -.004), hip + P_(s * .052, -.038, -.008)], 6)
    A.add(f'femur_col{s}', tube(nk, .0135, .0155, segs=9, ref=(0, 0, 1)), 'bone_aged', 'UpperLeg' + sd)
    A.add(f'trochanter{s}', blob(hip + P_(s * .056, -.03, -.012), .0215, sq=(.7, 1.3, 1), segs=8), 'bone_aged', 'UpperLeg' + sd)
    A.add(f'femur{s}', shaft(hip + P_(s * .048, -.036, -.006), kn + P_(0, .018, 0), .0178, ends=(1.15, 1.8), bow=(0, 0, .018), n=14, segs=12), 'bone_aged', 'UpperLeg' + sd)
    for e in (1, -1):
        A.add(f'condyle_f{s}_{e}', blob(kn + P_(e * .017, .012, -.004), .0185, sq=(.8, 1, 1.05), segs=8), 'bone_aged', 'UpperLeg' + sd)
    # rotule, tibia, péroné
    A.add(f'rotule{s}', blob(kn + P_(0, .018, .036), .0175, sq=(1, 1.1, .45), segs=8), 'bone_aged', 'LowerLeg' + sd)
    A.add(f'tibia_plateau{s}', blob(kn + P_(0, -.008, 0), .0295, sq=(1, .45, .82), segs=10), 'bone_aged', 'LowerLeg' + sd)
    A.add(f'tibia{s}', shaft(kn + P_(0, -.012, .006), an + P_(s * .002, .036, .0), .0158, ends=(1.5, 1.45), bow=(0, 0, .01), n=14, segs=10, ratio=.9), 'bone_aged', 'LowerLeg' + sd)
    A.add(f'crete_tibiale{s}', tube(smoothpath([kn + P_(0, -.03, .02), an + P_(0, .08, .015)], 6), .0045, .0035, segs=6, ref=(1, 0, 0)), 'bone_aged', 'LowerLeg' + sd)
    A.add(f'malleole_med{s}', blob(an + P_(-s * .0, .022, 0) + P_(-s * .018, .0, 0), .0125, segs=7), 'bone_aged', 'LowerLeg' + sd)
    fb0 = kn + P_(s * .03, -.02, -.012); fb1 = an + P_(s * .034, .028, -.012)
    A.add(f'perone{s}', shaft(fb0, fb1, .0074, ends=(1.5, 1.7), n=12, segs=8), 'bone_aged', 'LowerLeg' + sd)
    A.add(f'malleole_lat{s}', blob(fb1 + P_(s * .002, -.01, 0), .0105, segs=7), 'bone_aged', 'LowerLeg' + sd)
    # pied : astragale, calcanéum, métatarsiens, orteils
    ft = 'Foot' + sd; tt = 'Toe' + sd
    A.add(f'astragale{s}', blob(an + P_(0, .002, .008), .0215, sq=(1, .75, 1.1), segs=8), 'bone_aged', ft)
    A.add(f'calcaneum{s}', Loft(smoothpath([an + P_(0, -.005, -.04), an + P_(0, -.045, .006)], 5), .013, .0175, p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(1, 0, 0)).mesh(), 'bone_aged', ft) if False else \
        A.add(f'calcaneum{s}', blob(an + P_(0, -.03, -.018), .0225, sq=(.8, .9, 1.35), segs=8), 'bone_aged', ft)
    A.add(f'tarse{s}', blob(an + P_(0, -.04, .036), .02, sq=(1.4, .65, 1.4), segs=8), 'bone_aged', ft)
    for k in range(5):
        x = s * (.1 - .028 + k * .014 + (.002 if k == 4 else 0)) if False else s * (.1 - .02 + k * .0125)
        x = (.1 - .027 + .0135 * k) * s if s > 0 else -(.1 - .027 + .0135 * k)
        x = s * (.073 + .0135 * k) if s > 0 else s * (.073 + .0135 * k)
        a0 = P_(x, .058, .02 + .004 * (k == 0)); a1 = P_(x + s * .0, .048, .1 - .006 * k)
        A.add(f'metatarsien{s}_{k}', shaft(a0, a1, .0068 - .0003 * k, ends=(1.4, 1.6), n=5, segs=6), 'bone_aged', ft)
        L = (.036, .028, .026, .023, .02)[k]
        A.add(f'orteil{s}_{k}', shaft(a1, a1 + P_(0, -.006, L), .0058, ends=(1.2, 1.1), n=3, segs=6), 'bone_aged', tt)


def skeleton(A, eye_mat='eye'):
    skull(A, eye_mat=eye_mat); torso(A); pelvis(A)
    for s in (1, -1): arm(A, s); leg(A, s)


# ---------------------------------------------------------------------------------------------------------- équipement
def helm(A, kind):
    n = 12
    if kind == 'kettle':
        top, brim, nasal, cheeks, mat = 1.872, .152, False, False, 'rust'
    elif kind == 'barbute':
        top, brim, nasal, cheeks, mat = 1.87, .15, True, True, 'rust'
    elif kind == 'cap':
        top, brim, nasal, cheeks, mat = 1.855, .125, False, False, 'rust'
    y0 = 1.728
    path = np.stack([np.zeros(n), np.linspace(y0, top, n), np.full(n, -0.014)], 1)
    rf = prof([(0, .121), (.12, .118), (.5, .102), (.82, .068), (1, .012)], n); rs = prof([(0, .111), (.12, .108), (.5, .093), (.82, .062), (1, .012)], n)
    A.add('casque_dome', Loft(path, rf, rs, p=2.5, segs=32, cap1=2, tile=.2, ref=(0, 0, 1)).mesh(), mat, 'Head')
    A.add('casque_bande', Loft(np.array([[0, y0 + .004, -.014], [0, y0 + .02, -.014]]), .128, .118, p=2.5, segs=32, tile=.2, ref=(0, 0, 1)).mesh(), 'rust_dark', 'Head')
    bp = np.stack([np.zeros(4), np.linspace(y0 - .006, y0 + .002, 4), np.full(4, -0.014)], 1)
    A.add('casque_bord', Loft(bp, prof([(0, brim), (1, brim * .96)], 4), prof([(0, brim * .92), (1, brim * .88)], 4), p=2.3, segs=40, cap0=1, cap1=1, tile=.3, ref=(0, 0, 1)).mesh(), mat, 'Head')
    # arête centrale
    cr = smoothpath([P_(0, y0 + .02, .112), P_(0, top - .01, .07), P_(0, top + .004, -.015), P_(0, top - .03, -.1), P_(0, y0 + .03, -.122)], 16)
    A.add('casque_cimier', Loft(cr, .0085, .0042, p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 1, 0)).mesh(), 'rust_dark', 'Head')
    # nuquière
    nq = smoothpath([P_(0, y0 - .004, -.095), P_(0, 1.665, -.108), P_(0, 1.605, -.095)], 8)
    A.add('casque_nuque', Loft(nq, prof([(0, .016), (1, .012)], 8), prof([(0, .098), (.5, .09), (1, .06)], 8), p=2.4, segs=18, cap0=1, cap1=1, tile=.1, ref=(0, 0, 1)).mesh(), mat, 'Head')
    for k in range(6):
        a = np.deg2rad(-100 + k * 40)
        A.add(f'casque_rivet{k}', blob([.11 * np.sin(a) * 1.02, y0 + .012, -.014 + .12 * np.cos(a) * 1.0], .0042, segs=5, n=5), 'rust_dark', 'Head')
    if nasal:
        A.add('casque_nasal', Loft(smoothpath([P_(0, y0 + .004, .124), P_(0, 1.69, .114), P_(0, 1.648, .104)], 8), prof([(0, .0045), (1, .0035)], 8), prof([(0, .0115), (.6, .0095), (1, .006)], 8), p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 0, 1)).mesh(), mat, 'Head')
    if cheeks:
        for s in (1, -1):
            ch = smoothpath([P_(s * .098, y0 - .004, .012), P_(s * .092, 1.668, .02), P_(s * .074, 1.612, .02)], 8)
            A.add(f'casque_joue{s}', Loft(ch, prof([(0, .05), (.6, .052), (1, .036)], 8), prof([(0, .0052), (1, .0042)], 8), p=2.3, segs=12, cap0=1, cap1=1, tile=.1, ref=(0, 0, 1)).mesh(), mat, 'Head')


def hood(A):
    n = 14; y0 = 1.56; y1 = 1.905
    path = np.stack([np.zeros(n), np.linspace(y0, y1, n), np.full(n, -0.03 + .02 * np.linspace(0, 1, n) ** 2)], 1)
    rf = prof([(0, .125), (.3, .15), (.62, .142), (.88, .1), (1, .018)], n); rs = prof([(0, .125), (.3, .135), (.62, .125), (.88, .088), (1, .018)], n)
    lf = Loft(path, rf, rs, p=2.3, segs=40, cap1=2, tile=.3, ref=(0, 0, 1))
    m = open_loft(lf, 62, 298)
    # bord déchiré
    low = m.V[:, 1] < y0 + .03
    m.V[low, 1] -= (np.abs(np.sin(m.V[low, 0] * 70)) * .025)
    A.add('capuche', m, 'rag', 'Head')


def gear_parts(rx, remap):
    """Pièces d'armure du Veilleur (déjà liées aux bons os), re-matérialisées."""
    out = []
    for n, m, mat in G.parts:
        if re.match(rx, n): out.append((n, m.copy(), remap.get(mat, mat)))
    return out


def rag_robe(A, bottom=0.28):
    n = 14
    sp = smoothpath([(0, 1.03, 0), (0, .86, 0), (0, .55, 0), (0, bottom, 0)], n)
    m = Loft(sp, prof([(0, .13), (.3, .16), (1, .24)], n), prof([(0, .17), (.3, .2), (1, .3)], n), p=2.5, segs=40, cap1=0, tile=.4).mesh()
    low = m.V[:, 1] < .62
    ang = np.arctan2(m.V[:, 0], m.V[:, 2])
    m.V[low, 1] -= (np.clip((.62 - m.V[low, 1]) / .3, 0, 1)) * (.06 * np.abs(np.sin(ang[low] * 5.5 + 1)) + .04 * np.abs(np.sin(ang[low] * 11.3)))
    # fente avant pour laisser voir le bassin et les cuisses : pas de découpe, la robe reste fermée
    m = G.skin_skirt(m)
    A.parts.append(('robe', m, 'rag'))


def strap(A, a, b, w, mat='leather_old', bone='Chest', th=.005):
    A.add('sangle', Loft(smoothpath([a, b], 8), th, w, p=2.4, segs=10, cap0=1, cap1=1, tile=.1, ref=(0, 0, 1)).mesh(), mat, bone)


def round_shield():
    parts = []
    body = revolve([(0, -.014), (.30, -.014), (.338, -.008), (.35, .004), (.34, .015), (.30, .018), (.13, .028), (.085, .032)], segs=36)
    parts.append(('ecu', body, 'wood'))
    parts.append(('ecu_bord', revolve([(.325, -.018), (.352, -.012), (.358, .006), (.35, .02), (.323, .021)], segs=36), 'rust'))
    parts.append(('ecu_ombilic', revolve([(.0, .076), (.036, .066), (.066, .05), (.088, .031), (.09, .026), (.07, .028), (0.0, .034)][::-1][::-1], segs=20), 'rust'))
    parts.append(('ecu_pointe', Loft(np.array([[0, 0, .07], [0, 0, .102]]), .014, .014, p=2.0, segs=8, cap1=1, tile=.05, ref=(1, 0, 0)).mesh(), 'rust'))
    for k in range(8):
        a = k * PI / 4 + PI / 8
        pa = smoothpath([P_(.11 * np.cos(a), .11 * np.sin(a), .03), P_(.34 * np.cos(a), .34 * np.sin(a), .019)], 5)
        parts.append((f'ecu_planche{k}', Loft(pa, .0035, .0045, p=2.2, segs=6, tile=.05, ref=(0, 0, 1)).mesh(), 'rust_dark'))
        parts.append((f'ecu_clou{k}', blob([.335 * np.cos(a + .39), .335 * np.sin(a + .39), .02], .0075, segs=5, n=5), 'rust'))
    parts.append(('ecu_sangle', Loft(smoothpath([P_(-.12, 0, -.03), P_(0, 0, -.04), P_(.12, 0, -.03)], 8), .006, .02, p=2.2, segs=8, tile=.1, ref=(0, 1, 0)).mesh(), 'leather_old'))
    parts.append(('ecu_poignee', Loft(smoothpath([P_(-.07, 0, -.028), P_(.07, 0, -.028)], 5), .011, .011, p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 0, 1)).mesh(), 'wood'))
    return parts


def crossbow():
    parts = []
    # axe Y = direction de tir ; face +Z = dessus de l'arme
    st = smoothpath([P_(0, -.20, -.02), P_(0, .06, 0), P_(0, .42, .004)], 14)
    parts.append(('arbalete_fut', Loft(st, prof([(0, .028), (.2, .021), (.5, .017), (1, .014)], 14), prof([(0, .02), (.5, .017), (1, .012)], 14), p=2.4, segs=10, cap0=1, cap1=1, tile=.1, ref=(0, 0, 1)).mesh(), 'wood'))
    parts.append(('arbalete_rail', Loft(np.array([[0, .02, .02], [0, .43, .02]]), .005, .008, p=2.3, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 0, 1)).mesh(), 'steel_dull'))
    xs = np.linspace(-.3, .3, 20)
    prod = np.stack([xs, .43 + .075 * (xs / .3) ** 2, np.full(20, .006)], 1)
    parts.append(('arbalete_arc', Loft(prod, prof([(0, .007), (.5, .016), (1, .007)], 20), prof([(0, .009), (.5, .017), (1, .009)], 20), p=2.4, segs=10, cap0=1, cap1=1, tile=.1, ref=(0, 0, 1)).mesh(), 'wood'))
    parts.append(('arbalete_bride', Loft(np.array([[0, .42, .006], [0, .445, .006]]), .026, .02, p=2.6, segs=10, cap0=1, cap1=1, tile=.05, ref=(0, 0, 1)).mesh(), 'steel_dull'))
    for s in (1, -1):
        parts.append((f'arbalete_corde{s}', tube(smoothpath([P_(s * .3, .505, .006), P_(0, .20, .02)], 8), .0018, .0018, segs=4, ref=(0, 0, 1)), 'cord'))
        parts.append((f'arbalete_bout{s}', blob([s * .3, .505, .006], .0085, segs=6, n=5), 'steel_dull'))
    parts.append(('arbalete_etrier', Loft(smoothpath([P_(0, .39, .006), P_(0, .5, -.002), P_(0, .54, -.0), P_(0, .5, .016), P_(0, .45, .01)], 14), .004, .005, p=2.2, segs=6, cap0=1, cap1=1, tile=.05, ref=(1, 0, 0)).mesh(), 'steel_dull'))
    parts.append(('arbalete_noix', blob([0, .21, .024], .014, sq=(1, 1, 1), segs=8), 'steel_dull'))
    parts.append(('arbalete_gachette', tube(smoothpath([P_(0, .15, .0), P_(0, .13, -.03), P_(0, .12, -.045)], 5), .0035, .002, segs=5, ref=(1, 0, 0)), 'steel_dull'))
    parts.append(('arbalete_pontet', Loft(smoothpath([P_(0, .2, -.012), P_(0, .17, -.045), P_(0, .1, -.05), P_(0, .085, -.012)], 12), .003, .004, p=2.2, segs=6, cap0=1, cap1=1, tile=.05, ref=(1, 0, 0)).mesh(), 'steel_dull'))
    # carreau engagé
    parts.append(('carreau', tube(line(P_(0, .12, .03), P_(0, .43, .03), 8), .0048, .0048, segs=6, ref=(1, 0, 0)), 'wood'))
    parts.append(('carreau_pointe', Loft(line(P_(0, .43, .03), P_(0, .475, .03), 5), prof([(0, .0085), (1, .0006)], 5), prof([(0, .0085), (1, .0006)], 5), p=2.0, segs=6, tile=.05, ref=(1, 0, 0)).mesh(), 'steel_dull'))
    for s in (1, -1):
        parts.append((f'carreau_penne{s}', Loft(line(P_(0, .125, .03), P_(0, .17, .03), 5), .0008, prof([(0, .0), (.5, .011), (1, .002)], 5), p=2.0, segs=4, tile=.05, ref=(0, s, 0) if False else (s, 0, 0)).mesh(), 'leather_old'))
    return parts


def bolts_bandolier(A):
    strap(A, P_(.13, 1.40, .03), P_(-.12, 1.08, .1), .028, 'leather_old', 'Chest')
    for k in range(5):
        t = k / 4; p0 = P_(.13, 1.40, .03) * (1 - t) + P_(-.12, 1.08, .1) * t + P_(0, 0, .014)
        A.add(f'carreau_ban{k}', Loft(line(p0 + P_(-.02, -.05, 0), p0 + P_(.02, .06, 0), 5), .0045, .0045, p=2.0, segs=6, cap0=1, cap1=1, tile=.05, ref=(1, 0, 0)).mesh(), 'wood', 'Chest')


# ---------------------------------------------------------------------------------------------------------- variantes
V = {
    'skel_sword':    dict(eye=(0.25, 1.0, 0.65), weapon='sword', shield=True, helm='barbute'),
    'skel_archer':   dict(eye=(0.25, 1.0, 0.65), weapon='bow', helm='cap'),
    'skel_crossbow': dict(eye=(0.45, 1.0, 0.5), weapon='crossbow', helm='kettle'),
    'skel_mage':     dict(eye=(0.75, 0.35, 1.0), weapon='staff', helm=None),
}
REMAP = {'steel': 'rust', 'trim': 'rust_dark', 'leather': 'leather_old', 'cloth': 'rag', 'cloak': 'rag'}


def build(name):
    v = V[name]; A = Acc()
    skeleton(A, eye_mat='eye')
    P = A.parts
    if name == 'skel_sword':
        P += gear_parts(r'^(plastron|dos|epaule[0-1]|brassard0|cubitiere|cubitiere_pointe|genouillere|genouillere_pointe|lame[0-2]|ceinture|boucle|gorgerin0)(_R)?$', REMAP)
    elif name == 'skel_crossbow':
        P += gear_parts(r'^(epaule0|epaule1|gorgerin0|gorgerin1|brassard[01]|cubitiere|lame[0-2]|ceinture|boucle|genouillere)(_R)?$', REMAP)
        bolts_bandolier(A)
    elif name == 'skel_archer':
        P += gear_parts(r'^(brassard[0-2]|bracelet|ceinture|boucle|gorgerin0)(_R)?$', {'steel': 'leather_old', 'trim': 'rust_dark', 'leather': 'leather_old'})
        strap(A, P_(-.14, 1.40, .0), P_(.11, 1.10, .09), .02, 'leather_old', 'Chest')
    elif name == 'skel_mage':
        rag_robe(A); hood(A)
        P += gear_parts(r'^(medaillon|epaule_ornement|bracelet|ceinture)(_R)?$', {'steel': 'rust', 'trim': 'bone_aged', 'leather': 'leather_old'})
        strap(A, P_(.13, 1.41, .045), P_(-.1, 1.06, .1), .034, 'rag', 'Chest')
        # collier d'os
        cp = smoothpath([P_(-.07, 1.43, .05), P_(0, 1.395, .1), P_(.07, 1.43, .05)], 10)
        A.add('collier', tube(cp, .0035, .0035, segs=5, ref=(0, 1, 0)), 'cord', 'Chest')
        for k in range(5):
            t = (k + 1) / 6
            A.add(f'collier_dent{k}', blob(cp[int(t * 9)] + P_(0, -.012, 0), .007, sq=(.7, 1.6, .7), segs=5, n=5), 'bone_light', 'Chest')
    if v['helm']: helm(A, v['helm'])
    # armes
    if v['weapon'] == 'sword':
        wp = [(n, m, {'blade': 'rust_blade', 'trim': 'rust_dark', 'steel': 'rust', 'glow': 'rust_dark', 'leather': 'leather_old'}.get(mat, mat)) for n, m, mat in SG.parts if n != 'pierre']
        P += bake(wp, 'Hand_R', SWORD_Q, HAND_R_W, 'arme')
        P += bake(round_shield(), 'LowerArm_L', [0, sin_(50), 0, cos_(50)], S([0.33, 1.0, 0.14]), 'ecu')
    elif v['weapon'] == 'bow':
        wp = [(n, m, {'trim': 'rust_dark'}.get(mat, mat)) for n, m, mat in W.bow()]
        P += bake(wp, 'Hand_L', [sin_(20), 0, 0, cos_(20)], HAND_L_W, 'arme')
        qv = [(n, m, {'trim': 'rust_dark'}.get(mat, mat)) for n, m, mat in W.quiver()]
        P += bake(qv, 'Socket_Back', [0, 0, sin_(20), cos_(20)], S([-0.11, 1.18, -0.22]), 'carquois')
    elif v['weapon'] == 'crossbow':
        cb = crossbow()
        for _, m_, _ in cb: m_.V = m_.V - np.array([0, .14, 0])
        q = qmul(qaxis((1, 0, 0), PI / 2), qaxis((0, 1, 0), PI))
        P += bake(cb, 'Hand_R', list(q), S([-.33, .84, .12]), 'arme')
    elif v['weapon'] == 'staff':
        wp = [(n, m, {'trim': 'bone_aged', 'steel': 'rust', 'leather': 'leather_old'}.get(mat, mat)) for n, m, mat in W.staff()]
        P += bake(wp, 'Hand_R', [sin_(55), 0, 0, cos_(55)], HAND_R_W, 'arme')
        orb = [(n, m, {'trim': 'rust_dark', 'steel': 'rust'}.get(mat, mat)) for n, m, mat in W.orb()]
        P += bake(orb, 'Hand_L', [0, 0, 0, 1], S([0.362, 0.79, 0.08]), 'orbe')
    hmax = max(float(m.V[:, 1].max()) for _, m, _ in P)
    SK = copy.deepcopy(G.SK)
    return P, SK, dict(scale=np.ones(3), refHeight=round(hmax, 3), skin=(0.6, 0.55, 0.45), warty=0.0, eye=v['eye'], decimate=0.0, skel=True)
