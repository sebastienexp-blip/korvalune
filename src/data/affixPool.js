// Pool d'affixes possibles sur un objet généré. Chaque affixe cible une
// statistique précise du personnage (voir Player.recomputeDerived et
// Equipment.apply pour comment chaque clé est réellement appliquée).
// `flat` : valeur entière ajoutée telle quelle (+25 Force).
// `percent` : valeur en fraction (0.08 = +8%), affichée en %.
export const AFFIX_POOL = [
  { key: 'str', label: 'Force', kind: 'flat', min: 1, max: 4 },
  { key: 'agi', label: 'Agilité', kind: 'flat', min: 1, max: 4 },
  { key: 'int', label: 'Intelligence', kind: 'flat', min: 1, max: 4 },
  { key: 'vit', label: 'Endurance', kind: 'flat', min: 1, max: 4 },
  { key: 'spi', label: 'Esprit', kind: 'flat', min: 1, max: 4 },
  { key: 'luck', label: 'Chance', kind: 'flat', min: 1, max: 4 },
  { key: 'hp', label: 'Points de vie', kind: 'flat', min: 4, max: 14 },
  { key: 'mana', label: 'Mana', kind: 'flat', min: 3, max: 10 },
  { key: 'atk', label: 'Dégâts', kind: 'flat', min: 1, max: 5 },
  { key: 'def', label: 'Défense', kind: 'flat', min: 1, max: 4 },
  { key: 'atkSpeedPct', label: "Vitesse d'attaque", kind: 'percent', min: 0.02, max: 0.05 },
  { key: 'crit', label: 'Chance de critique', kind: 'percent', min: 0.01, max: 0.03 },
  { key: 'critDmgPct', label: 'Dégâts critiques', kind: 'percent', min: 0.03, max: 0.08 },
  { key: 'fireResPct', label: 'Résistance au feu', kind: 'percent', min: 0.02, max: 0.06 },
  { key: 'iceResPct', label: 'Résistance à la glace', kind: 'percent', min: 0.02, max: 0.06 },
  { key: 'lightningResPct', label: 'Résistance à la foudre', kind: 'percent', min: 0.02, max: 0.06 },
  { key: 'dmgReductionPct', label: 'Réduction des dégâts', kind: 'percent', min: 0.01, max: 0.03 },
  { key: 'hpRegen', label: 'Régénération de PV', kind: 'flat', min: 0.3, max: 1.0, decimals: 1 },
  { key: 'manaRegen', label: 'Régénération de mana', kind: 'flat', min: 0.3, max: 1.0, decimals: 1 },
  // V4.4
  { key: 'moveSpeedPct', label: 'Vitesse de déplacement', kind: 'percent', min: 0.01, max: 0.025 },
  { key: 'xpPct', label: "Expérience gagnée", kind: 'percent', min: 0.02, max: 0.05 },
  { key: 'goldPct', label: 'Or trouvé', kind: 'percent', min: 0.03, max: 0.08 },
  { key: 'staRegenPct', label: "Récupération d'endurance", kind: 'percent', min: 0.04, max: 0.1 }
];

// Tire une valeur d'affixe pour un niveau d'objet et une rareté donnés.
export function rollAffixValue(affix, itemLevel, rarity) {
  const levelMult = 1 + itemLevel * 0.035;
  const raw = (affix.min + Math.random() * (affix.max - affix.min)) * levelMult * rarity.statMult;
  if (affix.kind === 'percent') return Math.round(raw * 1000) / 1000;
  const value = affix.decimals ? Math.round(raw * 10) / 10 : Math.max(1, Math.round(raw));
  return value;
}

export function formatAffix(affix, value) {
  if (affix.kind === 'percent') return `+${Math.round(value * 1000) / 10}% ${affix.label}`;
  return `+${value} ${affix.label}`;
}

// Correctif V7.1 : les anciens objets sauvegardés portaient des affixes en % arrondis à 1 (= +100 %). On les ramène à une valeur normale.
export function fixLegacyAffix(a, itemLevel, rarity) {
  if (a.kind !== 'percent' || a.value < 0.5) return;
  const def = AFFIX_POOL.find((d) => d.key === a.key);
  if (!def) { a.value = 0.03; return; }
  a.value = Math.round(((def.min + def.max) / 2) * (1 + (itemLevel || 1) * 0.035) * (rarity?.statMult || 1) * 1000) / 1000;
}
