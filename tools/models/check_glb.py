"""Vérifie un fichier .glb de manière indépendante du moteur : structure, accessors, skin, animations, dimensions."""
import sys, json, struct
import numpy as np

def load(path):
    d = open(path, 'rb').read()
    magic, ver, total = struct.unpack('<4sII', d[:12])
    assert magic == b'glTF' and ver == 2 and total == len(d), 'en-tête GLB invalide'
    off = 12; js = None; bn = None
    while off < len(d):
        ln, ty = struct.unpack('<I4s', d[off:off + 8]); body = d[off + 8:off + 8 + ln]; off += 8 + ln
        if ty == b'JSON': js = json.loads(body)
        elif ty.startswith(b'BIN'): bn = body
    return js, bn

CT = {5126: ('<f4', 4), 5123: ('<u2', 2), 5125: ('<u4', 4), 5121: ('u1', 1)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def acc(js, bn, i):
    a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
    dt, sz = CT[a['componentType']]; n = a['count'] * NC[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.frombuffer(bn, dtype=dt, count=n, offset=off).reshape(a['count'], NC[a['type']])

def main(path):
    js, bn = load(path)
    ok = True
    def chk(c, msg):
        nonlocal ok
        print(('  OK  ' if c else '  ÉCHEC ') + msg); ok &= bool(c)
    print(path, f'{len(open(path,"rb").read())/1e6:.2f} Mo')
    chk(js['asset']['version'] == '2.0', 'glTF 2.0')
    chk(len(bn) == js['buffers'][0]['byteLength'], 'taille du tampon binaire cohérente')
    tris = 0; verts = 0
    allpos = []
    nb = len(js['skins'][0]['joints'])
    for mi, m in enumerate(js['meshes']):
        for p in m['primitives']:
            pos = acc(js, bn, p['attributes']['POSITION']); idx = acc(js, bn, p['indices']).reshape(-1)
            nrm = acc(js, bn, p['attributes']['NORMAL']); uv = acc(js, bn, p['attributes']['TEXCOORD_0'])
            jt = acc(js, bn, p['attributes']['JOINTS_0']); wt = acc(js, bn, p['attributes']['WEIGHTS_0'])
            verts += len(pos); tris += len(idx) // 3; allpos.append(pos)
            chk(idx.max() < len(pos), f"{js['materials'][p['material']]['name']}: indices valides")
            chk(np.isfinite(pos).all() and np.isfinite(nrm).all() and np.isfinite(uv).all(), f"  valeurs finies")
            chk(abs(np.linalg.norm(nrm, axis=1) - 1).max() < 1e-3, '  normales unitaires')
            chk(jt.max() < nb, '  indices d\'os valides')
            chk(abs(wt.sum(axis=1) - 1).max() < 1e-3, '  poids normalisés (somme = 1)')
            jmin = acc(js, bn, p['attributes']['POSITION']); a = js['accessors'][p['attributes']['POSITION']]
            chk(np.allclose(a['min'], pos.min(axis=0), atol=1e-5) and np.allclose(a['max'], pos.max(axis=0), atol=1e-5), '  min/max POSITION exacts')
    P = np.vstack(allpos)
    print(f'  {verts} sommets, {tris} triangles, {nb} os, {len(js["materials"])} matériaux, {len(js.get("images",[]))} images')
    print(f'  boîte : x[{P[:,0].min():.3f},{P[:,0].max():.3f}] y[{P[:,1].min():.3f},{P[:,1].max():.3f}] z[{P[:,2].min():.3f},{P[:,2].max():.3f}]')
    chk(abs(P[:, 1].min()) < 0.03, 'pieds au sol (y min ≈ 0)')
    chk(1.7 < P[:, 1].max() < 2.0, 'taille humaine (1,7–2,0 m)')
    chk(abs(P[:, 0].min() + P[:, 0].max()) < 0.04, 'centré en X (pivot à l\'axe du corps)')
    ibm = acc(js, bn, js['skins'][0]['inverseBindMatrices']).reshape(-1, 4, 4)
    chk(len(ibm) == nb and np.isfinite(ibm).all(), 'matrices de repos inverses valides')
    names = [js['nodes'][j]['name'] for j in js['skins'][0]['joints']]
    print('  os :', ', '.join(names))
    for an in js.get('animations', []):
        T = acc(js, bn, an['samplers'][0]['input']); dur = float(T.max())
        okq = True
        for ch in an['channels']:
            out = acc(js, bn, an['samplers'][ch['sampler']]['output'])
            okq &= np.isfinite(out).all()
            if ch['target']['path'] == 'rotation': okq &= abs(np.linalg.norm(out, axis=1) - 1).max() < 1e-3
        chk(okq, f"animation « {an['name']} » : {dur:.2f} s, {len(an['channels'])} canaux")
    for t in js.get('images', []):
        pass
    print('RÉSULTAT :', 'tout est valide' if ok else 'ERREURS')
    return ok

if __name__ == '__main__':
    sys.exit(0 if main(sys.argv[1]) else 1)
