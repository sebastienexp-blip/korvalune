"""Boss de la Forêt des Ombres : le Roi-Cerf des Ombres (11,5 m). Colosse d'écorce et de racines, cage thoracique de racines autour d'un cœur
d'esprit vert, crâne de cerf aux orbites spectrales, ramure géante aux andouillers chargés de feux follets, manteau de mousse."""
import numpy as np
from boss_geo import *
from boss_rig import *

H = 11.5


def mats():
    return {
        'bark': mat('bark', T.fibers(31, (.17, .13, .10), (.42, .33, .24), aniso=(.08, 1.0), rough=.9, relief=7.0, dirt=.5), 'ant_bark', 1.8),
        'moss': mat('moss', T.fibers(32, (.05, .13, .04), (.18, .36, .09), aniso=(.3, .6), rough=.95, relief=4.0, dirt=.3), 'ant_moss', 1.0, metal=0.0),
        'bone': mat('bone', T.stone(33, (.55, .5, .4), (.88, .84, .72), cells=50, rough=.65, relief=5.0), 'ant_bone', 1.0, metal=0.0),
        'antler': mat('antler', T.stone(34, (.30, .24, .16), (.62, .54, .38), cells=40, rough=.7, relief=7.0, moss=(.1, .25, .06)), 'ant_antler', 1.4, metal=0.0),
        'glow': mat('glow', T.skin(35, (.1, .5, .22), (.3, .9, .5), vein=(.3, 1, .55), wet=True, relief=3.0, cells=100), 'ant_glow', 1.0, emissive=True, metal=0.0),
        'leaf': mat('leaf', T.skin(36, (.06, .22, .05), (.2, .5, .12), vein=None, wet=True, relief=3.0, cells=300), 'ant_leaf', 1.0, ds=True, metal=0.0),
        'hoof': mat('hoof', T.stone(37, (.02, .02, .025), (.12, .11, .12), cells=80, rough=.5, relief=4.0), 'ant_hoof', 1.0, metal=0.0),
    }


def antler(R, bone, base, d0, L, r, depth, rng, mats_=('antler',), glow=True):
    d0 = unit(np.asarray(d0, float)); base = np.asarray(base, float)
    mid = base + d0 * L * .5 + np.array([0, L * .12, 0]) + rng.normal(0, .05 * L, 3) * np.array([1, .3, 1])
    tip = base + d0 * L + np.array([0, L * .12, 0]) + rng.normal(0, .06 * L, 3) * np.array([1, .3, 1])
    path = [base, mid, tip]
    m = rod(path, r, r * .18, segs=10, tile=.8, n=12, prof_k=[(0, 1.0 * r), (.15, .9 * r), (.55, .6 * r), (1, .16 * r)])
    R.add('andouiller', m, 'antler', bone)
    # nœuds / burls
    for t in (.25, .5):
        c = base + (tip - base) * t
        R.add('noeud', ell(c, r * .95, sq=(1, 1.2, 1), segs=8, n=7, tile=.5), 'antler', bone)
    if depth > 0:
        for t, sgn, ang in ((.32, 1, .75), (.5, -1, .8), (.7, 1, .85), (.86, -1, .7)):
            c = base + (tip - base) * t
            ax = np.cross(d0, (0, 1, 0)); ax = unit(ax) if np.linalg.norm(ax) > 1e-6 else np.array([1., 0, 0])
            up = np.cross(ax, d0)
            nd = unit(d0 * np.cos(ang) + (ax * sgn * .55 + up * .85) * np.sin(ang) + rng.normal(0, .08, 3))
            antler(R, bone, c, nd, L * (.5 - .06 * t), r * .62, depth - 1, rng, mats_, glow)
    elif glow:
        pass
    return tip


def build():
    R = Rig()
    biped_bones(R, hip=4.9, spine=5.7, chest=6.7, neck=(8.0, .25), head=(8.4, .35), sh=(1.75, 7.9, 0), el=(2.35, 5.8, .2), hand=(2.4, 3.5, .6),
                th=(.85, 4.9, 0), kn=(.9, 2.6, .25), an=(.9, .7, .1))
    for i, (y, z) in enumerate(((7.6, -.7), (6.4, -.9), (5.2, -.9))): R.bone(f'Moss{i + 1}', 'Chest' if i == 0 else f'Moss{i}', (0, y, z))
    RNG.seed(21)
    # ----------------------------------------------------------- jambes : troncs + racines + sabots fendus
    def leg():
        o = {}
        th = [rod([(.85, 5.1, 0), (.9, 3.9, .1), (.9, 2.7, .25)], .78, .6, segs=16, tile=1.6, ref=(0, 0, 1), prof_k=[(0, .8), (.25, .72), (.6, .6), (1, .56)])]
        for k in range(7):
            a = k * .9; y = 4.6 - k * .35
            th.append(ell((.9 + .62 * np.cos(a), y, .62 * np.sin(a) + .1), .2 - .01 * k, sq=(1, 1.2, 1), segs=8, n=7, tile=.6))
        o['th'] = concat(th)
        # racines qui s'enroulent
        rt = []
        for k in range(5):
            a = k * 1.25
            rt.append(rod([(.9 + .5 * np.cos(a), 5.0, .5 * np.sin(a)), (.9 + .68 * np.cos(a + .9), 4.0, .68 * np.sin(a + .9)), (.9 + .6 * np.cos(a + 1.8), 3.0, .6 * np.sin(a + 1.8))], .1, .05, segs=6, tile=.4, n=10))
        o['rt'] = concat(rt)
        o['moss'] = concat([ell((.9 + .1, 4.4, .55), .5, sq=(1, .6, .5), segs=10, n=8, tile=.9), ell((1.2, 3.4, -.3), .45, sq=(.7, .8, .6), segs=10, n=8, tile=.9)])
        kn = [ell((.9, 2.6, .3), .62, sq=(1, .9, 1), segs=16, n=11, tile=1.2), cone((.9, 2.6, .85), (.9, 2.55, 1.6), .22, segs=8, n=6, tile=.5, curve=.2, bow=(0, .1, 0))]
        o['kn'] = concat(kn)
        sh = [rod([(.9, 2.55, .25), (.92, 1.6, .5), (.9, .85, .1)], .5, .3, segs=14, tile=1.3, ref=(0, 0, 1), prof_k=[(0, .52), (.3, .38), (.75, .27), (1, .3)])]
        for k in range(4): sh.append(cone((.9 + .22 * np.cos(k * 1.6), 2.1 - k * .4, .5 + .22 * np.sin(k * 1.6)), (.9 + .5 * np.cos(k * 1.6), 1.7 - k * .4, .5 + .55 * np.sin(k * 1.6)), .1, segs=6, n=4, tile=.3))
        o['sh'] = concat(sh)
        ft = [ell((.9, .45, .35), .55, sq=(.8, .8, 1.35), segs=16, n=10, tile=.8)]
        for dx in (-.26, .26):
            ft.append(rod([(.9 + dx, .55, .7), (.9 + dx * 1.2, .3, 1.3), (.9 + dx * 1.3, .05, 1.6)], .24, .16, segs=8, tile=.5, n=8, ratio=.7))
        o['ft'] = concat(ft)
        return o
    L = leg()
    R.add_sym('cuisse', L['th'], 'bark', 'Thigh_L'); R.add_sym('racine', L['rt'], 'bark', 'Thigh_L'); R.add_sym('mousse_j', L['moss'], 'moss', 'Thigh_L')
    R.add_sym('genou', L['kn'], 'bark', 'Shin_L'); R.add_sym('tibia', L['sh'], 'bark', 'Shin_L')
    ft = L['ft']; R.add_sym('sabot', ft, 'hoof', 'Foot_L')
    for sd, s in (('L', 1), ('R', -1)):
        for k in range(6):
            a = -.9 + k * .36
            R.add('racine_pied', rod([(s * (.9 + .4 * np.sin(a)), .5, .2 + .4 * np.cos(a)), (s * (.9 + .75 * np.sin(a)), .2, .2 + .85 * np.cos(a)), (s * (.9 + 1.1 * np.sin(a)), .02, .2 + 1.3 * np.cos(a))], .09, .03, segs=6, tile=.3, n=8), 'bark', f'Foot_{sd}')
    # ----------------------------------------------------------- bassin + ventre
    R.add('bassin', ell((0, 5.0, 0), 1.35, sq=(1.1, .6, .85), segs=28, n=12, tile=1.8), 'bark', 'Hips')
    R.add('jupe_mousse', concat([ell((0, 4.6, 0), 1.45, sq=(1.1, .35, .9), segs=28, n=9, tile=1.6)]), 'moss', 'Hips')
    for k in range(18):
        a = k / 18 * 2 * PI
        R.add('liane', rod([(1.3 * np.cos(a), 4.7, 1.1 * np.sin(a)), (1.4 * np.cos(a), 3.9, 1.2 * np.sin(a)), (1.45 * np.cos(a) + .1, 3.2 - .3 * (k % 3), 1.25 * np.sin(a))], .07, .02, segs=5, tile=.3, n=7), 'moss', 'Hips')
    # ----------------------------------------------------------- torse : écorce + cage de racines + cœur d'esprit
    n = 14; y = np.linspace(5.4, 8.0, n)
    path = np.stack([np.zeros(n), y, np.zeros(n)], 1)
    rf = prof([(0, 1.1), (.3, 1.35), (.65, 1.7), (.9, 1.5), (1, 1.0)], n); rs = prof([(0, 1.3), (.3, 1.6), (.6, 2.0), (.9, 2.0), (1, 1.4)], n)
    R.add('torse', open_loft(Loft(path, rf, rs, p=2.5, segs=48, cap0=1, cap1=1, tile=1.8, ref=(0, 0, 1)), 125, 415), 'bark', 'Chest')
    R.add('coeur', ell((0, 6.75, .5), 1.0, sq=(.9, 1.05, .85), segs=28, n=14, tile=1.0), 'glow', 'Chest')
    for k in range(6):
        a = k * 1.05
        R.add('coeur_vrille', rod([(.55 * np.cos(a), 6.75 + .6 * np.sin(a), .9), (.9 * np.cos(a), 6.75 + .95 * np.sin(a), 1.25), (1.3 * np.cos(a), 6.75 + 1.3 * np.sin(a), .9)], .08, .04, segs=6, tile=.3, n=10), 'glow', 'Chest')
    for k in range(5):
        yy = 5.7 + k * .55
        for s in (1, -1):
            wid = 1.9 + .35 * np.sin(k * .5)
            pts = [(s * .15, yy + .22, 1.45), (s * wid * .55, yy + .1, 1.78), (s * wid * 1.0, yy - .05, 1.0), (s * wid * 1.05, yy - .1, -.3)]
            R.add('cote', rod(pts, .16, .1, segs=8, tile=.6, n=14), 'bark', 'Chest')
    R.add('sternum', rod([(0, 8.0, 1.5), (0, 6.8, 1.82), (0, 5.5, 1.5)], .2, .2, segs=8, tile=.6, n=14), 'bark', 'Chest')
    R.add('colonne', rod([(0, 5.4, -1.35), (0, 6.7, -1.75), (0, 8.0, -1.4)], .32, .28, segs=10, tile=.8, n=14), 'bark', 'Chest')
    for k in range(7):    # champignons-consoles sur le dos
        yy = 5.8 + k * .33; a = (k % 2) * .5
        R.add('console', ell((-.5 + a + .2 * np.sin(k), yy, -1.55 - .05 * k), .5 - .03 * k, sq=(1.3, .16, .9), segs=14, n=7, tile=.5), 'moss', 'Chest')
    # manteau de mousse pendante
    for k in range(20):
        x0 = -2.3 + k * .24; ln = 3.0 + 1.5 * RNG.rand()
        R.add('mousse_pendante', rod([(x0, 7.8, -1.0), (x0 * 1.05, 7.8 - ln * .45, -1.5), (x0 * 1.1, 7.8 - ln, -1.7)], .13, .03, segs=6, tile=.4, n=8), 'moss', 'Moss1')
    # ----------------------------------------------------------- épaules, bras de branches, mains-ronces
    def arm():
        o = {}
        sh = [ell((2.0, 8.0, 0), .95, sq=(1.1, .9, 1), segs=20, n=12, tile=1.2)]
        for k in range(5):
            a = k * 1.3
            sh.append(ell((2.0 + .8 * np.cos(a), 8.2 + .3 * np.sin(a * 2), .75 * np.sin(a)), .26, segs=8, n=7, tile=.5))
        sh.append(rod([(2.1, 8.7, 0), (2.4, 9.6, -.3), (2.9, 10.3, -.2)], .2, .06, segs=8, tile=.5, n=10))
        sh.append(rod([(2.0, 8.8, .3), (2.2, 9.5, .7), (2.0, 10.1, 1.0)], .14, .04, segs=8, tile=.5, n=10))
        o['sh'] = concat(sh)
        up = [rod([(1.9, 7.9, 0), (2.2, 6.9, .1), (2.35, 5.8, .2)], .62, .5, segs=14, tile=1.4, ref=(0, 0, 1))]
        for k in range(4): up.append(ell((2.2 + .5 * np.cos(k * 1.7), 7.2 - k * .45, .1 + .5 * np.sin(k * 1.7)), .2, segs=8, n=7, tile=.5))
        o['up'] = concat(up)
        o['el'] = concat([ell((2.35, 5.8, .2), .62, segs=14, n=10, tile=1.0), rod([(2.55, 5.9, .3), (3.4, 6.5, .5), (4.0, 7.3, .4)], .22, .05, segs=8, tile=.5, n=10)])
        fo = [rod([(2.35, 5.75, .2), (2.4, 4.6, .4), (2.4, 3.6, .6)], .52, .38, segs=14, tile=1.3, ref=(0, 0, 1))]
        for k in range(4): fo.append(ell((2.4 + .42 * np.cos(k * 1.9), 5.2 - k * .5, .4 + .42 * np.sin(k * 1.9)), .16, segs=8, n=7, tile=.5))
        o['fo'] = concat(fo)
        return o
    A = arm()
    R.add_sym('epaule', A['sh'], 'bark', 'Arm_L'); R.add_sym('bras', A['up'], 'bark', 'Arm_L'); R.add_sym('coude', A['el'], 'bark', 'Fore_L'); R.add_sym('avantbras', A['fo'], 'bark', 'Fore_L')
    R.add_sym('mousse_ep', ell((2.0, 8.75, .1), .7, sq=(1.1, .35, .9), segs=14, n=8, tile=.8), 'moss', 'Arm_L')

    def hand():
        g = [ell((2.4, 3.4, .65), .45, sq=(.9, 1.0, .9), segs=14, n=9, tile=.6)]
        for i, dx in enumerate((-.3, -.1, .1, .3)):
            g.append(rod([(2.4 + dx, 3.2, .7), (2.4 + dx * 1.6, 2.4, 1.2 - abs(dx)), (2.4 + dx * 2.2, 1.6, 1.5 - abs(dx) * 1.2)], .13, .03, segs=7, tile=.3, n=10, prof_k=[(0, .13), (.5, .1), (1, .02)]))
        g.append(rod([(2.75, 3.4, .7), (3.1, 2.8, 1.1), (3.2, 2.3, 1.4)], .12, .03, segs=7, tile=.3, n=8))
        return concat(g)
    R.add_sym('main', hand(), 'bark', 'Hand_L')
    # ----------------------------------------------------------- cou, crâne de cerf, oreilles, ramure
    R.add('cou', rod([(0, 7.8, .1), (0, 8.4, .35)], .85, .7, segs=16, tile=1.0, ref=(0, 0, 1)), 'bark', 'Neck')
    R.add('crinière', concat([tuft((0, 8.2, -.6), (0, .6, -1), n=1, L=.1)]), 'moss', 'Neck') if False else None
    for k in range(30):
        a = -PI * .6 + k * PI * 1.2 / 29
        R.add('feuille_cou', plate((1.05 * np.sin(a), 8.05 + .15 * np.cos(k), -.3 + .9 * np.cos(a) * 0.9), .5, 1.0, th=.03, bend=.12, rot=(-.4 + .3 * np.sin(k), a * .8, .2 * np.cos(k * 2)), tile=.5), 'leaf', 'Neck')
    # crâne : cranium + museau allongé + dents
    cr = ell((0, 9.0, .5), .95, sq=(.9, .95, 1.15), segs=36, n=22, tile=1.0)
    for s in (1, -1): dent(cr, s * .45, 9.1, .26, .3, .2, zmin=.2)
    HEAD0 = len(R.parts)
    R.add('crane', cr, 'bone', 'Head')
    n = 22; zz = np.linspace(1.0, 3.0, n)
    mp = np.stack([np.zeros(n), np.linspace(9.0, 8.2, n), zz], 1)
    mrf = prof([(0, .62), (.3, .5), (.7, .36), (1, .3)], n); mrs = prof([(0, .66), (.3, .5), (.7, .36), (1, .3)], n)
    mz = Loft(mp, mrs, mrf, p=2.4, segs=28, cap0=0, cap1=1, tile=.9, ref=(0, 1, 0)).mesh()
    for s in (1, -1): dent(mz, s * .36, 8.7, .1, .12, .12)
    R.add('museau', mz, 'bone', 'Head')
    for s in (1, -1):
        R.add('orbite', revolve([(0, .02), (.26, .0), (.3, .14), (.32, .3)], segs=20), 'hoof', 'Head'); xf(R.parts[-1][1], t=(s * .5, 9.15, 1.28), ry=s * .55)
        R.add('oeil', ell((s * .5 - s * .05, 9.15, 1.34), .14, segs=10, n=7, tile=.3), 'glow', 'Head')
        R.add('arcade', rod([(s * .86, 9.45, .9), (s * .56, 9.55, 1.4), (s * .2, 9.4, 1.55)], .12, .06, segs=8, tile=.4, n=10), 'bone', 'Head')
        R.add('narine', ell((s * .12, 8.15, 3.0), .1, sq=(.7, 1, .5), segs=8, n=6, tile=.2), 'hoof', 'Head')
        # oreille-feuille
        R.add('oreille', plate((s * 1.15, 9.2, .1), .7, 1.7, th=.06, bend=.2, rot=(-.5, s * .9, s * .5), tile=.8), 'leaf', 'Head')
    for k in range(8):   # dents de herbivore + crocs
        x = -.2 + k * .05
    for s in (1, -1):
        for k in range(5):
            R.add('dent', cone((s * .22, 8.2 + .02, 2.4 - k * .22), (s * .22, 7.82, 2.4 - k * .22), .06, segs=5, n=3, tile=.1), 'bone', 'Head')
        R.add('croc', cone((s * .24, 8.2, 2.85), (s * .26, 7.5, 2.9), .08, segs=6, n=5, tile=.2), 'bone', 'Head')
    # mâchoire
    R.add('machoire', rod([(0, 8.05, .8), (0, 7.75, 1.7), (0, 7.8, 2.8)], .4, .22, segs=16, tile=.8, ref=(0, 1, 0), ratio=1.4), 'bone', 'Head')
    # ramure : deux grands bois branchus
    rng = np.random.RandomState(7)
    for s in (1,):
        pass
    tip_pts = []
    for sx in (1, -1):
        rngl = np.random.RandomState(7)
        sub = Rig(); sub.B = R.B
        before = len(R.parts)
        antler(R, 'Head', (sx * .55, 9.9, .2), (sx * .85, .62, -.12), 4.6, .3, 2, rngl)
        for nm, m, mt in R.parts[before:]:
            pass
    # feux follets suspendus aux andouillers
    for sx in (1, -1):
        for k, (x, y, z) in enumerate(((1.7, 12.0, 0), (2.5, 13.1, .3), (1.2, 13.4, .2), (3.2, 12.6, -.2))):
            c = (sx * x, y - 2.0, z + .3)
            R.add('follet', ell(c, .18, segs=10, n=7, tile=.3), 'glow', 'Head')
            R.add('fil', rod([(sx * x, y - 1.6, z + .3), (sx * x, y - 1.85, z + .3)], .012, .012, segs=4, n=3, tile=.1), 'moss', 'Head')
    c0 = np.array([0, 8.9, .5])
    for nm, m, mt in R.parts[HEAD0:]:
        m.V = (m.V - c0) * 1.4 + c0
    for nm, m, mt in R.parts[HEAD0:]:
        m.V[:, 1] += 0.0
    return R, H


def pose_fns():
    ex = [(['Moss1', 'Moss2', 'Moss3'], 'x', .12, .6, 1.0, 1.0, .1)]
    return biped_poses('slam', ex, arm=.3, leg=.45, bob=.12, lean=.03, drop=3.0)
