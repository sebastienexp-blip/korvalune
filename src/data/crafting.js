// V10.19 — Artisanat : matériaux, runes, litanies (assemblages de runes), usure, emplacements.
// Données PARTAGÉES client + serveur (le serveur s'en sert pour borner ce qu'une sauvegarde peut contenir).
import { classForTier } from './rarities.js';

// ---------------------------------------------------------------- matériaux (objets empilables)
// `w` : valeur relative, utilisée par la distillation du Monolithe.
export const MATS = [
  { id: 'mat_ferraille', name: 'Ferraille', icon: '🔩', w: 1, value: 1, desc: 'Débris de métal récupérés en démantelant des équipements. Sert à presque tout.' },
  { id: 'mat_poussiere', name: 'Poussière arcanique', icon: '✨', w: 3, value: 4, desc: 'Poussière d’énergie résiduelle. Sert aux emplacements, à l’enchantement et à la gravure.' },
  { id: 'mat_essence', name: 'Essence astrale', icon: '🔮', w: 9, value: 14, desc: 'Essence condensée d’objets rares. Sert aux refontes et aux élévations.' },
  { id: 'mat_cristal', name: 'Cristal d’éclat', icon: '💠', w: 27, value: 45, desc: 'Cristal pur issu d’objets légendaires. Sert aux grandes transformations.' },
  { id: 'mat_ame', name: 'Âme oubliée', icon: '👻', w: 60, value: 120, desc: 'Fragment d’âme d’un équipement mythique. Indispensable à la Mystique.' }
];
export const MAT_BY_ID = Object.fromEntries(MATS.map((m) => [m.id, m]));
export const MAT_STACK = 99;

// ---------------------------------------------------------------- emplacements
// Nombre maximal d'emplacements (« chatons ») par pièce d'équipement.
export const SOCKET_CAP = { mainhand: 3, chest: 3, offhand: 2, head: 2, legs: 2, ring: 2, necklace: 2, shoulders: 1, gloves: 1, boots: 1, cape: 1 };
export const slotCategory = (slot) => (slot === 'mainhand' ? 'weapon' : slot === 'ring' || slot === 'necklace' ? 'jewel' : 'armor');
export const CATEGORY_LABEL = { weapon: 'Arme', armor: 'Armure', jewel: 'Bijou' };

// ---------------------------------------------------------------- runes
// Chaque rune donne un bonus différent selon la pièce où elle est sertie : arme / armure / bijou.
const R = (tier, key, name, color, weapon, armor, jewel) => ({ tier, id: 'rune_' + key, key, name: 'Rune ' + name, short: name, color, bonus: { weapon, armor, jewel } });
export const RUNES = [
  R(1, 'aral', 'd’Aral', '#c4c8d0', { atk: 2 }, { def: 2 }, { luck: 1 }),
  R(2, 'bresh', 'de Bresh', '#c9a46b', { crit: 0.01 }, { hp: 8 }, { hp: 6 }),
  R(3, 'caldor', 'de Caldor', '#e08a45', { str: 2 }, { vit: 2 }, { xpPct: 0.01 }),
  R(4, 'dren', 'de Dren', '#5fb0ff', { atkSpeedPct: 0.02 }, { iceResPct: 0.06 }, { mana: 8 }),
  R(5, 'eloh', 'd’Eloh', '#7bd88f', { agi: 3 }, { hpRegen: 0.6 }, { goldPct: 0.03 }),
  R(6, 'fenn', 'de Fenn', '#ff6a5a', { atk: 7 }, { fireResPct: 0.08 }, { critDmgPct: 0.05 }),
  R(7, 'garu', 'de Garu', '#b58cff', { int: 4 }, { lightningResPct: 0.08 }, { manaRegen: 0.6 }),
  R(8, 'hesk', 'de Hesk', '#ffd24a', { critDmgPct: 0.08 }, { def: 9 }, { moveSpeedPct: 0.01 }),
  R(9, 'ilvar', 'd’Ilvar', '#62e0d6', { crit: 0.02 }, { dmgReductionPct: 0.015 }, { xpPct: 0.02 }),
  R(10, 'jorun', 'de Jorun', '#ff9a3c', { atk: 13 }, { hp: 30 }, { luck: 4 }),
  R(11, 'kesh', 'de Kesh', '#e879f9', { atkSpeedPct: 0.04 }, { def: 15 }, { goldPct: 0.06 }),
  R(12, 'lumar', 'de Lumar', '#fff2a8', { critDmgPct: 0.15 }, { dmgReductionPct: 0.025 }, { hp: 40 }),
  R(13, 'morvah', 'de Morvah', '#f87171', { atk: 24 }, { hp: 55 }, { xpPct: 0.035 }),
  R(14, 'nyrel', 'de Nyrel', '#ffffff', { crit: 0.035, atk: 15 }, { dmgReductionPct: 0.04, def: 20 }, { critDmgPct: 0.1, luck: 6 })
];
export const RUNE_BY_ID = Object.fromEntries(RUNES.map((r) => [r.id, r]));
export const MAX_RUNE_TIER = RUNES.length;

export const STAT_NAMES = {
  atk: 'Dégâts', def: 'Défense', hp: 'Points de vie', mana: 'Mana', crit: 'Chance de critique', str: 'Force', agi: 'Agilité', int: 'Intelligence', vit: 'Endurance',
  spi: 'Esprit', luck: 'Chance', atkSpeedPct: 'Vitesse d’attaque', critDmgPct: 'Dégâts critiques', fireResPct: 'Résistance au feu', iceResPct: 'Résistance à la glace',
  lightningResPct: 'Résistance à la foudre', dmgReductionPct: 'Réduction des dégâts', hpRegen: 'Régénération de PV', manaRegen: 'Régénération de mana',
  moveSpeedPct: 'Vitesse de déplacement', xpPct: 'Expérience gagnée', goldPct: 'Or trouvé', staRegenPct: 'Récupération d’endurance'
};
const PCT = new Set(['crit', 'atkSpeedPct', 'critDmgPct', 'fireResPct', 'iceResPct', 'lightningResPct', 'dmgReductionPct', 'moveSpeedPct', 'xpPct', 'goldPct', 'staRegenPct']);
export const fmtBonus = (k, v) => `+${PCT.has(k) ? Math.round(v * 1000) / 10 + ' %' : v} ${STAT_NAMES[k] || k}`;
export const fmtBonusMap = (b) => Object.entries(b || {}).map(([k, v]) => fmtBonus(k, v)).join(', ');

/** Bonus total d'une rune sertie dans une pièce de catégorie `cat`. */
export const runeBonus = (runeId, cat) => RUNE_BY_ID[runeId]?.bonus[cat] || {};

// ---------------------------------------------------------------- litanies (assemblages de runes dans un ordre précis)
// Pièce à N emplacements, tous garnis des bonnes runes dans l'ordre → bonus supplémentaire. `cat` + `slots` limitent les pièces concernées.
export const LITANIES = [
  { id: 'aube', name: 'Aube Fendue', cat: 'weapon', runes: ['fenn', 'eloh', 'jorun'], bonus: { atk: 30, atkSpeedPct: 0.06, crit: 0.03 } },
  { id: 'orage', name: 'Souffle d’Orage', cat: 'weapon', runes: ['garu', 'kesh'], bonus: { atk: 18, atkSpeedPct: 0.05, manaRegen: 1, int: 8 } },
  { id: 'pacte', name: 'Pacte Pourpre', cat: 'weapon', runes: ['bresh', 'caldor', 'morvah'], bonus: { atk: 35, critDmgPct: 0.2, str: 8 } },
  { id: 'couchant', name: 'Griffe du Couchant', cat: 'weapon', runes: ['hesk', 'lumar', 'nyrel'], bonus: { atk: 50, crit: 0.05, critDmgPct: 0.25 } },
  { id: 'rempart', name: 'Rempart de Brume', cat: 'armor', slots: ['chest'], runes: ['bresh', 'ilvar', 'morvah'], bonus: { def: 40, hp: 120, dmgReductionPct: 0.05 } },
  { id: 'veille', name: 'Veille d’Argent', cat: 'armor', slots: ['head'], runes: ['caldor', 'lumar'], bonus: { hp: 60, xpPct: 0.03, int: 8 } },
  { id: 'pas', name: 'Pas du Vent', cat: 'armor', slots: ['legs'], runes: ['eloh', 'ilvar'], bonus: { moveSpeedPct: 0.05, agi: 10, hp: 30 } },
  { id: 'egide', name: 'Égide du Serment', cat: 'armor', slots: ['offhand'], runes: ['hesk', 'kesh'], bonus: { def: 30, dmgReductionPct: 0.04, hp: 50 } },
  { id: 'fortune', name: 'Cercle de Fortune', cat: 'jewel', runes: ['ilvar', 'jorun'], bonus: { luck: 10, goldPct: 0.1, xpPct: 0.05 } },
  { id: 'veine', name: 'Veine d’Ambre', cat: 'jewel', runes: ['dren', 'fenn'], bonus: { mana: 40, critDmgPct: 0.1, manaRegen: 1 } }
];
/** Litanie active d'un objet généré (ou null) : tous les emplacements garnis, dans l'ordre. */
export function activeLitany(gen) {
  if (!gen || !gen.sockets || !Array.isArray(gen.gems) || gen.gems.length !== gen.sockets) return null;
  const ids = gen.gems.map((g) => (g ? String(g).replace(/^rune_/, '') : ''));
  if (ids.some((i) => !i)) return null;
  const cat = slotCategory(gen.slot);
  return LITANIES.find((l) => l.cat === cat && (!l.slots || l.slots.includes(gen.slot)) && l.runes.length === ids.length && l.runes.every((r, i) => r === ids[i])) || null;
}

/** Somme des bonus apportés par les runes + litanie d'un objet généré. */
export function socketBonus(gen) {
  const out = {};
  if (!gen || !gen.sockets || !Array.isArray(gen.gems)) return out;
  const cat = slotCategory(gen.slot);
  for (const g of gen.gems) if (g) for (const [k, v] of Object.entries(runeBonus(g, cat))) out[k] = (out[k] || 0) + v;
  const lit = activeLitany(gen);
  if (lit) for (const [k, v] of Object.entries(lit.bonus)) out[k] = (out[k] || 0) + v;
  return out;
}

// ---------------------------------------------------------------- usure
// Durabilité maximale selon la classe de rareté (Commun … Absolu).
export const DURA_MAX = { commun: 30, magique: 40, rare: 50, legendaire: 60, mythique: 70, absolu: 80 };
export const durMaxOf = (gen) => DURA_MAX[classForTier(gen?.rarityTier || 1).id] || 40;
export const durOf = (gen) => {
  const max = durMaxOf(gen);
  const d = Number(gen?.dur);
  return Number.isFinite(d) ? Math.max(0, Math.min(max, d)) : max;
};
export const isBroken = (gen) => !!gen && durOf(gen) <= 0;
/** Coût d'une réparation complète (or). */
export const repairCost = (gen) => {
  const max = durMaxOf(gen), miss = max - durOf(gen);
  if (miss <= 0) return 0;
  return Math.max(1, Math.round((gen.value || 10) * 0.12 * (miss / max)));
};

// ---------------------------------------------------------------- démantèlement
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
/** Matériaux obtenus en démantelant un objet généré. */
export function salvageYield(gen) {
  const cls = classForTier(gen.rarityTier || 1).id;
  const lv = Math.max(1, gen.itemLevel || 1), bonus = Math.floor(lv / 40);
  const o = {};
  const add = (id, n) => { if (n > 0) o[id] = (o[id] || 0) + n; };
  if (cls === 'commun') { add('mat_ferraille', rnd(2, 4) + bonus); }
  else if (cls === 'magique') { add('mat_ferraille', rnd(3, 6) + bonus); add('mat_poussiere', rnd(1, 3)); }
  else if (cls === 'rare') { add('mat_poussiere', rnd(3, 6) + bonus); if (Math.random() < 0.35) add('mat_essence', 1); }
  else if (cls === 'legendaire') { add('mat_essence', rnd(3, 5) + bonus); add('mat_cristal', rnd(1, 2)); add('mat_poussiere', rnd(4, 8)); if (Math.random() < 0.3) add('mat_ame', 1); }
  else if (cls === 'mythique') { add('mat_essence', rnd(5, 9) + bonus); add('mat_cristal', rnd(2, 4)); add('mat_ame', rnd(1, 2)); }
  else { add('mat_cristal', rnd(5, 8)); add('mat_ame', rnd(2, 4)); add('mat_essence', rnd(8, 14)); }
  return o;
}

// ---------------------------------------------------------------- coûts
const CLS_INDEX = { commun: 0, magique: 1, rare: 2, legendaire: 3, mythique: 4, absolu: 5 };
export const clsIndex = (gen) => CLS_INDEX[classForTier(gen.rarityTier || 1).id] || 0;
export const SOCKET_COST = [
  { gold: (lv) => 40 + lv * 6, mats: { mat_poussiere: 5 } },
  { gold: (lv) => 90 + lv * 12, mats: { mat_poussiere: 8, mat_essence: 3 } },
  { gold: (lv) => 160 + lv * 20, mats: { mat_essence: 8, mat_cristal: 2 } }
];
export const socketCost = (gen) => { const c = SOCKET_COST[Math.min(2, gen.sockets || 0)]; return { gold: Math.round(c.gold(gen.itemLevel || 1)), mats: { ...c.mats } }; };
export const unsocketCost = (gen) => ({ gold: 20 + (gen.itemLevel || 1) * 3, mats: {} });
export const insertCost = (gen) => ({ gold: 5 + Math.round((gen.itemLevel || 1) * 0.5), mats: {} });

export const enchantCost = (gen) => {
  const n = Math.max(0, gen.ench || 0);
  return { gold: Math.round(((gen.itemLevel || 1) * 10 + 100) * (1 + n * 0.6)), mats: { mat_poussiere: 6 + n * 3, mat_ame: 1 + Math.floor(n / 2) } };
};
export const MAX_ENCH = 20;

export const TMOG_COLORS = [
  { id: null, name: 'Couleur d’origine' },
  { id: '#e8e8ee', name: 'Argent' }, { id: '#2b2b33', name: 'Obsidienne' }, { id: '#d94a4a', name: 'Rubis' }, { id: '#e8833a', name: 'Ambre' },
  { id: '#f2cf4a', name: 'Or' }, { id: '#5cc46b', name: 'Émeraude' }, { id: '#3fc7c0', name: 'Turquoise' }, { id: '#4a8cf0', name: 'Saphir' },
  { id: '#8a5cf0', name: 'Améthyste' }, { id: '#e86fc0', name: 'Rose' }, { id: '#8b5a35', name: 'Cuir' }, { id: '#f6f0e0', name: 'Ivoire' }
];
export const TMOG_VISUALS = { melee: ['sword', 'dagger'] };
export const TMOG_VISUAL_NAMES = { sword: 'Épée', dagger: 'Poignard' };
export const tmogCost = (gen) => ({ gold: 100 + (gen.itemLevel || 1) * 6, mats: { mat_poussiere: 3 } });
export const TMOG_HEX = /^#[0-9a-fA-F]{6}$/;
export const WEAPON_VISUALS = new Set(['sword', 'dagger', 'staff', 'bow']);

// ---------------------------------------------------------------- Monolithe : recettes
export const POWER_SLOTS = { weapon: 'Arme', armor: 'Armure', jewel: 'Bijou' };
const CLASS_COST = [
  null,
  { gold: 60, mats: { mat_ferraille: 12, mat_poussiere: 4 } },
  { gold: 150, mats: { mat_poussiere: 12, mat_essence: 3 } },
  { gold: 400, mats: { mat_essence: 10, mat_cristal: 3, mat_poussiere: 15 } },
  { gold: 1200, mats: { mat_essence: 22, mat_cristal: 8, mat_ame: 2 } },
  { gold: 4000, mats: { mat_cristal: 16, mat_ame: 5, mat_essence: 30 } }
];
const scaleGold = (gen, base) => Math.round(base + (gen.itemLevel || 1) * 6 * (1 + clsIndex(gen) * 0.4));
export const reforgeCost = (gen) => { const c = CLASS_COST[clsIndex(gen)] || CLASS_COST[1]; return { gold: scaleGold(gen, c.gold), mats: { ...c.mats } }; };
export const upgradeCost = (gen) => { const c = CLASS_COST[Math.min(5, clsIndex(gen) + 1)]; return { gold: scaleGold(gen, c.gold * 1.5), mats: Object.fromEntries(Object.entries(c.mats).map(([k, v]) => [k, Math.ceil(v * 1.5)])) }; };
export const convertSetCost = (gen) => ({ gold: scaleGold(gen, 200), mats: { mat_poussiere: 10, mat_essence: 5 } });
export const freeLevelCost = (gen) => ({ gold: scaleGold(gen, 500), mats: { mat_essence: 6, mat_cristal: 2 } });
export const extractCost = (gen) => ({ gold: scaleGold(gen, 300), mats: { mat_essence: 10, mat_cristal: 2 } });
export const fuseCost = (tier) => ({ gold: 40 * tier, mats: {} });
export const FUSE_COUNT = 3;
export const engraveCost = () => ({ gold: 120, mats: { mat_poussiere: 10, mat_ferraille: 10 } });
export const DISTILL_IN = 30;
/** Quantité obtenue en distillant DISTILL_IN unités de `from` en `to` (≈ 60 % de la valeur). */
export const distillOut = (from, to) => Math.max(0, Math.floor((DISTILL_IN * (MAT_BY_ID[from]?.w || 0) * 0.6) / (MAT_BY_ID[to]?.w || 1)));
export const engraveTierMax = (level) => Math.max(1, Math.min(MAX_RUNE_TIER - 4, 1 + Math.floor(level / 14)));
