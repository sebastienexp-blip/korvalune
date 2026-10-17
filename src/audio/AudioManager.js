// Moteur audio V10.40 — fichiers audio RÉELS (plus aucun son synthétisé).
//  - musique : vraies pistes MP3 en flux, fondus enchaînés, plusieurs morceaux par ambiance (MusicPlayer.js) ;
//  - bruitages : enregistrements CC0 / domaine public, plusieurs variantes par action (SoundBank.js, events.js) ;
//  - ambiances : boucles enregistrées (vent, pluie, nuit, ville, grottes…) + sons ponctuels (oiseaux, hibou, loups, tonnerre) ;
//  - chaîne de sortie : bus (sfx / ui / ambience / music) → master → filtres → compresseur/limiteur, réverbération de salle
//    (plein air / grande salle), spatialisation 3D des sons positionnés, limite de voix identiques simultanées ;
//  - interface inchangée pour le reste du jeu : resume, play, footstep, thunder, setEnvironment, setCombat, setRoom,
//    setMuffle, duck, setMix, setVolume, setMuted, setListener, startMusic, stopMusic.
// Provenance et licence de chaque fichier : public/audio/registry.json (et AUDIO_CREDITS.md).
import { SoundBank } from './SoundBank.js';
import { MusicPlayer } from './MusicPlayer.js';
import { EVENTS, STEP_SURFACES, setSpeciesResolver, allEventSounds } from './events.js';
import { SFX, GAIN } from './catalog.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// délai minimal entre deux déclenchements d'un même événement (ms)
const MIN_GAP = { hit: 45, swing: 70, click: 30, step: 80, bow: 60, cast: 80, arrowHit: 35, boltHit: 35, enemyAttack: 140, enemyHurt: 90, kill: 100, loot: 120, pickup: 60, land: 120, legendary: 600, absolute: 900, explode: 120, bossCast: 700, achieve: 300, coin: 50, pylon: 200, wings: 250, talk: 150 };
// nombre maximal de sons identiques en même temps (par fichier de base)
const MAX_SAME = { step: 2, 'step-grass': 2, 'step-dirt': 2, 'step-stone': 2, 'step-wood': 2, 'step-sand': 2, 'step-snow': 2, 'step-gravel': 2, 'step-mud': 2, 'step-leaves': 2, 'step-water': 2, slash: 3, hack: 3, strike: 3, pierce: 3, 'ui-click': 2 };
const MAX_VOICES = 40;
const UI_SOUNDS = new Set(['click', 'open', 'close', 'select', 'confirm', 'quest', 'zone', 'coin', 'equip', 'error', 'denied', 'legendary', 'absolute', 'page', 'trade', 'buy', 'levelup', 'achieve']);
const SENDS = { sfx: 0.2, ui: 0.05, ambience: 0.2, music: 0.25 };
// V10.52 — Garde-fou global : une valeur non finie (NaN, Infinity) donnée à un paramètre audio lève une exception qui arrêtait
// tout le jeu (« Failed to set the 'value' property on 'AudioParam' »). On l'ignore (une seule alerte en console avec la pile d'appels).
(function guardAudioParams() {
  if (typeof AudioParam === 'undefined' || AudioParam.prototype.__korvaGuard) return;
  let warned = 0;
  const warn = (what, v) => { if (warned++ < 3) console.warn('[audio] valeur non finie ignorée :', what, v, new Error().stack); };
  const d = Object.getOwnPropertyDescriptor(AudioParam.prototype, 'value');
  if (d && d.set) Object.defineProperty(AudioParam.prototype, 'value', { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { if (!Number.isFinite(v)) { warn('value', v); return; } d.set.call(this, v); } });
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) {
    const o = AudioParam.prototype[m]; if (typeof o !== 'function') continue;
    AudioParam.prototype[m] = function (...a) { if (!a.every((x) => typeof x !== 'number' || Number.isFinite(x))) { warn(m, a); return this; } return o.apply(this, a); };
  }
  AudioParam.prototype.__korvaGuard = true;
})();

const BUS_LEVEL = { sfx: 2.0, ui: 2.0, ambience: 1.0, music: 1.0 };

// sons chargés dès la première interaction (le reste est chargé à la demande puis en tâche de fond)
const CORE = ['ui-click', 'ui-open', 'ui-close', 'ui-error', 'swing-sword', 'slash', 'hack', 'strike', 'step-grass', 'step-dirt', 'step-stone', 'human-hurt', 'cloth-rustle', 'fall', 'coin-pickup', 'pickup', 'rustle', 'clink', 'tap', 'level-up', 'quest-done', 'bow-draw', 'arrow', 'cast-air-low', 'cast-fire-low', 'impact-fire-low'];
const FAMILIES = ['human', 'human-rough', 'wolf', 'bear', 'boar', 'rat', 'troll', 'goblin', 'ghost', 'skeleton', 'wight', 'dragon', 'slime', 'spider', 'bats'];
const BACKGROUND = [...FAMILIES.flatMap((f) => [`${f}-attack`, `${f}-hurt`, `${f}-death`, `${f}-call`]),
  ...['fire', 'water', 'air', 'earth', 'healing'].flatMap((e) => [`cast-${e}-low`, `cast-${e}-mid`, `cast-${e}-high`, `impact-${e}-low`, `impact-${e}-mid`, `impact-${e}-high`]),
  'swing-cleaver', 'swing-hammer', 'shockbolt', 'arcane', 'bolt', 'hex', 'fear', 'summon', 'light-spell', 'buff', 'ward', 'cure', 'teleport-out', 'unsling', 'arrow-quiver', 'unsheathe', 'fireball', 'thunder', 'church-bell', 'dragon-call', 'step-wood', 'step-sand', 'step-snow', 'step-gravel', 'step-mud', 'step-leaves', 'pierce', 'crush', 'clash', 'death-thud-small', 'death-thud-mid', 'human-death', 'human-attack', 'wolf-attack', 'wolf-hurt', 'wolf-death', 'boar-attack', 'boar-hurt', 'boar-death', 'ui-confirm', 'ui-select', 'scroll', 'denied', 'equip-plate', 'equip-leather', 'coins', 'drop', 'teleport-in', 'spell-circle', 'bird-day', 'door', 'chest-open', 'potion-drink', 'potion-cork'];

// boucles d'ambiance : nom de base → [durée utile, fondu de bouclage] (le fichier dure « utile + fondu »)
const BEDS = {
  'wind-open': [29, 3], 'wind-forest': [37, 3], 'wind-high': [31, 3], 'rain-loop': [34, 2], 'night-loop': [23, 2], 'town-loop': [33, 3],
  'stream-loop': [30, 3], 'frogs-loop': [30, 3], 'lair-loop': [30, 3], 'crypt-loop': [27, 3], 'cave-drips': [30, 3]
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.volume = 0.6;
    this.mix = { music: 0.7, sfx: 1, ui: 1, ambience: 1 };
    this.muted = false;
    this.buses = {};
    this._sends = {};
    this.voices = 0;
    this._same = new Map();
    this._last = {};
    this.env = { night: 0, town: false, rain: 0, snow: false, region: 'prairie', rift: false, hall: false };
    this.mood = 'day';
    this._combatUntil = 0;
    this._ctxMusic = { boss: false, cinematic: false, menu: true };
    this._lp = { x: 0, y: 0, z: 0 };
    this.room = 'open';
    this.beds = {};
  }

  // id de monstre → espèce (fourni par Game, à partir de enemies.json) pour choisir la voix des créatures
  setSpeciesResolver(fn) { setSpeciesResolver(fn); }

  // ------------------------------------------------------------------ initialisation (après la première interaction)
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { this.ctx = new AC(); }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      // chaîne de sortie : passe-haut, filtre « étouffé » (vie basse), chaleur dans les graves, compresseur doux, limiteur final
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28; hp.Q.value = 0.5;
      this._muffle = c.createBiquadFilter(); this._muffle.type = 'lowpass'; this._muffle.frequency.value = 20000; this._muffle.Q.value = 0.4;
      const warm = c.createBiquadFilter(); warm.type = 'lowshelf'; warm.frequency.value = 160; warm.gain.value = 1;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 24; comp.ratio.value = 3.5; comp.attack.value = 0.008; comp.release.value = 0.25;
      const lim = c.createDynamicsCompressor();
      lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
      this.master.connect(hp); hp.connect(this._muffle); this._muffle.connect(warm); warm.connect(comp); comp.connect(lim); lim.connect(c.destination);

      // acoustique de salle : deux réverbérations (plein air / grande salle sombre) mélangées selon le lieu
      this._revIn = c.createGain();
      this._rooms = {};
      for (const [name, sec, decay, lpStart] of [['open', 1.9, 2.6, 0.7], ['hall', 4.2, 2.0, 0.45]]) {
        const conv = c.createConvolver(); conv.buffer = this._makeImpulse(sec, decay, lpStart);
        const g = c.createGain(); g.gain.value = name === 'open' ? 0.7 : 0;
        this._revIn.connect(conv); conv.connect(g); g.connect(this.master);
        this._rooms[name] = g;
      }
      this.room = 'open';

      for (const name of Object.keys(BUS_LEVEL)) {
        const g = c.createGain();
        g.gain.value = 0;
        g.connect(this.master);
        const send = c.createGain(); send.gain.value = SENDS[name];
        g.connect(send); send.connect(this._revIn);
        this.buses[name] = g; this._sends[name] = send;
      }
      this._applyMix(true);

      this.bank = new SoundBank(c);
      this.music = new MusicPlayer(c, this.buses.music);
      this.bank.preload(CORE);
      // appareils modestes (≤ 3 Go de mémoire annoncés) : on garde le chargement à la demande pour ménager la mémoire
      const lowMem = typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory <= 3;
      if (!lowMem) setTimeout(() => this.bank.preload([...new Set([...BACKGROUND, ...allEventSounds()])], { background: true }), 2500);
      this._startEvents();
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', () => {
          if (!this.ctx) return;
          this.music?.setHidden(document.hidden || this.muted);
          const r = document.hidden ? this.ctx.suspend?.() : this.ctx.resume?.();
          r?.catch?.(() => {});
        });
      }
    }
    if (this.ctx.state === 'suspended') { const r = this.ctx.resume(); r?.catch?.(() => {}); }
  }

  // réponse impulsionnelle (acoustique de la salle, pas une source sonore) : pré-délai, réflexions, queue diffuse
  _makeImpulse(sec, decay, lpStart = 0.62) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), sr = c.sampleRate;
    const buf = c.createBuffer(2, n, sr);
    const pre = Math.floor(sr * 0.012);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = pre; i < n; i++) {
        const t = (i - pre) / n;
        const x = (Math.random() * 2 - 1) * Math.pow(1 - t, decay * 1.6);
        lp += (x - lp) * (lpStart - (lpStart - 0.08) * t);
        d[i] = lp * Math.min(1, (i - pre) / (sr * 0.02));
      }
      for (let k = 0; k < 7; k++) {
        const at = pre + Math.floor(sr * (0.011 + k * 0.0093 + (ch ? 0.0031 : 0) + Math.random() * 0.004));
        if (at < n) d[at] += (ch ? -1 : 1) * 0.55 * Math.pow(0.78, k);
      }
    }
    return buf;
  }

  // 'open' (plein air) ou 'hall' (donjon, failles) : fondu enchaîné entre les deux réverbérations
  setRoom(name) {
    if (!this.ctx || !this._rooms || this.room === name || !this._rooms[name]) return;
    this.room = name;
    const t = this.ctx.currentTime;
    this._rooms.open.gain.setTargetAtTime(name === 'open' ? 0.7 : 0, t, 0.6);
    this._rooms.hall.gain.setTargetAtTime(name === 'hall' ? 0.95 : 0, t, 0.6);
  }

  // 0 = net, 1 = très étouffé (vie basse, sous l'eau…)
  setMuffle(x) {
    if (!this.ctx || !this._muffle) return;
    const f = 20000 * Math.pow(0.04, clamp(x, 0, 1));
    this._muffle.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.25);
  }

  // baisse temporairement la musique et les ambiances sous un son important
  duck(amount = 0.45, hold = 1.4) {
    if (!this.ctx || !this.buses.music) return;
    const t = this.ctx.currentTime;
    for (const n of ['music', 'ambience']) {
      const base = BUS_LEVEL[n] * (this.mix[n] ?? 1) * (this._cine?.[n] ?? 1), g = this.buses[n].gain;
      g.cancelScheduledValues(t); g.setTargetAtTime(base * amount, t, 0.04); g.setTargetAtTime(base, t + hold, 0.5);
    }
  }

  // V10.52 : pendant une cinématique parlée, la musique et les ambiances baissent pour laisser entendre la voix
  // V10.67 : `intro` = film d'ouverture (musique plus basse et bruitages adoucis : le son ne doit pas agresser)
  cinemaMix(on, kind) {
    this._cine = on ? (kind === 'intro' ? { music: 0.32, ambience: 0.2, sfx: 0.4, ui: 0.5 } : { music: 0.16, ambience: 0.3, sfx: 0.45, ui: 0.6 }) : null;
    this._applyMix(false);
  }

  _applyMix(instant) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const name of Object.keys(this.buses)) {
      const user = this.mix[name] ?? this.mix.sfx;
      const v = BUS_LEVEL[name] * user * (this._cine?.[name] ?? 1);
      if (instant) this.buses[name].gain.value = v; else this.buses[name].gain.setTargetAtTime(v, now, 0.05);
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }
  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    // en sourdine : on arrête aussi la lecture en flux (batterie, données mobiles)
    this.music?.setHidden(this.muted || (typeof document !== 'undefined' && document.hidden));
  }

  // musique / effets / interface / ambiance : 0..1
  setMix({ music, sfx, ui, ambience }) {
    if (music != null) this.mix.music = clamp(music, 0, 1);
    if (sfx != null) this.mix.sfx = clamp(sfx, 0, 1);
    if (ui != null) this.mix.ui = clamp(ui, 0, 1);
    if (ambience != null) this.mix.ambience = clamp(ambience, 0, 1);
    this._applyMix(false);
  }

  // ------------------------------------------------------------------ spatialisation
  setListener(pos, fwd) {
    if (!this.ctx) return;
    // V10.52 : valeurs non finies (caméra dirigée, matrice dégénérée) : on garde la dernière position valide au lieu de planter
    if (![pos.x, pos.y, pos.z, fwd.x, fwd.y, fwd.z].every(Number.isFinite)) return;
    this._lp.x = pos.x; this._lp.y = pos.y; this._lp.z = pos.z;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
      l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else if (l.setPosition) {
      l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  _dest(o) {
    const bus = this.buses[o.bus || 'sfx'];
    if (!o.pos) return bus;
    const dx = o.pos.x - this._lp.x, dy = (o.pos.y || 0) - this._lp.y, dz = o.pos.z - this._lp.z;
    if (dx * dx + dy * dy + dz * dz > 75 * 75) return null; // trop loin : inaudible
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
    p.refDistance = 5; p.rolloffFactor = 1.25; p.maxDistance = 90;
    if (p.positionX) { p.positionX.value = o.pos.x; p.positionY.value = o.pos.y || 0; p.positionZ.value = o.pos.z; } else p.setPosition(o.pos.x, o.pos.y || 0, o.pos.z);
    p.connect(bus);
    return p;
  }

  // ------------------------------------------------------------------ lecture d'un fichier réel
  // name : nom de base (variantes tirées au hasard) ; o : { pos, bus, vol, rate:[a,b], delay, pan }
  playSample(name, o = {}) {
    if (!this.ctx || !this.bank || this.ctx.state === 'closed') return null;
    const buf = this.bank.pick(name);
    if (!buf) return null; // pas encore chargé (chargement lancé) : on ne remplace jamais par un son artificiel
    const cap = MAX_SAME[name] || 4;
    const n = this._same.get(name) || 0;
    if (n >= cap || this.voices >= MAX_VOICES) return null;
    const d = this._dest({ pos: o.pos, bus: o.bus || 'sfx' });
    if (!d) return null;
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = buf;
    const r = o.rate || [0.96, 1.05];
    src.playbackRate.value = Array.isArray(r) ? rnd(r[0], r[1]) : r;
    const g = c.createGain(); g.gain.value = (o.vol ?? 1) * (GAIN[name] || 1) * rnd(0.92, 1);
    src.connect(g);
    if (o.pan != null && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = o.pan; g.connect(p); p.connect(d); } else g.connect(d);
    this.voices++; this._same.set(name, n + 1);
    src.onended = () => { this.voices--; this._same.set(name, Math.max(0, (this._same.get(name) || 1) - 1)); try { g.disconnect(); } catch (e) { /* ok */ } };
    src.start(c.currentTime + (o.delay || 0));
    return src;
  }

  // événement de jeu (voir events.js)
  play(name, arg) {
    if (!this.ctx || this.ctx.state === 'closed' || !this.bank) return;
    const o = arg && (arg.pos !== undefined || arg.surface !== undefined || arg.kind !== undefined) ? arg : (arg ? { pos: arg } : {});
    const now = performance.now();
    const gap = MIN_GAP[name] || 0;
    if (gap && now - (this._last[name] || 0) < gap) return;
    this._last[name] = now;
    const bus = UI_SOUNDS.has(name) ? 'ui' : 'sfx';
    if (name === 'step') { if (this.stepsOn !== false) this._step(o); return; }
    if (name === 'riftDone') this.duck(0.3, 3);
    else if (name === 'quest' || name === 'guardian') this.duck(0.5, 1.8);
    else if (name === 'death') { this.duck(0.4, 4); this.music?.playStinger('defeat', this); }
    if (name === 'riftDone') this.music?.playStinger('victory', this);
    const make = EVENTS[name];
    if (!make) return;
    for (const l of make(o)) {
      if (l.p < 1 && Math.random() > l.p) continue;
      const sound = Array.isArray(l.s) ? pick(l.s) : l.s;
      if (!this.bank.has(sound)) continue;
      this.playSample(sound, { pos: o.pos, bus, vol: l.v, rate: l.r, delay: l.d });
    }
  }

  _step(o) {
    const base = STEP_SURFACES[o.surface] || 'step-grass';
    this.playSample(base, { pos: o.pos, vol: o.run ? 0.55 : 0.4, rate: o.run ? [1.04, 1.16] : [0.95, 1.05] });
  }
  footstep(surface, run) { this.play('step', { surface, run }); }

  // tonnerre lointain ou proche (fichiers réels)
  thunder() {
    if (!this.ctx || !this.bank) return;
    this.playSample('thunder', { bus: 'ambience', vol: rnd(0.8, 1), rate: [0.85, 1.0], pan: rnd(-0.6, 0.6) });
  }

  // ------------------------------------------------------------------ ambiances (boucles enregistrées)
  _bed(name) {
    let b = this.beds[name];
    if (!b) {
      const c = this.ctx, g = c.createGain(); g.gain.value = 0; g.connect(this.buses.ambience);
      b = this.beds[name] = { name, g, target: 0, started: false, nextAt: 0, zeroSince: 0 };
    }
    return b;
  }
  _setBed(name, level) {
    const b = this._bed(name);
    b.target = level;
    const t = this.ctx.currentTime;
    if (level > 0.01) {
      b.zeroSince = 0;
      if (!this.bank.ready(name)) { this.bank.load(name); return; }
      if (!b.started) this._startBed(b);
      b.g.gain.setTargetAtTime(level, t, 1.6);
    } else if (b.started) {
      b.g.gain.setTargetAtTime(0, t, 1.2);
      if (!b.zeroSince) b.zeroSince = performance.now();
      else if (performance.now() - b.zeroSince > 30000) this._stopBed(b); // libère la mémoire
    }
  }
  _startBed(b) {
    const buf = this.bank.pick(b.name);
    if (!buf) return;
    b.started = true; b.buf = buf;
    const [len, xf] = BEDS[b.name] || [buf.duration - 2, 2];
    b.len = Math.min(len, buf.duration - 0.5); b.xf = Math.min(xf, buf.duration - b.len);
    const off = Math.random() * Math.max(0, b.len - b.xf - 4);
    this._bedVoice(b, this.ctx.currentTime + 0.05, off, 1.5);
    b.nextAt = this.ctx.currentTime + 0.05 + (buf.duration - off) - b.xf;
    b.timer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      if (b.nextAt - this.ctx.currentTime < 2.5) { this._bedVoice(b, b.nextAt, 0, b.xf); b.nextAt += buf.duration - b.xf; }
    }, 800);
  }
  _bedVoice(b, when, offset, fadeIn) {
    const c = this.ctx, src = c.createBufferSource(), g = c.createGain();
    src.buffer = b.buf;
    const end = when + (b.buf.duration - offset);
    g.gain.setValueAtTime(0.0001, when);
    const G = GAIN[b.name] || 1;
    g.gain.linearRampToValueAtTime(G, when + Math.max(0.05, fadeIn));
    g.gain.setValueAtTime(G, Math.max(when + fadeIn, end - b.xf));
    g.gain.linearRampToValueAtTime(0.0001, end);
    src.connect(g); g.connect(b.g);
    src.start(when, offset);
    src.onended = () => { try { g.disconnect(); } catch (e) { /* ok */ } };
  }
  _stopBed(b) {
    clearInterval(b.timer); b.started = false; b.zeroSince = 0;
    this.bank.unload(b.name);
  }

  // env = { night 0..1, town, rain 0..1, snow, fountain 0..1, hw (Halloween), region, rift, hall }
  setEnvironment(e) {
    Object.assign(this.env, e);
    if (!this.ctx || !this.bank) return;
    const E = this.env, out = !E.rift && !E.hall, region = E.region || 'prairie';
    const day = 1 - clamp(E.night, 0, 1);
    const windName = !out ? null : region === 'forest' ? 'wind-forest' : (region === 'mount' || region === 'tundra' || E.snow) ? 'wind-high' : 'wind-open';
    for (const n of ['wind-open', 'wind-forest', 'wind-high']) this._setBed(n, n === windName ? (E.town ? 0.35 : 0.8) * (1 + E.rain * 0.4) * (region === 'desert' ? 1.2 : 1) : 0);
    this._setBed('rain-loop', out ? E.rain * 1.0 : 0);
    this._setBed('night-loop', out && !E.town && E.night > 0.5 && E.rain < 0.5 ? 0.7 * E.night : 0);
    this._setBed('town-loop', E.town && out ? 0.5 + 0.2 * day : 0);
    this._setBed('stream-loop', E.town && out ? 0.7 * (E.fountain ?? 0) : 0);
    this._setBed('frogs-loop', out && region === 'swamp' ? 0.7 : 0);
    this._setBed('lair-loop', E.rift ? 0.8 : 0);
    this._setBed('crypt-loop', E.hall && !E.rift ? 0.8 : 0);
    this._setBed('cave-drips', E.rift || E.hall ? 0.7 : 0);
    this._updateMood();
  }

  // ------------------------------------------------------------------ musique
  _combat() { return performance.now() < this._combatUntil; }
  // à appeler tant que des ennemis attaquent / poursuivent le joueur
  setCombat(active) {
    if (!active) return;
    if (!this._combat() && this._musicPlaying) this.play('combatStart');
    this._combatUntil = performance.now() + 9000;
    this._updateMood();
  }

  // contexte supplémentaire pour le choix de la musique : { boss: bool, cinematic: bool }
  setMusicContext(c) { Object.assign(this._ctxMusic, c); this._updateMood(); }

  // choix de l'ambiance musicale (priorité : cinématique > boss > combat > faille/donjon > Halloween > ville > région > nuit > jour)
  _decideMood() {
    const E = this.env, C = this._ctxMusic, region = E.region || 'prairie';
    if (C.cinematic) return 'cinematic';
    if (C.menu) return 'menu';   // écran-titre / création de personnage, avant l'entrée dans le monde
    if (C.boss && (this._combat() || E.rift)) return 'boss';
    if (this._combat()) return 'combat';
    if (E.rift || E.hall) return 'dungeon';
    if (E.hw) return 'halloween';
    if (E.town) return 'town';
    if (['desert', 'tundra', 'swamp', 'corrupt', 'celeste', 'abyss', 'void'].includes(region)) return region;
    return E.night > 0.55 ? 'night' : 'day';
  }
  _updateMood() {
    this.mood = this._decideMood();
    if (this._musicPlaying && this.music) this.music.request(this.mood);
  }

  startMusic() {
    if (this._musicPlaying || !this.ctx || !this.music) return;
    this._musicPlaying = true;
    this._updateMood();
  }
  stopMusic() {
    this._musicPlaying = false;
    this.music?.stop();
  }

  // ------------------------------------------------------------------ sons d'ambiance ponctuels
  _startEvents() {
    const loop = () => {
      this._eventTimer = setTimeout(loop, rnd(2800, 7500));
      if (!this.ctx || this.ctx.state !== 'running' || !this.bank || (typeof document !== 'undefined' && document.hidden)) return;
      const E = this.env, region = E.region || 'prairie';
      const pan = rnd(-0.85, 0.85), o = { bus: 'ambience', pan };
      if (E.rift || E.hall) { if (Math.random() < 0.12) this.playSample('bats-call', { ...o, vol: 0.4 }); return; }
      if (E.rain > 0.6 && Math.random() < 0.14) { this.thunder(); return; }
      if (E.rain > 0.5) return;
      const day = E.night < 0.45, dawn = E.night >= 0.2 && E.night < 0.5;
      if (day) {
        const birdy = !['desert', 'tundra', 'corrupt', 'swamp'].includes(region) && !E.hw;
        if (birdy && Math.random() < (E.town ? 0.4 : 0.7)) this.playSample(dawn ? 'bird-dawn' : 'bird-day', { ...o, vol: E.town ? 0.5 : 0.8 });
        if (E.town) {
          const r = Math.random();
          if (r < 0.05) this.playSample('church-bell', { ...o, vol: 0.45 });
          else if (r < 0.14) this.playSample('distant-hammer', { ...o, vol: 0.5 });
          else if (r < 0.2) this.playSample('dog-bark', { ...o, vol: 0.35 });
        } else if (region === 'forest' && Math.random() < 0.25) this.playSample('leaves', { ...o, vol: 0.5 });
        if (region === 'corrupt' && Math.random() < 0.3) this.playSample('crow', { ...o, vol: 0.5 });
      } else {
        if (Math.random() < 0.3) this.playSample(E.hw || region === 'corrupt' ? 'crow' : 'owl', { ...o, vol: 0.55 });
        if (!E.town && Math.random() < 0.12) this.playSample('wolf-call', { ...o, vol: 0.4, rate: [0.9, 1.0] });
        if (E.hw && Math.random() < 0.15) this.playSample('ghost-call', { ...o, vol: 0.35 });
        if (E.town && Math.random() < 0.06) this.playSample('church-bell', { ...o, vol: 0.4 });
      }
    };
    this._eventTimer = setTimeout(loop, 2500);
  }

  // vérifie que tous les événements pointent vers des fichiers existants (tests)
  static missingSounds() {
    const miss = new Set();
    const probe = (layers) => { for (const l of layers) for (const s of [].concat(l.s)) if (!SFX[s]) miss.add(s); };
    for (const k of Object.keys(EVENTS)) {
      for (const kind of ['wolf', 'bear', 'boar', 'rat_giant', 'troll', 'bandit', 'zealot', 'goblin', 'wraith_abyssal', 'spire_warden']) {
        try { probe(EVENTS[k]({ kind })); } catch (e) { miss.add(k + ': ' + e.message); }
      }
    }
    return [...miss].filter((s) => !/^ui-/.test(s));
  }
}
