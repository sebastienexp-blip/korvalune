// V10.19 — Artisanat : toute la logique du forgeron, du Monolithe des Métamorphoses et de la mystique.
// Fonctions pures sur un « contexte » { player, inventory, equipment, bus } (donc testables sans navigateur).
// Chaque opération vérifie tout AVANT de modifier quoi que ce soit, puis est « transactionnelle » : si l'inventaire est plein
// au moment de rendre les objets, l'inventaire et l'or sont remis exactement comme avant.
import { resolveItem, getItem } from '../inventory/Item.js';
import { SLOTS } from '../inventory/Equipment.js';
import { generateItem, generateBuildItem, generateSetItem, rollReplacementAffix } from '../inventory/ItemGenerator.js';
import { SETS } from '../data/sets.js';
import { getRarity } from '../data/rarities.js';
import {
  MAT_BY_ID, RUNE_BY_ID, RUNES, MAX_RUNE_TIER, SOCKET_CAP, slotCategory, durOf, durMaxOf, repairCost, salvageYield, clsIndex, socketCost, unsocketCost,
  insertCost, enchantCost, MAX_ENCH, TMOG_COLORS, TMOG_VISUALS, tmogCost, reforgeCost, upgradeCost, convertSetCost, freeLevelCost, extractCost, fuseCost,
  FUSE_COUNT, engraveCost, engraveTierMax, DISTILL_IN, distillOut
} from '../data/crafting.js';

const TIER_OF_CLASS = [1, 4, 8, 13, 19, 25];
const fail = (msg) => ({ ok: false, msg });
const itemName = (id) => MAT_BY_ID[id]?.name || RUNE_BY_ID[id]?.name || getItem(id)?.name || id;

// ---------------------------------------------------------------- accès
export const containerOf = (ctx, ref) => (!ref ? null : ref.where === 'inv' ? ctx.inventory.slots[ref.i] : ctx.equipment.slots[ref.slot]) || null;
export const genOf = (ctx, ref) => containerOf(ctx, ref)?.gen || null;

/** Tous les objets générés possédés : { ref, gen, view } (équipés d'abord si `eq` ≠ false). */
export function listGear(ctx, { eq = true, inv = true } = {}) {
  const out = [];
  if (eq) for (const s of SLOTS) { const c = ctx.equipment.slots[s]; if (c?.gen) out.push({ ref: { where: 'eq', slot: s }, gen: c.gen, view: resolveItem(c) }); }
  if (inv) ctx.inventory.slots.forEach((c, i) => { if (c?.gen) out.push({ ref: { where: 'inv', i }, gen: c.gen, view: resolveItem(c) }); });
  return out;
}
export const countItem = (inv, id) => ((inv.satchel && inv.satchel[id]) || 0) + inv.slots.reduce((n, s) => n + (s && !s.gen && s.defId === id ? s.qty : 0), 0);
export const listRunes = (ctx) => RUNES.map((r) => ({ rune: r, qty: countItem(ctx.inventory, r.id) })).filter((x) => x.qty > 0);

// ---------------------------------------------------------------- coûts
/** Texte du manque pour payer `cost` ({gold, mats:{id:n}}), ou null si tout est là. */
export function missing(ctx, cost) {
  if ((cost.gold || 0) > ctx.player.coins) return `Il te manque ${cost.gold - ctx.player.coins} pièces.`;
  for (const [id, n] of Object.entries(cost.mats || {})) {
    const have = countItem(ctx.inventory, id);
    if (have < n) return `Il te manque ${n - have} × ${itemName(id)}.`;
  }
  return null;
}
export function costText(cost) {
  const p = [];
  if (cost.gold) p.push(`${cost.gold} 🪙`);
  for (const [id, n] of Object.entries(cost.mats || {})) p.push(`${n} × ${itemName(id)}`);
  return p.join(' · ') || 'Gratuit';
}
function takeMats(inv, id, n) {
  if (inv.satchel && inv.satchel[id]) { const t = Math.min(inv.satchel[id], n); inv.satchel[id] -= t; n -= t; if (inv.satchel[id] <= 0) delete inv.satchel[id]; }
  for (let i = 0; i < inv.slots.length && n > 0; i++) {
    const s = inv.slots[i];
    if (!s || s.gen || s.defId !== id) continue;
    const t = Math.min(s.qty, n); s.qty -= t; n -= t;
    if (s.qty <= 0) inv.slots[i] = null;
  }
}
const snapshot = (inv) => inv.slots.map((s) => (s ? { ...s } : null));
const snapSat = (inv) => (inv.satchel ? { ...inv.satchel } : null);
function refresh(ctx) {
  ctx.equipment.apply();
  ctx.inventory.bus.emit('inventoryChanged');
  ctx.bus.emit('hud');
}

/**
 * Exécute une opération de façon transactionnelle.
 * @param {{cost?:object, remove?:object[], give?:Object<string,number>, apply?:Function, msg:string|Function}} op
 */
function run(ctx, op) {
  const cost = op.cost || { gold: 0, mats: {} };
  const miss = missing(ctx, cost); if (miss) return fail(miss);
  const inv = ctx.inventory, snap = snapshot(inv), satSnap = snapSat(inv), coins = ctx.player.coins;
  const restore = () => { inv.slots = snap; if (satSnap) { for (const k of Object.keys(inv.satchel)) delete inv.satchel[k]; Object.assign(inv.satchel, satSnap); } ctx.player.coins = coins; refresh(ctx); };
  ctx.player.coins -= cost.gold || 0;
  for (const [id, n] of Object.entries(cost.mats || {})) takeMats(inv, id, n);
  for (const r of op.remove || []) if (r.where === 'inv') inv.slots[r.i] = null;
  for (const [id, n] of Object.entries(op.give || {})) {
    if (n > 0 && inv.add(id, n) > 0) { restore(); return fail('Inventaire plein : fais de la place puis recommence.'); }
  }
  try { if (op.apply) op.apply(); } catch (e) { restore(); return fail('Opération impossible.'); }
  refresh(ctx);
  return { ok: true, msg: typeof op.msg === 'function' ? op.msg() : op.msg };
}
const giveText = (g) => Object.entries(g).map(([id, n]) => `${n} × ${itemName(id)}`).join(', ');

// ---------------------------------------------------------------- forgeron : réparation
export function repairOne(ctx, ref) {
  const gen = genOf(ctx, ref); if (!gen) return fail('Objet introuvable.');
  const c = repairCost(gen); if (c <= 0) return fail('Cet objet est en parfait état.');
  return run(ctx, { cost: { gold: c, mats: {} }, apply: () => { delete gen.dur; }, msg: `${gen.name} est réparé.` });
}
export function repairAllCost(ctx) { return listGear(ctx).reduce((n, g) => n + repairCost(g.gen), 0); }
export function repairAll(ctx) {
  const items = listGear(ctx).filter((g) => repairCost(g.gen) > 0);
  if (!items.length) return fail('Tout ton équipement est en parfait état.');
  const total = items.reduce((n, g) => n + repairCost(g.gen), 0);
  return run(ctx, { cost: { gold: total, mats: {} }, apply: () => items.forEach((g) => { delete g.gen.dur; }), msg: `${items.length} pièce(s) réparée(s) pour ${total} 🪙.` });
}

// ---------------------------------------------------------------- forgeron : emplacements et runes
export const socketCap = (gen) => SOCKET_CAP[gen.slot] || 0;
export function addSocket(ctx, ref) {
  const gen = genOf(ctx, ref); if (!gen) return fail('Objet introuvable.');
  if ((gen.sockets || 0) >= socketCap(gen)) return fail(`Cette pièce ne peut pas avoir plus de ${socketCap(gen)} emplacement(s).`);
  return run(ctx, {
    cost: socketCost(gen),
    apply: () => { gen.sockets = (gen.sockets || 0) + 1; gen.gems = [...(gen.gems || [])]; while (gen.gems.length < gen.sockets) gen.gems.push(null); },
    msg: `Un emplacement est creusé dans ${gen.name} (${(gen.sockets || 0) + 1}/${socketCap(gen)}).`
  });
}
export function socketRune(ctx, ref, runeId, idx) {
  const gen = genOf(ctx, ref); if (!gen) return fail('Objet introuvable.');
  if (!RUNE_BY_ID[runeId]) return fail('Rune inconnue.');
  if (!gen.sockets) return fail('Cette pièce n’a pas d’emplacement.');
  const gems = gen.gems || [];
  const at = Number.isInteger(idx) ? idx : gems.findIndex((g, i) => i < gen.sockets && !g);
  if (at < 0 || at >= gen.sockets) return fail('Aucun emplacement libre.');
  if (gems[at]) return fail('Cet emplacement est déjà occupé : retire d’abord la rune.');
  const cost = insertCost(gen); cost.mats = { [runeId]: 1 };
  return run(ctx, { cost, apply: () => { gen.gems = [...gems]; while (gen.gems.length < gen.sockets) gen.gems.push(null); gen.gems[at] = runeId; }, msg: `${RUNE_BY_ID[runeId].name} sertie dans ${gen.name}.` });
}
export function unsocketRune(ctx, ref, idx) {
  const gen = genOf(ctx, ref); if (!gen) return fail('Objet introuvable.');
  const rune = gen.gems && gen.gems[idx]; if (!rune) return fail('Cet emplacement est vide.');
  return run(ctx, { cost: unsocketCost(gen), give: { [rune]: 1 }, apply: () => { gen.gems = [...gen.gems]; gen.gems[idx] = null; }, msg: `${RUNE_BY_ID[rune]?.name || 'La rune'} est retirée et récupérée.` });
}

// ---------------------------------------------------------------- forgeron : démantèlement
const mergeYield = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = (a[k] || 0) + v; return a; };
export function canSalvage(gen) { return !!gen && !(gen.gems || []).some(Boolean); }
export function salvageOne(ctx, ref) {
  if (ref.where !== 'inv') return fail('Retire d’abord l’objet de ton équipement.');
  const gen = genOf(ctx, ref); if (!gen) return fail('Objet introuvable.');
  if (!canSalvage(gen)) return fail('Retire d’abord les runes serties dans cet objet.');
  const y = salvageYield(gen);
  return run(ctx, { remove: [ref], give: y, msg: `${gen.name} démantelé : ${giveText(y)}.` });
}
/** Démantèle tout l'inventaire jusqu'à la classe `maxCls` (0 Commun … 5 Absolu), sans toucher aux panoplies ni aux objets sertis. */
export function salvageBulk(ctx, maxCls) {
  const list = listGear(ctx, { eq: false }).filter((g) => clsIndex(g.gen) <= maxCls && !g.gen.setId && canSalvage(g.gen));
  if (!list.length) return fail('Aucun objet à démanteler dans cette catégorie.');
  const y = {}; list.forEach((g) => mergeYield(y, salvageYield(g.gen)));
  return run(ctx, { remove: list.map((g) => g.ref), give: y, msg: `${list.length} objet(s) démantelé(s) : ${giveText(y)}.` });
}

// ---------------------------------------------------------------- mystique : enchantement
export function enchantInfo(gen) { return { cost: enchantCost(gen), left: MAX_ENCH - (gen.ench || 0) }; }
/** Lance un tirage pour l'affixe n° `idx` : retourne la proposition ; rien ne change tant que le joueur n'accepte pas. */
export function enchantRoll(ctx, ref, idx) {
  const gen = genOf(ctx, ref); if (!gen) return fail('Objet introuvable.');
  const old = gen.affixes && gen.affixes[idx]; if (!old) return fail('Propriété introuvable.');
  if ((gen.ench || 0) >= MAX_ENCH) return fail('Cet objet ne peut plus être enchanté.');
  let neu = null;
  const r = run(ctx, {
    cost: enchantCost(gen),
    apply: () => { gen.ench = (gen.ench || 0) + 1; neu = rollReplacementAffix(gen.affixes.map((a) => a.key), gen.itemLevel || 1, gen.rarityTier || 1); },
    msg: 'La mystique murmure… une nouvelle propriété apparaît.'
  });
  if (!r.ok) return r;
  return { ...r, proposal: { ref, idx, oldKey: old.key, old: { ...old }, neu } };
}
export function enchantApply(ctx, proposal) {
  const gen = genOf(ctx, proposal.ref); if (!gen) return fail('Objet introuvable.');
  const cur = gen.affixes && gen.affixes[proposal.idx];
  if (!cur || cur.key !== proposal.oldKey) return fail('L’objet a changé entre-temps.');
  gen.affixes = [...gen.affixes]; gen.affixes[proposal.idx] = { ...proposal.neu };
  refresh(ctx);
  return { ok: true, msg: 'La nouvelle propriété est conservée.' };
}

// ---------------------------------------------------------------- mystique : changement d'apparence
export function tmogOptions(gen) {
  const melee = gen.slot === 'mainhand' && TMOG_VISUALS.melee.includes(gen.visual) && !['bow', 'crossbow', 'staff', 'wand', 'tome'].includes(gen.baseKey);
  return { colors: TMOG_COLORS, visuals: melee ? TMOG_VISUALS.melee : [] };
}
export function applyTransmog(ctx, ref, { c = null, v = null } = {}) {
  const gen = genOf(ctx, ref); if (!gen) return fail('Objet introuvable.');
  const opt = tmogOptions(gen);
  if (c !== null && !opt.colors.some((x) => x.id === c)) return fail('Teinte inconnue.');
  if (v !== null && !opt.visuals.includes(v)) return fail('Forme non disponible pour cette arme.');
  const cur = gen.tmog || {};
  if ((cur.c || null) === c && (cur.v || null) === v) return fail('Cette apparence est déjà appliquée.');
  const set = () => { if (c === null && v === null) delete gen.tmog; else gen.tmog = { c, v }; };
  if (c === null && v === null) { set(); refresh(ctx); ctx.equipment.player.refreshGearVisuals?.(ctx.equipment); return { ok: true, msg: 'Apparence d’origine rétablie (gratuit).' }; }
  const r = run(ctx, { cost: tmogCost(gen), apply: set, msg: `${gen.name} change d’apparence.` });
  if (r.ok) ctx.equipment.player.refreshGearVisuals?.(ctx.equipment);
  return r;
}

// ---------------------------------------------------------------- Monolithe
function replaceGen(ctx, ref, ng, old) {
  ng.sockets = old.sockets || 0; ng.gems = old.gems ? [...old.gems] : []; if (old.dur !== undefined) ng.dur = Math.min(old.dur, durMaxOf(ng));
  if (old.tmog) ng.tmog = old.tmog;
  containerOf(ctx, ref).gen = ng;
}
export function reforge(ctx, ref) {
  const gen = genOf(ctx, ref); if (!gen) return fail('Objet introuvable.');
  if (clsIndex(gen) < 1) return fail('Seuls les objets Magiques ou mieux peuvent être refondus.');
  return run(ctx, {
    cost: reforgeCost(gen),
    apply: () => {
      const ng = gen.buildId ? generateBuildItem(gen.buildId, gen.buildPiece || 0, gen.itemLevel)
        : gen.setId && SETS[gen.setId] ? generateSetItem(SETS[gen.setId], gen.setPiece || 0, gen.itemLevel)
        : generateItem({ category: gen.category, baseKey: gen.baseKey, itemLevel: gen.itemLevel, rarityTier: gen.rarityTier });
      ng.name = gen.name; ng.levelReq = gen.levelReq; if (gen.free) ng.free = true;
      replaceGen(ctx, ref, ng, gen);
    },
    msg: `${gen.name} est refondu : toutes ses propriétés sont retirées au sort.`
  });
}
export function upgradeInfo(gen) { const i = clsIndex(gen); return i >= 1 && i < 5 && !gen.setId && !gen.buildId ? { from: getRarity(TIER_OF_CLASS[i]), to: getRarity(TIER_OF_CLASS[i + 1]) } : null; }
export function upgrade(ctx, ref) {
  const gen = genOf(ctx, ref); if (!gen) return fail('Objet introuvable.');
  if (gen.setId) return fail('Les pièces de panoplie ne peuvent pas être élevées.');
  if (gen.buildId) return fail('Les objets de build ont déjà leur rareté définitive.');
  const i = clsIndex(gen);
  if (i < 1) return fail('Seuls les objets Magiques ou mieux peuvent être élevés.');
  if (i >= 5) return fail('Cet objet a atteint la rareté maximale.');
  return run(ctx, {
    cost: upgradeCost(gen),
    apply: () => {
      const ng = generateItem({ category: gen.category, baseKey: gen.baseKey, itemLevel: gen.itemLevel, rarityTier: TIER_OF_CLASS[i + 1] });
      ng.levelReq = gen.levelReq; if (gen.free) ng.free = true;
      replaceGen(ctx, ref, ng, gen);
    },
    msg: `${gen.name} s’élève en rareté ${getRarity(TIER_OF_CLASS[i + 1]).name}.`
  });
}
export function convertSet(ctx, ref) {
  const gen = genOf(ctx, ref); if (!gen) return fail('Objet introuvable.');
  const set = gen.setId && SETS[gen.setId]; if (!set) return fail('Cet objet ne fait pas partie d’une panoplie.');
  if ((gen.gems || []).some(Boolean)) return fail('Retire d’abord les runes serties.');
  return run(ctx, {
    cost: convertSetCost(gen),
    apply: () => {
      const others = set.pieces.map((_, k) => k).filter((k) => k !== gen.setPiece);
      const k = others[Math.floor(Math.random() * others.length)];
      const ng = generateSetItem(set, k, gen.itemLevel);
      ng.sockets = 0; ng.gems = []; if (gen.dur !== undefined) ng.dur = Math.min(gen.dur, durMaxOf(ng));
      containerOf(ctx, ref).gen = ng;
    },
    msg: 'La pièce se transforme en une autre pièce de la même panoplie.'
  });
}
export function freeLevel(ctx, ref) {
  const gen = genOf(ctx, ref); if (!gen) return fail('Objet introuvable.');
  if ((gen.levelReq || 1) <= 1) return fail('Cet objet n’a déjà aucun niveau requis.');
  return run(ctx, { cost: freeLevelCost(gen), apply: () => { gen.levelReq = 1; gen.free = true; }, msg: `${gen.name} peut désormais être porté à n’importe quel niveau.` });
}
export const POWER_CATEGORIES = ['weapon', 'armor', 'jewel'];
export function extractPower(ctx, ref, effIdx) {
  if (ref.where !== 'inv') return fail('Retire d’abord l’objet de ton équipement.');
  const gen = genOf(ctx, ref); if (!gen) return fail('Objet introuvable.');
  if (gen.setId) return fail('Les pièces de panoplie n’ont pas de pouvoir à extraire.');
  if (clsIndex(gen) < 3) return fail('Seuls les objets Légendaires ou mieux contiennent un pouvoir extractible.');
  const eff = gen.effects && gen.effects[effIdx]; if (!eff) return fail('Pouvoir introuvable.');
  const cat = slotCategory(gen.slot);
  return run(ctx, {
    cost: extractCost(gen), remove: [ref],
    apply: () => { ctx.player.cubePowers = { ...(ctx.player.cubePowers || {}), [cat]: { ...eff } }; },
    msg: `Le pouvoir « ${eff.name} » est lié au Monolithe (emplacement ${cat === 'weapon' ? 'Arme' : cat === 'armor' ? 'Armure' : 'Bijou'}). L’objet est détruit.`
  });
}
export function clearPower(ctx, cat) {
  if (!ctx.player.cubePowers || !ctx.player.cubePowers[cat]) return fail('Cet emplacement est déjà vide.');
  ctx.player.cubePowers = { ...ctx.player.cubePowers, [cat]: null };
  refresh(ctx);
  return { ok: true, msg: 'Le pouvoir est dissipé.' };
}
export function fuseRunes(ctx, runeId) {
  const r = RUNE_BY_ID[runeId]; if (!r) return fail('Rune inconnue.');
  if (r.tier >= MAX_RUNE_TIER) return fail('Cette rune est déjà au rang maximal.');
  const next = RUNES[r.tier]; // tier+1
  const cost = fuseCost(r.tier); cost.mats = { [runeId]: FUSE_COUNT };
  return run(ctx, { cost, give: { [next.id]: 1 }, msg: `${FUSE_COUNT} × ${r.name} fusionnent en ${next.name}.` });
}
export function engraveRune(ctx) {
  const max = engraveTierMax(ctx.player.level);
  const tier = 1 + Math.floor(Math.pow(Math.random(), 2) * max);
  const rune = RUNES[Math.min(RUNES.length, tier) - 1];
  return run(ctx, { cost: engraveCost(), give: { [rune.id]: 1 }, msg: `La gravure donne : ${rune.name} !` });
}
export function distill(ctx, from, to) {
  if (from === to || !MAT_BY_ID[from] || !MAT_BY_ID[to]) return fail('Choisis deux matériaux différents.');
  const out = distillOut(from, to); if (out < 1) return fail('Pas assez rentable : choisis un matériau plus précieux en entrée.');
  return run(ctx, { cost: { gold: 0, mats: { [from]: DISTILL_IN } }, give: { [to]: out }, msg: `${DISTILL_IN} × ${MAT_BY_ID[from].name} → ${out} × ${MAT_BY_ID[to].name}.` });
}

// ---------------------------------------------------------------- usure en jeu
const WARN_AT = 0.25;
/** kind : 'death' (−10 % partout), 'hit' (arme de défense usée au hasard), 'attack' (arme principale). */
export function wearGear(ctx, kind) {
  const gens = [];
  for (const s of SLOTS) { const c = ctx.equipment.slots[s]; if (c?.gen) gens.push({ s, gen: c.gen }); }
  if (!gens.length) return;
  const hit = (g, n) => {
    const max = durMaxOf(g.gen), before = durOf(g.gen), after = Math.max(0, before - n);
    if (after === before) return false;
    g.gen.dur = after;
    if (after <= 0) { ctx.bus.emit('notify', { text: `💥 ${g.gen.name} est brisé ! Il ne donne plus rien : va voir un forgeron.`, kind: 'warn' }); return true; }
    if (before / max > WARN_AT && after / max <= WARN_AT) ctx.bus.emit('notify', { text: `⚠️ ${g.gen.name} est très usé. Pense à le faire réparer.`, kind: 'warn' });
    return false;
  };
  let broke = false;
  if (kind === 'death') { for (const g of gens) if (hit(g, Math.max(1, Math.ceil(durMaxOf(g.gen) * 0.1)))) broke = true; }
  else if (kind === 'attack') { const g = gens.find((x) => x.s === 'mainhand'); if (g && Math.random() < 0.07 && hit(g, 1)) broke = true; }
  else if (kind === 'hit') { const arm = gens.filter((x) => x.s !== 'mainhand'); if (arm.length && Math.random() < 0.14) { const g = arm[Math.floor(Math.random() * arm.length)]; if (hit(g, 1)) broke = true; } }
  if (broke) ctx.equipment.apply();
}
