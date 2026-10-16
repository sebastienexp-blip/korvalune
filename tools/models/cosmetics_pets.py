"""cosmetics_pets — familiers de la boutique en modules 3D (corps / tête / patte / queue / aile), origines = points d'articulation du code :
  corps : origine = centre du groupe du familier ; tête : pivot de tête ; patte : hanche (pend vers -y) ; queue : racine ; aile : racine, plan XZ, étendue vers +X (miroir = scale.x -1).
Rôles : 0.8 = couleur principale (fx.color), 0.6 = extrémités (fx.tip), 0.4 = yeux (fx.eye), 1.0 = fixe ; matériau 'glow' = parties lumineuses/prisme."""
import numpy as np
from kit import *
from cosmetics_geo import tube, ell, lens, poly, xform, scaled, wing_angel, wing_demon, GOLD, DARK, PINK, W_, R_, T_R

EYEW = (1.0, 0.95, 0.75)

def _eyes(k, y, z, dx, r, role=T_R):
    for sx in (-1, 1):
        k.add('flat', ell((sx * dx, y, z), (r, r * 1.1, r * 0.7), 'flat', (1, 1, 1), role, seg=8, rings=5))

def quad_parts(o):
    if o.get('pony'): return pony_parts(o)
    L = o.get('len', 1.3); hR = o.get('headR', 0.12)
    body = Kit(); head = Kit(); leg = Kit(); tail = Kit()
    # corps
    body.add('flat', ell((0, 0.2, 0), (0.136, 0.128, 0.16 * L), 'flat', (1, 1, 1), W_, seg=12, rings=8))
    body.add('flat', ell((0, 0.17, 0.09 * L), (0.095, 0.1, 0.09 * L), 'flat', (1, 1, 1), R_, seg=8, rings=5))      # poitrail clair
    body.add('flat', ell((0, 0.21, -0.1 * L), (0.125, 0.125, 0.1 * L), 'flat', (1, 1, 1), W_, seg=8, rings=5))      # croupe
    body.add('flat', ell((0, 0.27, 0.15 * L), (0.07, 0.08, 0.1), 'flat', (1, 1, 1), W_, seg=8, rings=5))            # cou
    if o.get('mane'):
        for i in range(5):
            body.add('glow', ell((0, 0.31 - i * 0.03, 0.1 * L - i * 0.05), (0.03, 0.05, 0.045), 'glow', (1, 1, 1), 1.0, seg=8, rings=5))
    # tête (origine = pivot de tête)
    head.add('flat', ell((0, 0, 0.04), (hR * 0.98, hR * 0.92, hR * 1.02), 'flat', (1, 1, 1), W_, seg=12, rings=8))
    sn = o.get('snout', 0)
    if sn:
        head.add('flat', ell((0, -0.03, 0.12 + (sn - 1) * 0.04), (0.055, 0.045, 0.06 * sn), 'flat', (1, 1, 1), R_, seg=8, rings=5))
    zn = 0.19 + ((sn - 1) * 0.04 + 0.04 if sn else 0)
    head.add('flat', ell((0, -0.015, zn), (0.022, 0.017, 0.02), 'flat', (0.1, 0.06, 0.07), 1.0, seg=6, rings=4))
    _eyes(head, 0.03, 0.135, 0.055, 0.026)
    ew, eh, tl = o.get('earW', 0.05), o.get('earH', 0.11), o.get('earTilt', 0.18)
    for sx in (-1, 1):
        base = np.array([sx * 0.07, 0.1, -0.005]); tip = base + np.array([sx * np.sin(tl) * eh * 1.35, np.cos(tl) * eh * 1.35, -0.004 if o.get('long') else 0])
        head.add('flat', lens(base, tip, ew * 1.1, ew * 0.35, 'flat', (1, 1, 1), W_, peak=0.22 if not o.get('long') else 0.45))
        if not o.get('long'):
            head.add('flat', lens(base + [0, 0.01, 0.014], base + (tip - base) * 0.78 + [0, 0, 0.014], ew * 0.6, 0.006, 'flat', PINK, 1.0, peak=0.25))
        else:
            head.add('flat', lens(base + [0, 0.01, 0.012], base + (tip - base) * 0.85 + [0, 0, 0.012], ew * 0.6, 0.006, 'flat', PINK, 1.0, peak=0.45))
    if o.get('horn'):
        d = np.array([0, np.cos(0.25), np.sin(0.25)]); c = np.array([0, 0.19, 0.07])
        head.add('metal', tube(c - d * 0.02, c + d * 0.14, 0.02, 0.003, 'metal', GOLD, 1.0, seg=8))
        for t in (0.25, 0.5, 0.75):
            head.add('metal', ell(c + d * (0.14 * t), (0.021 * (1 - t) + 0.006, 0.004, 0.021 * (1 - t) + 0.006), 'metal', (0.85, 0.65, 0.2), 1.0, rot=(0, 0.25, 0), seg=8, rings=3))
    # patte
    leg.add('flat', ell((0, -0.03, 0), (0.042, 0.06, 0.046), 'flat', (1, 1, 1), W_, seg=8, rings=5))
    leg.add('flat', tube((0, -0.07, 0), (0, -0.125, 0.004), 0.027, 0.02, 'flat', (1, 1, 1), W_, seg=7))
    leg.add('flat', ell((0, -0.133, 0.014), (0.032, 0.02, 0.045), 'flat', (1, 1, 1), R_, seg=8, rings=5))
    # queue (racine à l'origine, vers l'arrière)
    kind = o.get('tail', 'long')
    if kind == 'puff':
        tail.add('flat', ell((0, 0, -0.04), (0.05, 0.05, 0.05), 'flat', (1, 1, 1), R_, seg=8, rings=5))
    elif kind == 'bushy':
        for (y, z, r) in ((0.01, -0.04, 0.034), (0.05, -0.1, 0.05), (0.1, -0.16, 0.058), (0.15, -0.2, 0.05)):
            tail.add('flat', ell((0, y, z), (r, r, r * 1.25), 'flat', (1, 1, 1), W_, rot=(0, -0.9, 0), seg=8, rings=5))
        tail.add('flat', ell((0, 0.2, -0.235), (0.04, 0.04, 0.055), 'flat', (1, 1, 1), R_, rot=(0, -0.9, 0), seg=8, rings=5))
    else:
        pts = [np.array(p) for p in ((0, 0, 0), (0, 0.02, -0.07), (0, 0.08, -0.13), (0, 0.16, -0.15), (0, 0.23, -0.12))]
        for i in range(4):
            tail.add('flat', tube(pts[i], pts[i + 1], 0.026 - i * 0.002, 0.024 - i * 0.003, 'flat', (1, 1, 1), W_ if i < 3 else R_, seg=6))
        tail.add('flat', ell(pts[4], (0.02, 0.022, 0.02), 'flat', (1, 1, 1), R_, seg=6, rings=4))
    return body, head, leg, tail

def pony_parts(o):
    """V10.83 : vrai poney licorne — corps tonneau, cou arqué avec crinière, tête longue, jambes fines à sabots, queue flottante, longue corne torsadée.
    Repères (voir Cosmetics.js) : tête pivot (0,.46,.25) ; hanches des pattes y=.2, x=±.065, z=±.14 ; queue racine (0,.33,-.19)."""
    body = Kit(); head = Kit(); leg = Kit(); tail = Kit()
    body.add('flat', ell((0, 0.3, 0), (0.095, 0.09, 0.19), 'flat', (1, 1, 1), W_, seg=14, rings=9))
    body.add('flat', ell((0, 0.3, 0.115), (0.092, 0.097, 0.1), 'flat', (1, 1, 1), W_, seg=12, rings=8))           # poitrail
    body.add('flat', ell((0, 0.31, -0.105), (0.097, 0.097, 0.1), 'flat', (1, 1, 1), W_, seg=12, rings=8))          # croupe
    body.add('flat', ell((0, 0.25, 0.03), (0.07, 0.04, 0.14), 'flat', (1, 1, 1), R_, seg=10, rings=6))             # ventre clair
    body.add('flat', tube((0, 0.33, 0.14), (0, 0.46, 0.25), 0.062, 0.042, 'flat', (1, 1, 1), W_, seg=10))           # cou arqué
    for i in range(7):                                                                                           # crinière le long du cou
        t = i / 6; c = np.array([0, 0.35 + 0.115 * t + 0.045, 0.135 + 0.115 * t - 0.035 - 0.012 * (1 - t)])
        body.add('glow', ell(c, (0.018, 0.04 - 0.008 * t, 0.034), 'glow', (1, 1, 1), 1.0, seg=8, rings=5))
    for sx in (-1, 1):
        body.add('glow', ell((sx * 0.026, 0.4, 0.16), (0.012, 0.045, 0.028), 'glow', (1, 1, 1), 1.0, seg=6, rings=4))
    # tête (pivot = haut du cou)
    head.add('flat', ell((0, 0.0, 0.035), (0.05, 0.057, 0.075), 'flat', (1, 1, 1), W_, seg=12, rings=8))          # crâne
    head.add('flat', ell((0, -0.035, 0.115), (0.036, 0.036, 0.075), 'flat', (1, 1, 1), W_, seg=10, rings=7))      # chanfrein long
    head.add('flat', ell((0, -0.048, 0.178), (0.03, 0.028, 0.032), 'flat', (1, 1, 1), R_, seg=8, rings=5))        # museau
    for sx in (-1, 1):
        head.add('flat', ell((sx * 0.012, -0.045, 0.206), (0.007, 0.006, 0.006), 'flat', (0.1, 0.06, 0.07), 1.0, seg=5, rings=3))   # narines
    _eyes(head, 0.012, 0.05, 0.048, 0.018)
    for sx in (-1, 1):
        base = np.array([sx * 0.03, 0.05, -0.012]); tip = base + np.array([sx * 0.012, 0.075, -0.01])
        head.add('flat', lens(base, tip, 0.019, 0.007, 'flat', (1, 1, 1), W_, peak=0.25))
    d = np.array([0, np.cos(0.4), np.sin(0.4)]); c = np.array([0, 0.062, 0.05])
    head.add('metal', tube(c - d * 0.01, c + d * 0.27, 0.021, 0.003, 'metal', GOLD, 1.0, seg=10))
    for t in np.linspace(0.12, 0.88, 6):                                                                         # torsades de la corne
        head.add('metal', ell(c + d * (0.27 * t), (0.025 * (1 - t) + 0.006, 0.0045, 0.025 * (1 - t) + 0.006), 'metal', (0.85, 0.65, 0.2), 1.0, rot=(0, 0.4, 0), seg=8, rings=3))
    head.add('glow', ell((0, 0.075, 0.07), (0.016, 0.03, 0.022), 'glow', (1, 1, 1), 1.0, seg=6, rings=4))         # toupet
    # patte longue à sabot (origine = hanche)
    leg.add('flat', tube((0, 0, 0), (0, -0.105, 0.004), 0.031, 0.022, 'flat', (1, 1, 1), W_, seg=8))
    leg.add('flat', ell((0, -0.105, 0.004), (0.024, 0.022, 0.026), 'flat', (1, 1, 1), W_, seg=7, rings=4))         # articulation
    leg.add('flat', tube((0, -0.105, 0.004), (0, -0.2, 0.0), 0.019, 0.016, 'flat', (1, 1, 1), W_, seg=7))
    leg.add('flat', ell((0, -0.213, 0.004), (0.021, 0.016, 0.026), 'flat', (1, 1, 1), R_, seg=8, rings=5))        # sabot
    # queue flottante (racine à l'origine, vers l'arrière et le bas)
    pts = [(0, 0, 0), (0, -0.01, -0.07), (0, -0.05, -0.13), (0, -0.11, -0.17), (0, -0.19, -0.19)]
    for i, (a, b) in enumerate(zip(pts[:-1], pts[1:])):
        tail.add('glow', ell(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), (0.034 + 0.004 * i, 0.04, 0.05), 'glow', (1, 1, 1), 1.0, seg=8, rings=5))
    tail.add('glow', ell((0, -0.23, -0.19), (0.032, 0.05, 0.03), 'glow', (1, 1, 1), 1.0, seg=8, rings=5))
    return body, head, leg, tail

QUADS = {
    'chat': dict(earW=0.045, earH=0.1, snout=0.6, tail='long', len=1.2),
    'renard': dict(earW=0.05, earH=0.14, snout=1.5, tail='bushy', len=1.35),
    'loup': dict(earW=0.05, earH=0.12, snout=1.7, tail='bushy', headR=0.13, len=1.5),
    'lapin': dict(earW=0.035, earH=0.26, long=True, earTilt=0.12, tail='puff', snout=0.5, len=1.0),
    'licorne': dict(pony=True),
}

def _rot_xz(k):
    xform(k, T_(rx=-np.pi / 2)); return k

def pet_wing_plume(): k, _ = wing_angel(); xform(k, T_(s=0.44)); return _rot_xz(k), {}
def pet_wing_chauve(): k, _ = wing_demon(); xform(k, T_(s=0.5)); return _rot_xz(k), {}

def pet_wing_fee():
    k = Kit(); c = (0.81, 0.96, 1.0)
    up = [(0, 0, 0), (0.1, 0.12, 0), (0.28, 0.2, 0), (0.42, 0.14, 0), (0.36, 0.0, 0), (0.18, -0.02, 0)]
    lo = [(0, 0, 0), (0.18, -0.02, 0), (0.28, -0.12, 0), (0.18, -0.18, 0), (0.06, -0.1, 0)]
    for P in (up, lo):
        tris = [(0, i, i + 1) for i in range(1, len(P) - 1)]
        k.add('glow', poly(P, 'glow', c, 1.0, tris, shade=(0.8, 1.0)))
    k.add('glow', tube((0, 0, 0.002), (0.4, 0.13, 0.002), 0.004, 0.002, 'glow', (0.6, 0.85, 1.0), 1.0, seg=4))
    return _rot_xz(k), {}

def pet_owl():
    k = Kit()
    k.add('flat', ell((0, 0.22, 0), (0.152, 0.184, 0.144), 'flat', (1, 1, 1), W_, seg=12, rings=8))
    k.add('flat', ell((0, 0.19, 0.075), (0.1, 0.11, 0.055), 'flat', (1, 1, 1), R_, seg=10, rings=6))
    k.add('flat', ell((0, 0.42, 0), (0.12, 0.115, 0.115), 'flat', (1, 1, 1), W_, seg=12, rings=8))
    for sx in (-1, 1):
        k.add('flat', ell((sx * 0.055, 0.44, 0.095), (0.053, 0.053, 0.026), 'flat', EYEW, 1.0, seg=10, rings=6))
        k.add('flat', ell((sx * 0.055, 0.44, 0.118), (0.026, 0.028, 0.012), 'flat', (1, 1, 1), T_R, seg=8, rings=5))
        k.add('flat', lens((sx * 0.07, 0.51, 0), (sx * 0.095, 0.585, -0.01), 0.032, 0.016, 'flat', (1, 1, 1), W_, peak=0.25))
        k.add('flat', tube((sx * 0.04, 0.09, 0.02), (sx * 0.04, 0.02, 0.04), 0.012, 0.01, 'flat', (0.91, 0.63, 0.13), 1.0, seg=5))
        for dx in (-0.018, 0, 0.018):
            k.add('flat', lens((sx * 0.04 + dx, 0.025, 0.04), (sx * 0.04 + dx * 1.5, 0.012, 0.085), 0.008, 0.006, 'flat', (0.91, 0.63, 0.13), 1.0))
    k.add('flat', cone(0.024, 0.07, 6, 'flat', (0.91, 0.63, 0.13), 1.0, M=T_((0, 0.4, 0.105), rx=np.pi / 2)))
    k.add('flat', ell((0, 0.17, -0.1), (0.06, 0.05, 0.1), 'flat', (1, 1, 1), R_, rot=(0, 0.5, 0), seg=8, rings=5))   # queue
    return k, {}

def pet_bird(glowy=False):
    k = Kit()
    k.add('flat', ell((0, 0.2, 0), (0.117, 0.124, 0.163), 'flat', (1, 1, 1), W_, seg=12, rings=8))
    k.add('flat', ell((0, 0.17, 0.045), (0.08, 0.07, 0.1), 'flat', (1, 1, 1), R_, seg=8, rings=5))
    k.add('flat', ell((0, 0.32, 0.12), (0.082, 0.082, 0.085), 'flat', (1, 1, 1), W_ if glowy else R_, seg=10, rings=6))
    k.add('flat', cone(0.026, 0.09, 6, 'flat', (0.91, 0.63, 0.13), 1.0, M=T_((0, 0.31, 0.2), rx=np.pi / 2)))
    _eyes(k, 0.335, 0.18, 0.05, 0.018)
    for i, (a, L) in enumerate(((-0.35, 0.22), (0, 0.27), (0.35, 0.22))):
        p0 = np.array([0, 0.2, -0.17]); d = np.array([np.sin(a) * 0.5, 0.13, -np.cos(a)]); d = d / np.linalg.norm(d)
        k.add('flat', lens(p0, p0 + d * L, 0.04, 0.012, 'flat', (1, 1, 1), R_, peak=0.4))
    for sx in (-1, 1):
        k.add('flat', tube((sx * 0.04, 0.1, 0.01), (sx * 0.04, 0.03, 0.02), 0.009, 0.008, 'flat', (0.91, 0.63, 0.13), 1.0, seg=4))
    return k, {}

def pet_bat():
    k = Kit()
    k.add('flat', ell((0, 0, 0), (0.09, 0.1, 0.09), 'flat', (1, 1, 1), W_, seg=10, rings=6))
    k.add('flat', ell((0, 0.11, 0.05), (0.075, 0.07, 0.07), 'flat', (1, 1, 1), W_, seg=10, rings=6))
    k.add('flat', ell((0, 0.075, 0.1), (0.04, 0.028, 0.03), 'flat', (1, 1, 1), R_, seg=8, rings=5))
    for sx in (-1, 1):
        k.add('flat', lens((sx * 0.035, 0.16, 0.05), (sx * 0.055, 0.26, 0.04), 0.036, 0.01, 'flat', (1, 1, 1), W_, peak=0.2))
        k.add('flat', ell((sx * 0.035, 0.12, 0.105), (0.014, 0.016, 0.01), 'flat', (1, 1, 1), T_R, seg=6, rings=4))
        k.add('flat', lens((sx * 0.012, 0.062, 0.12), (sx * 0.016, 0.04, 0.128), 0.006, 0.005, 'flat', (0.95, 0.95, 0.95), 1.0))
    return k, {}

def pet_dragon():
    k = Kit()
    k.add('flat', ell((0, 0.22, 0), (0.128, 0.128, 0.2), 'flat', (1, 1, 1), W_, seg=12, rings=8))
    k.add('flat', ell((0, 0.18, 0.05), (0.07, 0.065, 0.1), 'flat', (1, 1, 1), R_, seg=8, rings=5))
    k.add('flat', ell((0, 0.3, 0.12), (0.075, 0.08, 0.11), 'flat', (1, 1, 1), W_, seg=8, rings=5))   # cou
    k.add('flat', ell((0, 0.34, 0.19), (0.09, 0.085, 0.1), 'flat', (1, 1, 1), W_, seg=10, rings=6))
    k.add('flat', ell((0, 0.315, 0.285), (0.054, 0.042, 0.078), 'flat', (1, 1, 1), W_, seg=8, rings=5))
    k.add('flat', ell((0, 0.31, 0.3), (0.035, 0.02, 0.06), 'flat', (1, 1, 1), R_, seg=6, rings=4))
    for sx in (-1, 1):
        k.add('flat', ell((sx * 0.05, 0.37, 0.23), (0.02, 0.022, 0.014), 'flat', (1, 1, 1), T_R, seg=6, rings=4))
        k.add('flat', tube((sx * 0.05, 0.42, 0.15), (sx * 0.075, 0.52, 0.1), 0.02, 0.004, 'flat', (1, 1, 1), R_, seg=6))
        k.add('flat', ell((sx * 0.012, 0.31, 0.335), (0.006, 0.006, 0.006), 'flat', DARK, 1.0, seg=4, rings=3))
    for i in range(5):
        k.add('flat', lens((0, 0.34 - i * 0.025, 0.02 - i * 0.07), (0, 0.4 - i * 0.025, -0.01 - i * 0.07), 0.02, 0.01, 'flat', (1, 1, 1), R_, up=(1, 0, 0), peak=0.2))
    pts = [np.array(p) for p in ((0, 0.2, -0.17), (0, 0.19, -0.3), (0, 0.2, -0.43), (0, 0.24, -0.54), (0, 0.3, -0.62))]
    for i in range(4):
        k.add('flat', tube(pts[i], pts[i + 1], 0.07 * (1 - i * 0.22), 0.07 * (1 - (i + 1) * 0.22) + 0.006, 'flat', (1, 1, 1), W_, seg=8))
    k.add('flat', lens(pts[4] - [0, 0.01, 0.01], pts[4] + [0, 0.07, -0.12], 0.04, 0.012, 'flat', (1, 1, 1), R_, up=(1, 0, 0), peak=0.3))
    for sx in (-1, 1):
        for z in (0.1, -0.1):
            k.add('flat', tube((sx * 0.08, 0.12, z), (sx * 0.085, 0.03, z + 0.02), 0.032, 0.022, 'flat', (1, 1, 1), W_, seg=6))
            k.add('flat', ell((sx * 0.085, 0.022, z + 0.035), (0.03, 0.018, 0.045), 'flat', (1, 1, 1), R_, seg=6, rings=4))
    return k, {}

def pet_fairy():
    k = Kit()
    k.add('flat', ell((0, 0.1, 0), (0.05, 0.052, 0.05), 'flat', (1, 0.9, 0.84), 1.0, seg=10, rings=6))
    k.add('flat', ell((0, 0.13, -0.012), (0.054, 0.034, 0.054), 'flat', GOLD, 1.0, seg=8, rings=5))
    k.add('flat', ell((0, 0.2 - 0.2, 0), (0.06, 0.078, 0.06), 'flat', (1, 1, 1), W_, seg=8, rings=5))
    k.add('flat', cone(0.075, 0.1, 10, 'flat', (1, 1, 1), W_, M=T_((0, -0.12, 0), rx=np.pi) if False else T_((0, -0.13, 0))))
    k.add('flat', ell((0, 0.12 - 0.12 + 0.12, 0.028), (0.007, 0.007, 0.007), 'flat', (1, 1, 1), T_R, seg=4, rings=3)) if False else None
    for sx in (-1, 1):
        k.add('flat', ell((sx * 0.02, 0.105, 0.045), (0.007, 0.009, 0.005), 'flat', (1, 1, 1), T_R, seg=4, rings=3))
        k.add('flat', tube((sx * 0.055, 0.03, 0), (sx * 0.1, -0.02, 0.03), 0.009, 0.007, 'flat', (1, 0.9, 0.84), 1.0, seg=4))
        k.add('flat', tube((sx * 0.02, -0.11, 0), (sx * 0.025, -0.2, 0.008), 0.01, 0.008, 'flat', (1, 0.9, 0.84), 1.0, seg=4))
    return k, {}

def pet_golem_body():
    k = Kit(); ST = 'pierre'
    k.add(ST, box((0.3, 0.26, 0.22), ST, (1, 1, 1), W_, M=T_((0, 0.3, 0), ry=0.04, rz=0.02)))
    k.add(ST, box((0.2, 0.17, 0.18), ST, (1, 1, 1), W_, M=T_((0, 0.5, 0.01), ry=-0.08)))
    k.add(ST, box((0.12, 0.08, 0.1), ST, (1, 1, 1), W_, M=T_((0, 0.19, 0.02))))     # ceinture
    for sx in (-1, 1):
        k.add(ST, box((0.09, 0.22, 0.09), ST, (1, 1, 1), W_, M=T_((sx * 0.2, 0.28, 0), rz=-sx * 0.06)))
        k.add(ST, box((0.11, 0.1, 0.11), ST, (1, 1, 1), W_, M=T_((sx * 0.2, 0.43, 0), ry=0.4 * sx)))                # épaule
        k.add(ST, box((0.1, 0.09, 0.1), ST, (1, 1, 1), W_, M=T_((sx * 0.21, 0.14, 0.01), ry=-0.3)))                   # poing
        k.add('glow', box((0.07, 0.018, 0.016), 'glow', (1, 1, 1), R_, M=T_((sx * 0.05, 0.52, 0.1))))
    k.add(ST, box((0.06, 0.05, 0.05), ST, (1, 1, 1), W_, M=T_((-0.08, 0.64, -0.02), ry=0.5, rz=0.3)))
    k.add('glow', octa(0.06, 'glow', (1, 1, 1), R_, M=T_((0, 0.32, 0.12)), sy=1.25))
    return k, {}

def pet_golem_leg():
    k = Kit(); ST = 'pierre'
    k.add(ST, box((0.1, 0.17, 0.12), ST, (1, 1, 1), W_, M=T_((0, -0.08, 0))))
    k.add(ST, box((0.115, 0.035, 0.15), ST, (1, 1, 1), W_, M=T_((0, -0.16, 0.012))))
    return k, {}

def pet_spider_body():
    k = Kit()
    k.add('flat', ell((0, 0.16, -0.08), (0.117, 0.104, 0.15), 'flat', (1, 1, 1), W_, seg=12, rings=8))
    k.add('flat', ell((0, 0.15, 0.1), (0.085, 0.08, 0.085), 'flat', (1, 1, 1), W_, seg=10, rings=6))
    k.add('flat', ell((0, 0.2, -0.1), (0.045, 0.02, 0.07), 'flat', (1, 1, 1), R_, seg=6, rings=4))     # motif dorsal
    for sx in (-1, 1):
        for dy in (0, 0.03):
            k.add('flat', ell((sx * (0.03 + dy), 0.18 + dy * 0.5, 0.17), (0.017, 0.017, 0.012), 'flat', (1, 1, 1), T_R, seg=6, rings=4))
        k.add('flat', lens((sx * 0.025, 0.12, 0.17), (sx * 0.03, 0.06, 0.2), 0.012, 0.01, 'flat', (0.12, 0.08, 0.1), 1.0))
    return k, {}

def pet_spider_leg():
    k = Kit()
    a, b, c = np.array([0, 0.0, 0]), np.array([0.12, 0.08, 0]), np.array([0.25, -0.15, 0])
    k.add('flat', tube(a, b, 0.014, 0.011, 'flat', (1, 1, 1), W_, seg=5))
    k.add('flat', tube(b, c, 0.011, 0.005, 'flat', (1, 1, 1), W_, seg=5))
    k.add('flat', ell(b, (0.014, 0.014, 0.014), 'flat', (1, 1, 1), R_, seg=5, rings=4))
    return k, {}

def pet_pumpkin():
    from cosmetics_geo import hat_pumpkin
    k, _ = hat_pumpkin(0.2); return k, {}

def catalog():
    d = {}
    for nm, o in QUADS.items():
        b, h, l, t = quad_parts(o)
        d[f'cos_fam_{nm}_corps'] = (b, {}); d[f'cos_fam_{nm}_tete'] = (h, {}); d[f'cos_fam_{nm}_patte'] = (l, {}); d[f'cos_fam_{nm}_queue'] = (t, {})
    d['cos_fam_aile_plume'] = pet_wing_plume(); d['cos_fam_aile_chauve'] = pet_wing_chauve(); d['cos_fam_aile_fee'] = pet_wing_fee()
    d['cos_fam_hibou'] = pet_owl(); d['cos_fam_oiseau'] = pet_bird(False); d['cos_fam_phenix'] = pet_bird(True); d['cos_fam_chauve'] = pet_bat()
    d['cos_fam_dragon'] = pet_dragon(); d['cos_fam_fee'] = pet_fairy()
    d['cos_fam_golem'] = pet_golem_body(); d['cos_fam_golem_patte'] = pet_golem_leg()
    d['cos_fam_araignee'] = pet_spider_body(); d['cos_fam_araignee_patte'] = pet_spider_leg()
    d['cos_fam_citrouille'] = pet_pumpkin()
    return d
