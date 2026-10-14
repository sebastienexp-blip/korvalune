// V10.59 — invasions lancées par le créateur : des monstres apparaissent autour du joueur (butin et XP normaux).
import * as THREE from 'three';
import { Enemy } from '../entities/Enemy.js';
import enemiesData from '../data/enemies.json';
import { HALF } from './TownMap.js';

const MAX_ALIVE = 40, LIFETIME = 10 * 60 * 1000;
export class AdminSpawns {
  constructor(game) { this.g = game; this.list = []; this.pending = []; this._eid = 700000; setInterval(() => this._sweep(), 2500); }
  _inTown(x, z) { return Math.abs(x) < HALF + 10 && Math.abs(z) < HALF + 10; }
  spawn({ enemy, count, label, boss }) {
    const g = this.g, p = g.player, w = g.world, def = enemiesData[enemy];
    if (!p || !w || !def || p.dead) return 0;
    const alive = this.list.filter((e) => e.state !== 5).length;
    const n = Math.min(count | 0 || 1, MAX_ALIVE - alive);
    let made = 0;
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < 14; t++) {
        const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 10;
        const x = p.pos.x + Math.cos(a) * r, z = p.pos.z + Math.sin(a) * r;
        if (!w.isWalkable(x, z, 0.6) || this._inTown(x, z)) continue;
        const pos = new THREE.Vector3(x, w.heightAt(x, z), z);
        const e = new Enemy(g.scene, w, def, Math.max(1, p.level + (boss ? 2 : 0)), pos, g.bus, this._eid++);
        e.noRespawn = true; e.adminSpawn = true; e.state = 1; e._born = Date.now();
        if (boss) { e.maxHp *= 4; e.hp = e.maxHp; e.xp = Math.round(e.xp * 3); }
        e.setTitle(`${boss ? '👑' : '✨'} ${label || def.name} · Nv.${e.level}`, boss ? '#ff9a3c' : '#9be3ff');
        g.enemies.push(e); this.list.push(e); made++;
        g.particles?.emit(pos.x, pos.y + 0.8, pos.z, { count: boss ? 40 : 16, color: 0x9be3ff, speed: 3, life: 0.8, up: 2, spread: 1.2 });
        break;
      }
    }
    if (!made && !alive && this._inTown(p.pos.x, p.pos.z)) { // en ville : l'invasion attend que le joueur sorte (5 min max)
      this.pending.push({ enemy, count, label, boss, t: Date.now() });
      g.banner?.show({ kind: 'alert', icon: '⚠️', text: 'Une invasion approche !', sub: 'Sors de la ville pour affronter les monstres.', secs: 7 });
      return 0;
    }
    if (made) {
      g.banner?.show({ kind: 'event', icon: boss ? '👑' : '⚔️', text: boss ? `${label || def.name} est apparu !` : `Invasion : ${label || def.name} !`, sub: `${made} monstre${made > 1 ? 's' : ''} autour de toi — bats-les !`, secs: 7 });
      g.audio?.play?.('combatStart'); this._chip();
    }
    return made;
  }
  _chip() {
    const alive = this.list.filter((e) => e.state !== 5).length;
    const born = this.list.reduce((m, e) => Math.min(m, e._born), Date.now());
    this.g.banner?.setChip('inv', alive ? { icon: '⚔️', label: `Invasion : ${alive} restant${alive > 1 ? 's' : ''}`, until: born + LIFETIME } : null);
  }
  _remove(e) {
    const g = this.g, i = g.enemies.indexOf(e); if (i >= 0) g.enemies.splice(i, 1);
    if (g.player?.target === e) g.player.target = null;
    try { e.dispose(g.scene); } catch { /* déjà libéré */ }
  }
  _sweep() {
    const now = Date.now();
    const pl = this.g.player;
    this.pending = this.pending.filter((m) => now - m.t < 300000);
    if (this.pending.length && pl && !pl.dead && this.g.hud._curScreen === 'game-ui' && !this._inTown(pl.pos.x, pl.pos.z)) this.spawn(this.pending.shift());
    this.list = this.list.filter((e) => {
      if (e.state === 5 && !e._diedAt) e._diedAt = now;
      if ((e._diedAt && now - e._diedAt > 8000) || now - e._born > LIFETIME) { this._remove(e); return false; }
      return true;
    });
    this._chip();
  }
}
