"""Boss du Néant Primordial : l'Œil du Néant (13 m de haut, en lévitation). Globe oculaire veineux à iris de braise et pupille fendue, cadre de
pierre-vide, trois anneaux runiques en rotation, huit tentacules à crochets, éclats de vide en orbite."""
import numpy as np
from boss_geo import *
from boss_rig import *

CY = 7.0


def mats():
    return {
        'flesh': mat('flesh', T.skin(111, (.55, .50, .55), (.85, .78, .82), spots=(.5, .2, .35), vein=(.7, .2, 1.0), wet=True, relief=4.0, cells=150), 'ey_flesh', 1.0, emissive=True, metal=0.0),
        'iris': mat('iris', T.skin(112, (.9, .3, .05), (1.0, .75, .2), vein=(1, .8, .3), wet=False, relief=3.0, cells=40), 'ey_iris', 1.0, emissive=True, metal=0.0),
        'void': mat('void', T.void(113), 'ey_void', 1.0, emissive=True, metal=0.2),
        'stone': mat('stone', T.stone(114, (.05, .03, .09), (.22, .14, .32), crack=(.7, .3, 1.0), cells=60, rough=.5, relief=6.0), 'ey_stone', 1.3, emissive=True, metal=0.0),
        'glow': mat('glow', T.skin(115, (.6, .25, 1.0), (.95, .7, 1.0), vein=(.9, .6, 1), wet=False, relief=1.5, cells=60), 'ey_glow', 1.0, emissive=True, metal=0.0),
        'tent': mat('tent', T.skin(116, (.12, .05, .2), (.3, .14, .42), spots=(.5, .2, .6), vein=(.7, .3, 1.0), wet=True, relief=5.0, cells=120), 'ey_tent', 1.2, emissive=True, metal=0.0),
        'bone': mat('bone', T.stone(117, (.45, .4, .5), (.82, .78, .86), cells=40, rough=.5, relief=4.0), 'ey_bone', 1.0, metal=0.0),
    }


def build():
    R = Rig()
    R.bone('Root', None, (0, 0, 0)); R.bone('Core', 'Root', (0, CY, 0)); R.bone('Orbit', 'Root', (0, CY, 0))
    R.bone('Pupil', 'Core', (0, CY, 2.6))
    for i in (1, 2, 3): R.bone(f'Ring{i}', 'Core', (0, CY, 0))
    NT = 8
    for i in range(NT):
        a = i / NT * 2 * PI; x, z = 1.9 * np.sin(a), 1.9 * np.cos(a)
        prev = 'Core'
        for j in range(4):
            nm = f'T{i}_{j}'; R.bone(nm, prev, (x * (1 + .3 * j), CY - 2.2 - j * 1.35, z * (1 + .3 * j))); prev = nm
    RNG.seed(5)
    # ---------------------------------------------------------- globe
    R.add('globe', ell((0, CY, 0), 3.0, segs=44, n=26, tile=1.8), 'flesh', 'Core')
    zz = lambda r: np.sqrt(max(3.03 ** 2 - r * r, .01))
    rr = [0, .3, .7, 1.1, 1.5, 1.9, 2.25, 2.5]
    R.add('iris', revolve([(r, zz(r)) for r in rr], segs=48, tile=1.0), 'iris', 'Pupil'); xf(R.parts[-1][1], t=(0, CY, 0))
    R.add('limbe', revolve([(2.4, zz(2.4)), (2.5, zz(2.5) + .02), (2.7, zz(2.7) + .01), (2.85, zz(2.85))], segs=48, tile=1.0), 'stone', 'Pupil'); xf(R.parts[-1][1], t=(0, CY, 0))
    R.add('pupille', revolve([(0, zz(0) + .12), (.28, zz(.28) + .1), (.5, zz(.5) + .05), (.65, zz(.65))], segs=24, tile=.5), 'void', 'Pupil'); xf(R.parts[-1][1], t=(0, CY, 0), s=(1, 1, 1))
    R.parts[-1][1].V[:, 1] = (R.parts[-1][1].V[:, 1] - CY) * 2.6 + CY
    R.parts[-1][1].V[:, 0] *= .55
    R.add('cornee', ell((0, CY, 2.2), 1.9, sq=(1.0, 1.0, .55), segs=26, n=14, tile=1.0), 'iris', 'Pupil') if False else None
    # veines en relief
    for k in range(34):
        th0 = RNG.uniform(.2, PI - .2); ph0 = RNG.uniform(-PI * .9, PI * .9)
        pts = []
        for t in np.linspace(0, 1, 7):
            th = th0 + .5 * np.sin(t * 5 + k) * .3 + t * RNG.uniform(-.5, .5); ph = ph0 + t * RNG.uniform(-1.2, 1.2)
            r = 3.05
            p = np.array([r * np.sin(th) * np.sin(ph), CY + r * np.cos(th) * 1.0, r * np.sin(th) * np.cos(ph)])
            if p[2] > 2.2 and abs(p[0]) < 2.3 and abs(p[1] - CY) < 2.3: p = np.array([p[0] * 1.2, p[1], -abs(p[2])]) if False else p * np.array([1.15, 1.0, .3]) + np.array([0, CY * 0, 0])
            pts.append(p)
        R.add('veine', rod(pts, .09 + .05 * RNG.rand(), .05, segs=6, tile=.3, n=14), 'tent' if k % 3 else 'glow', 'Core')
    # cadre-paupières de pierre-vide
    R.add('orbite', torus(3.45, .5, axis='z', segs=48, rs=12, tile=.8), 'stone', 'Core'); xf(R.parts[-1][1], t=(0, CY, .9), s=(1.0, 1.0, 1.0))
    R.add('orbite_int', torus(3.1, .22, axis='z', segs=44, rs=8), 'glow', 'Core'); xf(R.parts[-1][1], t=(0, CY, 1.55))
    for k in range(14):
        a = k / 14 * 2 * PI
        R.add('cil', cone((3.4 * np.cos(a), CY + 3.4 * np.sin(a), 1.0), (4.6 * np.cos(a), CY + 4.6 * np.sin(a), .2), .3, segs=5, n=6, tile=.4, curve=.2), 'stone', 'Core')
    for k in range(7):
        a = k / 7 * 2 * PI + .2
        R.add('couronne', cone((2.0 * np.cos(a), CY + 2.7, 2.0 * np.sin(a) - .6), (2.4 * np.cos(a), CY + 4.4 + .5 * np.sin(k), 2.4 * np.sin(a) - 1.0), .3, segs=5, n=6, tile=.4), 'bone', 'Core')
    # ---------------------------------------------------------- anneaux
    R.add('anneau1', torus(4.9, .3, axis='z', segs=56, rs=10, tile=.8), 'stone', 'Ring1'); xf(R.parts[-1][1], t=(0, CY, 0))
    for k in range(18):
        a = k / 18 * 2 * PI
        R.add('rune1', box((4.9 * np.cos(a), CY + 4.9 * np.sin(a), .0), .38, .38, .5, tile=.3, rot=(0, 0, a)), 'glow', 'Ring1')
    R.add('anneau2', torus(5.8, .26, axis='x', segs=56, rs=10, tile=.8), 'stone', 'Ring2'); xf(R.parts[-1][1], t=(0, CY, 0))
    for k in range(12):
        a = k / 12 * 2 * PI
        R.add('pic2', cone((0, CY + 5.8 * np.sin(a), 5.8 * np.cos(a)), (0, CY + 7.2 * np.sin(a), 7.2 * np.cos(a)), .24, segs=5, n=5, tile=.3), 'bone', 'Ring2')
    R.add('anneau3', torus(6.9, .2, axis='y', segs=60, rs=8, tile=.8), 'void', 'Ring3'); xf(R.parts[-1][1], t=(0, CY, 0))
    for k in range(8):
        a = k / 8 * 2 * PI
        R.add('orbe3', ell((6.9 * np.sin(a), CY, 6.9 * np.cos(a)), .5, segs=12, n=8, tile=.4), 'glow', 'Ring3')
        R.add('cage3', torus(.8, .05, axis='y', segs=16, rs=5), 'stone', 'Ring3'); xf(R.parts[-1][1], t=(6.9 * np.sin(a), CY, 6.9 * np.cos(a)))
    # ---------------------------------------------------------- tentacules à crochets
    for i in range(NT):
        a = i / NT * 2 * PI; x, z = 1.9 * np.sin(a), 1.9 * np.cos(a)
        pts = [(x * (1 + .3 * j), CY - 2.2 - j * 1.35, z * (1 + .3 * j)) for j in range(5)]
        pts[0] = (x * .95, CY - 2.2, z * .95)
        pts[0] = (x * .8, CY - 1.2 - 0.0, z * .8)
        for j in range(4):
            pa = np.array(pts[j]); pb = np.array(pts[j + 1]) if j < 3 else np.array([x * 2.2, CY - 2.2 - 4.4, z * 2.2])
            r0 = .62 - .12 * j; r1 = .62 - .12 * (j + 1)
            R.add('tentacule', rod([pa, (pa + pb) / 2, pb], r0, r1, segs=10, tile=.6, n=5, ref=(1, 0, 0)), 'tent', f'T{i}_{j}')
            if j % 2 == 0:
                for s_ in (1, -1):
                    R.add('crochet', cone((pa + pb) / 2 + np.array([s_ * r0 * .8, 0, 0]), (pa + pb) / 2 + np.array([s_ * (r0 + .65), -.6, 0]), .12, segs=5, n=4, tile=.2, curve=.2), 'bone', f'T{i}_{j}')
        tip = np.array([x * 2.2, CY - 2.2 - 4.4, z * 2.2])
        R.add('pointe', cone(tip, tip + np.array([0, -1.6, 0]), .14, segs=6, n=5, tile=.3, curve=.2, bow=(0, 0, .2)), 'bone', f'T{i}_3')
    # ---------------------------------------------------------- éclats de vide en orbite
    for k in range(14):
        a = k / 14 * 2 * PI + RNG.uniform(-.2, .2); r = RNG.uniform(8.0, 9.6); y = CY + RNG.uniform(-3.5, 4.0); s = RNG.uniform(.5, 1.1)
        c = np.array([r * np.sin(a), y, r * np.cos(a)])
        for sg in (1, -1):
            R.add('eclat', cone(c, c + np.array([0, sg * 2.0 * s, 0]) + RNG.normal(0, .15, 3), .5 * s, segs=5, n=5, tile=.5), 'void' if k % 2 else 'stone', 'Orbit')
    return R, 14.0


def pose_fns():
    def base(p, u, spin=1, float_=0.35, tilt=0.0):
        w = 2 * PI * u
        p.r('Ring1', 0, 0, w * spin); p.r('Ring2', w * spin * 1, 0, 0); p.r('Ring3', 0, -w * spin, 0)
        p.r('Orbit', 0, w * spin, 0)
        p.mv('Core', 0, float_ * np.sin(w), 0)
        p.r('Core', tilt, .08 * np.sin(w * 1), .0)
        p.r('Pupil', .04 * np.sin(w), .05 * np.cos(w), 0)
        for i in range(8):
            for j in range(4):
                p.r(f'T{i}_{j}', .22 * np.sin(w * 1 - .7 * j + i * .8), 0, .22 * np.cos(w * 1 - .7 * j + i * .8))

    def idle(u): p = Pose(); base(p, u, 1); return p

    def walk(u): p = Pose(); base(p, u, 2, .45, .08); return p

    def run(u): p = Pose(); base(p, u, 3, .6, .2); return p

    def attack(u):
        p = Pose(); wind = seg(u, 0, .4); hit_ = seg(u, .42, .56); rec = seg(u, .7, 1.0); a = wind * (1 - hit_); b = hit_ * (1 - rec)
        base(p, u, 3)
        p.mv('Core', 0, 0, -.9 * a + 1.4 * b); p.r('Core', -.25 * a + .2 * b, 0, 0)
        p.r('Pupil', 0, 0, 0)
        for i in range(8):
            for j in range(4): p.r(f'T{i}_{j}', -.5 * a + .9 * b, 0, 0)
        return p

    def hit(u): p = Pose(); k = np.sin(PI * np.clip(u, 0, 1)); p.mv('Core', 0, 0, -.8 * k); p.r('Core', -.25 * k, .1 * k, 0); return p

    def death(u):
        p = Pose(); k = seg(u, .1, 1.0)
        p.mv('Root', 0, -5.6 * k, 0); p.r('Core', .5 * k, 0, .3 * k)
        for i in range(8):
            for j in range(4): p.r(f'T{i}_{j}', .3 * k, 0, 0)
        p.r('Ring1', 0, 0, 3 * k); p.r('Ring2', 3 * k, 0, 0)
        return p
    return dict(idle=idle, walk=walk, run=run, attack=attack, hit=hit, death=death)
