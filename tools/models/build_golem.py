"""Golem de cristal (niveau 10) : convertit le modèle statique fourni (Corvalune_Golem_Cristal_Niveau_10.glb, Z vers le haut, sans squelette)
en ennemi humanoïde animé : redressé (Y vers le haut, face à +Z), ramené à 1,8 m, chaque pièce liée rigidement à l'os du squelette du Veilleur
le plus proche de son rôle ; il hérite ainsi des animations marche / course / attaque / coup reçu / mort.
Usage : python3 build_golem.py <source.glb> <dossier_de_sortie>"""
import sys, os, json, struct
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
import hero_geo as G, hero_anim as A
import golem_tex as GT

B = G.B


def read_glb(path):
    d = open(path, 'rb').read()
    jl = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + jl])
    bl = struct.unpack('<I', d[20 + jl:24 + jl])[0]; blob = d[28 + jl:28 + jl + bl]
    def acc(i):
        a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]
        dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[a['componentType']]
        n = {'SCALAR': 1, 'VEC3': 3}[a['type']]
        off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        return np.frombuffer(blob, dt, a['count'] * n, off).reshape(-1, n).astype(np.float64 if dt == np.float32 else np.int64)
    out = []
    for node in j['nodes']:
        if 'mesh' not in node: continue
        p = j['meshes'][node['mesh']]['primitives'][0]
        out.append((node['name'], acc(p['attributes']['POSITION']), acc(p['indices']).reshape(-1, 3), p['material']))
    return out, j['materials']


def upright(V):            # (x, y, z) Z-haut -> Y-haut, face à +Z
    return np.stack([V[:, 0], V[:, 2], -V[:, 1]], 1)


def unweld(V, F):
    return V[F.reshape(-1)], np.arange(len(F) * 3).reshape(-1, 3)


FLAT = ('Armor_Crystal', 'Embedded_Shard', 'Knuckle_Crystal', 'Gem', 'Forehead', 'Chest_Core', 'Rib_', 'Back_Spike', 'EyeSocket')


def box_uv(V, F, tile=0.9):
    """Projection triplanaire « par boîte » (une face = un axe dominant), en mètres ; V doit être dé-soudé."""
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    ax = np.abs(fn).argmax(1)
    UV = np.zeros((len(V), 2))
    for a, (i, j) in enumerate(((1, 2), (0, 2), (0, 1))):
        fs = F[ax == a].reshape(-1)
        UV[fs, 0] = V[fs, i] / tile; UV[fs, 1] = V[fs, j] / tile
    return UV


def swapLR(n):             # le modèle nomme « gauche » ce qui est du côté -X ; le squelette du Veilleur a sa gauche en +X
    if n.endswith('_L') or '_L_' in n: return n.replace('_L', '_R')
    if n.endswith('_R') or '_R_' in n: return n.replace('_R', '_L')
    return n


def bone_of(name):
    n = swapLR(name)
    s = '_L' if ('_L' in n) else '_R' if ('_R' in n) else ''
    if name.startswith(('Torso_Core', 'Chest_Plate', 'Chest_Core', 'Rib_', 'Back_Spike')): return 'Chest'
    if name.startswith('Abdomen'): return 'Spine'
    if name.startswith('Pelvis'): return 'Hips'
    if name.startswith('Neck'): return 'Neck'
    if name.startswith(('Head', 'Jaw', 'EyeSocket', 'Glowing_Eye', 'Forehead')): return 'Head'
    if name.startswith('Shoulder'): return 'Shoulder' + s
    if name.startswith('UpperArm'): return 'UpperArm' + s
    if name.startswith(('Elbow', 'Forearm')): return 'LowerArm' + s
    if name.startswith(('Fist', 'Knuckle_Crystal')): return 'Hand' + s
    if name.startswith('Thigh'): return 'UpperLeg' + s
    if name.startswith(('Knee', 'Shin')): return 'LowerLeg' + s
    if name.startswith('Foot'): return 'Foot' + s
    return None            # cristaux d'armure et éclats : os le plus proche


def main(src, out):
    meshes, mats = read_glb(src)
    tr = [(n, upright(V), F, m) for n, V, F, m in meshes]
    zmin = min(V[:, 1].min() for _, V, _, _ in tr); zmax = max(V[:, 1].max() for _, V, _, _ in tr)
    k = 1.8 / (zmax - zmin)
    tr = [(n, (V - np.array([0, zmin, 0])) * k, F, m) for n, V, F, m in tr]
    by = {n: V for n, V, _, _ in tr}
    ctr = lambda n: (by[n].min(0) + by[n].max(0)) / 2
    # joints
    pos = {n: np.array(p, float) for n, p in zip(G.SK.names, G.SK.pos)}
    pos['Hips'] = ctr('Pelvis'); pos['Spine'] = ctr('Abdomen'); pos['Chest'] = ctr('Chest_Plate')
    nk = ctr('Neck'); pos['Neck'] = np.array([0, by['Neck'][:, 1].min(), nk[2]]); pos['Head'] = np.array([0, by['Head'][:, 1].min() + 0.02, ctr('Head')[2]])
    for sd, src_s in (('L', 'R'), ('R', 'L')):      # côté du squelette <- côté inverse du modèle
        sh = ctr(f'Shoulder_{src_s}'); pos[f'Shoulder_{sd}'] = sh * [0.55, 1, 1]
        pos[f'UpperArm_{sd}'] = sh
        el = ctr(f'Elbow_{src_s}'); pos[f'LowerArm_{sd}'] = el
        fv = by[f'Fist_{src_s}']; pos[f'Hand_{sd}'] = np.array([ctr(f'Fist_{src_s}')[0], fv[:, 1].max() - 0.02, ctr(f'Fist_{src_s}')[2]])
        th = by[f'Thigh_{src_s}']; pos[f'UpperLeg_{sd}'] = np.array([ctr(f'Thigh_{src_s}')[0], th[:, 1].max() - 0.04, ctr(f'Thigh_{src_s}')[2]])
        pos[f'LowerLeg_{sd}'] = ctr(f'Knee_{src_s}')
        fo = by[f'Foot_{src_s}']; pos[f'Foot_{sd}'] = np.array([ctr(f'Foot_{src_s}')[0], fo[:, 1].max() - 0.05, ctr(f'Foot_{src_s}')[2] - 0.05])
        pos[f'Toe_{sd}'] = np.array([ctr(f'Foot_{src_s}')[0], fo[:, 1].min() + 0.03, fo[:, 2].max() - 0.05])
    for i, n in enumerate(('Cape_1', 'Cape_2', 'Cape_3')): pos[n] = pos['Chest'] + np.array([0, -0.2 * i, -0.2])
    pos['Socket_Weapon_R'] = pos['Hand_R']; pos['Socket_Back'] = pos['Chest'] + np.array([0, 0, -0.3])
    pos['Root'] = np.zeros(3)
    SK = G.SK.__class__()
    for n, par, _ in zip(G.SK.names, G.SK.parents, range(len(G.SK.names))):
        SK.add(n, None if par < 0 else G.SK.names[par], pos[n])
    # attribution
    cent = {}
    assigned = {}
    for n, V, F, m in tr:
        b = bone_of(n)
        if b: assigned[n] = b; cent.setdefault(b, []).append(V.mean(0))
    rep = {b: np.mean(v, 0) for b, v in cent.items()}
    for n, V, F, m in tr:
        if n in assigned: continue
        c = V.mean(0)
        assigned[n] = min(rep, key=lambda b: np.linalg.norm(rep[b] - c) if b not in ('Neck', 'Hips') else 9)
    # matériaux du fichier
    M = {}
    for i, mt in enumerate(mats):
        pb = mt['pbrMetallicRoughness']; em = tuple(mt.get('emissiveFactor', (0, 0, 0)))
        M[i] = Material(mt['name'].replace(' ', '_'), factor=tuple(pb['baseColorFactor']), metal=pb['metallicFactor'], rough=pb['roughnessFactor'], emissive=em)
    sb, sn, so, se = GT.stone(); cb, cn, co, ce = GT.crystal()
    for i, mt in enumerate(mats):
        nm = mt['name']
        if nm in ('Obsidian_Stone', 'Dark_Granite', 'Obsidian Stone', 'Dark Granite'):
            M[i] = Material(nm.replace(' ', '_'), base=sb, normal=sn, orm=so, emissive=(1, 1, 1), emissive_tex=se, metal=1.0, rough=1.0,
                            normal_scale=1.6, texkey='golem_stone', base_fmt='JPEG')
            M[i].tex = True
        elif 'Crystal' in nm or 'Glow' in nm:
            M[i] = Material(nm.replace(' ', '_'), base=cb, normal=cn, orm=co, emissive=(1, 1, 1), emissive_tex=ce, metal=1.0, rough=1.0,
                            normal_scale=0.8, texkey='golem_crystal', base_fmt='JPEG')
            M[i].tex = True
    parts = []
    for n, V, F, mi in tr:
        tx = getattr(M[mi], 'tex', False)
        if n.startswith(FLAT) or tx: V, F = unweld(V, F)
        m = Mesh(V, F)
        if tx:
            m.UV = box_uv(V, F, 0.9 if 'stone' in M[mi].texkey else 0.5)
        skin_rigid(m, B[assigned[n]])
        parts.append((n, m, M[mi].name))
    used = [M[i] for i in sorted({mi for _, _, _, mi in tr})]
    anims = A.build()
    h = zmax - zmin
    extras = {'korvalune': {'type': 'body', 'skeleton': 'veilleur_foe_golem', 'species': 'golem', 'refHeight': 1.8, 'note': 'Golem de cristal (modèle fourni, converti : squelette du Veilleur, animations héritées)'}}
    os.makedirs(out, exist_ok=True)
    fn = os.path.join(out, 'ennemi_golem.glb')
    write_glb(fn, parts, SK, used, anims, extras=extras, mesh_name='golem', tex_dir=os.path.join(out, 'tex'))
    print('golem', sum(len(m.F) for _, m, _ in parts), 'tri', os.path.getsize(fn) // 1024, 'Ko', 'hauteur source', round(h, 2), '->1.8')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
