import sys, os, json, struct
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
import foe_geo as F, hero_anim as A, build_hero as BH, textures as T, build_weapons as BW
from lod import cluster_decimate

def patch_uris(path, old, new):
    d = open(path, 'rb').read()
    jl = struct.unpack('<I', d[12:16])[0]
    js = d[20:20 + jl].decode().replace(f'"uri":"{old}', f'"uri":"{new}').replace(f'"uri": "{old}', f'"uri": "{new}')
    jb = js.encode(); jb += b' ' * (-len(jb) % 4)
    rest = d[20 + jl:]
    out = d[:8] + struct.pack('<I', 12 + 8 + len(jb) + len(rest)) + struct.pack('<I', len(jb)) + b'JSON' + jb + rest
    open(path, 'wb').write(out)

def mats_for(meta, quick, base):
    ms = {m.name: m for m in base}
    c, n, o, h = T.skin(11, meta['skin'], meta['warty'])
    sz = 256 if quick else 512
    ms['hide'] = Material('hide', base=T.shrink(c, sz), normal=T.shrink(n, 256), orm=T.shrink(o, 256), metal=1.0, rough=1.0, texkey='skin_%02d%02d%02d_%d' % tuple(list((np.array(meta['skin']) * 100).astype(int)) + [int(meta['warty'] * 10)]))
    bc, bn, bo, bh = T.bone()
    ms['bone'] = Material('bone', base=T.shrink(bc, 256), normal=T.shrink(bn, 256), orm=T.shrink(bo, 256), metal=1.0, rough=1.0)
    ms['dark'] = Material('dark', factor=(0.02, 0.015, 0.015, 1), metal=0.0, rough=0.8)
    lc = ms['cloth']
    ms['linen'] = Material('linen', base=lc.base, normal=lc.normal, orm=lc.orm, factor=(2.1, 1.75, 1.25, 1), metal=1.0, rough=1.0, texkey='cloth')
    ms['eye'] = Material('eye', factor=(0.1, 0.06, 0.0, 1), metal=0.0, rough=0.3, emissive=meta.get('eye', (0.35, 0.3, 0.2)))
    return ms

if __name__ == '__main__':
    out = sys.argv[1]; names = [a for a in sys.argv[2:] if not a.startswith('--')] or list(F.V)
    quick = '--quick' in sys.argv
    os.makedirs(out, exist_ok=True)
    base = BH.materials(quick)
    bm = {m.name: m for m in base}; st, lt = bm['steel'], bm['leather']
    base += [Material('blade', base=st.base, normal=st.normal, orm=st.orm, factor=(3.2, 3.3, 3.7, 1), metal=1.0, rough=0.5, texkey='steel'),
             Material('wood', base=lt.base, normal=lt.normal, orm=lt.orm, factor=(0.62, 0.5, 0.42, 1), metal=1.0, rough=1.0, texkey='leather'),
             Material('cord', base=lt.base, normal=lt.normal, orm=lt.orm, factor=(1.6, 1.5, 1.35, 1), metal=1.0, rough=1.0, texkey='leather')]
    anims0 = A.build()
    for name in names:
        parts, SK, meta = F.build(name)
        cell = meta['decimate'] or 0.035
        parts = [(n, cluster_decimate(m, cell) if len(m.F) > 400 else m, mat) for n, m, mat in parts]
        ms = mats_for(meta, quick, base)
        used = [ms[k] for k in dict.fromkeys(p[2] for p in parts)]
        sc = meta['scale']
        anims = {}
        for an, a in anims0.items():
            ch = {}
            for b, c in a['channels'].items():
                ch[b] = {'rot': c.get('rot'), 'pos': None if c.get('pos') is None else np.asarray(c['pos']) * sc}
            anims[an] = {**a, 'channels': ch}
        extras = {'korvalune': {'type': 'body', 'skeleton': 'veilleur_foe_' + name, 'species': name, 'refHeight': meta['refHeight'], 'note': 'ennemi humanoïde ; squelette du Veilleur mis à l\'échelle, armes cuites dans le maillage'}}
        fn = os.path.join(out, f'ennemi_{name}.glb')
        write_glb(fn, parts, SK, used, anims, extras=extras, mesh_name=name, tex_dir=os.path.join(out, 'tex'))
        for pre in ('steel_', 'leather_', 'cloth_', 'trim_'): patch_uris(fn, 'tex/' + pre, '../veilleur/tex/' + pre)
        print(name, sum(len(m.F) for _, m, _ in parts), 'tri', os.path.getsize(fn) // 1024, 'Ko')

    # textures communes déjà présentes dans veilleur/tex : on supprime les doublons
    td = os.path.join(out, 'tex'); vt = os.path.join(os.path.dirname(os.path.normpath(out)), 'veilleur', 'tex')
    for f in os.listdir(td):
        if f.startswith(('steel_', 'leather_', 'cloth_', 'trim_')):
            assert open(os.path.join(td, f), 'rb').read() == open(os.path.join(vt, f), 'rb').read(), 'texture différente : ' + f
            os.remove(os.path.join(td, f))
