// Les 25 niveaux de rareté du jeu — du plus commun au plus exceptionnel.
// Conçu pour être facilement réajusté : modifier les nombres ici suffit,
// rien d'autre dans le code n'a besoin de changer.
//
// - statMult   : multiplicateur appliqué aux statistiques de base de l'objet
// - valueMult  : multiplicateur appliqué à sa valeur marchande
// - maxAffixes : nombre maximum d'affixes aléatoires (stats bonus) possibles
// - maxEffects : nombre maximum d'effets spéciaux (sorts automatiques) possibles
// - power      : "niveau de puissance" indicatif, affiché nulle part mais
//                utilisé pour calibrer la génération (affixes plus gros, etc.)
export const RARITIES = [
  { tier: 1, id: 'commun', name: 'Commun', color: '#C9CED6', statMult: 1.0, valueMult: 1, minAffixes: 0, maxAffixes: 0, minEffects: 0, maxEffects: 0, power: 1, pct: 66 },
  { tier: 4, id: 'magique', name: 'Magique', color: '#3DB2FF', statMult: 1.3, valueMult: 3, minAffixes: 1, maxAffixes: 2, minEffects: 0, maxEffects: 0, power: 4, pct: 27 },
  { tier: 8, id: 'rare', name: 'Rare', color: '#FFD21F', statMult: 1.8, valueMult: 9, minAffixes: 3, maxAffixes: 4, minEffects: 0, maxEffects: 0, power: 8, pct: 5.8 },
  { tier: 13, id: 'legendaire', name: 'Légendaire', color: '#C49A6C', statMult: 2.6, valueMult: 30, minAffixes: 3, maxAffixes: 5, minEffects: 1, maxEffects: 2, power: 13, pct: 1 },
  { tier: 19, id: 'mythique', name: 'Mythique', color: '#C23BFF', statMult: 3.8, valueMult: 100, minAffixes: 4, maxAffixes: 6, minEffects: 2, maxEffects: 3, power: 19, pct: 0.1 },
  { tier: 25, id: 'absolu', name: 'Absolu', color: '#FDE68A', prismatic: true, statMult: 5.5, valueMult: 300, minAffixes: 5, maxAffixes: 7, minEffects: 3, maxEffects: 4, power: 25, pct: 0.006 }
];

// Les anciens objets sauvegardés portent un palier 1-25 (ancien système) : on les rattache à la classe de rareté
// correspondante (leurs statistiques, déjà calculées, ne changent pas).
export function classForTier(n) {
  const t = Math.round(n) || 1;
  return t <= 2 ? RARITIES[0] : t <= 6 ? RARITIES[1] : t <= 12 ? RARITIES[2] : t <= 18 ? RARITIES[3] : t <= 24 ? RARITIES[4] : RARITIES[5];
}

export const RARITY_BY_TIER = Object.fromEntries(RARITIES.map((r) => [r.tier, r]));
export const RARITY_BY_ID = Object.fromEntries(RARITIES.map((r) => [r.id, r]));

// Les objets statiques existants (boutiques, objets de quête...) utilisent encore
// les anciennes clés de rareté ('commun', 'epique', ...) — on les fait pointer
// vers le palier équivalent du nouveau système à 25 niveaux, sans avoir à
// toucher items.json. Toute nouvelle rareté numérique (1-25) fonctionne directement.
const LEGACY_MAP = {
  commun: 1, peu_commun: 4, rare: 8, epique: 13, legendaire: 19, mythique: 25
};

// Accepte un palier numérique (ancien 1-25 ou nouveau) OU une ancienne clé de chaîne ('epique'...).
export function getRarity(tierOrLegacyId) {
  if (typeof tierOrLegacyId === 'number') return classForTier(tierOrLegacyId);
  if (tierOrLegacyId in LEGACY_MAP) return classForTier(LEGACY_MAP[tierOrLegacyId]);
  return RARITY_BY_ID[tierOrLegacyId] || RARITIES[0];
}

// Courbe classique : 6 raretés seulement. Commun/Magique dominent, Rare est courant, Légendaire est un vrai
// évènement (~1 objet sur 22), Mythique et Absolu (1 %) sont exceptionnels. `shift` (boss, coffres, lutin trésor…)
// décale la courbe vers le haut : chaque classe i est multipliée par (1 + 0,06·shift)^e_i.
export const TOP_TIER_CHANCE = 0.01;
const SHIFT_EXP = [0, 1, 2, 3, 4, 4.6];
export function tierWeight(tier, shift = 0) {
  const i = RARITIES.indexOf(classForTier(tier));
  const r = RARITIES[i];
  return shift > 0 ? r.pct * Math.pow(1 + shift * 0.06, SHIFT_EXP[i]) : r.pct;
}

// Tire un tier de rareté (1-25) pondéré, avec décalage optionnel (boss) et
// bornes optionnelles (ex: un coffre qui ne descend jamais sous le tier 2).
export function rollRarityTier({ shift = 0, minTier = 1, maxTier = 25 } = {}) {
  const pool = RARITIES.filter((r) => r.tier >= minTier && r.tier <= maxTier);
  if (!pool.length) return RARITIES[RARITIES.length - 1].tier;
  let total = 0;
  for (const r of pool) total += tierWeight(r.tier, shift);
  let x = Math.random() * total;
  for (const r of pool) { x -= tierWeight(r.tier, shift); if (x <= 0) return r.tier; }
  return pool[0].tier;
}

// Lueur d'un objet selon sa rareté (hautes raretés = halo plus marqué), pour les cases d'inventaire et les noms.
export function rarityGlow(r) {
  if (!r || r.tier < 4) return { box: '', text: '' };
  const k = r.tier >= 25 ? 2.4 : r.tier >= 19 ? 2 : r.tier >= 13 ? 1.5 : r.tier >= 8 ? 0.5 : 0.18; // V8.0 : les raretés basses restent discrètes
  return { box: `0 0 ${Math.round(6 * k)}px ${Math.round(1 * k)}px ${r.color}aa, inset 0 0 ${Math.round(5 * k)}px ${r.color}55`, text: `0 0 ${Math.round(5 * k)}px ${r.color}cc` };
}
