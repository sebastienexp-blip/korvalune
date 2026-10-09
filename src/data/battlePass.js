// V10.23 — Pass de combat « Éveil de Korvalune » : données PARTAGÉES (serveur + client).
// Règle de conception (comme la boutique) : uniquement de l'apparence, des Lunes et du confort — jamais de puissance de combat.
// Tous les nombres ci-dessous sont des valeurs de départ, faciles à ajuster ici sans toucher au reste du code.

export const PASS = {
  tiers: 50,
  xpPerTier: 1500,           // XP du pass nécessaire pour monter d'un palier
  seasonDays: 56,            // durée d'une saison
  epoch: Date.UTC(2026, 9, 1), // début de la saison 1 (1er octobre 2026, UTC)
  premiumPrice: 400,         // Lunes pour débloquer la voie premium (rétroactif : tout ce qui est déjà atteint se récupère)
  tierPrice: 40,             // Lunes pour acheter un palier d'un coup
  dayXpCap: 1800,            // plafond d'XP « de jeu » (hors missions) par jour
  killXp: 8, eliteXp: 35, bossXp: 250, chestXp: 40, questXp: 150, craftXp: 20, riftXp: 120
};

export const SEASON_NAMES = ['L’Éveil de Korvalune', 'La Marée d’Argent', 'Les Cendres de l’Aube', 'Le Souffle des Spires'];

// Saison courante (change automatiquement tous les `seasonDays` jours)
export function seasonOf(now = Date.now()) {
  const len = PASS.seasonDays * 86400000;
  const idx = Math.max(0, Math.floor((now - PASS.epoch) / len));
  return { id: idx + 1, name: SEASON_NAMES[idx % SEASON_NAMES.length], start: PASS.epoch + idx * len, end: PASS.epoch + (idx + 1) * len };
}

// ---- Cosmétiques exclusifs au pass (jamais en vente : `unlock.pass` = palier qui l'offre) ----
export const PASS_ITEMS = [
  // voie gratuite
  { id: 'trail_pass_lueur', cat: 'trail', name: 'Lueur de l’éveil', desc: 'Pass de combat (gratuit), palier 10 : une poussière de lumière pâle.', unlock: { pass: 10, track: 'free' }, fx: { color: 0xbfe9ff } },
  { id: 'title_pass_eveille', cat: 'title', name: 'Éveillé', desc: 'Pass de combat (gratuit), palier 25.', unlock: { pass: 25, track: 'free' }, fx: { text: 'Éveillé', color: '#9fe3ff' } },
  { id: 'ring_pass_aube', cat: 'ring', name: 'Cercle de l’aube', desc: 'Pass de combat (gratuit), palier 40 : un anneau rose et or.', unlock: { pass: 40, track: 'free' }, fx: { color: 0xffc27a } },
  { id: 'pet_pass_luciole', cat: 'pet', name: 'Luciole d’éveil', desc: 'Pass de combat (gratuit), palier 50 : une petite lumière fidèle.', unlock: { pass: 50, track: 'free' }, fx: { kind: 'wisp', color: 0xcfffe8, tip: 0xffffff } },
  // voie premium
  { id: 'aura_pass_lune', cat: 'aura', name: 'Aura de pleine lune', desc: 'Pass premium, palier 1 : un halo argenté.', unlock: { pass: 1, track: 'premium' }, fx: { color: 0xdfe8ff, spin: 2 } },
  { id: 'trail_pass_comete', cat: 'trail', name: 'Queue de comète', desc: 'Pass premium, palier 8 : une traînée bleue et blanche.', unlock: { pass: 8, track: 'premium' }, fx: { color: 0x7fd0ff } },
  { id: 'title_pass_astre', cat: 'title', name: 'Porteur d’astres', desc: 'Pass premium, palier 15.', unlock: { pass: 15, track: 'premium' }, fx: { text: 'Porteur d’astres', color: '#c6a8ff' } },
  { id: 'ring_pass_astral', cat: 'ring', name: 'Cercle des constellations', desc: 'Pass premium, palier 22 : des étoiles en orbite.', unlock: { pass: 22, track: 'premium' }, fx: { prism: true } },
  { id: 'skin_pass_veilleur', cat: 'skin', name: 'Tenue du veilleur', desc: 'Pass premium, palier 30 : bleu nuit et argent lunaire.', unlock: { pass: 30, track: 'premium' }, fx: { cloth: 0x1b2447, steel: 0xcfd8f0, glow: 0x9fb8ff } },
  { id: 'wings_pass_nuit', cat: 'wings', name: 'Ailes de la nuit étoilée', desc: 'Pass premium, palier 38 : des ailes sombres piquetées d’étoiles.', unlock: { pass: 38, track: 'premium' }, fx: { color: 0x141a38, glow: 0x8fa8ff, style: 'cristal' } },
  { id: 'pet_pass_renard', cat: 'pet', name: 'Renard des étoiles', desc: 'Pass premium, palier 45 : un renard à la fourrure nocturne.', unlock: { pass: 45, track: 'premium' }, fx: { kind: 'fox', color: 0x2b3566, tip: 0xbcd0ff } },
  { id: 'aura_pass_aurore', cat: 'aura', name: 'Aura d’aurore boréale', desc: 'Pass premium, palier 50 : toutes les couleurs du ciel.', unlock: { pass: 50, track: 'premium' }, fx: { prism: true, spin: 3 } },
  { id: 'title_pass_veilleur', cat: 'title', name: 'Veilleur de Korvalune', desc: 'Pass premium, palier 50.', unlock: { pass: 50, track: 'premium' }, fx: { text: 'Veilleur de Korvalune', color: '#ffe08a' } }
];
export const PASS_ITEM_BY_ID = Object.fromEntries(PASS_ITEMS.map((i) => [i.id, i]));

// ---- Récompenses par palier : { lunes?, item?, perk? } ----
// gratuit : un peu de Lunes à chaque palier + 4 cosmétiques ; premium : plus de Lunes + 9 cosmétiques + 1 onglet de coffre
const freeItemAt = {}; const premItemAt = {};
for (const it of PASS_ITEMS) (it.unlock.track === 'free' ? freeItemAt : premItemAt)[it.unlock.pass] = it.id;
const premPerkAt = { 18: 'bank_1', 34: 'bank_2' }; // confort offert (voir shopCatalog)

export function rewardOf(track, tier) {
  if (!Number.isInteger(tier) || tier < 1 || tier > PASS.tiers) return null;
  const r = {};
  if (track === 'free') {
    r.lunes = tier % 10 === 0 ? 8 : tier % 5 === 0 ? 5 : 2;
    if (freeItemAt[tier]) r.item = freeItemAt[tier];
  } else if (track === 'premium') {
    r.lunes = tier % 10 === 0 ? 20 : tier % 5 === 0 ? 12 : 5;
    if (premItemAt[tier]) r.item = premItemAt[tier];
    if (premPerkAt[tier]) r.perk = premPerkAt[tier];
  } else return null;
  return r;
}

// ---- Missions ----
// kind : kill | elite | boss | chest | quest | craft | rift. Les compteurs viennent des événements de jeu signalés par le client (bornés par le serveur).
export const DAILY_POOL = [
  { id: 'd_kill40', kind: 'kill', goal: 40, xp: 450, label: 'Vaincre 40 monstres' },
  { id: 'd_kill100', kind: 'kill', goal: 100, xp: 700, label: 'Vaincre 100 monstres' },
  { id: 'd_elite3', kind: 'elite', goal: 3, xp: 600, label: 'Vaincre 3 champions' },
  { id: 'd_chest2', kind: 'chest', goal: 2, xp: 500, label: 'Ouvrir 2 coffres' },
  { id: 'd_quest1', kind: 'quest', goal: 1, xp: 450, label: 'Terminer une quête' },
  { id: 'd_craft3', kind: 'craft', goal: 3, xp: 450, label: 'Utiliser l’atelier 3 fois' },
  { id: 'd_boss1', kind: 'boss', goal: 1, xp: 700, label: 'Vaincre un boss' },
  { id: 'd_rift1', kind: 'rift', goal: 1, xp: 800, label: 'Terminer une spire' }
];
export const WEEKLY_POOL = [
  { id: 'w_kill600', kind: 'kill', goal: 600, xp: 2200, label: 'Vaincre 600 monstres' },
  { id: 'w_elite20', kind: 'elite', goal: 20, xp: 2400, label: 'Vaincre 20 champions' },
  { id: 'w_boss5', kind: 'boss', goal: 5, xp: 2600, label: 'Vaincre 5 boss' },
  { id: 'w_chest12', kind: 'chest', goal: 12, xp: 2000, label: 'Ouvrir 12 coffres' },
  { id: 'w_quest6', kind: 'quest', goal: 6, xp: 2200, label: 'Terminer 6 quêtes' },
  { id: 'w_craft15', kind: 'craft', goal: 15, xp: 1800, label: 'Utiliser l’atelier 15 fois' },
  { id: 'w_rift4', kind: 'rift', goal: 4, xp: 2800, label: 'Terminer 4 spires' }
];
export const MISSION_BY_ID = Object.fromEntries([...DAILY_POOL, ...WEEKLY_POOL].map((m) => [m.id, m]));
export const EVENT_KINDS = ['kill', 'elite', 'boss', 'chest', 'quest', 'craft', 'rift'];

// choix déterministe (même tirage pour tous les joueurs, selon le jour / la semaine)
function pick(pool, n, seed) {
  const a = pool.map((m) => m.id); let s = (seed * 2654435761) >>> 0;
  for (let i = a.length - 1; i > 0; i--) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
export const dayNo = (now = Date.now()) => Math.floor(now / 86400000);
export const weekNo = (now = Date.now()) => Math.floor((dayNo(now) + 3) / 7); // semaines commençant le lundi (UTC)
export const dailyMissions = (now = Date.now()) => pick(DAILY_POOL, 3, dayNo(now));
export const weeklyMissions = (now = Date.now()) => pick(WEEKLY_POOL, 3, 7000 + weekNo(now));
