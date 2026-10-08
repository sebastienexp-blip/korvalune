import * as THREE from 'three';

// V4.5 : projectiles des monstres à distance (archers, mages). Ils se
// déplacent en ligne droite à vitesse finie : on les esquive en se déplaçant
// ou avec la roulade (invulnérabilité). Maximum 24 simultanés (mobile).
const GEO = new THREE.SphereGeometry(0.16, 8, 6);
const MAX = 24;

export class EnemyProjectiles {
  constructor(scene, bus) {
    this.scene = scene; this.bus = bus; this.list = [];
    this.pool = [];
  }

  spawn({ from, dir, speed, damage, color, range }) {
    if (this.list.length >= MAX) this._free(this.list.shift());
    let mesh = this.pool.pop();
    if (!mesh) mesh = new THREE.Mesh(GEO, new THREE.MeshBasicMaterial({ color, fog: false }));
    mesh.material.color.setHex(color);
    mesh.position.copy(from);
    mesh.scale.setScalar(1);
    this.scene.add(mesh);
    this.list.push({ mesh, vel: dir.clone().multiplyScalar(speed), damage, life: (range * 1.3) / speed, color });
  }

  _free(p) { this.scene.remove(p.mesh); this.pool.push(p.mesh); }

  clear() { for (const p of this.list) this._free(p); this.list.length = 0; }

  update(dt, player, world) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const pos = p.mesh.position;
      let hit = false, end = p.life <= 0;
      if (!player.dead && Math.abs(pos.x - player.pos.x) < 0.7 && Math.abs(pos.z - player.pos.z) < 0.7 && pos.y > player.pos.y - 0.1 && pos.y < player.pos.y + 2.1) {
        hit = true;
        if (player.takeDamage(p.damage)) this.bus.emit('enemyProjectileHit', pos);
      } else if (world && pos.y < world.heightAt(pos.x, pos.z)) end = true;
      if (hit || end) {
        this.bus.emit('particles', { pos: pos.clone(), color: p.color, count: hit ? 12 : 6, speed: 2.2, life: 0.35 });
        this._free(p); this.list.splice(i, 1);
      }
    }
  }
}
