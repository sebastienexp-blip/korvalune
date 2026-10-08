import * as THREE from 'three';
import { glowTexture, slashTexture, ringTexture, runeTexture, safeTexture } from './Textures.js';
import { ArrowPool, BoltPool } from './Arrows.js';

// Effets de combat et de magie V2.5 : arcs de coup, ondes de choc, flashs,
// cercles runiques, colonnes de lumière, traînées de projectiles, ombres
// "blob" pour les appareils sans ombres dynamiques. Tout est poolé (aucune
// allocation en jeu) et additif. Chaque appel public est protégé : un échec
// d'effet ne peut jamais interrompre le combat.

const CLASS_COLOR = {
  warrior: 0xcfe0ff, paladin: 0xffe8a0, mage: 0xb888ff, archer: 0xa6ff9a, assassin: 0xff5d86
};
const ELEMENT_BY_SKILL = [
  [/fire|meteor|flame|rampage|fury|wrath|burn/i, 0xff7a2a],
  [/frost|nova|ice|time/i, 0x7fd8ff],
  [/lightning|storm|chain/i, 0xcfe8ff],
  [/poison|venom/i, 0x7dff5a],
  [/void|oblivion|shadow|death|reaper|night|mark|soul/i, 0xb06cff],
  [/holy|divine|radiant|judg|heaven|celestial|sanct|light|vow|faith/i, 0xffe27a],
  [/earthquake|colossus|titan|bash/i, 0xd9b07a]
];

export function skillColor(skill, classId) {
  if (skill && typeof skill.color === 'number') return skill.color;
  const id = `${skill?.id || ''} ${skill?.name || ''}`;
  for (const [re, c] of ELEMENT_BY_SKILL) if (re.test(id)) return c;
  return CLASS_COLOR[classId] || 0xffffff;
}

function arcGeometry(inner, outer, arc, segs = 20) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, a = (t - 0.5) * arc;
    const s = Math.sin(a), c = Math.cos(a);
    pos.push(s * inner, 0, c * inner, s * outer, 0, c * outer);
    uv.push(t, 0, t, 1);
    if (i < segs) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const additive = (map, color = 0xffffff, extra = {}) => new THREE.MeshBasicMaterial({
  map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, ...extra
});

export class Fx {
  constructor(scene, quality = 'high') {
    this.scene = scene;
    this.enabled = true;
    this.scale = quality === 'verylow' ? 0.5 : quality === 'low' ? 0.7 : 1;
    this.active = [];
    this._tmp = new THREE.Vector3();

    const glow = safeTexture(glowTexture, 64);
    const slash = safeTexture(slashTexture);
    const ring = safeTexture(ringTexture);
    const rune = safeTexture(runeTexture);
    this.tex = { glow, slash, ring, rune };
    try { this.bolts = new BoltPool(scene); } catch (e) { console.warn('[V3.3] projectiles magiques indisponibles', e); this.bolts = null; }
    try { this.arrows = new ArrowPool(scene); } catch (e) { console.warn('[V3.2] flèches visibles indisponibles', e); this.arrows = null; }

    const mk = (n, make) => Array.from({ length: n }, () => { const o = make(); o.userData.busy = false; o.visible = false; scene.add(o); return o; });
    const flatQuad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const arc = arcGeometry(0.9, 1.7, 2.3);
    const arcWide = arcGeometry(0.7, 2.0, 5.2, 28);
    const beam = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5); // bande dans le plan XZ, longueur le long de +Z
    const pillar = new THREE.CylinderGeometry(0.8, 1.0, 1, 14, 1, true).translate(0, 0.5, 0);

    this.slashes = mk(6, () => new THREE.Mesh(arc, additive(slash)));
    this.wideSlashes = mk(3, () => new THREE.Mesh(arcWide, additive(slash)));
    this.rings = mk(8, () => new THREE.Mesh(flatQuad, additive(ring)));
    this.runes = mk(3, () => new THREE.Mesh(flatQuad, additive(rune)));
    this.flashes = mk(12, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
    this.pillars = mk(3, () => new THREE.Mesh(pillar, additive(glow, 0xffffff, { side: THREE.DoubleSide })));
    this.beams = mk(6, () => {
      // bande orientée vers +Z, ancrée à l'origine, face à la caméra ≈ plan vertical + horizontal croisés
      const g = new THREE.Group();
      const a = new THREE.Mesh(beam, additive(glow));
      const b = new THREE.Mesh(beam, additive(glow));
      b.rotation.z = Math.PI / 2;
      g.add(a, b);
      g.userData.mats = [a.material, b.material];
      return g;
    });

    // Ombres "blob" (si ombres dynamiques désactivées)
    this.blobCount = 40;
    const blobCanvasTex = safeTexture(() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    });
    this.blobs = new THREE.InstancedMesh(
      flatQuad,
      new THREE.MeshBasicMaterial({ map: blobCanvasTex, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      this.blobCount
    );
    this.blobs.frustumCulled = false;
    this.blobs.count = 0;
    this.blobs.renderOrder = 1;
    scene.add(this.blobs);
    this._dummy = new THREE.Object3D();
    this.blobsOn = false;
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (this.arrows) this.arrows.setEnabled(!!v);
    if (this.bolts) this.bolts.setEnabled(!!v);
    if (!v) for (const a of this.active) this._release(a);
    this.active.length = 0;
  }

  _take(pool) {
    for (const o of pool) if (!o.userData.busy) { o.userData.busy = true; o.visible = true; return o; }
    return null;
  }

  _release(a) { a.obj.userData.busy = false; a.obj.visible = false; }

  _push(obj, dur, fn) { this.active.push({ obj, t: 0, dur, fn }); }

  // Arc de lame : yaw = direction ; tilt = inclinaison (diagonale) ; big = grand arc
  slash(x, y, z, yaw, color = 0xffffff, { big = false, tilt = 0.5, size = 1, wide = false, flip = false } = {}) {
    if (!this.enabled) return;
    try {
      const o = this._take(wide ? this.wideSlashes : this.slashes);
      if (!o) return;
      o.material.color.setHex(color);
      o.position.set(x + Math.sin(yaw) * 0.5, y, z + Math.cos(yaw) * 0.5);
      const s = (big ? 1.5 : 1.15) * size;
      const dir = flip ? -1 : 1;
      this._push(o, wide ? 0.4 : 0.28, (k) => {
        const e = 1 - (1 - k) * (1 - k);
        o.rotation.set(0, yaw + (wide ? (e - 0.5) * 2.4 * dir : (e - 0.5) * 0.9 * dir), tilt * dir);
        o.scale.setScalar(s * (0.75 + e * 0.5));
        o.material.opacity = Math.pow(1 - k, 1.4);
      });
    } catch (e) { /* effet ignoré */ }
  }

  ring(x, y, z, color = 0xffffff, maxR = 4, dur = 0.5) {
    if (!this.enabled) return;
    try {
      const o = this._take(this.rings);
      if (!o) return;
      o.material.color.setHex(color);
      o.position.set(x, y + 0.08, z);
      this._push(o, dur, (k) => {
        const e = 1 - (1 - k) * (1 - k);
        o.scale.setScalar(maxR * (0.2 + e * 0.8) * 2);
        o.material.opacity = (1 - k) * 0.95;
      });
    } catch (e) { /* ignore */ }
  }

  flash(x, y, z, color = 0xffffff, size = 1.8, dur = 0.22) {
    if (!this.enabled) return;
    try {
      const o = this._take(this.flashes);
      if (!o) return;
      o.material.color.setHex(color);
      o.position.set(x, y, z);
      this._push(o, dur, (k) => {
        o.scale.setScalar(size * (0.5 + Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * 0.9));
        o.material.opacity = (1 - k) * (1 - k);
      });
    } catch (e) { /* ignore */ }
  }

  rune(x, y, z, color = 0xb888ff, radius = 3, dur = 0.9) {
    if (!this.enabled) return;
    try {
      const o = this._take(this.runes);
      if (!o) return;
      o.material.color.setHex(color);
      o.position.set(x, y + 0.06, z);
      this._push(o, dur, (k) => {
        o.scale.setScalar(radius * 2 * (0.6 + Math.min(1, k * 4) * 0.4));
        o.rotation.y = k * 3.2;
        o.material.opacity = k < 0.15 ? k / 0.15 : Math.max(0, (1 - k) / 0.85);
      });
    } catch (e) { /* ignore */ }
  }

  pillar(x, y, z, color = 0xffe27a, h = 6, r = 1.2, dur = 0.9) {
    if (!this.enabled) return;
    try {
      const o = this._take(this.pillars);
      if (!o) return;
      o.material.color.setHex(color);
      o.position.set(x, y, z);
      this._push(o, dur, (k) => {
        const g = Math.min(1, k * 5);
        o.scale.set(r * (1 - k * 0.5), h * g, r * (1 - k * 0.5));
        o.rotation.y = k * 2;
        o.material.opacity = (1 - k) * 0.7;
      });
    } catch (e) { /* ignore */ }
  }

  // Traînée entre deux points (projectile / éclair / flèche)
  beam(from, to, color = 0xffffff, width = 0.35, dur = 0.22) {
    if (!this.enabled) return;
    try {
      const o = this._take(this.beams);
      if (!o) return;
      for (const m of o.userData.mats) m.color.setHex(color);
      o.position.copy(from);
      o.lookAt(to);
      const len = from.distanceTo(to);
      this._push(o, dur, (k) => {
        o.scale.set(width * (1 - k * 0.5), width * (1 - k * 0.5), len);
        for (const m of o.userData.mats) m.opacity = (1 - k);
      });
    } catch (e) { /* ignore */ }
  }

  // Âmes qui s'élèvent à la mort d'un ennemi (petites sphères lumineuses qui dérivent vers le haut)
  soul(pos, color = 0xcfe8ff, n = 3) {
    if (!this.enabled) return;
    try {
      const cnt = Math.max(1, Math.round(n * this.scale));
      for (let i = 0; i < cnt; i++) {
        const o = this._take(this.flashes);
        if (!o) return;
        o.material.color.setHex(color);
        const ox = (Math.random() - 0.5) * 0.7, oz = (Math.random() - 0.5) * 0.7, sp = 1.1 + Math.random() * 0.9, ph = Math.random() * 6.28;
        const x0 = pos.x + ox, y0 = pos.y + 0.7 + i * 0.12, z0 = pos.z + oz;
        o.position.set(x0, y0, z0);
        this._push(o, 1.1 + Math.random() * 0.4, (k) => {
          o.position.set(x0 + Math.sin(k * 5 + ph) * 0.25, y0 + k * sp * 1.6, z0 + Math.cos(k * 4 + ph) * 0.25);
          o.scale.setScalar(0.5 * (1 - k * 0.5));
          o.material.opacity = Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.9;
        });
      }
    } catch (e) { /* ignore */ }
  }

  // Impact combiné (flash + étincelles via particules)
  impact(pos, color = 0xffffff, crit = false, particles = null) {
    if (!this.enabled) return;
    this.flash(pos.x, pos.y + 1, pos.z, crit ? 0xffd23f : color, crit ? 3.2 : 2.1, crit ? 0.3 : 0.2);
    if (crit) this.ring(pos.x, pos.y, pos.z, 0xffd23f, 2.2, 0.35);
    if (particles) {
      try { particles.emit(pos.x, pos.y + 1, pos.z, { count: crit ? 14 : 8, color, speed: 5.2, life: 0.4, gravity: 10, spread: 0.6 }); } catch (e) { /* ignore */ }
    }
  }

  levelUp(pos, particles = null) {
    this.pillar(pos.x, pos.y, pos.z, 0xffe27a, 9, 1.4, 1.4);
    this.ring(pos.x, pos.y, pos.z, 0xffe27a, 5, 0.9);
    this.rune(pos.x, pos.y, pos.z, 0xffe9a0, 2.6, 1.2);
    if (particles) particles.emit(pos.x, pos.y + 0.2, pos.z, { count: 40, color: 0xffe27a, speed: 4, life: 1.4, gravity: -1.5, up: 2, spread: 0.7 });
  }

  // Ombres blob : liste d'objets { pos, radius? } ; appelé chaque frame si ombres désactivées
  updateBlobs(list, groundFn) {
    const on = !!list && this.enabled;
    if (!on) { this.blobs.count = 0; return; }
    const d = this._dummy;
    let n = 0;
    for (const e of list) {
      if (n >= this.blobCount) break;
      const p = e.pos;
      if (!p) continue;
      const r = (e.shadowRadius || 0.8) * 1.5;
      d.position.set(p.x, groundFn(p.x, p.z) + 0.05, p.z);
      d.scale.set(r, 1, r);
      d.updateMatrix();
      this.blobs.setMatrixAt(n++, d.matrix);
    }
    this.blobs.count = n;
    this.blobs.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    if (this.arrows) this.arrows.update(dt);
    if (this.bolts) this.bolts.update(dt);
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      try { a.fn(k); } catch (e) { a.t = a.dur; }
      if (a.t >= a.dur) { this._release(a); this.active.splice(i, 1); }
    }
  }
}

// Traînée d'arme : ruban additif qui suit la pointe de l'arme pendant une frappe.
export class WeaponTrail {
  constructor(scene, n = 14) {
    this.n = n;
    this.samples = [];
    this.pos = new Float32Array(n * 2 * 3);
    this.col = new Float32Array(n * 2 * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this._c = new THREE.Color();
    this.life = 0.24;
  }

  update(dt, active, tip, base, color) {
    if (active && tip && base) this.samples.unshift({ tx: tip.x, ty: tip.y, tz: tip.z, bx: base.x, by: base.y, bz: base.z, age: 0 });
    if (this.samples.length > this.n) this.samples.length = this.n;
    for (const s of this.samples) s.age += dt;
    while (this.samples.length && this.samples[this.samples.length - 1].age > this.life) this.samples.pop();
    const len = this.samples.length;
    if (len < 2) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    this._c.set(color);
    for (let i = 0; i < this.n; i++) {
      const s = this.samples[Math.min(i, len - 1)];
      const a = i < len ? Math.max(0, 1 - s.age / this.life) * (1 - (i / this.n) * 0.5) : 0;
      const o = i * 6;
      this.pos[o] = s.tx; this.pos[o + 1] = s.ty; this.pos[o + 2] = s.tz;
      this.pos[o + 3] = s.bx; this.pos[o + 4] = s.by; this.pos[o + 5] = s.bz;
      this.col[o] = this._c.r * a; this.col[o + 1] = this._c.g * a; this.col[o + 2] = this._c.b * a;
      this.col[o + 3] = this._c.r * a * 0.15; this.col[o + 4] = this._c.g * a * 0.15; this.col[o + 5] = this._c.b * a * 0.15;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}

// Ambiance : lucioles la nuit, pollen/poussières lumineuses le jour. Un seul draw call.
export class Ambient {
  constructor(scene, count = 70) {
    this.n = count;
    this.base = new Float32Array(count * 3);
    this.ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.base[i * 3] = Math.random() * 44; this.base[i * 3 + 1] = 0.4 + Math.random() * 3.2; this.base[i * 3 + 2] = Math.random() * 44;
      this.ph[i] = Math.random() * 6.28;
    }
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const tex = safeTexture(glowTexture, 32);
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.28, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, sizeAttenuation: true }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.enabled = true;
  }

  setEnabled(v) { this.enabled = !!v; this.points.visible = !!v; }

  update(t, px, py, pz, night) {
    if (!this.enabled) return;
    const day = 1 - night;
    for (let i = 0; i < this.n; i++) {
      const o = i * 3, ph = this.ph[i];
      const wx = ((this.base[o] + Math.sin(t * 0.3 + ph) * 1.5 - px) % 44 + 66) % 44 - 22;
      const wz = ((this.base[o + 2] + Math.cos(t * 0.27 + ph) * 1.5 - pz) % 44 + 66) % 44 - 22;
      this.pos[o] = px + wx;
      this.pos[o + 1] = py + this.base[o + 1] + Math.sin(t * 0.8 + ph) * 0.35;
      this.pos[o + 2] = pz + wz;
      const blink = 0.45 + 0.55 * Math.sin(t * (1.2 + (i % 5) * 0.4) + ph);
      // nuit : lucioles vert-or ; jour : poussières claires, discrètes
      const a = night * blink + day * 0.12;
      this.col[o] = (night * 0.75 + day * 1.0) * a;
      this.col[o + 1] = (night * 1.0 + day * 0.95) * a;
      this.col[o + 2] = (night * 0.25 + day * 0.8) * a;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
