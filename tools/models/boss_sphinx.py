"""Boss du Désert d'Ambre : le Sphinx-Scorpion (long de 14 m). Corps de lion en grès fissuré d'ambre, masque pharaonique d'or à coiffe némès,
cobra royal, collier-plastron, carapace dorsale de scarabée et queue segmentée de scorpion à dard venimeux."""
import numpy as np
from boss_geo import *
from boss_rig import *


def mats():
    return {
        'sand': mat('sand', T.stone(51, (.30, .20, .10), (.72, .52, .28), crack=(1, .5, .06), cells=50, rough=.8, relief=6.0), 'sp_sand', 1.4, emissive=True, metal=0.0),
        'gold': mat('gold', T.metal(52, (.85, .62, .16), rust=(.5, .35, .08), rust_amt=.12, panels=4, rough=.28, relief=3.0), 'sp_gold', 1.0),
        'lapis': mat('lapis', T.scales(53, (.04, .12, .45), (.10, .28, .72), edge=(.8, .6, .15), cells=120, rough=.4, metal=.3, relief=4.0), 'sp_lapis', 1.0),
        'shell': mat('shell', T.scales(54, (.12, .06, .03), (.3, .16, .06), edge=(.9, .55, .1), cells=70, rough=.35, metal=.4, glow=(1, .5, .08), relief=5.0), 'sp_shell', 1.2, emissive=True),
        'glow': mat('glow', T.skin(55, (1.0, .5, .08), (1.0, .75, .2), vein=(1, .6, .1), wet=False, relief=2.0, cells=90), 'sp_glow', 1.0, emissive=True, metal=0.0),
        'bone': mat('bone', T.stone(56, (.55, .5, .4), (.9, .86, .74), cells=40, rough=.6, relief=4.0), 'sp_bone', 1.0, metal=0.0),
        'cloth': mat('cloth', T.fibers(57, (.78, .70, .5), (.95, .88, .7), weave=True, rough=.9, relief=3.0, dirt=.3), 'sp_cloth', 1.0, ds=True, metal=0.0),
    }


def build():
    R = Rig()
    quad_bones(R, hip=(0, 3.5, -2.6), spine=(0, 3.7, -.8), chest=(0, 3.9, 1.2), neck=(0, 5.0, 2.5), head=(0, 6.3, 3.1),
               front=(1.0, (3.6, 1.4), (2.1, 1.65), (.8, 1.75)), rear=(1.05, (3.4, -2.6), (1.9, -2.3), (.7, -2.7)),
               tail=[(0, 4.0, -3.8), (0, 5.3, -4.9), (0, 6.7, -5.2), (0, 8.0, -4.6), (0, 8.9, -3.5), (0, 8.8, -2.4)])
    RNG.seed(4)
    # ---------------------------------------------------------- corps de lion (grès)
    n = 22; z = np.linspace(-3.8, 1.8, n)
    path = np.stack([np.zeros(n), 3.5 + .5 * np.clip((z + 3.8) / 5.6, 0, 1) - .15 * np.sin((z + 3.8) / 5.6 * PI), z], 1)
    rf = prof([(0, 1.0), (.25, 1.35), (.55, 1.45), (.8, 1.7), (1, 1.35)], n); rs = prof([(0, 1.0), (.25, 1.3), (.55, 1.3), (.8, 1.6), (1, 1.25)], n)
    R.add('corps', Loft(path, rf, rs, p=2.6, segs=40, cap0=1, cap1=1, tile=1.8, ref=(0, 1, 0)).mesh(), 'sand', 'Spine')
    for k in range(10):   # anneaux de pierre sculptés
        zz = -3.4 + k * .56; i = int((zz + 3.8) / 5.6 * (n - 1)); i = min(max(i, 0), n - 1)
        a_ = rf[i] * 1.0; b_ = rs[i] * 1.0
        R.add('bande_pierre', torus(1.0, .085, axis='z', segs=40, rs=6), 'sand', 'Spine' if k > 2 else 'Hips'); xf(R.parts[-1][1], t=(0, path[i][1], zz), s=(b_, a_, 1))
    # croupe
    R.add('croupe', ell((0, 3.5, -3.2), 1.6, sq=(1.0, 1.0, 1.1), segs=24, n=12, tile=1.5), 'sand', 'Hips')
    # carapace dorsale : plaques articulées de scarabée
    for k in range(9):
        zz = -3.3 + k * .62; w = 1.15 - .05 * abs(k - 4)
        R.add('plaque', ell((0, 4.75 + .02 * k - .08 * abs(k - 4), zz), 1.0, sq=(w, .32, .38), segs=18, n=8, tile=.8), 'shell', 'Spine' if k > 2 else 'Hips')
        R.add('plaque_or', rod([(-w * .95, 4.65, zz - .2), (0, 4.95 - .06 * abs(k - 4), zz - .2), (w * .95, 4.65, zz - .2)], .06, .06, segs=6, tile=.3, n=10), 'gold', 'Spine' if k > 2 else 'Hips')
    # côtes / flancs : bandes d'or à glyphes lumineux
    for k in range(5):
        for s in (1, -1):
            zz = -2.4 + k * .95
            R.add('flanc_or', plate((s * 1.62, 3.55, zz), .12, 1.0, th=.12, bend=0, tile=.5, rot=(0, 0, 0)), 'gold', 'Spine')
            R.add('glyphe', plate((s * 1.69, 3.55, zz), .06, .6, th=.05, tile=.3), 'glow', 'Spine')
    # ---------------------------------------------------------- pattes de lion
    def paw_front():
        o = {}
        o['up'] = concat([rod([(1.0, 3.8, 1.35), (1.05, 3.0, 1.5), (1.0, 2.1, 1.65)], .78, .52, segs=16, tile=1.2, ref=(0, 0, 1)), ell((1.0, 3.7, 1.2), 1.0, sq=(.8, .9, 1.05), segs=18, n=10, tile=1.0)])
        o['lo'] = concat([rod([(1.0, 2.1, 1.65), (1.0, 1.3, 1.72), (1.0, .8, 1.78)], .5, .38, segs=14, tile=1.0, ref=(0, 0, 1)), band((1.0, 1.7, 1.7), 'y', .5, .22, .06), band((1.0, 1.15, 1.74), 'y', .42, .14, .05)])
        pw = [ell((1.0, .42, 2.2), .62, sq=(.85, .6, 1.5), segs=16, n=9, tile=.8)]
        for dx in (-.3, -.1, .1, .3): pw.append(cone((1.0 + dx, .3, 2.95), (1.0 + dx * 1.2, .05, 3.5), .11, segs=7, n=5, tile=.3, curve=.4, bow=(0, -.05, 0)))
        o['pw'] = concat(pw)
        o['or'] = concat([band((1.0, 1.9, 1.67), 'y', .53, .26, .07), band((1.0, 1.0, 1.76), 'y', .4, .2, .06)])
        return o
    P = paw_front()
    R.add_sym('epaule', P['up'], 'sand', 'FUpper_L'); R.add_sym('avantpatte', P['lo'], 'sand', 'FLower_L'); R.add_sym('patte', P['pw'], 'sand', 'FPaw_L')
    R.add_sym('bracelet', P['or'], 'gold', 'FLower_L')

    def paw_rear():
        o = {}
        o['up'] = concat([ell((1.05, 3.3, -2.6), 1.15, sq=(.85, 1.15, 1.2), segs=20, n=11, tile=1.2), rod([(1.05, 3.1, -2.6), (1.1, 2.4, -2.5), (1.05, 1.9, -2.3)], .75, .5, segs=14, tile=1.2, ref=(0, 0, 1))])
        o['lo'] = rod([(1.05, 1.9, -2.3), (1.1, 1.3, -2.7), (1.05, .75, -2.7)], .46, .34, segs=14, tile=1.0, ref=(0, 0, 1))
        pw = [ell((1.05, .42, -2.25), .62, sq=(.85, .6, 1.5), segs=16, n=9, tile=.8)]
        for dx in (-.3, -.1, .1, .3): pw.append(cone((1.05 + dx, .3, -1.5), (1.05 + dx * 1.2, .05, -1.0), .11, segs=7, n=5, tile=.3, curve=.4, bow=(0, -.05, 0)))
        o['pw'] = concat(pw)
        o['or'] = concat([band((1.05, 1.1, -2.7), 'y', .39, .2, .06), band((1.07, 2.2, -2.45), 'y', .5, .24, .07)])
        return o
    Q = paw_rear()
    R.add_sym('cuisse', Q['up'], 'sand', 'RUpper_L'); R.add_sym('jambe', Q['lo'], 'sand', 'RLower_L'); R.add_sym('patte_ar', Q['pw'], 'sand', 'RPaw_L'); R.add_sym('bracelet_ar', Q['or'], 'gold', 'RLower_L')
    # ---------------------------------------------------------- poitrail + collier usekh
    R.add('poitrail', ell((0, 4.1, 1.9), 1.5, sq=(.95, 1.0, .8), segs=24, n=12, tile=1.2), 'sand', 'Chest')
    for k in range(6):
        R.add('collier', torus(1.0 + k * .13, .09, axis='y', segs=36, rs=8), 'gold' if k % 2 == 0 else 'lapis', 'Neck')
        xf(R.parts[-1][1], t=(0, 4.55 - k * .09, 2.45 + k * .13), rx=.25, s=(1.05, 1.0, .95))
    for k in range(13):
        a = -1.15 + k * .19
        R.add('perle', ell((1.5 * np.sin(a), 4.25 + .0, 2.9 + 1.0 * np.cos(a) - .85 + .0), .12, segs=8, n=6, tile=.2), 'glow', 'Neck') if False else None
    R.add('pendentif', ell((0, 3.85, 3.05), .5, sq=(.8, 1.1, .35), segs=14, n=9, tile=.4), 'glow', 'Neck')
    R.add('pendentif_cadre', torus(.52, .07, axis='z', segs=20, rs=7), 'gold', 'Neck'); xf(R.parts[-1][1], t=(0, 3.85, 3.1), s=(.82, 1.1, 1))
    # ---------------------------------------------------------- cou + tête de pharaon
    R.add('cou', rod([(0, 4.3, 2.0), (0, 5.2, 2.6), (0, 6.0, 3.0)], 1.0, .85, segs=18, tile=.9, ref=(1, 0, 0)), 'sand', 'Neck')
    # visage : masque d'or
    face = ell((0, 6.55, 3.55), 1.05, sq=(.9, 1.2, .78), segs=30, n=18, tile=.8)
    R.add('visage', face, 'gold', 'Head')
    R.add('nez', cone((0, 6.55, 4.05), (0, 6.1, 4.55), .22, segs=8, ratio=.9, n=5, tile=.3, curve=.3), 'gold', 'Head')
    R.add('menton', ell((0, 5.65, 3.8), .5, sq=(.8, .7, .8), segs=14, n=8, tile=.5), 'gold', 'Head')
    R.add('levres', rod([(-.4, 5.95, 4.15), (0, 5.9, 4.3), (.4, 5.95, 4.15)], .1, .1, segs=8, tile=.2, n=10), 'gold', 'Head')
    for s in (1, -1):
        R.add('oeil_fond', ell((s * .42, 6.78, 4.0), .3, sq=(1.1, .6, .5), segs=12, n=8, tile=.4), 'bone', 'Head')
        R.add('iris', ell((s * .42, 6.78, 4.2), .15, sq=(1, 1, .35), segs=10, n=7, tile=.3), 'glow', 'Head')
        R.add('khol', rod([(s * .75, 6.72, 3.85), (s * .42, 6.84, 4.15), (s * .12, 6.72, 4.1)], .06, .05, segs=6, tile=.2, n=10), 'lapis', 'Head')
        R.add('sourcil', rod([(s * .8, 7.0, 3.8), (s * .45, 7.1, 4.1), (s * .1, 7.0, 4.15)], .08, .06, segs=6, tile=.2, n=10), 'lapis', 'Head')
        R.add('oreille', ell((s * 1.0, 6.5, 3.25), .35, sq=(.4, 1.0, .7), segs=10, n=7, tile=.4), 'gold', 'Head')
        # lappets du némès : grandes pièces rayées tombant des deux côtés
        for k in range(7):
            R.add('lappet', plate((s * (1.28 + .03 * k), 6.0 - .02 * k, 3.1 - .02 * k), .18, 2.3, th=.12, bend=.0, rot=(0, 0, 0), tile=.5), 'lapis' if k % 2 == 0 else 'gold', 'Head') if False else None
        R.add('lappet', box((s * 1.45, 5.6, 3.15), .5, 3.0, .75, bevel=3.0, tile=.7, rot=(0, 0, s * .06)), 'lapis', 'Head')
        for k in range(6): R.add('lappet_or', box((s * 1.45, 4.5 + k * .45, 3.46), .52, .12, .12, tile=.3), 'gold', 'Head')
    # coiffe : calotte rayée + diadème
    R.add('coiffe', ell((0, 7.25, 3.15), 1.35, sq=(1.0, .75, 1.12), segs=32, n=16, tile=1.0), 'lapis', 'Head')
    R.add('diademe', torus(1.3, .13, axis='y', segs=40, rs=8), 'gold', 'Head'); xf(R.parts[-1][1], t=(0, 7.1, 3.25), rx=.1, s=(1.0, 1, 1.05))
    # cobra royal
    R.add('cobra', rod([(0, 7.0, 4.3), (0, 7.45, 4.5), (0, 7.9, 4.35), (0, 8.2, 4.45)], .17, .1, segs=10, tile=.3, n=14), 'gold', 'Head')
    R.add('cobra_capuche', ell((0, 8.2, 4.4), .34, sq=(1.1, 1.1, .3), segs=14, n=9, tile=.4), 'gold', 'Head')
    R.add('cobra_oeil', ell((0, 8.28, 4.55), .06, segs=6, n=5, tile=.1), 'glow', 'Head')
    R.add('barbe', rod([(0, 5.6, 4.0), (0, 4.8, 4.2), (0, 3.9, 4.2)], .17, .25, segs=10, tile=.4, n=12, ratio=1.2), 'gold', 'Head')
    for k in range(5): R.add('barbe_b', band((0, 5.3 - k * .3, 4.1 + .05 * k), 'y', .16, .08, .04), 'lapis', 'Head')
    # ---------------------------------------------------------- queue de scorpion
    tp = [(0, 4.0, -3.8), (0, 5.3, -4.9), (0, 6.7, -5.2), (0, 8.0, -4.6), (0, 8.9, -3.5), (0, 8.8, -2.4)]
    rad = [.62, .6, .56, .52, .46, .4]
    for i in range(6):
        a = np.array(tp[i]); b = np.array(tp[i + 1]) if i < 5 else np.array([0, 8.2, -1.6])
        c = (a + b) / 2
        seg_ = ell(c, rad[i], sq=(1.0, 1.0, 1.0), segs=18, n=10, tile=.8)
        seg_.V = (seg_.V - c) * np.array([1, 1.15, 1.15]) + c
        R.add(f'seg{i}', seg_, 'shell', f'Tail{i + 1}')
        R.add(f'anneau{i}', torus(rad[i] * 1.04, .07, axis='z', segs=22, rs=6), 'gold', f'Tail{i + 1}'); orient_z(R.parts[-1][1], unit(b - a), a)
        for s_ in (1, -1):
            R.add(f'epine{i}', cone(c + np.array([s_ * rad[i] * .85, rad[i] * .4, 0]), c + np.array([s_ * rad[i] * 1.5, rad[i] * 1.1, 0]), .1, segs=6, n=4, tile=.2), 'bone', f'Tail{i + 1}')
    # dard
    R.add('ampoule', ell((0, 8.1, -1.7), .6, sq=(.85, 1.1, 1.3), segs=18, n=11, tile=.6), 'glow', 'Tail6')
    R.add('dard', cone((0, 8.0, -1.25), (0, 6.9, -.1), .3, segs=10, n=10, tile=.4, curve=.45, bow=(0, -.4, -.25)), 'bone', 'Tail6')
    R.add('dard_pointe', cone((0, 7.2, -.35), (0, 6.5, .35), .1, segs=8, n=5, tile=.2), 'glow', 'Tail6')
    R.add('gaine_dard', band((0, 8.0, -1.35), 'z', .35, .2, .07), 'gold', 'Tail6')
    # pinces vestigiales sur le poitrail
    for s in (1, -1):
        R.add('pince_bras', rod([(s * 1.35, 3.6, 2.7), (s * 1.9, 3.2, 3.6)], .22, .17, segs=8, tile=.4, n=8), 'shell', 'Chest')
        R.add('pince_a', cone((s * 1.9, 3.2, 3.6), (s * 1.5, 3.4, 4.5), .22, segs=8, n=7, tile=.3, curve=.2, bow=(s * .1, 0, 0)), 'shell', 'Chest')
        R.add('pince_b', cone((s * 1.95, 3.1, 3.6), (s * 2.55, 3.1, 4.3), .18, segs=8, n=7, tile=.3, curve=.2, bow=(s * -.12, 0, 0)), 'shell', 'Chest')
    return R, 10.0


def pose_fns():
    ex = [(['Tail1', 'Tail2', 'Tail3', 'Tail4', 'Tail5', 'Tail6'], 'y', .12, .4, 1.0, 1.0, 0.0)]
    return quad_poses('sting', ex, f=.5, r=.5, bob=.05, drop=2.0)
