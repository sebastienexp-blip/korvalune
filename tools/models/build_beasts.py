import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
import beast_geo as F, wolf_anim as A, build_wolf as BW

if __name__ == '__main__':
    out = sys.argv[1]; names = [a for a in sys.argv[2:] if not a.startswith('--')] or list(F.V)
    quick = '--quick' in sys.argv
    os.makedirs(out, exist_ok=True)
    base = BW.materials(quick)
    anims0 = A.build()
    for name in names:
        parts, SK, meta = F.build(name)
        fur0 = [m for m in base if m.name == 'fur'][0]
        fur = Material('fur', base=fur0.base, normal=fur0.normal, orm=fur0.orm, factor=tuple(meta['fur']) + (1,), metal=1.0, rough=1.0, normal_scale=0.8, texkey='fur')
        glow = Material('glow', factor=(0.2, 0.1, 0.02, 1), metal=0.0, rough=0.4, emissive=tuple(meta['eye']))
        ms = {'fur': fur, 'bone': [m for m in base if m.name == 'bone'][0], 'glow': glow}
        used = [ms[k] for k in dict.fromkeys(p[2] for p in parts)]
        sc = meta['scale']; anims = {}
        for an, a in anims0.items():
            ch = {}
            for b, c in a['channels'].items():
                ch[b] = {'rot': c.get('rot'), 'pos': None if c.get('pos') is None else np.asarray(c['pos']) * sc}
            anims[an] = {**a, 'channels': ch}
        extras = {'korvalune': {'type': 'creature', 'skeleton': 'loup_' + name, 'species': name, 'refHeight': meta['refHeight'], 'note': 'bête hostile ; squelette du Loup des Cendres mis à l\'échelle'}}
        fn = os.path.join(out, f'bete_{name}.glb')
        write_glb(fn, parts, SK, used, anims, extras=extras, mesh_name=name, tex_dir=os.path.join(out, 'tex'))
        print(name, sum(len(m.F) for _, m, _ in parts), 'tri', os.path.getsize(fn) // 1024, 'Ko')
