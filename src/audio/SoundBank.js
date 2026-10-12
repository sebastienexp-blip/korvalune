// V10.40 — Banque de sons réels : charge et décode à la demande les fichiers de public/audio.
// Chaque son est un « nom de base » qui possède plusieurs variantes (nom-1.mp3 … nom-N.mp3) ;
// pick() en renvoie une au hasard, jamais la même deux fois de suite.
import { SFX, UI } from './catalog.js';

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';

export function audioUrl(path) { return `${BASE}audio/${path}`; }

export class SoundBank {
  constructor(ctx) {
    this.ctx = ctx;
    this.buffers = new Map();   // nom de base → [AudioBuffer|null]
    this.loading = new Map();   // nom de base → Promise
    this.last = new Map();      // nom de base → dernier index joué
    this.active = 0;            // téléchargements en cours
    this.queue = [];
    this.saveData = !!(typeof navigator !== 'undefined' && navigator.connection && navigator.connection.saveData);
    this.failed = new Set();
  }

  _folder(name) { return UI[name] ? 'ui' : 'sfx'; }
  count(name) { return SFX[name] || UI[name] || 0; }
  has(name) { return this.count(name) > 0; }
  ready(name) { return this.buffers.has(name); }

  // charge toutes les variantes d'un son (une seule fois) ; renvoie une promesse
  load(name) {
    if (this.buffers.has(name)) return Promise.resolve();
    if (this.loading.has(name)) return this.loading.get(name);
    const n = this.count(name);
    if (!n) return Promise.resolve();
    const folder = this._folder(name);
    const p = Promise.all(Array.from({ length: n }, (_, i) => this._fetchDecode(`${folder}/${name}-${i + 1}.mp3`))).then((list) => {
      this.buffers.set(name, list);
      this.loading.delete(name);
    });
    this.loading.set(name, p);
    return p;
  }

  _slot() {
    if (this.active < 4) { this.active++; return Promise.resolve(); }
    return new Promise((res) => this.queue.push(res)).then(() => { this.active++; });
  }
  _release() { this.active--; const next = this.queue.shift(); if (next) next(); }

  async _fetchDecode(path) {
    await this._slot();
    try {
      const r = await fetch(audioUrl(path));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.arrayBuffer();
      return await new Promise((res, rej) => this.ctx.decodeAudioData(data, res, rej));
    } catch (e) {
      if (!this.failed.has(path)) { this.failed.add(path); console.warn('[audio] impossible de charger', path, e && e.message); }
      return null;
    } finally { this._release(); }
  }

  // une variante au hasard (jamais la même qu'au dernier appel) ; null si pas encore chargée (le chargement est lancé)
  pick(name) {
    const list = this.buffers.get(name);
    if (!list) { this.load(name); return null; }
    const ok = [];
    for (let i = 0; i < list.length; i++) if (list[i]) ok.push(i);
    if (!ok.length) return null;
    let i = ok[Math.floor(Math.random() * ok.length)];
    const prev = this.last.get(name);
    if (ok.length > 1 && i === prev) i = ok[(ok.indexOf(i) + 1 + Math.floor(Math.random() * (ok.length - 1))) % ok.length];
    this.last.set(name, i);
    return list[i];
  }

  // précharge une liste de noms ; en tâche de fond : par petits groupes, quand le navigateur est disponible
  preload(names, { background = false } = {}) {
    if (this.saveData && background) return;
    if (!background) { for (const n of names) this.load(n); return; }
    const STEP = 3;
    const run = (i) => {
      if (i >= names.length) return;
      Promise.all(names.slice(i, i + STEP).map((n) => this.load(n))).then(() => {
        if (typeof requestIdleCallback === 'function') requestIdleCallback(() => run(i + STEP), { timeout: 2500 });
        else setTimeout(() => run(i + STEP), 120);
      });
    };
    run(0);
  }

  // libère la mémoire d'un son rarement utilisé
  unload(name) { this.buffers.delete(name); }
}
