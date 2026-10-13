"""Empaquette models_proto/<dossiers> en une arborescence PLATE prête pour le jeu : <out>/*.glb + <out>/tex/*.
Le chargeur (ModelLibrary) lit /models/index.json (liste plate) ; toutes les textures sont référencées en « tex/<nom> ».
Usage : python3 package_models.py <models_proto> <out> [--only dossier,dossier]   (aucun fichier source modifié)"""
import sys, os, struct, json, shutil, hashlib

def rewrite(d, fn, dmap, vmap):
    jl = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + jl]); n = 0
    for im in j.get('images', []):
        if 'uri' in im:
            b = im['uri'].rsplit('/', 1)[-1]; m = vmap if im['uri'].startswith('../veilleur') else dmap
            u = 'tex/' + m.get(b, b)
            if u != im['uri']: im['uri'] = u; n += 1
    jb = json.dumps(j, separators=(',', ':')).encode(); jb += b' ' * (-len(jb) % 4)
    rest = d[20 + jl:]
    return d[:8] + struct.pack('<I', 20 + len(jb) + len(rest)) + struct.pack('<I', len(jb)) + b'JSON' + jb + rest, j

def main(src, out, only=None):
    shutil.rmtree(out, ignore_errors=True); os.makedirs(os.path.join(out, 'tex'))
    seen = {}; tex = {}; total = 0; missing = []; maps = {}
    def put(dname, tdir):
        mp = maps.setdefault(dname, {})
        for f in os.listdir(tdir):
            data = open(os.path.join(tdir, f), 'rb').read(); h = hashlib.md5(data).hexdigest()
            name = f
            if name in tex and tex[name] != h: name = h[:6] + '_' + f   # homonyme au contenu différent
            tex[name] = h; mp[f] = name
            open(os.path.join(out, 'tex', name), 'wb').write(data)
    for dname in sorted(os.listdir(src)):
        dp = os.path.join(src, dname)
        if os.path.isdir(dp) and os.path.isdir(os.path.join(dp, 'tex')) and (not only or dname in only or dname == 'veilleur'):
            put(dname, os.path.join(dp, 'tex'))
    for r, _, fs in os.walk(src):
        rel = os.path.relpath(r, src).split(os.sep)[0]
        if only and rel not in only and rel != '.': continue
        for f in sorted(fs):
            if not f.endswith('.glb'): continue
            if f in seen: raise SystemExit(f'nom de fichier en double : {f}')
            seen[f] = 1
            dn = os.path.relpath(r, src).split(os.sep)[0]
            data, j = rewrite(open(os.path.join(r, f), 'rb').read(), f, maps.get(dn, {}), maps.get('veilleur', {}))
            for im in j.get('images', []):
                if 'uri' in im and not os.path.exists(os.path.join(out, im['uri'])): missing.append((f, im['uri']))
            open(os.path.join(out, f), 'wb').write(data); total += len(data)
    json.dump({'files': sorted(seen), 'mapping': {}}, open(os.path.join(out, 'index.json'), 'w'))
    tsz = sum(os.path.getsize(os.path.join(out, 'tex', f)) for f in os.listdir(os.path.join(out, 'tex')))
    print(f'{len(seen)} GLB ({total // 1024} Ko) + {len(os.listdir(os.path.join(out, "tex")))} textures ({tsz // 1024} Ko) -> {out}')
    if missing: raise SystemExit(f'textures manquantes : {missing[:5]} (+{len(missing)})')

if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    only = None
    if '--only' in sys.argv: only = sys.argv[sys.argv.index('--only') + 1].split(',')
    main(a[0], a[1], only)
