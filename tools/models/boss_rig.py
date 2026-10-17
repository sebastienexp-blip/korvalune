"""Moteur commun des boss mondiaux : squelette sur mesure, pièces rigides/skinnées, animations procédurales (idle, walk, run, attack, hit, death)."""
import numpy as np
from glbkit import *
from skel_geo import shaft, blob, tube, revolve, open_loft, dent, line, unit, P_

PI = np.pi
FPS = 30


def ease(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def seg(u, a, b): return ease((u - a) / (b - a))


class Rig:
    def __init__(s):
        s.SK = Skeleton(); s.B = {}; s.parts = []; s.pos = {}
    def bone(s, name, parent, pos):
        s.B[name] = s.SK.add(name, parent, pos); s.pos[name] = np.asarray(pos, float); return name
    def add(s, name, mesh, mat, bone):
        skin_rigid(mesh, s.B[bone]); s.parts.append((name, mesh, mat)); return mesh
    def add_sym(s, name, mesh, mat, bone):
        """mesh construit côté +X (os *_L) ; ajoute aussi la copie miroir sur l'os *_R."""
        s.add(name + '_L', mesh, mat, bone)
        sw = {s.B[bone]: s.B[bone[:-1] + 'R']} if bone.endswith('L') else {}
        m2 = mirror_x(mesh, sw) if sw else mirror_x(mesh, {})
        s.parts.append((name + '_R', m2, mat))
    def tris(s): return sum(len(m.F) for _, m, _ in s.parts)


class Pose:
    def __init__(s): s.e = {}; s.p = {}
    def r(s, bone, rx=0, ry=0, rz=0):
        v = s.e.setdefault(bone, np.zeros(3)); v += (rx, ry, rz)
    def mv(s, bone, x=0, y=0, z=0):
        v = s.p.setdefault(bone, np.zeros(3)); v += (x, y, z)


def sample(fn, n, loop=True):
    ch = {}
    poses = [fn(i / n if loop else i / (n - 1)) for i in range(n)]
    bones = set()
    for p in poses: bones |= set(p.e) | set(p.p)
    for b in bones:
        rot = np.array([qeuler(*poses[i].e.get(b, (0, 0, 0))) for i in range(n)])
        pos = np.array([poses[i].p.get(b, np.zeros(3)) for i in range(n)]) if any(b in p.p for p in poses) else None
        ch[b] = {'rot': rot, 'pos': pos}
    return {'fps': FPS, 'n': n, 'channels': ch}


def build_clips(c):
    """c : dict de fonctions idle, walk, run, attack, hit, death -> Pose(u)"""
    return {'idle': sample(c['idle'], 72), 'walk': sample(c['walk'], 36), 'run': sample(c['run'], 24),
            'attack': sample(c['attack'], 42, False), 'hit': sample(c['hit'], 14, False), 'death': sample(c['death'], 72, False)}


# ------------------------------------------------------------------ allures génériques
def chain_sway(p, names, w, amp, lag=0.6, axis='y', base=0.0, ax2=None, amp2=0.0):
    for k, nm in enumerate(names):
        a = amp * np.sin(w - lag * k)
        if axis == 'y': p.r(nm, base, a, 0)
        elif axis == 'x': p.r(nm, a + base, 0, 0)
        else: p.r(nm, base, 0, a)
        if ax2 is not None: p.r(nm, 0, 0, amp2 * np.sin(w * 1.0 - lag * k + 1.2))


def biped_gait(p, u, arm=0.5, leg=0.55, bob=0.05, twist=0.12, lean=0.0, lift=0.9, arms_n=('Arm_L', 'Arm_R'), fore=('Fore_L', 'Fore_R')):
    w = 2 * PI * u
    for sd, ph in (('L', 0.0), ('R', PI)):
        s = np.sin(w + ph); c = np.cos(w + ph)
        p.r(f'Thigh_{sd}', -leg * s, 0, 0)
        p.r(f'Shin_{sd}', lift * max(0.0, c + 0.1) * 0.9 + 0.05, 0, 0)
        p.r(f'Foot_{sd}', leg * s * 0.4 - 0.3 * max(0, c), 0, 0)
        p.r(f'Arm_{sd}', arm * s, 0, 0)
        p.r(f'Fore_{sd}', -0.25 - 0.15 * max(0, -s), 0, 0)
    p.mv('Hips', 0, bob * (np.cos(2 * w) - 1), 0)
    p.r('Hips', 0, twist * np.sin(w) * 0.5, 0.03 * np.sin(w))
    p.r('Spine', lean, -twist * np.sin(w) * 0.5, 0); p.r('Chest', 0, -twist * np.sin(w) * 0.5, 0)
    p.r('Head', -lean * 0.8, twist * np.sin(w) * 0.5, 0)


def quad_gait(p, u, f=0.5, r=0.5, lift=0.9, bob=0.03, spine=0.05, diag=True):
    w = 2 * PI * u
    ph = {'FL': 0, 'RR': 0, 'FR': PI, 'RL': PI} if diag else {'FL': 0, 'FR': .3, 'RL': PI, 'RR': PI + .3}
    for k, off in ph.items():
        sd = k[1]; s = np.sin(w + off); c = np.cos(w + off)
        if k[0] == 'F':
            p.r(f'FUpper_{sd}', -f * s, 0, 0); p.r(f'FLower_{sd}', lift * max(0, c + .15) + .08, 0, 0); p.r(f'FPaw_{sd}', f * s * .5 - .3 * max(0, c), 0, 0)
        else:
            p.r(f'RUpper_{sd}', -r * s, 0, 0); p.r(f'RLower_{sd}', lift * max(0, c + .2) * .8 + .05, 0, 0); p.r(f'RPaw_{sd}', r * s * .5 - .25 * max(0, c), 0, 0)
    p.mv('Hips', 0, bob * (np.cos(2 * w) - 1), 0)
    p.r('Spine', spine * np.sin(w + .4), 0, 0); p.r('Chest', -spine * .5 * np.sin(w + .4), 0, 0)
    p.r('Neck', .06 * np.sin(w + 1), .05 * np.sin(w), 0)


def death_fall(p, u, bones_fall, drop=0.0, rootrz=0.0, rootrx=0.0, t0=0.15):
    k = seg(u, t0, 1.0)
    p.r('Root', rootrx * k, 0, rootrz * k)
    p.mv('Root', 0, -drop * k, 0)
    for b, (rx, ry, rz) in bones_fall.items(): p.r(b, rx * k, ry * k, rz * k)


# ------------------------------------------------------------------ squelettes types
def biped_bones(R, hip, spine, chest, neck, head, sh, el, hand, th, kn, an, shx=None):
    """Positions : hip,spine,chest,neck,head = (y[,z]) ; sh=(x,y,z) ; el,hand=(x,y,z) ; th=(x,y,z) ; kn,an=(x,y,z). Côté L = +X."""
    def yz(v): return (0, v[0], v[1]) if hasattr(v, '__len__') else (0, v, 0)
    R.bone('Root', None, (0, 0, 0)); R.bone('Hips', 'Root', yz(hip)); R.bone('Spine', 'Hips', yz(spine)); R.bone('Chest', 'Spine', yz(chest))
    R.bone('Neck', 'Chest', yz(neck)); R.bone('Head', 'Neck', yz(head))
    for s, sd in ((1, 'L'), (-1, 'R')):
        R.bone(f'Arm_{sd}', 'Chest', (s * sh[0], sh[1], sh[2])); R.bone(f'Fore_{sd}', f'Arm_{sd}', (s * el[0], el[1], el[2])); R.bone(f'Hand_{sd}', f'Fore_{sd}', (s * hand[0], hand[1], hand[2]))
        R.bone(f'Thigh_{sd}', 'Hips', (s * th[0], th[1], th[2])); R.bone(f'Shin_{sd}', f'Thigh_{sd}', (s * kn[0], kn[1], kn[2])); R.bone(f'Foot_{sd}', f'Shin_{sd}', (s * an[0], an[1], an[2]))


def quad_bones(R, hip, spine, chest, neck, head, front, rear, tail=None, jaw=None, trunk=None):
    """hip,spine,chest,neck,head = (x=0,y,z) tuples ; front/rear = dict(sd->...) via (x, shoulder(y,z), elbow(y,z), paw(y,z), toe(y,z))."""
    R.bone('Root', None, (0, 0, 0)); R.bone('Hips', 'Root', hip); R.bone('Spine', 'Hips', spine); R.bone('Chest', 'Spine', chest)
    R.bone('Neck', 'Chest', neck); R.bone('Head', 'Neck', head)
    if jaw is not None: R.bone('Jaw', 'Head', jaw)
    for s, sd in ((1, 'L'), (-1, 'R')):
        x, a, b, c = front
        R.bone(f'FUpper_{sd}', 'Chest', (s * x, a[0], a[1])); R.bone(f'FLower_{sd}', f'FUpper_{sd}', (s * x, b[0], b[1])); R.bone(f'FPaw_{sd}', f'FLower_{sd}', (s * x, c[0], c[1]))
        x, a, b, c = rear
        R.bone(f'RUpper_{sd}', 'Hips', (s * x, a[0], a[1])); R.bone(f'RLower_{sd}', f'RUpper_{sd}', (s * x, b[0], b[1])); R.bone(f'RPaw_{sd}', f'RLower_{sd}', (s * x, c[0], c[1]))
    if tail:
        prev = 'Hips'
        for i, p_ in enumerate(tail):
            R.bone(f'Tail{i + 1}', prev, p_); prev = f'Tail{i + 1}'
    if trunk:
        prev = 'Head'
        for i, p_ in enumerate(trunk):
            R.bone(f'Trunk{i + 1}', prev, p_); prev = f'Trunk{i + 1}'


def sway_all(p, w, extras, k=1.0):
    for e in extras:
        names, axis, amp, lag = e[:4]; sp = e[4] if len(e) > 4 else 1.0; sg = e[5] if len(e) > 5 else 1.0; base = e[6] if len(e) > 6 else 0.0
        for i, nm in enumerate(names):
            a = amp * k * np.sin(w * sp - lag * i) * sg
            if axis == 'x': p.r(nm, a + base, 0, 0)
            elif axis == 'y': p.r(nm, base, a, 0)
            else: p.r(nm, base, 0, a)


def biped_poses(atk='slam', extras=(), arm=.4, leg=.5, bob=.08, lean=.04, speed_extra=1.0, rear_collapse=False, fall_dir=1.0, drop=1.9, stomp=0.0):
    ex = list(extras)

    def idle(u):
        p = Pose(); w = 2 * PI * u
        p.r('Spine', .02 * np.sin(w), .05 * np.sin(w * .5), 0); p.r('Chest', .015 * np.sin(w + .5), -.04 * np.sin(w * .5), .02 * np.sin(w))
        p.r('Head', .05 * np.sin(w + 1), .12 * np.sin(w * .5 + .6), .04 * np.sin(w * .5))
        p.r('Arm_L', .08 * np.sin(w + .4), 0, -.05); p.r('Arm_R', .05 * np.sin(w + 1.1), 0, .05); p.r('Fore_L', -.12 - .05 * np.sin(w), 0, 0); p.r('Fore_R', -.12 - .04 * np.sin(w + 1), 0, 0)
        p.mv('Hips', 0, .04 * np.sin(w), 0)
        sway_all(p, w, ex, .6)
        return p

    def walk(u):
        p = Pose(); biped_gait(p, u, arm=arm, leg=leg, bob=bob, twist=.15, lean=lean, lift=1.0); w = 2 * PI * u
        sway_all(p, w * 2 if False else w, ex, 1.0)
        if stomp: p.mv('Root', 0, stomp * abs(np.sin(w)) * 0, 0)
        return p

    def run(u):
        p = Pose(); biped_gait(p, u, arm=arm * 1.5, leg=leg * 1.5, bob=bob * 2, twist=.22, lean=lean + .12, lift=1.3); w = 2 * PI * u
        sway_all(p, w * 2, ex, 1.6)
        return p

    def attack(u):
        p = Pose(); wind = seg(u, 0, .4); hit_ = seg(u, .42, .56); rec = seg(u, .68, 1.0)
        a = wind * (1 - hit_); b = hit_ * (1 - rec)
        if atk == 'slam':
            p.r('Arm_L', -2.5 * a + .6 * b, 0, -.3 * a); p.r('Arm_R', -2.5 * a + .6 * b, 0, .3 * a)
            p.r('Fore_L', -.6 * a, 0, 0); p.r('Fore_R', -.6 * a, 0, 0)
            p.r('Spine', -.35 * a + .55 * b, 0, 0); p.r('Chest', -.2 * a + .3 * b, 0, 0); p.r('Head', .3 * a - .3 * b, 0, 0)
            p.mv('Hips', 0, -.15 * a - .15 * b, .25 * b)
            p.r('Thigh_L', -.2 * b, 0, 0); p.r('Thigh_R', -.2 * b, 0, 0)
        elif atk == 'sweep':
            p.r('Spine', -.1 * a + .25 * b, 0, 0); p.r('Chest', 0, .9 * a - 1.1 * b, 0); p.r('Hips', 0, .25 * a - .3 * b, 0)
            p.r('Arm_R', -1.2 * a - .6 * b, 0, .5 * a); p.r('Fore_R', -.5 * a, 0, 0); p.r('Arm_L', -.6 * a + .2 * b, 0, -.3 * a)
            p.r('Head', 0, -.3 * b, 0); p.mv('Hips', 0, -.18 * a, .1 * b)
        elif atk == 'cast':
            p.r('Arm_L', -1.6 * a - 1.2 * b, 0, -1.0 * a + .5 * b); p.r('Arm_R', -1.6 * a - 1.2 * b, 0, 1.0 * a - .5 * b)
            p.r('Fore_L', -.4 * a, 0, 0); p.r('Fore_R', -.4 * a, 0, 0)
            p.r('Spine', -.25 * a + .2 * b, 0, 0); p.r('Chest', -.2 * a + .15 * b, 0, 0); p.r('Head', -.45 * a + .3 * b, 0, 0)
            p.mv('Hips', 0, .1 * a, 0)
        elif atk == 'punch':
            p.r('Arm_R', .9 * a - 1.5 * b, 0, .3 * a); p.r('Fore_R', -1.0 * a - .1 * b, 0, 0); p.r('Chest', 0, -.5 * a + .6 * b, 0); p.r('Spine', -.1 * a + .15 * b, 0, 0)
            p.r('Arm_L', -.6 * a, 0, -.3 * a); p.mv('Hips', 0, -.12 * a, .3 * b); p.r('Hips', 0, -.2 * a + .25 * b, 0)
        sway_all(p, 2 * PI * u * 2, ex, 1.0 + 1.5 * b)
        return p

    def hit(u):
        p = Pose(); k = np.sin(PI * np.clip(u, 0, 1))
        p.r('Spine', -.18 * k, 0, 0); p.r('Chest', -.1 * k, .1 * k, 0); p.r('Head', .2 * k, 0, 0); p.r('Arm_L', .25 * k, 0, 0); p.r('Arm_R', .25 * k, 0, 0)
        return p

    def death(u):
        p = Pose(); k = seg(u, .1, 1.0)
        f = fall_dir
        p.r('Spine', .5 * k * f, 0, 0); p.r('Chest', .45 * k * f, 0, 0); p.r('Head', .6 * k * f, 0, 0); p.r('Neck', .3 * k * f, 0, 0)
        p.r('Thigh_L', -.5 * k, 0, 0); p.r('Thigh_R', -.8 * k, 0, 0); p.r('Shin_L', 1.2 * k, 0, 0); p.r('Shin_R', 1.6 * k, 0, 0)
        p.r('Arm_L', -.4 * k, 0, -.8 * k); p.r('Arm_R', -.3 * k, 0, .9 * k)
        p.r('Root', 1.0 * k * f, 0, .15 * k); p.mv('Root', 0, -drop * k, 1.2 * k * f)
        sway_all(p, 0, ex, -1.0 * k)
        return p
    return dict(idle=idle, walk=walk, run=run, attack=attack, hit=hit, death=death)


def quad_poses(atk='rear', extras=(), f=.5, r=.5, bob=.04, drop=1.2):
    ex = list(extras)

    def idle(u):
        p = Pose(); w = 2 * PI * u
        p.r('Chest', .015 * np.sin(w), 0, 0); p.r('Spine', .01 * np.sin(w), 0, 0)
        p.r('Neck', .04 * np.sin(w + .7), .1 * np.sin(w * .5 + 1), 0); p.r('Head', -.03 + .04 * np.sin(w + 1.3), .08 * np.sin(w * .5 + .5), 0)
        p.mv('Hips', 0, .02 * np.sin(w), 0)
        if 'Jaw' in [n for e in ex for n in e[0]]: pass
        sway_all(p, w, ex, .7)
        return p

    def walk(u):
        p = Pose(); quad_gait(p, u, f=f, r=r, lift=.9, bob=bob, spine=.05); sway_all(p, 2 * PI * u, ex, 1.0); return p

    def run(u):
        p = Pose(); quad_gait(p, u, f=f * 1.6, r=r * 1.6, lift=1.4, bob=bob * 2, spine=.16, diag=False); sway_all(p, 2 * PI * u * 2, ex, 1.5); return p

    def attack(u):
        p = Pose(); wind = seg(u, 0, .4); hit_ = seg(u, .42, .56); rec = seg(u, .7, 1.0)
        a = wind * (1 - hit_); b = hit_ * (1 - rec)
        if atk == 'rear':      # se cabre puis écrase des pattes avant
            p.r('Chest', -.5 * a + .35 * b, 0, 0); p.r('Spine', -.25 * a + .15 * b, 0, 0); p.r('Neck', .3 * a - .4 * b, 0, 0)
            for sd in 'LR':
                p.r(f'FUpper_{sd}', -1.6 * a + .5 * b, 0, 0); p.r(f'FLower_{sd}', -.6 * a, 0, 0)
                p.r(f'RUpper_{sd}', .1 * a, 0, 0)
            p.mv('Hips', 0, -.1 * a, -.15 * a + .2 * b)
        elif atk == 'bite':    # se tasse puis bondit la gueule en avant
            p.r('Chest', .25 * a - .15 * b, 0, 0); p.r('Spine', .1 * a, 0, 0); p.r('Neck', .5 * a - .7 * b, 0, 0); p.r('Head', -.3 * a + .3 * b, 0, 0)
            if 'Jaw' in R_NAMES(ex): p.r('Jaw', .9 * b, 0, 0)
            for sd in 'LR':
                p.r(f'FUpper_{sd}', .5 * a - .5 * b, 0, 0); p.r(f'RUpper_{sd}', .4 * a - .2 * b, 0, 0); p.r(f'RLower_{sd}', -.2 * a, 0, 0)
            p.mv('Hips', 0, -.1 * a, -.1 * a + .5 * b)
        elif atk == 'sting':   # queue qui fouette vers l'avant
            p.r('Chest', .15 * a - .1 * b, 0, 0)
            for tn in [n for n in R_NAMES(ex) if n.startswith('Tail')]: p.r(tn, -.35 * a + .55 * b, 0, 0)
            p.r('Neck', -.2 * a + .2 * b, 0, 0)
            for sd in 'LR': p.r(f'FUpper_{sd}', .3 * a, 0, 0)
            p.mv('Hips', 0, -.05 * a, 0)
        elif atk == 'gore':    # charge, tête baissée
            p.r('Neck', .8 * a - 1.0 * b, 0, 0); p.r('Head', .3 * a - .2 * b, 0, 0); p.r('Chest', .2 * a - .1 * b, 0, 0)
            for sd in 'LR': p.r(f'FUpper_{sd}', .6 * a - .7 * b, 0, 0); p.r(f'RUpper_{sd}', .5 * a - .3 * b, 0, 0)
            for i in range(1, 6): p.r(f'Trunk{i}', .3 * a - .8 * b, 0, 0) if False else None
            p.mv('Hips', 0, -.12 * a, -.2 * a + .6 * b)
        sway_all(p, 2 * PI * u * 2, ex, 1.0 + 1.5 * b)
        return p

    def hit(u):
        p = Pose(); k = np.sin(PI * np.clip(u, 0, 1))
        p.r('Chest', -.15 * k, .1 * k, 0); p.r('Neck', -.3 * k, .2 * k, 0); p.r('Head', .2 * k, 0, 0)
        return p

    def death(u):
        p = Pose(); k = seg(u, .1, 1.0)
        p.r('Root', 0, 0, 1.45 * k); p.mv('Root', 0, -drop * k, 0)
        p.r('Neck', .3 * k, .0, .2 * k); p.r('Head', .25 * k, 0, 0)
        for sd in 'LR':
            p.r(f'FUpper_{sd}', -.5 * k, 0, 0); p.r(f'RUpper_{sd}', .4 * k, 0, 0); p.r(f'FLower_{sd}', .8 * k, 0, 0); p.r(f'RLower_{sd}', .8 * k, 0, 0)
        sway_all(p, 0, ex, -.8 * k)
        return p
    return dict(idle=idle, walk=walk, run=run, attack=attack, hit=hit, death=death)


def R_NAMES(ex): return [n for e in ex for n in e[0]]


def add_mirror(R, name, mesh, mat, bone):
    R.add(name, mesh, mat, bone)
    R.parts.append((name + '_m', mirror_x(mesh, {}), mat))
