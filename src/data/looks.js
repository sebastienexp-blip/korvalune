// V10.12 — Apparence du personnage : sexe, taille, corpulence, musculature, visage, coiffure, pilosité.
// Module PUR (aucune dépendance) : partagé par le jeu (création, barbier, modèle 3D) et par le serveur
// (server.js valide l'apparence reçue avec normalizeLook / sanitizeAppearance).
// Les couleurs gardent leurs champs historiques dans la sauvegarde : skin, hairCol, eyeCol.
// Les formes vont dans save.look. Une ancienne sauvegarde sans « look » garde exactement son apparence.

export const LOOK_SEXES = [
  { id: 'homme', label: 'Homme' },
  { id: 'femme', label: 'Femme' }
];

// Taille en cm. 178 = taille du modèle d'origine (échelle 1).
export const HEIGHT_RANGE = { min: 150, max: 205, base: 178, def: { homme: 178, femme: 167 } };
// Corpulence 0 (très mince) → 100 (forte). 45 = silhouette d'origine.
export const WEIGHT_RANGE = { min: 0, max: 100, base: 45, def: { homme: 45, femme: 38 } };
// Musculature 0 (frêle) → 100 (colosse). 40 = silhouette d'origine.
export const MUSCLE_RANGE = { min: 0, max: 100, base: 40, def: { homme: 40, femme: 30 } };

// Formes de visage : multiplicateurs appliqués au crâne, à la mâchoire et au menton du modèle.
// « ovale » = visage d'origine (tout à 1).
export const FACE_SHAPES = [
  { id: 'ovale', label: 'Ovale', skull: [1, 1], jaw: [1, 1], chin: [1, 1] },
  { id: 'rond', label: 'Rond', skull: [1.06, 0.96], jaw: [1.1, 0.95], chin: [1.12, 0.85] },
  { id: 'carre', label: 'Carré', skull: [1.04, 0.99], jaw: [1.16, 1.06], chin: [1.3, 0.95] },
  { id: 'long', label: 'Allongé', skull: [0.94, 1.08], jaw: [0.92, 1.14], chin: [0.95, 1.2] },
  { id: 'coeur', label: 'Cœur', skull: [1.05, 1.02], jaw: [0.85, 1.02], chin: [0.75, 1.05] },
  { id: 'anguleux', label: 'Anguleux', skull: [0.97, 1.04], jaw: [1.05, 1.0], chin: [0.85, 1.15], cheek: 1.35 }
];

export const EYE_STYLES = [
  { id: 'normaux', label: 'Classiques', scale: [1, 1] },
  { id: 'amande', label: 'Amande', scale: [1.12, 0.8] },
  { id: 'ronds', label: 'Ronds', scale: [1.05, 1.12] },
  { id: 'etroits', label: 'Étroits', scale: [1.12, 0.62] },
  { id: 'grands', label: 'Grands', scale: [1.2, 1.18] }
];

// w = largeur, l = longueur, d = relief
export const NOSE_STYLES = [
  { id: 'droit', label: 'Droit', scale: [1, 1, 1] },
  { id: 'fin', label: 'Fin', scale: [0.78, 0.95, 0.9] },
  { id: 'retrousse', label: 'Retroussé', scale: [0.92, 0.8, 1.1] },
  { id: 'large', label: 'Large', scale: [1.4, 0.95, 1] },
  { id: 'aquilin', label: 'Aquilin', scale: [0.95, 1.22, 1.25] }
];

export const FACIAL_HAIR = [
  { id: 'aucune', label: 'Aucune' },
  { id: 'barbe-3-jours', label: 'Barbe de 3 jours' },
  { id: 'moustache', label: 'Moustache' },
  { id: 'bouc', label: 'Bouc' },
  { id: 'barbe-courte', label: 'Barbe courte' },
  { id: 'barbe-longue', label: 'Barbe longue' }
];

// category : 'homme', 'femme' ou 'mixte' (filtre de l'interface uniquement : tout est accessible à tous).
// bulky : volume qui dépasserait d'un casque → caché quand un casque est porté.
export const HAIR_STYLES = [
  { id: 'classique', label: 'Classique', category: 'mixte' },
  { id: 'chauve', label: 'Chauve', category: 'mixte' },
  { id: 'crane-rase', label: 'Crâne rasé', category: 'mixte' },
  { id: 'coupe-courte', label: 'Coupe courte', category: 'homme' },
  { id: 'undercut', label: 'Undercut', category: 'homme' },
  { id: 'iroquoise', label: 'Iroquoise', category: 'mixte', bulky: true },
  { id: 'boucles-courtes', label: 'Boucles courtes', category: 'homme' },
  { id: 'afro', label: 'Afro', category: 'mixte', bulky: true },
  { id: 'dreadlocks', label: 'Dreadlocks', category: 'mixte' },
  { id: 'catogan', label: 'Chignon guerrier', category: 'homme', bulky: true },
  { id: 'mi-longs', label: 'Mi-longs', category: 'mixte' },
  { id: 'tresses-plaquees', label: 'Tresses plaquées', category: 'mixte' },
  { id: 'carre', label: 'Carré', category: 'femme' },
  { id: 'pixie', label: 'Pixie', category: 'femme' },
  { id: 'queue-de-cheval', label: 'Queue-de-cheval', category: 'femme' },
  { id: 'longs-lisses', label: 'Longs lisses', category: 'femme' },
  { id: 'tresse', label: 'Tresse', category: 'femme' },
  { id: 'chignon', label: 'Chignon', category: 'femme', bulky: true },
  { id: 'couettes', label: 'Couettes', category: 'femme' },
  { id: 'boucles-longues', label: 'Boucles longues', category: 'femme' },
  { id: 'afro-volumineux', label: 'Afro volumineux', category: 'femme', bulky: true },
  { id: 'tresses-box', label: 'Box braids', category: 'femme' },
  { id: 'rase-cote', label: 'Rasé sur le côté', category: 'femme' }
];

// Palettes (reprises de l'écran de création d'origine + quelques teintes)
export const HAIR_COLORS = [0x2c1f16, 0x0f0d0c, 0x6b4426, 0xb5803a, 0xd9c079, 0x9c3a22, 0xc9ccd2, 0x2f5f8a, 0x6a3a8a, 0xb8541f, 0xf0efea, 0x2f6d3c, 0xd46b9b];
export const EYE_COLORS = [0x3f78b0, 0x3d7a4a, 0x6b4a2a, 0x7a8a96, 0x8a5aa8, 0xb08a2a, 0x4a2c17];

// Prix chez le barbier (pièces d'or du jeu). Chaque catégorie modifiée est payée une fois. Création : gratuit.
export const LOOK_PRICES = {
  sex: { label: 'Changement de sexe', price: 600 },
  body: { label: 'Silhouette', price: 400 },
  face: { label: 'Traits du visage', price: 300 },
  hair: { label: 'Coupe', price: 150 },
  hairCol: { label: 'Coloration', price: 80 },
  eyeCol: { label: 'Couleur des yeux', price: 60 },
  beard: { label: 'Barbe', price: 100 }
};
const PRICE_FIELDS = {
  sex: ['sex'], body: ['height', 'weight', 'muscle'], face: ['face', 'eyes', 'nose'],
  hair: ['hair'], hairCol: ['hairCol'], eyeCol: ['eyeCol'], beard: ['beard']
};

const has = (list, id) => list.some((x) => x.id === id);
export const byId = (list, id) => list.find((x) => x.id === id) || list[0];
export const hairStyleOf = (id) => byId(HAIR_STYLES, id);

export function defaultLook(sex = 'homme') {
  const s = sex === 'femme' ? 'femme' : 'homme';
  return {
    sex: s, height: HEIGHT_RANGE.def[s], weight: WEIGHT_RANGE.def[s], muscle: MUSCLE_RANGE.def[s],
    face: 'ovale', eyes: 'normaux', nose: 'droit', hair: s === 'femme' ? 'longs-lisses' : 'classique', beard: 'aucune'
  };
}

const clampInt = (v, r, fb) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(r.max, Math.max(r.min, n)) : fb; };

// Apparence (formes) toujours valide. Sans entrée : le personnage d'origine (homme, classique).
export function normalizeLook(input) {
  const src = input && typeof input === 'object' ? input : {};
  const sex = src.sex === 'femme' ? 'femme' : 'homme';
  const d = defaultLook(sex);
  return {
    sex,
    height: clampInt(src.height, HEIGHT_RANGE, d.height),
    weight: clampInt(src.weight, WEIGHT_RANGE, d.weight),
    muscle: clampInt(src.muscle, MUSCLE_RANGE, d.muscle),
    face: has(FACE_SHAPES, src.face) ? src.face : d.face,
    eyes: has(EYE_STYLES, src.eyes) ? src.eyes : d.eyes,
    nose: has(NOSE_STYLES, src.nose) ? src.nose : d.nose,
    hair: has(HAIR_STYLES, src.hair) ? src.hair : d.hair,
    beard: has(FACIAL_HAIR, src.beard) ? src.beard : d.beard
  };
}

const isColor = (c) => Number.isInteger(c) && c >= 0 && c <= 0xffffff;

// Apparence complète visible des autres joueurs : formes + couleurs.
export function sanitizeAppearance(a) {
  const src = a && typeof a === 'object' ? a : {};
  return {
    ...normalizeLook(src.look ?? src),
    skin: isColor(src.skin) ? src.skin : null,
    hairCol: isColor(src.hairCol) ? src.hairCol : 0x2c1f16,
    eyeCol: isColor(src.eyeCol) ? src.eyeCol : 0x3f78b0
  };
}

// Coût d'un passage chez le barbier. before/after : { ...look, hairCol, eyeCol }
export function computeLookCost(before, after, prices = LOOK_PRICES) {
  const a = { ...normalizeLook(before), hairCol: before?.hairCol, eyeCol: before?.eyeCol };
  const b = { ...normalizeLook(after), hairCol: after?.hairCol, eyeCol: after?.eyeCol };
  const items = [];
  for (const [key, fields] of Object.entries(PRICE_FIELDS)) {
    if (fields.some((f) => a[f] !== b[f])) items.push({ key, label: prices[key].label, price: prices[key].price });
  }
  return { total: items.reduce((s, i) => s + i.price, 0), items };
}

// Facteurs de silhouette pour le modèle 3D (1 = modèle d'origine).
export function bodyFactors(look) {
  const L = normalizeLook(look);
  const w = (L.weight - WEIGHT_RANGE.base) / 100; // -0.45 … +0.55
  const m = (L.muscle - MUSCLE_RANGE.base) / 100; // -0.40 … +0.60
  const f = L.sex === 'femme';
  return {
    scale: L.height / HEIGHT_RANGE.base,
    girth: 1 + w * 0.62 + m * 0.08,                     // tour du torse
    shoulders: (f ? 0.9 : 1) * (1 + m * 0.18 + w * 0.06), // largeur d'épaules
    hips: (f ? 1.1 : 1) * (1 + w * 0.5),                 // bassin
    arms: (f ? 0.88 : 1) * (1 + m * 0.55 + w * 0.4),     // épaisseur des bras
    legs: (f ? 0.95 : 1) * (1 + m * 0.3 + w * 0.42),     // épaisseur des jambes
    female: f
  };
}
