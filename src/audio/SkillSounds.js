// V10.40 : sons propres à chaque compétence (151) — fichiers audio réels (sorts, armes, créatures), plus aucune synthèse.
// Chaque compétence est classée par ÉLÉMENT (feu, glace, foudre, arcane, sacré, poison, sang, acier, terre, nature)
// et par TYPE (mêlée, projectile, sort, soutien, bouclier, cri, déplacement), ce qui donne un son de lancement
// distinct, plus un son d'impact à l'endroit visé (plus gros pour les zones).

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

// ------------------------------------------------------------------ lancement
// couche élémentaire ajoutée aux coups de mêlée et aux flèches
const ELEMENT_LAYER = {
  fire: ['cast-fire-low', 0.4], ice: ['cast-water-low', 0.4], lightning: ['shockbolt', 0.45], holy: ['light-spell', 0.4],
  poison: ['slime-sizzle', 0.45], blood: ['hit-leather', 0.5], void: ['hex', 0.45], earth: ['cast-earth-low', 0.35], nature: ['leaves', 0.4], arcane: ['arcane', 0.35]
};
// sorts : élément → fichiers selon la puissance (0 faible, 1 moyen, 2 fort)
const SPELL_FILES = {
  fire: ['cast-fire-low', 'cast-fire-mid', 'cast-fire-high'], ice: ['cast-water-low', 'cast-water-mid', 'cast-water-high'],
  lightning: ['shockbolt', 'cast-air-mid', 'cast-air-high'], holy: ['cast-healing-low', 'cast-healing-mid', 'light-spell'],
  void: ['hex', 'fear', 'summon'], poison: ['slime-sizzle', 'cast-water-low', 'hiss'], arcane: ['arcane', 'bolt', 'cast-air-high'],
  blood: ['hex', 'fear', 'summon'], earth: ['cast-earth-low', 'cast-earth-mid', 'cast-earth-high'], nature: ['cast-earth-low', 'cast-earth-mid', 'cast-earth-high'], steel: ['arcane', 'bolt', 'cast-air-high']
};
const IMPACT_FILES = {
  fire: ['impact-fire-low', 'impact-fire-mid', 'impact-fire-high'], ice: ['impact-water-low', 'impact-water-mid', 'impact-water-high'],
  lightning: ['impact-air-low', 'impact-air-mid', 'impact-air-high'], arcane: ['impact-air-mid', 'impact-air-mid', 'impact-air-high'],
  void: ['impact-earth-low', 'impact-earth-mid', 'impact-earth-high'], holy: ['impact-healing-low', 'impact-healing-mid', 'impact-healing-high'],
  poison: ['slime-sizzle', 'slime-attack', 'impact-water-low'], blood: ['slash', 'hack', 'crush'], earth: ['impact-earth-low', 'impact-earth-mid', 'impact-earth-high'],
  nature: ['pierce', 'impact-earth-low', 'impact-earth-mid'], steel: ['clash', 'strike', 'crush']
};

export function playSkillCast(audio, s, classId) {
  if (!audio?.ctx || !audio.bank) return;
  const { el, kind, heavy, big } = profileOf(s, classId);
  const P = (name, vol = 1, rate, delay = 0) => audio.playSample(name, { vol, rate: rate || [0.96, 1.06], delay });
  const element = () => { const l = ELEMENT_LAYER[el]; if (l) P(l[0], l[1], [0.95, 1.05], 0.03); };
  const power = heavy || big ? 2 : (s.fx && (s.fx.zone || s.fx.radius)) ? 1 : 0;
  switch (kind) {
    case 'melee': {
      const hits = Math.min(4, (s.fx?.hits || 1) + (/thousand|dance|tempest|twin|phantom_blades|rapid|onslaught|light_blade/.test(s.id) ? 2 : 0));
      for (let i = 0; i < Math.max(1, hits); i++) P(heavy ? (i % 2 ? 'swing-cleaver' : 'swing-hammer') : (i % 2 ? 'swing-cleaver' : 'swing-sword'), 0.9 - i * 0.08, heavy ? [0.88, 1] : [0.95, 1.1], i * 0.09);
      element();
      break;
    }
    case 'arrow':
      if (/axe|knife|throw/.test(s.id)) { P('swing-cleaver', 0.7, [1.1, 1.25]); P('unsling', 0.5, [1, 1.1], 0.03); } else { P('bow-draw', 0.8); P('arrow', 0.9, [0.95, 1.1], 0.1); }
      if (big || /storm|rain|volley|barrage|multi|salve|rapid/.test(s.id)) { P('arrow', 0.6, [1, 1.15], 0.2); P('arrow', 0.5, [1, 1.2], 0.3); P('arrow-quiver', 0.5, [1, 1.1], 0.05); }
      element();
      break;
    case 'blink':
      P('teleport-out', 0.95);
      break;
    case 'spell': {
      const f = SPELL_FILES[el] || SPELL_FILES.arcane;
      P(f[power], 0.95);
      if (power === 2) P(f[1], 0.5, [0.8, 0.9], 0.08);
      break;
    }
    case 'dash':
      P('cloth-rustle', 0.8, [1.2, 1.4]); P('swing-sword', 0.6, [1.2, 1.35], 0.02); element();
      break;
    case 'shout':
      P('troll-attack', 0.85, [0.8, 0.9]); P('human-rough-attack', 0.5, [0.7, 0.8], 0.04);
      break;
    case 'ward':
      P('ward', 0.95); P('cast-healing-low', 0.5, [1, 1.05], 0.1);
      break;
    case 'stealth':
      P('cloth-rustle', 0.7, [0.8, 0.9]); P('hiss', 0.5, [0.8, 0.9], 0.05);
      break;
    default: // buff
      P('buff', 0.95); element();
  }
}

// ------------------------------------------------------------------ impact (à l'endroit visé)
export function playSkillImpact(audio, s, classId, pos) {
  if (!audio?.ctx || !audio.bank || s.id === 'strike') return;
  const { el, kind, big } = profileOf(s, classId);
  if (kind === 'buff' || kind === 'ward' || kind === 'stealth' || kind === 'shout' || kind === 'blink') return; // pas d'impact
  const f = IMPACT_FILES[el] || IMPACT_FILES.steel;
  const lvl = big ? 2 : (s.fx && (s.fx.zone || s.fx.radius)) ? 1 : 0;
  audio.playSample(f[lvl], { pos: pos || undefined, vol: big ? 1 : 0.85, rate: big ? [0.85, 0.98] : [0.97, 1.08] });
  if (big) audio.playSample('death-thud-big', { pos: pos || undefined, vol: 0.45, rate: [1.0, 1.15], delay: 0.03 });
}
