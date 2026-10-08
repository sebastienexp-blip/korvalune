import * as THREE from 'three';
import { weaponFamily, projectileKind } from './WeaponRules.js';
import { tryTriggerEquipEffects } from './ItemEffects.js';
import { skillColor } from '../visual/Fx.js';
import { SkillEffects } from './SkillEffects.js';

// Résolution des combats joueur → cible (ennemis, boss). Le "serveur" de demain
// validera ces calculs ; pour l'instant tout est calculé ici en local.
export class CombatSystem {
  constructor(bus, audio, particles) {
    this.bus = bus; this.audio = audio; this.particles = particles;
    this.fx = null; // effets visuels V2.5 (assigné par Game, optionnel)
    this._pending = []; // dégâts différés (temps de vol des flèches)
    this.sfx = new SkillEffects(this); // V3.8 : effets avancés des compétences (statuts, zones, buffs…)
    bus.on('playerSkillHit', (skill) => this.resolvePlayerSkill(skill));
  }

  // Appelé chaque frame : applique les dégâts des flèches arrivées à destination
  update(dt) {
    this.sfx.update(dt);
    const q = this._pending;
    for (let i = q.length - 1; i >= 0; i--) {
      const e = q[i];
      e.t -= dt;
      if (e.t <= 0) { q.splice(i, 1); try { e.fn(); } catch (err) { console.warn('[combat] dégât différé', err); } }
    }
  }

  setContext(player, enemies, bosses) { this.player = player; this.enemies = enemies; this.bosses = Array.isArray(bosses) ? bosses : [bosses].filter(Boolean); }

  resolvePlayerSkill(skill) {
    const p = this.player;
    const targets = [];
    const forward = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    const origin = p.pos.clone().addScaledVector(forward, 0.6);

    // Cible auto-verrouillée (voir Game._updateAutoTarget) : si elle est à
    // portée, les compétences ciblées (non AoE) la touchent automatiquement,
    // sans exiger que le joueur soit précisément tourné vers elle avec la
    // caméra — c'est ce qui rend le combat jouable sans viser au pixel près.
    const lockedTarget = (!skill.aoe && p.target && p.target.alive && p.pos.distanceTo(p.target.pos) <= skill.range + 1.1) ? p.target : null;
    if (lockedTarget) targets.push(lockedTarget);

    const kind = projectileKind(weaponFamily(p._equipRef));
    const custom = SkillEffects.usesCustomTargeting(skill);
    const consider = (e, pos) => {
      if (e === lockedTarget) return;
      const to = pos.clone().sub(origin); to.y = 0;
      const d = to.length();
      if (d > skill.range + 1.1) return;
      if (!skill.aoe) {
        const angle = Math.abs(Math.atan2(to.x, to.z) - p.yaw);
        const wrapped = Math.min(angle, Math.PI * 2 - angle);
        if (wrapped > Math.PI / 2.1) return;
      }
      targets.push(e);
    };
    if (custom) { targets.length = 0; for (const t of this.sfx.collect(skill, p, lockedTarget)) targets.push(t); }
    else {
      for (const e of this.enemies) if (e.alive) consider(e, e.pos);
      for (const b of this.bosses) if (b.alive && b.state !== 'dormant') consider(b, b.pos);
    }

    // Une flèche ciblée ne touche qu'un ennemi (la cible verrouillée, sinon le plus proche) ; la flèche perforante en traverse jusqu'à 4.
    if (!custom && !skill.fx && kind && !skill.aoe && !skill.heal && targets.length > 1) {
      const rest = targets.filter((e) => e !== lockedTarget).sort((a, b) => a.pos.distanceToSquared(p.pos) - b.pos.distanceToSquared(p.pos));
      const keep = skill.id === 'piercing_arrow' ? 4 : 1;
      const list = lockedTarget ? [lockedTarget, ...rest] : rest;
      targets.length = 0;
      for (const e of list.slice(0, keep)) targets.push(e);
    }
    const flight = skill.heal || !skill.damage ? null : (kind === 'arrow' ? this._shootArrows(skill, p, targets, lockedTarget) : kind === 'bolt' ? this._shootBolts(skill, p, targets, lockedTarget) : null);
    this._castFx(skill, p, targets, !!flight);
    if (skill.fx) { this.sfx.onCast(skill, p, targets, lockedTarget); this.sfx.visual(skill, p, targets, lockedTarget, !!flight); }
    if (skill.heal) {
      p.heal(p.maxHp * skill.heal);
      return;
    }
    if (!skill.damage || !targets.length) return; // le bruit du geste est déjà joué au lancement du sort
    const state = { first: true };
    const hits = Math.max(1, (skill.fx && skill.fx.hits) || 1);
    targets.forEach((t, i) => {
      for (let k = 0; k < hits; k++) {
        const apply = () => this._applyHit(skill, p, t, state, k);
        const delay = (flight ? flight[i] || 0 : 0) + k * 0.11;
        if (delay > 0.001) this._pending.push({ t: delay, fn: apply }); else apply();
      }
    });
  }

  _applyHit(skill, p, t, state, k = 0) {
    if (!t.alive) return;
    const f = skill.fx || {};
    const crit = Math.random() < p.critChance + (p.sbCrit || 0) + (f.crit || 0);
    let mult = 1;
    if (f.execute && t.maxHp && t.hp / t.maxHp < f.execute[0]) mult += f.execute[1];
    const dmg = Math.round(p.atk * skill.damage * (p.dmgMult || 1) * (p.sbDmg || 1) * mult * (crit ? p.critMult : 1) * (0.9 + Math.random() * 0.2));
    const dealt = t.takeDamage(dmg, crit, p) || 0;
    const ls = (f.lifesteal || 0) + (p.sbLifesteal || 0);
    if (ls > 0 && dealt > 0) p.heal(dealt * ls, true);
    if (k === 0 && skill.fx) this.sfx.hitExtras(skill, p, t, dealt);
    this.particles.emit(t.pos.x, t.pos.y + 1, t.pos.z, { count: crit ? 22 : 12, color: crit ? 0xffd23f : 0xffffff, speed: 3.4, life: 0.5 });
    if (this.fx?.enabled) { try { this.fx.impact(t.pos, skillColor(skill, p.classId), crit, this.particles); } catch (e) { /* effet ignoré */ } }
    this.audio.play(crit ? 'crit' : p.classId === 'archer' ? 'arrowHit' : p.classId === 'mage' ? 'boltHit' : 'hit', t.pos);
    if (state.first || crit) {
      this.bus.emit('hitstop', crit ? 0.085 : 0.04);
      this.bus.emit('shake', crit ? 0.3 : 0.15);
    }
    if (state.first) {
      tryTriggerEquipEffects('hit', p, { enemies: this.enemies, bosses: this.bosses, particles: this.particles, audio: this.audio, bus: this.bus });
    }
    state.first = false;
  }


  // Projectiles magiques (V3.3) : même principe que les flèches — orbes visibles, dégâts à l'arrivée.
  _shootBolts(skill, p, targets, locked) {
    const fx = this.fx, bolts = fx && fx.enabled && fx.bolts;
    if (!bolts || !bolts.enabled) return null;
    try {
      const sx = Math.sin(p.yaw), sz = Math.cos(p.yaw);
      const from = new THREE.Vector3();
      const rig = p.rig;
      if (rig && rig.tips && rig.tips.staff && rig.tips.staff.getWorldPosition) {
        rig.tips.staff.getWorldPosition(from);
        if (from.distanceTo(p.pos) > 4) from.set(p.pos.x + sx * 0.6, p.pos.y + 1.6, p.pos.z + sz * 0.6);
      } else from.set(p.pos.x + sx * 0.6, p.pos.y + 1.5, p.pos.z + sz * 0.6);
      const col = skillColor(skill, 'mage');
      const id = skill.id || '';
      if (skill.fx && skill.fx.at === 'target') { const fl = this.sfx.areaShot('bolt', skill, p, from, locked); return targets.map(() => fl); }
      const R = () => Math.random() * 2 - 1;
      const low = fx.scale < 1;
      const range = skill.range || 8;
      const aimAt = (t) => new THREE.Vector3(t.pos.x, t.pos.y + 1.0, t.pos.z);
      const flight = (a, b, sp = 34) => Math.min(0.8, Math.max(0.1, a.distanceTo(b) / sp));
      const delays = [];
      const forwardPt = (d) => new THREE.Vector3(from.x + sx * d, p.pos.y + 0.8, from.z + sz * d);

      if (id === 'meteor' || id === 'elemental_storm') {
        const storm = id === 'elemental_storm';
        const spots = targets.length ? targets.map((t) => t.pos) : [forwardPt(range * 0.7)];
        const cols = [0xff7a2a, 0x7fd8ff, 0xcfe8ff];
        spots.slice(0, 6).forEach((sp, i) => {
          const per = storm ? (low ? 2 : 3) : 1;
          for (let k = 0; k < per; k++) {
            const gx = sp.x + (storm ? R() * 1.4 : 0), gz = sp.z + (storm ? R() * 1.4 : 0);
            const a = new THREE.Vector3(gx - 7 + R() * 2, p.pos.y + 24 + R() * 3, gz - 5 + R() * 2), b = new THREE.Vector3(gx, sp.y + 0.3, gz);
            bolts.shoot(a, b, { dur: 0.5 + k * 0.03, delay: 0.1 + i * 0.1 + k * 0.12, color: storm ? cols[(i + k) % 3] : col, size: storm ? 1.1 : 2.2, arc: 0, trail: storm ? 4 : 7, linger: 0.3 });
          }
          fx.ring(sp.x, sp.y, sp.z, col, storm ? 2.8 : 3.4, 0.7);
        });
        targets.forEach((t, i) => delays.push(0.6 + Math.min(5, i) * 0.1 + (storm ? 0.1 : 0)));
        return delays;
      }

      if (id === 'chain_lightning') {
        // éclair qui saute de cible en cible (le plus proche à chaque saut)
        const left = targets.slice(); const order = []; let cur = from;
        while (left.length && order.length < 6) {
          left.sort((a, b) => a.pos.distanceToSquared(cur) - b.pos.distanceToSquared(cur));
          const t = left.shift(); order.push(t); cur = t.pos;
        }
        let prev = from.clone();
        order.forEach((t, i) => {
          const a = aimAt(t);
          setTimeout(() => { try { fx.beam(prev.clone(), a, 0xcfe8ff, 0.3, 0.2); fx.flash(a.x, a.y, a.z, 0xcfe8ff, 2.2, 0.2); } catch (e) { /* ignoré */ } }, i * 90);
          prev = a;
        });
        if (!order.length) fx.beam(from, forwardPt(range), 0xcfe8ff, 0.3, 0.2);
        targets.forEach((t) => delays.push(0.05 + Math.max(0, order.indexOf(t)) * 0.09));
        return delays;
      }

      if (id === 'frost_nova') {
        const n = low ? 8 : 14;
        for (let k = 0; k < n; k++) {
          const ang = (k / n) * Math.PI * 2, b = new THREE.Vector3(p.pos.x + Math.sin(ang) * range, p.pos.y + 0.6, p.pos.z + Math.cos(ang) * range);
          const a = new THREE.Vector3(p.pos.x, p.pos.y + 0.7, p.pos.z);
          bolts.shoot(a, b, { dur: 0.35, color: col, size: 0.7, arc: 0, trail: 2.5, linger: 0.15 });
        }
        targets.forEach((t) => delays.push(Math.min(0.4, Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) / 18)));
        return delays;
      }

      if (id === 'oblivion') {
        const main = targets[0] ? aimAt(targets[0]) : forwardPt(range * 0.8);
        const d = bolts.shoot(from, main, { dur: flight(from, main, 22), color: col, core: 0xe9d0ff, size: 3, arc: 0.6, trail: 6, linger: 0.35 });
        setTimeout(() => { try { fx.pillar(main.x, main.y - 1, main.z, col, 7, 2.2, 0.9); fx.ring(main.x, main.y - 1, main.z, col, 5, 0.8); } catch (e) { /* ignoré */ } }, d * 1000);
        targets.forEach(() => delays.push(d));
        return delays;
      }

      // trait ciblé (firebolt, void_bolt, mana_surge, arcane_devastation…)
      const heavy = skill.damage >= 3;
      if (!targets.length) {
        const b = forwardPt(range * 0.95);
        bolts.shoot(from, b, { color: col, size: heavy ? 1.9 : 1.3, linger: 0.2, dur: flight(from, b) });
        return delays;
      }
      targets.forEach((t, i) => {
        const a = aimAt(t), fl = flight(from, a);
        delays.push(fl);
        if (i < 4) bolts.shoot(from, a, { dur: fl, color: col, size: heavy ? 1.9 : 1.3, trail: heavy ? 5 : 3.5, linger: 0.2 });
      });
      return delays;
    } catch (e) { console.warn('[V3.3] projectiles magiques ignorés', e); return null; }
  }

  // Flèches visibles (V3.2) : lance les projectiles de la compétence et renvoie, pour chaque cible,
  // le temps de vol au bout duquel les dégâts sont appliqués. null → comportement instantané.
  _shootArrows(skill, p, targets, locked) {
    const fx = this.fx, arrows = fx && fx.enabled && fx.arrows;
    if (!arrows || !arrows.enabled) return null;
    try {
      const sx = Math.sin(p.yaw), sz = Math.cos(p.yaw);
      const from = new THREE.Vector3();
      const rig = p.rig;
      if (rig && rig.handL && rig.handL.getWorldPosition) {
        rig.handL.getWorldPosition(from);
        from.x += sx * 0.3; from.z += sz * 0.3; from.y += 0.04;
        if (from.distanceTo(p.pos) > 3.5) from.set(p.pos.x + sx * 0.6, p.pos.y + 1.3, p.pos.z + sz * 0.6);
      } else from.set(p.pos.x + sx * 0.6, p.pos.y + 1.3, p.pos.z + sz * 0.6);
      const col = skillColor(skill, 'archer');
      const big = skill.anim === 'attack2' || skill.damage >= 2.5;
      const id = skill.id || '';
      if (skill.fx && skill.fx.at === 'target') { const fl = this.sfx.areaShot('arrow', skill, p, from, locked); return targets.map(() => fl); }
      const speed = 46;
      const aimAt = (t) => new THREE.Vector3(t.pos.x, t.pos.y + 1.0, t.pos.z);
      const flightOf = (a, b) => Math.min(0.6, Math.max(0.07, a.distanceTo(b) / speed));
      const delays = [];
      const R = () => Math.random() * 2 - 1;
      const low = this.fx.scale < 1;
      const range = skill.range || 12;
      const forwardPt = (dist) => new THREE.Vector3(from.x + sx * dist, from.y - 0.9 - dist * 0.02, from.z + sz * dist);

      if (/rain|skyfall/.test(id)) {
        // une flèche monte vers le ciel, puis une pluie retombe sur chaque cible
        const up = new THREE.Vector3(from.x + sx * 2.5, from.y + 13, from.z + sz * 2.5);
        arrows.shoot(from, up, { dur: 0.2, arc: 0, color: col, big: true, linger: 0.02, streak: 3.5 });
        const spots = targets.length ? targets.map((t) => ({ x: t.pos.x, y: t.pos.y, z: t.pos.z })) : [{ x: from.x + sx * range * 0.55, y: p.pos.y, z: from.z + sz * range * 0.55 }];
        const per = spots.length > 5 ? 2 : (low ? 3 : 5);
        spots.forEach((sp) => {
          for (let k = 0; k < per; k++) {
            const gx = sp.x + R() * 1.1, gz = sp.z + R() * 1.1;
            const a = new THREE.Vector3(gx + R() * 1.5, sp.y + 14 + Math.random() * 3, gz + R() * 1.5), b = new THREE.Vector3(gx, sp.y + 0.15, gz);
            arrows.shoot(a, b, { dur: 0.26 + Math.random() * 0.06, delay: 0.2 + k * 0.05 + Math.random() * 0.05, arc: 0, color: col, linger: 0.5, streak: 2.6 });
          }
          if (this.fx) {
            this.fx.ring(sp.x, sp.y, sp.z, col, 2.6, 0.7);
          }
        });
        targets.forEach(() => delays.push(0.2 + 0.28 + 0.12));
        return delays;
      }

      if (id === 'barrage') {
        const n = low ? 4 : 7;
        for (let k = 0; k < n; k++) {
          const t = targets.length ? targets[k % targets.length] : null;
          const b = t ? aimAt(t).add(new THREE.Vector3(R() * 0.5, R() * 0.4, R() * 0.5)) : forwardPt(range * (0.75 + Math.random() * 0.4)).add(new THREE.Vector3(R() * 2.5, 0, R() * 2.5));
          arrows.shoot(from, b, { dur: flightOf(from, b), delay: k * 0.055, color: col, linger: 0.4 });
        }
        targets.forEach((t, i) => delays.push(flightOf(from, aimAt(t)) + 0.14 + 0.02 * i));
        return delays;
      }

      if (id === 'multi_shot') {
        const main = targets[0] ? aimAt(targets[0]) : forwardPt(range * 0.9);
        const base = Math.atan2(main.x - from.x, main.z - from.z), d = Math.hypot(main.x - from.x, main.z - from.z);
        const n = low ? 3 : 5;
        for (let k = 0; k < n; k++) {
          const ang = base + (k - (n - 1) / 2) * 0.16, tg = new THREE.Vector3(from.x + Math.sin(ang) * d, main.y - Math.abs(k - (n - 1) / 2) * 0.15, from.z + Math.cos(ang) * d);
          arrows.shoot(from, tg, { dur: flightOf(from, tg), delay: Math.abs(k - (n - 1) / 2) * 0.015, color: col, big: true, linger: 0.4 });
        }
        targets.forEach((t) => delays.push(flightOf(from, aimAt(t)) + 0.02));
        return delays;
      }

      // tirs ciblés (quick_shot, power_shot, piercing_arrow, hunters_mark, deadeye…)
      const pierce = id === 'piercing_arrow';
      const maxArrows = 4;
      if (!targets.length) {
        const b = forwardPt(range * 0.95);
        arrows.shoot(from, b, { dur: flightOf(from, b), color: col, big, linger: 0.45 });
        return delays;
      }
      targets.forEach((t, i) => {
        const a = aimAt(t);
        const fl = flightOf(from, a);
        delays.push(fl);
        if (i >= maxArrows) return;
        let b = a;
        if (pierce) { const d = a.clone().sub(from).normalize(); b = a.clone().addScaledVector(d, 4.5); }
        arrows.shoot(from, b, { dur: pierce ? flightOf(from, b) : fl, color: col, big, linger: 0.45, streak: big ? 3.4 : 2.3 });
      });
      return delays;
    } catch (e) { console.warn('[V3.2] flèches ignorées', e); return null; }
  }

  // Effets visuels V2.5 du lancer de compétence (jamais bloquants pour le combat)
  _castFx(skill, p, targets, arrowsUsed = false) {
    const fx = this.fx;
    if (!fx || !fx.enabled) return;
    if (!skill.damage && !skill.heal) return; // compétences de soutien : effets gérés par SkillEffects
    try {
      const col = skillColor(skill, p.classId), cls = p.classId;
      const sx = Math.sin(p.yaw), sz = Math.cos(p.yaw);
      if (skill.heal) {
        fx.ring(p.pos.x, p.pos.y, p.pos.z, 0x7dffb0, 2.8, 0.7);
        fx.pillar(p.pos.x, p.pos.y, p.pos.z, 0x7dffb0, 4.5, 0.9, 0.8);
        fx.rune(p.pos.x, p.pos.y, p.pos.z, col, 1.9, 0.9);
        this.particles.emit(p.pos.x, p.pos.y + 0.3, p.pos.z, { count: 22, color: 0x7dffb0, speed: 2, life: 1.0, gravity: -1.5, up: 2, spread: 0.6 });
        return;
      }
      const big = skill.anim === 'attack2';
      if (cls === 'mage' || cls === 'archer') {
        const from = new THREE.Vector3(p.pos.x + sx * 0.6, p.pos.y + 1.3, p.pos.z + sz * 0.6);
        const t0 = targets[0];
        const to = t0 ? new THREE.Vector3(t0.pos.x, t0.pos.y + 1.0, t0.pos.z) : new THREE.Vector3(from.x + sx * (skill.range || 5), from.y - 0.2, from.z + sz * (skill.range || 5));
        fx.flash(from.x, from.y, from.z, col, big ? 2.2 : 1.4, 0.22);
        if (cls === 'archer') { if (!arrowsUsed) fx.beam(from, to, 0xeaffd8, big ? 0.16 : 0.1, 0.18); }
        else {
          if (!arrowsUsed) fx.beam(from, to, col, big ? 0.55 : 0.36, 0.24);
          if (big) fx.rune(p.pos.x, p.pos.y, p.pos.z, col, 2.2, 0.8);
        }
        if (skill.aoe) {
          fx.ring(to.x, to.y - 1.0, to.z, col, skill.range * 0.6, 0.55);
          fx.rune(to.x, to.y - 1.0, to.z, col, 2.2, 0.9);
        }
      } else {
        fx.slash(p.pos.x, p.pos.y + 1.15, p.pos.z, p.yaw, col, { big, tilt: big ? 0.15 : 0.7, wide: !!skill.aoe, flip: Math.random() < 0.5 });
        if (skill.aoe) fx.ring(p.pos.x, p.pos.y, p.pos.z, col, skill.range * 0.8, 0.5);
        if (big && !skill.aoe) fx.flash(p.pos.x + sx * 1.0, p.pos.y + 1.1, p.pos.z + sz * 1.0, col, 1.8, 0.2);
      }
    } catch (e) { /* effet ignoré */ }
  }
}
