// Génère public/bienvenue/data.json (raretés, types d'équipement, builds par classe) depuis les données du jeu : le site reste toujours exact.
import fs from 'node:fs';
import { RARITIES } from '../src/data/rarities.js';
import { WEAPON_BASES, ARMOR_BASES, OFFHAND_BASES, ACCESSORY_BASES } from '../src/data/itemBases.js';
import { BUILDS_BY_CLASS } from '../src/data/builds.js';
const CLASSES = { warrior: 'Guerrier', paladin: 'Paladin', mage: 'Mage', archer: 'Archer', assassin: 'Assassin' };
const names = (o) => Object.values(o).map((x) => x.name);
const data = {
  rarities: RARITIES.map((r) => ({ name: r.name, color: r.color, pct: r.pct, affixes: [r.minAffixes, r.maxAffixes], effects: [r.minEffects, r.maxEffects] })),
  equipment: { weapons: names(WEAPON_BASES), armors: names(ARMOR_BASES), offhands: names(OFFHAND_BASES), accessories: names(ACCESSORY_BASES) },
  classes: Object.entries(CLASSES).map(([id, label]) => ({ id, label, builds: BUILDS_BY_CLASS[id].map((b) => ({ way: b.wayLabel, name: b.name, epithet: b.epithet, blurb: b.blurb })) }))
};
fs.mkdirSync('public/bienvenue', { recursive: true });
fs.writeFileSync('public/bienvenue/data.json', JSON.stringify(data));
console.log('data.json :', data.rarities.length, 'raretés,', Object.values(data.equipment).reduce((a, l) => a + l.length, 0), 'types d’équipement');
