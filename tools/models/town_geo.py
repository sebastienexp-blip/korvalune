"""Modules de la ville de Korvalune (GLB statiques). Origine = centre du bâtiment au sol, Y haut, façade/porte vers +Z."""
import numpy as np
from kit import *
from kit import _mk

STONE = (0.74, 0.72, 0.68); WOOD = (0.33, 0.23, 0.15); DWOOD = (0.26, 0.18, 0.12); IRON = (0.17, 0.18, 0.21); BRASS = (0.79, 0.65, 0.29)
FLOWERS = [(1.0, 0.42, 0.54), (1.0, 0.85, 0.23), (1.0, 1.0, 1.0), (0.69, 0.48, 1.0)]

def gable_poly(span, rise, e, mat='plaster', color=(0.95, 0.95, 0.95), role=ROLE_WALL, M=None):
    t = TILE[mat]; x = span / 2
    V = [(-x, 0, 0), (x, 0, 0), (x, e, 0), (0, rise, 0), (-x, e, 0)]
    UV = [(px / t, -py / t) for px, py, _ in V]
    return place(_mk(V, UV, [(0, 0, 1)] * 5, [(0, 1, 2), (0, 2, 3), (0, 3, 4)], color, role), M)

def window(k, px, py, pz, ry, flowerbox=False, scale=1.0):
    M = lambda t=(0, 0, 0): T_((px, py, pz), ry=ry) @ T_(t)
    k.add('bois', box((1.15, 1.15, .12), 'bois', WOOD, M=M()))
    k.add('window', box((.9, .9, .14), 'window', (1, 1, 1), M=M()))
    k.add('bois', box((.06, .92, .16), 'bois', WOOD, M=M()))
    k.add('bois', box((.92, .06, .16), 'bois', WOOD, M=M()))
    for sx in (-1, 1):
        k.add('bois', box((.42, 1.05, .05), 'bois', (1, 1, 1), ROLE_TRIM, M=M((sx * .82, 0, .04))))
    if flowerbox:
        k.add('bois', box((1.2, .2, .28), 'bois', DWOOD, M=M((0, -.68, .16))))
        for i in range(6):
            k.add('metal', sphere(.09, 'metal', FLOWERS[(i + 1) % 4], M=M((-.5 + i * .2, -.52 + (i % 2) * .05, .18)), seg=5, rings=3))

def house(w, d, h, along_x, inn=False):
    k = Kit(); S, L = (d, w) if along_x else (w, d); rh = S * 0.62; o = 0.5
    top = h + 0.3
    k.add('pierre', box((w + .5, .8, d + .5), 'pierre', STONE, M=T_((0, .4, 0))))
    k.add('plaster', box((w, h, d), 'plaster', (0.96, 0.96, 0.96), ROLE_WALL, M=T_((0, .3 + h / 2, 0))))
    for sx in (-1, 1):
        for sz in (-1, 1):
            k.add('bois', box((.28, h + .1, .28), 'bois', WOOD, M=T_((sx * w / 2, .3 + h / 2, sz * d / 2))))
    # colombages : poutres horizontales et poteaux sur les quatre faces
    for sz in (-1, 1):
        for yy in (.3 + h * .5, top - .12):
            k.add('bois', box((w + .1, .14, .1), 'bois', WOOD, M=T_((0, yy, sz * (d / 2 + .03)))))
        for xx in (-w * .46, w * .46):
            k.add('bois', box((.12, h * .5, .1), 'bois', WOOD, M=T_((xx, .3 + h * .25 + .07, sz * (d / 2 + .03)))))
    for sx in (-1, 1):
        for yy in (.3 + h * .5, top - .12):
            k.add('bois', box((.1, .14, d + .1), 'bois', WOOD, M=T_((sx * (w / 2 + .03), yy, 0))))
    # toit : deux pans, faîtage, pignons — arête dans l'axe X puis pivot si besoin
    ry = 0.0 if along_x else np.pi / 2
    sl = np.hypot(S / 2 + o, rh); al = np.arctan2(rh, S / 2 + o)
    R0 = T_((0, top, 0), ry=ry)
    for sd in (-1, 1):
        nrm = np.array([0, np.cos(al), sd * np.sin(al)])
        c = np.array([0, rh / 2, sd * (S / 2 + o) / 2]) + nrm * .07
        k.add('tuile', box((L + 2 * o, .14, sl), 'tuile', (1, 1, 1), ROLE_ROOF, M=R0 @ T_(c, rx=sd * al)))
    k.add('bois', box((L + 2 * o + .2, .16, .24), 'bois', DWOOD, M=R0 @ T_((0, rh + .08, 0))))
    e = rh * o / (S / 2 + o)
    for sx in (-1, 1):
        k.add('plaster', gable_poly(S, rh * 0.99, e, M=R0 @ T_((sx * L / 2, 0, 0), ry=sx * np.pi / 2)))
    # cheminée
    cx, cz = w * .28, -d * .2
    cy0 = top + rh * .35
    k.add('pierre', box((.85, 2.5, .85), 'pierre', STONE, M=T_((cx, cy0 + 1.25, cz))))
    k.add('pierre', box((1.05, .18, 1.05), 'pierre', STONE, M=T_((cx, cy0 + 2.55, cz))))
    chim = [float(cx), float(cy0 + 2.7), float(cz)]
    # porte voûtée + seuil + marche
    fz = d / 2
    k.add('bois', box((1.25, 1.75, .2), 'bois', DWOOD, M=T_((0, .3 + .875, fz + .04))))
    k.add('bois', halfdisc(.625, 10, 'bois', DWOOD, M=T_((0, .3 + 1.75, fz + .14))))
    k.add('bois', halfdisc(.625, 10, 'bois', DWOOD, M=T_((0, .3 + 1.75, fz - .06), ry=np.pi)))
    k.add('pierre', box((1.7, .18, .16), 'pierre', STONE, M=T_((0, .34, fz + .12))))
    k.add('pierre', box((1.9, .18, .5), 'pierre', STONE, M=T_((0, .2, fz + .4))))
    k.add('metal', sphere(.05, 'metal', BRASS, M=T_((.4, 1.2, fz + .17)), seg=6, rings=4))
    # fenêtres
    wy = h * .62
    for sx in (-1, 1): window(k, sx * w * .3, wy, fz + .06, 0, True)
    window(k, w / 2 + .06, wy, 0, np.pi / 2); window(k, -w / 2 - .06, wy, 0, -np.pi / 2)
    window(k, 0, wy, -fz - .06, np.pi)
    # lanterne de porche
    k.add('window', sphere(.13, 'window', (1, 1, 1), M=T_((1.0, 2.4, fz + .28)), seg=7, rings=4))
    k.add('metal', box((.05, .4, .05), 'metal', IRON, M=T_((1.0, 2.65, fz + .2))))
    return k, {'chimney': chim, 'dims': [w, h, d], 'roofTop': float(top + rh)}

# ------------------------------------------------------------------------------------------- accessoires
HAY = (0.80, 0.66, 0.29)

def well():
    k = Kit()
    k.add('pierre', cyl(1.7, 1.5, 1.0, 16, 'pierre', STONE))
    k.add('water', cyl(1.15, 1.15, .05, 16, 'water', (1, 1, 1), M=T_((0, 1.0, 0))))
    k.add('pierre', torus(1.6, .14, 18, 6, 'pierre', STONE, M=T_((0, 1.0, 0))))
    for sx in (-1, 1):
        k.add('bois', cyl(.09, .09, 2.6, 6, 'bois', WOOD, M=T_((sx * 1.3, .8, 0))))
    k.add('bois', cyl(.07, .07, 2.8, 6, 'bois', DWOOD, M=T_((0, 2.85, 0), rz=np.pi / 2)))      # axe du treuil
    k.add('tuile', facet_pyramid(1.9, .9, 4, 'tuile', (0.42, 0.18, 0.18), M=T_((0, 3.15, 0), ry=np.pi / 4)))
    k.add('bois', cyl(.2, .16, .26, 8, 'bois', DWOOD, M=T_((.5, 1.0, .1))))
    k.add('metal', cyl(.015, .015, .9, 4, 'metal', IRON, M=T_((0, 1.95, 0))))
    return k, {}

def barrel():
    k = Kit()
    k.add('bois', cyl(.38, .42, .9, 12, 'bois', WOOD, M=T_((0, 0, 0))))
    k.add('bois', cyl(.45, .45, .02, 12, 'bois', DWOOD, M=T_((0, .45, 0)), caps=(False, False)))
    for y, r in ((.14, .405), (.45, .445), (.76, .415)):
        k.add('metal', torus(r, .022, 14, 4, 'metal', IRON, M=T_((0, y, 0))))
    return k, {}

def crate():
    k = Kit()
    k.add('bois', box((.8, .8, .8), 'bois', WOOD, M=T_((0, .4, 0))))
    for sx in (-1, 1):
        for sz in (-1, 1):
            k.add('bois', box((.1, .84, .1), 'bois', DWOOD, M=T_((sx * .36, .4, sz * .36))))
    for y in (.06, .74):
        k.add('bois', box((.84, .08, .84), 'bois', DWOOD, M=T_((0, y, 0))))
    return k, {}

def hay():
    k = Kit()
    k.add('plaster', cyl(.55, .55, .8, 10, 'plaster', HAY, M=T_((-.4, .55, 0), rz=-np.pi / 2), caps=(True, True)))
    for x in (-.1, .1):
        k.add('metal', torus(.555, .015, 12, 3, 'metal', (0.55, 0.45, 0.2), M=T_((0, .55, 0) + np.array([x, 0, 0]), rz=np.pi / 2)))
    return k, {}

def lamp():
    k = Kit()
    k.add('metal', cyl(.1, .07, 3.0, 6, 'metal', IRON))
    k.add('metal', box((.34, .06, .34), 'metal', IRON, M=T_((0, 3.02, 0))))
    k.add('metal', box((.34, .05, .34), 'metal', IRON, M=T_((0, 3.55, 0))))
    for sx in (-1, 1):
        for sz in (-1, 1):
            k.add('metal', box((.03, .5, .03), 'metal', IRON, M=T_((sx * .15, 3.3, sz * .15))))
    k.add('metal', facet_pyramid(.28, .22, 4, 'metal', IRON, M=T_((0, 3.58, 0), ry=np.pi / 4)))
    k.add('window', sphere(.2, 'window', (1, 1, 1), M=T_((0, 3.3, 0)), seg=8, rings=5))
    return k, {'bulb': [0, 3.3, 0]}

def sign_inn():
    k = Kit()
    k.add('metal', box((.1, .1, .8), 'metal', IRON, M=T_((0, .6, .4))))
    k.add('metal', box((.04, .3, .04), 'metal', IRON, M=T_((-.5, .42, .8))))
    k.add('metal', box((.04, .3, .04), 'metal', IRON, M=T_((.5, .42, .8))))
    k.add('bois', box((1.5, .9, .1), 'bois', (0.45, 0.31, 0.18), M=T_((0, -.1, .8), rz=.04)))
    k.add('metal', cyl(.22, .22, .02, 10, 'metal', BRASS, M=T_((0, -.1, .86), rx=np.pi / 2)))
    return k, {}

def chest_base():
    """V10.83 : coffre à planches (3 rangs de teintes légèrement différentes), cerclages de fer rivetés, coins renforcés, serrure."""
    k = Kit(); WD = [(0.56, 0.37, 0.2), (0.62, 0.42, 0.23), (0.52, 0.34, 0.18)]; FE = (0.19, 0.2, 0.23); GD = (0.85, 0.66, 0.23)
    for i in range(3):
        k.add('bois', box((.95 - .004 * i, .164, .6), 'bois', WD[i], uv=.55, M=T_((0, .085 + .166 * i, 0))))
    k.add('metal', box((.99, .045, .64), 'metal', FE, uv=.5, M=T_((0, .022, 0))))                       # cadre bas
    k.add('metal', box((.99, .04, .64), 'metal', FE, uv=.5, M=T_((0, .48, 0))))                          # cadre haut
    for sx in (-1, 1):
        k.add('metal', box((.085, .5, .64), 'metal', FE, uv=.5, M=T_((sx * .31, .25, 0))))               # cerclages
        for sy in (.1, .25, .4):
            for sz in (-.25, .25):
                k.add('metal', sphere(.022, 'metal', GD, M=T_((sx * .31, sy, sz * 1.31)), seg=6, rings=4))   # rivets (faces avant/arrière)
        for cx in (-1, 1):                                                                              # coins renforcés
            k.add('metal', box((.07, .5, .07), 'metal', FE, uv=.4, M=T_((cx * .46, .25, sx * .295))))
    k.add('metal', box((.15, .2, .05), 'metal', GD, uv=.3, M=T_((0, .4, .32))))                          # plaque de serrure
    k.add('metal', box((.03, .06, .06), 'metal', (0.1, 0.1, 0.12), uv=.3, M=T_((0, .39, .335))))         # trou de serrure
    k.add('metal', cyl(.012, .012, .1, 6, 'metal', GD, M=T_((0, .43, .345), rx=np.pi / 2)))
    return k, {}

def chest_lid():
    """Couvercle voûté : origine = charnière (arrière, haut du coffre) ; il s'étend vers +Z."""
    k = Kit(); FE = (0.19, 0.2, 0.23); GD = (0.85, 0.66, 0.23)
    k.add('bois', cyl(.31, .31, .97, 18, 'bois', (0.6, 0.4, 0.22), M=T_((-.485, 0, .31), rz=-np.pi / 2), arc=np.pi, a0=np.pi / 2, caps=(False, False)))
    for sx in (-1, 1):                                                                                   # cerclages sur la voûte
        k.add('metal', cyl(.325, .325, .085, 18, 'metal', FE, M=T_((sx * .31 - .0425, 0, .31), rz=-np.pi / 2), arc=np.pi, a0=np.pi / 2, caps=(False, False)))
    for sx in (-1, 1):                                                                                   # flancs pleins de la voûte
        k.add('bois', cyl(.31, .31, .035, 18, 'bois', (0.56, 0.37, 0.2), M=T_((sx * .4675 - .0175, 0, .31), rz=-np.pi / 2)))
    for z in (.02, .6):                                                                                  # deux pignons en planches
        k.add('bois', box((.95, .04, .03), 'bois', (0.56, 0.37, 0.2), uv=.5, M=T_((0, .02, z))))
    k.add('metal', box((.15, .12, .06), 'metal', GD, uv=.3, M=T_((0, .02, .625))))                       # languette de serrure
    return k, {'pivot': [0, .5, -.3]}
