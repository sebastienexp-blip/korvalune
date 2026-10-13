"""Animations du Loup des Cendres : idle, walk, run, attack, hit, death (30 i/s)."""
import numpy as np
from glbkit import qeuler, qnorm
import wolf_geo as G

FPS = 30
def ease(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def lerp(a, b, t): return a + (b - a) * t
def seg(u, a, b): return ease((u - a) / (b - a))

class Pose(dict):
    def __init__(self):
        super().__init__(); self.pos = {'Hips': np.zeros(3), 'Root': np.zeros(3)}
    def r(self, bone, rx=0, ry=0, rz=0):
        v = self.setdefault(bone, np.zeros(3)); v += (rx, ry, rz)

def gait(ph, amp_f, amp_r, lift, spine, bob, head, tailw, diag=True):
    p = Pose(); w = 2 * np.pi * ph
    # paires diagonales : avant gauche + arrière droit ; (course = bond : paires avant/arrière)
    phases = {'FL': 0.0, 'RR': 0.0 if diag else 0.5, 'FR': np.pi if diag else 0.0, 'RL': np.pi if diag else 0.5}
    if not diag: phases = {'FL': 0.0, 'FR': 0.35, 'RL': np.pi, 'RR': np.pi + 0.35}
    for key, off in phases.items():
        sd = key[1]; s = np.sin(w + off); c = np.cos(w + off)
        if key[0] == 'F':
            f = amp_f * s
            p.r(f'FrontUpper_{sd}', -f, 0, 0)
            p.r(f'FrontFore_{sd}', lift * max(0.0, c + 0.2) + 0.1 + 0.3 * max(0, f) * 0, 0, 0)
            p.r(f'FrontPaw_{sd}', f * 0.6 - 0.25 * max(0.0, c), 0, 0)
        else:
            f = amp_r * s
            p.r(f'Thigh_{sd}', -f, 0, 0)
            p.r(f'Shin_{sd}', 0.55 * lift * max(0.0, c + 0.25) * -1 + 0.0, 0, 0)
            p.r(f'Hock_{sd}', 0.9 * lift * max(0.0, c + 0.25) + 0.2 * -f, 0, 0)
            p.r(f'RearPaw_{sd}', f * 0.5, 0, 0)
    p.pos['Hips'] += (0, bob * np.cos(2 * w) - bob, 0)
    p.r('Spine1', spine * np.sin(w + 0.4), 0, 0); p.r('Spine2', spine * 0.8 * np.sin(w + 0.4), 0, 0); p.r('Chest', -spine * 0.5 * np.sin(w + 0.4), 0, 0)
    p.r('Hips', -spine * 0.4 * np.sin(w + 0.4), 0.05 * np.sin(w), 0)
    p.r('Neck', head * np.sin(w + 1.0) , 0.06 * np.sin(w), 0); p.r('Head', -head * np.sin(w + 1.0) * 0.7, 0, 0)
    for k, nm in enumerate(('Tail1', 'Tail2', 'Tail3')):
        p.r(nm, 0.12 + 0.05 * np.sin(w * 2 - k), tailw * np.sin(w - 0.8 * k), 0)
    return p

def walk(u): return gait(u, 0.55, 0.50, 0.9, 0.04, 0.012, 0.05, 0.25)
def run(u): return gait(u, 0.95, 0.90, 1.5, 0.18, 0.03, 0.08, 0.2, diag=False)

def idle(u):
    p = Pose(); w = 2 * np.pi * u; br = np.sin(w)
    p.r('Chest', 0.012 * br, 0, 0); p.r('Spine2', 0.008 * br, 0, 0)
    p.r('Neck', 0.04 + 0.03 * np.sin(w + 0.7), 0.12 * np.sin(w * 1.0 + 1.0), 0); p.r('Head', -0.06 + 0.04 * np.sin(w + 1.3), 0.1 * np.sin(w + 0.5), 0.05 * np.sin(w))
    p.r('Jaw', 0.03 + 0.03 * max(0, np.sin(w * 2)), 0, 0)
    for k, nm in enumerate(('Tail1', 'Tail2', 'Tail3')):
        p.r(nm, 0.18 + 0.03 * np.sin(w - k), 0.22 * np.sin(w * 2 - 0.8 * k), 0)
    # appuis légers
    for sd in 'LR':
        p.r(f'FrontFore_{sd}', 0.05, 0, 0); p.r(f'Shin_{sd}', 0.02, 0, 0); p.r(f'Hock_{sd}', -0.02, 0, 0)
    p.pos['Hips'] += (0, -0.004 * (1 - br), 0)
    return p

def attack(u):
    """Accroupi → bond la gueule ouverte → claquement → retour."""
    p = Pose()
    crouch = seg(u, 0.0, 0.32); leap = seg(u, 0.32, 0.50); snap = seg(u, 0.52, 0.62); rec = seg(u, 0.66, 1.0)
    k = (1 - rec)
    c = crouch * (1 - leap)
    p.pos['Hips'] += (0, -0.07 * c, -0.03 * c + 0.0)
    p.r('Spine1', -0.12 * c + 0.18 * leap * k, 0, 0); p.r('Spine2', -0.1 * c + 0.14 * leap * k, 0, 0); p.r('Chest', 0.2 * c - 0.1 * leap * k, 0, 0)
    p.r('Neck', 0.25 * c - 0.35 * leap * k, 0, 0); p.r('Head', -0.1 * c + 0.1 * leap * k, 0, 0)
    jaw = 0.75 * leap * (1 - snap) * k
    p.r('Jaw', jaw, 0, 0)
    for sd in 'LR':
        p.r(f'FrontUpper_{sd}', 0.45 * c - 1.15 * leap * k, 0, 0); p.r(f'FrontFore_{sd}', 0.5 * c + 0.7 * leap * k, 0, 0); p.r(f'FrontPaw_{sd}', -0.2 * leap * k, 0, 0)
        p.r(f'Thigh_{sd}', 0.5 * c + 0.7 * leap * k, 0, 0); p.r(f'Shin_{sd}', -0.5 * c - 0.3 * leap * k, 0, 0); p.r(f'Hock_{sd}', 0.6 * c + 0.2 * leap * k, 0, 0)
    for j, nm in enumerate(('Tail1', 'Tail2', 'Tail3')):
        p.r(nm, 0.3 * c - 0.35 * leap * k, 0, 0)
    p.pos['Root'] += (0, 0.0, 0.0)
    return p

def hit(u):
    p = Pose(); k = np.sin(np.pi * np.clip(u, 0, 1)) ** 0.8
    p.r('Spine1', -0.2 * k, 0.12 * k, 0); p.r('Spine2', -0.15 * k, 0.1 * k, 0); p.r('Neck', -0.3 * k, 0.2 * k, 0); p.r('Head', 0.2 * k, 0, 0)
    p.r('Jaw', 0.4 * k, 0, 0)
    for sd in 'LR':
        p.r(f'FrontUpper_{sd}', 0.3 * k, 0, 0); p.r(f'Thigh_{sd}', -0.2 * k, 0, 0)
    p.pos['Hips'] += (0, 0, -0.06 * k)
    for nm in ('Tail1', 'Tail2', 'Tail3'): p.r(nm, 0.4 * k, 0, 0)
    return p

def death(u):
    p = Pose()
    stag = seg(u, 0.0, 0.30); fall = seg(u, 0.25, 0.65); settle = seg(u, 0.65, 1.0)
    p.r('Root', 0, 0, 1.52 * fall)                    # bascule sur le flanc gauche (roulis)
    p.pos['Root'] += (0.0, 0.10 * fall, 0)
    p.r('Spine1', -0.15 * stag, 0.15 * fall, 0); p.r('Neck', -0.3 * stag + 0.2 * fall, 0.3 * fall, 0); p.r('Head', 0.2 * stag, 0, 0)
    p.r('Jaw', 0.5 * fall, 0, 0)
    for sd, sg in (('L', 1), ('R', -1)):
        p.r(f'FrontUpper_{sd}', -0.7 * fall + 0.2 * stag, 0, 0.3 * fall * sg); p.r(f'FrontFore_{sd}', 0.4 * fall, 0, 0)
        p.r(f'Thigh_{sd}', -0.6 * fall + 0.1 * stag, 0, -0.2 * fall * sg); p.r(f'Shin_{sd}', 0.5 * fall, 0, 0)
    for nm in ('Tail1', 'Tail2', 'Tail3'): p.r(nm, -0.2 * fall, 0.4 * fall, 0)
    return p

CLIPS = {'idle': (idle, 2.4, True), 'walk': (walk, 0.80, True), 'run': (run, 0.52, True), 'attack': (attack, 0.90, False), 'hit': (hit, 0.35, False), 'death': (death, 1.2, False)}

def build():
    out = {}
    for name, (fn, dur, loop) in CLIPS.items():
        n = int(round(dur * FPS)) + 1
        frames = [fn((i % (n - 1)) / (n - 1) if loop else i / (n - 1)) for i in range(n)]
        bones = set()
        for f in frames: bones |= set(f.keys())
        ch = {}
        for b in bones:
            ch.setdefault(b, {})['rot'] = np.array([qnorm(qeuler(*f.get(b, np.zeros(3)))) for f in frames])
        for pb in ('Hips', 'Root'):
            arr = np.array([f.pos[pb] for f in frames])
            if np.abs(arr).max() > 1e-6: ch.setdefault(pb, {})['pos'] = arr
        for b, d in ch.items():
            if 'rot' not in d: d['rot'] = np.tile([0, 0, 0, 1.0], (n, 1))
        out[name] = {'fps': FPS, 'n': n, 'channels': ch}
    return out
