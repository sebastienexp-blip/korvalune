import * as THREE from 'three';
import { glowTexture, safeTexture } from '../visual/Textures.js';
import { NPC } from '../entities/NPC.js';
import { Enemy } from '../entities/Enemy.js';
import { mulberry32 } from '../core/math.js';
import { HUNT_SPOTS, EVENT_MONSTERS, CANDY, eventActive, shopOpen } from '../data/halloween.js';
import enemiesData from '../data/enemies.json';
import npcsData from '../data/npcs.json';

// V10.13 — Événement Halloween (partie jeu) : décor, ciel, Jack à tête de citrouille, bonbons cachés, monstres et Roi Citrouille.
// Tout est léger (instances, sprites, aucune lumière dynamique) pour rester fluide sur mobile.

export const JACK_POS = [3.4, 1.3];   // à côté du puits (centre de la ville)

const mk = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

// La ville (enceinte de 36 m de demi-côté + marge) reste un lieu sûr : aucun monstre d'événement n'y apparaît ni n'y entre.
export const inTown = (x, z, m = 38) => Math.abs(x) < m && Math.abs(z) < m;

// ---------------------------------------------------------------- tête de citrouille sculptée
// R = rayon. La tête regarde vers +Z. Retourne { group, glows } (glows : matériaux lumineux animés).
export function buildPumpkinHead(R = 0.23) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(R, 44, 30);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  const cHi = new THREE.Color(0xf08a22), cLo = new THREE.Color(0x8a3206), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), rib = Math.cos(a * 10 + Math.PI); // 10 côtes, une côte bien saillante face au joueur
    const k = 1 + 0.08 * rib;
    x *= k; z *= k; y *= 0.86;
    if (Math.abs(y) > R * 0.7) { const f = 1 - 0.18 * ((Math.abs(y) - R * 0.7) / (R * 0.3)); x *= f; z *= f; } // creux près des pôles, comme une vraie citrouille
    p.setXYZ(i, x, y, z);
    const grain = 0.9 + 0.2 * (Math.sin(x * 91 + y * 57) * Math.cos(z * 73 + y * 31) * 0.5 + 0.5);
    c.copy(cLo).lerp(cHi, 0.5 + 0.5 * rib).multiplyScalar(grain);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, emissive: 0x7a2600, emissiveIntensity: 0.6 });
  const body = mk(geo, skin, g); body.castShadow = true;

  // profondeur d'une face sculptée : on plaque les formes plates sur la courbure de la tête
  const surf = (x, y) => Math.sqrt(Math.max(0.0004, 1 - (x / R) ** 2 - (y / (R * 0.86)) ** 2)) * R;
  const carve = (pts, depth = 0.018) => {
    const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * R, y * R)));
    const eg = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
    const q = eg.attributes.position;
    for (let i = 0; i < q.count; i++) q.setZ(i, surf(q.getX(i), q.getY(i)) - 0.012 + q.getZ(i));
    eg.computeVertexNormals();
    return eg;
  };
  const fire = new THREE.MeshBasicMaterial({ color: 0xffc23a, toneMapped: false, fog: false });
  const ember = new THREE.MeshBasicMaterial({ color: 0xff6a12, toneMapped: false, fog: false });
  // yeux : deux triangles méchants, inclinés vers le nez
  mk(carve([[-0.62, 0.34], [-0.12, 0.08], [-0.5, 0.0]]), fire, g);
  mk(carve([[0.62, 0.34], [0.12, 0.08], [0.5, 0.0]]), fire, g);
  // nez : petit triangle renversé
  mk(carve([[0, -0.02], [-0.1, -0.24], [0.1, -0.24]]), ember, g);
  // bouche : large sourire aux dents irrégulières
  const N = 10, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const x = -0.78 + (1.56 * i) / N, cy = -0.5 + 0.34 * x * x * 1.4;
    const j = 0.02 * ((i * 7) % 3); // dents un peu inégales
    const edge = i === 0 || i === N;
    top.push([x, edge ? cy : cy + (i % 2 ? 0.0 + j : 0.17)]);
    bot.push([x, edge ? cy : cy - (i % 2 ? 0.17 : 0.0 + j)]);
  }
  mk(carve(top.concat(bot.reverse())), fire, g);
  // lueur intérieure (halo additif derrière la bouche et les yeux)
  const gt = safeTexture(glowTexture, 64);
  const halo = (w, h, x, y, z, op) => {
    if (!gt) return null;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: 0xff8a1e, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
    s.scale.set(w, h, 1); s.position.set(x, y, z); g.add(s); return s;
  };
  const halos = [halo(R * 2.0, R * 0.9, 0, -R * 0.42, R * 0.95, 0.75), halo(R * 0.8, R * 0.6, -R * 0.38, R * 0.2, R * 0.97, 0.8), halo(R * 0.8, R * 0.6, R * 0.38, R * 0.2, R * 0.97, 0.8)].filter(Boolean);
  // fissures sombres (front et joue)
  const dark = new THREE.MeshBasicMaterial({ color: 0x2a0c00 });
  const crack = (pts, r) => mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x * R, y * R, surf(x * R, y * R) + 0.004))), 14, r, 4), dark, g);
  crack([[-0.2, 0.7], [-0.05, 0.55], [-0.12, 0.45], [0.02, 0.36]], R * 0.016);
  crack([[0.62, -0.1], [0.72, -0.32], [0.6, -0.4]], R * 0.014);
  // tige tordue + vrille
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5b4a1c, roughness: 0.9 });
  const stem = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 0.8, 0], [0.01, 1.0, 0.0], [0.07, 1.16, -0.03], [0.17, 1.26, -0.05]].map(([x, y, z]) => new THREE.Vector3(x * R, y * R, z * R))), 12, R * 0.13, 7);
  mk(stem, stemMat, g);
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x3f7a2a, roughness: 0.8 });
  const vp = []; for (let i = 0; i <= 16; i++) { const t = i / 16; vp.push(new THREE.Vector3((-0.15 - 0.3 * Math.cos(t * 9) * t) * R, (0.82 + 0.5 * t) * R, (0.05 + 0.3 * Math.sin(t * 9) * t) * R)); }
  mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vp), 24, R * 0.03, 5), vineMat, g);
  return { group: g, halos, fire, ember, skin };
}

// ---------------------------------------------------------------- textures peintes (canvas)
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const faceTex = () => canvasTex(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#ffc23a'; g.shadowColor = '#ff7a10'; g.shadowBlur = 10;
  const tri = (a, b, c) => { g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.closePath(); g.fill(); };
  tri([22, 44], [54, 54], [26, 66]); tri([106, 44], [74, 54], [102, 66]); tri([64, 70], [58, 82], [70, 82]);
  g.beginPath(); g.moveTo(20, 90);
  for (let i = 0; i <= 8; i++) g.lineTo(20 + i * 11, 90 + (i % 2 ? 14 : 4) - Math.sin(i / 8 * Math.PI) * 6);
  for (let i = 8; i >= 0; i--) g.lineTo(20 + i * 11, 100 + (i % 2 ? 4 : 16) - Math.sin(i / 8 * Math.PI) * 6);
  g.closePath(); g.fill();
});
const ghostTex = () => canvasTex(128, 192, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(235,245,255,0.95)'); gr.addColorStop(1, 'rgba(200,225,255,0.15)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(14, h - 18);
  g.bezierCurveTo(6, 60, 20, 12, 64, 12); g.bezierCurveTo(108, 12, 122, 60, 114, h - 18);
  for (let i = 0; i < 5; i++) g.quadraticCurveTo(114 - i * 20 - 10, h - (i % 2 ? 4 : 30), 114 - (i + 1) * 20.4, h - 18);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(20,10,40,0.9)'; g.beginPath(); g.ellipse(46, 62, 9, 14, 0, 0, 7); g.ellipse(82, 62, 9, 14, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(64, 96, 10, 16, 0, 0, 7); g.fill();
});
const batTex = () => canvasTex(64, 32, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(32, 12);
  g.quadraticCurveTo(46, 0, 62, 10); g.quadraticCurveTo(52, 12, 54, 22); g.quadraticCurveTo(46, 14, 40, 22);
  g.quadraticCurveTo(36, 16, 32, 22); g.quadraticCurveTo(28, 16, 24, 22); g.quadraticCurveTo(18, 14, 10, 22);
  g.quadraticCurveTo(12, 12, 2, 10); g.quadraticCurveTo(18, 0, 32, 12); g.fill();
});

// ---------------------------------------------------------------- bonbon ramassable
function buildCandy(color, color2) {
  const g = new THREE.Group();
  const m1 = new THREE.MeshStandardMaterial({ color, roughness: 0.35, emissive: color, emissiveIntensity: 0.55 });
  const m2 = new THREE.MeshStandardMaterial({ color: color2, roughness: 0.4, emissive: color2, emissiveIntensity: 0.45 });
  const body = mk(new THREE.SphereGeometry(0.16, 14, 10), m1, g); body.scale.set(1.5, 0.95, 0.95);
  for (const s of [-1, 1]) { const w = mk(new THREE.ConeGeometry(0.16, 0.2, 10), m2, g, s * 0.34, 0, 0); w.rotation.z = -s * Math.PI / 2; }
  const stripe = mk(new THREE.TorusGeometry(0.15, 0.025, 6, 16), m2, g); stripe.rotation.y = Math.PI / 2; stripe.scale.set(1, 1, 1.0);
  g.scale.setScalar(1.15);
  return g;
}
const CANDY_COLORS = [[0xff4f9a, 0xffe14a], [0x4fd6ff, 0xff7a2e], [0x8dff5a, 0xb04bff], [0xffa62e, 0xffffff], [0xb04bff, 0xff4f9a]];

// ================================================================ monde de l'événement
export class Halloween {
  constructor(game) {
    this.g = game;
    this.state = null;          // dernier état envoyé par le serveur (bonbons, défis…)
    this.t = 0;
    this.enemies = new Set();
    this.hordeT = 90;           // première horde 1 min 30 après la connexion
    this.kingT = 180;           // premier Roi Citrouille après 3 min
    this.king = null;
    this.spawnT = 4;
    this._eid = 880000;
    this.on = false;
    const gt = safeTexture(glowTexture, 64);
    this.glowTex = gt;
    this.group = new THREE.Group();
    this.group.visible = false;
    game.scene.add(this.group);
    try { this._buildDecor(); } catch (e) { console.warn('[V10.13] décor d’Halloween ignoré', e); }
    try { this._buildJack(); } catch (e) { console.warn('[V10.13] Jack ignoré', e); }
    this._candies = new Map();
    this.setOn(eventActive() || shopOpen());
  }

  // ---- décor ----
  _buildDecor() {
    const g = this.g, world = g.world, rnd = mulberry32(1031);
    // citrouilles lanternes : un seul InstancedMesh pour les corps, un pour les faces, un pour les tiges
    const spots = [];
    const tryAdd = (x, z, s = 1) => { if (world.isWalkable(x, z, 0.55) && spots.length < 96) spots.push({ x, z, s, yaw: Math.atan2(-x, -z) + (rnd() - 0.5) * 1.2 }); };
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.4; tryAdd(Math.cos(a) * 4.6, Math.sin(a) * 4.6, 0.9 + rnd() * 0.4); }   // autour du puits
    for (let z = -32; z <= 32; z += 5) { tryAdd(-5.6, z + rnd() * 2, 0.8 + rnd() * 0.5); tryAdd(5.6, z + rnd() * 2, 0.8 + rnd() * 0.5); }  // le long de la grand-rue
    for (let tries = 0; tries < 260 && spots.length < 90; tries++) tryAdd((rnd() - 0.5) * 66, (rnd() - 0.5) * 66, 0.7 + rnd() * 0.7);
    const N = spots.length;
    const bodyGeo = new THREE.SphereGeometry(0.3, 14, 10); { const q = bodyGeo.attributes.position; for (let i = 0; i < q.count; i++) { const a = Math.atan2(q.getZ(i), q.getX(i)), k = 1 + 0.07 * Math.cos(a * 8); q.setXYZ(i, q.getX(i) * k, q.getY(i) * 0.82, q.getZ(i) * k); } bodyGeo.computeVertexNormals(); }
    const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x5a1c00, emissiveIntensity: 0.55 }), N);
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.05, 0.14, 5), new THREE.MeshStandardMaterial({ color: 0x4f6a22, roughness: 0.9 }), N);
    const ft = faceTex();
    const faces = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: ft, transparent: true, alphaTest: 0.4, toneMapped: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), N);
    const d = new THREE.Object3D(), col = new THREE.Color();
    const glowPos = new Float32Array(N * 3);
    spots.forEach((s, i) => {
      const y = world.heightAt(s.x, s.z), r = 0.3 * s.s;
      d.position.set(s.x, y + r * 0.82, s.z); d.rotation.set(0, s.yaw, 0); d.scale.setScalar(s.s); d.updateMatrix();
      bodies.setMatrixAt(i, d.matrix);
      col.setHSL(0.07 + rnd() * 0.03, 0.9, 0.46 + rnd() * 0.1); bodies.setColorAt(i, col);
      d.position.set(s.x, y + r * 1.65, s.z); d.rotation.set(0.1, rnd() * 6, 0.12); d.updateMatrix(); stems.setMatrixAt(i, d.matrix);
      d.position.set(s.x + Math.sin(s.yaw) * r * 0.97, y + r * 0.86, s.z + Math.cos(s.yaw) * r * 0.97); d.rotation.set(0, s.yaw, 0); d.updateMatrix(); faces.setMatrixAt(i, d.matrix);
      glowPos.set([s.x, y + r * 0.9, s.z], i * 3);
    });
    for (const im of [bodies, stems, faces]) { im.instanceMatrix.needsUpdate = true; im.castShadow = false; im.frustumCulled = false; this.group.add(im); }
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    if (this.glowTex) {
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
      this.pumpGlow = new THREE.Points(pg, new THREE.PointsMaterial({ map: this.glowTex, color: 0xff8a2a, size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
      this.pumpGlow.frustumCulled = false; this.group.add(this.pumpGlow);
    }
    // fantômes flottants (feuilles translucides)
    const gtex = ghostTex();
    this.ghosts = [];
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex, transparent: true, opacity: 0.55, depthWrite: false, fog: true, toneMapped: false }));
      sp.scale.set(1.5, 2.25, 1);
      const a = rnd() * 6.28, r = 6 + rnd() * 26;
      sp.userData = { a, r, sp: 0.08 + rnd() * 0.1, h: 2.4 + rnd() * 1.6, ph: rnd() * 6 };
      this.group.add(sp); this.ghosts.push(sp);
    }
    // chauves-souris : points sombres tournant haut dans le ciel
    const bt = batTex(), B = 22, bp = new Float32Array(B * 3);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    this.bats = { pos: bp, geo: bg, data: Array.from({ length: B }, () => ({ a: rnd() * 6.28, r: 10 + rnd() * 40, sp: (0.3 + rnd() * 0.5) * (rnd() < 0.5 ? -1 : 1), h: 10 + rnd() * 12, ph: rnd() * 6 })) };
    this.batPts = new THREE.Points(bg, new THREE.PointsMaterial({ map: bt, color: 0x0d0714, size: 1.5, sizeAttenuation: true, transparent: true, alphaTest: 0.3, depthWrite: false, fog: false }));
    this.batPts.frustumCulled = false; this.group.add(this.batPts);
  }

  // ---- Jack ----
  _buildJack() {
    const g = this.g, def = npcsData.jack;
    const y = g.world.heightAt(JACK_POS[0], JACK_POS[1]);
    const yaw = Math.atan2(-JACK_POS[0], -JACK_POS[1]);   // regarde vers le puits
    this.jack = new NPC(g.scene, def, new THREE.Vector3(JACK_POS[0], y, JACK_POS[1]), yaw);
    this.jack.id = 'jack';
    const head = this.jack.rig.head;
    for (const ch of head.children) ch.visible = false;   // la vraie tête disparaît
    const ph = buildPumpkinHead(0.3);
    ph.group.position.y = 0.07;
    head.add(ph.group);
    this.pumpkin = ph;
    this.jack.label.position.y += 0.35;
    this.jackLight = 0;
    g.npcs.push(this.jack);
    this.jack.rig.root.visible = false;
  }

  // l'événement (ou sa boutique) est-il en cours ? Active/désactive tout le décor.
  setOn(on) {
    this.on = !!on;
    this.group.visible = this.on;
    if (this.jack) {
      this.jack.rig.root.visible = this.on;
      const i = this.g.npcs.indexOf(this.jack);
      if (this.on && i < 0) this.g.npcs.push(this.jack);
      if (!this.on && i >= 0) this.g.npcs.splice(i, 1);
    }
    if (this.g.dayNight) this.g.dayNight.mood = eventActive() && this.on ? 1 : 0;
    if (!this.on) this._clearCandies();
  }

  reset() { this.state = null; this._clearCandies(); this.setOn(eventActive() || shopOpen()); }

  onEvent(st) {
    this.state = st;
    this.setOn(st.active || st.shopOpen);
    this._syncCandies();
  }

  // ---- bonbons cachés ----
  _syncCandies() {
    const st = this.state, want = st && st.active;
    if (!want) { this._clearCandies(); return; }
    HUNT_SPOTS.forEach((h, i) => {
      const got = st.hunt.includes(h.id), cur = this._candies.get(h.id);
      if (got && cur) { this.group.remove(cur.obj); this._candies.delete(h.id); }
      if (!got && !cur) {
        const [c1, c2] = CANDY_COLORS[i % CANDY_COLORS.length];
        const obj = buildCandy(c1, c2);
        const y = this.g.world.heightAt(h.x, h.z) + 0.9;
        obj.position.set(h.x, y, h.z);
        if (this.glowTex) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: c1, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })); s.scale.set(1.6, 1.6, 1); obj.add(s); }
        this.group.add(obj);
        this._candies.set(h.id, { obj, y, ph: i, h });
      }
    });
  }
  _clearCandies() { for (const c of this._candies.values()) this.group.remove(c.obj); this._candies.clear(); }

  // ---- monstres ----
  _fx(pos, big = false) {
    this.g.particles?.emit(pos.x, pos.y + 0.8, pos.z, { count: big ? 40 : 18, color: 0xff7a1a, speed: big ? 5 : 3, life: 0.8, up: 2, spread: 1.2 });
    this.g.particles?.emit(pos.x, pos.y + 0.6, pos.z, { count: big ? 24 : 10, color: 0x8a52ff, speed: 2.5, life: 0.9, up: 1.5, spread: 1.2 });
  }
  _spawn(id, near, minR, maxR, levelAdd = 0) {
    const g = this.g, w = g.world, def = enemiesData[id]; if (!def) return null;
    for (let t = 0; t < 14; t++) {
      const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR);
      const x = near.x + Math.cos(a) * r, z = near.z + Math.sin(a) * r;
      if (!w.isWalkable(x, z, 0.6) || inTown(x, z, 42)) continue;
      const pos = new THREE.Vector3(x, w.heightAt(x, z), z);
      const level = Math.max(1, g.player.level + levelAdd + Math.round((Math.random() - 0.5) * 2));
      const e = new Enemy(g.scene, w, def, level, pos, g.bus, this._eid++);
      e.noRespawn = true; e.hwSpawn = true; e.state = 1; // 1 = CHASE : ils fondent directement sur le joueur
      if (def.ghost) e.rig.root.traverse((o) => { if (o.material && !Array.isArray(o.material)) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; o.material.depthWrite = false; } });
      if (def.boss) {
        e.maxHp *= 3; e.hp = e.maxHp;
        const h = e.rig.head; if (h) { for (const ch of h.children) ch.visible = false; const ph = buildPumpkinHead(0.26); h.add(ph.group); }
        e.setTitle(`👑 ${def.name} · Nv.${e.level}`, '#ff9a3c');
      } else e.setTitle(`🎃 ${def.name} · Nv.${e.level}`, '#ffb36b');
      g.enemies.push(e); this.enemies.add(e);
      this._fx(pos, !!def.boss);
      return e;
    }
    return null;
  }
  _despawn(e) {
    const g = this.g, i = g.enemies.indexOf(e);
    if (i >= 0) g.enemies.splice(i, 1);
    if (g.player.target === e) g.player.target = null;
    e.dispose(g.scene);
    this.enemies.delete(e);
    if (this.king === e) this.king = null;
  }

  update(dt, camQuat) {
    this.t += dt;
    const g = this.g, t = this.t;
    if (this.pumpkin) { // braise qui palpite
      const k = 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1);
      for (const h of this.pumpkin.halos) h.material.opacity = 0.55 + 0.35 * k;
      this.pumpkin.skin.emissiveIntensity = 0.45 + 0.3 * k;
      this._ember = (this._ember || 0) + dt;
      if (this.on && this._ember > 0.25 && g.player.pos.distanceTo(this.jack.pos) < 30) {
        this._ember = 0;
        g.particles?.emit(this.jack.pos.x, this.jack.pos.y + 2.1, this.jack.pos.z, { count: 2, color: 0xff8a2a, speed: 0.7, life: 1.1, up: 1.6, spread: 0.4 });
      }
    }
    if (!this.on) return;
    if (this.pumpGlow) this.pumpGlow.material.opacity = 0.42 + 0.16 * Math.sin(t * 6.1) * Math.sin(t * 1.7);
    for (const s of this.ghosts || []) {
      const u = s.userData; u.a += u.sp * dt;
      s.position.set(Math.cos(u.a) * u.r, g.world.heightAt(Math.cos(u.a) * u.r, Math.sin(u.a) * u.r) + u.h + Math.sin(t * 0.9 + u.ph) * 0.45, Math.sin(u.a) * u.r);
      s.material.opacity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.7 + u.ph));
    }
    if (this.bats) {
      const b = this.bats;
      b.data.forEach((o, i) => { o.a += o.sp * dt; b.pos[i * 3] = Math.cos(o.a) * o.r; b.pos[i * 3 + 1] = o.h + Math.sin(t * 3 + o.ph) * 1.2; b.pos[i * 3 + 2] = Math.sin(o.a) * o.r; });
      b.geo.attributes.position.needsUpdate = true;
    }
    // bonbons : rotation, flottement, ramassage automatique
    const pp = g.player.pos;
    for (const c of this._candies.values()) {
      c.obj.rotation.y += dt * 2.2;
      c.obj.position.y = c.y + Math.sin(t * 2 + c.ph) * 0.12;
      if (!c.taken && !g.player.dead && Math.hypot(pp.x - c.h.x, pp.z - c.h.z) < 1.8) {
        c.taken = true; c.obj.visible = false;
        g.net.eventCollect(c.h.id);
        g.audio.play('coin');
        g.particles?.emit(c.h.x, c.obj.position.y, c.h.z, { count: 14, color: 0xffd45a, speed: 3, life: 0.6, up: 2 });
      }
    }
    // monstres : seulement connecté, hors spire, joueur vivant
    const allowed = this.state?.active && g.net.loggedIn && !g.rift?.active && !g.player.dead;
    for (const e of [...this.enemies]) {
      const far = e.pos.distanceTo(pp) > 80;
      if ((e.state === 5 && e.deadT > 6) || far || !allowed && e.alive) this._despawn(e);
    }
    if (!allowed) return;
    if (inTown(pp.x, pp.z)) { // le joueur est en ville : les monstres d'événement disparaissent dans la fumée, rien ne se déclenche
      for (const e of [...this.enemies]) { this._fx(e.pos); this._despawn(e); }
      return;
    }
    const maxN = g.settings?.quality === 'verylow' || g.settings?.quality === 'low' ? 3 : 5;
    this.spawnT -= dt; this.hordeT -= dt; this.kingT -= dt;
    const alive = [...this.enemies].filter((e) => e.alive && !e.def.boss).length;
    if (this.spawnT <= 0) {
      this.spawnT = 6 + Math.random() * 4;
      if (alive < maxN && Math.hypot(pp.x, pp.z) < 90) {
        const kinds = ['hw_skeleton', 'hw_skeleton', 'hw_pumpkin', 'hw_ghost', 'hw_werewolf', 'hw_witch'];
        this._spawn(kinds[Math.floor(Math.random() * kinds.length)], pp, 16, 28);
      }
    }
    if (this.hordeT <= 0 && Math.hypot(pp.x, pp.z) < 90) {
      this.hordeT = 360;
      g.hud.notify('🎃 Une horde de morts-vivants sort de terre autour de toi ! (la ville reste à l’abri)', 'quest');
      g.audio.play('quest');
      const kinds = ['hw_skeleton', 'hw_skeleton', 'hw_pumpkin', 'hw_pumpkin', 'hw_ghost', 'hw_werewolf', 'hw_witch'];
      for (let i = 0; i < 7; i++) this._spawn(kinds[i], pp, 14, 24);
    }
    if (this.kingT <= 0 && !this.king && Math.hypot(pp.x, pp.z) < 90) {
      this.kingT = 720;
      this.king = this._spawn('hw_pumpkin_king', pp, 22, 32, 2);
      if (this.king) { g.hud.notify('👑 Le Roi Citrouille est apparu ! Il laisse 30 bonbons à qui le vainc.', 'quest'); g.audio.play('quest'); }
    }
  }
}
