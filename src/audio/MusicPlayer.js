// V10.40 — Lecteur de musique : vraies pistes MP3 (domaine public, voir public/audio/registry.json).
// - lecture en flux (élément <audio>) : une seule piste est en mémoire, très léger sur mobile ;
// - deux voies avec fondu enchaîné : aucune coupure, ni à la fin d'un morceau (on enchaîne sur une autre piste
//   de la même ambiance), ni au changement d'ambiance (combat, boss, ville, donjon…) ;
// - plusieurs morceaux par ambiance, jamais le même deux fois de suite.
import { MUSIC } from './catalog.js';
import { audioUrl } from './SoundBank.js';

// ambiance → pistes (noms de fichiers de public/audio/music, sans .mp3)
export const PLAYLISTS = {
  town: ['dancing-at-the-inn', 'new-hero-in-town', 'village-tarantella', 'magic-in-the-garden', 'infinite-peace', 'wisdom-in-the-sun'],
  day: ['heroic-adventure', 'lonely-mountain', 'rulers-of-our-lands', 'adventure', 'the-vikings', 'northur'],
  night: ['forest-night', 'night-vigil', 'night-in-the-castle', 'mysterious-lights', 'landra-s-dream'],
  combat: ['battle-ready', 'beginning-of-conflict', 'night-attack', 'behind-enemy-lines', 'honor-bound', 'brothers-unite', 'guerilla-tactics', 'strength-of-the-titans'],
  boss: ['epic-boss-battle', 'black-knight', 'evil-incoming', 'the-enemy', 'kings-trailer', 'release-the-hybrids'],
  dungeon: ['dark-hallway', 'horror-suspense', 'the-abyss', 'consecrated-ground', 'horror-mytery', 'ancient-rite', 'nightmare', 'footsteps-in-the-attic'],
  halloween: ['halloween-theme-1', 'witch-waltz', 'creepy-hallow', 'fright-night-twist', 'goodnightmare'],
  desert: ['the-desert', 'desert-conflict', 'lonely-mountain'],
  tundra: ['ice-and-snow', 'winter', 'the-ice-giants', 'cold-journey', 'nordic-wist'],
  swamp: ['creepy-hallow', 'horror-mytery', 'night-vigil'],
  corrupt: ['the-land-of-the-dead', 'dawn-of-the-apocalypse', 'cursed-intro', 'the-abyss'],
  celeste: ['novus-initium', 'the-crown', 'wisdom-in-the-sun', 'magic-in-the-garden'],
  abyss: ['the-land-of-the-dead', 'dawn-of-the-apocalypse', 'the-abyss', 'evil-incoming'],
  void: ['cursed-intro', 'the-abyss', 'nightmare', 'dawn-of-the-apocalypse', 'ancient-rite'],
  cinematic: ['overture']
};
// changements appliqués tout de suite (fondu rapide) ; les autres attendent la fin du morceau en cours
const URGENT = new Set(['combat', 'boss', 'dungeon', 'town', 'halloween', 'cinematic']);
export const STINGERS = { victory: 'stinger-victory', defeat: 'stinger-defeat' };

export class MusicPlayer {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.out = ctx.createGain();            // niveau propre au lecteur
    this.out.connect(dest);
    this.slots = [this._slot(), this._slot()];
    this.cur = -1;                          // voie en cours
    this.key = null;                        // ambiance en cours
    this.want = null;                       // ambiance demandée
    this.track = null;
    this.recent = [];                       // dernières pistes jouées (pour varier)
    this.since = 0;                         // instant du dernier changement
    this.blocked = false;                   // lecture refusée par le navigateur (attend une interaction)
    this.timer = setInterval(() => this._tick(), 400);
    this._unlock = () => { if (this.blocked) { this.blocked = false; this._resumeCurrent(); } };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, this._unlock, { passive: true });
    this.stinger = this._makeEl();
  }

  _makeEl() {
    const el = new Audio();
    el.preload = 'auto'; el.loop = false; el.crossOrigin = 'anonymous';
    el.setAttribute('playsinline', '');
    const src = this.ctx.createMediaElementSource(el);
    const g = this.ctx.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(this.out);
    return { el, g };
  }
  _slot() { return this._makeEl(); }

  _pick(key) {
    const list = (PLAYLISTS[key] || []).filter((t) => MUSIC[t]);
    if (!list.length) return null;
    const fresh = list.filter((t) => !this.recent.includes(t));
    const pool = fresh.length ? fresh : list.filter((t) => t !== this.track);
    const t = (pool.length ? pool : list)[Math.floor(Math.random() * (pool.length ? pool.length : list.length))];
    this.recent.push(t); if (this.recent.length > Math.min(4, list.length - 1)) this.recent.shift();
    return t;
  }

  // demande une ambiance. Combat, boss et cinématique : immédiat. Les autres changements doivent rester stables un moment
  // (évite les va-et-vient quand on longe une frontière) ; les changements « doux » (jour/nuit, région) attendent la fin du morceau.
  request(key) {
    if (!PLAYLISTS[key]) return;
    const now = performance.now();
    if (key !== this.want) { this.want = key; this.wantSince = now; }
    if (this.key === key && this.cur >= 0) return;
    if (this.cur < 0 || key === 'combat' || key === 'boss' || key === 'cinematic') this._switch(key, key === 'cinematic' ? 1.5 : 2);
  }

  _switch(key, fade = 3) {
    const track = this._pick(key);
    if (!track) return;
    const prev = this.slots[this.cur];
    const next = this.slots[this.cur < 0 ? 0 : 1 - this.cur];
    this.cur = this.cur < 0 ? 0 : 1 - this.cur;
    this.key = key; this.track = track; this.since = performance.now();
    const t = this.ctx.currentTime;
    next.el.src = audioUrl(`music/${track}.mp3`);
    next.el.currentTime = 0;
    next.g.gain.cancelScheduledValues(t); next.g.gain.setValueAtTime(0.0001, t); next.g.gain.setTargetAtTime(1, t, fade / 3.2);
    this._play(next.el);
    if (prev && prev !== next) {
      prev.g.gain.cancelScheduledValues(t); prev.g.gain.setTargetAtTime(0.0001, t, fade / 3.2);
      const el = prev.el; setTimeout(() => { if (this.slots[this.cur].el !== el) this._release(el); }, fade * 1000 + 300);
    }
  }

  // arrête la lecture et abandonne le téléchargement en cours (économie de données)
  _release(el) { try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) { /* ok */ } }

  _play(el) {
    const p = el.play();
    if (p && p.catch) p.catch(() => { this.blocked = true; });
  }
  _resumeCurrent() { const s = this.slots[this.cur]; if (s) this._play(s.el); }

  _tick() {
    if (this.cur < 0 || typeof document === 'undefined') return;
    const s = this.slots[this.cur], el = s.el, now = performance.now();
    if (!el.duration || !isFinite(el.duration)) return;
    const left = el.duration - el.currentTime, dwell = now - this.since;
    if (el.paused) return;
    const want = this.want || this.key;
    if (left < 4.5) { this._switch(want, 4); return; } // fin de morceau proche : on enchaîne sur une autre piste
    if (want === this.key) return;
    const stable = now - (this.wantSince || 0);
    if ((URGENT.has(want) || URGENT.has(this.key)) && stable > 2000 && dwell > 6000) this._switch(want, 3);
    else if (left < 20 && dwell > 25000 && stable > 2000) this._switch(want, 4);
  }

  // fanfare courte (victoire, défaite) par-dessus la musique
  playStinger(name, audio) {
    const file = STINGERS[name]; if (!file) return;
    const s = this.stinger, t = this.ctx.currentTime;
    s.el.src = audioUrl(`music/${file}.mp3`); s.el.currentTime = 0;
    s.g.gain.cancelScheduledValues(t); s.g.gain.setValueAtTime(1.15, t);
    this._play(s.el);
    if (audio) audio.duck(0.18, 9);
  }

  stop(fade = 1.5) {
    const t = this.ctx.currentTime;
    for (const s of this.slots) { s.g.gain.cancelScheduledValues(t); s.g.gain.setTargetAtTime(0.0001, t, fade / 3); const el = s.el; setTimeout(() => { if (this.cur < 0) this._release(el); }, fade * 1000 + 200); }
    this.cur = -1; this.key = null;
  }

  // pause quand l'application passe en arrière-plan (économie de batterie), reprise au retour
  setHidden(h) {
    for (const s of this.slots) { if (h) { try { s.el.pause(); } catch (e) { /* ok */ } } }
    if (!h && this.cur >= 0) this._resumeCurrent();
  }
}
