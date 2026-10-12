import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
import wolf_geo as G, wolf_anim as A, textures as T

def materials(quick=False):
    sz = 256 if quick else 1024
    def prep(fn, sizes):
        c, n, o, h = fn()
        sb, sn, so = (256,) * 3 if quick else sizes
        f = lambda a, s: a if s == 1024 else T.shrink(a, s)
        return f(c, sb), f(n, sn), f(o, so)
    c, n, o = prep(T.fur, (1024, 512, 512)); fur = Material('fur', base=c, normal=n, orm=o, metal=1.0, rough=1.0, normal_scale=0.8)
    c, n, o = prep(T.bone, (512, 512, 512)); bone = Material('bone', base=c, normal=n, orm=o, metal=1.0, rough=1.0)
    glow = Material('glow', factor=(0.2, 0.1, 0.02, 1), metal=0.0, rough=0.4, emissive=(1.0, 0.55, 0.08))
    return [fur, bone, glow]

if __name__ == '__main__':
    out = sys.argv[1]
    st = write_glb(out, G.parts, G.SK, materials('--quick' in sys.argv), A.build())
    print(st, os.path.getsize(out))
