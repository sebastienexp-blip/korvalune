"""Épée « Lame de la Veille » : acier lunaire, garde en croissant argenté, pierre de lune.
Repère local : origine au centre de la poignée, lame vers +Y, plats de la lame face à ±Z, tranchants vers ±X. Longueur totale ≈ 1,13 m."""
import numpy as np
from glbkit import *

parts = []
def add(n, m, mat): parts.append((n, m, mat))

# lame : section losange avec gouttière centrale (« fuller »), pointe effilée
def blade_section(i, a, rf, rs):
    z = rs * np.cos(a)                       # largeur (tranchants)
    s = np.sign(np.sin(a)); w = np.abs(z) / max(rs, 1e-9)
    t = rf * (1 - w) ** 0.85                  # épaisseur : max au centre, 0 aux tranchants
    groove = 0.52 * rf * np.exp(-(z / (0.26 * rs + 1e-9)) ** 2) * (1 - w)
    return s * np.maximum(t - groove, 0.0003), z
N = 28
y = np.linspace(0.13, 1.02, N)
bp = np.stack([np.zeros(N), y, np.zeros(N)], 1)
t = np.linspace(0, 1, N)
width = 0.0285 * (1 - 0.30 * t) * np.where(t > 0.86, np.clip((1 - t) / 0.14, 0, 1) ** 0.7, 1.0) + 0.0004
thick = 0.0062 * (1 - 0.45 * t) * np.where(t > 0.9, np.clip((1 - t) / 0.1, 0, 1), 1.0) + 0.0002
blade = Loft(bp, thick, width, segs=24, section=blade_section, ref=(0, 0, 1), tile=0.2)
add('lame', blade.mesh(), 'blade')
# arête de dos de la lame (talon) en argent
heel = Loft(np.stack([np.zeros(6), np.linspace(0.12, 0.2, 6), np.zeros(6)], 1), 0.0085, 0.031, p=2.6, segs=14, cap0=1, tile=0.1)
add('talon', heel.mesh(), 'trim')

# garde : croissant de lune (cornes vers la pointe)
cn = 22; r = 0.078; yc = 0.128 + r
th = np.linspace(np.deg2rad(192), np.deg2rad(348), cn)
gp = np.stack([r * np.cos(th), yc + r * np.sin(th), np.zeros(cn)], 1)
tt = np.linspace(0, 1, cn)
guard = Loft(gp, 0.0095, 0.0125 * np.sin(np.pi * tt) ** 0.7 + 0.0035, p=2.2, segs=12, cap0=2, cap1=2, tile=0.1, ref=(0, 0, 1))
add('garde', guard.mesh(), 'trim')
# pierre de lune
gem = Loft(np.stack([np.zeros(5), np.linspace(0.138, 0.16, 5), np.full(5, 0.0)], 1), prof([(0, .007), (.5, .0085), (1, .0045)], 5), prof([(0, .007), (.5, .0085), (1, .0045)], 5), p=2.0, segs=12, cap0=2, cap1=2, tile=0.03)
m = gem.mesh(); m.V[:, 2] += 0.0105; add('pierre', m, 'glow')
# poignée enveloppée de cuir
gr = Loft(np.stack([np.zeros(12), np.linspace(-0.11, 0.115, 12), np.zeros(12)], 1), prof([(0, .0185), (.5, .0165), (1, .0185)], 12), prof([(0, .0185), (.5, .0165), (1, .0185)], 12), p=2.2, segs=12, cap0=1, cap1=1, tile=0.1)
add('poignee', gr.mesh(), 'leather')
for k in range(6):
    yy = -0.085 + k * 0.034
    ring = Loft(np.stack([np.zeros(3), np.linspace(yy, yy + 0.005, 3), np.zeros(3)], 1), 0.0195, 0.0195, p=2.2, segs=12, cap0=1, cap1=1, tile=0.05)
    add(f'bague{k}', ring.mesh(), 'trim')
# pommeau : tête de corbeau stylisée = ovoïde avec bec
pm = Loft(np.stack([np.zeros(8), np.linspace(-0.175, -0.108, 8), np.zeros(8)], 1), prof([(0, .012), (.4, .03), (.8, .027), (1, .02)], 8), prof([(0, .012), (.4, .03), (.8, .027), (1, .02)], 8), p=2.1, segs=14, cap0=2, tile=0.1)
add('pommeau', pm.mesh(), 'trim')
bk = Loft(smoothpath([(0, -0.15, 0.02), (0, -0.152, 0.05), (0, -0.165, 0.075)], 6), prof([(0, .013), (1, .002)], 6), prof([(0, .012), (1, .002)], 6), p=2.1, segs=10, cap1=1, tile=0.05, ref=(1, 0, 0))
add('pommeau_bec', bk.mesh(), 'steel')
