"""Armures alternatives du Veilleur : cuir (archer, assassin) et tissu (mage), mêmes os que l'armure de plates.
  python3 tools/models/armor_sets.py public/models_proto/veilleur
Écrit veilleur_<emplacement>@<style>.glb (cape : pièce commune)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from glbkit import *
import hero_geo as G
import build_hero as BH
from hero_geo import B, P, S, sh, rigid, wrap, notch, tri, vpath, mirrored, torso, arm, leg, boot, skirt, sho, collar, skull, beak
gl = G.gl

# capuche : ajustée au crâne de la tête modélisée (plus haute et plus large que le crâne du casque de plates)
_hp = G.smoothpath([(0, 1.55, 0.03), (0, 1.61, 0.045), (0, 1.70, 0.05), (0, 1.79, 0.046), (0, 1.865, 0.03)], 14)
hood = G.Loft(_hp, prof([(0, .075), (.16, .118), (.48, .152), (.76, .140), (.92, .092), (1, .030)], 14), prof([(0, .070), (.16, .106), (.48, .124), (.76, .116), (.92, .076), (1, .028)], 14), p=2.15, segs=30, cap0=0, cap1=1, tile=0.3)

def build(style):
    parts = []
    def add(slot, name, mesh, mat, both=False):
        parts.append((slot, name, mesh, mat))
        if both: parts.append((slot, name + '_R', mirrored(mesh), mat))
    leather = 'leather'
    if style == 'cuir':
        # --- casque : capuche de cuir, queue dans la nuque, bord renforcé
        add('casque', 'capuche', sh(hood, 'Head', a0=0.11, a1=0.89, t_lo=0.0, t_hi=1.0, offset=0.014, thick=0.010, bevel=0.01, na=40, nt=22, dome=0.004, tile=0.3), leather)
        add('casque', 'capuche_pli', sh(hood, 'Head', a0=0.30, a1=0.70, t_lo=0.0, t_hi=0.28, offset=0.030, thick=0.009, bevel=0.01, na=26, nt=8, tile=0.3), leather)
        add('casque', 'capuche_bord', sh(hood, 'Head', a0=0.09, a1=0.12, t_lo=0.02, t_hi=0.96, offset=0.018, thick=0.008, bevel=0.004, na=4, nt=22, tile=0.1), 'trim', both=False)
        add('casque', 'capuche_bord_R', sh(hood, 'Head', a0=0.88, a1=0.91, t_lo=0.02, t_hi=0.96, offset=0.018, thick=0.008, bevel=0.004, na=4, nt=22, tile=0.1), 'trim')
        # --- épaulières de cuir bouilli : deux lames et une sangle
        for k, (lo, hi, off) in enumerate([(0.0, 0.50, 0.010), (0.22, 0.74, 0.022)]):
            nf = notch(5 + 2 * k, 0.04)
            hf = lambda a, hi=hi, nf=nf: np.clip(hi * nf(a) + 0.05 * (0.5 + 0.5 * np.cos(2 * np.pi * (a - 0.25))), 0, 1)
            add('epaules', f'epaule_cuir{k}', sh(sho, 'UpperArm_L', **wrap(0.75), t_lo=lo, t_hi=hf, offset=off, thick=0.008, bevel=0.008, na=40, nt=7, dome=0.004, tile=0.3), leather, both=True)
        add('epaules', 'epaule_sangle', sh(sho, 'UpperArm_L', **wrap(0.75), t_lo=0.20, t_hi=0.30, offset=0.030, thick=0.006, bevel=0.004, na=40, nt=4, tile=0.2), 'trim', both=True)
        # --- torse : gilet clouté, bandoulière, ceinture, poche, tassettes de cuir
        add('torse', 'gilet', sh(torso, 'Chest', **wrap(0.5), t_lo=0.40, t_hi=0.90, offset=0.010, thick=0.010, bevel=0.010, na=46, nt=18, tile=0.35), leather)
        add('torse', 'gilet_bas', sh(torso, 'Spine', **wrap(0.5), t_lo=0.16, t_hi=0.42, offset=0.008, thick=0.009, bevel=0.01, na=46, nt=8, tile=0.35), leather)
        add('torse', 'bandouliere', sh(torso, 'Chest', a0=-0.32, a1=0.32, t_lo=lambda a: 0.50 + 0.80 * a, t_hi=lambda a: 0.60 + 0.80 * a, offset=0.022, thick=0.007, bevel=0.005, na=26, nt=5, tile=0.2), 'trim')
        add('torse', 'bandouliere_dos', sh(torso, 'Chest', a0=0.68, a1=1.32, t_lo=lambda a: 0.50 - 0.80 * (a - 1.0), t_hi=lambda a: 0.60 - 0.80 * (a - 1.0), offset=0.022, thick=0.007, bevel=0.005, na=26, nt=5, tile=0.2), 'trim')
        add('torse', 'ceinture', sh(torso, 'Hips', **wrap(0.5), t_lo=0.085, t_hi=0.185, offset=0.016, thick=0.01, bevel=0.01, na=44, nt=6, tile=0.2), leather)
        add('torse', 'boucle', sh(torso, 'Hips', a0=-0.04, a1=0.04, t_lo=0.09, t_hi=0.18, offset=0.026, thick=0.010, bevel=0.008, na=10, nt=8, dome=0.008, tile=0.1), 'trim')
        add('torse', 'poche', sh(torso, 'Hips', a0=0.14, a1=0.22, t_lo=0.04, t_hi=0.17, offset=0.030, thick=0.012, bevel=0.01, na=10, nt=8, dome=0.01, tile=0.1), leather, both=True)
        for i in range(10):
            a0 = i / 10 - 0.04; a1 = i / 10 + 0.12
            hi = (lambda a, a0=a0, a1=a1: 0.50 + 0.32 * tri(np.clip((a - a0) / (a1 - a0), 0, 1)) ** 0.9)
            m = G.shell(skirt, a0=a0, a1=a1, t_lo=0.0, t_hi=hi, offset=0.008, thick=0.006, bevel=0.008, na=5, nt=6, dome=0.003, tile=0.25)
            add('torse', f'tassette{i}', G.skin_skirt(m), leather)
        # --- bras : brassards lacés et gants
        add('bras', 'brassard_cuir', sh(arm, 'LowerArm_L', **wrap(0.75), t_lo=0.56, t_hi=0.94, offset=0.007, thick=0.008, bevel=0.01, na=26, nt=10, tile=0.25), leather, both=True)
        for k in range(4):
            lo = 0.60 + 0.08 * k
            add('bras', f'lacet{k}', sh(arm, 'LowerArm_L', **wrap(0.75), t_lo=lo, t_hi=lo + 0.014, offset=0.012, thick=0.004, bevel=0.003, na=26, nt=3, tile=0.1), 'trim', both=True)
        add('bras', 'gant', sh(gl, 'Hand_L', a0=-0.30, a1=0.30, t_lo=0.0, t_hi=1.0, offset=0.003, thick=0.006, bevel=0.007, na=14, nt=6, tile=0.12), leather, both=True)
        # --- jambes : pantalon renforcé, genouillères de cuir, bottes
        add('jambes', 'cuisse_cuir', sh(leg, 'UpperLeg_L', **wrap(0.5), t_lo=0.08, t_hi=0.42, offset=0.007, thick=0.009, bevel=0.01, na=26, nt=12, tile=0.3), leather, both=True)
        add('jambes', 'genou_cuir', sh(leg, 'UpperLeg_L', a0=-0.27, a1=0.27, t_lo=0.42, t_hi=0.60, offset=0.012, thick=0.010, bevel=0.012, na=18, nt=10, dome=0.020, tile=0.2), leather, both=True)
        add('jambes', 'jambiere_cuir', sh(leg, 'LowerLeg_L', **wrap(0.5), t_lo=0.60, t_hi=0.94, offset=0.007, thick=0.009, bevel=0.01, na=26, nt=12, tile=0.3), leather, both=True)
        add('jambes', 'botte_revers', sh(leg, 'LowerLeg_L', **wrap(0.5), t_lo=0.90, t_hi=1.0, offset=0.014, thick=0.008, bevel=0.007, na=30, nt=4, tile=0.15), 'trim', both=True)
        add('jambes', 'botte_cuir', sh(boot, 'Foot_L', a0=-0.32, a1=0.32, t_lo=0.40, t_hi=0.99, offset=0.004, thick=0.007, bevel=0.01, na=16, nt=10, dome=0.004, tile=0.2), leather, both=True)
    else:  # tissu
        cl = 'cloth'
        add('casque', 'capuche', sh(hood, 'Head', a0=0.11, a1=0.89, t_lo=0.0, t_hi=1.0, offset=0.016, thick=0.007, bevel=0.01, na=40, nt=22, dome=0.006, tile=0.3), cl)
        add('casque', 'capuche_pli', sh(hood, 'Head', a0=0.28, a1=0.72, t_lo=0.0, t_hi=0.34, offset=0.032, thick=0.007, bevel=0.01, na=26, nt=8, tile=0.3), cl)
        pth = G.smoothpath([(0, 1.82, 0.0), (0, 1.88, -0.03), (0, 1.915, -0.08), (0, 1.925, -0.135)], 10)
        pt = G.Loft(pth, prof([(0, .060), (.5, .036), (1, .006)], 10), prof([(0, .060), (.5, .036), (1, .006)], 10), p=2.0, segs=14, cap1=2, tile=0.2, ref=(0, 0, 1))
        m = pt.mesh(); rigid(m, 'Head'); add('casque', 'pointe', m, cl)
        add('casque', 'diademe', sh(hood, 'Head', a0=-0.21, a1=0.21, t_lo=0.60, t_hi=0.66, offset=0.020, thick=0.006, bevel=0.004, na=20, nt=4, tile=0.1), 'trim')
        add('casque', 'gemme', sh(hood, 'Head', a0=-0.025, a1=0.025, t_lo=0.58, t_hi=0.68, offset=0.026, thick=0.008, bevel=0.006, na=6, nt=6, dome=0.010, tile=0.1), 'glow')
        # épaules : mantelet
        add('epaules', 'mantelet', sh(sho, 'UpperArm_L', **wrap(0.75), t_lo=0.0, t_hi=lambda a: 0.50 + 0.06 * np.cos(2 * np.pi * a * 3), offset=0.016, thick=0.007, bevel=0.01, na=40, nt=8, dome=0.004, tile=0.3), cl, both=True)
        add('epaules', 'mantelet_bord', sh(sho, 'UpperArm_L', **wrap(0.75), t_lo=0.44, t_hi=0.52, offset=0.020, thick=0.006, bevel=0.004, na=40, nt=3, tile=0.15), 'trim', both=True)
        # torse : robe
        add('torse', 'robe_haut', sh(torso, 'Chest', **wrap(0.5), t_lo=0.30, t_hi=0.92, offset=0.010, thick=0.008, bevel=0.01, na=46, nt=18, tile=0.35), cl)
        add('torse', 'robe_bas', sh(torso, 'Spine', **wrap(0.5), t_lo=0.12, t_hi=0.32, offset=0.010, thick=0.008, bevel=0.01, na=46, nt=8, tile=0.35), cl)
        add('torse', 'plastron_ruban', sh(torso, 'Chest', a0=-0.09, a1=0.09, t_lo=0.42, t_hi=0.90, offset=0.020, thick=0.006, bevel=0.005, na=10, nt=14, tile=0.15), 'trim')
        add('torse', 'echarpe', sh(torso, 'Hips', **wrap(0.5), t_lo=0.07, t_hi=0.19, offset=0.020, thick=0.008, bevel=0.01, na=44, nt=6, tile=0.2), 'trim')
        add('torse', 'noeud', sh(torso, 'Hips', a0=-0.05, a1=0.05, t_lo=0.04, t_hi=0.22, offset=0.030, thick=0.010, bevel=0.01, na=10, nt=8, dome=0.010, tile=0.1), 'trim')
        add('torse', 'col', sh(collar, 'Chest', **wrap(0.5), t_lo=0.0, t_hi=0.85, offset=0.008, thick=0.006, bevel=0.01, na=40, nt=6, tile=0.2), cl)
        # bras : longues manches
        add('bras', 'manche_haut', sh(arm, 'LowerArm_L', **wrap(0.75), t_lo=0.0, t_hi=0.60, offset=0.012, thick=0.006, bevel=0.01, na=26, nt=10, tile=0.25), cl, both=True)
        add('bras', 'manche_bas', sh(arm, 'LowerArm_L', **wrap(0.75), t_lo=0.50, t_hi=0.95, offset=0.026, thick=0.006, bevel=0.01, na=26, nt=10, tile=0.25), cl, both=True)
        add('bras', 'poignet', sh(arm, 'LowerArm_L', **wrap(0.75), t_lo=0.92, t_hi=0.99, offset=0.010, thick=0.006, bevel=0.004, na=26, nt=3, tile=0.15), 'trim', both=True)
        add('bras', 'gant', sh(gl, 'Hand_L', a0=-0.30, a1=0.30, t_lo=0.0, t_hi=1.0, offset=0.003, thick=0.005, bevel=0.007, na=14, nt=6, tile=0.12), cl, both=True)
        # jambes : jupe de robe jusqu'aux chevilles, bottines
        rp = G.smoothpath([(0, 1.03, 0), (0, 0.80, 0), (0, 0.50, 0), (0, 0.14, 0)], 12)
        rob = G.Loft(rp, prof([(0, .125), (.3, .15), (1, .30)], 12), prof([(0, .17), (.3, .21), (1, .35)], 12), p=2.4, segs=44, tile=0.4)
        hem = lambda a: 1.0 - 0.05 * np.abs(np.sin(np.pi * 9 * a))
        m = G.shell(rob, **wrap(0.5), t_lo=0.0, t_hi=hem, offset=0.0, thick=0.007, bevel=0.01, na=60, nt=18, tile=0.4)
        mb = G.shell(rob, **wrap(0.5), t_lo=0.94, t_hi=1.0, offset=0.004, thick=0.006, bevel=0.004, na=60, nt=3, tile=0.2)
        for nm, mm, mt in (('robe_jupe', m, cl), ('robe_ourlet', mb, 'trim')):
            y = mm.V[:, 1]; x = mm.V[:, 0]; n = len(mm.V)
            s_ = smoothstep((1.0 - y) / 0.9) * 0.45; wl = smoothstep((x + 0.15) / 0.30)
            mm.J = np.zeros((n, 4), np.int64); mm.W = np.zeros((n, 4))
            mm.J[:, 0] = B['Hips']; mm.W[:, 0] = 1 - s_
            mm.J[:, 1] = B['UpperLeg_L']; mm.W[:, 1] = s_ * wl
            mm.J[:, 2] = B['UpperLeg_R']; mm.W[:, 2] = s_ * (1 - wl)
            add('jambes', nm, mm, mt)
        add('jambes', 'botte_tissu', sh(boot, 'Foot_L', a0=-0.32, a1=0.32, t_lo=0.40, t_hi=0.99, offset=0.004, thick=0.006, bevel=0.01, na=16, nt=10, dome=0.004, tile=0.2), 'leather', both=True)
    return parts

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    mats = BH.materials('--quick' in sys.argv)
    tex = os.path.join(out, 'tex')
    for style in ('cuir', 'tissu'):
        groups = {}
        for slot, n, m, mat in build(style): groups.setdefault(slot, []).append((n, m, mat))
        for slot, parts in groups.items():
            used = {p[2] for p in parts}
            ms = [m for m in mats if m.name in used]
            extras = {'korvalune': {'type': 'armor', 'slot': slot, 'skeleton': 'veilleur', 'style': style, 'note': 'même squelette que le corps'}}
            fn = os.path.join(out, f'veilleur_{slot}__{style}.glb')
            st = write_glb(fn, parts, G.SK, ms, {}, extras=extras, tex_dir=tex, mesh_name=slot)
            print(style, slot, os.path.getsize(fn) // 1024, 'Ko', sum(v[1] for v in st.values()), 'tri')
