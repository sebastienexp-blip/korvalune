"""Boss du Royaume Céleste : le Séraphin Brisé (11 m). Armure d'or et d'ivoire fissurée de lumière, six ailes dont plusieurs rompues,
halo brisé, heaume sans visage à fente ardente, grande lame solaire et orbes de lumière en orbite."""
import numpy as np
from boss_geo import *
from boss_rig import *


def mats():
    return {
        'gold': mat('gold', T.metal(91, (.92, .72, .22), rust=(.6, .42, .1), rust_amt=.15, panels=4, rough=.25, glow=(1, .85, .4), relief=3.0), 'sr_gold', 1.0, emissive=True),
        'ivory': mat('ivory', T.stone(92, (.62, .60, .54), (.96, .94, .88), crack=(1, .8, .3), cells=40, rough=.4, relief=3.0), 'sr_ivory', 1.0, emissive=True, metal=0.0),
        'feather': mat('feather', T.scales(93, (.82, .80, .74), (1.0, .98, .92), edge=(.9, .7, .25), cells=60, rough=.6, metal=.1, relief=2.5), 'sr_feather', .8, metal=0.1, ds=True),
        'glow': mat('glow', T.skin(94, (1.0, .85, .35), (1.0, 1.0, .8), vein=(1, .9, .5), wet=False, relief=1.5, cells=60), 'sr_glow', 1.0, emissive=True, metal=0.0),
        'cloth': mat('cloth', T.fibers(95, (.78, .75, .68), (.96, .94, .88), weave=True, rough=.9, relief=2.5, dirt=.15, emis_col=(1, .85, .4)), 'sr_cloth', 1.0, ds=True, emissive=True, metal=0.0),
        'dark': mat('dark', T.stone(96, (.05, .045, .04), (.2, .17, .13), crack=(1, .8, .3), cells=60, rough=.6, relief=4.0), 'sr_dark', 1.0, emissive=True, metal=0.0),
    }


def feather(a, tip, w, thick=.025, n=7, tile=.5):
    a = np.asarray(a, float); tip = np.asarray(tip, float)
    path = smoothpath([a, (a + tip) / 2 + np.array([0, .12 * np.linalg.norm(tip - a) * .3, 0]), tip], n)
    ww = prof([(0, w * .25), (.25, w), (.7, w * .85), (.93, w * .45), (1, .01)], n)
    return Loft(path, np.full(n, thick), ww, p=2.3, segs=8, cap0=1, cap1=1, tile=tile, ref=(0, 0, 1)).mesh()


def build():
    R = Rig()
    biped_bones(R, hip=4.6, spine=5.4, chest=6.4, neck=(7.9, .1), head=(8.3, .2), sh=(1.7, 7.5, 0), el=(2.2, 5.7, .2), hand=(2.25, 3.8, .7),
                th=(.75, 4.5, 0), kn=(.8, 2.4, .2), an=(.8, .6, .1))
    wing_roots = {'U': (.7, 7.6, -.9), 'M': (.6, 6.8, -.95), 'D': (.5, 6.0, -.9)}
    wing_tips = {'U': (5.5, 12.0, -2.2), 'M': (6.4, 8.8, -2.6), 'D': (4.6, 5.0, -2.2)}
    for s, sd in ((1, 'L'), (-1, 'R')):
        for k, r_ in wing_roots.items():
            t = np.array(wing_tips[k]); r0 = np.array(r_)
            mid = (r0 + t) / 2
            R.bone(f'Wing{k}1_{sd}', 'Chest', (s * r0[0], r0[1], r0[2])); R.bone(f'Wing{k}2_{sd}', f'Wing{k}1_{sd}', (s * mid[0], mid[1], mid[2]))
    R.bone('Cape', 'Chest', (0, 7.4, -1.0)); R.bone('Halo', 'Head', (0, 8.6, -1.0))
    for i, p_ in enumerate(((2.0, 9.5, 1.4), (-3.0, 10.5, 1.0), (0.5, 12.0, 2.2))): R.bone(f'Orb{i + 1}', 'Chest', (p_[0], p_[1], p_[2]))
    RNG.seed(33)
    # ---------------------------------------------------------- jambes en armure
    def leg():
        o = {}
        o['cuisse'] = concat([box((.8, 3.6, .1), 1.3, 1.9, 1.3, tile=.9), plate((.8, 3.7, .7), 1.0, 1.6, th=.12, bend=.14, tile=.8)])
        o['genou'] = concat([ell((.8, 2.4, .5), .55, sq=(1, 1, .9), segs=14, n=9, tile=.7), cone((.8, 2.4, .85), (.8, 2.3, 1.6), .28, segs=6, n=5, tile=.4)])
        o['tibia'] = concat([box((.8, 1.45, .25), 1.2, 1.9, 1.15, tile=.9), plate((.8, 1.5, .85), .8, 1.5, th=.1, bend=.12, tile=.7)])
        o['pied'] = concat([box((.8, .3, .5), 1.1, .6, 1.9, tile=.8), cone((.8, .3, 1.4), (.8, .2, 2.0), .35, segs=6, ratio=1.3, n=4, tile=.4)])
        return o
    L = leg()
    R.add_sym('cuisse', L['cuisse'], 'gold', 'Thigh_L'); R.add_sym('genou', L['genou'], 'ivory', 'Shin_L'); R.add_sym('tibia', L['tibia'], 'gold', 'Shin_L'); R.add_sym('pied', L['pied'], 'ivory', 'Foot_L')
    R.add('bassin', box((0, 4.7, 0), 2.2, .9, 1.6, tile=.9), 'ivory', 'Hips')
    # tassettes + tabard
    for k in range(5):
        x = (k - 2) * .4
        R.add('tassette', plate((x, 3.9, .88 + .02 * abs(k - 2)), .42, 1.4, th=.07, bend=.1, rot=(.05, 0, 0), tile=.5), 'gold', 'Hips')
    R.add('tabard', Loft(smoothpath([(0, 4.7, .85), (0, 3.2, .98), (0, 1.5, .9)], 8), np.full(8, .02), prof([(0, .65), (1, .45)], 8), p=2.3, segs=8, cap1=1, tile=.8, ref=(0, 0, 1)).mesh(), 'cloth', 'Hips')
    # ---------------------------------------------------------- torse
    R.add('torse', box((0, 6.0, 0), 3.0, 2.4, 1.9, bevel=3.0, tile=1.2), 'gold', 'Chest')
    R.add('plastron', plate((0, 6.3, .94), 2.5, 2.1, th=.2, bend=.28, tile=1.0), 'ivory', 'Chest')
    R.add('fissure_c', ell((0, 6.2, 1.22), .5, sq=(.35, 1.5, .25), segs=10, n=8, tile=.4), 'glow', 'Chest')
    R.add('noyau', ell((0, 6.2, 1.28), .22, sq=(1, 1, .5), segs=10, n=7, tile=.3), 'glow', 'Chest')
    for k in range(5): R.add('lamelle', plate((0, 5.15 - k * .0, .95), 2.2, .3, th=.12, bend=.15, tile=.5), 'gold', 'Spine') if False else None
    for k in range(4): R.add('lamelle', plate((0, 5.35 - k * .26, .85), 2.2 - .15 * k, .28, th=.1, bend=.2, tile=.5), 'gold', 'Spine')
    R.add('gorgerin', box((0, 7.5, .1), 1.5, .7, 1.4, tile=.7), 'ivory', 'Neck')
    # cape de lumière
    for k in range(9):
        x0 = -1.2 + k * .3
        R.add('cape', Loft(smoothpath([(x0, 7.6, -1.0), (x0 * 1.1, 5.6, -1.35), (x0 * 1.2, 3.4, -1.5), (x0 * 1.25 + RNG.normal(0, .1), 2.2, -1.5)], 9), np.full(9, .012), prof([(0, .15), (.6, .14), (1, .03)], 9), p=2.2, segs=6, cap1=1, tile=.8, ref=(1, 0, 0)).mesh(), 'cloth', 'Cape')
    # ---------------------------------------------------------- épaules, bras
    def arm():
        o = {}
        sh = [ell((1.9, 7.6, 0), .95, sq=(1.1, .8, 1.05), segs=18, n=11, tile=1.0)]
        for k in range(4): sh.append(box((2.0 + .05 * k, 8.1 - k * .35, 0), 1.9 - .15 * k, .42, 1.8 - .1 * k, bevel=3.0, tile=.6, rot=(0, 0, -.2)))
        for k in range(3): sh.append(cone((2.1 + .45 * k, 8.3, -.2), (2.3 + .6 * k, 9.4 + .2 * k, -.4), .15, segs=5, n=4, tile=.3))
        o['sh'] = concat(sh)
        o['up'] = concat([box((2.0, 6.7, .1), 1.0, 2.0, 1.0, tile=.8)])
        o['el'] = concat([ell((2.2, 5.7, .2), .5, segs=12, n=8, tile=.6), cone((2.45, 5.8, .1), (3.1, 6.3, -.3), .18, segs=6, n=5, tile=.3)])
        o['fo'] = concat([box((2.25, 4.7, .45), 1.05, 2.0, 1.05, tile=.8), plate((2.25, 4.7, 1.0), .7, 1.6, th=.1, bend=.1, tile=.6)])
        return o
    A = arm()
    R.add_sym('epaule', A['sh'], 'ivory', 'Arm_L'); R.add_sym('bras', A['up'], 'gold', 'Arm_L'); R.add_sym('coude', A['el'], 'ivory', 'Fore_L'); R.add_sym('avantbras', A['fo'], 'gold', 'Fore_L')
    for s, sd in ((1, 'L'), (-1, 'R')):
        R.add('gantelet', concat([box((s * 2.25, 3.5, .7), .95, .8, .95, tile=.6)] + [rod([(s * 2.25 + dx, 3.3, .85), (s * 2.25 + dx, 2.95, 1.15)], .09, .07, segs=6, tile=.2, n=3) for dx in (-.3, -.1, .1, .3)]), 'ivory', f'Hand_{sd}')
    # grande lame solaire (main droite)
    hx = -2.25
    R.add('poignee', rod([(hx, 3.2, .7), (hx, 4.4, .7)], .13, .13, segs=8, tile=.3, n=4), 'dark', 'Hand_R')
    R.add('garde', box((hx, 4.6, .7), 2.2, .28, .28, tile=.4), 'gold', 'Hand_R')
    for s in (1, -1): R.add('garde_aile', cone((hx + s * 1.1, 4.6, .7), (hx + s * 1.9, 5.3, .7), .18, segs=6, n=5, tile=.3), 'gold', 'Hand_R')
    R.add('lame', Loft(smoothpath([(hx, 4.7, .7), (hx, 8.0, .7), (hx, 11.0, .7)], 10), prof([(0, .08), (.5, .1), (.95, .06), (1, .01)], 10), prof([(0, .5), (.6, .55), (.9, .4), (1, .02)], 10), p=2.4, segs=10, cap0=1, cap1=1, tile=.8, ref=(1, 0, 0)).mesh(), 'ivory', 'Hand_R')
    R.add('lame_coeur', Loft(smoothpath([(hx, 4.8, .7), (hx, 8.0, .7), (hx, 10.6, .7)], 10), prof([(0, .1), (.5, .12), (1, .05)], 10), prof([(0, .14), (.5, .16), (1, .02)], 10), p=2.4, segs=8, cap1=1, tile=.5, ref=(1, 0, 0)).mesh(), 'glow', 'Hand_R')
    R.add('pommeau', ell((hx, 3.1, .7), .25, segs=10, n=7, tile=.4), 'gold', 'Hand_R')
    # ---------------------------------------------------------- tête : heaume sans visage
    R.add('heaume', ell((0, 8.55, .2), .95, sq=(.82, 1.12, .95), segs=30, n=18, tile=.9), 'ivory', 'Head')
    R.add('fente', box((0, 8.6, 1.08), .1, 1.0, .15, tile=.3), 'glow', 'Head'); R.add('fente_h', box((0, 8.75, 1.08), .75, .1, .15, tile=.3), 'glow', 'Head')
    R.add('bandeau', band((0, 8.9, .2), 'y', .86, .2, .07, segs=30), 'gold', 'Head')
    for s in (1, -1):
        R.add('aile_heaume', concat([feather((s * .8, 8.8, .2), (s * 2.2, 9.8, -.2), .28)]), 'gold', 'Head')
        R.add('aile_heaume2', concat([feather((s * .8, 8.6, .2), (s * 1.9, 8.9, -.2), .22)]), 'gold', 'Head')
    for k in range(7):  # cimier de plumes
        R.add('cimier', feather((0, 9.4, -.1 - k * .12), (0, 10.4 + .3 * np.sin(k), -.9 - k * .2), .14), 'feather', 'Head')
    R.add('cou', box((0, 7.9, .1), .9, .5, .9, tile=.5), 'dark', 'Neck')
    # halo brisé : arcs
    for a0, a1 in ((.25, 2.3), (2.8, 4.6), (5.0, 6.1)):
        th = np.linspace(a0, a1, 22); pts = [(1.8 * np.cos(t), 8.7 + 1.8 * np.sin(t), -1.0) for t in th]
        R.add('halo', rod(pts, .1, .06, segs=8, tile=.3, n=22), 'glow', 'Halo')
    for k in range(5): R.add('halo_eclat', cone((1.8 * np.cos(.5 + k * 1.3), 8.7 + 1.8 * np.sin(.5 + k * 1.3), -1.0), (2.3 * np.cos(.5 + k * 1.3), 8.7 + 2.3 * np.sin(.5 + k * 1.3), -1.0), .07, segs=4, n=3, tile=.2), 'glow', 'Halo')
    # ---------------------------------------------------------- six ailes (certaines rompues)
    for s, sd in ((1, 'L'), (-1, 'R')):
        for k in ('U', 'M', 'D'):
            r0 = np.array(wing_roots[k]); t = np.array(wing_tips[k]); broken = (k == 'M' and sd == 'R') or (k == 'D' and sd == 'L')
            nf = 12 if not broken else 7
            main = rod([(s * r0[0], r0[1], r0[2]), (s * (r0[0] + t[0]) / 2, (r0[1] + t[1]) / 2 + .6, (r0[2] + t[2]) / 2), (s * t[0] * (.62 if broken else 1.0), t[1] * (1.0 if not broken else .85) + (0 if not broken else 0), t[2])], .16, .06, segs=8, tile=.4, n=12)
            R.add('aile_os', main, 'gold', f'Wing{k}1_{sd}')
            for j in range(nf):
                u = (j + .5) / nf; phi = np.deg2rad(70 - u * 125)
                base = np.array([s * (r0[0] + (t[0] - r0[0]) * (.25 + .55 * (1 - u))), r0[1] + (t[1] - r0[1]) * (.25 + .55 * (1 - u)) + .1, r0[2] - .0])
                ln = (4.6 - 1.2 * abs(u - .45)) * (.62 if broken else 1.0)
                d = unit(np.array([s * np.cos(phi), np.sin(phi), -.18]))
                R.add('plume', feather(base, base + d * ln, .75 - .25 * abs(u - .5), tile=.6), 'feather', f'Wing{k}1_{sd}' if u > .5 else f'Wing{k}2_{sd}')
            if broken:
                for j in range(4): R.add('lueur', cone((s * t[0] * .6, t[1] * .9, t[2]), (s * t[0] * (.7 + .08 * j), t[1] * (.95 + .06 * j), t[2] - .3), .09, segs=4, n=3, tile=.2), 'glow', f'Wing{k}2_{sd}')
    # orbes de lumière en orbite
    for i, (x, y, z) in enumerate(((2.0, 9.5, 1.4), (-3.0, 10.5, 1.0), (.5, 12.0, 2.2))):
        R.add('orbe', ell((x, y, z), .45, segs=14, n=9, tile=.4), 'glow', f'Orb{i + 1}')
        R.add('orbe_anneau', torus(.7, .04, axis='y', segs=20, rs=5), 'gold', f'Orb{i + 1}'); xf(R.parts[-1][1], t=(x, y, z), rx=.5 * i)
    return R, 12.0


def pose_fns():
    ex = []
    for k in ('U', 'M', 'D'):
        for sd, sg in (('L', 1.0), ('R', -1.0)):
            ex.append(([f'Wing{k}1_{sd}'], 'z', .22, 0, 1.0, sg, 0.0)); ex.append(([f'Wing{k}2_{sd}'], 'z', .25, 0, 1.0, sg, 0.0))
    ex.append((['Cape'], 'x', .1, 0, 1.0, 1.0, .1)); ex.append((['Halo'], 'z', .1, 0, .7, 1.0, 0)); ex.append((['Orb1'], 'y', .5, 0, .7, 1.0, 0)); ex.append((['Orb2'], 'y', .4, 0, .5, -1.0, 0)); ex.append((['Orb3'], 'y', .4, 0, .9, 1.0, 0))
    return biped_poses('cast', ex, arm=.25, leg=.4, bob=.1, lean=.03, drop=2.0)
