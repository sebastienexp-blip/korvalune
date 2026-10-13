import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
import town_geo as G, town_tex as TT

def materials():
    out = {}
    for nm, f in TT.TEX.items():
        base, nrm = f()
        out[nm] = Material(nm, base=base, normal=nrm, factor=(1, 1, 1, 1), metal=0.0, rough=0.92, texkey='ville_' + nm, double_sided=(nm == 'cloth'))
    out['metal'] = Material('metal', factor=(1, 1, 1, 1), metal=0.7, rough=0.45)
    out['window'] = Material('window', factor=(0.23, 0.17, 0.09, 1), metal=0.0, rough=0.6, emissive=(1.0, 0.69, 0.31))
    out['glow'] = Material('glow', factor=(1, 1, 1, 1), metal=0.0, rough=0.5, emissive=(0.6, 0.6, 0.6))
    out['water'] = Material('water', factor=(0.18, 0.44, 0.6, 1), metal=0.2, rough=0.1)
    return out

def emit(out, name, kit, extras, ms):
    used = [ms[m] for m in dict.fromkeys(p[2] for p in kit.parts)]
    fn = os.path.join(out, f'ville_{name}.glb')
    write_glb(fn, kit.parts, None, used, None, extras={'korvalune': {'type': 'town', 'kind': name, **extras}}, mesh_name=name, tex_dir=os.path.join(out, 'tex'))
    tri = sum(len(m.F) for _, m, _ in kit.parts)
    print(f'{name:22s} {tri:6d} tri {os.path.getsize(fn)//1024:4d} Ko')

def catalog():
    items = {}
    for hk, hv in (('a', 3.8), ('b', 4.7), ('c', 5.6)):
        k, ex = G.house(7, 6, hv, True); items['maison_long_' + hk] = (k, ex)
        k, ex = G.house(6, 7, hv, False); items['maison_pignon_' + hk] = (k, ex)
    for nm, fn in (('puits', G.well), ('tonneau', G.barrel), ('caisse', G.crate), ('foin', G.hay), ('lampadaire', G.lamp), ('enseigne_auberge', G.sign_inn), ('coffre_base', G.chest_base), ('coffre_couvercle', G.chest_lid)):
        k, ex = fn(); items[nm] = (k, ex)
    return items

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    only = [a for a in sys.argv[2:] if not a.startswith('--')]
    ms = materials()
    for name, (k, ex) in catalog().items():
        if only and name not in only: continue
        emit(out, name, k, ex, ms)
