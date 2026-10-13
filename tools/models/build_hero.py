import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from glbkit import *
import hero_geo as G
import hero_anim as A
import textures as T

def materials(quick=False):
    mats = []
    size = 256 if quick else 1024
    SIZES = {'steel': (1024, 512, 512), 'leather': (512, 512, 512), 'cloth': (512, 512, 512), 'trim': (1024, 512, 512)}
    def mk(name, fn, **kw):
        c, n, o, h = fn()
        sb, sn, so = (256, 256, 256) if quick else SIZES[name]
        c, n, o = (c if sb == 1024 else T.shrink(c, sb)), (n if sn == 1024 else T.shrink(n, sn)), (o if so == 1024 else T.shrink(o, so))
        return Material(name, base=c, normal=n, orm=o, **kw)
    mats.append(mk('steel', T.steel, metal=1.0, rough=1.0, normal_scale=1.0))
    mats.append(mk('leather', T.leather, metal=1.0, rough=1.0))
    mats.append(mk('cloth', T.cloth, metal=1.0, rough=1.0))
    mats.append(mk('trim', T.trim, metal=1.0, rough=1.0))
    cl = [m for m in mats if m.name == 'cloth'][0]
    mats.append(Material('cloak', base=cl.base, normal=cl.normal, orm=cl.orm, factor=(2.6, 0.95, 1.5, 1), metal=1.0, rough=1.0, double_sided=True, texkey='cloth'))
    mats.append(Material('glow', factor=(0.05, 0.03, 0.12, 1), metal=0.0, rough=0.4, emissive=(0.38, 0.22, 1.0)))
    return mats

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/rt/hero_test.glb'
    quick = '--quick' in sys.argv
    mats = materials(quick)
    names = {m.name for m in mats}
    parts = [(n, m, mat) for n, m, mat in G.parts]
    st = write_glb(out, parts, G.SK, mats, A.build() if '--noanim' not in sys.argv else {})
    print(st, os.path.getsize(out))
