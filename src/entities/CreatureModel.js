import * as THREE from 'three';
import { clamp } from '../core/math.js';
import { glowTexture, safeTexture } from '../visual/Textures.js';
import { createCreatureLegacy } from './CreatureLegacy.js';
import { tryCreateGlbRig, animateGlbRig } from '../visual/ModelLibrary.js';

let _glowTex;
const glowTex = () => (_glowTex === undefined ? (_glowTex = safeTexture(glowTexture, 64)) : _glowTex);

const hsh = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return v - Math.floor(v); };

// Colore une géométrie : dos (fur) → ventre (belly) selon la normale, avec
// un bruit de pelage par sommet — donne un aspect fourrure sans texture.
function paintFur(geo, fur, belly, { dark = 0.0 } = {}) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal;
  const cf = new THREE.Color(fur), cb = new THREE.Color(belly), c = new THREE.Color();
  const arr = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = clamp((-n.getY(i) - 0.1) / 0.7, 0, 1);
    c.copy(cf).lerp(cb, t);
    const j = (hsh(Math.round(p.getX(i) * 40), Math.round(p.getY(i) * 40), Math.round(p.getZ(i) * 40)) - 0.5) * 0.16;
    c.multiplyScalar(1 + j - dark);
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// Quadrupède procédural (loup, sanglier…). Regarde vers +Z.
export function createCreature(opts = {}) {
  if (opts.role) {
    try { const glb = tryCreateGlbRig('creature', opts); if (glb) return glb; } catch (e) { console.warn('[V3] modèle GLB ignoré (créature)', e); }
  }
  try { return createCreatureV25(opts); } catch (e) {
    console.warn('[V2.5] modèle de créature classique utilisé', e);
    return createCreatureLegacy(opts);
  }
}

function createCreatureV25(opts = {}) {
  const o = { fur: 0x6b6b72, belly: 0x9a9aa2, eye: 0xffc040, scale: 1, bodyLen: 1, snout: 0.3, tusks: false, ...opts };
  const fur = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1 });
  const belly = new THREE.MeshStandardMaterial({ color: o.belly, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141112, roughness: 0.6 });
  const spikeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.fur).multiplyScalar(0.55), roughness: 1 });
  const eye = new THREE.MeshStandardMaterial({ color: o.eye, emissive: o.eye, emissiveIntensity: 1.4 });
  const bone = new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.6 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x5a1a1f, roughness: 0.7 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(o.scale);
  root.add(body);
  const L = o.bodyLen;
  const add = (geo, m, parent, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const furSph = () => paintFur(new THREE.SphereGeometry(1, 14, 10), o.fur, o.belly);
  const sph = new THREE.SphereGeometry(1, 10, 8);

  // tronc : croupe, ventre, poitrail, cou
  add(furSph(), fur, body, 0, 0.72, 0, 0.3, 0.32, 0.62 * L);
  add(furSph(), fur, body, 0, 0.78, 0.36 * L, 0.33, 0.37, 0.34);
  add(furSph(), fur, body, 0, 0.74, -0.34 * L, 0.3, 0.33, 0.3); // hanches
  add(furSph(), fur, body, 0, 0.86, 0.6 * L, 0.2, 0.22, 0.26); // cou
  add(sph, belly, body, 0, 0.6, 0.05, 0.22, 0.2, 0.5 * L);

  // crinière / crête dorsale
  const spike = new THREE.ConeGeometry(0.045, 0.16, 5);
  for (let i = 0; i < 7; i++) {
    const t = i / 6, z = (0.55 - t * 1.0) * L;
    const sp = add(spike, spikeMat, body, 0, 1.0 - Math.abs(t - 0.4) * 0.12, z);
    sp.rotation.x = -0.25 - t * 0.4; sp.scale.setScalar(1 - t * 0.25 + (o.tusks ? 0.5 : 0));
  }

  const head = new THREE.Group();
  head.position.set(0, 0.86, 0.82 * L);
  body.add(head);
  add(furSph(), fur, head, 0, 0, 0, 0.2, 0.19, 0.24);
  add(furSph(), fur, head, 0, -0.03, 0.2, 0.11, 0.1, o.snout);
  add(sph, dark, head, 0, -0.01, 0.2 + o.snout, 0.04, 0.035, 0.04);
  // mâchoire inférieure (pivot pour ouvrir la gueule)
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.06, 0.12);
  head.add(jaw);
  add(sph, mouthMat, jaw, 0, -0.02, 0.1, 0.085, 0.03, o.snout * 0.7 + 0.1);
  add(sph, fur, jaw, 0, -0.045, 0.1, 0.075, 0.035, o.snout * 0.6 + 0.08);
  // crocs
  const fang = new THREE.ConeGeometry(0.014, 0.06, 4);
  for (const sx of [-1, 1]) {
    const f = add(fang, bone, head, sx * 0.055, -0.095, 0.17 + o.snout * 0.8); f.rotation.x = Math.PI;
    const g = add(fang, bone, jaw, sx * 0.04, 0.03, 0.12 + o.snout * 0.5);
  }
  const earGeo = new THREE.ConeGeometry(0.065, 0.2, 5);
  const ears = [];
  for (const sx of [1, -1]) {
    const pv = new THREE.Group();
    pv.position.set(sx * 0.11, 0.17, -0.04);
    head.add(pv);
    add(earGeo, fur, pv, 0, 0.08, 0);
    add(new THREE.ConeGeometry(0.035, 0.12, 4), mouthMat, pv, 0, 0.07, 0.025);
    ears.push(pv);
  }
  const eyeL = add(sph, eye, head, 0.09, 0.05, 0.15, 0.03, 0.03, 0.03);
  const eyeR = add(sph, eye, head, -0.09, 0.05, 0.15, 0.03, 0.03, 0.03);
  const brow = new THREE.BoxGeometry(0.08, 0.02, 0.04);
  for (const sx of [1, -1]) { const b = add(brow, spikeMat, head, sx * 0.09, 0.09, 0.15); b.rotation.z = sx * -0.35; }
  const gt = glowTex();
  let glow = null;
  if (gt) {
    // lueur des yeux (très discrète, visible surtout la nuit)
    glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: o.eye, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
    glow.scale.setScalar(0.28);
    glow.position.set(0, 0.05, 0.19);
    head.add(glow);
  }
  if (o.tusks) {
    const tusk = new THREE.ConeGeometry(0.032, 0.24, 6);
    const a = add(tusk, bone, head, 0.09, -0.06, 0.24); a.rotation.x = -0.6; a.rotation.z = -0.15;
    const b = add(tusk, bone, head, -0.09, -0.06, 0.24); b.rotation.x = -0.6; b.rotation.z = 0.15;
  }

  // queue à deux segments (retard)
  const tail = new THREE.Group();
  tail.position.set(0, 0.8, -0.6 * L);
  body.add(tail);
  const t1 = add(new THREE.ConeGeometry(0.08, 0.34, 6), fur, tail, 0, -0.06, -0.14);
  t1.rotation.x = -2.0;
  const tail2 = new THREE.Group();
  tail2.position.set(0, -0.2, -0.3);
  tail.add(tail2);
  const t2 = add(new THREE.ConeGeometry(0.065, 0.32, 6), fur, tail2, 0, 0, -0.1);
  t2.rotation.x = -2.5;

  const legs = [];
  for (const [sx, sz] of [[1, 0.36], [-1, 0.36], [1, -0.36], [-1, -0.36]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.19, 0.6, sz * L);
    body.add(pivot);
    const thigh = add(paintFur(new THREE.CapsuleGeometry(0.065, 0.3, 5, 8), o.fur, o.fur), fur, pivot, 0, -0.18, 0);
    thigh.scale.set(1.1, 1, 1.15);
    add(paintFur(new THREE.CapsuleGeometry(0.048, 0.3, 4, 8), o.fur, o.fur, { dark: 0.1 }), fur, pivot, 0, -0.43, 0.01);
    add(sph, dark, pivot, 0, -0.58, 0.03, 0.07, 0.04, 0.09);
    const claw = new THREE.ConeGeometry(0.012, 0.05, 4);
    for (let c = -1; c <= 1; c++) { const m = add(claw, bone, pivot, c * 0.026, -0.585, 0.11); m.rotation.x = Math.PI / 2; }
    legs.push(pivot);
  }
  return { root, body, head, tail, tail2, jaw, ears, legs, fur, glow, phase: 0, k: 0, t: 0, hurtT: 0 };
}

// s = { speed, action ('attack'|null), actionT, actionDur, dead, deadT }
export function animateCreature(rig, s, dt) {
  if (rig.glb) return animateGlbRig(rig, s, dt, 'creature');
  rig.t += dt;
  rig.hurtT = Math.max(0, rig.hurtT - dt * 5);
  rig.fur.emissive.setRGB(rig.hurtT * 0.9, 0, 0);
  const k = clamp(s.speed / 6, 0, 1);
  rig.k += (k - rig.k) * Math.min(1, dt * 10);
  rig.phase += dt * (5 + s.speed * 1.6);
  const w = Math.sin(rig.phase) * 0.9 * rig.k;
  const [fl, fr, bl, br] = rig.legs;
  fl.rotation.x = w; br.rotation.x = w;
  fr.rotation.x = -w; bl.rotation.x = -w;
  rig.body.position.y = Math.abs(Math.cos(rig.phase)) * 0.05 * rig.k;
  rig.body.rotation.x = Math.sin(rig.phase * 2) * 0.03 * rig.k; // ondulation de la colonne
  rig.tail.rotation.y = Math.sin(rig.t * 6) * 0.4 * (1 - rig.k * 0.7);
  if (rig.tail2) rig.tail2.rotation.y = Math.sin(rig.t * 6 - 0.9) * 0.5 * (1 - rig.k * 0.6);
  rig.tail.rotation.x = -0.2 * rig.k;
  rig.head.rotation.x = Math.sin(rig.t * 1.5) * 0.03 + Math.sin(rig.phase) * 0.04 * rig.k;
  rig.head.rotation.y = Math.sin(rig.t * 0.7) * 0.12 * (1 - rig.k);
  if (rig.ears) {
    rig.ears[0].rotation.z = -0.15 + Math.sin(rig.t * 5.3) * 0.08 * (Math.sin(rig.t * 0.7) > 0.8 ? 3 : 1);
    rig.ears[1].rotation.z = 0.15 - Math.sin(rig.t * 4.7) * 0.08;
  }
  let jaw = 0.04 + Math.sin(rig.t * 2.1) * 0.02; // respiration
  // au repos : flaire le sol par intermittence
  const sniff = Math.max(0, Math.sin(rig.t * 0.5)) ** 3 * (1 - rig.k);
  rig.head.rotation.x += 0.45 * sniff;
  rig.head.position.y = 0.86 - 0.12 * sniff;
  // course : bonds plus marqués, foulée plus ample
  rig.body.position.y += Math.abs(Math.sin(rig.phase)) * 0.06 * rig.k;
  // coup reçu : recul et tête relevée
  rig.body.rotation.x += -0.35 * rig.hurtT;
  rig.head.rotation.x -= 0.4 * rig.hurtT;
  rig.body.position.z = -0.25 * rig.hurtT;

  if (s.dead) {
    const p = clamp(s.deadT / 0.5, 0, 1);
    rig.body.rotation.z = (Math.PI / 2) * p;
    rig.body.position.y = 0.1 * p;
    rig.body.position.x = -0.25 * p;
    if (rig.jaw) rig.jaw.rotation.x = 0.5 * p;
    if (rig.glow) rig.glow.material.opacity = 0.55 * (1 - p);
    return;
  }
  rig.body.rotation.z = 0;
  rig.body.position.x = 0;
  if (s.action === 'attack') {
    const p = clamp(s.actionT / s.actionDur, 0, 1);
    const lunge = Math.sin(p * Math.PI);
    const rear = Math.sin(Math.min(1, p * 1.6) * Math.PI * 0.5) * (1 - clamp((p - 0.45) / 0.4, 0, 1)); // se cabre avant de mordre
    rig.body.position.z = lunge * 0.55;
    rig.head.rotation.x = 0.55 * lunge - 0.25 * rear;
    rig.body.position.y += 0.1 * rear;
    if (rig.ears) { rig.ears[0].rotation.z = -0.9 * lunge; rig.ears[1].rotation.z = 0.9 * lunge; }
    rig.tail.rotation.x = 0.4 * lunge;
    jaw = 0.75 * Math.sin(Math.min(1, p * 1.4) * Math.PI);
    rig.body.rotation.x = -0.12 * lunge;
  } else {
    rig.body.position.z = -0.25 * rig.hurtT;
  }
  if (rig.jaw) rig.jaw.rotation.x = jaw;
  if (rig.glow) rig.glow.material.opacity = 0.5 + Math.sin(rig.t * 3) * 0.1;
}
