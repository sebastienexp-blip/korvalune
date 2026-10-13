import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from glbkit import *
import town_geo as G, town_geo2 as G2, lm_geo as LM, town_tex as TT

def materials():
    out = {}
    for nm, f in TT.TEX.items():
        base, nrm = f()
        out[nm] = Material(nm, base=base, normal=nrm, factor=(1, 1, 1, 1), metal=0.0, rough=0.92, texkey='ville_' + nm, double_sided=(nm == 'cloth'))
    out['metal'] = Material('metal', factor=(1, 1, 1, 1), metal=0.7, rough=0.45)
    out['window'] = Material('window', factor=(0.23, 0.17, 0.09, 1), metal=0.0, rough=0.6, emissive=(1.0, 0.69, 0.31))
    out['glow'] = Material('glow', factor=(1, 1, 1, 1), metal=0.0, rough=0.5, emissive=(0.12, 0.12, 0.12))
    out['water'] = Material('water', factor=(0.18, 0.44, 0.6, 1), metal=0.2, rough=0.1)
    return out

def emit(out, name, kit, extras, ms):
    used = [ms[m] for m in dict.fromkeys(p[2] for p in kit.parts)]
    fn = os.path.join(out, f'ville_{name}.glb')
    write_glb(fn, kit.parts, None, used, None, extras={'korvalune': {'type': 'town', 'kind': name, **extras}}, mesh_name=name, tex_dir=os.path.join(out, 'tex'))
    tri = sum(len(m.F) for _, m, _ in kit.parts)
    print(f'{name:22s} {tri:6d} tri {os.path.getsize(fn)//1024:4d} Ko')

def catalog():
    items = {}
    for hk, hv in (('a', 3.8), ('b', 4.7), ('c', 5.6)):
        k, ex = G.house(7, 6, hv, True); items['maison_long_' + hk] = (k, ex)
        k, ex = G.house(6, 7, hv, False); items['maison_pignon_' + hk] = (k, ex)
    for nm, fn in (('puits', G.well), ('tonneau', G.barrel), ('caisse', G.crate), ('foin', G.hay), ('lampadaire', G.lamp), ('enseigne_auberge', G.sign_inn), ('coffre_base', G.chest_base), ('coffre_couvercle', G.chest_lid)):
        k, ex = fn(); items[nm] = (k, ex)
    items['mur'] = G2.wall_segment()
    items['tour_coin'] = G2.round_tower(3.6, 12, 4.1, G2.RED)
    items['tour_porte'] = G2.round_tower(2.5, 10, 3.0, G2.BLUE)
    items['tour_chateau_coin'] = G2.round_tower(3.8, 16, 4.4, G2.BLUE)
    items['tour_chateau_porte'] = G2.round_tower(2.6, 12.5, 3.2, G2.BLUE)
    items['tour_carree'] = G2.square_tower()
    items['banniere_porte'] = G2.banner(2.2, 4.2)
    items['linteau_ville'] = G2.gate_lintel(11.4, 2.2, 2.6)
    items['linteau_chateau'] = G2.gate_lintel(9.4, 2.4, 3.2)
    items['donjon'] = G2.keep()
    for nm, (ca, cb, gd) in {'armes': ((0.69, 0.19, 0.19), (0.91, 0.86, 0.75), G2.g_weapons), 'armures': ((0.18, 0.37, 0.6), (0.91, 0.86, 0.75), G2.g_armors),
                             'potions': ((0.23, 0.54, 0.29), (0.91, 0.86, 0.75), G2.g_potions), 'fruits': ((0.75, 0.56, 0.19), (0.91, 0.86, 0.75), G2.g_fruit),
                             'tissus': ((0.63, 0.29, 0.54), (0.91, 0.86, 0.75), G2.g_cloth), 'curios': ((0.29, 0.23, 0.54), (0.82, 0.69, 0.38), G2.g_curios)}.items():
        items['etal_' + nm] = G2.stall(ca, cb, gd)
    items['fontaine'] = G2.fountain()
    for kd in ('forge', 'alchimie', 'enchant', 'armurier'): items['etabli_' + kd] = G2.bench(kd)
    items['cercle_monolithe'] = G2.monolith_circle()
    items['ecurie_abri'] = G2.stable_shed()
    items['barriere'] = G2.fence_span()
    items['auge'] = G2.trough()
    items['portail_regions'] = G2.portal_gate()
    items['torchere'] = G2.torchere()
    for nm, fn in (('lm_moulin', LM.windmill), ('lm_moulin_helice', LM.windmill_sails), ('lm_menhirs', LM.menhirs), ('lm_ferme', LM.farm), ('lm_camp', LM.camp),
                   ('lm_flamme', LM.flame), ('lm_autel', LM.altar), ('lm_autel_sang', lambda: LM.altar(True)), ('lm_forteresse', LM.fortress), ('lm_tour_guet', LM.watchtower),
                   ('lm_tour_brulee', lambda: LM.watchtower(True)), ('lm_obelisque', LM.obelisk_base), ('lm_obelisque_coeur', LM.obelisk_core), ('lm_arche', LM.arch),
                   ('lm_fontaine', LM.fountain_astres), ('lm_orbe', LM.orb), ('lm_temple', LM.temple), ('lm_gueule', LM.maw), ('lm_monolithe', LM.monolith_lm), ('lm_rune', LM.rune),
                   ('lm_anneau', LM.ring_lm), ('lm_portique', LM.border_gate), ('lm_portique_banniere', LM.border_banner),
                   ('ruine_mur', LM.ruin_wall), ('ruine_mur_casse', lambda: LM.ruin_wall(True)), ('ruine_mur_mousse', lambda: LM.ruin_wall(False, True)), ('ruine_mur_casse_mousse', lambda: LM.ruin_wall(True, True)),
                   ('ruine_gravats', LM.ruin_rubble), ('ruine_pilier', LM.ruin_pillar), ('ruine_piedestal', LM.pedestal),
                   ('portail_cadre', LM.portal_frame), ('chariot', LM.wagon), ('forge_decor', LM.forge_decor), ('forge_braises', LM.forge_coals),
                   ('statue_monolithe', LM.monolith_statue), ('statue_runes', LM.monolith_runes), ('statue_cristal', LM.monolith_crystal), ('statue_anneau_a', lambda: LM.monolith_ring(.65)), ('statue_anneau_b', lambda: LM.monolith_ring(.85))):
        items[nm] = fn()
    return items

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    only = [a for a in sys.argv[2:] if not a.startswith('--')]
    ms = materials()
    for name, (k, ex) in catalog().items():
        if only and name not in only: continue
        emit(out, name, k, ex, ms)
