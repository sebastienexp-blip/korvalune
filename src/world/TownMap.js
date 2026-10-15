// V10.39 — Plan de Korvalune (ville agrandie). Un seul endroit pour toutes les positions :
// Town.js (bâtiments), Game.js (PNJ, portails), Halloween, statue de la Spire, portail de retour.
// Repère : x vers l'est, z vers le sud ; le nord (z < 0) abrite les portails et l'arrière du château.
export const HALF = 62;            // demi-côté de l'enceinte
export const GATE_HW = 5.5;        // demi-largeur des quatre portes
export const TOWN_R = 82;          // rayon du terrain aplani (couvre les coins de l'enceinte)

// portes : nord, est, sud, ouest (axe de la porte)
export const GATES = {
  N: { x: 0, z: -HALF }, S: { x: 0, z: HALF }, E: { x: HALF, z: -10 }, W: { x: -HALF, z: -10 }
};

// château au centre : enceinte intérieure x ±22, z -28..8 (porte au sud, cour intérieure praticable)
export const CASTLE = { x: 0, z: -10, hw: 22, hd: 18, gateHW: 4.5, keepZ: -19 };

export const POS = {
  spawn: [0, 50],
  well: [0, 40],
  bank: [-12, 15],
  guard: [7, 57.5],
  gateGuards: { E: [57, -5.5], W: [-57, -5.5], N: [6.5, -57] },
  // quartier marchand (est)
  market: { x: 42, z: -6 },
  weaponsmith: [32, -17.1], armorsmith: [42, -17.1], apothecary: [52, -17.1],
  tilda: [42, 5.2], orsin: [52, 5.2],
  // artisans (ouest)
  smith: [-40, -12], forgeDecor: [-44, -12],
  mystic: [-33, -4], enchantBench: [-37, -4],
  // personnalisation (sud-ouest)
  monolith: [-43, 33], barberHouse: { x: -30, z: 45, w: 5.5, d: 5 }, barber: [-29.6, 49.2],
  // écurie et auberge (sud-est)
  stable: [42, 50], inn: { x: 25, z: 40, w: 12, d: 8 },
  // quêtes
  hugo: [-9, 55], laurine: [19.5, 46.5], sebastien: [-12, -4], morgane: [12, -4],
  // portails (nord)
  regionsPortal: [0, -50], returnPortal: [17, -45], statue: [-19, -46], statuePortal: [-19, -38.8]
};

// objets à laisser dégagés quand on sème les maisons : [x, z, rayon]
export const KEEP_CLEAR = [
  [0, 40, 17], [0, 50, 8], [-12, 15, 5], [7, 57.5, 5],
  [42, -6, 17], [-43, 33, 10], [-30, 49, 6], [42, 50, 15], [25, 46, 9],
  [-40, -12, 10], [-33, -4, 6], [-44, -22, 7], [-50, -4, 6], [-32, -22, 6],
  [0, -50, 12], [17, -45, 6], [-19, -43, 9], [0, -62, 9], [0, 62, 9], [62, -10, 9], [-62, -10, 9]
];

// zones d'habitation (rectangles x0, x1, z0, z1) où l'on sème des maisons
export const HOUSE_BLOCKS = [
  [26, 58, -58, -30], [-58, -26, -58, -30],      // nord-est, nord-ouest (devant les portails)
  [26, 58, 14, 32], [-58, -26, 10, 26],          // est, ouest (sous les quartiers marchand et artisan)
  [-58, -26, 52, 60], [24, 58, 28, 36]           // lisières sud
];
