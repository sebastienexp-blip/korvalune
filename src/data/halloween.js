// V10.13 — Événement Halloween (données PARTAGÉES serveur + client).
// Le serveur est seul juge des bonbons : solde, gains (plafonnés), achats. Le client ne fait qu'afficher et envoyer des demandes.

// Dates en UTC. L'événement démarre dès la mise en ligne et s'arrête tout seul : les cosmétiques gagnés restent au joueur pour toujours.
export const EVENT = {
  id: 'halloween',
  start: Date.parse('2026-10-09T00:00:00Z'),
  end: Date.parse('2026-11-02T00:00:00Z'),      // dernier jour : 1er novembre inclus
  shopEnd: Date.parse('2026-11-05T00:00:00Z')   // la boutique de Jack reste ouverte 3 jours de plus pour dépenser ses bonbons
};
export const eventActive = (now = Date.now()) => now >= EVENT.start && now < EVENT.end;
export const shopOpen = (now = Date.now()) => now >= EVENT.start && now < EVENT.shopEnd;

export const CANDY = {
  name: 'Bonbons',
  daily: 8,             // sac quotidien chez Jack
  perHunt: 2,           // par bonbon ramassé dans la ville
  killCapPerDay: 120,   // plafond de bonbons gagnés en combattant, par jour et par compte
  killMinGapMs: 700,    // délai minimum entre deux victoires déclarées
  huntBonus: 10,        // tous les bonbons de la ville ramassés dans la journée
  killBonus: 10,        // défi du jour : 25 monstres de l'événement vaincus
  killGoal: 25,
  pickRange: 7          // distance serveur maximale (en mètres) entre le joueur et un bonbon ramassé
};

// Bonbons cachés dans la ville : ils réapparaissent chaque jour (UTC).
export const HUNT_SPOTS = [
  { id: 'h1', x: 4, z: 8 }, { id: 'h2', x: -5, z: 9 }, { id: 'h3', x: 10, z: -1 }, { id: 'h4', x: -11, z: 1 },
  { id: 'h5', x: 0, z: -10 }, { id: 'h6', x: -22, z: 1 }, { id: 'h7', x: 22, z: 0 }, { id: 'h8', x: 8, z: 28 },
  { id: 'h9', x: 0, z: 22 }, { id: 'h10', x: -24, z: -3 }, { id: 'h11', x: 24, z: -3 }, { id: 'h12', x: -3, z: -24 },
  { id: 'h13', x: 14, z: 20 }, { id: 'h14', x: -16, z: 10 }
];
export const HUNT_BY_ID = Object.assign(Object.create(null), Object.fromEntries(HUNT_SPOTS.map((h) => [h.id, h])));

// Monstres de l'événement (définitions de comportement dans enemies.json). candy = bonbons par victoire.
export const EVENT_MONSTERS = {
  hw_skeleton: { candy: 1 },
  hw_pumpkin: { candy: 2 },
  hw_ghost: { candy: 2 },
  hw_werewolf: { candy: 3 },
  hw_witch: { candy: 3 },
  hw_pumpkin_king: { candy: 30, boss: true }
};

// Cosmétiques d'événement : mêmes emplacements que la boutique des Lunes (aura, cercle, traînée, ailes, titre), mais payés en bonbons.
// Ils sont enregistrés dans CATALOG_BY_ID (pour l'équipement et l'affichage) mais PAS dans la liste de la boutique des Lunes.
export const HALLOWEEN_ITEMS = [
  { id: 'hw_aura_citrouille', cat: 'aura', name: 'Aura de citrouille', desc: 'Des braises orangées, comme une lanterne de la nuit des morts.', candy: 40, event: 'halloween', fx: { color: 0xff7a1a, embers: true } },
  { id: 'hw_aura_spectre', cat: 'aura', name: 'Aura de spectre', desc: 'Une lueur verdâtre qui tournoie autour de l’arme.', candy: 70, event: 'halloween', fx: { color: 0x6dff9a, spin: 3 } },
  { id: 'hw_ring_toile', cat: 'ring', name: 'Cercle de toiles', desc: 'Un anneau de toiles d’araignée argentées.', candy: 50, event: 'halloween', fx: { color: 0xdfe6ff } },
  { id: 'hw_ring_sorciere', cat: 'ring', name: 'Cercle de sorcière', desc: 'Un cercle de sortilège violet et orange.', candy: 90, event: 'halloween', fx: { prism: true } },
  { id: 'hw_trail_bonbons', cat: 'trail', name: 'Pluie de bonbons', desc: 'Des bonbons colorés tombent derrière vous.', candy: 45, event: 'halloween', fx: { color: 0xff5fa8 } },
  { id: 'hw_trail_fantomes', cat: 'trail', name: 'Brume de fantômes', desc: 'Une brume pâle qui chuchote dans votre sillage.', candy: 80, event: 'halloween', fx: { color: 0xb9f3ff } },
  { id: 'hw_wings_chauve', cat: 'wings', name: 'Ailes de chauve-souris', desc: 'De grandes ailes membraneuses, bordées de braise orange.', candy: 160, event: 'halloween', fx: { color: 0x1c1030, glow: 0xff7a1a, style: 'demon' } },
  { id: 'hw_wings_spectre', cat: 'wings', name: 'Ailes du spectre', desc: 'Des ailes de cristal fantomatique, vertes et translucides.', candy: 260, event: 'halloween', fx: { color: 0xc8ffd8, prism: true, style: 'cristal' } },
  { id: 'hw_title_chasseur', cat: 'title', name: 'Chasseur de spectres', desc: 'Titre d’Halloween.', candy: 40, event: 'halloween', fx: { text: 'Chasseur de spectres', color: '#8dffb0' } },
  { id: 'hw_title_maudit', cat: 'title', name: 'Maudit d’Halloween', desc: 'Titre d’Halloween.', candy: 60, event: 'halloween', fx: { text: 'Maudit d’Halloween', color: '#c58bff' } },
  { id: 'hw_title_roi', cat: 'title', name: 'Briseur de citrouilles', desc: 'Titre d’Halloween.', candy: 110, event: 'halloween', fx: { text: 'Briseur de citrouilles', color: '#ff9a3c' } }
];
export const HALLOWEEN_BY_ID = Object.assign(Object.create(null), Object.fromEntries(HALLOWEEN_ITEMS.map((c) => [c.id, c])));
