// V10.18 — Niveaux de difficulté façon Diablo (données PARTAGÉES client + serveur).
// Plus la difficulté monte, plus les monstres sont solides et dangereux, plus l'or, l'expérience et les objets rares abondent.
// Le niveau choisi est enregistré avec le personnage (champ `difficulty`). On ne le change qu'en ville.
import { computeEnemyStats } from './enemyScaling.js';

// hp / dmg : multiplicateurs de monstres ; xp / gold : récompenses ; drop : chance d'objet ; shift : décalage de rareté du butin
export const DIFFICULTIES = [
  { id: 0, name: 'Normal', lvl: 1, hp: 1, dmg: 1, xp: 1, gold: 1, drop: 1, shift: 0, color: '#c9ced6' },
  { id: 1, name: 'Difficile', lvl: 10, hp: 1.5, dmg: 1.3, xp: 1.25, gold: 1.25, drop: 1.2, shift: 2, color: '#7dd3fc' },
  { id: 2, name: 'Expert', lvl: 25, hp: 2.2, dmg: 1.7, xp: 1.6, gold: 1.6, drop: 1.45, shift: 4, color: '#86efac' },
  { id: 3, name: 'Maître', lvl: 40, hp: 3.2, dmg: 2.2, xp: 2.1, gold: 2.1, drop: 1.8, shift: 6, color: '#fde047' },
  { id: 4, name: 'Tourment I', lvl: 60, hp: 4.5, dmg: 2.9, xp: 2.8, gold: 2.8, drop: 2.2, shift: 9, color: '#fdba74' },
  { id: 5, name: 'Tourment II', lvl: 80, hp: 6.5, dmg: 3.8, xp: 3.7, gold: 3.7, drop: 2.7, shift: 12, color: '#fb923c' },
  { id: 6, name: 'Tourment III', lvl: 100, hp: 9.5, dmg: 5, xp: 5, gold: 5, drop: 3.4, shift: 16, color: '#f87171' },
  { id: 7, name: 'Tourment IV', lvl: 130, hp: 14, dmg: 6.5, xp: 7, gold: 7, drop: 4.2, shift: 20, color: '#e879f9' }
];
export const MAX_DIFFICULTY = DIFFICULTIES.length - 1;
export const clampDifficulty = (n) => (Number.isInteger(n) ? Math.max(0, Math.min(MAX_DIFFICULTY, n)) : 0);

let current = 0;
export const getDifficultyId = () => current;
export const getDifficulty = () => DIFFICULTIES[current];
export const setDifficultyId = (n) => { current = clampDifficulty(n); return DIFFICULTIES[current]; };

// Le matériel du joueur (objets de rareté croissante) grandit plus vite que la formule de base des monstres :
// on durcit donc les monstres avec le niveau pour qu'ils restent un défi du niveau 1 au niveau 200.
export const hpScale = (level) => 1 + Math.pow(level / 12, 1.1);
export const dmgScale = (level) => 1 + level / 150;

// Statistiques réelles d'un monstre : base du niveau et de l'espèce × durcissement par niveau × difficulté choisie.
export function scaledEnemyStats(level, species) {
  const s = computeEnemyStats(level, species), d = getDifficulty(), hs = species === 'goblin' ? 1 : hpScale(level); // le lutin trésor reste facile à abattre une fois rattrapé
  const rewardK = (1 + (hs - 1) * 0.35); // les combats durent plus longtemps : on récompense davantage
  const xp = Math.max(1, Math.round(s.xp * rewardK * d.xp));
  return {
    hp: Math.max(5, Math.round(s.hp * hs * (species === 'goblin' ? 1 : d.hp))),
    damage: Math.max(1, Math.round(s.damage * dmgScale(level) * d.dmg)),
    defense: s.defense,
    xp,
    coins: [Math.max(1, Math.round(s.coins[0] * rewardK * d.gold)), Math.max(2, Math.round(s.coins[1] * rewardK * d.gold))]
  };
}
