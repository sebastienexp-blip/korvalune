// V10.28 — Zénith : au-delà du niveau 200, l'expérience fait monter des niveaux de Zénith, sans limite.
// Chaque niveau de Zénith donne 1 point à investir dans l'arbre des Constellations (4 constellations, des nœuds reliés entre eux).
// Au centre, le Rayonnement n'a pas de rang maximal : c'est ce qui garde chaque point utile, même quand le reste de l'arbre est complet.
// Module partagé client / serveur (pas d'import JSON) : le serveur revalide tout l'arbre.
import { MOD_LABEL, isPctKey } from './builds.js';

export const MAX_LEVEL = 200;
export const CORE_ID = 'core';
export const zenithXp = (z) => Math.round((60 * Math.pow(MAX_LEVEL, 1.5) + 40) * 0.5 * (1 + 0.04 * Math.min(z, 400)));
export const respecCost = (lvl) => Math.round(5000 + 800 * lvl);

export const ZENITH_LABEL = { ...MOD_LABEL, allPct: 'PV, attaque et défense', skillRadPct: 'Portée des compétences' };
export const ZENITH_PCT = (k) => isPctKey(k) || k === 'allPct' || k === 'skillRadPct';

// valeur par rang d'un nœud « normal » (un nœud magique vaut le double)
const BASE = {
  PRIM: 4, atk: 14, crit: 0.005, critDmgPct: 0.03, atkSpeedPct: 0.005, skillDmgPct: 0.012, bossDmgPct: 0.015,
  hp: 70, def: 12, dmgReductionPct: 0.004, hpRegen: 1.5, vit: 4, lifestealPct: 0.003, killHealPct: 0.002,
  cdrPct: 0.004, costRedPct: 0.006, mana: 30, manaRegen: 1, skillRadPct: 0.01, xpPct: 0.01, goldPct: 0.02, luck: 4, moveSpeedPct: 0.004, staRegenPct: 0.02
};
const KINDS = { n: { max: 5, mult: 1 }, m: { max: 3, mult: 2 }, k: { max: 1, mult: 0 } };

// [nom, type, [bonus…]] — le type k (clé de voûte) a ses propres bonus, forts, en un seul rang.
const SPEC = {
  fureur: { name: 'Fureur', color: '#ff7a59', root: ['Éveil guerrier', 'm', ['atk', 'PRIM']], arms: [
    { name: 'Précision', nodes: [['Œil acéré', 'n', ['crit']], ['Coup précis', 'n', ['critDmgPct']], ['Frappe chirurgicale', 'm', ['crit', 'critDmgPct']], ['Instinct', 'n', ['atk']], ['Exécution', 'k', { critDmgPct: 0.25, crit: 0.03 }]] },
    { name: 'Puissance', nodes: [['Poigne de fer', 'n', ['PRIM']], ['Lame affûtée', 'n', ['atk']], ['Surcharge', 'm', ['skillDmgPct']], ['Fureur', 'n', ['atkSpeedPct']], ['Déluge', 'k', { skillDmgPct: 0.15 }]] },
    { name: 'Brutalité', nodes: [['Rage', 'n', ['atk']], ['Cible faible', 'n', ['bossDmgPct']], ['Briseur de titans', 'm', ['bossDmgPct', 'atk']], ['Élan', 'n', ['PRIM']], ['Mise à mort', 'k', { bossDmgPct: 0.2, atkSpeedPct: 0.05 }]] }
  ] },
  rempart: { name: 'Rempart', color: '#6ec3ff', root: ['Peau de pierre', 'm', ['hp', 'def']], arms: [
    { name: 'Bastion', nodes: [['Cuirasse', 'n', ['def']], ['Vigueur', 'n', ['hp']], ['Mur vivant', 'm', ['dmgReductionPct', 'def']], ['Endurance', 'n', ['vit']], ['Inébranlable', 'k', { dmgReductionPct: 0.05, def: 60 }]] },
    { name: 'Vitalité', nodes: [['Souffle long', 'n', ['hpRegen']], ['Sang épais', 'n', ['hp']], ['Cœur robuste', 'm', ['hp', 'vit']], ['Récupération', 'n', ['hpRegen']], ['Colosse', 'k', { hp: 500, hpRegen: 8 }]] },
    { name: 'Survie', nodes: [['Soif', 'n', ['lifestealPct']], ['Coup de grâce', 'n', ['killHealPct']], ['Festin', 'm', ['lifestealPct', 'hp']], ['Ténacité', 'n', ['dmgReductionPct']], ['Immortel', 'k', { lifestealPct: 0.02, killHealPct: 0.015 }]] }
  ] },
  savoir: { name: 'Savoir', color: '#b58cff', root: ['Esprit vif', 'm', ['mana', 'cdrPct']], arms: [
    { name: 'Maîtrise', nodes: [['Concentration', 'n', ['cdrPct']], ['Économie de geste', 'n', ['costRedPct']], ['Rythme', 'm', ['cdrPct', 'costRedPct']], ['Précision magique', 'n', ['skillDmgPct']], ['Cadence infinie', 'k', { cdrPct: 0.06, costRedPct: 0.08 }]] },
    { name: 'Ampleur', nodes: [['Écho', 'n', ['skillRadPct']], ['Onde', 'n', ['skillDmgPct']], ['Résonance', 'm', ['skillRadPct', 'skillDmgPct']], ['Étendue', 'n', ['skillRadPct']], ['Cataclysme', 'k', { skillDmgPct: 0.12, skillRadPct: 0.1 }]] },
    { name: 'Réserve', nodes: [['Source', 'n', ['mana']], ['Flux', 'n', ['manaRegen']], ['Réservoir', 'm', ['mana', 'manaRegen']], ['Sagesse', 'n', ['mana']], ['Puits sans fond', 'k', { mana: 300, manaRegen: 6 }]] }
  ] },
  fortune: { name: 'Fortune', color: '#ffd35e', root: ['Bonne étoile', 'm', ['luck', 'xpPct']], arms: [
    { name: 'Apprentissage', nodes: [['Curiosité', 'n', ['xpPct']], ['Étude', 'n', ['xpPct']], ['Érudition', 'm', ['xpPct', 'luck']], ['Mémoire', 'n', ['xpPct']], ['Éveil', 'k', { xpPct: 0.12 }]] },
    { name: 'Prospérité', nodes: [['Flair', 'n', ['goldPct']], ['Négoce', 'n', ['goldPct']], ['Veine', 'm', ['goldPct', 'luck']], ['Chance', 'n', ['luck']], ['Fortune faite', 'k', { goldPct: 0.25, luck: 25 }]] },
    { name: 'Allure', nodes: [['Pas léger', 'n', ['moveSpeedPct']], ['Souffle', 'n', ['staRegenPct']], ['Foulée', 'm', ['moveSpeedPct', 'staRegenPct']], ['Agilité', 'n', ['staRegenPct']], ['Vent d’étoile', 'k', { moveSpeedPct: 0.05, staRegenPct: 0.2 }]] }
  ] }
};
export const CONSTELLATIONS = Object.keys(SPEC);

function modsOf(spec, kind) {
  if (!Array.isArray(spec)) return { ...spec };
  const out = {}, m = KINDS[kind].mult;
  for (const k of spec) { const v = BASE[k] * m; out[k] = typeof v === 'number' && v < 1 ? Math.round(v * 1000) / 1000 : v; }
  return out;
}

// Nœuds dans l'ordre « prérequis d'abord » (un nœud exige que le précédent de sa branche ait au moins 1 rang).
export const NODES = [{ id: CORE_ID, c: null, name: 'Rayonnement', kind: 'c', max: Infinity, mods: { allPct: 0.005 }, pre: null, x: 500, y: 500 }];
const AXIS = { fureur: -90, rempart: 0, savoir: 90, fortune: 180 }; // degrés
CONSTELLATIONS.forEach((c) => {
  const S = SPEC[c], a0 = AXIS[c] * Math.PI / 180, rx = 500 + Math.cos(a0) * 105, ry = 500 + Math.sin(a0) * 105;
  NODES.push({ id: `${c}.0`, c, name: S.root[0], kind: 'm', max: KINDS.m.max, mods: modsOf(S.root[2], 'm'), pre: null, x: rx, y: ry });
  S.arms.forEach((arm, ai) => {
    const ang = a0 + (ai - 1) * 0.62;
    arm.nodes.forEach(([name, kind, spec], ni) => {
      const d = 105 + (ni + 1) * 68;
      NODES.push({
        id: `${c}.${ai + 1}.${ni + 1}`, c, arm: arm.name, name, kind, max: KINDS[kind].max, mods: modsOf(spec, kind),
        pre: ni === 0 ? `${c}.0` : `${c}.${ai + 1}.${ni}`, x: Math.round(500 + Math.cos(ang) * d), y: Math.round(500 + Math.sin(ang) * d)
      });
    });
  });
});
export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));
export const CONSTELLATION_INFO = Object.fromEntries(CONSTELLATIONS.map((c) => [c, { name: SPEC[c].name, color: SPEC[c].color }]));

export const spentOf = (ranks) => Object.values(ranks || {}).reduce((a, b) => a + b, 0);
/** Un nœud est investissable si son prérequis est pris, s'il n'est pas au maximum et s'il reste des points. */
export function canInvest(z, id) {
  const n = NODE_BY_ID[id]; if (!n) return { ok: false, msg: 'Nœud inconnu.' };
  const r = z.ranks[id] || 0;
  if (r >= n.max) return { ok: false, msg: 'Rang maximal atteint.' };
  if (n.pre && !(z.ranks[n.pre] > 0)) return { ok: false, msg: `Il faut d’abord investir dans « ${NODE_BY_ID[n.pre].name} ».` };
  if (spentOf(z.ranks) >= z.lvl) return { ok: false, msg: 'Aucun point disponible : gagne des niveaux de Zénith.' };
  return { ok: true };
}
/** Nettoie un état de Zénith (client et serveur) : niveau borné, rangs valides, prérequis respectés, total ≤ niveau. */
export function cleanZenith(raw, maxLvl = Infinity) {
  const lvl = Math.max(0, Math.min(Math.floor(Number(raw && raw.lvl)) || 0, maxLvl, 1e7));
  const ranks = {};
  let left = lvl;
  const src = (raw && raw.ranks && typeof raw.ranks === 'object') ? raw.ranks : {};
  for (const n of [...NODES.slice(1), NODES[0]]) { // le Rayonnement (sans limite) passe en dernier
    let r = Math.floor(Number(src[n.id])); if (!Number.isFinite(r) || r <= 0) continue;
    if (n.pre && !(ranks[n.pre] > 0)) continue;
    r = Math.min(r, n.max === Infinity ? 1e7 : n.max, left);
    if (r > 0) { ranks[n.id] = r; left -= r; }
  }
  return { lvl, ranks };
}
/** Bonus cumulés de l'arbre : { clé: valeur } (PRIM remplacé par l'attribut principal de la classe). */
export function zenithBonus(z, prim) {
  const out = {};
  for (const [id, r] of Object.entries((z && z.ranks) || {})) {
    const n = NODE_BY_ID[id]; if (!n) continue;
    for (const [k, v] of Object.entries(n.mods)) { const key = k === 'PRIM' ? prim : k; out[key] = (out[key] || 0) + v * r; }
  }
  for (const k of Object.keys(out)) if (ZENITH_PCT(k)) out[k] = Math.round(out[k] * 10000) / 10000;
  return out;
}
export const describeZenith = (mods, prim) => Object.entries(mods).map(([k, v]) => { const key = k === 'PRIM' ? prim : k; const lab = ZENITH_LABEL[key] || key; return `${ZENITH_PCT(key) ? '+' + Math.round(v * 1000) / 10 + ' %' : '+' + v} ${lab}`; }).join(' · ');
