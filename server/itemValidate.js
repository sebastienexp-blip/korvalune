// Validation côté serveur des objets générés procéduralement envoyés dans
// une sauvegarde (inventaire, équipement, coffre). Le client ne doit jamais
// être cru sur parole pour des valeurs qui affectent la puissance du
// personnage — voir la note de sécurité en tête de server.js. On ne rejoue
// pas la génération, mais on borne strictement toute valeur à ce que le
// générateur pourrait raisonnablement produire.
import { RARITY_BY_TIER } from '../src/data/rarities.js';
import { AFFIX_POOL } from '../src/data/affixPool.js';
import { ITEM_EFFECTS } from '../src/data/itemEffectPool.js';
import { SETS } from '../src/data/sets.js';
import { cleanSkillBoosts } from '../src/combat/SkillRanks.js';
import { BUILDS, BUILD_TIER, buildProc } from '../src/data/builds.js';
import { SOCKET_CAP, RUNE_BY_ID, durMaxOf, MAX_ENCH, TMOG_COLORS } from '../src/data/crafting.js';

const AFFIX_BY_KEY = Object.fromEntries(AFFIX_POOL.map((a) => [a.key, a]));
const EFFECT_BY_ID = Object.fromEntries(ITEM_EFFECTS.map((e) => [e.id, e]));
const VALID_SLOTS = new Set(['head', 'shoulders', 'chest', 'gloves', 'legs', 'boots', 'cape', 'mainhand', 'offhand', 'ring', 'necklace']);
const VALID_STAT_KEYS = new Set(['atk', 'def', 'hp', 'mana', 'crit', 'str', 'agi', 'int', 'vit', 'spi', 'luck']);

function clampNum(v, min, max, fallback = min) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }

// Renvoie un objet généré "propre" (bornes plausibles) ou null si la forme
// est trop invalide pour être récupérée.
export function sanitizeGeneratedItem(gen) {
  if (!gen || typeof gen !== 'object') return null;
  const tier = Math.round(clampNum(gen.rarityTier, 1, 25, 1));
  const rarity = RARITY_BY_TIER[tier];
  if (!rarity) return null;
  const slot = VALID_SLOTS.has(gen.slot) ? gen.slot : null;
  if (!slot) return null;
  const type = gen.type === 'weapon' ? 'weapon' : 'armor';
  const itemLevel = Math.round(clampNum(gen.itemLevel, 1, 500, 1));
  const levelReq = Math.min(itemLevel, Math.round(clampNum(gen.levelReq, 1, 500, 1)));

  const stats = {};
  if (gen.stats && typeof gen.stats === 'object') {
    for (const [k, v] of Object.entries(gen.stats)) {
      if (!VALID_STAT_KEYS.has(k)) continue;
      // 'crit' (bonus de critique inhérent à certaines armes) est une fraction
      // (0.01 = 1%), contrairement aux autres stats de base qui sont entières.
      stats[k] = k === 'crit' ? Math.round(clampNum(v, 0, 0.5, 0) * 1000) / 1000 : Math.round(clampNum(v, -9999, 9999, 0));
    }
  }

  const maxAffixes = rarity.maxAffixes;
  const affixes = Array.isArray(gen.affixes)
    ? gen.affixes.slice(0, maxAffixes).map((a) => {
        const def = a && AFFIX_BY_KEY[a.key];
        if (!def) return null;
        // Les affixes en % croissent avec l'itemLevel et la rareté (valeurs > 1 légitimes, ~4 max)
        const bound = def.kind === 'percent' ? 8 : 9999;
        return { key: def.key, kind: def.kind, label: def.label, value: clampNum(a.value, -bound, bound, 0) };
      }).filter(Boolean)
    : [];

  const maxEffects = rarity.maxEffects;
  const effects = Array.isArray(gen.effects)
    ? gen.effects.slice(0, maxEffects).map((e) => {
        const def = e && EFFECT_BY_ID[e.id];
        if (!def || def.minTier > tier) return null;
        return {
          id: def.id, name: def.name, triggerOn: def.triggerOn, dmgType: def.dmgType || null,
          power: def.power || 0, healPct: def.healPct || 0, aoe: !!def.aoe, range: clampNum(e.range, 1, 12, def.range || 4),
          cooldown: clampNum(e.cooldown, 1, 60, def.cooldown), chance: clampNum(e.chance, 0, 0.5, def.chance[0]),
          // V4.4 : paramètres des nouveaux effets, toujours repris de la définition (jamais du client)
          ...(def.staminaPct ? { staminaPct: def.staminaPct } : {}), ...(def.manaPct ? { manaPct: def.manaPct } : {}),
          ...(def.slowSec ? { slowSec: def.slowSec, slowF: def.slowF } : {}), ...(def.stunSec ? { stunSec: def.stunSec } : {}),
          ...(def.dotSec ? { dotSec: def.dotSec, dotPower: def.dotPower } : {}), ...(def.wardSec ? { wardSec: def.wardSec } : {})
        };
      }).filter(Boolean)
    : [];

  // V10.19 : emplacements, runes, usure, enchantement, apparence — toujours bornés
  const cap = SOCKET_CAP[slot] || 0;
  const sockets = Math.round(clampNum(gen.sockets, 0, cap, 0));
  const gems = sockets && Array.isArray(gen.gems) ? Array.from({ length: sockets }, (_, i) => (typeof gen.gems[i] === 'string' && RUNE_BY_ID[gen.gems[i]] ? gen.gems[i] : null)) : [];
  const durMax = durMaxOf({ rarityTier: tier });
  const extra = {};
  if (sockets) { extra.sockets = sockets; extra.gems = gems; }
  if (gen.dur !== undefined && gen.dur !== null) { const d = Math.round(clampNum(gen.dur, 0, durMax, durMax)); if (d < durMax) extra.dur = d; }
  if (gen.ench) extra.ench = Math.round(clampNum(gen.ench, 0, MAX_ENCH, 0));
  if (gen.free === true) extra.free = true;
  if (gen.tmog && typeof gen.tmog === 'object') {
    const c = TMOG_COLORS.some((x) => x.id && x.id === gen.tmog.c) ? gen.tmog.c : null;
    const v = (gen.tmog.v === 'sword' || gen.tmog.v === 'dagger') && slot === 'mainhand' ? gen.tmog.v : null;
    if (c || v) extra.tmog = { c, v };
  }

  // V10.26 : objet de build — voie et pièce seulement ; bonus et pouvoir sont reconstruits depuis builds.js
  const skillsClean = cleanSkillBoosts(gen.skills, tier); // V10.27
  const build = typeof gen.buildId === 'string' && BUILDS[gen.buildId] && tier === BUILD_TIER ? { id: gen.buildId, piece: Math.round(clampNum(gen.buildPiece, 0, 4, 0)) } : null;
  return {
    ...extra,
    uid: str(gen.uid, 40) || ('gi_srv' + Math.random().toString(36).slice(2)),
    category: ['weapon', 'armor', 'accessory', 'offhand'].includes(gen.category) ? gen.category : 'armor',
    baseKey: str(gen.baseKey, 20),
    type, slot, visual: str(gen.visual, 20) || null, icon: str(gen.icon, 8) || '❔',
    name: str(gen.name, 60) || 'Objet',
    rarityTier: tier, itemLevel, levelReq,
    stats, affixes, effects: build ? (build.piece === 0 && buildProc(build.id) ? [buildProc(build.id)] : []) : effects,
    value: Math.round(clampNum(gen.value, 0, 5_000_000, 0)),
    ...(build ? { buildId: build.id, buildPiece: build.piece } : {}),
    ...(skillsClean.length ? { skills: skillsClean } : {}),
    desc: str(gen.desc, 200),
    ...(typeof gen.setId === 'string' && SETS[gen.setId] ? { setId: gen.setId, setPiece: Math.round(clampNum(gen.setPiece, 0, 5, 0)) } : {}),
    stackable: false
  };
}

// Valide un tableau de cases d'inventaire/coffre (objets statiques ou générés).
export function sanitizeItemSlots(arr, maxLen, sanitizeDefId) {
  if (!Array.isArray(arr)) return null;
  return arr.slice(0, maxLen).map((s) => {
    if (!s) return null;
    if (s.gen) { const g = sanitizeGeneratedItem(s.gen); return g ? { gen: g } : null; }
    if (typeof s.defId === 'string') return { defId: sanitizeDefId(s.defId, 40), qty: Math.max(1, Math.min(99, Math.floor(Number(s.qty) || 1))) };
    return null;
  });
}

// V10.19 : pouvoirs liés au Monolithe (un par catégorie). Chaque pouvoir est reconstruit à partir de sa définition, jamais cru sur parole.
export function sanitizeCubePowers(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const cat of ['weapon', 'armor', 'jewel']) {
    const e = obj[cat];
    const def = e && typeof e === 'object' && EFFECT_BY_ID[e.id];
    if (!def) { out[cat] = null; continue; }
    out[cat] = {
      id: def.id, name: def.name, triggerOn: def.triggerOn, dmgType: def.dmgType || null,
      power: def.power || 0, healPct: def.healPct || 0, aoe: !!def.aoe, range: clampNum(e.range, 1, 12, def.range || 4),
      cooldown: clampNum(e.cooldown, 1, 60, def.cooldown), chance: clampNum(e.chance, 0, 0.5, def.chance[0]),
      ...(def.staminaPct ? { staminaPct: def.staminaPct } : {}), ...(def.manaPct ? { manaPct: def.manaPct } : {}),
      ...(def.slowSec ? { slowSec: def.slowSec, slowF: def.slowF } : {}), ...(def.stunSec ? { stunSec: def.stunSec } : {}),
      ...(def.dotSec ? { dotSec: def.dotSec, dotPower: def.dotPower } : {}), ...(def.wardSec ? { wardSec: def.wardSec } : {})
    };
  }
  return out;
}
