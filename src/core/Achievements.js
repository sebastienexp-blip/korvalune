import { ACHIEVEMENTS } from '../data/achievements.js';

// V4.8 : suivi des succès. Les compteurs sont gardés dans le navigateur
// (localStorage), par personnage (clé = nom du personnage), sans toucher
// au format de sauvegarde serveur.
const EVENT_STATS = { roll: 'rolls', use: 'potions', loot: 'loot', equip: 'equips', chest: 'chests', meteor: 'meteors', caravan: 'caravans' };

export class Achievements {
  constructor(game) {
    this.game = game;
    this.stats = {}; this.done = new Set(); this._key = null;
    const b = game.bus;
    b.on('enemyKilled', (e) => { this._add('kills'); if (e?.champion) this._add('champions'); });
    b.on('bossKilled', () => this._add('bosses'));
    b.on('tut', (n) => { if (EVENT_STATS[n]) this._add(EVENT_STATS[n]); });
    b.on('questCompleted', (q) => { if (!q.tutorial) this._add('quests'); });
    b.on('levelup', (lvl) => this._set('level', lvl));
  }

  // à appeler une fois le personnage chargé
  load(name, level) {
    this._key = 'aetheria.ach.v1.' + (name || 'hero');
    this.stats = {}; this.done = new Set();
    try {
      const d = JSON.parse(localStorage.getItem(this._key) || '{}');
      this.stats = d.stats || {}; this.done = new Set(d.done || []);
    } catch (e) { /* ignoré */ }
    this._set('level', level || 1, true);
    // les succès déjà acquis (niveau, etc.) sont validés en silence à la première ouverture
  }

  _save() { try { if (this._key) localStorage.setItem(this._key, JSON.stringify({ stats: this.stats, done: [...this.done] })); } catch (e) { /* ignoré */ } }
  _add(stat, n = 1) { if (!this._key) return; this.stats[stat] = (this.stats[stat] || 0) + n; this._check(stat); }
  _set(stat, v, silent = false) { if (!this._key) return; if (v > (this.stats[stat] || 0)) { this.stats[stat] = v; this._check(stat, silent); } }

  _check(stat, silent = false) {
    let changed = true;
    for (const a of ACHIEVEMENTS) {
      if (a.stat !== stat || this.done.has(a.id) || (this.stats[stat] || 0) < a.goal) continue;
      this.done.add(a.id);
      if (silent) continue;
      const g = this.game, p = g.player;
      if (p) { p.gainXp(a.reward.xp); p.addCoins(a.reward.coins); }
      g.hud?.notify(`🏆 Succès : ${a.icon} ${a.name} (+${a.reward.xp} XP, +${a.reward.coins} 🪙)`, 'quest');
      g.audio?.play('quest');
    }
    if (changed) this._save();
  }

  list() {
    return ACHIEVEMENTS.map((a) => ({ ...a, value: Math.min(a.goal, this.stats[a.stat] || 0), done: this.done.has(a.id) }));
  }
}
