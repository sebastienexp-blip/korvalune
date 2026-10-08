import * as THREE from 'three';

// V4.6 : zones de danger au sol. Un cercle annonce l'impact (télégraphe),
// puis la zone explose : dégâts à tout joueur encore dedans. La roulade
// (invulnérabilité) ou un simple pas de côté permet de les éviter.
// Utilisé par les boss et par l'événement « Pluie d'astres ». Max 24 zones.
const RING = new THREE.RingGeometry(0.94, 1, 40);
const DISC = new THREE.CircleGeometry(1, 28);
const MAX = 24;

export class GroundHazards {
  constructor(scene, world, bus) { this.scene = scene; this.world = world; this.bus = bus; this.list = []; this.pool = []; }

  _mk() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    const disc = new THREE.Mesh(DISC, new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    ring.rotation.x = disc.rotation.x = -Math.PI / 2;
    g.add(ring, disc); g.userData = { ring, disc };
    return g;
  }

  spawn({ x, z, radius = 3, delay = 1.4, damage = 10, color = 0xff3a2a, dmgType = null }) {
    if (this.list.length >= MAX) this._free(this.list.shift());
    const mesh = this.pool.pop() || this._mk();
    mesh.userData.ring.material.color.setHex(color); mesh.userData.disc.material.color.setHex(color);
    mesh.position.set(x, this.world.heightAt(x, z) + 0.12, z);
    mesh.scale.set(radius, 1, radius);
    this.scene.add(mesh);
    this.list.push({ mesh, x, z, radius, t: 0, delay, damage, color, dmgType });
  }

  _free(h) { this.scene.remove(h.mesh); this.pool.push(h.mesh); }
  clear() { for (const h of this.list) this._free(h); this.list.length = 0; }

  update(dt, player) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const h = this.list[i];
      h.t += dt;
      const f = Math.min(1, h.t / h.delay);
      h.mesh.userData.disc.material.opacity = 0.12 + 0.4 * f * (0.7 + 0.3 * Math.sin(h.t * 18));
      h.mesh.userData.disc.scale.set(f, f, f); // le disque se remplit jusqu'à l'impact
      if (h.t < h.delay) continue;
      const dx = player.pos.x - h.x, dz = player.pos.z - h.z;
      let hit = false;
      if (!player.dead && dx * dx + dz * dz < h.radius * h.radius) {
        hit = !!player.takeDamage(h.damage, h.dmgType ? { dmgType: h.dmgType } : {});
      }
      this.bus.emit('particles', { pos: new THREE.Vector3(h.x, h.mesh.position.y + 0.4, h.z), color: h.color, count: 22, speed: 5, life: 0.6, up: 3 });
      this.bus.emit('hazardBurst', { x: h.x, z: h.z, hit });
      this._free(h); this.list.splice(i, 1);
    }
  }
}
