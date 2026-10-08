import * as THREE from 'three';

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Système de particules poolé : un seul draw call, aucune allocation pendant le jeu.
export class Particles {
  constructor(scene, max = 600) {
    this.max = max;
    this.factor = 1;
    this.head = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      this.geo,
      new THREE.PointsMaterial({ size: 0.34, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
    this._c = new THREE.Color();
  }

  emit(x, y, z, { count = 10, color = 0xffffff, speed = 3, life = 0.8, gravity = 6, up = 1, spread = 1 } = {}) {
    const n = Math.max(1, Math.round(count * this.factor));
    this._c.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.max;
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread * 0.3;
      this.pos[i * 3] = x + Math.cos(a) * r;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z + Math.sin(a) * r;
      const sp = speed * (0.4 + Math.random() * 0.6), phi = Math.random() * Math.PI * 2;
      const ct = Math.random() * 2 - 1, st = Math.sqrt(1 - ct * ct);
      this.vel[i * 3] = Math.cos(phi) * st * sp * spread;
      this.vel[i * 3 + 1] = Math.abs(ct) * sp * up + (up > 0 ? 0.5 : 0);
      this.vel[i * 3 + 2] = Math.sin(phi) * st * sp * spread;
      this.base[i * 3] = this._c.r;
      this.base[i * 3 + 1] = this._c.g;
      this.base[i * 3 + 2] = this._c.b;
      this.maxLife[i] = this.life[i] = life * (0.6 + Math.random() * 0.4);
      this.grav[i] = gravity;
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] > 0) {
        this.life[i] -= dt;
        const f = Math.max(this.life[i] / this.maxLife[i], 0);
        this.vel[i * 3 + 1] -= this.grav[i] * dt;
        for (let a = 0; a < 3; a++) {
          this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
          this.col[i * 3 + a] = this.base[i * 3 + a] * f;
        }
      } else {
        this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
