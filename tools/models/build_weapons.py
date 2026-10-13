import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
import weapons_geo as W, textures as T
import build_sword as BS

def qx(deg): h = math.radians(deg) / 2; return [round(math.sin(h), 6), 0, 0, round(math.cos(h), 6)]
def qy(deg): h = math.radians(deg) / 2; return [0, round(math.sin(h), 6), 0, round(math.cos(h), 6)]
def qz(deg): h = math.radians(deg) / 2; return [0, 0, round(math.sin(h), 6), round(math.cos(h), 6)]
SWORD_Q = [0.5, 0.5, 0.5, 0.5]
HAND_R = [-0.017, -0.072, 0.03]; HAND_L = [0.017, -0.072, 0.03]

def mats(quick):
    ms = {m.name: m for m in BS.mats(quick)}
    lt = ms['leather']
    ms['wood'] = Material('wood', base=lt.base, normal=lt.normal, orm=lt.orm, factor=(0.62, 0.5, 0.42, 1), metal=1.0, rough=1.0, texkey='leather')
    ms['cord'] = Material('cord', base=lt.base, normal=lt.normal, orm=lt.orm, factor=(1.6, 1.5, 1.35, 1), metal=1.0, rough=1.0, texkey='leather')
    return ms

ITEMS = {
  # id: (fonction, visual, mesh_name, socket, quat, offset, description)
  'dague_du_veilleur':  (W.dagger, 'dagger',    'Dague',      'Socket_Weapon_R', SWORD_Q, [0, 0, 0], 'main droite, lame vers l\'avant'),
  'dague_gauche':       (W.dagger, 'offdagger', 'DagueG',     'Hand_L',          SWORD_Q, HAND_L, 'main gauche (objet secondaire)'),
  'baton_de_la_veille': (W.staff,  'staff',     'Baton',      'Socket_Weapon_R', qx(55),  [0, 0, 0], 'main droite, incliné vers l\'avant (la prise de la main est horizontale)'),
  'arc_de_la_veille':   (W.bow,    'bow',       'Arc',        'Hand_L',          qx(20),  HAND_L, 'main gauche, corde vers l\'archer'),
  'ecu_de_la_veille':   (W.shield, 'shield',    'Bouclier',   'LowerArm_L',      qy(50),  [0.038, -0.134, 0.12], 'sanglé à l\'avant-bras gauche, face vers l\'avant-extérieur'),
  'orbe_de_la_veille':  (W.orb,    'orb',       'Orbe',       'Hand_L',          [0, 0, 0, 1], [0.017, -0.01, 0.05], 'cristal tenu dans la main gauche'),
  'carquois':           (W.quiver, 'quiver',    'Carquois',   'Socket_Back',     qz(20),  [-0.11, -0.12, -0.06], 'dans le dos, penché vers l\'épaule droite'),
}

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    quick = '--quick' in sys.argv
    ms = mats(quick)
    for id_, (fn, visual, name, socket, quat, off, note) in ITEMS.items():
        parts = fn()
        used = [ms[k] for k in ['steel', 'leather', 'trim', 'blade', 'glow', 'wood', 'cord'] if any(p[2] == k for p in parts)]
        extras = {'korvalune': {'type': 'weapon', 'id': id_, 'visual': visual, 'attach': {'socket': socket, 'quat': quat, 'offset': off}, 'note': note}}
        fnout = os.path.join(out, id_ + '.glb')
        write_glb(fnout, parts, None, used, {}, extras=extras, mesh_name=name, tex_dir=os.path.join(out, 'tex'))
        print(id_, sum(len(m.F) for _, m, _ in parts), 'tri', os.path.getsize(fnout) // 1024, 'Ko')
