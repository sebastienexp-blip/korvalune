// V10.1 — Boutique des Lunes : catalogue PARTAGÉ (serveur + client).
// Règle de conception : on ne vend QUE de l'apparence et du confort — jamais de puissance de combat.
// Le serveur valide chaque achat (prix, possession, prérequis) ; le client ne fait qu'afficher.
//
// fx : paramètres visuels lus par src/visual/Cosmetics.js (couleur hex, 'prism' = arc-en-ciel animé).

export const LUNES = {
  name: 'Lunes',
  welcome: 50,          // offert à la création du compte
  daily: 20,            // récompense quotidienne (1 fois par jour, côté serveur)
  perLevel: 3,          // par nouveau niveau atteint (record du compte, tous personnages confondus)
  maxBankTabs: 4        // onglets de coffre supplémentaires achetables
};

export const CATEGORIES = [
  { id: 'aura', label: 'Auras d’arme', icon: '🗡️', slot: 'aura' },
  { id: 'ring', label: 'Cercles', icon: '⭕', slot: 'ring' },
  { id: 'trail', label: 'Traînées', icon: '✨', slot: 'trail' },
  { id: 'wings', label: 'Ailes', icon: '🪽', slot: 'wings' },
  { id: 'title', label: 'Titres', icon: '🏷️', slot: 'title' },
  { id: 'perk', label: 'Confort', icon: '🎒', slot: null }
];

export const CATALOG = [
  // ---- Auras d'arme (visibles même sur une arme commune ; remplacent l'aura de rareté) ----
  { id: 'aura_azur', cat: 'aura', name: 'Aura d’azur', desc: 'Un halo bleu glacé qui danse le long de votre arme.', price: 60, fx: { color: 0x58c4ff } },
  { id: 'aura_braise', cat: 'aura', name: 'Aura de braise', desc: 'Des braises orangées s’élèvent de la lame.', price: 80, fx: { color: 0xff7a2e, embers: true } },
  { id: 'aura_jade', cat: 'aura', name: 'Aura de jade', desc: 'Une lueur verte, calme et profonde.', price: 80, fx: { color: 0x3be08f } },
  { id: 'aura_nuit', cat: 'aura', name: 'Aura des abysses', desc: 'Des volutes violettes aspirées vers l’arme.', price: 120, fx: { color: 0x9a4bff, spin: 3 } },
  { id: 'aura_prisme', cat: 'aura', name: 'Aura prismatique', desc: 'Toutes les couleurs, en continu.', price: 200, fx: { prism: true } },

  // ---- Cercles au sol ----
  { id: 'ring_runes', cat: 'ring', name: 'Cercle runique', desc: 'Un cercle d’runes bleues qui tourne sous vos pieds.', price: 90, fx: { color: 0x6aa8ff } },
  { id: 'ring_flamme', cat: 'ring', name: 'Cercle de flammes', desc: 'Un anneau de feu doux autour de vous.', price: 120, fx: { color: 0xff6a2a } },
  { id: 'ring_givre', cat: 'ring', name: 'Cercle de givre', desc: 'Un anneau de cristaux de glace.', price: 120, fx: { color: 0xa8ecff } },
  { id: 'ring_astral', cat: 'ring', name: 'Cercle astral', desc: 'Un cercle d’étoiles aux couleurs changeantes.', price: 220, fx: { prism: true } },

  // ---- Traînées de déplacement ----
  { id: 'trail_etincelles', cat: 'trail', name: 'Étincelles dorées', desc: 'Une poussière d’or derrière chacun de vos pas.', price: 70, fx: { color: 0xffd45a } },
  { id: 'trail_petales', cat: 'trail', name: 'Pétales roses', desc: 'Des pétales qui flottent dans votre sillage.', price: 90, fx: { color: 0xff8fc4 } },
  { id: 'trail_ombre', cat: 'trail', name: 'Brume d’ombre', desc: 'Une brume violette qui s’attarde.', price: 110, fx: { color: 0x8a52ff } },
  { id: 'trail_arc', cat: 'trail', name: 'Arc-en-ciel', desc: 'Une traînée de toutes les couleurs.', price: 200, fx: { prism: true } },

  // ---- Ailes ----
  { id: 'wings_ange', cat: 'wings', name: 'Ailes d’aube', desc: 'Des ailes de lumière dorée.', price: 250, fx: { color: 0xfff1b0, glow: 0xffd45a, style: 'ange' } },
  { id: 'wings_demon', cat: 'wings', name: 'Ailes des cendres', desc: 'Des ailes sombres bordées de braise.', price: 250, fx: { color: 0x2a1020, glow: 0xff3a2a, style: 'demon' } },
  { id: 'wings_cristal', cat: 'wings', name: 'Ailes de cristal', desc: 'Des ailes translucides aux reflets changeants.', price: 400, fx: { color: 0xbfe6ff, prism: true, style: 'cristal' } },

  // ---- Titres (affichés au-dessus de votre nom pour les autres joueurs) ----
  { id: 'title_pionnier', cat: 'title', name: 'Pionnier de Korvalune', desc: 'Pour les premiers aventuriers.', price: 30, fx: { text: 'Pionnier de Korvalune', color: '#9fe3ff' } },
  { id: 'title_chasseur', cat: 'title', name: 'Chasseur de légendes', desc: 'Un titre qui impose le respect.', price: 60, fx: { text: 'Chasseur de légendes', color: '#ffd45a' } },
  { id: 'title_aube', cat: 'title', name: 'Porteur d’Aube', desc: 'Réservé à ceux qui n’ont pas peur de la nuit.', price: 100, fx: { text: 'Porteur d’Aube', color: '#ffb36b' } },
  { id: 'title_spires', cat: 'title', name: 'Seigneur des Spires', desc: 'Pour les maîtres des spires d’Éther.', price: 150, fx: { text: 'Seigneur des Spires', color: '#d79bff' } },

  // ---- Confort (aucun avantage de combat) ----
  { id: 'bank_1', cat: 'perk', name: 'Coffre : onglet 5', desc: '+30 emplacements dans votre coffre partagé.', price: 80, perk: 'bank', requires: null },
  { id: 'bank_2', cat: 'perk', name: 'Coffre : onglet 6', desc: '+30 emplacements dans votre coffre partagé.', price: 100, perk: 'bank', requires: 'bank_1' },
  { id: 'bank_3', cat: 'perk', name: 'Coffre : onglet 7', desc: '+30 emplacements dans votre coffre partagé.', price: 120, perk: 'bank', requires: 'bank_2' },
  { id: 'bank_4', cat: 'perk', name: 'Coffre : onglet 8', desc: '+30 emplacements dans votre coffre partagé.', price: 150, perk: 'bank', requires: 'bank_3' }
];

// objet SANS prototype : CATALOG_BY_ID['__proto__'] / ['constructor'] ne doit jamais renvoyer un « objet » valide (faille d'achat gratuit)
export const CATALOG_BY_ID = Object.assign(Object.create(null), Object.fromEntries(CATALOG.map((c) => [c.id, c])));
export const COSMETIC_SLOTS = ['aura', 'ring', 'trail', 'wings', 'title'];
