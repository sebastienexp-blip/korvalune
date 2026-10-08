import * as THREE from 'three';
import { share, RemoteTarget } from './NetShare.js';
import { applyStun, applySlow, applyDot, applyVuln } from '../combat/Status.js';

// Monde partagé d'un groupe (V6.0).
//  • l'HÔTE (choisi par le serveur : le chef, ou le premier membre qui n'est pas dans une spire) simule les monstres et les boss ;
//  • les INVITÉS voient des copies (« proxys ») : leurs dégâts partent vers l'hôte, qui tranche ;
//  • chaque joueur reçoit SON XP, SON or, SON butin et la progression de SES quêtes (s'il est à moins de 90 m).
const SNAP_EVERY = 0.125;
const SNAP_RANGE = 150;
const MAX_DMG = 5e6;

export class GroupWorld {
  constructor(game) {
    this.g = game;
    this.net = game.net;
    this.members = [];
    this.hostId = null;     // hôte de MA salle (monde ouvert, ou la spire où je suis)
    this.leaderId = null;
    this.targets = new Map();   // id -> RemoteTarget (membres distants, utilisés par l'IA de l'hôte)
    this.role = 'solo';
    this._room = 0;
    this._acc = 0;
    this._map = new Map(); this._mapT = 0;
    share.sendDmg = (key, dmg, crit) => this.net.sendGr('dmg', 'host', { k: key, d: Math.round(Math.min(dmg, MAX_DMG)), c: crit ? 1 : 0 });
    share.sendStatus = (key, kind, a, b, c) => this.net.sendGr('st', 'host', { k: key, n: kind, a, b, c });
    share.onKill = (e) => { if (this.role === 'host' && this.members.length > 1) this.net.sendGr('ekill', 'group', { k: e.netKey }); };
    const bus = game.bus;
    bus.on('enemyShoot', (d) => {
      if (this.role !== 'host' || d.net || !d.enemy?.netKey || this.members.length < 2) return;
      this.net.sendGr('evt', 'group', { n: 'shoot', f: [d.from.x, d.from.y, d.from.z], v: [d.dir.x, d.dir.y, d.dir.z], s: d.speed, m: d.damage, c: d.color, r: d.range });
    });
    bus.on('hazard', (d) => {
      if (this.role !== 'host' || d.net || !d.fromBoss || this.members.length < 2) return;
      this.net.sendGr('evt', 'group', { n: 'haz', x: d.x, z: d.z, ra: d.radius, de: d.delay, m: d.damage, c: d.color });
    });
  }

  // ---------- Groupe ----------
  onGroup(msg) {
    this.members = msg.members || [];
    this.leaderId = msg.leader || null;
    const ids = new Set(this.members.map((m) => m.id).filter((id) => id !== this.net.id));
    for (const id of [...this.targets.keys()]) if (!ids.has(id)) this.targets.delete(id);
    for (const m of this.members) {
      if (m.id === this.net.id) continue;
      let t = this.targets.get(m.id);
      if (!t) { t = new RemoteTarget(m.id, (to, dmg) => this.net.sendGr('hit', to, { d: dmg })); this.targets.set(m.id, t); }
      t.set(m.pos || [0, 0, 0], m.hp);
      t.inst = m.inst | 0;
    }
    this._refreshRole();
  }

  onMoved(msg) {
    const t = this.targets.get(msg.id);
    if (t) { t.set(msg.pos, msg.hp); t.inst = msg.inst | 0; }
  }

  // « Salle » : 0 = monde ouvert, sinon la graine de la spire où je suis (les monstres d'une salle sont simulés par l'hôte de cette salle)
  get room() { const r = this.g.rift; return r?.active && r.run ? ((r.run.seed | 0) || 1) : 0; }
  _inRoom(t) { return (t.inst | 0) === this.room; }

  _refreshRole() {
    const room = this.room;
    let role = 'solo';
    this.hostId = null;
    if (this.net.id && this.members.length > 1) {
      // l'hôte = premier membre (chef d'abord) présent dans ma salle ; moi je suis toujours dans ma salle
      const first = this.members.find((m) => m.id === this.net.id || (m.inst | 0) === room);
      const inRoom = this.members.filter((m) => m.id === this.net.id || (m.inst | 0) === room).length;
      if (first && inRoom > 1) { this.hostId = first.id; role = first.id === this.net.id ? 'host' : 'guest'; }
    }
    if (role === this.role && !this._roomChanged(room)) return;
    this._room = room;
    const was = this.role;
    this.role = role; share.role = role;
    const proxy = role === 'guest';
    for (const e of this.g.enemies) if (e.netKey) e.netProxy = proxy;
    for (const b of this.g.bosses) if (b.netKey) b.netProxy = proxy;
    if (role === 'solo' || was === 'solo') this.g.hud.notify(role === 'solo' ? 'Monde de groupe : terminé (mode solo).' : (role === 'host' ? 'Monde de groupe : tu fais tourner les monstres pour ton groupe.' : 'Monde de groupe : tu combats les mêmes monstres que ton groupe.'), 'quest');
  }

  _roomChanged(room) { return this._room !== room && this._room !== undefined; }

  // Annonce aux autres membres que j'entre dans une spire (ils peuvent me rejoindre)
  announceRift(info) { if (this.members.length > 1) this.net.sendGr('rift', 'group', info); }
  announceGuardian(name) { if (this.role === 'host') this.net.sendGr('evt', 'group', { n: 'guardian', nm: name }); }

  // Marque un monstre/boss comme partagé (clé identique chez tous les joueurs).
  tag(e, key) { e.netKey = key; e.netProxy = this.role === 'guest'; }

  get isHost() { return this.role === 'host'; }
  get isGuest() { return this.role === 'guest'; }

  // positions de tous les membres que l'hôte doit servir (lui compris)
  activeTargets() {
    const out = [this.g.player];
    if (this.role === 'host') for (const t of this.targets.values()) if (this._inRoom(t)) out.push(t);
    return out;
  }

  nearestDist(pos) {
    let best = this.g.player.pos.distanceTo(pos);
    if (this.role === 'host') for (const t of this.targets.values()) if (this._inRoom(t)) best = Math.min(best, t.pos.distanceTo(pos));
    return best;
  }

  // distance (au sol) au membre servi le plus proche
  nearestDist2D(pos) {
    let best = Math.hypot(this.g.player.pos.x - pos.x, this.g.player.pos.z - pos.z);
    if (this.role === 'host') for (const t of this.targets.values()) if (this._inRoom(t)) best = Math.min(best, Math.hypot(t.pos.x - pos.x, t.pos.z - pos.z));
    return best;
  }

  // Quelle cible un monstre doit-il poursuivre ? (le plus proche vivant, avec un peu d'hystérésis)
  pick(e) {
    const p = this.g.player;
    if (this.role !== 'host' || !e.netKey || !this.targets.size) return p;
    let best = null, bd = Infinity;
    for (const t of this.activeTargets()) {
      if (t.dead) continue;
      const d = t.pos.distanceToSquared(e.pos);
      if (d < bd) { bd = d; best = t; }
    }
    const cur = e._tgt;
    if (cur && !cur.dead && cur !== best && cur.pos.distanceToSquared(e.pos) <= bd * 1.6) best = cur;
    e._tgt = best || p;
    return e._tgt;
  }

  // ---------- Boucle ----------
  update(dt) {
    this._refreshRole();
    if (this.role !== 'host') return;
    this._acc += dt;
    if (this._acc < SNAP_EVERY) return;
    this._acc = 0;
    const far = [...this.targets.values()].filter((t) => this._inRoom(t));
    if (!far.length) return;
    const near = (pos) => { for (const t of far) if (Math.abs(t.pos.x - pos.x) < SNAP_RANGE && Math.abs(t.pos.z - pos.z) < SNAP_RANGE) return true; return false; };
    const es = [];
    for (const e of this.g.enemies) if (e.netKey && !e.netProxy && near(e.pos)) es.push(e.netSnap());
    const bs = [];
    for (const b of this.g.bosses) if (b.netKey && !b.netProxy) bs.push(b.netSnap());
    const body = { e: es, b: bs };
    const rift = this.g.rift;
    this._kT = (this._kT || 0) + SNAP_EVERY;
    if (rift?.active && rift.run && this._kT >= 1) { // une fois par seconde : monstres déjà tués + Gardien présent
      this._kT = 0;
      body.k = [...rift.run.killedKeys];
      if (rift.run.guardianSpawned && rift.run.guardian) body.g = rift.run.guardian.name.replace(/ · Nv\.\d+$/, '');
    }
    this.net.sendGr('snap', 'group', body);
  }

  _index() {
    this._map.clear();
    for (const e of this.g.enemies) if (e.netKey) this._map.set(e.netKey, e);
    for (const b of this.g.bosses) if (b.netKey) this._map.set(b.netKey, b);
  }

  // ---------- Messages reçus ----------
  onRelay(msg) {
    const g = this.g, d = msg.d || {};
    switch (msg.k) {
      case 'snap': {
        if (this.role !== 'guest') return;
        this._index();
        for (const a of d.e || []) this._map.get(a[0])?.netApply(a);
        for (const a of d.b || []) this._map.get(a[0])?.netApply(a);
        if (g.rift?.active) { if (d.k) g.rift.netKilled(d.k); if (d.g) g.rift.onNetGuardian(d.g); }
        break;
      }
      case 'dmg': {
        if (this.role !== 'host') return;
        this._index();
        const e = this._map.get(d.k), who = this.targets.get(msg.from);
        if (!e || !who || e.netProxy || !(d.d > 0) || d.d > MAX_DMG) return;
        if (e.pos.distanceTo(who.pos) > 90) return; // trop loin pour avoir frappé
        e.takeDamage(d.d, !!d.c, who);
        break;
      }
      case 'st': {
        if (this.role !== 'host') return;
        this._index();
        const e = this._map.get(d.k);
        if (!e || e.netProxy) return;
        const a = Number(d.a), b = Number(d.b);
        if (!Number.isFinite(a)) return;
        if (d.n === 'stun') applyStun(e, Math.min(10, a));
        else if (d.n === 'slow' && Number.isFinite(b)) applySlow(e, Math.max(0.1, Math.min(1, a)), Math.min(15, b));
        else if (d.n === 'dot' && Number.isFinite(b)) applyDot(e, Math.min(MAX_DMG, a), Math.min(15, b), ['poison', 'burn', 'bleed'].includes(d.c) ? d.c : 'poison');
        else if (d.n === 'vuln' && Number.isFinite(b)) applyVuln(e, Math.min(1, a), Math.min(15, b));
        break;
      }
      case 'ekill': {
        if (this.role !== 'guest') return;
        this._index();
        const e = this._map.get(d.k);
        if (!e) return;
        if (e.alive) { e.hp = 0; if (e.die) e.die(); else e.kill(g.player); }
        break;
      }
      case 'hit': {
        if (g.player.dead || !(d.d > 0) || d.d > MAX_DMG) return;
        g.player.takeDamage(d.d);
        break;
      }
      case 'rift': {
        g.onGroupRift?.(msg.from, d);
        break;
      }
      case 'evt': {
        if (d.n === 'guardian') { g.rift?.onNetGuardian?.(d.nm); return; }
        if (d.n === 'shoot') g.bus.emit('enemyShoot', { from: new THREE.Vector3(...d.f), dir: new THREE.Vector3(...d.v), speed: d.s, damage: d.m, color: d.c, range: d.r, net: true });
        else if (d.n === 'haz') g.bus.emit('hazard', { x: d.x, z: d.z, radius: d.ra, delay: d.de, damage: d.m, color: d.c, net: true });
        break;
      }
      default: break;
    }
  }
}
