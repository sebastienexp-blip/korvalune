// V10.18 — Niveaux de difficulté à paliers (données PARTAGÉES client + serveur).
// Plus la difficulté monte, plus les monstres sont solides et dangereux, plus l'or, l'expérience et les objets rares abondent.
// Le niveau choisi est enregistré avec le personnage (champ `difficulty`). V10.33 : aucun verrou, on le change quand on veut (`lvl` n'est plus qu'un niveau conseillé).
import { computeEnemyStats } from './enemyScaling.js';

// hp / dmg : multiplicateurs de monstres ; xp / gold : récompenses ; drop : chance d'objet ; shift : décalage de rareté du butin
export const DIFFICULTIES = [
  { id: 0, name: 'Voyageur', lvl: 1, hp: 1, dmg: 1, xp: 1, gold: 1, drop: 1, shift: 0, color: '#c9ced6' },
  { id: 1, name: 'Aguerri', lvl: 10, hp: 1.5, dmg: 1.3, xp: 1.25, gold: 1.25, drop: 1.2, shift: 2, color: '#7dd3fc' },
  { id: 2, name: 'Vétéran', lvl: 25, hp: 2.2, dmg: 1.7, xp: 1.6, gold: 1.6, drop: 1.45, shift: 4, color: '#86efac' },
  { id: 3, name: 'Champion', lvl: 40, hp: 3.2, dmg: 2.2, xp: 2.1, gold: 2.1, drop: 1.8, shift: 6, color: '#fde047' },
  { id: 4, name: 'Fléau I', lvl: 60, hp: 4.5, dmg: 2.9, xp: 2.8, gold: 2.8, drop: 2.2, shift: 9, color: '#fdba74' },
  { id: 5, name: 'Fléau II', lvl: 80, hp: 6.5, dmg: 3.8, xp: 3.7, gold: 3.7, drop: 2.7, shift: 12, color: '#fb923c' },
  { id: 6, name: 'Fléau III', lvl: 100, hp: 9.5, dmg: 5, xp: 5, gold: 5, drop: 3.4, shift: 16, color: '#f87171' },
  { id: 7, name: 'Fléau IV', lvl: 130, hp: 14, dmg: 6.5, xp: 7, gold: 7, drop: 4.2, shift: 20, color: '#e879f9' },
  // V10.33 : dix paliers de plus pour les personnages de fin de jeu (Zénith)
  { id: 8, name: 'Calamité I', lvl: 150, hp: 20, dmg: 8.5, xp: 9.5, gold: 9.5, drop: 4.6, shift: 22, color: '#f472b6' },
  { id: 9, name: 'Calamité II', lvl: 160, hp: 28, dmg: 11, xp: 13, gold: 13, drop: 5, shift: 24, color: '#fb7185' },
  { id: 10, name: 'Calamité III', lvl: 170, hp: 40, dmg: 14, xp: 18, gold: 18, drop: 5.4, shift: 26, color: '#f43f5e' },
  { id: 11, name: 'Calamité IV', lvl: 180, hp: 56, dmg: 18, xp: 25, gold: 25, drop: 5.8, shift: 28, color: '#ef4444' },
  { id: 12, name: 'Calamité V', lvl: 190, hp: 80, dmg: 23, xp: 35, gold: 35, drop: 6.2, shift: 30, color: '#dc2626' },
  { id: 13, name: 'Apocalypse I', lvl: 200, hp: 110, dmg: 30, xp: 48, gold: 48, drop: 6.6, shift: 33, color: '#c084fc' },
  { id: 14, name: 'Apocalypse II', lvl: 200, hp: 150, dmg: 38, xp: 66, gold: 66, drop: 7, shift: 36, color: '#a855f7' },
  { id: 15, name: 'Apocalypse III', lvl: 200, hp: 210, dmg: 48, xp: 90, gold: 90, drop: 7.4, shift: 40, color: '#9333ea' },
  { id: 16, name: 'Apocalypse IV', lvl: 200, hp: 300, dmg: 60, xp: 125, gold: 125, drop: 7.8, shift: 44, color: '#7e22ce' },
  { id: 17, name: 'Apocalypse V', lvl: 200, hp: 420, dmg: 75, xp: 175, gold: 175, drop: 8.2, shift: 50, color: '#6b21a8' }
];
export const MAX_DIFFICULTY = DIFFICULTIES.length - 1;
export const clampDifficulty = (n) => (Number.isInteger(n) ? Math.max(0, Math.min(MAX_DIFFICULTY, n)) : 0);

let current = 0;
export const getDifficultyId = () => current;
export const getDifficulty = () => DIFFICULTIES[current];
export const setDifficultyId = (n) => { current = clampDifficulty(n); return DIFFICULTIES[current]; };

// Le matériel du joueur (objets de rareté croissante) grandit plus vite que la formule de base des monstres :
// on durcit donc les monstres avec le niveau pour qu'ils restent un défi du niveau 1 au niveau 200.
export const hpScale = (level) => 1 + (level / 80) * 0.8; // V10.19 : fortement adouci (niveau 100 ≈ ×2 ; niveau 200 ≈ ×3) — les monstres étaient trop coriaces
export const dmgScale = (level) => 1 + level / 400;

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
