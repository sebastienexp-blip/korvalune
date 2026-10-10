import skillDefs from '../data/skills.json';

export const SKILLS = Object.fromEntries(skillDefs.map((s) => [s.id, s]));

// Tous les sorts/techniques disponibles pour une classe donnée (ceux qui lui
// sont propres + les universels comme "Frappe"), triés par niveau requis.
export function getClassSkillPool(classId) {
  return skillDefs
    .filter((s) => s.classId === null || s.classId === classId)
    .sort((a, b) => a.levelReq - b.levelReq);
}

export const CLASSES = {
  warrior: { id: 'warrior', name: 'Guerrier', color: 0x3a4a6a, armor: 0x9aa3ad, shield: true, startWeapon: 'sword_common', desc: 'Robuste et polyvalent, excelle au corps-à-corps.' },
  paladin: { id: 'paladin', name: 'Paladin', color: 0xd8cfa0, armor: 0xe6d98a, shield: true, startWeapon: 'sword_common', desc: 'Combattant sacré capable de se soigner.' },
  mage: { id: 'mage', name: 'Mage', color: 0x33205a, armor: 0x6a4fae, shield: false, startWeapon: 'staff_common', desc: 'Maîtrise les arts magiques, fragile mais dévastateur.' },
  archer: { id: 'archer', name: 'Archer', color: 0x2f5a34, armor: 0x6b8a5a, shield: false, startWeapon: 'bow_common', desc: 'Précis et mobile, frappe à distance.' },
  assassin: { id: 'assassin', name: 'Assassin', color: 0x1c1c22, armor: 0x3a3a44, shield: false, startWeapon: 'dagger_common', desc: 'Rapide et létal, vise les points faibles.' }
};

export const RACES = {
  human: { id: 'human', name: 'Humain', skin: 0xd9a98b },
  elf: { id: 'elf', name: 'Elfe', skin: 0xe6c9a8 },
  dwarf: { id: 'dwarf', name: 'Nain', skin: 0xcf9f78 },
  orc: { id: 'orc', name: 'Orc', skin: 0x7fae6a },
  sylvan: { id: 'sylvan', name: 'Sylvain', skin: 0xb7d99a }
};

// V7.3 : attribut principal de chaque classe — c'est lui qui augmente ses dégâts (les autres comptent 4× moins)
export const PRIMARY_STAT = { warrior: 'str', paladin: 'str', mage: 'int', archer: 'agi', assassin: 'agi' };

// V10.30 : équilibrage des classes. Mesure sur les compétences (dégâts par seconde, cible unique et de groupe) :
// le mage dépasse nettement les autres, qui doivent en plus s'exposer au corps-à-corps ou dépenser une ressource
// qui ne grandit pas avec leur attribut principal. Ce multiplicateur d'attaque rapproche chaque classe du mage.
export const CLASS_POWER = { mage: 1, warrior: 1.4, paladin: 1.65, archer: 1.35, assassin: 1.2 };
