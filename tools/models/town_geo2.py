"""Remparts, tours, portes, donjon, étals, fontaine, établis, écurie, piliers de portails — modules GLB statiques de Korvalune (origine au sol)."""
import numpy as np
from kit import *
from town_geo import STONE, WOOD, DWOOD, IRON, BRASS, gable_poly

WALL = (0.70, 0.69, 0.64); KEEP = (0.77, 0.75, 0.70); DARK = (0.04, 0.04, 0.05)
BLUE = (0.30, 0.35, 0.66); RED = (0.36, 0.17, 0.15); PURPLE = (0.35, 0.16, 0.60); GOLD = (0.85, 0.68, 0.25)

def ring_merlons(k, radius, n, y, w=0.9, h=0.8, d=0.5, color=WALL):
    for i in range(n):
        a = 2 * np.pi * i / n
        k.add('pierre', box((w, h, d), 'pierre', color, M=T_((np.cos(a) * radius, y + h / 2, np.sin(a) * radius), ry=-a + np.pi / 2)))

def wall_segment(L=6.0, H=6.4, TH=2.0):
    k = Kit()
    k.add('pierre', box((L, H, TH), 'pierre', (0.96, 0.96, 0.96), ROLE_WALL, M=T_((0, H / 2, 0))))
    k.add('pierre', box((L, 0.9, TH + .35), 'pierre', (0.8, 0.8, 0.78), M=T_((0, .45, 0))))
    k.add('pierre', box((L, .35, TH + .4), 'pierre', STONE, M=T_((0, H - .17, 0))))
    for x in (-2.0, 0.0, 2.0):
        k.add('pierre', box((1.1, .9, TH + .15), 'pierre', (0.96, 0.96, 0.96), ROLE_WALL, M=T_((x, H + .45, 0))))
    for sz in (-1, 1):
        for x in (-1.5, 1.5):
            k.add('metal', box((.14, .95, .08), 'metal', DARK, M=T_((x, H * .56, sz * (TH / 2 + .02)))))
    return k, {'dims': [L, H, TH]}

def round_tower(r, h, rr, roof, windows=True, merl=10):
    k = Kit()
    k.add('pierre', cyl(r * 1.1, r, h, 14, 'pierre', WALL))
    k.add('pierre', cyl(r * 1.16, r * 1.16, .6, 14, 'pierre', STONE))
    k.add('pierre', cyl(r + .45, r + .45, .5, 14, 'pierre', STONE, M=T_((0, h - .05, 0))))
    ring_merlons(k, r + .35, merl, h + .45, .8, .5, .45, WALL)
    k.add('tuile', cyl(rr, 0.02, h * .38, 14, 'tuile', roof, M=T_((0, h + .45 + .4, 0)), caps=(True, False)))
    k.add('metal', cyl(.04, .04, 1.2, 4, 'metal', IRON, M=T_((0, h + .45 + .4 + h * .38 - .1, 0))))
    k.add('metal', sphere(.12, 'metal', BRASS, M=T_((0, h + .45 + .4 + h * .38 + 1.0, 0)), seg=6, rings=4))
    if windows:
        for i in range(4):
            a = i * np.pi / 2 + np.pi / 4
            for y, mat, sz in ((h * .62, 'window', (.5, 1.0, .2)), (h * .3, 'metal', (.16, .9, .12))):
                rad = r * (1 + .1 * (1 - y / h)) - 0.02
                k.add(mat, box(sz, mat, (1, 1, 1) if mat == 'window' else DARK, M=T_((np.cos(a) * rad, y, np.sin(a) * rad), ry=-a + np.pi / 2)))
    return k, {'height': h}

def square_tower():
    k = Kit()
    k.add('pierre', box((4.6, 9, 4.6), 'pierre', WALL, M=T_((0, 4.5, 0))))
    k.add('pierre', box((5.2, .5, 5.2), 'pierre', STONE, M=T_((0, 9.2, 0))))
    for sx in (-1, 1):
        for i in (-1.8, 0, 1.8):
            k.add('pierre', box((1.1, .8, .5), 'pierre', WALL, M=T_((i, 9.85, sx * 2.45))))
            k.add('pierre', box((.5, .8, 1.1), 'pierre', WALL, M=T_((sx * 2.45, 9.85, i))))
    for sz in (-1, 1):
        k.add('window', box((.5, 1.0, .15), 'window', (1, 1, 1), M=T_((0, 6.0, sz * 2.3))))
        k.add('window', box((.15, 1.0, .5), 'window', (1, 1, 1), M=T_((sz * 2.3, 6.0, 0))))
        k.add('metal', box((.16, 1.0, .1), 'metal', DARK, M=T_((1.2, 3.0, sz * 2.3))))
        k.add('metal', box((.1, 1.0, .16), 'metal', DARK, M=T_((sz * 2.3, 3.0, -1.2))))
    return k, {}

def banner(w, h, color=PURPLE, mat='cloth'):
    k = Kit()
    k.add('cloth', quad(w, h, 'cloth', color, M=T_((0, h / 2, 0)), uv=1.0))
    k.add('cloth', quad(w * .5, h * .35, 'cloth', GOLD, M=T_((0, h * .7, .01)), uv=1.0))
    k.add('cloth', gable_poly(w * 0.0 + 0.001, 0.001, 0.0, 'cloth', color, 1.0)) if False else None
    k.add('metal', box((w + .3, .1, .1), 'metal', IRON, M=T_((0, h, .02))))
    return k, {}

def gate_lintel(W, H, D):
    """Linteau au-dessus d'une porte : bloc de pierre avec corniche, claveaux et deux supports."""
    k = Kit()
    k.add('pierre', box((W, H, D), 'pierre', WALL, M=T_((0, H / 2, 0))))
    k.add('pierre', box((W + .5, .35, D + .5), 'pierre', STONE, M=T_((0, H + .17, 0))))
    k.add('pierre', box((W + .3, .3, D + .3), 'pierre', STONE, M=T_((0, .15, 0))))
    for i in range(-3, 4):
        k.add('pierre', box((.14, H - .6, .06), 'pierre', DARK if False else (0.5, 0.5, 0.48), M=T_((i * W / 7.5, H / 2, D / 2 + .02))))
        k.add('pierre', box((.14, H - .6, .06), 'pierre', (0.5, 0.5, 0.48), M=T_((i * W / 7.5, H / 2, -D / 2 - .02))))
    for x in np.linspace(-W / 2 + .6, W / 2 - .6, int(W / 1.6)):
        k.add('pierre', box((.9, .8, .5), 'pierre', WALL, M=T_((x, H + .35 + .4, 0))))
    return k, {'dims': [W, H, D]}

def keep():
    k = Kit(); kw, kd, kh = 18, 12, 21
    k.add('pierre', box((kw, kh, kd), 'pierre', KEEP, M=T_((0, kh / 2, 0))))
    k.add('pierre', box((kw + 1.2, .8, kd + 1.2), 'pierre', STONE, M=T_((0, kh + .4, 0))))
    k.add('pierre', box((kw + 1.2, .6, kd + 1.2), 'pierre', STONE, M=T_((0, 9.5, 0))))
    k.add('pierre', box((kw + .8, 1.0, kd + .8), 'pierre', (0.62, 0.61, 0.58), M=T_((0, .5, 0))))
    k.add('tuile', facet_pyramid(7.2 * 1.0, 11, 4, 'tuile', BLUE, M=T_((0, kh + .8, 0), ry=np.pi / 4)))
    k.add('metal', cyl(.06, .06, 2.4, 4, 'metal', IRON, M=T_((0, kh + .8 + 10.6, 0))))
    for sx in (-1, 1):
        for sz in (-1, 1):
            tx, tz = sx * (kw / 2 - .6), sz * (kd / 2 - .4)
            k.add('pierre', cyl(1.9, 1.7, kh + 5, 10, 'pierre', KEEP, M=T_((tx, 0, tz))))
            k.add('tuile', cyl(2.3, .02, 4.6, 10, 'tuile', BLUE, M=T_((tx, kh + 5, tz)), caps=(True, False)))
            k.add('metal', sphere(.14, 'metal', BRASS, M=T_((tx, kh + 5 + 4.7, tz)), seg=6, rings=4))
    fz = kd / 2
    k.add('bois', box((3.4, 5, .4), 'bois', DWOOD, M=T_((0, 2.5, fz + .1))))
    k.add('bois', halfdisc(1.7, 14, 'bois', DWOOD, M=T_((0, 5, fz + .31))))
    k.add('pierre', box((4.2, .3, .6), 'pierre', STONE, M=T_((0, .15, fz + .5))))
    for row in (0, 1, 2):
        for i in range(-3, 4):
            if row == 0 and abs(i) < 1: continue
            k.add('window', box((.9, 1.6, .15), 'window', (1, 1, 1), M=T_((i * 2.3, 4.2 + row * 5.2, fz + .06))))
            k.add('pierre', box((1.2, .18, .25), 'pierre', STONE, M=T_((i * 2.3, 4.2 + row * 5.2 - .88, fz + .12))))
    for sx in (-1, 1):
        k.add('cloth', quad(2.4, 8, 'cloth', PURPLE, M=T_((sx * 6.4, 13, fz + .2)), uv=1.0))
        k.add('cloth', quad(1.2, 2.6, 'cloth', GOLD, M=T_((sx * 6.4, 14.5, fz + .21)), uv=1.0))
    return k, {}

# ------------------------------------------------------------------------------------------- quartiers
def stall(ca, cb, goods):
    k = Kit()
    k.add('bois', box((3.6, 1.0, 1.3), 'bois', WOOD, M=T_((0, .5, 0))))
    k.add('bois', box((3.8, .12, 1.5), 'bois', DWOOD, M=T_((0, 1.04, 0))))
    for px in (-1.7, 1.7):
        k.add('bois', cyl(.07, .07, 3.0, 6, 'bois', WOOD, M=T_((px, 0, -.7))))
        k.add('bois', cyl(.06, .06, 2.3, 6, 'bois', WOOD, M=T_((px, 0, .7))))
    for i in range(6):
        k.add('cloth', box((.64, .08, 2.2), 'cloth', ca if i % 2 == 0 else cb, M=T_((-1.6 + i * .64, 2.75, 0), rx=-0.2)))
    k.add('bois', box((3.6, 1.7, .1), 'bois', DWOOD, M=T_((0, 1.9, -.72))))
    goods(k)
    return k, {}

def g_weapons(k):
    for i in range(4):
        k.add('metal', box((.1, 1.3, .04), 'metal', (0.73, 0.75, 0.8), M=T_((-1.2 + i * .7, 2.0, -.62), rz=0.12 * (i - 1.5))))
        k.add('metal', box((.34, .06, .06), 'metal', BRASS, M=T_((-1.2 + i * .7 + .0, 1.45, -.62))))
    k.add('metal', cyl(.4, .4, .05, 12, 'metal', (0.55, 0.38, 0.22), M=T_((1.3, 1.1, .1))))

def g_armors(k):
    for i in range(3):
        k.add('metal', cyl(.28, .22, .5, 8, 'metal', (0.54, 0.58, 0.64), M=T_((-1.0 + i * 1.0, 1.1, .05))))
        k.add('metal', sphere(.2, 'metal', (0.58, 0.62, 0.68), M=T_((-1.0 + i * 1.0, 1.72, .05)), seg=7, rings=4))
    k.add('metal', box((.9, .06, .5), 'metal', (0.5, 0.52, 0.58), M=T_((1.3, 1.1, .2), rz=.1)))

def g_potions(k):
    cs = [(0.88, 0.29, 0.29), (0.29, 0.54, 0.88), (0.42, 0.88, 0.29), (0.69, 0.29, 0.88)]
    for i in range(8):
        k.add('glow', cyl(.13, .1, .3, 7, 'glow', cs[i % 4], M=T_((-1.35 + (i % 4) * .9, 1.1 + (i // 4) * .0, -.15 + (i // 4) * .35))))

def g_fruit(k):
    cols = [(0.82, 0.23, 0.16), (0.88, 0.63, 0.12), (0.42, 0.66, 0.19)]
    for c in range(3):
        k.add('bois', box((.9, .25, .55), 'bois', WOOD, M=T_((-1.1 + c * 1.1, 1.22, 0))))
        for j in range(6):
            k.add('metal', sphere(.13, 'metal', cols[c], M=T_((-1.1 + c * 1.1 - .3 + (j % 3) * .3, 1.42, -.12 + (j // 3) * .25)), seg=6, rings=4))

def g_cloth(k):
    cs = [(0.75, 0.29, 0.42), (0.29, 0.42, 0.75), (0.82, 0.63, 0.19), (0.29, 0.63, 0.44)]
    for i in range(4):
        k.add('cloth', box((.75, .22, .55), 'cloth', cs[i], M=T_((-1.2 + i * .8, 1.2 + (i % 2) * .22, 0))))

def g_curios(k):
    k.add('glow', sphere(.26, 'glow', (0.56, 0.82, 1.0), M=T_((-.9, 1.45, 0)), seg=10, rings=7))
    k.add('glow', octa(.3, 'glow', (0.85, 0.7, 1.0), M=T_((0, 1.5, 0)), sy=1.5))
    k.add('metal', box((.5, .35, .4), 'metal', BRASS, M=T_((.9, 1.22, 0))))
    k.add('metal', cyl(.12, .12, .3, 6, 'metal', (0.6, 0.55, 0.62), M=T_((1.35, 1.1, .1))))

def fountain():
    k = Kit()
    k.add('pierre', cyl(3.5, 3.2, .7, 20, 'pierre', STONE))
    k.add('water', cyl(2.7, 2.7, .05, 20, 'water', (1, 1, 1), M=T_((0, .68, 0))))
    k.add('pierre', cyl(.6, .45, 2.2, 10, 'pierre', STONE, M=T_((0, .3, 0))))
    k.add('pierre', cyl(.5, 1.2, .4, 14, 'pierre', STONE, M=T_((0, 2.3, 0))))
    k.add('pierre', torus(3.35, .22, 24, 6, 'pierre', STONE, M=T_((0, .72, 0))))
    k.add('glow', sphere(.35, 'glow', (0.56, 0.85, 1.0), M=T_((0, 3.0, 0)), seg=10, rings=7))
    return k, {}

def bench(kind):
    k = Kit()
    k.add('bois', box((3, .16, 1.3), 'bois', DWOOD, M=T_((0, 1.0, 0))))
    for sx in (-1.3, 1.3):
        for sz in (-.5, .5):
            k.add('bois', box((.16, 1.0, .16), 'bois', WOOD, M=T_((sx, .5, sz))))
    k.add('bois', box((2.8, .1, 1.0), 'bois', WOOD, M=T_((0, .35, 0))))
    if kind == 'forge':
        k.add('metal', box((.9, .22, .4), 'metal', IRON, M=T_((-.7, 1.2, 0))))
        k.add('metal', box((.5, .2, .3), 'metal', IRON, M=T_((-.7, 1.05, 0))))
        k.add('metal', box((.9, .08, .14), 'metal', IRON, M=T_((.6, 1.14, .1), ry=.5)))
        for i in range(3):
            k.add('bois', cyl(.03, .03, .9, 5, 'bois', WOOD, M=T_((.9 + i * .12, 1.05, -.55), rz=.2)))
    elif kind == 'alchimie':
        cs = [(0.88, 0.29, 0.29), (0.29, 0.54, 0.88), (0.42, 0.88, 0.29)]
        for i, c in enumerate(cs):
            k.add('glow', sphere(.2, 'glow', c, M=T_((-.9 + i * .7, 1.28, .05)), seg=8, rings=5))
        k.add('metal', cyl(.38, .3, .35, 10, 'metal', IRON, M=T_((1.0, 1.08, .1))))
    elif kind == 'enchant':
        k.add('glow', cyl(.9, .9, .05, 20, 'glow', (0.54, 0.42, 1.0), M=T_((0, 1.08, 0))))
        k.add('glow', octa(.34, 'glow', (0.85, 0.78, 1.0), M=T_((0, 1.9, 0)), sy=1.5))
    else:
        k.add('bois', cyl(.34, .28, 1.0, 8, 'bois', WOOD, M=T_((-.9, 1.1, -.1))))
        k.add('metal', sphere(.28, 'metal', (0.54, 0.58, 0.64), M=T_((-.9, 2.3, -.1)), seg=8, rings=5))
        k.add('metal', box((.8, .2, .4), 'metal', IRON, M=T_((.7, 1.2, 0))))
    return k, {}

def monolith_circle():
    k = Kit()
    k.add('pierre', torus(6.5, .28, 36, 6, 'pierre', STONE, M=T_((0, .14, 0))))
    for i in range(4):
        a = i * np.pi / 2 + np.pi / 4; px, pz = np.cos(a) * 6.5, np.sin(a) * 6.5
        k.add('pierre', cyl(.45, .35, 2.4, 8, 'pierre', STONE, M=T_((px, 0, pz))))
        k.add('pierre', cyl(.5, .5, .15, 8, 'pierre', STONE, M=T_((px, 2.4, pz))))
        k.add('glow', octa(.4, 'glow', (0.56, 0.89, 1.0), M=T_((px, 3.0, pz)), sy=1.4))
    return k, {}

def stable_shed():
    k = Kit()
    for px in (-5, 5):
        for pz in (-3.5, 3.5):
            k.add('bois', cyl(.26, .22, 4.2, 7, 'bois', WOOD, M=T_((px, 0, pz))))
    k.add('tuile', box((12, .3, 9), 'tuile', (0.42, 0.23, 0.17), M=T_((0, 4.5, 0), rx=.12)))
    k.add('bois', box((12.4, .2, .3), 'bois', DWOOD, M=T_((0, 4.28, 4.45))))
    k.add('bois', box((11, .4, .6), 'bois', DWOOD, M=T_((0, .5, -3.4))))
    k.add('bois', box((11, .12, .12), 'bois', DWOOD, M=T_((0, 3.6, -3.5))))
    for x in (-3.5, 0, 3.5):
        k.add('bois', box((.14, 3.2, .14), 'bois', WOOD, M=T_((x, .7, -3.45))))
    return k, {}

def fence_span():
    k = Kit()
    for x in (0.0, 2.5):
        k.add('bois', box((.18, 1.3, .18), 'bois', WOOD, M=T_((x, .65, 0))))
    for y in (.5, 1.05):
        k.add('bois', box((2.5, .1, .1), 'bois', WOOD, M=T_((1.25, y, 0))))
    return k, {'span': 2.5}

def trough():
    k = Kit()
    k.add('bois', box((2.4, .5, .6), 'bois', DWOOD, M=T_((0, .25, 0))))
    k.add('water', box((2.1, .02, .36), 'water', (1, 1, 1), M=T_((0, .5, 0))))
    return k, {}

def portal_gate():
    """Deux piliers monumentaux reliés par un linteau, cristaux violets (origine : milieu, z du pilier)."""
    k = Kit()
    for s in (-1, 1):
        x = s * 8
        k.add('pierre', cyl(1.25, 1.0, 11, 10, 'pierre', STONE, M=T_((x, 0, 0))))
        k.add('pierre', cyl(1.4, 1.4, .6, 10, 'pierre', STONE, M=T_((x, 10.9, 0))))
        k.add('pierre', box((2.9, .6, 2.9), 'pierre', STONE, M=T_((x, .3, 0))))
        k.add('glow', octa(.8, 'glow', (0.64, 0.30, 1.0), M=T_((x, 12.6, 0)), sy=1.5))
    k.add('pierre', box((18, 1.4, 2.2), 'pierre', STONE, M=T_((0, 11.6, 0))))
    return k, {}

def torchere():
    k = Kit()
    k.add('pierre', cyl(.65, .5, 1.6, 8, 'pierre', STONE))
    k.add('pierre', cyl(.7, .7, .12, 8, 'pierre', STONE, M=T_((0, 1.6, 0))))
    k.add('glow', octa(.45, 'glow', (0.64, 0.30, 1.0), M=T_((0, 2.1, 0)), sy=1.4))
    return k, {}
