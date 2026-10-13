"""Tête, yeux, nez, lèvres, sourcils, oreilles, cheveux et barbes en modèles 3D (.glb) — modules « town » teintés par rôle de sommet.
  python3 tools/models/build_head.py public/models_proto/veilleur [nom ...]"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from glbkit import *
import head_geo as H

def mats():
    return {
        'peau': Material('peau', factor=(1, 1, 1, 1), metal=0.0, rough=0.62, double_sided=True),
        'oeil': Material('oeil', factor=(1, 1, 1, 1), metal=0.0, rough=0.12, double_sided=False),
        'flat': Material('flat', factor=(1, 1, 1, 1), metal=0.0, rough=0.5, double_sided=True),
        'cheveux': Material('cheveux', factor=(1, 1, 1, 1), metal=0.0, rough=0.42, double_sided=True),
    }

def lin(m):
    """Couleurs fixes (rôle 1.0) : sRGB → linéaire, comme cosmetics_geo.catalog()."""
    fx = np.abs(m.C[:, 3] - 1.0) < 1e-6
    m.C[fx, :3] = np.clip(m.C[fx, :3], 0, 1) ** 2.2
    return m

def mirror(m):
    n = m.copy(); n.V[:, 0] *= -1; n.F = n.F[:, ::-1].copy(); n.N = m.N * np.array([-1, 1, 1]); return n

def eye_pos(sex):
    return np.array([0.031, 0.008, float(H.face_z(sex, 'ovale', 0.031, 0.008)) - 1.13 * H.EYE_R * (1.04 if sex == 'femme' else 1.0) + 0.0030])

def catalog():
    items = {}
    for sex in ('homme', 'femme'):
        for shape in H.FACES:
            items[f'tete_{sex}_{shape}'] = [('peau', H.build_head(sex, shape))]
        for st in H.EYES:
            e = H.build_eye(sex, st); e.V += eye_pos(sex)
            items[f'oeil_{sex}_{st}'] = [('oeil', e)]
        for k in H.NOSES:
            items[f'nez_{sex}_{k}'] = [('peau', H.build_nose(sex, k))]
        items[f'levres_{sex}'] = [('peau', H.build_lips(sex))]
        b = H.build_brow(sex); b.C[:, 3] = 0.6
        items[f'sourcil_{sex}'] = [('cheveux', b)]
    import hair_geo as HG
    tus = []
    for sg in (-1, 1):
        z = float(H.face_z('homme', 'ovale', 0.02, -0.074)) - 0.004
        m = HG.lock([np.array([sg * 0.019, -0.078, z]), np.array([sg * 0.021, -0.066, z + 0.003]), np.array([sg * 0.0225, -0.049, z + 0.0035])], 0.0058, 0.0050, hint=(1, 0, 0), taper=0.12, root=1.0, seed=3, n=10, seg=7)
        m.C[:, :3] = np.array([0.93, 0.89, 0.76]) * (0.88 + 0.12 * np.linspace(0, 1, len(m.V))[:, None] * 0 + 0.0); m.C[:, 3] = 1.0
        tus.append(m)
    from glbkit import concat as _cc
    t = _cc(tus); t.N = np.vstack([m.N for m in tus])
    items['crocs_orque'] = [('flat', t)]
    for k in ('humaine', 'elfe', 'orque'):
        items[f'oreille_{k}'] = [('peau', H.build_ear(k))]
    return items

def hair_catalog(only=None):
    import hair_geo as HG
    items = {}
    for k in list(HG.HAIR_STYLES) + list(HG.BEARDS):
        nm = ('coiffure_' if k in HG.HAIR_STYLES else 'barbe_') + k
        if only and not any(nm.startswith(o) for o in only): continue
        items[nm] = [('cheveux', HG.build(k))]
    return items

def emit(out, name, parts, ms):
    ps = [(f'{name}_{i}', lin(m), mat) for i, (mat, m) in enumerate(parts)]
    used = [ms[m] for m in dict.fromkeys(p[2] for p in ps)]
    fn = os.path.join(out, f'{name}.glb')
    write_glb(fn, ps, None, used, None, extras={'korvalune': {'type': 'town', 'kind': name}}, mesh_name=name, tex_dir=os.path.join(out, 'tex'))
    return sum(len(m.F) for _, m, _ in ps), os.path.getsize(fn) // 1024

if __name__ == '__main__':
    out = sys.argv[1]; only = sys.argv[2:]
    ms = mats(); tot = 0
    allc = dict(catalog()); allc.update(hair_catalog())
    for name, parts in allc.items():
        if only and not any(name.startswith(o) for o in only): continue
        t, kb = emit(out, name, parts, ms); tot += kb
        print(f'{name:28s} {t:6d} tri {kb:4d} Ko')
    print('total', tot, 'Ko')

def preview(out, sex='homme', shape='ovale', eyes='normaux', nose='droit', ear='humaine', extra=()):
    ms = mats(); cat = catalog(); parts = []
    def add(k, mir=False):
        for mat, m in cat[k]:
            m = m.copy() if not hasattr(m, 'N') else m
            parts.append((mat, m))
            if mir: parts.append((mat, mirror(m)))
    add(f'tete_{sex}_{shape}'); add(f'oeil_{sex}_{eyes}', True); add(f'nez_{sex}_{nose}'); add(f'levres_{sex}'); add(f'sourcil_{sex}', True)
    ax = 0.0715 * H.FACES[shape]['skull'][0] * (0.955 if sex == 'femme' else 1)
    for mat, m in cat[f'oreille_{ear}']:
        e = m.copy(); e.N = m.N.copy(); e.V = e.V + np.array([ax, -0.004, -0.012]); parts.append((mat, e))
        e2 = mirror(m); e2.V = e2.V + np.array([-ax, -0.004, -0.012]); parts.append((mat, e2))
    hc = hair_catalog(list(extra)) if extra else {}
    for k in extra:
        for mat, m in hc[k]: parts.append((mat, m))
    ps = [(f'p{i}', lin(m.copy() if False else m), mat) for i, (mat, m) in enumerate(parts)]
    used = [ms[m] for m in dict.fromkeys(p[2] for p in ps)]
    write_glb(os.path.join(out, 'prev_tete.glb'), ps, None, used, None, extras={'korvalune': {'type': 'town', 'kind': 'prev_tete'}}, mesh_name='prev')
