"""Ours des forêts — modèle dédié (et non plus un loup déformé) : carcasse massive, bosse d'épaules, cou épais, tête large au museau court,
oreilles rondes, pattes en colonnes avec larges coussinets et longues griffes pâles, queue réduite. Même squelette (29 os) que le loup,
donc mêmes animations ; seules les positions des articulations changent."""
import copy
import numpy as np
from glbkit import *
import wolf_geo as G

S = np.array
B = G.B
FP = 0.0

# articulations de repos de l'ours (mètres, regarde +Z, pieds à y = 0)
J = {'Root': (0, 0, 0), 'Hips': (0, 0.74, -0.52), 'Spine1': (0, 0.76, -0.28), 'Spine2': (0, 0.82, -0.02), 'Chest': (0, 0.88, 0.24),
     'Neck': (0, 0.90, 0.44), 'Head': (0, 0.86, 0.68), 'Jaw': (0, 0.76, 0.84),
     'Tail1': (0, 0.78, -0.76), 'Tail2': (0, 0.76, -0.84), 'Tail3': (0, 0.72, -0.90)}
X = 0.24
FL = {'Upper': (X, 0.92, 0.34), 'Fore': (X, 0.52, 0.38), 'Paw': (X, 0.12, 0.40), 'Toe': (X, 0.035, 0.50)}
RL = {'Thigh': (X, 0.84, -0.46), 'Shin': (X + 0.01, 0.52, -0.42), 'Hock': (X + 0.01, 0.30, -0.50), 'Paw': (X + 0.01, 0.10, -0.42), 'Toe': (X + 0.01, 0.035, -0.30)}


def skeleton():
    SK = copy.deepcopy(G.SK)
    pos = {n: np.array(J[n], float) for n in J}
    for sd, sg in (('L', 1), ('R', -1)):
        for nm, k in (('FrontUpper', 'Upper'), ('FrontFore', 'Fore'), ('FrontPaw', 'Paw'), ('FrontToe', 'Toe')):
            pos[f'{nm}_{sd}'] = np.array([sg * FL[k][0], FL[k][1], FL[k][2]])
        for nm, k in (('Thigh', 'Thigh'), ('Shin', 'Shin'), ('Hock', 'Hock'), ('RearPaw', 'Paw'), ('RearToe', 'Toe')):
            pos[f'{nm}_{sd}'] = np.array([sg * RL[k][0], RL[k][1], RL[k][2]])
    SK.pos = [pos[n] for n in SK.names]
    return SK


def fur(p, n):
    back = 0.5 + 0.5 * np.clip(n[1], -1, 1)
    t = 0.62 + 0.45 * (1 - back)
    leg = np.clip((0.5 - p[1]) / 0.45, 0, 1)
    t = t * (1 - 0.30 * leg)
    shade = 1.0 + 0.10 * np.sin(p[2] * 9.0 + p[0] * 5.0)      # légères mèches
    return (t * shade * 1.0, t * shade * 0.96, t * shade * 0.92, 1)


def pf(m):
    return G.paint(m, fur)


def build():
    parts = []
    def add(n, m, mat, both=False):
        parts.append((n, m, mat))
        if both: parts.append((n + '_R', mirror_x(m, G.SWAP), mat))
    rg = lambda m, b: skin_rigid(m, B[b])

    # corps : tonneau profond, bosse d'épaules au-dessus des pattes avant, croupe arrondie
    n = 18
    bp = smoothpath([(0, 0.72, -0.64), (0, 0.74, -0.46), (0, 0.78, -0.22), (0, 0.84, 0.02), (0, 0.88, 0.26), (0, 0.86, 0.46)], n)
    rf = prof([(0, .17), (.15, .25), (.4, .26), (.62, .29), (.82, .29), (1, .22)], n)
    rs = prof([(0, .17), (.15, .25), (.4, .25), (.62, .26), (.82, .26), (1, .20)], n)
    body = Loft(bp, rf, rs, p=2.2, segs=20, cap0=2, cap1=1, tile=0.35)
    m = pf(body.mesh())
    skin_chain(m, [J['Hips'], J['Spine1'], J['Spine2'], J['Chest'], J['Neck']], [B['Hips'], B['Spine1'], B['Spine2'], B['Chest'], B['Neck']], blend=0.12)
    add('corps', m, 'fur')

    # cou épais
    npth = smoothpath([(0, 0.90, 0.38), (0, 0.88, 0.54), (0, 0.84, 0.68)], 8)
    neck = Loft(npth, prof([(0, .24), (1, .17)], 8), prof([(0, .24), (1, .17)], 8), p=2.2, segs=16, tile=0.3)
    m = pf(neck.mesh()); skin_chain(m, [J['Neck'], J['Head'], (0, 0.84, 0.74)], [B['Neck'], B['Head'], B['Head']], blend=0.08); add('cou', m, 'fur')

    # tête : crâne large, museau court et épais
    hp = smoothpath([(0, 0.86, 0.62), (0, 0.855, 0.72), (0, 0.82, 0.84), (0, 0.79, 0.95)], 10)
    sk = Loft(hp, 1.22 * prof([(0, .16), (.3, .155), (.65, .10), (1, .06)], 10), 1.22 * prof([(0, .155), (.3, .15), (.65, .095), (1, .058)], 10), p=2.3, segs=16, cap0=1, cap1=3, tile=0.25)
    m = pf(sk.mesh()); rg(m, 'Head'); add('crane', m, 'fur')
    nz = Loft(S([(0, 0.79, 0.95), (0, 0.789, 0.975)]), 0.034, 0.042, p=2.0, segs=10, cap0=2, cap1=2, tile=0.05)
    m = nz.mesh(); m.C[:] = (0.07, 0.06, 0.06, 1); rg(m, 'Head'); add('truffe', m, 'fur')
    jp = smoothpath([(0, 0.75, 0.74), (0, 0.735, 0.84), (0, 0.73, 0.93)], 8)
    jaw = Loft(jp, prof([(0, .045), (1, .028)], 8), prof([(0, .085), (1, .05)], 8), p=2.3, segs=12, cap0=1, cap1=2, tile=0.2)
    m = G.paint(jaw.mesh(), lambda p, nn: (0.75, 0.68, 0.62, 1)); rg(m, 'Jaw'); add('machoire', m, 'fur')
    for s in (1, -1):
        add(f'canine_h{s}', G.tooth(s * 0.04, 0.775, 0.90, -0.045, 0.012, True, 'Head'), 'bone')
        add(f'canine_b{s}', G.tooth(s * 0.04, 0.745, 0.89, 0.04, 0.011, True, 'Jaw'), 'bone')
        # oreilles rondes, sur les côtés du crâne
        ep = smoothpath([(s * 0.115, 0.985, 0.60), (s * 0.145, 1.0, 0.595)], 3)
        ear = Loft(ep, 0.055, 0.055, p=2.0, segs=16, cap0=2, cap1=2, tile=0.1, ref=(0, 0, 1))
        m = pf(ear.mesh()); rg(m, 'Head'); add(f'oreille{s}', m, 'fur')
        ip = smoothpath([(s * 0.12, 0.985, 0.605), (s * 0.152, 1.0, 0.603)], 3)
        inner = Loft(ip, 0.032, 0.032, p=2.0, segs=14, cap0=2, cap1=2, tile=0.1, ref=(0, 0, 1))
        m = inner.mesh(); m.C[:] = (0.28, 0.2, 0.17, 1); rg(m, 'Head'); add(f'oreille_i{s}', m, 'fur')
        e = Loft(smoothpath([S([s * 0.088, 0.885, 0.80]), S([s * 0.098, 0.88, 0.788])], 3), 0.011, 0.012, p=2.0, segs=8, cap0=2, cap1=2, tile=.03, ref=(0, 1, 0))
        m = e.mesh(); rg(m, 'Head'); add(f'oeil{s}', m, 'glow')

    # pattes : colonnes épaisses, coussinets larges
    def fleg(sg):
        pth = smoothpath([(sg * X, 0.86, 0.34), (sg * X, 0.66, 0.38), (sg * X, 0.40, 0.385), (sg * X, 0.14, 0.40), (sg * X, 0.05, 0.47)], 16)
        return Loft(pth, 1.2 * prof([(0, .17), (.25, .16), (.55, .105), (.8, .092), (.92, .097), (1, .06)], 16),
                    1.2 * prof([(0, .16), (.25, .15), (.55, .10), (.8, .09), (.92, .12), (1, .10)], 16), p=2.3, segs=14, cap0=1, cap1=2, tile=0.25)
    def rleg(sg):
        pth = smoothpath([(sg * X, 0.78, -0.46), (sg * (X + .01), 0.58, -0.38), (sg * (X + .01), 0.38, -0.46), (sg * (X + .01), 0.16, -0.43), (sg * (X + .01), 0.05, -0.34)], 18)
        return Loft(pth, 1.18 * prof([(0, .18), (.2, .19), (.45, .12), (.7, .09), (.9, .10), (1, .06)], 18),
                    1.18 * prof([(0, .17), (.2, .17), (.45, .11), (.7, .085), (.9, .12), (1, .10)], 18), p=2.3, segs=14, cap0=1, cap1=2, tile=0.25)
    m = pf(fleg(1).mesh())
    skin_chain(m, [FL['Upper'], FL['Fore'], FL['Paw'], FL['Toe']], [B['FrontUpper_L'], B['FrontFore_L'], B['FrontPaw_L'], B['FrontToe_L']], blend=0.08)
    add('patte_av', m, 'fur', both=True)
    m = pf(rleg(1).mesh())
    skin_chain(m, [(X, 0.86, -0.48), RL['Thigh'], RL['Shin'], RL['Hock'], RL['Paw'], RL['Toe']], [B['Hips'], B['Thigh_L'], B['Shin_L'], B['Hock_L'], B['RearPaw_L'], B['RearToe_L']], blend=0.08)
    add('patte_ar', m, 'fur', both=True)
    # longues griffes pâles
    for sx in (1, -1):
        for k, dx in enumerate((-0.04, 0.0, 0.04)):
            for nm, bx, bz, bone in (('av', X, 0.52, 'FrontToe_L' if sx > 0 else 'FrontToe_R'), ('ar', X + 0.01, -0.285, 'RearToe_L' if sx > 0 else 'RearToe_R')):
                p0 = S([sx * bx + dx, 0.03, bz]); p1 = p0 + S([0, -0.026, 0.085])
                c = Loft(smoothpath([p0, (p0 + p1) / 2 + S([0, 0.006, 0]), p1], 4), prof([(0, .011), (1, .0014)], 4), prof([(0, .011), (1, .0014)], 4), p=2.0, segs=6, tile=0.03)
                add(f'griffe_{nm}{sx}{k}', rg(c.mesh(), bone), 'bone')

    # queue réduite
    tp = smoothpath([(0, 0.78, -0.72), (0, 0.76, -0.80), (0, 0.72, -0.88)], 5)
    tail = Loft(tp, prof([(0, .06), (.5, .07), (1, .03)], 5), prof([(0, .06), (.5, .07), (1, .03)], 5), p=2.3, segs=10, cap1=1, tile=0.2)
    m = pf(tail.mesh()); skin_chain(m, [J['Tail1'], J['Tail2'], J['Tail3'], (0, 0.70, -0.92)], [B['Tail1'], B['Tail2'], B['Tail3'], B['Tail3']], blend=0.1); add('queue', m, 'fur')

    # collerette et bosse : mèches de pelage hirsutes, de la nuque au milieu du dos
    rng = np.random.default_rng(11); tufts = []
    for i in range(30):
        u = i / 29; z = 0.60 - u * 0.62; y = 0.92 + 0.22 * np.sin(np.clip(u * 1.3, 0, 1) * np.pi * 0.62) - 0.04 * u
        for sx in (-1, 0, 1):
            d = S([sx * 0.45, 0.22, -0.9]) + rng.normal(0, 0.07, 3)
            tufts.append(G.tuft((sx * 0.07, y - 0.1 * (1 - abs(sx)) * 0.2, z), d, 0.075 + rng.uniform(0, 0.03), 0.032))
    m = concat(tufts); m.C = np.tile([0.5, 0.42, 0.36, 1.0], (len(m.V), 1))
    skin_chain(m, [J['Head'], J['Neck'], J['Chest'], J['Spine2'], J['Spine1'], J['Hips']], [B['Head'], B['Neck'], B['Chest'], B['Spine2'], B['Spine1'], B['Hips']], blend=0.1)
    add('criniere', m, 'fur')
    return parts
