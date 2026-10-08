import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Générateurs de géométries organiques pour la V2.5 : arbres, rochers,
// buissons, herbe, fleurs, champignons, roseaux, souches. Tout est fusionné
// en une seule géométrie colorée par vertex (un seul draw call par espèce
// et par chunk grâce à l'instancing).

const h3 = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s); // 0..1
};
// bruit de valeur lissé 3D (coût faible, suffisant pour déformer)
const n3 = (x, y, z) => {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h3(ix, iy, iz), h3(ix + 1, iy, iz), u), l(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), u), v),
    l(l(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), u), l(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), u), v),
    w
  );
};

function clean(geo) {
  // retire les attributs qui empêchent la fusion des sommets, puis lisse les normales
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  return g;
}

// Blob organique : icosaèdre déformé par du bruit, normales lissées.
export function blob(radius, detail, { squash = 1, rough = 0.28, seed = 0, freq = 1.4 } = {}) {
  let g = clean(new THREE.IcosahedronGeometry(radius, detail));
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = v.length() || 1;
    const k = 1 + (n3(v.x * freq / radius + seed, v.y * freq / radius, v.z * freq / radius - seed) - 0.5) * 2 * rough;
    p.setXYZ(i, (v.x / d) * radius * k, (v.y / d) * radius * k * squash, (v.z / d) * radius * k);
  }
  g.computeVertexNormals();
  return g;
}

// Colorie un géométrie : dégradé vertical + bruit + (option) teinte selon la normale.
export function paintGradient(geo, bottom, top, { jitter = 0.08, y0, y1, seed = 0, moss = null } = {}) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position, nrm = geo.attributes.normal;
  if (y0 === undefined || y1 === undefined) {
    geo.computeBoundingBox();
    y0 = geo.boundingBox.min.y; y1 = geo.boundingBox.max.y;
  }
  const cb = new THREE.Color(bottom), ct = new THREE.Color(top), c = new THREE.Color(), cm = moss !== null ? new THREE.Color(moss) : null;
  const arr = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, (p.getY(i) - y0) / Math.max(1e-4, y1 - y0)));
    c.copy(cb).lerp(ct, t);
    const j = (n3(p.getX(i) * 3 + seed, p.getY(i) * 3, p.getZ(i) * 3) - 0.5) * jitter * 2;
    c.r = Math.min(1, Math.max(0, c.r + j)); c.g = Math.min(1, Math.max(0, c.g + j)); c.b = Math.min(1, Math.max(0, c.b + j * 0.6));
    if (cm && nrm.getY(i) > 0.55) c.lerp(cm, Math.min(1, (nrm.getY(i) - 0.55) * 2.2));
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function place(geo, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz)
  );
  geo.applyMatrix4(m);
  return geo;
}

function finish(parts) {
  const out = [];
  for (const g of parts) {
    // normalise : toutes les parties doivent être non indexées avec les mêmes attributs
    const ng = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'color'].includes(k)) ng.deleteAttribute(k);
    out.push(ng);
  }
  const m = mergeGeometries(out, false);
  if (!m) throw new Error('mergeGeometries a échoué');
  return m;
}

function trunk(r0, r1, h, color0, color1, { bend = 0, seg = 7, seed = 0 } = {}) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 3, true);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / h;
    p.setX(i, p.getX(i) + bend * t * t + (n3(p.getY(i) * 2 + seed, p.getX(i) * 4, p.getZ(i) * 4) - 0.5) * 0.04);
  }
  g.computeVertexNormals();
  return paintGradient(g, color0, color1, { jitter: 0.07, y0: 0, y1: h, seed });
}

// ---- Arbres -------------------------------------------------------------

// Conifère : tronc + 5 étages de branches tombantes, pointes plus claires.
export function pineGeometry(lod = 'hi') {
  const parts = [trunk(0.3, 0.12, 5.4, 0x4a3320, 0x5a4028, { bend: 0.1, seed: 1 })];
  const tiers = lod === 'hi' ? 5 : 3;
  const seg = lod === 'hi' ? 10 : 7;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const r = 2.0 - t * 1.35, h = 2.5 - t * 0.7, y = 1.5 + t * 4.0;
    let g = new THREE.ConeGeometry(r, h, seg, 2, false);
    g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), yy = p.getY(k), z = p.getZ(k);
      const rad = Math.hypot(x, z);
      if (rad > 0.05) {
        const f = 1 + (h3(Math.round(x * 20) + i, Math.round(z * 20), i) - 0.5) * 0.3;
        const droop = (rad / r) * 0.28; // bord extérieur qui pend
        p.setXYZ(k, x * f, yy - droop, z * f);
      }
    }
    g.computeVertexNormals();
    place(g, 0, y + h / 2, 0, 1, 1, 1, 0, i * 0.7, 0);
    paintGradient(g, 0x16401f, 0x2f7336, { jitter: 0.06, y0: y - 0.3, y1: y + h, seed: i * 3 });
    parts.push(g);
  }
  return finish(parts);
}

// Feuillu : tronc ramifié + canopée en blobs lissés.
export function oakGeometry(lod = 'hi', palette = 'green') {
  const pal = palette === 'autumn'
    ? { lo: 0x8a3b17, hi: 0xd9892b, moss: 0xe8b13a }
    : palette === 'light'
      ? { lo: 0x3d7a2a, hi: 0x8fc24a, moss: 0xb4dc66 }
      : { lo: 0x2a5e24, hi: 0x6aa83a, moss: 0x86c04a };
  const parts = [trunk(0.34, 0.2, 2.6, 0x4a3524, 0x5c4630, { bend: 0.15, seed: 2 })];
  // branches
  for (const [a, tilt] of [[0.3, 0.8], [2.4, 0.9], [4.4, 0.7]]) {
    const b = trunk(0.1, 0.05, 1.4, 0x4a3524, 0x5c4630, { seg: 5, seed: a });
    place(b, 0, 1.9, 0, 1, 1, 1, 0, a, tilt);
    parts.push(b);
  }
  const detail = lod === 'hi' ? 1 : 0;
  const blobs = lod === 'hi'
    ? [[0, 3.9, 0, 1.75], [1.15, 3.3, 0.35, 1.25], [-1.1, 3.4, -0.4, 1.3], [0.2, 3.2, 1.1, 1.15], [-0.3, 4.9, -0.2, 1.1]]
    : [[0, 3.9, 0, 1.8], [1.0, 3.2, 0.3, 1.2], [-1.0, 3.4, -0.4, 1.25]];
  blobs.forEach(([x, y, z, r], i) => {
    const g = blob(r, detail, { squash: 0.85, rough: 0.22, seed: i * 5.3 });
    place(g, x, y, z);
    paintGradient(g, pal.lo, pal.hi, { jitter: 0.08, y0: y - r, y1: y + r, seed: i, moss: pal.moss });
    parts.push(g);
  });
  return finish(parts);
}

// Bouleau : tronc blanc tacheté, feuillage clair en petits blobs.
export function birchGeometry(lod = 'hi') {
  const t = trunk(0.17, 0.08, 4.8, 0xe3dfd2, 0xd2cdbd, { bend: -0.25, seed: 4 });
  // taches noires
  const p = t.attributes.position, col = t.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const m = n3(p.getX(i) * 9, p.getY(i) * 6, p.getZ(i) * 9);
    if (m > 0.68) col.setXYZ(i, 0.12, 0.11, 0.1);
  }
  const parts = [t];
  const spots = lod === 'hi' ? [[0, 4.9, 0, 1.15], [0.7, 4.2, 0.3, 0.8], [-0.7, 4.0, -0.2, 0.85], [0.1, 3.4, -0.7, 0.7], [-0.1, 5.6, 0.1, 0.6]] : [[0, 4.8, 0, 1.2], [0.7, 4.0, 0.3, 0.8]];
  spots.forEach(([x, y, z, r], i) => {
    const g = blob(r, lod === 'hi' ? 1 : 0, { squash: 1.1, rough: 0.25, seed: i * 2.1 + 9 });
    place(g, x, y, z);
    paintGradient(g, 0x6aa036, 0xb7d95a, { jitter: 0.09, y0: y - r, y1: y + r, seed: i + 20 });
    parts.push(g);
  });
  return finish(parts);
}

// Arbre mort / sec (variété pour les zones hostiles, hautes altitudes)
export function deadTreeGeometry() {
  const parts = [trunk(0.32, 0.1, 4.2, 0x3a3128, 0x4b4036, { bend: 0.3, seed: 8 })];
  for (const [y, a, t] of [[2.2, 0.4, 0.9], [3.0, 2.5, 0.8], [3.6, 4.6, 0.7], [1.6, 5.4, 1.0]]) {
    const b = trunk(0.09, 0.025, 1.5, 0x3a3128, 0x4b4036, { seg: 5, seed: a });
    place(b, 0, y, 0, 1, 1, 1, 0, a, t);
    parts.push(b);
  }
  return finish(parts);
}

// ---- Rochers -----------------------------------------------------------

export function boulderGeometry(seed = 0) {
  const g = blob(1, 1, { squash: 0.8, rough: 0.34, seed, freq: 1.8 });
  // facettes marquées : on aplatit certaines zones
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < -0.35) p.setY(i, -0.35 + (y + 0.35) * 0.15); // base plate (posée dans le sol)
  }
  g.computeVertexNormals();
  return paintGradient(g, 0x4d4a47, 0x8b8883, { jitter: 0.09, y0: -0.4, y1: 0.85, seed, moss: 0x5f7f3d });
}

export function rockClusterGeometry() {
  const parts = [];
  [[0, 0, 0, 1], [1.05, -0.1, 0.4, 0.62], [-0.8, -0.1, -0.5, 0.55], [0.3, 0.0, -1.0, 0.45]].forEach(([x, y, z, s], i) => {
    const g = blob(s, 1, { squash: 0.85, rough: 0.32, seed: i * 4.4 + 2, freq: 1.8 });
    place(g, x, y + s * 0.35, z, 1, 1, 1, 0, i * 1.3, 0);
    paintGradient(g, 0x484541, 0x8a8782, { jitter: 0.09, y0: y - 0.2, y1: y + s * 1.2, seed: i, moss: 0x607e3e });
    parts.push(g);
  });
  return finish(parts);
}

// ---- Petits éléments ---------------------------------------------------

export function bushGeometry(lod = 'hi') {
  const parts = [];
  const spots = [[0, 0.45, 0, 0.7], [0.55, 0.35, 0.2, 0.5], [-0.5, 0.38, -0.2, 0.55], [0.1, 0.35, 0.55, 0.45]];
  spots.slice(0, lod === 'hi' ? 4 : 2).forEach(([x, y, z, r], i) => {
    const g = blob(r, 1, { squash: 0.8, rough: 0.22, seed: i * 3.7 });
    place(g, x, y, z);
    paintGradient(g, 0x2b5a26, 0x5c9a3a, { jitter: 0.09, y0: y - r, y1: y + r, seed: i + 5, moss: 0x7cb14a });
    parts.push(g);
  });
  return finish(parts);
}

// Touffe d'herbe : 7 lames courbées, pointe plus claire.
export function grassTuftGeometry() {
  const parts = [];
  const blades = 7;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + h3(i, 1, 2), r = 0.04 + h3(i, 2, 3) * 0.1;
    const hgt = 0.35 + h3(i, 3, 4) * 0.4, w = 0.045 + h3(i, 4, 5) * 0.025;
    const lean = 0.08 + h3(i, 5, 6) * 0.2;
    // lame à 2 segments (6 sommets utiles → 3 triangles) : base, milieu, pointe
    const pos = new Float32Array([
      -w, 0, 0, w, 0, 0, -w * 0.7, hgt * 0.55, lean * 0.4,
      w, 0, 0, w * 0.7, hgt * 0.55, lean * 0.4, -w * 0.7, hgt * 0.55, lean * 0.4,
      -w * 0.7, hgt * 0.55, lean * 0.4, w * 0.7, hgt * 0.55, lean * 0.4, 0, hgt, lean
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.computeVertexNormals();
    // normales vers le haut → éclairage homogène (aspect herbe)
    const nr = g.attributes.normal;
    for (let k = 0; k < nr.count; k++) nr.setXYZ(k, 0, 1, 0);
    place(g, Math.cos(a) * r, 0, Math.sin(a) * r, 1, 1, 1, 0, -a + Math.PI / 2, 0);
    paintGradient(g, 0x2a5a1e, 0x9fd04e, { jitter: 0.07, y0: 0, y1: hgt, seed: i });
    parts.push(g);
  }
  return finish(parts);
}

export function flowerGeometry() {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.008, 0.01, 0.3, 4, 1, true);
  stem.translate(0, 0.15, 0);
  paintGradient(stem, 0x2f6a24, 0x4f8a34, { jitter: 0.03, y0: 0, y1: 0.3 });
  parts.push(stem);
  // pétales blancs → teinte donnée par instanceColor (multiplie)
  const petals = new THREE.ConeGeometry(0.07, 0.05, 6, 1, true);
  petals.rotateX(Math.PI);
  petals.translate(0, 0.32, 0);
  paintGradient(petals, 0xffffff, 0xffffff, { jitter: 0, y0: 0.28, y1: 0.35 });
  parts.push(petals);
  const heart = new THREE.SphereGeometry(0.025, 5, 4);
  heart.translate(0, 0.325, 0);
  paintGradient(heart, 0xffd85a, 0xffd85a, { jitter: 0, y0: 0.3, y1: 0.35 });
  parts.push(heart);
  return finish(parts);
}

export function mushroomGeometry() {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.05, 0.065, 0.2, 6, 1, true);
  stem.translate(0, 0.1, 0);
  paintGradient(stem, 0xd8cfb8, 0xeee6d2, { jitter: 0.03, y0: 0, y1: 0.2 });
  parts.push(stem);
  const cap = new THREE.SphereGeometry(0.14, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
  cap.translate(0, 0.19, 0);
  paintGradient(cap, 0xb02a22, 0xd8483a, { jitter: 0.05, y0: 0.19, y1: 0.33 });
  parts.push(cap);
  return finish(parts);
}

export function stumpGeometry() {
  const g = new THREE.CylinderGeometry(0.34, 0.46, 0.55, 8, 2, false);
  g.translate(0, 0.27, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const f = 1 + (n3(x * 6, p.getY(i) * 4, z * 6) - 0.5) * 0.18;
    p.setX(i, x * f); p.setZ(i, z * f);
  }
  g.computeVertexNormals();
  paintGradient(g, 0x3e2d1d, 0x6b5238, { jitter: 0.07, y0: 0, y1: 0.55 });
  return finish([g]);
}

export function logGeometry() {
  const g = new THREE.CylinderGeometry(0.28, 0.33, 2.6, 8, 3, false);
  g.rotateZ(Math.PI / 2);
  g.translate(0, 0.3, 0);
  paintGradient(g, 0x40301f, 0x5f4a33, { jitter: 0.08, y0: 0, y1: 0.6 });
  // petit moignon de branche
  const b = new THREE.CylinderGeometry(0.06, 0.1, 0.6, 5, 1, true);
  place(b, 0.3, 0.55, 0, 1, 1, 1, 0, 0, -0.6);
  paintGradient(b, 0x40301f, 0x5f4a33, { jitter: 0.05, y0: 0.3, y1: 0.9 });
  return finish([g, b]);
}

// Roseaux au bord de l'eau
export function reedGeometry() {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28, r = 0.12 + h3(i, 7, 1) * 0.12, hgt = 0.9 + h3(i, 8, 2) * 0.8;
    const s = new THREE.CylinderGeometry(0.012, 0.02, hgt, 4, 2, true);
    s.translate(0, hgt / 2, 0);
    const p = s.attributes.position;
    for (let k = 0; k < p.count; k++) { const t = p.getY(k) / hgt; p.setX(k, p.getX(k) + t * t * 0.2); }
    s.computeVertexNormals();
    place(s, Math.cos(a) * r, 0, Math.sin(a) * r, 1, 1, 1, 0, a, 0);
    paintGradient(s, 0x4a6a2a, 0x93a85a, { jitter: 0.05, y0: 0, y1: hgt, seed: i });
    parts.push(s);
    if (i % 2 === 0) {
      const tip = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 5);
      place(tip, Math.cos(a) * r + 0.0, hgt - 0.05, Math.sin(a) * r, 1, 1, 1, 0, a, 0);
      paintGradient(tip, 0x5a3c22, 0x6e4a2a, { jitter: 0.03, y0: hgt - 0.16, y1: hgt + 0.06 });
      parts.push(tip);
    }
  }
  return finish(parts);
}

export function disposeGeos(list) { for (const g of list) g?.dispose?.(); }
