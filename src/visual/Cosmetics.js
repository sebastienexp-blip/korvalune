// V10.1 — Rendu des cosmétiques de la boutique (cercle au sol, traînée, ailes). L'aura d'arme passe par WeaponAura.js.
// Tout est en matériaux additifs / sprites : aucune lumière dynamique, léger pour le mobile.
import * as THREE from 'three';
import { glowTexture, safeTexture } from './Textures.js';
import { CATALOG_BY_ID } from '../data/shopCatalog.js';

let _glow;
const glowTex = () => (_glow === undefined ? (_glow = safeTexture(glowTexture, 64)) : _glow);
const _c = new THREE.Color();
const prismColor = (t, off = 0, out = _c) => out.setHSL((t * 0.3 + off) % 1, 0.9, 0.62);
const fxOf = (id) => (id && CATALOG_BY_ID[id] ? CATALOG_BY_ID[id].fx || {} : null);

function disposeObj(o) {
  if (!o) return;
  if (o.parent) o.parent.remove(o);
  o.traverse((x) => { if (x.geometry && !x.geometry.userData?.shared) x.geometry.dispose(); if (x.material) x.material.dispose(); });
}

// ---------------- Cercle au sol ----------------
function buildRing(fx) {
  const g = new THREE.Group();
  g.position.y = 0.06;
  const col = new THREE.Color(fx.color || 0xffffff);
  // fusion normale (lisible aussi sur un sol clair, où l'additif disparaît) + léger décalage de profondeur pour ne pas « clignoter » avec le sol
  const mat = () => new THREE.MeshBasicMaterial({ color: col.clone(), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const outer = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.2, 56), mat());
  const inner = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.76, 48), mat());
  // « runes » : petits blocs répartis sur l'anneau intermédiaire
  const runes = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.22), mat());
    const a = (i / 10) * Math.PI * 2;
    m.position.set(Math.cos(a) * 0.92, Math.sin(a) * 0.92, 0);
    m.rotation.z = a + Math.PI / 2;
    runes.add(m);
  }
  for (const o of [outer, inner, runes]) { o.rotation.x = -Math.PI / 2; g.add(o); }
  runes.rotation.x = -Math.PI / 2;
  return { group: g, parts: [outer, inner, runes], outer, inner, runes, fx, col };
}

// ---------------- Ailes ----------------
function wingShape(style) {
  const s = new THREE.Shape();
  if (style === 'demon') { // ailes de chauve-souris : bord avec pointes
    s.moveTo(0, 0); s.lineTo(0.5, 0.55); s.lineTo(0.95, 0.5); s.lineTo(0.8, 0.2); s.lineTo(1.05, 0.05); s.lineTo(0.75, -0.1);
    s.lineTo(0.85, -0.45); s.lineTo(0.45, -0.25); s.lineTo(0.2, -0.5); s.lineTo(0, -0.15); s.lineTo(0, 0);
  } else if (style === 'cristal') { // facettes anguleuses
    s.moveTo(0, 0.05); s.lineTo(0.35, 0.6); s.lineTo(0.7, 0.75); s.lineTo(1.0, 0.35); s.lineTo(0.85, 0.0); s.lineTo(0.95, -0.4);
    s.lineTo(0.5, -0.35); s.lineTo(0.25, -0.65); s.lineTo(0, -0.2); s.lineTo(0, 0.05);
  } else { // ange : plumes arrondies
    s.moveTo(0, 0); s.bezierCurveTo(0.25, 0.7, 0.8, 0.85, 1.15, 0.6); s.bezierCurveTo(1.0, 0.45, 1.05, 0.35, 0.95, 0.25);
    s.bezierCurveTo(1.0, 0.1, 0.9, 0.0, 0.8, -0.05); s.bezierCurveTo(0.8, -0.25, 0.55, -0.4, 0.4, -0.45); s.bezierCurveTo(0.25, -0.35, 0.1, -0.2, 0, 0);
  }
  return s;
}

function buildWings(fx, rig) {
  const root = new THREE.Group();
  const col = new THREE.Color(fx.color || 0xffffff);
  const glowCol = new THREE.Color(fx.glow || fx.color || 0xffffff);
  const geo = new THREE.ShapeGeometry(wingShape(fx.style), 10);
  const sides = [];
  // deux couches par aile (balayage différent) : l'aile garde du volume sous n'importe quel angle de caméra, jamais « de chant »
  for (const sx of [1, -1]) {
    for (const L of [{ base: 0.5, k: 1, op: 1 }, { base: 1.15, k: 0.78, op: 0.7 }]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.09, 0.4, -0.2);
      const body = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col.clone(), transparent: true, opacity: (fx.style === 'cristal' ? 0.7 : 0.92) * L.op, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      const halo = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: glowCol.clone(), transparent: true, opacity: 0.35 * L.op, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
      halo.scale.setScalar(1.08); halo.position.z = -0.01;
      for (const m of [body, halo]) { m.scale.x *= sx * L.k; m.scale.y *= L.k; pivot.add(m); }
      pivot.rotation.y = sx * L.base;
      pivot.rotation.z = sx * 0.12; // légère forme en V
      root.add(pivot);
      sides.push({ pivot, body, halo, sx, base: L.base, op: L.op });
    }
  }
  root.scale.setScalar(0.95);
  (rig.torso || rig.root).add(root);
  return { group: root, sides, fx, col, glowCol, geo };
}

// ---------------- Traînée (particules en coordonnées monde) ----------------
const TRAIL_N = 48;
function buildTrail(fx, rig) {
  const pos = new Float32Array(TRAIL_N * 3), col = new Float32Array(TRAIL_N * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const gt = glowTex();
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.5, map: gt || null, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, sizeAttenuation: true }));
  pts.frustumCulled = false;
  const life = new Float32Array(TRAIL_N).fill(0), vel = new Float32Array(TRAIL_N * 3);
  return { pts, pos, col, life, vel, head: 0, fx, acc: 0, base: new THREE.Color(fx.color || 0xffffff), attached: false };
}

function clearAll(rig) {
  const f = rig.cosFx; if (!f) return;
  if (f.pet) disposeObj(f.pet.group);
  if (f.ring) disposeObj(f.ring.group);
  if (f.wings) { disposeObj(f.wings.group); f.wings.geo.dispose(); }
  if (f.trail) disposeObj(f.trail.pts);
  rig.cosFx = null;
}

// cos : { aura, ring, trail, wings, title } (identifiants du catalogue). L'aura d'arme est gérée dans Player.refreshGearVisuals.
export function applyCosmetics(rig, cos = {}) {
  if (!rig) return;
  const key = JSON.stringify([cos.ring || '', cos.trail || '', cos.wings || '', cos.pet || '', cos.skin || '']);
  if (rig.cosKey === key) return;
  rig.cosKey = key;
  clearAll(rig);
  try { restoreSkin(rig); const sk = fxOf(cos.skin); if (sk) applySkin(rig, sk); } catch (e) { console.warn('[V10.17] skin', e); }
  const f = (rig.cosFx = {});
  try {
    const pf = fxOf(cos.pet); if (pf && pf.kind) f.pet = buildPet(pf, rig);
    const rf = fxOf(cos.ring); if (rf) { f.ring = buildRing(rf); rig.root.add(f.ring.group); }
    const wf = fxOf(cos.wings); if (wf) f.wings = buildWings(wf, rig);
    const tf = fxOf(cos.trail); if (tf) f.trail = buildTrail(tf, rig);
  } catch (e) { console.warn('[V10.1] cosmétiques indisponibles', e); }
  if (!f.ring && !f.wings && !f.trail && !f.pet) rig.cosFx = null;
}

const _v = new THREE.Vector3();
export function updateCosmetics(rig, dt, speed = 0) {
  const f = rig.cosFx; if (!f) return;
  const t = (f.t = (f.t || 0) + dt);
  if (f.ring) {
    const r = f.ring;
    r.runes.rotation.z += dt * 0.9; r.inner.rotation.z -= dt * 0.5;
    const pulse = 0.7 + 0.3 * Math.sin(t * 2.4);
    const prism = r.fx.prism;
    for (let i = 0; i < r.parts.length; i++) {
      const p = r.parts[i];
      if (p.isMesh) { if (prism) prismColor(t, i * 0.12, p.material.color); p.material.opacity = 0.62 + 0.3 * pulse; }
      else p.children.forEach((m, k) => { if (prism) prismColor(t, k * 0.1, m.material.color); m.material.opacity = 0.7 + 0.25 * Math.sin(t * 3 + k); });
    }
  }
  if (f.wings) {
    const w = f.wings, flap = Math.sin(t * (speed > 0.5 ? 7 : 2.2)) * (speed > 0.5 ? 0.28 : 0.1);
    for (const s of w.sides) {
      s.pivot.rotation.y = s.sx * (s.base + flap);
      if (w.fx.prism) { prismColor(t, 0, s.body.material.color); prismColor(t, 0.25, s.halo.material.color); }
      s.halo.material.opacity = (0.28 + 0.14 * Math.sin(t * 2.6)) * s.op;
    }
  }
  if (f.pet) updatePet(f.pet, rig, dt, t);
  if (f.trail) {
    const tr = f.trail;
    if (!tr.attached) { // posée dans la scène (coordonnées monde) dès que le personnage y est
      const sc = rig.root.parent; if (sc) { sc.add(tr.pts); tr.attached = true; }
    }
    rig.root.getWorldPosition(_v);
    tr.acc += dt;
    const rate = speed > 0.5 ? 0.028 : 0.16;
    while (tr.acc > rate) {
      tr.acc -= rate;
      const i = tr.head; tr.head = (tr.head + 1) % TRAIL_N;
      tr.pos[i * 3] = _v.x + (Math.random() - 0.5) * 0.35; tr.pos[i * 3 + 1] = _v.y + 0.12 + Math.random() * 0.5; tr.pos[i * 3 + 2] = _v.z + (Math.random() - 0.5) * 0.35;
      tr.vel[i * 3] = (Math.random() - 0.5) * 0.15; tr.vel[i * 3 + 1] = 0.25 + Math.random() * 0.4; tr.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
      tr.life[i] = 1;
    }
    const prism = tr.fx.prism;
    for (let i = 0; i < TRAIL_N; i++) {
      const l = tr.life[i] = Math.max(0, tr.life[i] - dt * 1.1);
      tr.pos[i * 3] += tr.vel[i * 3] * dt; tr.pos[i * 3 + 1] += tr.vel[i * 3 + 1] * dt; tr.pos[i * 3 + 2] += tr.vel[i * 3 + 2] * dt;
      if (prism) prismColor(t * 1.5, i / TRAIL_N, _c); else _c.copy(tr.base);
      const k = l * l;
      tr.col[i * 3] = _c.r * k; tr.col[i * 3 + 1] = _c.g * k; tr.col[i * 3 + 2] = _c.b * k; // additif : s'éteint en noir
    }
    tr.pts.geometry.attributes.position.needsUpdate = true; tr.pts.geometry.attributes.color.needsUpdate = true;
  }
}

export function disposeCosmetics(rig) { if (rig) { clearAll(rig); try { restoreSkin(rig); } catch { /* ignoré */ } rig.cosKey = null; } }


// ======================================================================================
// V10.17 — SKINS : recolorent le personnage (peau, tissu, métal), parfois translucide ou avec un accessoire de tête.
// Tout est restitué à l'identique quand le skin est retiré (couleurs d'origine mémorisées dans rig.skinSaved).
// ======================================================================================
const stdMat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...extra });

function saveMat(rig, m) {
  if (!m || !m.isMaterial) return;
  const list = (rig.skinSaved = rig.skinSaved || []);
  if (list.some((e) => e.m === m)) return;
  list.push({ m, color: m.color ? m.color.getHex() : null, base: m.userData?.__base, em: m.emissive ? m.emissive.getHex() : null, emI: m.emissiveIntensity, op: m.opacity, tr: m.transparent, dw: m.depthWrite });
}

function restoreSkin(rig) {
  if (rig.skinSaved) {
    for (const e of rig.skinSaved) {
      const m = e.m;
      if (e.color != null && m.color) m.color.setHex(e.color);
      if (e.base !== undefined) m.userData.__base = e.base;
      if (e.em != null && m.emissive) { m.emissive.setHex(e.em); m.emissiveIntensity = e.emI; }
      m.opacity = e.op; m.transparent = e.tr; m.depthWrite = e.dw; m.needsUpdate = true;
    }
    rig.skinSaved = null;
  }
  if (rig.skinHead) {
    for (const o of rig.skinHead.added) disposeObj(o);
    for (const o of rig.skinHead.hidden) o.visible = true;
    rig.skinHead = null;
  }
}

function applySkin(rig, fx) {
  const sm = rig.skinMats; if (!sm) return; // modèle 3D importé : pas de skin
  const paint = (m, hex, glow) => {
    if (!m || hex == null) return;
    saveMat(rig, m);
    m.color.setHex(hex); if (m.userData) m.userData.__base = hex;
    if (glow != null && m.emissive) { m.emissive.setHex(glow); m.emissiveIntensity = 0.65; }
  };
  if (fx.tone != null) paint(sm.skin, fx.tone, fx.glow);
  if (fx.cloth != null) { paint(sm.cloth, fx.cloth, fx.glow); paint(sm.clothDark, new THREE.Color(fx.cloth).multiplyScalar(0.7).getHex(), fx.glow); }
  if (fx.steel != null) for (const m of [sm.steel, rig.matRefs?.chest, rig.matRefs?.helm, rig.matRefs?.shoulders]) paint(m, fx.steel, fx.glow);
  if (fx.ghost) {
    rig.root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.blending === THREE.AdditiveBlending) continue;
        saveMat(rig, m); m.transparent = true; m.opacity = Math.min(m.opacity, fx.ghost); m.depthWrite = false;
      }
    });
  }
  if (fx.head && rig.head) buildHeadgear(rig, fx.head);
}

function buildHeadgear(rig, kind) {
  const head = rig.head, added = [], hidden = [];
  const add = (o) => { head.add(o); added.push(o); return o; };
  const mk = (geo, mat, x = 0, y = 0, z = 0, parent = null) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent ? parent.add(m) : add(m)); return m; };
  const gold = () => stdMat(0xffd34a, { roughness: 0.3, metalness: 0.85, emissive: 0x553300, emissiveIntensity: 0.4 });
  if (kind === 'crown') {
    const g = add(new THREE.Group()); g.position.y = 0.13;
    const m = gold();
    mk(new THREE.CylinderGeometry(0.15, 0.14, 0.06, 14, 1, true), Object.assign(m.clone(), { side: THREE.DoubleSide }), 0, 0, 0, g);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const c = mk(new THREE.ConeGeometry(0.03, 0.09, 5), m, Math.cos(a) * 0.145, 0.07, Math.sin(a) * 0.145, g); }
    mk(new THREE.SphereGeometry(0.022, 8, 6), stdMat(0xff3a5a, { emissive: 0x801020, emissiveIntensity: 0.8 }), 0, 0.03, 0.15, g);
  } else if (kind === 'halo') {
    const h = mk(new THREE.TorusGeometry(0.16, 0.014, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffe9a0, toneMapped: false, fog: false }), 0, 0.3, 0);
    h.rotation.x = Math.PI / 2;
  } else if (kind === 'horns') {
    const m = stdMat(0x1a0a0a, { roughness: 0.4 });
    for (const sx of [-1, 1]) { const c = mk(new THREE.ConeGeometry(0.035, 0.22, 7), m, sx * 0.1, 0.17, 0.0); c.rotation.z = -sx * 0.45; c.rotation.x = -0.2; }
  } else if (kind === 'catears') {
    const m = stdMat(0xe8d8b8), inner = stdMat(0xffa0b0);
    for (const sx of [-1, 1]) { const c = mk(new THREE.ConeGeometry(0.06, 0.14, 4), m, sx * 0.085, 0.17, -0.01); c.rotation.z = -sx * 0.25; mk(new THREE.ConeGeometry(0.03, 0.08, 4), inner, sx * 0.085, 0.165, 0.012); }
  } else if (kind === 'wolfears') {
    const m = stdMat(0x3a2f26);
    for (const sx of [-1, 1]) { const c = mk(new THREE.ConeGeometry(0.055, 0.17, 4), m, sx * 0.09, 0.19, -0.02); c.rotation.z = -sx * 0.2; }
  } else if (kind === 'witchhat') {
    const g = add(new THREE.Group()); g.position.y = 0.12;
    const m = stdMat(0x24102e, { roughness: 0.8 });
    mk(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 20), m, 0, 0, 0, g);
    const cone = mk(new THREE.ConeGeometry(0.15, 0.4, 14), m, 0, 0.2, 0, g); cone.rotation.z = 0.12;
    mk(new THREE.CylinderGeometry(0.152, 0.152, 0.05, 14), stdMat(0xff8a1a, { emissive: 0x552200, emissiveIntensity: 0.5 }), 0.0, 0.05, 0, g);
  } else if (kind === 'pumpkin') {
    for (const ch of head.children) { if (ch.visible) { ch.visible = false; hidden.push(ch); } }
    const g = add(new THREE.Group()); g.position.y = 0.03;
    const skinM = stdMat(0xf08a22, { roughness: 0.55, emissive: 0x7a2600, emissiveIntensity: 0.7 });
    const body = mk(new THREE.SphereGeometry(0.2, 22, 16), skinM, 0, 0, 0, g); body.scale.set(1.08, 0.9, 1.0);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI; const rib = mk(new THREE.TorusGeometry(0.2, 0.012, 5, 22), stdMat(0xc4600e), 0, 0, 0, g); rib.rotation.y = a; rib.scale.set(1.08, 0.9, 1); }
    mk(new THREE.CylinderGeometry(0.02, 0.03, 0.07, 6), stdMat(0x4a7a2a), 0, 0.19, 0, g);
    const fire = new THREE.MeshBasicMaterial({ color: 0xffc23a, toneMapped: false, fog: false, side: THREE.DoubleSide });
    const tri = (pts) => { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); return new THREE.ShapeGeometry(sh); };
    mk(tri([[-0.11, 0.07], [-0.03, 0.01], [-0.09, -0.01]]), fire, 0, 0.03, 0.2, g).position.x = 0;
    mk(tri([[0.11, 0.07], [0.03, 0.01], [0.09, -0.01]]), fire, 0, 0.03, 0.2, g);
    mk(tri([[-0.12, -0.05], [0.12, -0.05], [0.06, -0.12], [0.0, -0.08], [-0.06, -0.12]]), fire, 0, 0, 0.195, g);
    // les formes plates sont plaquées sur la face avant, à hauteur de sphère
    g.children.forEach((c) => { if (c.geometry && c.geometry.type === 'ShapeGeometry') c.position.z = 0.19; });
  }
  rig.skinHead = { added, hidden };
}

// ======================================================================================
// V10.17 — COMPAGNONS : petit modèle posé dans la scène, qui suit le joueur (visible de tous les joueurs).
// Matériaux standards, formes simples, aucune lumière dynamique : léger pour le mobile.
// ======================================================================================
function prismMats(group) {
  const arr = [];
  group.traverse((o) => { if (o.isMesh && o.userData.prism) arr.push(o.material); });
  return arr;
}

function buildPet(fx, rig) {
  const group = new THREE.Group();
  const col = fx.color ?? 0xffffff, tip = fx.tip ?? col, eyeC = fx.eye ?? 0x151015;
  const body = stdMat(col, { roughness: 0.75 });
  const tipM = stdMat(tip, { roughness: 0.7 });
  const dark = new THREE.MeshBasicMaterial({ color: eyeC, toneMapped: false });
  const glow = (c, op = 0.5) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
  const part = (geo, m, x = 0, y = 0, z = 0, parent = group, sc = null) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); if (sc) me.scale.set(...sc); me.castShadow = true; parent.add(me); return me; };
  const eyes = (parent, y, z, dx, r = 0.028) => { for (const sx of [-1, 1]) part(new THREE.SphereGeometry(r, 8, 6), dark, sx * dx, y, z, parent); };
  const wingGeo = new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.2, 0.28, 0.5, 0.18); s.quadraticCurveTo(0.38, 0.06, 0.45, -0.06); s.quadraticCurveTo(0.2, -0.02, 0, 0); return s; })());
  const makeWings = (m, y, z, size = 1) => {
    const ws = [];
    for (const sx of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(sx * 0.07, y, z); group.add(pv); const w = new THREE.Mesh(wingGeo, m); w.scale.set(sx * size, size, size); w.rotation.x = -Math.PI / 2; pv.add(w); ws.push({ pv, sx }); }
    return ws;
  };
  const wingMat = (c, op = 0.9) => new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, transparent: op < 1, opacity: op, roughness: 0.6 });
  const p = { group, fx, kind: fx.kind, legs: [], wings: [], hover: 0, bounce: 0, spin: 0, scale: 1, pos: new THREE.Vector3(), init: false, face: 0, speed: 0, tailRef: null };

  const quad = (o) => {
    const b = part(new THREE.SphereGeometry(0.16, 14, 10), body, 0, 0.2, 0, group, [0.85, 0.8, o.len || 1.3]);
    const head = new THREE.Group(); head.position.set(0, 0.3, (o.len || 1.3) * 0.15 + 0.06); group.add(head);
    part(new THREE.SphereGeometry(o.headR || 0.12, 14, 10), body, 0, 0, 0.04, head);
    if (o.snout) part(new THREE.SphereGeometry(0.06, 10, 8), tipM, 0, -0.03, 0.15 + (o.snout - 1) * 0.04, head, [0.9, 0.8, o.snout]);
    part(new THREE.SphereGeometry(0.022, 6, 5), stdMat(0x201015), 0, -0.02, 0.19 + (o.snout ? (o.snout - 1) * 0.04 + 0.04 : 0), head);
    eyes(head, 0.03, 0.135, 0.055, 0.026);
    for (const sx of [-1, 1]) {
      const e = part(new THREE.ConeGeometry(o.earW || 0.05, o.earH || 0.11, 5), body, sx * 0.07, 0.12 + (o.earH ? o.earH * 0.35 : 0), 0.0, head);
      e.rotation.z = -sx * (o.earTilt ?? 0.18);
      if (!o.long) part(new THREE.ConeGeometry((o.earW || 0.05) * 0.5, (o.earH || 0.11) * 0.6, 4), stdMat(0xffb0c0), sx * 0.07, 0.115, 0.012, head).rotation.z = -sx * (o.earTilt ?? 0.18);
    }
    if (o.horn) part(new THREE.ConeGeometry(0.018, 0.14, 6), stdMat(0xffe27a, { emissive: 0x553300, emissiveIntensity: 0.4 }), 0, 0.2, 0.06, head).rotation.x = 0.25;
    if (o.mane) { const mm = stdMat(0xff9ad8, { emissive: 0x401030, emissiveIntensity: 0.3 }); for (let i = 0; i < 4; i++) { const m = part(new THREE.SphereGeometry(0.045, 8, 6), mm, 0, 0.24 - i * 0.03, -0.1 - i * 0.045, group); m.userData.prism = !!fx.prism; } }
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const lg = new THREE.Group(); lg.position.set(x * 0.07, 0.12, z * 0.12 * (o.len || 1.3) * 0.8); group.add(lg); part(new THREE.CylinderGeometry(0.03, 0.026, 0.14, 6), body, 0, -0.06, 0, lg); part(new THREE.SphereGeometry(0.034, 6, 5), tipM, 0, -0.13, 0.01, lg); p.legs.push(lg); }
    const tl = new THREE.Group(); tl.position.set(0, 0.24, -(o.len || 1.3) * 0.16); group.add(tl);
    if (o.tail === 'puff') part(new THREE.SphereGeometry(0.05, 8, 6), tipM, 0, 0.0, -0.04, tl);
    else { const t = part(new THREE.CylinderGeometry(o.tail === 'bushy' ? 0.06 : 0.025, 0.025, 0.3, 7), body, 0, 0.08, -0.1, tl); t.rotation.x = -1.1; if (o.tail === 'bushy') part(new THREE.SphereGeometry(0.06, 8, 6), tipM, 0, 0.19, -0.2, tl); }
    p.tailRef = tl; p.headRef = head;
  };

  switch (fx.kind) {
    case 'cat': quad({ earW: 0.045, earH: 0.1, snout: 0.6, tail: 'long', len: 1.2 }); break;
    case 'fox': quad({ earW: 0.05, earH: 0.14, snout: 1.5, tail: 'bushy', len: 1.35 }); break;
    case 'wolf': quad({ earW: 0.05, earH: 0.12, snout: 1.7, tail: 'bushy', headR: 0.13, len: 1.5 }); break;
    case 'bunny': quad({ earW: 0.035, earH: 0.26, long: true, earTilt: 0.12, tail: 'puff', snout: 0.5, len: 1.0 }); break;
    case 'unicorn': quad({ earW: 0.035, earH: 0.09, snout: 1.2, tail: 'bushy', horn: true, mane: true, len: 1.6, headR: 0.12 }); p.scale = 1.1; break;
    case 'slime': {
      const m = new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.85, roughness: 0.15, emissive: col, emissiveIntensity: 0.18 });
      p.blob = part(new THREE.SphereGeometry(0.2, 16, 12), m, 0, 0.15, 0, group, [1.1, 0.85, 1.1]);
      eyes(p.blob, 0.06, 0.17, 0.07, 0.03); p.bounce = 1; break;
    }
    case 'pumpkin': {
      const sk = stdMat(col, { roughness: 0.55, emissive: 0x7a2600, emissiveIntensity: 0.6 });
      p.blob = part(new THREE.SphereGeometry(0.2, 16, 12), sk, 0, 0.18, 0, group, [1.1, 0.9, 1.05]);
      for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.011, 5, 20), stdMat(0xc4600e)); r.rotation.y = (i / 4) * Math.PI; r.scale.set(1.1, 0.9, 1); p.blob.add(r); }
      part(new THREE.CylinderGeometry(0.02, 0.03, 0.07, 6), stdMat(0x4a7a2a), 0, 0.2, 0, p.blob);
      const fire = new THREE.MeshBasicMaterial({ color: 0xffc23a, toneMapped: false, side: THREE.DoubleSide });
      const tri = (pts) => new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));
      part(tri([[-0.1, 0.05], [-0.02, 0], [-0.08, -0.02]]), fire, 0, 0.03, 0.2, p.blob); part(tri([[0.1, 0.05], [0.02, 0], [0.08, -0.02]]), fire, 0, 0.03, 0.2, p.blob);
      part(tri([[-0.1, -0.05], [0.1, -0.05], [0.05, -0.11], [0, -0.07], [-0.05, -0.11]]), fire, 0, 0, 0.19, p.blob);
      if (fx.crown) { const g = stdMat(0xffd34a, { metalness: 0.8, roughness: 0.3, emissive: 0x553300, emissiveIntensity: 0.4 }); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; part(new THREE.ConeGeometry(0.035, 0.1, 5), g, Math.cos(a) * 0.1, 0.26, Math.sin(a) * 0.1, p.blob); } }
      p.bounce = 1; break;
    }
    case 'ghost': {
      const m = new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.8, emissive: 0x6affc0, emissiveIntensity: 0.25, roughness: 0.4, side: THREE.DoubleSide });
      const b = part(new THREE.ConeGeometry(0.17, 0.4, 14, 1, true), m, 0, 0.0, 0, group); b.rotation.x = Math.PI;
      part(new THREE.SphereGeometry(0.17, 14, 10), m, 0, 0.19, 0, group);
      eyes(group, 0.21, 0.14, 0.06, 0.035); p.hover = 1.0; p.sway = 1; break;
    }
    case 'wisp': {
      part(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false }), 0, 0, 0, group);
      p.halo = part(new THREE.SphereGeometry(0.2, 12, 10), glow(col, 0.45), 0, 0, 0, group);
      part(new THREE.ConeGeometry(0.08, 0.3, 8), glow(col, 0.5), 0, -0.2, 0, group).rotation.x = Math.PI;
      p.hover = 1.2; break;
    }
    case 'owl': {
      part(new THREE.SphereGeometry(0.16, 14, 10), body, 0, 0.22, 0, group, [0.95, 1.15, 0.9]);
      part(new THREE.SphereGeometry(0.1, 10, 8), tipM, 0, 0.19, 0.08, group, [1, 1.1, 0.5]);
      const hd = part(new THREE.SphereGeometry(0.12, 12, 10), body, 0, 0.42, 0, group);
      for (const sx of [-1, 1]) { part(new THREE.SphereGeometry(0.052, 10, 8), stdMat(0xfff3c0), sx * 0.055, 0.44, 0.09, group); part(new THREE.SphereGeometry(0.026, 8, 6), dark, sx * 0.055, 0.44, 0.135, group); part(new THREE.ConeGeometry(0.03, 0.08, 4), body, sx * 0.08, 0.53, 0, group); }
      part(new THREE.ConeGeometry(0.02, 0.06, 5), stdMat(0xe8a020), 0, 0.4, 0.14, group).rotation.x = Math.PI / 2;
      p.wings = makeWings(wingMat(col), 0.28, -0.02, 0.8); p.hover = 0.9; break;
    }
    case 'bird': {
      const glowy = fx.color === 0xff8a1a;
      const bm = stdMat(col, { roughness: 0.7, emissive: glowy ? 0xff5a00 : 0x000000, emissiveIntensity: glowy ? 0.45 : 0 });
      part(new THREE.SphereGeometry(0.13, 12, 9), bm, 0, 0.2, 0, group, [0.9, 0.95, 1.25]);
      part(new THREE.SphereGeometry(0.085, 10, 8), glowy ? bm : tipM, 0, 0.32, 0.12, group);
      part(new THREE.ConeGeometry(0.028, 0.09, 5), stdMat(0xe8a020), 0, 0.31, 0.21, group).rotation.x = Math.PI / 2;
      eyes(group, 0.34, 0.18, 0.04, 0.018);
      const tl = part(new THREE.ConeGeometry(0.07, 0.24, 5), glowy ? stdMat(0xffd24a, { emissive: 0xff7a00, emissiveIntensity: 0.6 }) : tipM, 0, 0.2, -0.24, group); tl.rotation.x = -Math.PI / 2 - 0.2;
      p.wings = makeWings(wingMat(glowy ? 0xff9a2a : col), 0.26, 0, 1.0); p.hover = 1.0; break;
    }
    case 'bat': {
      part(new THREE.SphereGeometry(0.09, 10, 8), body, 0, 0.0, 0, group, [1, 1.1, 1]);
      part(new THREE.SphereGeometry(0.075, 10, 8), body, 0, 0.11, 0.05, group);
      for (const sx of [-1, 1]) { part(new THREE.ConeGeometry(0.03, 0.09, 4), body, sx * 0.045, 0.19, 0.05, group); part(new THREE.SphereGeometry(0.014, 6, 5), new THREE.MeshBasicMaterial({ color: eyeC, toneMapped: false }), sx * 0.035, 0.12, 0.11, group); }
      p.wings = makeWings(wingMat(col, 0.96), 0.03, 0, 1.2); p.hover = 1.2; p.fast = 1.6; break;
    }
    case 'dragon': {
      part(new THREE.SphereGeometry(0.15, 14, 10), body, 0, 0.22, 0, group, [0.85, 0.85, 1.35]);
      part(new THREE.SphereGeometry(0.1, 10, 8), tipM, 0, 0.18, 0.05, group, [0.7, 0.75, 1.0]);
      const hd = new THREE.Group(); hd.position.set(0, 0.34, 0.18); group.add(hd);
      part(new THREE.SphereGeometry(0.09, 12, 10), body, 0, 0, 0, hd); part(new THREE.SphereGeometry(0.06, 10, 8), body, 0, -0.025, 0.1, hd, [0.9, 0.75, 1.3]);
      eyes(hd, 0.03, 0.07, 0.05, 0.02);
      for (const sx of [-1, 1]) { const h = part(new THREE.ConeGeometry(0.018, 0.1, 5), tipM, sx * 0.05, 0.1, -0.03, hd); h.rotation.x = -0.5; }
      for (let i = 0; i < 4; i++) part(new THREE.ConeGeometry(0.02, 0.05, 4), tipM, 0, 0.36 - i * 0.03, -0.02 - i * 0.07, group);
      const tl = part(new THREE.ConeGeometry(0.06, 0.4, 7), body, 0, 0.2, -0.3, group); tl.rotation.x = -Math.PI / 2 - 0.15;
      p.wings = makeWings(wingMat(tip, 0.92), 0.3, 0, 1.0); p.hover = 0.85; p.tailRef = null; break;
    }
    case 'fairy': {
      part(new THREE.SphereGeometry(0.05, 10, 8), stdMat(0xffe6d6), 0, 0.1, 0, group);
      part(new THREE.SphereGeometry(0.06, 10, 8), stdMat(col, { emissive: col, emissiveIntensity: 0.4 }), 0, 0.0, 0, group, [0.9, 1.3, 0.9]);
      part(new THREE.SphereGeometry(0.052, 8, 6), stdMat(0xffd24a), 0, 0.13, -0.01, group, [1, 0.6, 1]);
      p.halo = part(new THREE.SphereGeometry(0.17, 10, 8), glow(tip, 0.28), 0, 0.04, 0, group);
      p.wings = makeWings(new THREE.MeshBasicMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }), 0.07, -0.02, 0.5); p.hover = 1.35; p.fast = 2.2; break;
    }
    case 'golem': {
      const st = stdMat(col, { roughness: 0.95 }), cr = new THREE.MeshBasicMaterial({ color: tip, toneMapped: false });
      part(new THREE.BoxGeometry(0.3, 0.26, 0.22), st, 0, 0.3, 0, group);
      part(new THREE.BoxGeometry(0.2, 0.17, 0.18), st, 0, 0.5, 0.01, group);
      for (const sx of [-1, 1]) { part(new THREE.BoxGeometry(0.06, 0.02, 0.02), cr, sx * 0.05, 0.52, 0.1, group); part(new THREE.BoxGeometry(0.09, 0.22, 0.09), st, sx * 0.2, 0.3, 0, group); const lg = new THREE.Group(); lg.position.set(sx * 0.08, 0.17, 0); group.add(lg); part(new THREE.BoxGeometry(0.1, 0.17, 0.12), st, 0, -0.08, 0, lg); p.legs.push(lg); }
      part(new THREE.OctahedronGeometry(0.06), cr, 0, 0.32, 0.12, group); p.scale = 0.95; break;
    }
    case 'spider': {
      part(new THREE.SphereGeometry(0.13, 12, 9), body, 0, 0.16, -0.08, group, [0.9, 0.8, 1.15]);
      part(new THREE.SphereGeometry(0.085, 10, 8), body, 0, 0.15, 0.1, group);
      for (const sx of [-1, 1]) for (const dy of [0, 0.03]) part(new THREE.SphereGeometry(0.016, 6, 5), new THREE.MeshBasicMaterial({ color: eyeC, toneMapped: false }), sx * (0.03 + dy), 0.18 + dy * 0.5, 0.17, group);
      for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { const lg = new THREE.Group(); lg.position.set(sx * 0.07, 0.16, 0.08 - i * 0.07); group.add(lg); const seg = part(new THREE.CylinderGeometry(0.009, 0.009, 0.24, 4), body, sx * 0.1, -0.02, 0, lg); seg.rotation.z = sx * 1.0; lg.userData.base = sx; p.legs.push(lg); }
      break;
    }
    default: part(new THREE.SphereGeometry(0.12, 10, 8), body, 0, 0.14, 0);
  }
  p.prism = fx.prism ? prismMats(group) : null;
  group.scale.setScalar(p.scale * 1.3); // un peu plus gros que nature : lisible sur un petit écran
  group.visible = false; // posé au premier calage dans la scène
  return p;
}

const _pv = new THREE.Vector3();
function updatePet(p, rig, dt, t) {
  const g = p.group;
  if (!g.parent) { const sc = rig.root.parent; if (!sc) return; sc.add(g); p.init = false; }
  rig.root.getWorldPosition(_pv);
  const yaw = rig.root.rotation.y || 0;
  // place voulue : à droite et un peu derrière le joueur
  const sx = Math.sin(yaw), cz = Math.cos(yaw);
  const tx = _pv.x + cz * 0.95 - sx * 0.8, tz = _pv.z - sx * 0.95 - cz * 0.8, ty = _pv.y;
  if (!p.init || Math.hypot(tx - p.pos.x, tz - p.pos.z) > 9) { p.pos.set(tx, ty, tz); p.init = true; g.visible = rig.root.visible; }
  const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
  const k = 1 - Math.exp(-dt * (d > 3 ? 7 : 3.2));
  const px = p.pos.x, pz = p.pos.z;
  p.pos.x += dx * k; p.pos.z += dz * k; p.pos.y += (ty - p.pos.y) * (1 - Math.exp(-dt * 8));
  const spd = Math.hypot(p.pos.x - px, p.pos.z - pz) / Math.max(dt, 1e-3);
  p.speed += (spd - p.speed) * Math.min(1, dt * 8);
  const moving = p.speed > 0.35;
  const want = moving ? Math.atan2(p.pos.x - px, p.pos.z - pz) : Math.atan2(_pv.x - p.pos.x, _pv.z - p.pos.z);
  let da = want - p.face; da = Math.atan2(Math.sin(da), Math.cos(da)); p.face += da * Math.min(1, dt * 6);
  g.visible = rig.root.visible;
  const fast = p.fast || 1;
  const hover = p.hover ? p.hover + Math.sin(t * 2 * fast + 1) * 0.08 : 0;
  const bob = p.bounce ? Math.abs(Math.sin(t * (moving ? 7 : 2.2))) * (moving ? 0.16 : 0.05) : (moving && !p.hover ? Math.abs(Math.sin(t * 12)) * 0.03 : 0);
  g.position.set(p.pos.x, p.pos.y + hover + bob, p.pos.z);
  g.rotation.y = p.face;
  if (p.sway) g.rotation.z = Math.sin(t * 1.6) * 0.08;
  for (let i = 0; i < p.legs.length; i++) { const l = p.legs[i]; const ph = Math.sin(t * 14 + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.2 : 0)); if (l.userData.base !== undefined) l.rotation.y = ph * (moving ? 0.35 : 0.08) * l.userData.base; else l.rotation.x = moving ? ph * 0.6 : 0; }
  for (const w of p.wings) w.pv.rotation.z = w.sx * (0.15 + Math.sin(t * 14 * fast) * 0.55);
  if (p.tailRef) p.tailRef.rotation.y = Math.sin(t * 5) * 0.35;
  if (p.headRef) p.headRef.rotation.y = Math.sin(t * 0.7) * 0.18;
  if (p.blob) { const s = 1 + Math.sin(t * (moving ? 14 : 3)) * 0.05; p.blob.scale.y = (p.kind === 'slime' ? 0.85 : 0.9) * s; }
  if (p.halo) p.halo.material.opacity = (p.kind === 'fairy' ? 0.28 : 0.45) * (0.75 + 0.25 * Math.sin(t * 5));
  if (p.prism) for (let i = 0; i < p.prism.length; i++) prismColor(t * 1.2, i * 0.15, p.prism[i].color);
}
