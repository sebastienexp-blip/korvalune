"""Bêtes hostiles : variantes du squelette quadrupède du Loup des Cendres (même 29 os, mêmes animations) avec têtes,
proportions et attributs propres : sanglier, ours, rat géant, loup alpha. build(nom) → (parts, squelette, méta)."""
import copy, re
import numpy as np
from glbkit import *
import wolf_geo as G

S = np.array
B = G.B; J = G.J

def rigid(m, bone): return skin_rigid(m, B[bone])
def furc(m, col=None):
    return G.paint(m, G.fur_tone) if col is None else _flat(m, col)
def _flat(m, col):
    m.C = np.tile(list(col) + [1.0], (len(m.V), 1)); return m

KEEP_ALL = r'.*'
HEAD_PARTS = r'^(crane|truffe|machoire|croc_|canine_|oreille|oeil)'
FUR_EXTRA = r'^(criniere|epines)$'

def lof(path, r0, r1, rs0=None, rs1=None, mid=None, n=8, **kw):
    rs0 = r0 if rs0 is None else rs0; rs1 = r1 if rs1 is None else rs1
    rf = prof([(0, r0), (1, r1)] if mid is None else [(0, r0), (0.5, mid[0]), (1, r1)], n)
    rs = prof([(0, rs0), (1, rs1)] if mid is None else [(0, rs0), (0.5, mid[1]), (1, rs1)], n)
    return Loft(smoothpath(path, n), rf, rs, **kw)

def tusk(side, base, tip_dx, tip_dy, tip_dz, r=0.011, bone='Head', curl=0.5):
    p0 = S(base, float); p1 = p0 + S([side * tip_dx * 0.4, tip_dy * 0.5, tip_dz * 0.6]); p2 = p0 + S([side * tip_dx, tip_dy, tip_dz])
    t = Loft(smoothpath([p0, p1, p2], 10), prof([(0, r), (1, 0.0012)], 10), prof([(0, r), (1, 0.0012)], 10), p=2.0, segs=8, tile=0.05, ref=(1, 0, 0))
    return rigid(t.mesh(), bone)

def bristles(n, z0, z1, y0, y1, length, width, spread=0.5, seed=3):
    r = np.random.default_rng(seed); out = []
    for i in range(n):
        u = i / max(n - 1, 1); z = z0 + (z1 - z0) * u; y = y0 + (y1 - y0) * u
        for sx in (-1, 0, 1):
            d = S([sx * spread, 0.9, -0.35]) + r.normal(0, 0.06, 3)
            out.append(G.tuft((sx * 0.02, y, z), d, length * (0.8 + 0.4 * r.random()), width))
    m = concat(out)
    skin_chain(m, [J['Head'], J['Neck'], J['Chest'], J['Spine2'], J['Spine1'], J['Hips']], [B['Head'], B['Neck'], B['Chest'], B['Spine2'], B['Spine1'], B['Hips']], blend=0.1)
    return m

# ------------------------------------------------------------------------------------------------ têtes
def head_boar():
    P = []
    sk = lof([(0, 0.76, 0.43), (0, 0.745, 0.52), (0, 0.72, 0.62), (0, 0.695, 0.70)], 0.095, 0.052, 0.098, 0.058, mid=(0.098, 0.1), n=10, p=2.4, segs=14, cap0=1, cap1=2, tile=0.2)
    P.append(('crane', rigid(furc(sk.mesh()), 'Head'), 'fur'))
    disc = Loft(S([(0, 0.696, 0.70), (0, 0.692, 0.725)]), 0.034, 0.05, p=2.2, segs=12, cap0=2, cap1=2, tile=0.05)
    m = disc.mesh(); m.C[:] = (0.16, 0.11, 0.11, 1); P.append(('groin', rigid(m, 'Head'), 'fur'))
    jw = lof([(0, 0.70, 0.52), (0, 0.675, 0.60), (0, 0.67, 0.67)], 0.032, 0.014, 0.05, 0.026, n=8, p=2.3, segs=12, cap0=1, cap1=2, tile=0.15)
    P.append(('machoire', rigid(furc(jw.mesh(), (0.7, 0.66, 0.62)), 'Jaw'), 'fur'))
    for s in (1, -1):
        P.append((f'defense{s}', tusk(s, (s * 0.04, 0.678, 0.64), 0.035, 0.085, 0.07, 0.013, 'Jaw'), 'bone'))
        P.append((f'defense_b{s}', tusk(s, (s * 0.034, 0.70, 0.66), 0.03, 0.04, 0.035, 0.009, 'Head'), 'bone'))
        ear = Loft(smoothpath([S([s * 0.06, 0.80, 0.44]), S([s * 0.085, 0.835, 0.42]), S([s * 0.095, 0.865, 0.40])], 6), 0.007, prof([(0, .035), (1, .004)], 6), p=2.0, segs=8, cap1=1, tile=.08, ref=(1, 0, 0))
        P.append((f'oreille{s}', rigid(furc(ear.mesh(), (0.25, 0.2, 0.18)), 'Head'), 'fur'))
        e = Loft(smoothpath([S([s * 0.056, 0.772, 0.56]), S([s * 0.064, 0.768, 0.548]), S([s * 0.07, 0.762, 0.535])], 5), 0.005, 0.0055, p=2.0, segs=8, cap0=1, cap1=1, tile=.03, ref=(0, 1, 0))
        P.append((f'oeil{s}', rigid(e.mesh(), 'Head'), 'glow'))
    return P

def head_bear():
    P = []
    sk = lof([(0, 0.76, 0.43), (0, 0.755, 0.52), (0, 0.735, 0.60), (0, 0.715, 0.66)], 0.098, 0.04, 0.1, 0.046, mid=(0.094, 0.095), n=10, p=2.4, segs=14, cap0=1, cap1=3, tile=0.2)
    P.append(('crane', rigid(furc(sk.mesh()), 'Head'), 'fur'))
    nz = Loft(S([(0, 0.718, 0.665), (0, 0.716, 0.682)]), 0.018, 0.022, p=2.0, segs=8, cap0=2, cap1=2, tile=0.05)
    m = nz.mesh(); m.C[:] = (0.07, 0.06, 0.06, 1); P.append(('truffe', rigid(m, 'Head'), 'fur'))
    jw = lof([(0, 0.705, 0.545), (0, 0.69, 0.60), (0, 0.685, 0.645)], 0.026, 0.012, 0.046, 0.024, n=8, p=2.3, segs=12, cap0=1, cap1=2, tile=0.15)
    P.append(('machoire', rigid(furc(jw.mesh(), (0.7, 0.66, 0.62)), 'Jaw'), 'fur'))
    for s in (1, -1):
        P.append((f'croc{s}', G.tooth(s * 0.024, 0.712, 0.655, -0.026, 0.0075, True, 'Head'), 'bone'))
        P.append((f'croc_b{s}', G.tooth(s * 0.024, 0.688, 0.645, 0.022, 0.0065, True, 'Jaw'), 'bone'))
        ear = Loft(smoothpath([S([s * 0.06, 0.82, 0.44]), S([s * 0.068, 0.835, 0.435])], 3), 0.014, 0.036, p=2.2, segs=12, cap0=2, cap1=2, tile=.08, ref=(1, 0, 0))
        P.append((f'oreille{s}', rigid(furc(ear.mesh()), 'Head'), 'fur'))
        e = Loft(smoothpath([S([s * 0.052, 0.775, 0.575]), S([s * 0.060, 0.772, 0.563]), S([s * 0.065, 0.768, 0.55])], 5), 0.004, 0.0045, p=2.0, segs=8, cap0=1, cap1=1, tile=.03, ref=(0, 1, 0))
        P.append((f'oeil{s}', rigid(e.mesh(), 'Head'), 'glow'))
    return P

def head_rat():
    P = []
    sk = lof([(0, 0.745, 0.47), (0, 0.735, 0.56), (0, 0.72, 0.68), (0, 0.705, 0.80)], 0.07, 0.014, 0.062, 0.012, mid=(0.05, 0.045), n=10, p=2.3, segs=12, cap0=1, cap1=3, tile=0.2)
    P.append(('crane', rigid(furc(sk.mesh()), 'Head'), 'fur'))
    nz = Loft(S([(0, 0.704, 0.805), (0, 0.702, 0.82)]), 0.011, 0.012, p=2.0, segs=8, cap0=2, cap1=2, tile=0.03)
    m = nz.mesh(); m.C[:] = (0.55, 0.3, 0.3, 1); P.append(('truffe', rigid(m, 'Head'), 'fur'))
    jw = lof([(0, 0.70, 0.55), (0, 0.685, 0.66), (0, 0.68, 0.74)], 0.02, 0.006, 0.034, 0.012, n=8, p=2.3, segs=10, cap0=1, cap1=2, tile=0.15)
    P.append(('machoire', rigid(furc(jw.mesh(), (0.7, 0.62, 0.58)), 'Jaw'), 'fur'))
    for s in (1, -1):
        P.append((f'incisive{s}', G.tooth(s * 0.007, 0.696, 0.77, -0.04, 0.007, True, 'Head'), 'bone'))
        P.append((f'incisive_b{s}', G.tooth(s * 0.006, 0.688, 0.725, 0.03, 0.006, True, 'Jaw'), 'bone'))
        ear = Loft(smoothpath([S([s * 0.05, 0.79, 0.47]), S([s * 0.08, 0.84, 0.455])], 3), 0.004, 0.05, p=2.2, segs=14, cap0=1, cap1=2, tile=.08, ref=(1, 0, 0))
        m = ear.mesh(); m.C[:] = (0.7, 0.45, 0.45, 1); P.append((f'oreille{s}', rigid(m, 'Head'), 'fur'))
        e = Loft(smoothpath([S([s * 0.04, 0.762, 0.585]), S([s * 0.048, 0.76, 0.575])], 3), 0.0055, 0.006, p=2.0, segs=8, cap0=2, cap1=2, tile=.03, ref=(0, 1, 0))
        P.append((f'oeil{s}', rigid(e.mesh(), 'Head'), 'glow'))
        for k in range(3):                                     # vibrisses
            wp = smoothpath([S([s * 0.014, 0.70 - 0.004 * k, 0.76]), S([s * 0.06, 0.70 + 0.012 * (k - 1), 0.74]), S([s * 0.11, 0.70 + 0.03 * (k - 1), 0.70])], 5)
            P.append((f'vib{s}{k}', rigid(Loft(wp, 0.0008, 0.0008, p=2.0, segs=4, cap1=1, tile=.03).mesh(), 'Head'), 'bone'))
    return P

def horns_alpha():
    P = []
    for s in (1, -1):
        hp = smoothpath([S([s * 0.04, 0.80, 0.47]), S([s * 0.09, 0.87, 0.42]), S([s * 0.12, 0.96, 0.43]), S([s * 0.09, 1.02, 0.50])], 12)
        r = prof([(0, .016), (1, .0015)], 12)
        P.append((f'corne{s}', rigid(Loft(hp, r, r, p=2.0, segs=8, cap1=1, tile=.06, ref=(1, 0, 0)).mesh(), 'Head'), 'bone'))
        for k in range(3):                                      # andouillers
            b = hp[3 + 2 * k]; tp_ = b + S([s * 0.025, 0.045, -0.015 - 0.01 * k])
            P.append((f'andouiller{s}{k}', rigid(Loft(smoothpath([b, tp_], 4), prof([(0, .007), (1, .001)], 4), prof([(0, .007), (1, .001)], 4), p=2.0, segs=6, cap1=1, tile=.04, ref=(1, 0, 0)).mesh(), 'Head'), 'bone'))
    return P

# ------------------------------------------------------------------------------------------------ variantes
V = {
  'boar':  dict(drop=HEAD_PARTS + r'|^criniere$|^epines$', scale=(1.12, 1.0, 0.92), leg=(0.58, 0.95, 1.5), head=head_boar, bristle=True, tail=0.6, eye=(1.0, 0.35, 0.1), fur=(1.9, 1.35, 0.9)),
  'bear':  dict(custom=True, eye=(0.9, 0.4, 0.1), fur=(1.55, 1.1, 0.8)),
  'skitter': dict(drop=HEAD_PARTS + r'|^criniere$|^epines$', scale=(0.62, 1.0, 0.95), leg=(0.50, 0.85, 1.0), head=head_rat, tail=1.9, eye=(1.0, 0.1, 0.1), fur=(1.5, 1.25, 1.05)),
  'alpha': dict(drop=r'^$', scale=(1.12, 1.12, 1.12), extra=horns_alpha, tail=1.0, eye=(1.0, 0.1, 0.05), fur=(0.55, 0.55, 0.62)),
}

def build(name):
    v = V[name]
    if v.get('custom'):                                         # modèle dédié (pas de déformation du loup)
        import bear_geo
        parts = bear_geo.build(); SK = bear_geo.skeleton()
        body = [m for n, m, _ in parts if not n.startswith('queue')]
        ymax = max(float(m.V[:, 1].max()) for m in body); zmax = max(float(m.V[:, 2].max()) for m in body); zmin = min(float(m.V[:, 2].min()) for m in body)
        return parts, SK, dict(scale=np.array([1.0, 1.0, 1.0]), eye=v['eye'], fur=v['fur'], tail=1.0, refHeight=round(max(ymax, (zmax - zmin) * 0.6), 3))
    parts = []
    for n, m, mat in G.parts:
        if re.match(v['drop'], n): continue
        parts.append((n, m.copy(), mat))
    if v.get('head'): parts += v['head']()
    if v.get('extra'): parts += v['extra']()
    if v.get('bristle'):
        parts.append(('soies', bristles(16, 0.42, -0.28, 0.76, 0.69, 0.11, 0.02, 0.5), 'fur'))
    if v.get('hump'):                                          # bosse d'épaules massive
        hp = smoothpath([S([0, 0.70, 0.12]), S([0, 0.80, 0.22]), S([0, 0.82, 0.30]), S([0, 0.74, 0.40])], 10)
        h = Loft(hp, prof([(0, .06), (.5, .10), (1, .05)], 10), prof([(0, .10), (.5, .13), (1, .09)], 10), p=2.4, segs=16, cap0=1, cap1=1, tile=.25)
        m = G.paint(h.mesh(), G.fur_tone)
        skin_chain(m, [J['Spine2'], J['Chest'], J['Neck']], [B['Spine2'], B['Chest'], B['Neck']], blend=0.1); parts.append(('bosse', m, 'fur'))
    sc = np.array(v['scale'])
    lk, bk, th = v.get('leg', (1.0, 1.0, 1.0))
    Y0 = 0.62
    def squash(y): return np.where(y < Y0, y * lk, Y0 * lk + (y - Y0) * bk)
    for n, m, mat in parts:
        if n.startswith('patte') and th != 1.0:        # pattes plus épaisses (autour de l'axe de la patte)
            c = m.V[:, [0, 2]].mean(0); m.V[:, [0, 2]] = c + (m.V[:, [0, 2]] - c) * th
        m.V[:, 1] = squash(m.V[:, 1])
        m.V = m.V * sc
        if n == 'queue' or n.startswith('queue'):
            m.V[:, 2] = (m.V[:, 2] + 0.40 * sc[2]) * v['tail'] - 0.40 * sc[2]
    SK = copy.deepcopy(G.SK); SK.pos = [np.array([p[0], float(squash(np.array(p[1]))), p[2]]) * sc for p in SK.pos]
    for i, nme in enumerate(SK.names):
        if nme.startswith('Tail'): SK.pos[i] = np.array([SK.pos[i][0], SK.pos[i][1], (SK.pos[i][2] + 0.40 * sc[2]) * v['tail'] - 0.40 * sc[2]])
    body = [m for n, m, _ in parts if not n.startswith('queue')]
    ymax = max(float(m.V[:, 1].max()) for m in body); zmax = max(float(m.V[:, 2].max()) for m in body); zmin = min(float(m.V[:, 2].min()) for m in body)
    return parts, SK, dict(scale=sc, eye=v['eye'], fur=v['fur'], tail=v['tail'], refHeight=round(max(ymax, (zmax - zmin) * 0.6), 3))
