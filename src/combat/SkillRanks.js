// V10.26 — Rangs de compétences et puissance qui grandit avec le niveau.
//  • Chaque compétence a un rang de 0 à 10 (amélioré chez soi, contre des pièces d'or, dans le menu Compétences).
//  • Une compétence de haut niveau est intrinsèquement plus puissante (×1 + niveau/150) : un sort de niveau 150 frappe ×2.
//  • Chaque rang : +10 % de dégâts (+25 % de bonus au rang 10), −1,5 % de recharge, −2 % de coût, +3 % de rayon.
//  • « Grandeur » visuelle : palier de niveau (0–5) + rang → anneaux, runes et colonnes de plus en plus spectaculaires.
// (pas d'import JSON ici : le serveur Node charge ce module tel quel ; la table des compétences est fournie par setSkillTable)
let SKILLS = {};
export const setSkillTable = (t) => { SKILLS = t; };

export const MAX_RANK = 10;
export const progMult = (levelReq) => 1 + (levelReq || 1) / 150;
export const rankDmg = (r) => 1 + 0.1 * r + (r >= MAX_RANK ? 0.25 : 0);
export const tierOf = (levelReq) => Math.min(5, Math.floor((levelReq || 1) / 40));
export const rankCost = (levelReq, rank) => Math.round((120 + (levelReq || 1) * 25) * Math.pow(1.6, rank));
export const rankLevelNeeded = (levelReq, nextRank) => Math.min(200, (levelReq || 1) + 3 * nextRank);
export const upgradable = (s) => !!s && s.id !== 'strike' && (s.damage || s.heal || s.fx);

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
  const out = { ...s, rank, grand: { tier: tierOf(s.levelReq), rank } };
  const dm = progMult(s.levelReq) * rankDmg(rank) * (1 + (player.skillDmgPct || 0));
  if (s.damage) out.damage = s.damage * dm;
  if (s.heal) out.heal = s.heal * (1 + 0.06 * rank);
  if (s.cooldown) out.cooldown = s.cooldown * (1 - 0.015 * rank);
  const cm = (1 - 0.02 * rank) * (1 - (player.costRedPct || 0));
  if (s.cost) { out.cost = {}; for (const [k, v] of Object.entries(s.cost)) out.cost[k] = k === 'hp' ? v : Math.max(1, Math.round(v * cm)); }
  const rs = 1 + 0.03 * rank;
  if (s.fx) {
    const f = { ...s.fx };
    if (f.radius) f.radius = f.radius * rs;
    if (f.zone) f.zone = { ...f.zone, r: f.zone.r * rs };
    if (f.rain) f.rain = { ...f.rain, r: f.rain.r * rs };
    if (f.waves) f.waves = { ...f.waves, r: f.waves.r * rs };
    out.fx = f;
  }
  if (s.aoe && s.range) out.range = s.range * rs;
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
