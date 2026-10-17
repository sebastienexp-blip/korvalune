// V10.40 — Table des événements sonores : événement de jeu → fichiers audio réels (voir catalog.js).
// Chaque entrée est une liste de « couches » jouées ensemble : { s: nom de base (ou liste = tirage au hasard), v: volume,
// r: [hauteur min, max] (vitesse de lecture), d: retard en secondes, p: probabilité }.
// Aucun son synthétisé : si un événement n'a pas de fichier réel, il reste silencieux (voir README, section Audio).
const L = (s, v = 1, r = [0.96, 1.05], d = 0, p = 1) => ({ s, v, r, d, p });

export const EVENTS = {
  // --- combat
  swing: () => [L(Math.random() < 0.8 ? 'swing-sword' : 'swing-cleaver', 0.85, [0.92, 1.08])],
  swingHeavy: () => [L('swing-hammer', 0.9, [0.9, 1.0]), L('swing-cleaver', 0.5, [0.8, 0.95], 0.02)],
  hit: () => [L(['slash', 'hack', 'strike'], 0.9), L(['hit-mail', 'hit-leather', 'punch'], 0.45, [0.9, 1.1], 0.01, 0.5)],
  crit: () => [L('crush', 1, [0.9, 1.0]), L(['clash', 'strike'], 0.75, [0.95, 1.05], 0.03), L('impact-earth-low', 0.45, [0.9, 1.1], 0.02)],
  arrowHit: () => [L('pierce', 0.9), L('arrow', 0.25, [1.2, 1.5], 0.0, 0.4)],
  boltHit: () => [L(['impact-air-low', 'impact-air-mid', 'impact-fire-low'], 0.9)],
  bow: () => [L('bow-draw', 0.8, [0.97, 1.05]), L('arrow', 0.85, [0.95, 1.1], 0.1)],
  cast: () => [L(['cast-air-low', 'cast-air-mid', 'cast-earth-low', 'bolt'], 0.85)],
  hurt: () => [L('human-hurt', 0.9, [0.93, 1.05]), L(['hit-leather', 'hit-mail'], 0.5, [0.95, 1.05], 0.02)],
  death: () => [L('human-death', 1, [0.95, 1]), L('death-thud-mid', 0.9, [0.9, 1], 0.55)],
  roll: () => [L('cloth-rustle', 0.8, [1.0, 1.15]), L('fall', 0.25, [1.3, 1.5], 0.12)],
  potion: () => [L('potion-cork', 0.7), L('potion-drink', 0.9, [0.97, 1.04], 0.28)],
  heartbeat: () => [], // pas de fichier réel de battement de cœur dans la bibliothèque : volontairement silencieux
  explode: () => [L(['impact-fire-high', 'fireball'], 1, [0.9, 1.0]), L('crush', 0.55, [0.7, 0.85], 0.02), L('death-thud-big', 0.6, [0.9, 1], 0.05)],
  enrage: (o) => creature(o.kind, 'call', 1, [0.72, 0.82]),
  jump: () => [L('breath', 0.35, [1.0, 1.2]), L('cloth-rustle', 0.35, [1.1, 1.3], 0.03)],
  land: () => [L('fall', 0.7, [0.95, 1.1])],
  combatStart: () => [L('unsheathe', 0.9)],
  enemyAttack: (o) => creature(o.kind, 'attack', 1),
  enemyHurt: (o) => creature(o.kind, 'hurt', 0.9),
  kill: (o) => isHumanoid(o.kind) ? humanoidDeath(o.kind) : isUndeadVoice(o.kind) ? undeadDeath(o.kind) : [...creature(o.kind, 'death', 1), L(creatureSize(o.kind) > 1 ? 'death-thud-big' : 'death-thud-small', 0.7, [0.95, 1.05], 0.35)],
  // --- soins, progression, butin
  heal: () => [L(['cast-healing-mid', 'cure'], 0.9)],
  levelup: () => [],   // V10.45 : plus de fanfare de niveau (la bannière reste)
  quest: () => [L('quest-done', 1, [1, 1])],
  legendary: () => [L('summon', 0.9, [1, 1]), L('church-bell', 0.6, [1, 1], 0.4)],
  absolute: () => [L('summon', 1, [0.85, 0.9]), L('light-spell', 0.9, [1, 1], 0.15), L('church-bell', 0.8, [0.85, 0.9], 0.5), L('dragon-call', 0.35, [0.9, 1], 0.9)],
  zone: () => [L('scroll', 0.8, [1, 1])],
  loot: () => [L('rustle', 0.75), L('clink', 0.5, [0.95, 1.1], 0.07)],
  pickup: () => [L('cloth-rustle', 0.8, [0.95, 1.1]), L('tap', 0.45, [1.1, 1.3], 0.04)],
  coin: () => [L(['coin-pickup', 'coins'], 0.85)],
  equip: () => [L(['equip-plate', 'equip-mail', 'equip-leather', 'equip-cloth'], 0.9)],
  portal: () => [L('teleport-in', 1, [0.95, 1.05]), L('spell-circle', 0.5, [1, 1], 0.05)],
  obelisk: () => [L('spell-circle', 0.9)],
  pearl: () => [L('light-spell', 0.85)],
  guardian: () => [L('dragon-call', 1, [0.85, 0.95]), L('wight-call', 0.6, [0.8, 0.9], 0.3)],
  riftDone: () => [L('quest-done', 1, [1, 1]), L('level-up', 0.6, [0.85, 0.9], 0.4)],
  // --- interface
  click: () => [L('ui-click', 0.9, [0.97, 1.05])],
  open: () => [L('ui-open', 0.85)],
  close: () => [L('ui-close', 0.85)],
  select: () => [L('ui-select', 0.7)],
  confirm: () => [L('ui-confirm', 0.9)],
  error: () => [L('ui-error', 0.85)],
  denied: () => [L('denied', 0.8)],
  // --- monde et objets
  door: () => [L(['door', 'door-heavy'], 0.9)],
  gate: () => [L('gate', 1)],
  chestOpen: () => [L('chest-open', 1)],
  chestClose: () => [L('chest-close', 0.9)],
  lock: () => [L('lock', 0.9)],
  talk: () => [L('talk', 0.7)],
  page: () => [L('page-turn', 0.8)],
  anvil: () => [L('anvil', 0.95)],
  craft: () => [L(['anvil', 'grind'], 0.85), L('clink', 0.5, [1, 1.1], 0.2)],
  trade: () => [L('trade-done', 0.9)],
  buy: () => [L(['coins', 'coin-pickup'], 0.9), L('trade-done', 0.5, [1, 1], 0.15)],
  eat: () => [L('eat', 0.8)],
  // --- montures
  mount: () => [L('horse-whinny', 0.8, [0.95, 1.05]), L('equip-leather', 0.6, [1, 1], 0.1)],
  dismount: () => [L('shield-sling', 0.6), L('breath', 0.4, [0.8, 0.9], 0.1)],
  horseWhinny: () => [L('horse-whinny', 0.9, [0.9, 1.05])],
  wings: () => [L('wingbeat', 0.8, [0.9, 1.05])],
  gryphonCall: () => [L('crow', 0.7, [0.55, 0.65]), L('big-cat-call', 0.5, [0.8, 0.9], 0.05)]
};

// ---------------------------------------------------------------------------------------------------- créatures
// espèce (champ « species » de enemies.json) → famille de fichiers (loup-call, bear-attack…)
const SPECIES = {
  boar: 'boar', wolf: 'wolf', alpha: 'wolf', bear: 'bear', skitter: 'rat', troll: 'troll', brute: 'troll',
  golem: 'troll', golem_colossus: 'troll', bandit: 'human-rough', elite: 'human-rough', zealot: 'human', mage: 'human', archer: 'human', guard: 'human', goblin: 'goblin'
};
const BIG = /behemoth|colossus|sovereign|harbinger|troll|bear|brute|alpha|werewolf|warden|golem/;
let speciesOf = () => null; // branché par AudioManager (id de monstre → espèce)
export function setSpeciesResolver(fn) { speciesOf = fn; }

export function creatureFamily(kind) {
  const id = String(kind || '');
  if (/wraith|ghost|specter|shade/.test(id)) return 'ghost';
  if (/skeleton|revenant/.test(id)) return 'skeleton';
  if (/spire_warden|dragon|sovereign|harbinger/.test(id)) return 'dragon';
  if (/werewolf/.test(id)) return 'wolf';
  if (/loot_sprite|hw_pumpkin$/.test(id)) return 'goblin';
  if (/behemoth|colossus|pumpkin_king/.test(id)) return 'troll';
  if (/slime/.test(id)) return 'slime';
  if (/spider/.test(id)) return 'spider';
  const sp = speciesOf(id);
  const fam = SPECIES[sp] || 'wight';
  // variantes corrompues / abyssales : voix de revenants pour les humanoïdes
  if (/corrupted|abyssal|primordial/.test(id) && (fam === 'human' || fam === 'human-rough')) return 'wight';
  return fam;
}
export function creatureSize(kind) { return BIG.test(String(kind || '')) ? 2 : 1; }

// V10.80 : mort des humanoïdes (bandits, zélotes, mages, archers, gardes, brutes — toutes variantes de région) : plus de cri de revenant ;
// chute lourde d'un corps en armure ou d'un corps en tissu (mages, zélotes), arme qui tombe, souffle bref.
const HUMANOID_SP = new Set(['bandit', 'elite', 'zealot', 'mage', 'archer', 'guard', 'brute']);
export function isHumanoid(kind) { return HUMANOID_SP.has(speciesOf(String(kind || ''))); }
// V10.82 : plus aucune voix de revenant / spectre à la mort d'un monstre : seulement le bruit du corps qui s'effondre
export function isUndeadVoice(kind) { return ['wight', 'ghost'].includes(creatureFamily(kind)); }
function undeadDeath(kind) {
  const big = creatureSize(kind) > 1;
  return [L(big ? 'death-thud-big' : 'death-thud-mid', 1, big ? [0.9, 1.0] : [0.95, 1.05]), L('fall', 0.5, [0.85, 0.95], 0.05)];
}
function humanoidDeath(kind) {
  const cloth = /mage|zealot|cultist/.test(String(kind || '')) || ['mage', 'zealot'].includes(speciesOf(String(kind || '')));
  const big = creatureSize(kind) > 1;
  return cloth
    ? [L('fall', 0.95, [0.9, 1.0]), L('cloth-rustle', 0.7, [0.85, 1.0], 0.04), L('breath', 0.5, [0.75, 0.9], 0.02), L('drop-weapon', 0.5, [0.9, 1.05], 0.22)]
    : [L(big ? 'death-thud-big' : 'fall-armoured', 1, big ? [0.95, 1.05] : [0.92, 1.02]), L(['plate-clank', 'mail-jingle'], 0.55, [0.85, 1.0], 0.07), L('drop-weapon', 0.7, [0.9, 1.05], 0.2), L('breath', 0.4, [0.7, 0.85], 0.02)];
}

function creature(kind, what, v, rate) {
  const fam = creatureFamily(kind);
  const big = creatureSize(kind) > 1;
  const r = rate || (big ? [0.8, 0.92] : [0.95, 1.08]);
  const name = fam === 'human' || fam === 'human-rough' ? (what === 'call' ? `${fam}-attack` : `${fam}-${what}`) : `${fam}-${what}`;
  return [L(name, v, r)];
}

// ---------------------------------------------------------------------------------------------------- pas
export const STEP_SURFACES = { grass: 'step-grass', dirt: 'step-dirt', stone: 'step-stone', wood: 'step-wood', sand: 'step-sand', snow: 'step-snow', gravel: 'step-gravel', mud: 'step-mud', leaves: 'step-leaves', water: 'step-water' };

// tous les sons référencés par la table d'événements (pour les précharger en tâche de fond)
export function allEventSounds(kinds = ['wolf', 'bear', 'boar', 'rat_giant', 'troll', 'bandit', 'zealot', 'goblin', 'wraith_abyssal', 'spire_warden']) {
  const out = new Set();
  const keep = (layers) => { for (const l of layers) for (const s of [].concat(l.s)) out.add(s); };
  for (const k of Object.keys(EVENTS)) for (const kind of kinds) { try { keep(EVENTS[k]({ kind })); } catch (e) { /* ok */ } }
  for (const s of Object.values(STEP_SURFACES)) out.add(s);
  return [...out];
}
