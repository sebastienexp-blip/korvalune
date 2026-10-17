"""Boss des Abysses Oubliées : le Seigneur de Braise (13 m). Colosse de basalte fendu de lave, cornes de bélier et de crâne, crinière de flammes,
ailes de chauve-souris membraneuses, épaulières d'obsidienne hérissées, queue barbelée et grande hache de forge fondue."""
import numpy as np
from boss_geo import *
from boss_rig import *


def mats():
    return {
        'rock': mat('rock', T.stone(101, (.05, .035, .035), (.22, .15, .13), crack=(1, .32, .04), cells=70, rough=.75, relief=8.0), 'em_rock', 1.6, emissive=True, metal=0.0),
        'lava': mat('lava', T.stone(102, (.6, .15, .02), (1.0, .6, .1), crack=(1, .7, .2), cells=45, rough=.4, relief=4.0), 'em_lava', 1.0, emissive=True, metal=0.0),
        'horn': mat('horn', T.stone(103, (.12, .06, .05), (.45, .30, .22), cells=30, rough=.45, relief=5.0, crack=(1, .35, .05)), 'em_horn', 1.2, emissive=True, metal=0.0),
        'membrane': mat('membrane', T.skin(104, (.16, .03, .03), (.42, .1, .06), vein=(1, .38, .08), wet=False, relief=2.5, cells=150), 'em_mem', 1.0, emissive=True, ds=True, metal=0.0),
        'obsidian': mat('obsidian', T.metal(105, (.07, .06, .08), rust=(.4, .15, .05), rust_amt=.2, panels=3, rough=.2, glow=(1, .3, .05), relief=4.0, rivets=False), 'em_obs', 1.0, emissive=True),
        'bone': mat('bone', T.stone(106, (.4, .35, .28), (.78, .72, .6), cells=40, rough=.55, relief=4.0), 'em_bone', 1.0, metal=0.0),
        'flame': mat('flame', T.skin(107, (1.0, .35, .02), (1.0, .8, .2), vein=(1, .8, .3), wet=False, relief=1.0, cells=50), 'em_flame', 1.0, emissive=True, metal=0.0),
        'steel': mat('steel', T.metal(108, (.28, .27, .3), rust=(.35, .15, .05), rust_amt=.35, panels=3, rough=.45, glow=(1, .45, .1), relief=4.0), 'em_steel', 1.0, ds=True),
    }


def build():
    R = Rig()
    biped_bones(R, hip=5.2, spine=6.1, chest=7.3, neck=(8.8, .3), head=(9.2, .45), sh=(2.2, 8.5, 0), el=(2.8, 6.4, .3), hand=(2.85, 4.1, .9),
                th=(1.05, 5.0, 0), kn=(1.1, 2.75, .35), an=(1.1, .7, .1))
    for i, p_ in enumerate(((0, 5.0, -1.2), (0, 4.0, -2.4), (0, 3.0, -3.8), (0, 2.2, -5.2))): R.bone(f'Tail{i + 1}', 'Hips' if i == 0 else f'Tail{i}', p_)
    for s, sd in ((1, 'L'), (-1, 'R')):
        R.bone(f'WingA_{sd}', 'Chest', (s * 1.0, 8.5, -1.2)); R.bone(f'WingB_{sd}', f'WingA_{sd}', (s * 4.2, 11.2, -2.0)); R.bone(f'WingC_{sd}', f'WingB_{sd}', (s * 8.2, 12.2, -3.0))
    R.bone('Mane', 'Head', (0, 9.8, -.5))
    RNG.seed(77)
    # ---------------------------------------------------------- jambes : sabots, genoux piquants
    def leg():
        o = {}
        o['cuisse'] = concat([rod([(1.1, 5.4, 0), (1.15, 4.0, .2), (1.1, 2.8, .35)], 1.25, .85, segs=18, tile=1.4, ref=(0, 0, 1), prof_k=[(0, 1.15), (.3, 1.25), (1, .85)]),
                               ell((1.45, 4.5, .25), .8, sq=(.9, 1.3, 1.0), segs=14, n=9, tile=.9)])
        o['genou'] = concat([ell((1.1, 2.75, .5), .8, sq=(1, 1, 1), segs=16, n=10, tile=.9), cone((1.1, 2.75, 1.1), (1.1, 2.55, 2.1), .4, segs=8, n=6, tile=.5, curve=.3)])
        o['tibia'] = concat([rod([(1.1, 2.7, .35), (1.15, 1.7, .0), (1.1, .9, .15)], .85, .62, segs=16, tile=1.2, ref=(0, 0, 1)), plate((1.1, 1.8, .85), 1.0, 1.6, th=.12, bend=.15, tile=.8)])
        ft = [ell((1.1, .5, .55), .75, sq=(.85, .6, 1.5), segs=18, n=10, tile=.9)]
        for dx in (-.4, 0, .4): ft.append(cone((1.1 + dx, .35, 1.5), (1.1 + dx * 1.2, .08, 2.3), .26, segs=7, n=5, tile=.4, curve=.3))
        ft.append(cone((1.1, .5, -.5), (1.1, .15, -1.1), .22, segs=6, n=4, tile=.3))
        o['pied'] = concat(ft)
        return o
    L = leg()
    R.add_sym('cuisse', L['cuisse'], 'rock', 'Thigh_L'); R.add_sym('genou', L['genou'], 'obsidian', 'Shin_L'); R.add_sym('tibia', L['tibia'], 'rock', 'Shin_L'); R.add_sym('pied', L['pied'], 'horn', 'Foot_L')
    # bassin / pagne de chaînes
    R.add('bassin', ell((0, 5.2, 0), 1.7, sq=(1.15, .62, .9), segs=26, n=12, tile=1.5), 'rock', 'Hips')
    R.add('ceinture', torus(1.75, .22, axis='y', segs=36, rs=8), 'steel', 'Hips'); xf(R.parts[-1][1], t=(0, 5.65, 0), s=(1.05, 1, .85))
    R.add('crane_ceinture', ell((0, 5.5, 1.5), .5, sq=(.9, 1.0, .8), segs=14, n=9, tile=.5), 'bone', 'Hips')
    for s in (1, -1): R.add('orbite_ceinture', ell((s * .2, 5.55, 1.85), .13, segs=7, n=5, tile=.2), 'flame', 'Hips')
    for k in range(9):
        a = -PI * .5 + k * PI / 8
        R.add('chaine_pagne', rod([(1.9 * np.sin(a), 5.4, 1.5 * np.cos(a) - .1), (2.0 * np.sin(a), 4.2, 1.55 * np.cos(a) + .1), (2.05 * np.sin(a), 3.4, 1.6 * np.cos(a))], .09, .05, segs=6, tile=.3, n=8), 'steel', 'Hips')
    # ---------------------------------------------------------- torse
    n = 12; y = np.linspace(5.8, 8.6, n); path = np.stack([np.zeros(n), y, np.zeros(n)], 1)
    rf = prof([(0, 1.3), (.3, 1.6), (.65, 2.0), (1, 1.5)], n); rs = prof([(0, 1.7), (.3, 2.1), (.65, 2.7), (1, 2.1)], n)
    R.add('torse', Loft(path, rf, rs, p=2.4, segs=44, cap0=1, cap1=1, tile=1.8, ref=(0, 0, 1)).mesh(), 'rock', 'Chest')
    for k in range(5):
        for s in (1, -1):
            R.add('abdo', ell((s * .6, 5.9 + k * .0, 1.5), .5, sq=(1, .5, .45), segs=10, n=6, tile=.5), 'rock', 'Spine') if False else None
    R.add('coeur', ell((0, 7.4, 1.5), .95, sq=(1.0, 1.3, .45), segs=22, n=12, tile=.7), 'lava', 'Chest')
    for k in range(8):
        a = k / 8 * 2 * PI
        R.add('coeur_pic', cone((1.0 * np.cos(a), 7.4 + 1.25 * np.sin(a), 1.55), (1.45 * np.cos(a), 7.4 + 1.9 * np.sin(a), 1.7), .13, segs=5, n=4, tile=.3), 'obsidian', 'Chest')
    for k in range(6):
        for s in (1, -1):
            R.add('cote', rod([(s * .3, 6.0 + k * .45, 1.5), (s * 1.6, 6.15 + k * .45, 1.7), (s * 2.5, 6.2 + k * .45, .6)], .2, .12, segs=8, tile=.5, n=10), 'bone', 'Chest') if False else None
    for k in range(5):
        for s in (1, -1):
            R.add('pec_plaque', plate((s * (.85 + .0), 6.2 + k * .0 + (k - 2) * .0, 1.5), 1.0, .5, th=.25, bend=.1, tile=.5), 'rock', 'Chest') if False else None
    for s in (1, -1):
        R.add('pectoral', ell((s * 1.1, 7.8, 1.2), 1.0, sq=(1.1, .8, .8), segs=18, n=10, tile=.9), 'rock', 'Chest')
        for k in range(3): R.add('pic_dos', cone((s * (.5 + k * .55), 7.0 + k * .5, -1.8), (s * (.7 + k * .7), 8.2 + k * .8, -2.9), .26, segs=6, n=5, tile=.4, curve=.3), 'obsidian', 'Chest')
    for k in range(7):
        R.add('colonne_pic', cone((0, 6.0 + k * .45, -1.5 - .04 * k), (0, 6.9 + k * .45 + .4, -2.4 - .1 * k), .3 - .02 * k, segs=6, n=5, tile=.4, curve=.2), 'obsidian', 'Chest')
    # ---------------------------------------------------------- épaulières et bras
    def arm():
        o = {}
        sh = [ell((2.4, 8.5, 0), 1.35, sq=(1.1, .85, 1.1), segs=20, n=12, tile=1.2)]
        for k in range(4): sh.append(box((2.6 + .1 * k, 9.2 - k * .45, 0), 2.4 - .22 * k, .5, 2.4 - .18 * k, bevel=3.0, tile=.8, rot=(0, 0, -.25)))
        for k in range(4): sh.append(cone((2.5 + .6 * k, 9.4 - .15 * k, -.4 + .35 * k), (2.7 + .9 * k, 11.2 + .3 * k, -.5 + .5 * k), .26, segs=6, n=6, tile=.4, curve=.3))
        o['sh'] = concat(sh)
        o['up'] = concat([rod([(2.3, 8.3, 0), (2.55, 7.4, .15), (2.8, 6.4, .3)], 1.0, .8, segs=16, tile=1.2, ref=(0, 0, 1)), ell((2.7, 7.4, .5), .7, sq=(1, 1.3, .9), segs=12, n=8, tile=.8)])
        o['el'] = concat([ell((2.8, 6.4, .3), .8, segs=14, n=9, tile=.8), cone((3.2, 6.5, .2), (4.3, 7.1, -.4), .32, segs=7, n=6, tile=.4, curve=.3)])
        o['fo'] = concat([rod([(2.8, 6.3, .3), (2.85, 5.2, .6), (2.85, 4.2, .9)], .8, .6, segs=16, tile=1.1, ref=(0, 0, 1)), box((2.85, 4.9, 1.0), 1.1, 1.8, 1.1, tile=.8, bevel=3.0)])
        return o
    A = arm()
    R.add_sym('epaule', A['sh'], 'obsidian', 'Arm_L'); R.add_sym('bras', A['up'], 'rock', 'Arm_L'); R.add_sym('coude', A['el'], 'obsidian', 'Fore_L'); R.add_sym('avantbras', A['fo'], 'rock', 'Fore_L')
    R.add_sym('bracelet', concat([band((2.85, 4.4, .9), 'y', .72, .5, .09), band((2.85, 5.4, .8), 'y', .78, .3, .08)]), 'steel', 'Fore_L')

    def claws(s, closed=False):
        g = [ell((s * 2.85, 3.75, .95), .65, sq=(1, 1.1, 1), segs=14, n=9, tile=.7)]
        for dx in (-.4, -.14, .14, .4):
            g.append(rod([(s * 2.85 + dx, 3.4, 1.1), (s * 2.85 + dx * 1.2, 2.7, 1.6), (s * 2.85 + dx * 1.3, 2.2, 1.8)], .17, .05, segs=7, tile=.3, n=8))
        g.append(rod([(s * 3.4, 3.8, 1.0), (s * 3.9, 3.2, 1.5), (s * 4.0, 2.7, 1.6)], .16, .05, segs=7, tile=.3, n=8))
        return concat(g)
    R.add('griffes_g', claws(1), 'horn', 'Hand_L')
    R.add('poing_d', claws(-1), 'horn', 'Hand_R')
    # grande hache de forge (main droite)
    hx = -2.85
    R.add('manche', rod([(hx, .6, 1.0), (hx, 3.0, 1.0), (hx, 6.0, 1.05), (hx, 9.2, 1.1)], .2, .17, segs=10, tile=.5, n=18, ref=(0, 0, 1)), 'steel', 'Hand_R')
    for y in (1.0, 2.6, 4.0): R.add('manche_bande', band((hx, y, 1.0), 'y', .22, .35, .06), 'obsidian', 'Hand_R')
    R.add('hache_collet', box((hx, 9.0, 1.1), .6, 1.0, .6, tile=.5), 'obsidian', 'Hand_R')
    for s in (1, -1):
        blade = Loft(smoothpath([(hx, 9.2, 1.1), (hx + s * 1.5, 9.8, 1.1), (hx + s * 2.7, 10.8, 1.1), (hx + s * 3.2, 8.2, 1.1)], 14), np.full(14, .1), prof([(0, .5), (.3, 1.3), (.7, 1.45), (1, .08)], 14), p=2.6, segs=12, cap0=1, cap1=1, tile=.8, ref=(0, 0, 1)).mesh()
        R.add('lame', blade, 'steel', 'Hand_R')
        edge = Loft(smoothpath([(hx + s * 1.5, 9.8, 1.1), (hx + s * 2.7, 10.8, 1.1), (hx + s * 3.2, 8.2, 1.1)], 12), np.full(12, .14), prof([(0, .15), (.5, .18), (1, .04)], 12), p=2.6, segs=8, tile=.5, ref=(0, 0, 1), os_=prof([(0, .75), (1, .5)], 12) * s * 0.0).mesh()
        R.add('tranchant', edge, 'lava', 'Hand_R')
        for k in range(4): R.add('dent_lame', cone((hx + s * (2.2 + .3 * k), 10.4 - k * .55, 1.1), (hx + s * (2.9 + .3 * k), 10.7 - k * .6, 1.1), .12, segs=5, n=3, tile=.2), 'obsidian', 'Hand_R')
    R.add('pointe_hache', cone((hx, 9.8, 1.1), (hx, 11.6, 1.1), .3, segs=6, n=6, tile=.4), 'steel', 'Hand_R')
    R.add('pommeau_hache', ell((hx, .45, 1.0), .35, segs=10, n=7, tile=.4), 'obsidian', 'Hand_R')
    # ---------------------------------------------------------- queue barbelée
    tp = [(0, 5.0, -1.2), (0, 4.0, -2.4), (0, 3.0, -3.8), (0, 2.2, -5.2)]
    for i in range(4):
        a = np.array(tp[i]); b = np.array(tp[i + 1]) if i < 3 else np.array([0, 1.6, -6.7])
        R.add(f'queue{i}', rod([a, (a + b) / 2, b], .75 - .13 * i, .62 - .13 * i, segs=12, tile=.8, n=6, ref=(1, 0, 0)), 'rock', f'Tail{i + 1}')
        for s_ in (1, -1): R.add(f'queue_pic{i}', cone((a + b) / 2 + np.array([s_ * .5, .5, 0]), (a + b) / 2 + np.array([s_ * 1.1, 1.3, -.3]), .2, segs=5, n=4, tile=.3), 'obsidian', f'Tail{i + 1}')
    R.add('queue_pointe', cone((0, 1.7, -6.5), (0, 1.0, -8.2), .42, segs=8, n=7, tile=.4, curve=.3), 'obsidian', 'Tail4')
    R.add('queue_flamme', ell((0, 1.9, -6.6), .55, sq=(1, 1, 1.4), segs=12, n=8, tile=.4), 'flame', 'Tail4')
    # ---------------------------------------------------------- tête : crâne cornu, crinière de flammes
    R.add('cou', rod([(0, 8.5, .2), (0, 9.0, .4)], 1.0, .85, segs=14, tile=.8, ref=(0, 0, 1)), 'rock', 'Neck')
    R.add('crane', ell((0, 9.6, .5), 1.25, sq=(.95, 1.0, 1.1), segs=32, n=18, tile=1.2), 'rock', 'Head')
    R.add('arcade', rod([(-1.1, 9.95, 1.0), (0, 10.05, 1.5), (1.1, 9.95, 1.0)], .26, .26, segs=10, tile=.5, n=14), 'rock', 'Head')
    R.add('museau', ell((0, 9.0, 1.45), .9, sq=(.9, .6, 1.0), segs=20, n=11, tile=.8), 'rock', 'Head')
    mach = ell((0, 8.3, 1.2), 1.05, sq=(.95, .38, 1.05), segs=24, n=10, tile=.9)
    R.add('machoire', mach, 'rock', 'Head')
    R.add('bouche_lave', ell((0, 8.75, 1.35), .85, sq=(1.0, .1, 1.0), segs=20, n=6, tile=.5), 'lava', 'Head')
    for i, a in enumerate(np.linspace(-1.2, 1.2, 9)):
        x = 1.0 * np.sin(a); z = 1.35 + .85 * np.cos(a)
        R.add('dent_h', cone((x, 8.75, z), (x, 8.2 - .15 * (i % 2), z + .1), .1, segs=5, n=4, tile=.2), 'bone', 'Head')
        R.add('dent_b', cone((x * 1.0, 8.5, z), (x, 9.0 + .1 * (i % 2), z + .1), .09, segs=5, n=4, tile=.2), 'bone', 'Head')
    for s in (1, -1):
        R.add('croc', cone((s * .65, 8.5, 2.05), (s * .7, 9.6, 2.3), .22, segs=6, n=6, tile=.3, curve=.3), 'bone', 'Head')
        R.add('oeil', ell((s * .55, 9.8, 1.5), .22, sq=(1.3, .6, .6), segs=10, n=7, tile=.3), 'flame', 'Head')
        R.add('orbite', ell((s * .55, 9.85, 1.42), .35, sq=(1.3, .8, .6), segs=10, n=7, tile=.4), 'obsidian', 'Head')
        R.add('narine', ell((s * .22, 9.1, 2.35), .1, segs=6, n=5, tile=.2), 'lava', 'Head')
        # cornes de bélier + cornes dressées
        R.add('corne_belier', rod([(s * 1.0, 10.0, .2), (s * 2.3, 10.5, -.2), (s * 2.9, 9.4, .6), (s * 2.2, 8.7, 1.4)], .42, .06, segs=10, tile=.7, n=22, prof_k=[(0, .46), (.5, .35), (1, .05)]), 'horn', 'Head')
        for t in (.2, .4, .6): pass
        R.add('corne_haute', rod([(s * .6, 10.7, -.2), (s * 1.2, 12.4, -.8), (s * 1.0, 14.0, -.9)], .32, .05, segs=9, tile=.6, n=16), 'horn', 'Head')
        R.add('oreille_pic', cone((s * 1.25, 9.6, .0), (s * 2.6, 9.9, -.6), .2, segs=5, n=5, tile=.3), 'horn', 'Head')
    # crinière de flammes
    for k in range(16):
        a = -1.3 + k * .17
        R.add('flamme', cone((np.sin(a) * .9, 10.2 + .3 * np.cos(a), -.3), (np.sin(a) * 1.7, 11.4 + 1.0 * np.cos(a * 2) + .8, -1.9 - .3 * abs(np.sin(a))), .38, segs=6, n=6, tile=.4, curve=.4, bow=(0, .4, -.2)), 'flame', 'Mane')
    # ---------------------------------------------------------- ailes de chauve-souris
    for s, sd in ((1, 'L'), (-1, 'R')):
        sh0 = np.array([s * 1.0, 8.5, -1.2]); el = np.array([s * 4.2, 11.2, -2.0]); wr = np.array([s * 8.2, 12.2, -3.0])
        R.add('aile_bras', rod([sh0, el], .5, .38, segs=10, tile=.5, n=8), 'rock', f'WingA_{sd}')
        R.add('aile_epaule', ell(sh0, .7, segs=12, n=8, tile=.6), 'rock', f'WingA_{sd}')
        R.add('aile_avantbras', rod([el, wr], .38, .26, segs=10, tile=.5, n=8), 'rock', f'WingB_{sd}')
        R.add('aile_poignet', ell(wr, .4, segs=10, n=7, tile=.4), 'obsidian', f'WingB_{sd}')
        R.add('aile_pouce', cone(wr + np.array([0, .1, 0]), wr + np.array([s * .2, 1.3, .5]), .15, segs=6, n=5, tile=.3), 'horn', f'WingC_{sd}')
        tips = [wr + np.array([s * 3.4, .6, -1.0]), wr + np.array([s * 3.8, -2.4, -2.2]), wr + np.array([s * 1.6, -5.4, -2.8]), wr + np.array([-s * 1.2, -7.4, -2.6]), sh0 + np.array([s * .5, -3.8, -.6])]
        for i, tp_ in enumerate(tips[:4]):
            R.add('doigt_aile', rod([wr, wr + (tp_ - wr) * .5 + np.array([0, .3, 0]), tp_], .17 - .03 * i, .04, segs=7, tile=.3, n=10), 'horn', f'WingC_{sd}')
        mem = membrane(wr, tips[:4], sag=.5, rows=6, tile=1.5)
        mem2 = membrane(sh0 + np.array([s * .2, -.2, -.2]), [wr + np.array([-s * 1.2, -7.4, -2.6]) , tips[4]], sag=.4, rows=5, tile=1.5) if False else None
        R.add('membrane', mem, 'membrane', f'WingC_{sd}')
        # panneau bas (du bras au dernier doigt)
        pan = membrane(el, [tips[3], tips[4]], sag=.3, rows=6, tile=1.5)
        R.add('membrane_bas', pan, 'membrane', f'WingB_{sd}')
    return R, 14.0


def pose_fns():
    ex = [(['Tail1', 'Tail2', 'Tail3', 'Tail4'], 'y', .22, .5, 1.0, 1.0, 0.0), (['Mane'], 'x', .12, 0, 2.0, 1.0, .0)]
    for sd, sg in (('L', 1.0), ('R', -1.0)):
        ex.append(([f'WingA_{sd}'], 'z', .14, 0, 1.0, sg, .05 * sg)); ex.append(([f'WingB_{sd}'], 'z', .2, 0, 1.0, sg, 0)); ex.append(([f'WingC_{sd}'], 'z', .22, 0, 1.0, sg, 0))
    return biped_poses('slam', ex, arm=.3, leg=.45, bob=.12, lean=.04, drop=2.8)
