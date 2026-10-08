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
  if (f.ring) disposeObj(f.ring.group);
  if (f.wings) { disposeObj(f.wings.group); f.wings.geo.dispose(); }
  if (f.trail) disposeObj(f.trail.pts);
  rig.cosFx = null;
}

// cos : { aura, ring, trail, wings, title } (identifiants du catalogue). L'aura d'arme est gérée dans Player.refreshGearVisuals.
export function applyCosmetics(rig, cos = {}) {
  if (!rig) return;
  const key = JSON.stringify([cos.ring || '', cos.trail || '', cos.wings || '']);
  if (rig.cosKey === key) return;
  rig.cosKey = key;
  clearAll(rig);
  const f = (rig.cosFx = {});
  try {
    const rf = fxOf(cos.ring); if (rf) { f.ring = buildRing(rf); rig.root.add(f.ring.group); }
    const wf = fxOf(cos.wings); if (wf) f.wings = buildWings(wf, rig);
    const tf = fxOf(cos.trail); if (tf) f.trail = buildTrail(tf, rig);
  } catch (e) { console.warn('[V10.1] cosmétiques indisponibles', e); }
  if (!f.ring && !f.wings && !f.trail) rig.cosFx = null;
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

export function disposeCosmetics(rig) { if (rig) { clearAll(rig); rig.cosKey = null; } }
