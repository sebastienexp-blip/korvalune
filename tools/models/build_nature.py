import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
import nature_geo as G, nature_tex as NT

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    atlas = NT.build_atlas()
    mat = Material('nature', base=atlas, factor=(1, 1, 1, 1), metal=0.0, rough=0.95, texkey='nature', double_sided=True, alpha_mode='MASK', cutoff=0.5, base_fmt='PNG')
    only = [a for a in sys.argv[2:] if not a.startswith('--')]
    tot = 0
    for name, (mesh, kind, lod) in G.catalog().items():
        if only and name not in only: continue
        extras = {'korvalune': {'type': 'nature', 'kind': kind, 'lod': lod, 'note': 'décor statique, matériau/atlas partagés (nature/tex), couleurs de sommets = teinte'}}
        fn = os.path.join(out, f'nature_{name}.glb')
        write_glb(fn, [(name, mesh, 'nature')], None, [mat], None, extras=extras, mesh_name=name, tex_dir=os.path.join(out, 'tex'))
        tot += os.path.getsize(fn)
        print(f'{name:18s} {len(mesh.F):5d} tri {os.path.getsize(fn)//1024:4d} Ko  h={mesh.V[:,1].max():.2f} r={np.abs(mesh.V[:,[0,2]]).max():.2f}')
    print('total', tot // 1024, 'Ko + atlas')
