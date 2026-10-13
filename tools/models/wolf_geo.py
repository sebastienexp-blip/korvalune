"""Loup des Cendres — créature hostile originale : pelage gris charbonneux, crinière en lames, épines d'os, yeux ambrés.
Quadrupède, 36 os, ~9 000 triangles. Regarde +Z, pieds à y = 0, longueur ≈ 1,3 m (queue comprise ≈ 1,6 m)."""
import numpy as np
from glbkit import *
S = np.array

SK = Skeleton()
J = {  # joints (pose de repos)
    'Root': (0, 0, 0), 'Hips': (0, 0.60, -0.30), 'Spine1': (0, 0.63, -0.12), 'Spine2': (0, 0.67, 0.08), 'Chest': (0, 0.69, 0.26),
    'Neck': (0, 0.72, 0.38), 'Head': (0, 0.75, 0.50), 'Jaw': (0, 0.705, 0.585),
    'Tail1': (0, 0.64, -0.44), 'Tail2': (0, 0.60, -0.62), 'Tail3': (0, 0.52, -0.80),
}
FL = {'Upper': (0.105, 0.60, 0.27), 'Fore': (0.105, 0.38, 0.235), 'Paw': (0.105, 0.115, 0.285), 'Toe': (0.105, 0.03, 0.33)}
RL = {'Thigh': (0.105, 0.58, -0.31), 'Shin': (0.105, 0.39, -0.20), 'Hock': (0.105, 0.20, -0.33), 'Paw': (0.105, 0.075, -0.28), 'Toe': (0.105, 0.03, -0.235)}
mx = lambda p: (-p[0], p[1], p[2])
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
rng = np.random.default_rng(5)

def paint(m, fn):
    """Couleur de sommet (0..1) = fn(position, normale) — dégradés dos sombre / ventre clair."""
    N = normals(m)
    m.C = np.clip(np.array([fn(p, n) for p, n in zip(m.V, N)]), 0, 1.5)
    return m
def fur_tone(p, n):
    back = 0.5 + 0.5 * np.clip(n[1], -1, 1)                 # 1 = dessus, 0 = dessous
    base = 0.55 + 0.55 * (1 - back)                          # ventre plus clair
    leg = np.clip((0.45 - p[1]) / 0.4, 0, 1)                 # pattes plus sombres vers le bas
    t = base * (1 - 0.35 * leg)
    return (t * 1.0, t * 0.97, t * 0.95, 1)

# ---- corps : tonneau profond à la poitrine, taille fine ------------------------------------------
N_B = 16
bp = smoothpath([(0, 0.60, -0.40), (0, 0.62, -0.28), (0, 0.65, -0.10), (0, 0.675, 0.08), (0, 0.695, 0.26), (0, 0.715, 0.36)], N_B)
body = Loft(bp, 1.12 * prof([(0, .10), (.12, .14), (.4, .12), (.65, .15), (.85, .16), (1, .115)], N_B),
            1.12 * prof([(0, .08), (.12, .11), (.4, .095), (.65, .115), (.85, .12), (1, .085)], N_B), p=2.3, segs=18, cap0=2, cap1=1, tile=0.3,
            of=prof([(0, 0), (1, 0)], N_B))
m = paint(body.mesh(), fur_tone)
skin_chain(m, [J['Hips'], J['Spine1'], J['Spine2'], J['Chest'], J['Neck']], [B['Hips'], B['Spine1'], B['Spine2'], B['Chest'], B['Neck']], blend=0.10)
add('corps', m, 'fur')

# ---- cou + tête --------------------------------------------------------------------------------
N_N = 8
np_ = smoothpath([(0, 0.70, 0.30), (0, 0.735, 0.40), (0, 0.76, 0.49)], N_N)
neck = Loft(np_, prof([(0, .115), (1, .085)], N_N), prof([(0, .085), (1, .068)], N_N), p=2.3, segs=14, tile=0.25)
m = paint(neck.mesh(), fur_tone); skin_chain(m, [J['Neck'], J['Head'], (0, 0.76, 0.52)], [B['Neck'], B['Head'], B['Head']], blend=0.06); add('cou', m, 'fur')

hp_ = smoothpath([(0, 0.755, 0.45), (0, 0.76, 0.52), (0, 0.745, 0.60), (0, 0.725, 0.68)], 10)
skull = Loft(hp_, 1.15 * prof([(0, .082), (.35, .075), (.7, .042), (1, .026)], 10), 1.15 * prof([(0, .075), (.35, .07), (.7, .04), (1, .022)], 10), p=2.4, segs=14, cap0=1, cap1=3, tile=0.2)
m = paint(skull.mesh(), fur_tone); rigid(m, 'Head'); add('crane', m, 'fur')
nose = Loft(S([(0, 0.727, 0.70), (0, 0.724, 0.715)]), 0.014, 0.017, p=2.0, segs=8, cap0=2, cap1=2, tile=0.05)
m = nose.mesh(); m.C[:] = (0.12, 0.1, 0.1, 1); rigid(m, 'Head'); add('truffe', m, 'fur')
jp = smoothpath([(0, 0.705, 0.545), (0, 0.69, 0.60), (0, 0.685, 0.66)], 8)
jaw = Loft(jp, prof([(0, .028), (.5, .02), (1, .011)], 8), prof([(0, .05), (.5, .036), (1, .018)], 8), p=2.3, segs=12, cap0=1, cap1=2, tile=0.15)
m = paint(jaw.mesh(), lambda p, n: (0.95, 0.9, 0.88, 1)); rigid(m, 'Jaw'); add('machoire', m, 'fur')
# crocs
def tooth(x, y, z, h, w, up=True, bone='Head'):
    p0 = S([x, y, z]); p1 = p0 + S([0, h if up else -h, 0.004])
    t = Loft(smoothpath([p0, p1], 3), prof([(0, w), (1, 0.0008)], 3), prof([(0, w), (1, 0.0008)], 3), p=2.0, segs=6, tile=0.02)
    return rigid(t.mesh(), bone)
for sx in (1, -1):
    add('croc_h%d' % sx, tooth(sx * 0.02, 0.713, 0.675, -0.026, 0.0065, True, 'Head'), 'bone')
    add('croc_b%d' % sx, tooth(sx * 0.021, 0.689, 0.66, 0.022, 0.0055, True, 'Jaw'), 'bone')
    add('canine_h%d' % sx, tooth(sx * 0.033, 0.715, 0.64, -0.034, 0.008, True, 'Head'), 'bone')
    add('canine_b%d' % sx, tooth(sx * 0.031, 0.688, 0.625, 0.028, 0.007, True, 'Jaw'), 'bone')
# oreilles (plaques fines, pointe sombre)
for sx in (1, -1):
    ep = smoothpath([(sx * 0.045, 0.80, 0.46), (sx * 0.062, 0.865, 0.44), (sx * 0.062, 0.92, 0.425)], 8)
    t = np.linspace(0, 1, 8)
    ear = Loft(ep, 0.006, 0.040 * (1 - t) ** 0.8 + 0.003, p=2.0, segs=8, cap1=2, tile=0.08, ref=(1, 0, 0))
    m = paint(ear.mesh(), lambda p, n: (0.6 + 0.0, 0.58, 0.57, 1)); rigid(m, 'Head'); add('oreille%d' % sx, m, 'fur')
# yeux ambrés lumineux
for sx in (1, -1):
    ep = smoothpath([(sx * 0.052, 0.772, 0.585), (sx * 0.063, 0.768, 0.568), (sx * 0.068, 0.760, 0.552)], 6)
    e = Loft(ep, prof([(0, .0025), (.5, .005), (1, .002)], 6), prof([(0, .0018), (.5, .0065), (1, .0016)], 6), p=2.0, segs=8, cap0=1, cap1=1, tile=0.03, ref=(0, 1, 0))
    m = e.mesh(); rigid(m, 'Head'); add('oeil%d' % sx, m, 'glow')

# ---- pattes -----------------------------------------------------------------------------------
def fleg(sign):
    pts = [(sign * 0.105, 0.64, 0.27), FL['Fore'], (sign * 0.105, 0.15, 0.285), (sign * 0.105, 0.045, 0.31)]
    pth = smoothpath([(sign * 0.105, 0.64, 0.27), (sign * FL['Fore'][0], FL['Fore'][1], FL['Fore'][2]), (sign * 0.105, 0.14, 0.285), (sign * 0.105, 0.045, 0.315)], 16)
    L = Loft(pth, 1.38 * prof([(0, .062), (.3, .050), (.5, .036), (.75, .028), (.92, .03), (1, .026)], 16), 1.38 * prof([(0, .052), (.3, .044), (.5, .032), (.75, .024), (.92, .03), (1, .028)], 16), p=2.3, segs=12, cap0=1, cap1=2, tile=0.2)
    return L
def rleg(sign):
    pth = smoothpath([(sign * 0.105, 0.66, -0.30), (sign * 0.105, 0.50, -0.26), (sign * 0.105, 0.39, -0.205), (sign * 0.105, 0.25, -0.30), (sign * 0.105, 0.14, -0.31), (sign * 0.105, 0.05, -0.255)], 20)
    return Loft(pth, 1.38 * prof([(0, .085), (.2, .075), (.4, .045), (.55, .03), (.8, .024), (1, .028)], 20), 1.38 * prof([(0, .07), (.2, .066), (.4, .04), (.55, .028), (.8, .022), (1, .03)], 20), p=2.3, segs=12, cap0=1, cap1=2, tile=0.2)
fl = fleg(1); m = paint(fl.mesh(), fur_tone)
skin_chain(m, [FL['Upper'], FL['Fore'], FL['Paw'], FL['Toe']], [B['FrontUpper_L'], B['FrontFore_L'], B['FrontPaw_L'], B['FrontToe_L']], blend=0.07)
add('patte_av', m, 'fur', both=True)
rl = rleg(1); m = paint(rl.mesh(), fur_tone)
skin_chain(m, [(0.105, 0.62, -0.30), RL['Thigh'], RL['Shin'], RL['Hock'], RL['Paw'], RL['Toe']], [B['Hips'], B['Thigh_L'], B['Shin_L'], B['Hock_L'], B['RearPaw_L'], B['RearToe_L']], blend=0.07)
add('patte_ar', m, 'fur', both=True)
# griffes d'os
for sx in (1, -1):
    for k, dx in enumerate((-0.014, 0.0, 0.014)):
        for nm, base_, bone_ in (('av', (0.105, 0.035, 0.335), 'FrontToe_L' if sx > 0 else 'FrontToe_R'), ('ar', (0.105, 0.035, -0.228), 'RearToe_L' if sx > 0 else 'RearToe_R')):
            p0 = S([sx * base_[0] + dx, base_[1], base_[2]]); p1 = p0 + S([0, -0.03, 0.03])
            c = Loft(smoothpath([p0, p1], 3), prof([(0, .0065), (1, .0008)], 3), prof([(0, .0065), (1, .0008)], 3), p=2.0, segs=6, tile=0.02)
            add(f'griffe_{nm}{sx}{k}', rigid(c.mesh(), bone_), 'bone')

# ---- queue : touffue ----------------------------------------------------------------------------
tp = smoothpath([(0, 0.64, -0.40), (0, 0.62, -0.55), (0, 0.57, -0.72), (0, 0.50, -0.88)], 10)
tail = Loft(tp, prof([(0, .05), (.4, .056), (.8, .05), (1, .008)], 10), prof([(0, .045), (.4, .05), (.8, .045), (1, .008)], 10), p=2.3, segs=12, cap1=1, tile=0.2)
m = paint(tail.mesh(), fur_tone)
skin_chain(m, [J['Tail1'], J['Tail2'], J['Tail3'], (0, 0.45, -0.92)], [B['Tail1'], B['Tail2'], B['Tail3'], B['Tail3']], blend=0.1)
add('queue', m, 'fur')

# ---- crinière en lames de pelage + épines d'os le long du dos -----------------------------------
def tuft(base, direction, length, width, bone_chain=None, bone=None, bend=(0, 0, 0)):
    base = S(base, float); d = S(direction, float); d = d / np.linalg.norm(d)
    tip = base + d * length
    pth = smoothpath([base, (base + tip) / 2 + S(bend), tip], 6)
    t = np.linspace(0, 1, 6)
    w = width * (1 - t) ** 0.7 + 0.0015
    L = Loft(pth, 0.0035, w, p=2.0, segs=6, cap1=1, tile=0.05, ref=(1, 0, 0))
    m = L.mesh()
    m.C = np.tile([0.42, 0.40, 0.40, 1.0], (len(m.V), 1))
    return m
tufts = []
# crinière : de la nuque aux épaules, en deux rangs
for i in range(26):
    u = i / 25
    z = 0.50 - u * 0.30                                   # de la tête vers les épaules
    y = 0.775 - u * 0.025 + 0.0
    for sx in (-1, 0, 1):
        x = sx * (0.045 - 0.01 * u)
        d = S([sx * 0.55, 0.35 - 0.1 * u, -0.85]) + rng.normal(0, 0.08, 3)
        tufts.append(tuft((x, y, z), d, 0.13 + 0.05 * np.sin(u * 3) + rng.uniform(0, .04), 0.022, bend=(0, 0.015, 0)))
for i in range(18):                                        # le long du dos
    u = i / 17
    z = 0.22 - u * 0.52; y = 0.77 - 0.065 * u + 0.0
    for sx in (-1, 1):
        d = S([sx * 0.5, 0.45, -0.8]) + rng.normal(0, 0.06, 3)
        tufts.append(tuft((sx * 0.025, y, z), d, 0.10 + rng.uniform(0, .04), 0.018))
m = concat(tufts)
skin_chain(m, [J['Head'], J['Neck'], J['Chest'], J['Spine2'], J['Spine1'], J['Hips']], [B['Head'], B['Neck'], B['Chest'], B['Spine2'], B['Spine1'], B['Hips']], blend=0.1)
add('criniere', m, 'fur')
# épines d'os sur l'échine
bones_ = []
for i in range(7):
    u = i / 6; z = 0.32 - u * 0.58; y = 0.745 - 0.075 * u
    h = 0.075 - 0.02 * abs(u - 0.4)
    p0 = S([0, y, z]); p1 = p0 + S([0, h, -0.025])
    c = Loft(S([p0, (p0 + p1) / 2 + S([0, 0, 0.004]), p1]), prof([(0, .012), (1, .0012)], 3), prof([(0, .018), (1, .0012)], 3), p=2.0, segs=6, tile=0.04, ref=(1, 0, 0))
    bones_.append(c.mesh())
m = concat(bones_)
skin_chain(m, [J['Chest'], J['Spine2'], J['Spine1'], J['Hips']], [B['Chest'], B['Spine2'], B['Spine1'], B['Hips']], blend=0.1)
add('epines', m, 'bone')
