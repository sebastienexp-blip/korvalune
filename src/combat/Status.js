import { share } from '../network/NetShare.js';
// Altérations d'état des ennemis/boss (V3.8) : étourdissement, ralentissement, poison/brûlure/saignement
// (dégâts sur la durée) et vulnérabilité. Stockées dans target.st ; mises à jour par tickStatus().

const st = (t) => t.st || (t.st = { stunT: 0, slowT: 0, slowF: 1, vulnT: 0, vulnM: 0, dots: [] });

// Les boss résistent : étourdissement bien plus court, ralentissement réduit.
const isBoss = (t) => t.maxHp > 0 && (t.id === 'spire_warden' || t.phase !== undefined);

export function applyStun(t, sec) {
  if (t.netProxy) { share.sendStatus?.(t.netKey, 'stun', sec); return; }
  const s = st(t);
  const d = isBoss(t) ? Math.min(1, sec * 0.3) : sec;
  s.stunT = Math.max(s.stunT, d);
}

export function applySlow(t, factor, sec) {
  if (t.netProxy) { share.sendStatus?.(t.netKey, 'slow', factor, sec); return; }
  const s = st(t);
  const f = isBoss(t) ? 1 - (1 - factor) * 0.5 : factor;
  if (s.slowT <= 0 || f < s.slowF) s.slowF = f;
  s.slowT = Math.max(s.slowT, sec);
}

// dps = dégâts par seconde déjà calculés (avec la puissance du joueur)
export function applyDot(t, dps, sec, kind = 'poison') {
  if (t.netProxy) { share.sendStatus?.(t.netKey, 'dot', dps, sec, kind); return; }
  const s = st(t);
  if (s.dots.length >= 4) s.dots.sort((a, b) => a.t - b.t).shift();
  s.dots.push({ dps, t: sec, kind, acc: 0, tick: 0 });
}

export function applyVuln(t, pct, sec) {
  if (t.netProxy) { share.sendStatus?.(t.netKey, 'vuln', pct, sec); return; }
  const s = st(t);
  s.vulnM = Math.max(s.vulnT > 0 ? s.vulnM : 0, pct);
  s.vulnT = Math.max(s.vulnT, sec);
}

export function vulnMult(t) {
  const s = t.st;
  return s && s.vulnT > 0 ? 1 + s.vulnM : 1;
}

export function isStunned(t) { return !!(t.st && t.st.stunT > 0); }
export function isSlowed(t) { return !!(t.st && t.st.slowT > 0); }

// Appelé chaque frame. Renvoie { stun, slow } ; applique les dégâts périodiques (toutes les 0,5 s).
export function tickStatus(t, dt, player) {
  const s = t.st;
  if (!s) return NONE;
  if (s.stunT > 0) s.stunT -= dt;
  if (s.slowT > 0) { s.slowT -= dt; if (s.slowT <= 0) s.slowF = 1; }
  if (s.vulnT > 0) { s.vulnT -= dt; if (s.vulnT <= 0) s.vulnM = 0; }
  if (s.dots.length) {
    let sum = 0;
    for (let i = s.dots.length - 1; i >= 0; i--) {
      const d = s.dots[i];
      const step = Math.min(dt, d.t);
      d.acc += d.dps * step; d.t -= dt; d.tick += dt;
      if (d.t <= 0 && d.acc <= 0) s.dots.splice(i, 1);
    }
    s.tickT = (s.tickT || 0) + dt;
    if (s.tickT >= 0.5 || (s.dots.every((d) => d.t <= 0))) {
      s.tickT = 0;
      for (const d of s.dots) { sum += d.acc; d.acc = 0; }
      s.dots = s.dots.filter((d) => d.t > 0);
      if (sum >= 1) {
        t.takeDamage(Math.round(sum), false, player, true);
        if (t.bus && t.pos) t.bus.emit('particles', { pos: t.pos.clone().add({ x: 0, y: 1, z: 0 }), color: DOT_COLOR[s.lastKind] || 0x7dff5a, count: 4, speed: 1.4, life: 0.5 });
      }
    }
    if (s.dots.length) s.lastKind = s.dots[s.dots.length - 1].kind;
  }
  if (s.stunT > 0 || s.slowT > 0 || s.dots.length || s.vulnT > 0) {
    out.stun = s.stunT > 0; out.slow = s.slowT > 0 ? s.slowF : 1;
    return out;
  }
  return NONE;
}

const DOT_COLOR = { poison: 0x7dff5a, burn: 0xff7a2a, bleed: 0xd22a2a };
const NONE = { stun: false, slow: 1 };
const out = { stun: false, slow: 1 };
