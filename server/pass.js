// V10.23 — Pass de combat côté serveur : SEULE source de vérité pour l'XP, les missions et les récompenses.
// Le client signale des ÉVÉNEMENTS (monstres vaincus, coffres…) ; le serveur borne leur rythme, plafonne l'XP quotidienne et valide chaque récupération.
import { PASS, seasonOf, rewardOf, MISSION_BY_ID, EVENT_KINDS, dailyMissions, weeklyMissions, dayNo, weekNo, PASS_ITEM_BY_ID } from '../src/data/battlePass.js';
import { ensureShop } from './shop.js';
import { CATALOG_BY_ID } from '../src/data/shopCatalog.js';

const int = (v, max = 1e9) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
const tierList = (a) => [...new Set((Array.isArray(a) ? a : []).filter((t) => Number.isInteger(t) && t >= 1 && t <= PASS.tiers))].sort((x, y) => x - y);
const mapOf = (o) => { const r = {}; if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (MISSION_BY_ID[k]) r[k] = int(v, 1e6); return r; };

export function ensurePass(acc, now = Date.now()) {
  const sea = seasonOf(now);
  if (!acc.pass || typeof acc.pass !== 'object') acc.pass = {};
  let p = acc.pass;
  if (p.season !== sea.id) { // nouvelle saison : la progression repart de zéro (les cosmétiques déjà gagnés restent au compte)
    p = acc.pass = { season: sea.id, xp: 0, premium: false, free: [], prem: [], day: 0, dayXp: 0, dm: {}, dmc: [], week: 0, wm: {}, wmc: [], tok: {}, tokAt: 0 };
  }
  p.xp = int(p.xp, PASS.tiers * PASS.xpPerTier);
  p.premium = p.premium === true;
  p.free = tierList(p.free); p.prem = tierList(p.prem);
  p.tokAt = Number.isFinite(p.tokAt) ? p.tokAt : 0;
  if (p.day !== dayNo(now)) { p.day = dayNo(now); p.dayXp = 0; p.dm = {}; p.dmc = []; }
  if (p.week !== weekNo(now)) { p.week = weekNo(now); p.wm = {}; p.wmc = []; }
  p.dayXp = int(p.dayXp, PASS.dayXpCap); p.dm = mapOf(p.dm); p.wm = mapOf(p.wm);
  p.dmc = (Array.isArray(p.dmc) ? p.dmc : []).filter((id) => MISSION_BY_ID[id]); p.wmc = (Array.isArray(p.wmc) ? p.wmc : []).filter((id) => MISSION_BY_ID[id]);
  return p;
}

export const tierOf = (p) => Math.min(PASS.tiers, Math.floor(p.xp / PASS.xpPerTier));
const addXp = (p, n) => { const before = p.xp; p.xp = Math.min(PASS.tiers * PASS.xpPerTier, p.xp + Math.max(0, Math.floor(n))); return p.xp - before; };

export function passView(acc, now = Date.now()) {
  const p = ensurePass(acc, now);
  const sea = seasonOf(now);
  const mview = (ids, prog, claimed) => ids.map((id) => { const m = MISSION_BY_ID[id]; return { id, label: m.label, goal: m.goal, xp: m.xp, progress: Math.min(m.goal, prog[id] || 0), claimed: claimed.includes(id) }; });
  return {
    t: 'pass', season: sea.id, name: sea.name, endsAt: sea.end,
    xp: p.xp, tier: tierOf(p), xpPerTier: PASS.xpPerTier, tiers: PASS.tiers, premium: p.premium,
    free: p.free, prem: p.prem, dayXp: p.dayXp, dayXpCap: PASS.dayXpCap,
    premiumPrice: PASS.premiumPrice, tierPrice: PASS.tierPrice,
    daily: mview(dailyMissions(now), p.dm, p.dmc), weekly: mview(weeklyMissions(now), p.wm, p.wmc),
    gems: ensureShop(acc).gems
  };
}

// Anti-triche : chaque type d'événement dispose d'une réserve (seau à jetons) qui se remplit avec le temps ; au-delà, les événements sont ignorés.
const RATE = { kill: [3, 40], elite: [0.25, 3], boss: [1 / 30, 1], chest: [0.2, 3], quest: [1 / 45, 2], craft: [0.5, 5], rift: [1 / 90, 1] }; // [par seconde, réserve max]

// Événements de jeu signalés par le client : { kill: n, elite: n, ... }
export function addEvents(acc, counts, now = Date.now()) {
  const p = ensurePass(acc, now);
  if (!counts || typeof counts !== 'object') return { ok: false, xp: 0 };
  const dt = p.tokAt ? Math.max(0, Math.min(3600, (now - p.tokAt) / 1000)) : 3600;
  p.tokAt = now;
  const tok = p.tok && typeof p.tok === 'object' ? p.tok : {};
  for (const k of EVENT_KINDS) { const [r, mx] = RATE[k]; tok[k] = Math.min(mx, (Number.isFinite(tok[k]) ? Math.max(0, tok[k]) : mx) + dt * r); }
  p.tok = tok;
  const XP = { kill: PASS.killXp, elite: PASS.eliteXp, boss: PASS.bossXp, chest: PASS.chestXp, quest: PASS.questXp, craft: PASS.craftXp, rift: PASS.riftXp };
  const ids = [...dailyMissions(now), ...weeklyMissions(now)];
  let gained = 0, any = false;
  for (const k of EVENT_KINDS) {
    const n = Math.min(int(counts[k], 1000), Math.floor(tok[k]));
    if (!n) continue;
    any = true; tok[k] -= n;
    const room = Math.max(0, PASS.dayXpCap - p.dayXp);
    const xp = Math.min(room, n * XP[k]);
    p.dayXp += xp; gained += addXp(p, xp);
    for (const id of ids) if (MISSION_BY_ID[id].kind === k) { const tgt = id[0] === 'd' ? p.dm : p.wm; tgt[id] = Math.min(MISSION_BY_ID[id].goal, (tgt[id] || 0) + n); }
  }
  return { ok: any, xp: gained };
}

export function missionClaim(acc, id, now = Date.now()) {
  const p = ensurePass(acc, now);
  const m = MISSION_BY_ID[typeof id === 'string' ? id : ''];
  const daily = m && dailyMissions(now).includes(m.id), weekly = m && weeklyMissions(now).includes(m.id);
  if (!daily && !weekly) return { ok: false, error: 'Mission inconnue ou expirée.' };
  const prog = daily ? p.dm : p.wm, done = daily ? p.dmc : p.wmc;
  if (done.includes(m.id)) return { ok: false, error: 'Mission déjà récupérée.' };
  if ((prog[m.id] || 0) < m.goal) return { ok: false, error: 'Mission pas encore terminée.' };
  done.push(m.id);
  const xp = addXp(p, m.xp);
  return { ok: true, xp };
}

function grant(acc, r) {
  const s = ensureShop(acc);
  const out = { lunes: 0, items: [] };
  if (r.lunes) { s.gems += r.lunes; out.lunes += r.lunes; }
  for (const id of [r.item, r.perk]) {
    if (!id || !CATALOG_BY_ID[id]) continue;
    if (s.owned.includes(id)) { if (PASS_ITEM_BY_ID[id]) { s.gems += 10; out.lunes += 10; } continue; } // déjà possédé : remplacé par un peu de Lunes
    s.owned.push(id); out.items.push(CATALOG_BY_ID[id].name);
  }
  return out;
}

export function claim(acc, track, tier, now = Date.now()) {
  const p = ensurePass(acc, now);
  if (track !== 'free' && track !== 'premium') return { ok: false, error: 'Voie inconnue.' };
  if (!Number.isInteger(tier) || tier < 1 || tier > PASS.tiers) return { ok: false, error: 'Palier inconnu.' };
  if (tier > tierOf(p)) return { ok: false, error: 'Palier pas encore atteint.' };
  if (track === 'premium' && !p.premium) return { ok: false, error: 'Débloque d’abord le pass premium.' };
  const list = track === 'free' ? p.free : p.prem;
  if (list.includes(tier)) return { ok: false, error: 'Récompense déjà récupérée.' };
  list.push(tier);
  return { ok: true, ...grant(acc, rewardOf(track, tier)) };
}

export function claimAll(acc, now = Date.now()) {
  const p = ensurePass(acc, now);
  const tot = { ok: true, lunes: 0, items: [], n: 0 };
  for (let t = 1; t <= tierOf(p); t++) for (const track of p.premium ? ['free', 'premium'] : ['free']) {
    if ((track === 'free' ? p.free : p.prem).includes(t)) continue;
    const r = claim(acc, track, t, now);
    if (r.ok) { tot.lunes += r.lunes; tot.items.push(...r.items); tot.n++; }
  }
  if (!tot.n) return { ok: false, error: 'Aucune récompense à récupérer.' };
  return tot;
}

export function buyPremium(acc, now = Date.now()) {
  const p = ensurePass(acc, now), s = ensureShop(acc);
  if (p.premium) return { ok: false, error: 'Tu as déjà le pass premium.' };
  if (s.gems < PASS.premiumPrice) return { ok: false, error: `Il te manque ${PASS.premiumPrice - s.gems} Lunes.` };
  s.gems -= PASS.premiumPrice; p.premium = true;
  return { ok: true };
}

export function buyTier(acc, now = Date.now()) {
  const p = ensurePass(acc, now), s = ensureShop(acc);
  if (tierOf(p) >= PASS.tiers) return { ok: false, error: 'Tu as atteint le dernier palier.' };
  if (s.gems < PASS.tierPrice) return { ok: false, error: `Il te manque ${PASS.tierPrice - s.gems} Lunes.` };
  s.gems -= PASS.tierPrice;
  p.xp = (tierOf(p) + 1) * PASS.xpPerTier;
  return { ok: true, tier: tierOf(p) };
}
