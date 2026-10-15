// V10.36 — Jeu d'icônes vectorielles (interface mobile) : remplace les emojis par des pictogrammes cohérents.
// Toutes les icônes sont dessinées sur une grille 24×24, trait doré dégradé (gradient « icoG » défini une fois dans la page).
const S = (body, extra = '') => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="url(#icoG)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICONS = {
  bag: S('<path d="M6.2 8.5h11.6l1.4 10.3a1.6 1.6 0 0 1-1.6 1.9H6.4a1.6 1.6 0 0 1-1.6-1.9z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/><circle cx="12" cy="14" r="1.3" fill="url(#icoG)" stroke="none"/>'),
  char: S('<circle cx="12" cy="8" r="3.6"/><path d="M5 20.5c0-4.2 3-6.6 7-6.6s7 2.4 7 6.6"/><path d="M9.5 7.2h5" opacity=".55"/>'),
  skills: S('<path d="M12 3l2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7z"/><path d="M19 3.5v3M17.5 5h3" opacity=".7"/>'),
  quests: S('<path d="M7 4h10a2 2 0 0 1 2 2v12.5a1.5 1.5 0 0 1-1.5 1.5H8.5A2.5 2.5 0 0 1 6 17.5V5"/><path d="M6 5.5a1.5 1.5 0 0 1 1-1.5"/><path d="M9.5 9h6M9.5 12.2h6M9.5 15.4h3.5"/>'),
  trophy: S('<path d="M8 4h8v5.2a4 4 0 0 1-8 0z"/><path d="M8 6H5.2v1.3A3 3 0 0 0 8 10.3M16 6h2.8v1.3A3 3 0 0 1 16 10.3"/><path d="M12 13.2V17M9 20h6M10.2 17h3.6"/>'),
  people: S('<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c0-3.5 2.5-5.4 5.5-5.4s5.5 1.9 5.5 5.4"/><circle cx="17" cy="9.5" r="2.4" opacity=".75"/><path d="M16 14c3 0 4.8 1.7 4.8 4.4" opacity=".75"/>'),
  portal: S('<ellipse cx="12" cy="12" rx="5.2" ry="8.5"/><ellipse cx="12" cy="12" rx="2.4" ry="5" opacity=".7"/><path d="M4 5.5c1.2-1 2.6-1.5 4-1.7M20 18.5c-1.2 1-2.6 1.5-4 1.7" opacity=".55"/>'),
  horse: S('<path d="M7.5 21C7.8 15.5 8.6 11.5 10.8 8.6L11 4.4l2.3 3.2C15.6 7.8 17.3 9.3 18.4 11.8l2.3 5.4c.4 1.2-.5 2.2-1.7 2.1l-1.6-.2c-1-.1-1.7-.9-2-1.9-1.1.6-1.8 1.6-1.8 3.8"/><path d="M9 11.6L6.6 10.6M8.3 14.6L5.8 14M7.9 17.6l-2.4.2" opacity=".7"/><circle cx="15.2" cy="11.9" r=".85" fill="url(#icoG)" stroke="none"/><circle cx="19.6" cy="16.6" r=".5" fill="url(#icoG)" stroke="none" opacity=".8"/>'),
  medal: S('<path d="M8.5 3.5L12 10l3.5-6.5"/><circle cx="12" cy="15" r="5.2"/><path d="M12 12.4l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z" fill="url(#icoG)" stroke="none"/>'),
  moon: S('<path d="M19.5 14.2A8 8 0 1 1 9.8 4.5a6.4 6.4 0 0 0 9.7 9.7z"/><path d="M17 4v3M15.5 5.5h3" opacity=".7"/>'),
  chat: S('<path d="M4 5.5h16v10.5H11.5L7.5 20v-4H4z"/><path d="M8 9.5h8M8 12.5h5" opacity=".7"/>'),
  pause: S('<rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="url(#icoG)" stroke="none"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="url(#icoG)" stroke="none"/>'),
  sword: S('<path d="M18.6 3.4l2 2-9.3 9.3-3 .6.6-3z" fill="rgba(255,243,196,.18)"/><path d="M8 13.3l2.7 2.7M7.8 16.2L4.6 19.4"/><circle cx="4" cy="20" r="1.1" fill="url(#icoG)" stroke="none"/>'),
  roll: S('<path d="M5.2 12a7 7 0 1 1 2.4 5.3"/><path d="M5 18.3v-5h5"/>'),
  bolt: S('<path d="M13.2 2.5L5.5 13.2h5.8l-1 8.3 8-11.2h-5.8z" fill="rgba(255,243,196,.16)"/>'),
  down: S('<path d="M6 8.2l6 5 6-5M6 14l6 5 6-5"/>'),
  hand: S('<path d="M9 11.5V5.7a1.5 1.5 0 0 1 3 0V10m0-1.2a1.5 1.5 0 0 1 3 0V11m0-.4a1.5 1.5 0 0 1 3 0v4.4a6 6 0 0 1-6 6h-.8a5 5 0 0 1-4-2L4 15.6a1.5 1.5 0 0 1 2.3-1.8L9 16"/>'),
  lock: S('<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><circle cx="12" cy="15.2" r="1.2" fill="url(#icoG)" stroke="none"/>'),
  flaskHeal: S('<path d="M9.6 3h4.8M10.5 3v5.6L5.6 17.8A2 2 0 0 0 7.4 21h9.2a2 2 0 0 0 1.8-3.2l-4.9-9.2V3"/><path d="M7.2 15.5h9.6l1.2 2.3a1 1 0 0 1-.9 1.5H6.9a1 1 0 0 1-.9-1.5z" fill="#ff5f6d" stroke="none"/>'),
  flaskMana: S('<path d="M9.6 3h4.8M10.5 3v5.6L5.6 17.8A2 2 0 0 0 7.4 21h9.2a2 2 0 0 0 1.8-3.2l-4.9-9.2V3"/><path d="M7.2 15.5h9.6l1.2 2.3a1 1 0 0 1-.9 1.5H6.9a1 1 0 0 1-.9-1.5z" fill="#4aa8ff" stroke="none"/>'),
  map: S('<path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13M15 6.5v13" opacity=".6"/>'),
  compass: S('<circle cx="12" cy="12" r="8.5"/><path d="M15.8 8.2l-2 5.6-5.6 2 2-5.6z" fill="rgba(255,243,196,.2)"/>'),
  coin: S('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5" opacity=".6"/><path d="M12 9.2v5.6M10.2 10.6h2.9a1 1 0 0 1 0 2h-2a1 1 0 0 0 0 2h2.9" opacity=".9"/>'),
  sun: S('<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7"/>'),
  nightMoon: S('<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>'),
  menu: S('<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  heart: S('<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z" fill="#ff5f6d" stroke="none"/>'),
  drop: S('<path d="M12 3.5s6 6.2 6 10.3a6 6 0 0 1-12 0C6 9.7 12 3.5 12 3.5z" fill="#4aa8ff" stroke="none"/>'),
  star: S('<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8z" fill="url(#icoG)" stroke="none"/>'),
  scroll: S('<path d="M6 4.5h10a2 2 0 0 1 2 2V19a1.5 1.5 0 0 1-1.5 1.5H8A2 2 0 0 1 6 18.5z"/><path d="M9 9h6M9 12h6M9 15h3.5" opacity=".75"/>'),
  emote: S('<circle cx="12" cy="12" r="8.5"/><path d="M8.6 14.2c.9 1.5 2 2.2 3.4 2.2s2.5-.7 3.4-2.2"/><circle cx="9.2" cy="10" r=".9" fill="url(#icoG)" stroke="none"/><circle cx="14.8" cy="10" r=".9" fill="url(#icoG)" stroke="none"/>'),
  target: S('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.2" fill="url(#icoG)" stroke="none"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>')
};

// définition du dégradé partagé (à insérer une fois dans le document)
export function iconDefsHTML() {
  return '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="icoG" gradientUnits="userSpaceOnUse" x1="4" y1="3" x2="20" y2="21"><stop offset="0" stop-color="#fff6d2"/><stop offset="1" stop-color="#e2b866"/></linearGradient></defs></svg>';
}

// ---------- Pictogrammes de compétences (remplacent l'emoji sur mobile) ----------
const G = (b) => `<svg class="sk-glyph" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
const F = 'fill="rgba(255,255,255,.88)" stroke="none"';
const GLYPHS = {
  slash: G(`<path d="M4 19C9 17 15 11 20 4c-.5 6-4 12-14 16z" ${F}/><path d="M7 13l-3 3M10 16l-3 3" opacity=".7"/>`),
  hammer: G(`<rect x="4" y="4" width="11" height="6.5" rx="1.5" ${F}/><path d="M9.5 10.5L18 20" stroke-width="2.4"/>`),
  shield: G(`<path d="M12 3.2l7 2.6v5.4c0 4.6-3 8.2-7 9.8-4-1.6-7-5.2-7-9.8V5.8z" ${F}/><path d="M12 7v9" stroke="rgba(0,0,0,.35)"/>`),
  arrow: G(`<path d="M5 19L19 5M19 5h-5.5M19 5v5.5"/><path d="M5 19l-1.2-3.8M5 19l3.8 1.2" opacity=".7"/>`),
  arrows: G(`<path d="M6 3.5v13M6 16.5l-2-2.6M6 16.5l2-2.6M12 6v13M12 19l-2-2.6M12 19l2-2.6M18 3.5v13M18 16.5l-2-2.6M18 16.5l2-2.6"/>`),
  fire: G(`<path d="M12 21c-4 0-6.5-2.8-6.5-6.2 0-3 2-4.8 3.2-7 .5 1.5 1.3 2.3 2.2 2.8C10.5 7.2 11.5 4.6 13 3c.3 3.2 5.5 5.6 5.5 11.5C18.5 18.5 16 21 12 21z" ${F}/>`),
  ice: G(`<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M12 3l-2 2.4M12 3l2 2.4M12 21l-2-2.4M12 21l2-2.4"/>`),
  bolt: G(`<path d="M13.5 2.5L5.5 13.5h5.5l-1.2 8 8.7-11.8h-5.8z" ${F}/>`),
  heal: G(`<path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z" ${F}/>`),
  nova: G(`<circle cx="12" cy="12" r="3.2" ${F}/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M5.3 18.7l2.8-2.8M15.9 8.1l2.8-2.8"/>`),
  whirl: G(`<path d="M12 12m0 0c0-2 2.2-2.7 3-1.4.9 1.6-.7 3.4-2.6 3.4-3 0-4.8-2.6-4.2-5.2.7-3 4-4.4 6.8-3.4 3.3 1.2 4.8 4.8 3.6 8"/><path d="M5 16c1 2.3 3.2 4 6 4" opacity=".7"/>`),
  dagger: G(`<path d="M12 2.5l2.4 9.5H9.6z" ${F}/><path d="M8 12h8M12 12v6.5M10.2 20.5h3.6"/>`),
  skull: G(`<path d="M12 3.5c-4 0-7 2.6-7 6.6 0 2.2 1 3.6 2.4 4.6V18h9.2v-3.3c1.4-1 2.4-2.4 2.4-4.6 0-4-3-6.6-7-6.6z" ${F}/><circle cx="9.2" cy="10.5" r="1.5" fill="rgba(0,0,0,.55)" stroke="none"/><circle cx="14.8" cy="10.5" r="1.5" fill="rgba(0,0,0,.55)" stroke="none"/><path d="M10.2 18v2.5M13.8 18v2.5"/>`),
  aura: G(`<circle cx="12" cy="12" r="7.5" opacity=".7"/><path d="M12 16.5v-9M8.5 11l3.5-3.5 3.5 3.5"/><path d="M8.5 15.5l3.5-3.5 3.5 3.5" opacity=".5"/>`),
  dash: G(`<path d="M3 8h9M3 12h13M3 16h9" opacity=".6"/><path d="M14 6l7 6-7 6z" ${F}/>`),
  meteor: G(`<circle cx="16" cy="16" r="4.4" ${F}/><path d="M13 13L4 4M10.5 14.5L3 9M14.5 10.5L9 3" opacity=".75"/>`),
  vortex: G(`<circle cx="12" cy="12" r="2" ${F}/><circle cx="12" cy="12" r="5.5" opacity=".8"/><circle cx="12" cy="12" r="9" opacity=".5"/>`),
  drop: G(`<path d="M12 3s6 6.4 6 10.6a6 6 0 0 1-12 0C6 9.4 12 3 12 3z" ${F}/>`),
  rune: G(`<circle cx="12" cy="12" r="8.5"/><path d="M12 5.5l5.7 9.7H6.3z" opacity=".85"/><circle cx="12" cy="12" r="1.3" ${F}/>`),
  axe: G(`<path d="M12.5 5L19 9.5 16 14c-2-.4-3.6-1.4-4.5-3z" ${F}/><path d="M12 9.5L5 20" stroke-width="2.2"/>`),
  wings: G(`<path d="M12 18c-1-4-4-7.5-9-8 1 4.6 4 7 9 8zM12 18c1-4 4-7.5 9-8-1 4.6-4 7-9 8z" ${F}/><path d="M12 8v10" opacity=".6"/>`),
  sun: G(`<circle cx="12" cy="12" r="4.2" ${F}/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>`),
  wave: G(`<path d="M3 15c3-5 6-5 9 0s6 5 9 0" /><path d="M3 9.5c3-5 6-5 9 0s6 5 9 0" opacity=".6"/>`),
  chain: G(`<rect x="3.5" y="9" width="9" height="6" rx="3"/><rect x="11.5" y="9" width="9" height="6" rx="3"/>`),
  eye: G(`<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3" ${F}/>`),
  rock: G(`<path d="M3.5 18l3-8 4-4 5 2 4.5 5-2 6.5z" ${F}/><path d="M10.5 6l1.5 6 4.5 1" stroke="rgba(0,0,0,.35)"/>`),
  star: G(`<path d="M12 2.8l2.8 6 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.2 1.2-6.4-4.7-4.4 6.4-.8z" ${F}/>`),
  poison: G(`<path d="M12 3.5s5.5 6 5.5 10a5.5 5.5 0 0 1-11 0c0-4 5.5-10 5.5-10z" ${F}/><circle cx="10.3" cy="13.5" r="1.1" fill="rgba(0,0,0,.45)" stroke="none"/><circle cx="13.7" cy="15.3" r=".8" fill="rgba(0,0,0,.45)" stroke="none"/>`),
  cross: G(`<path d="M12 3v18M6.5 9h11" stroke-width="2.4"/>`)
};

const RULES = [
  [/skull|death|reap|execut|assassin|oblivion|plague|silent|soul|rupture|rend|bloodthirst|lotus/, 'skull'],
  [/poison|venom|scorpion|toxin|deadly/, 'poison'],
  [/fire|flame|ignite|inferno|wildfire|cataclysm|burn|ember|pyro/, 'fire'],
  [/meteor|comet|starfall|falling|sunfall|titan_fall|sky_collapse|fall/, 'meteor'],
  [/ice|frost|blizzard|zero|prison|freeze|snow/, 'ice'],
  [/thunder|lightning|chain_l|bolt|spark|storm_cage|shock|tempest/, 'bolt'],
  [/heal|redemption|vigor|second_wind|restor|renew|mend|blessing|hymn|intervention|bastion|guardian/, 'heal'],
  [/shield|aegis|bulwark|stoneskin|armor|sanctuary|iron_will|faith|stance|barrier|veil|camouflage|vanish/, 'shield'],
  [/hammer|crush|heavy|colossus|quake|fissure|bash|smite|breaker|titan|sunder|boulder/, 'hammer'],
  [/axe|cleave|hatchet/, 'axe'],
  [/whirl|cyclone|spin|dance|tornado|hurricane|windrunner|wind|storm$|shuriken/, 'whirl'],
  [/rain|volley|barrage|hail|arrow_storm|storm_quiver|multi|razor|net|swarm|shower/, 'arrows'],
  [/arrow|shot|bow|quiver|snipe|deadeye|pierc|javelin|lance|precise|phantom_shot|fire_arrow|rapid|trap/, 'arrow'],
  [/dagger|knife|blade|stab|cut|slash|twin|eviscer|fan|thousand|backstab|sword|vengeance|verdict|judgment/, 'dagger'],
  [/dash|charge|leap|step|blink|roll|flip|onslaught|rush|jump|backflip/, 'dash'],
  [/void|singularity|gravity|vortex|well|hole|time|fracture|arcane_over|apocalypse|oblivion|black|eclipse/, 'vortex'],
  [/wings|ascension|archangel|angel|heaven|divine_wind/, 'wings'],
  [/sun|dawn|radiant|light|holy|beam|nova|burst|lux|gate|ray/, 'sun'],
  [/wave|roar|shout|horn|cry|shockwave|hymn|bell|rupture/, 'wave'],
  [/chain|bind|hook|root|snare/, 'chain'],
  [/eye|mark|hunter|zenith|sight|focus|aim/, 'eye'],
  [/stone|rock|earth|mountain|quake/, 'rock'],
  [/warcry|rage|fury|vow|aura|buff|will|warblood|stance|haste|frenzy|endless|champion/, 'aura'],
  [/rune|zone|ring|circle|sigil|consecrat|seal/, 'rune'],
  [/star|cosmos|celest/, 'star']
];
const CLASS_DEFAULT = { warrior: 'slash', paladin: 'cross', mage: 'star', archer: 'arrow', assassin: 'dagger' };

export function skillGlyph(skill, classId) {
  if (!skill) return '';
  const id = skill.id || '';
  for (const [re, g] of RULES) if (re.test(id)) return GLYPHS[g];
  const fx = skill.fx || {};
  if (fx.rain) return GLYPHS.arrows;
  if (fx.dash || fx.blink) return GLYPHS.dash;
  if (fx.buff || fx.shield) return GLYPHS.aura;
  if (skill.heal) return GLYPHS.heal;
  if (fx.waves) return GLYPHS.wave;
  if (fx.zone) return GLYPHS.rune;
  return GLYPHS[CLASS_DEFAULT[skill.classId || classId] || 'slash'];
}
