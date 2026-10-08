// V10.12 — Coiffures et pilosité faciale procédurales (barbier / création du personnage).
// Chaque coiffure est construite en primitives Three.js autour du centre du crâne
// (ctx = { R, sx, sy, sz, mats:{ hair, hairFine }, jaw:{ center, radii }, mouth:{ y, z } }).
// Remplaçable plus tard par un GLB : il suffit qu'un builder renvoie le modèle chargé.
// La coiffure « classique » (d'origine) reste construite dans HumanoidModel.js.
import * as THREE from 'three';

const PI = Math.PI;
const TAU = PI * 2;

// ---------- Primitives ----------
function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

/** Calotte de cheveux : portion de sphère inclinée vers l'arrière. */
function shell(ctx, { theta = 0.44 * PI, tilt = -0.45, inflate = 1.07, fine = false, offsetX = 0 } = {}) {
  // on incline la géométrie AVANT l'échelle : la calotte épouse ainsi exactement le crâne
  const g = new THREE.SphereGeometry(ctx.R * inflate, 28, 14, 0, TAU, 0, theta).rotateX(tilt);
  const m = mesh(g, fine ? ctx.mats.hairFine : ctx.mats.hair);
  m.scale.set(ctx.sx, ctx.sy, ctx.sz);
  m.position.x = offsetX;
  return m;
}

function ellipsoid(ctx, r, [ax, ay, az], [x, y, z], mat = ctx.mats.hair, seg = 14) {
  const m = mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), mat);
  m.scale.set(ax, ay, az);
  m.position.set(x, y, z);
  return m;
}

/** Rideau de cheveux tombant (dos + côtés). arc centré sur l'arrière du crâne. */
function curtain(ctx, { top = 0.35, height = 0.16, rTop = 1.08, rBottom = 1.2, arc = 1.3 * PI, center = PI }) {
  const g = new THREE.CylinderGeometry(ctx.R * rTop, ctx.R * rBottom, height, 30, 2, true, center - arc / 2, arc);
  const m = mesh(g, ctx.mats.hair);
  m.position.y = ctx.R * top - height / 2;
  m.scale.set(ctx.sx, 1, ctx.sz);
  return m;
}

/** Mèche / dread / tresse fine qui pend. */
function strand(ctx, { angle, top = 0.2, length = 0.2, rTop = 0.013, rBottom = 0.009, radius = 1.0, flare = 0.12 }) {
  const m = mesh(new THREE.CylinderGeometry(rTop, rBottom, length, 6, 1), ctx.mats.hair);
  const x = Math.sin(angle) * ctx.R * ctx.sx * radius;
  const z = Math.cos(angle) * ctx.R * ctx.sz * radius;
  m.position.set(x, ctx.R * top - length / 2, z);
  // léger écartement vers l'extérieur
  m.rotation.z = -Math.sin(angle) * flare;
  m.rotation.x = Math.cos(angle) * flare;
  return m;
}

/** Points répartis sur la calotte (pour boucles, texture). */
function capPoints(count, theta, tilt) {
  const pts = [];
  const golden = PI * (3 - Math.sqrt(5));
  const axis = new THREE.Vector3(0, Math.cos(tilt), Math.sin(tilt)).normalize();
  for (let i = 0; i < count * 3 && pts.length < count; i++) {
    const y = 1 - (i / (count * 3 - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * golden;
    const p = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);
    if (p.angleTo(axis) < theta) pts.push(p);
  }
  return pts;
}

function curls(ctx, { count = 34, theta = 0.42 * PI, tilt = -0.45, size = 0.17, inflate = 1.1 }) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(ctx.R * size, 8, 6);
  for (const p of capPoints(count, theta, -tilt)) {
    const c = mesh(geo, ctx.mats.hair);
    c.position.set(p.x * ctx.R * inflate * ctx.sx, p.y * ctx.R * inflate * ctx.sy, p.z * ctx.R * inflate * ctx.sz);
    g.add(c);
  }
  return g;
}

function afroVolume(ctx, { radii, center, bumps = 26 }) {
  const g = new THREE.Group();
  const R = ctx.R;
  const [rx, ry, rz] = radii.map((v, i) => v * R * [ctx.sx, ctx.sy, ctx.sz][i]);
  const [cx, cy, cz] = center.map((v) => v * R);
  g.add(ellipsoid(ctx, 1, [rx, ry, rz], [cx, cy, cz], ctx.mats.hair, 24));
  // petites bosses pour casser la sphère parfaite
  const geo = new THREE.SphereGeometry(R * 0.32, 8, 6);
  const golden = PI * (3 - Math.sqrt(5));
  for (let i = 0; i < bumps; i++) {
    const y = 1 - (i / (bumps - 1)) * 1.6;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * golden;
    const dz = Math.sin(phi) * r;
    if (dz > 0.55 && y < 0.5) continue; // pas de bosse sur le visage
    const b = mesh(geo, ctx.mats.hair);
    b.position.set(cx + Math.cos(phi) * r * rx * 0.92, cy + y * ry * 0.92, cz + dz * rz * 0.92);
    g.add(b);
  }
  return g;
}

// ---------- Coiffures ----------
export const HAIR_BUILDERS = {
  chauve: () => new THREE.Group(),

  'crane-rase': (ctx) => group(shell(ctx, { theta: 0.46 * PI, inflate: 1.012, fine: true })),

  'coupe-courte': (ctx) => group(
    shell(ctx, { theta: 0.44 * PI, inflate: 1.07 }),
    ellipsoid(ctx, ctx.R * 0.5, [1.5, 0.35, 0.8], [0, ctx.R * 0.78, ctx.R * 0.5]),
  ),

  undercut: (ctx) => group(
    shell(ctx, { theta: 0.46 * PI, inflate: 1.015, fine: true }),
    shell(ctx, { theta: 0.3 * PI, tilt: -0.2, inflate: 1.12 }),
    ellipsoid(ctx, ctx.R * 0.45, [1.3, 0.55, 1.0], [0, ctx.R * 0.88, ctx.R * 0.5]),
  ),

  iroquoise: (ctx) => {
    const crest = ellipsoid(ctx, ctx.R, [0.17, 0.5, 1.02], [0, ctx.R * 0.78, -ctx.R * 0.1]);
    crest.rotation.x = -0.25;
    return group(shell(ctx, { theta: 0.46 * PI, inflate: 1.012, fine: true }), crest);
  },

  'boucles-courtes': (ctx) => group(
    shell(ctx, { theta: 0.42 * PI, inflate: 1.06 }),
    curls(ctx, { count: 36 }),
  ),

  afro: (ctx) => afroVolume(ctx, { radii: [1.45, 1.25, 1.3], center: [0, 0.45, -0.4] }),

  dreadlocks: (ctx) => {
    const g = group(shell(ctx, { theta: 0.45 * PI, inflate: 1.06 }));
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = 0.38 * PI + (i / (n - 1)) * 1.24 * PI;
      g.add(strand(ctx, { angle: a, top: 0.25, length: 0.19 + (i % 3) * 0.015, rTop: 0.014, rBottom: 0.011, radius: 0.98, flare: 0.06 }));
    }
    return g;
  },

  catogan: (ctx) => group(
    shell(ctx, { theta: 0.44 * PI, inflate: 1.06 }),
    ellipsoid(ctx, ctx.R * 0.38, [1, 0.9, 1], [0, ctx.R * 0.72, -ctx.R * 0.88]),
  ),

  'mi-longs': (ctx) => group(
    shell(ctx, { theta: 0.45 * PI, inflate: 1.08 }),
    curtain(ctx, { top: 0.3, height: 0.15, rTop: 1.02, rBottom: 1.14 }),
  ),

  'tresses-plaquees': (ctx) => {
    const g = group(shell(ctx, { theta: 0.46 * PI, inflate: 1.012, fine: true }));
    const geo = new THREE.SphereGeometry(0.015, 8, 6);
    for (let row = 0; row < 6; row++) {
      const xr = -0.62 + row * (1.24 / 5);
      for (let t = 0; t < 12; t++) {
        const a = 1.1 - (t / 11) * 2.5;
        const d = new THREE.Vector3(xr, Math.cos(a), Math.sin(a)).normalize();
        const s = mesh(geo, ctx.mats.hair);
        s.position.set(d.x * ctx.R * 1.03 * ctx.sx, d.y * ctx.R * 1.03 * ctx.sy, d.z * ctx.R * 1.03 * ctx.sz);
        g.add(s);
      }
    }
    return g;
  },

  carre: (ctx) => group(
    shell(ctx, { theta: 0.46 * PI, inflate: 1.08 }),
    curtain(ctx, { top: 0.3, height: 0.11, rTop: 1.03, rBottom: 1.12, arc: 1.38 * PI }),
    ellipsoid(ctx, ctx.R * 0.5, [1.55, 0.32, 0.75], [0, ctx.R * 0.66, ctx.R * 0.62]),
  ),

  pixie: (ctx) => {
    const fringe = ellipsoid(ctx, ctx.R * 0.5, [1.6, 0.35, 0.8], [ctx.R * 0.18, ctx.R * 0.7, ctx.R * 0.6]);
    fringe.rotation.set(-0.45, 0, -0.3);
    return group(shell(ctx, { theta: 0.43 * PI, inflate: 1.07 }), fringe);
  },

  'queue-de-cheval': (ctx) => {
    const tail = mesh(new THREE.ConeGeometry(ctx.R * 0.3, 0.26, 12), ctx.mats.hair);
    tail.rotation.x = PI - 0.25;
    tail.position.set(0, ctx.R * 0.3 - 0.12, -ctx.R * 1.18);
    return group(
      shell(ctx, { theta: 0.44 * PI, inflate: 1.05 }),
      ellipsoid(ctx, ctx.R * 0.2, [1, 1, 1], [0, ctx.R * 0.32, -ctx.R * 1.02]),
      tail,
    );
  },

  'longs-lisses': (ctx) => group(
    shell(ctx, { theta: 0.46 * PI, inflate: 1.08 }),
    curtain(ctx, { top: 0.3, height: 0.32, rTop: 1.02, rBottom: 1.2, arc: 1.3 * PI }),
  ),

  tresse: (ctx) => {
    const g = group(shell(ctx, { theta: 0.45 * PI, inflate: 1.06 }));
    const n = 10;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = 0.028 - t * 0.012;
      g.add(ellipsoid(ctx, r, [1, 1.3, 0.9], [Math.sin(i * 1.7) * 0.004, ctx.R * 0.05 - t * 0.36, -ctx.R * 1.0 - t * 0.04]));
    }
    return g;
  },

  chignon: (ctx) => {
    const ring = mesh(new THREE.TorusGeometry(ctx.R * 0.42, 0.012, 6, 16), ctx.mats.hair);
    ring.position.set(0, ctx.R * 0.86, -ctx.R * 0.66);
    ring.rotation.x = -0.9;
    return group(
      shell(ctx, { theta: 0.45 * PI, inflate: 1.06 }),
      ellipsoid(ctx, ctx.R * 0.48, [1, 0.85, 1], [0, ctx.R * 0.9, -ctx.R * 0.72]),
      ring,
    );
  },

  couettes: (ctx) => {
    const g = group(shell(ctx, { theta: 0.45 * PI, inflate: 1.06 }));
    for (const side of [-1, 1]) {
      g.add(ellipsoid(ctx, ctx.R * 0.17, [1, 1, 1], [side * ctx.R * 0.98 * ctx.sx, ctx.R * 0.28, -ctx.R * 0.35]));
      const c = mesh(new THREE.ConeGeometry(ctx.R * 0.24, 0.2, 10), ctx.mats.hair);
      c.rotation.set(PI, 0, side * 0.12);
      c.position.set(side * ctx.R * 1.04 * ctx.sx, ctx.R * 0.28 - 0.1, -ctx.R * 0.35);
      g.add(c);
    }
    return g;
  },

  'boucles-longues': (ctx) => {
    const g = group(
      shell(ctx, { theta: 0.46 * PI, inflate: 1.08 }),
      curtain(ctx, { top: 0.3, height: 0.25, rTop: 1.03, rBottom: 1.2, arc: 1.3 * PI }),
    );
    const geo = new THREE.SphereGeometry(0.03, 8, 6);
    for (let i = 0; i < 24; i++) {
      const a = 0.4 * PI + (i % 8) * (1.2 * PI / 7);
      const level = Math.floor(i / 8);
      const rr = ctx.R * (1.1 + level * 0.05);
      const b = mesh(geo, ctx.mats.hair);
      b.position.set(Math.sin(a) * rr * ctx.sx, ctx.R * 0.1 - level * 0.08, Math.cos(a) * rr * ctx.sz);
      g.add(b);
    }
    return g;
  },

  'afro-volumineux': (ctx) => afroVolume(ctx, { radii: [1.7, 1.45, 1.55], center: [0, 0.55, -0.6], bumps: 34 }),

  'tresses-box': (ctx) => {
    const g = group(shell(ctx, { theta: 0.46 * PI, inflate: 1.05 }));
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a = 0.36 * PI + (i / (n - 1)) * 1.28 * PI;
      g.add(strand(ctx, { angle: a, top: 0.3, length: 0.3 + (i % 4) * 0.02, rTop: 0.009, rBottom: 0.007, radius: 1.0, flare: 0.05 }));
    }
    return g;
  },

  'rase-cote': (ctx) => group(
    shell(ctx, { theta: 0.46 * PI, inflate: 1.012, fine: true }),
    shell(ctx, { theta: 0.34 * PI, tilt: -0.25, inflate: 1.1, offsetX: ctx.R * 0.12 }),
    curtain(ctx, { top: 0.3, height: 0.2, rTop: 1.04, rBottom: 1.16, arc: 0.75 * PI, center: 0.62 * PI }),
  ),
};

function group(...children) {
  const g = new THREE.Group();
  children.forEach((c) => g.add(c));
  return g;
}

export function buildHair(id, ctx) {
  const builder = HAIR_BUILDERS[id] ?? HAIR_BUILDERS['coupe-courte'];
  const g = builder(ctx);
  g.name = `hair:${id}`;
  return g;
}

// ---------- Pilosité faciale ----------
// ctx.jaw = { center:[x,y,z], radii:[rx,ry,rz] }, ctx.mouth = { y, z }
function jawShell(ctx, inflate, fine) {
  const [rx, ry, rz] = ctx.jaw.radii;
  const g = new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0.6 * PI, 0.4 * PI);
  const m = mesh(g, fine ? ctx.mats.hairFine : ctx.mats.hair);
  m.scale.set(rx * inflate, ry * inflate, rz * inflate);
  m.position.set(...ctx.jaw.center);
  return m;
}

function moustache(ctx) {
  return ellipsoid(ctx, 0.028, [1.15, 0.25, 0.45], [0, ctx.mouth.y + 0.013, ctx.mouth.z + 0.002]);
}

export const FACIAL_HAIR_BUILDERS = {
  aucune: () => new THREE.Group(),
  'barbe-3-jours': (ctx) => group(jawShell(ctx, 1.015, true)),
  moustache: (ctx) => group(moustache(ctx)),
  bouc: (ctx) => group(
    moustache(ctx),
    ellipsoid(ctx, 0.022, [1, 1.35, 0.7], [0, ctx.mouth.y - 0.028, ctx.mouth.z - 0.006]),
  ),
  'barbe-courte': (ctx) => group(jawShell(ctx, 1.07, false), moustache(ctx)),
  'barbe-longue': (ctx) => {
    const cone = mesh(new THREE.ConeGeometry(0.05, 0.13, 12), ctx.mats.hair);
    cone.rotation.x = PI - 0.35;
    cone.position.set(0, ctx.mouth.y - 0.085, ctx.mouth.z - 0.012);
    return group(jawShell(ctx, 1.08, false), moustache(ctx), cone);
  },
};

export function buildFacialHair(id, ctx) {
  const builder = FACIAL_HAIR_BUILDERS[id] ?? FACIAL_HAIR_BUILDERS.aucune;
  const g = builder(ctx);
  g.name = `facialHair:${id}`;
  return g;
}
