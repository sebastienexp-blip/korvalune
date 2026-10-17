"""Boss du Marais de Brume : le Gobe-Lanterne (11 m). Crapaud-pêcheur colossal, peau verruqueuse constellée de champignons luminescents,
gueule hérissée de crocs, leurre-lanterne suspendu à une tige, gorge gonflée, pattes palmées."""
import numpy as np
from boss_geo import *
from boss_rig import *


def mats():
    return {
        'skin': mat('skin', T.skin(61, (.10, .17, .06), (.26, .36, .11), spots=(.5, .42, .12), wet=True, relief=7.0, cells=200), 'td_skin', 1.6, metal=0.0),
        'belly': mat('belly', T.skin(62, (.5, .46, .26), (.72, .66, .4), spots=(.35, .3, .12), wet=True, relief=4.0, cells=240), 'td_belly', 1.2, metal=0.0),
        'mouth': mat('mouth', T.skin(63, (.45, .08, .12), (.75, .22, .25), vein=(.9, .2, .25), wet=True, relief=4.0, cells=160), 'td_mouth', 1.0, emissive=True, metal=0.0),
        'bone': mat('bone', T.stone(64, (.55, .5, .38), (.9, .86, .72), cells=40, rough=.55, relief=3.0), 'td_bone', 1.0, metal=0.0),
        'lamp': mat('lamp', T.skin(65, (.3, .9, .55), (.7, 1.0, .8), vein=(.6, 1, .8), wet=False, relief=2.0, cells=60), 'td_lamp', 1.0, emissive=True, metal=0.0),
        'fungus': mat('fungus', T.scales(66, (.28, .10, .34), (.55, .28, .6), edge=(.15, .05, .2), cells=90, rough=.5, metal=0.0, glow=(.5, 1, .8), relief=3.0), 'td_fungus', 1.0, emissive=True, metal=0.0),
        'moss': mat('moss', T.fibers(67, (.04, .12, .04), (.15, .32, .08), aniso=(.3, .6), rough=.95, relief=3.0, dirt=.3), 'td_moss', 1.0, ds=True, metal=0.0),
        'eye': mat('eye', T.skin(68, (.95, .75, .1), (1.0, .95, .3), vein=(1, .8, .1), wet=True, relief=2.0, cells=60), 'td_eye', 1.0, emissive=True, metal=0.0),
    }


def build():
    R = Rig()
    quad_bones(R, hip=(0, 2.6, -2.8), spine=(0, 3.0, -1.0), chest=(0, 3.3, 1.0), neck=(0, 3.2, 2.7), head=(0, 3.4, 3.4), jaw=(0, 2.3, 3.6),
               front=(1.9, (3.0, 1.5), (1.7, 2.4), (.5, 3.0)), rear=(2.2, (3.0, -3.0), (1.5, -4.3), (.45, -2.7)))
    R.bone('Lure1', 'Head', (0, 5.0, 3.9)); R.bone('Lure2', 'Lure1', (0, 6.8, 4.9)); R.bone('Lure3', 'Lure2', (0, 7.8, 6.2))
    RNG.seed(9)
    # ---------------------------------------------------------- corps
    n = 20; z = np.linspace(-4.4, 2.6, n)
    path = np.stack([np.zeros(n), 3.0 + .25 * np.sin((z + 4.4) / 7 * PI), z], 1)
    rf = prof([(0, .9), (.2, 2.0), (.5, 2.2), (.8, 1.9), (1, 1.3)], n); rs = prof([(0, 1.0), (.2, 2.4), (.5, 2.8), (.8, 2.5), (1, 1.8)], n)
    body = Loft(path, rf, rs, p=2.2, segs=44, cap0=1, cap1=1, tile=2.0, ref=(0, 1, 0)).mesh()
    R.add('corps', body, 'skin', 'Spine')
    R.add('ventre', ell((0, 2.3, -.5), 2.2, sq=(1.2, .6, 1.8), segs=30, n=12, tile=1.8), 'belly', 'Spine')
    # verrues
    for k in range(150):
        zz = RNG.uniform(-4.0, 2.2); i = int((zz + 4.4) / 7 * (n - 1)); a = RNG.uniform(-PI * .75, PI * .75)
        rr = RNG.uniform(.1, .34)
        c = np.array([rs[i] * np.sin(a) * .98, path[i][1] + rf[i] * np.cos(a) * .98, zz])
        R.add('verrue', ell(c, rr, sq=(1, .8, 1), segs=7, n=5, tile=.4), 'skin', 'Spine' if zz > -2 else 'Hips')
    # glandes parotoïdes
    for s in (1, -1): R.add('glande', ell((s * 2.0, 4.9, 1.6), 1.0, sq=(.8, .55, 1.5), segs=18, n=9, tile=.8), 'skin', 'Chest')
    # ---------------------------------------------------------- champignons luminescents du dos
    for k in range(26):
        zz = RNG.uniform(-3.6, 1.8); i = int((zz + 4.4) / 7 * (n - 1)); a = RNG.uniform(-1.0, 1.0)
        base = np.array([rs[i] * np.sin(a) * .9, path[i][1] + rf[i] * np.cos(a) * .92, zz]); h = RNG.uniform(.6, 2.0); r = RNG.uniform(.35, 1.0)
        tilt = np.array([RNG.normal(0, .25), 0, RNG.normal(0, .25)])
        top = base + np.array([0, h, 0]) + tilt * h
        bn = 'Spine' if zz > -2 else 'Hips'
        R.add('tige', rod([base, (base + top) / 2 + tilt * .2, top], r * .25, r * .17, segs=8, tile=.4, n=6), 'belly', bn)
        R.add('chapeau', ell(top + np.array([0, .05, 0]), r, sq=(1, .38, 1), segs=14, n=8, tile=.6), 'fungus', bn)
        R.add('lamelle', revolve([(r * .85, 0), (r * .3, -.1), (.04, -.14)], segs=14, tile=.4), 'mouth', bn); xf(R.parts[-1][1], rx=-PI / 2, t=top + np.array([0, -.02, 0]))
    # algues / mousse pendantes
    for k in range(24):
        a = RNG.uniform(-PI * .8, PI * .8); zz = RNG.uniform(-3.5, 2.0); i = int((zz + 4.4) / 7 * (n - 1))
        b0 = np.array([rs[i] * np.sin(a), path[i][1] + rf[i] * np.cos(a) * .9, zz]); ln = RNG.uniform(1.2, 2.8)
        R.add('algue', rod([b0, b0 + np.array([np.sin(a) * .5, -ln * .5, 0]), b0 + np.array([np.sin(a) * .8, -ln, 0])], .1, .02, segs=5, tile=.4, n=6, ratio=.25), 'moss', 'Spine' if zz > -2 else 'Hips')
    # crête dorsale à membrane
    for k in range(14):
        zz = -3.9 + k * .4; i = int((zz + 4.4) / 7 * (n - 1)); y0 = path[i][1] + rf[i] * .98
        R.add('crete', cone((0, y0, zz), (0, y0 + 1.3 - .05 * abs(k - 7), zz - .25), .13, segs=6, n=5, tile=.3), 'bone', 'Spine' if zz > -2 else 'Hips')
    # ---------------------------------------------------------- pattes avant palmées
    def fl():
        o = {}
        o['up'] = concat([ell((1.9, 2.9, 1.5), 1.25, sq=(.8, 1.0, 1.1), segs=20, n=11, tile=1.0), rod([(1.9, 2.9, 1.5), (1.9, 2.2, 2.0), (1.9, 1.7, 2.4)], .8, .55, segs=14, tile=1.0, ref=(0, 0, 1))])
        o['lo'] = rod([(1.9, 1.7, 2.4), (1.9, 1.1, 2.7), (1.9, .55, 3.0)], .55, .42, segs=14, tile=1.0, ref=(0, 0, 1))
        pw = [ell((1.9, .3, 3.4), .65, sq=(1.1, .3, 1.3), segs=16, n=9, tile=.8)]
        for i, dx in enumerate((-.5, -.17, .17, .5)):
            pw.append(rod([(1.9 + dx * .5, .3, 3.8), (1.9 + dx * 1.2, .22, 4.4), (1.9 + dx * 1.5, .15, 4.9)], .13, .1, segs=7, tile=.3, n=8))
            pw.append(ell((1.9 + dx * 1.5, .14, 4.95), .17, sq=(1, .5, 1), segs=8, n=6, tile=.2))
        for i in range(3): pw.append(plate((1.9 + (i - 1) * .34 * 1.2, .13, 4.4), .38, .9, th=.03, bend=0, rot=(-PI / 2, 0, 0), tile=.5, segs=4))
        o['pw'] = concat(pw)
        return o
    F = fl()
    R.add_sym('bras', F['up'], 'skin', 'FUpper_L'); R.add_sym('avantbras', F['lo'], 'skin', 'FLower_L'); R.add_sym('main', F['pw'], 'belly', 'FPaw_L')
    # pattes arrière : énormes cuisses repliées
    def rl():
        o = {}
        o['th'] = concat([ell((2.3, 3.0, -3.0), 1.9, sq=(.7, 1.1, 1.4), segs=24, n=12, tile=1.5)])
        o['sh'] = rod([(2.3, 2.6, -4.0), (2.45, 1.6, -4.4), (2.3, .7, -3.5)], .78, .5, segs=14, tile=1.2, ref=(1, 0, 0))
        pw = [ell((2.3, .3, -2.3), .7, sq=(1, .3, 1.6), segs=16, n=9, tile=.8)]
        for i, dx in enumerate((-.6, -.2, .2, .6)):
            pw.append(rod([(2.3 + dx * .5, .26, -1.4), (2.3 + dx * 1.2, .2, -.6), (2.3 + dx * 1.5, .15, 0)], .13, .09, segs=7, tile=.3, n=8))
            pw.append(ell((2.3 + dx * 1.5, .14, .05), .17, sq=(1, .5, 1), segs=8, n=6, tile=.2))
        o['pw'] = concat(pw)
        return o
    Q = rl()
    R.add_sym('cuisse', Q['th'], 'skin', 'RUpper_L'); R.add_sym('jambe', Q['sh'], 'skin', 'RLower_L'); R.add_sym('pied', Q['pw'], 'belly', 'RPaw_L')
    # ---------------------------------------------------------- tête, mâchoires, yeux, gorge
    head = ell((0, 3.9, 3.7), 2.2, sq=(1.15, .62, 1.0), segs=36, n=18, tile=1.6)
    R.add('tete', head, 'skin', 'Head')
    R.add('museau_plat', ell((0, 3.4, 4.9), 1.6, sq=(1.1, .5, .9), segs=26, n=12, tile=1.2), 'skin', 'Head')
    jaw = ell((0, 2.35, 4.0), 2.0, sq=(1.1, .38, 1.15), segs=34, n=14, tile=1.4)
    R.add('machoire', jaw, 'belly', 'Jaw')
    R.add('gorge', ell((0, 1.6, 3.4), 1.3, sq=(1.1, .9, 1.1), segs=24, n=12, tile=1.0), 'belly', 'Jaw')
    for k in range(6): R.add('gorge_pustule', ell((np.sin(k * 1.1) * .8, 1.2, 3.4 + np.cos(k * 1.1) * .8), .22, segs=8, n=6, tile=.3), 'lamp', 'Jaw')
    inside = ell((0, 2.95, 4.3), 1.9, sq=(1.05, .1, 1.05), segs=30, n=7, tile=.8)
    R.add('palais', inside, 'mouth', 'Head'); R.add('langue', ell((0, 2.55, 4.1), 1.5, sq=(.75, .14, 1.0), segs=22, n=8, tile=.7), 'mouth', 'Jaw')
    # crocs : deux rangées
    for i, th in enumerate(np.linspace(-1.35, 1.35, 15)):
        x = 1.95 * np.sin(th); zz = 4.0 + 1.55 * np.cos(th) - .1
        L1 = RNG.uniform(.45, .85)
        R.add('croc_h', cone((x, 2.95, zz), (x * .95, 2.95 - L1, zz - .1), .1, segs=6, n=5, tile=.2, curve=.2), 'bone', 'Head')
        R.add('croc_b', cone((x * 1.0, 2.55, zz + .05), (x * .95, 2.55 + L1 * .9, zz - .05), .1, segs=6, n=5, tile=.2, curve=.2), 'bone', 'Jaw')
    for s in (1, -1):
        R.add('croc_long', cone((s * 1.0, 2.9, 5.35), (s * 1.0, 1.8, 5.5), .17, segs=7, n=7, tile=.3, curve=.3), 'bone', 'Head')
        R.add('croc_long_b', cone((s * 1.2, 2.5, 5.4), (s * 1.2, 3.7, 5.5), .17, segs=7, n=7, tile=.3, curve=.3), 'bone', 'Jaw')
    # yeux globuleux
    for s in (1, -1):
        R.add('orbite', ell((s * 1.35, 4.6, 3.3), .85, sq=(1, 1, 1), segs=20, n=12, tile=.8), 'skin', 'Head')
        R.add('globe', ell((s * 1.4, 4.8, 3.55), .62, segs=18, n=11, tile=.6), 'eye', 'Head')
        R.add('pupille', ell((s * 1.55, 4.85, 4.05), .22, sq=(.38, 1.3, .35), segs=8, n=7, tile=.3), 'bone', 'Head')
        R.add('narine', ell((s * .4, 4.1, 5.9), .13, sq=(1, 1, .6), segs=7, n=5, tile=.2), 'bone', 'Head')
        R.add('narine_b', ell((s * .4, 3.9, 5.75), .24, sq=(1, 1, .6), segs=8, n=5, tile=.3), 'skin', 'Head')
    # ---------------------------------------------------------- leurre : tige + lanterne
    R.add('tige_leurre1', rod([(0, 4.5, 3.5), (0, 5.0, 3.9), (0, 5.9, 4.4)], .22, .13, segs=10, tile=.4, n=10), 'skin', 'Lure1')
    R.add('tige_leurre2', rod([(0, 5.9, 4.4), (0, 6.8, 4.9), (0, 7.4, 5.5)], .13, .08, segs=8, tile=.3, n=10), 'skin', 'Lure2')
    R.add('tige_leurre3', rod([(0, 7.4, 5.5), (0, 7.8, 6.1), (0, 7.5, 6.5)], .08, .05, segs=6, tile=.3, n=8), 'bone', 'Lure3')
    R.add('lanterne', ell((0, 7.2, 6.8), .72, sq=(1, 1.15, 1), segs=22, n=14, tile=.5), 'lamp', 'Lure3')
    for k in range(8):
        a = k / 8 * 2 * PI
        R.add('cage', rod([(.0 + .35 * np.cos(a), 7.95, 6.8 + .35 * np.sin(a)), (.8 * np.cos(a), 7.2, 6.8 + .8 * np.sin(a)), (.35 * np.cos(a), 6.5, 6.8 + .35 * np.sin(a))], .035, .035, segs=5, tile=.2, n=8), 'bone', 'Lure3')
    R.add('lanterne_anneau', torus(.8, .06, axis='y', segs=24, rs=6), 'bone', 'Lure3'); xf(R.parts[-1][1], t=(0, 7.2, 6.8))
    for k in range(6): R.add('lanterne_frange', rod([(.2 * np.cos(k), 6.55, 6.8 + .2 * np.sin(k)), (.35 * np.cos(k), 5.9, 6.8 + .35 * np.sin(k))], .05, .02, segs=5, tile=.2, n=4), 'lamp', 'Lure3')
    return R, 10.0


def pose_fns():
    ex = [(['Lure1', 'Lure2', 'Lure3'], 'x', .18, .7, 1.2, 1.0, 0.0)]
    return quad_poses('bite', ex, f=.5, r=.6, bob=.07, drop=1.5)
