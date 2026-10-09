// V10.26 — Objets de build : 6 « voies » par classe × 5 pièces = 30 objets de build par classe.
// Chaque voie oriente le personnage vers un style (explosif, rempart, sangsue, érudit, vélocité, chasseur de titans).
// Chaque pièce porte 2-3 bonus de la voie ; la pièce d'arme porte aussi un pouvoir déclenché.
// Réunir 2 / 4 / 5 pièces d'une même voie active des bonus de lignée (voir activeBuildBonuses).
// Tout est recalculé depuis ces définitions (jamais lu depuis la sauvegarde) : le serveur ne croit que buildId + buildPiece.
import { ITEM_EFFECTS } from './itemEffectPool.js';

export const BUILD_TIER = 19; // rareté (Prismatique-) des objets de build

// valeur d'un bonus « plein » à niveau d'objet 100 ; le reste suit le niveau (voir levelFactor)
export const MOD_FULL = {
  atk: 14, def: 22, hp: 110, mana: 55, crit: 0.035, str: 9, agi: 9, int: 9, vit: 9, spi: 9, luck: 9,
  atkSpeedPct: 0.05, critDmgPct: 0.22, dmgReductionPct: 0.025, hpRegen: 3, manaRegen: 2, moveSpeedPct: 0.04, staRegenPct: 0.1,
  skillDmgPct: 0.1, bossDmgPct: 0.12, lifestealPct: 0.02, cdrPct: 0.04, costRedPct: 0.05, killHealPct: 0.012
};
export const MOD_LABEL = {
  atk: 'Attaque', def: 'Défense', hp: 'PV max', mana: 'Mana max', crit: 'Critique', str: 'Force', agi: 'Agilité', int: 'Intelligence', vit: 'Endurance', spi: 'Esprit', luck: 'Chance',
  atkSpeedPct: 'Vitesse d’attaque', critDmgPct: 'Dégâts critiques', dmgReductionPct: 'Réduction des dégâts', hpRegen: 'Régén. PV', manaRegen: 'Régén. mana', moveSpeedPct: 'Vitesse de déplacement',
  staRegenPct: 'Régén. endurance', skillDmgPct: 'Dégâts des compétences', bossDmgPct: 'Dégâts aux boss et élites', lifestealPct: 'Vol de vie', cdrPct: 'Récupération des compétences',
  costRedPct: 'Coût des compétences', killHealPct: 'PV rendus par victoire'
};
export const NEW_KEYS = ['skillDmgPct', 'bossDmgPct', 'lifestealPct', 'cdrPct', 'costRedPct', 'killHealPct'];
const PCT = new Set(['crit', 'atkSpeedPct', 'critDmgPct', 'dmgReductionPct', 'moveSpeedPct', 'staRegenPct', 'skillDmgPct', 'bossDmgPct', 'lifestealPct', 'cdrPct', 'costRedPct', 'killHealPct']);
export const isPctKey = (k) => PCT.has(k);
export const levelFactor = (lvl) => 0.55 + 0.45 * Math.min(1.6, (lvl || 1) / 100);
const scaled = (k, v, lvl) => { const x = v * levelFactor(lvl); return PCT.has(k) ? Math.round(x * 1000) / 1000 : Math.max(1, Math.round(x)); };

// Les cinq pièces d'une voie : emplacement, catégorie, base (clé d'itemBases) — le bonus « principal » tourne d'une pièce à l'autre.
export const BUILD_PIECES = [
  { slot: 'mainhand', category: 'weapon', noun: 'Arme' },
  { slot: 'offhand', category: 'offhand', noun: 'Secondaire' },
  { slot: 'chest', category: 'armor', baseKey: 'chest', noun: 'Plastron' },
  { slot: 'head', category: 'armor', baseKey: 'helm', noun: 'Casque' },
  { slot: 'necklace', category: 'accessory', baseKey: 'amulet', noun: 'Amulette' }
];

// Voies : mods = 4 bonus de voie ({PRIM} = attribut principal de la classe), pouvoir de l'arme, bonus de lignée 2 et 4 pièces, bonus d'ensemble à 5.
const WAYS = [
  { key: 'fleau', label: 'Explosif', blurb: 'Coups critiques dévastateurs et compétences ravageuses.', mods: ['crit', 'critDmgPct', 'skillDmgPct', '{PRIM}'], proc: 'fireball_proc',
    b2: { critDmgPct: 0.15, atk: 20 }, b4: { skillDmgPct: 0.12, crit: 0.04 }, b5: { critDmgPct: 0.3, skillDmgPct: 0.08 } },
  { key: 'rempart', label: 'Rempart', blurb: 'Encaisse tout, ne tombe jamais.', mods: ['def', 'hp', 'dmgReductionPct', 'hpRegen'], proc: 'warding_light',
    b2: { hp: 200, def: 30 }, b4: { dmgReductionPct: 0.06, hpRegen: 6 }, b5: { dmgReductionPct: 0.06, hp: 400 } },
  { key: 'sangsue', label: 'Sangsue', blurb: 'Se soigne en frappant et en tuant.', mods: ['lifestealPct', 'killHealPct', 'vit', '{PRIM}'], proc: 'vampiric_touch',
    b2: { lifestealPct: 0.03, hp: 150 }, b4: { killHealPct: 0.02, atk: 30 }, b5: { lifestealPct: 0.04, killHealPct: 0.02 } },
  { key: 'erudit', label: 'Érudit', blurb: 'Compétences en rafale : recharge réduite, mana abondant.', mods: ['cdrPct', 'costRedPct', 'mana', 'manaRegen'], proc: 'mana_siphon',
    b2: { cdrPct: 0.05, mana: 80 }, b4: { costRedPct: 0.1, skillDmgPct: 0.12 }, b5: { cdrPct: 0.08, skillDmgPct: 0.15 } },
  { key: 'velocite', label: 'Vélocité', blurb: 'Rapide, mobile, impossible à toucher.', mods: ['atkSpeedPct', 'moveSpeedPct', 'staRegenPct', '{PRIM}'], proc: 'lightning_chain',
    b2: { atkSpeedPct: 0.06, moveSpeedPct: 0.04 }, b4: { atkSpeedPct: 0.08, crit: 0.04 }, b5: { moveSpeedPct: 0.06, cdrPct: 0.08 } },
  { key: 'titan', label: 'Chasseur de titans', blurb: 'Fait tomber les boss et les élites.', mods: ['bossDmgPct', 'atk', 'luck', 'def'], proc: 'meteor_proc',
    b2: { bossDmgPct: 0.1, atk: 25 }, b4: { bossDmgPct: 0.18, critDmgPct: 0.15 }, b5: { bossDmgPct: 0.2, atkSpeedPct: 0.06 } }
];

// Noms : une voie par classe = « épithète » (complément du nom de chaque pièce) + nom de la voie.
const NAMES = {
  warrior: [['Aube Écarlate', "de l'Aube Écarlate"], ['Mur de Granit', 'du Mur de Granit'], ['Meute Sanglante', 'de la Meute Sanglante'], ['Forge Savante', 'de la Forge Savante'], ['Tempête d’Acier', "de la Tempête d'Acier"], ['Briseur de Géants', 'du Briseur de Géants']],
  paladin: [['Jugement Radieux', 'du Jugement Radieux'], ['Bastion Sacré', 'du Bastion Sacré'], ['Calice Ardent', 'du Calice Ardent'], ['Lumière Studieuse', 'de la Lumière Studieuse'], ['Pas de l’Aurore', "du Pas de l'Aurore"], ['Fléau des Titans', 'du Fléau des Titans']],
  mage: [['Cendre Fulgurante', 'de la Cendre Fulgurante'], ['Dôme de Givre', 'du Dôme de Givre'], ['Pacte Vampirique', 'du Pacte Vampirique'], ['Savoir Infini', 'du Savoir Infini'], ['Éclair Vif', "de l'Éclair Vif"], ['Chute des Astres', 'de la Chute des Astres']],
  archer: [['Œil du Faucon', 'de l’Œil du Faucon'], ['Écorce Ancienne', "de l'Écorce Ancienne"], ['Chasse Sanglante', 'de la Chasse Sanglante'], ['Souffle du Sage', 'du Souffle du Sage'], ['Vent Hurlant', 'du Vent Hurlant'], ['Tueur de Colosses', 'du Tueur de Colosses']],
  assassin: [['Lame Funeste', 'de la Lame Funeste'], ['Voile d’Ombre', "du Voile d'Ombre"], ['Morsure Pourpre', 'de la Morsure Pourpre'], ['Murmure Noir', 'du Murmure Noir'], ['Pas de Brume', 'du Pas de Brume'], ['Égorgeur de Rois', 'de l’Égorgeur de Rois']]
};
const PRIM = { warrior: 'str', paladin: 'str', mage: 'int', archer: 'agi', assassin: 'agi' };
export const BUILD_CLASSES = Object.keys(NAMES);

export const BUILDS = {};
export const BUILDS_BY_CLASS = {};
for (const cls of BUILD_CLASSES) {
  BUILDS_BY_CLASS[cls] = WAYS.map((w, i) => {
    const mods = w.mods.map((m) => (m === '{PRIM}' ? PRIM[cls] : m));
    const [name, epithet] = NAMES[cls][i];
    const proc = ITEM_EFFECTS.find((e) => e.id === w.proc);
    const b = { id: `${cls}_${w.key}`, classId: cls, way: w.key, wayLabel: w.label, name, epithet, blurb: w.blurb, mods, procId: proc ? proc.id : null, b2: w.b2, b4: w.b4, b5: w.b5 };
    BUILDS[b.id] = b;
    return b;
  });
}

/** Bonus portés par une pièce (valeurs recalculées depuis le niveau d'objet) : 2 bonus pleins + 2 à moitié, en tournant d'une pièce à l'autre. */
export function buildMods(buildId, piece, itemLevel) {
  const b = BUILDS[buildId]; if (!b || piece < 0 || piece > 4) return {};
  const out = {}, add = (k, f) => { out[k] = (out[k] || 0) + scaled(k, MOD_FULL[k] * f, itemLevel); };
  add(b.mods[piece % 4], 1);
  add(b.mods[(piece + 1) % 4], 0.5);
  if (piece === 4 || piece === 0) add(b.mods[(piece + 2) % 4], 0.5);
  for (const k of Object.keys(out)) if (PCT.has(k)) out[k] = Math.round(out[k] * 1000) / 1000;
  return out;
}

/** Effet déclenché de la pièce d'arme (reconstruit depuis la définition). */
export function buildProc(buildId) {
  const b = BUILDS[buildId]; const e = b && ITEM_EFFECTS.find((x) => x.id === b.procId); if (!e) return null;
  return {
    id: e.id, name: e.name, triggerOn: e.triggerOn, dmgType: e.dmgType || null, power: e.power || 0, healPct: e.healPct || 0, aoe: !!e.aoe, range: e.range || 4,
    cooldown: e.cooldown, chance: e.chance[1],
    ...(e.staminaPct ? { staminaPct: e.staminaPct } : {}), ...(e.manaPct ? { manaPct: e.manaPct } : {}),
    ...(e.slowSec ? { slowSec: e.slowSec, slowF: e.slowF } : {}), ...(e.stunSec ? { stunSec: e.stunSec } : {}),
    ...(e.dotSec ? { dotSec: e.dotSec, dotPower: e.dotPower } : {}), ...(e.wardSec ? { wardSec: e.wardSec } : {})
  };
}

/** Bonus de lignée selon le nombre de pièces portées de chaque voie : [{ build, count, bonus: [map…] }]. */
export function activeBuildBonuses(slots, resolve) {
  const counts = {};
  for (const sl of Object.values(slots)) {
    const g = sl && sl.gen; if (!g || !g.buildId || !BUILDS[g.buildId]) continue;
    const v = resolve(sl); if (v && v.broken) continue;
    (counts[g.buildId] = counts[g.buildId] || new Set()).add(g.buildPiece);
  }
  const out = [];
  for (const [id, set] of Object.entries(counts)) {
    const b = BUILDS[id], n = set.size, bonus = [];
    if (n >= 2) bonus.push(b.b2); if (n >= 4) bonus.push(b.b4); if (n >= 5) bonus.push(b.b5);
    out.push({ build: b, count: n, bonus });
  }
  return out;
}
export const describeMods = (m) => Object.entries(m).map(([k, v]) => `${PCT.has(k) ? '+' + Math.round(v * 1000) / 10 + ' %' : '+' + v} ${MOD_LABEL[k] || k}`).join(' · ');
