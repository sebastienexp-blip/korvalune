"""Quadrupèdes hostiles dédiés (ours, sanglier, rat géant, loup, loup alpha) : chaque espèce a ses propres proportions, sa tête, ses oreilles,
sa queue et ses accessoires — plus de déformation d'un modèle unique. Même squelette (29 os) que le loup, donc mêmes animations ;
seules les positions des articulations changent. build(cfg) → (parts, squelette, méta)."""
import copy
import numpy as np
from glbkit import *
import wolf_geo as G

S = np.array
B = G.B

BASE = dict(leg=1.0, zl=1.0, xw=1.0, bw=1.0, bh=1.0, lr=1.0, hr=1.0, nk=1.0, sn=1.0, tip=1.0, ear='round', earsz=1.0, tail=1.0, tailr=1.0,
            tailcol=None, tusks=0.0, horns=False, mane=0.0, crest=0.0, whisk=False, hump=0.0, tint=(1.0, 0.96, 0.92), belly=0.45, claw=1.0,
            eye=(0.9, 0.4, 0.1), fur=(1.5, 1.1, 0.8), jawcol=(0.75, 0.68, 0.62), nose=(0.07, 0.06, 0.06), rr=0.0, bellow=1.0, rump=0.0, disc=1.0)

SPECIES = {
    'bear':  dict(),
    'boar':  dict(leg=0.66, zl=0.92, xw=0.82, bw=0.82, bh=1.0, lr=0.52, hr=0.88, nk=0.95, sn=1.22, tip=1.15, ear='point', earsz=1.7, tail=0.7, tailr=0.30,
                  tusks=1.05, rr=1.0, crest=1.6, hump=0.10, rump=0.07, disc=1.6, tint=(0.95, 0.85, 0.78), claw=0.0, eye=(1.0, 0.35, 0.1), fur=(1.9, 1.35, 0.9), jawcol=(0.45, 0.36, 0.3), nose=(0.2, 0.14, 0.14)),
    'skitter': dict(leg=0.46, zl=0.78, xw=0.5, bw=0.52, bh=0.55, lr=0.34, hr=0.55, nk=0.5, sn=1.55, tip=0.45, ear='big', earsz=1.0, tail=3.2, tailr=0.30,
                    tailcol=(0.78, 0.55, 0.52, 1), whisk=True, tint=(0.9, 0.82, 0.76), claw=0.5, eye=(1.0, 0.1, 0.1), fur=(1.5, 1.25, 1.05), jawcol=(0.8, 0.7, 0.66), nose=(0.65, 0.35, 0.35), bellow=0.9),
    'wolf':  dict(leg=1.0, zl=1.05, xw=0.66, bw=0.62, bh=0.72, lr=0.50, hr=0.78, nk=0.62, sn=1.45, tip=0.72, ear='point', earsz=1.0, tail=1.45, tailr=1.0,
                  mane=1.0, tint=(0.75, 0.74, 0.76), claw=0.6, eye=(1.0, 0.55, 0.1), fur=(0.9, 0.9, 0.95), jawcol=(0.85, 0.82, 0.8), nose=(0.08, 0.07, 0.07)),
    'alpha': dict(leg=1.1, zl=1.12, xw=0.72, bw=0.70, bh=0.80, lr=0.58, hr=0.88, nk=0.8, sn=1.40, tip=0.75, ear='point', earsz=1.1, tail=1.4, tailr=1.1,
                  mane=1.9, horns=True, tint=(0.55, 0.55, 0.62), claw=0.8, eye=(1.0, 0.1, 0.05), fur=(0.55, 0.55, 0.62), jawcol=(0.7, 0.68, 0.7), nose=(0.06, 0.05, 0.05)),
}

# articulations de l'ours (référence)
J0 = {'Root': (0, 0, 0), 'Hips': (0, 0.74, -0.52), 'Spine1': (0, 0.76, -0.28), 'Spine2': (0, 0.82, -0.02), 'Chest': (0, 0.88, 0.24),
      'Neck': (0, 0.90, 0.44), 'Head': (0, 0.86, 0.68), 'Jaw': (0, 0.76, 0.84)}
X = 0.24
FL0 = {'Upper': (X, 0.92, 0.34), 'Fore': (X, 0.52, 0.38), 'Paw': (X, 0.12, 0.40), 'Toe': (X, 0.035, 0.50)}
RL0 = {'Thigh': (X, 0.84, -0.46), 'Shin': (X + 0.01, 0.52, -0.42), 'Hock': (X + 0.01, 0.30, -0.50), 'Paw': (X + 0.01, 0.10, -0.42), 'Toe': (X + 0.01, 0.035, -0.30)}


def build(name):
    c = {**BASE, **SPECIES[name]}
    yl, zl, xw = c['leg'], c['zl'], c['xw']
    sn = c['sn']
    def hz(z): return 0.62 + (z - 0.62) * sn if z > 0.62 else z      # allonge le museau
    def P(x, y, z): return np.array([x * xw, y * yl, z * zl])
    def PH(x, y, z): return P(x, y, hz(z))
    tl = c['tail']
    tail_pts = [(0, 0.78, -0.72), (0, 0.78 - 0.02 * tl, -0.72 - 0.10 * tl), (0, 0.74 - 0.05 * tl, -0.72 - 0.20 * tl), (0, 0.66 - 0.08 * tl, -0.72 - 0.30 * tl)]
    if name == 'skitter':
        tail_pts = [(0, 0.78, -0.72), (0, 0.70, -0.72 - 0.18 * tl), (0, 0.50, -0.72 - 0.30 * tl), (0, 0.36, -0.72 - 0.42 * tl)]
    if name in ('wolf', 'alpha'):
        tail_pts = [(0, 0.80, -0.72), (0, 0.74, -0.72 - 0.16 * tl), (0, 0.62, -0.72 - 0.28 * tl), (0, 0.46, -0.72 - 0.36 * tl)]
    JT = {'Tail1': tail_pts[0], 'Tail2': tail_pts[1], 'Tail3': tail_pts[2]}
    SK = copy.deepcopy(G.SK)
    pos = {n: P(*J0[n]) for n in J0}
    pos['Head'] = PH(*J0['Head']); pos['Jaw'] = PH(*J0['Jaw'])
    for n in JT: pos[n] = P(*JT[n])
    for sd, sg in (('L', 1), ('R', -1)):
        for nm, k in (('FrontUpper', 'Upper'), ('FrontFore', 'Fore'), ('FrontPaw', 'Paw'), ('FrontToe', 'Toe')):
            pos[f'{nm}_{sd}'] = P(sg * FL0[k][0], FL0[k][1], FL0[k][2])
        for nm, k in (('Thigh', 'Thigh'), ('Shin', 'Shin'), ('Hock', 'Hock'), ('RearPaw', 'Paw'), ('RearToe', 'Toe')):
            pos[f'{nm}_{sd}'] = P(sg * RL0[k][0], RL0[k][1], RL0[k][2])
    SK.pos = [np.array(pos[n], float) for n in SK.names]
    jp = lambda n: SK.pos[B[n]]

    tint = np.array(c['tint']); belly = c['belly']
    def fur(p, n):
        back = 0.5 + 0.5 * np.clip(n[1], -1, 1)
        t = 0.62 + belly * (1 - back)
        leg = np.clip((0.45 * yl - p[1]) / (0.45 * yl), 0, 1)
        t = t * (1 - 0.30 * leg)
        shade = 1.0 + 0.10 * np.sin(p[2] * 9.0 + p[0] * 5.0)
        return (t * shade * tint[0], t * shade * tint[1], t * shade * tint[2], 1)
    pf = lambda m: G.paint(m, fur)
    rg = lambda m, b: skin_rigid(m, B[b])
    parts = []
    def add(n, m, mat, both=False):
        parts.append((n, m, mat))
        if both: parts.append((n + '_R', mirror_x(m, G.SWAP), mat))
    bw, bh = c['bw'], c['bh']

    # corps
    n = 18
    hp_ = c['hump']
    bp = smoothpath([P(0, 0.72 - c['rump'], -0.64), P(0, 0.74 - c['rump'] * 0.8, -0.46), P(0, 0.78 + hp_, -0.22), P(0, 0.84 + hp_, 0.02), P(0, 0.88, 0.26), P(0, 0.86, 0.46)], n)
    rf = bh * prof([(0, .17), (.15, .25), (.4, .26), (.62, .29), (.82, .29), (1, .22)], n)
    rs = bw * prof([(0, .17), (.15, .25), (.4, .25), (.62, .26), (.82, .26), (1, .20)], n)
    if name == 'skitter':                                           # dos voûté, ventre fin
        rf = bh * prof([(0, .20), (.2, .27), (.45, .30), (.7, .26), (.9, .20), (1, .16)], n)
    body = Loft(bp, rf, rs, p=2.2, segs=20, cap0=2, cap1=1, tile=0.35)
    m = pf(body.mesh())
    skin_chain(m, [jp('Hips'), jp('Spine1'), jp('Spine2'), jp('Chest'), jp('Neck')], [B['Hips'], B['Spine1'], B['Spine2'], B['Chest'], B['Neck']], blend=0.12)
    add('corps', m, 'fur')

    # cou
    nk = c['nk']
    npth = smoothpath([P(0, 0.90, 0.38), PH(0, 0.88, 0.54), PH(0, 0.84, 0.68)], 8)
    neck = Loft(npth, nk * prof([(0, .24), (1, .17)], 8), nk * prof([(0, .24), (1, .17)], 8), p=2.2, segs=16, tile=0.3)
    m = pf(neck.mesh()); skin_chain(m, [jp('Neck'), jp('Head'), PH(0, 0.84, 0.74)], [B['Neck'], B['Head'], B['Head']], blend=0.08); add('cou', m, 'fur')

    # tête
    hr, tip = c['hr'], c['tip']
    hpth = smoothpath([PH(0, 0.86, 0.62), PH(0, 0.855, 0.72), PH(0, 0.82, 0.84), PH(0, 0.79, 0.95)], 10)
    hrf = hr * 1.22 * prof([(0, .16), (.3, .155), (.65, .10 * min(1, tip + .1)), (1, .06 * tip)], 10)
    hrs = hr * 1.22 * prof([(0, .155), (.3, .15), (.65, .095 * min(1, tip + .1)), (1, .058 * tip)], 10)
    sk = Loft(hpth, hrf, hrs, p=2.3, segs=16, cap0=1, cap1=3, tile=0.25)
    m = pf(sk.mesh()); rg(m, 'Head'); add('crane', m, 'fur')
    tipP = PH(0, 0.79, 0.95); tipEnd = PH(0, 0.789, 0.975)
    nz = Loft(S([tipP, tipEnd]), 0.034 * tip ** 0.5 * hr * c['disc'], 0.042 * tip ** 0.5 * hr * c['disc'], p=2.0, segs=10, cap0=2, cap1=2, tile=0.05)
    m = nz.mesh(); m.C[:] = list(c['nose']) + [1]; rg(m, 'Head'); add('truffe', m, 'fur')
    jpth = smoothpath([PH(0, 0.75, 0.74), PH(0, 0.735, 0.84), PH(0, 0.73, 0.93)], 8)
    jaw = Loft(jpth, hr * prof([(0, .045), (1, .028 * tip ** .5)], 8), hr * prof([(0, .085), (1, .05 * tip ** .5)], 8), p=2.3, segs=12, cap0=1, cap1=2, tile=0.2)
    m = G.paint(jaw.mesh(), lambda p, nn: tuple(c['jawcol']) + (1,)); rg(m, 'Jaw'); add('machoire', m, 'fur')
    for s in (1, -1):
        add(f'canine_h{s}', G.tooth(*(PH(s * 0.04, 0.775, 0.90) * [1, 1, 1]), -0.045 * hr, 0.011 * hr, True, 'Head'), 'bone')
        add(f'canine_b{s}', G.tooth(*PH(s * 0.04, 0.745, 0.89), 0.04 * hr, 0.010 * hr, True, 'Jaw'), 'bone')
        ey = PH(s * 0.088, 0.885, 0.80); ey2 = PH(s * 0.098, 0.88, 0.788)
        e = Loft(S([ey, ey2]), 0.011 * hr ** .5, 0.012 * hr ** .5, p=2.0, segs=8, cap0=2, cap1=2, tile=.03, ref=(0, 1, 0))
        m = e.mesh(); rg(m, 'Head'); add(f'oeil{s}', m, 'glow')
        es = c['earsz']
        if c['ear'] == 'round':
            ep = smoothpath([PH(s * 0.115, 0.985, 0.60), PH(s * 0.145, 1.0, 0.595)], 3)
            ear = Loft(ep, 0.055 * es, 0.055 * es, p=2.0, segs=16, cap0=2, cap1=2, tile=0.1, ref=(0, 0, 1))
            m = pf(ear.mesh()); rg(m, 'Head'); add(f'oreille{s}', m, 'fur')
            ip = smoothpath([PH(s * 0.12, 0.985, 0.605), PH(s * 0.152, 1.0, 0.603)], 3)
            inner = Loft(ip, 0.032 * es, 0.032 * es, p=2.0, segs=14, cap0=2, cap1=2, tile=0.1, ref=(0, 0, 1))
            m = inner.mesh(); m.C[:] = (0.28, 0.2, 0.17, 1); rg(m, 'Head'); add(f'oreille_i{s}', m, 'fur')
        elif c['ear'] == 'big':
            ep = smoothpath([PH(s * 0.10, 0.99, 0.60), PH(s * 0.16, 1.04, 0.58), PH(s * 0.19, 1.08, 0.57)], 6)
            ear = Loft(ep, prof([(0, .012), (1, .006)], 6), prof([(0, .07 * es), (.6, .105 * es), (1, .05 * es)], 6), p=2.1, segs=18, cap0=1, cap1=2, tile=0.1, ref=(0, 0, 1))
            m = ear.mesh(); m.C[:] = (0.80, 0.55, 0.52, 1); rg(m, 'Head'); add(f'oreille{s}', m, 'fur')
        else:
            ep = smoothpath([PH(s * 0.09, 0.99, 0.60), PH(s * 0.12, 1.05 + 0.10 * c['rr'], 0.585), PH(s * 0.125, 1.11 + 0.22 * c['rr'], 0.575)], 7)
            t = np.linspace(0, 1, 7)
            ear = Loft(ep, 0.012, 0.075 * es * (1 - t) ** 0.8 + 0.006, p=2.0, segs=10, cap1=2, tile=0.08, ref=(1, 0, 0))
            m = pf(ear.mesh()); rg(m, 'Head'); add(f'oreille{s}', m, 'fur')
    if c['whisk']:
        for s in (1, -1):
            for k in range(3):
                a = PH(s * 0.02, 0.775 - 0.006 * k, 0.96); b_ = PH(s * 0.13, 0.775 + 0.04 * (k - 1), 0.93); c_ = PH(s * 0.21, 0.775 + 0.07 * (k - 1), 0.88)
                add(f'vib{s}{k}', rg(Loft(smoothpath([a, b_, c_], 5), 0.0035, 0.0035, p=2.0, segs=4, cap1=1, tile=.03).mesh(), 'Head'), 'bone')
        for s in (1, -1):    # grandes incisives
            add(f'incisive{s}', G.tooth(*PH(s * 0.012, 0.77, 0.955), -0.05, 0.010, True, 'Head'), 'bone')
    if c['tusks'] > 0:
        for s in (1, -1):
            p0 = PH(s * 0.07, 0.76, 0.86); k = c['tusks']
            pts = [p0, p0 + S([s * 0.05, 0.04, 0.05]) * k, p0 + S([s * 0.07, 0.13, 0.07]) * k, p0 + S([s * 0.05, 0.20, 0.03]) * k]
            tk = Loft(smoothpath(pts, 10), prof([(0, .024), (1, .003)], 10), prof([(0, .024), (1, .003)], 10), p=2.0, segs=10, cap1=1, tile=.05, ref=(1, 0, 0))
            add(f'defense{s}', rg(tk.mesh(), 'Jaw'), 'bone')

    # pattes
    lr = c['lr']
    def fleg(sg):
        pth = smoothpath([P(sg * X, 0.86, 0.34), P(sg * X, 0.66, 0.38), P(sg * X, 0.40, 0.385), P(sg * X, 0.14, 0.40), P(sg * X, 0.05, 0.47)], 16)
        return Loft(pth, lr * 1.2 * prof([(0, .17), (.25, .16), (.55, .105), (.8, .092), (.92, .097), (1, .06)], 16),
                    lr * 1.2 * prof([(0, .16), (.25, .15), (.55, .10), (.8, .09), (.92, .12), (1, .10)], 16), p=2.3, segs=14, cap0=1, cap1=2, tile=0.25)
    def rleg(sg):
        pth = smoothpath([P(sg * X, 0.78, -0.46), P(sg * (X + .01), 0.58, -0.38), P(sg * (X + .01), 0.38, -0.46), P(sg * (X + .01), 0.16, -0.43), P(sg * (X + .01), 0.05, -0.34)], 18)
        return Loft(pth, lr * 1.18 * prof([(0, .18), (.2, .19), (.45, .12), (.7, .09), (.9, .10), (1, .06)], 18),
                    lr * 1.18 * prof([(0, .17), (.2, .17), (.45, .11), (.7, .085), (.9, .12), (1, .10)], 18), p=2.3, segs=14, cap0=1, cap1=2, tile=0.25)
    m = pf(fleg(1).mesh())
    skin_chain(m, [jp('FrontUpper_L'), jp('FrontFore_L'), jp('FrontPaw_L'), jp('FrontToe_L')], [B['FrontUpper_L'], B['FrontFore_L'], B['FrontPaw_L'], B['FrontToe_L']], blend=0.08)
    add('patte_av', m, 'fur', both=True)
    m = pf(rleg(1).mesh())
    skin_chain(m, [P(X, 0.86, -0.48), jp('Thigh_L'), jp('Shin_L'), jp('Hock_L'), jp('RearPaw_L'), jp('RearToe_L')], [B['Hips'], B['Thigh_L'], B['Shin_L'], B['Hock_L'], B['RearPaw_L'], B['RearToe_L']], blend=0.08)
    add('patte_ar', m, 'fur', both=True)
    if c['claw'] > 0:
        cl = c['claw']
        for sx in (1, -1):
            for k, dx in enumerate((-0.04, 0.0, 0.04)):
                for nm, bx, bz, bone in (('av', X, 0.52, 'FrontToe_L' if sx > 0 else 'FrontToe_R'), ('ar', X + 0.01, -0.285, 'RearToe_L' if sx > 0 else 'RearToe_R')):
                    p0 = P(sx * bx, 0.03, bz) + S([dx * lr * xw, 0, 0]); p1 = p0 + S([0, -0.026 * cl, 0.085 * cl * lr ** .3])
                    cc = Loft(smoothpath([p0, (p0 + p1) / 2 + S([0, 0.006, 0]), p1], 4), prof([(0, .011 * lr ** .6), (1, .0014)], 4), prof([(0, .011 * lr ** .6), (1, .0014)], 4), p=2.0, segs=6, tile=0.03)
                    add(f'griffe_{nm}{sx}{k}', rg(cc.mesh(), bone), 'bone')

    # queue
    tr = c['tailr']
    tp = smoothpath([P(*q) for q in tail_pts], 8)
    if name in ('wolf', 'alpha'):
        trf = prof([(0, .06), (.45, .09), (.8, .085), (1, .012)], 8) * tr; trs = prof([(0, .06), (.45, .085), (.8, .08), (1, .012)], 8) * tr
    elif name == 'skitter':
        trf = prof([(0, .035), (1, .007)], 8) * tr; trs = trf
    else:
        trf = prof([(0, .06), (.5, .07), (1, .03)], 8) * tr; trs = trf
    tail = Loft(tp, trf, trs, p=2.3, segs=10, cap1=1, tile=0.2)
    m = pf(tail.mesh())
    if c['tailcol']: m.C[:] = list(c['tailcol'])
    skin_chain(m, [jp('Tail1'), jp('Tail2'), jp('Tail3'), P(*tail_pts[3])], [B['Tail1'], B['Tail2'], B['Tail3'], B['Tail3']], blend=0.1)
    add('queue', m, 'fur')

    rng = np.random.default_rng(11)
    chain_j = [jp('Head'), jp('Neck'), jp('Chest'), jp('Spine2'), jp('Spine1'), jp('Hips')]; chain_b = [B['Head'], B['Neck'], B['Chest'], B['Spine2'], B['Spine1'], B['Hips']]
    # crinière / collerette / crête de soies
    if c['mane'] > 0 or c['crest'] > 0 or name == 'bear':
        tufts = []; k = c['mane'] if c['mane'] > 0 else 1.0
        cnt = 30
        for i in range(cnt):
            u = i / (cnt - 1); z = 0.60 - u * 0.62; y = 0.92 + 0.22 * np.sin(np.clip(u * 1.3, 0, 1) * np.pi * 0.62) - 0.04 * u
            if name in ('wolf', 'alpha'): y = 0.93 + 0.08 * np.sin(np.clip(u * 1.2, 0, 1) * np.pi * 0.6) - 0.05 * u
            for sx in (-1, 0, 1):
                if name == 'boar':
                    d = S([sx * 0.2, 0.95, -0.35]) + rng.normal(0, 0.06, 3); ln = 0.11 * c['crest'] * (0.8 + 0.4 * rng.random())
                elif name in ('wolf', 'alpha'):
                    d = S([sx * 0.55, 0.35, -0.85]) + rng.normal(0, 0.08, 3); ln = (0.10 + 0.04 * np.sin(u * 3) + rng.uniform(0, .03)) * k
                else:
                    d = S([sx * 0.45, 0.22, -0.9]) + rng.normal(0, 0.07, 3); ln = 0.075 + rng.uniform(0, 0.03)
                base = P(sx * 0.07 * (1 if name != 'boar' else 0.35), y, z)
                tufts.append(G.tuft(base, d, ln, 0.032 if name == 'bear' else 0.022 * (1 + 0.3 * (k - 1))))
        m = concat(tufts)
        col = (0.5, 0.42, 0.36, 1.0) if name == 'bear' else (0.22, 0.16, 0.13, 1.0) if name == 'boar' else (0.36 * tint[0] + .05, 0.35 * tint[1] + .05, 0.37 * tint[2] + .05, 1.0)
        m.C = np.tile(list(col), (len(m.V), 1))
        skin_chain(m, chain_j, chain_b, blend=0.1); add('criniere', m, 'fur')
    # ramures du loup alpha
    if c['horns']:
        for s in (1, -1):
            hp = smoothpath([PH(s * 0.07, 1.00, 0.62), PH(s * 0.12, 1.12, 0.58), PH(s * 0.17, 1.26, 0.60), PH(s * 0.13, 1.36, 0.68)], 12)
            r = prof([(0, .020), (1, .002)], 12)
            add(f'corne{s}', rg(Loft(hp, r, r, p=2.0, segs=8, cap1=1, tile=.06, ref=(1, 0, 0)).mesh(), 'Head'), 'bone')
            for k in range(3):
                b0 = hp[3 + 2 * k]; tp_ = b0 + S([s * 0.04, 0.07, -0.02 - 0.015 * k])
                add(f'andouiller{s}{k}', rg(Loft(smoothpath([b0, tp_], 4), prof([(0, .010), (1, .0015)], 4), prof([(0, .010), (1, .0015)], 4), p=2.0, segs=6, cap1=1, tile=.04, ref=(1, 0, 0)).mesh(), 'Head'), 'bone')
    body_ = [m for n_, m, _ in parts if not n_.startswith('queue')]
    ymax = max(float(m.V[:, 1].max()) for m in body_); zmax = max(float(m.V[:, 2].max()) for m in body_); zmin = min(float(m.V[:, 2].min()) for m in body_)
    meta = dict(scale=np.array([1.0, 1.0, 1.0]), eye=c['eye'], fur=c['fur'], tail=1.0, refHeight=round(max(ymax, (zmax - zmin) * 0.6), 3))
    return parts, SK, meta
