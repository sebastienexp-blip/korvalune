import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../core/config.js';
import { clamp, lerp, smoothstep, mulberry32 } from '../core/math.js';
import { fbm } from './noise.js';
import { buildTown } from './Town.js';
import { isSafeMode, addSway } from '../visual/Safe.js';
import { groundDetailTexture, waterSparkleTexture, safeTexture } from '../visual/Textures.js';
import * as FO from '../visual/Foliage.js';
import { GrassField } from '../visual/GrassField.js';
import { REGIONS, REGION_INDEX, regionField, coastD } from './Continent.js';
import { planLandmarks, buildLandmarks } from './Landmarks.js';


// ---------------------------------------------------------------------------------------------
// V7.0 — Le continent : un seul monde continu, régions de biomes distincts autour d'Aetheria,
// reliées par des routes (plus de portails).
const REGION_IDS = REGIONS.map((r) => r.id).filter((id) => id !== 'prairie');
// Routes (points de contrôle), de la ville vers chaque région
const ROAD_PTS = [
  [[0, 40], [6, 100], [20, 160], [36, 215], [42, 265], [52, 320], [60, 358]],                                // sud : Montagnes de Fer → Royaume Céleste
  [[-40, 8], [-95, 28], [-150, 40], [-210, 45], [-262, 20], [-308, -60], [-340, -150]],                      // ouest : Forêt des Ombres → Abysses
  [[40, -14], [110, -30], [180, 10], [245, 58]],                                                            // est : Désert d'Ambre
  [[245, 58], [282, -30], [280, -130], [272, -215]],                                                         // désert → Terres Corrompues
  [[245, 58], [262, 120], [282, 190], [298, 242]],                                                           // désert → Néant Primordial
  [[0, -40], [5, -100], [0, -160], [-8, -220], [-14, -292]],                                                 // nord : Toundra de Givre
  [[-150, 40], [-163, 110], [-176, 175], [-186, 232]]                                                        // forêt → Marais de Brume
];
const ROAD_GRID = { step: 2, half: 524, influence: 11 };

const CELL = 16;
const MAX_TREES = 5400;
const CHUNKS = 8;
const tick = () => new Promise((r) => setTimeout(r, 16));

function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.waterLevel = CONFIG.world.waterLevel;
    this.grid = new Map();
    this.rand = mulberry32(1337);
    this.treeChunks = [];
    this.torches = [];
    this.lights = [];
    this.windowMat = new THREE.MeshStandardMaterial({ color: 0x3a2c18, emissive: 0xffb050, emissiveIntensity: 0 });
    this.spots = {};
    this.v25 = false; // activé par Game avant build() (réglage « Qualité visuelle V2.5 »)
    this.vq = null; // palier de qualité (CONFIG.quality[x])
    this.grass = null;
  }

  // ---------- Terrain ----------
  riverX(z) { return 70 + 30 * Math.sin(z * 0.012); }
  // (hérité) abscisse de l'ancienne route sud — la vraie logique est roadDist()
  pathX(z) { return 6 * Math.sin(z * 0.03) * smoothstep(30, 75, z); }

  // poids (0..1) de chaque région en (x, z) — voir Continent.js (frontières irrégulières)
  regionW(x, z, id) { return regionField(x, z).w[REGION_INDEX[id]]; }
  // région dominante
  biomeAt(x, z) { return REGIONS[regionField(x, z).best].id; }

  _land0(x, z) { // relief brut (sans rivière, routes ni plateformes)
    const d = Math.hypot(x, z);
    const far = smoothstep(30, 130, d);
    let h = (fbm(x * 0.008 + 10, z * 0.008 + 10, 4) - 0.36) * 34 * (0.2 + 0.8 * far);
    h += (fbm(x * 0.04, z * 0.04, 3) - 0.4) * 3 * (0.3 + 0.7 * far);
    const F = regionField(x, z), W = F.w, T = F.t, I = REGION_INDEX;
    let w = W[I.forest];
    if (w > 0.01) h += w * ((fbm(x * 0.03 + 300, z * 0.03 + 300, 3) - 0.45) * 9 + 1.5);
    w = W[I.mount];
    if (w > 0.01) { const rid = 1 - Math.abs(fbm(x * 0.02 + 70, z * 0.02 + 70, 3) * 2 - 1); h += w * (0.25 + 0.75 * T[I.mount]) * (6 + rid * rid * 44 + fbm(x * 0.07, z * 0.07, 2) * 5); }
    w = W[I.desert];
    if (w > 0.01) { const r1 = 1 - Math.abs(fbm(x * 0.016 + 210, z * 0.009 + 210, 3) * 2 - 1); h = lerp(h, 3.5 + r1 * r1 * 9 + fbm(x * 0.06, z * 0.06, 2) * 1.6, w * 0.95); }
    w = W[I.swamp];
    if (w > 0.01) { const pools = smoothstep(0.5, 0.64, fbm(x * 0.022 + 450, z * 0.022 + 450, 3)); h = lerp(h, 0.75 + (fbm(x * 0.05 + 410, z * 0.05 + 410, 3) - 0.45) * 2.4 - pools * 3.6, w * 0.95); }
    w = W[I.tundra];
    if (w > 0.01) h = lerp(h, Math.max(0.6, 4 + (fbm(x * 0.011 + 510, z * 0.011 + 510, 4) - 0.34) * 28), w * 0.92);
    w = W[I.corrupt];
    if (w > 0.01) { const rid = 1 - Math.abs(fbm(x * 0.03 + 900, z * 0.03 + 900, 3) * 2 - 1); const crater = smoothstep(0.6, 0.7, fbm(x * 0.02 + 940, z * 0.02 + 940, 2)) * 6; h = lerp(h, 5 + rid * rid * rid * 22 - crater, w * 0.9); }
    w = W[I.celeste];
    if (w > 0.01) { const base = 14 + fbm(x * 0.012 + 600, z * 0.012 + 600, 3) * 22; const t = base / 3.4, f = t - Math.floor(t); h = lerp(h, (Math.floor(t) + smoothstep(0.72, 1, f)) * 3.4, w * 0.95); }
    w = W[I.abyss];
    if (w > 0.01) { const v = fbm(x * 0.012 + 130, z * 0.012 + 130, 4); const a = Math.abs(v - 0.5) * 2; h = lerp(h, 3 + Math.pow(a, 0.8) * 34, w * 0.95); }
    w = W[I.void];
    if (w > 0.01) h = lerp(h, 9 + (fbm(x * 0.03 + 800, z * 0.03 + 800, 3) - 0.45) * 5, w * 0.95);
    const town = 1 - smoothstep(CONFIG.world.townRadius, CONFIG.world.townRadius + 16, d);
    h = lerp(h, 0.6, town);
    // littoral : la terre plonge dans l'océan
    const cd = coastD(x, z);
    if (cd > -40) h = lerp(h, -9, smoothstep(-34, 12, cd));
    return h;
  }

  _land(x, z) { // relief + plateformes aplanies (points d'intérêt, cryptes)
    let h = this._land0(x, z);
    const fs = this.flatSpots;
    if (fs) for (const f of fs) {
      const dd = Math.hypot(x - f.x, z - f.z);
      if (dd < f.r + 10) h = lerp(h, f.h, 1 - smoothstep(f.r, f.r + 9, dd));
    }
    return h;
  }

  _baseHeight(x, z) {
    const d = Math.hypot(x, z);
    let h = this._land(x, z);
    const carve = 1 - smoothstep(3.5, 13, Math.abs(x - this.riverX(z)));
    h = lerp(h, this.waterLevel - 1.1, carve * (1 - smoothstep(150, 190, d)) * (1 - this.regionW(x, z, 'mount')));
    return h;
  }

  // grille de distance aux routes (+ altitude de la chaussée), construite une fois
  _buildRoads() {
    const { step, half, influence } = ROAD_GRID;
    const n = Math.round((half * 2) / step) + 1;
    this._rg = { n, d: new Float32Array(n * n).fill(999), y: new Float32Array(n * n) };
    this._roadPolys = [];
    for (const pts of ROAD_PTS) {
      // sous-échantillonnage régulier (5 m) avec léger méandre
      const poly = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
        const len = Math.hypot(x1 - x0, z1 - z0), m = Math.max(1, Math.round(len / 5));
        for (let k = 0; k < m; k++) {
          const t = k / m, nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
          const w = Math.sin(i * 1.7 + k * 0.9) * 2.4;
          poly.push([x0 + (x1 - x0) * t + nx * w, z0 + (z1 - z0) * t + nz * w]);
        }
      }
      poly.push(pts[pts.length - 1].slice());
      this._roadPolys.push(poly);
      // altitude lissée de la chaussée (sans rivière : la route traverse en chaussée surélevée)
      let ys = poly.map(([x, z]) => Math.max(this.waterLevel + 1.1, this._land(x, z)));
      for (let pass = 0; pass < 6; pass++) ys = ys.map((_, i) => { let a = 0, c = 0; for (let k = -4; k <= 4; k++) { const j = i + k; if (j >= 0 && j < ys.length) { a += ys[j]; c++; } } return a / c; });
      for (let i = 0; i < poly.length - 1; i++) {
        const [x0, z0] = poly[i], [x1, z1] = poly[i + 1], y0 = ys[i], y1 = ys[i + 1];
        const minx = Math.min(x0, x1) - influence, maxx = Math.max(x0, x1) + influence, minz = Math.min(z0, z1) - influence, maxz = Math.max(z0, z1) + influence;
        const gx0 = Math.max(0, Math.floor((minx + half) / step)), gx1 = Math.min(n - 1, Math.ceil((maxx + half) / step));
        const gz0 = Math.max(0, Math.floor((minz + half) / step)), gz1 = Math.min(n - 1, Math.ceil((maxz + half) / step));
        const sx = x1 - x0, sz = z1 - z0, L2 = sx * sx + sz * sz || 1;
        for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
          const px = gx * step - half, pz = gz * step - half;
          const t = clamp(((px - x0) * sx + (pz - z0) * sz) / L2, 0, 1);
          const d = Math.hypot(px - (x0 + sx * t), pz - (z0 + sz * t));
          const idx = gz * n + gx;
          if (d < this._rg.d[idx]) { this._rg.d[idx] = d; this._rg.y[idx] = y0 + (y1 - y0) * t; }
        }
      }
    }
  }
  _roadAt(x, z) { // { d, y } interpolés (d = 999 hors influence)
    if (!this._rg) this._buildRoads();
    const { step, half } = ROAD_GRID, g = this._rg, n = g.n;
    const fx = (x + half) / step, fz = (z + half) / step;
    if (fx < 0 || fz < 0 || fx >= n - 1 || fz >= n - 1) return null;
    const ix = Math.floor(fx), iz = Math.floor(fz), ux = fx - ix, uz = fz - iz, i0 = iz * n + ix;
    const d00 = g.d[i0], d10 = g.d[i0 + 1], d01 = g.d[i0 + n], d11 = g.d[i0 + n + 1];
    if (d00 > 900 && d10 > 900 && d01 > 900 && d11 > 900) return null;
    const m = (a, b, c, e) => a * (1 - ux) * (1 - uz) + b * ux * (1 - uz) + c * (1 - ux) * uz + e * ux * uz;
    // cellules hors influence : on les traite comme « loin » (12 m)
    const c = (v) => (v > 900 ? 14 : v);
    const near = Math.min(d00, d10, d01, d11);
    // altitude de la chaussée : interpolation (pondérée) des seuls coins sous l'influence d'une route — plus de « marches » de terrain
    const w00 = d00 > 900 ? 0 : (1 - ux) * (1 - uz), w10 = d10 > 900 ? 0 : ux * (1 - uz), w01 = d01 > 900 ? 0 : (1 - ux) * uz, w11 = d11 > 900 ? 0 : ux * uz;
    const ws = w00 + w10 + w01 + w11;
    const y = ws > 1e-6 ? (g.y[i0] * w00 + g.y[i0 + 1] * w10 + g.y[i0 + n] * w01 + g.y[i0 + n + 1] * w11) / ws
      : (near === d00 ? g.y[i0] : near === d10 ? g.y[i0 + 1] : near === d01 ? g.y[i0 + n] : g.y[i0 + n + 1]);
    return { d: m(c(d00), c(d10), c(d01), c(d11)), y };
  }
  roadDist(x, z) { const r = this._roadAt(x, z); return r ? r.d : 999; }

  // V8.6 — la hauteur du sol suit EXACTEMENT le maillage affiché (interpolation triangle par triangle) : plus de pieds qui flottent
  // ou s'enfoncent, plus de saccades, et c'est plus rapide que le calcul analytique. Avant la construction du terrain : formule exacte.
  heightAt(x, z) {
    if (x > 1500) return 0; // arène des Spires d'Éther : sol plat, loin à l'est de la carte
    const g = this._hg;
    if (g) {
      const fx = (x + g.half) / g.seg, fz = (z + g.half) / g.seg;
      if (fx >= 0 && fz >= 0 && fx < g.n - 1 && fz < g.n - 1) {
        const ix = fx | 0, iz = fz | 0, u = fx - ix, v = fz - iz, n = g.n, H = g.h, i0 = iz * n + ix;
        const a = H[i0], b = H[i0 + n], c = H[i0 + n + 1], d = H[i0 + 1]; // sommets (ix,iz) (ix,iz+1) (ix+1,iz+1) (ix+1,iz)
        return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
      }
    }
    return this._heightExact(x, z);
  }

  _heightExact(x, z) {
    if (x > 1500) return 0;
    let h = this._baseHeight(x, z);
    const r = this._roadAt(x, z);
    if (r && r.d < 11) { const k = 1 - smoothstep(3.2, 10.5, r.d); h = lerp(h, r.y, k); }
    if (CONFIG.world.flat) { // V9.1 : terrain plat (plus de falaises ni de marches) ; l'eau, les rivières et le littoral sont conservés
      const wl = this.waterLevel, t = smoothstep(wl - 1.2, wl + 1.0, h);
      h = lerp(h, 0.6 + (h - 0.6) * 0.03, t);
    }
    return h;
  }

  async build(progress) {
    progress(0.12, 'Sculpture du terrain…'); await tick();
    this.pois = planLandmarks(this);
    this.flatSpots = this.pois.map((p) => ({ x: p.x, z: p.z, r: p.flat, h: p.h }));
    this.flatSpots.push({ x: -112, z: 42, r: 21, h: this._land0(-112, 42) }); // Cryptes oubliées
    this.buildTerrain();
    progress(0.35, 'Rivières et lacs…'); await tick();
    this.buildWater();
    progress(0.5, 'Plantation des forêts…'); await tick();
    this.scatterVegetation();
    try { this.scatterDebris(); } catch (e) { console.warn('[V9.3] détails au sol indisponibles', e); }
    progress(0.7, "Construction d'Aetheria…"); await tick();
    this.town = buildTown(this);
    try { this.landmarks = buildLandmarks(this); } catch (e) { console.warn('[V7] repères indisponibles', e); }
    try { this._autoCollide(); } catch (e) { console.warn('[V8.8] collisions automatiques indisponibles', e); }
    progress(0.85, 'Cartographie…'); await tick();
    this.mapCanvas = this.renderMapImage();
  }

  buildTerrain() {
    const { size, segments } = CONFIG.world;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, this._heightExact(pos.getX(i), pos.getZ(i)));
    { const hh = new Float32Array(pos.count); for (let i = 0; i < pos.count; i++) hh[i] = pos.getY(i); this._hg = { h: hh, n: segments + 1, seg: size / segments, half: size / 2 }; }
    geo.computeVertexNormals();
    const nor = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), sand = new THREE.Color(0xb9a56e), rock = new THREE.Color(0x6e6a64);
    const dirt = new THREE.Color(0x6d5638), cobble = new THREE.Color(0x8d8677), snow = new THREE.Color(0xe8eef2);
    const floor = new THREE.Color(0x2b3f1d), dryC = new THREE.Color(0x8c8a3e), mud = new THREE.Color(0x4a3d2a);
    const wl = this.waterLevel;
    const v25 = this.v25;
    const S = segments + 1;
    const PAL = {};
    for (const [id, g2, r2] of [['forest', 0x1b3317, 0x3d4a38], ['mount', 0x6b6a62, 0x7d7b78], ['corrupt', 0x41284f, 0x57406a], ['celeste', 0xd2c18c, 0xece4cf], ['abyss', 0x2a201e, 0x40302c], ['void', 0x211c27, 0x3a3140], ['desert', 0xd8b86a, 0xb08a52], ['swamp', 0x2e3a20, 0x434a31], ['tundra', 0xe2ecf1, 0xb7c6d0]]) PAL[id] = { g: new THREE.Color(g2), r: new THREE.Color(r2) };
    const lava = new THREE.Color(0xff5a1a), vein = new THREE.Color(0xb36cff), crack = new THREE.Color(0xff8a3a), road = new THREE.Color(0x7a6444);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const v = fbm(x * 0.05, z * 0.05, 3);
      c.setHSL(0.26 + v * 0.06, 0.42, 0.2 + v * 0.14);
      if (v25) {
        // variété de biomes : sous-bois sombre, prairies sèches
        const forestN = fbm(x * 0.02 + 200, z * 0.02 + 200, 3);
        c.lerp(floor, smoothstep(0.4, 0.58, forestN) * 0.5);
        const dry = fbm(x * 0.012 + 400, z * 0.012 + 400, 2);
        c.lerp(dryC, smoothstep(0.56, 0.78, dry) * 0.4);
      }
      c.lerp(sand, smoothstep(wl + 0.6, wl - 0.3, y));
      const slope = 1 - nor.getY(i);
      c.lerp(rock, Math.max(smoothstep(0.22, 0.42, slope), smoothstep(14, 22, y)));
      // palettes de région (V7.0)
      let warm = 0;
      for (const id of REGION_IDS) {
        const w = this.regionW(x, z, id);
        if (w < 0.02) continue;
        if (id !== 'forest' && id !== 'mount' && id !== 'tundra') warm = Math.max(warm, w);
        c.lerp(PAL[id].g, w * 0.82);
        c.lerp(PAL[id].r, smoothstep(0.2, 0.4, slope) * w * 0.85);
        if (id === 'abyss') { const a = Math.abs(fbm(x * 0.012 + 130, z * 0.012 + 130, 4) - 0.5) * 2; c.lerp(lava, (1 - smoothstep(0.035, 0.09, a)) * w); }
        else if (id === 'corrupt') { const rv = Math.abs(fbm(x * 0.05 + 11, z * 0.05 + 7, 3) * 2 - 1); c.lerp(vein, (1 - smoothstep(0.02, 0.07, rv)) * w * 0.8); }
        else if (id === 'void') { const rv = Math.abs(fbm(x * 0.045 + 5, z * 0.045 + 31, 3) * 2 - 1); c.lerp(crack, (1 - smoothstep(0.015, 0.05, rv)) * w); }
      }
      c.lerp(snow, smoothstep(27, 33, y) * (1 - warm));
      const rd = this.roadDist(x, z);
      if (rd < 6) c.lerp(road, (1 - smoothstep(1.8, 3.6, rd)) * 0.85);
      c.lerp(cobble, (1 - smoothstep(20, 24, Math.hypot(x, z))) * (0.75 + v * 0.3));
      if (v25) {
        // berge humide + occlusion ambiante par courbure (vallées plus sombres)
        c.lerp(mud, smoothstep(wl + 0.9, wl + 0.1, y) * 0.35);
        const ix = i % S, iz = (i / S) | 0;
        if (ix > 0 && iz > 0 && ix < S - 1 && iz < S - 1) {
          const avg = (pos.getY(i - 1) + pos.getY(i + 1) + pos.getY(i - S) + pos.getY(i + S)) * 0.25;
          const shade = 1 - Math.max(-0.14, Math.min(0.26, (avg - y) * 0.13));
          c.multiplyScalar(shade);
        }
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    if (v25) {
      const detail = safeTexture(groundDetailTexture);
      if (detail) {
        detail.repeat.set(size / 4, size / 4);
        mat.map = detail;
        mat.color.setScalar(1.25);
        if (!isSafeMode()) {
          // 2e échantillonnage à grande échelle : casse la répétition du détail
          mat.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
#ifdef USE_MAP
  diffuseColor.rgb *= mix(vec3(1.0), texture2D(map, vMapUv * 0.067 + vec2(0.37, 0.11)).rgb * 1.2, 0.65);
#endif`);
          };
          mat.customProgramCacheKey = () => 'terrain_v25';
        }
      }
    }
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.group.add(this.terrain);
  }

  buildWater() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#5b8fb0';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.08})`;
      g.beginPath();
      g.ellipse(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 9, 1 + Math.random() * 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    this.waterTex = new THREE.CanvasTexture(c);
    this.waterTex.colorSpace = THREE.SRGBColorSpace;
    this.waterTex.wrapS = this.waterTex.wrapT = THREE.RepeatWrapping;
    this.waterTex.repeat.set(70, 70);
    const geo = new THREE.PlaneGeometry(CONFIG.world.size, CONFIG.world.size);
    geo.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.waterTex, color: 0x4a86a8, transparent: true, opacity: 0.8, roughness: 0.12, metalness: 0.15 }));
    this.water.position.y = this.waterLevel;
    this.group.add(this.water);
    if (this.v25) {
      const sp = safeTexture(waterSparkleTexture);
      if (sp) {
        sp.repeat.set(110, 110);
        this.waterTex2 = sp;
        const g2 = new THREE.PlaneGeometry(CONFIG.world.size, CONFIG.world.size);
        g2.rotateX(-Math.PI / 2);
        this.water2 = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ map: sp, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
        this.water2.position.y = this.waterLevel + 0.03;
        this.group.add(this.water2);
      }
    }
  }

  // ---------- Végétation ----------
  scatterVegetation() {
    if (this.v25) {
      try { this._scatterV25(); return; } catch (e) { console.warn('[V2.5] végétation avancée indisponible, retour au mode classique', e); this._v25Fallback = true; }
    }
    this._scatterLegacy();
  }

  _scatterLegacy() {
    const rnd = this.rand, half = CONFIG.world.bound - 8;
    const wl = this.waterLevel, tr = CONFIG.world.townRadius;
    const valid = (x, z, h, minTown) => {
      if (h < wl + 0.7 || h > 20) return false;
      if (Math.hypot(x, z) < tr + minTown) return false;
      if (this.roadDist(x, z) < 4) return false;
      const gx = this.heightAt(x + 1.2, z) - h, gz = this.heightAt(x, z + 1.2) - h;
      return Math.abs(gx) < 1 && Math.abs(gz) < 1;
    };

    // Arbres, répartis en chunks pour un frustum culling efficace
    const per = Array.from({ length: CHUNKS * CHUNKS }, () => []);
    const cs = (half * 2) / CHUNKS;
    for (let tries = 0, n = 0; n < MAX_TREES && tries < 70000; tries++) {
      const x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half;
      const h = this.heightAt(x, z);
      if (!valid(x, z, h, 6)) continue;
      if (fbm(x * 0.02 + 200, z * 0.02 + 200, 3) < 0.4 && rnd() > 0.06) continue;
      const cx = clamp(Math.floor((x + half) / cs), 0, CHUNKS - 1), cz = clamp(Math.floor((z + half) / cs), 0, CHUNKS - 1);
      per[cx * CHUNKS + cz].push({ x, y: h, z, s: 0.8 + rnd() * 0.9, r: rnd() * 6.28, v: rnd() });
      n++;
    }
    const treeGeo = mergeGeometries([
      paint(new THREE.CylinderGeometry(0.16, 0.26, 2.2, 6).translate(0, 1.1, 0), 0x4b3421),
      paint(new THREE.ConeGeometry(1.6, 3.0, 7).translate(0, 3.3, 0), 0x1f4a26),
      paint(new THREE.ConeGeometry(1.25, 2.5, 7).translate(0, 4.7, 0), 0x25562b),
      paint(new THREE.ConeGeometry(0.8, 2.0, 7).translate(0, 5.9, 0), 0x2c6231)
    ]);
    const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    for (const list of per) {
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(treeGeo, treeMat, list.length);
      list.forEach((t, i) => {
        dummy.position.set(t.x, t.y - 0.1, t.z);
        dummy.rotation.set(0, t.r, 0);
        dummy.scale.set(t.s, t.s * (0.9 + t.v * 0.4), t.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, col.setRGB(0.8 + t.v * 0.4, 0.85 + t.v * 0.3, 0.8 + t.v * 0.25));
        t.col = this.addCircle(t.x, t.z, 0.45 * t.s);
      });
      mesh.castShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      this.treeChunks.push({ mesh, total: list.length, list });
    }

    // Rochers
    const rocks = [];
    for (let tries = 0; rocks.length < 650 && tries < 16000; tries++) {
      const x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half;
      const h = this.heightAt(x, z);
      if (h < wl + 0.3 || Math.hypot(x, z) < tr + 4) continue;
      if (this.roadDist(x, z) < 3.5) continue;
      rocks.push({ x, y: h, z, s: 0.5 + rnd() * rnd() * 2.6, r: rnd() * 6.28, v: rnd() });
    }
    const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x7d7b78, roughness: 1, flatShading: true }), rocks.length);
    rocks.forEach((r, i) => {
      dummy.position.set(r.x, r.y + r.s * 0.15, r.z);
      dummy.rotation.set(r.v * 3, r.r, r.v * 2);
      dummy.scale.set(r.s * 1.2, r.s * 0.75, r.s);
      dummy.updateMatrix();
      rockMesh.setMatrixAt(i, dummy.matrix);
      rockMesh.setColorAt(i, col.setScalar(0.7 + r.v * 0.5));
      if (r.s > 0.7) this.addCircle(r.x, r.z, r.s * 1.0);
    });
    rockMesh.castShadow = rockMesh.receiveShadow = true;
    rockMesh.computeBoundingSphere();
    this.group.add(rockMesh);

    // Buissons
    const bushes = [];
    for (let tries = 0; bushes.length < 950 && tries < 16000; tries++) {
      const x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half;
      const h = this.heightAt(x, z);
      if (!valid(x, z, h, 3)) continue;
      bushes.push({ x, y: h, z, s: 0.6 + rnd() * 0.8, v: rnd() });
    }
    const bushMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 1), new THREE.MeshStandardMaterial({ color: 0x3f7a35, roughness: 1, flatShading: true }), bushes.length);
    bushes.forEach((b, i) => {
      dummy.position.set(b.x, b.y + 0.2 * b.s, b.z);
      dummy.rotation.set(0, b.v * 6, 0);
      dummy.scale.set(b.s * 1.3, b.s * 0.8, b.s * 1.3);
      dummy.updateMatrix();
      bushMesh.setMatrixAt(i, dummy.matrix);
      bushMesh.setColorAt(i, col.setRGB(0.7 + b.v * 0.5, 0.8 + b.v * 0.4, 0.6 + b.v * 0.3));
    });
    bushMesh.castShadow = true;
    bushMesh.computeBoundingSphere();
    this.group.add(bushMesh);
  }


  // ---------- Végétation V2.5 : espèces variées, rochers organiques, détails ----------
  _scatterV25() {
    const lod = this.vq && this.vq.trees <= 0.3 ? 'lo' : 'hi';
    // 1) Géométries d'abord : si l'une échoue on retombe sur le mode classique sans rien avoir posé
    const G = {
      pine: FO.pineGeometry(lod), oak: FO.oakGeometry(lod, 'green'), light: FO.oakGeometry(lod, 'light'),
      autumn: FO.oakGeometry(lod, 'autumn'), birch: FO.birchGeometry(lod), dead: FO.deadTreeGeometry()
    };
    const rocksG = [FO.boulderGeometry(1), FO.boulderGeometry(7), FO.rockClusterGeometry()];
    const bushG = FO.bushGeometry(lod), stumpG = FO.stumpGeometry(), logG = FO.logGeometry(), mushG = FO.mushroomGeometry(), reedG = FO.reedGeometry();

    const rnd = this.rand, half = CONFIG.world.bound - 8;
    const wl = this.waterLevel, tr = CONFIG.world.townRadius;
    const valid = (x, z, h, minTown) => {
      if (h < wl + 0.7 || h > 20) return false;
      if (Math.hypot(x, z) < tr + minTown) return false;
      if (this.roadDist(x, z) < 4) return false;
      const gx = this.heightAt(x + 1.2, z) - h, gz = this.heightAt(x, z + 1.2) - h;
      return Math.abs(gx) < 1 && Math.abs(gz) < 1;
    };

    // Arbres : une liste par (espèce, chunk)
    const SP = ['pine', 'oak', 'light', 'autumn', 'birch', 'dead'];
    const per = {};
    for (const k of SP) per[k] = Array.from({ length: CHUNKS * CHUNKS }, () => []);
    const cs = (half * 2) / CHUNKS;
    for (let tries = 0, n = 0; n < MAX_TREES && tries < 42000; tries++) {
      const x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half;
      const h = this.heightAt(x, z);
      if (!valid(x, z, h, 6)) continue;
      const bm = this.biomeAt(x, z), r = rnd();
      let sp, tint = [1, 1, 1];
      if (bm === 'void') continue; // le Néant est stérile
      else if (bm === 'desert') { if (rnd() > 0.045) continue; sp = 'dead'; tint = [1.15, 0.95, 0.6]; }
      else if (bm === 'swamp') { if (rnd() > 0.5) continue; sp = r < 0.62 ? 'dead' : 'oak'; tint = [0.6, 0.72, 0.42]; }
      else if (bm === 'tundra') { if (rnd() > 0.3) continue; sp = r < 0.92 ? 'pine' : 'dead'; tint = [0.86, 0.96, 1.12]; }
      else if (bm === 'abyss') { if (rnd() > 0.12) continue; sp = 'dead'; tint = [0.55, 0.4, 0.4]; }
      else if (bm === 'corrupt') { if (rnd() > 0.4) continue; sp = r < 0.82 ? 'dead' : 'pine'; tint = [0.85, 0.55, 1.05]; }
      else if (bm === 'celeste') { if (rnd() > 0.35) continue; sp = r < 0.5 ? 'birch' : 'light'; tint = [1.25, 1.12, 0.7]; }
      else if (bm === 'forest') { if (rnd() > 0.95) continue; sp = r < 0.78 ? 'pine' : r < 0.9 ? 'oak' : 'dead'; tint = [0.62, 0.78, 0.66]; }
      else if (bm === 'mount') { if (h > 17 || rnd() > 0.35) continue; sp = r < 0.9 ? 'pine' : 'dead'; tint = [0.85, 0.95, 0.9]; }
      else {
        if (fbm(x * 0.02 + 200, z * 0.02 + 200, 3) < 0.4 && rnd() > 0.06) continue;
        const biome = fbm(x * 0.007 + 500, z * 0.007 + 500, 3), d = Math.hypot(x, z);
        if (d > 120 && r < 0.035) sp = 'dead';
        else if (h > 9 || biome < 0.42) sp = r < 0.85 ? 'pine' : 'birch';
        else if (biome > 0.56) sp = r < 0.45 ? 'autumn' : r < 0.8 ? 'oak' : 'birch';
        else sp = r < 0.38 ? 'oak' : r < 0.68 ? 'light' : r < 0.85 ? 'birch' : 'pine';
      }
      const cx = clamp(Math.floor((x + half) / cs), 0, CHUNKS - 1), cz = clamp(Math.floor((z + half) / cs), 0, CHUNKS - 1);
      per[sp][cx * CHUNKS + cz].push({ x, y: h, z, s: 0.8 + rnd() * 0.9, r: rnd() * 6.28, v: rnd(), tint, tx: (rnd() - 0.5) * 0.08, tz: (rnd() - 0.5) * 0.08 });
      n++;
    }
    const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    addSway(treeMat, { amp: 0.16, height: 8, speed: 1.1 });
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    for (const sp of SP) {
      for (const list of per[sp]) {
        if (!list.length) continue;
        const mesh = new THREE.InstancedMesh(G[sp], treeMat, list.length);
        list.forEach((t, i) => {
          dummy.position.set(t.x, t.y - 0.1, t.z);
          dummy.rotation.set(t.tx, t.r, t.tz);
          dummy.scale.set(t.s, t.s * (0.9 + t.v * 0.4), t.s);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, col.setRGB((0.82 + t.v * 0.36) * t.tint[0], (0.86 + t.v * 0.28) * t.tint[1], (0.82 + t.v * 0.24) * t.tint[2]));
          t.col = this.addCircle(t.x, t.z, 0.45 * t.s);
        });
        mesh.castShadow = true;
        mesh.computeBoundingSphere();
        this.group.add(mesh);
        this.treeChunks.push({ mesh, total: list.length, list });
      }
    }

    // Rochers : 3 variantes (2 blocs + amas)
    const rocks = [[], [], []];
    for (let tries = 0, tot = 0; tot < 650 && tries < 16000; tries++) {
      const x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half;
      const h = this.heightAt(x, z);
      if (h < wl + 0.3 || Math.hypot(x, z) < tr + 4) continue;
      if (this.roadDist(x, z) < 3.5) continue;
      const kind = rnd() < 0.55 ? 0 : rnd() < 0.5 ? 1 : 2;
      rocks[kind].push({ x, y: h, z, s: 0.5 + rnd() * rnd() * 2.6, r: rnd() * 6.28, v: rnd() });
      tot++;
    }
    rocks.forEach((list, k) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(rocksG[k], new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), list.length);
      list.forEach((r, i) => {
        const sc = k === 2 ? r.s * 0.8 : r.s;
        dummy.position.set(r.x, r.y + sc * 0.05, r.z);
        dummy.rotation.set((r.v - 0.5) * 0.4, r.r, (r.v - 0.5) * 0.3);
        dummy.scale.set(sc * 1.15, sc * (0.7 + r.v * 0.5), sc);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, col.setScalar(0.75 + r.v * 0.45));
        if (r.s > 0.7) this.addCircle(r.x, r.z, sc * 1.0);
      });
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
    });

    // Buissons
    const bushes = [];
    for (let tries = 0; bushes.length < 950 && tries < 16000; tries++) {
      const x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half;
      const h = this.heightAt(x, z);
      if (!valid(x, z, h, 3)) continue;
      bushes.push({ x, y: h, z, s: 0.7 + rnd() * 0.9, v: rnd() });
    }
    const bushMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    addSway(bushMat, { amp: 0.07, height: 1.2, speed: 1.4 });
    const bushMesh = new THREE.InstancedMesh(bushG, bushMat, bushes.length);
    bushes.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(0, b.v * 6, 0);
      dummy.scale.set(b.s, b.s * (0.8 + b.v * 0.4), b.s);
      dummy.updateMatrix();
      bushMesh.setMatrixAt(i, dummy.matrix);
      bushMesh.setColorAt(i, col.setRGB(0.75 + b.v * 0.5, 0.85 + b.v * 0.35, 0.7 + b.v * 0.3));
    });
    bushMesh.castShadow = true;
    bushMesh.computeBoundingSphere();
    this.group.add(bushMesh);

    // Détails de sol : souches, troncs couchés, champignons, roseaux
    const scatterProps = (geo, count, tries, accept, setup, mat, shadow = true) => {
      const list = [];
      for (let t = 0; list.length < count && t < tries; t++) {
        const x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half;
        const h = this.heightAt(x, z);
        if (!accept(x, z, h)) continue;
        list.push({ x, y: h, z, r: rnd() * 6.28, v: rnd() });
      }
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((o, i) => {
        dummy.position.set(o.x, o.y - 0.02, o.z);
        dummy.rotation.set(0, o.r, 0);
        dummy.scale.setScalar(1);
        setup(o, dummy);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, col.setScalar(0.8 + o.v * 0.4));
      });
      mesh.castShadow = shadow;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
    };
    const forest = (x, z) => fbm(x * 0.02 + 200, z * 0.02 + 200, 3) > 0.46;
    const vcMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    scatterProps(stumpG, 170, 5000, (x, z, h) => valid(x, z, h, 8) && forest(x, z), (o, d) => { const s = 0.7 + o.v * 0.9; d.scale.set(s, s * (0.8 + o.v * 0.5), s); this.addCircle(o.x, o.z, 0.35 * s); }, vcMat());
    scatterProps(logG, 110, 5000, (x, z, h) => valid(x, z, h, 8) && forest(x, z), (o, d) => { const s = 0.8 + o.v * 0.8; d.scale.setScalar(s); }, vcMat());
    scatterProps(mushG, 320, 6000, (x, z, h) => valid(x, z, h, 6) && forest(x, z), (o, d) => { const s = 0.7 + o.v * 1.1; d.scale.setScalar(s); }, vcMat(), false);
    const reedMat = vcMat();
    addSway(reedMat, { amp: 0.1, height: 1.2, speed: 1.6 });
    scatterProps(reedG, 260, 14000, (x, z, h) => h > wl - 0.25 && h < wl + 0.55 && Math.hypot(x, z) > tr + 8, (o, d) => { const s = 0.8 + o.v * 0.8; d.scale.set(s, s, s); }, reedMat, false);
    this._v25Foliage = true;
    try { this._scatterBiomeProps(); } catch (e) { console.warn('[V7] décors de région indisponibles', e); }
  }


  // ---------- V7.0 : décors propres à chaque région ----------
  _scatterBiomeProps() {
    const rnd = this.rand, wl = this.waterLevel, dummy = new THREE.Object3D(), col = new THREE.Color();
    const pick = (id, n, minW = 0.55, hMax = 60) => {
      const R = REGIONS[REGION_INDEX[id]], out = [], rad = 190 * R.w;
      for (let t = 0; out.length < n && t < n * 60; t++) {
        const a = rnd() * 6.2832, r = Math.sqrt(rnd()) * rad;
        const x = R.site[0] + Math.cos(a) * r, z = R.site[1] + Math.sin(a) * r;
        if (Math.hypot(x, z) > CONFIG.world.bound - 10) continue;
        if (this.regionW(x, z, id) < minW) continue;
        const h = this.heightAt(x, z);
        if (h < wl + 0.8 || h > hMax) continue;
        if (this.roadDist(x, z) < 5.5) continue;
        out.push({ x, y: h, z, v: rnd(), r: rnd() * 6.28 });
      }
      return out;
    };
    const mesh = (geo, mat, list, setup, collide = 0) => {
      if (!list.length) return;
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((o, i) => {
        dummy.position.set(o.x, o.y, o.z); dummy.rotation.set(0, o.r, 0); dummy.scale.setScalar(1);
        setup(o, dummy); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
        m.setColorAt(i, col.setScalar(0.8 + o.v * 0.4));
        if (collide) { // rayon de collision proportionnel à la taille réelle de chaque instance
          const gp = geo.parameters || {}, br = Math.max(gp.radiusTop || 0, gp.radiusBottom || 0, gp.radius || 0) || 1;
          const rr = Math.max(dummy.scale.x, dummy.scale.z) * br * 0.82;
          if (rr > 0.3) this.addCircle(o.x, o.z, rr);
        }
      });
      m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere();
      this.group.add(m);
    };
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
    const cyl = new THREE.CylinderGeometry(0.75, 1, 1, 7), cone = new THREE.ConeGeometry(1, 1, 5), octa = new THREE.OctahedronGeometry(1, 0), dode = new THREE.DodecahedronGeometry(1, 0);
    // Néant : piliers de basalte fracturés + débris en lévitation
    mesh(cyl, std(0x2b2530), pick('void', 55), (o, d) => { const h = 5 + o.v * 15; o.cs = 1; d.position.y = o.y + h / 2 - 0.5; d.scale.set(1.6 + o.v * 1.4, h, 1.6 + o.v * 1.4); d.rotation.z = (o.v - 0.5) * 0.12; }, 1.9);
    mesh(dode, std(0x3a3140, { emissive: 0x5a2a10, emissiveIntensity: 0.6 }), pick('void', 45, 0.5), (o, d) => { d.position.y = o.y + 5 + o.v * 9; const s = 0.8 + o.v * 1.8; d.scale.set(s * 1.3, s * 0.8, s); d.rotation.set(o.v * 3, o.r, o.v * 2); });
    // Abysses : éclats d'obsidienne
    mesh(cone, std(0x1c1618, { emissive: 0x4a1208, emissiveIntensity: 0.5 }), pick('abyss', 130, 0.5), (o, d) => { const h = 2 + o.v * 7; d.position.y = o.y + h / 2 - 0.3; d.scale.set(0.7 + o.v * 1.1, h, 0.7 + o.v * 1.1); d.rotation.z = (o.v - 0.5) * 0.35; }, 0.8);
    // Terres corrompues : cristaux violets
    mesh(octa, std(0x7d3fc0, { emissive: 0x6a2bb0, emissiveIntensity: 0.9, roughness: 0.4 }), pick('corrupt', 100, 0.5), (o, d) => { const h = 1.6 + o.v * 4.2; d.position.y = o.y + h * 0.9; d.scale.set(0.5 + o.v * 0.5, h, 0.5 + o.v * 0.5); d.rotation.z = (o.v - 0.5) * 0.5; }, 0.6);
    // Royaume céleste : colonnes de marbre (certaines brisées)
    mesh(cyl, std(0xeee6d2, { roughness: 0.6 }), pick('celeste', 70, 0.55), (o, d) => { const h = o.v < 0.4 ? 1.2 + o.v * 3 : 5 + o.v * 4; d.position.y = o.y + h / 2 - 0.2; d.scale.set(0.55, h, 0.55); }, 0.7);
    // Montagnes de fer : gros blocs
    mesh(dode, std(0x6b6a66), pick('mount', 70, 0.5), (o, d) => { const s = 1.5 + o.v * 3.2; d.position.y = o.y + s * 0.3; d.scale.set(s * 1.2, s * 0.8, s); d.rotation.set(o.v * 3, o.r, o.v * 2); }, 1.3);
    // V8.0 — Désert d'Ambre : cactus et rochers de grès
    const sandstone = std(0xb98e52), cactusM = std(0x4f7a3a);
    mesh(cyl, cactusM, pick('desert', 95, 0.6), (o, d) => { const h = 1.6 + o.v * 2.6; d.position.y = o.y + h / 2 - 0.1; d.scale.set(0.4 + o.v * 0.12, h, 0.4 + o.v * 0.12); }, 0.55);
    mesh(dode, sandstone, pick('desert', 85, 0.55), (o, d) => { const s2 = 1.2 + o.v * 3.4; d.position.y = o.y + s2 * 0.3; d.scale.set(s2 * 1.3, s2 * 0.75, s2); d.rotation.set(o.v * 2, o.r, o.v); }, 1.2);
    // Marais de Brume : souches pourries, roseaux géants et feux follets
    mesh(cyl, std(0x3b2f22), pick('swamp', 85, 0.6), (o, d) => { const h = 0.8 + o.v * 2.2; d.position.y = o.y + h / 2 - 0.15; d.scale.set(0.5 + o.v * 0.4, h, 0.5 + o.v * 0.4); d.rotation.z = (o.v - 0.5) * 0.3; }, 0.6);
    mesh(cone, std(0x4d6a2c), pick('swamp', 160, 0.55), (o, d) => { const h = 1.8 + o.v * 2.2; d.position.y = o.y + h / 2 - 0.1; d.scale.set(0.3, h, 0.3); }, 0);
    mesh(octa, new THREE.MeshBasicMaterial({ color: 0x9dffb0 }), pick('swamp', 40, 0.6), (o, d) => { d.position.y = o.y + 1.4 + o.v * 1.4; d.scale.setScalar(0.16 + o.v * 0.08); });
    // Toundra de Givre : pointes de glace et rochers enneigés
    mesh(cone, std(0xbfe6f5, { emissive: 0x4a7a90, emissiveIntensity: 0.45, roughness: 0.3 }), pick('tundra', 110, 0.55), (o, d) => { const h = 1.5 + o.v * 5; d.position.y = o.y + h / 2 - 0.2; d.scale.set(0.5 + o.v * 0.7, h, 0.5 + o.v * 0.7); d.rotation.z = (o.v - 0.5) * 0.25; }, 0.6);
    mesh(dode, std(0xe6eef2), pick('tundra', 70, 0.55), (o, d) => { const s2 = 1.2 + o.v * 2.8; d.position.y = o.y + s2 * 0.3; d.scale.set(s2 * 1.2, s2 * 0.8, s2); d.rotation.set(o.v * 2, o.r, o.v); }, 1.1);
  }

  // Herbe et fleurs dynamiques autour du joueur (appelé par Game après build())
  initGrass(scene, quality) {
    if (!this.v25) return;
    const density = { verylow: 0, low: 2, medium: 3, high: 4, ultra: 5 }[quality] ?? 3;
    if (!density) return;
    try {
      this.grass = new GrassField(scene, this, { density, cells: quality === 'low' ? 24 : 30 });
    } catch (e) { console.warn('[V2.5] herbe indisponible', e); this.grass = null; }
  }

  // V9.3 : petits détails au sol (cailloux, brindilles sèches, ossements) — rendent le sol moins « lisse », sans collision
  scatterDebris() {
    const rnd = mulberry32(90317), wl = this.waterLevel, tr = CONFIG.world.townRadius, B = CONFIG.world.bound - 20;
    const kinds = [
      { geo: new THREE.IcosahedronGeometry(1, 0), n: 1500, mat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), scale: () => [0.12 + rnd() * 0.26, 0.08 + rnd() * 0.16, 0.12 + rnd() * 0.26], cols: [0x8a8070, 0x7a7266, 0x9c9180, 0x6c655a], lift: 0.02 },
      { geo: new THREE.BoxGeometry(1, 1, 1), n: 600, mat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), scale: () => [0.04 + rnd() * 0.05, 0.03 + rnd() * 0.03, 0.5 + rnd() * 0.9], cols: [0x5a4630, 0x6b5638, 0x4a3b2a], lift: 0.03 },
      { geo: new THREE.BoxGeometry(1, 1, 1), n: 160, mat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), scale: () => [0.07, 0.05, 0.35 + rnd() * 0.3], cols: [0xd8d0b8, 0xcfc6aa], lift: 0.03 }
    ];
    const cs = 330, dummy = new THREE.Object3D(), col = new THREE.Color();
    this.debris = [];
    for (const k of kinds) {
      const cells = new Map();
      for (let i = 0, tries = 0; i < k.n && tries < k.n * 6; tries++) {
        const x = (rnd() * 2 - 1) * B, z = (rnd() * 2 - 1) * B;
        const h = this.heightAt(x, z), d = Math.hypot(x, z);
        if (h < wl + 0.6 || d < tr + 4) continue;
        i++;
        const key = Math.floor((x + 500) / cs) + ',' + Math.floor((z + 500) / cs);
        (cells.get(key) || cells.set(key, []).get(key)).push([x, h, z]);
      }
      for (const list of cells.values()) {
        const im = new THREE.InstancedMesh(k.geo, k.mat, list.length);
        list.forEach(([x, h, z], j) => {
          const [sx, sy, sz] = k.scale();
          dummy.position.set(x, h + sy * 0.4 + k.lift, z); dummy.rotation.set((rnd() - 0.5) * 0.3, rnd() * 6.283, (rnd() - 0.5) * 0.3); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
          im.setMatrixAt(j, dummy.matrix);
          col.setHex(k.cols[(rnd() * k.cols.length) | 0]).multiplyScalar(0.85 + rnd() * 0.3); im.setColorAt(j, col);
        });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere();
        this.group.add(im); this.debris.push(im);
      }
    }
  }
  setDebrisVisible(v) { for (const m of this.debris || []) m.visible = !!v; }

  setGrassVisible(v) { if (this.grass) this.grass.setVisible(v); }
  updateGrass(px, pz) { if (this.grass) this.grass.update(px, pz); }

  setTreeDensity(f) {
    for (const ch of this.treeChunks) {
      const n = Math.floor(ch.total * f);
      ch.mesh.count = n;
      // V8.6 : un arbre masqué par la qualité graphique n'a plus de collision (plus de murs invisibles)
      if (ch.list) for (let i = 0; i < ch.list.length; i++) { const c = ch.list[i].col; if (c) c.off = i >= n; }
    }
  }

  // V8.8 — filet de sécurité : tout objet solide visible (poteau, pilier, stèle, banc…) sans aucune collision en reçoit une.
  // (Repérés par audit : piliers des cercles de pierre, poteaux d'autels, etc. que l'on traversait.)
  _autoCollide() {
    this.group.updateMatrixWorld(true);
    const box = new THREE.Box3(), sz = new THREE.Vector3(), ct = new THREE.Vector3();
    let added = 0;
    this.group.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o === this.terrain || o === this.water || o === this.water2) return;
      for (let p = o; p; p = p.parent) if (p.visible === false) return;
      if (o.material && o.material.transparent && o.material.opacity < 0.6) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.getSize(sz); box.getCenter(ct);
      const hx = sz.x / 2, hz = sz.z / 2, g = this.heightAt(ct.x, ct.z), h = box.max.y - g;
      if (h < 1.2 || box.min.y - g > 1.0 || hx < 0.25 || hz < 0.25 || hx > 12 || hz > 12 || ct.x > 1500) return;
      for (const [a, b] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) if (this.blockedCircle(ct.x + a * hx, ct.z + b * hz, 0.05)) return;
      if (hx <= 1.6 && hz <= 1.6) this.addCircle(ct.x, ct.z, Math.max(0.3, Math.max(hx, hz) * 0.9));
      else this.addBox(ct.x, ct.z, hx, hz, g - 1, box.max.y);
      added++;
    });
    this._autoColliders = added;
  }

  // ---------- Collisions (grille spatiale) ----------
  _key(cx, cz) { return (cx + 64) * 256 + (cz + 64); }
  _insert(o, ext) {
    const e = ext + 1;
    // (retourne l'objet pour pouvoir le désactiver : arbres masqués par la qualité graphique)
    const x0 = Math.floor((o.x - e) / CELL), x1 = Math.floor((o.x + e) / CELL);
    const z0 = Math.floor((o.z - e) / CELL), z1 = Math.floor((o.z + e) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = this._key(cx, cz);
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(o);
      }
    }
    return o;
  }
  addCircle(x, z, r) { return this._insert({ t: 0, x, z, r }, r); }
  addBox(x, z, hw, hd, y0, y1) { this._insert({ t: 1, x, z, hw, hd, y0, y1 }, Math.max(hw, hd)); }

  pushOut(pos, radius) {
    for (let pass = 0; pass < 3; pass++) { // plusieurs passes : plus de « tremblement » ni de traversée quand plusieurs obstacles se touchent
      const list = this.grid.get(this._key(Math.floor(pos.x / CELL), Math.floor(pos.z / CELL)));
      if (!list) return;
      let moved = false;
      for (const o of list) {
        if (o.off) continue;
        if (o.t === 0) {
          const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), m = o.r + radius;
          if (d < m) {
            moved = true;
            if (d < 1e-4) pos.x += m;
            else { pos.x = o.x + (dx / d) * m; pos.z = o.z + (dz / d) * m; }
          }
        } else {
          const nx = clamp(pos.x, o.x - o.hw, o.x + o.hw), nz = clamp(pos.z, o.z - o.hd, o.z + o.hd);
          const dx = pos.x - nx, dz = pos.z - nz, d = Math.hypot(dx, dz);
          if (d < radius) {
            moved = true;
            if (d > 1e-4) { pos.x = nx + (dx / d) * radius; pos.z = nz + (dz / d) * radius; }
            else {
              const px = o.hw - Math.abs(pos.x - o.x), pz = o.hd - Math.abs(pos.z - o.z);
              if (px < pz) pos.x += (pos.x >= o.x ? 1 : -1) * (px + radius);
              else pos.z += (pos.z >= o.z ? 1 : -1) * (pz + radius);
            }
          }
        }
      }
      if (!moved) return;
    }
  }

  blockedCircle(x, z, r) {
    const list = this.grid.get(this._key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return false;
    for (const o of list) {
      if (o.off) continue;
      if (o.t === 0) { if (Math.hypot(x - o.x, z - o.z) < o.r + r) return true; }
      else if (Math.abs(x - o.x) < o.hw + r && Math.abs(z - o.z) < o.hd + r) return true;
    }
    return false;
  }

  collidesPoint(x, y, z) {
    const list = this.grid.get(this._key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return false;
    for (const o of list) {
      if (o.t === 1 && Math.abs(x - o.x) < o.hw && Math.abs(z - o.z) < o.hd && y > o.y0 && y < o.y1) return true;
    }
    return false;
  }

  // supprime les colliders d'une zone rectangulaire (fin d'une spire)
  clearColliders(x0, z0, x1, z1) {
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) this.grid.delete(this._key(cx, cz));
    }
  }

  // V8.6 — terrain : eau/océan, limites du monde et falaises (pente montante trop raide). Les obstacles sont gérés par pushOut (glissement).
  terrainOk(x, z) {
    if (x > 1500) return true;
    return Math.hypot(x, z) < CONFIG.world.bound && this.heightAt(x, z) > this.waterLevel - 0.35;
  }
  canStep(x0, z0, x1, z1) {
    if (!this.terrainOk(x1, z1)) return false;
    if (x1 > 1500) return true;
    const d = Math.hypot(x1 - x0, z1 - z0);
    if (d > 1e-6 && (this.heightAt(x1, z1) - this.heightAt(x0, z0)) / d > 1.8) return false; // falaise
    return true;
  }

  isWalkable(x, z, r) {
    if (x > 1500) return !this.blockedCircle(x, z, r);
    return Math.hypot(x, z) < CONFIG.world.bound && this.heightAt(x, z) > this.waterLevel - 0.35 && !this.blockedCircle(x, z, r);
  }

  // ---------- Animation ----------
  update(dt, night, particles) {
    this.waterTex.offset.x += dt * 0.004;
    this.waterTex.offset.y += dt * 0.0025;
    if (this.waterTex2) { this.waterTex2.offset.x -= dt * 0.006; this.waterTex2.offset.y += dt * 0.004; }
    this.windowMat.emissiveIntensity = night * 1.8;
    if (this.landmarks) this.landmarks.update(performance.now() * 0.001);
    const t = performance.now() * 0.001;
    for (const tc of this.torches) {
      const f = 0.85 + Math.sin(t * 9 + tc.phase) * 0.12 + Math.sin(t * 23 + tc.phase * 2) * 0.05;
      tc.flame.scale.set(f, f * 1.3, f);
      tc.light.intensity = (0.5 + night * 3.2) * f;
      if (particles && Math.random() < dt * 3) particles.emit(tc.x, tc.y, tc.z, { count: 1, color: 0xff9a3a, speed: 0.6, life: 0.9, gravity: -1.2, up: 1, spread: 0.3 });
    }
    if (particles && this.chimneys) {
      for (const ch of this.chimneys) {
        if (Math.random() < dt * 1.4) particles.emit(ch.x, ch.y, ch.z, { count: 1, color: 0x8a8f99, speed: 0.5, life: 2.4, gravity: -0.7, up: 1, spread: 0.25 });
      }
    }
  }

  renderMapImage() {
    const S = 300, size = CONFIG.world.size;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const col = new THREE.Color();
    const best = new Int8Array(S * S);
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const x = (px / S - 0.5) * size, z = (py / S - 0.5) * size;
      best[py * S + px] = coastD(x, z) < 0 ? regionField(x, z).best : -1;
    }
    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        const x = (px / S - 0.5) * size, z = (py / S - 0.5) * size;
        const h = this.heightAt(x, z), d = Math.hypot(x, z);
        const bm = REGIONS[regionField(x, z).best].id;
        const v = fbm(x * 0.05, z * 0.05, 2);
        if (h < this.waterLevel) { const deep = Math.min(1, (this.waterLevel - h) / 8); col.setRGB(0.2 - deep * 0.1, 0.42 - deep * 0.16, 0.62 - deep * 0.14); }
        else if (d < CONFIG.world.townRadius) col.setRGB(0.6, 0.58, 0.52);
        else if (this.roadDist(x, z) < 2.6) col.setRGB(0.55, 0.44, 0.28);
        else if (bm === 'corrupt') col.setRGB(0.3 + v * 0.1, 0.16 + v * 0.06, 0.4 + v * 0.12);
        else if (bm === 'celeste') col.setRGB(0.78 + v * 0.1, 0.72 + v * 0.1, 0.5 + v * 0.1);
        else if (bm === 'abyss') { const a = Math.abs(fbm(x * 0.012 + 130, z * 0.012 + 130, 4) - 0.5) * 2; if (a < 0.06) col.setRGB(1, 0.35, 0.1); else col.setRGB(0.2 + h * 0.003, 0.14, 0.13); }
        else if (bm === 'void') col.setRGB(0.16 + v * 0.08, 0.13 + v * 0.05, 0.2 + v * 0.08);
        else if (bm === 'desert') col.setRGB(0.82 + v * 0.1, 0.66 + v * 0.1, 0.36 + v * 0.06);
        else if (bm === 'swamp') col.setRGB(0.2 + v * 0.08, 0.28 + v * 0.1, 0.14 + v * 0.05);
        else if (bm === 'tundra') col.setRGB(0.82 + v * 0.1, 0.9 + v * 0.06, 0.95);
        else if (h > 22) col.setRGB(0.85, 0.87, 0.9);
        else if (h > 13) col.setRGB(0.45, 0.43, 0.4);
        else if (bm === 'forest') col.setRGB(0.1 + v * 0.06, 0.24 + v * 0.1, 0.1 + v * 0.05);
        else if (bm === 'mount') col.setRGB(0.42, 0.41, 0.39);
        else col.setRGB(0.18 + v * 0.1, 0.36 + v * 0.16, 0.16 + v * 0.06);
        // frontières entre régions : fin liseré clair
        const me = best[py * S + px];
        if (me >= 0 && ((px < S - 1 && best[py * S + px + 1] >= 0 && best[py * S + px + 1] !== me) || (py < S - 1 && best[(py + 1) * S + px] >= 0 && best[(py + 1) * S + px] !== me))) col.lerp(new THREE.Color(0xf4e2a8), 0.75);
        const i = (py * S + px) * 4;
        img.data[i] = col.r * 255; img.data[i + 1] = col.g * 255; img.data[i + 2] = col.b * 255; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }
}
