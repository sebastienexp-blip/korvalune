import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { makeLabel } from '../ui/Label.js';
import { tierAt } from './WorldTiers.js';
import { Enemy } from '../entities/Enemy.js';
import enemiesData from '../data/enemies.json';
import { computeEnemyStats } from '../data/enemyScaling.js';
import { rollLootItem } from '../inventory/ItemGenerator.js';

// V4.9 : événement « Caravane en danger ». Une caravane marchande traverse la
// carte ; elle n'avance que si le joueur est proche et qu'aucun brigand ne
// rôde autour. Trois embuscades se déclenchent en chemin. Arrivée à bon
// port : XP, or et objets. Si le joueur s'éloigne trop longtemps, elle repart sans lui.
const SPEED = 2.4, DIST = 95, FAIL_AWAY = 85, FAIL_T = 35;
const T1_AMBUSH = ['wolf', 'bandit', 'bandit', 'bandit_archer', 'zealot', 'rat_giant', 'cultist_mage'];

const WOOD = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
const CLOTH = new THREE.MeshStandardMaterial({ color: 0xd8c9a0, roughness: 0.95 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 });

function buildWagon() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.3), WOOD); body.position.y = 0.85;
  const cover = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.95, 1.2), CLOTH); cover.position.set(-0.1, 1.55, 0);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), WOOD); bar.position.set(2.0, 0.7, 0);
  g.add(body, cover, bar);
  const wg = new THREE.CylinderGeometry(0.45, 0.45, 0.12, 12); wg.rotateX(Math.PI / 2);
  for (const [x, z] of [[-0.8, 0.72], [-0.8, -0.72], [0.8, 0.72], [0.8, -0.72]]) { const w = new THREE.Mesh(wg, DARK); w.position.set(x, 0.45, z); g.add(w); }
  return g;
}

export class CaravanEvent {
  constructor(game) { this.g = game; this.cd = 200 + Math.random() * 100; this.active = false; this.mesh = null; this.ambushers = []; }

  get pos() { return this.active ? this.mesh.position : null; }

  _pickRoute(p, wl) {
    for (let t = 0; t < 30; t++) {
      const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      const sx = p.x + dx * 40, sz = p.z + dz * 40, ex = sx + dx * DIST, ez = sz + dz * DIST;
      const lim = CONFIG.world.bound - 20;
      if (Math.abs(ex) > lim || Math.abs(ez) > lim || Math.abs(sx) > lim || Math.abs(sz) > lim) continue;
      let ok = Math.hypot(sx, sz) > 80 && Math.hypot(ex, ez) > 80;
      for (let i = 0; ok && i <= 12; i++) {
        const x = sx + (ex - sx) * i / 12, z = sz + (ez - sz) * i / 12;
        if (this.g.world.heightAt(x, z) < wl + 0.8 || !this.g.world.isWalkable(x, z, 1.6)) ok = false;
      }
      if (ok) return { sx, sz, ex, ez };
    }
    return null;
  }

  start() {
    const g = this.g, p = g.player;
    const r = this._pickRoute(p.pos, CONFIG.world.waterLevel);
    if (!r) { this.cd = 60; return false; }
    this.active = true; this.route = r; this.progress = 0; this.wave = 0; this.away = 0; this.t = 0;
    this.mesh = new THREE.Group();
    this.mesh.add(buildWagon());
    const lbl = makeLabel('Caravane marchande', { color: '#ffe9a8', size: 44, scale: 3.4 }); lbl.position.y = 3.1; this.mesh.add(lbl);
    this.mesh.position.set(r.sx, g.world.heightAt(r.sx, r.sz), r.sz);
    this.mesh.rotation.y = Math.atan2(r.ex - r.sx, r.ez - r.sz) - Math.PI / 2;
    g.scene.add(this.mesh);
    g.hud.notify('🐎 Caravane en danger ! Escortez-la jusqu\'au bout (voir la mini-carte).', 'boss');
    g.audio.play('guardian');
    return true;
  }

  _ambush() {
    const g = this.g, p = g.player, c = this.mesh.position;
    // espèces selon le monde où se trouve la caravane
    let species = T1_AMBUSH;
    const tt = tierAt(c.x, c.z);
    if (tt.species) species = tt.species.filter((k) => !/^(brute|bear|troll)/.test(k));
    const n = 3 + this.wave;
    const level = Math.max(1, p.level - 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random(), r = 14 + Math.random() * 4;
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (g.world.heightAt(x, z) < CONFIG.world.waterLevel + 0.6) continue;
      const def = enemiesData[species[Math.floor(Math.random() * species.length)]];
      const e = new Enemy(g.scene, g.world, def, level, new THREE.Vector3(x, g.world.heightAt(x, z), z), g.bus, 300000 + Math.floor(Math.random() * 1e6));
      e.noRespawn = true; e.caravan = true; e.state = 1; // CHASE
      g.enemies.push(e); this.ambushers.push(e);
    }
    this.wave++;
    g.hud.notify(`⚔ Embuscade ! (${this.wave}/3)`, 'boss');
    g.audio.play('combatStart');
  }

  _cleanup() {
    const g = this.g;
    for (const e of this.ambushers) {
      const i = g.enemies.indexOf(e); if (i !== -1) g.enemies.splice(i, 1);
      if (g.player.target === e) g.player.target = null;
      e.dispose(g.scene);
    }
    this.ambushers.length = 0;
  }

  _end(success) {
    const g = this.g, p = g.player;
    this._cleanup();
    const c = this.mesh.position.clone();
    g.scene.remove(this.mesh); this.mesh = null; this.active = false;
    this.cd = 420 + Math.random() * 180;
    if (!success) { g.hud.notify('La caravane a poursuivi sa route sans vous.', 'info'); return; }
    const st = computeEnemyStats(p.level, 'elite');
    p.gainXp(Math.round(st.xp * 3)); p.addCoins(Math.round(st.coins[1] * 4));
    for (let i = 0; i < 2; i++) g._spawnGroundItem({ gen: rollLootItem({ sourceLevel: p.level, tierShift: 7 }) }, p.pos.x + (i ? 1.5 : -1.5), p.pos.z + 1.5, true);
    g.hud.notify('🐎 Caravane arrivée à bon port ! Le marchand vous remercie (récompense au sol).', 'quest');
    g.audio.play('quest');
    g.bus.emit('tut', 'caravan');
  }

  update(dt) {
    const g = this.g, p = g.player;
    if (!p || p.dead || g.paused) return;
    if (!this.active) {
      if (g.modalOpen || g.dialogueOpen || g.rift?.active || g._mev?.active) return;
      if (Math.hypot(p.pos.x, p.pos.z) < 75) return;
      this.cd -= dt;
      if (this.cd <= 0) this.start();
      return;
    }
    if (g.rift?.active) { this._end(false); return; }
    const c = this.mesh.position, r = this.route;
    this.t += dt;
    // nettoyage des embusqués morts depuis un moment
    for (let i = this.ambushers.length - 1; i >= 0; i--) {
      const e = this.ambushers[i];
      if (!e.alive && e.deadT > 8) { const k = g.enemies.indexOf(e); if (k !== -1) g.enemies.splice(k, 1); e.dispose(g.scene); this.ambushers.splice(i, 1); }
    }
    const dP = Math.hypot(p.pos.x - c.x, p.pos.z - c.z);
    this.away = dP > FAIL_AWAY ? this.away + dt : 0;
    if (this.away > FAIL_T) { this._end(false); return; }
    const threat = this.ambushers.some((e) => e.alive && Math.hypot(e.pos.x - c.x, e.pos.z - c.z) < 30);
    if (dP < 24 && !threat) {
      this.progress = Math.min(1, this.progress + (SPEED * dt) / DIST);
    }
    const x = r.sx + (r.ex - r.sx) * this.progress, z = r.sz + (r.ez - r.sz) * this.progress;
    c.set(x, g.world.heightAt(x, z) + Math.abs(Math.sin(this.t * 5)) * (dP < 24 && !threat ? 0.03 : 0), z);
    if (this.wave < 3 && this.progress >= (this.wave + 1) * 0.25 && !threat) this._ambush();
    if (this.progress >= 1 && !threat) this._end(true);
  }
}
