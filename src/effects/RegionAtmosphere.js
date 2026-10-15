// V10.72 — Ambiance par région : teinte de la brume et de la lumière, portée de visibilité, et particules d'ambiance
// (poussière de sable, spores, flocons de givre, étincelles, braises…). Les transitions sont progressives (fondu de plusieurs secondes).
import * as THREE from 'three';

// fog/light : [couleur, intensité du mélange] ; mul : facteur de portée de la brume (≤ 1 : jamais plus loin que la distance d'affichage réglée)
// motes : n particules, couleur, taille, dérive [vx, vy, vz] (m/s), tremblement, opacité max
export const ATMOS = {
  prairie: null,
  forest: { fog: [0x2f4a38, 0.35], light: [0xcfe8b8, 0.15], mul: 0.82, motes: { n: 90, col: 0xd8ffb0, size: 0.16, v: [0.05, 0.12, 0.03], jit: 0.5, op: 0.55 } },
  mount: { fog: [0x9aa8bc, 0.3], light: [0xdfe8ff, 0.12], mul: 1, motes: { n: 70, col: 0xe8eef6, size: 0.12, v: [0.6, -0.1, 0.2], jit: 0.4, op: 0.4 } },
  desert: { fog: [0xe8c27a, 0.5], light: [0xffd9a0, 0.25], mul: 0.92, motes: { n: 140, col: 0xf3d79a, size: 0.14, v: [2.2, 0.15, 0.6], jit: 0.7, op: 0.5 } },
  swamp: { fog: [0x6f7f4a, 0.55], light: [0xc8d89a, 0.15], mul: 0.6, motes: { n: 80, col: 0xb6ff9a, size: 0.2, v: [0, 0.25, 0], jit: 0.9, op: 0.7 } },
  tundra: { fog: [0xdbe9f5, 0.55], light: [0xe8f2ff, 0.2], mul: 0.85, motes: { n: 150, col: 0xffffff, size: 0.16, v: [0.8, -0.9, 0.3], jit: 0.5, op: 0.8 } },
  corrupt: { fog: [0x5a3a78, 0.5], light: [0xd0a8ff, 0.2], mul: 0.75, motes: { n: 90, col: 0xc890ff, size: 0.2, v: [0, 0.35, 0], jit: 0.8, op: 0.75 } },
  celeste: { fog: [0xfff0c8, 0.45], light: [0xfff4d8, 0.2], mul: 1, motes: { n: 90, col: 0xfff2b8, size: 0.2, v: [0.05, 0.3, 0.02], jit: 0.6, op: 0.75 } },
  abyss: { fog: [0x4a1a14, 0.6], light: [0xff9068, 0.3], mul: 0.6, motes: { n: 120, col: 0xff7a3a, size: 0.17, v: [0.2, 1.1, 0.1], jit: 0.8, op: 0.85 } },
  void: { fog: [0x1c1830, 0.65], light: [0xb8a0ff, 0.2], mul: 0.55, motes: { n: 90, col: 0xb090ff, size: 0.2, v: [0, 0.18, 0], jit: 0.9, op: 0.7 } }
};
const R = 30;   // rayon de la bulle de particules autour de la caméra

const dot = () => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};

export class RegionAtmosphere {
  constructor(scene) {
    this.scene = scene;
    this.id = 'prairie'; this.max = 160; this.factor = 1;
    this.fogCol = new THREE.Color(0xffffff); this.fogK = 0;
    this.lightCol = new THREE.Color(0xffffff); this.lightK = 0;
    this.mul = 1;
    this._t = new THREE.Color(); this._cfgTarget = null;
    // particules
    const pos = new Float32Array(this.max * 3), ph = new Float32Array(this.max);
    for (let i = 0; i < this.max; i++) { pos[i * 3] = (Math.random() * 2 - 1) * R; pos[i * 3 + 1] = Math.random() * 14; pos[i * 3 + 2] = (Math.random() * 2 - 1) * R; ph[i] = Math.random() * 6.28; }
    this.pos = pos; this.ph = ph; this.acc = new Float32Array(this.max * 3);   // acc : position monde absolue (suivi de la caméra par repliement)
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({ map: dot(), size: 0.2, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff, fog: false });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; this.points.visible = false;
    scene.add(this.points);
    this.op = 0; this.cfg = null; this.vis = 0;
  }

  setRegion(id) { this.id = ATMOS[id] === undefined ? 'prairie' : id; }

  // base = distance de brume réglée par le joueur ; renvoie la portée à appliquer
  update(dt, camera, sceneFog, nightK = 0, active = true, groundY = 0) {
    const cfg = active ? ATMOS[this.id] : null, k = Math.min(1, dt * 0.7);
    // brume et lumière : fondu progressif vers la région courante (ou retour à neutre)
    const tf = cfg ? cfg.fog[1] : 0, tl = cfg ? cfg.light[1] : 0;
    if (cfg) { this.fogCol.lerp(this._t.setHex(cfg.fog[0]), k); this.lightCol.lerp(this._t.setHex(cfg.light[0]), k); }
    this.fogK += (tf - this.fogK) * k; this.lightK += (tl - this.lightK) * k;
    this.mul += ((cfg ? cfg.mul : 1) - this.mul) * k;
    if (this.fogK > 0.003) { const dark = 0.28 + 0.72 * (1 - nightK); sceneFog.color.lerp(this._t.copy(this.fogCol).multiplyScalar(dark), this.fogK); }
    // particules : on ne garde la configuration précédente que le temps du fondu sortant
    if (cfg) this.cfg = cfg;
    const want = cfg && this.factor > 0.05 ? cfg.motes.op * (1 - 0.6 * nightK * 0) : 0;
    this.op += (want - this.op) * Math.min(1, dt * 0.9);
    const c = this.cfg;
    this.points.visible = !!c && this.op > 0.01;
    if (!this.points.visible) return;
    const m = c.motes, n = Math.min(this.max, Math.round(m.n * this.factor));
    this.mat.opacity = this.op; this.mat.color.setHex(m.col); this.mat.size = m.size;
    this.points.geometry.setDrawRange(0, n);
    const p = this.pos, t = performance.now() * 0.001, cx = camera.position.x, cz = camera.position.z;
    this.points.position.set(cx, groundY, cz);
    const dx = this.lx === undefined ? 0 : cx - this.lx, dz = this.lz === undefined ? 0 : cz - this.lz; this.lx = cx; this.lz = cz;
    for (let i = 0; i < n; i++) {
      const j = i * 3, f = this.ph[i];
      p[j] -= dx; p[j + 2] -= dz;   // les particules restent fixes dans le monde pendant que la caméra avance
      p[j] += (m.v[0] + Math.sin(t * 0.9 + f) * m.jit) * dt;
      p[j + 1] += (m.v[1] + Math.cos(t * 0.7 + f * 1.3) * m.jit * 0.3) * dt;
      p[j + 2] += (m.v[2] + Math.sin(t * 0.8 + f * 0.7) * m.jit) * dt;
      // repliement : les particules restent dans la bulle autour de la caméra
      if (p[j] > R) p[j] -= 2 * R; else if (p[j] < -R) p[j] += 2 * R;
      if (p[j + 2] > R) p[j + 2] -= 2 * R; else if (p[j + 2] < -R) p[j + 2] += 2 * R;
      if (p[j + 1] > 14) p[j + 1] = 0.2; else if (p[j + 1] < 0) p[j + 1] = 14;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
