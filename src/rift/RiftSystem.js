import * as THREE from 'three';
import { clamp } from '../core/math.js';
import enemiesData from '../data/enemies.json';
import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { LootDrop } from '../entities/LootDrop.js';
import { rollLootItem, generateItem } from '../inventory/ItemGenerator.js';
import { rollRarityTier } from '../data/rarities.js';
import { makeLabel } from '../ui/Label.js';
import { glowTexture, safeTexture } from '../visual/Textures.js';
import { buildPortal, updatePortal } from '../world/Portals.js';
import { STATUE_PORTAL_POS } from './RiftStatue.js';
import { ARENA, cellCenter, cellAt, cellKey, generateLayout, buildRiftWorld } from './RiftLayout.js';
import {
  MODES, GEMS, GEM_IDS, OBELISKS, TOTEMS, AFFIXES, AFFIX_IDS, GUARDIAN_NAMES, ZENITH_TIME, FERVOR_MAX,
  RIFT_THEMES, riftMults, themeFor, normalizeRiftSave, gemBonuses, gemUpgradeChance, gemStepsForTime,
  KEY_PRICE, CRAFT_ZKEY_COST, GAMBLE, RIFT_MAX_LEVEL, riftLootShift
} from './RiftData.js';
import { RiftUI } from '../ui/RiftUI.js';

const ACTIVATE_DIST = 50, DEACTIVATE_DIST = 82;
const MAX_ACTIVE = { verylow: 14, low: 18, medium: 24, high: 30, ultra: 36 };
const WEIGHT = { normal: 1, champion: 2.5, leader: 6, minion: 1.5 };
const RETURN_POS = [-8.5, 25.5];

const rr = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Moteur des Spires d'Éther :
// clés, Ascension (jauge de progression + Gardien), Zénith chronométrée avec montée de cristaux,
// obélisques, totems, coffres piégés, lutins trésor, perles de vie, Ferveur d’éther, poussière d’éther.
export class RiftSystem {
  constructor(game, saved) {
    this.g = game;
    this.data = normalizeRiftSave(saved);
    this.active = false;
    this.state = 'idle';       // idle | active | complete | failed
    this.run = null;
    this.pending = null;       // spire ouverte à la statue, pas encore franchie
    this.buffs = new Map();
    this.fervor = { stacks: 0, t: 0 };
    this.zoneName = '';
    this._eid = 0;
    this._hudT = 0; this._streamT = 0; this._hintKey = '';
    this._explosions = [];
    this.mmWorld = { mapCanvas: null, size: 1100 };
    this.mmExtra = { zone: '', portals: [], under: (...a) => this._drawMinimap(...a) };
    this.ui = new RiftUI(game.hud, this);
    this.applyGems();
    if (this.data.open) { // une spire ouverte avant de quitter reste ouverte à la statue
      this.pending = { modeId: this.data.open.modeId, level: this.data.open.level, seed: (Math.random() * 0x7fffffff) | 0, keyUsed: !!MODES[this.data.open.modeId].key };
      const m = MODES[this.pending.modeId];
      game.riftStatue?.setPortalOpen(true, `${m.name} — Niv. ${this.pending.level}`);
    }

    this._offs = [ // V10.29 : retirés par dispose() quand une autre partie démarre (sinon les kills comptaient en double)
      game.bus.on('enemyKilled', (e) => this._onEnemyKilled(e)),
      game.bus.on('bossKilled', (id) => { if (id === 'spire_warden') this._onGuardianDead(); }),
      game.bus.on('net:riftBoard', (msg) => this.ui.setBoard(msg)) // V10.29 : classement
    ];
  }

  get statue() { return this.g.riftStatue; }

  serialize() { return this.data; }

  dispose() { for (const off of this._offs || []) off(); this._offs = []; }

  applyGems() { this.g.player.setRiftBonus(gemBonuses(this.data.gems)); }

  // ------------------------------------------------------------------ interface statue
  getModel() {
    const p = this.g.player;
    return { data: this.data, playerLevel: p.level, coins: p.coins, pending: this.pending, active: this.active, keyPrice: KEY_PRICE(p.level), craftCost: CRAFT_ZKEY_COST };
  }

  openStatueUi() {
    const g = this.g;
    document.exitPointerLock?.();
    g.modalOpen = true;
    g.hud.showScreen('rift-screen');
    this.ui.openStatue();
    this.g._tut?.('rift');
    g.audio.play('open');
  }

  open(modeId, level) {
    const g = this.g, mode = MODES[modeId];
    level = clamp(Math.round(level), 1, RIFT_MAX_LEVEL);
    if (!mode) return false;
    if (this.active) { g.hud.notify('Vous êtes déjà dans une spire.', 'boss'); return false; }
    if (this.pending) { g.hud.notify('Une spire est déjà ouverte : franchissez le portail ou annulez-la.', 'boss'); g.audio.play('error'); return false; }
    if (mode.key && this.data[mode.key] < 1) { g.hud.notify(`Il vous faut un ${mode.keyName.toLowerCase()}.`, 'boss'); g.audio.play('error'); return false; }
    if (mode.key) this.data[mode.key]--;
    this.pending = { modeId, level, seed: (Math.random() * 0x7fffffff) | 0, keyUsed: !!mode.key };
    this.data.open = { modeId, level };
    this.statue.setPortalOpen(true, `${mode.name} — Niv. ${level}`);
    const sp = this.statue.portal.pos;
    g.particles.emit(sp.x, sp.y + 2, sp.z, { count: 80, color: 0x5ee6d0, speed: 6, life: 1.2, up: 3 });
    g.audio.play('portal');
    g.hud.notify(`${mode.icon} ${mode.name} niveau ${level} : le portail est ouvert à côté de la statue.`, 'quest');
    g._doSave();
    return true;
  }

  cancelPending() {
    if (!this.pending) return;
    const mode = MODES[this.pending.modeId];
    if (this.pending.keyUsed && mode.key) this.data[mode.key]++;
    this.pending = null; this.data.open = null;
    this.statue.setPortalOpen(false);
    this.g.hud.notify('Spire fermée — votre sceau vous est rendu.', 'info');
  }

  buyKey() {
    const p = this.g.player, price = KEY_PRICE(p.level);
    if (p.coins < price) { this.g.hud.notify('Pas assez d’or.', 'boss'); this.g.audio.play('error'); return false; }
    p.addCoins(-price); this.data.keys++;
    this.g.audio.play('coin');
    return true;
  }

  craftZenithKey() {
    if (this.data.keys < CRAFT_ZKEY_COST) { this.g.hud.notify(`Il faut ${CRAFT_ZKEY_COST} sceaux de spire.`, 'boss'); this.g.audio.play('error'); return false; }
    this.data.keys -= CRAFT_ZKEY_COST; this.data.zkeys++;
    this.g.audio.play('equip');
    return true;
  }

  gamble(catId) {
    const g = this.g, cat = GAMBLE.find((c) => c.id === catId);
    if (!cat) return null;
    if (this.data.shards < cat.cost) { g.hud.notify('Pas assez de poussière d’éther.', 'boss'); g.audio.play('error'); return null; }
    if (g.inventory.firstEmpty() === -1) { g.hud.notify('Inventaire plein.', 'boss'); g.audio.play('error'); return null; }
    this.data.shards -= cat.cost;
    const item = generateItem({ category: cat.id, itemLevel: Math.max(1, g.player.level + Math.round(rr(0, 4))), rarityTier: rollRarityTier({ shift: 7, minTier: 3 }) });
    g.inventory.addGenerated(item);
    g.audio.play('pickup');
    g.hud.notify(`🎲 Obtenu : ${item.icon || ''} ${item.name}`, 'quest');
    return item;
  }

  // amélioration d'un cristal avec les rangs en attente (voir Zénith)
  upgradeGem(gemId) {
    const d = this.data;
    if (!GEMS[gemId] || d.pending <= 0) return null;
    const steps = d.pending, L = d.pendingLevel || 1;
    let gained = 0;
    for (let i = 0; i < steps; i++) {
      const chance = gemUpgradeChance(d.gems[gemId], L);
      if (Math.random() < chance) { d.gems[gemId]++; gained++; }
    }
    d.pending = 0; d.pendingLevel = 0;
    this.applyGems();
    this.g.audio.play(gained ? 'levelup' : 'error');
    this.g.hud.notify(gained ? `${GEMS[gemId].icon} ${GEMS[gemId].name} : +${gained} rang${gained > 1 ? 's' : ''} (rang ${d.gems[gemId]})` : `${GEMS[gemId].icon} L'amélioration a échoué (spire trop facile pour ce rang).`, gained ? 'quest' : 'boss');
    this.g._doSave();
    return { gained, rank: d.gems[gemId] };
  }

  // ------------------------------------------------------------------ interactions
  tryInteract() {
    const g = this.g, p = g.player;
    if (!this.active) {
      if (d2(p.pos, this.statue.pos) < 5.2) { this.openStatueUi(); return true; }
      if (this.pending && d2(p.pos, this.statue.portal.pos) < 3.8) { this.enter(); return true; }
      return false;
    }
    const run = this.run;
    const near = this._nearestInteractable();
    if (!near) return false;
    if (near.kind === 'exit') { this.requestExit(); return true; }
    if (near.kind === 'obelisk' || near.kind === 'totem') { this._activateObject(near.obj); return true; }
    if (near.kind === 'chest') { this._startChest(near.obj); return true; }
    return false;
  }

  _nearestInteractable() {
    const run = this.run; if (!run) return null;
    const pp = this.g.player.pos;
    let best = null, bd = 3.6;
    for (const o of run.objects) {
      if (o.used || o.hidden) continue;
      if (o.kind === 'chest' && o.state !== 'closed') continue;
      const d = d2(pp, o.pos);
      if (d < bd) { bd = d; best = { kind: o.kind, obj: o }; }
    }
    for (const ep of run.exits) {
      const d = d2(pp, ep.pos);
      if (d < bd) { bd = d; best = { kind: 'exit', obj: ep }; }
    }
    return best;
  }

  requestExit() {
    const run = this.run; if (!run) return;
    if (this.state === 'complete' || this.state === 'failed' || run.mode.id === 'trial') { this.exit(); return; }
    let ok = true;
    if (typeof confirm === 'function') ok = confirm('Quitter la spire ? Le sceau utilisé sera perdu.');
    if (ok) { this._record(false); this.exit(); }
  }

  // ------------------------------------------------------------------ entrée / sortie
  enter() {
    const g = this.g, p = this.pending;
    if (!p || this.active) return;
    this.pending = null; this.data.open = null;
    this.statue.setPortalOpen(false);
    const mode = MODES[p.modeId], theme = themeFor(p.level);
    const worldIdx = Math.max(0, RIFT_THEMES.indexOf(theme));
    const layout = generateLayout(p.seed, mode.id === 'ascent' ? 18 : mode.id === 'zenith' ? 15 : 12, worldIdx);
    const built = buildRiftWorld(g.world, layout, theme);
    // l'environnement (crypte, caverne, ruines…) teinte aussi le brouillard et les couleurs du thème
    const runTheme = { ...theme, wall: built.wall, floor: built.floor, fog: built.fog };
    const run = {
      mode, level: p.level, theme: runTheme, layout, built, seed: p.seed,
      mults: riftMults(mode.id, p.level),
      packs: [], live: [], objects: [], pickups: [], exits: [], explored: new Set(),
      collected: 0, need: 1, kills: 0, deaths: 0, elapsed: 0, timeLeft: ZENITH_TIME,
      guardian: null, guardianSpawned: false, done: false, killedKeys: new Set(),
      checkpoint: new THREE.Vector3(built.start.x, 0, built.start.z + 6),
      chest: null, goblin: null, spriteCell: null, cell: null, msgT: 0
    };
    this.run = run;
    this._populate();
    this._spawnObjects();
    // portail de sortie au centre de la salle de départ
    this._addExitPortal(built.start.x, built.start.z - 7);
    // téléportation
    g.player.pos.set(built.start.x, 0, built.start.z + 4);
    g.player.vel.set(0, 0, 0); g.player.target = null;
    g.camera.position.set(built.start.x, 4, built.start.z + 10);
    this._explore(run.layout.start.gx, run.layout.start.gz);
    this._setEnvironment(true);
    this.active = true; this.state = 'active';
    this.zoneName = `${mode.id === 'ascent' ? 'Spire' : mode.id === 'zenith' ? 'Zénith' : 'Entraînement'} · Nv.${p.level}`;
    this.buffs.clear(); this.fervor.stacks = 0;
    g.audio.play('portal');
    g.particles.emit(g.player.pos.x, 1, g.player.pos.z, { count: 60, color: theme.color, speed: 5, life: 1, up: 2.5 });
    g.hud.notify(`${mode.icon} ${mode.name} — niveau ${p.level}`, 'quest');
    g.hud.zoneBanner?.(`― ${theme.name} · ${built.styleLabel} ―`);
    if (mode.timed) g.hud.notify('Le chronomètre tourne : 15 minutes !', 'boss');
    this.ui.showHud(true);
    this._pushHud(true);
    if (!this._viaGroup) g.gw.announceRift({ seed: p.seed, modeId: p.modeId, level: p.level }); // les membres du groupe peuvent me rejoindre
    this._viaGroup = false;
  }

  exit() {
    const g = this.g, run = this.run;
    if (!run) return;
    // monstres
    for (let i = g.enemies.length - 1; i >= 0; i--) {
      const e = g.enemies[i];
      if (e.rift || e.chestWave || e === run.spriteEnemy) { g.enemies.splice(i, 1); e.dispose(g.scene); }
    }
    g.lootSprite = null;
    if (g.player.target && !g.player.target.alive) g.player.target = null;
    if (run.guardian) {
      const bi = g.bosses.indexOf(run.guardian); if (bi !== -1) g.bosses.splice(bi, 1);
      g.scene.remove(run.guardian.rig.root); run.guardian.rig.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose?.(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.()); } });
      g.hud.showBossBar(null);
    }
    for (const pk of run.pickups) this._disposePickup(pk);
    for (const o of run.objects) this._disposeObject(o);
    for (const ep of run.exits) { g.world.group.remove(ep.portal.group); }
    for (const ld of g.lootDrops.splice(0)) ld.dispose(g.scene);
    run.built.dispose();
    this._setEnvironment(false);
    this.buffs.clear(); this.fervor.stacks = 0; this.updateBuffs(0);
    this.active = false; this.state = 'idle'; this.run = null;
    this.ui.showHud(false);
    this.g.hud.setHint?.(null);
    // retour en ville, devant la statue
    const p = g.player;
    p.pos.set(RETURN_POS[0], g.world.heightAt(RETURN_POS[0], RETURN_POS[1]), RETURN_POS[1]);
    p.vel.set(0, 0, 0);
    if (p.dead) p.respawn();
    p.pos.set(RETURN_POS[0], g.world.heightAt(RETURN_POS[0], RETURN_POS[1]), RETURN_POS[1]);
    g.camera.position.set(RETURN_POS[0], 4, RETURN_POS[1] + 8);
    g.particles.emit(p.pos.x, p.pos.y + 1, p.pos.z, { count: 50, color: 0x5ee6d0, speed: 5, life: 1, up: 2.5 });
    g.audio.play('portal');
    g.hud.notify('Retour à Korvalune.', 'info');
    g._doSave();
  }

  onRespawn() {
    const g = this.g, run = this.run, p = g.player;
    p.respawn();
    run.deaths++;
    p.pos.copy(run.checkpoint);
    p.vel.set(0, 0, 0); p.invuln = 2.5; p.target = null;
    g.camera.position.set(p.pos.x, 4, p.pos.z + 8);
    g.hud.notify(`☠ Vous réapparaissez au dernier point de contrôle (${run.deaths} mort${run.deaths > 1 ? 's' : ''}).`, 'boss');
  }

  _setEnvironment(on) {
    const g = this.g, dn = g.dayNight, scene = g.scene;
    const sky = [dn.dome, dn.sunMesh, dn.moonMesh, dn.stars, dn.clouds, dn.cloudPlanes, dn.sunGlow, dn.moonGlow];
    if (on) {
      this._env = { near: scene.fog.near, far: scene.fog.far, bg: scene.background, vis: sky.map((o) => (o ? o.visible : false)) };
      sky.forEach((o) => { if (o) o.visible = false; });
      scene.background = new THREE.Color(this.run.theme.fog);
      g.world.setGrassVisible?.(false);
    } else if (this._env) {
      sky.forEach((o, i) => { if (o) o.visible = this._env.vis[i]; });
      if (dn.clouds) dn.clouds.visible = false; // (l'ancien nuage en sphères reste désactivé)
      scene.background = this._env.bg;
      scene.fog.near = this._env.near; scene.fog.far = this._env.far;
      g.world.setGrassVisible?.(g._v25 && g.settings.quality !== 'verylow');
      this._env = null;
    }
  }

  // appelé après DayNight / Zones / Weather chaque image
  postUpdate() {
    if (!this.active) return;
    const g = this.g, dn = g.dayNight, f = g.scene.fog, th = this.run.theme;
    f.color.setHex(th.fog); f.near = 14; f.far = clamp((g._q?.fogFar || 180) * 0.5, 70, 110);
    dn.hemi.intensity = 1.25; dn.hemi.color.setHex(th.hemi);
    dn.sun.intensity = 1.2; dn.sun.color.setHex(0xffffff);
    if (g.weather) { g.weather.rain.visible = false; g.weather.snow.visible = false; }
  }

  // ------------------------------------------------------------------ génération du contenu
  _themeSpecies(key) { return enemiesData[key] ? key : 'wolf'; }

  _populate() {
    const run = this.run, theme = run.theme, rnd = run.layout.rnd, L = run.level;
    let sum = 0, pid = 0;
    const mkPack = (cell, type) => {
      const c = cellCenter(cell.gx, cell.gz);
      const center = new THREE.Vector3(c.x + (rnd() - 0.5) * 10, 0, c.z + (rnd() - 0.5) * 10);
      const pack = { id: pid++, cell: cellKey(cell.gx, cell.gz), center, type, members: [], active: false, cleared: false, affixes: [], remaining: 0 };
      const add = (species, role) => {
        const a = rnd() * Math.PI * 2, r = 1.5 + rnd() * 2.5;
        const m = { species: this._themeSpecies(species), role, pos: new THREE.Vector3(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r), killed: false, ref: null, weight: WEIGHT[role], pack };
        pack.members.push(m); sum += m.weight; pack.remaining++;
      };
      if (type === 'normal') { const n = 4 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) add(theme.species[Math.floor(rnd() * theme.species.length)], 'normal'); }
      else if (type === 'champion') {
        const sp = theme.species[Math.floor(rnd() * theme.species.length)];
        for (let i = 0; i < 3; i++) add(sp, 'champion');
        pack.affixes = this._rollAffixes(rnd, 2);
      } else {
        add(theme.elite, 'leader');
        for (let i = 0; i < 2; i++) add(theme.species[Math.floor(rnd() * theme.species.length)], 'minion');
        pack.affixes = this._rollAffixes(rnd, 2);
      }
      run.packs.push(pack);
    };
    for (const cell of run.layout.list) {
      if (cell.kind === 'start' || cell.kind === 'boss') continue;
      const n = 1 + (rnd() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const r = rnd();
        const type = cell.dist >= 3 && r < 0.12 ? 'elite' : cell.dist >= 2 && r < 0.3 ? 'champion' : 'normal';
        mkPack(cell, type);
      }
    }
    run.need = Math.max(1, sum * 0.8);
  }

  _rollAffixes(rnd, n) {
    const pool = AFFIX_IDS.slice(), out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out;
  }

  _spawnObjects() {
    const run = this.run, rnd = run.layout.rnd, g = this.g;
    const rooms = run.layout.list.filter((c) => c.kind === 'room');
    for (let i = rooms.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rooms[i], rooms[j]] = [rooms[j], rooms[i]]; }
    let ri = 0;
    const spot = () => {
      const c = rooms[ri++ % rooms.length];
      const p = cellCenter(c.gx, c.gz);
      return { x: p.x + (rnd() - 0.5) * 5, z: p.z + (rnd() - 0.5) * 5, cell: cellKey(c.gx, c.gz), cellObj: c };
    };
    const nObelisks = run.mode.id === 'zenith' ? 3 : run.mode.id === 'ascent' ? 2 : 1;
    const obIds = Object.keys(OBELISKS).sort(() => rnd() - 0.5);
    for (let i = 0; i < nObelisks; i++) { const s = spot(); this._makeObject('obelisk', OBELISKS[obIds[i]], s); }
    if (run.mode.id !== 'zenith') {
      const toIds = Object.keys(TOTEMS).sort(() => rnd() - 0.5);
      for (let i = 0; i < 2; i++) { const s = spot(); this._makeObject('totem', TOTEMS[toIds[i]], s); }
    }
    this._makeObject('chest', { id: 'chest', name: 'Coffre piégé', color: 0xff4a3a }, spot());
    if (run.mode.rewards && rnd() < (run.mode.id === 'zenith' ? 0.5 : 0.7)) run.spriteCell = spot().cell;
  }

  // ------------------------------------------------------------------ objets (obélisques, totems, coffre)
  _makeObject(kind, def, s) {
    const g = this.g, run = this.run;
    const grp = new THREE.Group();
    grp.position.set(s.x, 0, s.z);
    const stone = new THREE.MeshStandardMaterial({ color: 0x6f6b64, roughness: 0.95, flatShading: true });
    const glowMat = new THREE.MeshBasicMaterial({ color: def.color, fog: true });
    const parts = { glowMat };
    if (kind === 'chest') {
      const wood = new THREE.MeshStandardMaterial({ color: 0x4a2f20, roughness: 0.85 });
      const gold = new THREE.MeshStandardMaterial({ color: 0xb8892a, roughness: 0.4, metalness: 0.6 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.0), wood); base.position.y = 0.45; base.castShadow = true;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.5, 1.04), wood); lid.geometry.translate(0, 0.25, 0.52);
      lid.position.set(0, 0.9, -0.52); lid.castShadow = true;
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 1.08), gold); trim.position.y = 0.92;
      const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), glowMat); eye.position.set(0, 1.3, 0.55);
      grp.add(base, lid, trim, eye);
      parts.lid = lid; parts.eye = eye;
    } else {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.25, 0.5, 8), stone); base.position.y = 0.25; base.castShadow = true;
      grp.add(base);
      if (kind === 'obelisk') {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 2.6, 6), stone); col.position.y = 1.8; col.castShadow = true;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), glowMat); crystal.position.y = 3.6; crystal.scale.y = 1.5;
        grp.add(col, crystal); parts.crystal = crystal;
      } else {
        const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), glowMat); crystal.position.y = 1.5;
        grp.add(crystal); parts.crystal = crystal;
      }
      const tex = safeTexture(glowTexture, 64);
      if (tex) {
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: def.color, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        halo.scale.setScalar(kind === 'obelisk' ? 5 : 3); halo.position.y = kind === 'obelisk' ? 3.6 : 1.5; grp.add(halo); parts.halo = halo;
      }
    }
    try {
      const lb = makeLabel(def.name, { color: '#' + def.color.toString(16).padStart(6, '0'), size: 38, width: 640, height: 96, scale: 3.6 });
      lb.position.y = kind === 'obelisk' ? 5.2 : kind === 'chest' ? 2.6 : 3; grp.add(lb); parts.label = lb;
    } catch (e) { /* ignoré */ }
    g.scene.add(grp);
    const o = { kind, def, group: grp, pos: new THREE.Vector3(s.x, 0, s.z), cell: s.cell, used: false, hidden: false, state: 'closed', parts, t: Math.random() * 6 };
    g.world.addCircle(s.x, s.z, kind === 'chest' ? 1.0 : 1.1);
    run.objects.push(o);
    return o;
  }

  _disposeObject(o) {
    const g = this.g;
    g.scene.remove(o.group);
    o.group.traverse((m) => {
      if (m.isMesh) { m.geometry.dispose?.(); (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose?.()); }
      if (m.isSprite) { m.material.map?.dispose?.(); m.material.dispose?.(); }
    });
  }

  _addExitPortal(x, z, big = false) {
    const g = this.g;
    const portal = buildPortal(g.world, [x, z], '#5ee6d0', 'Sortie', { noLight: true });
    try { const lb = makeLabel('Sortie de la spire', { color: '#5ee6d0', size: 36, width: 768, height: 96, scale: 4.2 }); lb.position.set(0, 5.1, 0.2); portal.group.add(lb); } catch (e) { /* ignoré */ }
    this.run.exits.push({ portal, pos: portal.pos.clone() });
    return portal;
  }

  _activateObject(o) {
    const g = this.g, run = this.run, p = g.player, def = o.def, L = run.level;
    o.used = true;
    const c = def.color;
    g.particles.emit(o.pos.x, 1.5, o.pos.z, { count: 70, color: c, speed: 6, life: 1.1, up: 3 });
    g.audio.play('obelisk', o.pos);
    if (o.kind === 'obelisk') {
      this._addBuff(def.id, def.dur, def.name, def.icon);
      g.hud.notify(`${def.icon} ${def.name} : ${def.desc} (${def.dur} s)`, 'quest');
    } else if (def.id === 'frenzy' || def.id === 'protection') {
      this._addBuff(def.id, def.dur, def.name, def.icon);
      g.hud.notify(`${def.icon} ${def.name} : ${def.desc} (${def.dur} s)`, 'quest');
    } else if (def.id === 'enlightenment') {
      const xp = run.mode.rewards ? Math.round(p.xpNeeded * (0.28 + L / 800)) : 0;
      if (xp) p.gainXp(xp);
      g.hud.notify(xp ? `${def.icon} ${def.name} : +${xp} XP` : `${def.icon} ${def.name} : sans effet en entraînement.`, xp ? 'quest' : 'info');
    } else if (def.id === 'fortune') {
      if (run.mode.rewards) {
        const coins = Math.round(100 + L * 45);
        p.addCoins(coins);
        const drops = [{ gen: rollLootItem({ sourceLevel: L, tierShift: 5 + riftLootShift(L), levelSpread: [0, 4] }) }, { gen: rollLootItem({ sourceLevel: L, tierShift: 5 + riftLootShift(L), levelSpread: [0, 4] }) }];
        this._dropItems(drops, o.pos);
        g.hud.notify(`${def.icon} ${def.name} : +${coins} 🪙 et du butin !`, 'quest');
      } else g.hud.notify(`${def.icon} ${def.name} : sans effet en entraînement.`, 'info');
    }
    if (o.parts.crystal) { o.parts.glowMat.color.setHex(0x555a66); }
    if (o.parts.halo) o.parts.halo.visible = false;
    if (o.parts.label) o.parts.label.visible = false;
  }

  // ------------------------------------------------------------------ coffre piégé
  _startChest(o) {
    const g = this.g, run = this.run, L = run.level;
    if (run.chest) { g.hud.notify('Terminez d’abord le coffre piégé en cours.', 'boss'); return; }
    o.state = 'fight';
    const list = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = 5 + Math.random() * 2;
      const pos = new THREE.Vector3(o.pos.x + Math.cos(a) * r, 0, o.pos.z + Math.sin(a) * r);
      const sp = pick(run.theme.species);
      const e = this._spawnEnemy(sp, pos, { role: 'normal' }, null);
      e.chestWave = true;
      e.setTitle(`Possédé · Nv.${L}`, '#ff6a5a');
      e.state = 1; // CHASE
      list.push(e);
    }
    run.chest = { obj: o, t: 55, enemies: list };
    g.hud.notify('😈 Coffre piégé ! Éliminez tous les monstres en 55 secondes.', 'boss');
    g.audio.play('combatStart');
    g.particles.emit(o.pos.x, 1, o.pos.z, { count: 60, color: 0xff3a3a, speed: 5, life: 1, up: 2 });
  }

  _updateChest(dt) {
    const run = this.run, c = run.chest; if (!c) return;
    const g = this.g;
    c.t -= dt;
    const alive = c.enemies.filter((e) => e.alive).length;
    if (alive === 0) {
      c.obj.state = 'open'; c.obj.used = true;
      c.obj.parts.lid.rotation.x = -1.7;
      c.obj.parts.glowMat.color.setHex(0xffd23f);
      const L = run.level;
      if (run.mode.rewards) {
        const drops = [];
        const n = 3 + (L >= 60 ? 1 : 0);
        for (let i = 0; i < n; i++) drops.push({ gen: rollLootItem({ sourceLevel: L, tierShift: 6 * run.mults.loot + riftLootShift(L), levelSpread: [0, 5] }) });
        this._dropItems(drops, c.obj.pos);
        g.player.addCoins(Math.round(80 + L * 30));
        if (Math.random() < 0.25) { this.data.keys++; g.hud.notify('🗝 Une sceau de spire était cachée dans le coffre !', 'quest'); }
      }
      g.hud.notify('🎁 Le coffre piégé s’ouvre !', 'quest');
      g.audio.play('quest');
      g.particles.emit(c.obj.pos.x, 1.2, c.obj.pos.z, { count: 50, color: 0xffd23f, speed: 4, life: 1, up: 2 });
      run.chest = null;
    } else if (c.t <= 0) {
      for (const e of c.enemies) if (e.alive) { const i = g.enemies.indexOf(e); if (i !== -1) g.enemies.splice(i, 1); if (g.player.target === e) g.player.target = null; e.dispose(g.scene); }
      c.obj.used = true; c.obj.hidden = true; c.obj.group.visible = false;
      g.hud.notify('Le coffre piégé disparaît…', 'boss');
      g.audio.play('error');
      run.chest = null;
    }
  }

  // ------------------------------------------------------------------ monstres
  _spawnEnemy(speciesKey, pos, member, pack) {
    const g = this.g, run = this.run;
    const base = enemiesData[speciesKey] || enemiesData.wolf;
    const def = { ...base, aggro: (base.aggro || 10) * 1.7, leash: 150 };
    pos = pos.clone(); pos.y = g.world.heightAt(pos.x, pos.z);
    const e = new Enemy(g.scene, g.world, def, run.level, pos, g.bus, 200000 + (++this._eid));
    const m = run.mults, role = member.role;
    const hpR = role === 'champion' ? 2.2 : role === 'minion' ? 1.3 : 1;
    const dmR = role === 'champion' ? 1.25 : role === 'minion' ? 1.1 : role === 'leader' ? 1.0 : 1;
    const xpR = role === 'champion' ? 3 : role === 'leader' ? 2 : role === 'minion' ? 1.4 : 1;
    e.maxHp = Math.max(1, Math.round(e.maxHp * m.hp * hpR)); e.hp = e.maxHp;
    e.damage = Math.max(1, Math.round(e.damage * m.dmg * dmR));
    e.xp = Math.round(e.xp * m.xp * xpR);
    if (m.xp === 0) { e.xp = 0; e.coins = [0, 0]; }
    e.noRespawn = true;
    e.hp = e.maxHp;
    e.hpBar.fg.scale.x = 1; e.hpBar.fg.position.x = 0;
    if (pack && member) g.gw.tag(e, 'r' + pack.id + '_' + pack.members.indexOf(member)); // même clé chez tous les joueurs de la spire
    g.enemies.push(e);
    if (pack && (role === 'champion' || role === 'leader')) this._applyAffixes(e, pack.affixes, role);
    if (role === 'leader' && !pack.affixes.length) e.setTitle(`${e.def.name} · Élite · Nv.${run.level}`, '#c78bff');
    return e;
  }

  _applyAffixes(e, ids, role) {
    const names = ids.map((i) => AFFIXES[i].name);
    for (const id of ids) {
      if (id === 'fast') e.def = { ...e.def, speed: e.def.speed * 1.45 };
      else if (id === 'frenzy') e.def = { ...e.def, attackCd: (e.def.attackCd || 1.5) * 0.6 };
      else if (id === 'juggernaut') { e.maxHp = Math.round(e.maxHp * 1.7); e.hp = e.maxHp; e.damage = Math.round(e.damage * 1.15); e.rig.root.scale.multiplyScalar(1.22); }
      else if (id === 'thorns') e.thorns = 0.05;
      else if (id === 'vampiric') e.onPlayerHit = (dealt) => { if (dealt > 0) { e.hp = Math.min(e.maxHp, e.hp + dealt * 0.5); e.hpBar.fg.scale.x = Math.max(0.001, e.hp / e.maxHp); e.hpBar.fg.position.x = -(1 - e.hpBar.fg.scale.x) / 2; } };
    }
    e.affixes = ids;
    const tag = role === 'leader' ? 'Élite' : 'Champion';
    e.setTitle(`${tag} · ${names.join(', ')} · Nv.${this.run.level}`, role === 'leader' ? '#c78bff' : '#ffd23f');
  }

  _activatePack(pack) {
    const g = this.g;
    for (const m of pack.members) {
      if (m.killed || m.ref) continue;
      if (this.run.killedKeys.has('r' + pack.id + '_' + pack.members.indexOf(m))) { this._markKilledSilent(pack, m); continue; } // déjà tué par le groupe
      m.ref = this._spawnEnemy(m.species, m.pos, m, pack);
      m.ref.rift = m;
      m.ref.home.copy(m.ref.pos);
      this.run.live.push(m.ref);
    }
    pack.active = true;
  }

  // Monstre déjà tué par le groupe avant que je l'aie vu : on met à jour la progression sans récompense
  _markKilledSilent(pack, m) {
    const run = this.run;
    if (m.killed) return;
    m.killed = true; pack.remaining = Math.max(0, pack.remaining - 1);
    run.kills++; run.collected += m.weight;
    if (pack.remaining === 0) pack.cleared = true;
  }

  // Liste complète des monstres tués, envoyée régulièrement par l'hôte de la spire
  netKilled(keys) {
    const run = this.run;
    if (!this.active || !run || !Array.isArray(keys)) return;
    for (const k of keys.slice(0, 600)) if (typeof k === 'string') run.killedKeys.add(k);
    for (const pack of run.packs) pack.members.forEach((m, i) => {
      if (m.killed || !run.killedKeys.has('r' + pack.id + '_' + i)) return;
      this._markKilledSilent(pack, m);
      if (m.ref && m.ref.alive) m.ref._netDieSilent();
    });
  }

  _deactivatePack(pack) {
    const g = this.g, run = this.run;
    for (const m of pack.members) {
      const e = m.ref; if (!e) continue;
      if (e.alive) {
        const i = g.enemies.indexOf(e); if (i !== -1) g.enemies.splice(i, 1);
        if (g.player.target === e) g.player.target = null;
        e.dispose(g.scene);
        const li = run.live.indexOf(e); if (li !== -1) run.live.splice(li, 1);
        m.ref = null;
      }
    }
    pack.active = false;
  }

  _streamPacks() {
    const run = this.run;
    const cap = MAX_ACTIVE[this.g.settings.quality] || 24;
    let aliveCount = 0;
    for (const e of run.live) if (e.alive) aliveCount++;
    for (const pack of run.packs) {
      if (pack.cleared) continue;
      const d = this.g.gw.nearestDist2D(pack.center); // en groupe, l'hôte fait vivre les packs autour de tous les membres
      if (!pack.active) {
        if (d < ACTIVATE_DIST && aliveCount + pack.remaining <= cap + 4) { this._activatePack(pack); aliveCount += pack.remaining; }
      } else if (d > DEACTIVATE_DIST) {
        let engaged = false;
        for (const m of pack.members) if (m.ref && m.ref.alive && (m.ref.state === 1 || m.ref.state === 2)) engaged = true;
        if (!engaged) this._deactivatePack(pack);
      }
    }
  }

  _onEnemyKilled(e) {
    const run = this.run;
    if (!this.active || !run) { this._worldDrops(e); return; }
    const g = this.g;
    if (e === run.spriteEnemy) { run.spriteEnemy = null; return; }
    const m = e.rift;
    if (!m) return;
    m.killed = true;
    if (e.netKey) run.killedKeys.add(e.netKey);
    const pack = m.pack;
    pack.remaining = Math.max(0, pack.remaining - 1);
    run.kills++;
    const before = run.collected / run.need;
    run.collected += m.weight;
    // perle de vie
    const lifeChance = m.role === 'normal' ? 0.1 : 0.35;
    if (Math.random() < lifeChance) this._spawnPickup('life', e.pos);
    // Ferveur d’éther : élite / champion
    if (m.role === 'leader') this._spawnPickup('fervor', e.pos);
    // affixe « fondu » : explosion différée
    if (e.affixes && e.affixes.includes('molten')) this._explosions.push({ t: 1.1, pos: e.pos.clone(), dmg: Math.round(e.damage * 0.8) });
    if (e.affixes && e.affixes.includes('molten')) g.particles.emit(e.pos.x, 0.5, e.pos.z, { count: 40, color: 0xff6a1a, speed: 3, life: 1.1, up: 1 });
    if (pack.remaining === 0) {
      pack.cleared = true;
      if (pack.type !== 'normal') {
        this.data.shards += pack.type === 'elite' ? 2 : 1;
        this._spawnPickup('fervor', e.pos);
        if (Math.random() < 0.12 && run.mode.key) { this.data.keys++; g.hud.notify('🗝 L’élite portait un sceau de spire !', 'quest'); }
        g.hud.notify(`${pack.type === 'elite' ? '👑 Élite vaincue' : '⚔ Champions vaincus'} ! +${pack.type === 'elite' ? 2 : 1} ✨`, 'info');
      }
    }
    if (!run.guardianSpawned && run.collected >= run.need && !g.gw.isGuest) this._spawnGuardian();
    void before;
  }

  // butin de clés en dehors des spires
  _worldDrops(e) {
    const g = this.g;
    if (!e || !e.def) return;
    const id = e.def.id || '';
    const isSprite = e === g.lootSprite;
    const elite = e.def.species === 'elite';
    let key = 0.012, shard = 0;
    if (elite) { key = 0.14; shard = 2 + Math.floor(Math.random() * 3); }
    if (isSprite) { key = 0.5; shard = 4; }
    if (Math.random() < key) { this.data.keys++; g.hud.notify('🗝 Vous trouvez un sceau de spire !', 'quest'); g.audio.play('pickup'); }
    if (shard) { this.data.shards += shard; g.hud.notify(`✨ +${shard} poussière d’éther`, 'info'); }
    void id;
  }

  // appelé par Game avant de faire tomber le butin d'un monstre
  modifyDrops(source, drops) {
    if (!this.active || !this.run) return drops;
    const run = this.run;
    if (!source.rift && !source.chestWave && source !== run.guardian) return drops;
    if (!run.mode.rewards) return [];
    const out = drops.slice();
    if (source.rift) {
      const extra = source.rift.role === 'normal' ? 0.1 : source.rift.role === 'leader' ? 1 : 0.5;
      if (Math.random() < extra * run.mults.loot) out.push({ gen: rollLootItem({ sourceLevel: run.level, tierShift: (source.rift.role === 'normal' ? 1 : 4) + riftLootShift(run.level), levelSpread: [0, 4] }) });
    }
    return out;
  }

  // ------------------------------------------------------------------ gardien
  // Invité d'un groupe : le Gardien apparaît quand l'hôte de la spire l'annonce
  onNetGuardian(name) { if (this.active && this.run && !this.run.guardianSpawned) this._spawnGuardian(name); }

  _spawnGuardian(forcedName) {
    const g = this.g, run = this.run, th = run.theme;
    run.guardianSpawned = true;
    const bp = run.built.boss;
    const pos = new THREE.Vector3(bp.x, 0, bp.z);
    const name = forcedName || pick(GUARDIAN_NAMES);
    const boss = new Boss(g.scene, g.world, g.bus, pos, { id: 'spire_warden', level: run.level, name: `${name} · Nv.${run.level}`, scale: 3.0, fur: th.wall, belly: th.color, eye: th.color });
    boss.maxHp = Math.round(boss.maxHp * run.mults.hp * 1.1); boss.hp = boss.maxHp;
    boss.damage = Math.round(boss.damage * run.mults.dmg);
    boss.xp = Math.round(boss.xp * run.mults.xp);
    if (run.mults.xp === 0) { boss.xp = 0; boss.coins = [0, 0]; }
    boss.rig.root.visible = true;
    run.guardian = boss;
    g.gw.tag(boss, 'b:spire_warden');
    g.bosses.push(boss);
    if (!forcedName) g.gw.announceGuardian(name);
    g.hud.notify('👹 Le Gardien de la spire est apparu ! Retrouvez-le (point rouge sur la mini-carte).', 'boss');
    g.audio.play('guardian');
    g.particles.emit(pos.x, 1.5, pos.z, { count: 100, color: th.color, speed: 7, life: 1.4, up: 3 });
  }

  _onGuardianDead() {
    const g = this.g, run = this.run;
    if (!this.active || !run || run.done) return;
    run.done = true; this.state = 'complete';
    if (run.mode.rewards) g.bus.emit('passEvent', 'rift');
    const mode = run.mode, L = run.level, p = g.player;
    const elapsed = Math.round(run.elapsed);
    const rewards = { xp: 0, coins: 0, shards: 0, keys: 0, zkeys: 0, steps: 0, items: 0 };
    if (mode.rewards) {
      const gr = mode.id === 'zenith';
      rewards.shards = Math.round(gr ? 12 + L / 6 : 8 + L / 8);
      rewards.xp = Math.round(p.xpNeeded * (0.4 + L / 300) * (gr ? 1.8 : 1));
      rewards.coins = Math.round((200 + L * 60) * (gr ? 1.5 : 1));
      if (gr) {
        rewards.steps = gemStepsForTime(elapsed);
        rewards.zkeys = 1;
        if (rewards.steps > 0) { this.data.pending = Math.max(this.data.pending, rewards.steps); this.data.pendingLevel = L; }
      } else {
        rewards.keys = 1;
        if (Math.random() < Math.min(0.9, 0.35 + L / 400)) rewards.zkeys = 1;
      }
      this.data.keys += rewards.keys; this.data.zkeys += rewards.zkeys; this.data.shards += rewards.shards;
      p.gainXp(rewards.xp); p.addCoins(rewards.coins);
      const drops = [];
      const n = 3 + (L >= 50 ? 1 : 0) + (gr ? 2 : 0);
      for (let i = 0; i < n; i++) drops.push({ gen: rollLootItem({ sourceLevel: L, tierShift: (gr ? 13 : 10) + riftLootShift(L), levelSpread: [2, 8] }) });
      if (gr || Math.random() < 0.3) drops.push({ gen: generateItem({ category: Math.random() < 0.5 ? 'weapon' : 'armor', itemLevel: L + 6, rarityTier: rollRarityTier({ shift: riftLootShift(L), minTier: gr ? 19 : 13, maxTier: 25 }) }) });
      rewards.items = drops.length;
      this._dropItems(drops, run.guardian ? run.guardian.pos : p.pos);
      if (mode.id === 'ascent') this.data.bestAscent = Math.max(this.data.bestAscent, L);
      else if (mode.id === 'zenith') {
        const b = this.data.bestZenith;
        if (L > b.level || (L === b.level && elapsed < b.time)) this.data.bestZenith = { level: L, time: elapsed };
      }
    }
    this._record(true);
    // portail de sortie près du gardien
    if (run.guardian) this._addExitPortal(run.guardian.pos.x + 7, run.guardian.pos.z);
    p.invuln = Math.max(p.invuln, 6);
    g.audio.play('levelup'); g.audio.play('riftDone');
    g.hud.notify('🏆 Spire accomplie !', 'quest');
    g._doSave();
    this.ui.showResult({ mode, level: L, elapsed, deaths: run.deaths, kills: run.kills, rewards, pending: this.data.pending, pendingLevel: this.data.pendingLevel });
  }

  _fail() {
    const run = this.run, g = this.g;
    if (!run || run.done || this.state === 'failed') return;
    this.state = 'failed';
    this._record(false);
    run.failT = 6;
    g.hud.notify('⏳ Temps écoulé ! La spire se referme…', 'boss');
    g.audio.play('error');
  }

  _record(ok) {
    const run = this.run; if (!run || run.recorded) return;
    run.recorded = true;
    this.data.history.unshift({ mode: run.mode.id, level: run.level, time: Math.round(run.elapsed), ok });
    this.data.history.length = Math.min(10, this.data.history.length);
  }

  // ------------------------------------------------------------------ butin / pickups
  _dropItems(drops, pos) {
    const g = this.g;
    drops.forEach((d, i) => {
      const a = (i / Math.max(1, drops.length)) * Math.PI * 2, r = drops.length > 1 ? 1.2 + Math.random() * 0.8 : 0;
      const dp = new THREE.Vector3(pos.x + Math.cos(a) * r, 0, pos.z + Math.sin(a) * r);
      dp.y = g.world.heightAt(dp.x, dp.z);
      if (g.lootDrops.length >= 60) g.lootDrops.shift().dispose(g.scene);
      { const ld = new LootDrop(g.scene, dp, d, g.settings.quality); if (g._applyLootLabel) g._applyLootLabel(ld); g.lootDrops.push(ld); }
    });
    if (drops.length) g.audio.play('loot', pos);
  }

  _pickupMat(type) {
    this._pm = this._pm || {};
    if (!this._pm[type]) {
      const tex = safeTexture(glowTexture, 64);
      this._pm[type] = new THREE.SpriteMaterial({ map: tex, color: type === 'life' ? 0xff4a4a : 0xffd23f, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    }
    return this._pm[type];
  }

  _spawnPickup(type, pos) {
    const g = this.g, run = this.run;
    const sp = new THREE.Sprite(this._pickupMat(type));
    sp.scale.setScalar(type === 'life' ? 0.9 : 1.3);
    const p = new THREE.Vector3(pos.x + rr(-0.8, 0.8), 0, pos.z + rr(-0.8, 0.8));
    sp.position.set(p.x, 0.9, p.z);
    g.scene.add(sp);
    const pk = { type, sprite: sp, pos: p, t: 0, life: 45, ph: Math.random() * 6 };
    run.pickups.push(pk);
    if (run.pickups.length > 26) this._disposePickup(run.pickups.shift());
  }

  _disposePickup(pk) { this.g.scene.remove(pk.sprite); }

  _updatePickups(dt) {
    const run = this.run, g = this.g, p = g.player;
    for (let i = run.pickups.length - 1; i >= 0; i--) {
      const pk = run.pickups[i];
      pk.t += dt; pk.life -= dt;
      pk.sprite.position.y = 0.9 + Math.sin(pk.t * 3 + pk.ph) * 0.15;
      const d = d2(p.pos, pk.pos);
      if (!p.dead && d < 5) { // aimant
        const k = Math.min(1, dt * 6), dx = p.pos.x - pk.pos.x, dz = p.pos.z - pk.pos.z;
        pk.pos.x += dx * k; pk.pos.z += dz * k; pk.sprite.position.x = pk.pos.x; pk.sprite.position.z = pk.pos.z;
      }
      if (!p.dead && d < 1.3) {
        if (pk.type === 'life') { p.heal(p.maxHp * 0.2); p.restoreMana?.(p.maxMana * 0.2); g.audio.play('pearl'); }
        else { this._addFervor(); g.audio.play('pearl'); }
        g.particles.emit(pk.pos.x, 1, pk.pos.z, { count: 14, color: pk.type === 'life' ? 0xff5a5a : 0xffd23f, speed: 2.5, life: 0.6, up: 2 });
        this._disposePickup(pk); run.pickups.splice(i, 1);
      } else if (pk.life <= 0) { this._disposePickup(pk); run.pickups.splice(i, 1); }
    }
  }

  // ------------------------------------------------------------------ bonus temporaires
  _addBuff(id, dur, name, icon) { this.buffs.set(id, { t: dur, dur, name, icon }); }

  _addFervor() {
    this.fervor.stacks = Math.min(FERVOR_MAX, this.fervor.stacks + 1);
    this.fervor.t = 30;
    this.g.hud.notify(`🌟 Ferveur d’éther ×${this.fervor.stacks}`, 'quest');
  }

  updateBuffs(dt) {
    const p = this.g.player; if (!p) return;
    let dmg = 1, spd = 1, cd = 1, taken = 1, free = false, conduit = false;
    for (const [id, b] of this.buffs) {
      b.t -= dt;
      if (b.t <= 0) { this.buffs.delete(id); continue; }
      if (id === 'power') dmg *= 1.6;
      else if (id === 'conduit') conduit = true;
      else if (id === 'channeling') { cd *= 0.5; free = true; }
      else if (id === 'shield') taken *= 0.35;
      else if (id === 'speed') { spd *= 1.35; cd *= 0.75; }
      else if (id === 'frenzy') { cd *= 0.5; spd *= 1.2; }
      else if (id === 'protection') taken *= 0.5;
    }
    if (this.fervor.stacks > 0) {
      this.fervor.t -= dt;
      if (this.fervor.t <= 0) this.fervor.stacks = 0;
      else { dmg *= 1 + 0.06 * this.fervor.stacks; spd *= 1 + 0.04 * this.fervor.stacks; }
    }
    p.dmgMult = dmg; p.speedMult = spd; p.cdBuff = cd; p.takenMult = taken; p.freeCost = free;
    this._conduit = conduit;
  }

  _updateConduit(dt) {
    if (!this._conduit) return;
    this._cdT = (this._cdT || 0) - dt;
    if (this._cdT > 0) return;
    this._cdT = 0.7;
    const g = this.g, p = g.player;
    const targets = [];
    for (const e of g.enemies) { if (e.alive && d2(p.pos, e.pos) < 14) targets.push(e); if (targets.length >= 3) break; }
    if (this.run?.guardian?.alive && d2(p.pos, this.run.guardian.pos) < 14 && this.run.guardian.state !== 'dormant') targets.push(this.run.guardian);
    for (const t of targets) {
      t.takeDamage(Math.round(p.atk * 0.8 * (p.dmgMult || 1)), false, p);
      g.particles.emit(t.pos.x, t.pos.y + 1.2, t.pos.z, { count: 14, color: 0x6fd0ff, speed: 4, life: 0.4, up: 2 });
    }
    if (targets.length) g.audio.play('boltHit', targets[0].pos);
  }

  // ------------------------------------------------------------------ boucle
  update(dt) {
    const g = this.g;
    if (!g.player) return;
    this.updateBuffs(dt);
    this.statue.update(dt);
    if (this.statue.portal.open) updatePortal(this.statue.portal, dt);
    if (!this.active) {
      if (this.pending && !g.modalOpen && d2(g.player.pos, this.statue.portal.pos) < 2.4) this.enter();
      this._updateHint();
      return;
    }
    const run = this.run;
    run.built.update(dt);
    if (run.built.seeThrough) run.built.seeThrough(g.player.pos, g.camera.position, !!(g.cameraRig && g.cameraRig.isIso));
    for (const ep of run.exits) updatePortal(ep.portal, dt);
    if (this.state === 'active') {
      run.elapsed += dt;
      if (run.mode.timed) { run.timeLeft = Math.max(0, ZENITH_TIME - run.elapsed); if (run.timeLeft <= 0) this._fail(); }
    }
    if (this.state === 'failed') { run.failT -= dt; if (run.failT <= 0) this.exit(); return; }

    this._streamT += dt;
    if (this._streamT > 0.4) { this._streamT = 0; this._streamPacks(); this._trackCell(); }
    this._updatePickups(dt);
    this._updateObjects(dt);
    this._updateChest(dt);
    this._updateSprite(dt);
    this._updateGuardian(dt);
    this._updateExplosions(dt);
    this._updateConduit(dt);
    this._cleanCorpses(dt);
    this._updateHint();
    this._hudT += dt;
    if (this._hudT > 0.12) { this._hudT = 0; this._pushHud(false); }
  }

  _updateObjects(dt) {
    const run = this.run;
    for (const o of run.objects) {
      if (o.hidden) continue;
      o.t += dt;
      const c = o.parts.crystal;
      if (c && !o.used) { c.rotation.y += dt * 1.2; c.position.y = (o.kind === 'obelisk' ? 3.6 : 1.5) + Math.sin(o.t * 2) * 0.12; }
      if (o.parts.halo && !o.used) o.parts.halo.material.opacity = 0.6 + Math.sin(o.t * 3) * 0.15;
      if (o.parts.eye && o.state === 'closed') o.parts.eye.rotation.y += dt * 2;
    }
  }

  _updateGuardian() {
    const run = this.run, b = run.guardian;
    if (!b || !b.alive) return;
    run.guardianPos = b.pos;
  }

  _updateExplosions(dt) {
    const g = this.g;
    for (let i = this._explosions.length - 1; i >= 0; i--) {
      const x = this._explosions[i];
      x.t -= dt;
      if (x.t <= 0) {
        g.particles.emit(x.pos.x, 0.6, x.pos.z, { count: 60, color: 0xff7a1a, speed: 6, life: 0.8, up: 2 });
        g.audio.play('boltHit', x.pos);
        if (d2(g.player.pos, x.pos) < 5 && !g.player.dead) g.player.takeDamage(x.dmg, { dmgType: 'fire' });
        this._explosions.splice(i, 1);
      }
    }
  }

  _cleanCorpses(dt) {
    const g = this.g, run = this.run;
    for (let i = run.live.length - 1; i >= 0; i--) {
      const e = run.live[i];
      if (!e.alive && e.deadT > 4.5) {
        const gi = g.enemies.indexOf(e); if (gi !== -1) g.enemies.splice(gi, 1);
        if (g.player.target === e) g.player.target = null;
        e.dispose(g.scene);
        run.live.splice(i, 1);
        if (e.rift) e.rift.ref = null;
      }
    }
    // cadavres du coffre piégé
    for (let i = g.enemies.length - 1; i >= 0; i--) {
      const e = g.enemies[i];
      if (e.chestWave && !e.alive && e.deadT > 4.5) { g.enemies.splice(i, 1); e.dispose(g.scene); }
    }
    if (run.spriteEnemy && !run.spriteEnemy.alive) run.spriteEnemy = null;
  }

  // ------------------------------------------------------------------ lutin trésor
  _trackCell() {
    const run = this.run, p = this.g.player;
    const c = cellAt(p.pos.x, p.pos.z);
    if (!c) return;
    const k = cellKey(c.gx, c.gz);
    if (run.cell !== k) {
      run.cell = k;
      if (!run.explored.has(k)) this._explore(c.gx, c.gz);
      const cell = run.layout.cells.get(k);
      if (cell) { const cc = cellCenter(c.gx, c.gz); run.checkpoint.set(cc.x, 0, cc.z); }
      if (run.spriteCell === k && !run.spriteEnemy && !run.spriteDone) this._spawnSprite(c);
    }
  }

  _explore(gx, gz) { this.run.explored.add(cellKey(gx, gz)); }

  _spawnSprite(c) {
    const g = this.g, run = this.run;
    const cc = cellCenter(c.gx, c.gz);
    const pos = new THREE.Vector3(cc.x + rr(-8, 8), 0, cc.z + rr(-8, 8)); pos.y = 0;
    const e = new Enemy(g.scene, g.world, enemiesData.loot_sprite, run.level, pos, g.bus, 200000 + (++this._eid));
    e.noRespawn = true;
    g.enemies.push(e);
    g.lootSprite = e; g._spriteLifeT = 0;
    run.spriteEnemy = e; run.spriteT = 80; run.spriteDone = true;
    g.hud.notify('✨ Un lutin trésor rôde dans cette salle ! Attrapez-le !', 'quest');
    g.audio.play('zone');
  }

  _updateSprite(dt) {
    const run = this.run, g = this.g;
    const e = run.spriteEnemy; if (!e) return;
    run.spriteT -= dt;
    g._spriteLifeT = 0;
    if (run.spriteT <= 0 && e.alive) {
      const i = g.enemies.indexOf(e); if (i !== -1) g.enemies.splice(i, 1);
      if (g.player.target === e) g.player.target = null;
      e.dispose(g.scene); run.spriteEnemy = null; g.lootSprite = null;
      g.hud.notify('Le lutin trésor a filé avec son butin…', 'info');
    }
  }

  // ------------------------------------------------------------------ interface (HUD, aide, minimap)
  _updateHint() {
    const g = this.g, p = g.player;
    let text = null;
    if (!this.active) {
      if (d2(p.pos, this.statue.pos) < 5.2) text = 'E — Statue de la Spire';
      else if (this.pending && d2(p.pos, this.statue.portal.pos) < 3.8) text = 'E — Entrer dans la spire';
    } else {
      const near = this._nearestInteractable();
      if (near) {
        text = near.kind === 'exit' ? 'E — Quitter la spire' : near.kind === 'chest' ? 'E — Ouvrir le coffre piégé (combat !)' : `E — ${near.obj.def.name}`;
      }
    }
    if (text !== this._hintKey) { this._hintKey = text; g.hud.setHint?.(text); }
  }

  _pushHud(force) {
    const run = this.run; if (!run) return;
    const frac = clamp(run.collected / run.need, 0, 1);
    const buffs = [];
    for (const [id, b] of this.buffs) buffs.push({ icon: b.icon, name: b.name, t: b.t, frac: b.t / b.dur });
    if (this.fervor.stacks > 0) buffs.push({ icon: '🌟', name: `Ferveur ×${this.fervor.stacks}`, t: this.fervor.t, frac: this.fervor.t / 30 });
    const mode = run.mode;
    let objective = 'Tuez des monstres pour remplir la jauge.';
    if (run.done) objective = 'Spire accomplie ! Rejoignez le portail de sortie.';
    else if (this.state === 'failed') objective = 'Temps écoulé…';
    else if (run.guardianSpawned) objective = 'Éliminez le Gardien de la spire !';
    this.ui.updateHud({
      title: `${mode.icon} ${mode.name} · Niv. ${run.level}`,
      frac: run.guardianSpawned ? 1 : frac, guardian: run.guardianSpawned && !run.done, done: run.done,
      pct: Math.floor((run.guardianSpawned ? 1 : frac) * 100),
      time: mode.timed ? run.timeLeft : run.elapsed, timed: mode.timed, timeFrac: mode.timed ? run.timeLeft / ZENITH_TIME : 1,
      buffs, objective, deaths: run.deaths, kills: run.kills
    });
  }

  _drawMinimap(g, sx, sy, k, H) {
    const run = this.run; if (!run) return;
    const C = ARENA.cell / 2, th = run.theme;
    const col = '#' + th.color.toString(16).padStart(6, '0');
    // salles
    for (const c of run.layout.list) {
      const key = cellKey(c.gx, c.gz);
      const seen = run.explored.has(key);
      let near = seen;
      if (!near) for (const [dx, dz, b] of [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]]) { if ((c.links & b) && run.explored.has(cellKey(c.gx + dx, c.gz + dz))) near = true; }
      if (!near) continue;
      const p = cellCenter(c.gx, c.gz);
      g.fillStyle = seen ? 'rgba(70,86,140,0.85)' : 'rgba(34,42,72,0.8)';
      g.beginPath();
      g.moveTo(sx(p.x - C, p.z - C), sy(p.x - C, p.z - C)); g.lineTo(sx(p.x + C, p.z - C), sy(p.x + C, p.z - C));
      g.lineTo(sx(p.x + C, p.z + C), sy(p.x + C, p.z + C)); g.lineTo(sx(p.x - C, p.z + C), sy(p.x - C, p.z + C));
      g.closePath(); g.fill();
      // murs
      g.strokeStyle = seen ? '#cdd5f2' : '#6b7596'; g.lineWidth = 2;
      g.beginPath();
      const seg = (x0, z0, x1, z1) => { g.moveTo(sx(x0, z0), sy(x0, z0)); g.lineTo(sx(x1, z1), sy(x1, z1)); };
      const door = 5;
      if (!(c.links & 1)) seg(p.x - C, p.z - C, p.x + C, p.z - C); else { seg(p.x - C, p.z - C, p.x - door, p.z - C); seg(p.x + door, p.z - C, p.x + C, p.z - C); }
      if (!(c.links & 4)) seg(p.x - C, p.z + C, p.x + C, p.z + C); else { seg(p.x - C, p.z + C, p.x - door, p.z + C); seg(p.x + door, p.z + C, p.x + C, p.z + C); }
      if (!(c.links & 8)) seg(p.x - C, p.z - C, p.x - C, p.z + C); else { seg(p.x - C, p.z - C, p.x - C, p.z - door); seg(p.x - C, p.z + door, p.x - C, p.z + C); }
      if (!(c.links & 2)) seg(p.x + C, p.z - C, p.x + C, p.z + C); else { seg(p.x + C, p.z - C, p.x + C, p.z - door); seg(p.x + C, p.z + door, p.x + C, p.z + C); }
      g.stroke();
    }
    const dot = (x, z, r, fill, stroke) => {
      const px = sx(x, z), py = sy(x, z);
      g.fillStyle = fill; g.beginPath(); g.arc(px, py, r, 0, 6.2832); g.fill();
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.4; g.stroke(); }
    };
    for (const o of run.objects) {
      if (o.used || o.hidden || !run.explored.has(o.cell)) continue;
      const c = '#' + o.def.color.toString(16).padStart(6, '0');
      dot(o.pos.x, o.pos.z, o.kind === 'obelisk' ? 5 : 4, c, '#0a1020');
    }
    for (const ep of run.exits) dot(ep.pos.x, ep.pos.z, 5.5, '#5ee6d0', '#06202a');
    for (const pk of run.pickups) dot(pk.pos.x, pk.pos.z, 2.4, pk.type === 'life' ? '#ff5a5a' : '#ffd23f');
    if (run.spriteEnemy && run.spriteEnemy.alive) dot(run.spriteEnemy.pos.x, run.spriteEnemy.pos.z, 4.5, '#ffd23f', '#5a3a00');
    const b = run.guardian;
    if (b && b.alive) dot(b.pos.x, b.pos.z, 7, '#ff3a3a', '#fff'); // gardien
    else if (!run.guardianSpawned) { const bp = run.built.boss; if (run.explored.has(cellKey(run.layout.boss.gx, run.layout.boss.gz))) dot(bp.x, bp.z, 4, 'rgba(255,58,58,0.5)', '#ff6a6a'); }
    void H; void k; void col;
  }
}
