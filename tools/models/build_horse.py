import sys, os, copy
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
import horse_geo as H, wolf_anim as A, textures as T
import build_hero as BH

def mats(quick):
    sz = 256 if quick else 512
    c, n, o, h = T.hair(); hair = dict(base=T.shrink(c, sz), normal=T.shrink(n, sz), orm=T.shrink(o, sz))
    base = {m.name: m for m in BH.materials(quick)}
    bc, bn, bo, bh = T.bone()
    return [Material('coat', factor=(1, 1, 1, 1), metal=1.0, rough=1.0, texkey='hair', **hair),
            Material('mane', factor=(1, 1, 1, 1), metal=1.0, rough=1.0, texkey='hair', **hair, double_sided=True),
            base['leather'], base['trim'],
            Material('cloth', base=base['cloth'].base, normal=base['cloth'].normal, orm=base['cloth'].orm, factor=(2.3, 0.5, 0.45, 1), metal=1.0, rough=1.0, texkey='cloth', double_sided=True),
            Material('dark', factor=(0.03, 0.025, 0.025, 1), metal=0.0, rough=0.5),
            Material('hoof', base=T.shrink(bc, 256), normal=T.shrink(bn, 256), orm=T.shrink(bo, 256), factor=(0.35, 0.3, 0.28, 1), metal=1.0, rough=1.0, texkey='bone')]

if __name__ == '__main__':
    out = sys.argv[1]
    quick = '--quick' in sys.argv
    ms = mats(quick)
    anims0 = A.build(); anims = {}
    sc = np.array([1.0, 1.8, 1.8])
    for an in ('idle', 'walk', 'run'):
        a = anims0[an]; ch = {}
        for b, c in a['channels'].items():
            ch[b] = {'rot': c.get('rot'), 'pos': None if c.get('pos') is None else np.asarray(c['pos']) * sc}
        anims[an] = {**a, 'channels': ch}
    extras = {'korvalune': {'type': 'mount', 'kind': 'horse', 'seat': 0.62, 'recolor': {'coat': 'body', 'mane': 'mane'}, 'recolorGain': 1.25, 'note': 'cheval de selle, robe blanche neutre à teinter ; assise du cavalier : y du pied du cavalier dans le repère du fichier'}}
    used = [m for m in ms if any(p[2] == m.name for p in H.parts)]
    write_glb(out, H.parts, H.SK, used, anims, extras=extras, mesh_name='Cheval', tex_dir=os.path.join(os.path.dirname(out), 'tex'))
    print(sum(len(m.F) for _, m, _ in H.parts), 'tri', os.path.getsize(out) // 1024, 'Ko')
