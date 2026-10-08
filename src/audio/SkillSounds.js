// V5.1 : sons propres à chaque compétence (151), 100 % synthétisés.
// Chaque compétence est classée par ÉLÉMENT (feu, glace, foudre, arcane, sacré, poison, sang, acier, terre, nature)
// et par TYPE (mêlée, projectile, sort, soutien, bouclier, cri, déplacement), ce qui donne un son de lancement
// distinct, plus un son d'impact à l'endroit visé (plus gros pour les zones).
const rnd = (a, b) => a + Math.random() * (b - a);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const COLOR_EL = { 0xff7a2a: 'fire', 0x7fd8ff: 'ice', 0xcfe8ff: 'lightning', 0xb888ff: 'arcane', 0xb06cff: 'void', 0xffe27a: 'holy', 0x7dff5a: 'poison', 0xd22a2a: 'blood', 0xdfe8f5: 'steel', 0xd9b07a: 'earth', 0x8be86a: 'nature' };
const ID_EL = [
  [/fire|flame|meteor|ignite|cataclysm|elemental|inferno|ember/, 'fire'], [/frost|ice|blizzard|zero|glac/, 'ice'], [/lightning|thunder|spark|storm_arrow|chain/, 'lightning'],
  [/void|oblivion|timefracture|singularity|nightfall|shadow|vanish|phantom|death_mark|silent|assassinate|soul|clone|veil|master/, 'void'], [/arcane|mana|missile|blink|overload|surge|devastation/, 'arcane'],
  [/holy|heal|judg|sanct|divine|radiant|guardian|wrath_of_heaven|celestial|eternal|faith|vow|bless|aegis|redemption|ascen|hymn|consecr|light|sun|smite|vigor|bastion|vengeance|hammer/, 'holy'],
  [/poison|venom|plague|toxic/, 'poison'], [/rend|blood|cut|rampage|berserk|execut|eviscer|bleed|drain|rage|fury|warblood|endless/, 'blood'],
  [/earthquake|colossus|titan|stone|bulwark|stance|leap|shockwave|iron|charge/, 'earth'], [/arrow|shot|evasion|wind|camouflage|eagle|nature|trap|barrage|rain|volley|hunter|deadeye|backflip|zenith|skyfall/, 'nature']
];
const CLASS_EL = { warrior: 'steel', paladin: 'holy', mage: 'arcane', archer: 'nature', assassin: 'steel' };

export function profileOf(s, classId) {
  const fx = s.fx || {};
  let el = COLOR_EL[s.color];
  if (!el) { for (const [re, e] of ID_EL) if (re.test(s.id)) { el = e; break; } }
  if (!el) el = CLASS_EL[classId || s.classId] || 'steel';
  const cls = classId || s.classId;
  const support = s.anim === 'interact' || !!(fx.buff || fx.shield || fx.invuln || fx.restore) && s.anim === 'interact';
  let kind;
  if (fx.blink) kind = 'blink';
  else if (fx.dash) kind = 'dash';
  else if (/roar|warcry|cry|hymn|stance/.test(s.id) && s.anim !== 'attack') kind = 'shout';
  else if (support) kind = (fx.shield || s.heal || el === 'holy') ? 'ward' : /camouflage|vanish|shadow|nightfall|smoke|veil|clone/.test(s.id) ? 'stealth' : 'buff';
  else if (cls === 'archer' || /axe_throw|throwing|knife/.test(s.id)) kind = 'arrow';
  else if (cls === 'mage' || /sunbeam|smite|light_column|holy_storm|wrath_of_heaven|judgment|radiant|blinding|divine_wrath|hammer_toss/.test(s.id)) kind = 'spell';
  else kind = 'melee';
  return { el, kind, big: !!(s.aoe || fx.zone || fx.radius || fx.arc || /meteor|earthquake|cataclysm|titan|colossus|storm|rain|fall/.test(s.id)), heavy: s.anim === 'attack2' };
}

function mk(audio, to) {
  return {
    T: (f, d, o = {}) => audio.tone(f, d, { bus: 'sfx', to, ...o }),
    N: (d, o = {}) => audio.noise(d, { bus: 'sfx', to, ...o }),
    B: (f, d, v, o = {}) => audio.bell(f, d, v, { bus: 'sfx', to, ...o })
  };
}

// ------------------------------------------------------------------ lancement
export function playSkillCast(audio, s, classId) {
  if (!audio?.ctx || !audio.noiseBuf) return;
  const { el, kind, heavy, big } = profileOf(s, classId), { T, N, B } = mk(audio, null);
  const w = heavy ? 0.7 : 1; // les coups lourds : plus graves et plus longs
  const element = () => { // couche élémentaire commune (mêlée et flèches)
    if (el === 'fire') { N(0.35, { freq: 1800, sweep: 600, q: 0.7, vol: 0.07, pink: true, attack: 0.05 }); N(0.03, { freq: 6000, type: 'highpass', vol: 0.05, delay: 0.05 }); }
    else if (el === 'ice') { B(rnd(2400, 3200), 0.5, 0.025, { bright: 0.8 }); N(0.2, { freq: 7000, type: 'highpass', vol: 0.03 }); }
    else if (el === 'lightning') for (let i = 0; i < 4; i++) N(0.02, { freq: rnd(3000, 7000), type: 'highpass', vol: 0.08, delay: i * 0.035 });
    else if (el === 'holy') { B(mtof(84), 0.8, 0.03, { bright: 0.5 }); B(mtof(91), 1.0, 0.025, { delay: 0.07, bright: 0.4 }); }
    else if (el === 'poison') N(0.3, { freq: 1200, sweep: 300, q: 2, vol: 0.05, pink: true });
    else if (el === 'blood') T(70, 0.25, { vol: 0.12, slide: -25 });
    else if (el === 'void') T(90, 0.5, { type: 'sawtooth', vol: 0.04, slide: -50, lp: 500 });
    else if (el === 'steel') { B(rnd(1900, 2600), 0.45, 0.02, { bright: 1 }); }
  };
  switch (kind) {
    case 'melee':
      N(0.22 / w, { freq: 700 * w, sweep: 2800 * w, q: 1.1, vol: 0.15, attack: 0.07, pink: true });
      if (heavy) { T(80, 0.3, { vol: 0.12, slide: -30, delay: 0.1 }); N(0.12, { freq: 220, type: 'lowpass', vol: 0.1, delay: 0.12, pink: true }); }
      if (/thousand|dance|tempest|twin|phantom_blades|rapid|onslaught|light_blade/.test(s.id) || (s.fx && s.fx.hits)) for (let i = 1; i < Math.min(4, (s.fx?.hits || 3)); i++) N(0.14, { freq: 900 + i * 300, sweep: 3000, q: 1.1, vol: 0.09, attack: 0.04, delay: i * 0.09, pink: true });
      element();
      break;
    case 'arrow':
      T(210 * rnd(0.95, 1.05), 0.2, { type: 'triangle', vol: 0.2, slide: -75, attack: 0.002, lp: 2400 });
      N(0.05, { freq: 3300, q: 1.5, vol: 0.12, attack: 0.002 });
      N(0.28, { freq: 1900, sweep: 650, q: 1, vol: 0.06, attack: 0.03, delay: 0.03, pink: true });
      if (big || /storm|rain|volley|barrage|multi|salve|rapid/.test(s.id)) for (let i = 1; i < 4; i++) { T(210 + i * 12, 0.16, { type: 'triangle', vol: 0.11, slide: -60, delay: i * 0.07, lp: 2400 }); N(0.2, { freq: 1900, sweep: 700, vol: 0.04, delay: i * 0.07, pink: true }); }
      if (/axe|knife|throw/.test(s.id)) { N(0.3, { freq: 900, sweep: 2200, q: 1, vol: 0.12, attack: 0.05, pink: true }); }
      element();
      break;
    case 'spell':
    case 'blink': {
      if (kind === 'blink') { N(0.25, { freq: 400, sweep: 5000, q: 1.5, vol: 0.12, attack: 0.15 }); T(300, 0.3, { type: 'sine', vol: 0.1, slide: 1200, attack: 0.1 }); T(2400, 0.1, { vol: 0.08, delay: 0.26 }); break; }
      if (el === 'fire') { N(0.55, { freq: 500, sweep: 3200, q: 0.8, vol: 0.14, attack: 0.2, pink: true }); T(110, 0.5, { type: 'sawtooth', vol: 0.06, slide: 90, lp: 700, attack: 0.15 }); N(0.2, { freq: 5000, type: 'highpass', vol: 0.04, delay: 0.2 }); }
      else if (el === 'ice') { for (let i = 0; i < 4; i++) B(mtof(88 + [0, 4, 7, 12][i]), 0.9, 0.03, { delay: i * 0.06, bright: 0.9 }); N(0.5, { freq: 6000, sweep: 9000, type: 'highpass', vol: 0.035, attack: 0.2 }); }
      else if (el === 'lightning') { T(60, 0.5, { type: 'sawtooth', vol: 0.07, lp: 400, attack: 0.1 }); for (let i = 0; i < 7; i++) N(0.02, { freq: rnd(2500, 8000), type: 'highpass', vol: 0.09, delay: 0.05 + i * rnd(0.03, 0.07) }); }
      else if (el === 'holy') { [60, 64, 67, 72].forEach((m, i) => T(mtof(m + 12), 0.9, { vol: 0.04, delay: i * 0.05, attack: 0.15 })); B(mtof(96), 1.2, 0.03, { delay: 0.25, bright: 0.5 }); N(0.6, { freq: 3000, sweep: 8000, type: 'highpass', vol: 0.025, attack: 0.3 }); }
      else if (el === 'void') { T(220, 0.7, { type: 'sawtooth', vol: 0.05, slide: -170, lp: 600, attack: 0.2 }); T(55, 0.8, { vol: 0.12, slide: -15, attack: 0.2 }); N(0.6, { freq: 1200, sweep: 120, q: 0.8, vol: 0.08, attack: 0.25, pink: true }); }
      else if (el === 'poison') { N(0.5, { freq: 900, sweep: 250, q: 3, vol: 0.09, pink: true, attack: 0.1 }); for (let i = 0; i < 3; i++) T(rnd(200, 360), 0.07, { vol: 0.07, slide: 200, delay: 0.1 + i * 0.09 }); }
      else { // arcane
        T(200, 0.55, { type: 'sawtooth', vol: 0.05, slide: 520, attack: 0.12, lp: 1400, detune: -7 }); T(203, 0.55, { type: 'sawtooth', vol: 0.05, slide: 520, attack: 0.12, lp: 1400, detune: 7 });
        T(1320, 0.5, { vol: 0.04, slide: 880, delay: 0.1, attack: 0.1 }); N(0.5, { freq: 1500, sweep: 6000, q: 1.2, vol: 0.05, attack: 0.15 }); B(2093, 0.4, 0.025, { delay: 0.32 });
      }
      break;
    }
    case 'dash':
      N(0.3, { freq: 500, sweep: 3500, q: 0.9, vol: 0.2, attack: 0.05, pink: true }); T(140, 0.25, { vol: 0.1, slide: 200, attack: 0.02 }); element();
      break;
    case 'shout':
      T(95, 0.8, { type: 'sawtooth', vol: 0.14, slide: 25, lp: 700, vib: 4, vibRate: 22, attack: 0.08 }); T(142, 0.8, { type: 'sawtooth', vol: 0.07, slide: 38, lp: 900, attack: 0.1 });
      N(0.7, { freq: 800, q: 1.4, vol: 0.12, pink: true, attack: 0.1 }); T(mtof(55), 1.0, { type: 'square', vol: 0.04, lp: 800, attack: 0.1, delay: 0.05 });
      break;
    case 'ward':
      [0, 7, 12, 16].forEach((st, i) => B(mtof(72 + st), 0.9, 0.05, { delay: i * 0.08, bright: 0.6 }));
      T(mtof(48), 0.9, { type: 'sine', vol: 0.08, attack: 0.15 }); N(0.5, { freq: 3500, sweep: 7500, type: 'highpass', vol: 0.025, attack: 0.25 });
      break;
    case 'stealth':
      N(0.7, { freq: 4000, sweep: 300, q: 0.7, vol: 0.16, attack: 0.05, pink: true }); T(180, 0.7, { type: 'sine', vol: 0.06, slide: -120 }); T(1000, 0.3, { vol: 0.025, slide: -700, delay: 0.1 });
      break;
    default: // buff
      T(mtof(43), 0.8, { type: 'sawtooth', vol: 0.06, slide: 55, lp: 800, attack: 0.1 }); T(mtof(55), 0.7, { type: 'triangle', vol: 0.06, attack: 0.1 });
      B(mtof(79), 0.8, 0.035, { delay: 0.2, bright: 0.6 }); N(0.4, { freq: 600, sweep: 2600, vol: 0.07, attack: 0.15, pink: true });
      if (el === 'blood' || el === 'fire') T(70, 0.5, { vol: 0.14, slide: -20 });
  }
}

// ------------------------------------------------------------------ impact (à l'endroit visé)
export function playSkillImpact(audio, s, classId, pos) {
  if (!audio?.ctx || !audio.noiseBuf || s.id === 'strike') return;
  const { el, kind, big } = profileOf(s, classId);
  if (kind === 'buff' || kind === 'ward' || kind === 'stealth' || kind === 'shout' || kind === 'blink') return; // pas d'impact
  const d = pos ? audio._dest({ pos, bus: 'sfx' }) : null;
  if (pos && !d) return;
  const { T, N, B } = mk(audio, d || null);
  const g = big ? 1.4 : 1; // zones : plus fort
  switch (el) {
    case 'fire': T(70, 0.5 * g, { vol: 0.22 * g, slide: -35, attack: 0.003 }); N(0.35 * g, { freq: 1400, sweep: 300, q: 0.6, vol: 0.18 * g, pink: true }); for (let i = 0; i < (big ? 6 : 3); i++) N(0.03, { freq: rnd(2500, 6000), type: 'highpass', vol: 0.07, delay: 0.05 + i * rnd(0.04, 0.09) }); break;
    case 'ice': N(0.06, { freq: 6500, type: 'highpass', vol: 0.2 * g, attack: 0.001 }); for (let i = 0; i < (big ? 6 : 3); i++) B(rnd(2600, 4800), 0.5, 0.03, { delay: i * rnd(0.02, 0.06), bright: 1 }); T(100, 0.2, { vol: 0.12, slide: -40 }); break;
    case 'lightning': N(0.03, { freq: 5500, type: 'highpass', vol: 0.3 * g, attack: 0.001 }); T(70, 0.6 * g, { vol: 0.2 * g, slide: -25, delay: 0.02 }); N(0.5 * g, { freq: 260, sweep: 60, q: 0.5, vol: 0.14 * g, pink: true, type: 'lowpass', delay: 0.04 }); break;
    case 'arcane': T(120, 0.45, { vol: 0.2 * g, slide: -70, attack: 0.003 }); B(rnd(900, 1300), 0.9, 0.05, { bright: 0.8 }); N(0.35, { freq: 3000, sweep: 800, q: 1, vol: 0.07, pink: true }); break;
    case 'void': T(48, 0.9 * g, { vol: 0.26 * g, slide: -10, attack: 0.02 }); N(0.7, { freq: 900, sweep: 90, q: 0.7, vol: 0.12, pink: true }); break;
    case 'holy': B(mtof(84), 1.0, 0.07, { bright: 0.6 }); B(mtof(91), 1.3, 0.05, { delay: 0.05, bright: 0.5 }); T(96, 0.5 * g, { vol: 0.15 * g, slide: -30 }); N(0.3, { freq: 5000, type: 'highpass', vol: 0.06 }); break;
    case 'poison': N(0.2, { freq: 500, sweep: 150, q: 1.5, vol: 0.2, pink: true, type: 'lowpass' }); for (let i = 0; i < 3; i++) T(rnd(260, 420), 0.06, { vol: 0.08, slide: 160, delay: 0.05 + i * 0.07 }); break;
    case 'blood': T(85, 0.22, { vol: 0.3, slide: -40, attack: 0.002 }); N(0.12, { freq: 500, q: 0.8, vol: 0.2, pink: true, type: 'lowpass' }); N(0.05, { freq: 3000, type: 'highpass', vol: 0.06 }); break;
    case 'earth': T(52, 0.9 * g, { vol: 0.32 * g, slide: -14, attack: 0.003 }); N(0.8 * g, { freq: 250, sweep: 70, q: 0.5, vol: 0.2 * g, pink: true, type: 'lowpass' }); for (let i = 0; i < 5; i++) N(0.05, { freq: rnd(400, 1500), q: 1, vol: 0.06, delay: 0.1 + i * rnd(0.05, 0.12) }); break;
    case 'nature': T(125, 0.14, { vol: 0.2, slide: -60, attack: 0.002 }); N(0.07, { freq: 800, q: 0.8, vol: 0.16 }); if (big) for (let i = 1; i < 5; i++) { T(125, 0.1, { vol: 0.12, slide: -60, delay: i * rnd(0.05, 0.1) }); N(0.05, { freq: 900, vol: 0.09, delay: i * 0.07 }); } break;
    default: // steel
      N(0.012, { freq: 5000, type: 'highpass', vol: 0.18, attack: 0.001 }); B(rnd(1600, 2400), 0.5, 0.05, { bright: 1 }); T(110, 0.18, { vol: 0.2, slide: -60 }); N(0.08, { freq: 1500, q: 0.7, vol: 0.15 });
  }
}
