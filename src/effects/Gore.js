import * as THREE from 'three';

// V10.93 — SANG ET DÉCAPITATION (option « Sang et décapitation » des réglages, désactivée par défaut).
// Gouttes de sang (mélange normal, pas additif), flaques au sol qui sèchent, jets au cou, tête qui roule.
// Tout est mutualisé (pools) : aucun coût quand l'option est coupée.
const MAXD = 420, MAXDECAL = 44, MAXHEADS = 6;
const BLOOD = 0x8c0a0e, DARK = 0x4a0508;

// Quel « liquide » pour quel monstre : sang, éclats d'os, gelée verte, rien (pierre, esprits, boss mécaniques).
export function fluidOf(e) {
  const id = String(e?.def?.id || e?.id || '');
  if (/skeleton|revenant/.test(id)) return 'bone';
  if (/slime/.test(id)) return 'slime';
  if (/golem|colossus|wb_|spire_warden|wraith|ghost|specter|shade|pumpkin/.test(id)) return null;
  if (/corrupted|abyssal|primordial/.test(id)) return 'dark';
  return 'blood';
}
const FLUID = { blood: [BLOOD, DARK], dark: [0x3a0a2a, 0x1a0412], bone: [0xd8d0b4, 0xa89f84], slime: [0x6aa83a, 0x3f7a22] };

const headBoneOf = (rig) => {
  if (rig._headBone !== undefined) return rig._headBone;
  let b = null;
  rig.glbInst?.traverse((o) => { if (!b && o.isBone && /^(head|tete|tête|skull|crane|crâne)(\.|_|$)/i.test(o.name)) b = o; });
  if (!b) rig.glbInst?.traverse((o) => { if (!b && o.isBone && /head|tete|skull/i.test(o.name)) b = o; });
  return (rig._headBone = b);
};

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
    this.decals = []; this.decalHead = 0;
    this._dgeo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
    // têtes
    this.heads = []; this.spurts = [];
    this._hgeo = new THREE.SphereGeometry(1, 12, 9);
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

  /** flaque au sol */
  stain(x, z, r, fluid = 'blood', grow = false) {
    const [c1] = FLUID[fluid] || FLUID.blood;
    let d = this.decals[this.decalHead];
    if (!d) {
      const m = new THREE.Mesh(this._dgeo, new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true }));
      m.renderOrder = 2; m.frustumCulled = false; this.g.scene.add(m);
      d = { m, t: 0, life: 30, r: 1, grow: false, tr: 1 };
      this.decals[this.decalHead] = d;
    }
    this.decalHead = (this.decalHead + 1) % MAXDECAL;
    d.m.material.color.setHex(c1);
    d.m.position.set(x, this.ground(x, z) + 0.06, z);
    d.m.rotation.y = Math.random() * 6.283;
    d.t = 0; d.tr = r; d.grow = grow; d.r = grow ? 0.15 * r : r; d.life = fluid === 'bone' ? 14 : fluid === 'slime' ? 20 : 34;
    d.m.scale.set(d.r * (0.8 + Math.random() * 0.5), 1, d.r * (0.8 + Math.random() * 0.5)); d.m.visible = true;
  }

  _height(e) {
    if (e._goreH) return e._goreH;
    const b = new THREE.Box3().setFromObject(e.rig.root), h = Math.max(0.5, b.max.y - b.min.y);
    return (e._goreH = h);
  }

  onHit({ e, crit, dmg }) {
    if (!this.on() || !e || e.isBoss) return;
    const fl = fluidOf(e); if (!fl) return;
    const p = this.g.player?.pos; if (!p) return;
    let dx = e.pos.x - p.x, dz = e.pos.z - p.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const H = this._height(e);
    this.spray(e.pos.x, e.pos.y + H * 0.6, e.pos.z, dx, dz, fl, crit ? 14 : 6, crit ? 1.25 : 0.85);
    if (Math.random() < (crit ? 0.9 : 0.35)) this.stain(e.pos.x + dx * (0.6 + Math.random() * 1.4), e.pos.z + dz * (0.6 + Math.random() * 1.4), (0.25 + Math.random() * 0.3) * Math.min(2, H * 0.6), fl);
  }

  onKill({ e, crit, dmg, bonus = 0 }) {
    if (!this.on() || !e || e.isBoss) return;
    const fl = fluidOf(e); if (!fl) return;
    const p = this.g.player?.pos; if (!p) return;
    let dx = e.pos.x - p.x, dz = e.pos.z - p.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const H = this._height(e);
    this.spray(e.pos.x, e.pos.y + H * 0.5, e.pos.z, dx, dz, fl, 24, 1.1);
    this.stain(e.pos.x, e.pos.z, Math.min(2.6, H * 0.8), fl, true);
    // décapitation : surtout sur un coup critique ou très lourd
    const heavy = dmg > e.maxHp * 0.35;
    const chance = (crit ? 0.5 : heavy ? 0.22 : 0.07) + bonus;
    if (Math.random() < chance) this.behead(e, fl, dx, dz, H);
  }

  behead(e, fl, dx, dz, H) {
    const rig = e.rig; if (!rig || rig._beheaded) return;
    let wp = new THREE.Vector3();
    const bone = rig.glb ? headBoneOf(rig) : null;
    if (bone) { bone.getWorldPosition(wp); bone.scale.setScalar(0.0001); rig._restoreHead = () => { bone.scale.setScalar(1); rig._beheaded = false; this.spurts = this.spurts.filter((s) => s.e !== e); }; }
    else if (rig.head && rig.head.visible !== false && !rig.glb) { rig.head.getWorldPosition(wp); rig.head.visible = false; rig._restoreHead = () => { rig.head.visible = true; rig._beheaded = false; }; }
    else return;   // pas de tête repérable : pas de décapitation
    rig._beheaded = true;
    this.g.audio?.play('gore', e.pos);
    // la tête s'envole
    const r = Math.max(0.09, Math.min(0.5, H * 0.065));
    const col = fl === 'bone' ? 0xd9d1b8 : fl === 'dark' ? 0x7a5a8a : fl === 'slime' ? 0x7ab04a : /wolf|boar|bear|rat|spider/.test(String(e.def?.id)) ? 0x5a4636 : 0xc09070;
    const m = new THREE.Mesh(this._hgeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }));
    m.scale.set(r * 0.88, r, r * 0.95); m.position.copy(wp); m.castShadow = true;
    this.g.scene.add(m);
    if (this.heads.length >= MAXHEADS) this._dropHead(this.heads.shift());
    const side = (Math.random() - 0.5) * 2;
    this.heads.push({ m, v: new THREE.Vector3(dx * 3.2 + dz * side * 1.5, 5.2 + Math.random() * 1.8, dz * 3.2 - dx * side * 1.5), w: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12), t: 0, r, fl, rest: false });
    this.spurts.push({ e, bone, t: 0, wp, H });
    this.spray(wp.x, wp.y, wp.z, dx, dz, fl, 22, 1.3);
  }

  _dropHead(h) { this.g.scene.remove(h.m); h.m.material.dispose(); }

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
        if (Math.random() < 0.12) this.stain(x, z, 0.12 + Math.random() * 0.2, this._fluidOfColor(i));
      }
    }
    if (!any && this.points.visible && !this._hot) this.points.visible = false;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    // flaques
    for (const d of this.decals) {
      if (!d || !d.m.visible) continue;
      d.t += dt;
      if (d.grow && d.r < d.tr) { d.r = Math.min(d.tr, d.r + dt * d.tr * 0.9); const k = d.r; d.m.scale.x = d.m.scale.z = k; }
      const rem = d.life - d.t;
      d.m.material.opacity = rem < 6 ? 0.8 * Math.max(0, rem / 6) : 0.8;
      if (rem <= 0) d.m.visible = false;
    }
    // jets au cou
    for (let i = this.spurts.length - 1; i >= 0; i--) {
      const s = this.spurts[i]; s.t += dt;
      if (s.t > 1.6) { this.spurts.splice(i, 1); continue; }
      if (s.bone) s.bone.getWorldPosition(s.wp); else s.e.rig.head?.getWorldPosition(s.wp);
      const fl = fluidOf(s.e);
      if (fl && fl !== 'bone') this.spray(s.wp.x, s.wp.y, s.wp.z, 0, 0, fl, Math.max(1, Math.round(10 * dt * (1.6 - s.t) * 3)), 0.55);
    }
    // têtes
    for (let i = this.heads.length - 1; i >= 0; i--) {
      const h = this.heads[i]; h.t += dt;
      if (!h.rest) {
        h.v.y -= 16 * dt;
        h.m.position.addScaledVector(h.v, dt);
        h.m.rotation.x += h.w.x * dt; h.m.rotation.y += h.w.y * dt; h.m.rotation.z += h.w.z * dt;
        const gy = this.ground(h.m.position.x, h.m.position.z) + h.r * 0.9;
        if (h.m.position.y < gy) {
          h.m.position.y = gy;
          if (Math.abs(h.v.y) > 1.6) { h.v.y *= -0.38; h.v.x *= 0.6; h.v.z *= 0.6; h.w.multiplyScalar(0.6); this.stain(h.m.position.x, h.m.position.z, 0.2 + Math.random() * 0.2, h.fl); this.spray(h.m.position.x, gy, h.m.position.z, 0, 0, h.fl, 5, 0.5); }
          else { h.v.y = 0; h.v.x *= 0.9; h.v.z *= 0.9; h.w.multiplyScalar(0.85); if (Math.hypot(h.v.x, h.v.z) < 0.2) { h.rest = true; this.stain(h.m.position.x, h.m.position.z, 0.5, h.fl); } }
        }
        else if (h.t < 1.2 && h.fl !== 'bone' && Math.random() < 0.6) this.spray(h.m.position.x, h.m.position.y, h.m.position.z, 0, 0, h.fl, 1, 0.3);
      } else if (h.t > 22) {
        const k = Math.max(0, 1 - (h.t - 22) / 2); h.m.scale.multiplyScalar(0.96 + 0.04 * k);
        if (k <= 0) { this._dropHead(h); this.heads.splice(i, 1); }
      }
    }
  }

  _fluidOfColor(i) { const r = this.col[i * 3], g = this.col[i * 3 + 1]; return g > 0.5 ? (r > 0.7 ? 'bone' : 'slime') : r < 0.3 ? 'dark' : 'blood'; }
}
