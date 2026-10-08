import * as THREE from 'three';
import { glowTexture, safeTexture } from './Textures.js';

// Flèches en vol (V3.2) : projectiles visibles, tirés depuis l'arc, avec trajectoire
// balistique, traînée lumineuse et plantage à l'arrivée. Tout est poolé : aucune
// allocation en jeu. `shoot()` renvoie la durée de vol afin que les dégâts puissent
// être appliqués exactement à l'arrivée de la flèche (voir CombatSystem).
const POOL = 28;

const shaftGeo = new THREE.CylinderGeometry(0.014, 0.014, 1.15, 5).rotateX(Math.PI / 2).translate(0, 0, 0.1);
const headGeo = new THREE.ConeGeometry(0.04, 0.17, 4).rotateX(Math.PI / 2).translate(0, 0, 0.77);
const vaneGeo = new THREE.BoxGeometry(0.005, 0.07, 0.24).translate(0, 0.04, -0.4);
const streakGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5); // le long de -Z, ancré à l'origine

export class ArrowPool {
  constructor(scene) {
    this.scene = scene;
    this.enabled = true;
    this.live = [];
    const glow = safeTexture(glowTexture, 64);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xd8b078, roughness: 0.6, emissive: 0x2a1a08, emissiveIntensity: 0.4 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.25, metalness: 0.9, emissive: 0x334455, emissiveIntensity: 0.4 });
    const vaneMat = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x333333, emissiveIntensity: 0.4 });
    const cockMat = new THREE.MeshStandardMaterial({ color: 0xc03030, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x330a0a, emissiveIntensity: 0.4 });
    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(shaftGeo, shaftMat), new THREE.Mesh(headGeo, headMat));
      for (let k = 0; k < 3; k++) {
        const v = new THREE.Mesh(vaneGeo, k === 0 ? cockMat : vaneMat);
        v.rotation.z = (k / 3) * Math.PI * 2;
        g.add(v);
      }
      const mk = () => new THREE.MeshBasicMaterial({ map: glow, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      const m1 = mk(), m2 = mk();
      const s1 = new THREE.Mesh(streakGeo, m1), s2 = new THREE.Mesh(streakGeo, m2);
      s2.rotation.z = Math.PI / 2;
      g.add(s1, s2);
      let halo = null;
      if (glow) {
        halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        halo.position.z = 0.8;
        g.add(halo);
      }
      g.visible = false;
      g.traverse((o) => { o.frustumCulled = false; });
      scene.add(g);
      this.pool.push({ g, streaks: [s1, s2], mats: [m1, m2], halo, busy: false });
    }
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._p = new THREE.Vector3();
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (!v) { for (const a of this.live) { a.slot.busy = false; a.slot.g.visible = false; } this.live.length = 0; }
  }

  // Lance une flèche. opts: { dur, delay, arc (hauteur relative), color, big, linger, onHit, onLaunch }
  shoot(from, to, opts = {}) {
    if (!this.enabled) return 0;
    const dist = from.distanceTo(to);
    const dur = Math.max(0.06, opts.dur ?? Math.min(0.55, dist / 46));
    let slot = null;
    for (const s of this.pool) if (!s.busy) { slot = s; break; }
    if (!slot) return dur; // pool saturé : pas d'image, mais la durée reste valable pour les dégâts
    slot.busy = true;
    const col = opts.color ?? 0xeaffd8;
    for (const m of slot.mats) m.color.setHex(col);
    if (slot.halo) slot.halo.material.color.setHex(col);
    const big = !!opts.big;
    slot.g.scale.setScalar(big ? 1.35 : 1);
    const a = {
      slot, from: from.clone(), to: to.clone(), t: -(opts.delay || 0), dur, big,
      arc: opts.arc ?? Math.min(2.2, dist * 0.035), linger: opts.linger ?? 0.35, onHit: opts.onHit || null, onLaunch: opts.onLaunch || null,
      state: 0, streak: opts.streak ?? (big ? 3.2 : 2.2)
    };
    slot.g.visible = false;
    this.live.push(a);
    return dur;
  }

  _pos(a, u, out) {
    out.lerpVectors(a.from, a.to, u);
    out.y += a.arc * 4 * u * (1 - u);
    return out;
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const a = this.live[i], g = a.slot.g;
      a.t += dt;
      if (a.t < 0) continue; // départ différé (salves)
      if (a.state === 0) {
        a.state = 1;
        if (a.onLaunch) { try { a.onLaunch(); } catch (e) { /* ignoré */ } a.onLaunch = null; }
        g.visible = true;
      }
      if (a.state === 1) {
        const u = Math.min(1, a.t / a.dur);
        this._pos(a, u, this._p);
        g.position.copy(this._p);
        this._pos(a, Math.min(1, u + 0.03), this._b);
        if (u >= 0.97) this._pos(a, u - 0.03, this._a), this._b.copy(this._p).sub(this._a).add(this._p);
        g.lookAt(this._b);
        const k = Math.min(1, a.t / 0.08); // la traînée s'étire au départ
        for (const s of a.slot.streaks) s.scale.set(big(a) * 0.55, 1, a.streak * k);
        for (const m of a.slot.mats) m.opacity = 0.75;
        if (a.slot.halo) { a.slot.halo.scale.setScalar(big(a) * 0.55); a.slot.halo.material.opacity = 0.8; }
        if (u >= 1) {
          a.state = 2; a.t = 0;
          if (a.onHit) { try { a.onHit(this._p); } catch (e) { /* ignoré */ } a.onHit = null; }
        }
      } else if (a.state === 2) {
        // plantée : la traînée s'éteint, la flèche reste un instant puis disparaît
        const k = Math.min(1, a.t / Math.max(0.05, a.linger));
        for (const m of a.slot.mats) m.opacity = 0.75 * (1 - Math.min(1, a.t / 0.12));
        if (a.slot.halo) a.slot.halo.material.opacity = 0.8 * (1 - Math.min(1, a.t / 0.15));
        if (k >= 1) { g.visible = false; a.slot.busy = false; this.live.splice(i, 1); }
      }
    }
  }
}
const big = (a) => (a.big ? 1.35 : 1);

// Projectiles magiques (V3.3) : orbe lumineuse en "comète" (noyau blanc + halo coloré + 3 images
// fantômes + traînée), même contrat que ArrowPool.shoot() (renvoie la durée de vol).
const BOLTS = 22, GHOSTS = 3;
export class BoltPool {
  constructor(scene) {
    this.enabled = true;
    this.live = [];
    const glow = safeTexture(glowTexture, 64);
    const mkSprite = (color, op) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      return s;
    };
    this.pool = [];
    for (let i = 0; i < BOLTS; i++) {
      const g = new THREE.Group();
      const outer = mkSprite(0xffffff, 0.8), core = mkSprite(0xffffff, 1);
      const ghosts = [];
      for (let k = 0; k < GHOSTS; k++) ghosts.push(mkSprite(0xffffff, 0.5));
      const m1 = new THREE.MeshBasicMaterial({ map: glow, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      const m2 = m1.clone();
      const s1 = new THREE.Mesh(streakGeo, m1), s2 = new THREE.Mesh(streakGeo, m2);
      s2.rotation.z = Math.PI / 2;
      g.add(s1, s2, outer, core, ...ghosts);
      g.visible = false;
      g.traverse((o) => { o.frustumCulled = false; });
      scene.add(g);
      this.pool.push({ g, outer, core, ghosts, streaks: [s1, s2], mats: [m1, m2], busy: false });
    }
    this._p = new THREE.Vector3(); this._q = new THREE.Vector3();
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (!v) { for (const a of this.live) { a.slot.busy = false; a.slot.g.visible = false; } this.live.length = 0; }
  }

  // opts: { dur, delay, color, core (couleur du noyau), size, arc, linger, speed }
  shoot(from, to, opts = {}) {
    if (!this.enabled) return 0;
    const dist = from.distanceTo(to);
    const dur = Math.max(0.08, opts.dur ?? Math.min(0.8, dist / (opts.speed || 34)));
    let slot = null;
    for (const s of this.pool) if (!s.busy) { slot = s; break; }
    if (!slot) return dur;
    slot.busy = true;
    const col = opts.color ?? 0xffa14a;
    slot.outer.material.color.setHex(col);
    slot.core.material.color.setHex(opts.core ?? 0xffffff);
    for (const gh of slot.ghosts) gh.material.color.setHex(col);
    for (const m of slot.mats) m.color.setHex(col);
    this.live.push({ slot, from: from.clone(), to: to.clone(), t: -(opts.delay || 0), dur, size: opts.size ?? 1, arc: opts.arc ?? Math.min(1.6, dist * 0.02), linger: opts.linger ?? 0.12, state: 0, trail: opts.trail ?? 3 });
    slot.g.visible = false;
    return dur;
  }

  _pos(a, u, out) {
    out.lerpVectors(a.from, a.to, u);
    out.y += a.arc * 4 * u * (1 - u);
    return out;
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const a = this.live[i], s = a.slot, g = s.g;
      a.t += dt;
      if (a.t < 0) continue;
      if (a.state === 0) { a.state = 1; g.visible = true; }
      if (a.state === 1) {
        const u = Math.min(1, a.t / a.dur);
        this._pos(a, u, this._p);
        g.position.copy(this._p);
        const pulse = 1 + Math.sin(a.t * 40) * 0.12;
        s.outer.scale.setScalar(a.size * 1.5 * pulse); s.core.scale.setScalar(a.size * 0.6);
        s.outer.material.opacity = 0.8; s.core.material.opacity = 1;
        // fantômes : positions antérieures sur la trajectoire (relatives au groupe)
        for (let k = 0; k < GHOSTS; k++) {
          const uu = Math.max(0, u - (k + 1) * 0.035 * (3 / Math.max(1, a.dur * 4)));
          this._pos(a, uu, this._q);
          const gh = s.ghosts[k];
          gh.position.copy(this._q).sub(this._p);
          gh.scale.setScalar(a.size * (1.15 - k * 0.3));
          gh.material.opacity = 0.5 - k * 0.14;
        }
        // traînée : segment orienté le long de la trajectoire
        this._pos(a, Math.min(1, u + 0.03), this._q);
        g.lookAt(this._q);
        for (const st of s.streaks) st.scale.set(a.size * 0.5, 1, a.trail * a.size * Math.min(1, a.t / 0.06));
        for (const m of s.mats) m.opacity = 0.55;
        if (u >= 1) { a.state = 2; a.t = 0; }
      } else {
        const k = Math.min(1, a.t / Math.max(0.05, a.linger));
        for (const gh of s.ghosts) gh.material.opacity = 0;
        s.outer.material.opacity = 0.8 * (1 - k); s.core.material.opacity = 1 - k;
        s.outer.scale.setScalar(a.size * (1.5 + k * 2.2));
        for (const m of s.mats) m.opacity = 0.55 * (1 - k);
        if (k >= 1) { g.visible = false; s.busy = false; this.live.splice(i, 1); }
      }
    }
  }
}
