// V7.1 — Sets d'équipement classique : 3 sets par classe (15 au total), 6 pièces chacun
// (arme, casque, épaulières, plastron, gants, bottes). Bonus à 2, 4 et 6 pièces portées ;
// le bonus à 6 pièces ajoute un effet spécial. Les pièces de set ne tombent que pour la classe du joueur.
export const SET_RARITY = {
  tier: 13, id: 'set', name: 'Set', color: '#35F27A', statMult: 2.6, valueMult: 45
};
export const SET_SLOTS = [
  { slot: 'mainhand', category: 'weapon' },
  { slot: 'head', category: 'armor', baseKey: 'helm' },
  { slot: 'shoulders', category: 'armor', baseKey: 'pauldrons' },
  { slot: 'chest', category: 'armor', baseKey: 'chest' },
  { slot: 'gloves', category: 'armor', baseKey: 'gloves' },
  { slot: 'boots', category: 'armor', baseKey: 'boots' }
];

// Thème de bonus par classe (valeurs de base du set I ; les sets II et III sont plus puissants)
const THEME = {
  warrior: { b2: { str: 5, hp: 30 }, b4: { atkSpeedPct: 0.08, dmgReductionPct: 0.05, def: 6 }, b6: { critDmgPct: 0.3, atk: 12 },
    fx: { dmgType: 'physical', power: 2.0, aoe: true, range: 5.5, stunSec: 1, cooldown: 8, chance: 0.12, triggerOn: 'hit' } },
  paladin: { b2: { vit: 5, spi: 3 }, b4: { dmgReductionPct: 0.07, hpRegen: 1.5 }, b6: { def: 14, hp: 120 },
    fx: { healPct: 0.12, wardSec: 1.5, cooldown: 15, chance: 0.15, triggerOn: 'hurt' } },
  mage: { b2: { int: 6, mana: 30 }, b4: { manaRegen: 2, critDmgPct: 0.15 }, b6: { atk: 14, crit: 0.06 },
    fx: { dmgType: 'fire', power: 2.2, aoe: true, range: 6, cooldown: 7, chance: 0.12, triggerOn: 'hit' } },
  archer: { b2: { agi: 6, crit: 0.03 }, b4: { atkSpeedPct: 0.1, moveSpeedPct: 0.05 }, b6: { critDmgPct: 0.35, atk: 12 },
    fx: { dmgType: 'physical', power: 1.8, aoe: true, range: 6, dotSec: 3, dotPower: 0.5, cooldown: 6, chance: 0.14, triggerOn: 'hit' } },
  assassin: { b2: { agi: 5, luck: 3, crit: 0.03 }, b4: { critDmgPct: 0.2, moveSpeedPct: 0.06 }, b6: { atkSpeedPct: 0.1, crit: 0.06 },
    fx: { dmgType: 'physical', power: 2.6, aoe: false, range: 5, cooldown: 6, chance: 0.15, triggerOn: 'hit' } }
};

const DEFS = {
  warrior: [
    ['Armure du Berserker', 6, 'axe', 'Rage de fer', ['Hache du Berserker', 'Heaume du Berserker', 'Épaulières du Berserker', 'Cuirasse du Berserker', 'Gantelets du Berserker', 'Bottes du Berserker']],
    ['Panoplie du Titan écarlate', 35, 'warhammer', 'Fracas du Titan', ['Marteau du Titan écarlate', 'Casque du Titan écarlate', 'Spalières du Titan écarlate', 'Plastron du Titan écarlate', 'Poings du Titan écarlate', 'Jambières du Titan écarlate']],
    ['Parure du Seigneur de guerre primordial', 90, 'halberd', 'Cataclysme guerrier', ['Hallebarde du Seigneur de guerre', 'Couronne du Seigneur de guerre', 'Pauldrons du Seigneur de guerre', 'Harnois du Seigneur de guerre', 'Mains du Seigneur de guerre', 'Sabatons du Seigneur de guerre']]
  ],
  paladin: [
    ['Lumière de l’Aube', 6, 'mace', 'Châtiment sacré', ['Masse de l’Aube', 'Heaume de l’Aube', 'Épaulières de l’Aube', 'Cuirasse de l’Aube', 'Gantelets de l’Aube', 'Bottes de l’Aube']],
    ['Égide du Croisé radieux', 35, 'sword', 'Égide radieuse', ['Épée du Croisé radieux', 'Heaume du Croisé radieux', 'Spalières du Croisé radieux', 'Plastron du Croisé radieux', 'Gantelets du Croisé radieux', 'Grèves du Croisé radieux']],
    ['Vestiges du Séraphin', 90, 'warhammer', 'Jugement séraphique', ['Marteau du Séraphin', 'Auréole du Séraphin', 'Ailes du Séraphin', 'Cuirasse du Séraphin', 'Mains du Séraphin', 'Sandales du Séraphin']]
  ],
  mage: [
    ['Robes de l’Apprenti étoilé', 6, 'staff', 'Étoile filante', ['Bâton de l’Apprenti étoilé', 'Chapeau de l’Apprenti étoilé', 'Mantelet de l’Apprenti étoilé', 'Robe de l’Apprenti étoilé', 'Gants de l’Apprenti étoilé', 'Souliers de l’Apprenti étoilé']],
    ['Régalia de l’Archimage cendré', 35, 'tome', 'Pluie de cendres', ['Grimoire de l’Archimage cendré', 'Capuche de l’Archimage cendré', 'Épaulettes de l’Archimage cendré', 'Manteau de l’Archimage cendré', 'Mitaines de l’Archimage cendré', 'Bottines de l’Archimage cendré']],
    ['Tissu du Vide infini', 90, 'wand', 'Pluie d’astres', ['Orbe du Vide infini', 'Diadème du Vide infini', 'Mantelet du Vide infini', 'Robe du Vide infini', 'Gants du Vide infini', 'Sandales du Vide infini']]
  ],
  archer: [
    ['Cuir du Pisteur des bois', 6, 'bow', 'Volée du pisteur', ['Arc du Pisteur des bois', 'Capuche du Pisteur des bois', 'Épaulières du Pisteur des bois', 'Veste du Pisteur des bois', 'Gants du Pisteur des bois', 'Bottes du Pisteur des bois']],
    ['Livrée du Chasseur de tempête', 35, 'crossbow', 'Carreaux de tempête', ['Arbalète du Chasseur de tempête', 'Capuche du Chasseur de tempête', 'Épaulières du Chasseur de tempête', 'Veste du Chasseur de tempête', 'Gants du Chasseur de tempête', 'Bottes du Chasseur de tempête']],
    ['Panoplie de l’Œil du zénith', 90, 'bow', 'Pluie du zénith', ['Arc de l’Œil du zénith', 'Masque de l’Œil du zénith', 'Épaulières de l’Œil du zénith', 'Cuirasse de l’Œil du zénith', 'Gants de l’Œil du zénith', 'Bottes de l’Œil du zénith']]
  ],
  assassin: [
    ['Ombres de la Lame muette', 6, 'dagger', 'Lame muette', ['Dague de la Lame muette', 'Capuche de la Lame muette', 'Épaulières de la Lame muette', 'Veste de la Lame muette', 'Gants de la Lame muette', 'Bottes de la Lame muette']],
    ['Linceul du Danseur écarlate', 35, 'scimitar', 'Danse écarlate', ['Cimeterre du Danseur écarlate', 'Masque du Danseur écarlate', 'Épaulières du Danseur écarlate', 'Linceul du Danseur écarlate', 'Gants du Danseur écarlate', 'Bottes du Danseur écarlate']],
    ['Voile de la Mort sans nom', 90, 'dagger', 'Éclipse mortelle', ['Dague de la Mort sans nom', 'Capuche de la Mort sans nom', 'Épaulières de la Mort sans nom', 'Voile de la Mort sans nom', 'Gants de la Mort sans nom', 'Bottes de la Mort sans nom']]
  ]
};

const PCT = new Set(['crit', 'atkSpeedPct', 'critDmgPct', 'moveSpeedPct', 'dmgReductionPct', 'fireResPct', 'iceResPct', 'lightningResPct']);
function scaleBonus(b, idx, minLevel) {
  const m = 1 + minLevel * 0.035, pm = 1 + idx * 0.25;
  const out = {};
  for (const [k, v] of Object.entries(b)) out[k] = PCT.has(k) ? Math.round(v * pm * 1000) / 1000 : (k === 'hpRegen' || k === 'manaRegen') ? Math.round(v * m * 10) / 10 : Math.max(1, Math.round(v * m));
  return out;
}

export const SETS = {};
export const SETS_BY_CLASS = {};
for (const [cls, list] of Object.entries(DEFS)) {
  SETS_BY_CLASS[cls] = [];
  list.forEach(([name, minLevel, weapon, fxName, pieces], idx) => {
    const th = THEME[cls];
    const id = `${cls}_${idx + 1}`;
    const fx = { ...th.fx, power: th.fx.power ? Math.round(th.fx.power * (1 + idx * 0.5) * 100) / 100 : 0, id: 'set_' + id, name: fxName };
    if (fx.healPct) fx.healPct = Math.round(fx.healPct * (1 + idx * 0.4) * 100) / 100;
    const set = {
      id, cls, name, minLevel, weapon, pieces,
      bonuses: {
        2: scaleBonus(th.b2, idx, minLevel),
        4: scaleBonus(th.b4, idx, minLevel),
        6: { ...scaleBonus(th.b6, idx, minLevel), effect: fx }
      }
    };
    SETS[id] = set; SETS_BY_CLASS[cls].push(set);
  });
}

export const BONUS_LABEL = {
  atk: 'Dégâts', def: 'Défense', hp: 'PV', mana: 'Mana', crit: 'Chance de critique', str: 'Force', agi: 'Agilité', int: 'Intelligence',
  vit: 'Endurance', spi: 'Esprit', luck: 'Chance', atkSpeedPct: "Vitesse d'attaque", critDmgPct: 'Dégâts critiques',
  dmgReductionPct: 'Réduction des dégâts', hpRegen: 'Régén. PV', manaRegen: 'Régén. mana', moveSpeedPct: 'Vitesse de déplacement'
};
export function describeBonus(b) {
  const lines = [];
  for (const [k, v] of Object.entries(b)) {
    if (k === 'effect') {
      const e = v;
      const what = e.healPct ? `soigne ${Math.round(e.healPct * 100)}% des PV${e.wardSec ? ` et protège ${e.wardSec}s` : ''}` : `inflige ${Math.round(e.power * 100)}% de dégâts${e.aoe ? ' de zone' : ''}${e.stunSec ? ' + étourdit' : ''}${e.dotSec ? ' + poison' : ''}`;
      lines.push(`✦ ${e.name} : ${Math.round(e.chance * 100)}% de chance (${e.triggerOn === 'hit' ? 'en frappant' : 'en subissant des dégâts'}) — ${what}`);
    } else lines.push(`+${PCT.has(k) ? Math.round(v * 1000) / 10 + '%' : v} ${BONUS_LABEL[k] || k}`);
  }
  return lines;
}

// Compte les pièces distinctes portées par set → [{set, count, owned:Set(pieceIdx)}]
export function countSets(slotsObj) {
  const map = {};
  for (const it of Object.values(slotsObj || {})) {
    const g = it && it.gen;
    if (!g || !g.setId || !SETS[g.setId]) continue;
    (map[g.setId] ||= new Set()).add(g.setPiece);
  }
  return Object.entries(map).map(([id, owned]) => ({ set: SETS[id], count: owned.size, owned }));
}
export function activeSetBonuses(slotsObj) {
  const bonus = [], effects = [];
  for (const { set, count } of countSets(slotsObj)) {
    for (const n of [2, 4, 6]) if (count >= n) {
      const { effect, ...stats } = set.bonuses[n];
      bonus.push(stats);
      if (effect) effects.push({ ...effect, sourceSlot: 'set' });
    }
  }
  return { bonus, effects };
}
