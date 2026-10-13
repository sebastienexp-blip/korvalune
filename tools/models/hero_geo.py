"""Le Veilleur de Corvalune — géométrie, squelette et skinning (armure noire « corbeau & lune »)."""
import numpy as np
from glbkit import *

S = np.array

# ------------------------------------------------------------------------------------------- squelette
SK = Skeleton()
P = {  # positions des joints (pose de repos, bras légèrement écartés)
    'Root': (0, 0, 0), 'Hips': (0, 0.98, 0), 'Spine': (0, 1.07, 0), 'Chest': (0, 1.22, 0), 'Neck': (0, 1.50, 0.005), 'Head': (0, 1.58, 0.015),
    'Shoulder': (0.07, 1.45, 0), 'UpperArm': (0.215, 1.42, 0), 'LowerArm': (0.262, 1.134, 0.0), 'Hand': (0.328, 0.872, 0.02),
    'UpperLeg': (0.095, 0.965, 0), 'LowerLeg': (0.100, 0.520, 0.012), 'Foot': (0.100, 0.100, -0.012), 'Toe': (0.100, 0.045, 0.115),
    'Cape_1': (0, 1.46, -0.125), 'Cape_2': (0, 1.16, -0.165), 'Cape_3': (0, 0.82, -0.2),
}
def mx(p):
    return (-p[0], p[1], p[2])

SK.add('Root', None, P['Root']); SK.add('Hips', 'Root', P['Hips']); SK.add('Spine', 'Hips', P['Spine']); SK.add('Chest', 'Spine', P['Chest'])
SK.add('Neck', 'Chest', P['Neck']); SK.add('Head', 'Neck', P['Head'])
for side, sx in (('L', 1), ('R', -1)):
    f = (lambda p: p) if sx > 0 else mx
    SK.add(f'Shoulder_{side}', 'Chest', f(P['Shoulder'])); SK.add(f'UpperArm_{side}', f'Shoulder_{side}', f(P['UpperArm']))
    SK.add(f'LowerArm_{side}', f'UpperArm_{side}', f(P['LowerArm'])); SK.add(f'Hand_{side}', f'LowerArm_{side}', f(P['Hand']))
    SK.add(f'UpperLeg_{side}', 'Hips', f(P['UpperLeg'])); SK.add(f'LowerLeg_{side}', f'UpperLeg_{side}', f(P['LowerLeg']))
    SK.add(f'Foot_{side}', f'LowerLeg_{side}', f(P['Foot'])); SK.add(f'Toe_{side}', f'Foot_{side}', f(P['Toe']))
SK.add('Cape_1', 'Chest', P['Cape_1']); SK.add('Cape_2', 'Cape_1', P['Cape_2']); SK.add('Cape_3', 'Cape_2', P['Cape_3'])
# points d'attache (sans déformation) : arme main droite, dos
SK.add('Socket_Weapon_R', 'Hand_R', (-0.345, 0.80, 0.05)); SK.add('Socket_Back', 'Chest', (0, 1.30, -0.16))
B = {n: i for i, n in enumerate(SK.names)}
SWAP = {B[n]: B[n.replace('_L', '_R')] for n in SK.names if n.endswith('_L')}
SWAP.update({v: k for k, v in SWAP.items()})

def mirrored(mesh):
    return mirror_x(mesh, SWAP)

def tri(q):  # 1 au centre, 0 aux bords
    return 1 - np.abs(2 * q - 1)

# ------------------------------------------------------------------------------------------- pièces
parts = []   # (nom, Mesh, matériau)

def add(name, mesh, mat, both=False):
    parts.append((name, mesh, mat))
    if both:
        parts.append((name + '_R', mirrored(mesh), mat))

def vpath(x, y0, y1, z=0.0, n=14):
    return np.stack([np.full(n, x), np.linspace(y0, y1, n), np.full(n, z)], 1)

# ---- sous-vêtement : torse, cou, bras, jambes ------------------------------------------------
N_T = 18
tp = smoothpath([(0, 0.88, 0.0), (0, 1.00, 0.0), (0, 1.17, 0.005), (0, 1.33, 0.0), (0, 1.45, -0.005), (0, 1.53, 0.0)], N_T)
torso = Loft(tp, prof([(0, .125), (.2, .122), (.5, .118), (.72, .13), (.9, .12), (1, .075)], N_T),
             prof([(0, .165), (.2, .152), (.45, .142), (.72, .185), (.88, .185), (1, .075)], N_T), p=2.6, segs=24, cap0=2, cap1=1, tile=0.4)
m = torso.mesh(); skin_chain(m, [P['Hips'], P['Spine'], P['Chest'], P['Neck']], [B['Hips'], B['Spine'], B['Chest'], B['Neck']], blend=0.12)
add('torse', m, 'cloth')

neck = Loft(vpath(0, 1.47, 1.62, 0.01, 8), .052, .05, p=2.2, segs=14, cap1=2, tile=0.3)
m = neck.mesh(); skin_chain(m, [P['Neck'], P['Head']], [B['Neck'], B['Head']], blend=0.04); add('cou', m, 'leather')

def limb_arm():
    pth = smoothpath([(0.205, 1.43, 0), P['LowerArm'], P['Hand']], 22)
    rf = prof([(0, .056), (.35, .05), (.5, .043), (.62, .048), (.85, .036), (1, .033)], 22)
    rs = prof([(0, .058), (.35, .052), (.5, .044), (.62, .05), (.85, .037), (1, .034)], 22)
    return Loft(pth, rf, rs, p=2.3, segs=16, cap0=2, cap1=1, tile=0.3)
arm = limb_arm(); m = arm.mesh()
skin_chain(m, [P['UpperArm'], P['LowerArm'], P['Hand']], [B['UpperArm_L'], B['LowerArm_L'], B['Hand_L']], blend=0.07)
add('bras', m, 'cloth', both=True)

def limb_leg():
    pth = smoothpath([(0.092, 1.0, 0.0), P['LowerLeg'], (0.100, 0.115, -0.012)], 26)
    rf = prof([(0, .098), (.3, .088), (.5, .064), (.6, .066), (.72, .06), (1, .042)], 26)
    rs = prof([(0, .098), (.3, .086), (.5, .063), (.6, .062), (.72, .055), (1, .04)], 26)
    of = prof([(0, 0), (.5, 0), (.62, -.012), (.8, -.004), (1, 0)], 26)
    return Loft(pth, rf, rs, p=2.3, of=of, segs=16, cap0=1, cap1=1, tile=0.3)
leg = limb_leg(); m = leg.mesh()
skin_chain(m, [(0.092, 1.03, 0), P['UpperLeg'], P['LowerLeg'], P['Foot']], [B['Hips'], B['UpperLeg_L'], B['LowerLeg_L'], B['Foot_L']], blend=0.09)
add('jambe', m, 'cloth', both=True)

# ---- bottes ------------------------------------------------------------------------------------
bp = smoothpath([(0.100, 0.20, -0.012), (0.100, 0.085, -0.006), (0.100, 0.05, 0.05), (0.100, 0.042, 0.14), (0.100, 0.04, 0.2)], 14)
boot = Loft(bp, prof([(0, .056), (.35, .05), (.7, .034), (1, .026)], 14), prof([(0, .058), (.35, .062), (.7, .056), (1, .038)], 14), p=2.8, segs=16, cap0=0, cap1=3, tile=.3, ref=(0, 0, 1))
# l'axe « avant » de la section est la normale transportée ; ici on veut hauteur (rf) / largeur (rs)
m = boot.mesh(); skin_rigid(m, B['Foot_L']); add('botte', m, 'leather', both=True)

# ---- mains : paume + doigts recourbés autour de la poignée -------------------------------------
def hand_mesh():
    hp = S([[0.328, 0.872, 0.02], [0.336, 0.83, 0.032], [0.342, 0.795, 0.045]])
    palm = Loft(smoothpath(hp, 6), prof([(0, .026), (1, .03)], 6), prof([(0, .036), (1, .042)], 6), p=3.0, segs=12, cap0=1, cap1=1, tile=.2, ref=(0, 0, 1))
    ms = [palm.mesh()]
    # quatre doigts
    for k in range(4):
        z = 0.03 + k * 0.0 ; xo = (k - 1.5) * 0.0   # espacés le long de Z (de l'avant vers l'arrière)
        base = S([0.346 + 0.002 * k, 0.792, 0.07 - k * 0.024])
        f1 = base + S([0.012, -0.022, 0.012]); f2 = f1 + S([0.004, -0.012, 0.022]); f3 = f2 + S([-0.012, 0.0, 0.02])
        L = 1 - 0.07 * abs(k - 1.2)
        pth = smoothpath([base, f1, f2, f3], 8)
        fg = Loft(pth, prof([(0, .0125), (1, .009)], 8), prof([(0, .0125), (1, .009)], 8), p=2.2, segs=8, cap1=2, tile=.15, ref=(1, 0, 0))
        ms.append(fg.mesh())
    # pouce
    tp_ = smoothpath([S([0.318, 0.842, 0.05]), S([0.322, 0.818, 0.075]), S([0.33, 0.805, 0.085])], 6)
    th = Loft(tp_, prof([(0, .013), (1, .009)], 6), prof([(0, .013), (1, .009)], 6), p=2.2, segs=8, cap1=2, tile=.15, ref=(1, 0, 0))
    ms.append(th.mesh())
    return concat(ms)
hand = hand_mesh(); skin_rigid(hand, B['Hand_L']); add('main', hand, 'leather', both=True)

# =========================================================================================== ARMURE
def rigid(mesh, bone):
    return skin_rigid(mesh, B[bone] if isinstance(bone, str) else bone)

def sh(loft, bone, **kw):
    return rigid(shell(loft, **kw), bone)

def wrap(a_seam):  # tour complet dont la couture est à l'angle a_seam
    return dict(a0=a_seam, a1=a_seam + 1.0)

def notch(n, depth):
    return lambda a: 1 - depth * np.abs(np.sin(np.pi * n * a))

# ---- cuirasse ------------------------------------------------------------------------------------
cuir_hi = lambda a: 0.93 - 2.2 * a * a
cuir_lo = lambda a: 0.43 + 0.95 * np.abs(a)
add('plastron', sh(torso, 'Chest', a0=-0.215, a1=0.215, t_lo=cuir_lo, t_hi=cuir_hi, offset=0.010, thick=0.012, bevel=0.010, na=34, nt=18, dome=0.007, tile=0.35), 'steel')
# arête centrale + croissant gravé (ornement argenté)
add('arete', sh(torso, 'Chest', a0=-0.018, a1=0.018, t_lo=0.50, t_hi=0.90, offset=0.030, thick=0.008, bevel=0.006, na=6, nt=18, tile=0.2), 'trim')
add('medaillon', sh(torso, 'Chest', a0=-0.05, a1=0.05, t_lo=0.60, t_hi=0.76, offset=0.034, thick=0.012, bevel=0.01, na=14, nt=12, dome=0.012, tile=0.1), 'trim')
add('dos', sh(torso, 'Chest', a0=0.30, a1=0.70, t_lo=lambda a: 0.40 + 0.5 * np.abs(a - 0.5), t_hi=lambda a: 0.92 - 1.8 * (a - 0.5) ** 2, offset=0.010, thick=0.011, bevel=0.010, na=30, nt=16, dome=0.004), 'steel')
for k, (lo, hi, off) in enumerate([(0.17, 0.285, 0.006), (0.265, 0.385, 0.011), (0.36, 0.46, 0.016)]):
    add(f'lame{k}', sh(torso, 'Spine', **wrap(0.5), t_lo=lo, t_hi=hi, offset=off, thick=0.008, bevel=0.01, na=44, nt=6, tile=0.4), 'steel')
# ceinture + boucle
add('ceinture', sh(torso, 'Hips', **wrap(0.5), t_lo=0.085, t_hi=0.185, offset=0.016, thick=0.01, bevel=0.01, na=44, nt=6, tile=0.2), 'leather')
add('boucle', sh(torso, 'Hips', a0=-0.045, a1=0.045, t_lo=0.075, t_hi=0.2, offset=0.026, thick=0.012, bevel=0.01, na=12, nt=10, dome=0.01, tile=0.1), 'trim')

# ---- faulds : jupe de plaques en plumes, deux rangs ---------------------------------------------
N_S = 10
sp = smoothpath([(0, 1.02, 0), (0, 0.9, 0), (0, 0.76, 0), (0, 0.60, 0)], N_S)
skirt = Loft(sp, prof([(0, .125), (1, .205)], N_S), prof([(0, .17), (1, .27)], N_S), p=2.5, segs=44, tile=0.4)

def skin_skirt(m, bone_h='Hips'):
    y = m.V[:, 1]; x = m.V[:, 0]
    s_ = smoothstep((1.0 - y) / 0.42) * 0.7
    wl = smoothstep((x + 0.04) / 0.10); wr_ = 1 - wl
    # os : Hips, UpperLeg_L, UpperLeg_R
    n = len(m.V)
    m.J = np.zeros((n, 4), np.int64); m.W = np.zeros((n, 4))
    m.J[:, 0] = B['Hips']; m.W[:, 0] = 1 - s_
    m.J[:, 1] = B['UpperLeg_L']; m.W[:, 1] = s_ * wl
    m.J[:, 2] = B['UpperLeg_R']; m.W[:, 2] = s_ * wr_
    return m

NP = 11
for layer, (off, dep, c0) in enumerate([(0.006, 0.0, 0.0), (0.020, 0.0, 0.5)]):
    for k in range(NP):
        a0 = (k + c0) / NP - 0.075; a1 = (k + c0) / NP + 0.075 + 0.04
        shape = lambda q, L=layer: (0.62 - 0.12 * L) + (0.34 - 0.06 * L) * tri(np.clip(q, 0, 1)) ** 0.9
        hi = (lambda a, a0=a0, a1=a1, shape=shape: shape((a - a0) / (a1 - a0)))
        m = shell(skirt, a0=a0, a1=a1, t_lo=0.0 if layer == 0 else 0.05, t_hi=hi, offset=off, thick=0.007, bevel=0.012, na=5, nt=7, dome=0.004, tile=0.25)
        add(f'faulde{layer}_{k}', skin_skirt(m), 'steel')

# ---- épaulières « plumes de corbeau » -------------------------------------------------------------
N_P = 14
pp = smoothpath([(0.205, 1.55, 0), (0.208, 1.50, 0), (0.214, 1.42, 0), (0.222, 1.33, 0)], N_P)
sho = Loft(pp, prof([(0, .02), (.12, .056), (.35, .072), (.7, .066), (1, .055)], N_P), prof([(0, .02), (.12, .056), (.35, .072), (.7, .068), (1, .055)], N_P), p=2.3, segs=32, tile=0.4)
for k, (lo, hi, off) in enumerate([(0.0, 0.40, 0.006), (0.16, 0.60, 0.016), (0.34, 0.80, 0.026), (0.52, 1.0, 0.036)]):
    nf = notch(7 + 2 * k, 0.05 + 0.02 * k)
    hfn = lambda a, hi=hi, nf=nf: hi * nf(a) + 0.07 * (0.5 + 0.5 * np.cos(2 * np.pi * (a - 0.25)))
    m = sh(sho, 'UpperArm_L', **wrap(0.75), t_lo=lo, t_hi=lambda a, hfn=hfn: np.clip(hfn(a), 0, 1), offset=off, thick=0.007, bevel=0.007, na=48, nt=7, dome=0.004, tile=0.3)
    add(f'epaule{k}', m, 'steel', both=True)
for k in range(1):
    cap = Loft(vpath(0.205, 1.562, 1.538, 0.0, 5), 0.034, 0.034, p=2.2, segs=14, cap0=2, cap1=1, tile=0.1)
    add('epaule_cap', rigid(cap.mesh(), 'UpperArm_L'), 'steel', both=True)
# bord argenté de la plaque supérieure
add('epaule_ornement', sh(sho, 'UpperArm_L', a0=0.12, a1=0.38, t_lo=0.14, t_hi=0.22, offset=0.026, thick=0.007, bevel=0.005, na=16, nt=5, tile=0.15), 'trim', both=True)
# trois plumes-lames dressées
def feather(base, tip, bend, width, bone, thick=0.0035, n=16, mat='steel'):
    base = S(base, float); tip = S(tip, float); bend = S(bend, float)
    ctrl = [base, (base + tip) / 2 + bend, tip]
    pth = smoothpath(ctrl, n)
    t = np.linspace(0, 1, n)
    w = width * (np.sin(np.pi * np.clip(t * 0.92 + 0.04, 0, 1)) ** 0.55) * (1 - 0.15 * t)
    f = Loft(pth, thick * (1 + 0.7 * np.sin(np.pi * t)), w, p=2.0, segs=8, cap0=1, cap1=2, tile=0.1, ref=(0, 0, 1))
    return rigid(f.mesh(), bone)
for i, (dx, dy, dz, wd) in enumerate([(0.06, 0.20, -0.02, 0.026), (0.12, 0.15, -0.04, 0.024), (0.16, 0.08, -0.05, 0.020)]):
    base = (0.215 + 0.03 * i, 1.53, -0.035)
    m = feather(base, (base[0] + dx, base[1] + dy, base[2] + dz), (0.02, 0.0, -0.01), wd, 'UpperArm_L')
    add(f'plume{i}', m, 'steel', both=True)

# ---- brassards, cubitières ---------------------------------------------------------------------
for k, (lo, hi, off, thick) in enumerate([(0.585, 0.70, 0.005, 0.008), (0.68, 0.82, 0.010, 0.008), (0.80, 0.94, 0.004, 0.009)]):
    add(f'brassard{k}', sh(arm, 'LowerArm_L', **wrap(0.75), t_lo=lo, t_hi=hi, offset=off, thick=thick, bevel=0.01, na=26, nt=6, tile=0.25), 'steel', both=True)
add('cubitiere', sh(arm, 'LowerArm_L', a0=0.36, a1=0.64, t_lo=0.40, t_hi=0.58, offset=0.012, thick=0.012, bevel=0.012, na=14, nt=10, dome=0.022, tile=0.2), 'steel', both=True)
sp_ = feather((0.262, 1.134, -0.055), (0.262, 1.12, -0.17), (0, 0.012, 0), 0.016, 'LowerArm_L', thick=0.010, n=10)
add('cubitiere_pointe', sp_, 'steel', both=True)
add('bracelet', sh(arm, 'LowerArm_L', **wrap(0.75), t_lo=0.92, t_hi=1.0, offset=0.006, thick=0.006, bevel=0.005, na=26, nt=3, tile=0.15), 'trim', both=True)
# gantelet : dessus de la main
gp = smoothpath([S([0.328, 0.872, 0.02]), S([0.336, 0.83, 0.032]), S([0.342, 0.795, 0.045])], 6)
gl = Loft(gp, prof([(0, .026), (1, .03)], 6), prof([(0, .036), (1, .042)], 6), p=3.0, segs=16, tile=.2)
add('gantelet', sh(gl, 'Hand_L', a0=-0.28, a1=0.28, t_lo=0.0, t_hi=1.0, offset=0.003, thick=0.007, bevel=0.007, na=14, nt=6, tile=0.12), 'steel', both=True)

# ---- jambières, genouillères, cuissards --------------------------------------------------------
add('cuissard', sh(leg, 'UpperLeg_L', a0=-0.30, a1=0.30, t_lo=0.06, t_hi=0.43, offset=0.010, thick=0.012, bevel=0.014, na=22, nt=14, dome=0.012, tile=0.3), 'steel', both=True)
add('cuissard_ext', sh(leg, 'UpperLeg_L', a0=0.18, a1=0.34, t_lo=0.1, t_hi=0.42, offset=0.014, thick=0.01, bevel=0.01, na=10, nt=10, tile=0.3), 'trim', both=True)
add('genouillere', sh(leg, 'UpperLeg_L', a0=-0.27, a1=0.27, t_lo=0.42, t_hi=0.60, offset=0.012, thick=0.014, bevel=0.014, na=20, nt=12, dome=0.032, tile=0.2), 'steel', both=True)
add('genouillere_pointe', feather((0.100, 0.52, 0.085), (0.100, 0.545, 0.185), (0, 0.014, 0), 0.018, 'UpperLeg_L', thick=0.011, n=10), 'steel', both=True)
add('jambiere', sh(leg, 'LowerLeg_L', a0=-0.32, a1=0.32, t_lo=0.60, t_hi=0.97, offset=0.008, thick=0.012, bevel=0.012, na=24, nt=16, dome=0.012, tile=0.3), 'steel', both=True)
add('mollet', sh(leg, 'LowerLeg_L', a0=0.36, a1=0.64, t_lo=0.60, t_hi=0.92, offset=0.012, thick=0.011, bevel=0.012, na=18, nt=14, dome=0.008, tile=0.3), 'steel', both=True)
add('botte_revers', sh(leg, 'LowerLeg_L', **wrap(0.5), t_lo=0.90, t_hi=1.0, offset=0.012, thick=0.008, bevel=0.007, na=30, nt=4, tile=0.15), 'trim', both=True)
add('botte_pointe', sh(boot, 'Foot_L', a0=-0.3, a1=0.3, t_lo=0.45, t_hi=0.99, offset=0.004, thick=0.008, bevel=0.01, na=16, nt=10, dome=0.004, tile=0.2), 'steel', both=True)

# ---- gorgerin : plumes autour du cou ---------------------------------------------------------------
N_C = 10
cp = smoothpath([(0, 1.615, 0.0), (0, 1.55, -0.005), (0, 1.47, -0.01)], N_C)
collar = Loft(cp, prof([(0, .058), (1, .125)], N_C), prof([(0, .058), (1, .15)], N_C), p=2.3, segs=40, tile=0.3)
for k, (lo, hi, off) in enumerate([(0.0, 0.45, 0.004), (0.2, 0.72, 0.012), (0.42, 1.0, 0.020)]):
    nf = notch(10 + 3 * k, 0.12)
    m = sh(collar, 'Chest', **wrap(0.5), t_lo=lo, t_hi=lambda a, hi=hi, nf=nf: np.clip(hi * nf(a), 0.05, 1), offset=off, thick=0.007, bevel=0.01, na=56, nt=6, tile=0.2)
    add(f'gorgerin{k}', m, 'steel')

# ---- casque : crâne, bec de corbeau, croissant de lune ---------------------------------------------
N_H = 14
hp_ = smoothpath([(0, 1.54, 0.005), (0, 1.60, 0.012), (0, 1.675, 0.016), (0, 1.75, 0.012), (0, 1.79, 0.006)], N_H)
skull = Loft(hp_, prof([(0, .066), (.16, .098), (.48, .118), (.76, .105), (.92, .066), (1, .022)], N_H), prof([(0, .064), (.16, .086), (.48, .099), (.76, .088), (.92, .056), (1, .02)], N_H), p=2.15, segs=30, cap1=2, tile=0.25)
m = skull.mesh(); rigid(m, 'Head'); add('crane', m, 'steel')
add('casque_arete', sh(skull, 'Head', a0=-0.03, a1=0.03, t_lo=0.2, t_hi=1.0, offset=0.004, thick=0.012, bevel=0.008, na=6, nt=20, tile=0.1), 'trim')
add('casque_front', sh(skull, 'Head', a0=-0.16, a1=0.16, t_lo=0.50, t_hi=0.58, offset=0.003, thick=0.007, bevel=0.006, na=16, nt=4, dome=0.004, tile=0.15), 'steel')
add('joue', sh(skull, 'Head', a0=0.12, a1=0.34, t_lo=0.06, t_hi=0.42, offset=0.003, thick=0.009, bevel=0.01, na=12, nt=10, dome=0.006, tile=0.15), 'steel', both=True)
# nuque en lames
for k, (lo, hi, off) in enumerate([(0.0, 0.30, 0.004), (0.0, 0.18, 0.012)]):
    add(f'nuque{k}', sh(skull, 'Head', a0=0.30, a1=0.70, t_lo=lo, t_hi=hi, offset=off, thick=0.007, bevel=0.008, na=24, nt=5, tile=0.15), 'steel')
# bec
bk = smoothpath([(0, 1.664, 0.078), (0, 1.656, 0.14), (0, 1.636, 0.215), (0, 1.598, 0.272)], 12)
beak = Loft(bk, prof([(0, .040), (.4, .028), (.8, .016), (1, .005)], 12), prof([(0, .036), (.4, .026), (.8, .014), (1, .004)], 12), p=2.2, segs=14, cap1=2, tile=0.15, ref=(0, 1, 0))
m = beak.mesh(); rigid(m, 'Head'); add('bec', m, 'steel')
add('bec_arete', sh(beak, 'Head', a0=-0.04, a1=0.04, t_lo=0.0, t_hi=0.95, offset=0.002, thick=0.006, bevel=0.004, na=6, nt=14, tile=0.1), 'trim')
# yeux : fentes lumineuses
def skull_z(x, y=1.66):
    return 0.016 + 0.118 * np.sqrt(max(1 - (x / 0.099) ** 2, 0.05))
for sx in (1, -1):
    xs = [0.022, 0.048, 0.074]
    ep = smoothpath([(sx * x, 1.664 - 0.004 * i, skull_z(x) + 0.006) for i, x in enumerate(xs)], 8)
    eye = Loft(ep, prof([(0, .0025), (.5, .0045), (1, .0015)], 8), prof([(0, .0016), (.5, .0055), (1, .0012)], 8), p=2.0, segs=8, cap0=1, cap1=1, tile=0.05, ref=(0, 0, 1))
    m = eye.mesh(); rigid(m, 'Head'); add('oeil_' + ('L' if sx > 0 else 'R'), m, 'glow')
# croissant de lune
cn = 24
th = np.linspace(np.deg2rad(150), np.deg2rad(390), cn)
cr = 0.095
cpth = np.stack([cr * np.cos(th), 1.86 + cr * np.sin(th), np.full(cn, -0.012)], 1)
tt = np.linspace(0, 1, cn)
cres = Loft(cpth, 0.0085, 0.001 + 0.032 * np.sin(np.pi * tt) ** 0.75, p=2.0, segs=10, cap0=1, cap1=1, tile=0.1, ref=(0, 0, 1))
m = cres.mesh(); rigid(m, 'Head'); add('croissant', m, 'trim')
# support du croissant
sup = Loft(vpath(0, 1.745, 1.775, -0.006, 4), 0.016, 0.02, p=2.5, segs=10, cap1=1, tile=0.1)
m = sup.mesh(); rigid(m, 'Head'); add('croissant_pied', m, 'steel')

# ---- cape : drap tatoué par l'usure ----------------------------------------------------------------
def make_cape():
    nu, nv = 24, 22
    u = np.linspace(-1, 1, nu); v = np.linspace(0, 1, nv)
    rng = np.random.default_rng(11)
    jag = 0.07 * np.abs(np.sin(u * 6.1 + 0.7)) + 0.05 * rng.random(nu) * (np.abs(u) > 0.2)
    bottom = 0.40 + jag
    top = 1.47
    V = []; UV = []
    for j, vv in enumerate(v):
        for i, uu in enumerate(u):
            y = top - vv * (top - bottom[i])
            hw = 0.16 + 0.17 * vv ** 0.9
            x = uu * hw
            z = -(0.125 + 0.052 * vv) - 0.018 * (uu ** 2) * (0.4 + vv)
            z += 0.022 * np.sin(uu * 5.3 * np.pi * 0.5 + vv * 1.3) * (0.15 + vv) + 0.008 * np.sin(uu * 11 + vv * 3)
            V.append((x, y, z)); UV.append((x * 1.6 + 0.5, y * 1.6))
    V = np.array(V); UV = np.array(UV)
    idx = np.arange(nu * nv).reshape(nv, nu)
    a = idx[:-1, :-1].ravel(); b = idx[:-1, 1:].ravel(); c = idx[1:, :-1].ravel(); d = idx[1:, 1:].ravel()
    F = np.concatenate([np.stack([a, b, c], 1), np.stack([b, d, c], 1)])
    outer = Mesh(V, F, UV)
    inner = Mesh(V + np.array([0, 0, 0.004]), F[:, ::-1].copy(), UV)
    return outer, inner
for mm in make_cape():
    m = skin_chain(mm, [P['Cape_1'], P['Cape_2'], P['Cape_3'], (0, 0.40, -0.21)], [B['Cape_1'], B['Cape_2'], B['Cape_3'], B['Cape_3']], blend=0.16)
    # le haut de la cape est solidaire du dos
    wc = smoothstep((m.V[:, 1] - 1.36) / 0.10)
    m.W = m.W * (1 - wc[:, None]); m.J[:, 3] = B['Chest']; m.W[:, 3] = wc
    add('cape', m, 'cloak')
