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
  { id: 'hw_title_roi', cat: 'title', name: 'Briseur de citrouilles', desc: 'Titre d’Halloween.', candy: 110, event: 'halloween', fx: { text: 'Briseur de citrouilles', color: '#ff9a3c' } },
  // ---- V10.17 : suite de la collection d'Halloween ----
  { id: 'hw_aura_sang', cat: 'aura', name: 'Aura de vampire', desc: 'Un halo rouge sombre, comme un crépuscule de sang.', candy: 60, event: 'halloween', fx: { color: 0xc0102a, embers: true } },
  { id: 'hw_aura_toxique', cat: 'aura', name: 'Aura de potion', desc: 'Une vapeur verte de chaudron de sorcière.', candy: 55, event: 'halloween', fx: { color: 0x9aff3a, spin: 3 } },
  { id: 'hw_aura_os', cat: 'aura', name: 'Aura d’os blancs', desc: 'Un éclat blanc froid de catacombes.', candy: 50, event: 'halloween', fx: { color: 0xf0ecdc } },
  { id: 'hw_ring_citrouilles', cat: 'ring', name: 'Cercle de citrouilles', desc: 'Un anneau de petites lanternes orange.', candy: 60, event: 'halloween', fx: { color: 0xff8a1a } },
  { id: 'hw_ring_pentacle', cat: 'ring', name: 'Pentacle maudit', desc: 'Un sceau pourpre aux reflets d’enfer.', candy: 100, event: 'halloween', fx: { color: 0xb02aff } },
  { id: 'hw_ring_cimetiere', cat: 'ring', name: 'Cercle de cimetière', desc: 'Une brume verdâtre au ras du sol.', candy: 70, event: 'halloween', fx: { color: 0x7affb0 } },
  { id: 'hw_trail_chauves', cat: 'trail', name: 'Nuée de chauves-souris', desc: 'Des ombres qui s’envolent dans votre dos.', candy: 70, event: 'halloween', fx: { color: 0x5a3a8a } },
  { id: 'hw_trail_braises', cat: 'trail', name: 'Braises de lanterne', desc: 'Des étincelles de citrouille.', candy: 50, event: 'halloween', fx: { color: 0xff9a2a } },
  { id: 'hw_trail_sorcellerie', cat: 'trail', name: 'Fumée de sortilège', desc: 'Une fumée violette et orange.', candy: 90, event: 'halloween', fx: { prism: true } },
  { id: 'hw_wings_corbeau', cat: 'wings', name: 'Ailes de corbeau', desc: 'Des plumes noires, un reflet bleuté.', candy: 190, event: 'halloween', fx: { color: 0x14141f, glow: 0x6a7aff, style: 'ange' } },
  { id: 'hw_wings_citrouille', cat: 'wings', name: 'Ailes de lanterne', desc: 'Des ailes orange qui brillent comme une bougie.', candy: 220, event: 'halloween', fx: { color: 0xff8a1a, glow: 0xffd24a, style: 'cristal' } },
  { id: 'hw_title_vampire', cat: 'title', name: 'Comte de la nuit', desc: 'Titre d’Halloween.', candy: 70, event: 'halloween', fx: { text: 'Comte de la nuit', color: '#ff6a7a' } },
  { id: 'hw_title_sorcier', cat: 'title', name: 'Maître des sortilèges', desc: 'Titre d’Halloween.', candy: 80, event: 'halloween', fx: { text: 'Maître des sortilèges', color: '#d28bff' } },
  { id: 'hw_title_gourmand', cat: 'title', name: 'Gourmand de bonbons', desc: 'Titre d’Halloween.', candy: 30, event: 'halloween', fx: { text: 'Gourmand de bonbons', color: '#ff9fd0' } },
  { id: 'hw_title_terreur', cat: 'title', name: 'Terreur de la nuit', desc: 'Titre d’Halloween : gagné en vainquant le Roi Citrouille.', unlock: { hwBoss: 1 }, event: 'halloween', fx: { text: 'Terreur de la nuit', color: '#ff7a2a' } },
  // ---- Compagnons d'Halloween ----
  { id: 'hw_pet_chauve', cat: 'pet', name: 'Petite chauve-souris', desc: 'Elle voltige autour de toi.', candy: 90, event: 'halloween', fx: { kind: 'bat', color: 0x2a1a3a, eye: 0xff4a4a } },
  { id: 'hw_pet_fantome', cat: 'pet', name: 'Petit fantôme', desc: 'Un fantôme timide qui flotte à tes côtés.', candy: 110, event: 'halloween', fx: { kind: 'ghost', color: 0xe8fff0 } },
  { id: 'hw_pet_citrouille', cat: 'pet', name: 'Citrouillon', desc: 'Une petite citrouille qui rebondit.', candy: 70, event: 'halloween', fx: { kind: 'pumpkin', color: 0xf5821f } },
  { id: 'hw_pet_chatsquelette', cat: 'pet', name: 'Chat squelette', desc: 'Un chat tout en os, aux yeux de braise.', candy: 130, event: 'halloween', fx: { kind: 'cat', color: 0xe9e4d2, eye: 0xff7a1a } },
  { id: 'hw_pet_araignee', cat: 'pet', name: 'Araignée', desc: 'Huit pattes, zéro danger.', candy: 100, event: 'halloween', fx: { kind: 'spider', color: 0x1a1a1a, eye: 0xff3a3a } },
  { id: 'hw_pet_roi', cat: 'pet', name: 'Mini Roi Citrouille', desc: 'Gagné en vainquant le Roi Citrouille : un petit roi à couronne.', unlock: { hwBoss: 1 }, event: 'halloween', fx: { kind: 'pumpkin', color: 0xe86a10, crown: true } },
  // ---- Skins d'Halloween ----
  { id: 'hw_skin_squelette', cat: 'skin', name: 'Squelette', desc: 'Os blancs et tenue en lambeaux.', candy: 150, event: 'halloween', fx: { tone: 0xe9e4d2, cloth: 0xd8d2bd, steel: 0xbfb8a0 } },
  { id: 'hw_skin_spectre', cat: 'skin', name: 'Spectre', desc: 'Un corps fantomatique et translucide.', candy: 220, event: 'halloween', fx: { tone: 0xe8fff0, cloth: 0xcfe8ff, steel: 0xdff8ee, glow: 0x2a6a5a, ghost: 0.55 } },
  { id: 'hw_skin_sorciere', cat: 'skin', name: 'Sorcier / Sorcière', desc: 'Violet profond et chapeau pointu.', candy: 180, event: 'halloween', fx: { cloth: 0x3a1a5a, steel: 0x6a2a8a, head: 'witchhat' } },
  { id: 'hw_skin_citrouille', cat: 'skin', name: 'Tête de citrouille', desc: 'La même tête que Jack. Frissons garantis.', candy: 260, event: 'halloween', fx: { cloth: 0x3a1a05, steel: 0xf5821f, head: 'pumpkin' } },
  { id: 'hw_skin_loup', cat: 'skin', name: 'Loup-garou', desc: 'Pelage sombre et oreilles pointues.', candy: 200, event: 'halloween', fx: { tone: 0x5a4a3a, cloth: 0x3a2f26, steel: 0x5a4a3a, head: 'wolfears' } },
  { id: 'hw_skin_vampire', cat: 'skin', name: 'Comte vampire', desc: 'Teint pâle, noir et rouge sang.', candy: 170, event: 'halloween', fx: { tone: 0xe8dcd8, cloth: 0x1a0a1a, steel: 0x8a1020 } },
  { id: 'hw_skin_momie', cat: 'skin', name: 'Momie', desc: 'Des bandelettes anciennes.', candy: 120, event: 'halloween', fx: { tone: 0xe6dcc0, cloth: 0xe6dcc0, steel: 0xcfc4a4 } },
  { id: 'hw_skin_roi', cat: 'skin', name: 'Tenue du Roi Citrouille', desc: 'Gagnée en vainquant le Roi Citrouille 3 fois.', unlock: { hwBoss: 3 }, event: 'halloween', fx: { cloth: 0x4a1a05, steel: 0xffb02a, glow: 0x4a2000, head: 'crown' } }
];
export const HALLOWEEN_BY_ID = Object.assign(Object.create(null), Object.fromEntries(HALLOWEEN_ITEMS.map((c) => [c.id, c])));
