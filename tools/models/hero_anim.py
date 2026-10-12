"""Animations du Veilleur (cinématique directe, échantillonnées à 30 i/s) : idle, walk, run, attack, attack2, hit, death, jump."""
import numpy as np
from glbkit import qeuler, qmul, qnorm
import hero_geo as G

FPS = 30
def ease(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def lerp(a, b, t): return a + (b - a) * t
def seg(u, a, b): return ease((u - a) / (b - a))   # 0→1 entre a et b

class Pose(dict):
    """os → [rx, ry, rz] ; pos : 'Hips' / 'Root' → décalage (x,y,z)."""
    def __init__(self):
        super().__init__(); self.pos = {'Hips': np.zeros(3), 'Root': np.zeros(3)}
    def r(self, bone, rx=0, ry=0, rz=0):
        v = self.setdefault(bone, np.zeros(3)); v += (rx, ry, rz)
    def both(self, base, rx=0, ry=0, rz=0, rxR=None, ryR=None, rzR=None):
        self.r(base + '_L', rx, ry, rz)
        self.r(base + '_R', rx if rxR is None else rxR, -ry if ryR is None else ryR, -rz if rzR is None else rzR)

def locomotion(ph, amp, knee, arm, bob, lean, cape_k):
    """ph : phase [0,1) ; jambe gauche en avance à ph=0.25."""
    p = Pose(); w = 2 * np.pi * ph
    for side, off in (('L', 0.0), ('R', np.pi)):
        s = np.sin(w + off); c = np.cos(w + off)
        f = amp * s                                  # avant positif
        kb = knee * max(0.0, c * 0.9 + 0.25) ** 1.2 + 0.06
        p.r(f'UpperLeg_{side}', -f, 0, 0)
        p.r(f'LowerLeg_{side}', kb, 0, 0)
        p.r(f'Foot_{side}', f - kb + 0.12 * (1 - s) * 0.5 * (c < 0) , 0, 0)
        p.r(f'Toe_{side}', 0.25 * max(0.0, -s) * (c < 0), 0, 0)
        # bras opposé à la jambe du même côté
        a_f = -arm * s
        p.r(f'UpperArm_{side}', -a_f * 1.0, 0, 0)
        p.r(f'LowerArm_{side}', -(0.35 + 0.35 * max(0.0, -s * -1) * 0 + 0.25 * max(0.0, -s)) - 0.2 * lean, 0, 0)
    sgn = {'L': 1, 'R': -1}
    p.r('UpperArm_L', 0, 0, 0.05); p.r('UpperArm_R', 0, 0, -0.05)
    p.pos['Hips'] += (0.012 * np.sin(w), bob * np.cos(2 * w) - bob, 0)
    p.r('Hips', 0, 0.07 * amp / 0.6 * np.sin(w), 0.03 * np.sin(w))
    p.r('Spine', lean * 0.5, -0.10 * amp / 0.6 * np.sin(w), -0.02 * np.sin(w))
    p.r('Chest', lean * 0.5, -0.06 * amp / 0.6 * np.sin(w), 0)
    p.r('Head', -lean * 0.8, 0.05 * amp / 0.6 * np.sin(w), 0)
    # cape : traîne vers l'arrière, ondule
    for k, nm in enumerate(('Cape_1', 'Cape_2', 'Cape_3')):
        p.r(nm, cape_k * (0.5 + 0.5 * k) + 0.06 * np.sin(w * 2 - 0.9 * k), 0.04 * np.sin(w - 1.2 * k), 0.05 * np.sin(w + 0.7 * k))
    return p

def walk(u): return locomotion(u, 0.58, 0.95, 0.5, 0.022, 0.06, 0.10)
def run(u): return locomotion(u, 0.82, 1.45, 0.85, 0.040, 0.28, 0.42)

def idle(u):
    p = Pose(); w = 2 * np.pi * u
    br = np.sin(w)
    p.r('Chest', 0.018 * br, 0.03 * np.sin(w + 1), 0); p.r('Spine', 0.01 * br, 0, 0)
    p.r('Head', -0.015 * br + 0.02, 0.10 * np.sin(w + 0.5), 0.015 * np.sin(w))
    p.r('Shoulder_L', 0, 0, 0.02 * br); p.r('Shoulder_R', 0, 0, -0.02 * br)
    p.r('UpperArm_L', 0.02 * np.sin(w + 0.4), 0, 0.06); p.r('UpperArm_R', 0.02 * np.sin(w + 0.4), 0, -0.06)
    p.r('LowerArm_L', -0.18 - 0.03 * br, 0, 0); p.r('LowerArm_R', -0.25 - 0.03 * br, 0, 0)
    p.r('UpperLeg_L', -0.03, 0, 0); p.r('UpperLeg_R', 0.03, 0, 0); p.r('LowerLeg_L', 0.05, 0, 0); p.r('LowerLeg_R', 0.04, 0, 0)
    p.pos['Hips'] += (0.012 * np.sin(w), -0.006 * (1 - br) , 0)
    p.r('Hips', 0, 0, 0.012 * np.sin(w))
    for k, nm in enumerate(('Cape_1', 'Cape_2', 'Cape_3')):
        p.r(nm, 0.03 + 0.03 * np.sin(w - 0.8 * k - 0.4), 0.02 * np.sin(w * 1 - k), 0.02 * np.sin(w + k))
    return p

def attack(u):
    """Taille descendante à une main (épée) : armement → frappe → retour. Bras droit = os _R."""
    p = Pose()
    wind = seg(u, 0.0, 0.32); strike = seg(u, 0.32, 0.50); rec = seg(u, 0.58, 1.0)
    a = wind * (1 - strike) + 0 * rec
    # bras droit : lève l'arme derrière l'épaule puis la ramène devant
    up = lerp(lerp(0.0, -2.35, wind), -0.35, strike); up = lerp(up, 0.0, rec)
    p.r('UpperArm_R', up, 0, 0)
    p.r('UpperArm_R', 0, 0, lerp(lerp(0, -0.55, wind), 0.12, strike) * (1 - rec))
    el = lerp(lerp(0.0, -1.5, wind), -0.25, strike); el = lerp(el, 0, rec)
    p.r('LowerArm_R', el - 0.2, 0, 0)
    p.r('Hand_R', lerp(lerp(0, 0.4, wind), -0.3, strike) * (1 - rec), 0, 0)
    # buste : se tord vers la droite à l'armement, vers la gauche à la frappe
    tw = lerp(lerp(0.0, -0.45, wind), 0.55, strike); tw = lerp(tw, 0, rec)
    lean = lerp(lerp(0.0, -0.18, wind), 0.32, strike); lean = lerp(lean, 0, rec)
    p.r('Spine', lean * 0.5, tw * 0.5, 0); p.r('Chest', lean * 0.6, tw * 0.6, 0)
    p.r('Hips', 0, tw * -0.35, 0)
    p.r('Head', -lean * 0.5, -tw * 0.5, 0)
    # bras gauche : équilibre
    p.r('UpperArm_L', lerp(0, -0.5, wind) * (1 - strike) + 0.25 * strike * (1 - rec), 0, lerp(0, 0.5, wind) * (1 - rec))
    p.r('LowerArm_L', -0.5, 0, 0)
    # fente avant
    step = strike * (1 - rec)
    p.r('UpperLeg_L', -0.55 * step, 0, 0); p.r('LowerLeg_L', 0.5 * step, 0, 0); p.r('Foot_L', 0.1 * step, 0, 0)
    p.r('UpperLeg_R', 0.35 * step, 0, 0); p.r('LowerLeg_R', 0.35 * step, 0, 0); p.r('Foot_R', -0.3 * step, 0, 0)
    p.pos['Hips'] += (0, -0.09 * step, 0.12 * step - 0.04 * wind * (1 - strike))
    for k, nm in enumerate(('Cape_1', 'Cape_2', 'Cape_3')):
        p.r(nm, 0.2 * (strike * (1 - rec)) * (1 + k * 0.5) - 0.05 * wind, 0.08 * tw, 0)
    return p

def attack2(u):
    """Coup de taille horizontal en revers, plus ample."""
    p = Pose()
    wind = seg(u, 0.0, 0.28); strike = seg(u, 0.28, 0.5); rec = seg(u, 0.6, 1.0)
    f = (1 - rec)
    p.r('UpperArm_R', lerp(lerp(0, -1.2, wind), -1.45, strike) * f, 0, 0)
    p.r('UpperArm_R', 0, lerp(lerp(0, 0.7, wind), -1.3, strike) * f, lerp(lerp(0, -1.1, wind), -0.2, strike) * f)
    p.r('LowerArm_R', lerp(lerp(-0.2, -0.7, wind), -0.15, strike) * f - 0.2 * rec, 0, 0)
    tw = lerp(lerp(0, -0.75, wind), 0.85, strike) * f
    p.r('Spine', 0.05, tw * 0.5, 0); p.r('Chest', 0.05, tw * 0.55, 0); p.r('Hips', 0, tw * -0.3, 0); p.r('Head', 0, -tw * 0.5, 0)
    p.r('UpperArm_L', lerp(0, -0.6, wind) * f, 0, lerp(0, 0.9, strike) * f)
    p.r('LowerArm_L', -0.6 * f, 0, 0)
    step = strike * f
    p.r('UpperLeg_L', -0.4 * step, 0, 0); p.r('LowerLeg_L', 0.4 * step, 0, 0)
    p.r('UpperLeg_R', 0.3 * step, 0, 0); p.r('LowerLeg_R', 0.3 * step, 0, 0)
    p.pos['Hips'] += (0, -0.08 * step, 0.06 * step)
    for k, nm in enumerate(('Cape_1', 'Cape_2', 'Cape_3')):
        p.r(nm, 0.25 * step * (1 + 0.5 * k), 0.25 * tw, 0)
    return p

def hit(u):
    p = Pose(); k = np.sin(np.pi * np.clip(u, 0, 1)) ** 0.8
    p.r('Spine', -0.22 * k, 0.1 * k, 0); p.r('Chest', -0.15 * k, 0, 0); p.r('Head', 0.25 * k, -0.15 * k, 0)
    p.r('UpperArm_L', 0.3 * k, 0, 0.3 * k); p.r('UpperArm_R', 0.3 * k, 0, -0.3 * k)
    p.r('UpperLeg_L', -0.1 * k, 0, 0); p.r('LowerLeg_L', 0.2 * k, 0, 0); p.r('UpperLeg_R', 0.1 * k, 0, 0); p.r('LowerLeg_R', 0.2 * k, 0, 0)
    p.pos['Hips'] += (0, -0.05 * k, -0.07 * k)
    for k2, nm in enumerate(('Cape_1', 'Cape_2', 'Cape_3')): p.r(nm, -0.3 * k * (1 + k2 * .3), 0, 0)
    return p

def death(u):
    p = Pose()
    stag = seg(u, 0.0, 0.30); kneel = seg(u, 0.20, 0.50); fall = seg(u, 0.42, 0.78); settle = seg(u, 0.78, 1.0)
    # le corps bascule en arrière autour du sol (os Root)
    p.r('Root', -np.pi / 2 * fall * 0.97, 0, 0)
    p.pos["Root"] += (0, 0.17 * fall, 0.0)
    # flexion des genoux, buste en arrière
    p.r('UpperLeg_L', -0.9 * kneel * (1 - fall) - 0.15 * fall, 0, 0); p.r('UpperLeg_R', -0.6 * kneel * (1 - fall) - 0.05 * fall, 0, 0.0)
    p.r('LowerLeg_L', 1.5 * kneel * (1 - fall) + 0.1 * fall, 0, 0); p.r('LowerLeg_R', 1.2 * kneel * (1 - fall) + 0.2 * fall, 0, 0)
    p.pos['Hips'] += (0, -0.28 * kneel * (1 - fall), -0.05 * stag)
    p.r('Spine', -0.3 * stag * (1 - fall), 0, 0); p.r('Chest', -0.2 * stag, 0, 0); p.r('Head', 0.3 * stag - 0.2 * fall, 0.25 * fall, 0)
    p.r('UpperArm_L', 0.3 * stag - 0.4 * fall, 0, 0.35 * stag + 0.6 * fall); p.r('UpperArm_R', 0.4 * stag - 0.2 * fall, 0, -0.35 * stag - 0.8 * fall)
    p.r('LowerArm_L', -0.5 * stag, 0, 0); p.r('LowerArm_R', -0.4 * stag - 0.3 * fall, 0, 0)
    for k, nm in enumerate(('Cape_1', 'Cape_2', 'Cape_3')):
        p.r(nm, 0.3 * stag * (1 + k) * (1 - fall) - 0.5 * fall, 0, 0.0)
    return p

def jump(u):
    p = Pose(); up = np.sin(np.pi * np.clip(u, 0, 1)); crouch = (1 - seg(u, 0, 0.2)) * 0 + 0
    p.r('UpperLeg_L', -0.7 * up, 0, 0); p.r('LowerLeg_L', 1.2 * up, 0, 0); p.r('UpperLeg_R', -0.2 * up, 0, 0); p.r('LowerLeg_R', 0.5 * up, 0, 0)
    p.r('UpperArm_L', -0.9 * up, 0, 0.5 * up); p.r('UpperArm_R', -0.9 * up, 0, -0.5 * up)
    p.r('LowerArm_L', -0.5 * up, 0, 0); p.r('LowerArm_R', -0.5 * up, 0, 0)
    p.r('Spine', 0.1 * up, 0, 0)
    for k, nm in enumerate(('Cape_1', 'Cape_2', 'Cape_3')): p.r(nm, 0.5 * up * (1 + 0.3 * k), 0, 0)
    return p

CLIPS = {  # nom : (fonction, durée s, boucle)
    'idle': (idle, 2.6, True), 'walk': (walk, 0.90, True), 'run': (run, 0.62, True),
    'attack': (attack, 0.80, False), 'attack2': (attack2, 0.95, False), 'hit': (hit, 0.40, False),
    'death': (death, 1.50, False), 'jump': (jump, 0.70, False),
}

def build():
    out = {}
    for name, (fn, dur, loop) in CLIPS.items():
        n = int(round(dur * FPS)) + (1 if not loop else 1)   # boucle : dernière image = première
        frames = []
        for i in range(n):
            u = (i / (n - 1)) if not loop else (i / (n - 1))  # u∈[0,1], pour une boucle fn(1)==fn(0) par construction
            frames.append(fn(u if not loop else (i % (n - 1)) / (n - 1)))
        bones = set()
        for f in frames: bones |= set(f.keys())
        ch = {}
        for b in bones:
            rot = []
            for f in frames:
                e = f.get(b, np.zeros(3))
                rot.append(qnorm(qeuler(e[0], e[1], e[2])))
            ch.setdefault(b, {})['rot'] = np.array(rot)
        for pb in ('Hips', 'Root'):
            arr = np.array([f.pos[pb] for f in frames])
            if np.abs(arr).max() > 1e-6:
                ch.setdefault(pb, {})['pos'] = arr
        # os sans canal de rotation mais avec position : rotation identité
        for b, d in ch.items():
            if 'rot' not in d: d['rot'] = np.tile([0, 0, 0, 1.0], (n, 1))
        out[name] = {'fps': FPS, 'n': n, 'channels': ch}
    return out
