"""Construit les GLB des boss mondiaux. Usage : python3 build_bosses.py <dossier_sortie> [ids…]"""
import sys, os, importlib
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
from boss_rig import build_clips

BOSSES = {
    'scarecrow': ('boss_scarecrow', 'wb_scarecrow', 'Épouvantail Moissonneur'),
    'antler': ('boss_antler', 'wb_antler', 'Roi-Cerf des Ombres'),
    'forgeron': ('boss_forgeron', 'wb_forgeron', 'Colosse Forgeron'),
    'sphinx': ('boss_sphinx', 'wb_sphinx', 'Sphinx-Scorpion'),
    'toad': ('boss_toad', 'wb_toad', 'Gobe-Lanterne'),
    'mammoth': ('boss_mammoth', 'wb_mammoth', 'Mammouth de Givre'),
    'cathedral': ('boss_cathedral', 'wb_cathedral', 'Prélat de Chair'),
    'seraph': ('boss_seraph', 'wb_seraph', 'Séraphin Brisé'),
    'ember': ('boss_ember', 'wb_ember', 'Seigneur de Braise'),
    'eye': ('boss_eye', 'wb_eye', 'Œil du Néant'),
}


def main(out, ids):
    os.makedirs(out, exist_ok=True)
    for bid in ids:
        modn, species, title = BOSSES[bid]
        M = importlib.import_module(modn)
        R, H = M.build()
        mats = M.mats()
        used_names = sorted({m for _, _, m in R.parts})
        used = [mats[n] for n in used_names]
        import numpy as _np
        ys = _np.concatenate([m.V[:, 1] for _, m, _ in R.parts]); H = float(ys.max() - min(0.0, ys.min()))
        clips = build_clips(M.pose_fns())
        extras = {'korvalune': {'type': 'creature', 'species': species, 'refHeight': H, 'note': title}}
        fn = os.path.join(out, species + '.glb')
        write_glb(fn, R.parts, R.SK, used, clips, extras=extras, mesh_name=species, tex_dir=os.path.join(out, 'tex'))
        print(bid, R.tris(), 'tri', os.path.getsize(fn) // 1024, 'Ko')


if __name__ == '__main__':
    ids = [a for a in sys.argv[2:] if not a.startswith('--')] or list(BOSSES)
    main(sys.argv[1], ids)
