// V10.63 — grandes annonces à l'écran (texte blanc, en gros) + pastilles d'événements en cours avec compte à rebours.
import { wbInfo } from '../data/worldBoost.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`; };

export class Banner {
  constructor(root, game) {
    this.game = game;
    this.queue = []; this.busy = false;
    this.el = document.createElement('div'); this.el.className = 'big-banner'; this.el.setAttribute('role', 'status'); this.el.setAttribute('aria-live', 'polite');
    this.chips = document.createElement('div'); this.chips.className = 'event-chips';
    root.append(this.el, this.chips);
    this.extra = new Map(); // id -> { icon, label, until }
    setInterval(() => this._tickChips(), 1000);
  }
  // m : { kind, icon, text, sub, secs }
  show(m) {
    if (!m || !m.text) return;
    this.queue.push({ kind: m.kind || 'announce', icon: m.icon || '📢', text: String(m.text).slice(0, 200), sub: m.sub ? String(m.sub).slice(0, 120) : '', secs: Math.min(30, Math.max(3, +m.secs || 7)) });
    this.queue[this.queue.length - 1].at = Date.now();
    if (this.queue.length > 5) this.queue.splice(0, this.queue.length - 5);
    if (!this.busy) this._next();
  }
  _inGame() { return this.game?.hud?._curScreen === 'game-ui'; }
  _next() {
    while (this.queue.length && Date.now() - this.queue[0].at > 120000) this.queue.shift(); // trop vieux : on laisse tomber
    if (!this._inGame()) { this.busy = false; return; } // reçu dans un menu : attend l'entrée en jeu
    const m = this.queue.shift();
    if (!m) { this.busy = false; return; }
    this.busy = true;
    this.el.className = `big-banner k-${m.kind}`;
    this.el.innerHTML = `<div class="bb-icon">${esc(m.icon)}</div><div class="bb-body"><div class="bb-text">${esc(m.text)}</div>${m.sub ? `<div class="bb-sub">${esc(m.sub)}</div>` : ''}</div>`;
    void this.el.offsetWidth;
    this.el.classList.add('show');
    this.game?.audio?.play?.('quest');
    setTimeout(() => { this.el.classList.remove('show'); setTimeout(() => this._next(), 450); }, m.secs * 1000);
  }
  // pastille d'un événement local (ex. invasion) : set(id, { icon, label, until }) / set(id, null)
  setChip(id, c) { if (c) this.extra.set(id, c); else this.extra.delete(id); this._tickChips(); }
  _tickChips() {
    if (!this.busy && this.queue.length && this._inGame()) this._next();
    const now = Date.now(), list = [];
    this.chips.style.display = this._inGame() ? '' : 'none';
    const b = wbInfo();
    if (b) list.push({ icon: '✨', label: `${b.label} — XP ×${b.xp} · butin ×${b.drop}`, left: b.until - now, cls: 'boost' });
    for (const [id, c] of this.extra) { if (c.until <= now) { this.extra.delete(id); continue; } list.push({ icon: c.icon, label: c.label, left: c.until - now, cls: 'inv' }); }
    const html = list.map((c) => `<div class="ev-chip ${c.cls}" title="${esc(c.label)}"><span class="ev-ico">${esc(c.icon)}</span><span class="ev-txt">${esc(c.label)}</span><b>${mmss(c.left)}</b></div>`).join('');
    if (html !== this._html) { this._html = html; this.chips.innerHTML = html; }
  }
}
