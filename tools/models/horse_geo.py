"""Cheval de selle — monture du Veilleur. Même squelette quadrupède (29 os) que le loup, à l'échelle d'un cheval :
garrot ≈ 1,5 m, longueur ≈ 2,3 m. Regarde +Z, sabots à y = 0. La robe est blanche/neutre dans le fichier : le jeu la teinte
(matériaux « coat » et « mane »). Selle, sangle, bride et couverture sont des pièces à part (matériaux « leather », « trim », « cloth »)."""
import numpy as np
from glbkit import *
S = np.array

J = {'Root': (0, 0, 0), 'Hips': (0, 1.30, -0.55), 'Spine1': (0, 1.34, -0.25), 'Spine2': (0, 1.40, 0.10), 'Chest': (0, 1.43, 0.45),
     'Neck': (0, 1.46, 0.66), 'Head': (0, 1.86, 1.06), 'Jaw': (0, 1.72, 1.22),
     'Tail1': (0, 1.38, -0.84), 'Tail2': (0, 1.18, -0.98), 'Tail3': (0, 0.92, -1.04)}
FL = {'Upper': (0.17, 1.28, 0.52), 'Fore': (0.17, 0.84, 0.54), 'Paw': (0.17, 0.32, 0.53), 'Toe': (0.17, 0.07, 0.58)}
RL = {'Thigh': (0.18, 1.26, -0.52), 'Shin': (0.18, 0.86, -0.42), 'Hock': (0.18, 0.54, -0.62), 'Paw': (0.18, 0.22, -0.60), 'Toe': (0.18, 0.07, -0.55)}
mx = lambda p: (-p[0], p[1], p[2])
SK = Skeleton()
SK.add('Root', None, J['Root']); SK.add('Hips', 'Root', J['Hips']); SK.add('Spine1', 'Hips', J['Spine1']); SK.add('Spine2', 'Spine1', J['Spine2'])
SK.add('Chest', 'Spine2', J['Chest']); SK.add('Neck', 'Chest', J['Neck']); SK.add('Head', 'Neck', J['Head']); SK.add('Jaw', 'Head', J['Jaw'])
SK.add('Tail1', 'Hips', J['Tail1']); SK.add('Tail2', 'Tail1', J['Tail2']); SK.add('Tail3', 'Tail2', J['Tail3'])
for sd, f in (('L', lambda p: p), ('R', mx)):
    SK.add(f'FrontUpper_{sd}', 'Chest', f(FL['Upper'])); SK.add(f'FrontFore_{sd}', f'FrontUpper_{sd}', f(FL['Fore']))
    SK.add(f'FrontPaw_{sd}', f'FrontFore_{sd}', f(FL['Paw'])); SK.add(f'FrontToe_{sd}', f'FrontPaw_{sd}', f(FL['Toe']))
    SK.add(f'Thigh_{sd}', 'Hips', f(RL['Thigh'])); SK.add(f'Shin_{sd}', f'Thigh_{sd}', f(RL['Shin']))
    SK.add(f'Hock_{sd}', f'Shin_{sd}', f(RL['Hock'])); SK.add(f'RearPaw_{sd}', f'Hock_{sd}', f(RL['Paw'])); SK.add(f'RearToe_{sd}', f'RearPaw_{sd}', f(RL['Toe']))
B = {n: i for i, n in enumerate(SK.names)}
SWAP = {B[n]: B[n.replace('_L', '_R')] for n in SK.names if n.endswith('_L')}
SWAP.update({v: k for k, v in SWAP.items()})
parts = []
def add(name, mesh, mat, both=False):
    parts.append((name, mesh, mat))
    if both: parts.append((name + '_R', mirror_x(mesh, SWAP), mat))
def rigid(m, bone): return skin_rigid(m, B[bone])
rng = np.random.default_rng(9)

def coat(m, belly=0.18, lower=0.25):
    N = normals(m); y = m.V[:, 1]
    up = 0.5 + 0.5 * np.clip(N[:, 1], -1, 1)
    t = (1 - belly * (1 - up)) * (1 - lower * np.clip((0.7 - y) / 0.7, 0, 1))
    m.C = np.stack([t, t, t, np.ones_like(t)], 1); return m
def flat(m, v=1.0):
    m.C = np.tile([v, v, v, 1.0], (len(m.V), 1)); return m

# ---- corps : tonneau profond, garrot, croupe arrondie --------------------------------------------
n = 18
bp = smoothpath([(0, 1.26, -0.80), (0, 1.29, -0.55), (0, 1.31, -0.20), (0, 1.33, 0.15), (0, 1.35, 0.45), (0, 1.40, 0.66)], n)
body = Loft(bp, prof([(0, .27), (.15, .29), (.5, .275), (.8, .30), (1, .25)], n), prof([(0, .24), (.15, .275), (.5, .27), (.8, .27), (1, .21)], n),
            p=2.4, segs=22, cap0=2, cap1=1, tile=0.5, of=prof([(0, 0), (1, 0)], n))
m = coat(body.mesh())
skin_chain(m, [J['Hips'], J['Spine1'], J['Spine2'], J['Chest'], J['Neck']], [B['Hips'], B['Spine1'], B['Spine2'], B['Chest'], B['Neck']], blend=0.2)
add('corps', m, 'coat')

# ---- encolure arquée -----------------------------------------------------------------------------
nn = 14
np_ = smoothpath([(0, 1.47, 0.60), (0, 1.58, 0.74), (0, 1.74, 0.90), (0, 1.88, 1.02)], nn)
neck = Loft(np_, prof([(0, .23), (.5, .15), (1, .10)], nn), prof([(0, .19), (.5, .125), (1, .085)], nn), p=2.3, segs=16, tile=0.4)
m = coat(neck.mesh()); skin_chain(m, [J['Chest'], J['Neck'], J['Head']], [B['Chest'], B['Neck'], B['Head']], blend=0.15); add('encolure', m, 'coat')

# ---- tête longue : front, chanfrein, naseaux, mâchoire --------------------------------------------
hn = 12
hp = smoothpath([(0, 1.88, 1.02), (0, 1.84, 1.10), (0, 1.74, 1.22), (0, 1.62, 1.34)], hn)
head = Loft(hp, prof([(0, .105), (.4, .088), (.8, .062), (1, .052)], hn), prof([(0, .085), (.4, .075), (.8, .052), (1, .05)], hn), p=2.4, segs=16, cap0=1, cap1=3, tile=0.3)
m = flat(head.mesh()); rigid(m, 'Head'); add('tete', m, 'coat')
jw = Loft(smoothpath([(0, 1.76, 1.10), (0, 1.69, 1.22), (0, 1.62, 1.33)], 8), prof([(0, .05), (1, .028)], 8), prof([(0, .06), (1, .04)], 8), p=2.3, segs=12, cap0=1, cap1=2, tile=0.2)
m = flat(jw.mesh(), 0.9); rigid(m, 'Jaw'); add('machoire', m, 'coat')
for sx in (1, -1):
    nz = Loft(S([(sx * 0.03, 1.60, 1.345), (sx * 0.034, 1.598, 1.36)]), 0.014, 0.018, p=2.0, segs=8, cap0=2, cap1=2, tile=0.05)
    m = flat(nz.mesh(), 0.25); rigid(m, 'Head'); add('naseau%d' % sx, m, 'dark')
    ear = Loft(smoothpath([S([sx * 0.045, 1.95, 0.99]), S([sx * 0.05, 2.03, 0.985]), S([sx * 0.042, 2.09, 0.99])], 6), 0.012, prof([(0, .028), (.6, .026), (1, .003)], 6), p=2.1, segs=10, cap1=1, tile=.1, ref=(1, 0, 0))
    m = flat(ear.mesh()); rigid(m, 'Head'); add('oreille%d' % sx, m, 'coat')
    eye = Loft(smoothpath([S([sx * 0.068, 1.865, 1.075]), S([sx * 0.076, 1.862, 1.065])], 3), 0.009, 0.013, p=2.0, segs=10, cap0=2, cap1=2, tile=.03, ref=(0, 1, 0))
    rigid(eye.mesh(), 'Head'); add('oeil%d' % sx, rigid(eye.mesh(), 'Head'), 'dark')

# ---- jambes ----------------------------------------------------------------------------------------
def fleg(sign):
    pth = smoothpath([(sign * 0.17, 1.28, 0.52), (sign * 0.17, 0.84, 0.54), (sign * 0.165, 0.50, 0.535), (sign * 0.165, 0.32, 0.53), (sign * 0.165, 0.14, 0.55)], 18)
    return Loft(pth, prof([(0, .125), (.25, .08), (.5, .05), (.62, .042), (.85, .04), (1, .038)], 18), prof([(0, .10), (.25, .07), (.5, .045), (.62, .04), (.85, .04), (1, .036)], 18), p=2.4, segs=12, cap0=1, tile=0.3)
def rleg(sign):
    pth = smoothpath([(sign * 0.18, 1.30, -0.52), (sign * 0.18, 1.00, -0.42), (sign * 0.18, 0.86, -0.42), (sign * 0.18, 0.54, -0.62), (sign * 0.18, 0.36, -0.60), (sign * 0.18, 0.15, -0.575)], 22)
    return Loft(pth, prof([(0, .19), (.2, .15), (.4, .075), (.55, .055), (.75, .042), (1, .04)], 22), prof([(0, .16), (.2, .13), (.4, .06), (.55, .05), (.75, .04), (1, .038)], 22), p=2.4, segs=12, cap0=1, tile=0.3)
m = coat(fleg(1).mesh(), 0.1, 0.0)
skin_chain(m, [FL['Upper'], FL['Fore'], FL['Paw'], FL['Toe']], [B['FrontUpper_L'], B['FrontFore_L'], B['FrontPaw_L'], B['FrontToe_L']], blend=0.1); add('jambe_av', m, 'coat', both=True)
m = coat(rleg(1).mesh(), 0.1, 0.0)
skin_chain(m, [(0.18, 1.28, -0.52), RL['Thigh'], RL['Shin'], RL['Hock'], RL['Paw'], RL['Toe']], [B['Hips'], B['Thigh_L'], B['Shin_L'], B['Hock_L'], B['RearPaw_L'], B['RearToe_L']], blend=0.1); add('jambe_ar', m, 'coat', both=True)
# sabots
for sx in (1, -1):
    for nm, z, bone in (('av', 0.55, 'FrontToe_L' if sx > 0 else 'FrontToe_R'), ('ar', -0.575, 'RearToe_L' if sx > 0 else 'RearToe_R')):
        hf = Loft(smoothpath([S([sx * 0.165, 0.17, z]), S([sx * 0.165, 0.06, z + 0.04])], 4), prof([(0, .042), (1, .062)], 4), prof([(0, .04), (1, .055)], 4), p=2.2, segs=14, cap0=1, cap1=1, tile=0.1)
        m = flat(hf.mesh(), 0.45); add(f'sabot_{nm}{sx}', rigid(m, bone), 'hoof')
# ---- crinière, toupet, queue -----------------------------------------------------------------------
def lock(base, tip, bend, width, th=0.010):
    base = S(base, float); tip = S(tip, float)
    pth = smoothpath([base, (base + tip) / 2 + S(bend), tip], 7); t = np.linspace(0, 1, 7)
    return Loft(pth, th, width * (1 - t) ** 0.5 + 0.004, p=2.0, segs=6, cap1=1, tile=0.1, ref=(1, 0, 0)).mesh()
mane = []
for i in range(34):
    u = i / 33; p0 = S([0.0, 1.97 - 0.50 * u, 0.98 - 0.42 * u + 0.0])
    for k in range(2):
        mane.append(lock(p0 + S([0.012 * (k - 0.5), 0, 0]), p0 + S([0.17 + 0.03 * k, -0.30 - 0.05 * u, -0.12 - 0.04 * u + rng.normal(0, 0.012)]), (0.04, 0.04, 0), 0.075))
m = concat(mane); m.C[:] = 1.0
skin_chain(m, [J['Head'], J['Neck'], J['Chest']], [B['Head'], B['Neck'], B['Chest']], blend=0.2); add('criniere', m, 'mane')
fl_ = [lock(S([sx * 0.01, 1.98, 1.09]), S([sx * 0.02, 1.86, 1.15 + 0.02 * k]), (0, 0.02, 0.02), 0.022) for k, sx in enumerate((-1, 0, 1))]
m = concat(fl_); m.C[:] = 1.0; rigid(m, 'Head'); add('toupet', m, 'mane')
tl = []
for k in range(22):
    a = (k - 10.5) / 10.5
    p0 = S([0.03 * a, 1.38, -0.86]); p1 = S([0.12 * a, 0.62 + 0.05 * abs(a), -1.10 - 0.03 * abs(a) - 0.03 * rng.random()])
    tl.append(lock(p0, p1, (0.0, -0.1, -0.12), 0.11, 0.02))
m = concat(tl); m.C[:] = 1.0
skin_chain(m, [J['Hips'], J['Tail1'], J['Tail2'], J['Tail3'], (0, 0.80, -1.10)], [B['Hips'], B['Tail1'], B['Tail2'], B['Tail3'], B['Tail3']], blend=0.15); add('queue', m, 'mane')

# ---- harnachement : couverture, selle, sangle, étriers, bride ------------------------------------------
cl = Loft(smoothpath([(0, 1.55, -0.18), (0, 1.56, 0.05), (0, 1.54, 0.28)], 5), prof([(0, .03), (1, .03)], 5), prof([(0, .34), (.5, .36), (1, .33)], 5), p=2.5, segs=16, tile=0.3)
m = cl.mesh(); skin_chain(m, [J['Spine1'], J['Spine2'], J['Chest']], [B['Spine1'], B['Spine2'], B['Chest']], blend=0.2); add('couverture', m, 'cloth')
sd_ = Loft(smoothpath([(0, 1.60, -0.28), (0, 1.63, 0.0), (0, 1.62, 0.18)], 6), prof([(0, .07), (.5, .05), (1, .08)], 6), prof([(0, .14), (.5, .10), (1, .12)], 6), p=2.4, segs=16, cap0=1, cap1=1, tile=0.25)
m = sd_.mesh(); skin_chain(m, [J['Spine1'], J['Spine2'], J['Chest']], [B['Spine1'], B['Spine2'], B['Chest']], blend=0.2); add('selle', m, 'leather')
for nm, y_, z_ in (('pommeau', 1.73, 0.20), ('troussequin', 1.71, -0.30)):
    c_ = Loft(smoothpath([(0, y_ - 0.06, z_), (0, y_ + 0.0, z_)], 4), prof([(0, .035), (1, .03)], 4), prof([(0, .045), (1, .03)], 4), p=2.3, segs=12, cap1=2, tile=0.1)
    m = c_.mesh(); skin_chain(m, [J['Spine1'], J['Spine2'], J['Chest']], [B['Spine1'], B['Spine2'], B['Chest']], blend=0.2); add(nm, m, 'leather')
gi = Loft(smoothpath([(0, 1.55, 0.05), (0, 1.0, 0.06), (0, 0.78, 0.07)], 8), 0.02, prof([(0, .31), (.5, .31), (1, .21)], 8), p=3.0, segs=16, tile=0.2)
m = gi.mesh(); skin_chain(m, [J['Spine2'], J['Chest']], [B['Spine2'], B['Chest']], blend=0.3); add('sangle', m, 'leather')
for sx in (1, -1):
    st = Loft(smoothpath([S([sx * 0.30, 1.52, 0.04]), S([sx * 0.33, 1.10, 0.04]), S([sx * 0.34, 0.92, 0.04])], 6), 0.007, 0.018, p=2.2, segs=8, cap1=1, tile=0.1, ref=(0, 0, 1))
    m = st.mesh(); skin_chain(m, [J['Spine2'], J['Chest']], [B['Spine2'], B['Chest']], blend=0.3); add('etrivier%d' % sx, m, 'leather')
    ir = Loft(smoothpath([S([sx * 0.34, 0.93, 0.0]), S([sx * 0.34, 0.90, 0.04]), S([sx * 0.34, 0.93, 0.08])], 7), 0.010, 0.012, p=2.0, segs=8, tile=0.05, ref=(1, 0, 0))
    m = ir.mesh(); skin_chain(m, [J['Spine2'], J['Chest']], [B['Spine2'], B['Chest']], blend=0.3); add('etrier%d' % sx, m, 'trim')
# bride : montant, frontal, muserolle, rênes
br = []
for sx in (1, -1):
    br.append(Loft(smoothpath([S([sx * 0.082, 1.94, 1.02]), S([sx * 0.092, 1.82, 1.10]), S([sx * 0.06, 1.66, 1.30])], 8), 0.004, 0.009, p=2.2, segs=8, tile=0.1, ref=(1, 0, 0)).mesh())
br.append(Loft(smoothpath([S([-0.085, 1.90, 1.075]), S([0, 1.915, 1.10]), S([0.085, 1.90, 1.075])], 7), 0.004, 0.008, p=2.2, segs=8, tile=0.1, ref=(0, 1, 0)).mesh())
br.append(Loft(smoothpath([S([-0.062, 1.665, 1.30]), S([0, 1.645, 1.355]), S([0.062, 1.665, 1.30])], 7), 0.005, 0.009, p=2.2, segs=8, tile=0.1, ref=(0, 1, 0)).mesh())
m = concat(br); rigid(m, 'Head'); add('bride', m, 'leather')
for sx in (1, -1):
    rn = Loft(smoothpath([S([sx * 0.058, 1.665, 1.31]), S([sx * 0.15, 1.62, 0.95]), S([sx * 0.10, 1.60, 0.62])], 10), 0.004, 0.006, p=2.0, segs=6, tile=0.1, ref=(1, 0, 0))
    m = rn.mesh(); skin_chain(m, [J['Head'], J['Neck'], J['Chest']], [B['Head'], B['Neck'], B['Chest']], blend=0.3); add('rene%d' % sx, m, 'leather')
