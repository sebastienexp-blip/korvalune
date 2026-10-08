import * as THREE from 'three';
import { applyStun, applySlow, applyDot } from './Status.js';

const DMG_TYPE_COLOR = { fire: 0xff5a2a, ice: 0x7fd8ff, lightning: 0xffe259, physical: 0xffffff };

// Tente de déclencher les effets spéciaux (sorts automatiques) de l'équipement
// du joueur pour un déclencheur donné ('hit' = vient d'infliger des dégâts,
// 'hurt' = vient d'en subir). Gère lui-même le temps de recharge par effet.
// ctx = { enemies, boss, particles, audio, bus }
export function tryTriggerEquipEffects(trigger, player, ctx) {
  if (!player.equipEffects || !player.equipEffects.length) return;
  const now = performance.now() / 1000;
  for (const eff of player.equipEffects) {
    if (eff.triggerOn !== trigger) continue;
    const readyAt = player.effectCooldowns[eff.id] || 0;
    if (readyAt > now) continue;
    if (Math.random() > eff.chance) continue;
    player.effectCooldowns[eff.id] = now + eff.cooldown;
    fireEquipEffect(eff, player, ctx);
  }
}

function fireEquipEffect(eff, player, ctx) {
  if (eff.staminaPct) {
    player.stamina = Math.min(player.maxStamina, player.stamina + player.maxStamina * eff.staminaPct);
    ctx.particles?.emit(player.pos.x, player.pos.y + 1, player.pos.z, { count: 18, color: 0xffe29a, speed: 2.6, life: 0.5, up: 2 });
    ctx.bus?.emit('floatText', { pos: player.pos.clone().add({ x: 0, y: 2.4, z: 0 }), text: eff.name, color: '#ffe29a', big: true });
    return;
  }
  if (eff.manaPct) {
    player.mana = Math.min(player.maxMana, player.mana + player.maxMana * eff.manaPct);
    ctx.particles?.emit(player.pos.x, player.pos.y + 1, player.pos.z, { count: 18, color: 0x6aa8ff, speed: 2.6, life: 0.5, up: 2 });
    ctx.bus?.emit('floatText', { pos: player.pos.clone().add({ x: 0, y: 2.4, z: 0 }), text: eff.name, color: '#6aa8ff', big: true });
    return;
  }
  if (eff.wardSec) player.invuln = Math.max(player.invuln || 0, eff.wardSec);
  if (eff.healPct) {
    player.heal(player.maxHp * eff.healPct);
    ctx.particles?.emit(player.pos.x, player.pos.y + 1, player.pos.z, { count: 24, color: 0x6dffb0, speed: 3, life: 0.6, up: 2 });
    ctx.audio?.play('heal');
    ctx.bus?.emit('floatText', { pos: player.pos.clone().add({ x: 0, y: 2.4, z: 0 }), text: eff.name, color: '#6dffb0', big: true });
    return;
  }

  const candidates = [...(ctx.enemies || []).filter((e) => e.alive)];
  for (const b of ctx.bosses || []) if (b.alive && b.state !== 'dormant') candidates.push(b);
  const inRange = candidates.filter((e) => player.pos.distanceTo(e.pos) <= eff.range);
  if (!inRange.length) return;

  let targets;
  if (eff.aoe) targets = inRange;
  else {
    inRange.sort((a, b) => player.pos.distanceTo(a.pos) - player.pos.distanceTo(b.pos));
    targets = [inRange[0]];
  }

  const dmg = Math.max(1, Math.round(player.atk * eff.power));
  const color = DMG_TYPE_COLOR[eff.dmgType] || 0xffffff;
  for (const t of targets) {
    t.takeDamage(dmg, false, player);
    if (eff.stunSec) applyStun(t, eff.stunSec);
    if (eff.slowSec) applySlow(t, eff.slowF || 0.5, eff.slowSec);
    if (eff.dotSec) applyDot(t, Math.max(1, Math.round(player.atk * (eff.dotPower || 0.4))), eff.dotSec, 'poison');
    ctx.particles?.emit(t.pos.x, t.pos.y + 1, t.pos.z, { count: eff.aoe ? 14 : 20, color, speed: 3.6, life: 0.55 });
  }
  ctx.audio?.play('crit');
  ctx.bus?.emit('floatText', { pos: (targets[0]?.pos || player.pos).clone().add({ x: 0, y: 2.2, z: 0 }), text: eff.name, color: '#ffd23f', big: true });
  ctx.bus?.emit('shake', 0.18);
}
