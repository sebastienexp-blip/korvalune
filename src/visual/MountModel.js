// V10.10 — Modèles 3D simples (boîtes, léger pour mobile) des chevaux et griffons. Axe avant = +Z, origine au sol.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { ModelLibrary } from './ModelLibrary.js';

const mat = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };

function leg(m, hoof, x, z, len, w) {
  const pivot = new THREE.Group(); pivot.position.set(x, len, z);
  pivot.add(box(w, len, w, m, 0, -len / 2, 0));
  pivot.add(box(w * 1.15, 0.1, w * 1.15, hoof, 0, -len + 0.05, 0));
  return pivot;
}

function buildHorse(g, def, P) {
  const body = mat(def.colors.body), mane = mat(def.colors.mane), dark = mat(0x201812), leather = mat(0x6b3b1c);
  g.add(box(0.7, 0.72, 1.55, body, 0, 1.18, 0));
  const neck = box(0.3, 0.85, 0.36, body, 0, 1.78, 0.78); neck.rotation.x = 0.55; g.add(neck);
  const head = box(0.3, 0.34, 0.66, body, 0, 2.12, 1.12); head.rotation.x = 0.35; g.add(head);
  g.add(box(0.22, 0.2, 0.2, dark, 0, 1.98, 1.42)); // museau
  g.add(box(0.07, 0.18, 0.07, body, -0.1, 2.38, 0.98), box(0.07, 0.18, 0.07, body, 0.1, 2.38, 0.98));
  const mn = box(0.1, 0.7, 0.2, mane, 0, 1.95, 0.62); mn.rotation.x = 0.55; g.add(mn);
  P.tail = new THREE.Group(); P.tail.position.set(0, 1.45, -0.78); const tl = box(0.14, 0.75, 0.2, mane, 0, -0.35, -0.05); P.tail.add(tl); P.tail.rotation.x = 0.25; g.add(P.tail);
  g.add(box(0.74, 0.1, 0.5, leather, 0, 1.58, -0.05)); // selle
  g.add(box(0.5, 0.1, 0.2, leather, 0, 1.64, -0.3));
  P.legs = [leg(body, dark, -0.22, 0.6, 0.82, 0.16), leg(body, dark, 0.22, 0.6, 0.82, 0.16), leg(body, dark, -0.22, -0.6, 0.82, 0.16), leg(body, dark, 0.22, -0.6, 0.82, 0.16)];
  P.legs.forEach((l) => g.add(l));
  P.head = head; P.neck = neck; P.seat = 0.78;
}

function buildGriffon(g, def, P) {
  const body = mat(def.colors.body), feather = mat(def.colors.feather), beak = mat(def.colors.beak), dark = mat(0x2b2118), leather = mat(0x5a3418);
  g.add(box(0.75, 0.72, 1.5, body, 0, 1.15, -0.1)); // corps de lion
  g.add(box(0.62, 0.66, 0.5, feather, 0, 1.35, 0.6)); // poitrail à plumes
  const neck = box(0.34, 0.7, 0.34, feather, 0, 1.85, 0.82); neck.rotation.x = 0.35; g.add(neck);
  const head = box(0.4, 0.38, 0.5, feather, 0, 2.28, 0.98); g.add(head);
  const bk = box(0.16, 0.16, 0.42, beak, 0, 2.2, 1.34); bk.rotation.x = 0.3; g.add(bk);
  g.add(box(0.06, 0.06, 0.06, dark, -0.15, 2.36, 1.16), box(0.06, 0.06, 0.06, dark, 0.15, 2.36, 1.16));
  g.add(box(0.1, 0.3, 0.1, feather, -0.12, 2.55, 0.82), box(0.1, 0.3, 0.1, feather, 0.12, 2.55, 0.82)); // aigrettes
  P.tail = new THREE.Group(); P.tail.position.set(0, 1.25, -0.85); P.tail.add(box(0.12, 0.12, 0.9, body, 0, 0, -0.4), box(0.3, 0.3, 0.3, feather, 0, 0, -0.95)); g.add(P.tail);
  g.add(box(0.74, 0.1, 0.5, leather, 0, 1.55, 0.05));
  P.legs = [leg(beak, dark, -0.22, 0.5, 0.8, 0.14), leg(beak, dark, 0.22, 0.5, 0.8, 0.14), leg(body, dark, -0.24, -0.6, 0.8, 0.18), leg(body, dark, 0.24, -0.6, 0.8, 0.18)];
  P.legs.forEach((l) => g.add(l));
  P.wings = [];
  for (const sx of [1, -1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.35, 1.5, 0.0);
    const arm = new THREE.Group(); // l'aile s'étend sur le côté (X) ; on bat autour de l'axe Z
    for (let i = 0; i < 4; i++) { const f = box(1.9 - i * 0.18, 0.05, 0.38, i === 3 ? mat(def.colors.body) : feather, sx * (0.95 - i * 0.09), -i * 0.015, -0.05 - i * 0.3); arm.add(f); }
    pivot.add(arm); g.add(pivot); P.wings.push({ pivot, sx });
  }
  P.head = head; P.neck = neck; P.seat = 0.72;
}

// ---- V10.41 : montures en GLB (cheval, griffon) — si le fichier est présent dans ModelLibrary.gear.mounts, sinon rendu procédural ----
function createGlbMount(def, entry) {
  const group = new THREE.Group();
  const inst = SkeletonUtils.clone(entry.gltf.scene);
  group.add(inst);
  const rec = entry.meta.recolor || {};              // nom de matériau → clé de couleur dans def.colors
  inst.traverse((o) => {
    if (!(o.isMesh || o.isSkinnedMesh)) return;
    o.castShadow = true; o.frustumCulled = false;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => {
      const c = m.clone();
      const key = rec[m.name];
      if (key && def.colors && def.colors[key] != null) c.color.set(def.colors[key]).multiplyScalar(entry.meta.recolorGain || 1);
      return c;
    });
    o.material = mats.length === 1 ? mats[0] : mats;
  });
  const mixer = new THREE.AnimationMixer(inst);
  const actions = {};
  for (const c of entry.gltf.animations || []) actions[c.name.toLowerCase()] = mixer.clipAction(c);
  return { group, parts: {}, def, t: Math.random() * 6, seat: entry.meta.seat ?? 0.7, glb: { mixer, actions, cur: null, kind: def.kind } };
}

function updateGlbMount(m, dt, speed, flying) {
  const g = m.glb;
  const want = flying ? (speed > 1.5 ? 'fly' : 'glide') : speed > 4.6 ? 'run' : speed > 0.4 ? 'walk' : 'idle';
  const pick = (n) => g.actions[n] || (n === 'glide' ? g.actions.fly : null) || (n === 'run' ? g.actions.walk : null) || g.actions.idle || null;
  const act = pick(want);
  if (act && g.cur !== act) {
    act.reset().play();
    if (g.cur) g.cur.crossFadeTo(act, 0.25, false); else act.fadeIn(0.2);
    g.cur = act;
  }
  if (g.cur) {   // la cadence suit la vitesse réelle
    const k = want === 'walk' ? Math.min(1.6, Math.max(0.6, speed / 2.2)) : want === 'run' ? Math.min(1.5, Math.max(0.8, speed / 7)) : 1;
    g.cur.timeScale = k;
  }
  g.mixer.update(dt);
}

export function createMount(def) {
  const glbEntry = ModelLibrary.gear.mounts[def.kind];
  if (glbEntry) { try { return createGlbMount(def, glbEntry); } catch (e) { console.warn('[V10.41] monture GLB ignorée', e); } }
  const group = new THREE.Group();
  const P = {};
  if (def.kind === 'griffon') buildGriffon(group, def, P); else buildHorse(group, def, P);
  return { group, parts: P, def, t: Math.random() * 6, seat: P.seat };
}

// speed : vitesse au sol (m/s) ; flying : monture volante en vol
export function updateMount(m, dt, speed = 0, flying = false) {
  if (m.glb) return updateGlbMount(m, dt, speed, flying);
  const P = m.parts; m.t += dt;
  const moving = speed > 0.4, k = Math.min(1, speed / 7);
  if (P.legs) {
    P.legs.forEach((l, i) => {
      if (flying) l.rotation.x = 0.9 + Math.sin(m.t * 5 + i) * 0.05; // pattes repliées
      else { const ph = m.t * (6 + k * 6) + (i === 0 || i === 3 ? 0 : Math.PI); l.rotation.x = moving ? Math.sin(ph) * (0.45 + k * 0.35) : 0; }
    });
  }
  if (P.tail) P.tail.rotation.x = 0.25 + Math.sin(m.t * 3) * 0.12 + (moving ? 0.2 : 0);
  if (P.neck && P.head && !P.wings) { const b = moving ? Math.sin(m.t * 9) * 0.05 : Math.sin(m.t * 1.4) * 0.03; P.neck.rotation.x = 0.55 + b; P.head.rotation.x = 0.35 - b; }
  if (P.wings) {
    const amp = flying ? 0.75 : moving ? 0.25 : 0.06, rate = flying ? 8 : 4;
    for (const w of P.wings) w.pivot.rotation.z = w.sx * (0.15 + Math.sin(m.t * rate) * amp);
  }
}

export function disposeMount(m) {
  if (!m) return;
  if (m.group.parent) m.group.parent.remove(m.group);
  m.group.traverse((o) => {
    if (!o.isMesh) return;
    if (!m.glb) o.geometry.dispose();       // les géométries GLB sont partagées avec le cache
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((x) => x.dispose());
  });
  if (m.glb) m.glb.mixer.stopAllAction();
}
