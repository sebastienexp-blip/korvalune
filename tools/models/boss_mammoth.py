"""Boss de la Toundra de Givre : le Mammouth de Givre (11 m au garrot). Colosse laineux cuirassé de glace : défenses de cristal à cœur lumineux,
échine hérissée d'éclats, trompe annelée, pelage en mèches pendantes, pattes-piliers chaussées de givre."""
import numpy as np
from boss_geo import *
from boss_rig import *


def mats():
    return {
        'fur': mat('fur', T.fibers(71, (.20, .15, .11), (.52, .45, .38), aniso=(.05, 1.0), rough=.95, relief=5.0, dirt=.4), 'mm_fur', 1.4, metal=0.0),
        'snow': mat('snow', T.fibers(72, (.72, .78, .84), (.96, .98, 1.0), aniso=(.08, .9), rough=.9, relief=3.0, dirt=.15), 'mm_snow', 1.0, metal=0.0),
        'skin': mat('skin', T.skin(73, (.28, .24, .24), (.42, .36, .34), wet=False, relief=6.0, cells=140), 'mm_skin', 1.4, metal=0.0),
        'ice': mat('ice', T.stone(74, (.28, .50, .66), (.80, .94, 1.0), crack=(.3, .85, 1.0), cells=40, rough=.18, relief=6.0), 'mm_ice', 1.2, emissive=True, metal=0.2),
        'tusk': mat('tusk', T.stone(75, (.62, .78, .86), (.96, 1.0, 1.0), crack=(.4, .9, 1.0), cells=30, rough=.15, relief=3.0), 'mm_tusk', .9, emissive=True, metal=0.1),
        'bone': mat('bone', T.stone(76, (.5, .46, .38), (.86, .82, .72), cells=40, rough=.6, relief=4.0), 'mm_bone', 1.0, metal=0.0),
        'eye': mat('eye', T.skin(77, (.2, .7, 1.0), (.7, 1.0, 1.0), vein=(.5, .9, 1), wet=True, relief=1.0, cells=50), 'mm_eye', 1.0, emissive=True, metal=0.0),
    }


def build():
    R = Rig()
    quad_bones(R, hip=(0, 5.0, -3.6), spine=(0, 5.5, -1.0), chest=(0, 5.8, 1.5), neck=(0, 5.6, 3.3), head=(0, 6.2, 4.2),
               front=(1.9, (5.2, 1.8), (3.0, 2.0), (.8, 2.0)), rear=(2.0, (5.0, -3.6), (2.8, -3.4), (.8, -3.6)),
               tail=[(0, 6.0, -5.6), (0, 5.0, -6.6)], trunk=[(0, 5.0, 5.7), (0, 3.6, 6.7), (0, 2.2, 7.1), (0, 1.0, 6.9)])
    RNG.seed(12)
    # ---------------------------------------------------------- corps massif
    n = 22; z = np.linspace(-5.2, 3.2, n)
    path = np.stack([np.zeros(n), 5.1 + .55 * np.exp(-((z - .8) / 2.2) ** 2) - .3 * np.exp(-((z + 4.5) / 1.5) ** 2), z], 1)
    rf = prof([(0, 2.0), (.2, 2.9), (.45, 3.0), (.75, 3.1), (1, 2.4)], n); rs = prof([(0, 1.8), (.2, 2.7), (.5, 3.0), (.8, 3.0), (1, 2.3)], n)
    R.add('corps', Loft(path, rf, rs, p=2.3, segs=44, cap0=1, cap1=1, tile=2.2, ref=(0, 1, 0)).mesh(), 'skin', 'Spine')
    R.add('bosse', ell((0, 8.3, 0.3), 2.3, sq=(1.1, .8, 1.2), segs=30, n=14, tile=1.8), 'fur', 'Chest')
    R.add('croupe', ell((0, 5.3, -4.3), 2.4, sq=(1.1, 1.1, 1.0), segs=26, n=12, tile=1.8), 'fur', 'Hips')
    # pelage : franges pendantes + touffes sur le dos
    for k in range(260):
        zz = RNG.uniform(-5.4, 3.2); a = RNG.uniform(-PI * .95, PI * .95)
        i = min(max(int((zz + 5.2) / 8.4 * (n - 1)), 0), n - 1)
        b0 = np.array([rs[i] * np.sin(a) * .98, path[i][1] + rf[i] * np.cos(a) * .98, zz])
        out = np.array([np.sin(a), np.cos(a) * .3, 0]); down = np.array([0, -1, 0])
        ln = RNG.uniform(1.2, 3.0) * (1.4 if abs(a) > 1.2 else .6)
        tip = b0 + out * .5 + down * ln
        bn = 'Spine' if zz > -2.5 else 'Hips'
        if zz > 1.5: bn = 'Chest'
        R.add('meche', cone(b0, tip, .22, segs=5, n=5, tile=.5, curve=.3, bow=(out[0] * .3, -.1, 0)), 'fur' if RNG.rand() > .2 else 'snow', bn)
    # neige sur le dos
    for k in range(18):
        zz = RNG.uniform(-4.5, 2.5); i = min(max(int((zz + 5.2) / 8.4 * (n - 1)), 0), n - 1); a = RNG.uniform(-.7, .7)
        R.add('neige', ell([rs[i] * np.sin(a) * .85, path[i][1] + rf[i] * np.cos(a) * .96, zz], RNG.uniform(.6, 1.3), sq=(1, .25, 1.1), segs=10, n=6, tile=.6), 'snow', 'Spine')
    # armure de glace : éclats le long de l'échine et plaques sur les épaules
    for k in range(14):
        zz = -4.6 + k * .62; i = min(max(int((zz + 5.2) / 8.4 * (n - 1)), 0), n - 1)
        y0 = path[i][1] + rf[i] * .97 + (.3 if 2 < k < 8 else 0)
        h = 1.6 + 1.6 * np.exp(-((k - 7) / 4) ** 2) + RNG.uniform(0, .6)
        R.add('eclat', cone((0, y0 - .2, zz), (RNG.normal(0, .25), y0 + h, zz - .5), .5, segs=6, n=5, tile=.5, curve=.2), 'ice', 'Spine' if zz > -2.5 else 'Hips')
        for s in (1, -1):
            R.add('eclat_p', cone((s * .8, y0 - .35, zz), (s * (1.2 + .4 * RNG.rand()), y0 + h * .55, zz - .4), .3, segs=6, n=4, tile=.4, curve=.2), 'ice', 'Spine' if zz > -2.5 else 'Hips')
    for s in (1, -1):
        for k in range(5):
            R.add('plaque_epaule', plate((s * (2.3 + .1 * k), 7.3 - .38 * k, 1.9), 1.5 - .1 * k, .8, th=.22, bend=.3, rot=(.3, s * .3, -s * (.5 + .1 * k)), tile=.9), 'ice', 'Chest')
        for k in range(4):
            R.add('eclat_epaule', cone((s * (2.9 + .1 * k), 7.5 - .1 * k, 1.5 + .35 * k), (s * (3.9 + .3 * k), 9.2 - .25 * k, 1.1 + .35 * k), .32, segs=6, n=5, tile=.4, curve=.3), 'ice', 'Chest')
    # ---------------------------------------------------------- pattes-piliers
    def lg(front=True):
        o = {}
        x = 1.9 if front else 2.0
        if front:
            o['up'] = rod([(x, 5.4, 1.8), (x, 4.2, 1.95), (x, 3.0, 2.0)], 1.55, 1.2, segs=18, tile=1.5, ref=(0, 0, 1))
            o['lo'] = rod([(x, 3.0, 2.0), (x, 1.9, 2.0), (x, .9, 2.0)], 1.2, 1.0, segs=18, tile=1.4, ref=(0, 0, 1))
            ft = [ell((x, .45, 2.3), 1.25, sq=(.95, .5, 1.25), segs=22, n=10, tile=1.0)]
            for dx in (-.65, -.22, .22, .65): ft.append(cone((x + dx, .3, 3.6), (x + dx * 1.1, .12, 4.1), .22, segs=7, n=4, tile=.3, ratio=1.3))
            o['ft'] = concat(ft)
        else:
            o['up'] = concat([ell((x, 5.3, -3.6), 2.1, sq=(.8, 1.0, 1.15), segs=22, n=12, tile=1.5), rod([(x, 4.8, -3.6), (x, 3.8, -3.5), (x, 2.8, -3.4)], 1.4, 1.15, segs=18, tile=1.4, ref=(0, 0, 1))])
            o['lo'] = rod([(x, 2.8, -3.4), (x, 1.8, -3.5), (x, .9, -3.6)], 1.15, 1.0, segs=18, tile=1.4, ref=(0, 0, 1))
            ft = [ell((x, .45, -3.3), 1.25, sq=(.95, .5, 1.25), segs=22, n=10, tile=1.0)]
            for dx in (-.65, -.22, .22, .65): ft.append(cone((x + dx, .3, -2.0), (x + dx * 1.1, .12, -1.5), .22, segs=7, n=4, tile=.3, ratio=1.3))
            o['ft'] = concat(ft)
        return o
    F = lg(True); Q = lg(False)
    R.add_sym('bras', F['up'], 'fur', 'FUpper_L'); R.add_sym('avantbras', F['lo'], 'fur', 'FLower_L'); R.add_sym('pied', F['ft'], 'bone', 'FPaw_L')
    R.add_sym('cuisse', Q['up'], 'fur', 'RUpper_L'); R.add_sym('jambe', Q['lo'], 'fur', 'RLower_L'); R.add_sym('pied_ar', Q['ft'], 'bone', 'RPaw_L')
    for sd, s in (('L', 1), ('R', -1)):
        for nm, y, zc, rr, bn in (('botte', 1.5, 2.0, 1.15, f'FLower_{sd}'), ('botte_ar', 1.5, -3.55, 1.12, f'RLower_{sd}')):
            xx = s * (1.9 if 'ar' not in nm else 2.0)
            R.add(nm, concat([torus(rr, .26, axis='y', segs=26, rs=8)]), 'ice', bn); xf(R.parts[-1][1], t=(xx, y + .3, zc))
            for k in range(7):
                a = k / 7 * 2 * PI
                R.add(nm + '_pic', cone((xx + rr * np.cos(a), y + .55, zc + rr * np.sin(a)), (xx + (rr + .5) * np.cos(a), y + 1.5, zc + (rr + .5) * np.sin(a)), .15, segs=5, n=4, tile=.3), 'ice', bn)
    # queue
    R.add('queue1', rod([(0, 6.0, -5.5), (0, 5.4, -6.2)], .55, .4, segs=10, tile=.5, n=5), 'fur', 'Tail1')
    R.add('queue2', cone((0, 5.4, -6.2), (0, 3.8, -7.0), .45, segs=8, n=6, tile=.5, curve=.2), 'fur', 'Tail2')
    # ---------------------------------------------------------- tête, oreilles, défenses, trompe
    R.add('cou', ell((0, 6.1, 3.4), 2.0, sq=(1.1, 1.1, 1.0), segs=24, n=12, tile=1.5), 'fur', 'Neck')
    R.add('crane', ell((0, 7.0, 4.4), 2.0, sq=(.95, 1.1, 1.0), segs=32, n=16, tile=1.5), 'skin', 'Head')
    R.add('front', ell((0, 8.1, 4.6), 1.5, sq=(1.0, .8, 1.0), segs=24, n=12, tile=1.2), 'fur', 'Head')
    for s in (1, -1):
        R.add('joue', ell((s * 1.3, 6.1, 4.8), 1.0, sq=(.7, .8, 1.0), segs=14, n=8, tile=.9), 'skin', 'Head')
        R.add('oeil', ell((s * 1.45, 7.0, 5.0), .22, sq=(.5, 1, 1), segs=10, n=7, tile=.3), 'eye', 'Head')
        R.add('arcade', rod([(s * 1.7, 7.4, 4.5), (s * 1.5, 7.35, 5.0), (s * 1.0, 7.3, 5.4)], .26, .15, segs=8, tile=.4, n=8), 'skin', 'Head')
        R.add('oreille', plate((s * 2.2, 7.1, 3.8), 2.3, 3.2, th=.25, bend=.5, rot=(0, s * -.7, s * .3), tile=1.2), 'skin', 'Head')
        R.add('oreille_fourrure', plate((s * 2.35, 7.15, 3.75), 2.0, 2.8, th=.3, bend=.7, rot=(0, s * -.7, s * .3), tile=1.0), 'fur', 'Head')
        # défense
        R.add('defense', rod([(s * 1.1, 6.1, 5.0), (s * 2.3, 5.2, 6.4), (s * 3.2, 4.2, 8.4), (s * 2.4, 5.2, 10.6), (s * 1.3, 7.0, 11.4)], .5, .06, segs=12, tile=.9, n=24,
                               prof_k=[(0, .56), (.2, .5), (.6, .36), (.9, .18), (1, .04)]), 'tusk', 'Head')
        for t in (.08, .22, .38):
            pts = smoothpath([(s * 1.1, 6.1, 5.0), (s * 2.3, 5.2, 6.4), (s * 3.2, 4.2, 8.4), (s * 2.4, 5.2, 10.6), (s * 1.3, 7.0, 11.4)], 30)
            i = int(t * 29); R.add('defense_b', torus(.55 - .5 * t, .09, axis='z', segs=16, rs=6), 'ice', 'Head'); orient_z(R.parts[-1][1], unit(pts[i + 1] - pts[i]), pts[i])
        for k in range(5):
            R.add('crystal_tusk', cone((s * 2.5, 4.9 - .1 * k, 7.0 + .4 * k), (s * (3.1 + .2 * k), 5.0 - .5 * k, 6.8 + .5 * k), .16, segs=5, n=4, tile=.3), 'ice', 'Head')
    # couronne de cristaux sur le front
    for k in range(7):
        a = -1.2 + k * .4
        R.add('couronne', cone((np.sin(a) * 1.1, 8.6, 4.2 + np.cos(a) * .5), (np.sin(a) * 1.8, 10.2 + .5 * np.cos(a * 2), 3.8), .38, segs=6, n=5, tile=.4, curve=.2), 'ice', 'Head')
    # trompe annelée
    tr = [(0, 6.5, 5.5), (0, 5.0, 5.9), (0, 3.6, 6.9), (0, 2.2, 7.3), (0, 1.0, 7.1)]
    for i, nm in enumerate(('Head', 'Trunk1', 'Trunk2', 'Trunk3')):
        pa = np.array(tr[i]); pb = np.array(tr[i + 1]); r0 = .85 - .17 * i; r1 = .85 - .17 * (i + 1)
        R.add('trompe', rod([pa, (pa + pb) / 2, pb], r0, r1, segs=14, tile=.7, n=6, ref=(1, 0, 0)), 'skin', nm if i else 'Head')
        for t in np.linspace(.15, .85, 4):
            c = pa + (pb - pa) * t; R.add('pli', torus(r0 + (r1 - r0) * t + .04, .06, axis='z', segs=16, rs=5), 'skin', nm if i else 'Head'); orient_z(R.parts[-1][1], unit(pb - pa), c)
    R.add('trompe_bout', cone((0, 1.2, 7.1), (0, .35, 6.9), .4, segs=10, n=5, tile=.4), 'skin', 'Trunk3')
    R.add('doigt', cone((0, .9, 7.3), (0, .3, 7.8), .1, segs=6, n=4, tile=.2), 'bone', 'Trunk3')
    return R, 10.0


def pose_fns():
    ex = [(['Tail1', 'Tail2'], 'y', .25, .5, 1.0, 1.0, 0.0), (['Trunk1', 'Trunk2', 'Trunk3'], 'x', .14, .7, 1.0, 1.0, 0.12)]
    return quad_poses('gore', ex, f=.35, r=.35, bob=.08, drop=2.5)
