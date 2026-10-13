import { SPEAKERS } from '../data/story.js';

// V10.46 — Voix off du mode histoire.
// 1) si public/voices/<id>.mp3 existe (listé dans public/voices/index.json) : on joue ce fichier ;
// 2) sinon : voix de synthèse du navigateur (français) ;
// 3) sinon : texte seul (les sous-titres restent toujours affichés).
export class VoiceOver {
  constructor(getSettings) {
    this.getSettings = getSettings;
    this._files = null;          // Set des identifiants disposant d'un fichier
    this._audio = null;
    this._token = 0;
    this._loadIndex();
  }

  async _loadIndex() {
    try {
      const r = await fetch('/voices/index.json', { cache: 'no-cache' });
      const j = r.ok ? await r.json() : [];
      this._files = new Set(Array.isArray(j) ? j : []);
    } catch (e) { this._files = new Set(); }
  }

  get enabled() { const s = this.getSettings(); return s.voiceOn !== false && !s.mute && (s.voiceVol ?? 90) > 0; }
  get volume() { const s = this.getSettings(); return Math.min(1, ((s.voiceVol ?? 90) / 100) * ((s.volume ?? 60) / 60)); }

  stop() {
    this._token++;
    if (this._audio) { try { this._audio.pause(); } catch (e) { /* ignoré */ } this._audio = null; }
    try { window.speechSynthesis?.cancel(); } catch (e) { /* ignoré */ }
  }

  // Joue une réplique {id, who, t}. Retourne une promesse résolue quand la voix est terminée
  // (ou tout de suite si la voix est coupée / indisponible : l'appelant se base alors sur le temps de lecture du texte).
  speak(line) {
    this.stop();
    const token = this._token;
    if (!line || !this.enabled) return Promise.resolve({ voiced: false });
    if (this._files?.has(line.id)) return this._playFile(line, token);
    return this._playSynth(line, token);
  }

  _playFile(line, token) {
    return new Promise((resolve) => {
      const a = new Audio(`/voices/${line.id}.mp3`);
      a.volume = this.volume;
      this._audio = a;
      const done = (v) => resolve({ voiced: v });
      a.onended = () => done(true);
      a.onerror = () => { if (token === this._token) this._playSynth(line, token).then(resolve); else done(false); };
      a.play().catch(() => { if (token === this._token) this._playSynth(line, token).then(resolve); else done(false); });
    });
  }

  _playSynth(line, token) {
    return new Promise((resolve) => {
      const ss = window.speechSynthesis;
      if (!ss || typeof SpeechSynthesisUtterance === 'undefined') return resolve({ voiced: false });
      const u = new SpeechSynthesisUtterance(line.t);
      const sp = SPEAKERS[line.who] || {};
      u.lang = 'fr-FR';
      const voices = ss.getVoices?.() || [];
      const fr = voices.filter((v) => /^fr/i.test(v.lang));
      if (fr.length) {
        // une voix légèrement différente par personnage, de façon stable
        const keys = Object.keys(SPEAKERS); const k = Math.max(0, keys.indexOf(line.who));
        u.voice = fr[k % fr.length];
      }
      u.pitch = sp.pitch || 1; u.rate = sp.rate || 1; u.volume = this.volume;
      u.onend = () => resolve({ voiced: true });
      u.onerror = () => resolve({ voiced: false });
      try { ss.speak(u); } catch (e) { resolve({ voiced: false }); }
    });
  }
}

// temps de lecture minimal d'un texte (secondes) : base pour les sous-titres quand aucune voix ne joue
export function readTime(text) { return Math.max(2.2, String(text).length / 14 + 0.8); }
