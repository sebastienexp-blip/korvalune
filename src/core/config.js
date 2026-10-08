// Configuration centralisée du jeu.
export const CONFIG = {
  world: { size: 1100, segments: 200, waterLevel: -1.4, flat: true, townRadius: 52, bound: 500 },
  dayNight: { cycleSeconds: 780, startHour: 9 },
  player: { walk: 4.2, run: 7.4, crouch: 2.2, jump: 7.6, gravity: 22, radius: 0.45, spawn: [0, 12] },
  camera: { min: 2.5, max: 14, start: 7, fov: 60, far: 900 },
  quality: {
    verylow: { label: 'Très faible', pixelRatio: 0.75, shadows: false, shadowMap: 512, trees: 0.12, fogFar: 90, particles: 0.2 },
    low: { label: 'Faible', pixelRatio: 1, shadows: false, shadowMap: 512, trees: 0.3, fogFar: 120, particles: 0.35 },
    medium: { label: 'Moyenne', pixelRatio: 1.5, shadows: true, shadowMap: 1024, trees: 0.6, fogFar: 180, particles: 0.7 },
    high: { label: 'Élevée', pixelRatio: 2, shadows: true, shadowMap: 2048, trees: 0.85, fogFar: 240, particles: 1 },
    ultra: { label: 'Ultra', pixelRatio: 3, shadows: true, shadowMap: 2048, trees: 1, fogFar: 300, particles: 1 }
  },
  qualityOrder: ['verylow', 'low', 'medium', 'high', 'ultra'],
  saveKey: 'aetheria.save.v1',
  settingsKey: 'aetheria.settings.v1'
};
