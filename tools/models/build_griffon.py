import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
import griffon_geo as G, griffon_anim as A, textures as T
import build_hero as BH

def mats(quick):
    sz = 256 if quick else 512
    c, n, o, h = T.hair(31); hair = dict(base=T.shrink(c, sz), normal=T.shrink(n, sz), orm=T.shrink(o, sz))
    base = {m.name: m for m in BH.materials(quick)}
    return [Material('coat', factor=(1, 1, 1, 1), metal=1.0, rough=1.0, texkey='hair', **hair),
            Material('feather', factor=(1, 1, 1, 1), metal=1.0, rough=1.0, texkey='hair', **hair, double_sided=True),
            Material('beak', factor=(1, 1, 1, 1), metal=1.0, rough=0.6, texkey='hair', **hair),
            Material('claw', factor=(0.06, 0.05, 0.05, 1), metal=0.0, rough=0.45),
            Material('glow', factor=(0.2, 0.1, 0.02, 1), metal=0.0, rough=0.4, emissive=(1.0, 0.75, 0.15)),
            base['leather'],
            Material('cloth', base=base['cloth'].base, normal=base['cloth'].normal, orm=base['cloth'].orm, factor=(2.3, 0.5, 0.45, 1), metal=1.0, rough=1.0, texkey='cloth', double_sided=True)]

if __name__ == '__main__':
    out = sys.argv[1]; quick = '--quick' in sys.argv
    ms = mats(quick)
    extras = {'korvalune': {'type': 'mount', 'kind': 'griffon', 'seat': 0.40, 'recolor': {'coat': 'body', 'feather': 'feather', 'beak': 'beak'}, 'recolorGain': 1.25,
                            'note': 'griffon monture volante ; clips idle/walk/run/fly/glide ; matériaux teintables coat/feather/beak'}}
    used = [m for m in ms if any(p[2] == m.name for p in G.parts)]
    write_glb(out, G.parts, G.SK, used, A.build(), extras=extras, mesh_name='Griffon', tex_dir=os.path.join(os.path.dirname(out), 'tex'))
    print(sum(len(m.F) for _, m, _ in G.parts), 'tri', os.path.getsize(out) // 1024, 'Ko')
