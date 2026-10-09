import { HALLOWEEN_ITEMS } from './halloween.js';
import { PASS_ITEMS } from './battlePass.js';
// V10.1 — Boutique des Lunes : catalogue PARTAGÉ (serveur + client).
// Règle de conception : on ne vend QUE de l'apparence et du confort — jamais de puissance de combat.
// Le serveur valide chaque achat (prix, possession, prérequis) ; le client ne fait qu'afficher.
//
// fx : paramètres visuels lus par src/visual/Cosmetics.js (couleur hex, 'prism' = arc-en-ciel animé).

export const LUNES = {
  name: 'Lunes',
  welcome: 15,          // offert à la création du compte (de quoi s'offrir un titre ou presque)
  daily: 3,             // récompense quotidienne (1 fois par jour, côté serveur) : ~90 par mois
  levelStep: 5,         // une prime tous les 5 niveaux (record du compte, tous personnages confondus)
  perStep: 2,           // Lunes par palier de niveau : 80 au maximum sur les 200 niveaux
  maxBankTabs: 4        // onglets de coffre supplémentaires achetables
};

export const CATEGORIES = [
  { id: 'aura', label: 'Auras d’arme', icon: '🗡️', slot: 'aura' },
  { id: 'ring', label: 'Cercles', icon: '⭕', slot: 'ring' },
  { id: 'trail', label: 'Traînées', icon: '✨', slot: 'trail' },
  { id: 'wings', label: 'Ailes', icon: '🪽', slot: 'wings' },
  { id: 'title', label: 'Titres', icon: '🏷️', slot: 'title' },
  { id: 'pet', label: 'Compagnons', icon: '🐾', slot: 'pet' },
  { id: 'skin', label: 'Skins', icon: '🧥', slot: 'skin' },
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

  // ================= V10.17 — grand élargissement de la boutique =================
  // unlock : { level } = offert automatiquement quand le record de niveau du compte l'atteint (gratuit, jamais achetable).
  // ---- Auras (suite) ----
  { id: 'aura_foudre', cat: 'aura', name: 'Aura d’orage', desc: 'Des arcs électriques jaunes crépitent autour de l’arme.', price: 100, fx: { color: 0xffe45a, spin: 4 } },
  { id: 'aura_sang', cat: 'aura', name: 'Aura de sang', desc: 'Une lueur cramoisie, lourde et chaude.', price: 110, fx: { color: 0xd01a3a, embers: true } },
  { id: 'aura_sylve', cat: 'aura', name: 'Aura sylvestre', desc: 'Des lucioles vertes montent le long de la lame.', price: 90, fx: { color: 0x7bd957, embers: true } },
  { id: 'aura_lune', cat: 'aura', name: 'Aura lunaire', desc: 'Un halo blanc argenté, doux et froid.', price: 90, fx: { color: 0xdfe9ff } },
  { id: 'aura_ocean', cat: 'aura', name: 'Aura des marées', desc: 'Un tourbillon d’eau turquoise.', price: 100, fx: { color: 0x2aa8c4, spin: 3 } },
  { id: 'aura_or', cat: 'aura', name: 'Aura dorée', desc: 'De la poussière d’or qui s’élève sans fin.', price: 130, fx: { color: 0xffc83d, embers: true } },
  { id: 'aura_vide', cat: 'aura', name: 'Aura du vide', desc: 'Un noyau d’ombre violette qui aspire la lumière.', price: 160, fx: { color: 0x4a1a8a, spin: 5 } },
  { id: 'aura_novice', cat: 'aura', name: 'Aura de l’apprenti', desc: 'Offerte au niveau 15 : une petite lueur bleue.', unlock: { level: 15 }, fx: { color: 0x8fd0ff } },

  // ---- Cercles (suite) ----
  { id: 'ring_foret', cat: 'ring', name: 'Cercle sylvestre', desc: 'Des feuilles et des racines lumineuses.', price: 100, fx: { color: 0x58d65a } },
  { id: 'ring_sang', cat: 'ring', name: 'Cercle de sang', desc: 'Un sceau écarlate qui palpite.', price: 120, fx: { color: 0xc2183a } },
  { id: 'ring_or', cat: 'ring', name: 'Cercle d’or', desc: 'Un anneau doré, digne d’un roi.', price: 130, fx: { color: 0xffd34a } },
  { id: 'ring_ombre', cat: 'ring', name: 'Cercle d’ombre', desc: 'Un sceau violet sombre.', price: 120, fx: { color: 0x6a3aa8 } },
  { id: 'ring_foudre', cat: 'ring', name: 'Cercle d’orage', desc: 'Un anneau jaune vif.', price: 130, fx: { color: 0xfff06a } },
  { id: 'ring_ocean', cat: 'ring', name: 'Cercle des marées', desc: 'Un anneau bleu profond.', price: 110, fx: { color: 0x2ab4ff } },
  { id: 'ring_veteran', cat: 'ring', name: 'Cercle du vétéran', desc: 'Offert au niveau 40 : un anneau d’argent.', unlock: { level: 40 }, fx: { color: 0xdfe6ee } },

  // ---- Traînées (suite) ----
  { id: 'trail_flammes', cat: 'trail', name: 'Pas de flamme', desc: 'Des étincelles de feu derrière vous.', price: 90, fx: { color: 0xff6a1a } },
  { id: 'trail_neige', cat: 'trail', name: 'Flocons', desc: 'Une neige légère suit vos pas.', price: 80, fx: { color: 0xe8f6ff } },
  { id: 'trail_feuilles', cat: 'trail', name: 'Feuilles d’automne', desc: 'Des feuilles vertes qui s’envolent.', price: 80, fx: { color: 0x78c84a } },
  { id: 'trail_coeurs', cat: 'trail', name: 'Pluie de cœurs', desc: 'Des éclats roses et chaleureux.', price: 100, fx: { color: 0xff5f8f } },
  { id: 'trail_etoiles', cat: 'trail', name: 'Poussière d’étoiles', desc: 'Des étoiles pâles qui scintillent.', price: 110, fx: { color: 0xfff3a0 } },
  { id: 'trail_bulles', cat: 'trail', name: 'Bulles', desc: 'Des bulles bleutées qui montent.', price: 90, fx: { color: 0x7fe0ff } },
  { id: 'trail_orage', cat: 'trail', name: 'Éclairs', desc: 'Une traînée électrique.', price: 120, fx: { color: 0xffe45a } },
  { id: 'trail_marcheur', cat: 'trail', name: 'Sillage du marcheur', desc: 'Offert au niveau 25 : un nuage de poussière claire.', unlock: { level: 25 }, fx: { color: 0xe3d8c0 } },

  // ---- Ailes (suite) ----
  { id: 'wings_phenix', cat: 'wings', name: 'Ailes de phénix', desc: 'Des plumes de feu doré.', price: 450, fx: { color: 0xff8a1a, glow: 0xffd24a, style: 'ange' } },
  { id: 'wings_givre', cat: 'wings', name: 'Ailes de givre', desc: 'Des ailes de glace bleue.', price: 400, fx: { color: 0xcfeeff, glow: 0x8fdcff, style: 'cristal' } },
  { id: 'wings_nuit', cat: 'wings', name: 'Ailes de nuit', desc: 'Des ailes indigo au bord bleuté.', price: 350, fx: { color: 0x1a1a3a, glow: 0x6a7aff, style: 'demon' } },
  { id: 'wings_sylve', cat: 'wings', name: 'Ailes sylvestres', desc: 'Des ailes de feuillage lumineux.', price: 320, fx: { color: 0x4aa84a, glow: 0xb6ff8a, style: 'ange' } },
  { id: 'wings_ambre', cat: 'wings', name: 'Ailes d’ambre', desc: 'Des facettes d’ambre translucide.', price: 380, fx: { color: 0xffb347, glow: 0xffe08a, style: 'cristal' } },
  { id: 'wings_rose', cat: 'wings', name: 'Ailes de pétales', desc: 'De grandes ailes roses et douces.', price: 300, fx: { color: 0xffb3d4, glow: 0xff7fb0, style: 'ange' } },
  { id: 'wings_legende', cat: 'wings', name: 'Ailes de la légende', desc: 'Offertes au niveau 100 : des ailes aux couleurs infinies.', unlock: { level: 100 }, fx: { color: 0xffffff, prism: true, style: 'ange' } },

  // ---- Titres (suite) ----
  { id: 'title_vagabond', cat: 'title', name: 'Vagabond des cimes', desc: 'Pour ceux qui ne restent jamais en place.', price: 40, fx: { text: 'Vagabond des cimes', color: '#a8e6a1' } },
  { id: 'title_gobelin', cat: 'title', name: 'Fléau des gobelins', desc: 'Les gobelins changent de route en vous voyant.', price: 50, fx: { text: 'Fléau des gobelins', color: '#9bd36a' } },
  { id: 'title_lune', cat: 'title', name: 'Enfant de la Lune', desc: 'Un titre argenté.', price: 70, fx: { text: 'Enfant de la Lune', color: '#cfe0ff' } },
  { id: 'title_brave', cat: 'title', name: 'Cœur vaillant', desc: 'Pour les plus braves.', price: 80, fx: { text: 'Cœur vaillant', color: '#ff9a9a' } },
  { id: 'title_ombre', cat: 'title', name: 'Rôdeur des ombres', desc: 'On ne vous voit qu’au dernier moment.', price: 110, fx: { text: 'Rôdeur des ombres', color: '#b79bff' } },
  { id: 'title_dragon', cat: 'title', name: 'Tueur de dragons', desc: 'Un titre redouté.', price: 180, fx: { text: 'Tueur de dragons', color: '#ff7a4a' } },
  { id: 'title_roi', cat: 'title', name: 'Roi de Korvalune', desc: 'Le titre le plus prestigieux de la boutique.', price: 300, fx: { text: 'Roi de Korvalune', color: '#ffe27a' } },
  { id: 'title_confirme', cat: 'title', name: 'Aventurier confirmé', desc: 'Offert au niveau 10.', unlock: { level: 10 }, fx: { text: 'Aventurier confirmé', color: '#c8d8e8' } },
  { id: 'title_veteran', cat: 'title', name: 'Vétéran de Korvalune', desc: 'Offert au niveau 30.', unlock: { level: 30 }, fx: { text: 'Vétéran de Korvalune', color: '#e8d08a' } },
  { id: 'title_maitre', cat: 'title', name: 'Maître d’armes', desc: 'Offert au niveau 60.', unlock: { level: 60 }, fx: { text: 'Maître d’armes', color: '#ffb36b' } },
  { id: 'title_vivante', cat: 'title', name: 'Légende vivante', desc: 'Offert au niveau 100.', unlock: { level: 100 }, fx: { text: 'Légende vivante', color: '#ff7fe0' } },

  // ---- Compagnons : suivent le joueur, visibles de tous. kind = modèle, color = couleur principale ----
  { id: 'pet_chaton', cat: 'pet', name: 'Chaton d’ombre', desc: 'Un petit chat noir aux yeux d’or.', price: 70, fx: { kind: 'cat', color: 0x2b2b3a, eye: 0xffd24a } },
  { id: 'pet_renard', cat: 'pet', name: 'Renardeau roux', desc: 'Curieux et très rapide.', price: 80, fx: { kind: 'fox', color: 0xe8742a, tip: 0xffffff } },
  { id: 'pet_loup', cat: 'pet', name: 'Louveteau gris', desc: 'Un jeune loup fidèle.', price: 90, fx: { kind: 'wolf', color: 0x9aa3b0, tip: 0xdfe4ea } },
  { id: 'pet_lapin', cat: 'pet', name: 'Lapin de lune', desc: 'Offert au niveau 10 : doux et blanc comme la neige.', unlock: { level: 10 }, fx: { kind: 'bunny', color: 0xf2f2f7 } },
  { id: 'pet_hibou', cat: 'pet', name: 'Hibou des brumes', desc: 'Il vole sans un bruit à vos côtés.', price: 100, fx: { kind: 'owl', color: 0xa8805a, tip: 0xe8d8b8 } },
  { id: 'pet_slime', cat: 'pet', name: 'Gelée émeraude', desc: 'Un petit blob joyeux et brillant.', price: 60, fx: { kind: 'slime', color: 0x3bdc8a } },
  { id: 'pet_dragonnet', cat: 'pet', name: 'Dragonneau', desc: 'Un bébé dragon qui crache des étincelles.', price: 180, fx: { kind: 'dragon', color: 0xc84a3a, tip: 0xffd24a } },
  { id: 'pet_feufollet', cat: 'pet', name: 'Feu follet', desc: 'Une flamme bleue qui danse.', price: 120, fx: { kind: 'wisp', color: 0x6ad0ff } },
  { id: 'pet_phenix', cat: 'pet', name: 'Poussin de phénix', desc: 'Une petite boule de feu à plumes.', price: 200, fx: { kind: 'bird', color: 0xff8a1a, tip: 0xffd24a } },
  { id: 'pet_golem', cat: 'pet', name: 'Mini-golem', desc: 'Offert au niveau 40 : solide comme un roc.', unlock: { level: 40 }, fx: { kind: 'golem', color: 0x8a8f99, tip: 0x6ad0ff } },
  { id: 'pet_licorne', cat: 'pet', name: 'Poney arc-en-ciel', desc: 'Sa crinière change de couleur.', price: 220, fx: { kind: 'unicorn', color: 0xfaf4ff, prism: true } },
  { id: 'pet_fee', cat: 'pet', name: 'Fée lumineuse', desc: 'Une minuscule fée qui laisse des étincelles.', price: 150, fx: { kind: 'fairy', color: 0xffd6f0, tip: 0xfff3a0 } },
  { id: 'pet_aigle', cat: 'pet', name: 'Aiglon doré', desc: 'Offert au niveau 70 : un jeune aigle royal.', unlock: { level: 70 }, fx: { kind: 'bird', color: 0xb8863a, tip: 0xfff0c8 } },

  // ---- Skins : changent les couleurs du personnage (l’équipement visible garde la couleur de sa rareté) ----
  { id: 'skin_ombre', cat: 'skin', name: 'Tenue de l’ombre', desc: 'Noir et acier sombre.', price: 150, fx: { cloth: 0x1a1a24, steel: 0x3a3a52 } },
  { id: 'skin_or', cat: 'skin', name: 'Tenue d’or', desc: 'Tissu et métal dorés, qui brillent doucement.', price: 220, fx: { cloth: 0xc8982a, steel: 0xffd34a, glow: 0x442a00 } },
  { id: 'skin_givre', cat: 'skin', name: 'Tenue de givre', desc: 'Bleu glacé et argent.', price: 160, fx: { cloth: 0xbfe4f5, steel: 0x8fd0ee } },
  { id: 'skin_sylve', cat: 'skin', name: 'Tenue sylvestre', desc: 'Vert forêt et cuir brun.', price: 140, fx: { cloth: 0x2f6a34, steel: 0x6a8a3a } },
  { id: 'skin_carmin', cat: 'skin', name: 'Tenue carmin', desc: 'Rouge profond et métal rubis.', price: 160, fx: { cloth: 0x7a1020, steel: 0xb0283a } },
  { id: 'skin_cristal', cat: 'skin', name: 'Peau de cristal', desc: 'Un corps translucide aux reflets bleus.', price: 260, fx: { tone: 0x9fe6ff, cloth: 0x7ab8e8, steel: 0xcfefff, glow: 0x1a4a6a, ghost: 0.78 } },
  { id: 'skin_obsidienne', cat: 'skin', name: 'Obsidienne', desc: 'Une peau noire veinée de violet.', price: 300, fx: { tone: 0x1a1a22, cloth: 0x14141c, steel: 0x2a2a3a, glow: 0x3a0a5a } },
  { id: 'skin_royal', cat: 'skin', name: 'Tenue royale', desc: 'Bleu royal, or et couronne.', price: 280, fx: { cloth: 0x3a2a8a, steel: 0xffd34a, head: 'crown' } },
  { id: 'skin_celeste', cat: 'skin', name: 'Tenue céleste', desc: 'Blanc lumineux et auréole.', price: 260, fx: { cloth: 0xf4f0e0, steel: 0xffe9a0, glow: 0x3a3418, head: 'halo' } },
  { id: 'skin_infernal', cat: 'skin', name: 'Tenue infernale', desc: 'Peau rouge, cornes noires.', price: 280, fx: { tone: 0xc43a2a, cloth: 0x4a0a0a, steel: 0x2a0a0a, glow: 0x300600, head: 'horns' } },
  { id: 'skin_chat', cat: 'skin', name: 'Tenue de chat', desc: 'Des oreilles de chat et une tenue crème.', price: 120, fx: { cloth: 0xe8d8b8, steel: 0xb8a888, head: 'catears' } },
  { id: 'skin_aventurier', cat: 'skin', name: 'Tenue d’aventurier', desc: 'Offerte au niveau 20 : vert mousse et cuir.', unlock: { level: 20 }, fx: { cloth: 0x4f7a3a, steel: 0x8a8a7a } },
  { id: 'skin_argent', cat: 'skin', name: 'Armure d’argent', desc: 'Offerte au niveau 50 : acier poli et bleu nuit.', unlock: { level: 50 }, fx: { cloth: 0x2a3550, steel: 0xdfe6ee } },

  // ---- Confort (aucun avantage de combat) ----
  { id: 'bank_1', cat: 'perk', name: 'Coffre : onglet 5', desc: '+30 emplacements dans votre coffre partagé.', price: 80, perk: 'bank', requires: null },
  { id: 'bank_2', cat: 'perk', name: 'Coffre : onglet 6', desc: '+30 emplacements dans votre coffre partagé.', price: 100, perk: 'bank', requires: 'bank_1' },
  { id: 'bank_3', cat: 'perk', name: 'Coffre : onglet 7', desc: '+30 emplacements dans votre coffre partagé.', price: 120, perk: 'bank', requires: 'bank_2' },
  { id: 'bank_4', cat: 'perk', name: 'Coffre : onglet 8', desc: '+30 emplacements dans votre coffre partagé.', price: 150, perk: 'bank', requires: 'bank_3' }
];

// objet SANS prototype : CATALOG_BY_ID['__proto__'] / ['constructor'] ne doit jamais renvoyer un « objet » valide (faille d'achat gratuit)
export const CATALOG_BY_ID = Object.assign(Object.create(null), Object.fromEntries(CATALOG.map((c) => [c.id, c])));
// V10.13 : les cosmétiques d'événement (payés en bonbons) sont connus de CATALOG_BY_ID, mais absents de la liste CATALOG de la boutique des Lunes
for (const it of HALLOWEEN_ITEMS) CATALOG_BY_ID[it.id] = it;
// V10.23 : cosmétiques exclusifs du pass de combat (offerts par palier, jamais en vente)
for (const it of PASS_ITEMS) CATALOG_BY_ID[it.id] = it;
export const COSMETIC_SLOTS = ['aura', 'ring', 'trail', 'wings', 'title', 'pet', 'skin'];
