// V10.34 — Portail de ville : un portail violet s'ouvre sur le terrain, mène au portail du retour en ville ;
// le portail de la ville ramène exactement là où on était. Le groupe peut l'emprunter aussi.
import * as THREE from 'three';
import { buildPortal, updatePortal } from './Portals.js';
import { makeLabel } from '../ui/Label.js';
import { CONFIG } from '../core/config.js';

export const TOWN_PORTAL_POS = [10.5, -27.5]; // provisoire : sera déplacé dans la zone des portails (refonte de la ville)
const COLOR = '#a24dff';
const LIFE = 10 * 60 * 1000;    // le portail reste ouvert 10 minutes
const CHANNEL = 2.2;            // secondes d'incantation
const COOLDOWN = 12 * 1000;
const MAX_FIELD = 4;

export class TownPortal {
  constructor(game) {
    this.g = game;
    this.fields = [];    // { portal, x, z, owner, mine, until }
    this.ret = null;     // dernier portail de terrain utilisé / annoncé : { x, z }
    this.town = null;
    this._chan = null;
    this._cd = 0;
  }

  build() {
    const g = this.g;
    this.town = buildPortal(g.world, TOWN_PORTAL_POS, COLOR, 'Portail du retour', { noLight: true });
    try {
      const lb = makeLabel('Portail du retour', { color: '#d3a8ff', size: 38, width: 768, height: 96, scale: 4.2 });
      lb.position.set(0, 5.1, 0.2); this.town.group.add(lb);
    } catch { /* étiquette ignorée */ }
  }

  inTown(p) { return Math.hypot(p.x, p.z) < CONFIG.world.townRadius + 4; }

  // touche T / bouton : ouvre un portail à ses pieds (ou annule l'incantation)
  cast() {
    const g = this.g, p = g.player;
    if (!p || p.dead) return;
    if (this._chan) { this._chan = null; g.hud.notify('Portail annulé.', 'info'); return; }
    if (g.rift?.active) { g.hud.notify('Impossible d’ouvrir un portail de ville dans une faille.', 'info'); return; }
    if (this.inTown(p.pos)) { g.hud.notify('Tu es déjà à Korvalune. Utilise le portail violet pour revenir où tu étais.', 'info'); return; }
    if (Date.now() < this._cd) { g.hud.notify(`Portail en recharge (${Math.ceil((this._cd - Date.now()) / 1000)} s).`, 'info'); return; }
    this._chan = { t: 0, x: p.pos.x, z: p.pos.z };
    g.hud.notify('🌀 Ouverture du portail… ne bouge pas.', 'quest');
    g.audio.play('portal');
  }

  update(dt) {
    for (const f of this.fields) updatePortal(f.portal, dt);
    if (this.town) updatePortal(this.town, dt);
    const now = Date.now();
    for (let i = this.fields.length - 1; i >= 0; i--) if (this.fields[i].until < now) this._removeField(i);
    const c = this._chan, g = this.g, p = g.player;
    if (!c || !p) return;
    if (p.dead || Math.hypot(p.pos.x - c.x, p.pos.z - c.z) > 1.6) { this._chan = null; g.hud.notify('Portail interrompu.', 'info'); return; }
    c.t += dt;
    if (Math.random() < dt * 30) g.particles.emit(p.pos.x, p.pos.y + 0.2 + Math.random() * 1.6, p.pos.z, { count: 2, color: 0xa24dff, speed: 1.6, life: 0.7, up: 1.2, spread: 0.7 });
    if (c.t >= CHANNEL) {
      this._chan = null; this._cd = now + COOLDOWN;
      const yaw = p.yaw || 0;
      const x = p.pos.x + Math.sin(yaw) * 2.6, z = p.pos.z + Math.cos(yaw) * 2.6;
      this._addField(x, z, 'toi', true, now + LIFE);
      this.ret = { x, z };
      if (g.gw.members.length > 1) g.net.sendGr('tp', 'group', { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
      g.hud.notify('🌀 Portail ouvert (10 min). Ton groupe peut l’emprunter.', 'quest');
    }
  }

  _addField(x, z, owner, mine, until) {
    const g = this.g;
    // un seul portail par propriétaire
    const old = this.fields.findIndex((f) => f.owner === owner);
    if (old >= 0) this._removeField(old);
    if (this.fields.length >= MAX_FIELD) this._removeField(0);
    const portal = buildPortal(g.world, [x, z], COLOR, 'Portail de ville', { noLight: true, noCollide: true });
    try {
      const lb = makeLabel(mine ? 'Retour à Korvalune' : `Portail de ${owner}`, { color: '#d3a8ff', size: 38, width: 768, height: 96, scale: 3.6 });
      lb.position.set(0, 4.7, 0.2); portal.group.add(lb);
    } catch { /* étiquette ignorée */ }
    g.particles.emit(x, portal.pos.y + 1.5, z, { count: 50, color: 0xa24dff, speed: 4.5, life: 0.9, up: 2 });
    this.fields.push({ portal, x, z, owner, mine, until });
  }

  _removeField(i) {
    const f = this.fields[i]; if (!f) return;
    f.portal.group.parent?.remove(f.portal.group);
    f.portal.group.traverse((o) => { o.geometry?.dispose?.(); if (o.material) { for (const m of [].concat(o.material)) m.dispose?.(); } });
    this.fields.splice(i, 1);
    if (this.ret && Math.hypot(this.ret.x - f.x, this.ret.z - f.z) < 0.5) this.ret = null;
  }

  // un membre du groupe a ouvert son portail
  onGroupPortal(fromId, d) {
    const g = this.g;
    if (!d || !Number.isFinite(d.x) || !Number.isFinite(d.z) || Math.abs(d.x) > 600 || Math.abs(d.z) > 600) return;
    const name = g.group.find((m) => m.id === fromId)?.name;
    if (!name) return;
    this._addField(d.x, d.z, name, false, Date.now() + LIFE);
    this.ret = { x: d.x, z: d.z };
    g.hud.notify(`🌀 ${name} a ouvert un portail de ville. Tu peux l’emprunter à Korvalune.`, 'quest');
  }

  _arrive(x, z) {
    const g = this.g, p = g.player;
    const y = g.world.heightAt(x, z);
    p.pos.set(x, y, z); p.vel.set(0, 0, 0);
    g.particles.emit(x, y + 1, z, { count: 70, color: 0xa24dff, speed: 5.5, life: 1, up: 2.5 });
    g.audio.play('portal');
  }

  // touche E : utilise un portail à proximité ; renvoie true si c'était le cas
  tryInteract() {
    const g = this.g, p = g.player;
    if (!p || g.rift?.active) return false;
    for (const f of this.fields) {
      if (Math.hypot(p.pos.x - f.x, p.pos.z - f.z) < 3) {
        this.ret = { x: f.x, z: f.z };
        const tx = TOWN_PORTAL_POS[0] + 0.4, tz = TOWN_PORTAL_POS[1] + 2.9;
        this._arrive(tx, tz);
        g.hud.notify('Bienvenue à Korvalune. Le portail violet te ramènera où tu étais.', 'quest');
        return true;
      }
    }
    if (this.town && p.pos.distanceTo(this.town.pos) < 3.8) {
      if (!this.ret) { g.hud.notify('Aucun portail ouvert : appuie sur T (ou le bouton 🌀) sur le terrain pour en ouvrir un.', 'info'); return true; }
      const f = this.fields.find((q) => Math.hypot(q.x - this.ret.x, q.z - this.ret.z) < 0.5);
      if (!f) { this.ret = null; g.hud.notify('Le portail a disparu.', 'info'); return true; }
      this._arrive(this.ret.x + 0.4, this.ret.z + 2.4);
      g.hud.notify('Tu reviens là où tu étais.', 'quest');
      return true;
    }
    return false;
  }
}
