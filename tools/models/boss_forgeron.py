"""Boss des Montagnes de Fer : le Colosse Forgeron (10 m). Automate d'acier riveté à fournaise ventrale, cheminées fumantes, genoux à engrenages,
poing-enclume et énorme marteau de forge aux faces incandescentes."""
import numpy as np
from boss_geo import *
from boss_rig import *


def mats():
    return {
        'plate': mat('plate', T.metal(41, (.46, .47, .52), rust=(.32, .16, .07), rust_amt=.35, panels=5, rough=.5, glow=(1, .4, .08), relief=5.0), 'fg_plate', 1.2, ds=False),
        'dark': mat('dark', T.metal(42, (.22, .22, .26), rust=(.25, .12, .05), rust_amt=.3, panels=7, rough=.55, relief=4.0), 'fg_dark', 1.0, ds=True),
        'brass': mat('brass', T.metal(43, (.62, .42, .13), rust=(.25, .3, .15), rust_amt=.2, panels=4, rough=.4, relief=3.0), 'fg_brass', 1.0),
        'molten': mat('molten', T.stone(44, (.5, .12, .02), (1.0, .55, .1), crack=(1, .5, .08), cells=60, rough=.5, relief=5.0), 'fg_molten', 1.0, emissive=True, metal=0.0),
        'soot': mat('soot', T.stone(45, (.015, .015, .02), (.08, .075, .08), cells=60, rough=.85, relief=6.0), 'fg_soot', 1.2, metal=0.0),
    }


def build():
    R = Rig()
    biped_bones(R, hip=4.4, spine=5.1, chest=6.0, neck=(7.25, .2), head=(7.6, .25), sh=(2.15, 7.1, 0), el=(2.7, 5.1, .2), hand=(2.75, 2.9, .6),
                th=(.95, 4.3, 0), kn=(1.0, 2.35, .2), an=(1.0, .65, .1))
    R.bone('Smoke', 'Chest', (0, 7.5, -.9))
    RNG.seed(2)

    def rivets(c0, c1, n, r=.05, bone='Chest', mt='brass'):
        c0 = np.asarray(c0, float); c1 = np.asarray(c1, float)
        for k in range(n): R.add('rivet', ell(c0 + (c1 - c0) * k / max(n - 1, 1), r, segs=6, n=5, tile=.1), mt, bone)

    # ---------------------------------------------------------- jambes
    def leg():
        o = {}
        th = [box((1.0, 3.55, .1), 1.5, 1.8, 1.5, tile=.9), plate((1.0, 3.6, .82), 1.2, 1.5, th=.14, bend=.12, tile=.9), box((1.0, 4.45, .1), 1.6, .5, 1.6, tile=.9)]
        for dx in (-.5, .5): th.append(rod([(1.0 + dx, 4.2, .75), (1.0 + dx, 2.75, .75)], .07, .07, segs=8, tile=.3, n=4))
        o['th'] = concat(th)
        pis = [rod([(1.55, 4.3, .5), (1.6, 3.35, .55)], .12, .12, segs=10, tile=.3, n=4), rod([(1.6, 3.35, .55), (1.62, 2.55, .58)], .075, .075, segs=10, tile=.2, n=4)]
        for y in (3.9, 3.6, 3.3): pis.append(band((1.58, y, .53), 'y', .12, .06, .03))
        o['pis'] = concat(pis)
        kn = [gear((1.0 + .85, 2.35, .1), .55, teeth=14, depth=.12, thick=.3, axis='x'), ell((1.0, 2.35, .3), .72, sq=(1, .9, 1), segs=16, n=10, tile=1.0), box((1.0, 2.35, .85), 1.0, .8, .4, tile=.7)]
        o['kn'] = concat(kn)
        sh = [box((1.0, 1.45, .25), 1.35, 1.9, 1.3, tile=.9), plate((1.0, 1.45, .95), 1.0, 1.5, th=.12, bend=.1, tile=.8)]
        for k in range(4): sh.append(plate((1.0, 1.9 - k * .38, .98), 1.15, .22, th=.1, bend=.08, tile=.5))
        o['sh'] = concat(sh)
        ft = [box((1.0, .38, .5), 1.4, .7, 2.2, tile=.9), plate((1.0, .75, 1.0), 1.0, 1.2, th=.14, bend=.1, rot=(-1.1, 0, 0), tile=.8)]
        for dx in (-.4, 0, .4): ft.append(box((1.0 + dx, .18, 1.5), .32, .3, .9, tile=.4))
        o['ft'] = concat(ft)
        return o
    L = leg()
    R.add_sym('cuisse', L['th'], 'plate', 'Thigh_L'); R.add_sym('piston', L['pis'], 'dark', 'Thigh_L'); R.add_sym('genou', L['kn'], 'brass', 'Shin_L')
    R.add_sym('tibia', L['sh'], 'plate', 'Shin_L'); R.add_sym('pied', L['ft'], 'dark', 'Foot_L')
    # ---------------------------------------------------------- bassin
    R.add('bassin', box((0, 4.55, 0), 2.9, 1.1, 1.9, tile=1.0), 'dark', 'Hips')
    R.add('ceinture', box((0, 4.95, 0), 3.2, .5, 2.2, tile=1.0), 'plate', 'Hips')
    for k in range(7):
        R.add('enclumette', box(((k - 3) * .42, 4.1, .98 + .02 * abs(k - 3)), .34, .5, .22, tile=.4), 'brass', 'Hips')
    R.add('boucle', gear((0, 4.95, 1.12), .5, teeth=10, depth=.14, thick=.2, axis='z'), 'brass', 'Hips')
    # ---------------------------------------------------------- torse + fournaise
    R.add('torse_bas', box((0, 5.5, 0), 3.1, 1.2, 2.0, tile=1.0), 'plate', 'Spine')
    R.add('torse', box((0, 6.55, -.05), 4.6, 2.1, 2.4, bevel=3.4, tile=1.1), 'plate', 'Chest')
    R.add('torse_dos', box((0, 6.5, -1.15), 3.6, 2.4, .6, tile=1.0), 'dark', 'Chest')
    # fournaise : gueule ardente derrière une grille
    R.add('braise', ell((0, 6.45, 1.0), .95, sq=(1.2, 1.0, .35), segs=24, n=12, tile=.6), 'molten', 'Chest')
    R.add('cadre', torus(1.15, .13, axis='z', segs=32, rs=8), 'brass', 'Chest'); xf(R.parts[-1][1], t=(0, 6.45, 1.18), s=(1.15, 1.0, 1))
    for k in range(7):
        x = (k - 3) * .33
        R.add('barreau', rod([(x, 5.55, 1.28), (x, 7.35, 1.28)], .055, .055, segs=8, tile=.3, n=4), 'dark', 'Chest')
    for k in range(3): R.add('traverse', rod([(-1.15, 5.95 + k * .5, 1.3), (1.15, 5.95 + k * .5, 1.3)], .05, .05, segs=8, tile=.3, n=4), 'dark', 'Chest')
    R.add('porte_g', box((-1.6, 6.45, 1.15), .25, 1.6, .3, tile=.5), 'dark', 'Chest'); R.add('porte_d', box((1.6, 6.45, 1.15), .25, 1.6, .3, tile=.5), 'dark', 'Chest')
    # plaque de poitrail + rivets + manomètre
    R.add('poitrail', plate((0, 7.45, 1.18), 3.2, .9, th=.2, bend=.14, tile=.9), 'dark', 'Chest')
    R.add('cadran', gear((1.5, 7.45, 1.35), .3, teeth=18, depth=.08, thick=.12, axis='z'), 'brass', 'Chest')
    R.add('cadran2', ell((1.5, 7.45, 1.42), .22, sq=(1, 1, .3), segs=12, n=7, tile=.3), 'molten', 'Chest')
    rivets((-2.1, 7.45, 1.3), (-.9, 7.45, 1.4), 5); rivets((.9, 7.45, 1.4), (2.1, 7.45, 1.3), 5)
    rivets((-2.1, 5.7, 1.1), (-1.3, 5.7, 1.28), 4); rivets((1.3, 5.7, 1.28), (2.1, 5.7, 1.1), 4)
    # cheminées
    for sx in (-1, 1):
        for h_, x_, z_, r_ in ((2.2, 1.5, -.9, .38), (1.5, 2.1, -.6, .3)):
            R.add('cheminee', rod([(sx * x_, 7.5, z_), (sx * x_, 7.5 + h_, z_)], r_, r_ * .85, segs=14, tile=.6, n=5, ref=(0, 0, 1)), 'dark', 'Chest')
            for hh in (.3, h_ * .6): R.add('cheminee_b', band((sx * x_, 7.5 + hh, z_), 'y', r_ * 1.0, .16, .05), 'brass', 'Chest')
            R.add('cheminee_bouche', revolve([(r_ * .86, 0), (r_ * 1.25, .12), (r_ * 1.25, .26), (r_ * .8, .26)], segs=18), 'dark', 'Chest'); xf(R.parts[-1][1], rx=-PI / 2, t=(sx * x_, 7.5 + h_, z_))
            R.add('cheminee_braise', ell((sx * x_, 7.5 + h_ + .22, z_), r_ * .8, sq=(1, .2, 1), segs=12, n=5, tile=.4), 'molten', 'Chest')
    # tuyaux dorsaux
    for k in range(4):
        x = -1.2 + k * .8
        R.add('tuyau', rod([(x, 5.6, -1.5), (x, 6.5, -1.9), (x + .2, 7.6, -1.5)], .15, .15, segs=10, tile=.4, n=10), 'brass', 'Chest')
    # ---------------------------------------------------------- épaules, bras, poing-enclume, marteau
    def shoulder():
        o = [ell((2.3, 7.1, 0), 1.0, sq=(1.1, .9, 1.05), segs=20, n=12, tile=1.0)]
        for k in range(4): o.append(plate((2.4 + .1 * k, 7.7 - .0 * k + .0, .05), 1.8 - .1 * k, .7, th=.12, bend=.4, rot=(0, 0, -.35 - .0), tile=.6)) if False else None
        for k in range(3): o.append(box((2.45, 7.55 - k * .3, 0), 1.9 - .15 * k, .45, 1.9 - .1 * k, bevel=3.0, tile=.7))
        for k in range(3): o.append(cone((2.2 + k * .5, 8.1, -.3 + k * .3), (2.4 + k * .7, 8.9, -.3 + k * .3), .17, segs=8, n=5, tile=.4))
        return concat(o)
    R.add_sym('epaule', shoulder(), 'plate', 'Arm_L')
    R.add_sym('engr_ep', gear((3.3, 7.1, 0), .5, teeth=12, depth=.12, thick=.25, axis='x'), 'brass', 'Arm_L')
    R.add_sym('bras', concat([box((2.55, 6.0, .1), 1.15, 2.1, 1.15, tile=.9), rod([(3.15, 6.8, .1), (3.15, 5.4, .1)], .12, .12, segs=8, tile=.3, n=4)]), 'plate', 'Arm_L')
    R.add_sym('coude', concat([gear((2.7 + .7, 5.1, .2), .5, teeth=12, depth=.12, thick=.3, axis='x'), ell((2.7, 5.1, .2), .62, segs=14, n=9, tile=.8)]), 'dark', 'Fore_L')
    R.add_sym('avantbras', concat([box((2.7, 3.9, .3), 1.25, 2.2, 1.25, tile=.9), plate((2.7, 3.9, .95), .9, 1.7, th=.12, bend=.1, tile=.8)]), 'plate', 'Fore_L')
    # main gauche : enclume
    R.add('enclume', concat([box((-2.78, 2.7, .6), 1.5, .7, 1.1, tile=.7), box((-2.78, 2.1, .6), .8, .6, .6, tile=.7), box((-2.78, 1.6, .6), 1.4, .45, 1.0, tile=.7), cone((-2.78, 2.7, 1.1), (-2.78, 2.6, 2.3), .5, segs=10, ratio=.7, n=6, tile=.5)]), 'dark', 'Hand_L')
    R.add('poignet_g', band((-2.75, 3.0, .55), 'y', .62, .3, .1), 'brass', 'Hand_L')
    # main droite : manche + marteau
    R.add('manche', rod([(2.75, 1.0, .5), (2.8, 3.0, .7), (2.85, 5.6, 1.0)], .22, .2, segs=12, tile=.6, n=14, ref=(0, 0, 1)), 'dark', 'Hand_R') if False else None
    hx = -2.78
    R.add('manche', rod([(hx, .5, .6), (hx, 3.0, .65), (hx, 6.2, .75)], .2, .17, segs=12, tile=.6, n=14, ref=(0, 0, 1)), 'dark', 'Hand_R')
    for y in (1.0, 2.2, 3.2): R.add('manche_b', band((hx, y, .62), 'y', .21, .3, .06), 'brass', 'Hand_R')
    R.add('tete_marteau', box((hx, 6.7, .75), 1.6, 1.5, 3.2, bevel=3.2, tile=1.0), 'plate', 'Hand_R')
    for sz in (-1, 1):
        R.add('face_marteau', box((hx, 6.7, .75 + sz * 1.62), 1.25, 1.2, .14, tile=.5), 'molten', 'Hand_R')
        R.add('collet', box((hx, 6.7, .75 + sz * 1.45), 1.5, 1.45, .3, tile=.6), 'dark', 'Hand_R')
    R.add('dessus_marteau', cone((hx, 7.45, .75), (hx, 8.2, .75), .3, segs=8, n=5, tile=.4), 'dark', 'Hand_R')
    R.add('poignet_d', band((hx, 3.0, .65), 'y', .45, .5, .08), 'brass', 'Hand_R') if False else None
    R.add('poing_d', concat([box((hx, 2.9, .65), .9, .8, .9, tile=.6), box((hx, 3.55, .7), .8, .5, .8, tile=.5)]), 'plate', 'Hand_R')
    # chaîne pendante
    for k in range(10):
        R.add('maillon', torus(.17, .045, axis='x' if k % 2 else 'z', segs=14, rs=6), 'dark', 'Hips'); xf(R.parts[-1][1], t=(1.55, 4.7 - k * .33, 1.05))
    # ---------------------------------------------------------- cou + tête
    R.add('cou', box((0, 7.35, .1), 1.5, .7, 1.3, tile=.6), 'dark', 'Neck')
    R.add('casque', box((0, 8.0, .25), 1.9, 1.5, 1.9, bevel=3.4, tile=.8), 'plate', 'Head')
    R.add('visiere', box((0, 8.0, 1.2), 1.7, .4, .2, tile=.5), 'dark', 'Head')
    R.add('regard', box((0, 8.0, 1.3), 1.45, .16, .1, tile=.4), 'molten', 'Head')
    R.add('menton', box((0, 7.5, 1.0), 1.2, .55, .6, tile=.6), 'dark', 'Head')
    for k in range(6): R.add('grille', rod([(-.5 + k * .2, 7.35, 1.3), (-.5 + k * .2, 7.7, 1.3)], .04, .04, segs=6, tile=.2, n=3), 'molten', 'Head')
    for sx in (1, -1):
        R.add('corne', cone((sx * .9, 8.5, .1), (sx * 1.9, 10.0, -.2), .3, segs=10, n=8, tile=.6, curve=.3, bow=(sx * .25, .1, -.1)), 'dark', 'Head')
        R.add('oreille_eng', gear((sx * 1.05, 8.0, .2), .38, teeth=10, depth=.12, thick=.25, axis='x'), 'brass', 'Head')
    R.add('cimier', box((0, 9.0, .0), .35, .5, 1.6, tile=.5), 'dark', 'Head')
    return R, 10.0


def pose_fns():
    return biped_poses('slam', [(['Smoke'], 'x', .06, .5)], arm=.3, leg=.4, bob=.1, lean=.02, drop=2.6)
