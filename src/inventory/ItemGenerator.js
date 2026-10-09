import { RARITIES, getRarity, rollRarityTier } from '../data/rarities.js';
import { WEAPON_BASES, ARMOR_BASES, ACCESSORY_BASES, ACCESSORY_STAT_POOL, NAME_PREFIXES, NAME_SUFFIXES, namePoolForTier } from '../data/itemBases.js';
import { AFFIX_POOL, rollAffixValue } from '../data/affixPool.js';
import { CLASS_WEAPONS } from '../combat/WeaponRules.js';
import { SETS_BY_CLASS, SET_SLOTS } from '../data/sets.js';
import { effectsAvailableForTier, rollEffectChance } from '../data/itemEffectPool.js';
import { getDifficulty } from '../data/difficulty.js';

export const MAX_ITEM_LEVEL = 200;
let lootClass = null;
// V7.2 : le butin s'adapte à la classe du joueur (armes de sa famille, stats principales utiles)
const IRRELEVANT_STATS = { warrior: ['int', 'agi'], paladin: ['int', 'agi'], mage: ['str', 'agi'], archer: ['str', 'int'], assassin: ['str', 'int'] };
const CLASS_ACC_STATS = { warrior: ['str', 'vit', 'luck'], paladin: ['vit', 'spi', 'str'], mage: ['int', 'spi', 'vit'], archer: ['agi', 'luck', 'vit'], assassin: ['agi', 'luck', 'vit'] };
const CLASS_WEAPON_CHANCE = 1; // 100 % : un mage ne trouve que des armes de mage
let uidCounter = 1;
function nextGenId() { return 'gi' + (uidCounter++) + '_' + Math.floor(Math.random() * 1e6).toString(36); }

const DESCRIPTIONS = [
  "Un objet dont l'origine s'est perdue dans le temps.",
  'On raconte que son premier possesseur ne fut jamais retrouvé.',
  'Forgé loin des regards, dans un atelier oublié.',
  "Une aura discrète s'en dégage, même au repos.",
  "Il semble avoir traversé bien plus d'une bataille.",
  "Certains disent qu'il chuchote la nuit venue.",
  "Récupéré sur les lieux d'un affrontement ancien."
];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const pool = arr.slice();
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

function buildName(baseName, tier) {
  const pool = namePoolForTier(tier);
  const prefixes = NAME_PREFIXES[pool], suffixes = NAME_SUFFIXES[pool];
  if (pool === 'low') return `${pickRandom(prefixes)} ${baseName}`;
  const usePrefix = Math.random() < 0.7;
  const useSuffix = suffixes.length && Math.random() < 0.6;
  let name = usePrefix ? `${pickRandom(prefixes)} ${baseName}` : baseName;
  if (useSuffix) name += ` ${pickRandom(suffixes)}`;
  return name;
}

function rollAffixes(rarity, itemLevel) {
  if (rarity.maxAffixes <= 0) return [];
  const lo = rarity.minAffixes || 0;
  const count = lo + Math.round(Math.random() * (rarity.maxAffixes - lo));
  if (count <= 0) return [];
  const bad = (lootClass && IRRELEVANT_STATS[lootClass]) || [];
  const chosen = pickN(AFFIX_POOL.filter((a) => !bad.includes(a.key)), count);
  return chosen.map((a) => ({ key: a.key, kind: a.kind, label: a.label, value: rollAffixValue(a, itemLevel, rarity) }));
}

function rollEffects(rarity, tier) {
  if (rarity.maxEffects <= 0) return [];
  const pool = effectsAvailableForTier(tier);
  if (!pool.length) return [];
  const lo = rarity.minEffects || 0;
  const count = Math.min(pool.length, lo + Math.round(Math.random() * (rarity.maxEffects - lo)));
  if (count <= 0) return [];
  const chosen = pickN(pool, count);
  return chosen.map((e) => ({
    id: e.id, name: e.name, triggerOn: e.triggerOn, dmgType: e.dmgType || null,
    power: e.power || 0, healPct: e.healPct || 0, aoe: !!e.aoe, range: e.range || 4,
    cooldown: e.cooldown, chance: rollEffectChance(e),
    ...(e.staminaPct ? { staminaPct: e.staminaPct } : {}), ...(e.manaPct ? { manaPct: e.manaPct } : {}),
    ...(e.slowSec ? { slowSec: e.slowSec, slowF: e.slowF } : {}), ...(e.stunSec ? { stunSec: e.stunSec } : {}),
    ...(e.dotSec ? { dotSec: e.dotSec, dotPower: e.dotPower } : {}), ...(e.wardSec ? { wardSec: e.wardSec } : {})
  }));
}

// Génère un objet complet (arme, armure ou accessoire) pour un niveau
// d'objet et une rareté donnés. C'est la fonction centrale du système —
// tout le loot procédural (ennemis, boss, coffres) passe par elle.
export function generateItem({ category, baseKey, itemLevel = 1, rarityTier = 1 }) {
  const rarity = getRarity(rarityTier);
  itemLevel = Math.min(MAX_ITEM_LEVEL, Math.max(1, Math.round(itemLevel))); // V8.0 : niveau 200 maximum
  const levelReq = Math.min(MAX_ITEM_LEVEL, Math.max(1, itemLevel - 2));

  let type, slot, visual, icon, baseName, stats = {};

  if (category === 'weapon') {
    const cw = lootClass && CLASS_WEAPONS[lootClass];
    const key = baseKey && WEAPON_BASES[baseKey] ? baseKey : (cw && Math.random() < CLASS_WEAPON_CHANCE ? pickRandom(cw) : pickRandom(Object.keys(WEAPON_BASES)));
    const b = WEAPON_BASES[key];
    type = 'weapon'; slot = 'mainhand'; visual = b.visual; icon = b.icon; baseName = b.name;
    stats.atk = Math.max(1, Math.round((b.base + itemLevel * b.perLevel) * rarity.statMult));
    if (b.bonusCrit) stats.crit = Math.round(b.bonusCrit * rarity.statMult * 1000) / 1000;
    if (b.bonusStat) stats[b.bonusStat] = Math.max(1, Math.round(itemLevel * 0.15 * rarity.statMult));
    baseKey = key;
  } else if (category === 'armor') {
    const key = baseKey && ARMOR_BASES[baseKey] ? baseKey : pickRandom(Object.keys(ARMOR_BASES));
    const b = ARMOR_BASES[key];
    type = 'armor'; slot = b.slot; visual = null; icon = b.icon; baseName = b.name;
    stats.def = Math.max(1, Math.round((b.base + itemLevel * b.perLevel) * rarity.statMult));
    stats.hp = Math.max(1, Math.round((b.hpBase + itemLevel * b.hpPerLevel) * rarity.statMult));
    baseKey = key;
  } else { // accessory
    const key = baseKey && ACCESSORY_BASES[baseKey] ? baseKey : pickRandom(Object.keys(ACCESSORY_BASES));
    const b = ACCESSORY_BASES[key];
    type = 'armor'; slot = b.slot; visual = null; icon = b.icon; baseName = b.name;
    const statKey = pickRandom(lootClass && CLASS_ACC_STATS[lootClass] ? CLASS_ACC_STATS[lootClass] : ACCESSORY_STAT_POOL);
    stats[statKey] = Math.max(1, Math.round((1 + itemLevel * 0.2) * rarity.statMult));
    baseKey = key;
  }

  const affixes = rollAffixes(rarity, itemLevel);
  const effects = rollEffects(rarity, rarity.tier);

  const primaryValueBasis = Object.values(stats).reduce((a, b2) => a + (typeof b2 === 'number' ? Math.abs(b2) : 0), 0);
  const value = Math.max(1, Math.round((8 + itemLevel * 1.4 + primaryValueBasis * 1.8) * rarity.valueMult));

  return {
    uid: nextGenId(),
    category, baseKey, type, slot, visual, icon,
    name: buildName(baseName, rarity.tier),
    rarityTier: rarity.tier,
    itemLevel, levelReq,
    stats, affixes, effects,
    value,
    desc: pickRandom(DESCRIPTIONS),
    stackable: false
  };
}

// Point d'entrée pour le butin : choisit une catégorie (arme/armure/
// accessoire), une rareté (pondérée, avec décalage optionnel pour les
// boss), un niveau d'objet proche de `sourceLevel`, puis génère l'objet.
export function setLootClass(c) { lootClass = c; }
// V10.18 : tout le butin a un niveau d'objet de 0 à 5 niveaux AU-DESSUS du niveau du joueur, quel que soit le niveau du monstre vaincu.
let lootLevel = 0;
export function setLootLevel(n) { lootLevel = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0; }
export function rollItemLevel(fallback = 1) {
  return Math.min(MAX_ITEM_LEVEL, Math.max(1, (lootLevel > 0 ? lootLevel : fallback) + Math.floor(Math.random() * 6)));
}

// Pièce de set pour une classe : statistiques de rareté Légendaire (+15 %), 3 à 5 affixes, pas d'effet aléatoire
// (l'effet vient du bonus de set à 6 pièces).
export function generateSetItem(setDef, pieceIdx, itemLevel) {
  const sl = SET_SLOTS[pieceIdx];
  const it = generateItem({ category: sl.category, baseKey: sl.category === 'weapon' ? setDef.weapon : sl.baseKey, itemLevel: Math.max(setDef.minLevel, itemLevel), rarityTier: 13 });
  for (const k of Object.keys(it.stats)) if (typeof it.stats[k] === 'number' && k !== 'crit') it.stats[k] = Math.max(1, Math.round(it.stats[k] * 1.15));
  it.effects = [];
  it.name = setDef.pieces[pieceIdx];
  it.setId = setDef.id; it.setPiece = pieceIdx;
  it.value = Math.round(it.value * 1.5);
  it.desc = `Pièce du set « ${setDef.name} ».`;
  return it;
}
export function rollSetItem(sourceLevel, itemLevel) {
  const sets = (SETS_BY_CLASS[lootClass] || []).filter((s) => s.minLevel <= sourceLevel + 6);
  if (!sets.length) return null;
  const set = sets[Math.floor(Math.random() * sets.length)];
  return generateSetItem(set, Math.floor(Math.random() * 6), itemLevel);
}
export const SET_DROP_CHANCE = 0.4; // part des objets Légendaire+ qui deviennent une pièce de set

export function rollLootItem({ sourceLevel = 1, tierShift = 0, minTier = 1, maxTier = 25, levelSpread = [-1, 3] } = {}) {
  if (lootLevel > 0) { sourceLevel = lootLevel; levelSpread = [0, 5]; }
  tierShift += getDifficulty().shift; // difficulté choisie : plus de raretés élevées
  const roll = Math.random();
  const category = roll < 0.4 ? 'weapon' : roll < 0.8 ? 'armor' : 'accessory';
  const rarityTier = rollRarityTier({ shift: tierShift, minTier, maxTier });
  const [lo, hi] = levelSpread;
  const itemLevel = Math.max(1, sourceLevel + Math.floor(lo + Math.random() * (hi - lo + 1)));
  if (rarityTier >= 13 && lootClass && Math.random() < SET_DROP_CHANCE) { const si = rollSetItem(sourceLevel, itemLevel); if (si) return si; }
  return generateItem({ category, itemLevel, rarityTier });
}

// V10.19 — Mystique : tire UN nouvel affixe (différent de ceux déjà présents) pour un objet de ce niveau et de cette rareté.
export function rollReplacementAffix(excludeKeys, itemLevel, rarityTier) {
  const rarity = getRarity(rarityTier);
  const bad = (lootClass && IRRELEVANT_STATS[lootClass]) || [];
  const pool = AFFIX_POOL.filter((a) => !excludeKeys.includes(a.key) && !bad.includes(a.key));
  const a = pickRandom(pool.length ? pool : AFFIX_POOL.filter((x) => !excludeKeys.includes(x.key)));
  return { key: a.key, kind: a.kind, label: a.label, value: rollAffixValue(a, itemLevel, rarity) };
}
