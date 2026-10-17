import * as THREE from 'three';

// V10.94 — SANG, DÉCAPITATION, DÉMEMBREMENT, EXPLOSION (option « Sang et décapitation » des réglages, désactivée par défaut).
// Gouttes de sang (mélange normal, pas additif), vraies flaques irrégulières (texture dessinée : bords déchiquetés, coulées,
// gouttelettes, reflet humide) qui sèchent, jets aux moignons, membres et têtes qui volent, corps qui explosent en morceaux.
// Le résultat dépend de la compétence : lames → membres coupés et têtes, marteaux → écrasement, feu/foudre → explosion,
// givre → corps qui éclate en glace. Tout est mutualisé (pools) : aucun coût quand l'option est coupée.
const MAXD = 520, MAXDECAL = 64, BIGDECAL = 24, MAXCHUNKS = 28;   // flaques : 24 emplacements pour les grandes (corps), 40 pour les éclaboussures
const BLOOD = 0x8c0a0e, DARK = 0x4a0508;

/** Contexte de la compétence en cours (posé par le combat autour de takeDamage, lu par Enemy → événements gore). */
export const goreCtx = { skill: null, aoe: false };

/** Quel « liquide » pour quel monstre : sang, éclats d'os, gelée verte, rien (pierre, esprits, boss mécaniques). */
export function fluidOf(e) {
  const id = String(e?.def?.id || e?.id || '');
  if (/skeleton|revenant/.test(id)) return 'bone';
  if (/slime/.test(id)) return 'slime';
  if (/golem|colossus|wb_|spire_warden|wraith|ghost|specter|shade|pumpkin/.test(id)) return null;
  if (/corrupted|abyssal|primordial/.test(id)) return 'dark';
  return 'blood';
}
const FLUID = {
  blood: [BLOOD, DARK], dark: [0x3a0a2a, 0x1a0412], bone: [0xd8d0b4, 0xa89f84], slime: [0x6aa83a, 0x3f7a22], ice: [0xc8e8ff, 0x8cc4ee]
};

/** Style de la compétence : détermine ce qui peut arriver au corps. */
const RX = {
  ice: /frost|ice|blizzard|absolute_zero|freez/,
  blast: /meteor|fire|flam|ball|explo|cataclysm|nova|starfall|apocalypse|comet|singularity|devastation|void|lightning|thunder|storm|inferno|wildfire|bomb|sunfall|cluster|sky_collapse|world_breaker|titan_fall|oblivion|wrath|judgment|spark|arcane|elemental|sacred|light_column|burst|heaven|radiant|holy_nova|final_verdict|eclipse|cannon/,
  blunt: /hammer|bash|colossus|titan|earthquake|fissure|boulder|quake|shockwave|fury|stone|crush|charge|leap|bulwark|aegis/,
  slash: /heavy|rampage|whirlwind|backstab|execute|eviscerate|cuts|blade|dagger|knife|rend|sunder|assassinate|silent|stab|twin|shuriken|razor|deep_cut|onslaught|reap|lotus|cyclone|steel|axe|smite|bloodthirst|champion|rupture|death_mark|soul|verdict|holy_strike|strike|vengeance|hamstring|claw/,
  pierce: /arrow|shot|volley|bolt|lance|javelin|missile|barrage|deadeye|trap|quiver|hail|rain_of/
};
export function styleOf(skill) {
  const id = String(skill?.id || '');
  if (!id) return 'plain';
  if (RX.ice.test(id)) return 'ice';
  if (RX.blast.test(id)) return 'blast';
  if (RX.blunt.test(id)) return 'blunt';
  if (RX.pierce.test(id)) return 'pierce';
  if (RX.slash.test(id)) return 'slash';
  return 'plain';
}

// ——— flaques : textures dessinées (une fois, mises en cache) ———
const TEXC = {}; let _seed = 1;
const rnd = () => ((_seed = (_seed * 16807) % 2147483647) / 2147483647);
const PAL = {
  blood: { edge: [164, 14, 20], mid: [128, 9, 14], core: [70, 5, 9], a: 0.96 },
  dark: { edge: [74, 16, 56], mid: [48, 10, 36], core: [18, 3, 15], a: 0.95 },
  bone: { edge: [214, 206, 180], mid: [186, 176, 148], core: [150, 140, 112], a: 0.85 },
  slime: { edge: [122, 190, 62], mid: [90, 156, 42], core: [58, 112, 26], a: 0.9 },
  ice: { edge: [214, 238, 255], mid: [170, 214, 248], core: [140, 190, 236], a: 0.75 }
};
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function blobPath(x, cx, cy, R, wob) {
  const N = 44, a1 = rnd() * 6.28, a2 = rnd() * 6.28, a3 = rnd() * 6.28, a4 = rnd() * 6.28;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * 6.2832;
    let r = 1 + wob * (0.5 * Math.sin(2 * t + a1) + 0.42 * Math.sin(3 * t + a2) + 0.3 * Math.sin(5 * t + a3) + 0.18 * Math.sin(8 * t + a4)) + (rnd() - 0.5) * wob * 0.35;
    pts.push([cx + Math.cos(t) * R * r, cy + Math.sin(t) * R * r]);
  }
  x.beginPath();
  x.moveTo((pts[0][0] + pts[N - 1][0]) / 2, (pts[0][1] + pts[N - 1][1]) / 2);
  for (let i = 0; i < N; i++) { const p = pts[i], q = pts[(i + 1) % N]; x.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  x.closePath();
}

function drawPool(fluid) {
  const S = 192, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), P = PAL[fluid] || PAL.blood, C = S / 2;
  const main = 0.27 + rnd() * 0.07, R = S * main;
  // traînées effilées
  const nr = 2 + ((rnd() * 3) | 0), base = rnd() * 6.28;
  x.fillStyle = rgb(P.mid, P.a);
  for (let k = 0; k < nr; k++) {
    const a = base + (rnd() - 0.5) * 2.6, len = S * (0.36 + rnd() * 0.12), w = S * (0.022 + rnd() * 0.03);
    const ex = C + Math.cos(a) * len, ey = C + Math.sin(a) * len, nx = -Math.sin(a), ny = Math.cos(a), bend = (rnd() - 0.5) * S * 0.1;
    x.beginPath();
    x.moveTo(C + nx * w * 2, C + ny * w * 2);
    x.quadraticCurveTo((C + ex) / 2 + nx * (w + bend), (C + ey) / 2 + ny * (w + bend), ex, ey);
    x.quadraticCurveTo((C + ex) / 2 - nx * (w - bend), (C + ey) / 2 - ny * (w - bend), C - nx * w * 2, C - ny * w * 2);
    x.closePath(); x.fill();
    x.beginPath(); x.arc(ex, ey, w * 1.15, 0, 6.2832); x.fill();
  }
  // lobes qui débordent de la masse
  const nl = 4 + ((rnd() * 3) | 0);
  for (let k = 0; k < nl; k++) {
    const a = rnd() * 6.28, d = R * (0.7 + rnd() * 0.5), r = S * (0.05 + rnd() * 0.07);
    blobPath(x, C + Math.cos(a) * d, C + Math.sin(a) * d, r, 0.5);
    x.fillStyle = rgb(P.mid, P.a); x.fill();
  }
  // masse principale : bord déchiqueté, dégradé du centre coagulé vers le bord plus clair
  blobPath(x, C, C, R, 0.34);
  const g = x.createRadialGradient(C - R * 0.1, C - R * 0.1, R * 0.05, C, C, R * 1.15);
  g.addColorStop(0, rgb(P.core, P.a)); g.addColorStop(0.55, rgb(P.mid, P.a)); g.addColorStop(1, rgb(P.edge, P.a * 0.92));
  x.fillStyle = g; x.fill();
  // bord légèrement plus clair (film mince)
  x.lineWidth = S * 0.012; x.strokeStyle = rgb(P.edge, 0.55); x.stroke();
  // gouttelettes projetées autour (allongées vers l'extérieur)
  const nd = 12 + ((rnd() * 10) | 0);
  x.fillStyle = rgb(P.mid, P.a);
  for (let k = 0; k < nd; k++) {
    const a = rnd() * 6.28, d = S * (0.34 + rnd() * 0.14), r = S * (0.006 + rnd() * rnd() * 0.03);
    x.save(); x.translate(C + Math.cos(a) * d, C + Math.sin(a) * d); x.rotate(a); x.scale(1 + rnd() * 1.3, 1);
    x.beginPath(); x.arc(0, 0, r, 0, 6.2832); x.fill(); x.restore();
  }
  // reflets humides
  x.fillStyle = 'rgba(255,255,255,0.28)';
  for (let k = 0; k < 3; k++) {
    const a = -2.3 + (rnd() - 0.5) * 0.9, d = R * (0.2 + rnd() * 0.55);
    x.save(); x.translate(C + Math.cos(a) * d, C + Math.sin(a) * d); x.rotate(a + 1.57);
    x.beginPath(); x.ellipse(0, 0, S * (0.02 + rnd() * 0.025), S * (0.008 + rnd() * 0.008), 0, 0, 6.2832); x.fill(); x.restore();
  }
  if (fluid === 'bone') { // poussière d'os : petits éclats clairs
    x.fillStyle = 'rgba(255,250,235,0.7)';
    for (let k = 0; k < 14; k++) { const a = rnd() * 6.28, d = rnd() * R * 1.3; x.save(); x.translate(C + Math.cos(a) * d, C + Math.sin(a) * d); x.rotate(rnd() * 6.28); x.fillRect(-2, -0.8, 3 + rnd() * 4, 1.6); x.restore(); }
  }
  return c;
}

function poolTexture(fluid) {
  const arr = TEXC[fluid] || (TEXC[fluid] = []);
  if (arr.length < 5) {
    _seed = 1000 + arr.length * 7919 + fluid.length * 131;
    const t = new THREE.CanvasTexture(drawPool(fluid)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; arr.push(t); return t;
  }
  return arr[(Math.random() * arr.length) | 0];
}

const headBoneOf = (rig) => {
  if (rig._headBone !== undefined) return rig._headBone;
  let b = null;
  rig.glbInst?.traverse((o) => { if (!b && o.isBone && /^(head|tete|tête|skull|crane|crâne)(\.|_|$)/i.test(o.name)) b = o; });
  if (!b) rig.glbInst?.traverse((o) => { if (!b && o.isBone && /head|tete|skull/i.test(o.name)) b = o; });
  return (rig._headBone = b);
};
/** Os des membres (humanoïdes : bras/jambes ; bêtes : pattes avant/arrière). */
const limbBonesOf = (rig) => {
  if (rig._limbBones) return rig._limbBones;
  const arms = [], legs = [];
  rig.glbInst?.traverse((o) => {
    if (!o.isBone) return;
    if (/^(UpperArm|FrontUpper)_[LR]$/.test(o.name)) arms.push(o);
    else if (/^(UpperLeg|Thigh)_[LR]$/.test(o.name)) legs.push(o);
  });
  return (rig._limbBones = { arms, legs });
};
const farthestBone = (bone) => { // extrémité du membre (main/pied) = descendant le plus éloigné
  const a = new THREE.Vector3(), b = new THREE.Vector3(); bone.getWorldPosition(a);
  let best = null, bd = 0;
  bone.traverse((o) => { if (o === bone || !o.isBone) return; o.getWorldPosition(b); const d = a.distanceTo(b); if (d > bd) { bd = d; best = b.clone(); } });
  return best;
};

const _up = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _q = new THREE.Quaternion();

export class Gore {
  constructor(game) {
    this.g = game;
    this.pos = new Float32Array(MAXD * 3); this.vel = new Float32Array(MAXD * 3); this.col = new Float32Array(MAXD * 3);
    this.life = new Float32Array(MAXD); this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(8, 8, 7, 0, 7); x.fill();
    const tex = new THREE.CanvasTexture(c);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, map: tex, vertexColors: true, transparent: true, alphaTest: 0.4, depthWrite: false, fog: true }));
    this.points.frustumCulled = false; this.points.visible = false;
    game.scene.add(this.points);
    // flaques
    this.decals = []; this.decalHead = 0; this.bigHead = 0;
    this._dgeo = new THREE.PlaneGeometry(2.3, 2.3).rotateX(-Math.PI / 2);
    // morceaux (têtes, membres, éclats)
    this.chunks = []; this.spurts = [];
    this._hgeo = new THREE.SphereGeometry(1, 12, 9);
    this._cgeo = new THREE.CapsuleGeometry(1, 2, 4, 8);   // rayon 1, corps de longueur 2 (axe Y)
    this._bgeo = new THREE.BoxGeometry(1, 1, 1);
    const b = game.bus;
    b.on('goreHit', (d) => this.onHit(d));
    b.on('goreKill', (d) => this.onKill(d));
    b.on('playerHurt', () => { if (this.on() && game.player) this.spray(game.player.pos.x, game.player.pos.y + 1.1, game.player.pos.z, 0, 0, 'blood', 7, 0.6); });
  }

  on() { return this.g.settings?.gore === true; }
  ground(x, z) { return this.g.world.heightAt(x, z); }

  /** jet de gouttes (dir : direction horizontale de la poussée) */
  spray(x, y, z, dx, dz, fluid = 'blood', n = 8, power = 1) {
    if (!this.on()) return;
    const [c1, c2] = FLUID[fluid] || FLUID.blood, ca = new THREE.Color(c1), cb = new THREE.Color(c2), c = new THREE.Color();
    this.points.visible = true;
    for (let k = 0; k < n; k++) {
      const i = this.head; this.head = (this.head + 1) % MAXD;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      const a = Math.random() * 6.283, s = (1.2 + Math.random() * 3.4) * power;
      this.vel[i * 3] = dx * 3 * power + Math.cos(a) * s * 0.7;
      this.vel[i * 3 + 1] = (1.5 + Math.random() * 3.5) * power;
      this.vel[i * 3 + 2] = dz * 3 * power + Math.sin(a) * s * 0.7;
      c.copy(ca).lerp(cb, Math.random());
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
      this.life[i] = 1.4;
    }
  }

  /** flaque au sol : vraie tache irrégulière, posée dans la pente, qui s'étale puis sèche et s'assombrit */
  stain(x, z, r, fluid = 'blood', grow = false) {
    const key = FLUID[fluid] ? fluid : 'blood';
    const big = r >= 0.6, slot = big ? this.bigHead : BIGDECAL + this.decalHead;   // les grosses flaques ne sont pas écrasées par les gouttes
    if (big) this.bigHead = (this.bigHead + 1) % BIGDECAL; else this.decalHead = (this.decalHead + 1) % (MAXDECAL - BIGDECAL);
    let d = this.decals[slot];
    if (!d) {
      const m = new THREE.Mesh(this._dgeo, new THREE.MeshStandardMaterial({ map: poolTexture(key), transparent: true, opacity: 1, depthWrite: false, roughness: 0.22, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.38, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true }));
      m.renderOrder = 2; m.frustumCulled = false; this.g.scene.add(m);
      d = { m, t: 0, life: 30, r: 1, grow: false, tr: 1, asp: 1, key };
      this.decals[slot] = d;
    }
    d.key = key;
    d.m.material.map = d.m.material.emissiveMap = poolTexture(key); d.m.material.needsUpdate = true;
    d.m.material.color.setRGB(1, 1, 1);
    d.m.material.roughness = key === 'bone' ? 0.9 : key === 'slime' || key === 'ice' ? 0.12 : 0.22;
    // dans la pente
    const h = this.ground(x, z), k = 0.7;
    _v.set(this.ground(x - k, z) - this.ground(x + k, z), 2 * k, this.ground(x, z - k) - this.ground(x, z + k)).normalize();
    d.m.position.set(x, h + 0.05, z);
    d.m.quaternion.setFromUnitVectors(_up, _v);
    d.m.rotateY(Math.random() * 6.283);
    d.t = 0; d.tr = r; d.grow = grow; d.r = grow ? 0.15 * r : r; d.asp = 0.8 + Math.random() * 0.45;
    d.life = key === 'bone' ? 14 : key === 'slime' ? 20 : key === 'ice' ? 12 : 36;
    d.m.scale.set(d.r * d.asp, 1, d.r / d.asp); d.m.visible = true; d.m.material.opacity = 1;
  }

  _height(e) {
    if (e._goreH) return e._goreH;
    const b = new THREE.Box3().setFromObject(e.rig.root), h = Math.max(0.5, b.max.y - b.min.y);
    return (e._goreH = h);
  }

  onHit({ e, crit, dmg, aoe }) {
    if (!this.on() || !e || e.isBoss) return;
    const fl = fluidOf(e); if (!fl) return;
    const p = this.g.player?.pos; if (!p) return;
    let dx = e.pos.x - p.x, dz = e.pos.z - p.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const H = this._height(e);
    if (aoe && Math.random() < 0.5) return;   // zones : la moitié des touches seulement (évite l'avalanche de gouttes)
    this.spray(e.pos.x, e.pos.y + H * 0.6, e.pos.z, dx, dz, fl, crit ? 14 : 6, crit ? 1.25 : 0.85);
    if (Math.random() < (crit ? 0.9 : 0.35)) this.stain(e.pos.x + dx * (0.6 + Math.random() * 1.4), e.pos.z + dz * (0.6 + Math.random() * 1.4), (0.3 + Math.random() * 0.35) * Math.min(2, H * 0.6), fl);
  }

  onKill({ e, crit, dmg, skill, bonus = 0 }) {
    if (!this.on() || !e || e.isBoss) return;
    const fl = fluidOf(e); if (!fl) return;
    const p = this.g.player?.pos; if (!p) return;
    let dx = e.pos.x - p.x, dz = e.pos.z - p.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const H = this._height(e);
    const st = styleOf(skill), ratio = Math.min(2, dmg / Math.max(1, e.maxHp)), c = crit ? 1 : 0;
    // 1) explosion / éclatement — surtout feu, foudre, givre, coups d'une violence énorme
    let pe = 0;
    if (st === 'blast') pe = 0.2 + c * 0.14 + ratio * 0.3;
    else if (st === 'ice') pe = 0.28 + c * 0.15 + ratio * 0.2;
    else if (st === 'blunt') pe = 0.05 + c * 0.1 + ratio * 0.25;
    else pe = ratio > 0.8 ? 0.06 : 0;
    if (Math.random() < pe + bonus * 0.5) return this.explode(e, st === 'ice' ? 'ice' : fl, dx, dz, H, st);
    // 2) sinon : le corps tombe, flaque qui s'étale…
    this.spray(e.pos.x, e.pos.y + H * 0.5, e.pos.z, dx, dz, fl, 24, 1.1);
    this.stain(e.pos.x, e.pos.z, Math.min(3, H * 1.0), fl, true);
    // …et selon la compétence : tête tranchée et/ou membres arrachés
    const heavy = ratio > 0.35;
    let pb, pl;
    if (st === 'slash') { pb = crit ? 0.45 : heavy ? 0.22 : 0.12; pl = crit ? 0.6 : heavy ? 0.5 : 0.36; }
    else if (st === 'pierce') { pb = crit ? 0.3 : 0.08; pl = crit ? 0.25 : 0.1; }
    else if (st === 'blunt') { pb = 0.04; pl = crit ? 0.4 : heavy ? 0.34 : 0.2; }
    else if (st === 'blast' || st === 'ice') { pb = 0.05; pl = crit ? 0.3 : 0.18; }
    else { pb = crit ? 0.5 : heavy ? 0.22 : 0.07; pl = crit ? 0.25 : 0.1; }
    pb += bonus; pl += bonus;
    let did = false;
    if (Math.random() < pb) did = this.behead(e, fl, dx, dz, H);
    if (Math.random() < pl) { const n = (crit || heavy) && Math.random() < 0.55 ? 2 + (Math.random() < 0.3 ? 1 : 0) : 1; this.dismember(e, fl, dx, dz, H, n); }
  }

  // ——— explosion : le corps disparaît dans un nuage de sang et de morceaux ———
  explode(e, fl, dx, dz, H, st) {
    const rig = e.rig; if (!rig || rig._exploded) return;
    rig._exploded = true;
    const prev = rig._restoreHead; rig._restoreHead = () => { rig.root.visible = true; rig._exploded = false; prev?.(); };
    rig.root.visible = false;
    const x = e.pos.x, y = e.pos.y + H * 0.5, z = e.pos.z;
    this.g.audio?.play('gore', e.pos);
    this.g.audio?.play(st === 'blast' ? 'explode' : 'crush', e.pos);
    this.spray(x, y, z, 0, 0, fl, 70, 1.7 + H * 0.15);
    this.spray(x, y + 0.3, z, dx, dz, fl, 30, 2.1);
    this.stain(x, z, Math.min(3.8, H * 1.5), fl, true);
    for (let k = 0; k < 3; k++) { const a = Math.random() * 6.28, rr = (0.8 + Math.random() * 1.5) * Math.min(2, H * 0.7); this.stain(x + Math.cos(a) * rr, z + Math.sin(a) * rr, (0.35 + Math.random() * 0.45) * Math.min(2, H * 0.6), fl, true); }
    const col = fl === 'ice' ? 0xcfeaff : fl === 'bone' ? 0xe0d8bf : fl === 'slime' ? 0x6aa83a : fl === 'dark' ? 0x4d1a40 : 0xc9a090;
    this.g.particles?.emit(x, y, z, { count: 38, color: fl === 'ice' ? 0xe8f6ff : fl === 'bone' ? 0xd8d0b4 : fl === 'slime' ? 0x8bd04a : 0xa00a10, speed: 5.5, life: 0.9, up: 2.2 });
    // morceaux : viande, os, éclats ; boules de gelée pour les slimes ; éclats de glace
    const n = Math.max(6, Math.min(12, Math.round(H * 4.2)));
    for (let k = 0; k < n; k++) {
      const r = Math.max(0.05, Math.min(0.3, H * (0.04 + Math.random() * 0.06)));
      const meat = fl === 'blood' || fl === 'dark';
      const cc = fl === 'ice' ? 0xbfe4ff : meat ? (Math.random() < 0.6 ? 0x7d1d1f : col) : fl === 'bone' ? 0xe6dfc6 : col;
      const mat = new THREE.MeshStandardMaterial({ color: cc, roughness: fl === 'ice' ? 0.15 : 0.6, metalness: fl === 'ice' ? 0.1 : 0, transparent: fl === 'ice', opacity: fl === 'ice' ? 0.85 : 1 });
      const m = new THREE.Mesh(fl === 'ice' || fl === 'bone' ? this._bgeo : this._hgeo, mat);
      m.scale.set(r * (0.7 + Math.random()), r * (0.5 + Math.random() * 0.7), r * (0.7 + Math.random())); m.position.set(x, y, z); m.castShadow = true;
      this.g.scene.add(m);
      const a = Math.random() * 6.28, s = 3.5 + Math.random() * 5.5;
      this._addChunk({ m, v: new THREE.Vector3(Math.cos(a) * s + dx * 1.5, 4 + Math.random() * 6.5, Math.sin(a) * s + dz * 1.5), w: new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16), t: 0, r: r * 0.8, fl, rest: false, trail: meat && Math.random() < 0.6 });
    }
  }

  // ——— tête tranchée ———
  behead(e, fl, dx, dz, H) {
    const rig = e.rig; if (!rig || rig._beheaded) return false;
    let wp = new THREE.Vector3();
    const prev = rig._restoreHead, bone = rig.glb ? headBoneOf(rig) : null;
    if (bone) { bone.getWorldPosition(wp); bone.scale.setScalar(0.0001); rig._restoreHead = () => { bone.scale.setScalar(1); rig._beheaded = false; this.spurts = this.spurts.filter((s) => s.e !== e); prev?.(); }; }
    else if (rig.head && rig.head.visible !== false && !rig.glb) { rig.head.getWorldPosition(wp); rig.head.visible = false; rig._restoreHead = () => { rig.head.visible = true; rig._beheaded = false; prev?.(); }; }
    else return false;   // pas de tête repérable : pas de décapitation
    rig._beheaded = true;
    this.g.audio?.play('gore', e.pos);
    const r = Math.max(0.09, Math.min(0.5, H * 0.065));
    const col = fl === 'bone' ? 0xd9d1b8 : fl === 'dark' ? 0x7a5a8a : fl === 'slime' ? 0x7ab04a : /wolf|boar|bear|rat|spider/.test(String(e.def?.id)) ? 0x5a4636 : 0xc09070;
    const m = new THREE.Mesh(this._hgeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }));
    m.scale.set(r * 0.88, r, r * 0.95); m.position.copy(wp); m.castShadow = true;
    this.g.scene.add(m);
    const side = (Math.random() - 0.5) * 2;
    this._addChunk({ m, v: new THREE.Vector3(dx * 3.2 + dz * side * 1.5, 5.2 + Math.random() * 1.8, dz * 3.2 - dx * side * 1.5), w: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12), t: 0, r, fl, rest: false, trail: true });
    this.spurts.push({ e, bone, t: 0, wp, H });
    this.spray(wp.x, wp.y, wp.z, dx, dz, fl, 22, 1.3);
    return true;
  }

  // ——— membres arrachés (bras, jambes, pattes) ———
  dismember(e, fl, dx, dz, H, n = 1) {
    const rig = e.rig; if (!rig || !rig.glb) return false;
    const { arms, legs } = limbBonesOf(rig);
    const pool = [...arms, ...legs].filter((b) => !b._severed);
    if (!pool.length) return false;
    let did = 0;
    for (let k = 0; k < n && pool.length; k++) {
      const bone = pool.splice((Math.random() * pool.length) | 0, 1)[0];
      const isArm = arms.includes(bone);
      const a = new THREE.Vector3(); bone.getWorldPosition(a);
      const tip = farthestBone(bone) || a.clone().add(new THREE.Vector3(0, -H * 0.25, 0));
      const dir = tip.clone().sub(a), len = Math.max(0.25, dir.length()); dir.normalize();
      const r = Math.max(0.05, Math.min(0.2, len * 0.15));
      // le membre disparaît du corps
      bone._severed = true; bone.scale.setScalar(0.0001);
      const prev = rig._restoreHead;
      rig._restoreHead = () => { bone.scale.setScalar(1); bone._severed = false; this.spurts = this.spurts.filter((s) => s.bone !== bone); prev?.(); };
      // un morceau de membre qui vole : capsule colorée (peau / os / gelée…)
      const col = fl === 'bone' ? 0xdcd4ba : fl === 'dark' ? 0x6b4a7a : fl === 'slime' ? 0x7ab04a : /wolf|boar|bear|rat|spider|beast|skitter/.test(String(e.def?.id)) ? 0x5a4636 : isArm ? 0xc09070 : 0x6b5238;
      const m = new THREE.Mesh(this._cgeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
      m.scale.set(r, Math.max(0.05, len / 4), r); m.position.copy(a).addScaledVector(dir, len * 0.5); m.castShadow = true;
      m.quaternion.setFromUnitVectors(_up, dir);
      this.g.scene.add(m);
      const side = (Math.random() - 0.5) * 2;
      this._addChunk({ m, v: new THREE.Vector3(dx * 3.6 + dz * side * 2.2, 4 + Math.random() * 3, dz * 3.6 - dx * side * 2.2), w: new THREE.Vector3((Math.random() - 0.5) * 11, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 11), t: 0, r: Math.max(r, 0.08), fl, rest: false, trail: true });
      this.spurts.push({ e, bone, t: 0, wp: a.clone(), H, limb: true });
      this.spray(a.x, a.y, a.z, dx, dz, fl, 18, 1.2);
      did++;
    }
    if (did) { this.g.audio?.play('gore', e.pos); return true; }
    return false;
  }

  _addChunk(c) {
    if (this.chunks.length >= MAXCHUNKS) this._dropChunk(this.chunks.shift());
    this.chunks.push(c);
  }
  _dropChunk(h) { this.g.scene.remove(h.m); h.m.material.dispose(); }

  update(dt) {
    // gouttes
    let any = false;
    for (let i = 0; i < MAXD; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 14 * dt;
      const x = (this.pos[i * 3] += this.vel[i * 3] * dt), y = (this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt), z = (this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt);
      if (y < this.ground(x, z) + 0.03) {
        this.life[i] = 0; this.pos[i * 3 + 1] = -999;
        if (Math.random() < 0.07) this.stain(x, z, 0.14 + Math.random() * 0.24, this._fluidOfColor(i));
      }
    }
    if (!any && this.points.visible && !this._hot) this.points.visible = false;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    // flaques : elles s'étalent, puis sèchent (plus sombres, plus mates) et s'effacent
    for (const d of this.decals) {
      if (!d || !d.m.visible) continue;
      d.t += dt;
      if (d.grow && d.r < d.tr) { d.r = Math.min(d.tr, d.r + dt * d.tr * 0.7); d.m.scale.set(d.r * d.asp, 1, d.r / d.asp); }
      const rem = d.life - d.t;
      d.m.material.opacity = rem < 6 ? Math.max(0, rem / 6) : 1;
      if (d.key === 'blood' || d.key === 'dark') { const k = 1 - 0.42 * Math.min(1, d.t / 22); d.m.material.color.setRGB(k, k * 0.92, k * 0.92); d.m.material.roughness = 0.22 + 0.5 * Math.min(1, d.t / 22); }
      if (rem <= 0) d.m.visible = false;
    }
    // jets aux moignons
    for (let i = this.spurts.length - 1; i >= 0; i--) {
      const s = this.spurts[i]; s.t += dt;
      if (s.t > (s.limb ? 1.1 : 1.6)) { this.spurts.splice(i, 1); continue; }
      if (s.bone) s.bone.getWorldPosition(s.wp); else s.e.rig.head?.getWorldPosition(s.wp);
      const fl = fluidOf(s.e);
      if (fl && fl !== 'bone') this.spray(s.wp.x, s.wp.y, s.wp.z, 0, 0, fl, Math.max(1, Math.round(10 * dt * (1.6 - s.t) * 3)), 0.55);
    }
    // morceaux (têtes, membres, éclats)
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const h = this.chunks[i]; h.t += dt;
      if (!h.rest) {
        h.v.y -= 16 * dt;
        h.m.position.addScaledVector(h.v, dt);
        h.m.rotation.x += h.w.x * dt; h.m.rotation.y += h.w.y * dt; h.m.rotation.z += h.w.z * dt;
        const gy = this.ground(h.m.position.x, h.m.position.z) + h.r * 0.9;
        if (h.m.position.y < gy) {
          h.m.position.y = gy;
          if (Math.abs(h.v.y) > 1.6) { h.v.y *= -0.38; h.v.x *= 0.6; h.v.z *= 0.6; h.w.multiplyScalar(0.6); if (!h.bled) { h.bled = true; this.stain(h.m.position.x, h.m.position.z, 0.3 + Math.random() * 0.25, h.fl); } this.spray(h.m.position.x, gy, h.m.position.z, 0, 0, h.fl, 5, 0.5); }
          else { h.v.y = 0; h.v.x *= 0.9; h.v.z *= 0.9; h.w.multiplyScalar(0.85); if (Math.hypot(h.v.x, h.v.z) < 0.2) { h.rest = true; this.stain(h.m.position.x, h.m.position.z, 0.45 + h.r * 1.2, h.fl); } }
        }
        else if (h.trail && h.t < 1.2 && h.fl !== 'bone' && Math.random() < 0.6) this.spray(h.m.position.x, h.m.position.y, h.m.position.z, 0, 0, h.fl, 1, 0.3);
      } else if (h.t > 24) {
        const k = Math.max(0, 1 - (h.t - 24) / 2); h.m.scale.multiplyScalar(0.96 + 0.04 * k);
        if (k <= 0) { this._dropChunk(h); this.chunks.splice(i, 1); }
      }
    }
  }

  _fluidOfColor(i) { const r = this.col[i * 3], g = this.col[i * 3 + 1], b = this.col[i * 3 + 2]; return b > 0.8 ? 'ice' : g > 0.5 ? (r > 0.7 ? 'bone' : 'slime') : r < 0.3 ? 'dark' : 'blood'; }
}
