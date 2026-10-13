"""Griffon — monture volante : corps et pattes arrière de lion, pattes avant et tête d'aigle, grandes ailes à plumes.
Squelette : 29 os du quadrupède + 3 os d'aile par côté (WingU / WingF / WingT). Regarde +Z, serres à y = 0, envergure ≈ 3,6 m.
Matériaux teintables au chargement : coat (corps), feather (plumage), beak (bec/serres)."""
import numpy as np
from glbkit import *
S = np.array

J = {'Root': (0, 0, 0), 'Hips': (0, 0.95, -0.45), 'Spine1': (0, 0.98, -0.20), 'Spine2': (0, 1.02, 0.10), 'Chest': (0, 1.05, 0.40),
     'Neck': (0, 1.14, 0.55), 'Head': (0, 1.46, 0.80), 'Jaw': (0, 1.37, 0.92),
     'Tail1': (0, 0.98, -0.66), 'Tail2': (0, 0.90, -0.95), 'Tail3': (0, 0.80, -1.22)}
FL = {'Upper': (0.17, 0.95, 0.38), 'Fore': (0.17, 0.56, 0.42), 'Paw': (0.17, 0.22, 0.50), 'Toe': (0.17, 0.05, 0.58)}
RL = {'Thigh': (0.19, 0.92, -0.45), 'Shin': (0.19, 0.62, -0.34), 'Hock': (0.19, 0.40, -0.50), 'Paw': (0.19, 0.16, -0.47), 'Toe': (0.19, 0.05, -0.42)}
WG = {'U': (0.22, 1.24, 0.12), 'F': (0.95, 1.36, 0.02), 'T': (1.62, 1.31, -0.22)}
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
    SK.add(f'WingU_{sd}', 'Chest', f(WG['U'])); SK.add(f'WingF_{sd}', f'WingU_{sd}', f(WG['F'])); SK.add(f'WingT_{sd}', f'WingF_{sd}', f(WG['T']))
B = {n: i for i, n in enumerate(SK.names)}
SWAP = {B[n]: B[n.replace('_L', '_R')] for n in SK.names if n.endswith('_L')}
SWAP.update({v: k for k, v in SWAP.items()})
parts = []
def add(name, mesh, mat, both=False):
    parts.append((name, mesh, mat))
    if both: parts.append((name + '_R', mirror_x(mesh, SWAP), mat))
def rigid(m, bone): return skin_rigid(m, B[bone])
rng = np.random.default_rng(13)
def flat(m, v=1.0): m.C = np.tile([v, v, v, 1.0], (len(m.V), 1)); return m
def shade(m, belly=0.2):
    N = normals(m); up = 0.5 + 0.5 * np.clip(N[:, 1], -1, 1); t = 1 - belly * (1 - up)
    m.C = np.stack([t, t, t, np.ones_like(t)], 1); return m
SPINE = ([J['Hips'], J['Spine1'], J['Spine2'], J['Chest'], J['Neck']], [B['Hips'], B['Spine1'], B['Spine2'], B['Chest'], B['Neck']])

# ---- corps de lion ---------------------------------------------------------------------------------
n = 16
bp = smoothpath([(0, 0.93, -0.62), (0, 0.95, -0.40), (0, 0.99, -0.05), (0, 1.03, 0.25), (0, 1.07, 0.48)], n)
body = Loft(bp, prof([(0, .20), (.15, .25), (.5, .22), (.8, .27), (1, .22)], n), prof([(0, .17), (.15, .21), (.5, .185), (.8, .22), (1, .18)], n), p=2.4, segs=20, cap0=2, cap1=1, tile=0.5)
m = shade(body.mesh()); skin_chain(m, *SPINE, blend=0.15); add('corps', m, 'coat')
# ---- cou emplumé (collerette) + tête d'aigle ---------------------------------------------------------
nn = 10
neck = Loft(smoothpath([(0, 1.08, 0.46), (0, 1.22, 0.60), (0, 1.38, 0.74)], nn), prof([(0, .17), (.5, .15), (1, .105)], nn), prof([(0, .17), (.5, .14), (1, .095)], nn), p=2.3, segs=16, tile=0.3)
m = flat(neck.mesh()); skin_chain(m, [J['Chest'], J['Neck'], J['Head']], [B['Chest'], B['Neck'], B['Head']], blend=0.1); add('cou', m, 'feather')
hn = 9
head = Loft(smoothpath([(0, 1.44, 0.74), (0, 1.47, 0.82), (0, 1.45, 0.90)], hn), prof([(0, .105), (.5, .10), (1, .07)], hn), prof([(0, .085), (.5, .09), (1, .06)], hn), p=2.3, segs=16, cap0=1, cap1=2, tile=0.2)
m = flat(head.mesh()); rigid(m, 'Head'); add('tete', m, 'feather')
# bec crochu : mandibule haute courbée vers le bas, mandibule basse sur l'os Jaw
bk = smoothpath([(0, 1.43, 0.88), (0, 1.43, 0.99), (0, 1.40, 1.06), (0, 1.33, 1.085)], 10)
beak = Loft(bk, prof([(0, .055), (.5, .042), (1, .004)], 10), prof([(0, .048), (.5, .036), (1, .004)], 10), p=2.2, segs=14, cap1=1, tile=0.15)
m = flat(beak.mesh()); rigid(m, 'Head'); add('bec_haut', m, 'beak')
jb = Loft(smoothpath([(0, 1.385, 0.86), (0, 1.375, 0.96), (0, 1.365, 1.03)], 7), prof([(0, .028), (1, .006)], 7), prof([(0, .04), (1, .01)], 7), p=2.2, segs=12, cap1=1, tile=0.15)
m = flat(jb.mesh()); rigid(m, 'Jaw'); add('bec_bas', m, 'beak')
for s in (1, -1):
    e = Loft(smoothpath([S([s * 0.07, 1.50, 0.86]), S([s * 0.083, 1.495, 0.845])], 3), 0.014, 0.017, p=2.0, segs=10, cap0=2, cap1=2, tile=.03, ref=(0, 1, 0))
    m = e.mesh(); rigid(m, 'Head'); add('oeil%d' % s, m, 'glow')
    br = Loft(smoothpath([S([s * 0.03, 1.535, 0.93]), S([s * 0.075, 1.54, 0.85]), S([s * 0.095, 1.52, 0.78])], 6), 0.01, 0.014, p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 1, 0))
    m = flat(br.mesh()); rigid(m, 'Head'); add('arcade%d' % s, m, 'feather')
# crête de plumes derrière la tête
cr = []
for k in range(7):
    a = (k - 3) / 3
    p0 = S([0.025 * a, 1.52, 0.74]); p1 = p0 + S([0.06 * a, 0.10 - 0.02 * abs(a), -0.15])
    cr.append(Loft(smoothpath([p0, (p0 + p1) / 2 + S([0, 0.03, 0]), p1], 6), 0.004, prof([(0, .02), (.4, .022), (1, .003)], 6), p=2.0, segs=6, cap1=1, tile=.1, ref=(0, 1, 0)).mesh())
m = concat(cr); m.C[:] = 1.0; rigid(m, 'Head'); add('crete', m, 'feather')
# collerette : plumes sur le cou
ruff = []
for k in range(26):
    u = k / 25; a = rng.uniform(-1, 1)
    p0 = S([0.10 * a, 1.12 + 0.28 * u, 0.50 + 0.22 * u + 0.1 * abs(a) * (1 - u)])
    p1 = p0 + S([0.12 * a, -0.05, -0.17 - 0.05 * rng.random()])
    ruff.append(Loft(smoothpath([p0, (p0 + p1) / 2 + S([0, 0.02, 0]), p1], 6), 0.004, prof([(0, .02), (.5, .028), (1, .004)], 6), p=2.0, segs=6, cap1=1, tile=.1, ref=(0, 1, 0)).mesh())
m = concat(ruff); m.C[:] = 1.0; skin_chain(m, [J['Chest'], J['Neck'], J['Head']], [B['Chest'], B['Neck'], B['Head']], blend=0.1); add('collerette', m, 'feather')
# ---- pattes avant d'aigle (plumes jusqu'au genou, serres) ----------------------------------------------
def fleg(s):
    pth = smoothpath([(s * 0.17, 1.0, 0.38), (s * 0.17, 0.62, 0.42), (s * 0.17, 0.30, 0.48), (s * 0.17, 0.10, 0.55)], 14)
    return Loft(pth, prof([(0, .11), (.4, .075), (.6, .04), (1, .032)], 14), prof([(0, .09), (.4, .07), (.6, .036), (1, .032)], 14), p=2.3, segs=12, cap0=1, tile=0.25)
m = flat(fleg(1).mesh()); skin_chain(m, [FL['Upper'], FL['Fore'], FL['Paw'], FL['Toe']], [B['FrontUpper_L'], B['FrontFore_L'], B['FrontPaw_L'], B['FrontToe_L']], blend=0.08)
add('patte_av', m, 'feather', both=True)
def talons(s, base, bones, kind):
    out = []
    for k, dx in enumerate((-0.035, 0.0, 0.035)):
        p0 = S([s * base[0] + dx, base[1], base[2]]); p1 = p0 + S([0.0, -0.03, 0.10]); p2 = p1 + S([0.0, -0.05, 0.04])
        c = Loft(smoothpath([p0, p1, p2], 6), prof([(0, .016), (.5, .011), (1, .002)], 6), prof([(0, .015), (.5, .010), (1, .002)], 6), p=2.1, segs=8, cap1=1, tile=.04, ref=(1, 0, 0))
        out.append(c.mesh())
    p0 = S([s * base[0], base[1] + 0.01, base[2] - 0.03]); p1 = p0 + S([0, -0.03, -0.07]); 
    out.append(Loft(smoothpath([p0, p1], 4), prof([(0, .015), (1, .002)], 4), prof([(0, .014), (1, .002)], 4), p=2.1, segs=8, cap1=1, tile=.04).mesh())
    m = concat(out); m.C[:] = 1.0; return rigid(m, bones)
for s in (1, -1):
    add(f'serres_av{s}', talons(s, (0.17, 0.065, 0.56), 'FrontToe_L' if s > 0 else 'FrontToe_R', 'f'), 'claw')
# ---- pattes arrière de lion ------------------------------------------------------------------------------
def rleg(s):
    pth = smoothpath([(s * 0.19, 1.00, -0.45), (s * 0.19, 0.70, -0.36), (s * 0.19, 0.48, -0.52), (s * 0.19, 0.28, -0.50), (s * 0.19, 0.08, -0.44)], 18)
    return Loft(pth, prof([(0, .13), (.25, .10), (.5, .05), (.75, .04), (1, .046)], 18), prof([(0, .11), (.25, .09), (.5, .045), (.75, .036), (1, .05)], 18), p=2.3, segs=12, cap0=1, tile=0.25)
m = shade(rleg(1).mesh(), 0.1); skin_chain(m, [(0.19, 0.98, -0.45), RL['Thigh'], RL['Shin'], RL['Hock'], RL['Paw'], RL['Toe']], [B['Hips'], B['Thigh_L'], B['Shin_L'], B['Hock_L'], B['RearPaw_L'], B['RearToe_L']], blend=0.08)
add('patte_ar', m, 'coat', both=True)
for s in (1, -1):
    ps = []
    for k, dx in enumerate((-0.03, 0.0, 0.03)):
        p0 = S([s * 0.19 + dx, 0.045, -0.40]); p1 = p0 + S([0, -0.02, 0.07])
        ps.append(Loft(smoothpath([p0, p1], 4), prof([(0, .012), (1, .002)], 4), prof([(0, .012), (1, .002)], 4), p=2.1, segs=8, cap1=1, tile=.04).mesh())
    m = concat(ps); m.C[:] = 1.0; add(f'griffes_ar{s}', rigid(m, 'RearToe_L' if s > 0 else 'RearToe_R'), 'claw')
# ---- queue de lion à houppe ------------------------------------------------------------------------------
tail = Loft(smoothpath([(0, 0.97, -0.60), (0, 0.92, -0.90), (0, 0.84, -1.18), (0, 0.78, -1.32)], 10), prof([(0, .045), (.8, .035), (1, .02)], 10), prof([(0, .045), (.8, .035), (1, .02)], 10), p=2.2, segs=10, cap0=1, tile=0.2)
m = flat(tail.mesh()); skin_chain(m, [J['Tail1'], J['Tail2'], J['Tail3'], (0, 0.78, -1.32)], [B['Tail1'], B['Tail2'], B['Tail3'], B['Tail3']], blend=0.1); add('queue', m, 'coat')
tf = []
for k in range(14):
    a = (k - 6.5) / 6.5; p0 = S([0, 0.80, -1.25]); p1 = S([0.10 * a, 0.62 - 0.03 * abs(a), -1.52 - 0.04 * rng.random()])
    tf.append(Loft(smoothpath([p0, (p0 + p1) / 2 + S([0.02 * a, 0.0, 0]), p1], 6), 0.008, prof([(0, .02), (.4, .03), (1, .004)], 6), p=2.0, segs=6, cap1=1, tile=.1, ref=(0, 1, 0)).mesh())
m = concat(tf); m.C[:] = 1.0; skin_chain(m, [J['Tail2'], J['Tail3']], [B['Tail2'], B['Tail3']], blend=0.1); add('houppe', m, 'feather')
# ---- ailes ---------------------------------------------------------------------------------------------------
WCH = ([WG['U'], WG['F'], WG['T']], [B['WingU_L'], B['WingF_L'], B['WingT_L']])
arm = Loft(smoothpath([WG['U'], S([0.55, 1.31, 0.09]), WG['F'], S([1.30, 1.34, -0.09]), WG['T']], 14), prof([(0, .06), (.4, .045), (.7, .035), (1, .014)], 14), prof([(0, .06), (.4, .05), (.7, .04), (1, .014)], 14), p=2.3, segs=10, cap1=1, tile=0.3)
m = shade(arm.mesh(), 0.1); skin_chain(m, *WCH, blend=0.1); add('aile_bras', m, 'coat', both=True)
def plume(base, ang, length, width, droop=0.05):
    base = S(base, float); d = S([np.sin(ang), 0.0, -np.cos(ang)])             # ang = écart vers l'extérieur (rad) ; direction vers l'arrière
    tip = base + d * length + S([0, -droop, 0])
    pth = smoothpath([base, (base + tip) / 2 + S([0, 0.012, 0]), tip], 7)
    return Loft(pth, 0.0035, prof([(0, width), (.5, width * 1.05), (.9, width * 0.7), (1, 0.006)], 7), p=2.0, segs=6, cap1=1, tile=0.1, ref=(0, 1, 0)).mesh()
fe = []
for k in range(10):                                            # rémiges primaires : de la main vers le bout
    t = k / 9; bx = 1.00 + 0.62 * t
    fe.append(plume((bx, 1.34 - 0.03 * t, 0.0 - 0.20 * t), 0.10 + 0.32 * t - 0.14 * (1 - t), 0.85 - 0.28 * t + 0.1 * np.sin(t * np.pi), 0.055 - 0.012 * t))
for k in range(9):                                             # rémiges secondaires : de l'avant-bras vers l'épaule
    t = k / 8; bx = 0.95 - 0.70 * t
    fe.append(plume((bx, 1.34 - 0.06 * t, 0.0 + 0.10 * t - 0.02), -0.04 - 0.10 * t, 0.62 + 0.04 * t, 0.060))
m = concat(fe); m.C[:] = 1.0; skin_chain(m, *WCH, blend=0.12); add('aile_remiges', m, 'feather', both=True)
cv = []
for row in range(2):                                           # couvertures : petites plumes recouvrant la base des rémiges
    for k in range(13):
        t = k / 12; bx = 0.25 + 1.35 * t
        cv.append(plume((bx, 1.35 - 0.04 * t + 0.015 * row, 0.09 - 0.25 * t - 0.01 * row), 0.0 + 0.05 * t, 0.30 - 0.06 * row - 0.05 * t, 0.045 - 0.006 * row))
m = concat(cv); m.C[:] = 1.0; skin_chain(m, *WCH, blend=0.12); add('aile_couvertures', m, 'feather', both=True)

# ---- harnachement : couverture, selle, sangle, étriers ------------------------------------------------------------
TOP = 1.21
cl = Loft(smoothpath([(0, 1.09, -0.12), (0, 1.12, 0.12), (0, 1.14, 0.34)], 5), prof([(0, .03), (1, .03)], 5), prof([(0, .27), (.5, .29), (1, .26)], 5), p=2.5, segs=16, tile=0.3)
m = cl.mesh(); skin_chain(m, [J['Spine1'], J['Spine2'], J['Chest']], [B['Spine1'], B['Spine2'], B['Chest']], blend=0.2); add('couverture', m, 'cloth')
sd_ = Loft(smoothpath([(0, 1.20, -0.20), (0, 1.25, 0.06), (0, 1.25, 0.28)], 6), prof([(0, .07), (.5, .05), (1, .07)], 6), prof([(0, .13), (.5, .10), (1, .11)], 6), p=2.4, segs=16, cap0=1, cap1=1, tile=0.25)
m = sd_.mesh(); skin_chain(m, [J['Spine1'], J['Spine2'], J['Chest']], [B['Spine1'], B['Spine2'], B['Chest']], blend=0.2); add('selle', m, 'leather')
for nm, y_, z_ in (('pommeau', 1.34, 0.28), ('troussequin', 1.32, -0.22)):
    c_ = Loft(smoothpath([(0, y_ - 0.06, z_), (0, y_, z_)], 4), prof([(0, .035), (1, .03)], 4), prof([(0, .045), (1, .03)], 4), p=2.3, segs=12, cap1=2, tile=0.1)
    m = c_.mesh(); skin_chain(m, [J['Spine1'], J['Spine2'], J['Chest']], [B['Spine1'], B['Spine2'], B['Chest']], blend=0.2); add(nm, m, 'leather')
gi = Loft(smoothpath([(0, 1.12, 0.12), (0, 0.80, 0.14), (0, 0.66, 0.15)], 8), 0.02, prof([(0, .27), (.5, .26), (1, .18)], 8), p=3.0, segs=16, tile=0.2)
m = gi.mesh(); skin_chain(m, [J['Spine2'], J['Chest']], [B['Spine2'], B['Chest']], blend=0.3); add('sangle', m, 'leather')
