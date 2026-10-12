"""Exporte le Veilleur en pièces séparées : corps animé + une pièce d'équipement par emplacement (même squelette, mêmes os),
textures partagées dans un dossier tex/. Le moteur assemble : corps (animations) + pièces liées à son squelette.

  python3 tools/models/export_modular.py public/models_proto/veilleur
"""
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
import hero_geo as G, hero_anim as A, build_hero as BH

SLOTS = {
    'casque': r'^(crane|casque_|joue|nuque|bec|oeil_|croissant)',
    'epaules': r'^(epaule|plume)',
    'torse': r'^(plastron|arete|medaillon|dos|lame\d|ceinture|boucle|gorgerin)',
    'bras': r'^(brassard|cubitiere|bracelet|gantelet)',
    'jambes': r'^(faulde|cuissard|genouillere|jambiere|mollet|botte_revers|botte_pointe)',
    'cape': r'^cape',
}
BODY = r'^(torse$|cou|bras(_R)?$|jambe(_R)?$|main(_R)?$|botte(_R)?$)'

def slot_of(name):
    if re.match(BODY, name): return 'corps'
    for s, rx in SLOTS.items():
        if re.match(rx, name): return s
    return None

if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    mats = BH.materials('--quick' in sys.argv)
    groups = {}
    for n, m, mat in G.parts:
        s = slot_of(n)
        assert s, 'pièce sans emplacement : ' + n
        groups.setdefault(s, []).append((n, m, mat))
    tex = os.path.join(out, 'tex')
    anims = A.build()
    report = {}
    for slot, parts in groups.items():
        used = {p[2] for p in parts}
        ms = [m for m in mats if m.name in used or (m.name == 'cloak' and 'cloak' in used)]
        extras = {'korvalune': {'type': 'body' if slot == 'corps' else 'armor', 'slot': slot, 'skeleton': 'veilleur', 'note': 'même squelette que le corps ; lier chaque SkinnedMesh au squelette du corps'}}
        if slot == 'corps': extras['korvalune']['refHeight'] = round(max(float(m.V[:, 1].max()) for _, m, _ in G.parts), 3)
        fn = os.path.join(out, f'veilleur_{slot}.glb')
        st = write_glb(fn, parts, G.SK, ms, anims if slot == 'corps' else {}, extras=extras, tex_dir=tex, mesh_name=slot)
        report[slot] = (os.path.getsize(fn), sum(v[1] for v in st.values()))
    for s, (b, t) in report.items(): print(f'{s:8s} {b/1024:7.0f} Ko  {t:6d} triangles')
    tot = sum(os.path.getsize(os.path.join(tex, f)) for f in os.listdir(tex))
    print('textures partagées :', len(os.listdir(tex)), 'fichiers', f'{tot/1e6:.2f} Mo')
