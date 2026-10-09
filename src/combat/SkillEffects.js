import * as THREE from 'three';
import { skillColor } from '../visual/Fx.js';
import { applyStun, applySlow, applyDot, applyVuln, isStunned } from './Status.js';

// Effets avancés des compétences (V3.8). Chaque compétence peut porter un objet `fx` (voir data/skills.json) :
//   ciblage  : at:'target' + radius (zone autour de la cible), arc (cône, en radians), single, pierce:n, hits:n (coups multiples)
//   sur cible: stun (s), slow:[facteur,s], dot:[dégâts/s ×ATQ, s, 'poison'|'burn'|'bleed'], vuln:[%,s], knock (+repousse / −attire),
//              lifesteal, execute:[seuil PV, bonus], crit (bonus de chance de critique)
//   sur soi  : dash:{to:'target'|'fwd'|'back', d}, blink:d, shield:[% PV max, s], invuln:s, restore:{mana,stamina,hp},
//              buff:{t, dmg, speed, taken, cdr, crit, regen, lifesteal}, zone:{r, t, dps, slow, heal, pull, stun, at:'self'|'target'}
//   V10.22   : rain:{n, r, t, mult, rad, at} = n impacts répartis sur t secondes dans un rayon r (chacun blesse tout dans rad),
//              waves:{n, gap, r, mult, heal, at} = n ondes de choc successives de rayon r (autour de soi, ou de la cible si at:'target')
const MAX_TARGETS = 14;
const ZONE_TICK = 0.5;
const MAX_ZONES = 5;
const KIND_LABEL = { poison: 'EMPOISONNÉ', burn: 'BRÛLURE', bleed: 'SAIGNEMENT' };

export class SkillEffects {
  constructor(combat) {
    this.c = combat;
    this.zones = [];
    this._pool = [];
    this._fwd = new THREE.Vector3();
  }

  get fx() { return this.c.fx; }

  // ---------------------------------------------------------------- ciblage
  static usesCustomTargeting(skill) {
    const f = skill.fx;
    return !!(f && (f.at || f.arc || f.single || f.pierce));
  }

  _live() {
    const c = this.c, out = [];
    for (const e of c.enemies) if (e.alive) out.push(e);
    for (const b of c.bosses) if (b.alive && b.state !== 'dormant') out.push(b);
    return out;
  }

  // centre d'effet : cible verrouillée, sinon point devant le joueur
  center(skill, p, locked) {
    if (locked) return { x: locked.pos.x, y: locked.pos.y, z: locked.pos.z };
    const d = Math.min(skill.range || 6, 8) * 0.7;
    const x = p.pos.x + Math.sin(p.yaw) * d, z = p.pos.z + Math.cos(p.yaw) * d;
    return { x, y: p.pos.y, z };
  }

  collect(skill, p, locked) {
    const f = skill.fx, live = this._live();
    const rangeOk = skill.range + 1.1;
    const ox = p.pos.x + Math.sin(p.yaw) * 0.6, oz = p.pos.z + Math.cos(p.yaw) * 0.6; // même origine que les compétences classiques
    let out = [];
    if (f.at === 'target') {
      const ctr = this.center(skill, p, locked);
      const r = (f.radius || 4) + 0.6;
      for (const e of live) if (Math.hypot(e.pos.x - ctr.x, e.pos.z - ctr.z) <= r) out.push(e);
      if (locked && !out.includes(locked)) out.unshift(locked);
      out.sort((a, b) => (a === locked ? -1 : b === locked ? 1 : 0));
    } else if (skill.aoe) {
      for (const e of live) if (Math.hypot(e.pos.x - ox, e.pos.z - oz) <= rangeOk) out.push(e);
    } else {
      const half = (f.arc || Math.PI * 0.95) / 2;
      for (const e of live) {
        if (e === locked) continue;
        const dx = e.pos.x - ox, dz = e.pos.z - oz, d = Math.hypot(dx, dz);
        if (d > rangeOk) continue;
        const a = Math.abs(((Math.atan2(dx, dz) - p.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (a > half) continue;
        out.push(e);
      }
      out.sort((a, b) => a.pos.distanceToSquared(p.pos) - b.pos.distanceToSquared(p.pos));
      if (locked) out.unshift(locked);
    }
    if (f.single) out = out.slice(0, 1);
    else if (f.pierce) out = out.slice(0, f.pierce);
    if (out.length > MAX_TARGETS) out.length = MAX_TARGETS;
    return out;
  }

  // ---------------------------------------------------------------- effets sur les cibles touchées
  hitExtras(skill, p, t, dealt) {
    const f = skill.fx;
    if (!f || !t.alive) return;
    const bus = this.c.bus;
    const power = p.atk * (p.dmgMult || 1) * (p.sbDmg || 1);
    const tag = (txt, color) => bus.emit('floatText', { pos: t.pos.clone().add({ x: 0, y: 2.0, z: 0 }), text: txt, color });
    if (f.stun) { const was = isStunned(t); applyStun(t, f.stun); if (!was && isStunned(t)) tag('ÉTOURDI', '#ffe27a'); }
    if (f.slow) { applySlow(t, f.slow[0], f.slow[1]); }
    if (f.dot) {
      const kind = f.dot[2] || 'poison';
      applyDot(t, power * f.dot[0], f.dot[1], kind);
      tag(KIND_LABEL[kind] || 'POISON', kind === 'burn' ? '#ff9a4a' : kind === 'bleed' ? '#ff6a6a' : '#9be86a');
    }
    if (f.vuln) { applyVuln(t, f.vuln[0], f.vuln[1]); tag('VULNÉRABLE', '#e6a8ff'); }
    if (f.knock && typeof t.state === 'number') { // ennemis seulement (les boss ne sont pas repoussés)
      const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
      t._kb = { x: (dx / d) * f.knock * 2.2, z: (dz / d) * f.knock * 2.2 };
    }
  }

  // ---------------------------------------------------------------- effets sur soi (au moment du lancer)
  onCast(skill, p, targets, locked) {
    const f = skill.fx;
    if (!f) return;
    const col = skillColor(skill, p.classId);
    const fx = this.fx;
    if (f.shield) p.addShield(f.shield[0], f.shield[1]);
    if (f.buff) {
      const b = f.buff;
      p.addBuff({ id: skill.id, name: skill.name, icon: skill.icon, t: b.t || 8, dmg: b.dmg, speed: b.speed, taken: b.taken, cdr: b.cdr, crit: b.crit, regen: b.regen, lifesteal: b.lifesteal });
    }
    if (f.invuln) p.invuln = Math.max(p.invuln, f.invuln);
    if (f.restore) {
      const r = f.restore;
      if (r.mana) p.restoreMana(p.maxMana * r.mana);
      if (r.stamina) { p.stamina = Math.min(p.maxStamina, p.stamina + p.maxStamina * r.stamina); p.bus.emit('floatText', { pos: p.pos.clone().add({ x: 0, y: 2.1, z: 0 }), text: `+${Math.round(p.maxStamina * r.stamina)} endurance`, color: '#ffe08a' }); }
      if (r.hp) p.heal(p.maxHp * r.hp);
    }
    if (f.zone) {
      const z = f.zone;
      const c = z.at === 'target' ? this.center(skill, p, locked) : { x: p.pos.x, y: p.pos.y, z: p.pos.z };
      this._addZone(skill, p, c, z, col);
    }
    if (f.rain) this._rain(skill, p, locked, f.rain, col);
    if (f.waves) this._waves(skill, p, locked, f.waves, col);
    if ((f.shield || f.buff || f.invuln || f.restore) && fx && fx.enabled) {
      try {
        fx.ring(p.pos.x, p.pos.y, p.pos.z, col, 2.6, 0.7);
        fx.pillar(p.pos.x, p.pos.y, p.pos.z, col, 3.6, 0.9, 0.8);
        fx.rune(p.pos.x, p.pos.y, p.pos.z, col, 1.8, 0.9);
      } catch (e) { /* ignoré */ }
    }
  }

  // visuels des compétences de zone / cône (sans projectile)
  visual(skill, p, targets, locked, projectile) {
    const f = skill.fx, fx = this.fx;
    if (!f || !fx || !fx.enabled) return;
    const col = skillColor(skill, p.classId);
    try {
      if (f.at === 'target' && !projectile) {
        const c = this.center(skill, p, locked);
        fx.ring(c.x, c.y, c.z, col, (f.radius || 4) * 0.9, 0.6);
        fx.flash(c.x, c.y + 0.6, c.z, col, 2.4, 0.3);
      }
      if (!projectile && skill.range > 6 && p.classId !== 'archer' && p.classId !== 'mage' && skill.damage) {
        const c = this.center(skill, p, locked);
        fx.beam(new THREE.Vector3(p.pos.x, p.pos.y + 1.2, p.pos.z), new THREE.Vector3(c.x, c.y + 1.0, c.z), col, 0.3, 0.22);
        fx.flash(c.x, c.y + 1, c.z, col, 2.2, 0.25);
      }
      if (f.arc && !skill.aoe) fx.ring(p.pos.x, p.pos.y, p.pos.z, col, (skill.range || 5) * 0.7, 0.4);
      if (f.dash) fx.flash(p.pos.x, p.pos.y + 1, p.pos.z, col, 2, 0.25);
    } catch (e) { /* ignoré */ }
  }

  // projectile unique vers le centre d'une zone (utilisé par l'archer et le mage)
  areaShot(kind, skill, p, from, locked) {
    const fx = this.fx; if (!fx) return null;
    const c = this.center(skill, p, locked);
    const to = new THREE.Vector3(c.x, c.y + 0.9, c.z);
    const col = skillColor(skill, p.classId);
    const dur = Math.min(0.7, Math.max(0.12, from.distanceTo(to) / (kind === 'arrow' ? 44 : 30)));
    const pool = kind === 'arrow' ? fx.arrows : fx.bolts;
    if (pool && pool.enabled) {
      if (kind === 'arrow') pool.shoot(from, to, { dur, color: col, big: true, linger: 0.4, streak: 3.2 });
      else pool.shoot(from, to, { dur, color: col, size: 1.7, trail: 5, linger: 0.25 });
    }
    const r = skill.fx.radius || 4;
    setTimeout(() => {
      try { fx.ring(c.x, c.y, c.z, col, r * 0.95, 0.65); fx.flash(c.x, c.y + 0.8, c.z, col, 3, 0.3); if (r >= 5) fx.rune(c.x, c.y, c.z, col, Math.min(r, 6), 0.8); } catch (e) { /* ignoré */ }
    }, dur * 1000);
    return dur + 0.04;
  }

  // ---------------------------------------------------------------- V10.22 : pluies d'impacts et ondes de choc
  _gy(p, x, z) { try { return p.world && p.world.heightAt ? p.world.heightAt(x, z) : p.pos.y; } catch (e) { return p.pos.y; } }

  // dégâts de zone instantanés (impact / onde) ; `seen` = ennemis déjà touchés par cette compétence (les statuts ne se cumulent pas)
  _blast(skill, p, x, z, rad, mult, seen, quiet = true) {
    const power = p.atk * mult * (p.dmgMult || 1) * (p.sbDmg || 1);
    let n = 0;
    for (const e of this._live()) {
      if (!e.alive) continue;
      if (Math.hypot(e.pos.x - x, e.pos.z - z) > rad + 0.45) continue;
      if (p.world && p.world.losBlocked && p.world.losBlocked(x, z, e.pos.x, e.pos.z)) continue;
      const crit = Math.random() < p.critChance + (p.sbCrit || 0);
      const dmg = Math.round(power * (crit ? p.critMult : 1) * (0.9 + Math.random() * 0.2));
      const dealt = e.takeDamage(dmg, crit, p, quiet) || 0;
      if (dealt > 0 && p.sbLifesteal) p.heal(dealt * p.sbLifesteal, true);
      if (!seen.has(e)) { seen.add(e); this.hitExtras(skill, p, e, dealt); }
      if (++n >= 20) break;
    }
    return n;
  }

  _rain(skill, p, locked, R, col) {
    const c = this.c, fx = this.fx, ctr = R.at === 'self' ? { x: p.pos.x, y: p.pos.y, z: p.pos.z } : this.center(skill, p, locked);
    const n = Math.min(16, R.n || 8), T = R.t || 2.5, rad = R.rad || 2.6, seen = new Set();
    const arrows = p.classId === 'archer';
    const low = fx && fx.scale < 1;
    let sounds = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = (i === 0 ? 0 : Math.sqrt(Math.random())) * (R.r || 6);
      const x = ctr.x + Math.cos(a) * d, z = ctr.z + Math.sin(a) * d, y = this._gy(p, x, z);
      const at = 0.15 + (n > 1 ? (i / (n - 1)) * T : 0), fall = 0.42;
      if (fx && fx.enabled) {
        try {
          const pool = arrows ? fx.arrows : fx.bolts;
          if (pool && pool.enabled) {
            const from = new THREE.Vector3(x - 6 + Math.random() * 2, y + 22 + Math.random() * 4, z - 4 + Math.random() * 2), to = new THREE.Vector3(x, y + 0.3, z);
            if (arrows) pool.shoot(from, to, { dur: fall, delay: at, color: col, big: true, linger: 0.2, streak: 3 });
            else pool.shoot(from, to, { dur: fall, delay: at, color: col, size: 1.6, trail: 6, linger: 0.25 });
          }
        } catch (e) { /* ignoré */ }
      }
      c._pending.push({ t: at + fall, fn: () => {
        this._blast(skill, p, x, z, rad, R.mult || 1, seen);
        c.particles.emit(x, y + 0.5, z, { count: low ? 8 : 16, color: col, speed: 4, life: 0.6, up: 2.5 });
        if (fx && fx.enabled) { try { fx.pillar(x, y, z, col, 5, rad * 0.45, 0.55); fx.ring(x, y, z, col, rad, 0.5); fx.flash(x, y + 0.5, z, col, rad * 1.1, 0.25); } catch (e) { /* ignoré */ } }
        if (sounds++ < 4) c.audio.play('explode', new THREE.Vector3(x, y, z));
        c.bus.emit('shake', 0.16);
      } });
    }
  }

  _waves(skill, p, locked, W, col) {
    const c = this.c, fx = this.fx, seen = new Set();
    const ctr = W.at === 'target' ? this.center(skill, p, locked) : { x: p.pos.x, y: p.pos.y, z: p.pos.z };
    const n = Math.min(8, W.n || 3), gap = W.gap || 0.35, r = W.r || 7;
    for (let i = 0; i < n; i++) {
      c._pending.push({ t: 0.05 + i * gap, fn: () => {
        const cx = W.at === 'target' ? ctr.x : p.pos.x, cz = W.at === 'target' ? ctr.z : p.pos.z, cy = this._gy(p, cx, cz);
        const k = 0.65 + 0.35 * ((i + 1) / n);
        this._blast(skill, p, cx, cz, r * k, W.mult || 1, seen);
        if (W.heal && !p.dead) p.heal(p.maxHp * W.heal, true);
        if (fx && fx.enabled) { try { fx.ring(cx, cy, cz, col, r * k, 0.55); fx.rune(cx, cy, cz, col, r * k * 0.6, 0.7); fx.flash(cx, cy + 0.6, cz, col, 2.6, 0.25); if (i === 0 || i === n - 1) fx.pillar(cx, cy, cz, col, 4, r * 0.18, 0.7); } catch (e) { /* ignoré */ } }
        c.particles.emit(cx, cy + 0.4, cz, { count: 18, color: col, speed: 6, life: 0.6, up: 1.5, spread: 1 });
        if (i === 0 || i === n - 1) c.audio.play('explode', new THREE.Vector3(cx, cy, cz));
        c.bus.emit('shake', i === n - 1 ? 0.35 : 0.2);
      } });
    }
  }

  // ---------------------------------------------------------------- zones persistantes
  _addZone(skill, p, c, z, col) {
    if (this.zones.length >= MAX_ZONES) this._retire(this.zones.shift());
    const zone = { x: c.x, y: c.y, z: c.z, r: z.r, t: z.t, left: z.t, dps: z.dps || 0, slow: z.slow || 0, heal: z.heal || 0, pull: z.pull || 0, stun: z.stun || 0, pullT: 0, col, tick: 0, healTick: 0, pT: 0, vis: this._visual(z.r, col) };
    this.zones.push(zone);
    const fx = this.fx;
    if (fx && fx.enabled) { try { fx.ring(c.x, c.y, c.z, col, z.r, 0.6); fx.pillar(c.x, c.y, c.z, col, 4, 1.4, 0.8); } catch (e) { /* ignoré */ } }
  }

  _visual(r, col) {
    const fx = this.fx;
    if (!fx || !fx.tex || !fx.tex.rune) return null;
    let v = this._pool.find((o) => !o.userData.busy);
    if (!v) {
      if (this._pool.length >= MAX_ZONES) return null;
      const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      const mk = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      v = new THREE.Group();
      const a = new THREE.Mesh(geo, mk(fx.tex.rune)); const b = new THREE.Mesh(geo, mk(fx.tex.ring || fx.tex.rune));
      v.add(a, b); v.userData.a = a; v.userData.b = b;
      fx.scene.add(v); this._pool.push(v);
    }
    v.userData.busy = true; v.visible = true;
    v.userData.a.material.color.setHex(col); v.userData.b.material.color.setHex(col);
    v.userData.a.scale.setScalar(r * 2); v.userData.b.scale.setScalar(r * 2.1);
    return v;
  }

  _retire(z) { if (z && z.vis) { z.vis.userData.busy = false; z.vis.visible = false; } }

  clear() { for (const z of this.zones) this._retire(z); this.zones.length = 0; }

  update(dt) {
    if (!this.zones.length) return;
    const c = this.c, p = c.player;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.left -= dt;
      if (z.left <= 0) { this._retire(z); this.zones.splice(i, 1); continue; }
      if (z.vis) {
        const k = z.left / z.t, fade = Math.min(1, z.left / 0.8, (z.t - z.left) / 0.3 + 0.2);
        const pulse = 0.5 + 0.12 * Math.sin((z.t - z.left) * 5);
        z.vis.position.set(z.x, z.y + 0.1, z.z);
        z.vis.userData.a.rotation.y += dt * 0.8; z.vis.userData.b.rotation.y -= dt * 0.4;
        z.vis.userData.a.material.opacity = pulse * fade; z.vis.userData.b.material.opacity = 0.55 * fade * (0.6 + 0.4 * k);
      }
      z.pT -= dt;
      if (z.pT <= 0) { z.pT = 0.16; const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * z.r; c.particles.emit(z.x + Math.cos(a) * d, z.y + 0.2, z.z + Math.sin(a) * d, { count: 1, color: z.col, speed: 0.8, life: 0.8, gravity: -1.2, up: 1.4, spread: 0.2 }); }
      if (z.pull > 0) { // V10.22 : les ennemis sont attirés vers le centre (les boss ne bougent pas)
        z.pullT -= dt;
        if (z.pullT <= 0) {
          z.pullT = 0.2;
          for (const e of this._live()) {
            if (typeof e.state !== 'number') continue;
            const dx = z.x - e.pos.x, dz = z.z - e.pos.z, d = Math.hypot(dx, dz);
            if (d > z.r * 1.5 || d < 0.8) continue;
            const v = Math.min(14, z.pull * 2.2 + d * 1.2);
            e._kb = { x: (dx / d) * v, z: (dz / d) * v };
          }
        }
      }
      z.tick += dt;
      if (z.tick >= ZONE_TICK) {
        z.tick -= ZONE_TICK;
        if (z.dps > 0 || z.slow > 0 || z.stun > 0) {
          const base = p.atk * z.dps * ZONE_TICK * (p.dmgMult || 1) * (p.sbDmg || 1);
          for (const e of this._live()) {
            if (Math.hypot(e.pos.x - z.x, e.pos.z - z.z) > z.r + 0.4) continue;
            if (z.dps > 0) e.takeDamage(Math.round(base * (0.9 + Math.random() * 0.2)), false, p, true);
            if (z.slow > 0 && e.alive) applySlow(e, z.slow, 0.9);
            if (z.stun > 0 && e.alive) applyStun(e, z.stun);
          }
        }
      }
      if (z.heal > 0 && p && !p.dead) {
        z.healTick += dt;
        if (z.healTick >= 1 && Math.hypot(p.pos.x - z.x, p.pos.z - z.z) <= z.r) { z.healTick = 0; p.heal(p.maxHp * z.heal); }
      }
    }
  }
}
