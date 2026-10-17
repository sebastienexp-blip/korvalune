"""Boss des Terres Corrompues : le Prélat de Chair (12,5 m). Haute silhouette en robe, poitrail de façade gothique à rosace incandescente, contreforts
d'os en arcs-boutants, quatre bras, visage sans bouche aux trois fentes lumineuses, couronne de flèches et encensoir hérissé au bout d'une chaîne."""
import numpy as np
from boss_geo import *
from boss_rig import *


def mats():
    return {
        'robe': mat('robe', T.fibers(81, (.07, .03, .10), (.20, .09, .26), weave=True, rough=.85, relief=4.0, dirt=.5, emis_col=(.7, .15, 1.0)), 'cp_robe', 1.2, emissive=True, ds=True, metal=0.0),
        'stone': mat('stone', T.stone(82, (.10, .08, .13), (.34, .28, .38), crack=(.8, .25, 1.0), cells=60, rough=.7, relief=7.0), 'cp_stone', 1.4, emissive=True, metal=0.0),
        'flesh': mat('flesh', T.skin(83, (.45, .20, .30), (.72, .38, .48), spots=(.3, .1, .22), vein=(.85, .25, 1.0), wet=True, relief=5.0, cells=180), 'cp_flesh', 1.2, emissive=True, metal=0.0),
        'bone': mat('bone', T.stone(84, (.42, .38, .34), (.78, .74, .68), cells=50, rough=.55, relief=4.0), 'cp_bone', 1.0, metal=0.0),
        'gold': mat('gold', T.metal(85, (.55, .42, .2), rust=(.25, .12, .2), rust_amt=.3, panels=3, rough=.4, relief=3.0, rivets=False), 'cp_gold', 1.0),
        'glow': mat('glow', T.skin(86, (.7, .25, 1.0), (1.0, .65, 1.0), vein=(.9, .5, 1), wet=False, relief=2.0, cells=70), 'cp_glow', 1.0, emissive=True, metal=0.0),
        'iron': mat('iron', T.metal(87, (.16, .14, .18), rust=(.3, .12, .2), rust_amt=.4, panels=4, rough=.5, relief=4.0), 'cp_iron', 1.0, ds=True),
    }


def build():
    R = Rig()
    biped_bones(R, hip=5.4, spine=6.4, chest=7.6, neck=(9.3, .15), head=(9.7, .2), sh=(1.5, 8.9, 0), el=(2.0, 6.7, .3), hand=(2.0, 4.5, .9),
                th=(.7, 5.3, 0), kn=(.7, 2.8, .2), an=(.7, .6, .1))
    R.bone('ArmB_L', 'Chest', (1.1, 7.7, .2)); R.bone('ArmB_R', 'Chest', (-1.1, 7.7, .2))
    R.bone('Chain1', 'Hand_R', (-2.0, 4.1, 1.0)); R.bone('Chain2', 'Chain1', (-2.2, 2.8, 1.3)); R.bone('Chain3', 'Chain2', (-2.3, 1.6, 1.5))
    R.bone('Veil', 'Head', (0, 10.2, -.5))
    RNG.seed(14)
    # ---------------------------------------------------------- pieds + jambes cachées
    for sd, s in (('L', 1), ('R', -1)):
        R.add('jambe', rod([(s * .7, 5.3, 0), (s * .7, 2.8, .2), (s * .7, .7, .1)], .5, .3, segs=10, tile=1.0, ref=(0, 0, 1)), 'flesh', f'Thigh_{sd}')
        ft = [ell((s * .7, .35, .5), .5, sq=(.8, .45, 1.6), segs=14, n=9, tile=.8)]
        for dx in (-.2, 0, .2): ft.append(cone((s * .7 + dx, .25, 1.2), (s * .7 + dx * 1.4, .08, 1.9), .09, segs=6, n=5, tile=.2, curve=.3))
        R.add('pied', concat(ft), 'bone', f'Foot_{sd}')
    # ---------------------------------------------------------- robe à lambeaux
    n = 14; y = np.linspace(.2, 7.8, n); path = np.stack([np.zeros(n), y, np.zeros(n)], 1)
    rf = prof([(0, 2.6), (.15, 2.2), (.5, 1.45), (.8, 1.25), (1, 1.5)], n); rs = prof([(0, 2.8), (.15, 2.3), (.5, 1.6), (.8, 1.4), (1, 1.7)], n)
    R.add('robe', Loft(path, rf, rs, p=2.3, segs=48, cap0=0, cap1=1, tile=2.0, ref=(0, 0, 1)).mesh(), 'robe', 'Hips')
    for k in range(26):
        a = k / 26 * 2 * PI; ln = RNG.uniform(.8, 2.2)
        R.add('lambeau', Loft(smoothpath([(2.65 * np.sin(a), .35, 2.5 * np.cos(a)), (2.8 * np.sin(a), .1 - ln * .2, 2.65 * np.cos(a)), (2.9 * np.sin(a), -.05, 2.8 * np.cos(a))], 6),
                               np.full(6, .015), prof([(0, .35), (1, .02)], 6), p=2.2, segs=6, cap1=1, tile=.6, ref=(np.sin(a), 0, np.cos(a))).mesh(), 'robe', 'Hips')
    R.add('ceinture', torus(1.5, .16, axis='y', segs=36, rs=8), 'gold', 'Hips'); xf(R.parts[-1][1], t=(0, 5.6, 0))
    for k in range(10):
        a = k / 10 * 2 * PI
        R.add('pendentif', cone((1.5 * np.sin(a), 5.5, 1.5 * np.cos(a)), (1.55 * np.sin(a), 4.2, 1.55 * np.cos(a)), .1, segs=5, n=4, tile=.2), 'bone', 'Hips')
    # ---------------------------------------------------------- torse : façade gothique
    R.add('torse', box((0, 7.2, 0), 3.0, 2.8, 2.0, bevel=3.0, tile=1.4), 'stone', 'Chest')
    R.add('facade', box((0, 7.6, .9), 2.4, 2.8, .5, bevel=3.0, tile=1.2), 'stone', 'Chest')
    # grande arche ogivale (deux arcs) + rosace
    for s in (1, -1):
        R.add('arc', rod([(s * 1.1, 6.2, 1.25), (s * 1.1, 7.6, 1.3), (s * .55, 8.6, 1.35), (0, 9.15, 1.35)], .13, .1, segs=8, tile=.4, n=16), 'bone', 'Chest')
        R.add('arc_in', rod([(s * .8, 6.4, 1.28), (s * .8, 7.5, 1.3), (s * .4, 8.3, 1.33), (0, 8.7, 1.34)], .08, .06, segs=8, tile=.3, n=14), 'bone', 'Chest')
    R.add('rosace_vitre', ell((0, 7.7, 1.2), .95, sq=(1, 1, .15), segs=26, n=8, tile=.5), 'glow', 'Chest')
    R.add('rosace', torus(.98, .09, axis='z', segs=32, rs=7), 'bone', 'Chest'); xf(R.parts[-1][1], t=(0, 7.7, 1.38))
    for k in range(12):
        a = k / 12 * 2 * PI
        R.add('rayon', rod([(0, 7.7, 1.4), (.95 * np.cos(a), 7.7 + .95 * np.sin(a), 1.4)], .045, .045, segs=5, tile=.2, n=3), 'bone', 'Chest')
    R.add('rosace_c', torus(.45, .05, axis='z', segs=20, rs=6), 'bone', 'Chest'); xf(R.parts[-1][1], t=(0, 7.7, 1.4))
    for k in range(3):   # portail inférieur : bouche de chair
        R.add('portail', ell((0, 6.1, 1.2), .55 - k * .12, sq=(.8, 1.3, .3), segs=18, n=9, tile=.5), 'flesh' if k < 2 else 'glow', 'Chest')
    # pinacles
    for s in (1, -1):
        for k, (x, h) in enumerate(((1.7, 2.2), (1.0, 1.4))):
            R.add('pinacle', cone((s * x, 8.4, .6), (s * x, 8.4 + h, .6), .22, segs=4, n=4, tile=.4), 'stone', 'Chest')
            R.add('pinacle_b', box((s * x, 8.4, .6), .5, .4, .5, tile=.4), 'stone', 'Chest')
    # contreforts : arcs-boutants d'os dans le dos
    for s in (1, -1):
        for k in range(5):
            y0 = 6.4 + k * .5
            R.add('arc_boutant', rod([(s * .5, y0, -.8), (s * (1.7 + .4 * k), y0 + 1.2 + .3 * k, -1.8 - .2 * k), (s * (2.8 + .8 * k), y0 + .2 - .3 * k, -1.4 - .5 * k)], .13 - .01 * k, .05, segs=8, tile=.4, n=16), 'bone', 'Chest')
        R.add('pinacle_dos', cone((s * 2.3, 9.4, -1.5), (s * 2.5, 11.8, -1.8), .26, segs=4, n=5, tile=.4), 'stone', 'Chest')
    R.add('colonne', rod([(0, 5.6, -1.0), (0, 7.5, -1.2), (0, 9.2, -.8)], .3, .25, segs=10, tile=.6, n=12), 'bone', 'Chest')
    for k in range(9): R.add('vertebre', ell((0, 5.9 + k * .38, -1.12 - .03 * k), .22, sq=(1.2, .6, 1), segs=8, n=6, tile=.3), 'bone', 'Chest')
    # étole de chair
    for s in (1, -1):
        R.add('etole', rod([(s * .6, 9.0, 1.0), (s * .65, 7.0, 1.5), (s * .7, 4.5, 1.2), (s * .6, 3.0, 1.2)], .3, .2, segs=8, tile=.6, n=14, ratio=.35), 'flesh', 'Chest')
        R.add('etole_or', rod([(s * .6, 8.8, 1.2), (s * .66, 6.8, 1.7), (s * .7, 4.3, 1.4)], .05, .05, segs=5, tile=.2, n=12), 'gold', 'Chest')
    # ---------------------------------------------------------- bras principaux (fins, longs) + mains à doigts démesurés
    def arm():
        o = {}
        o['sh'] = concat([ell((1.6, 9.0, 0), .7, sq=(1.1, .9, 1), segs=16, n=10, tile=.9), cone((1.7, 9.4, 0), (2.0, 10.6, -.2), .25, segs=6, n=5, tile=.4, curve=.3)])
        o['up'] = rod([(1.55, 8.9, 0), (1.8, 7.8, .15), (2.0, 6.7, .3)], .36, .26, segs=12, tile=.8, ref=(0, 0, 1))
        o['el'] = concat([ell((2.0, 6.7, .3), .36, segs=12, n=8, tile=.6), cone((2.2, 6.8, .2), (2.9, 7.3, -.2), .13, segs=6, n=5, tile=.3)])
        o['fo'] = rod([(2.0, 6.7, .3), (2.0, 5.6, .6), (2.0, 4.6, .9)], .26, .17, segs=12, tile=.8, ref=(0, 0, 1))
        o['cuff'] = band((2.0, 5.0, .8), 'y', .24, .5, .06)
        return o
    A = arm()
    R.add_sym('epaule', A['sh'], 'stone', 'Arm_L'); R.add_sym('bras', A['up'], 'flesh', 'Arm_L'); R.add_sym('coude', A['el'], 'bone', 'Fore_L')
    R.add_sym('avantbras', A['fo'], 'flesh', 'Fore_L'); R.add_sym('manchette', A['cuff'], 'gold', 'Fore_L')

    def hand(s):
        g = [ell((s * 2.0, 4.35, .95), .26, sq=(1, 1.1, 1), segs=10, n=7, tile=.4)]
        for i, dx in enumerate((-.2, -.1, 0, .1, .2)):
            ln = 1.7 - .25 * abs(dx) * 5
            g.append(rod([(s * 2.0 + dx, 4.2, 1.0), (s * 2.0 + dx * 1.4, 3.3, 1.5 + .0), (s * 2.0 + dx * 1.7, 2.7 - .2 * abs(i - 2) * 0, 1.9)], .07, .025, segs=6, tile=.2, n=8))
        return concat(g)
    R.add('main_g', hand(1), 'flesh', 'Hand_L'); R.add('main_d', hand(-1), 'flesh', 'Hand_R')
    # bras supplémentaires (bas) : fins, repliés, tenant un livre / un cierge
    for sd, s in (('L', 1), ('R', -1)):
        R.add('bras_sup', rod([(s * 1.1, 7.7, .2), (s * 1.9, 7.0, 1.0), (s * 1.3, 6.6, 1.9)], .24, .15, segs=10, tile=.5, n=12), 'flesh', f'ArmB_{sd}')
        R.add('bras_sup_main', concat([ell((s * 1.3, 6.55, 2.0), .22, segs=8, n=6, tile=.3)] + [rod([(s * 1.3 + dx, 6.5, 2.1), (s * 1.3 + dx * 1.5, 6.2, 2.6)], .05, .02, segs=5, tile=.2, n=5) for dx in (-.12, 0, .12)]), 'flesh', f'ArmB_{sd}')
    R.add('cierge', rod([(1.2, 6.55, 2.1), (1.2, 7.6, 2.1)], .09, .09, segs=8, tile=.3, n=3), 'bone', 'ArmB_L')
    R.add('flamme', cone((1.2, 7.55, 2.1), (1.2, 8.35, 2.1), .17, segs=8, n=6, tile=.3, curve=-.2), 'glow', 'ArmB_L') if False else None
    R.add('flamme', ell((1.2, 7.85, 2.1), .22, sq=(.8, 1.7, .8), segs=8, n=7, tile=.3), 'glow', 'ArmB_L')
    # ---------------------------------------------------------- encensoir à chaîne
    for i, (nm, a, b) in enumerate((('Chain1', (-2.0, 4.1, 1.0), (-2.2, 2.8, 1.3)), ('Chain2', (-2.2, 2.8, 1.3), (-2.3, 1.6, 1.5)), ('Chain3', (-2.3, 1.6, 1.5), (-2.3, .9, 1.6)))):
        a = np.array(a); b = np.array(b); L = np.linalg.norm(b - a); k = max(2, int(L / .22))
        for j in range(k):
            c = a + (b - a) * (j + .5) / k
            R.add('maillon', torus(.1, .028, axis='x' if j % 2 else 'z', segs=10, rs=5), 'iron', nm); xf(R.parts[-1][1], t=c)
    R.add('encensoir', ell((-2.3, .5, 1.6), .62, segs=18, n=11, tile=.6), 'iron', 'Chain3')
    R.add('encensoir_braise', ell((-2.3, .5, 1.6), .5, segs=14, n=9, tile=.5), 'glow', 'Chain3')
    for k in range(9):
        a = k / 9 * 2 * PI
        R.add('encensoir_pic', cone((-2.3 + .6 * np.cos(a), .5 + .1 * np.sin(a * 2), 1.6 + .6 * np.sin(a)), (-2.3 + 1.15 * np.cos(a), .5 + .3 * np.sin(a * 2), 1.6 + 1.15 * np.sin(a)), .09, segs=5, n=4, tile=.2), 'iron', 'Chain3')
    for k in range(5):
        a = k * 1.3
        R.add('encensoir_ban', cone((-2.3 + .4 * np.cos(a), .95, 1.6 + .4 * np.sin(a)), (-2.3 + .5 * np.cos(a), 1.15, 1.6 + .5 * np.sin(a)), .08, segs=5, n=3, tile=.2), 'iron', 'Chain3')
    # ---------------------------------------------------------- cou + tête sans bouche + couronne de flèches
    R.add('cou', rod([(0, 9.0, .1), (0, 9.6, .2)], .5, .4, segs=12, tile=.6, ref=(0, 0, 1)), 'flesh', 'Neck')
    R.add('collerette', torus(.9, .2, axis='y', segs=30, rs=8), 'stone', 'Neck'); xf(R.parts[-1][1], t=(0, 9.15, .1), s=(1, 1, 1))
    head = ell((0, 10.4, .2), .85, sq=(.82, 1.5, .95), segs=34, n=22, tile=1.0)
    R.add('tete', head, 'flesh', 'Head')
    for k, y in enumerate((10.15, 10.55, 10.95)):
        w = (.3, .22, .15)[k]
        R.add('fente', ell((0, y, .98 - .1 * k * 0), w, sq=(1, .18, .25), segs=14, n=7, tile=.4), 'glow', 'Head')
        for s in (1,):
            pass
    for k in range(3):
        for s in (1, -1):
            R.add('fente_lat', ell((s * .5, 10.55 + .3 * (k - 1), .72), .1, sq=(1.5, .5, .5), segs=8, n=6, tile=.3), 'glow', 'Head')
    for k in range(8):
        R.add('suture', rod([(-.28 + k * .08, 9.62, .94), (-.28 + k * .08 + .03, 9.78, .93)], .015, .015, segs=4, tile=.1, n=3), 'bone', 'Head')
    R.add('suture_ligne', rod([(-.34, 9.7, .92), (.34, 9.7, .92)], .02, .02, segs=4, tile=.1, n=8), 'bone', 'Head')
    R.add('mitre', cone((0, 11.4, .0), (0, 13.0, -.1), .6, segs=4, n=6, tile=.5, curve=.1, ratio=1.1), 'stone', 'Head')
    for k in range(9):
        a = k / 9 * 2 * PI
        R.add('couronne', cone((1.0 * np.cos(a), 11.1, 1.0 * np.sin(a)), (1.25 * np.cos(a), 12.2 + .6 * np.sin(k * 1.7), 1.25 * np.sin(a)), .1, segs=4, n=4, tile=.3), 'bone', 'Head')
    R.add('couronne_anneau', torus(1.0, .09, axis='y', segs=34, rs=6), 'gold', 'Head'); xf(R.parts[-1][1], t=(0, 11.1, 0))
    R.add('halo', torus(1.9, .06, axis='z', segs=44, rs=6), 'glow', 'Head'); xf(R.parts[-1][1], t=(0, 10.6, -.9))
    for k in range(12):
        a = k / 12 * 2 * PI
        R.add('halo_pic', cone((1.9 * np.cos(a), 10.6 + 1.9 * np.sin(a), -.9), (2.3 * np.cos(a), 10.6 + 2.3 * np.sin(a), -.9), .06, segs=4, n=3, tile=.2), 'glow', 'Head')
    # voile
    for k in range(9):
        x0 = -.8 + k * .2
        R.add('voile', Loft(smoothpath([(x0, 11.0, -.55), (x0 * 1.1, 9.6, -.95), (x0 * 1.2, 8.0, -1.2)], 8), np.full(8, .012), prof([(0, .11), (1, .03)], 8), p=2.2, segs=6, cap1=1, tile=.6, ref=(1, 0, 0)).mesh(), 'robe', 'Veil')
    return R, 12.5


def pose_fns():
    ex = [(['ArmB_L'], 'x', .12, 0, 1.0, 1.0, .0), (['ArmB_R'], 'x', .12, 0, 1.0, -1.0, .0), (['Chain1', 'Chain2', 'Chain3'], 'x', .22, .6, 1.4, 1.0, .0), (['Veil'], 'x', .1, .5, 1.0, 1.0, .1)]
    return biped_poses('cast', ex, arm=.25, leg=.3, bob=.05, lean=.02, drop=1.2)
