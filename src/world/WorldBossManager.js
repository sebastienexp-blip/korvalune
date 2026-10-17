import * as THREE from 'three';
import { WorldBoss } from '../entities/WorldBoss.js';
import { ModelLibrary } from '../visual/ModelLibrary.js';
import { regionAt, REGION_BY_ID, isLand } from './Continent.js';
import { WB_ORDER, WB_WARN_MS, WORLD_BOSSES, wbSchedule, wbNextWindow, fmtDur } from '../data/worldBosses.js';

const KEY = 'korvalune.wbKilled';

// V10.92 — Gère le cycle des boss mondiaux : un boss par tranche d'une heure (heure universelle), préavis, apparition,
// disparition en fin de fenêtre (sauf s'il est engagé), mémoire locale des boss déjà vaincus.
export class WorldBossManager {
  constructor(game) {
    this.g = game;
    this.cur = null;            // { slot, rid, boss }
    this.killed = this._load();
    this._acc = 1; this._loading = null; this._warned = new Set(); this._announced = new Set();
    this._pos = {};
    game.bus.on('bossDefeated', (b) => {
      if (!b.isWorldBoss) return;
      this.killed[b.slot] = 1; this._save();
      this._cleanup = { t: 12, boss: b };
    });
    game.bus.on('bossAbandon', (b) => { if (b.isWorldBoss) game.hud.notify(`${b.name} abandonne le combat et regagne son antre.`, 'info'); });
  }

  _load() { try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }
  _save() {
    const keys = Object.keys(this.killed).map(Number).sort((a, b) => a - b).slice(-40);
    const o = {}; for (const k of keys) o[k] = 1; this.killed = o;
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* ignoré */ }
  }

  /** Point d'apparition (déterministe → identique pour tous les joueurs) : décalage autour du centre de la région, premier endroit praticable. */
  posOf(rid) {
    if (this._pos[rid]) return this._pos[rid];
    const w = this.g.world, R = REGION_BY_ID[rid], d = WORLD_BOSSES[rid];
    const bx = R.site[0] + d.pre[0], bz = R.site[1] + d.pre[1];
    const r = Math.min(9, d.height * 0.5);
    let best = null;
    for (let ring = 0; ring < 14 && !best; ring++) {
      const n = ring ? ring * 8 : 1;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = bx + Math.cos(a) * ring * 7, z = bz + Math.sin(a) * ring * 7;
        if (isLand(x, z) && regionAt(x, z).id === rid && w.isWalkable(x, z, r) && w.heightAt(x, z) > w.waterLevel + 0.6) { best = [x, z]; break; }
      }
    }
    if (!best) best = [bx, bz];
    return (this._pos[rid] = { x: Math.round(best[0]), z: Math.round(best[1]) });
  }

  _spawn(sch) {
    const g = this.g, d = sch.boss, p = this.posOf(sch.regionId);
    const pos = new THREE.Vector3(p.x, g.world.heightAt(p.x, p.z), p.z);
    const boss = new WorldBoss(g.scene, g.world, g.bus, pos, d, sch.slot);
    g.gw.tag(boss, 'b:wb' + sch.slot);
    g.bosses.push(boss);
    this.cur = { slot: sch.slot, rid: sch.regionId, boss };
    return boss;
  }

  _despawn(c) {
    const g = this.g, b = c.boss;
    try { g.scene.remove(b.rig.root); } catch { /* ignoré */ }
    const i = g.bosses.indexOf(b); if (i >= 0) g.bosses.splice(i, 1);
    if (g.player?.target === b) g.player.target = null;
    g.hud.showBossBar?.(null);
    if (this.cur === c) this.cur = null;
  }

  update(dt) {
    const g = this.g;
    if (this._cleanup) { this._cleanup.t -= dt; if (this._cleanup.t <= 0) { const c = this._cleanup; this._cleanup = null; if (this.cur && this.cur.boss === c.boss) this._despawn(this.cur); } }
    this._acc += dt;
    if (this._acc < 1) return;
    this._acc = 0;
    if (!g.player || g.rift?.active) return;
    const now = Date.now(), sch = wbSchedule(now);

    // préavis 5 min avant la prochaine tranche + préchargement du modèle
    const nxt = wbSchedule(now + sch.nextIn + 1000);
    if (sch.nextIn < WB_WARN_MS + 30000) ModelLibrary.ensureBossModel(nxt.boss.species);
    if (sch.nextIn <= WB_WARN_MS && !this._warned.has(nxt.slot)) {
      this._warned.add(nxt.slot);
      g.hud.notify(`${nxt.boss.icon} Dans 5 min : ${nxt.boss.name} — ${REGION_BY_ID[nxt.regionId].name}`, 'boss');
    }

    // fin de fenêtre : le boss disparaît s'il n'est pas engagé
    if (this.cur) {
      const c = this.cur;
      if (c.slot !== sch.slot || !sch.windowOpen) {
        if (!c.boss.alive || !c.boss.engaged) this._despawn(c);
      }
    }

    // apparition
    if (sch.windowOpen && !this.killed[sch.slot] && !this.cur && !this._loading) {
      const slot = sch.slot;
      this._loading = ModelLibrary.ensureBossModel(sch.boss.species).then((ok) => {
        this._loading = null;
        const s2 = wbSchedule(Date.now());
        if (!ok || s2.slot !== slot || !s2.windowOpen || this.cur || !this.g.player || this.killed[slot]) return;
        this._spawn(s2);
        if (!this._announced.has(slot)) {
          this._announced.add(slot);
          const R = REGION_BY_ID[s2.regionId], fresh = Date.now() - s2.slotStart < 120000;
          this.g.banner?.show({ kind: 'boss', icon: s2.boss.icon, text: `${s2.boss.name} est apparu`, sub: `${R.name} · niveau ${s2.boss.level} · ouvre la carte pour le suivre`, secs: fresh ? 9 : 6 });
        }
      });
    }
  }

  /** Outil de test / admin : fait apparaître le boss d'une région tout de suite (hors planning). */
  async debugSpawn(rid) {
    const d = WORLD_BOSSES[rid]; if (!d) return null;
    if (this.cur) this._despawn(this.cur);
    await ModelLibrary.ensureBossModel(d.species);
    return this._spawn({ slot: -1 - WB_ORDER.indexOf(rid), regionId: rid, boss: d }).def.name;
  }

  /** Icônes de minimap/carte : le boss actif (vivant), position réelle. */
  active() { const c = this.cur; return c && c.boss.alive ? c : null; }

  /** Liste pour l'interface : une ligne par région, dans l'ordre de passage. */
  entries(now = Date.now()) {
    return WB_ORDER.map((rid) => {
      const d = WORLD_BOSSES[rid], R = REGION_BY_ID[rid], w = wbNextWindow(rid, now), p = this.posOf(rid);
      let status = 'wait', txt = '';
      if (w.open) {
        if (this.killed[w.slot]) { status = 'dead'; txt = 'Vaincu · renaît à la prochaine rotation'; }
        else { status = 'live'; txt = `Actif · ${fmtDur(w.end - now)} restant`; }
      } else txt = `Apparaît dans ${fmtDur(w.start - now)}`;
      return { rid, def: d, region: R, x: p.x, z: p.z, status, txt, at: w.start };
    }).sort((a, b) => (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1) || a.at - b.at);
  }
}
