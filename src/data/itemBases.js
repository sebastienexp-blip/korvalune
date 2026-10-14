// Modèles de base pour la génération procédurale d'objets. Chaque entrée
// décrit une "famille" d'objet (arme, pièce d'armure, accessoire) : son
// type, son emplacement d'équipement, son icône, son apparence visuelle sur
// le personnage, et comment ses statistiques de base évoluent avec le
// niveau de l'objet. Ajouter une nouvelle base ici suffit à l'intégrer
// partout (génération, loot, affichage) — c'est la même architecture que
// items.json pour les objets statiques (boutiques, etc.), en parallèle.
//
// `visual` doit correspondre à une silhouette gérée par HumanoidModel.js
// (sword/dagger/staff/bow) ; les familles qui n'ont pas de modèle 3D dédié
// réutilisent la silhouette la plus proche (ex: hache/masse/lance → sword).
export const WEAPON_BASES = {
  sword: { name: 'Épée', icon: '⚔️', visual: 'sword', primary: 'atk', base: 3, perLevel: 2.2 },
  axe: { name: 'Hache', icon: '🪓', visual: 'sword', model: 'axe', primary: 'atk', base: 4, perLevel: 2.4 },
  mace: { name: 'Masse', icon: '🔨', visual: 'sword', model: 'mace', primary: 'atk', base: 4, perLevel: 2.3 },
  spear: { name: 'Lance', icon: '🔱', visual: 'sword', model: 'spear', primary: 'atk', base: 3, perLevel: 2.5 },
  dagger: { name: 'Poignard', icon: '🔪', visual: 'dagger', primary: 'atk', base: 2, perLevel: 1.8, bonusCrit: 0.01 },
  bow: { name: 'Arc', icon: '🏹', visual: 'bow', primary: 'atk', base: 2, perLevel: 2.0, bonusCrit: 0.006 },
  staff: { name: 'Bâton', icon: '🪄', visual: 'staff', primary: 'atk', base: 2, perLevel: 2.1, bonusStat: 'int' },
  wand: { name: 'Orbe magique', icon: '🔮', visual: 'staff', model: 'wand', primary: 'atk', base: 2, perLevel: 1.9, bonusStat: 'int' },
  // V4.4 : nouvelles familles d'armes
  halberd: { name: 'Hallebarde', icon: '⚔️', visual: 'sword', model: 'halberd', primary: 'atk', base: 4, perLevel: 2.6 },
  scimitar: { name: 'Cimeterre', icon: '🗡️', visual: 'sword', model: 'scimitar', primary: 'atk', base: 3, perLevel: 2.3, bonusCrit: 0.006 },
  warhammer: { name: 'Marteau de guerre', icon: '🔨', visual: 'sword', model: 'warhammer', primary: 'atk', base: 5, perLevel: 2.5 },
  crossbow: { name: 'Arbalète', icon: '🏹', visual: 'bow', model: 'crossbow', primary: 'atk', base: 3, perLevel: 2.1, bonusCrit: 0.01 },
  tome: { name: 'Grimoire', icon: '📖', visual: 'staff', model: 'tome', primary: 'atk', base: 2, perLevel: 2.0, bonusStat: 'int' }
};

export const ARMOR_BASES = {
  helm: { name: 'Casque', icon: '🪖', slot: 'head', base: 1, perLevel: 0.9, hpBase: 3, hpPerLevel: 1.1 },
  chest: { name: 'Plastron', icon: '🥋', slot: 'chest', base: 2, perLevel: 1.3, hpBase: 6, hpPerLevel: 1.8 },
  gloves: { name: 'Gants', icon: '🧤', slot: 'gloves', base: 1, perLevel: 0.7, hpBase: 2, hpPerLevel: 0.7 },
  legs: { name: 'Pantalon', icon: '👖', slot: 'legs', base: 1, perLevel: 1.0, hpBase: 4, hpPerLevel: 1.2 },
  boots: { name: 'Bottes', icon: '🥾', slot: 'boots', base: 1, perLevel: 0.7, hpBase: 2, hpPerLevel: 0.7 },
  // V4.4 : épaules et cape (emplacements qui n'avaient encore aucun butin)
  pauldrons: { name: 'Épaulières', icon: '🧥', slot: 'shoulders', base: 1, perLevel: 0.8, hpBase: 3, hpPerLevel: 0.9 },
  cloak: { name: 'Cape', icon: '🧣', slot: 'cape', base: 1, perLevel: 0.5, hpBase: 4, hpPerLevel: 1.0 }
};

// V10.48 — icône du carquois : un vrai carquois (étui de cuir + flèches empennées), pas un arc. `icon` reste un emoji pour les textes (notifications, étiquettes) ; `iconHtml` est utilisé dans les cases d'inventaire.
export const QUIVER_SVG = '<svg class="ico-q" viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(24 12 12)"><path d="M9.5 9.6h5l-.9 11.4a1.5 1.5 0 0 1-1.5 1.4h-.2a1.5 1.5 0 0 1-1.5-1.4z" fill="#8a5a33" stroke="#2f1c0d" stroke-width=".9"/><rect x="9" y="8.6" width="6" height="1.9" rx=".6" fill="#c9a064" stroke="#2f1c0d" stroke-width=".8"/><path d="M10.4 8.6V3.6M12 8.6V2.4M13.6 8.6V3.6" stroke="#efe6cf" stroke-width="1" stroke-linecap="round"/><path d="M10.4 4.2l-1-1.7h2zM12 3l-1-1.7h2zM13.6 4.2l-1-1.7h2z" fill="#c8453b"/><path d="M10.2 12.6h3.6M10.4 15.8h3.2" stroke="#3b2412" stroke-width=".7" opacity=".7"/></g></svg>';

// V10.26 — objets secondaires : un par famille de classe (bouclier, orbe, carquois, dague de la main gauche).
// Chaque champ [base, parNiveau] donne une statistique ; `crit` est une fraction fixe.
export const OFFHAND_BASES = {
  shield: { name: 'Bouclier', icon: '🛡️', visual: 'shield', def: [2, 1.3], hp: [8, 2.0] },
  orb: { name: 'Orbe arcanique', icon: '🔮', visual: 'orb', atk: [1, 0.9], int: [1, 0.12], mana: [10, 1.6] },
  quiver: { name: 'Carquois', icon: '🏹', visual: 'quiver', atk: [1, 0.9], agi: [1, 0.12], crit: 0.012 },
  offdagger: { name: 'Dague de parade', icon: '🗡️', visual: 'offdagger', atk: [1, 1.0], agi: [1, 0.08], crit: 0.014 }
};
export const OFFHAND_BY_CLASS = { warrior: ['shield'], paladin: ['shield'], mage: ['orb'], archer: ['quiver'], assassin: ['offdagger'] };

export const ACCESSORY_BASES = {
  ring: { name: 'Anneau', icon: '💍', slot: 'ring' },
  amulet: { name: 'Amulette', icon: '📿', slot: 'necklace' },
  signet: { name: 'Chevalière', icon: '💍', slot: 'ring' },
  talisman: { name: 'Talisman', icon: '📿', slot: 'necklace' }
};

export const ACCESSORY_STAT_POOL = ['str', 'agi', 'int', 'vit', 'spi', 'luck'];

// Petits mots mis devant/derrière le nom de base selon la rareté, pour un nom
// d'objet généré qui ait l'air "à part" sans avoir besoin d'une liste écrite
// à la main pour chaque objet (des centaines/milliers à terme).
export const NAME_PREFIXES = {
  low: ['Simple', 'Robuste', 'Solide', 'Fiable', 'Usé', 'Rustique'],
  mid: ['Affûté', 'Renforcé', 'Gravé', 'Éclatant', 'Vaillant', 'Trempé', 'Rune', 'Sauvage'],
  high: ['Béni', 'Maudit', 'Flamboyant', 'Glacial', 'Foudroyant', 'Ténébreux', 'Radieux', 'Venimeux', 'Spectral', 'Tonitruant'],
  top: ['Immaculé', 'Céleste', 'Abyssal', 'Primordial', 'Éternel', 'Transcendant', 'Stellaire', 'Légendaire']
};
export const NAME_SUFFIXES = {
  low: [],
  mid: ['du Vagabond', 'du Chasseur', "de l'Aube", 'du Pisteur', 'de la Meute', 'du Marcheur'],
  high: ['du Gardien', 'des Tempêtes', 'du Dragon', "de l'Abysse", 'des Âmes Perdues', 'du Troll', 'du Fanatique', 'de la Nuit'],
  top: ['des Dieux Oubliés', "de la Genèse", "du Néant Primordial", "de l'Infini"]
};

export function namePoolForTier(tier) {
  if (tier <= 7) return 'low';
  if (tier <= 14) return 'mid';
  if (tier <= 20) return 'high';
  return 'top';
}
