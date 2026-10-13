import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
import sword_geo as G, textures as T

def mats(quick):
    f = lambda a, s: a if s == 1024 else T.shrink(a, s)
    sz = lambda s: 256 if quick else s
    out = {}
    for name, fn, sizes in (('steel', T.steel, (512, 256, 256)), ('leather', T.leather, (256, 256, 256)), ('trim', T.trim, (512, 256, 256))):
        c, n, o, h = fn()
        out[name] = Material(name, base=f(c, sz(sizes[0])), normal=f(n, sz(sizes[1])), orm=f(o, sz(sizes[2])), metal=1.0, rough=1.0)
    st = out['steel']
    blade = Material('blade', base=st.base, normal=st.normal, orm=st.orm, factor=(3.2, 3.3, 3.7, 1), metal=1.0, rough=0.5, texkey='steel')
    glow = Material('glow', factor=(0.1, 0.06, 0.25, 1), metal=0.0, rough=0.2, emissive=(0.45, 0.3, 1.0))
    return [out['steel'], out['leather'], out['trim'], blade, glow]

if __name__ == '__main__':
    out = sys.argv[1]
    extras = {'korvalune': {'type': 'weapon', 'id': 'lame_de_la_veille', 'visual': 'sword', 'attach': {'socket': 'Socket_Weapon_R', 'quat': [0.5, 0.5, 0.5, 0.5], 'offset': [0, 0, 0]},
                            'note': 'origine = centre de la poignée ; lame vers +Y ; la quaternion oriente la lame vers l\'avant, tranchants en haut/bas'}}
    st = write_glb(out, G.parts, None, mats('--quick' in sys.argv), {}, extras=extras, mesh_name='Epee')
    print(st, os.path.getsize(out))
