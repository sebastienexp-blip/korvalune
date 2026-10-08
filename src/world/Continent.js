import { fbm } from './noise.js';

// V8.0 — LE CONTINENT. Une seule source de vérité pour la géographie : régions aux frontières irrégulières
// (diagramme de Voronoï déformé par du bruit), littoral irrégulier entouré d'océan, niveaux 1 → 200.
// Utilisé par le relief (World), les ennemis (Game), la détection de zone (ZoneManager) et les cartes.
export const REGIONS = [
  { id: 'prairie', name: "Prairies de Korvalune", site: [0, -10], w: 1.5, levels: [1, 12], color: '#8fd06a', tint: 0xc2c8b8 },
  { id: 'forest', name: 'Forêt des Ombres', site: [-215, 35], w: 1.0, levels: [10, 24], color: '#2f7a3a', tint: 0x273a2a },
  { id: 'mount', name: 'Montagnes de Fer', site: [45, 232], w: 1.2, levels: [15, 32], color: '#9aa0a8', tint: 0x9098a8 },
  { id: 'desert', name: "Désert d'Ambre", site: [255, 65], w: 1.0, levels: [28, 50], color: '#e0b14f', tint: 0xe6cf9a },
  { id: 'swamp', name: 'Marais de Brume', site: [-185, 240], w: 0.9, levels: [40, 65], color: '#6f8a3c', tint: 0x6f7f58 },
  { id: 'tundra', name: 'Toundra de Givre', site: [-15, -300], w: 1.0, levels: [55, 80], color: '#cfe6f2', tint: 0xcfdde8 },
  { id: 'corrupt', name: 'Terres Corrompues', site: [275, -225], w: 0.95, levels: [75, 105], color: '#9b5fd4', tint: 0x6a4a82 },
  { id: 'celeste', name: 'Royaume Céleste', site: [60, 360], w: 1.05, levels: [100, 130], color: '#ffe9a8', tint: 0xf2e6b8 },
  { id: 'abyss', name: 'Abysses Oubliées', site: [-345, -175], w: 0.9, levels: [125, 160], color: '#ff5a3a', tint: 0x6a3a30 },
  { id: 'void', name: 'Néant Primordial', site: [300, 250], w: 1.0, levels: [150, 200], color: '#ff8a3a', tint: 0x4a3a5a }
];
export const REGION_INDEX = Object.fromEntries(REGIONS.map((r, i) => [r.id, i]));
export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
const M = 22; // largeur (en unités de distance pondérée) du fondu entre deux régions

const _res = { best: 0, w: new Float32Array(REGIONS.length), t: new Float32Array(REGIONS.length), d: new Float32Array(REGIONS.length) };
let _cx = NaN, _cz = NaN;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Calcule (avec un cache d'un seul point) le poids de chaque région en (x, z).
export function regionField(x, z) {
  if (x === _cx && z === _cz) return _res;
  _cx = x; _cz = z;
  // frontières déformées : ondulations larges + dentelures fines
  const wx = x + (fbm(x * 0.0065 + 50, z * 0.0065 + 50, 3) - 0.45) * 150 + (fbm(x * 0.024 + 9, z * 0.024 + 3, 2) - 0.45) * 26;
  const wz = z + (fbm(x * 0.0065 + 120, z * 0.0065 + 90, 3) - 0.45) * 150 + (fbm(x * 0.024 + 77, z * 0.024 + 41, 2) - 0.45) * 26;
  let d1 = 1e9, d2 = 1e9, b = 0;
  const d = _res.d;
  for (let i = 0; i < REGIONS.length; i++) {
    const R = REGIONS[i];
    const v = Math.hypot(wx - R.site[0], wz - R.site[1]) / R.w;
    d[i] = v;
    if (v < d1) { d2 = d1; d1 = v; b = i; } else if (v < d2) d2 = v;
  }
  _res.best = b;
  for (let i = 0; i < REGIONS.length; i++) {
    const margin = ((i === b ? d2 : d1) - d[i]) / M; // > 0 à l'intérieur de la région i
    _res.w[i] = sm(-1, 1, margin);
    _res.t[i] = sm(0, 2.4, margin); // « profondeur » : 0 à la frontière, 1 au cœur
  }
  return _res;
}

export function regionAt(x, z) { return REGIONS[regionField(x, z).best]; }

// Littoral : distance signée à la côte (négative = terre). Rayon variable selon l'angle + bruit.
export function coastD(x, z) {
  const a = Math.atan2(z, x);
  const R = 425 + 38 * Math.sin(2 * a + 1.3) + 24 * Math.sin(3 * a + 4.1) + 14 * Math.sin(5 * a + 0.4) + (fbm(x * 0.006 + 90, z * 0.006 + 90, 3) - 0.45) * 70;
  return Math.hypot(x, z) - R;
}
export const isLand = (x, z) => coastD(x, z) < -6;
