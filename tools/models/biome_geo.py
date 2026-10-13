"""Décors de régions (biomes) — modules GLB « unité » : même repère que les primitives procédurales (centré à l'origine, hauteur 1 de -0.5 à +0.5,
rayon ~1) afin que le code d'instanciation (échelle/rotation/collision) du monde reste inchangé."""
import numpy as np
from kit import *
from kit import _mk

def rock(seed, color, jag=0.22, flat=0.75, mat='pierre', seg=11, rings=7, M=None):
    """Bloc rocheux à facettes : sphère déformée, normales plates par face. Rayon ~1, aplati en Y (flat)."""
    rng = np.random.default_rng(seed)
    s = sphere(1.0, mat, color, seg=seg, rings=rings)
    # soude les sommets de couture pour déformer de façon cohérente
    key = np.round(s.V, 4); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1)
    k = inv.max() + 1
    d = 1 + rng.uniform(-jag, jag, k)
    V = s.V * d[inv][:, None]; V[:, 1] *= flat
    tri = V[s.F]; n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    ok = np.linalg.norm(n, axis=1) > 1e-9; F = s.F[ok]; tri = tri[ok]; n = n[ok]; n /= np.linalg.norm(n, axis=1, keepdims=True)
    out = _mk(tri.reshape(-1, 3), s.UV[F].reshape(-1, 2), np.repeat(n, 3, axis=0), np.arange(len(F) * 3).reshape(-1, 3), color, 1.0)
    cen = tri.mean(1); flip = (n * cen).sum(1) < 0
    out.F[flip] = out.F[flip][:, ::-1]
    out.N = np.repeat(np.where(flip[:, None], -n, n), 3, axis=0)
    # variation de teinte par facette
    shade = 0.85 + 0.3 * rng.random(len(F)); out.C[:, :3] *= np.repeat(shade, 3)[:, None]
    return place(out, M)

def prism(r0, r1, h, seg, mat, color, a0=0.0, M=None):
    return cyl(r0, r1, h, seg, mat, color, M=M, smooth=False, a0=a0)

BAS = (0.17, 0.15, 0.20); OBS = (0.10, 0.08, 0.09); VIOL = (0.62, 0.35, 0.95); MARB = (0.93, 0.90, 0.82); IRONR = (0.42, 0.41, 0.40)
SAND = (0.72, 0.56, 0.32); SNOW = (0.90, 0.93, 0.95); ICE = (0.72, 0.90, 0.97); CACT = (0.31, 0.48, 0.23); ROT = (0.23, 0.18, 0.13); REED = (0.30, 0.42, 0.17)

def basalt():
    k = Kit(); rng = np.random.default_rng(1)
    # trois tronçons de prisme (colonnes basaltiques) décalés + éclats ; cylindre unité : y de -.5 à +.5
    k.add('pierre', prism(.75, 1.0, .52, 7, 'pierre', BAS, M=T_((0, -.5, 0))))
    k.add('pierre', prism(.72, .78, .30, 7, 'pierre', BAS, a0=.3, M=T_((.03, .02, -.02), ry=.2)))
    k.add('pierre', prism(.66, .55, .20, 7, 'pierre', (0.21, 0.19, 0.24), a0=.6, M=T_((-.05, .32, .03), ry=.5, rz=.08)))
    for i in range(3):
        a = i * 2.1; k.add('pierre', rock(10 + i, BAS, .25, .6, M=T_((np.cos(a) * 1.0, -.46, np.sin(a) * 1.0), s=.22)))
    return k, {}

def float_rock():
    k = Kit()
    k.add('pierre', rock(21, (0.23, 0.19, 0.25), .3, .7))
    k.add('glow', octa(.12, 'glow', (1.0, 0.45, 0.15), M=T_((.2, .55, .3))))
    return k, {}

def obsidian():
    k = Kit()
    k.add('metal', facet_pyramid(1.0, 1.0, 5, 'metal', OBS, M=T_((0, -.5, 0))))
    k.add('metal', facet_pyramid(.5, .7, 4, 'metal', (0.14, 0.10, 0.11), M=T_((.9, -.5, .2), rz=-.35)))
    k.add('glow', facet_pyramid(.16, .35, 4, 'glow', (1.0, 0.33, 0.12), M=T_((.05, -.5, .85))))
    return k, {}

def crystal():
    k = Kit()
    k.add('glow', octa(1.0, 'glow', VIOL))
    for i, (x, z, s) in enumerate(((1.1, .3, .45), (-.8, .7, .35), (.2, -1.0, .4))):
        k.add('glow', octa(s, 'glow', (0.48, 0.25, 0.8), M=T_((x, -.55 + s * .3, z), rz=(x * .3)), sy=1.5))
    return k, {}

def column():
    k = Kit()
    k.add('pierre', cyl(1.0, .95, .04, 14, 'pierre', MARB, M=T_((0, -.5, 0)), smooth=True))
    k.add('pierre', cyl(.92, .78, .92, 14, 'pierre', MARB, M=T_((0, -.46, 0))))
    k.add('pierre', cyl(1.2, 1.1, .035, 14, 'pierre', (0.88, 0.84, 0.76), M=T_((0, .465, 0))))
    # cannelures : fines baguettes verticales
    for i in range(10):
        a = i * 2 * np.pi / 10; k.add('pierre', box((.07, .86, .05), 'pierre', (0.82, 0.78, 0.70), M=T_((np.cos(a) * .85, 0, np.sin(a) * .85), ry=-a)))
    return k, {}

def rock_iron(): return _rk(31, IRONR)
def rock_sand(): return _rk(32, SAND, flat=.62)
def rock_snow(): return _rk(33, SNOW, .18)
def _rk(seed, col, jag=.22, flat=.75):
    k = Kit(); k.add('pierre', rock(seed, col, jag, flat)); return k, {}

def cactus():
    k = Kit()
    k.add('plaster', cyl(.8, .85, 1.0, 10, 'plaster', CACT, M=T_((0, -.5, 0))))
    k.add('plaster', sphere(.8, 'plaster', CACT, M=T_((0, .5, 0)), seg=10, rings=4))
    # deux bras : tronçon horizontal puis relevé (échelle Y forte en jeu → hauteurs prudentes)
    for sx, y in ((1, -.05), (-1, .12)):
        k.add('plaster', cyl(.4, .4, 1.2, 8, 'plaster', CACT, M=T_((sx * .75, y, 0), rz=-sx * np.pi / 2)))
        k.add('plaster', cyl(.38, .36, .55, 8, 'plaster', CACT, M=T_((sx * 1.9, y - .05, 0))))
    return k, {}

def stump():
    k = Kit()
    k.add('bois', cyl(1.0, .75, 1.0, 9, 'bois', ROT, M=T_((0, -.5, 0))))
    for i in range(5):
        a = i * 1.26 + .3; k.add('bois', cyl(.35, .08, .45, 5, 'bois', (0.20, 0.15, 0.10), M=T_((np.cos(a) * .95, -.52, np.sin(a) * .95), rz=-np.cos(a) * 1.0 - .2, rx=np.sin(a) * 1.0)))
    k.add('bois', facet_pyramid(.6, .22, 5, 'bois', (0.28, 0.20, 0.14), M=T_((.1, .5, 0))))
    return k, {}

def reed():
    k = Kit(); rng = np.random.default_rng(5)
    for i in range(5):
        a = rng.random() * 6.28; lean = rng.uniform(.0, .25); h = 1.0 - rng.random() * .25
        k.add('plaster', cyl(.22, .0, h, 4, 'plaster', REED, M=T_((np.cos(a) * .35, -.5, np.sin(a) * .35), ry=a, rz=lean), caps=(False, False)))
    k.add('plaster', cyl(.2, .2, .22, 6, 'plaster', (0.38, 0.27, 0.14), M=T_((.05, .22, 0))))
    return k, {}

def ice():
    k = Kit()
    k.add('pierre', facet_pyramid(1.0, 1.0, 6, 'pierre', ICE, M=T_((0, -.5, 0))))
    k.add('pierre', facet_pyramid(.55, .6, 5, 'pierre', (0.8, 0.94, 1.0), M=T_((.85, -.5, .3), rz=-.28)))
    k.add('pierre', facet_pyramid(.4, .5, 5, 'pierre', (0.66, 0.86, 0.95), M=T_((-.7, -.5, .6), rz=.3)))
    return k, {}

def catalog():
    return {'biome_basalte': basalt(), 'biome_debris': float_rock(), 'biome_obsidienne': obsidian(), 'biome_cristal': crystal(), 'biome_colonne': column(),
            'biome_roche_fer': rock_iron(), 'biome_roche_gres': rock_sand(), 'biome_roche_neige': rock_snow(), 'biome_cactus': cactus(),
            'biome_souche': stump(), 'biome_roseau': reed(), 'biome_glace': ice()}

# ------------------------------------------------------------------------------------------------ cinématique d'introduction
def _rh(x, z, seed=7):
    s = np.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453; return s - np.floor(s)

def _hnoise(x, z, seed=7):
    """Bruit de valeur lissé (même principe que celui de la cinématique)."""
    xi, zi = np.floor(x), np.floor(z); xf, zf = x - xi, z - zi
    u = xf * xf * (3 - 2 * xf); v = zf * zf * (3 - 2 * zf)
    a = _rh(xi, zi, seed) * (1 - u) + _rh(xi + 1, zi, seed) * u
    b = _rh(xi, zi + 1, seed) * (1 - u) + _rh(xi + 1, zi + 1, seed) * u
    return a * (1 - v) + b * v

def intro_citadel():
    """Île flottante (pointe vers le bas) + donjon central, 5 tours, enceinte, fenêtres allumées. Origine = centre de l'île (le jeu la pose à y = -38)."""
    k = Kit(); rng = np.random.default_rng(5)
    s = sphere(40.0, 'pierre', (1, 1, 1), seg=30, rings=20)
    key = np.round(s.V, 3); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1)
    V = s.V.copy()
    for i in range(len(V)):
        x, y, z = V[i]
        n = float(_hnoise(x * .08 + 5, z * .08 + y * .05))
        if y > 0: y *= .16
        else:
            kk = 1 + (-y / 40) * 1.6; y *= 2.1; x /= kk; z /= kk
        f = .84 + n * .34; x *= f; z *= f; y += (n - .5) * 6
        V[i] = (x, y, z)
    # soude les coutures (même position d'origine → même point déformé)
    acc = np.zeros((inv.max() + 1, 3)); cnt = np.zeros(inv.max() + 1)
    np.add.at(acc, inv, V); np.add.at(cnt, inv, 1); V = (acc / cnt[:, None])[inv]
    tri = V[s.F]; n_ = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); ok = np.linalg.norm(n_, axis=1) > 1e-9
    F = s.F[ok]; tri = tri[ok]; n_ = n_[ok] / np.linalg.norm(n_[ok], axis=1, keepdims=True)
    flip = (n_ * tri.mean(1)).sum(1) < 0; n_[flip] *= -1
    isl = _mk(tri.reshape(-1, 3), s.UV[F].reshape(-1, 2) * 4, np.repeat(n_, 3, axis=0), np.arange(len(F) * 3).reshape(-1, 3), (1, 1, 1), 1.0)
    isl.F[flip] = isl.F[flip][:, ::-1]
    top = isl.V[:, 1] > -2
    shade = np.repeat(.6 + .4 * rng.random(len(F)), 3)
    isl.C[:, 0] = np.where(top, .50, .52) * shade; isl.C[:, 1] = np.where(top, .58, .50) * shade; isl.C[:, 2] = np.where(top, .64, .82) * shade
    k.add('plaster', isl)
    STONE_ = (0.62, 0.68, 0.95); ROOF_ = (0.30, 0.33, 0.68)
    def tower(x, z, r, h, rh):
        k.add('pierre', cyl(r, r * .85, h, 9, 'pierre', STONE_, M=T_((x, 6, z))))
        k.add('tuile', cyl(r * 1.25, .01, rh, 9, 'tuile', ROOF_, M=T_((x, 6 + h, z)), caps=(True, False)))
        for j in range(6):
            a = rng.random() * 6.28; yy = 8 + rng.random() * (h - 5)
            k.add('glow', box((.9, 1.5, .5), 'glow', (1.0, .84, .5), M=T_((x + np.cos(a) * r * .9, yy, z + np.sin(a) * r * .9), ry=-a + np.pi / 2)))
    tower(0, 0, 6.5, 34, 20)
    for i in range(5):
        a = i / 5 * np.pi * 2 + .3; tower(np.cos(a) * 22, np.sin(a) * 22, 3.2, 12 + (i % 2) * 7, 8 + i % 3 * 2)
    k.add('pierre', cyl(24, 23, 5, 24, 'pierre', (0.55, 0.60, 0.88), M=T_((0, 6, 0)), caps=(False, False)))
    return k, {}

def intro_rock():
    k = Kit(); k.add('pierre', rock(77, (0.5, 0.53, 0.8), .3, 1.0)); return k, {}

_old_catalog = catalog
def catalog():
    d = _old_catalog(); d['intro_citadelle'] = intro_citadel(); d['intro_rocher'] = intro_rock(); return d
