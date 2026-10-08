// V4.0 : quêtes de tutoriel. Elles s'enchaînent automatiquement (champ `next`) et présentent
// les fonctions du jeu une par une. Étapes `event` : validées par un évènement du jeu (voir Game._tut).
// `give` = récompense d'étape : { items:[{defId,qty}], ground:[defId], coins, xp }.
const ev = (id, text, target, extra = {}) => ({ id, text, type: 'event', target, ...extra });

export const TUTORIAL_QUESTS = [
  {
    id: 'tuto_1', name: 'Initiation : premiers pas', level: 1, tutorial: true, next: 'tuto_2',
    steps: [
      ev('move', 'Marchez quelques pas ({k:forward}{k:left}{k:back}{k:right} ou joystick)', 'move'),
      ev('camera', 'Zoomez la caméra (molette ou pincement à deux doigts)', 'camera'),
      ev('roll', 'Faites une roulade ({k:roll} ou bouton 🌀) : brève invulnérabilité !', 'roll'),
      { id: 'talk', text: 'Parlez au garde Halvar (touche {k:interact} près de lui)', type: 'talk', target: 'guard',
        give: { items: [{ defId: 'potion_heal_small', qty: 3 }], ground: ['chest_common'] } },
      ev('loot', 'Halvar a posé une armure au sol : ramassez-la ({k:interact} à côté)', 'loot'),
      ev('inventory', 'Ouvrez l\'inventaire ({k:inventory} ou bouton 🎒)', 'inventory'),
      ev('equip', 'Touchez l\'armure puis « Équiper »', 'equip'),
      ev('character', 'Ouvrez la fiche du personnage ({k:character} ou bouton 🧍)', 'character')
    ],
    reward: { xp: 60, coins: 40 }
  },
  {
    id: 'tuto_2', name: 'Initiation : le combat', level: 1, tutorial: true, next: 'tuto_3',
    steps: [
      ev('skills', 'Ouvrez l\'écran des compétences ({k:skills} ou bouton ✨)', 'skills'),
      ev('skill', 'Lancez une compétence de la barre ({k:skill1}… ou touchez-la)', 'skill'),
      { id: 'wolves', text: 'Tuez 2 loups autour de la ville', type: 'kill', target: 'wolf', need: 2 },
      ev('use', 'Buvez une potion de soin (bouton 🧪 ou {k:potionHeal})', 'use'),
      ev('drop', 'Jetez un objet par terre (inventaire → Jeter)', 'drop'),
      ev('loot2', 'Ramassez-le de nouveau ({k:interact} à côté)', 'loot')
    ],
    reward: { xp: 120, coins: 60 }
  },
  {
    id: 'tuto_3', name: 'Initiation : la ville d\'Aetheria', level: 1, tutorial: true, next: 'commencement',
    steps: [
      ev('map', 'Ouvrez la carte du monde ({k:map} ou bouton 🗺)', 'map'),
      ev('shop', 'Visitez un marchand (Ymir, Sella ou Wren) pour acheter ou vendre', 'shop'),
      ev('bank', 'Ouvrez le coffre d\'Aetheria ({k:interact} près du coffre)', 'bank'),
      ev('rift', 'Approchez la Statue de la Spire, à l\'ouest de la place, et appuyez sur {k:interact}', 'rift'),
      { id: 'hugo', text: 'Parlez à Hugo pour débuter les grandes quêtes', type: 'talk', target: 'hugo' }
    ],
    reward: { xp: 200, coins: 100 }
  }
];
