// V10.26 — Rangs de compétences et puissance qui grandit avec le niveau.
//  • Chaque compétence a un rang de 0 à 10 (amélioré chez soi, contre des pièces d'or, dans le menu Compétences).
//  • Une compétence de haut niveau est intrinsèquement plus puissante (×1 + niveau/150) : un sort de niveau 150 frappe ×2.
//  • Chaque rang : +10 % de dégâts (+25 % de bonus au rang 10), −1,5 % de recharge, −2 % de coût, +3 % de rayon.
//  • « Grandeur » visuelle : palier de niveau (0–5) + rang → anneaux, runes et colonnes de plus en plus spectaculaires.
// (pas d'import JSON ici : le serveur Node charge ce module tel quel ; la table des compétences est fournie par setSkillTable)
let SKILLS = {};
export const setSkillTable = (t) => { SKILLS = t; };

// V10.27 — Empreintes de compétence : un objet Légendaire modifie 1 compétence, un Mythique 2, un Absolu 3.
// Chaque empreinte est un modèle précis (puissance, portée, célérité…) qui change la compétence : dégâts, portée / rayon, recharge, coût.
// L'objet ne stocke que { id, t (modèle), q (qualité 0-1) } ; les valeurs sont recalculées depuis le modèle et le niveau d'objet.
export const SKILL_TEMPLATES = {
  puissance: { label: 'Puissance', dmg: [0.25, 0.6] },
  portee: { label: 'Portée', rad: [0.2, 0.45], dmg: [0.08, 0.18] },
  celerite: { label: 'Célérité', cd: [0.15, 0.35] },
  economie: { label: 'Économie', cost: [0.25, 0.45], cd: [0.05, 0.1] },
  cataclysme: { label: 'Cataclysme', dmg: [0.4, 0.9], rad: [0.2, 0.4], cd: [0.1, 0.2], minTier: 19 }
};
const TPL_KEYS = Object.keys(SKILL_TEMPLATES);
export const boostCount = (tier) => (tier >= 25 ? 3 : tier >= 19 ? 2 : tier >= 13 ? 1 : 0);
const lvlScale = (lvl) => 0.55 + 0.45 * Math.min(1.6, (lvl || 1) / 100);
const r3 = (x) => Math.round(x * 1000) / 1000;
/** Valeurs d'une empreinte : { dmg, rad, cd, cost } (fractions) */
export function skillModValues(b, itemLevel) {
  const t = SKILL_TEMPLATES[b && b.t]; if (!t) return {};
  const q = Math.max(0, Math.min(1, Number(b.q) || 0)), sc = lvlScale(itemLevel), out = {};
  for (const k of ['dmg', 'rad', 'cd', 'cost']) if (t[k]) out[k] = r3((t[k][0] + (t[k][1] - t[k][0]) * q) * sc);
  return out;
}
export function describeSkillMod(b, itemLevel) {
  const v = b && b.__raw ? b : skillModValues(b, itemLevel), p = (x) => Math.round(x * 100);
  const parts = [];
  if (v.dmg) parts.push(`+${p(v.dmg)} % de dégâts`);
  if (v.rad) parts.push(`+${p(v.rad)} % de portée`);
  if (v.cd) parts.push(`−${p(v.cd)} % de recharge`);
  if (v.cost) parts.push(`−${p(v.cost)} % de coût`);
  return parts.join(' · ');
}
/** Tire les empreintes d'un objet : compétences de la classe, jamais deux fois la même. */
export function rollSkillBoosts(classId, tier, itemLevel, rnd = Math.random) {
  const cnt = boostCount(tier); if (!cnt || !classId) return [];
  const pool = Object.values(SKILLS).filter((s) => upgradable(s) && s.classId === classId && s.levelReq <= Math.max(12, itemLevel + 5));
  const tpls = TPL_KEYS.filter((k) => !(SKILL_TEMPLATES[k].minTier > tier));
  const out = [];
  while (out.length < cnt && pool.length) {
    const i = Math.floor(rnd() * pool.length), sk = pool.splice(i, 1)[0];
    out.push({ id: sk.id, t: tpls[Math.floor(rnd() * tpls.length)], q: Math.round(rnd() * 100) / 100 });
  }
  return out;
}
/** Nettoie les empreintes d'un objet (serveur) : nombre selon la rareté, compétences et modèles existants, qualité bornée. */
export function cleanSkillBoosts(arr, tier) {
  if (!Array.isArray(arr)) return [];
  const out = [], seen = new Set(), max = boostCount(tier);
  for (const b of arr) {
    if (out.length >= max) break;
    const s = b && SKILLS[b.id], t = b && SKILL_TEMPLATES[b.t];
    if (!upgradable(s) || !t || seen.has(b.id) || t.minTier > tier) continue;
    seen.add(b.id); out.push({ id: b.id, t: b.t, q: Math.max(0, Math.min(1, Math.round((Number(b.q) || 0) * 100) / 100)) });
  }
  return out;
}
/** Additionne les empreintes de plusieurs objets : { skillId: { dmg, rad, cd, cost } } (plafonnées). */
export function sumSkillMods(list) {
  const out = {}, CAP = { dmg: 3, rad: 1, cd: 0.6, cost: 0.7 };
  for (const { b, itemLevel } of list) {
    const v = skillModValues(b, itemLevel), o = (out[b.id] = out[b.id] || {});
    for (const [k, x] of Object.entries(v)) o[k] = Math.min(CAP[k], (o[k] || 0) + x);
  }
  return out;
}

export const MAX_RANK = 10;
export const progMult = (levelReq) => 1 + (levelReq || 1) / 150;
export const rankDmg = (r) => 1 + 0.1 * r + (r >= MAX_RANK ? 0.25 : 0);
export const tierOf = (levelReq) => Math.min(5, Math.floor((levelReq || 1) / 40));
export const rankCost = (levelReq, rank) => Math.round((120 + (levelReq || 1) * 25) * Math.pow(1.6, rank));
export const rankLevelNeeded = (levelReq, nextRank) => Math.min(200, (levelReq || 1) + 3 * nextRank);
export function upgradable(s) { return !!s && s.id !== 'strike' && !!(s.damage || s.heal || s.fx); }

export function cleanRanks(raw, level = 200) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw)) {
    const s = SKILLS[id]; if (!upgradable(s)) continue;
    let r = Math.floor(Number(v)); if (!Number.isFinite(r) || r <= 0) continue;
    r = Math.min(MAX_RANK, r);
    while (r > 0 && rankLevelNeeded(s.levelReq, r) > level) r--;
    if (r > 0) out[id] = r;
  }
  return out;
}

/** Copie de la compétence avec rang, progression de niveau et bonus d'équipement appliqués (tout le combat lit cette copie). */
export function effectiveSkill(s, player) {
  if (!s || s.id === 'strike') return s;
  const rank = (player.skillRanks && player.skillRanks[s.id]) | 0;
  const m = (player.skillMods && player.skillMods[s.id]) || {}; // V10.27 : empreintes des objets
  const out = { ...s, rank, grand: { tier: tierOf(s.levelReq), rank } };
  const dm = progMult(s.levelReq) * rankDmg(rank) * (1 + (player.skillDmgPct || 0)) * (1 + (m.dmg || 0));
  if (s.damage) out.damage = s.damage * dm;
  if (s.heal) out.heal = s.heal * (1 + 0.06 * rank);
  if (s.cooldown) out.cooldown = s.cooldown * (1 - 0.015 * rank) * Math.max(0.4, 1 - (m.cd || 0));
  const cm = (1 - 0.02 * rank) * (1 - (player.costRedPct || 0)) * Math.max(0.3, 1 - (m.cost || 0));
  if (s.cost) { out.cost = {}; for (const [k, v] of Object.entries(s.cost)) out.cost[k] = k === 'hp' ? v : Math.max(1, Math.round(v * cm)); }
  const rs = (1 + 0.03 * rank) * (1 + (m.rad || 0));
  if (s.fx) {
    const f = { ...s.fx };
    if (f.radius) f.radius = f.radius * rs;
    if (f.zone) f.zone = { ...f.zone, r: f.zone.r * rs };
    if (f.rain) f.rain = { ...f.rain, r: f.rain.r * rs };
    if (f.waves) f.waves = { ...f.waves, r: f.waves.r * rs };
    out.fx = f;
  }
  if (s.range && (s.aoe || m.rad)) out.range = s.range * rs; // portée des zones (et des tirs si l'empreinte l'étend)
  return out;
}

/** Améliore d'un rang. Renvoie { ok, msg }. Le prix est prélevé sur player.coins. */
export function tryUpgrade(player, id) {
  const s = SKILLS[id];
  if (!upgradable(s) || !player.isSkillUnlocked(id)) return { ok: false, msg: 'Compétence indisponible.' };
  const r = (player.skillRanks[id] | 0);
  if (r >= MAX_RANK) return { ok: false, msg: 'Rang maximal atteint.' };
  const need = rankLevelNeeded(s.levelReq, r + 1);
  if (player.level < need) return { ok: false, msg: `Niveau ${need} requis pour le rang ${r + 1}.` };
  const cost = rankCost(s.levelReq, r);
  if (player.coins < cost) return { ok: false, msg: `Il te manque ${cost - player.coins} pièces.` };
  player.coins -= cost; player.skillRanks[id] = r + 1;
  return { ok: true, msg: `${s.name} : rang ${r + 1}`, rank: r + 1 };
}
