"""Boss de la Prairie : l'Épouvantail Moissonneur (8,4 m). Charpente de bois cerclée de fer, torse de toile de jute éventré d'où jaillit
un cœur de citrouille ardent, tête-sac cousue au rictus de lanterne, chapeau de fermier en lambeaux, corbeaux perchés, grande faux."""
import numpy as np
from boss_geo import *
from boss_rig import *

H = 8.4


def mats():
    return {
        'wood': mat('wood', T.fibers(11, (.16, .10, .06), (.36, .24, .13), aniso=(.1, 1.0), rough=.88, relief=5.0, dirt=.5), 'sc_wood', 1.4),
        'burlap': mat('burlap', T.fibers(12, (.42, .33, .18), (.62, .50, .30), weave=True, rough=.95, relief=4.0, dirt=.55), 'sc_burlap', 1.2),
        'straw': mat('straw', T.fibers(13, (.62, .48, .16), (.92, .78, .34), aniso=(.06, 1.2), rough=.8, relief=2.5, dirt=.25), 'sc_straw', .8),
        'iron': mat('iron', T.metal(14, (.20, .19, .19), rust_amt=.55, panels=3, rough=.6, relief=4.0, rivets=False), 'sc_iron', 1.0, ds=True),
        'blade': mat('blade', T.metal(15, (.55, .56, .58), rust=(.3, .15, .06), rust_amt=.25, panels=2, rough=.35, relief=2.0, rivets=False), 'sc_blade', .8, ds=True),
        'glow': mat('glow', T.skin(16, (.95, .38, .04), (1.0, .62, .12), vein=(1, .55, .05), wet=False, relief=4.0, cells=120), 'sc_glow', 1.0, emissive=True, metal=0.0),
        'pump': mat('pump', T.skin(17, (.62, .26, .04), (.86, .42, .07), spots=(.35, .16, .03), vein=None, wet=False, relief=5.0, cells=200), 'sc_pump', 1.2, metal=0.0),
        'cloth': mat('cloth', T.fibers(18, (.10, .07, .12), (.24, .17, .26), weave=True, rough=.9, relief=3.5, dirt=.6), 'sc_cloth', 1.0, ds=True),
        'crow': mat('crow', T.fibers(19, (.02, .02, .03), (.10, .10, .14), aniso=(.15, 1.2), rough=.4, relief=2.0, dirt=.1), 'sc_crow', .8, metal=0.2),
        'bone': mat('bone', T.stone(20, (.52, .47, .38), (.82, .77, .66), cells=70, rough=.7, relief=5.0), 'sc_bone', 1.0, metal=0.0),
    }


def crow(R, bone, pos, yaw=0.0, s=1.0):
    parts = []
    body = ell((0, 0, 0), .26, sq=(.8, .75, 1.35), segs=10, n=9, tile=.5); xf(body, rx=.25)
    head = ell((0, .22, .30), .11, sq=(.9, 1, 1), segs=8, n=7, tile=.3)
    beak = cone((0, .22, .38), (0, .17, .58), .045, segs=6, n=4, tile=.2, cap=1)
    wing = ell((.17, .03, -.02), .18, sq=(.25, .55, 1.5), segs=8, n=7, tile=.4); xf(wing, rz=-.15)
    tail = cone((0, 0, -.26), (0, -.08, -.72), .1, segs=6, ratio=2.4, n=4, tile=.3)
    eye = ell((.075, .25, .36), .02, segs=5, n=5, tile=.1)
    out = concat([body, head, beak, tail])
    wings = concat([wing, mirror_x(wing, {})])
    for m in (out, wings): xf(m, ry=yaw, s=s); m.V += np.asarray(pos, float)
    R.add('corbeau', out, 'crow', bone); R.add('corbeau_aile', wings, 'crow', bone)
    for sx in (1, -1):
        e = ell((sx * .075, .25, .36), .02, segs=5, n=5, tile=.1); xf(e, ry=yaw, s=s); e.V += np.asarray(pos, float); R.add('corbeau_oeil', e, 'glow', bone)


def build():
    R = Rig()
    R.bone('Root', None, (0, 0, 0))
    R.bone('Hips', 'Root', (0, 3.7, 0)); R.bone('Spine', 'Hips', (0, 4.3, 0)); R.bone('Chest', 'Spine', (0, 5.0, 0))
    R.bone('Neck', 'Chest', (0, 6.1, .05)); R.bone('Head', 'Neck', (0, 6.35, .08))
    R.bone('Cloak', 'Chest', (0, 5.9, -.35))
    for s, sd in ((1, 'L'), (-1, 'R')):
        R.bone(f'Arm_{sd}', 'Chest', (s * 1.15, 5.75, 0)); R.bone(f'Fore_{sd}', f'Arm_{sd}', (s * 1.75, 4.15, .12)); R.bone(f'Hand_{sd}', f'Fore_{sd}', (s * 1.8, 2.45, .45))
        R.bone(f'Thigh_{sd}', 'Hips', (s * .6, 3.6, 0)); R.bone(f'Shin_{sd}', f'Thigh_{sd}', (s * .65, 2.0, .12)); R.bone(f'Foot_{sd}', f'Shin_{sd}', (s * .65, .55, .1))

    # ---------------------------------------------------------------- jambes : poteaux cerclés
    def leg():
        out = {}
        th = [rod([(.6, 3.65, 0), (.62, 2.9, .06), (.65, 2.0, .12)], .40, .32, segs=14, tile=1.2, ref=(0, 0, 1), prof_k=[(0, .5), (.12, .42), (.5, .36), (.9, .33), (1, .3)])]
        for y in (3.4, 2.95, 2.45): th.append(band((.61 + (3.65 - y) * .02, y, .03), 'y', .36, .14, .05))
        th.append(helix((.6, 3.4, 0), (.64, 2.2, .1), .385, 3.2, .028))
        for k in range(5):  # clous / chevilles
            a = 1.1 + k * .6; y = 3.3 - k * .22
            th.append(ell((.62 + .4 * np.cos(a), y, .05 + .4 * np.sin(a)), .035, segs=6, n=5, tile=.1))
        out['thigh'] = (concat(th), 'wood')
        # genou : bloc de bois + plaque de fer cloutée
        kn = [ell((.65, 2.0, .26), .30, sq=(1.0, .9, .9), segs=14, n=10, tile=1.0), plate((.65, 2.0, .46), .52, .55, th=.07, bend=.06, tile=.6)]
        for dx in (-.17, .17):
            for dy in (-.2, .2): kn.append(ell((.65 + dx, 2.0 + dy, .52), .035, segs=6, n=5, tile=.1))
        out['knee'] = (concat(kn), 'iron')
        sh = [rod([(.65, 1.95, .12), (.66, 1.2, .14), (.65, .6, .1)], .31, .25, segs=14, tile=1.2, ref=(0, 0, 1), prof_k=[(0, .31), (.4, .27), (1, .23)])]
        for y in (1.7, 1.25, .85): sh.append(band((.655, y, .12), 'y', .30 - (1.95 - y) * .03, .12, .05))
        sh.append(helix((.65, 1.8, .12), (.65, .8, .1), .275, 2.8, .026))
        out['shin'] = (concat(sh), 'wood')
        # pied : sabot de bois racinaire à orteils-crochets
        ft = [ell((.65, .3, .22), .46, sq=(.85, .5, 1.25), segs=16, n=10, tile=1.0)]
        for i, dx in enumerate((-.24, -.08, .08, .24)):
            ft.append(cone((.65 + dx, .22, .58), (.65 + dx * 1.5, .1, 1.18), .14, segs=8, n=6, tile=.4, curve=.4, bow=(0, .07, 0)))
        ft.append(cone((.65, .22, -.2), (.65, .12, -.7), .17, segs=8, n=5, tile=.4))
        for k, a in enumerate(np.linspace(-.9, .9, 6)):  # racines qui plongent
            ft.append(rod([(.65 + .25 * np.sin(a), .5, .1 + .25 * np.cos(a)), (.65 + .5 * np.sin(a), .22, .1 + .5 * np.cos(a)), (.65 + .7 * np.sin(a), .04, .1 + .72 * np.cos(a))], .055, .02, segs=6, tile=.3, n=8))
        out['foot'] = (concat(ft), 'wood')
        out['strap'] = (concat([band((.65, .42, .15), 'y', .43, .1, .05), band((.65, .22, .22), 'z', .42, .1, .05)]), 'iron')
        return out
    L = leg()
    R.add_sym('cuisse', L['thigh'][0], 'wood', 'Thigh_L'); R.add_sym('genou', L['knee'][0], 'iron', 'Shin_L')
    R.add_sym('tibia', L['shin'][0], 'wood', 'Shin_L'); R.add_sym('pied', L['foot'][0], 'wood', 'Foot_L'); R.add_sym('sangle', L['strap'][0], 'iron', 'Foot_L')

    # ---------------------------------------------------------------- bassin / ceinture
    pel = [ell((0, 3.75, 0), 1.0, sq=(1.05, .55, .72), segs=24, n=12, tile=1.2)]
    R.add('bassin', concat(pel), 'burlap', 'Hips')
    belt = [band((0, 4.05, 0), 'y', 1.02, .24, .08, segs=32)]
    R.add('ceinture', belt[0], 'iron', 'Hips')
    R.add('boucle', plate((0, 4.05, .98), .5, .42, th=.1, bend=.05, tile=.5), 'iron', 'Hips')
    for k in range(7):  # pendants de jute à la ceinture
        a = -PI * .8 + k * PI * 1.6 / 6
        R.add('pendant', rod([(1.0 * np.sin(a), 4.0, 1.0 * np.cos(a) * .75), (1.1 * np.sin(a), 3.4, 1.1 * np.cos(a) * .75), (1.15 * np.sin(a), 2.85 - .2 * (k % 2), 1.15 * np.cos(a) * .75)], .15, .04, segs=6, ratio=.25, tile=.4), 'cloth', 'Hips')

    # ---------------------------------------------------------------- torse : sac de jute éventré
    n = 14; y = np.linspace(4.0, 6.05, n)
    path = np.stack([np.zeros(n), y, np.zeros(n)], 1)
    rf = prof([(0, .85), (.3, .95), (.6, 1.18), (.85, 1.1), (1, .8)], n); rs = prof([(0, 1.0), (.3, 1.2), (.55, 1.55), (.85, 1.6), (1, 1.1)], n)
    tor = open_loft(Loft(path, rf, rs, p=2.6, segs=48, cap0=1, cap1=1, tile=1.1, ref=(0, 0, 1)), 140, 400)   # ouvert devant (z+) : 140..400 ferme l'arrière, ouvre l'avant
    R.add('torse', tor, 'burlap', 'Chest')
    # cœur de citrouille ardent dans la cage
    R.add('coeur', lobed((0, 5.0, .25), .78, lobes=9, depth=.1, sq=(1.0, .95, .9), segs=36), 'glow', 'Chest')
    R.add('coeur_cadre', concat([torus(.84, .075, axis='z', segs=32, rs=8)]), 'iron', 'Chest')
    xf(R.parts[-1][1], t=(0, 5.0, .55))
    # côtes de bois cintrées + sternum
    for k in range(6):
        yy = 4.35 + k * .31; wid = 1.25 + .2 * np.sin(k * .5)
        for s in (1, -1):
            pts = [(s * .12, yy + .18, .72), (s * wid * .55, yy + .1, .98), (s * wid * .95, yy, .55), (s * wid * 1.0, yy - .05, -.2)]
            R.add('cote', rod(pts, .085, .06, segs=8, tile=.5, n=14), 'wood', 'Chest')
    R.add('sternum', rod([(0, 6.0, .78), (0, 5.0, .95), (0, 4.2, .8)], .11, .11, segs=8, tile=.5, n=12), 'wood', 'Chest')
    R.add('colonne', rod([(0, 4.0, -.82), (0, 5.0, -1.02), (0, 6.0, -.82)], .2, .18, segs=10, tile=.6, n=12), 'wood', 'Chest')
    # paille qui jaillit de la plaie
    RNG.seed(3)
    for k in range(10):
        a = k / 10 * 2 * PI
        R.add('paille_torse', tuft((np.cos(a) * .72, 5.0 + np.sin(a) * .85, .5), (np.cos(a) * .9, np.sin(a) * .8 - .1, .7), n=9, L=.9, spread=.35, r=.028, droop=.35), 'straw', 'Chest')
    # coutures grossières en travers du ventre
    for k in range(9):
        yy = 4.25 + k * .06; xx = -.6 + k * .15
    for k in range(8):
        a = -.9 + k * .26
        R.add('couture', rod([(np.sin(a) * 1.15 - .08, 4.28 + k * .05, np.cos(a) * .93), (np.sin(a) * 1.15 + .08, 4.40 + k * .05, np.cos(a) * .93)], .022, .022, segs=5, tile=.1, n=4), 'wood', 'Spine')
    # épaules : fagots de paille + planches
    for s in (1, -1):
        sh = lobed((s * 1.55, 6.15, 0), .62, lobes=8, depth=.11, sq=(1, .85, 1), segs=32)
        R.add('citrouille_epaule', sh, 'pump', 'Chest')
        for (ex, ez, sx) in ((.18, .52, .1),):
            tri = revolve([(.0, .14), (.17, 0)], segs=3); xf(tri, t=(s * 1.55 - s * .2, 6.2, .56))
            R.add('oeil_epaule', tri, 'glow', 'Chest')
        tri = revolve([(.0, .14), (.17, 0)], segs=3); xf(tri, t=(s * 1.55 + s * .2, 6.2, .56)); R.add('oeil_epaule', tri, 'glow', 'Chest')
        mo = [ell((s * 1.55, 6.15 - .1, .58), .17, sq=(1.7, .6, .35), segs=10, n=7, tile=.3)]
        R.add('bouche_epaule', concat(mo), 'glow', 'Chest')
        R.add('tige_epaule', cone((s * 1.55, 6.7, 0), (s * 1.62, 7.05, .05), .09, segs=8, n=4, tile=.3, cap=1), 'wood', 'Chest')
        R.add('paille_epaule', tuft((s * 1.9, 6.35, -.1), (s * 1, .5, -.2), n=14, L=1.1, spread=.4, r=.03, droop=.5), 'straw', 'Chest')
        R.add('planche_epaule', plate((s * 1.45, 6.5, .1), 1.05, .5, th=.12, bend=.14, rot=(.35, 0, -s * .5), tile=.7), 'wood', 'Chest')

    # ---------------------------------------------------------------- cape en lambeaux (se balance)
    RNG.seed(8)
    for k in range(15):
        x0 = -1.5 + k * .215; ln = 3.0 + 1.3 * RNG.rand() + .6 * np.cos((k - 7) * .4)
        zb = -.82 - .12 * np.cos((k - 7) * .3)
        pts = [(x0, 6.0, zb), (x0 * 1.06, 6.0 - ln * .4, zb - .22), (x0 * 1.12, 6.0 - ln * .75, zb - .42), (x0 * 1.16 + RNG.normal(0, .1), 6.0 - ln, zb - .5)]
        path = smoothpath(pts, 9)
        w = prof([(0, .13), (.5, .12), (.85, .1), (1, .02)], 9)
        R.add('lambeau', Loft(path, np.full(9, .012), w, p=2.2, segs=6, cap0=0, cap1=1, tile=.8, ref=(1, 0, 0)).mesh(), 'cloth', 'Cloak')
    R.add('col_cape', torus(.95, .22, axis='y', segs=30, rs=8, tile=.5), 'cloth', 'Chest'); xf(R.parts[-1][1], t=(0, 6.05, -.12), s=(1, 1, .85))

    # ---------------------------------------------------------------- cou, tête-sac cousue, chapeau
    R.add('cou', rod([(0, 6.0, .04), (0, 6.35, .1)], .5, .42, segs=14, tile=.6, ref=(0, 0, 1)), 'burlap', 'Neck')
    R.add('paille_cou', tuft((0, 6.15, .45), (0, .2, 1), n=26, L=.8, spread=.7, r=.026, droop=.2), 'straw', 'Neck')
    head = ell((0, 6.95, .12), .86, sq=(.95, 1.05, 1.0), segs=40, n=26, tile=1.0)
    R.add('tete', head, 'burlap', 'Head')
    # suture verticale + croix de coutures
    for k in range(18):
        yy = 6.3 + k * .07
        R.add('suture', rod([(-.07, yy, .98), (.07, yy + .035, .98)], .018, .018, segs=5, n=3, tile=.1), 'wood', 'Head')
    R.add('suture_fil', rod([(0, 6.25, .96), (0, 7.55, .93)], .013, .013, segs=4, n=10, tile=.1), 'wood', 'Head')
    # visage de lanterne : yeux triangulaires incandescents, bouche denticulée
    for s in (1, -1):
        e = revolve([(.0, .14), (.3, 0)], segs=3); xf(e, ry=0, rz=PI if s > 0 else PI + .0, t=(s * .36, 7.14, .95)); xf(e, rx=0)
        R.add('oeil', e, 'glow', 'Head')
        R.add('arcade', rod([(s * .64, 7.38, .72), (s * .38, 7.45, .94), (s * .12, 7.36, .98)], .06, .035, segs=7, tile=.2, n=8), 'wood', 'Head')
    R.add('nez', cone((0, 7.0, .97), (0, 6.82, 1.2), .1, segs=3, n=3, tile=.2), 'wood', 'Head')
    mouth = ell((0, 6.58, .88), .5, sq=(1.35, .32, .22), segs=24, n=9, tile=.4)
    R.add('bouche', mouth, 'glow', 'Head')
    for k in range(9):
        x = -.62 + k * .155; hh = .17 + .06 * (k % 2)
        up = revolve([(.0, -hh), (.06, 0)], segs=3); xf(up, rx=PI / 2, t=(x, 6.7, .96)); R.add('dent_h', up, 'bone', 'Head')
        dn_ = revolve([(.0, hh), (.06, 0)], segs=3); xf(dn_, rx=PI / 2, t=(x + .07, 6.46, .96)); R.add('dent_b', dn_, 'bone', 'Head')
    R.add('paille_tete', tuft((0, 7.8, .0), (0, 1, -.1), n=30, L=1.0, spread=.9, r=.03, droop=.5), 'straw', 'Head')
    # chapeau
    brim = revolve([(1.9, -.02), (1.75, .08), (1.4, .14), (.98, .18), (.9, .2), (.86, .7), (.8, 1.1), (.62, 1.5), (.34, 1.62), (.1, 1.52)], segs=48, tile=1.2)
    xf(brim, rx=-PI / 2, rz=0, t=(0, 7.72, .1)); xf(brim, rx=.1)
    R.add('chapeau', brim, 'cloth', 'Head')
    R.add('ruban', band((0, 7.92, .1), 'y', .88, .26, .06, segs=36), 'iron', 'Head')
    for k in range(8):  # bord déchiré
        a = k / 8 * 2 * PI
        R.add('chapeau_fil', cone((1.85 * np.cos(a), 7.6, .1 + 1.85 * np.sin(a)), (2.05 * np.cos(a), 7.3, .1 + 2.05 * np.sin(a)), .06, segs=5, n=4, tile=.2), 'cloth', 'Head')
    R.add('paille_chapeau', tuft((0, 7.7, 1.0), (0, .1, 1), n=18, L=.9, spread=.6, r=.03, droop=.5), 'straw', 'Head')
    crow(R, 'Head', (.92, 8.12, .3), yaw=-.8, s=1.1); crow(R, 'Head', (-1.15, 7.8, .5), yaw=.6, s=.9)
    crow(R, 'Chest', (-1.65, 6.95, .0), yaw=2.4, s=1.0)

    # ---------------------------------------------------------------- bras
    def arm():
        o = {}
        up = [rod([(1.2, 5.9, 0), (1.5, 5.0, .06), (1.75, 4.15, .12)], .27, .22, segs=12, tile=1.0, ref=(0, 0, 1))]
        up.append(rod([(1.25, 5.8, 0), (1.5, 5.2, .06), (1.72, 4.5, .1)], .46, .38, segs=14, tile=1.0, ref=(0, 0, 1), prof_k=[(0, .5), (.5, .44), (1, .3)]))
        up.append(helix((1.28, 5.6, 0), (1.7, 4.3, .1), .45, 2.5, .03))
        o['up'] = concat(up)
        el = [ell((1.77, 4.12, .1), .33, segs=14, n=10, tile=.8), band((1.77, 4.12, .1), 'y', .33, .2, .06), cone((1.9, 4.2, .1), (2.35, 4.55, .08), .13, segs=8, n=5, tile=.3)]
        o['el'] = concat(el)
        fo = [rod([(1.76, 4.1, .12), (1.78, 3.2, .3), (1.8, 2.5, .45)], .24, .18, segs=12, tile=1.0, ref=(0, 0, 1))]
        fo.append(rod([(1.76, 4.0, .12), (1.78, 3.4, .25), (1.8, 2.9, .38)], .4, .3, segs=14, tile=1.0, ref=(0, 0, 1), prof_k=[(0, .42), (.5, .36), (1, .22)]))
        fo.append(helix((1.76, 3.9, .15), (1.8, 2.7, .42), .37, 2.4, .028))
        o['fo'] = concat(fo)
        o['wrist'] = concat([band((1.8, 2.5, .45), 'y', .22, .22, .06), band((1.78, 3.0, .35), 'y', .32, .1, .05)])
        return o
    A = arm()
    R.add_sym('bras', A['up'], 'burlap', 'Arm_L'); R.add_sym('coude', A['el'], 'iron', 'Fore_L')
    R.add_sym('avantbras', A['fo'], 'burlap', 'Fore_L'); R.add_sym('poignet', A['wrist'], 'iron', 'Hand_L')
    # mains : trois griffes de fer en serpe + pouce
    def hand_geo(s):
        g = [ell((s * 1.8, 2.28, .5), .26, sq=(1, 1.1, 1), segs=12, n=8, tile=.5)]
        for i, dx in enumerate((-.14, 0, .14)):
            g.append(cone((s * 1.8 + dx, 2.15, .58), (s * 1.8 + dx * 1.8, 1.3, 1.1 - abs(dx) * 1.5), .075, segs=6, n=8, tile=.3, curve=.3, bow=(0, -.1, .38)))
        g.append(cone((s * 1.8 + s * .2, 2.28, .5), (s * 1.8 + s * .5, 1.65, .9), .07, segs=6, n=6, tile=.3, curve=.3, bow=(0, -.05, .25)))
        return concat(g)
    R.add('main_L', hand_geo(1), 'iron', 'Hand_L'); R.add('main_R', hand_geo(-1), 'iron', 'Hand_R')

    # ---------------------------------------------------------------- la grande faux (main droite)
    hx, hz = -1.85, .75
    R.add('manche', rod([(hx, 0.1, hz), (hx - .04, 2.5, hz + .03), (hx - .08, 5.5, hz + .1), (hx - .1, 8.35, hz + .2)], .1, .08, segs=10, tile=.8, n=20, ref=(0, 0, 1)), 'wood', 'Hand_R')
    R.add('pointe', cone((hx, .2, hz), (hx, -.3, hz), .09, segs=6, n=3, tile=.2), 'iron', 'Hand_R')
    R.add('poignee1', ell((hx - .03, 3.3, hz + .03), .17, sq=(.8, 1.4, .8), segs=8, n=7, tile=.3), 'wood', 'Hand_R')
    R.add('virole', band((hx - .1, 8.2, hz + .2), 'y', .13, .16, .05), 'iron', 'Hand_R')
    bp = smoothpath([(hx - .1, 8.3, hz + .2), (hx - .1, 8.75, hz + 1.2), (hx - .1, 8.5, hz + 2.4), (hx - .1, 7.7, hz + 3.5), (hx - .1, 6.7, hz + 4.1), (hx - .1, 5.9, hz + 4.2)], 28)
    w = prof([(0, .1), (.15, .42), (.5, .52), (.85, .3), (1, .015)], 28)
    blade = Loft(bp, np.full(28, .035), w, p=2.6, segs=14, cap0=1, cap1=1, tile=.8, ref=(1, 0, 0), os_=w * .72).mesh()
    R.add('lame', blade, 'blade', 'Hand_R')
    R.add('dos_lame', rod([(hx - .1, 8.3, hz + .2), (hx - .1, 8.82, hz + 1.2), (hx - .1, 8.6, hz + 2.4), (hx - .1, 7.8, hz + 3.5), (hx - .1, 6.8, hz + 4.12), (hx - .1, 6.0, hz + 4.22)], .075, .03, segs=8, tile=.4, n=26, ref=(1, 0, 0)), 'iron', 'Hand_R')
    for k in range(6):
        t = (k + .5) / 6; i = int(t * 27)
        R.add('rivet', ell(bp[i] + np.array([.05, .1, 0]), .05, segs=6, n=5, tile=.1), 'iron', 'Hand_R')
    # corbeau sur la faux + chaîne
    crow(R, 'Hand_R', (hx - .1, 8.95, hz + 1.3), yaw=1.6, s=1.2)
    R.add('chaine', rod([(hx - .05, 6.5, hz + .15), (hx + .6, 5.9, hz + .55), (hx + .5, 5.0, hz + .5), (hx, 4.6, hz + .1)], .045, .045, segs=6, tile=.1, n=16), 'iron', 'Hand_R')
    return R, H


def pose_fns():
    def base(p, w, k=1.0):
        p.r('Chest', .01 * np.sin(w), 0, 0)

    def idle(u):
        p = Pose(); w = 2 * PI * u
        p.r('Spine', .02 * np.sin(w), .05 * np.sin(w * .5), 0); p.r('Chest', .015 * np.sin(w + .5), -.04 * np.sin(w * .5), .02 * np.sin(w))
        p.r('Head', .05 * np.sin(w + 1), .12 * np.sin(w * .5 + .6), .05 * np.sin(w * .5))
        p.r('Cloak', .08 + .06 * np.sin(w - .8), 0, 0)
        p.r('Arm_L', .1 * np.sin(w + .4), 0, -.05); p.r('Arm_R', .05 * np.sin(w + 1.1), 0, .04); p.r('Fore_L', -.1 - .05 * np.sin(w), 0, 0)
        p.mv('Hips', 0, .05 * np.sin(w), 0)
        return p

    def walk(u):
        p = Pose(); biped_gait(p, u, arm=.35, leg=.5, bob=.08, twist=.15, lean=.04, lift=1.0)
        w = 2 * PI * u; p.r('Cloak', .2 + .12 * np.sin(w * 2 - .8), 0, 0); p.r('Arm_R', -.15, 0, 0)
        return p

    def run(u):
        p = Pose(); biped_gait(p, u, arm=.6, leg=.8, bob=.15, twist=.22, lean=.14, lift=1.3)
        w = 2 * PI * u; p.r('Cloak', .5 + .15 * np.sin(w * 2), 0, 0)
        return p

    def attack(u):
        # faux : levée en arrière, grand fauchage horizontal, retour
        p = Pose(); wind = seg(u, 0, .38); swing = seg(u, .4, .58); rec = seg(u, .66, 1.0)
        k = wind * (1 - swing) + (swing * (1 - rec)) * 1.0
        p.r('Spine', -.1 * wind + .25 * swing * (1 - rec), 0, 0)
        p.r('Chest', 0, .9 * wind * (1 - swing) - 1.1 * swing * (1 - rec), 0); p.r('Hips', 0, .25 * wind * (1 - swing) - .3 * swing * (1 - rec), 0)
        p.r('Arm_R', -1.2 * wind * (1 - swing) - .6 * swing * (1 - rec), 0, .5 * wind * (1 - swing)); p.r('Fore_R', -.5 * wind * (1 - swing), 0, 0)
        p.r('Arm_L', -.6 * wind * (1 - swing) + .2 * swing, 0, -.3 * wind)
        p.r('Head', 0, -.3 * swing * (1 - rec), 0); p.r('Cloak', .35 * swing * (1 - rec), 0, 0)
        p.mv('Hips', 0, -.18 * wind * (1 - swing), .1 * swing * (1 - rec))
        return p

    def hit(u):
        p = Pose(); k = np.sin(PI * np.clip(u, 0, 1))
        p.r('Spine', -.18 * k, 0, 0); p.r('Chest', -.1 * k, .1 * k, 0); p.r('Head', .2 * k, 0, 0); p.r('Arm_L', .25 * k, 0, 0)
        return p

    def death(u):
        p = Pose(); k = seg(u, .1, 1.0); j = seg(u, .0, .5)
        p.r('Spine', .5 * k, 0, 0); p.r('Chest', .45 * k, 0, 0); p.r('Head', .6 * k, 0, 0); p.r('Neck', .3 * k, 0, 0)
        p.r('Thigh_L', -.5 * k, 0, 0); p.r('Thigh_R', -.8 * k, 0, 0); p.r('Shin_L', 1.2 * k, 0, 0); p.r('Shin_R', 1.6 * k, 0, 0)
        p.r('Arm_L', -.4 * k, 0, -.8 * k); p.r('Arm_R', -.3 * k, 0, .9 * k)
        p.r('Root', 1.0 * k, 0, .15 * k); p.mv('Root', 0, -1.9 * k, 1.2 * k)
        p.r('Cloak', -.5 * k, 0, 0)
        return p
    return dict(idle=idle, walk=walk, run=run, attack=attack, hit=hit, death=death)
