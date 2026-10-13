"""Ennemis humanoïdes : corps construits sur le squelette du Veilleur (mêmes 27 os, mêmes animations) avec
leurs propres têtes, proportions, vêtements/armures et armes cuites dans le maillage (liées à la main).
build(nom) → (parts, squelette, méta). Reste à l'échelle « 1,8 m » : le jeu applique ensuite l'échelle propre à chaque monstre."""
import copy, re
import numpy as np
from glbkit import *
import hero_geo as G
import weapons_geo as W

B = G.B
S = np.array
BASE = r'^(torse|cou|bras|jambe|botte|main)(_R)?$'
ELITE = r'^(plastron|arete|dos|lame\d|ceinture|boucle|faulde\d_\d+|epaule[0-3]|epaule_cap|brassard\d|cubitiere|cubitiere_pointe|bracelet|gantelet|cuissard|cuissard_ext|genouillere|genouillere_pointe|jambiere|mollet|botte_revers|botte_pointe|gorgerin\d|crane|casque_arete|casque_front|joue|nuque\d)(_R)?$'

def qmat(q, t):
    x, y, z, w = q
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4); M[:3, :3] = R; M[:3, 3] = t
    return M

def bake(parts_w, bone, q, world, prefix):
    """Cuit une arme/un objet dans le maillage, lié rigidement à un os."""
    out = []
    for n, m, mat in parts_w:
        mm = m.copy().transform(qmat(q, world)); skin_rigid(mm, B[bone]); out.append((f'{prefix}_{n}', mm, mat))
    return out

SWORD_Q = [0.5, 0.5, 0.5, 0.5]
HAND_R_W = (-0.345, 0.80, 0.05); HAND_L_W = (0.345, 0.80, 0.05)
def sin_(d): return float(np.sin(np.deg2rad(d) / 2))
def cos_(d): return float(np.cos(np.deg2rad(d) / 2))

# ------------------------------------------------------------------------------------------------ têtes
def head(w=1.0, h=1.0, d=1.0, jaw=0.5, brow=0.3, nose=0.5, ears=0.0, ear_pt=0.0, tusk=0.0, eye=None, k=1.0, hood=False, base_cloth='cloth'):
    parts = []
    y0, y1 = 1.545, 1.545 + 0.255 * h
    n = 14
    rs = w * prof([(0, .045), (.18, .066 + .02 * jaw), (.5, .086), (.82, .083), (1, .05)], n)
    rf = d * prof([(0, .060), (.2, .092), (.5, .108), (.82, .1), (1, .062)], n)
    sk = Loft(np.stack([np.zeros(n), np.linspace(y0, y1, n), np.full(n, 0.016)], 1), rf, rs, p=2.5, segs=28, cap0=2, cap1=2, tile=0.25, ref=(0, 0, 1))
    parts.append(('crane', sk.mesh(), 'hide'))
    # arcade sourcilière
    if brow > 0:
        for s in (1, -1):
            a = (0.5 + 0.0) if False else 0
            P0, _ = sk.sample(0.62, 0.04 * s); P1, _ = sk.sample(0.64, 0.115 * s)
            pth = smoothpath([P0 + S([0, 0.004, 0.004]), (P0 + P1) / 2 + S([0, 0.010 * brow + 0.004, 0.012 * brow]), P1 + S([0, -0.004, 0.004])], 6)
            parts.append((f'arcade{s}', Loft(pth, 0.006 + 0.012 * brow, 0.008, p=2.2, segs=8, cap0=1, cap1=1, tile=.05, ref=(0, 1, 0)).mesh(), 'hide'))
    # nez
    P0, _ = sk.sample(0.50, 0.0)
    ln = 0.02 + 0.05 * nose
    nz = smoothpath([P0 + S([0, 0.025, -0.004]), P0 + S([0, 0.0, 0.012]), P0 + S([0, -0.022, 0.010 + ln * 0.5])], 6)
    parts.append(('nez', Loft(nz, prof([(0, .005), (1, .014)], 6), prof([(0, .007), (1, .016 + 0.01 * nose)], 6), p=2.2, segs=8, cap1=2, tile=.05, ref=(1, 0, 0)).mesh(), 'hide'))
    # yeux
    for s in (1, -1):
        P0, N0 = sk.sample(0.60, 0.062 * s)
        e = Loft(smoothpath([P0 + S([-0.012 * s, 0.0, 0.0]), P0 + S([0.0, 0.0, 0.004]), P0 + S([0.012 * s, 0.002, 0.0])], 5), 0.0035, 0.0058, p=2.0, segs=8, cap0=1, cap1=1, tile=.03, ref=(0, 0, 1))
        parts.append((f'oeil{s}', e.mesh(), 'eye' if eye else 'dark'))
    # bouche : lèvre fendue
    P0, _ = sk.sample(0.30, 0.0)
    parts.append(('levre', Loft(smoothpath([P0 + S([-0.034 * w, 0.0, -0.012]), P0 + S([0, -0.002, 0.004]), P0 + S([0.034 * w, 0.0, -0.012])], 7), 0.0035, 0.004, p=2.0, segs=6, cap0=1, cap1=1, tile=.03, ref=(0, 1, 0)).mesh(), 'dark'))
    # oreilles (a = ±0.25 = côtés)
    if ears > 0:
        for s in (1, -1):
            P0, _ = sk.sample(0.50, 0.25 * s)
            e = smoothpath([P0 + S([0, 0.0, 0]), P0 + S([s * (0.03 + 0.07 * ears), 0.02 + 0.03 * ear_pt, -0.015 - 0.02 * ears]), P0 + S([s * (0.05 + 0.15 * ears), 0.05 + 0.12 * ear_pt, -0.04 - 0.05 * ears])], 9)
            parts.append((f'oreille{s}', Loft(e, prof([(0, .006), (.4, .004), (1, .001)], 9), prof([(0, .03), (.4, .034), (1, .004)], 9), p=2.1, segs=8, cap1=1, tile=.1, ref=(0, 0, 1)).mesh(), 'hide'))
    # défenses
    if tusk > 0:
        for s in (1, -1):
            P0, _ = sk.sample(0.14, 0.035 * s)
            t_ = smoothpath([P0 + S([0, 0.0, 0.0]), P0 + S([s * 0.004, 0.035 * tusk, 0.022 * tusk]), P0 + S([-s * 0.004, 0.08 * tusk, 0.03 * tusk])], 8)
            parts.append((f'defense{s}', Loft(t_, prof([(0, .0085), (1, .0012)], 8), prof([(0, .0085), (1, .0012)], 8), p=2.0, segs=8, cap1=1, tile=.05, ref=(1, 0, 0)).mesh(), 'bone'))
    # capuche : coiffe plus large, décalée vers l'arrière et le haut (le visage reste dégagé) + drapé sur la nuque
    if hood:
        n2 = 12
        top = Loft(np.stack([np.zeros(n2), np.linspace(1.60, 1.84 * 0 + 1.60 + 0.25 * h, n2), np.full(n2, -0.012)], 1),
                   d * prof([(0, .100), (.35, .125), (.8, .120), (1, .07)], n2) * 1.0, w * prof([(0, .098), (.35, .108), (.8, .102), (1, .06)], n2) * 1.0,
                   p=2.4, segs=28, cap1=2, tile=0.3, ref=(0, 0, 1))
        parts.append(('capuche', top.mesh(), base_cloth))
        dr = smoothpath([S([0, 1.64, -0.07]), S([0, 1.54, -0.12]), S([0, 1.44, -0.115])], 8)
        parts.append(('capuche_drape', Loft(dr, prof([(0, .07), (1, .06)], 8), prof([(0, .12), (1, .15)], 8), p=2.4, segs=24, cap1=1, tile=.2, ref=(0, 0, 1)).mesh(), base_cloth))
    c = S([0, 1.55, 0.0])
    out = []
    for n_, m, mat in parts:
        m = m.copy(); m.V = c + (m.V - c) * k; skin_rigid(m, B['Head']); out.append((n_, m, mat))
    return out

# ------------------------------------------------------------------------------------------------ robe longue
def robe(width=1.0):
    n = 12
    sp = smoothpath([(0, 1.02, 0), (0, 0.80, 0), (0, 0.45, 0), (0, 0.13, 0)], n)
    m = Loft(sp, prof([(0, .125), (.3, .15), (1, .24)], n) * width, prof([(0, .17), (.3, .19), (1, .31)], n) * width, p=2.5, segs=36, cap1=0, tile=0.4).mesh()
    return G.skin_skirt(m)

def kilt():
    n = 10
    sp = smoothpath([(0, 1.03, 0), (0, 0.90, 0), (0, 0.72, 0)], n)
    m = Loft(sp, prof([(0, .13), (1, .19)], n), prof([(0, .18), (1, .27)], n), p=2.5, segs=32, tile=0.3).mesh()
    return G.skin_skirt(m)

# ------------------------------------------------------------------------------------------------ variantes
V = {
  'bandit':  dict(keep=r'^(ceinture|boucle)(_R)?$', head=dict(w=0.98, jaw=.6, brow=.45, nose=.6, eye=True, hood=True, base_cloth='linen'), skin=(0.46, 0.30, 0.22), weapon=('dagger', 'R'), scale=(1, 1, 1)),
  'elite':   dict(keep=ELITE, head=None, skin=(0.46, 0.30, 0.22), weapon=('sword', 'R'), shield=True, scale=(1.04, 1, 1.04), decimate=0.07),
  'zealot':  dict(keep=r'^cape$', head=dict(w=0.95, jaw=.35, brow=.2, nose=.5, hood=True, eye=True), skin=(0.52, 0.42, 0.36), weapon=('sword', 'R'), robe=True, scale=(1, 1, 1)),
  'mage':    dict(keep=r'^cape$', head=dict(w=0.92, h=1.04, jaw=.2, brow=.15, nose=.45, hood=True, eye=True), skin=(0.50, 0.40, 0.36), weapon=('staff', 'R'), off=('orb', 'L'), robe=True, scale=(0.98, 1.03, 0.98)),
  'archer':  dict(keep=r'^(ceinture|boucle)(_R)?$', head=dict(w=0.94, jaw=.4, brow=.25, nose=.55, eye=True, hood=True, base_cloth='linen'), skin=(0.46, 0.30, 0.22), weapon=('bow', 'L'), quiver=True, scale=(0.96, 1.01, 0.96)),
  'brute':   dict(keep=r'^(ceinture|boucle|epaule0|epaule_cap)(_R)?$', head=dict(w=1.12, h=0.95, d=1.1, jaw=.95, brow=.95, nose=.4, tusk=0.7, ears=0.15, k=0.95), skin=(0.40, 0.25, 0.18), weapon=('club', 'R', 1.0), scale=(1.30, 0.98, 1.22), warty=0.4),
  'troll':   dict(keep=r'^(ceinture|boucle)(_R)?$', head=dict(w=1.05, h=0.9, d=1.1, jaw=1.0, brow=1.0, nose=.8, tusk=1.3, ears=0.35, ear_pt=-0.3, eye=True, k=0.9), skin=(0.22, 0.27, 0.19), weapon=('club', 'R', 1.4), scale=(1.45, 1.0, 1.35), warty=1.0),
  'goblin':  dict(keep=r'^(ceinture|boucle)(_R)?$', head=dict(w=1.1, h=1.0, d=1.1, jaw=.5, brow=.6, nose=1.0, ears=1.0, ear_pt=1.0, tusk=.4, eye=True, k=1.55), skin=(0.16, 0.30, 0.10), weapon=('dagger', 'R'), scale=(0.92, 0.95, 0.92), warty=0.6),
}

def build(name):
    v = V[name]
    parts = []
    bare = ('plastron' not in v['keep'])
    for n, m, mat in G.parts:
        base = re.sub(r'_R$', '', n)
        if re.match(BASE, n) or re.match(v['keep'], n):
            if re.match(r'^(bras|jambe|cou|main|botte)(_R)?$', n) and not v.get('robe_cloth'):
                # membres nus : peau (sauf si habillé en armure complète)
                if name != 'elite' or n.startswith(('cou', 'main')):
                    mat = 'hide' if n.startswith(('cou', 'main', 'bras')) or v.get('legs_bare', True) else mat
            if name in ('bandit', 'archer') and re.match(r'^(torse|jambe|botte)(_R)?$', n): mat = 'linen' if n.startswith(('torse', 'jambe')) else 'leather'
            if name in ('zealot', 'mage') and n.startswith(('torse', 'jambe', 'bras')): mat = 'cloth'
            if name == 'elite' and n.startswith(('torse', 'jambe')): mat = 'linen'
            parts.append((n, m.copy(), mat))
    if name in ('brute', 'troll', 'goblin'):
        parts = [(n, m, 'hide' if (n.startswith(('torse', 'jambe', 'bras')) ) else mat) for n, m, mat in parts]
        parts.append(('pagne', kilt(), 'leather'))
    if v['head']: parts += head(**v['head'])
    if v.get('robe'):
        parts.append(('robe', robe(), 'cloth'))
    # armes
    kind = v['weapon'][0]
    wp = {'dagger': W.dagger, 'sword': None, 'staff': W.staff, 'bow': W.bow, 'club': None}[kind] if kind != 'club' else None
    if kind == 'club': wparts = W.club(v['weapon'][2])
    elif kind == 'sword':
        import sword_geo as SG; wparts = [(n, m, mat) for n, m, mat in SG.parts]
    else: wparts = wp()
    if v['weapon'][1] == 'R':
        q = {'staff': [sin_(55), 0, 0, cos_(55)], 'club': [sin_(70), 0, 0, cos_(70)]}.get(kind, SWORD_Q)
        parts += bake(wparts, 'Hand_R', q, HAND_R_W, 'arme')
    else:
        parts += bake(wparts, 'Hand_L', [sin_(20), 0, 0, cos_(20)], HAND_L_W, 'arme')
    if v.get('shield'):
        parts += bake(W.shield(), 'LowerArm_L', [0, sin_(50), 0, cos_(50)], S([0.30, 1.0, 0.12]), 'ecu')
    if v.get('off'):
        parts += bake(W.orb(), 'Hand_L', [0, 0, 0, 1], S([0.362, 0.79, 0.08]), 'orbe')
    if v.get('quiver'):
        parts += bake(W.quiver(), 'Socket_Back', [0, 0, sin_(20), cos_(20)], S([-0.11, 1.18, -0.22]), 'carquois')
    sx, sy, sz = v['scale']
    sc = np.array([sx, sy, sz])
    for n, m, mat in parts: m.V = m.V * sc
    SK = copy.deepcopy(G.SK); SK.pos = [p * sc for p in SK.pos]
    eyec = {'zealot': (0.9, 0.2, 0.15), 'mage': (0.35, 0.5, 1.0), 'troll': (1.0, 0.55, 0.1), 'goblin': (1.0, 0.9, 0.15), 'brute': (0.9, 0.5, 0.2)}.get(name, (0.35, 0.3, 0.2))
    hmax = max(float(m.V[:, 1].max()) for _, m, _ in parts)
    return parts, SK, dict(scale=sc, refHeight=round(hmax, 3), skin=v['skin'], warty=v.get('warty', 0.0), eye=eyec, decimate=v.get('decimate', 0))
