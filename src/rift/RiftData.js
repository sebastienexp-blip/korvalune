// Spires d'Éther — données et formules (V3.7).
// Tout ce qui est « règle du jeu » est ici : modes, échelle de difficulté 1-200,
// cristaux, obélisques, totems, affixes d'élites, économie de clés / poussière d’éther.

export const RIFT_MAX_LEVEL = 200;
export const ZENITH_TIME = 15 * 60;       // Zénith : 15 minutes
export const FERVOR_MAX = 5;

export const MODES = {
  ascent: {
    id: 'ascent', name: 'Ascension', icon: '🌀', key: 'keys', keyName: 'Sceau de spire',
    timed: false, rewards: true,
    desc: 'Explorez, tuez des monstres pour remplir la jauge, puis affrontez le Gardien de la spire. Pas de limite de temps.'
  },
  zenith: {
    id: 'zenith', name: 'Zénith', icon: '🔱', key: 'zkeys', keyName: 'Sceau du zénith',
    timed: true, rewards: true,
    desc: '15 minutes chrono. Monstres plus robustes, meilleur butin. Finir vite améliore un cristal (jusqu’à +3 rangs).'
  },
  trial: {
    id: 'trial', name: 'Entraînement', icon: '🎯', key: null, keyName: null,
    timed: true, rewards: false,
    desc: 'Gratuit, chronométré, sans butin ni récompenses : pour tester un niveau de difficulté avant de miser un sceau.'
  }
};

// Cristaux : montent de rang à chaque Zénith réussie. Les effets s'appliquent en permanence.
export const GEMS = {
  power: { id: 'power', name: 'Cristal de Force', icon: '🔴', color: '#ff6a5a', desc: (r) => `+${(gemEffect('power', r) * 100).toFixed(1)} % de dégâts` },
  vigor: { id: 'vigor', name: 'Cristal de Vigueur', icon: '🟢', color: '#6dff9a', desc: (r) => `+${(gemEffect('vigor', r) * 100).toFixed(1)} % de PV max` },
  haste: { id: 'haste', name: 'Cristal de Célérité', icon: '🔵', color: '#6fb8ff', desc: (r) => `−${(gemEffect('haste', r) * 100).toFixed(1)} % de recharge` },
  fury: { id: 'fury', name: 'Cristal de Férocité', icon: '🟣', color: '#c78bff', desc: (r) => `+${(gemEffect('fury', r) * 100).toFixed(0)} % de dégâts critiques` },
  ease: { id: 'ease', name: 'Cristal de Savoir', icon: '🟡', color: '#ffd86a', desc: (r) => `+${(gemEffect('ease', r) * 100).toFixed(1)} % d’expérience` }
};
export const GEM_IDS = Object.keys(GEMS);

export function gemEffect(id, rank) {
  const r = Math.max(0, rank);
  switch (id) {
    case 'power': return Math.min(1.0, r * 0.005);
    case 'vigor': return Math.min(1.2, r * 0.006);
    case 'haste': return Math.min(0.30, r * 0.0015);
    case 'fury': return Math.min(2.4, r * 0.012);
    case 'ease': return Math.min(1.0, r * 0.005);
    default: return 0;
  }
}

// Probabilité de réussite d'un rang de cristal : 100 % si la spire est au moins du niveau de la cristal,
// puis −10 % par niveau d'écart.
export function gemUpgradeChance(gemRank, riftLevel) {
  if (riftLevel >= gemRank) return 1;
  return Math.max(0, 1 - 0.1 * (gemRank - riftLevel));
}

// Rangs gagnés selon la rapidité d'un Zénith (secondes écoulées).
export function gemStepsForTime(elapsed) {
  if (elapsed <= 300) return 3;
  if (elapsed <= 600) return 2;
  if (elapsed <= ZENITH_TIME) return 1;
  return 0;
}

// Bonus permanents des cristaux → player.riftBonus
export function gemBonuses(gems) {
  const g = gems || {};
  return {
    atkPct: gemEffect('power', g.power || 0),
    hpPct: gemEffect('vigor', g.vigor || 0),
    cdr: gemEffect('haste', g.haste || 0),
    critDmg: gemEffect('fury', g.fury || 0),
    xpPct: gemEffect('ease', g.ease || 0)
  };
}

// Obélisques (bonus temporaires) et totems
export const OBELISKS = {
  power: { id: 'power', name: 'Obélisque de Force', icon: '⚔️', color: 0xff5a3a, dur: 45, desc: 'Dégâts ×1,6' },
  conduit: { id: 'conduit', name: 'Obélisque de Foudre', icon: '⚡', color: 0x6fd0ff, dur: 45, desc: 'La foudre frappe les ennemis proches' },
  channeling: { id: 'channeling', name: 'Obélisque de Focalisation', icon: '🔮', color: 0xb070ff, dur: 45, desc: 'Sorts gratuits, recharge ÷2' },
  shield: { id: 'shield', name: 'Obélisque d’Égide', icon: '🛡️', color: 0xffe07a, dur: 30, desc: 'Dégâts subis −65 %' },
  speed: { id: 'speed', name: 'Obélisque de Vélocité', icon: '💨', color: 0x6dffb0, dur: 45, desc: 'Vitesse ×1,35, recharge −25 %' }
};
export const TOTEMS = {
  frenzy: { id: 'frenzy', name: 'Totem de Rage', icon: '🔥', color: 0xff9a3a, dur: 30, desc: 'Recharge ÷2, vitesse ×1,2' },
  protection: { id: 'protection', name: 'Totem de Garde', icon: '✨', color: 0x9fe0ff, dur: 30, desc: 'Dégâts subis −50 %' },
  enlightenment: { id: 'enlightenment', name: 'Totem de Savoir', icon: '📖', color: 0x7a8aff, dur: 0, desc: 'Gain d’expérience immédiat' },
  fortune: { id: 'fortune', name: 'Totem d’Opulence', icon: '💰', color: 0xffd23f, dur: 0, desc: 'Pluie d’or et butin' }
};

// Affixes d'élites (jusqu'à 2 par pack de champions)
export const AFFIXES = {
  fast: { id: 'fast', name: 'Rapide' },
  juggernaut: { id: 'juggernaut', name: 'Colosse' },
  vampiric: { id: 'vampiric', name: 'Vampirique' },
  molten: { id: 'molten', name: 'Fondu' },
  thorns: { id: 'thorns', name: 'Épineux' },
  frenzy: { id: 'frenzy', name: 'Frénétique' }
};
export const AFFIX_IDS = Object.keys(AFFIXES);

export const GUARDIAN_NAMES = [
  'Gardien éveillé', 'Seigneur tourmenté', 'Le Colosse brisé', 'Horreur de cendre',
  'Dévoreur d’éther', 'Reine des ombres', 'Le Faucheur d’éther', 'Sentinelle du vide'
];

// Difficulté : multiplicateurs par rapport à un monstre « normal » du même niveau.
export function riftMults(modeId, level) {
  if (modeId === 'zenith') return { hp: 1.3 + level * 0.012, dmg: 1.1 + level * 0.004, xp: 1.6, loot: 1.5 };
  if (modeId === 'trial') return { hp: 1.0 + level * 0.006, dmg: 1.0 + level * 0.002, xp: 0, loot: 0 };
  return { hp: 1.0, dmg: 1.0, xp: 1.25, loot: 1.0 };
}

// Danger ressenti par rapport au niveau du joueur
export function dangerLabel(level, playerLevel) {
  const d = level - playerLevel;
  if (d <= -15) return { text: 'Très facile', color: '#8fe0a0' };
  if (d <= -3) return { text: 'Facile', color: '#b6e88a' };
  if (d <= 5) return { text: 'Équilibré', color: '#f2cf6e' };
  if (d <= 20) return { text: 'Difficile', color: '#ff9a4a' };
  if (d <= 50) return { text: 'Très dangereux', color: '#ff6a5a' };
  return { text: 'Suicidaire', color: '#ff3a5a' };
}

// Économie
export const KEY_PRICE = (playerLevel) => 150 + 40 * playerLevel;
export const CRAFT_ZKEY_COST = 3;       // 3 sceaux de spire → 1 sceau du zénith
export const GAMBLE = [
  { id: 'weapon', name: 'Arme', icon: '🗡️', cost: 40 },
  { id: 'armor', name: 'Armure', icon: '🛡️', cost: 25 },
  { id: 'accessory', name: 'Bijou', icon: '💍', cost: 50 }
];

export function defaultRiftSave() {
  return {
    keys: 5, zkeys: 1, shards: 0,
    gems: { power: 1, vigor: 1, haste: 1, fury: 1, ease: 1 },
    pending: 0, pendingLevel: 0, open: null,
    bestAscent: 0, bestZenith: { level: 0, time: 0 },
    history: []
  };
}

// Nettoie une sauvegarde (chargement local ou serveur)
// Anciennes sauvegardes (V3.7/V3.8) : on traduit les anciens noms de champs et de modes.
export function migrateRiftSave(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const r = { ...raw };
  const mode = (m) => (m === 'nephalem' ? 'ascent' : m === 'greater' ? 'zenith' : m);
  if (r.zkeys === undefined && r.gkeys !== undefined) r.zkeys = r.gkeys;
  if (r.bestAscent === undefined && r.bestNephalem !== undefined) r.bestAscent = r.bestNephalem;
  if (r.bestZenith === undefined && r.bestGreater !== undefined) r.bestZenith = r.bestGreater;
  if (r.open && typeof r.open === 'object') r.open = { ...r.open, modeId: mode(r.open.modeId) };
  if (Array.isArray(r.history)) r.history = r.history.map((h) => (h && typeof h === 'object' ? { ...h, mode: mode(h.mode) } : h));
  return r;
}

export function normalizeRiftSave(rawIn) {
  const raw = migrateRiftSave(rawIn);
  const d = defaultRiftSave();
  if (!raw || typeof raw !== 'object') return d;
  const n = (v, lo, hi, def) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : def);
  d.keys = n(raw.keys, 0, 9999, d.keys);
  d.zkeys = n(raw.zkeys, 0, 9999, d.zkeys);
  d.shards = n(raw.shards, 0, 999999, 0);
  for (const id of GEM_IDS) d.gems[id] = n(raw.gems?.[id], 1, RIFT_MAX_LEVEL + 50, 1);
  d.pending = n(raw.pending, 0, 3, 0);
  if (raw.open && MODES[raw.open.modeId]) d.open = { modeId: raw.open.modeId, level: n(raw.open.level, 1, RIFT_MAX_LEVEL, 1) };
  d.pendingLevel = n(raw.pendingLevel, 0, RIFT_MAX_LEVEL, 0);
  d.bestAscent = n(raw.bestAscent, 0, RIFT_MAX_LEVEL, 0);
  d.bestZenith = { level: n(raw.bestZenith?.level, 0, RIFT_MAX_LEVEL, 0), time: n(raw.bestZenith?.time, 0, 99999, 0) };
  d.history = Array.isArray(raw.history) ? raw.history.slice(0, 10).map((h) => ({
    mode: MODES[h?.mode] ? h.mode : 'ascent', level: n(h?.level, 1, RIFT_MAX_LEVEL, 1),
    time: n(h?.time, 0, 99999, 0), ok: !!h?.ok
  })) : [];
  return d;
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Thème visuel/ennemis selon le niveau de spire (suit les 5 mondes du jeu)
export const RIFT_THEMES = [
  { from: 1, name: 'Spires des Prairies', color: 0x8fd0ff, wall: 0x6a6f78, floor: 0x4a4f58, fog: 0x0b1020, hemi: 0x8fa8d8, species: ['wolf', 'boar', 'bear', 'bandit', 'brute', 'rat_giant', 'zealot', 'troll', 'shield_guard', 'bandit_archer', 'cultist_mage'], elite: 'bandit_chief' },
  { from: 22, name: 'Spires corrompues', color: 0x9b5fd4, wall: 0x55405f, floor: 0x3a2a48, fog: 0x120a1e, hemi: 0xa888d8, species: ['wolf_corrupted', 'boar_corrupted', 'bear_corrupted', 'marauder_corrupted', 'brute_corrupted', 'rat_corrupted', 'zealot_corrupted', 'troll_corrupted', 'archer_corrupted', 'mage_corrupted'], elite: 'warden_corrupted' },
  { from: 60, name: 'Spires célestes', color: 0xffe9a8, wall: 0x8a8470, floor: 0x6c6652, fog: 0x1a1608, hemi: 0xf0e0b0, species: ['wolf_celestial', 'boar_celestial', 'bear_celestial', 'sentinel_celestial', 'brute_celestial', 'rat_celestial', 'zealot_celestial', 'troll_celestial', 'archer_celestial', 'mage_celestial'], elite: 'warden_celestial' },
  { from: 100, name: 'Spires abyssales', color: 0xff4d4d, wall: 0x5a2a2e, floor: 0x3a1a1e, fog: 0x1a0608, hemi: 0xe08080, species: ['wraith_abyssal', 'behemoth_abyssal', 'bear_abyssal', 'marauder_abyssal', 'brute_abyssal', 'rat_abyssal', 'zealot_abyssal', 'troll_abyssal', 'archer_abyssal', 'mage_abyssal'], elite: 'harbinger_abyssal' },
  { from: 145, name: 'Spires du Néant', color: 0xff8a3a, wall: 0x4a3a30, floor: 0x2c2018, fog: 0x160c06, hemi: 0xe0a070, species: ['stalker_primordial', 'colossus_primordial', 'bear_primordial', 'herald_primordial', 'brute_primordial', 'rat_primordial', 'zealot_primordial', 'troll_primordial', 'archer_primordial', 'mage_primordial'], elite: 'sovereign_primordial' }
];
export function themeFor(level) {
  let t = RIFT_THEMES[0];
  for (const th of RIFT_THEMES) if (level >= th.from) t = th;
  return t;
}
