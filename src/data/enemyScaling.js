// Calcule les statistiques réelles d'un ennemi à partir de son niveau et de
// son "espèce" (gabarit de comportement), au lieu de chiffres fixes par
// ennemi. C'est ce qui permet au jeu de rester cohérent du niveau 1 au
// niveau 200 : un loup niveau 5 et un loup niveau 150 utilisent la même
// formule, juste avec un niveau différent — pas besoin de centaines
// d'ennemis définis à la main. Calibré pour qu'un personnage qui combat des
// ennemis de son niveau mette ~5 coups à en vaincre un, quel que soit le
// niveau (vérifié par simulation de 1 à 200).
export const SPECIES = {
  // rapide, fragile, mord fort
  wolf: { hp: 0.8, dmg: 1.15, def: 0.7, xp: 0.9 },
  // lent, tanky
  boar: { hp: 1.3, dmg: 0.85, def: 1.3, xp: 1.0 },
  // très résistant, encaisse tout
  bear: { hp: 1.7, dmg: 0.95, def: 1.15, xp: 1.15 },
  // humanoïde, équilibré
  bandit: { hp: 1.0, dmg: 1.0, def: 1.0, xp: 1.1 },
  // humanoïde massif, cogneur
  brute: { hp: 1.5, dmg: 1.3, def: 0.85, xp: 1.3 },
  // chef / mini-boss
  elite: { hp: 2.6, dmg: 1.5, def: 1.4, xp: 2.8 },
  // boss majeur
  boss: { hp: 16, dmg: 2.0, def: 1.6, xp: 14 },
  // lutin trésor : fuit sans arrêt, presque inoffensif, mais très peu de PV
  // une fois rattrapé — tout l'intérêt est de réussir à le toucher.
  // V4.4 : nouvelles espèces
  skitter: { hp: 0.45, dmg: 0.8, def: 0.5, xp: 0.7 },
  alpha: { hp: 1.7, dmg: 1.3, def: 1.0, xp: 2.0 },
  guard: { hp: 1.3, dmg: 0.9, def: 1.6, xp: 1.25 },
  zealot: { hp: 0.7, dmg: 1.1, def: 0.6, xp: 1.2 },
  // V4.5 : monstres à distance (fragiles, frappent de loin)
  archer: { hp: 0.7, dmg: 1.0, def: 0.7, xp: 1.2 },
  mage: { hp: 0.6, dmg: 1.35, def: 0.5, xp: 1.4 },
  troll: { hp: 1.9, dmg: 1.1, def: 0.9, xp: 1.5 },
  goblin: { hp: 0.35, dmg: 0.08, def: 0.15, xp: 1.4 }
};

export function computeEnemyStats(level, speciesKey) {
  const m = SPECIES[speciesKey] || SPECIES.bandit;
  const hp = Math.max(5, Math.round((30 + level * 11.4) * m.hp));
  const damage = Math.max(1, Math.round((6 + level * 4.233) * m.dmg));
  const defense = Math.max(0, Math.round((1 + level * 0.55) * m.def));
  const xp = Math.max(1, Math.round((3.33 * Math.pow(level, 1.5) + 2.2) * m.xp));
  const coinLo = Math.max(1, Math.round(xp * 0.11));
  const coinHi = Math.max(coinLo + 1, Math.round(xp * 0.28));
  return { hp, damage, defense, xp, coins: [coinLo, coinHi] };
}
