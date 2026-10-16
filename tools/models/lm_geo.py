"""Points d'intérêt (repères), ruines, portails, caravane, forge — modules GLB statiques (origine au sol, centre du repère)."""
import numpy as np
from kit import *
from town_geo import STONE, WOOD, DWOOD, IRON, BRASS, gable_poly

ROCK = (0.46, 0.45, 0.42); DROCK = (0.30, 0.29, 0.27); MOSS = (0.34, 0.39, 0.29); MARBLE = (0.93, 0.90, 0.82); GOLD = (0.85, 0.70, 0.29)
ROOF = (0.48, 0.29, 0.20); CLOTH = (0.54, 0.29, 0.23)

def ring_pos(n, r, a0=0.0):
    return [(np.cos(a0 + 2 * np.pi * i / n) * r, np.sin(a0 + 2 * np.pi * i / n) * r, a0 + 2 * np.pi * i / n) for i in range(n)]

def windmill():
    k = Kit()
    k.add('pierre', cyl(3.2, 2.4, 8, 10, 'pierre', (0.6, 0.58, 0.54)))
    k.add('tuile', cyl(3.4, .02, 3, 10, 'tuile', ROOF, M=T_((0, 7.9, 0)), caps=(True, False)))
    k.add('bois', box((1.3, 2.2, .3), 'bois', DWOOD, M=T_((0, 1.1, 3.0))))
    k.add('bois', box((.9, 1.2, .3), 'bois', DWOOD, M=T_((0, 5.0, 2.7))))
    k.add('metal', box((.5, .5, 1.2), 'metal', IRON, M=T_((0, 8, 2.9))))
    return k, {}

def windmill_sails():
    """Hélice : origine = moyeu ; à faire tourner autour de Z."""
    k = Kit()
    for i in range(4):
        a = i * np.pi / 2
        R = T_((0, 0, 0), rz=a)
        k.add('bois', box((.22, 7.4, .15), 'bois', WOOD, M=R @ T_((0, 3.7, 0))))
        for j in range(5):
            k.add('bois', box((1.4, .1, .1), 'bois', WOOD, M=R @ T_((0.75, 1.2 + j * 1.2, .02))))
        k.add('cloth', box((1.4, 5.6, .04), 'cloth', (0.86, 0.82, 0.7), M=R @ T_((0.75, 3.9, -.02))))
    k.add('metal', cyl(.3, .3, .4, 8, 'metal', IRON, M=T_((0, 0, -.2), rx=np.pi / 2)))
    return k, {}

def menhirs():
    rng = np.random.default_rng(3); k = Kit()
    for x, z, a in ring_pos(9, 7.0):
        h = 3 + rng.random() * 3
        k.add('pierre', cyl(.8, .5, h, 5, 'pierre', ROCK if rng.random() > .3 else MOSS, M=T_((x, -.3, z), ry=-a + rng.random() * .3, rz=rng.uniform(-.06, .06))))
        k.add('pierre', cyl(.5, .3, .25, 5, 'pierre', ROCK, M=T_((x, h - .35, z), ry=-a)))
    k.add('pierre', cyl(1.9, 1.6, .7, 7, 'pierre', DROCK, M=T_((0, 0, 0))))
    k.add('pierre', cyl(1.3, 1.5, .25, 7, 'pierre', ROCK, M=T_((0, .7, 0))))
    return k, {'colliders': [[float(x), float(z), 0.9] for x, z, _ in ring_pos(9, 7.0)]}

def farm():
    k = Kit(); rng = np.random.default_rng(4)
    for (x, z, w, d), h in zip([(-5, -4, 8, .8), (-5, 4, 8, .8), (-9, 0, .8, 8)], (2.6, 3.4, 2.2)):
        k.add('pierre', box((w, h, d), 'pierre', (0.54, 0.48, 0.38), M=T_((x, h / 2, z))))
        k.add('pierre', box((w * .35, .5, d * .9 if w < d else d * 2), 'pierre', (0.54, 0.48, 0.38), M=T_((x + (w * .2), h + .2, z), rz=.2 if w > d else 0)))
    k.add('plaster', box((5, 3.4, 5), 'plaster', (0.48, 0.42, 0.33), M=T_((4, 1.7, 0))))
    k.add('tuile', facet_pyramid(4.6, 2.2, 4, 'tuile', ROOF, M=T_((4, 3.4, 0), ry=np.pi / 4)))
    k.add('bois', box((1.6, 2.2, .2), 'bois', DWOOD, M=T_((4, 1.1, 2.55))))
    for sx in (-1, 1):
        k.add('bois', box((.2, 3.4, .2), 'bois', WOOD, M=T_((4 + sx * 2.5, 1.7, 2.5))))
    return k, {'boxes': [[-5, -4, 4, .4, 2.6], [-5, 4, 4, .4, 3.4], [-9, 0, .4, 4, 2.2], [4, 0, 2.5, 2.5, 4]]}

def camp():
    k = Kit()
    for i in range(3):
        a = i * 2.1; px, pz = np.cos(a) * 5, np.sin(a) * 5
        k.add('cloth', facet_pyramid(2.0 * 1.35, 2.8, 4, 'cloth', CLOTH, M=T_((px, 0, pz), ry=a + np.pi / 4)))
        k.add('cloth', box((.9, 1.5, .06), 'cloth', (0.2, 0.12, 0.1), M=T_((px + np.cos(a) * 0, .75, pz + 0), ry=a)))
        k.add('bois', cyl(.05, .04, 3.4, 5, 'bois', WOOD, M=T_((px, 0, pz))))
    k.add('pierre', cyl(1.0, .9, .3, 8, 'pierre', DROCK))
    for a in np.linspace(0, 2 * np.pi, 7)[:-1]:
        k.add('pierre', sphere(.22, 'metal', (0.4, 0.39, 0.37), M=T_((np.cos(a) * .95, .15, np.sin(a) * .95)), seg=5, rings=3))
    for a in (0.3, 1.9, 3.6):
        k.add('bois', cyl(.07, .07, .9, 5, 'bois', DWOOD, M=T_((0, .3, 0), ry=a, rz=1.1)))
    return k, {'colliders': [[float(np.cos(i * 2.1) * 5), float(np.sin(i * 2.1) * 5), 1.6] for i in range(3)]}

def flame():
    k = Kit()
    k.add('glow', cyl(.5, 0.01, 1.2, 6, 'glow', (1.0, 0.48, 0.16), M=T_((0, 0.3, 0)), caps=(True, False)))
    return k, {}

def altar(blood=False):
    k = Kit(); c = (0.29, 0.11, 0.13) if blood else MOSS
    k.add('pierre', box((4, 1.1, 2.2), 'pierre', c, M=T_((0, .55, 0))))
    k.add('pierre', box((3.4, .4, 1.8), 'pierre', DROCK, M=T_((0, 1.3, 0))))
    for sx in (-1, 1):
        k.add('pierre', box((.5, 3.2, .5), 'pierre', c, M=T_((sx * 2.6, 1.6, 0))))
        k.add('pierre', box((.7, .25, .7), 'pierre', DROCK, M=T_((sx * 2.6, 3.3, 0))))
    if blood:
        k.add('glow', octa(.5, 'glow', (1.0, 0.23, 0.23), M=T_((0, 2.0, 0)), sy=1.4))
    return k, {}

def fortress():
    rng = np.random.default_rng(5); k = Kit(); R = 13; cols = []
    for i in range(16):
        a = 2 * np.pi * i / 16
        if np.cos(a) > .85: continue
        h = 3 + rng.random() * 3.5
        cols.append([float(np.cos(a) * R), float(np.sin(a) * R), 2.8])
        k.add('pierre', box((5.6, h, 1.4), 'pierre', (0.42, 0.41, 0.38), M=T_((np.cos(a) * R, h / 2, np.sin(a) * R), ry=-a + np.pi / 2)))
        if rng.random() > .5:
            k.add('pierre', box((1.2, .6, 1.5), 'pierre', ROCK, M=T_((np.cos(a) * R + rng.uniform(-1, 1), h + .2, np.sin(a) * R), ry=-a + np.pi / 2, rz=.3)))
    for a in (0.8, 2.4, 3.9, 5.5):
        x, z = np.cos(a) * R, np.sin(a) * R
        cols.append([float(x), float(z), 2.5])
        k.add('pierre', cyl(2.4, 2.0, 8, 8, 'pierre', ROCK, M=T_((x, 0, z))))
        k.add('pierre', cyl(2.6, 2.6, .4, 8, 'pierre', DROCK, M=T_((x, 7.8, z))))
        for j in range(6):
            b = j * np.pi / 3
            k.add('pierre', box((.8, .9, .5), 'pierre', ROCK, M=T_((x + np.cos(b) * 2.3, 8.45, z + np.sin(b) * 2.3), ry=-b + np.pi / 2)))
    k.add('pierre', box((5, 4, 5), 'pierre', DROCK, M=T_((0, 2, 0))))
    k.add('pierre', box((5.6, .4, 5.6), 'pierre', ROCK, M=T_((0, 4.2, 0))))
    return k, {'colliders': cols, 'boxes': [[0, 0, 2.5, 2.5, 4]]}

def watchtower(burnt=False):
    k = Kit(); c = (0.17, 0.14, 0.12) if burnt else ROCK
    k.add('pierre', cyl(2.6, 2.0, 9, 8, 'pierre', c))
    k.add('pierre', cyl(2.8, 2.8, .4, 8, 'pierre', DROCK if not burnt else (0.1, 0.09, 0.08), M=T_((0, 8.8, 0))))
    k.add('bois', box((1.0, 1.9, .3), 'bois', DWOOD, M=T_((0, .95, 2.2))))
    for i in range(3):
        a = i * 2.1 + .5
        k.add('window' if not burnt else 'metal', box((.4, .9, .2), 'window' if not burnt else 'metal', (1, 1, 1) if not burnt else (0.02, 0.02, 0.02), M=T_((np.cos(a) * 2.2, 5.5, np.sin(a) * 2.2), ry=-a + np.pi / 2)))
    if not burnt:
        k.add('tuile', cyl(3, .02, 2.4, 8, 'tuile', ROOF, M=T_((0, 9, 0)), caps=(True, False)))
    else:
        for i in range(6):
            a = i * 1.05
            k.add('pierre', box((.7, .9 + (i % 3) * .5, .5), 'pierre', (0.1, 0.09, 0.08), M=T_((np.cos(a) * 2.5, 9.3, np.sin(a) * 2.5), ry=-a + np.pi / 2)))
    return k, {}

def obelisk_base():
    rng = np.random.default_rng(6); k = Kit()
    for i in range(6):
        a = i * 1.05; s = .6
        k.add('glow', octa(1, 'glow', (0.49, 0.25, 0.75), M=T_((np.cos(a) * 3.5, 1.5, np.sin(a) * 3.5), ry=a) @ np.diag([s, 2 + rng.random(), s, 1])))
    k.add('pierre', cyl(2.2, 2.6, .5, 8, 'pierre', (0.2, 0.17, 0.25)))
    return k, {}

def obelisk_core():
    k = Kit()
    k.add('glow', octa(1, 'glow', (0.42, 0.18, 0.69), M=T_((0, 7, 0)) @ np.diag([1.5, 7, 1.5, 1])))
    return k, {}

def arch():
    k = Kit()
    for sx in (-1, 1):
        k.add('pierre', cyl(1.1, .9, 8, 12, 'pierre', MARBLE, M=T_((sx * 5, 0, 0))))
        k.add('pierre', box((2.4, .6, 2.4), 'pierre', MARBLE, M=T_((sx * 5, .3, 0))))
        k.add('pierre', box((2.0, .5, 2.0), 'pierre', MARBLE, M=T_((sx * 5, 8.2, 0))))
    k.add('metal', torus(5, .7, 24, 8, 'metal', GOLD, M=T_((0, 8, 0))) if False else None) if False else None
    # arc doré : demi-tore
    segs = 20; r = 5; tr = .7
    for i in range(segs):
        a0, a1 = np.pi * i / segs, np.pi * (i + 1) / segs
        am = (a0 + a1) / 2
        L = r * (a1 - a0) * 1.05
        k.add('metal', box((L, tr * 1.6, tr * 1.6), 'metal', GOLD, M=T_((np.cos(am) * r, 8 + np.sin(am) * r, 0), rz=am + np.pi / 2)))
    return k, {}

def fountain_astres():
    k = Kit()
    k.add('pierre', cyl(5, 4.5, .9, 16, 'pierre', MARBLE))
    k.add('water', cyl(3.8, 3.8, .4, 16, 'water', (0.43, 0.71, 0.88), M=T_((0, .75, 0))))
    k.add('pierre', cyl(.9, .6, 3, 10, 'pierre', MARBLE, M=T_((0, .4, 0))))
    k.add('pierre', cyl(.5, 1.3, .4, 12, 'pierre', MARBLE, M=T_((0, 3.0, 0))))
    k.add('pierre', torus(4.7, .25, 24, 6, 'pierre', MARBLE, M=T_((0, .92, 0))))
    return k, {}

def orb():
    k = Kit()
    k.add('glow', sphere(.8, 'glow', (1.0, 0.94, 0.69), seg=10, rings=7))
    return k, {}

def temple():
    rng = np.random.default_rng(7); k = Kit(); cols = []
    k.add('pierre', box((14, .8, 11), 'pierre', MARBLE, M=T_((0, .4, 0))))
    k.add('pierre', box((15, .3, 12), 'pierre', (0.8, 0.77, 0.7), M=T_((0, .15, 0))))
    for i in range(6):
        for sz in (-1, 1):
            if rng.random() < .2: continue
            h = 2.5 if rng.random() < .3 else 6.5
            x, z = -5.5 + i * 2.2, sz * 4.4
            cols.append([float(x), float(z), 0.8])
            k.add('pierre', cyl(.7, .6, h, 10, 'pierre', MARBLE, M=T_((x, .8, z))))
            k.add('pierre', box((1.5, .35, 1.5), 'pierre', MARBLE, M=T_((x, .98, z))))
            if h > 5: k.add('pierre', box((1.5, .4, 1.5), 'pierre', MARBLE, M=T_((x, .8 + h + .2, z))))
    k.add('metal', box((6, .5, 3), 'metal', GOLD, M=T_((0, 1.05, -2))))
    for sx in (-1, 1):
        k.add('pierre', box((1.4, .5, 5), 'pierre', (0.85, 0.82, 0.74), M=T_((sx * 3.2, 7.7, 4.4), rz=.0)))
    return k, {'colliders': cols}

def maw():
    rng = np.random.default_rng(8); k = Kit()
    k.add('glow', cyl(5, 5, .02, 18, 'glow', (1.0, 0.29, 0.08), M=T_((0, .12, 0)), caps=(True, True)))
    for x, z, a in ring_pos(12, 6.4):
        h = 3 + rng.random() * 5
        k.add('pierre', cyl(.9, 0.02, h, 5, 'pierre', (0.11, 0.09, 0.1), M=T_((x, 0, z), rz=0)))
    k.add('pierre', cyl(6.2, 6.8, .35, 18, 'pierre', (0.1, 0.08, 0.09), M=T_((0, 0, 0)), caps=(False, True)))
    return k, {'colliders': [[float(x), float(z), 0.8] for x, z, _ in ring_pos(12, 6.4)]}

def monolith_lm():
    k = Kit()
    k.add('pierre', box((3.2, 18, 1.6), 'pierre', (0.11, 0.1, 0.13), M=T_((0, 9, 0), ry=.3)))
    k.add('pierre', box((4.2, .8, 2.6), 'pierre', (0.2, 0.19, 0.22), M=T_((0, .4, 0), ry=.3)))
    return k, {}

def rune():
    k = Kit()
    k.add('glow', box((.5, 6, .1), 'glow', (1.0, 0.54, 0.23), M=T_((0, 0, 0))))
    return k, {}

def ring_lm():
    rng = np.random.default_rng(9); k = Kit(); cols = []
    for i in range(14):
        if i % 5 == 4: continue
        a = 2 * np.pi * i / 14; h = 3 + rng.random() * 4
        cols.append([float(np.cos(a) * 9), float(np.sin(a) * 9), 1.2])
        k.add('pierre', box((2.2, h, 1.2), 'pierre', (0.17, 0.15, 0.19), M=T_((np.cos(a) * 9, h / 2, np.sin(a) * 9), ry=-a)))
    # anneau lumineux au sol
    k.add('glow', cyl(8, 8, .02, 24, 'glow', (0.48, 0.23, 0.06), M=T_((0, .1, 0)), caps=(True, False)))
    return k, {'colliders': cols}

def border_gate():
    k = Kit()
    for sx in (-5.6, 5.6):
        k.add('pierre', box((1.8, 8, 1.8), 'pierre', (0.43, 0.42, 0.39), M=T_((sx, 4, 0))))
        k.add('pierre', box((2.4, .8, 2.4), 'pierre', (0.29, 0.29, 0.27), M=T_((sx, .4, 0))))
        k.add('pierre', box((2.4, .7, 2.4), 'pierre', (0.29, 0.29, 0.27), M=T_((sx, 8.2, 0))))
    k.add('pierre', box((13.4, 1.3, 1.9), 'pierre', (0.43, 0.42, 0.39), M=T_((0, 8.4, 0))))
    k.add('pierre', box((13.8, .3, 2.3), 'pierre', (0.29, 0.29, 0.27), M=T_((0, 9.2, 0))))
    return k, {}

def border_banner():
    k = Kit()
    k.add('cloth', quad(9.2, 2.6, 'cloth', (1, 1, 1), M=T_((0, 0, 0)), uv=1.0))
    return k, {}

# ------------------------------------------------------------------------------------------- ruines de la crypte
RUNE = (0.30, 0.85, 1.0)
def _runes(k, h):
    """Fines lignes lumineuses bleu-cyan incrustées dans la pierre (angles droits, comme des circuits runiques), des deux côtés du mur."""
    for sz in (1, -1):
        z = sz * .655
        k.add('glow', box((.07, h * .62, .03), 'glow', RUNE, M=T_((-.9, h * .5, z))))
        k.add('glow', box((1.0, .07, .03), 'glow', RUNE, M=T_((-.4, h * .81, z))))
        k.add('glow', box((.07, h * .3, .03), 'glow', RUNE, M=T_((.1, h * .66, z))))
        k.add('glow', box((.9, .07, .03), 'glow', RUNE, M=T_((.55, h * .51, z))))
        k.add('glow', box((.07, h * .24, .03), 'glow', RUNE, M=T_((1.0, h * .39, z))))

def ruin_wall(broken=False, mossy=False):
    k = Kit(); h = 1.8 if broken else 4.0
    c = (0.24, 0.29, 0.22) if mossy else (0.30, 0.30, 0.28)
    k.add('pierre', box((3.4, h, 1.3), 'pierre', c, M=T_((0, h / 2, 0))))
    if broken:
        k.add('pierre', box((1.0, .6, 1.3), 'pierre', c, M=T_((.8, h + .25, 0), rz=-.5)))
    else:
        k.add('pierre', box((3.6, .3, 1.5), 'pierre', (0.34, 0.34, 0.32), M=T_((0, h + .15, 0))))
    _runes(k, h)   # V10.79 : veines de runes lumineuses
    return k, {}

def ruin_rubble():
    k = Kit(); rng = np.random.default_rng(10)
    for i in range(3):
        k.add('pierre', octa(.9, 'pierre', (0.3, 0.3, 0.28), M=T_((rng.uniform(-.5, .5), .5, rng.uniform(-.5, .5)), ry=rng.random() * 3)))
    return k, {}

def ruin_pillar():
    k = Kit()
    k.add('pierre', cyl(.9, .7, 4.6, 8, 'pierre', (0.30, 0.30, 0.28)))
    k.add('pierre', box((1.6, .35, 1.6), 'pierre', (0.34, 0.34, 0.32), M=T_((0, 4.6, 0))))
    for a in (0, np.pi / 2, np.pi, 3 * np.pi / 2):   # V10.79 : rainure lumineuse sur chaque face
        k.add('glow', box((.06, 2.6, .04), 'glow', RUNE, M=T_((np.cos(a) * .8, 2.4, np.sin(a) * .8), ry=-a)))
    return k, {}

def pedestal():
    k = Kit()
    k.add('pierre', cyl(2.6, 2.2, 1, 10, 'pierre', (0.30, 0.30, 0.28)))
    k.add('pierre', cyl(2.0, 2.3, .15, 10, 'pierre', (0.36, 0.35, 0.33), M=T_((0, 1.0, 0))))
    k.add('glow', cyl(1.9, 1.9, .05, 24, 'glow', RUNE, M=T_((0, 1.16, 0)), caps=(False, False)))   # V10.79 : anneau lumineux
    return k, {}

# ------------------------------------------------------------------------------------------- portail, caravane, forge, monolithe
def portal_frame():
    k = Kit()
    k.add('pierre', cyl(1.8, 1.6, .4, 10, 'pierre', (0.42, 0.42, 0.45)))
    for sx in (-1, 1):
        k.add('pierre', cyl(.34, .28, 3.4, 8, 'pierre', (0.48, 0.48, 0.5), M=T_((sx * 1.25, .4, 0))))
        k.add('pierre', box((.8, .3, .8), 'pierre', (0.4, 0.4, 0.43), M=T_((sx * 1.25, .55, 0))))
    segs = 12; r = 1.25
    for i in range(segs):
        a0, a1 = np.pi * i / segs, np.pi * (i + 1) / segs; am = (a0 + a1) / 2
        k.add('pierre', box((r * (a1 - a0) * 1.08, .5, .55), 'pierre', (0.48, 0.48, 0.5), M=T_((np.cos(am) * r, 3.8 + np.sin(am) * r, 0), rz=am + np.pi / 2)))
    return k, {}

def wagon():
    k = Kit()
    k.add('bois', box((2.4, .7, 1.3), 'bois', (0.5, 0.35, 0.2), M=T_((0, .85, 0))))
    k.add('cloth', box((2.1, .95, 1.2), 'cloth', (0.85, 0.8, 0.66), M=T_((-.1, 1.55, 0))))
    k.add('bois', box((1.6, .1, .1), 'bois', WOOD, M=T_((2.0, .7, 0))))
    for sx in (-.8, .8):
        for sz in (-.7, .7):
            k.add('bois', cyl(.45, .45, .12, 12, 'bois', DWOOD, M=T_((sx, .45, sz), rx=np.pi / 2)))
            k.add('metal', cyl(.1, .1, .16, 6, 'metal', IRON, M=T_((sx, .45, sz), rx=np.pi / 2)))
    return k, {}

def forge_decor():
    k = Kit()
    k.add('bois', cyl(.4, .34, .7, 10, 'bois', (0.42, 0.29, 0.17), M=T_((1.5, 0, .2))))
    k.add('metal', box((.9, .22, .38), 'metal', IRON, M=T_((1.5, .82, .2))))
    k.add('metal', box((.5, .12, .3), 'metal', IRON, M=T_((1.5, .64, .2))))
    k.add('metal', cone(.16, .4, 8, 'metal', IRON, M=T_((2.2, .86, .2), rz=-np.pi / 2)))
    k.add('pierre', box((1.4, .85, 1.0), 'pierre', (0.42, 0.39, 0.35), M=T_((-.9, .42, 0))))
    k.add('pierre', box((.5, 1.7, .5), 'pierre', (0.42, 0.39, 0.35), M=T_((-1.25, 1.55, -.25))))
    for i in range(3):
        k.add('bois', cyl(.03, .03, 1.1, 5, 'bois', (0.42, 0.29, 0.17), M=T_((-.1 + i * .12, .0, -.55), rz=.15 - i * .12)))
        k.add('metal', box((.2, .12, .05), 'metal', IRON, M=T_((-.1 + i * .12 - .05 * (i - 1), 1.1, -.55))))
    return k, {}

def forge_coals():
    k = Kit()
    k.add('glow', box((1.1, .12, .7), 'glow', (1.0, 0.36, 0.08), M=T_((0, 0, 0))))
    return k, {}

def monolith_statue():
    k = Kit()
    k.add('pierre', cyl(1.8, 1.5, .35, 8, 'pierre', (0.35, 0.36, 0.42)))
    k.add('pierre', cyl(1.3, 1.1, .3, 8, 'pierre', (0.35, 0.36, 0.42), M=T_((0, .35, 0))))
    k.add('metal', box((.9, 2.5, .55), 'metal', (0.14, 0.14, 0.18), M=T_((0, 1.9, 0))))
    return k, {}

def monolith_runes():
    k = Kit()
    for i in range(6):
        k.add('glow', box((.32 if i % 2 else .2, .06, .02), 'glow', (0.56, 0.89, 1.0), M=T_((0 if i % 2 else -.12, 1.15 + i * .36, .285))))
    return k, {}

def monolith_crystal():
    k = Kit()
    k.add('glow', octa(.42, 'glow', (0.5, 0.85, 1.0), M=T_((0, 0, 0)) @ np.diag([.8, 1.3, .8, 1])))
    return k, {}

def monolith_ring(R=.65):
    k = Kit()
    k.add('glow', torus(R, .025, 24, 6, 'glow', (0.56, 0.89, 1.0)))
    return k, {}
