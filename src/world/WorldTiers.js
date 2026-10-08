import { REGION_BY_ID, regionAt } from './Continent.js';

// V8.0 — Les « paliers » du continent : une famille d'ennemis + des contrats par grande région. Tout est relié à pied
// (pas de portails). Les niveaux couvrent 1 → 200 ; chaque région garde sa propre tranche (voir Continent.js).
// Le palier 1 regroupe Prairies + Forêt + Montagnes (faune de base) ; les autres paliers correspondent chacun à une région.
const fam = (suffix) => ['wolf', 'boar', 'bear', 'marauder', 'brute', 'rat', 'zealot', 'troll', 'archer', 'mage'].map((s) => `${s}_${suffix}`);
const rg = (id) => REGION_BY_ID[id];

export const WORLD_TIERS = [
  { id: 1, regionId: 'prairie', regions: ['prairie', 'forest', 'mount'], name: "Prairies de Korvalune", unlockLevel: 1, levelRange: [1, 32], color: '#8fd0ff' },
  { id: 6, regionId: 'desert', name: rg('desert').name, unlockLevel: 28, levelRange: rg('desert').levels, color: rg('desert').color, center: rg('desert').site, radius: 140,
    species: fam('sand'), elite: 'warden_sand' },
  { id: 7, regionId: 'swamp', name: rg('swamp').name, unlockLevel: 40, levelRange: rg('swamp').levels, color: rg('swamp').color, center: rg('swamp').site, radius: 130,
    species: fam('swamp'), elite: 'warden_swamp' },
  { id: 8, regionId: 'tundra', name: rg('tundra').name, unlockLevel: 55, levelRange: rg('tundra').levels, color: rg('tundra').color, center: rg('tundra').site, radius: 140,
    species: fam('frost'), elite: 'warden_frost' },
  { id: 2, regionId: 'corrupt', name: rg('corrupt').name, unlockLevel: 75, levelRange: rg('corrupt').levels, color: rg('corrupt').color, center: rg('corrupt').site, radius: 135,
    species: ['wolf_corrupted', 'boar_corrupted', 'bear_corrupted', 'marauder_corrupted', 'brute_corrupted', 'rat_corrupted', 'zealot_corrupted', 'troll_corrupted', 'archer_corrupted', 'mage_corrupted'], elite: 'warden_corrupted' },
  { id: 3, regionId: 'celeste', name: rg('celeste').name, unlockLevel: 100, levelRange: rg('celeste').levels, color: rg('celeste').color, center: rg('celeste').site, radius: 120,
    species: ['wolf_celestial', 'boar_celestial', 'bear_celestial', 'sentinel_celestial', 'brute_celestial', 'rat_celestial', 'zealot_celestial', 'troll_celestial', 'archer_celestial', 'mage_celestial'], elite: 'warden_celestial' },
  { id: 4, regionId: 'abyss', name: rg('abyss').name, unlockLevel: 125, levelRange: rg('abyss').levels, color: rg('abyss').color, center: rg('abyss').site, radius: 130,
    species: ['wraith_abyssal', 'behemoth_abyssal', 'bear_abyssal', 'marauder_abyssal', 'brute_abyssal', 'rat_abyssal', 'zealot_abyssal', 'troll_abyssal', 'archer_abyssal', 'mage_abyssal'], elite: 'harbinger_abyssal' },
  { id: 5, regionId: 'void', name: rg('void').name, unlockLevel: 150, levelRange: rg('void').levels, color: rg('void').color, center: rg('void').site, radius: 120,
    species: ['stalker_primordial', 'colossus_primordial', 'bear_primordial', 'herald_primordial', 'brute_primordial', 'rat_primordial', 'zealot_primordial', 'troll_primordial', 'archer_primordial', 'mage_primordial'], elite: 'sovereign_primordial',
    capstoneBoss: { name: 'Le Souverain du Néant', level: 195 } }
];

export function tierById(id) { return WORLD_TIERS.find((t) => t.id === id); }
// palier correspondant à une région (les Prairies, la Forêt et les Montagnes partagent le palier 1)
export function tierForRegion(regionId) { return WORLD_TIERS.find((t) => t.regionId === regionId || (t.regions && t.regions.includes(regionId))) || WORLD_TIERS[0]; }
export function tierAt(x, z) { return tierForRegion(regionAt(x, z).id); }
