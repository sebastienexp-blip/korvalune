"""Animations du griffon : idle, walk, run (marche du quadrupède + ailes repliées), fly (battement), glide (plané)."""
import numpy as np
from glbkit import qeuler, qnorm
import wolf_anim as W

FPS = 30
Pose = W.Pose

def fold(p, k=1.0, flutter=0.0, w=0.0):
    """Ailes repliées le long des flancs (k=1) ou étalées (k=0)."""
    for sd, s in (('L', 1), ('R', -1)):
        p.r(f'WingU_{sd}', 0.0, s * 1.25 * k, s * -0.45 * k + s * flutter * np.sin(w))
        p.r(f'WingF_{sd}', 0.0, s * -2.3 * k, s * 0.25 * k)
        p.r(f'WingT_{sd}', 0.0, s * 2.35 * k, 0.0)
    return p

def tuck(p, k=1.0):
    for sd in 'LR':
        p.r(f'FrontUpper_{sd}', 0.5 * k, 0, 0); p.r(f'FrontFore_{sd}', 1.1 * k, 0, 0); p.r(f'FrontPaw_{sd}', -0.7 * k, 0, 0)
        p.r(f'Thigh_{sd}', 0.55 * k, 0, 0); p.r(f'Shin_{sd}', -0.3 * k, 0, 0); p.r(f'Hock_{sd}', 0.5 * k, 0, 0)
    return p

def base(fn):
    def f(u):
        p = fn(u); fold(p, 1.0, 0.03, 2 * np.pi * u)
        return p
    return f

def fly(u):
    p = Pose(); w = 2 * np.pi * u
    for sd, s in (('L', 1), ('R', -1)):
        p.r(f'WingU_{sd}', 0.0, 0.0, s * (0.60 * np.sin(w) + 0.05))
        p.r(f'WingF_{sd}', 0.0, s * 0.10, s * 0.55 * np.sin(w - 0.9))
        p.r(f'WingT_{sd}', 0.0, 0.0, s * 0.50 * np.sin(w - 1.8))
    tuck(p, 0.9)
    p.pos['Hips'] += (0, 0.07 * np.cos(w - 0.5), 0)
    p.r('Spine1', 0.05 * np.sin(w + 0.4), 0, 0); p.r('Chest', -0.04 * np.sin(w + 0.4), 0, 0)
    p.r('Neck', 0.08, 0, 0); p.r('Head', -0.06, 0, 0)
    for k, nm in enumerate(('Tail1', 'Tail2', 'Tail3')): p.r(nm, 0.12 + 0.1 * np.sin(w - 0.9 - 0.5 * k), 0.08 * np.sin(w), 0)
    return p

def glide(u):
    p = Pose(); w = 2 * np.pi * u
    for sd, s in (('L', 1), ('R', -1)):
        p.r(f'WingU_{sd}', 0.0, 0.0, s * (0.10 + 0.04 * np.sin(w)))
        p.r(f'WingF_{sd}', 0.0, s * 0.05, s * (0.04 * np.sin(w - 0.8)))
        p.r(f'WingT_{sd}', 0.0, 0.0, s * (0.05 * np.sin(w - 1.5) - 0.05))
    tuck(p, 1.0)
    p.pos['Hips'] += (0, 0.015 * np.sin(w), 0)
    p.r('Neck', 0.05, 0, 0)
    for k, nm in enumerate(('Tail1', 'Tail2', 'Tail3')): p.r(nm, 0.08, 0.1 * np.sin(w - 0.7 * k), 0)
    return p

CLIPS = {'idle': (base(W.idle), 2.4, True), 'walk': (base(W.walk), 0.9, True), 'run': (base(W.run), 0.58, True),
         'fly': (fly, 0.85, True), 'glide': (glide, 2.6, True)}

def build():
    out = {}
    for name, (fn, dur, loop) in CLIPS.items():
        n = int(round(dur * FPS)) + 1
        frames = [fn((i % (n - 1)) / (n - 1)) for i in range(n)]
        bones = set()
        for f in frames: bones |= set(f.keys())
        ch = {}
        for b in bones:
            ch.setdefault(b, {})['rot'] = np.array([qnorm(qeuler(*f.get(b, np.zeros(3)))) for f in frames])
        for pb in ('Hips', 'Root'):
            arr = np.array([f.pos[pb] for f in frames])
            if np.abs(arr).max() > 1e-6: ch.setdefault(pb, {})['pos'] = arr
        out[name] = {'fps': FPS, 'n': n, 'channels': ch}
    return out
