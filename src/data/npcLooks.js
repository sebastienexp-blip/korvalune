// V10.75 — Apparence des PNJ : même corps et même tête modélisés que le personnage joueur, mais visage, coiffure, pilosité, silhouette,
// teint et couleurs propres à chaque PNJ. Tirage DÉTERMINISTE (graine = identifiant du PNJ) : un PNJ garde le même visage à chaque session.
// Module pur (aucune dépendance au rendu).
import { FACE_SHAPES, EYE_STYLES, NOSE_STYLES, HAIR_STYLES, FACIAL_HAIR, HAIR_COLORS, EYE_COLORS, HEIGHT_RANGE, WEIGHT_RANGE, MUSCLE_RANGE, normalizeLook } from './looks.js';

function seedOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// teints variés (aucun ne correspond exactement à une race jouable : pas d'oreilles pointues ni de crocs par accident)
const SKINS = [0xd9a98b, 0xf0d2b8, 0xc98f6b, 0xb98462, 0x8d5a3b, 0x6b4429, 0xe8bf9f];
const FEM = /(ière|iere|onne|ante\b|euse|ère\b|Marchande|Mystique|Herboriste|Archiviste|Rhoda|Lysa|Sella|Morgane|Laurine|Mira|Nessa|Odile|Wren|Helga|Maelis)/i;
const MIL = /(garde|capitaine|sentinelle|guard|captain|sentinel|gate)/i;

export const isGuardNpc = (def) => MIL.test(`${def.id || ''} ${def.name || ''}`);

/** Apparence complète d'un PNJ → { look, skin, hair, eye, cloth }. Les champs déjà fixés dans npcs.json (teint, forme, cheveux) sont respectés. */
export function npcAppearance(def) {
  const key = String(def.id || def.name || 'pnj'), L = def.look || {}, R = rngOf(seedOf(key));
  const pick = (a) => a[Math.floor(R() * a.length) % a.length];
  const fixed = L.shape ? normalizeLook(L.shape) : null;
  const sex = fixed ? fixed.sex : (L.sex || (FEM.test(`${def.name || ''} ${key}`) ? 'femme' : 'homme'));
  const guard = isGuardNpc(def), smith = /forgeron|smith|armur/i.test(`${def.name || ''} ${key}`);
  const cats = [sex, 'mixte'];
  let hairPool = HAIR_STYLES.filter((h) => cats.includes(h.category) && h.id !== 'chauve' && h.id !== 'iroquoise' && h.id !== 'dreadlocks');
  if (guard) hairPool = hairPool.filter((h) => !h.bulky);
  const bald = sex === 'homme' && !guard && R() < 0.08;
  const lerp = (r, t) => Math.round(r.min + (r.max - r.min) * t);
  const rnd = (a, b) => a + (b - a) * R();
  const look = fixed || normalizeLook({
    sex,
    height: sex === 'femme' ? lerp(HEIGHT_RANGE, rnd(0.14, 0.42)) : lerp(HEIGHT_RANGE, rnd(0.32, 0.78)),
    weight: lerp(WEIGHT_RANGE, rnd(0.22, 0.72)),
    muscle: lerp(MUSCLE_RANGE, guard || smith ? rnd(0.55, 0.8) : rnd(0.15, 0.5)),
    face: pick(FACE_SHAPES).id, eyes: pick(EYE_STYLES).id, nose: pick(NOSE_STYLES).id,
    hair: bald ? 'chauve' : pick(hairPool).id,
    beard: sex === 'homme' && R() < 0.4 ? pick(FACIAL_HAIR.filter((b) => b.id !== 'aucune')).id : 'aucune'
  });
  const skin = L.skin != null ? L.skin : pick(SKINS);
  const hair = L.hair != null ? L.hair : pick(HAIR_COLORS);
  return { look, skin, hair, eye: pick(EYE_COLORS), cloth: L.cloth };
}
