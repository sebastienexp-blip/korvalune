// V4.2 : commandes clavier personnalisables. Chaque action a jusqu'à 2 touches (principale / secondaire).
// Les codes sont des `KeyboardEvent.code` (position physique de la touche : W = Z sur un clavier AZERTY).
export const ACTIONS = [
  { id: 'forward', label: 'Avancer', group: 'Déplacement', def: ['KeyW', 'ArrowUp'] },
  { id: 'back', label: 'Reculer', group: 'Déplacement', def: ['KeyS', 'ArrowDown'] },
  { id: 'left', label: 'Aller à gauche', group: 'Déplacement', def: ['KeyA', 'ArrowLeft'] },
  { id: 'right', label: 'Aller à droite', group: 'Déplacement', def: ['KeyD', 'ArrowRight'] },
  { id: 'roll', label: 'Roulade', group: 'Déplacement', def: ['Space', null] },
  { id: 'run', label: 'Sprint (maintenir)', group: 'Déplacement', def: ['ShiftLeft', 'ShiftRight'] },
  { id: 'crouch', label: 'S’accroupir (maintenir)', group: 'Déplacement', def: ['KeyC', null] },
  { id: 'interact', label: 'Interagir / ramasser', group: 'Actions', def: ['KeyE', null] },
  { id: 'potionHeal', label: 'Potion de vie', group: 'Actions', def: ['KeyV', null] },
  { id: 'potionMana', label: 'Potion de mana', group: 'Actions', def: ['KeyB', null] },
  ...Array.from({ length: 10 }, (_, i) => ({ id: 'skill' + (i + 1), label: 'Compétence ' + (i + 1), group: 'Compétences', def: ['Digit' + ((i + 1) % 10), 'Numpad' + ((i + 1) % 10)] })),
  { id: 'inventory', label: 'Inventaire', group: 'Menus', def: ['KeyI', null] },
  { id: 'character', label: 'Personnage', group: 'Menus', def: ['KeyP', null] },
  { id: 'skills', label: 'Compétences (écran)', group: 'Menus', def: ['KeyK', null] },
  { id: 'map', label: 'Carte du monde', group: 'Menus', def: ['KeyM', null] },
  { id: 'chat', label: 'Ouvrir le chat', group: 'Menus', def: ['Enter', null] },
  { id: 'zoomIn', label: 'Zoom avant', group: 'Caméra', def: ['Equal', 'NumpadAdd'] },
  { id: 'zoomOut', label: 'Zoom arrière', group: 'Caméra', def: ['Minus', 'NumpadSubtract'] },
  { id: 'camReset', label: 'Recentrer la caméra', group: 'Caméra', def: ['KeyR', null] }
];
export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
export const GROUPS = [...new Set(ACTIONS.map((a) => a.group))];
// touches réservées (non réassignables)
export const RESERVED = new Set(['Escape', 'F3', 'F5', 'F11', 'F12', 'Tab', 'MetaLeft', 'MetaRight', 'ContextMenu']);

export function defaultKeys() {
  return Object.fromEntries(ACTIONS.map((a) => [a.id, [...a.def]]));
}

// Fusionne des touches enregistrées (éventuellement incomplètes ou corrompues) avec les valeurs par défaut.
export function normalizeKeys(saved) {
  const out = defaultKeys();
  if (!saved || typeof saved !== 'object') return out;
  for (const a of ACTIONS) {
    const v = saved[a.id];
    if (Array.isArray(v)) out[a.id] = [0, 1].map((i) => (typeof v[i] === 'string' && v[i].length < 24 && !RESERVED.has(v[i]) ? v[i] : null));
  }
  return out;
}

const NAMES = { Space: 'Espace', Enter: 'Entrée', ShiftLeft: 'Maj gauche', ShiftRight: 'Maj droite', ControlLeft: 'Ctrl gauche', ControlRight: 'Ctrl droite', AltLeft: 'Alt gauche', AltRight: 'Alt droite', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: 'Retour', Equal: '=', Minus: '-', NumpadAdd: 'Pavé +', NumpadSubtract: 'Pavé −', NumpadMultiply: 'Pavé ×', NumpadDivide: 'Pavé ÷', NumpadEnter: 'Pavé Entrée', Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Semicolon: ';', Quote: '\'', BracketLeft: '[', BracketRight: ']', Backquote: '`', CapsLock: 'Verr Maj', Delete: 'Suppr', Insert: 'Inser', Home: 'Début', End: 'Fin', PageUp: 'Pg préc.', PageDown: 'Pg suiv.' };
let layout = null; // KeyboardLayoutMap (navigateur) : donne la vraie lettre selon le clavier (AZERTY, QWERTZ…)
try { navigator.keyboard?.getLayoutMap?.().then((m) => { layout = m; }).catch(() => {}); } catch (e) { /* ignoré */ }

export function keyLabel(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (/^Digit\d$/.test(code)) return code.slice(5);
  const lm = layout && layout.get && layout.get(code);
  if (lm) return lm.length === 1 ? lm.toUpperCase() : lm;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return 'Pavé ' + code.slice(6);
  return code;
}
