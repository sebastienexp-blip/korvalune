// Moteur audio V3.6 — 100 % synthétisé (aucun fichier audio, fonctionne hors ligne).
//  - chaîne : bus (sfx / ui / ambience / music) → master → compresseur/limiteur → sortie, avec une réverbération
//    à convolution (réponse impulsionnelle générée) dosée par bus ;
//  - effets sonores à plusieurs couches (acier, chair, magie, arc, pas, butin…), spatialisés (panoramique + distance)
//    quand on leur donne une position dans le monde ;
//  - ambiances : vent, pluie, fontaine de la ville, oiseaux le jour, grillons / hibou / loups la nuit ;
//  - musique générative : 4 ambiances (plaine, ville, nuit, combat), accords + harpe + flûte + percussions,
//    changement d'ambiance à la mesure suivante, passage en musique de combat quand des ennemis attaquent.
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const SCALES = {
  lydian: [0, 2, 4, 6, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11]
};
// bpm, tonique (MIDI), gamme, progression (degrés de la gamme, 1 accord par mesure de 4 temps), densité de harpe, chance de mélodie
const MOODS = {
  town: { bpm: 80, root: 50, scale: 'lydian', prog: [0, 1, 5, 4, 0, 1, 2, 4], harp: 0.85, lead: 0.7, pad: 1, bright: 1 },
  day: { bpm: 72, root: 50, scale: 'dorian', prog: [0, 3, 0, 4, 0, 6, 3, 4], harp: 0.6, lead: 0.55, pad: 1, bright: 0.8 },
  night: { bpm: 58, root: 45, scale: 'aeolian', prog: [0, 5, 2, 6, 0, 3, 5, 6], harp: 0.35, lead: 0.4, pad: 0.9, bright: 0.5 },
  combat: { bpm: 132, root: 38, scale: 'aeolian', prog: [0, 5, 6, 0, 0, 5, 3, 4], harp: 0, lead: 0, pad: 0.6, bright: 1 }
};
// Variantes : à chaque nouveau « morceau » (16 à 28 mesures) on tire au hasard une variante
// différente de la précédente (tonalité, gamme, tempo, progression, timbre du lead).
const VARIANTS = {
  town: [
    {},
    { bpm: 92, root: 55, scale: 'ionian', prog: [0, 4, 5, 3, 0, 4, 1, 4], leadType: 'triangle' },
    { bpm: 70, root: 47, scale: 'mixolydian', prog: [0, 6, 3, 0, 0, 6, 4, 0], harp: 1, leadType: 'sine' },
    { bpm: 86, root: 52, scale: 'lydian', prog: [0, 2, 3, 1, 0, 5, 3, 4], harp: 0.7, lead: 0.9 },
    { bpm: 76, root: 57, scale: 'dorian', prog: [0, 3, 6, 4, 0, 3, 1, 4], leadType: 'triangle', bright: 1.2 }
  ],
  day: [
    {},
    { bpm: 84, root: 53, scale: 'ionian', prog: [0, 4, 5, 3, 0, 4, 3, 4], lead: 0.7, bright: 1 },
    { bpm: 66, root: 47, scale: 'mixolydian', prog: [0, 6, 0, 3, 0, 6, 4, 3], harp: 0.75 },
    { bpm: 78, root: 55, scale: 'lydian', prog: [0, 1, 4, 5, 0, 2, 3, 1], leadType: 'triangle', harp: 0.5 },
    { bpm: 62, root: 43, scale: 'aeolian', prog: [0, 2, 5, 4, 0, 5, 3, 4], lead: 0.65, bright: 0.7 },
    { bpm: 74, root: 52, scale: 'dorian', prog: [0, 4, 3, 6, 0, 4, 1, 4], harp: 0.9, leadType: 'sine' }
  ],
  night: [
    {},
    { bpm: 52, root: 41, scale: 'phrygian', prog: [0, 1, 0, 6, 0, 3, 1, 0], harp: 0.3 },
    { bpm: 56, root: 47, scale: 'harmonic', prog: [0, 5, 3, 4, 0, 5, 1, 4], lead: 0.35 },
    { bpm: 60, root: 43, scale: 'dorian', prog: [0, 6, 3, 5, 0, 6, 4, 5], harp: 0.45, leadType: 'triangle' },
    { bpm: 54, root: 50, scale: 'aeolian', prog: [0, 3, 5, 2, 0, 3, 6, 4], harp: 0.25, lead: 0.5 }
  ],
  combat: [
    {},
    { bpm: 144, root: 40, scale: 'phrygian', prog: [0, 1, 0, 6, 0, 1, 3, 4] },
    { bpm: 126, root: 36, scale: 'harmonic', prog: [0, 5, 3, 4, 0, 5, 6, 4] },
    { bpm: 138, root: 43, scale: 'aeolian', prog: [0, 6, 5, 4, 0, 6, 3, 4] }
  ]
};
const HARP_PATTERNS = [[0, 1, 2, 3, 2, 1, 2, 1], [0, 2, 1, 3, 2, 4, 3, 2], [0, 1, 2, 1, 3, 2, 1, 0], [0, 2, 3, 2, 4, 3, 2, 1]];
const LEAD_RHYTHMS = [[1, 1, 2], [2, 1, 1], [1, 0.5, 0.5, 2], [3, 1], [1.5, 0.5, 1, 1], [1, 1, 1, 1]];
const MIN_GAP = { hit: 40, swing: 70, click: 30, step: 80, bow: 60, cast: 80, arrowHit: 35, boltHit: 35, enemyAttack: 140, enemyHurt: 90, kill: 100, loot: 120, pickup: 60, land: 120, legendary: 600, absolute: 900, coin: 50, globe: 60, pylon: 200 };
const UI_SOUNDS = new Set(['click', 'open', 'close', 'quest', 'zone', 'coin', 'equip', 'error', 'legendary', 'absolute']);
const SENDS = { sfx: 0.2, ui: 0.08, ambience: 0.28, music: 0.5 };
const BUS_LEVEL = { sfx: 1.5, ui: 1.2, ambience: 0.8, music: 0.7 };

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.volume = 0.6;
    this.mix = { music: 0.7, sfx: 1, ui: 1, ambience: 1 };
    this.muted = false;
    this.buses = {};
    this._sends = {};
    this.voices = 0;
    this._last = {};
    this.env = { night: 0, town: false, rain: 0, snow: false };
    this.mood = 'day';
    this._moodTarget = 'day';
    this._combatUntil = 0;
    this._lp = { x: 0, y: 0, z: 0 };
  }

  // ------------------------------------------------------------------ initialisation
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { this.ctx = new AC(); }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      // V5.0 : chaîne de sortie — filtre passe-haut (retire les infra-graves), filtre « étouffé » (vie basse),
      // petite chaleur dans les graves, compresseur doux, puis limiteur final (aucune saturation, même avec beaucoup d'effets)
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28; hp.Q.value = 0.5;
      this._muffle = c.createBiquadFilter(); this._muffle.type = 'lowpass'; this._muffle.frequency.value = 20000; this._muffle.Q.value = 0.4;
      const warm = c.createBiquadFilter(); warm.type = 'lowshelf'; warm.frequency.value = 160; warm.gain.value = 1.5;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 4; comp.attack.value = 0.006; comp.release.value = 0.25;
      const lim = c.createDynamicsCompressor();
      lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
      this.master.connect(hp); hp.connect(this._muffle); this._muffle.connect(warm); warm.connect(comp); comp.connect(lim); lim.connect(c.destination);
      this._probe = c.createAnalyser(); this._probe.fftSize = 512; lim.connect(this._probe);

      // réverbération : deux salles (plein air / grande salle sombre) mélangées selon le lieu
      this._revIn = c.createGain();
      this._rooms = {};
      for (const [name, sec, decay, lpStart] of [['open', 1.9, 2.6, 0.7], ['hall', 4.2, 2.0, 0.45]]) {
        const conv = c.createConvolver(); conv.buffer = this._makeImpulse(sec, decay, lpStart);
        const g = c.createGain(); g.gain.value = name === 'open' ? 0.85 : 0;
        this._revIn.connect(conv); conv.connect(g); g.connect(this.master);
        this._rooms[name] = g;
      }
      this.room = 'open';

      // écho de musique (croche pointée, filtré) : profondeur sur la harpe et la flûte
      this._echoIn = c.createGain(); this._echoIn.gain.value = 1;
      const dl = c.createDelay(2); dl.delayTime.value = 0.42;
      const fb = c.createGain(); fb.gain.value = 0.34;
      const elp = c.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 2600;
      const eOut = c.createGain(); eOut.gain.value = 0.5;
      this._echoIn.connect(dl); dl.connect(elp); elp.connect(fb); fb.connect(dl); elp.connect(eOut); eOut.connect(this.master);
      this._echoDelay = dl;

      for (const name of Object.keys(BUS_LEVEL)) {
        const g = c.createGain();
        g.gain.value = 0;
        g.connect(this.master);
        const send = c.createGain(); send.gain.value = SENDS[name];
        g.connect(send); send.connect(this._revIn);
        if (name === 'music') { const es = c.createGain(); es.gain.value = 0.2; g.connect(es); es.connect(this._echoIn); }
        this.buses[name] = g; this._sends[name] = send;
      }
      this._applyMix(true);

      // bruits : blanc et rose (Paul Kellet)
      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      this.pinkBuf = c.createBuffer(1, len, c.sampleRate);
      const w = this.noiseBuf.getChannelData(0), p = this.pinkBuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const x = Math.random() * 2 - 1;
        w[i] = x;
        b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
        b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
        p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
      }
      this._buildAmbience();
      this._startEvents();
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', () => {
          if (!this.ctx) return;
          const r = document.hidden ? this.ctx.suspend?.() : this.ctx.resume?.();
          r?.catch?.(() => {});
        });
      }
    }
    if (this.ctx.state === 'suspended') { const r = this.ctx.resume(); r?.catch?.(() => {}); }
  }

  // réponse impulsionnelle : pré-délai, premières réflexions espacées, queue diffuse décorrélée entre les deux oreilles
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
        lp += (x - lp) * (lpStart - (lpStart - 0.08) * t); // les aigus meurent plus vite (salle chaleureuse)
        d[i] = lp * Math.min(1, (i - pre) / (sr * 0.02));
      }
      // premières réflexions (positions différentes par oreille)
      for (let k = 0; k < 7; k++) {
        const at = pre + Math.floor(sr * (0.011 + k * 0.0093 + (ch ? 0.0031 : 0) + Math.random() * 0.004));
        if (at < n) d[at] += (ch ? -1 : 1) * 0.55 * Math.pow(0.78, k);
      }
    }
    return buf;
  }

  // 'open' (plein air) ou 'hall' (donjon, Spires) : fondu enchaîné entre les deux réverbérations
  setRoom(name) {
    if (!this.ctx || !this._rooms || this.room === name || !this._rooms[name]) return;
    this.room = name;
    const t = this.ctx.currentTime;
    this._rooms.open.gain.setTargetAtTime(name === 'open' ? 0.85 : 0, t, 0.6);
    this._rooms.hall.gain.setTargetAtTime(name === 'hall' ? 0.95 : 0, t, 0.6);
  }

  // 0 = net, 1 = très étouffé (vie basse, sous l'eau…)
  setMuffle(x) {
    if (!this.ctx || !this._muffle) return;
    const f = 20000 * Math.pow(0.04, clamp(x, 0, 1)); // 20 kHz → ~800 Hz
    this._muffle.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.25);
  }

  // baisse temporairement la musique et les ambiances sous un son important
  duck(amount = 0.45, hold = 1.4) {
    if (!this.ctx || !this.buses.music) return;
    const t = this.ctx.currentTime;
    for (const n of ['music', 'ambience']) {
      const base = BUS_LEVEL[n] * (this.mix[n] ?? 1), g = this.buses[n].gain;
      g.cancelScheduledValues(t); g.setTargetAtTime(base * amount, t, 0.04); g.setTargetAtTime(base, t + hold, 0.5);
    }
  }

  _applyMix(instant) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const name of Object.keys(this.buses)) {
      const user = this.mix[name] ?? this.mix.sfx;
      const v = BUS_LEVEL[name] * user;
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
  }

  // musique / effets : 0..1
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
    if (o.to) return o.to;
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

  // ------------------------------------------------------------------ briques de synthèse
  _track(node) { this.voices++; node.onended = () => { this.voices--; }; }

  tone(freq, dur, { type = 'sine', vol = 0.2, slide = 0, delay = 0, bus = 'sfx', attack = 0.008, to = null, detune = 0, lp = 0, vib = 0, vibRate = 5.5, vibDelay = 0.25 } = {}) {
    const c = this.ctx;
    if (!c || (this.voices > 60 && bus !== 'music')) return;
    const dest = to || this.buses[bus];
    if (!dest) return;
    const t = c.currentTime + Math.max(0, delay);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    osc.detune.value = detune + (bus === 'sfx' && !detune ? rnd(-9, 9) : 0); // légère variation naturelle
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(attack, dur * 0.8));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let last = osc;
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; osc.connect(f); last = f; }
    last.connect(g); g.connect(dest);
    if (vib) {
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = vibRate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(vib, t + vibDelay + 0.3);
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    osc.start(t); osc.stop(t + dur + 0.05);
    this._track(osc);
  }

  noise(dur, { vol = 0.15, freq = 1500, q = 1, type = 'bandpass', sweep = 0, delay = 0, bus = 'sfx', attack = 0.004, pink = false, to = null } = {}) {
    const c = this.ctx;
    if (!c || !this.noiseBuf || (this.voices > 60 && bus !== 'music')) return;
    const dest = to || this.buses[bus];
    if (!dest) return;
    const t = c.currentTime + Math.max(0, delay);
    const src = c.createBufferSource();
    src.buffer = pink ? this.pinkBuf : this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, sweep), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(attack, dur * 0.8));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.9, dur + 0.05);
    this._track(src);
  }

  // cloche / métal : partiels inharmoniques qui s'éteignent à des vitesses différentes
  bell(freq, dur, vol, { delay = 0, to = null, bus = 'sfx', bright = 1 } = {}) {
    const P = [[1, 1, 1], [2.0, 0.5, 0.7], [2.76, 0.35 * bright, 0.5], [4.07, 0.2 * bright, 0.35], [5.4, 0.12 * bright, 0.25]];
    for (const [m, a, d] of P) this.tone(freq * m, dur * d, { vol: vol * a, delay, to, bus, attack: 0.004 });
  }

  pluck(freq, dur, vol, { delay = 0, to = null, bus = 'sfx', bright = 1 } = {}) {
    this.tone(freq, dur, { type: 'triangle', vol, delay, to, bus, attack: 0.004, lp: 1200 + 2600 * bright });
    this.tone(freq * 2, dur * 0.45, { type: 'sine', vol: vol * 0.35, delay, to, bus, attack: 0.003 });
  }

  // ------------------------------------------------------------------ effets sonores
  // play(nom) ou play(nom, position-monde | { pos, ...options })
  play(name, arg) {
    if (!this.ctx || this.ctx.state === 'closed' || !this.noiseBuf) return;
    const o = arg && (arg.pos !== undefined || arg.surface !== undefined || arg.kind !== undefined) ? arg : (arg ? { pos: arg } : {});
    const now = performance.now();
    const gap = MIN_GAP[name] || 0;
    if (gap && now - (this._last[name] || 0) < gap) return;
    this._last[name] = now;
    const bus = UI_SOUNDS.has(name) ? 'ui' : 'sfx';
    const d = this._dest({ pos: o.pos, bus });
    if (!d) return;
    const T = (f, du, op = {}) => this.tone(f, du, { to: d, ...op });
    const N = (du, op = {}) => this.noise(du, { to: d, ...op });
    const v = rnd(0.92, 1.08); // petite variation à chaque coup
    if (name === 'levelup' || name === 'riftDone') this.duck(0.35, 2.4);
    else if (name === 'quest' || name === 'guardian' || name === 'death') this.duck(0.5, 1.6);
    switch (name) {
      case 'swing':
        N(0.24, { freq: 600 * v, sweep: 2600, q: 1.1, vol: 0.14, attack: 0.07, pink: true });
        N(0.1, { freq: 4200, type: 'highpass', vol: 0.03, attack: 0.04, delay: 0.04 });
        break;
      case 'hit':
        N(0.012, { freq: 4800, type: 'highpass', vol: 0.18, attack: 0.001 }); // transitoire sec
        T(150 * v, 0.16, { vol: 0.3, slide: -90, attack: 0.003 });
        T(62, 0.2, { vol: 0.16, slide: -22, attack: 0.002 }); // corps grave
        N(0.08, { freq: 1700 * v, q: 0.7, vol: 0.22 });
        this.bell(1250 * v, 0.28, 0.035, { to: d });
        break;
      case 'crit':
        N(0.015, { freq: 5200, type: 'highpass', vol: 0.22, attack: 0.001 });
        T(46, 0.5, { vol: 0.3, slide: -14, attack: 0.002 });
        T(95, 0.38, { vol: 0.42, slide: -50, attack: 0.003 });
        N(0.16, { freq: 1500, q: 0.6, vol: 0.28 });
        this.bell(1560, 0.7, 0.085, { to: d });
        T(880, 0.22, { type: 'triangle', vol: 0.08, slide: 900, delay: 0.02 });
        break;
      case 'arrowHit':
        T(125 * v, 0.12, { vol: 0.26, slide: -60, attack: 0.002 });
        N(0.07, { freq: 800, q: 0.8, vol: 0.2 });
        T(1900 * v, 0.06, { vol: 0.03, type: 'triangle' });
        break;
      case 'boltHit':
        T(120, 0.45, { vol: 0.34, slide: -80, attack: 0.004 });
        N(0.3, { freq: 5200, type: 'highpass', vol: 0.09, attack: 0.005 });
        N(0.35, { freq: 500, sweep: 160, q: 0.9, vol: 0.2 });
        this.bell(1500 * v, 0.5, 0.04, { to: d });
        break;
      case 'bow':
        T(210 * v, 0.2, { type: 'triangle', vol: 0.2, slide: -75, attack: 0.002, lp: 2400 });
        N(0.05, { freq: 3300, q: 1.5, vol: 0.12, attack: 0.002 });
        N(0.28, { freq: 1900, sweep: 650, q: 1, vol: 0.06, attack: 0.03, delay: 0.03, pink: true });
        break;
      case 'cast':
        T(200, 0.55, { type: 'sawtooth', vol: 0.05, slide: 520, attack: 0.12, lp: 1400, detune: -7 });
        T(203, 0.55, { type: 'sawtooth', vol: 0.05, slide: 520, attack: 0.12, lp: 1400, detune: 7 });
        T(1320, 0.5, { vol: 0.04, slide: 880, delay: 0.1, attack: 0.1 });
        N(0.5, { freq: 1500, sweep: 6000, q: 1.2, vol: 0.05, attack: 0.15 });
        this.bell(2093, 0.4, 0.025, { to: d, delay: 0.32 });
        break;
      case 'hurt':
        T(185 * v, 0.24, { type: 'sawtooth', vol: 0.2, slide: -75, lp: 900 });
        N(0.14, { freq: 700, q: 1.4, vol: 0.14 });
        T(80, 0.14, { vol: 0.2, slide: -30 });
        break;
      case 'death':
        T(210, 1.4, { type: 'sawtooth', vol: 0.18, slide: -160, attack: 0.02, lp: 700 });
        T(52, 1.6, { vol: 0.3, slide: -20, attack: 0.05 });
        N(1.1, { freq: 900, sweep: 120, q: 0.7, vol: 0.12, attack: 0.05, pink: true });
        break;
      // V4.4 : sons dédiés (roulade, potion, battements, explosion, fureur)
      case 'roll':
        N(0.34, { freq: 380, sweep: 1500, q: 0.7, vol: 0.3, attack: 0.05, pink: true });
        N(0.18, { freq: 2600, sweep: 900, type: 'highpass', vol: 0.05, delay: 0.12 });
        T(110, 0.12, { vol: 0.12, slide: -40, delay: 0.3 }); N(0.1, { freq: 420, type: 'lowpass', vol: 0.1, delay: 0.34, pink: true });
        break;
      case 'potion':
        [0, 0.11, 0.22].forEach((dl) => { T(rnd(260, 340), 0.09, { vol: 0.1, slide: -110, delay: dl, type: 'sine' }); N(0.06, { freq: rnd(900, 1400), q: 3, vol: 0.05, delay: dl }); });
        this.bell(mtof(79), 0.6, 0.04, { to: d, delay: 0.38, bright: 0.5 });
        break;
      case 'heartbeat':
        T(62, 0.16, { vol: 0.34, slide: -22, attack: 0.01 }); T(55, 0.2, { vol: 0.28, slide: -20, delay: 0.17, attack: 0.01 });
        break;
      case 'explode':
        N(0.7, { freq: 900, sweep: 90, q: 0.6, vol: 0.36, attack: 0.01, pink: true }); T(70, 0.6, { vol: 0.42, slide: -45, attack: 0.01 });
        N(0.25, { freq: 3500, type: 'highpass', vol: 0.08, delay: 0.02 });
        break;
      case 'enrage':
        T(95 * v, 0.7, { type: 'sawtooth', vol: 0.18, slide: 70, lp: 900, vib: 5, vibRate: 26, attack: 0.04 });
        N(0.5, { freq: 700, q: 1.8, vol: 0.1, attack: 0.1, pink: true });
        break;
      case 'jump': N(0.13, { freq: 520, sweep: 900, q: 0.8, vol: 0.28, attack: 0.03, pink: true }); break;
      case 'land': T(95, 0.16, { vol: 0.2, slide: -40 }); N(0.12, { freq: 380, type: 'lowpass', vol: 0.12, pink: true }); break;
      case 'step': {
        const stone = o.surface === 'stone', run = o.run ? 1.4 : 1;
        if (stone) { N(0.04, { freq: rnd(2000, 3000), q: 1.2, vol: 0.2 * run }); T(rnd(150, 200), 0.06, { vol: 0.16 * run, slide: -40 }); }
        else { N(0.09, { freq: rnd(650, 1100), q: 0.55, vol: 0.3 * run, pink: true, attack: 0.01 }); N(0.05, { freq: 3500, type: 'highpass', vol: 0.05 * run, delay: 0.01 }); }
        break;
      }
      case 'enemyAttack': {
        const id = String(o.kind || '');
        const base = /boar|bear|brute|colossus|behemoth/.test(id) ? 70 : /wolf|stalker/.test(id) ? 120 : /wraith|herald|sentinel/.test(id) ? 150 : 100;
        T(base * v, 0.38, { type: 'sawtooth', vol: 0.15, slide: -base * 0.25, lp: 650, vib: base * 0.05, vibRate: 22, vibDelay: 0.05, attack: 0.05 });
        N(0.3, { freq: base * 6, q: 2.2, vol: 0.07, attack: 0.05, pink: true });
        break;
      }
      case 'enemyHurt':
        T(rnd(300, 360), 0.16, { type: 'sawtooth', vol: 0.2, slide: -140, lp: 1200 });
        N(0.08, { freq: 1000, q: 1.5, vol: 0.12 });
        break;
      case 'kill':
        T(230, 0.38, { type: 'triangle', vol: 0.16, slide: -150, lp: 900 });
        N(0.28, { freq: 600, sweep: 150, vol: 0.12, pink: true });
        this.bell(1320, 0.7, 0.025, { to: d, delay: 0.06 });
        break;
      case 'heal':
        [0, 4, 7, 12].forEach((s, i) => this.bell(mtof(72 + s), 0.7, 0.05, { to: d, delay: i * 0.09, bright: 0.6 }));
        break;
      case 'levelup':
        [60, 64, 67, 72, 76].forEach((m, i) => { T(mtof(m), 0.9, { type: 'triangle', vol: 0.11, delay: i * 0.11, attack: 0.01 }); this.bell(mtof(m + 12), 1.1, 0.04, { to: d, delay: i * 0.11 }); });
        [48, 55, 64].forEach((m) => T(mtof(m), 2.2, { type: 'sawtooth', vol: 0.03, delay: 0.4, attack: 0.3, lp: 900 }));
        N(1.2, { freq: 3000, sweep: 9000, type: 'highpass', vol: 0.035, attack: 0.6, delay: 0.3 });
        break;
      case 'quest':
        this.bell(mtof(67), 0.9, 0.09, { to: d, bright: 0.7 }); this.bell(mtof(74), 1.3, 0.09, { to: d, delay: 0.16, bright: 0.7 });
        break;
      case 'legendary': // alerte reconnaissable : fanfare montante + scintillement
        [67, 72, 76, 79, 84].forEach((m, i) => { T(mtof(m), 0.55, { type: 'triangle', vol: 0.09, delay: i * 0.09, attack: 0.008 }); this.bell(mtof(m + 12), 1.3, 0.06, { to: d, delay: i * 0.09, bright: 0.8 }); });
        T(mtof(48), 1.4, { type: 'sawtooth', vol: 0.04, delay: 0.1, attack: 0.1, lp: 800 });
        N(0.9, { freq: 4000, sweep: 9000, type: 'highpass', vol: 0.04, attack: 0.3, delay: 0.35 });
        break;
      case 'absolute': // item Absolu : fanfare plus longue, deux octaves
        [60, 64, 67, 72, 76, 79, 84, 88, 91].forEach((m, i) => { T(mtof(m), 0.7, { type: 'triangle', vol: 0.08, delay: i * 0.075, attack: 0.008 }); this.bell(mtof(m + 12), 1.8, 0.06, { to: d, delay: i * 0.075, bright: 0.9 }); });
        [48, 55, 60, 64].forEach((m) => T(mtof(m), 2.6, { type: 'sawtooth', vol: 0.035, delay: 0.3, attack: 0.25, lp: 1100 }));
        N(1.8, { freq: 3000, sweep: 11000, type: 'highpass', vol: 0.05, attack: 0.5, delay: 0.3 });
        break;
      case 'zone':
        this.bell(mtof(72), 1.6, 0.05, { to: d, bright: 0.5 }); this.bell(mtof(79), 2.0, 0.04, { to: d, delay: 0.25, bright: 0.5 });
        break;
      case 'click': T(950, 0.035, { vol: 0.18, slide: -450, attack: 0.002 }); N(0.02, { freq: 3500, type: 'highpass', vol: 0.03 }); break;
      case 'open': N(0.18, { freq: 500, sweep: 1700, q: 0.8, vol: 0.14, attack: 0.05, pink: true }); T(660, 0.08, { vol: 0.04, delay: 0.08, type: 'triangle' }); break;
      case 'close': N(0.16, { freq: 1700, sweep: 450, q: 0.8, vol: 0.3, attack: 0.03, pink: true }); break;
      case 'equip': N(0.05, { freq: 3000, q: 2, vol: 0.08 }); this.bell(1800 * v, 0.3, 0.05, { to: d }); T(120, 0.1, { vol: 0.14, slide: -40 }); break;
      case 'coin': this.bell(2600 * v, 0.4, 0.05, { to: d, bright: 0.4 }); this.bell(3300, 0.5, 0.05, { to: d, delay: 0.07, bright: 0.4 }); break;
      case 'loot': [0, 0.07, 0.15].forEach((dl) => this.bell(rnd(2300, 3400), 0.35, 0.035, { to: d, delay: dl, bright: 0.3 })); break;
      case 'pickup': this.bell(mtof(84), 0.4, 0.05, { to: d, bright: 0.4 }); this.bell(mtof(91), 0.6, 0.05, { to: d, delay: 0.07, bright: 0.4 }); N(0.06, { freq: 4000, type: 'highpass', vol: 0.03 }); break;
      case 'error': T(220, 0.09, { type: 'square', vol: 0.05, lp: 900 }); T(165, 0.14, { type: 'square', vol: 0.05, lp: 900, delay: 0.1 }); break;
      case 'portal':
        N(1.3, { freq: 220, sweep: 2200, q: 1.3, vol: 0.2, attack: 0.5, pink: true });
        T(110, 1.5, { vol: 0.12, attack: 0.4, slide: 55 }); T(165, 1.5, { vol: 0.08, attack: 0.5, slide: 80, detune: 8 });
        this.bell(mtof(88), 1.6, 0.04, { to: d, delay: 0.9 });
        break;
      case 'obelisk':
        N(0.5, { freq: 300, sweep: 3500, q: 1.2, vol: 0.18, attack: 0.2, pink: true });
        [0, 0.08, 0.16, 0.26].forEach((dl, i) => this.bell(mtof(72 + i * 5), 0.9, 0.05, { to: d, delay: dl, bright: 0.5 }));
        T(80, 0.7, { vol: 0.2, slide: 40 });
        break;
      case 'pearl': this.bell(mtof(88), 0.35, 0.04, { to: d, bright: 0.5 }); this.bell(mtof(95), 0.5, 0.035, { to: d, delay: 0.06, bright: 0.5 }); break;
      case 'guardian':
        T(55, 1.6, { vol: 0.3, attack: 0.05, slide: -15 }); T(82, 1.4, { vol: 0.2, attack: 0.2, type: 'sawtooth', lp: 500 });
        N(1.4, { freq: 150, sweep: 800, q: 1, vol: 0.2, attack: 0.6, pink: true });
        break;
      case 'riftDone': [72, 76, 79, 84, 88].forEach((m, i) => this.bell(mtof(m), 1.4, 0.06, { to: d, delay: [0, 0.15, 0.3, 0.5, 0.7][i], bright: 0.6 })); break;
      case 'combatStart': N(0.9, { freq: 2500, sweep: 7000, type: 'highpass', vol: 0.05, attack: 0.5 }); T(55, 0.9, { vol: 0.2, attack: 0.05 }); break;
      default: break;
    }
  }

  footstep(surface, run) { this.play('step', { surface, run }); }

  thunder() {
    if (!this.ctx || !this.noiseBuf) return;
    const b = 'ambience';
    this.noise(0.35, { freq: 3500, type: 'highpass', vol: 0.18, bus: b, attack: 0.002 });
    this.noise(2.8, { freq: 260, sweep: 60, q: 0.6, vol: 0.5, bus: b, attack: 0.25, pink: true, delay: 0.05 });
    for (let i = 0; i < 3; i++) this.noise(rnd(0.5, 1), { freq: rnd(120, 220), sweep: 50, q: 0.7, vol: rnd(0.18, 0.3), bus: b, attack: 0.1, pink: true, delay: 0.5 + i * rnd(0.4, 0.8) });
    this.tone(48, 2.4, { vol: 0.28, bus: b, attack: 0.3, slide: -12 });
  }

  _thunder() {
    const b = 'ambience', far = rnd(0, 1);
    this.noise(rnd(2.5, 4.5), { freq: 220 + far * 120, sweep: 55, q: 0.5, vol: 0.55, bus: b, attack: rnd(0.15, 0.5), pink: true, type: 'lowpass' });
    for (let i = 0; i < 3; i++) this.noise(rnd(0.7, 1.4), { freq: rnd(150, 300), sweep: 50, q: 0.6, vol: rnd(0.22, 0.38), bus: b, attack: 0.1, pink: true, type: 'lowpass', delay: 0.6 + i * rnd(0.5, 1.1) });
    this.tone(44, 3, { vol: 0.2, bus: b, attack: 0.4, slide: -10 });
  }

  // ------------------------------------------------------------------ ambiances
  _loopSrc(buf) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.start(0, Math.random() * 1.5);
    return s;
  }

  _buildAmbience() {
    const c = this.ctx, A = this.buses.ambience;
    // source → filtre → modulation (gain 1 ± LFO) → niveau (piloté par setEnvironment) → bus
    const mk = (buf, type, f, q) => {
      const s = this._loopSrc(buf), fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const mod = c.createGain(); mod.gain.value = 1;
      const g = c.createGain(); g.gain.value = 0;
      s.connect(fl); fl.connect(mod); mod.connect(g); g.connect(A);
      return { s, fl, mod, g };
    };
    const lfo = (rate, amt, param) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = rate; g.gain.value = amt; o.connect(g); g.connect(param); o.start(); };
    const wind = mk(this.pinkBuf, 'bandpass', 420, 0.5);
    lfo(0.07, 0.4, wind.mod.gain); lfo(0.11, 150, wind.fl.frequency);
    const rain = mk(this.noiseBuf, 'highpass', 1100, 0.4);
    const rainLp = c.createBiquadFilter(); rainLp.type = 'lowpass'; rainLp.frequency.value = 7000;
    rain.fl.disconnect(); rain.fl.connect(rainLp); rainLp.connect(rain.mod);
    const rainLow = mk(this.pinkBuf, 'lowpass', 520, 0.5);
    const water = mk(this.noiseBuf, 'bandpass', 1900, 0.35);
    lfo(8, 0.35, water.mod.gain);
    this._amb = { wind, rain, rainLow, water };
  }

  // env = { night 0..1, town bool, rain 0..1, snow bool, fountain 0..1 }
  setEnvironment(e) {
    Object.assign(this.env, e);
    if (!this.ctx || !this._amb) return;
    const now = this.ctx.currentTime, E = this.env;
    const set = (n, v, tc = 1.6) => { this._amb[n].g.gain.setTargetAtTime(v, now, tc); };
    set('wind', (E.town ? 0.035 : 0.07) * (1 + (E.snow ? 0.8 : 0)) + E.rain * 0.03);
    set('rain', E.rain * 0.17, 1.2);
    set('rainLow', E.rain * 0.22, 1.2);
    set('water', E.town ? 0.05 * (E.fountain == null ? 1 : E.fountain) : 0, 1.2);
    this._moodTarget = this._combat() ? 'combat' : E.night > 0.55 ? 'night' : E.town ? 'town' : 'day';
  }

  _combat() { return performance.now() < this._combatUntil; }
  // à appeler tant que des ennemis attaquent / poursuivent le joueur
  setCombat(active) {
    if (!active) return;
    if (!this._combat() && this._musicPlaying) this.play('combatStart');
    this._combatUntil = performance.now() + 7000;
    this._moodTarget = 'combat';
  }

  _startEvents() {
    const loop = () => {
      this._eventTimer = setTimeout(loop, rnd(2200, 6500));
      if (!this.ctx || this.ctx.state !== 'running' || (typeof document !== 'undefined' && document.hidden)) return;
      const E = this.env;
      if (E.rain > 0.6 && Math.random() < 0.12) this._thunder();
      if (E.rain > 0.5) return;
      if (E.night < 0.5) {
        if (Math.random() < (E.town ? 0.35 : 0.7)) this._chirp();
        if (E.town && Math.random() < 0.05) this.bell(mtof(67), 5, 0.025, { bus: 'ambience', bright: 0.35 }); // cloche lointaine
      } else {
        if (Math.random() < 0.7) this._crickets();
        if (Math.random() < 0.1) this._owl();
        if (!E.town && Math.random() < 0.035) this._howl();
      }
    };
    this._eventTimer = setTimeout(loop, 2500);
  }

  _panTo(x) {
    const c = this.ctx;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = x; p.connect(this.buses.ambience); return p; }
    return this.buses.ambience;
  }

  _chirp() {
    const to = this._panTo(rnd(-0.9, 0.9)), c = this.ctx;
    const n = Math.floor(rnd(2, 6)), base = rnd(2300, 4300), step = rnd(0.09, 0.14), peak = rnd(0.012, 0.03);
    for (let i = 0; i < n; i++) {
      const t = c.currentTime + i * step, f0 = base * rnd(0.85, 1.2);
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * rnd(0.7, 1.4), t + 0.07);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
      o.connect(g); g.connect(to); o.start(t); o.stop(t + 0.1);
    }
  }

  _crickets() {
    const to = this._panTo(rnd(-0.8, 0.8)), c = this.ctx, t0 = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = rnd(4000, 4600);
    g.gain.value = 0.0001;
    const n = Math.floor(rnd(8, 18));
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.065;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.01, t + 0.02); g.gain.linearRampToValueAtTime(0.0001, t + 0.05);
    }
    o.connect(g); g.connect(to); o.start(t0); o.stop(t0 + n * 0.065 + 0.1);
  }

  _owl() {
    const o = { bus: 'ambience' };
    this.tone(430, 0.55, { ...o, vol: 0.035, slide: -45, attack: 0.08 });
    this.tone(860, 0.4, { ...o, vol: 0.008, attack: 0.08 });
    this.tone(400, 0.8, { ...o, vol: 0.035, slide: -60, attack: 0.08, delay: 0.7 });
  }

  _howl() {
    const c = this.ctx, t = c.currentTime, dur = rnd(2.6, 3.6);
    const to = this._panTo(rnd(-0.9, 0.9));
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(520, t + dur * 0.35); o.frequency.exponentialRampToValueAtTime(380, t + dur);
    f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1100, t + dur * 0.4);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 5.2; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
    o.connect(f); f.connect(g); g.connect(to);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }

  // ------------------------------------------------------------------ musique générative
  startMusic() {
    if (this._musicPlaying || !this.ctx) return;
    this._musicPlaying = true;
    this._bar = 0;
    this._M = null;
    this.mood = this._moodTarget;
    this._nextBar = this.ctx.currentTime + 0.3;
    const now = this.ctx.currentTime;
    this.buses.music.gain.cancelScheduledValues(now);
    this.buses.music.gain.setValueAtTime(0.0001, now);
    this.buses.music.gain.setTargetAtTime(BUS_LEVEL.music * this.mix.music, now + 0.1, 1.8);
    const pump = () => {
      if (!this._musicPlaying || !this.ctx) return;
      const t = this.ctx.currentTime;
      if (this._nextBar < t - 0.5) this._nextBar = t + 0.1; // onglet resté en arrière-plan : on repart proprement
      let guard = 0;
      while (this._nextBar < t + 1.1 && guard++ < 4) this._scheduleBar(this._nextBar);
      this._musicTimer = setTimeout(pump, 160);
    };
    pump();
  }

  stopMusic() {
    this._musicPlaying = false;
    clearTimeout(this._musicTimer);
  }

  // nouveau morceau : variante tirée au hasard, différente de la précédente de cette ambiance
  _newPiece() {
    const list = VARIANTS[this.mood] || [{}];
    this._lastVar = this._lastVar || {};
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this._lastVar[this.mood]) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
    this._lastVar[this.mood] = i;
    this._M = { ...MOODS[this.mood], ...list[i] };
    this._pieceLen = 16 + 4 * Math.floor(Math.random() * 4);
  }

  _chordMidi(M, deg) {
    const S = SCALES[M.scale];
    const n = (k) => { const i = deg + k; return M.root + S[i % 7] + 12 * Math.floor(i / 7); };
    return [n(0), n(2), n(4)];
  }

  _scheduleBar(t) {
    if (this._moodTarget !== this.mood) { this.mood = this._moodTarget; this._bar = 0; this._M = null; }
    else if (this._M && this._bar >= this._pieceLen) { this._bar = 0; this._M = null; }
    if (!this._M) this._newPiece();
    const M = this._M, beat = 60 / M.bpm, barDur = beat * 4;
    const deg = M.prog[this._bar % M.prog.length];
    const ch = this._chordMidi(M, deg);
    const S = SCALES[M.scale];
    const dest = this.buses.music;
    const night = this.mood === 'night';
    const base = t - this.ctx.currentTime;

    // nappe (pad) : deux dents-de-scie désaccordées par note, filtre doux
    for (const m of ch) {
      for (const det of [-6, 6]) this._padNote(mtof(m + (night ? 0 : 12)), t, barDur * 1.15, 0.016 * M.pad, det, this.mood === 'combat' ? 1500 : 1000, dest);
    }
    this._padNote(mtof(ch[0] - 12), t, barDur * 1.05, 0.03 * M.pad, 0, 380, dest, 'sine');

    if (this.mood === 'combat') this._combatBar(base, beat, ch);
    else {
      // basse : racine sur le temps 1 (et la quinte au temps 3 en ville)
      this.tone(mtof(ch[0] - 12), beat * 2.4, { type: 'triangle', vol: 0.06, bus: 'music', delay: base, attack: 0.03, lp: 500 });
      if (this.mood === 'town') this.tone(mtof(ch[0] - 5), beat * 1.6, { type: 'triangle', vol: 0.035, bus: 'music', delay: base + beat * 2, attack: 0.03, lp: 500 });

      // harpe : arpège en croches, quelques silences pour respirer
      if (M.harp > 0) {
        const pat = pick(HARP_PATTERNS);
        const pool = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[1] + 24];
        pat.forEach((idx, i) => {
          if (i > 0 && Math.random() > M.harp) return;
          this.pluck(mtof(pool[idx % pool.length]), beat * (night ? 2.2 : 1.5), (i === 0 ? 0.06 : 0.042) * (0.85 + Math.random() * 0.3), { delay: base + i * beat * 0.5, bus: 'music', bright: M.bright });
        });
      }

      // mélodie de flûte, une phrase toutes les ~2 mesures
      if (this._bar % 2 === 0 && Math.random() < M.lead) this._leadPhrase(base + beat * (Math.random() < 0.5 ? 0 : 1), beat, M, S);
      // nuit : quelques notes de cristal très espacées
      if (night && Math.random() < 0.5) this.bell(mtof(ch[2] + 24), 3, 0.018, { delay: base + beat * rnd(0.5, 3.5), bus: 'music', bright: 0.3 });
    }

    this._bar++;
    this._nextBar = t + barDur;
  }

  _padNote(freq, t, dur, vol, det, lp, dest, type = 'sawtooth') {
    const c = this.ctx;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = det;
    f.type = 'lowpass'; f.frequency.setValueAtTime(lp * 0.55, t); f.frequency.linearRampToValueAtTime(lp, t + dur * 0.5); f.frequency.linearRampToValueAtTime(lp * 0.6, t + dur);
    const a = Math.min(1.4, dur * 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + dur - a); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    this._track(o);
  }

  // delay : secondes à partir de maintenant
  _leadPhrase(delay, beat, M, S) {
    const rhythm = pick(LEAD_RHYTHMS);
    const toMidi = (d) => M.root + 24 + S[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    // on part d'une note de l'accord et on marche par degrés conjoints
    let d = 7 + pick([0, 2, 4]) + (Math.random() < 0.3 ? 1 : 0);
    let at = delay;
    rhythm.forEach((len, i) => {
      if (i > 0) d += pick([-2, -1, -1, 0, 1, 1, 2]);
      d = clamp(d, 5, 13);
      if (!(i > 0 && Math.random() < 0.12)) {
        const dur = len * beat * 0.95 + 0.25, f = mtof(toMidi(d));
        this.tone(f, dur, { type: M.leadType || 'sine', vol: 0.05, bus: 'music', delay: at, attack: 0.07, vib: 6, vibRate: 5.2, vibDelay: 0.2 });
        this.tone(f * 2, dur * 0.8, { type: 'triangle', vol: 0.008, bus: 'music', delay: at, attack: 0.09 });
        this.noise(Math.min(0.25, dur * 0.5), { freq: f * 2, q: 6, vol: 0.006, bus: 'music', delay: at, attack: 0.05 });
      }
      at += len * beat;
    });
  }

  _combatBar(base, beat, ch) {
    const e = beat * 0.5;
    // basse en croches
    for (let i = 0; i < 8; i++) {
      const m = ch[0] - 12 + (i % 4 === 3 ? 7 : 0);
      this.tone(mtof(m), e * 0.95, { type: 'sawtooth', vol: 0.05, bus: 'music', delay: base + i * e, attack: 0.005, lp: 420 + (i % 2 ? 0 : 260) });
    }
    // grosse caisse / taïko
    [1, 0, 0, 0.5, 1, 0, 0.7, 0].forEach((k, i) => {
      if (!k) return;
      this.tone(118, 0.32, { vol: 0.34 * k, slide: -75, bus: 'music', delay: base + i * e, attack: 0.002 });
      this.noise(0.1, { freq: 300, type: 'lowpass', vol: 0.12 * k, bus: 'music', delay: base + i * e });
    });
    // caisse claire (temps 2 et 4) + petit roulement toutes les 4 mesures
    for (const b of [1, 3]) this.noise(0.14, { freq: 1900, q: 0.8, vol: 0.1, bus: 'music', delay: base + b * beat, attack: 0.002 });
    if (this._bar % 4 === 3) for (let i = 0; i < 4; i++) this.noise(0.08, { freq: 2200, q: 0.8, vol: 0.07, bus: 'music', delay: base + beat * 3 + i * e * 0.5 });
    // cordes tendues + accent de cuivres sur le temps 1
    if (this._bar % 2 === 0) {
      for (const m of ch) this.tone(mtof(m + 12), beat * 3.6, { type: 'sawtooth', vol: 0.022, bus: 'music', delay: base, attack: 0.02, lp: 1700 });
      this.tone(mtof(ch[0]), beat * 1.2, { type: 'square', vol: 0.02, bus: 'music', delay: base, attack: 0.01, lp: 1100 });
    }
    // cymbale au début de chaque cycle de 8 mesures
    if (this._bar % 8 === 0) this.noise(1.4, { freq: 6500, type: 'highpass', vol: 0.05, bus: 'music', delay: base, attack: 0.002 });
  }
}
