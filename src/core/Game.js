import * as THREE from 'three';
import { CONFIG } from './config.js';
import { EventBus } from './EventBus.js';
import { InputManager } from './InputManager.js';
import { SaveManager } from './SaveManager.js';
import { World } from '../world/World.js';
import { DayNight } from '../world/DayNight.js';
import { ZoneManager } from '../world/ZoneManager.js';
import { buildDungeon } from '../world/DungeonRuins.js';
import { WORLD_TIERS, tierById, tierAt } from '../world/WorldTiers.js';
import { REGIONS, regionAt, isLand } from '../world/Continent.js';
import { buildPortal, updatePortal } from '../world/Portals.js';
import { mulberry32, clamp } from '../core/math.js';
import { Weather } from '../effects/Weather.js';
import { Player } from '../player/Player.js';
import { CameraRig } from '../player/CameraRig.js';
import { Enemy } from '../entities/Enemy.js';
import { NPC } from '../entities/NPC.js';
import { Boss } from '../entities/Boss.js';
import { LootDrop, warmupLoot } from '../entities/LootDrop.js';
import { CaravanEvent } from '../world/Caravan.js';
import { Achievements } from './Achievements.js';
import { WorldChests } from '../world/WorldChests.js';
import { GroundHazards } from '../combat/GroundHazards.js';
import { EnemyProjectiles } from '../combat/EnemyProjectiles.js';
import { tryTriggerEquipEffects } from '../combat/ItemEffects.js';
import { computeEnemyStats } from '../data/enemyScaling.js';
import { rollLootItem, setLootClass } from '../inventory/ItemGenerator.js';

import { makeLabel } from '../ui/Label.js';
import { CombatSystem } from '../combat/CombatSystem.js';
import { QuestManager } from '../quests/QuestManager.js';
import { generateSecondaryQuests } from '../data/secondaryQuests.js';
import { MAIN_QUESTS } from '../data/mainQuests.js';
import { TUTORIAL_QUESTS } from '../data/tutorialQuests.js';
import { Particles } from '../effects/Particles.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Fx, skillColor, WeaponTrail, Ambient } from '../visual/Fx.js';
import { RiftSystem } from '../rift/RiftSystem.js';
import { buildRiftStatue, STATUE_POS } from '../rift/RiftStatue.js';
import { ModelLibrary } from '../visual/ModelLibrary.js';
import { setSafeMode, isSafeMode, updateVisualUniforms } from '../visual/Safe.js';
import { AudioManager } from '../audio/AudioManager.js';
import { HUD } from '../ui/HUD.js';
import { TouchControls } from '../ui/TouchControls.js';
import { SettingsUI, DEFAULTS, TOUCH_DEFAULTS } from '../ui/SettingsUI.js';
import { normalizeKeys, defaultKeys, keyLabel } from './Keybinds.js';
import { CharPreview } from '../ui/CharPreview.js';
import { CLASSES, RACES } from '../combat/Classes.js';
import { Inventory } from '../inventory/Inventory.js';
import { Equipment } from '../inventory/Equipment.js';
import { LootSystem } from '../inventory/LootSystem.js';
import { getItem, resolveItem } from '../inventory/Item.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { GroupWorld } from '../network/GroupWorld.js';
import { applyOcclusionFade, updateOcclusion } from '../visual/OcclusionFade.js';
import { share as netShare } from '../network/NetShare.js';
import { RemotePlayer } from '../network/RemotePlayer.js';
import { CATALOG_BY_ID, LUNES } from '../data/shopCatalog.js';
import { LATEST_VERSION } from '../data/patchNotes.js';
import enemiesData from '../data/enemies.json';
import npcsData from '../data/npcs.json';
import skillDefs from '../data/skills.json';

const DUNGEON_CENTER = [-112, 42];
const DUNGEON_SPAWNS = [
  { def: 'bandit', off: [-6, -3], level: 19 }, { def: 'bandit', off: [5, -4], level: 20 }, { def: 'bandit', off: [0, 5], level: 19 }
];
const DUNGEON_CHIEF_LEVEL = 24;
const MAX_ACTIVE_SECONDARY_QUESTS = 6;
const GUARDIAN_BOSS_LEVEL = 28;

export class Game {
  constructor(root) {
    this.root = root;
    this.bus = new EventBus();
    this.audio = new AudioManager();
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    // V3.5 : sur téléphone/tablette, qualité « Moyenne » par défaut + résolution adaptative + plein écran au lancement
    const saved = SaveManager.loadSettings();
    this.settings = { ...DEFAULTS, quality: coarse ? 'medium' : 'high', autoFullscreen: coarse, cameraLock: true, cameraMode: 'iso', visualV25: true, adaptive: true, ...saved };
    this.settings.touch = { ...TOUCH_DEFAULTS, ...(saved.touch || {}), layout: { ...((saved.touch && saved.touch.layout) || {}) } };
    this.settings.keys = normalizeKeys(saved.keys);
    if (!CONFIG.quality[this.settings.quality]) this.settings.quality = coarse ? 'medium' : 'high';
    if (typeof saved.shadows !== 'boolean') this.settings.shadows = CONFIG.quality[this.settings.quality].shadows;
    this._resScale = 1; this._lowN = 0; this._highN = 0; this._adaptCool = 0;
    this.hud = new HUD(root, this.bus, this);
    const unlock = () => {
      removeEventListener('pointerdown', unlock, true); removeEventListener('keydown', unlock, true);
      try {
        this.audio.resume(); this.audio.setVolume(this.settings.volume / 100);
        this.audio.setMix({ music: this.settings.musicVol / 100, sfx: this.settings.sfxVol / 100 });
        this.audio.startMusic();
      } catch (e) { /* ignore */ }
    };
    addEventListener('pointerdown', unlock, true); addEventListener('keydown', unlock, true);
    this.net = new NetworkManager(this.bus);
    this.gw = new GroupWorld(this); // monde partagé du groupe (V6.0)
    this.remotePlayers = new Map();
    this.lootDrops = [];
    this.group = [];
    this.clock = new THREE.Clock();
    this.paused = false;
    this.dialogueOpen = false;
    this.modalOpen = false;
    this.debug = false;
    this._fpsAcc = 0; this._fpsN = 0; this._fps = 60;
    this._initRenderer();
    this._bindUi();
    this.hud.showScreen('loading-screen');
    this._boot();
  }

  _initRenderer() {
    const canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    this.root.prepend(canvas);
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 1.5, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    // V2.5 : si un shader personnalisé échoue sur cet appareil, on bascule en mode compatible au prochain lancement
    this.renderer.debug.onShaderError = (gl, program, vs, fs) => this._onShaderError(gl, vs, fs);
    const vg = document.createElement('div');
    vg.id = 'v25-vignette';
    this.root.appendChild(vg);
    const lowFx = document.createElement('div'); lowFx.id = 'lowhp-fx'; this.root.appendChild(lowFx);
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, innerWidth / innerHeight, 0.1, CONFIG.camera.far);
    this.input = new InputManager(canvas);
    this.input.setKeys(this.settings.keys);
    window.addEventListener('resize', () => this._resize());
    this._resize();
    this._applyQuality(this.settings.quality);
    this._buildEnvironment();
    this._applyVisualMode();
  }

  get _v25() { return this.settings.visualV25 !== false; }

  _onShaderError(gl, vs, fs) {
    if (this._shaderErrorShown) return;
    this._shaderErrorShown = true;
    let log = '';
    try { log = (gl.getShaderInfoLog(fs) || '') + (gl.getShaderInfoLog(vs) || ''); } catch (e) { /* ignore */ }
    console.warn('[V2.5] erreur de shader :', log);
    setSafeMode(true);
    try { this.hud.notify('Un effet visuel n’est pas compatible avec ton téléphone : le mode compatible sera actif au prochain lancement.', 'quest'); } catch (e) { /* ignore */ }
  }

  // Reflets d'environnement doux : indispensable pour que métaux (armures, armes) et eau ne paraissent pas ternes.
  _buildEnvironment() {
    try {
      const pm = new THREE.PMREMGenerator(this.renderer);
      const env = new RoomEnvironment();
      this._envTex = pm.fromScene(env, 0.04).texture;
      pm.dispose();
      this.scene.environment = this._envTex;
      this.scene.environmentIntensity = 0.3;
    } catch (e) { console.warn('[V2.5] environnement ignoré', e); this.scene.environment = null; }
  }

  _applyRealLook() { const on = this.settings.realLook !== false;
    try { const cv = this.renderer.domElement; const grade = on && ['medium', 'high', 'ultra'].includes(this.settings.quality); cv.style.filter = grade ? 'contrast(1.12) saturate(1.22) brightness(0.96)' : ''; } catch (e) { /* facultatif */ } if (this.dayNight) this.dayNight.real = on; if (this.world?.setDebrisVisible) this.world.setDebrisVisible(on && this.settings.quality !== 'verylow'); }

  // Active/désactive l'ensemble des améliorations visuelles V2.5 (réglage utilisateur)
  _applyVisualMode() {
    const on = this._v25;
    this.renderer.toneMapping = on ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 0.95 * (this.settings.exposure || 100) / 100;
    if (this.scene) this.scene.environment = on ? (this._envTex || null) : null;
    this.root.classList.toggle('v25-on', on);
    if (!on && this.camera) { this._runFov = 0; this._fovKick = 0; this.camera.fov = (this.cameraRig ? this.cameraRig.fov : CONFIG.camera.fov) + (this.settings.fovAdj || 0); this.camera.updateProjectionMatrix(); }
    if (this.fx) this.fx.setEnabled(on);
    if (this.ambient) this.ambient.setEnabled(on && this.settings.quality !== 'verylow');
    if (this.trail && !on) this.trail.mesh.visible = false;
    if (this.world) this.world.setGrassVisible(on && this.settings.quality !== 'verylow' && this.settings.grass !== false);
  }

  _resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // Résolution de rendu = plafond de la qualité × échelle adaptative (baisse automatiquement si ça rame)
  _applyResolution() {
    const pr = Math.max(0.3, Math.min(devicePixelRatio || 1, this._q.pixelRatio) * (this._resScale || 1) * ((this.settings.renderScale || 100) / 100));
    if (Math.abs(pr - (this._curPR || 0)) < 0.01) return;
    this._curPR = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(innerWidth, innerHeight);
  }

  // Appelée toutes les 0,5 s avec les FPS mesurés.
  _adaptResolution(fps) {
    if (this.settings.adaptive === false || !this.player || this.paused || this.modalOpen) { this._lowN = this._highN = 0; return; }
    const now = performance.now();
    if (fps < 48) { this._lowN++; this._highN = 0; } else if (fps >= 58) { this._highN++; this._lowN = 0; } else { this._lowN = 0; this._highN = 0; }
    if (now < this._adaptCool) return;
    if (this._lowN >= 3) {
      this._lowN = 0; this._adaptCool = now + 2500;
      if (this._resScale > 0.52) { this._resScale = Math.max(0.5, this._resScale - 0.12); this._applyResolution(); }
      else if (this._q.shadows && !this._autoShadowOff) {
        this._autoShadowOff = true; this._q.shadows = false; this.dayNight.setShadows(false, this._q.shadowMap);
        this.hud.notify('Ombres coupées pour garder un jeu fluide (réglable dans Paramètres).', 'quest');
      }
    } else if (this._highN >= 10 && this._resScale < 1) {
      this._highN = 0; this._adaptCool = now + 4000;
      this._resScale = Math.min(1, this._resScale + 0.08); this._applyResolution();
    }
  }

  _applyQuality(key) {
    const q0 = CONFIG.quality[key];
    this.settings.quality = key;
    // objet « qualité » stable (d'autres modules gardent une référence) ; la config d'origine n'est jamais modifiée
    const q = this._q || (this._q = {});
    Object.assign(q, q0, { shadows: q0.shadows && this.settings.shadows !== false });
    this._applyResolution();
    this.renderer.shadowMap.enabled = q.shadows;
    if (this.dayNight) this.dayNight.setShadows(q.shadows, q.shadowMap);
    this._applyRealLook();
    if (this.world) this.world.setTreeDensity(q.trees);
    if (this.scene?.fog && !this.rift?.active) this.scene.fog.far = q.fogFar * (this.settings.viewDist || 100) / 100;
    if (this.particles) this.particles.factor = q.particles * (this.settings.particleScale ?? 100) / 100;
    if (this.world && this.world.v25 && !this.world.grass && key !== 'verylow') this.world.initGrass(this.scene, key);
    if (this.world) this.world.setGrassVisible(this._v25 && key !== 'verylow' && this.settings.grass !== false);
    if (this.fx) this.fx.scale = key === 'verylow' ? 0.5 : key === 'low' ? 0.7 : 1;
  }

  async _boot() {
    try { const q = new URLSearchParams(location.search); if (q.has('paid')) { this._paidReturn = q.get('paid'); history.replaceState(null, '', location.pathname); } } catch { /* ignoré */ } // retour de la page de paiement Stripe
    this.net.connect();
    this.hud.setLoading(0.02, 'Chargement des modèles 3D…');
    await ModelLibrary.init();
    this.hud.setLoading(0.03, 'Préparation du monde…');
    this.world = new World(this.scene);
    this.world.v25 = this._v25;
    this.world.vq = this._q;
    await this.world.build((f, t) => this.hud.setLoading(0.05 + f * 0.7, t));
    this._q && this.world.setTreeDensity(this._q.trees);
    if (this._v25 && this.settings.quality !== 'verylow') this.world.initGrass(this.scene, this.settings.quality);
    try { applyOcclusionFade(this.world.group, [this.world.terrain, this.world.water, this.world.water2].filter(Boolean)); } catch (e) { console.warn('[V6.1] transparence du décor indisponible', e); }

    this.hud.setLoading(0.8, 'Ciel et lumières…');
    this.dayNight = new DayNight(this.scene, this._q, this._v25);
    this._applyRealLook();
    this.zones = new ZoneManager(this.bus, this.scene);
    this.weather = new Weather(this.scene, this.bus, this.audio);
    this.particles = new Particles(this.scene, 700);
    this.enemyProj = new EnemyProjectiles(this.scene, this.bus);
    this.hazards = null; // créé quand le monde existe
    this.particles.factor = this._q.particles * (this.settings.particleScale ?? 100) / 100;
    this.combat = new CombatSystem(this.bus, this.audio, this.particles);
    try {
      this.fx = new Fx(this.scene, this.settings.quality);
      this.fx.setEnabled(this._v25);
      this.combat.fx = this.fx;
      this.trail = new WeaponTrail(this.scene);
      this.ambient = new Ambient(this.scene, this.settings.quality === 'verylow' ? 0 : this.settings.quality === 'low' ? 36 : 70);
      this.ambient.setEnabled(this._v25 && this.settings.quality !== 'verylow');
      this.bus.on('hitstop', (d) => { this._hitStop = Math.max(this._hitStop || 0, d); this._fovKick = 1; });
    } catch (e) { console.warn('[V2.5] effets de combat indisponibles', e); this.fx = null; }

    this.hud.setLoading(0.85, "Construction des Cryptes oubliées…");
    this.dungeon = buildDungeon(this.world, DUNGEON_CENTER);

    this.hud.setLoading(0.9, 'Peuplement…');
    this._spawnNpcs();
    this.enemies = [];
    this._generateSpawnPoints();
    this._spawnDungeonGuardians();
    this.boss = new Boss(this.scene, this.world, this.bus, new THREE.Vector3(0, 0, -150), { id: 'guardian_ruins', level: GUARDIAN_BOSS_LEVEL, name: 'Le Gardien des Ruines' });
    this.gw.tag(this.boss, 'b:guardian_ruins');
    this.bosses = [this.boss];
    const finalTier = tierById(5);
    if (finalTier.capstoneBoss) {
      const cPos = new THREE.Vector3(finalTier.center[0], 0, finalTier.center[1]);
      cPos.y = this.world.heightAt(cPos.x, cPos.z);
      this.capstoneBoss = new Boss(this.scene, this.world, this.bus, cPos, {
        id: 'sovereign_void', level: finalTier.capstoneBoss.level, name: finalTier.capstoneBoss.name,
        scale: 3.2, fur: 0x1a1420, belly: 0x3a2a4a, eye: 0xff8a3a
      });
      this.gw.tag(this.capstoneBoss, 'b:sovereign_void');
      this.bosses.push(this.capstoneBoss);
    }

    this.hud.setLoading(0.95, 'Ouverture des portails…');
    this._buildPortals();
    try { this.riftStatue = buildRiftStatue(this.world); } catch (e) { console.warn('[V3.7] statue de la spire indisponible', e); }

    this.hud.setLoading(1, 'Prêt.');
    await new Promise((r) => setTimeout(r, 250));
    this.hud.showScreen('main-menu');
    this.hud.initAccountScreen((mode, username, password) => this._handleAccountSubmit(mode, username, password));
    this._refreshContinueButton();
  }

  _refreshContinueButton() {
    const hasLocal = !!SaveManager.load();
    const hasServer = this.net.loggedIn && (this._serverChars || []).some(Boolean);
    this.root.querySelector('[data-act="continue"]').disabled = !hasLocal && !hasServer;
  }

  _handleAccountSubmit(mode, username, password) {
    if (!username || !password) { this.hud.setAccountError('Identifiant et mot de passe requis.'); return; }
    if (!this.net.connected) { this.hud.setAccountError(this._onlineHost ? 'Connexion au serveur impossible pour le moment. Réessaie dans quelques secondes.' : 'Aucune connexion au serveur — voir le README (npm run server).'); return; }
    if (mode === 'register' && password.length < 8) { this.hud.setAccountError('Mot de passe trop court (8 caractères minimum).'); return; }
    this.hud.setAccountError('…');
    if (mode === 'register') this.net.register(username, password);
    else this.net.login(username, password);
  }

  _addRemote(p) {
    if (p.id === this.net.id || this.remotePlayers.has(p.id)) return;
    this.remotePlayers.set(p.id, new RemotePlayer(this.scene, p));
  }

  _spawnNpcs() {
    this.npcs = [];
    const y = this.world.heightAt(6, 33);
    const guard = new NPC(this.scene, npcsData.guard, new THREE.Vector3(6, y, 33), Math.PI);
    guard.id = 'guard';
    this.npcs.push(guard);

    const stalls = [
      { def: npcsData.weaponsmith, pos: [-7.5, -4.9], yaw: 0.3 },
      { def: npcsData.armorsmith, pos: [7.5, -5.9], yaw: -0.3 },
      { def: npcsData.apothecary, pos: [-6, 4.1], yaw: Math.PI }
    ];
    stalls.forEach((s, i) => {
      const sy = this.world.heightAt(s.pos[0], s.pos[1]);
      const npc = new NPC(this.scene, s.def, new THREE.Vector3(s.pos[0], sy, s.pos[1]), s.yaw);
      npc.id = s.def.id;
      this.npcs.push(npc);
    });

    // PNJ des quêtes principales (chaînes déclarées dans npcs.json).
    const questGivers = [
      { def: npcsData.hugo, pos: [-7, 28], yaw: 0.5 },          // accueil : près de la porte sud
      { def: npcsData.sebastien, pos: [-24, -3], yaw: -1.2 },    // quartier ouest
      { def: npcsData.morgane, pos: [24, -16], yaw: 2.4 },       // quartier est
      { def: npcsData.laurine, pos: [-8, -11.5], yaw: 0.2 }      // devant l'auberge
    ];
    questGivers.forEach((s) => {
      const sy = this.world.heightAt(s.pos[0], s.pos[1]);
      const npc = new NPC(this.scene, s.def, new THREE.Vector3(s.pos[0], sy, s.pos[1]), s.yaw);
      npc.id = s.def.id;
      this.npcs.push(npc);
    });
  }

  _spawnDungeonGuardians() {
    const [cx, cz] = DUNGEON_CENTER;
    let id = 9000;
    DUNGEON_SPAWNS.forEach((s) => {
      const pos = new THREE.Vector3(cx + s.off[0], 0, cz + s.off[1]);
      pos.y = this.world.heightAt(pos.x, pos.z);
      const dg = new Enemy(this.scene, this.world, enemiesData.bandit, s.level, pos, this.bus, id);
      this.gw.tag(dg, 'e' + id++);
      this.enemies.push(dg);
    });
    const chiefPos = new THREE.Vector3(cx, 0, cz - 2);
    chiefPos.y = this.world.heightAt(chiefPos.x, chiefPos.z);
    this.dungeonChief = new Enemy(this.scene, this.world, enemiesData.bandit_chief, DUNGEON_CHIEF_LEVEL, chiefPos, this.bus, id);
    this.gw.tag(this.dungeonChief, 'e' + id++);
    this.enemies.push(this.dungeonChief);
  }

  // Construit le REGISTRE des points de spawn (de simples données — position,
  // espèce, niveau — pas encore d'ennemi 3D) sur l'intégralité de la carte :
  // tout le territoire du monde de départ (en excluant la ville, l'eau, le
  // donjon et les autres mondes), plus chaque monde accessible par portail.
  // Le niveau augmente avec la distance à la ville (ou au point d'entrée du
  // portail pour les autres mondes) — voir _updateEnemyStreaming pour la
  // partie qui décide, image par image, quels points sont assez proches du
  // joueur pour mériter un vrai ennemi.
  _generateSpawnPoints() {
    this.spawnPoints = [];
    let sid = 0;
    const rand = mulberry32(4242);
    const wl = CONFIG.world.waterLevel;
    const TOWN_EXCLUDE = 64, DUNGEON_EXCLUDE = 26, B = CONFIG.world.bound - 40;

    // V8.0 — Tout le continent est peuplé, région par région, niveaux 1 → 200.
    // Prairies / Forêt / Montagnes : faune de base ; les autres régions : leur propre famille de monstres (+ élites).
    const baseSpecies = {
      prairie: ['wolf', 'wolf', 'boar', 'boar', 'bandit', 'bandit', 'rat_giant', 'bandit_archer', 'wolf_alpha'],
      forest: ['wolf', 'wolf', 'bear', 'bear', 'rat_giant', 'zealot', 'zealot', 'cultist_mage', 'wolf_alpha', 'bandit'],
      mount: ['troll', 'troll', 'brute', 'brute', 'shield_guard', 'bear', 'bandit_archer', 'zealot', 'cultist_mage']
    };
    const TARGET = { prairie: 190, forest: 120, mount: 100, desert: 100, swamp: 90, tundra: 100, corrupt: 100, celeste: 90, abyss: 90, void: 100 };
    const cand = {};
    for (const r of REGIONS) cand[r.id] = [];
    const counts = {};
    for (let tries = 0; tries < 160000; tries++) {
      const x = (rand() * 2 - 1) * B, z = (rand() * 2 - 1) * B;
      const d = Math.hypot(x, z);
      if (d < TOWN_EXCLUDE || !isLand(x, z)) continue;
      if (Math.hypot(x - DUNGEON_CENTER[0], z - DUNGEON_CENTER[1]) < DUNGEON_EXCLUDE) continue;
      const reg = regionAt(x, z);
      if ((counts[reg.id] || 0) >= TARGET[reg.id]) continue;
      if (this.world.heightAt(x, z) < wl + 0.6) continue;
      if (this.world.roadDist(x, z) < 5) continue; // les routes restent dégagées
      if (!this.world.isWalkable(x, z, 0.9)) continue; // pas dans un arbre / un rocher / l'eau
      { const h0 = this.world.heightAt(x, z), g = Math.max(Math.abs(this.world.heightAt(x + 1.5, z) - h0), Math.abs(this.world.heightAt(x, z + 1.5) - h0)) / 1.5; if (g > 1.1) continue; } // pas sur une falaise
      counts[reg.id] = (counts[reg.id] || 0) + 1;
      cand[reg.id].push({ x, z, d });
    }
    for (const reg of REGIONS) {
      const pts = cand[reg.id];
      if (!pts.length) continue;
      const tier = tierAt(reg.site[0], reg.site[1]);
      const ds = pts.map((p) => p.d).sort((a, b) => a - b);
      const dLo = ds[Math.floor(ds.length * 0.04)], dHi = ds[Math.floor(ds.length * 0.96)];
      const [lo, hi] = reg.levels;
      for (const p of pts) {
        // plus on s'éloigne de la ville au sein d'une région, plus les monstres sont forts
        const f = clamp((p.d - dLo) / Math.max(1, dHi - dLo), 0, 1);
        const level = clamp(Math.round(lo + f * (hi - lo) + (rand() - 0.5) * (hi - lo) * 0.08), lo, hi);
        let speciesKey;
        if (tier.species) speciesKey = rand() < 0.07 ? tier.elite : tier.species[Math.floor(rand() * tier.species.length)];
        else { const pool = baseSpecies[reg.id]; speciesKey = pool[Math.floor(rand() * pool.length)]; }
        this.spawnPoints.push({ id: sid++, pos: new THREE.Vector3(p.x, 0, p.z), speciesKey, level, active: false, enemyRef: null });
      }
    }

    // --- Meute de loups niveau 1 tout autour de la ville (les débutants s'entraînent ici)
    for (let placed = 0, tries = 0; placed < 34 && tries < 600; tries++) {
      const a = rand() * Math.PI * 2, r = 58 + rand() * 34;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this.world.heightAt(x, z) < wl + 0.6) continue;
      if (Math.hypot(x - DUNGEON_CENTER[0], z - DUNGEON_CENTER[1]) < DUNGEON_EXCLUDE) continue;
      if (this.world.roadDist(x, z) < 5) continue;
      this.spawnPoints.push({ id: sid++, pos: new THREE.Vector3(x, 0, z), speciesKey: 'wolf', level: 1, active: false, enemyRef: null });
      placed++;
    }
  }

  // Active/désactive les points de spawn selon la distance au joueur : les
  // ennemis proches deviennent de vrais objets 3D, les trop lointains sont
  // proprement supprimés (ils réapparaîtront si le joueur revient). Le
  // nombre total de points peut être énorme (toute la carte) sans jamais
  // coûter cher, puisque seuls quelques dizaines sont réellement actifs à
  // la fois — c'est ce qui permet une carte entièrement peuplée tout en
  // restant fluide sur mobile.
  _updateEnemyStreaming(dt) {
    this._streamAcc = (this._streamAcc || 0) + dt;
    if (this._streamAcc < 0.5) return;
    this._streamAcc = 0;
    if (!this.spawnPoints) return;

    const fogFar = this._q?.fogFar || 150;
    const ACTIVATE = clamp(fogFar * 0.55, 40, 140);
    const DEACTIVATE = ACTIVATE * 1.4;
    const MAX_ACTIVE = Math.round(({ verylow: 18, low: 24, medium: 32, high: 40, ultra: 48 }[this.settings.quality] || 32) * (1 + Math.min(1, 0.4 * (this.gw.isHost ? this.gw.targets.size : 0))));
    const ppos = this.player.pos;
    const nd = (pos) => this.gw.nearestDist(pos); // en groupe : l'hôte fait vivre les monstres autour de TOUS les membres

    let activeCount = 0;
    for (const sp of this.spawnPoints) {
      if (!sp.active) continue;
      activeCount++;
      if (nd(sp.pos) > DEACTIVATE) {
        const enemy = sp.enemyRef;
        const idx = this.enemies.indexOf(enemy);
        if (idx !== -1) this.enemies.splice(idx, 1);
        if (this.player.target === enemy) this.player.target = null;
        enemy.dispose(this.scene);
        sp.active = false; sp.enemyRef = null;
        activeCount--;
      }
    }

    if (activeCount >= MAX_ACTIVE) return;
    const candidates = this.spawnPoints.filter((sp) => !sp.active && nd(sp.pos) <= ACTIVATE);
    candidates.sort((a, b) => nd(a.pos) - nd(b.pos));
    for (const sp of candidates) {
      if (activeCount >= MAX_ACTIVE) break;
      const pos = sp.pos.clone();
      pos.y = this.world.heightAt(pos.x, pos.z);
      let def = enemiesData[sp.speciesKey], champ = null;
      // V4.6 : ~6 % des monstres sont des champions (déterministe par point d'apparition)
      const hsh = (Math.imul(sp.id + 1, 2654435761) >>> 0) % 1000;
      if (hsh < 60 && !['elite', 'goblin'].includes(def.species)) {
        champ = ['Rapide', 'Colossal', 'Vampirique', 'Blindé'][hsh % 4];
        def = { ...def, itemDropChance: Math.min(0.95, (def.itemDropChance || 0.3) * 2.5), ...(champ === 'Rapide' ? { speed: def.speed * 1.35, attackCd: def.attackCd * 0.8 } : {}), ...(champ === 'Blindé' ? { trait: 'armored' } : {}) };
      }
      const enemy = new Enemy(this.scene, this.world, def, sp.level, pos, this.bus, 100000 + sp.id);
      if (champ) this._makeChampion(enemy, champ);
      this.gw.tag(enemy, 'e' + (100000 + sp.id));
      this.enemies.push(enemy);
      sp.active = true; sp.enemyRef = enemy;
      activeCount++;
    }
  }

  _makeChampion(e, kind) {
    e.champion = kind;
    e.maxHp = Math.round(e.maxHp * (kind === 'Colossal' ? 2.8 : 2.0)); e.hp = e.maxHp;
    e.damage = Math.round(e.damage * 1.25);
    e.xp = Math.round(e.xp * 3); e.coins = [e.coins[0] * 2, e.coins[1] * 2];
    if (kind === 'Colossal') e.rig.root.scale.multiplyScalar(1.3);
    if (kind === 'Vampirique') e.onPlayerHit = (dealt) => { if (dealt > 0) { e.hp = Math.min(e.maxHp, e.hp + dealt * 0.5); e.hpBar.fg.scale.x = Math.max(0.001, e.hp / e.maxHp); e.hpBar.fg.position.x = -(1 - e.hpBar.fg.scale.x) / 2; } };
    e.setTitle(`★ ${kind} · ${e.def.name} · Nv.${e.level}`, '#ffd23f');
  }

  // Lutin pillard (classique) : apparaît au hasard près du joueur, fuit
  // sans jamais vraiment se battre, et laisse tomber un énorme butin une
  // fois rattrapé (voir LootSystem.rollForTreasureGoblin). Disparaît tout
  // seul s'il n'est pas attrapé à temps — il ne faut pas traîner.
  // V4.6 : événement « Pluie d'astres » — toutes les 4 à 7 min en terrain découvert : des météores
  // tombent autour du joueur (cercles à éviter). Sans être touché : XP, or et un objet au sol.
  _updateMeteorEvent(dt) {
    const p = this.player;
    if (!p || p.dead || this.rift?.active || this.paused) return;
    const m = this._mev || (this._mev = { cd: 150 + Math.random() * 120, active: false, t: 0, spawnT: 0, hit: false });
    if (!m.active) {
      if (this.modalOpen || this.dialogueOpen) return;
      if (Math.hypot(p.pos.x, p.pos.z) < 75 || Math.hypot(p.pos.x - DUNGEON_CENTER[0], p.pos.z - DUNGEON_CENTER[1]) < 30) return; // pas en ville
      m.cd -= dt;
      if (m.cd <= 0) this.startMeteorShower();
      return;
    }
    m.t += dt; m.spawnT -= dt;
    if (m.spawnT <= 0 && m.t < 14) {
      m.spawnT = 0.5;
      const dmg = Math.round((6 + p.level * 4.233) * 0.9);
      const near = Math.random() < 0.35, a = Math.random() * Math.PI * 2, r = near ? Math.random() * 2.5 : 3 + Math.random() * 7;
      this.bus.emit('hazard', { x: p.pos.x + Math.cos(a) * r, z: p.pos.z + Math.sin(a) * r, radius: 2.6, delay: 1.3, damage: dmg, color: 0xffa23a, dmgType: 'fire' });
    }
    if (m.t >= 16) this._endMeteorShower();
  }

  startMeteorShower() {
    const m = this._mev || (this._mev = {});
    Object.assign(m, { active: true, t: 0, spawnT: 0.5, hit: false });
    this.hud.notify('☄️ Pluie d\'astres ! Évitez les cercles pendant 15 secondes.', 'boss');
    this.audio.play('guardian');
  }

  _endMeteorShower() {
    const m = this._mev, p = this.player;
    m.active = false; m.cd = 240 + Math.random() * 180;
    if (m.hit) { this.hud.notify('La pluie d\'astres s\'achève. Vous avez été touché : pas de récompense.', 'info'); return; }
    const st = computeEnemyStats(p.level, 'elite');
    p.gainXp(Math.round(st.xp * 1.5)); p.addCoins(Math.round(st.coins[1] * 2));
    this._spawnGroundItem({ gen: rollLootItem({ sourceLevel: p.level, tierShift: 6 }) }, p.pos.x + 1.5, p.pos.z + 1.5, true);
    this.hud.notify('☄️ Pluie d\'astres survivante ! Récompense déposée près de vous.', 'quest');
    this.audio.play('quest');
    this._tut('meteor');
  }

  _updateTreasureGoblin(dt) {
    if (this.rift?.active) return; // dans une spire, le lutin est géré par RiftSystem
    if (this.lootSprite) {
      if (!this.lootSprite.alive) { this.lootSprite = null; return; }
      this._spriteLifeT = (this._spriteLifeT || 0) + dt;
      if (this._spriteLifeT > 55) {
        const g = this.lootSprite;
        const idx = this.enemies.indexOf(g);
        if (idx !== -1) this.enemies.splice(idx, 1);
        if (this.player.target === g) this.player.target = null;
        g.dispose(this.scene);
        this.lootSprite = null;
        this.hud.notify('Le lutin trésor a filé avec son butin…', 'info');
        return;
      }
      this._goblinSparkleT = (this._goblinSparkleT || 0) + dt;
      if (this._goblinSparkleT > 0.12) {
        this._goblinSparkleT = 0;
        const p = this.lootSprite.pos;
        this.particles.emit(p.x, p.y + 0.6, p.z, { count: 3, color: 0xffd23f, speed: 1.2, life: 0.5, up: 1.4, spread: 0.6 });
      }
      return;
    }
    this._goblinSpawnAcc = (this._goblinSpawnAcc || 0) + dt;
    if (this._goblinSpawnAcc < 15) return;
    this._goblinSpawnAcc = 0;
    if (Math.random() > 0.07) return;

    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 20;
      const x = this.player.pos.x + Math.cos(a) * r, z = this.player.pos.z + Math.sin(a) * r;
      if (!this.world.isWalkable(x, z, 0.5)) continue;
      const pos = new THREE.Vector3(x, 0, z);
      pos.y = this.world.heightAt(x, z);
      const level = Math.max(1, this.player.level + Math.round((Math.random() - 0.5) * 4));
      this.lootSprite = new Enemy(this.scene, this.world, enemiesData.loot_sprite, level, pos, this.bus, 777777);
      this.enemies.push(this.lootSprite);
      this._spriteLifeT = 0;
      this.hud.notify('✨ Un lutin trésor est apparu à proximité — rattrapez-le !', 'quest');
      this.audio.play('quest');
      break;
    }
  }

  // ---------- UI wiring ----------
  _bindUi() {
    const b = this.bus;
    b.on('ui:fullscreen', () => this._toggleFullscreen());
    // Version en ligne : un compte est obligatoire pour jouer (création / connexion sur l'écran « Compte »).
    this._onlineHost = NetworkManager.isOnlineHost();
    const needAccount = () => {
      if (!this._onlineHost || this.net.loggedIn) return false;
      this._accountGate = true;
      this.hud.showScreen('account-screen'); this.hud.setAccountState(null);
      this.hud.setAccountError('Crée un compte (ou connecte-toi) pour jouer en ligne.');
      return true;
    };
    const hint = this.root.querySelector('#account-hint');
    if (hint && this._onlineHost) hint.innerHTML = 'Un compte est nécessaire pour jouer en ligne : votre personnage est sauvegardé sur le serveur et accessible depuis n\'importe quel appareil.<br>Il n\'y a pas de récupération de mot de passe : notez-le bien.';
    b.on('ui:new', () => {
      if (needAccount()) return;
      if (this.net.loggedIn) { this._openCharSelect(); return; } // compte : 5 emplacements
      if (this.settings.autoFullscreen) this._enterFullscreen(); this._pendingSlot = null; this._openCharCreate();
    });
    b.on('ui:continue', () => {
      if (needAccount()) return;
      if (this.net.loggedIn && (this._serverChars || []).some(Boolean)) { this._openCharSelect(); return; }
      if (this.settings.autoFullscreen) this._enterFullscreen();
      this._slot = 0;
      this._startGame(SaveManager.load());
    });
    b.on('ui:cs-back', () => this.hud.showScreen('main-menu'));
    b.on('net:chars', (msg) => { this._serverChars = msg.chars || []; this._serverBank = msg.bank || []; this._refreshContinueButton(); if (this.hud._curScreen === 'char-select') this._openCharSelect(); });
    b.on('ui:lune', () => this._openLune(this.hud._curScreen === 'pause-menu' ? 'pause-menu' : 'main-menu'));
    b.on('ui:account', () => { this.hud.showScreen('account-screen'); this.hud.setAccountError(''); });
    b.on('ui:account-back', () => this.hud.showScreen('main-menu'));
    // V10.3 — page « Nouveautés » (menu principal + page de connexion) ; pastille « Nouveau » tant que la dernière version n'a pas été vue
    {
      const KEY = 'korvalune.patchSeen';
      const badge = this.root.querySelector('#news-badge');
      let seen = null; try { seen = localStorage.getItem(KEY); } catch { /* ignoré */ }
      if (badge && seen === LATEST_VERSION) badge.classList.add('hidden');
      b.on('ui:patch', () => {
        this._patchReturn = this.hud._curScreen === 'patch-screen' ? this._patchReturn : this.hud._curScreen;
        this.hud.showScreen('patch-screen');
        this.hud.q('#patch-body').scrollTop = 0;
        badge?.classList.add('hidden');
        try { localStorage.setItem(KEY, LATEST_VERSION); } catch { /* ignoré */ }
      });
      b.on('ui:patch-back', () => this.hud.showScreen(this._patchReturn || 'main-menu'));
    }
    b.on('ui:account-logout', () => { this.net.logout(); this._shop = null; this._preview = null; this._serverChars = null; this._serverBank = null; this.hud.setAccountState(null); this._refreshContinueButton(); });
    b.on('net:authResult', (msg) => {
      if (msg.ok) {
        this.hud.setAccountError('');
        this.hud.setAccountState(msg.username);
        this._serverChars = Array.isArray(msg.chars) ? msg.chars : (msg.save ? [msg.save] : []);
        this._serverBank = Array.isArray(msg.bank) ? msg.bank : (msg.save?.bank || []);
        this._refreshContinueButton();
        this.hud.notify(`Connecté : ${msg.username}`, 'quest');
        if (this._accountGate || (this._onlineHost && this.hud._curScreen === 'account-screen')) { this._accountGate = false; this.hud.showScreen('main-menu'); }
      } else if (!msg.silent) {
        this.hud.setAccountError(msg.error || 'Erreur.');
      }
    });
    b.on('net:saveAck', (msg) => { if (!msg.ok) this.hud.notify('Sauvegarde serveur refusée : ' + (msg.error || ''), 'boss'); });
    b.on('ui:options', () => { this._menuReturn = 'main-menu'; this._openSettings(); });
    b.on('ui:credits', () => this.hud.showScreen('credits'));
    b.on('ui:back', () => this.hud.showScreen('main-menu'));
    b.on('ui:resume', () => this.setPaused(false));
    b.on('ui:teleport-town', () => this._teleportToTown());
    b.on('ui:settings', () => { this._menuReturn = 'pause-menu'; this._openSettings(); });
    b.on('ui:settings-back', () => { this.settingsUI?._stopListen(); this.hud.showScreen(this._menuReturn); });
    b.on('ui:save', () => { this._doSave(); this.hud.notify('Partie sauvegardée.'); });
    b.on('ui:quit', () => { try { this._doSave(); } catch (e) { /* ignoré */ } setTimeout(() => location.reload(), 400); });
    b.on('ui:cc-back', () => { if (this._charPreview) { this._charPreview.dispose(); this._charPreview = null; } if (this.net.loggedIn) this._openCharSelect(); else this.hud.showScreen('main-menu'); });
    b.on('ui:respawn', () => { if (this.rift?.active) this.rift.onRespawn(); else this.player.respawn(); this.hud.showScreen('game-ui'); });
    b.on('ui:close-rift', () => this._closeModal());
    b.on('ui:close-map', () => this.hud.showScreen('game-ui'));
    b.on('ui:close-inv', () => this._closeModal());
    b.on('ui:close-char', () => this._closeModal());
    b.on('ui:close-shop', () => this._closeModal());
    b.on('ui:close-skills', () => this._closeModal());
    b.on('ui:close-quests', () => this._closeModal());
    b.on('ui:close-ach', () => this._closeModal());
    b.on('ui:close-social', () => this._closeModal());
    this.ach = new Achievements(this);
    b.on('ui:close-bank', () => this._closeModal());
    b.on('notify', (d) => { if (d.kind === 'zone') { this.hud.zoneBanner(d.text); this.audio.play('zone'); } else this.hud.notify(d.text, d.kind === 'warn' ? 'boss' : 'info'); });
    this.hud.onUnequip = (slotName) => {
      if (!this.equipment.slots[slotName]) return;
      this.equipment.unequip(slotName, this.inventory);
      this.player.refreshGearVisuals(this.equipment);
      this.audio.play('equip');
      this._refreshEquipPanels();
    };
    b.on('equipmentChanged', () => this._refreshEquipPanels());
    b.on('inventoryChanged', () => {
      this._updatePotionBadges(); if (!this.hud.q('#inventory-screen').classList.contains('hidden')) this.hud.renderInventory(this.inventory, this.equipment, this.player, (a, i) => this._onItemAction(a, i)); });
    b.on('loot', (source) => {
      let drops;
      if (!source.def) drops = LootSystem.rollForMajorBoss(source.level || 14);
      else if (source === this.lootSprite) {
        drops = LootSystem.rollForTreasureGoblin(source.level || 10);
        this.hud.notify('✨ Le lutin trésor explose en un torrent de butin !', 'quest');
        this.audio.play('levelup');
        this.particles.emit(source.pos.x, source.pos.y + 0.8, source.pos.z, { count: 90, color: 0xffd23f, speed: 6.5, life: 1.2, up: 3 });
        this.lootSprite = null;
      }
      else if (source === this.dungeonChief) drops = LootSystem.rollForBoss(source.level || 20);
      else drops = LootSystem.rollForEnemy(source);
      if (this.rift) drops = this.rift.modifyDrops(source, drops);
      const pos = source.pos.clone();
      drops.forEach((d) => {
        const offset = drops.length > 1 ? { x: (Math.random() - 0.5) * 1.2, y: 0, z: (Math.random() - 0.5) * 1.2 } : { x: 0, y: 0, z: 0 };
        const dropPos = pos.clone().add(offset);
        dropPos.y = this.world.heightAt(dropPos.x, dropPos.z);
        this._spawnGroundItem(d, dropPos.x, dropPos.z);
      });
      if (drops.length) this.audio.play('loot', pos);
    });
    b.on('skillPressed', (id) => this._useSkill(id));
    b.on('buffs', () => { if (this.player) this.hud.renderBuffs(this.player); });
    b.on('interact', () => this._tryInteract());
    b.on('toggleCameraLock', () => {
      if (this.cameraRig?.isIso) { this.cameraRig.recenter(); return; } // vue aérienne : recentre angle + zoom
      this.settings.cameraLock = !this.settings.cameraLock; this.cameraRig.locked = this.settings.cameraLock;
    });
    b.on('playerDeath', () => setTimeout(() => {
      const rf = !!this.rift?.active, ds = this.hud.q('#death-screen');
      const btn = ds.querySelector('button'), msg = ds.querySelector('p');
      if (btn) btn.textContent = rf ? 'Réapparaître au point de contrôle' : 'Revenir à Korvalune';
      if (msg) msg.textContent = rf ? (this.rift.run?.mode.timed ? 'Vous réapparaissez dans la spire — le chronomètre continue !' : 'Vous réapparaissez au dernier point de contrôle de la spire.') : 'Votre équipement est intact. Le portail de Korvalune vous attend.';
      this.hud.showScreen('death-screen');
    }, 900));
    b.on('playerHurt', () => tryTriggerEquipEffects('hurt', this.player, { enemies: this.enemies, bosses: this.bosses, particles: this.particles, audio: this.audio, bus: this.bus }));
    b.on('levelup', (lvl) => { try { const nu = this.player.getSkillPool().filter((x) => x.levelReq === lvl); if (nu.length) this.hud.notify(`Nouvelle compétence : ${nu.map((x) => x.icon + ' ' + x.name).join(', ')} (touche K)`, 'info'); } catch (e) { /* ignoré */ } this.hud.levelupBanner(); try { this.fx?.levelUp(this.player.pos, this.particles); } catch (e) { /* ignore */ } });
    b.on('enemyAttack', (e) => this.audio.play('enemyAttack', { pos: e.pos, kind: e.def?.id || e.def?.name || '' }));
    b.on('enemyShoot', (d) => { this.enemyProj.spawn(d); this.audio.play(d.enemy?.def?.species === 'mage' ? 'cast' : 'bow', d.from); });
    b.on('hazard', (d) => { if (!this.hazards) this.hazards = new GroundHazards(this.scene, this.world, this.bus); this.hazards.spawn(d); });
    b.on('hazardBurst', (d) => { this.audio.play('explode', new THREE.Vector3(d.x, 0, d.z)); if (d.hit && this._mev?.active) this._mev.hit = true; if (d.hit) this.bus.emit('shake', 0.3); });
    b.on('enemyProjectileHit', () => this.audio.play('hurt'));
    b.on('enemyExplode', (e) => this.audio.play('explode', e.pos));
    b.on('enemyEnrage', (e) => this.audio.play('enrage', { pos: e.pos }));
    b.on('enemyHurt', (e) => this.audio.play('enemyHurt', e.pos));
    b.on('enemyKilled', (e) => {
      if (e?.champion) { this.hud.notify(`★ Champion ${e.champion} vaincu !`, 'quest'); this._tut('champion'); }
      if (e?.pos) this.audio.play('kill', e.pos);
      if (!this.fx?.enabled || !e?.pos) return;
      try {
        this.fx.flash(e.pos.x, e.pos.y + 0.9, e.pos.z, 0xffffff, 2.4, 0.3);
        this.fx.ring(e.pos.x, e.pos.y, e.pos.z, 0xcfd8ff, 1.8, 0.4);
        this.particles.emit(e.pos.x, e.pos.y + 0.6, e.pos.z, { count: 16, color: 0xb9c4ff, speed: 2.6, life: 0.9, gravity: -0.8, up: 1.5, spread: 0.6 });
        this.fx.soul(e.pos, e.def?.boss || e.isBoss ? 0xffe27a : 0xcfe8ff, e.def?.boss || e.isBoss ? 6 : 3);
      } catch (err) { /* effet ignoré */ }
    });
    b.on('floatText', (data) => this.settings.floatText !== false && this.hud.floatText((p) => this._worldToScreen(p), data));
    b.on('particles', (d) => this.particles.emit(d.pos.x, d.pos.y, d.pos.z, d));
    b.on('shake', (amt) => { this._shake = Math.max(this._shake || 0, amt * (this.settings.shake ?? 100) / 100); });
    b.on('questStarted', (q) => this.hud.notify(`Nouvelle quête : ${q.name}`, 'quest'));
    b.on('questUpdated', (qm) => this.hud.renderQuests(qm));
    b.on('questCompleted', (q) => {
      this.hud.notify(`Quête terminée : ${q.name} (+${q.reward.xp} XP, +${q.reward.coins} 🪙)`, 'quest');
      this.audio.play('quest');
      this.player.gainXp(q.reward.xp);
      this.player.addCoins(q.reward.coins);
    });
    b.on('questGive', (gv) => {
      for (const it of gv.items || []) {
        this.inventory.add(it.defId, it.qty || 1);
        const v = resolveItem({ defId: it.defId, qty: it.qty || 1 });
        this.hud.notify(`Reçu : ${v.icon} ${v.name}${(it.qty || 1) > 1 ? ' x' + it.qty : ''}`, 'quest');
      }
      for (const id of gv.ground || []) {
        const p = this.player, x = p.pos.x + Math.sin(p.yaw) * 1.6, z = p.pos.z + Math.cos(p.yaw) * 1.6;
        this._spawnGroundItem({ defId: id, qty: 1 }, x, z, true);
      }
      if (gv.coins) this.player.addCoins(gv.coins);
      if (gv.xp) this.player.gainXp(gv.xp);
    });
    b.on('bossStart', (boss) => this.hud.notify(`⚠ ${boss.name} se réveille !`, 'boss'));
    b.on('bossHp', (boss) => this.hud.showBossBar(boss));
    b.on('bossDefeated', (boss) => { this.hud.notify(`🏆 ${boss.name} est vaincu !`, 'boss'); this.hud.showBossBar(null); });

    // ---------- Réseau (multijoueur, chat, groupe) ----------
    b.on('net:status', (s) => this.hud.setNetStatus(s.connected));
    b.on('zoneChanged', (z) => { // V7.0 : avertissement quand la région dépasse largement le niveau du joueur
      if (!z || !z.levels || !this.player) return;
      const min = parseInt(z.levels, 10);
      if (this.player.level < min - 4) this.hud.notify(`⚠ Région dangereuse : niveau recommandé ${z.levels} (vous êtes niveau ${this.player.level})`, 'boss');
    });
    b.on('net:disconnected', () => { this.hud.notify('Connexion au serveur perdue — mode solo.', 'boss'); this.group = []; this.gw.onGroup({ members: [] }); });
    b.on('net:welcome', (msg) => {
      for (const rp of this.remotePlayers.values()) rp.dispose(this.scene); // reconnexion : repart d'une liste propre
      this.remotePlayers.clear();
      for (const p of msg.players) this._addRemote(p);
    });
    b.on('net:playerJoined', (p) => this._addRemote(p));
    b.on('net:playerLeft', (id) => { this.remotePlayers.get(id)?.dispose(this.scene); this.remotePlayers.delete(id); });
    b.on('net:playerMoved', (msg) => { this.remotePlayers.get(msg.id)?.applyState(msg); this.gw.onMoved(msg); });
    b.on('net:gr', (msg) => this.gw.onRelay(msg));
    b.on('net:chat', (msg) => this.hud.appendChat({ channel: msg.channel, from: msg.from, text: msg.text }));
    b.on('net:whisper', (msg) => this.hud.appendChat({ channel: 'general', whisper: true, from: msg.from, to: msg.to, text: msg.text, self: msg.self }));
    b.on('net:system', (msg) => this.hud.appendChat({ channel: 'general', system: true, text: msg.text }));
    b.on('net:who', (players) => this.hud.appendChat({ channel: 'general', system: true, text: `En ligne (${players.length}) : ${players.map((p) => `${p.name} (Nv.${p.level})`).join(', ') || '—'}` }));
    b.on('net:group', (msg) => { this.group = msg.members || []; this.gw.onGroup(msg); this._renderSocial(); });
    // V10.1 — boutique des Lunes (état fourni par le serveur : le client ne décide de rien)
    b.on('net:shop', (msg) => {
      if (this._paidReturn) {
        const ok = this._paidReturn === '1'; this._paidReturn = null;
        this.hud.notify(ok ? 'Paiement reçu : tes Lunes arrivent dans quelques secondes…' : 'Paiement annulé : rien n\u2019a été débité.', ok ? 'quest' : 'info');
        if (ok) { setTimeout(() => this.net.shopGet(), 4000); setTimeout(() => this.net.shopGet(), 12000); }
      }
      this._shop = msg;
      this._growBank();
      if (this.player) this.player.setCosmetics(this._shopCos());
      this._renderLune();
    });
    b.on('net:shopMsg', (msg) => { this._luneMsg = { ok: msg.ok, text: msg.text }; if (msg.text) this.hud.notify(msg.text, msg.ok ? 'quest' : 'info'); this._renderLune(); });
    b.on('net:playerCos', (msg) => { this.remotePlayers.get(msg.id)?.setCos(msg.cos); });
    b.on('ui:close-lune', () => this._closeLune());
    b.on('net:friends', (msg) => {
      const before = this._friends?.requests?.length || 0;
      this._friends = msg;
      if (msg.requests.length > before) this.hud.notify(`👥 Demande d'ami de ${msg.requests[msg.requests.length - 1]} (menu 👥)`, 'quest');
      this._renderSocial();
    });
    b.on('net:groupInvited', (msg) => {
      this._pendingInvite = msg.from;
      this.hud.showInvite(msg.from, () => this.net.acceptGroupInvite(), () => this.net.declineGroupInvite());
      this.hud.notify(`${msg.from} t'invite dans son groupe — tape /group accept`, 'quest');
      this.hud.appendChat({ channel: 'general', system: true, text: `${msg.from} t'invite dans son groupe. Tape /group accept pour rejoindre.` });
    });

    this.root.querySelector('#te-done').addEventListener('click', () => this._endTouchEdit());
    this.root.querySelector('#te-reset').addEventListener('click', () => { this.touch?.resetLayout(); });
    this.root.querySelector('#btn-pause').addEventListener('click', () => this.setPaused(!this.paused));
    this.root.querySelector('#map-expand').addEventListener('click', () => this._openWorldMap());
    this.root.querySelector('#btn-inv').addEventListener('click', () => this._openInventory());
    for (const [id, kind] of [['#pq-heal', 'heal'], ['#pq-mana', 'mana']]) {
      this.root.querySelector(id).addEventListener('pointerdown', (e) => { if (this.touch?.editing) return; e.preventDefault(); e.stopPropagation(); this._quickPotion(kind); });
    }
    this.root.querySelector('#btn-char').addEventListener('click', () => this._openCharacter());
    this.root.querySelector('#btn-skills').addEventListener('click', () => this._openSkills());
    this.root.querySelector('#btn-quests').addEventListener('click', () => this._openQuestBoard());
    this.root.querySelector('#btn-ach').addEventListener('click', () => this._openAchievements());
    this.root.querySelector('#btn-social').addEventListener('click', () => this._openSocial());
    this.root.querySelector('#btn-lune').addEventListener('click', () => this._openLune());
    this.root.querySelector('#lune-screen').addEventListener('change', (e) => { if (e.target && e.target.id === 'lune-consent') this._luneConsent = !!e.target.checked; });
    this.root.querySelector('#lune-screen').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-la]');
      if (!btn || btn.disabled) return;
      const v = btn.dataset.v;
      switch (btn.dataset.la) {
        case 'tab': this._luneTab = v; this._luneMsg = null; break;
        case 'daily': this.net.shopDaily(); return;
        case 'pay': {
          if (!this._luneConsent) { this._luneMsg = { ok: false, text: 'Coche d\u2019abord la case d\u2019acceptation des conditions de vente.' }; this._renderLune(); return; }
          btn.disabled = true;
          this.net.startCheckout(v, true).then((url) => { window.location.assign(url); }).catch((err) => { this._luneMsg = { ok: false, text: err.message }; this._renderLune(); });
          return;
        }
        case 'buy': this.net.shopBuy(v); return;
        case 'equip': { const it = CATALOG_BY_ID[v]; if (it) { this._preview = null; this.net.shopEquip(it.cat, v); } return; }
        case 'unequip': this._preview = null; this.net.shopEquip(v, null); return;
        case 'try': { const it = CATALOG_BY_ID[v]; if (it) { this._preview = this._preview?.id === v ? null : { slot: it.cat, id: v }; this.player?.setCosmetics(this._shopCos()); } break; }
        default: return;
      }
      this._renderLune();
    });
    {
      const scr = this.root.querySelector('#social-screen');
      scr.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sa]');
        if (!btn) return;
        const v = btn.dataset.v;
        switch (btn.dataset.sa) {
          case 'invite': this.net.inviteToGroup(v); break;
          case 'invite-id': this.net.inviteToGroup('', v); break;
          case 'accept': this.net.friendAccept(v); break;
          case 'decline': this.net.friendDecline(v); break;
          case 'remove': this.net.friendRemove(v); break;
          case 'kick': this.net.kickFromGroup(v); break;
          case 'leave': this.net.leaveGroup(); break;
          case 'join-rift': this._closeModal(); this._joinGroupRift(); break;
          default: break;
        }
      });
      const doAdd = () => { const i = scr.querySelector('#friend-input'); const n = i.value.trim(); if (n) { this.net.friendAdd(n); i.value = ''; } };
      scr.querySelector('#friend-add').addEventListener('click', doAdd);
      scr.querySelector('#friend-input').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') doAdd(); });
    }
    this.root.querySelector('#btn-chat').addEventListener('click', () => { document.exitPointerLock?.(); this.hud.toggleChat(); });
    document.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.code === 'Escape') e.target.blur();
        return;
      }
      if (this.input.listening) return; // réassignation d'une touche en cours (menu Paramètres)
      if (e.code === 'Escape') this.setPaused(!this.paused);
      if (e.code === 'F3') this.debug = !this.debug;
      if (!this.player) return;
      const act = this.input.actionOf(e.code);
      if (!act) return;
      if (act === 'map') this._openWorldMap();
      else if (act === 'inventory') this.modalOpen ? this._closeModal() : this._openInventory();
      else if (act === 'character') this.modalOpen ? this._closeModal() : this._openCharacter();
      else if (act === 'skills') this.modalOpen ? this._closeModal() : this._openSkills();
      else if (act === 'interact') this._tryInteract();
      else if (act === 'potionHeal' && !e.repeat) this._quickPotion('heal');
      else if (act === 'potionMana' && !e.repeat) this._quickPotion('mana');
      else if (act === 'chat' && !e.repeat && !this.paused && !this.modalOpen) { e.preventDefault(); document.exitPointerLock?.(); this.hud.toggleChat(); }
      else if (act === 'camReset') this.bus.emit('toggleCameraLock');
      else if (act.startsWith('skill')) this._useSkill(this.player.skillBar[+act.slice(5) - 1]);
    });
    this.root.addEventListener('click', (e) => { if (e.target.id === 'game-canvas' && this.player && !this.dialogueOpen && !this.modalOpen) this._tryClickTarget(e); });
  }

  _doSave() {
    if (!this.player) return;
    const data = {
      ...this.player.serialize(),
      ...this.quests.serialize(),
      inventory: this.inventory.serialize(),
      equipment: this.equipment.serialize(),
      bank: this.bank.serialize(),
      // V4.0 : objets jetés au sol (sauvegardés en local)
      ground: this.lootDrops.filter((d) => d.keep).slice(0, 40).map((d) => ({ x: +d.pos.x.toFixed(2), z: +d.pos.z.toFixed(2), item: d.item })),
      chests: this.worldChests ? this.worldChests.serialize() : undefined,
      rift: this.rift ? this.rift.serialize() : undefined
    };
    if (this.rift?.active) data.pos = [-8.5, this.world.heightAt(-8.5, 25.5), 25.5]; // sauvegarde en ville, jamais dans l'arène
    SaveManager.save(data);
    if (this.net.loggedIn) {
      const slot = this._slot ?? 0;
      this.net.saveToServer(data, slot);
      if (this._serverChars) { const { bank, ...rest } = data; this._serverChars[slot] = rest; this._serverBank = bank; } // garde la copie locale à jour (changement de personnage)
    }
  }

  // V8.4 — choix du personnage (5 emplacements par compte, coffre partagé).
  _openCharSelect() {
    this.hud.showScreen('char-select');
    const list = this.root.querySelector('#cs-list'); list.innerHTML = '';
    const chars = this._serverChars || [];
    const ICON = { warrior: '⚔️', paladin: '🛡️', mage: '🔮', archer: '🏹', assassin: '🗡️' };
    for (let i = 0; i < 5; i++) {
      const c = chars[i];
      const row = document.createElement('div'); row.className = 'cs-slot' + (c ? '' : ' empty');
      if (c) {
        const cls = CLASSES[c.classId];
        const esc = (t) => String(t).replace(/[<>&]/g, '');
        row.innerHTML = `<span class="cs-ic">${ICON[c.classId] || '✨'}</span><div class="cs-info"><b>${esc(c.name || 'Aventurier')}</b><small>${cls ? cls.name : c.classId} · niveau ${c.level || 1}</small></div>`;
        const play = document.createElement('button'); play.className = 'btn-primary'; play.textContent = 'Jouer';
        play.onclick = () => { if (this.settings.autoFullscreen) this._enterFullscreen(); this._slot = i; this._startGame({ ...c, bank: this._serverBank || [] }); };
        const del = document.createElement('button'); del.className = 'cs-del'; del.textContent = '🗑';
        del.setAttribute('aria-label', 'Supprimer ' + (c.name || 'ce personnage'));
        del.onclick = () => { if (confirm(`Supprimer définitivement « ${c.name || 'Aventurier'} » (niv. ${c.level || 1}) ?\nLe coffre partagé n'est pas touché.`)) this.net.deleteChar(i); };
        row.append(play, del);
      } else {
        const nb = document.createElement('button'); nb.textContent = '＋ Nouveau personnage (emplacement ' + (i + 1) + ')';
        nb.onclick = () => { if (this.settings.autoFullscreen) this._enterFullscreen(); this._pendingSlot = i; this._openCharCreate(); };
        row.appendChild(nb);
      }
      list.appendChild(row);
    }
  }

  _openCharCreate() {
    this.hud.showScreen('char-create');
    const raceGrid = this.root.querySelector('#cc-race');
    const classGrid = this.root.querySelector('#cc-class');
    const skinRow = this.root.querySelector('#cc-skin');
    raceGrid.innerHTML = ''; classGrid.innerHTML = ''; skinRow.innerHTML = '';
    this._chosenRace = 'human'; this._chosenClass = 'warrior'; this._chosenTone = 2; this._chosenHair = 0; this._chosenEye = 0;
    const HAIRS = [0x2c1f16, 0x0f0d0c, 0x6b4426, 0xb5803a, 0xd9c079, 0x9c3a22, 0xc9ccd2, 0x2f5f8a, 0x6a3a8a];
    const EYES = [0x3f78b0, 0x3d7a4a, 0x6b4a2a, 0x7a8a96, 0x8a5aa8, 0xb08a2a];
    const hairRow = this.root.querySelector('#cc-hair'), eyeRow = this.root.querySelector('#cc-eye');
    hairRow.innerHTML = ''; eyeRow.innerHTML = '';

    const CLASS_UI = {
      warrior: ['⚔️', 'Mêlée'], paladin: ['🛡️', 'Mêlée · soin'], mage: ['🔮', 'Magie'], archer: ['🏹', 'Distance'], assassin: ['🗡️', 'Vitesse']
    };
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    // 5 teintes autour de la couleur de peau de la race (plus claire → plus sombre)
    const TONES = [0.2, 0.1, 0, -0.14, -0.28];
    const shade = (col, f) => {
      let r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255;
      const t = f > 0 ? 255 : 0, a = Math.abs(f);
      r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
      return (r << 16) | (g << 8) | b;
    };
    const currentSkin = () => shade(RACES[this._chosenRace].skin, TONES[this._chosenTone]);

    if (this._charPreview) this._charPreview.dispose();
    this._charPreview = new CharPreview(this.root.querySelector('#cc-preview'));
    const refreshSwatches = () => {
      skinRow.querySelectorAll('.cc-swatch').forEach((b, i) => { b.style.background = hex(shade(RACES[this._chosenRace].skin, TONES[i])); b.classList.toggle('active', i === this._chosenTone); });
    };
    const refreshPreview = () => {
      const race = RACES[this._chosenRace], cls = CLASSES[this._chosenClass];
      const weaponVisual = getItem(cls.startWeapon)?.visual || 'sword';
      this._charPreview.setAppearance({ skin: currentSkin(), cloth: cls.color, armor: cls.armor, shield: cls.shield, hair: HAIRS[this._chosenHair], eye: EYES[this._chosenEye], weaponVisual, classId: this._chosenClass });
      refreshSwatches();
      hairRow.querySelectorAll('.cc-swatch').forEach((b, i) => b.classList.toggle('active', i === this._chosenHair));
      eyeRow.querySelectorAll('.cc-swatch').forEach((b, i) => b.classList.toggle('active', i === this._chosenEye));
    };

    TONES.forEach((_, i) => {
      const b = document.createElement('button');
      b.className = 'cc-swatch'; b.setAttribute('aria-label', 'Teint ' + (i + 1));
      b.onclick = () => { this._chosenTone = i; refreshPreview(); };
      skinRow.appendChild(b);
    });
    HAIRS.forEach((c, i) => { const b = document.createElement('button'); b.className = 'cc-swatch'; b.style.background = hex(c); b.setAttribute('aria-label', 'Cheveux ' + (i + 1)); b.onclick = () => { this._chosenHair = i; refreshPreview(); }; hairRow.appendChild(b); });
    EYES.forEach((c, i) => { const b = document.createElement('button'); b.className = 'cc-swatch'; b.style.background = hex(c); b.setAttribute('aria-label', 'Yeux ' + (i + 1)); b.onclick = () => { this._chosenEye = i; refreshPreview(); }; eyeRow.appendChild(b); });
    for (const r of Object.values(RACES)) {
      const b = document.createElement('button'); b.dataset.id = r.id;
      b.className = r.id === this._chosenRace ? 'chip active' : 'chip';
      b.innerHTML = `<i class="chip-dot" style="background:${hex(r.skin)}"></i>${r.name}`;
      b.onclick = () => { this._chosenRace = r.id; raceGrid.querySelectorAll('.chip').forEach((x) => x.classList.remove('active')); b.classList.add('active'); refreshPreview(); };
      raceGrid.appendChild(b);
    }
    const descEl = this.root.querySelector('#cc-desc');
    for (const c of Object.values(CLASSES)) {
      const b = document.createElement('button'); b.dataset.id = c.id;
      const ui = CLASS_UI[c.id] || ['✨', ''];
      b.className = c.id === this._chosenClass ? 'chip class-card active' : 'chip class-card';
      b.innerHTML = `<span class="cc-ic">${ui[0]}</span><b>${c.name}</b><small>${ui[1]}</small>`;
      b.onclick = () => { this._chosenClass = c.id; classGrid.querySelectorAll('.chip').forEach((x) => x.classList.remove('active')); b.classList.add('active'); descEl.textContent = c.desc; refreshPreview(); };
      classGrid.appendChild(b);
    }
    descEl.textContent = CLASSES.warrior.desc;
    refreshPreview();
    this.root.querySelector('#cc-start').onclick = () => {
      const skin = currentSkin();
      if (this._charPreview) { this._charPreview.dispose(); this._charPreview = null; }
      this._slot = this.net.loggedIn ? (this._pendingSlot ?? 0) : 0;
      this._startGame({ classId: this._chosenClass, name: this.root.querySelector('#cc-name').value.trim() || 'Aventurier', skin, hairCol: HAIRS[this._chosenHair], eyeCol: EYES[this._chosenEye], ...(this.net.loggedIn ? { bank: this._serverBank || [] } : {}) });
    };
  }

  _startGame(save) {
    try {
      this._startGameInner(save);
    } catch (err) {
      console.error('Erreur au démarrage de la partie :', err);
      alert('Erreur au démarrage de la partie :\n' + (err?.message || err) + '\n\nMerci de signaler ce message exact.');
    }
  }

  _startGameInner(save) {
    this.player = new Player(this.scene, this.world, this.audio, this.particles, this.bus, save);
    setLootClass(this.player.classId);
    // V8.0 : le continent a été redessiné — une ancienne sauvegarde posée en mer ou hors terre ferme repart de Korvalune
    try {
      const pp = this.player.pos;
      if (save?.pos && (!isLand(pp.x, pp.z) || this.world.heightAt(pp.x, pp.z) < this.world.waterLevel + 0.3)) {
        pp.set(0, this.world.heightAt(0, 12) + 0.5, 12);
        this.hud.notify('Le continent a été redessiné : vous reprenez votre aventure à Korvalune.', 'info');
      }
    } catch (e) { /* ignoré */ }
    netShare.localPlayer = this.player;
    this._secondaryQuests = this._secondaryQuests || generateSecondaryQuests();
    this.quests = new QuestManager(this.bus, save, [...TUTORIAL_QUESTS, ...MAIN_QUESTS, ...this._secondaryQuests]);
    this.inventory = new Inventory(this.bus, 30, save?.inventory);
    this.equipment = new Equipment(this.bus, this.player, save?.equipment);
    this.bank = new Inventory(this.bus, 120 + 30 * Math.min(LUNES.maxBankTabs, this._shop?.bankTabs || 0), save?.bank);
    this.player.setCosmetics(this._shopCos());
    this.bankPage = 0;
    this.rift = this.riftStatue ? new RiftSystem(this, save?.rift) : null;
    if (!save || !Array.isArray(save.inventory)) { // nouveau personnage (la création passe un objet sans inventaire)
      const cls = CLASSES[this.player.classId] || CLASSES.warrior;
      // V4.0 : on démarre avec la seule arme de classe, équipée. Le reste s'obtient en jouant (tutoriel, butin, marchands).
      this.inventory.add(cls.startWeapon, 1);
      this.equipment.equipFromInventory(this.inventory, this.inventory.slots.findIndex((s) => s?.defId === cls.startWeapon));
    }
    this.ach.load(this.player.name, this.player.level);
    this.caravan = new CaravanEvent(this);
    this.worldChests = new WorldChests(this.scene, this.world, new Set(Array.isArray(save?.chests) ? save.chests : []));
    for (const gi of Array.isArray(save?.ground) ? save.ground.slice(0, 40) : []) {
      if (gi && Number.isFinite(gi.x) && Number.isFinite(gi.z) && gi.item && (gi.item.gen || getItem(gi.item.defId))) this._spawnGroundItem(gi.item, gi.x, gi.z, true);
    }
    this.player.refreshGearVisuals(this.equipment);
    this.cameraRig = new CameraRig(this.camera, this.world, this.settings.cameraMode);
    this.cameraRig.locked = this.settings.cameraLock;
    this._applyCamRotate();
    this._applyCameraMode();
    this.touch = new TouchControls(this.root, this.input, this.bus);
    this.touch.onLayout = (layout) => { this.settings.touch.layout = layout; this._persistSettings(); };
    this._applyExtra();
    this.hud.buildSkillbar(this.player.skillBar);
    this._updatePotionBadges();
    this.hud.renderQuests(this.quests);
    this.hud.initChat((channel, text) => this._handleChatSend(channel, text));
    this.combat.setContext(this.player, this.enemies, this.bosses);
    this.hud.showScreen('game-ui');
    this.audio.resume();
    this.audio.setVolume(this.settings.volume / 100);
    this.audio.setMix({ music: this.settings.musicVol / 100, sfx: this.settings.sfxVol / 100 });
    this.audio.startMusic();
    this._camQuat = new THREE.Quaternion();
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this.net.joinWorld({
      name: this.player.name, classId: this.player.classId, level: this.player.level,
      pos: [this.player.pos.x, this.player.pos.y, this.player.pos.z], yaw: this.player.yaw,
      hp: this.player.hp, maxHp: this.player.maxHp
    });
    this._autoSaveAcc = 0;
    this._running = true;
    this._loop();
    setTimeout(() => this._warmup(), 600);
  }

  // V7.4 : compile les shaders des effets et du butin dès le chargement (aucun à-coup en plein combat)
  _warmup() {
    try {
      const fx = this.fx, parked = [];
      if (fx) for (const pool of [fx.slashes, fx.wideSlashes, fx.rings, fx.runes, fx.flashes, fx.pillars, fx.beams]) {
        for (const o of pool || []) if (!o.userData.busy) { o.visible = true; o.traverse((c) => { c.frustumCulled = false; }); const y = o.position.y; o.position.y = -500; parked.push([o, y]); }
      }
      warmupLoot(this.renderer, this.scene, this.camera, this.settings.quality);
      for (const [o, y] of parked) { o.visible = false; o.position.y = y; }
    } catch (e) { /* facultatif */ }
  }

  _handleChatSend(channel, text) {
    if (text.startsWith('/')) {
      const [cmd, ...rest] = text.slice(1).split(' ');
      const arg = rest.join(' ').trim();
      switch (cmd.toLowerCase()) {
        case 'help':
          this.hud.appendChat({ channel: 'general', system: true, text: 'Commandes : /help /who /invite <nom> /group [accept|leave] /friend add <compte> /whisper <nom> <message> — ou le bouton 👥' });
          break;
        case 'who':
          this.net.requestWho();
          break;
        case 'friend':
        case 'ami': {
          const [sub, ...r2] = rest; const nm = r2.join(' ').trim();
          if (sub === 'add' && nm) this.net.friendAdd(nm);
          else if (sub === 'remove' && nm) this.net.friendRemove(nm);
          else if (sub === 'accept' && nm) this.net.friendAccept(nm);
          else this._openSocial();
          break;
        }
        case 'invite':
          if (arg) this.net.inviteToGroup(arg);
          else this.hud.appendChat({ channel: 'general', system: true, text: 'Usage : /invite <nom>' });
          break;
        case 'group':
          if (arg === 'accept') this.net.acceptGroupInvite();
          else if (arg === 'leave') this.net.leaveGroup();
          else {
            const names = this.group.filter((m) => m.id !== this.net.id).map((m) => `${m.name} (Nv.${m.level})`);
            this.hud.appendChat({ channel: 'general', system: true, text: names.length ? `Groupe : ${names.join(', ')}` : "Tu n'es dans aucun groupe. /invite <nom>, ou /group accept après une invitation." });
          }
          break;
        case 'whisper':
        case 'w': {
          const [to, ...msgParts] = rest;
          const msg = msgParts.join(' ').trim();
          if (to && msg) this.net.sendWhisper(to, msg);
          else this.hud.appendChat({ channel: 'general', system: true, text: 'Usage : /whisper <nom> <message>' });
          break;
        }
        default:
          this.hud.appendChat({ channel: 'general', system: true, text: `Commande inconnue : /${cmd} (tape /help)` });
      }
      return;
    }
    if (!this.net.connected) {
      this.hud.appendChat({ channel: 'general', system: true, text: 'Mode solo : le chat nécessite le serveur multijoueur (voir le README).' });
      return;
    }
    this.net.sendChat(channel, text);
  }

  _openInventory() {
    this._tut('inventory');
    document.exitPointerLock?.();
    this.modalOpen = true;
    this.hud.showScreen('inventory-screen');
    this.hud.renderInventory(this.inventory, this.equipment, this.player, (action, index) => this._onItemAction(action, index));
  }

  _openCharacter() {
    this._tut('character');
    document.exitPointerLock?.();
    this.modalOpen = true;
    this.hud.showScreen('character-screen');
    const refresh = () => this.hud.renderCharacter(this.player, this.equipment, onUnequip, onSpend);
    const onUnequip = (slotName) => {
      this.equipment.unequip(slotName, this.inventory);
      this.player.refreshGearVisuals(this.equipment);
      refresh();
      this.hud.renderInventory(this.inventory, this.equipment, this.player, (a, i) => this._onItemAction(a, i));
    };
    const onSpend = (statKey) => {
      if (this.player.spendStatPoint(statKey)) { this.audio.play('click'); refresh(); }
    };
    refresh();
  }

  _openSkills() {
    this._tut('skills');
    document.exitPointerLock?.();
    this.modalOpen = true;
    this.hud.showScreen('skills-screen');
    const refresh = () => this.hud.renderSkills(this.player, onToggleBarSlot, onToggleSkill);
    const onToggleBarSlot = (index) => {
      this.player.setBarSlot(index, null);
      this.hud.buildSkillbar(this.player.skillBar);
      this.audio.play('click');
      refresh();
    };
    const onToggleSkill = (skillId) => {
      const bar = this.player.skillBar;
      if (bar.includes(skillId)) {
        this.player.setBarSlot(bar.indexOf(skillId), null);
      } else {
        const empty = bar.indexOf(null);
        if (empty === -1) { this.hud.notify('Barre de compétences pleine — retirez-en une d\'abord.', 'boss'); return; }
        this.player.setBarSlot(empty, skillId);
      }
      this.hud.buildSkillbar(this.player.skillBar);
      this.audio.play('click');
      refresh();
    };
    refresh();
  }

  _riftLabel(i) { const n = { ascent: 'Spire', zenith: 'Zénith', trial: 'Entraînement' }[i.modeId] || 'Spire'; return `${n} · niveau ${i.level}`; }

  // Un membre du groupe est entré dans une spire : on propose de le rejoindre (même graine = même spire, mêmes monstres)
  onGroupRift(fromId, info) {
    if (!info || !Number.isFinite(info.seed) || !['ascent', 'zenith', 'trial'].includes(info.modeId)) return;
    const from = this.group.find((m) => m.id === fromId)?.name || 'Un membre du groupe';
    this._groupRift = { seed: info.seed | 0, modeId: info.modeId, level: Math.max(1, Math.min(200, info.level | 0)), from, t: Date.now() };
    if (this.rift?.active || !this.player || this.player.dead) return;
    this.hud.notify(`🌀 ${from} est entré dans une spire !`, 'quest');
    this.hud.showInvite(from, () => this._joinGroupRift(), () => {}, `est dans une spire (${this._riftLabel(this._groupRift)}). Le rejoindre ?`);
  }

  _joinGroupRift() {
    const r = this._groupRift;
    if (!r || !this.rift || this.rift.active || !this.player || this.player.dead) return;
    if (this.rift.pending) { this.hud.notify('Referme d\'abord ta propre faille ouverte (statue), puis rejoins ton groupe.', 'info'); return; }
    this.rift._viaGroup = true;
    this.rift.pending = { modeId: r.modeId, level: r.level, seed: r.seed, keyUsed: false };
    this.rift.enter();
  }

  // ---------- V10.1 : boutique des Lunes ----------
  // cosmétiques réellement équipés (serveur) + aperçu temporaire éventuel
  _shopCos() {
    const cos = { ...(this._shop?.eq || {}) };
    if (this._preview) cos[this._preview.slot] = this._preview.id;
    return cos;
  }

  _growBank() { // onglets de coffre achetés : le coffre grandit sans rien perdre
    const n = 120 + 30 * Math.min(LUNES.maxBankTabs, this._shop?.bankTabs || 0);
    if (this.bank && this.bank.size < n) { while (this.bank.slots.length < n) this.bank.slots.push(null); this.bank.size = n; }
  }

  // from : écran de départ ('main-menu' | 'pause-menu' | undefined = en jeu via le bouton 🌙)
  _openLune(from) {
    if (from === 'main-menu') { // depuis le menu principal : pas de personnage en jeu, donc pas d'aperçu « Essayer »
      if (!this.net.loggedIn) { this.hud.notify('Connecte-toi à ton compte (menu Compte) pour utiliser la boutique des Lunes.', 'info'); return; }
      this._luneReturn = 'main-menu';
    } else {
      if (from === 'pause-menu') this.setPaused(false);
      if (!this.player || this.dialogueOpen || this.modalOpen) return;
      if (!this.net.loggedIn) { this.hud.notify('Connecte-toi à ton compte pour utiliser la boutique des Lunes.', 'info'); return; }
      this._luneReturn = null;
      document.exitPointerLock?.();
      this.modalOpen = true;
    }
    this._luneTab = this._luneTab || 'aura';
    this._luneMsg = null;
    this.hud.showScreen('lune-screen');
    this._renderLune();
    this.net.shopGet();
  }

  _closeLune() {
    if (this._preview) { this._preview = null; this.player?.setCosmetics(this._shopCos()); }
    if (this._luneReturn) { const r = this._luneReturn; this._luneReturn = null; this.hud.showScreen(r); return; }
    this._closeModal();
  }

  _renderLune() {
    if (this.hud.q('#lune-screen').classList.contains('hidden')) return;
    this.hud.renderLune({ shop: this._shop, tab: this._luneTab || 'aura', preview: this._preview, msg: this._luneMsg, consent: !!this._luneConsent, canTry: !!this.player && !this._luneReturn });
  }

  _openSocial() {
    if (!this.player || this.dialogueOpen || this.modalOpen) return;
    if (!this.net.loggedIn && this._onlineHost) { this.hud.notify('Connecte-toi à ton compte pour utiliser les amis.', 'info'); return; }
    document.exitPointerLock?.();
    this.modalOpen = true;
    this.hud.showScreen('social-screen');
    this._renderSocial();
    this.net.friendList();
  }

  _renderSocial() {
    if (this.hud.q('#social-screen').classList.contains('hidden')) return;
    const f = this._friends || { friends: [], requests: [] };
    const inGroup = new Set(this.group.map((m) => m.id));
    const players = [...this.remotePlayers.values()].filter((p) => !inGroup.has(p.id)).slice(0, 20).map((p) => ({ id: p.id, name: p.name, level: p.level }));
    const gr = this._groupRift && Date.now() - this._groupRift.t < 15 * 60 * 1000 && !this.rift?.active ? { from: this._groupRift.from, label: this._riftLabel(this._groupRift) } : null;
    this.hud.renderSocial({ rift: gr, meId: this.net.id, leaderId: this.gw.leaderId, group: this.group.length > 1 ? this.group : [], friends: f.friends, requests: f.requests, players });
  }

  _openAchievements() {
    if (!this.player || this.dialogueOpen || this.modalOpen) return;
    document.exitPointerLock?.();
    this.modalOpen = true;
    this.hud.showScreen('ach-screen');
    this.hud.renderAchievements(this.ach.list());
  }

  _openQuestBoard() {
    document.exitPointerLock?.();
    this.modalOpen = true;
    this.hud.showScreen('quests-screen');
    const unlocked = WORLD_TIERS.filter((t) => this.player.level >= t.unlockLevel);
    if (!this._questBoardTier || !unlocked.some((t) => t.id === this._questBoardTier)) this._questBoardTier = unlocked[unlocked.length - 1]?.id || 1;
    const refresh = () => {
      this.hud.renderQuestBoard(
        WORLD_TIERS, this.player.level, this._questBoardTier, this.quests.secondaryQuestsForTier(this._questBoardTier), this.quests,
        this.quests.activeSecondaryCount(), MAX_ACTIVE_SECONDARY_QUESTS,
        (tierId) => { this._questBoardTier = tierId; refresh(); },
        (id) => {
          if (this.quests.activeSecondaryCount() >= MAX_ACTIVE_SECONDARY_QUESTS) {
            this.hud.notify(`Vous ne pouvez pas suivre plus de ${MAX_ACTIVE_SECONDARY_QUESTS} contrats à la fois.`, 'boss');
            return;
          }
          this.quests.start(id);
          this.audio.play('click');
          refresh();
        }
      );
    };
    refresh();
  }

  _openBank() {
    this._tut('bank');
    document.exitPointerLock?.();
    this.modalOpen = true;
    this.hud.showScreen('bank-screen');
    const PAGE_SIZE = 30, PAGE_COUNT = this.bank.size / PAGE_SIZE;
    const refresh = () => this.hud.renderBank(this.bank, this.inventory, this.bankPage, PAGE_COUNT, onTransfer, this.equipment);
    this._bankRefresh = refresh;
    const onTransfer = (source, index) => {
      const [from, to] = source === 'bank' ? [this.bank, this.inventory] : [this.inventory, this.bank];
      const slot = from.slots[index];
      if (!slot) return;
      // Les objets générés (équipement aléatoire) portent leurs données dans `gen` : ils doivent être
      // déplacés tels quels (avant, seul `defId` était recopié et l'objet disparaissait).
      if (slot.gen) {
        const idx = to.firstEmpty();
        if (idx === -1) { this.hud.notify(source === 'bank' ? 'Inventaire plein !' : 'Le coffre est plein.', 'boss'); return; }
        from.takeWhole(index);
        to.placeAt(idx, { instanceId: slot.instanceId, gen: slot.gen, qty: 1 });
      } else {
        const taken = from.takeWhole(index);
        const leftover = to.add(taken.defId, taken.qty);
        if (leftover === false || leftover > 0) {
          const back = leftover === false ? taken.qty : leftover;
          if (back < taken.qty) this.hud.notify('Pas assez de place pour tout transférer.', 'boss');
          else this.hud.notify(source === 'bank' ? 'Inventaire plein !' : 'Le coffre est plein.', 'boss');
          from.placeAt(index, { instanceId: taken.instanceId, defId: taken.defId, qty: back });
        }
      }
      this.audio.play('click');
      refresh();
    };
    this.root.querySelector('#bank-prev').onclick = () => { this.bankPage = (this.bankPage - 1 + PAGE_COUNT) % PAGE_COUNT; refresh(); };
    this.root.querySelector('#bank-next').onclick = () => { this.bankPage = (this.bankPage + 1) % PAGE_COUNT; refresh(); };
    refresh();
  }

  _closeModal(returnTo = 'game-ui') {
    this.modalOpen = false;
    this.hud.showScreen(returnTo);
  }

  _onItemAction(action, index) {
    const slot = this.inventory.slots[index];
    if (!slot) return;
    const view = resolveItem(slot);
    if (action === 'equip') {
      if (this.equipment.equipFromInventory(this.inventory, index)) this._tut('equip');
      this.player.refreshGearVisuals(this.equipment);
      this.audio.play('equip');
    } else if (action === 'use') {
      if (!slot.gen && this.player.useConsumable(getItem(slot.defId))) { this.inventory.removeAt(index, 1); this._tut('use'); }
    } else if (action === 'sell') {
      this.player.addCoins(view.value || 0);
      this.audio.play('coin');
      this.inventory.removeAt(index, slot.qty);
    } else if (action === 'drop') {
      this._dropToGround(slot, index);
    }
    this.hud.renderInventory(this.inventory, this.equipment, this.player, (a, i) => this._onItemAction(a, i));
  }

  // V4.0 : raccourcis potions (boutons 🧪 / 🔷 et touches V / B). Choisit la meilleure potion adaptée.
  _quickPotion(kind) {
    const p = this.player;
    if (!p || p.dead || this.paused || this.dialogueOpen || this.modalOpen) return;
    const now = performance.now();
    if (now < (this._potionCdUntil || 0)) return;
    const list = [];
    this.inventory.slots.forEach((sl, i) => {
      if (!sl || sl.gen) return;
      const st = getItem(sl.defId)?.stats || {};
      if (kind === 'heal' && st.healPct) list.push({ i, v: st.healPct });
      if (kind === 'mana' && st.manaPct) list.push({ i, v: st.manaPct });
    });
    const label = kind === 'heal' ? 'de vie' : 'de mana';
    if (!list.length) { this.hud.notify(`Plus de potion ${label} !`, 'boss'); this.audio.play('error'); return; }
    const missing = kind === 'heal' ? 1 - p.hp / p.maxHp : 1 - p.mana / p.maxMana;
    if (missing < 0.04) { this.hud.notify(kind === 'heal' ? 'Vos PV sont déjà au maximum.' : 'Votre mana est déjà au maximum.', 'info'); return; }
    list.sort((a, b) => a.v - b.v);
    // la plus petite qui suffit à peu près, sinon la plus grosse
    const pick = list.find((x) => x.v >= missing * 0.9) || list[list.length - 1];
    const slot = this.inventory.slots[pick.i];
    if (p.useConsumable(getItem(slot.defId))) {
      this.inventory.removeAt(pick.i, 1);
      this._potionCdUntil = now + 900;
      this.audio.play('potion');
      this._potionFx(kind);
      this._tut('use');
      this._updatePotionBadges();
    }
  }

  // V4.4 : petit effet de gorgée (vie = vert, mana = bleu)
  _potionFx(kind) {
    const p = this.player; if (!p) return;
    this.particles?.emit(p.pos.x, p.pos.y + 0.9, p.pos.z, { count: 20, color: kind === 'heal' ? 0x6dffb0 : 0x6aa8ff, speed: 2.4, life: 0.7, up: 2.4 });
    try { this.fx?.flash?.(p.pos.x, p.pos.y + 1, p.pos.z, kind === 'heal' ? 0x6dffb0 : 0x6aa8ff, 2.2, 0.35); } catch (e) { /* ignore */ }
  }

  // V4.4 : alerte de vie basse (vignette rouge pulsée + battements de cœur)
  _lowHpFx(dt) {
    const p = this.player; if (!p) { if (this._lowHp) { this._lowHp = false; this.root.classList.remove('lowhp'); } return; }
    const low = !p.dead && p.hp / p.maxHp < 0.3;
    if (low !== this._lowHp) { this._lowHp = low; this.audio.setMuffle(low ? 0.55 : 0); this.root.classList.toggle('lowhp', low && this.settings.vignette !== false); }
    if (low) {
      this._hbT = (this._hbT || 0) - dt;
      if (this._hbT <= 0) { this._hbT = 0.4 + 1.1 * (p.hp / p.maxHp) / 0.3; this.audio.play('heartbeat'); }
    }
  }

  _updatePotionBadges() {
    if (!this.inventory || !this.hud) return;
    let h = 0, m = 0;
    for (const sl of this.inventory.slots) {
      if (!sl || sl.gen) continue;
      const st = getItem(sl.defId)?.stats || {};
      if (st.healPct) h += sl.qty; if (st.manaPct) m += sl.qty;
    }
    const set = (id, n) => { const b = this.hud.q(id); if (b) { b.querySelector('.pq-n').textContent = n; b.classList.toggle('empty', n === 0); } };
    set('#pq-heal', h); set('#pq-mana', m);
  }

  _refreshEquipPanels() {
    if (!this.equipment || !this.hud) return;
    if (!this.hud.q('#bank-screen').classList.contains('hidden')) {
      this._bankRefresh && this._bankRefresh();
    }
    if (!this.hud.q('#inventory-screen').classList.contains('hidden')) this.hud.renderInventory(this.inventory, this.equipment, this.player, (a, i) => this._onItemAction(a, i));
  }

  // V4.0 : « Jeter » pose réellement l'objet par terre, devant le joueur ; on le ramasse avec E.
  _dropToGround(slot, index) {
    const p = this.player;
    const item = slot.gen ? { gen: slot.gen } : { defId: slot.defId, qty: slot.qty };
    const x = p.pos.x + Math.sin(p.yaw) * 1.3, z = p.pos.z + Math.cos(p.yaw) * 1.3;
    this.inventory.removeAt(index, slot.qty);
    this._spawnGroundItem(item, x, z, true);
    const view = resolveItem(item);
    this.hud.notify(`Objet jeté : ${view.icon} ${view.name}${item.qty > 1 ? ' x' + item.qty : ''}`, 'info');
    this.audio.play('click');
    this._tut('drop');
  }

  // Pose un objet au sol. keep = objet du joueur : jamais supprimé par la limite de butin, sauvegardé.
  _spawnGroundItem(item, x, z, keep = false) {
    const pos = new THREE.Vector3(x, this.world.heightAt(x, z), z);
    const MAX = 40;
    if (this.lootDrops.length >= MAX) {
      const i = this.lootDrops.findIndex((d) => !d.keep);
      if (i !== -1) this.lootDrops.splice(i, 1)[0].dispose(this.scene);
    }
    const ld = new LootDrop(this.scene, pos, item, this.settings.quality);
    ld.keep = keep;
    if (!keep) { // annonce des belles trouvailles : légendaire (13+) et au-delà
      try {
        const v = resolveItem(item), t = v.rarityInfo.tier;
        if (t >= 13) {
          this.hud.notify(`${t >= 19 ? '🌟' : '✨'} ${v.rarityInfo.name} : ${v.icon} ${v.name} !`, t >= 19 ? 'boss' : 'quest');
          this.audio.play(t >= 25 ? 'absolute' : 'legendary');
          this.particles.emit(pos.x, pos.y + 0.6, pos.z, { count: t >= 19 ? 40 : 26, color: parseInt(v.rarityInfo.color.slice(1), 16), speed: 3.2, life: 0.9, up: 4 });
        }
      } catch (e) { /* annonce facultative */ }
    }
    this.lootDrops.push(ld);
    return ld;
  }

  // V4.0 : détection des étapes de tutoriel qui n'ont pas de point d'accroche dédié (marcher, caméra, saut)
  _tutTick(look, wheel) {
    const st = this.quests.tutorialStep();
    if (!st || st.type !== 'event') return;
    const p = this.player;
    if (st.target === 'move') {
      if (!this._tutP0) this._tutP0 = p.pos.clone();
      if (p.pos.distanceTo(this._tutP0) > 6) this._tut('move');
    } else if (st.target === 'camera') {
      this._tutCam = (this._tutCam || 0) + Math.abs(look.dx) + Math.abs(look.dy) + Math.abs(wheel) * 0.3;
      if (this._tutCam > 120) this._tut('camera');
    }
  }

  _tut(name) { this.bus.emit('tut', name); }

  _useSkill(id) {
    if (!id || !this.player || this.paused || this.dialogueOpen || this.modalOpen) return;
    this.player.tryUseSkill(id);
    this._tut('skill');
  }

  setPaused(v) {
    this.paused = v;
    if (v) document.exitPointerLock?.();
    this.hud.showScreen(v ? 'pause-menu' : 'game-ui');
    if (v && this.player) {
      const cost = this._teleportCost();
      const btn = this.root.querySelector('#btn-teleport');
      if (this.rift?.active) { btn.innerHTML = 'Quitter la spire'; btn.disabled = false; }
      else {
        btn.innerHTML = `Téléportation vers Korvalune — <span id="teleport-cost">${cost}</span> 🪙`;
        btn.disabled = cost === 0 || this.player.coins < cost;
      }
    }
  }

  _teleportCost() {
    const spawn = this.world.spots.spawn || new THREE.Vector3(0, 0, 12);
    const dist = this.player.pos.distanceTo(spawn);
    if (dist < 15) return 0; // déjà en ville, pas besoin de payer
    return Math.min(300, Math.max(20, Math.round(dist * 0.8)));
  }

  _teleportToTown() {
    if (this.rift?.active) { this.setPaused(false); this.rift.requestExit(); return; }
    const cost = this._teleportCost();
    if (cost > 0) {
      if (this.player.coins < cost) { this.hud.notify('Pas assez d\'or pour se téléporter.', 'boss'); return; }
      this.player.addCoins(-cost);
    }
    this.player.pos.copy(this.world.spots.spawn || new THREE.Vector3(0, 0, 12));
    this.player.vel.set(0, 0, 0);
    this.particles.emit(this.player.pos.x, this.player.pos.y + 1, this.player.pos.z, { count: 50, color: 0x8fd0ff, speed: 5, life: 0.9, up: 2.5 });
    this.audio.play('portal');
    this.hud.notify(cost > 0 ? `Téléporté vers Korvalune (-${cost} 🪙)` : 'Déjà en ville.', 'info');
    this.setPaused(false);
  }

  // V8.1 — 10 portails gratuits au « quartier des portails » : un par région, aucun niveau requis.
  // V8.8 — collisions entre corps : on ne traverse plus les monstres ni les PNJ, et les monstres ne s'empilent plus les uns sur les autres.
  _separateBodies() {
    const P = this.player;
    if (!P || P.dead || P.dash || (P.action === 'roll')) return; // la roulade et la ruée passent à travers
    const px = P.pos.x, pz = P.pos.z, host = this.gw?.isHost;
    const near = [];
    const add = (e, r) => { if (near.length < 28) near.push({ e, r }); };
    for (const e of this.enemies) {
      if (!e.alive || e === this.lootSprite) continue;
      const dx = e.pos.x - px, dz = e.pos.z - pz;
      if (dx * dx + dz * dz < 144) add(e, Math.max(0.4, 0.45 * (e.rig?.root?.scale?.x || 1)));
    }
    for (const b of this.bosses || []) {
      if (!b.alive || b.state === 'dormant') continue;
      const dx = b.pos.x - px, dz = b.pos.z - pz;
      if (dx * dx + dz * dz < 400) add(b, 1.3);
    }
    const push = (a, ra, b, rb, wa, wb) => { // a, b : objets {pos} ; wa/wb : part du déplacement
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, m = ra + rb, d2 = dx * dx + dz * dz;
      if (d2 >= m * m) return;
      const d = Math.sqrt(d2) || 1e-4, o = m - d, nx = d < 1e-3 ? 1 : dx / d, nz = d < 1e-3 ? 0 : dz / d;
      a.pos.x -= nx * o * wa; a.pos.z -= nz * o * wa;
      b.pos.x += nx * o * wb; b.pos.z += nz * o * wb;
    };
    const movable = (e) => !e.netKey || host;
    for (const n of near) {
      const m = movable(n.e);
      push(P, 0.42, n.e, n.r, m ? 0.3 : 1, m ? 0.7 : 0);
    }
    for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
      const A = near[i], B = near[j], ma = movable(A.e), mb = movable(B.e);
      if (!ma && !mb) continue;
      push(A.e, A.r * 0.8, B.e, B.r * 0.8, ma ? (mb ? 0.5 : 1) : 0, mb ? (ma ? 0.5 : 1) : 0);
    }
    for (const npc of this.npcs || []) { // PNJ immobiles : seul le joueur est repoussé
      const dx = P.pos.x - npc.pos.x, dz = P.pos.z - npc.pos.z, m = 0.42 + 0.5;
      const d2 = dx * dx + dz * dz;
      if (d2 < m * m) { const d = Math.sqrt(d2) || 1e-4; P.pos.x = npc.pos.x + (dx / d) * m; P.pos.z = npc.pos.z + (dz / d) * m; }
    }
    // après toute poussée : on respecte les obstacles fixes et le terrain
    this.world.pushOut(P.pos, 0.45);
    for (const n of near) if (movable(n.e)) { this.world.pushOut(n.e.pos, n.r); n.e.pos.y = this.world.heightAt(n.e.pos.x, n.e.pos.z); }
    if (!this.world.terrainOk(P.pos.x, P.pos.z) && this._lastSafe) { P.pos.x = this._lastSafe.x; P.pos.z = this._lastSafe.z; }
  }

  _ensureOnLand() {
    const p = this.player.pos, w = this.world;
    if (p.x > 1500) return;
    if (w.terrainOk(p.x, p.z) && !w.blockedCircle(p.x, p.z, 0.2)) { (this._lastSafe || (this._lastSafe = new THREE.Vector3())).copy(p); return; }
    for (let r = 2; r <= 80; r += 2) {
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        if (isLand(x, z) && w.terrainOk(x, z) && w.heightAt(x, z) > w.waterLevel + 0.4 && !w.blockedCircle(x, z, 0.6)) {
          p.set(x, w.heightAt(x, z), z); this.player.vel.set(0, 0, 0);
          this.hud.notify('Vous avez été replacé sur la terre ferme.', 'info');
          return;
        }
      }
    }
    const f = this._lastSafe || w.spots.spawn || new THREE.Vector3(0, 0, 12);
    p.set(f.x, w.heightAt(f.x, f.z), f.z); this.player.vel.set(0, 0, 0);
    this.hud.notify('Vous avez été replacé dans un endroit sûr.', 'info');
  }

  _regionArrival(r) {
    let [sx, sz] = r.site;
    for (let k = 0; k < 40; k++) {
      for (let a = 0; a < 8; a++) {
        const x = sx + Math.cos(a * 0.785) * k * 6, z = sz + Math.sin(a * 0.785) * k * 6;
        if (isLand(x, z) && regionAt(x, z) === r && this.world.heightAt(x, z) > this.world.waterLevel + 0.6 && this.world.isWalkable(x, z, 1.2)) return [x, z];
      }
    }
    return [sx, sz];
  }

  _buildPortals() {
    this.portals = [];
    const portal = buildPortal(this.world, [0, -29.5], '#8fd0ff', 'Portail des régions', { noLight: true });
    try {
      const lb = makeLabel('Portail des régions', { color: '#8fd0ff', size: 38, width: 768, height: 96, scale: 4.2 });
      lb.position.set(0, 5.1, 0.2);
      portal.group.add(lb);
    } catch (e) { /* étiquette ignorée */ }
    this.portals.push(portal);
  }

  // V8.1 — un seul portail : menu de destination (gratuit, sans niveau requis) avec niveaux des monstres.
  _usePortal() { this._openPortalMenu(); }

  _openPortalMenu() {
    if (this._portalMenu) return;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(5,8,20,.82);display:flex;align-items:center;justify-content:center;padding:10px;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#12182c;border:1px solid #3a4a7a;border-radius:12px;max-width:460px;width:100%;max-height:92vh;overflow:auto;padding:12px;color:#fff;font-family:inherit;';
    box.innerHTML = '<div style="font-size:18px;font-weight:bold;margin-bottom:2px">Portail des régions</div><div style="opacity:.7;font-size:12px;margin-bottom:8px">Voyage gratuit — choisis ta destination.</div>';
    const close = () => { el.remove(); this._portalMenu = null; };
    for (const r of REGIONS) {
      const b = document.createElement('button');
      b.style.cssText = `display:flex;justify-content:space-between;align-items:center;width:100%;margin:4px 0;padding:11px 12px;border-radius:8px;border:1px solid ${r.color};background:rgba(255,255,255,.05);color:#fff;font-size:15px;text-align:left;cursor:pointer;`;
      b.innerHTML = `<span style="color:${r.color};font-weight:bold">${r.name}</span><span style="opacity:.85">niv. ${r.levels[0]}–${r.levels[1]}</span>`;
      b.addEventListener('click', () => { close(); this._teleportToRegion(r); });
      box.appendChild(b);
    }
    const c = document.createElement('button');
    c.textContent = 'Fermer';
    c.style.cssText = 'width:100%;margin-top:8px;padding:10px;border-radius:8px;border:1px solid #555;background:#222;color:#fff;font-size:15px;cursor:pointer;';
    c.addEventListener('click', close);
    box.appendChild(c);
    el.appendChild(box);
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
    document.body.appendChild(el);
    this._portalMenu = el;
  }

  _teleportToRegion(r) {
    const [x, z] = this._regionArrival(r);
    const dest = new THREE.Vector3(x, this.world.heightAt(x, z), z);
    this.player.pos.copy(dest);
    this.player.vel.set(0, 0, 0);
    this.particles.emit(dest.x, dest.y + 1, dest.z, { count: 60, color: parseInt(r.color.slice(1), 16), speed: 5.5, life: 1, up: 2.5 });
    this.audio.play('portal');
    this.hud.notify(`Vous entrez dans : ${r.name} (niv. ${r.levels[0]}–${r.levels[1]})`, 'quest');
  }

  // Mises à jour visuelles V2.5 (vent, herbe autour du joueur, effets, ombres blob, environnement)
  _updateVisualsV25(dt) {
    try {
      updateVisualUniforms(performance.now() * 0.001, this.player.pos);
      this.world.updateGrass(this.player.pos.x, this.player.pos.z);
      if (this.scene.environment) this.scene.environmentIntensity = 0.1 + 0.22 * (1 - this.dayNight.night);
      const p = this.player, rig = p.rig;
      // zoom léger à l'impact + élargissement du champ de vision en course (sensation de vitesse)
      this._runFov = (this._runFov || 0) + (((p.speed > 5.5 && !p.dead) ? 3.2 : 0) - (this._runFov || 0)) * Math.min(1, dt * 2.5);
      if (this._fovKick > 0.01) this._fovKick *= Math.pow(0.002, dt);
      else this._fovKick = 0;
      const fovK = this.cameraRig?.isIso ? 0.35 : 1;
      const wantFov = (this.cameraRig ? this.cameraRig.fov : CONFIG.camera.fov) + (this.settings.fovAdj || 0) + (this._runFov - 3.5 * this._fovKick) * fovK;
      if (Math.abs(wantFov - this.camera.fov) > 0.03) { this.camera.fov = wantFov; this.camera.updateProjectionMatrix(); }
      // traînée de l'arme pendant la frappe
      if (this.trail && this.fx?.enabled) {
        const ap = rig.attackPhase, kind = rig.weaponKind;
        const active = !p.dead && (p.action === 'attack' || p.action === 'attack2') && ap && ap.p > 0.1 && ap.p < 0.88 && kind !== 'bow' && !rig.glb;
        const tipObj = rig.tips && rig.tips[kind];
        if (tipObj && (active || this.trail.samples.length)) {
          const tp = this._tipV || (this._tipV = new THREE.Vector3()), bp = this._baseV || (this._baseV = new THREE.Vector3());
          tipObj.getWorldPosition(tp);
          tipObj.parent.getWorldPosition(bp);
          bp.lerp(tp, 0.35);
          this.trail.update(dt, active, tp, bp, skillColor(p.pendingSkill || { id: 'strike' }, p.classId));
        } else this.trail.update(dt, false);
      }
      // poussière de course, éclaboussures, atterrissage
      this._stepT = (this._stepT || 0) - dt;
      if (p.grounded && p.speed > 4.5 && this._stepT <= 0 && !p.dead) {
        this._stepT = 0.24;
        const wet = this.world.heightAt(p.pos.x, p.pos.z) < this.world.waterLevel + 0.15;
        this.particles.emit(p.pos.x - Math.sin(p.yaw) * 0.3, p.pos.y + 0.08, p.pos.z - Math.cos(p.yaw) * 0.3,
          wet ? { count: 5, color: 0xbfe6ff, speed: 2.2, life: 0.5, gravity: 9, spread: 0.5 } : { count: 3, color: 0x8a7a5c, speed: 0.9, life: 0.55, gravity: -0.4, up: 0.8, spread: 0.6 });
      }
      if (rig.landT > 0.97) this.particles.emit(p.pos.x, p.pos.y + 0.1, p.pos.z, { count: 10, color: 0x9a8a68, speed: 2.2, life: 0.6, gravity: 0.5, up: 0.4, spread: 1 });
      this.ambient?.update(performance.now() * 0.001, p.pos.x, p.pos.y, p.pos.z, this.dayNight.night);
      if (this.fx) {
        this.fx.update(dt);
        if (!this._q.shadows) {
          const list = this._blobList || (this._blobList = []);
          list.length = 0;
          list.push({ pos: this.player.pos, shadowRadius: 0.7 });
          const pp = this.player.pos;
          for (const e of this.enemies) if (e.alive && Math.abs(e.pos.x - pp.x) < 40 && Math.abs(e.pos.z - pp.z) < 40) list.push({ pos: e.pos, shadowRadius: 0.8 * (e.def?.model?.scale || 1) });
          for (const b of this.bosses) if (b.alive && b.state !== 'dormant') list.push({ pos: b.pos, shadowRadius: 1.8 });
          for (const n of this.npcs) if (Math.abs(n.pos.x - pp.x) < 30 && Math.abs(n.pos.z - pp.z) < 30) list.push({ pos: n.pos, shadowRadius: 0.7 });
          this.fx.updateBlobs(list, (x, z) => this.world.heightAt(x, z));
        } else this.fx.updateBlobs(null);
      }
    } catch (e) {
      if (!this._v25Err) { this._v25Err = true; console.warn('[V2.5] mise à jour visuelle désactivée', e); }
    }
  }

  // Applique le mode de caméra (aérienne / libre) : champ de vision, curseur, verrouillage.
  _applyCamRotate() {
    const v = this.settings.camRotate;
    if (this.cameraRig) this.cameraRig.rotate = v === 'on' ? true : v === 'off' ? false : null;
  }

  _applyCameraMode() {
    const r = this.cameraRig; if (!r) return;
    r.setMode(this.settings.cameraMode);
    this._applyCamRotate();
    this.input.pointerLock = !r.isIso;
    if (r.isIso) document.exitPointerLock?.();
    this.camera.fov = r.fov + (this.settings.fovAdj || 0); this.camera.updateProjectionMatrix();
    this._runFov = 0; this._fovKick = 0;
  }

  _openSettings() {
    this.hud.showScreen('settings-menu');
    if (!this.settingsUI) this.settingsUI = new SettingsUI(this.hud, this);
    this.settingsUI.open();
    this._renderDebugStats();
  }

  // « Z », « Z Q S D »… selon les touches choisies ; { k:skill1 } → « 1 »
  keyText(action) {
    const k = this.settings.keys[action];
    if (!k) return '';
    const l = keyLabel(k[0]);
    return l === '—' ? '(non assignée)' : l;
  }

  restartTutorial() {
    if (!this.quests) return;
    this._tutP0 = null; this._tutCam = 0;
    this.quests.restart(['tuto_1', 'tuto_2', 'tuto_3']);
    this.hud.renderQuests(this.quests);
    this.hud.notify('Tutoriel relancé : suivez le journal de quêtes.', 'quest');
  }

  // V4.3 : repères dorés « ! » sur la mini-carte (PNJ à voir, coffre, statue…) pour la quête de tutoriel et les remises de quête
  _questSpots() {
    const spots = [];
    const npcPos = (id) => { const n = this.npcs.find((x) => x.id === id || x.def?.id === id); return n ? n.pos : null; };
    for (const q of this.quests.active.values()) {
      const st = this.quests.currentStep(q);
      if (!st) continue;
      let p = null;
      if (st.type === 'talk') p = npcPos(st.target);
      else if (st.type === 'event') {
        if (st.target === 'bank') p = this.world.town?.bankPos;
        else if (st.target === 'rift') p = { x: STATUE_POS[0], z: STATUE_POS[1] };
        else if (st.target === 'shop') p = npcPos('armorsmith');
        else if (st.target === 'loot' && this.lootDrops.length) {
          let best = null, bd = 1e9;
          for (const d of this.lootDrops) { const dd = d.pos.distanceToSquared(this.player.pos); if (dd < bd) { bd = dd; best = d; } }
          p = best && best.pos;
        }
      }
      if (p) spots.push({ x: p.x, z: p.z });
    }
    if (this.caravan?.active) spots.push({ x: this.caravan.pos.x, z: this.caravan.pos.z });
    return spots;
  }

  skillKeyLabel(i) { return keyLabel(this.settings.keys['skill' + (i + 1)]?.[0]); }

  // Applique un réglage modifié depuis le menu Options (puis sauvegarde).
  applySettings(key) {
    const s = this.settings;
    if (key === 'quality') {
      s.shadows = !!CONFIG.quality[s.quality].shadows; this._applyQuality(s.quality);
      if (this.settingsUI) this.settingsUI.render();
    } else if (key === 'shadows') {
      this._q.shadows = !!s.shadows; this.renderer.shadowMap.enabled = this._q.shadows;
      this.dayNight?.setShadows(this._q.shadows, this._q.shadowMap);
    } else if (key === 'visualV25') this._applyVisualMode();
    else if (key === 'realLook') this._applyRealLook();
    else if (key === 'cameraMode') this._applyCameraMode();
    else if (key === 'camRotate') this._applyCamRotate();
    else if (key === 'cameraLock') { if (this.cameraRig) this.cameraRig.locked = s.cameraLock; }
    else if (key === 'adaptive') { if (!s.adaptive) this._resScale = 1; }
    this._applyExtra(key);
    this._persistSettings();
  }

  // Réglages « légers » : appliqués à chaque modification (idempotent).
  _applyExtra(key) {
    const s = this.settings;
    if (this.renderer && this._q) { this._curPR = 0; this._applyResolution(); }
    if (this.scene?.fog && this._q && !this.rift?.active) this.scene.fog.far = this._q.fogFar * (s.viewDist || 100) / 100;
    if (this.particles && this._q) this.particles.factor = this._q.particles * (s.particleScale ?? 100) / 100;
    if (this.renderer) this.renderer.toneMappingExposure = 0.95 * (s.exposure || 100) / 100;
    if (this.world && this._q) this.world.setGrassVisible(this._v25 && s.quality !== 'verylow' && s.grass !== false);
    if (this.camera && this.cameraRig && (key === 'fovAdj' || !this._v25)) { this.camera.fov = this.cameraRig.fov + (s.fovAdj || 0); this.camera.updateProjectionMatrix(); }
    const vg = this.root.querySelector('#v25-vignette'); if (vg) vg.style.display = s.vignette === false ? 'none' : '';
    this.root.classList.toggle('hide-quests', s.showQuests === false);
    this.root.classList.toggle('hide-minimap', s.showMinimap === false);
    this.root.classList.toggle('hide-hints', s.showHints === false);
    this._fpsEl = this._fpsEl || this.root.querySelector('#fps-counter');
    if (this._fpsEl) { this._fpsEl.classList.toggle('hidden', !s.showFps); if (s.showFps && this._fps) this._fpsEl.textContent = this._fps + ' FPS'; }
    // audio
    this.audio.setMuted(s.mute);
    this.audio.setVolume(s.volume / 100);
    this.audio.setMix({ music: s.musicVol / 100, sfx: s.sfxVol / 100, ui: s.uiVol / 100, ambience: s.ambVol / 100 });
    // entrées
    const o = this.input.opts;
    o.lookSens = (s.lookSens || 100) / 100; o.invertY = !!s.invertY; o.invertWheel = !!s.invertWheel; o.zoomSpeed = (s.zoomSpeed || 100) / 100; o.rotateBtn = s.rotateBtn === 'middle' ? 'middle' : 'right';
    if (key === 'keys' || !key) {
      this.input.setKeys(s.keys);
      if (this.player && key === 'keys') this.hud.buildSkillbar(this.player.skillBar);
    }
    if (this.touch) this.touch.apply(s.touch);
  }

  resetSettings() {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const layout = {};
    this.settings = { ...DEFAULTS, quality: coarse ? 'medium' : 'high', autoFullscreen: coarse, cameraLock: true, cameraMode: 'iso', visualV25: true, adaptive: true };
    this.settings.shadows = CONFIG.quality[this.settings.quality].shadows;
    this.settings.touch = { ...TOUCH_DEFAULTS, layout };
    this.settings.keys = defaultKeys();
    this._resScale = 1;
    this._applyQuality(this.settings.quality); this._applyVisualMode(); this._applyCameraMode();
    this._applyExtra('keys');
    this._persistSettings();
  }

  // ---- modification de la disposition tactile (en jeu) ----
  startTouchEdit() {
    if (!this.touch) return;
    this.hud.showScreen('game-ui');
    this.touch.startEdit();
    this.hud.q('#touch-edit-bar').classList.remove('hidden');
  }
  _endTouchEdit() {
    this.touch.stopEdit();
    this.hud.q('#touch-edit-bar').classList.add('hidden');
    this.hud.showScreen('settings-menu');
    this.settingsUI.open('touch');
  }

  _renderDebugStats() {
    const el = this.root.querySelector('#debug-stats');
    if (!el) return;
    if (!this.renderer) { el.textContent = ''; return; }
    const info = this.renderer.info;
    el.textContent = [
      `FPS: ${this._fps || '—'}`,
      `Draw calls: ${info.render.calls}`,
      `Triangles: ${info.render.triangles}`,
      `Géométries en mémoire: ${info.memory.geometries}`,
      `Textures en mémoire: ${info.memory.textures}`,
      this.enemies ? `Ennemis actifs: ${this.enemies.filter((e) => e.alive).length}/${this.enemies.length}` : ''
    ].filter(Boolean).join('\n');
  }
  _persistSettings() { SaveManager.saveSettings(this.settings); }

  // ---- Plein écran (V3.5) ----
  _isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  _enterFullscreen() {
    if (this._isFullscreen()) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) { this.hud.notify('Plein écran indisponible : menu ⋮ du navigateur → « Ajouter à l\'écran d\'accueil ».', 'boss'); return; }
    try {
      const p = req.call(el, { navigationUI: 'hide' });
      Promise.resolve(p).then(() => { try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) { /* ignore */ } }).catch(() => {});
    } catch (e) { /* refusé par le navigateur */ }
  }
  _toggleFullscreen() {
    if (this._isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    else this._enterFullscreen();
  }

  // Audio : position de l'auditeur, ambiance (lieu, nuit, météo) et musique de combat
  _updateAudio(dt) {
    const a = this.audio;
    if (!a.ctx || !this.player) return;
    this._audT = (this._audT || 0) + dt;
    if (this._audT < 0.05) return;
    this._audT = 0;
    if (!this._audFwd) { this._audFwd = new THREE.Vector3(); this._audEnvT = 0; }
    this.camera.getWorldDirection(this._audFwd);
    a.setListener(this.player.pos, this._audFwd);
    this._audEnvT += 0.05;
    const p = this.player.pos;
    // combat : un ennemi (ou un boss) en train de poursuivre / attaquer à moins de 24 m
    let fight = false;
    for (const e of this.enemies) {
      if (!e.alive || (e.state !== 1 && e.state !== 2)) continue;
      const dx = e.pos.x - p.x, dz = e.pos.z - p.z;
      if (dx * dx + dz * dz < 576) { fight = true; break; }
    }
    if (!fight && this.bosses) for (const b of this.bosses) { if (b.alive && b.state !== 'dormant' && b.pos.distanceTo(p) < 40) { fight = true; break; } }
    if (fight && !this.player.dead) a.setCombat(true);
    if (this._audEnvT >= 0.5) {
      this._audEnvT = 0;
      const w = this.weather, raining = w && (w.state === 'rain' || w.state === 'storm');
      const town = Math.abs(p.x) < 44 && Math.abs(p.z) < 44;
      a.setRoom(this.rift?.active || Math.hypot(p.x - DUNGEON_CENTER[0], p.z - DUNGEON_CENTER[1]) < 22 ? 'hall' : 'open');
      if (this.rift?.active) a.setEnvironment({ night: 1, town: false, rain: 0, snow: false, fountain: 0 });
      else a.setEnvironment({ night: this.dayNight.night, town, rain: raining ? w.intensity : 0, snow: !!w && w.state === 'snow' && w.intensity > 0.3, fountain: town ? Math.max(0, 1 - Math.hypot(p.x, p.z) / 38) : 0 });
    }
  }

  // V8.0 : « Lieu découvert » — les points d'intérêt s'inscrivent sur la carte quand on s'en approche
  _updatePoiDiscovery(dt) {
    this._poiAcc = (this._poiAcc || 0) + dt;
    if (this._poiAcc < 0.6 || !this.world.pois || !this.player) return;
    this._poiAcc = 0;
    if (!this._poiSeen) {
      this._poiSeen = new Set();
      try { for (const id of JSON.parse(localStorage.getItem('aetheria.pois') || '[]')) this._poiSeen.add(id); } catch (e) { /* ignoré */ }
    }
    const p = this.player.pos;
    for (const poi of this.world.pois) {
      if (this._poiSeen.has(poi.id) || Math.hypot(p.x - poi.x, p.z - poi.z) > 38) continue;
      this._poiSeen.add(poi.id);
      try { localStorage.setItem('aetheria.pois', JSON.stringify([...this._poiSeen])); } catch (e) { /* ignoré */ }
      this.hud.notify(`🧭 Lieu découvert : ${poi.name}`, 'quest');
      this.audio.play('quest');
    }
  }

  _zoneNameAt(x, z) {
    if (Math.hypot(x, z) < CONFIG.world.townRadius + 4) return 'Korvalune';
    if (!isLand(x, z)) return 'Haute mer';
    return regionAt(x, z).name;
  }

  // joueurs à afficher sur les cartes : membres du groupe (vert) + autres connectés (bleu clair)
  _mapPlayers() {
    const out = [];
    if (!this.remotePlayers.size) return out;
    const inGroup = new Set((this.group || []).map((m) => m.id));
    const room = this.gw.room | 0;
    for (const rp of this.remotePlayers.values()) {
      if ((rp.inst | 0) !== room) continue;
      out.push({ x: rp.pos.x, z: rp.pos.z, name: rp.name, level: rp.level, group: inGroup.has(rp.id) });
    }
    return out;
  }

  _openWorldMap() {
    this._tut('map');
    if (this.rift?.active) { this.hud.notify('La carte du monde est indisponible dans une spire.', 'info'); return; }
    this.hud.showScreen('worldmap-screen');
    const c = this.root.querySelector('#worldmap-canvas'), g = c.getContext('2d');
    const W = c.width, size = CONFIG.world.size;
    const toX = (wx) => (wx / size + 0.5) * W, toY = (wz) => (wz / size + 0.5) * c.height;
    g.clearRect(0, 0, W, c.height);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.world.mapCanvas, 0, 0, W, c.height);
    // voile sombre sur les bords
    const vg = g.createRadialGradient(W / 2, W / 2, W * 0.35, W / 2, W / 2, W * 0.75);
    vg.addColorStop(0, 'rgba(6,10,20,0)'); vg.addColorStop(1, 'rgba(6,10,20,0.22)');
    g.fillStyle = vg; g.fillRect(0, 0, W, c.height);
    // quadrillage discret
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < 8; i++) { g.moveTo((W / 8) * i, 0); g.lineTo((W / 8) * i, c.height); g.moveTo(0, (c.height / 8) * i); g.lineTo(W, (c.height / 8) * i); }
    g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // régions du continent : nom + tranche de niveaux
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const r of REGIONS) {
      const x = toX(r.site[0]), y = toY(r.site[1]);
      g.font = 'bold 13px sans-serif';
      const nm = r.name, lv = `niv. ${r.levels[0]}–${r.levels[1]}`;
      const w = Math.max(g.measureText(nm).width, 60) + 14;
      g.fillStyle = 'rgba(8,12,24,0.72)'; g.fillRect(x - w / 2, y - 15, w, 30);
      g.fillStyle = r.color; g.fillText(nm, x, y - 5);
      g.font = '11px sans-serif'; g.fillStyle = 'rgba(255,248,220,0.9)'; g.fillText(lv, x, y + 8);
    }
    // lieux remarquables : losange (nom une fois découvert)
    g.font = '11px sans-serif';
    const seen = this._poiSeen || (this._poiSeen = new Set());
    for (const p of this.world.pois || []) {
      const x = toX(p.x), y = toY(p.z), known = seen.has(p.id);
      g.fillStyle = known ? '#f2cf6e' : 'rgba(242,207,110,0.45)'; g.strokeStyle = '#0a1020'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 4, y); g.lineTo(x, y + 5); g.lineTo(x - 4, y); g.closePath(); g.fill(); g.stroke();
      if (known) { g.fillStyle = 'rgba(255,248,220,0.95)'; g.strokeStyle = 'rgba(6,10,20,0.9)'; g.lineWidth = 3; g.strokeText(p.name, x, y + 12); g.fillText(p.name, x, y + 12); }
    }
    // ville
    const tx = toX(0), ty = toY(0), tr = (CONFIG.world.townRadius / size) * W;
    g.strokeStyle = '#e2b866'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(tx, ty, Math.max(tr, 8), 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(8,12,24,0.75)'; g.font = 'bold 13px sans-serif';
    const tw = g.measureText('Korvalune').width + 14;
    g.fillRect(tx - tw / 2, ty - 34, tw, 22);
    g.fillStyle = '#f2cf6e'; g.fillText('Korvalune', tx, ty - 23);
    // autres joueurs connectés (groupe en vert, les autres en bleu clair)
    g.font = 'bold 11px sans-serif';
    for (const o of this._mapPlayers().sort((a, b) => a.group - b.group)) {
      const ox = toX(o.x), oy = toY(o.z);
      g.fillStyle = o.group ? '#7dff9a' : '#8fd3ff'; g.strokeStyle = '#0a1620'; g.lineWidth = 2;
      g.beginPath(); g.arc(ox, oy, o.group ? 6 : 4.5, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = o.group ? '#caffd7' : '#d6efff';
      g.strokeStyle = 'rgba(6,10,20,0.9)'; g.lineWidth = 3;
      const lbl = `${o.name} Nv.${o.level}`;
      g.strokeText(lbl, ox, oy - 12); g.fillText(lbl, ox, oy - 12);
    }
    // joueur : flèche orientée (devant = (sin yaw, cos yaw), la carte a z vers le bas)
    if (this.player) {
      const px = toX(this.player.pos.x), pz = toY(this.player.pos.z);
      g.save(); g.translate(px, pz); g.rotate(Math.PI - this.player.yaw);
      g.fillStyle = 'rgba(94,230,208,0.25)'; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fill();
      g.lineJoin = 'round';
      g.beginPath(); g.moveTo(0, -13); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath();
      g.fillStyle = '#f2fffc'; g.fill(); g.strokeStyle = '#0a1620'; g.lineWidth = 2; g.stroke();
      g.restore();
    }
  }

  _worldToScreen(pos) {
    const v = pos.clone().project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  }

  _tryClickTarget(e) {
    this._pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const candidates = [...this.enemies.filter((x) => x.alive), ...this.bosses.filter((b) => b.alive && b.state !== 'dormant')];
    let best = null, bestD = Infinity;
    for (const c of candidates) {
      const d = this._raycaster.ray.distanceToPoint(c.pos.clone().add({ x: 0, y: 1, z: 0 }));
      if (d < 1.4 && d < bestD) { bestD = d; best = c; }
    }
    if (best) { this.player.target = best; this._manualTargetT = performance.now(); }
  }

  // Ciblage automatique : verrouille le joueur sur l'ennemi le plus proche à
  // portée, sans qu'il ait besoin d'orienter précisément la caméra. Reste
  // "collé" sur la même cible tant qu'elle est vivante et à portée — ne
  // change que lorsqu'elle meurt, s'échappe, ou qu'aucune cible n'est
  // encore choisie. Un tap manuel sur un ennemi (_tryClickTarget) reste
  // toujours possible et prioritaire tant qu'il reste valide.
  _updateAutoTarget() {
    if (!this.player || this.player.dead || this.settings.autoTarget === false) return;
    const RANGE = this.player.classId === 'archer' ? 20 : this.player.classId === 'mage' ? 17 : 11; // archer/mage verrouillent de loin
    const cur = this.player.target;
    const curD = cur && cur.alive ? this.player.pos.distanceTo(cur.pos) : Infinity;
    const curOk = curD <= RANGE;
    // un tap manuel garde la cible 2,5 s ; ensuite l'ennemi le plus proche reprend la main
    if (curOk && performance.now() - (this._manualTargetT || 0) < 2500) return;
    const now = performance.now();
    if (curOk && now - (this._autoTgtT || 0) < 120) return; // re-scan ~8 fois/s
    this._autoTgtT = now;

    let best = null, bestD = RANGE;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = this.player.pos.distanceTo(e.pos);
      if (d < bestD) { bestD = d; best = e; }
    }
    for (const b of this.bosses) {
      if (!b.alive || b.state === 'dormant') continue;
      const d = this.player.pos.distanceTo(b.pos);
      if (d < bestD) { bestD = d; best = b; }
    }
    // l'ennemi le plus proche prend la place de la cible actuelle (petite marge pour éviter le clignotement)
    if (curOk && best && best !== cur && bestD > curD - 0.8) best = cur;
    else if (curOk && !best) best = cur;
    this.player.target = best;
  }

  _tryInteract() {
    if (!this.player || this.dialogueOpen || this.modalOpen) return;
    let nearestLoot = null, nearestD = 2.4;
    for (const ld of this.lootDrops) {
      const d = ld.pos.distanceTo(this.player.pos);
      if (d < nearestD) { nearestD = d; nearestLoot = ld; }
    }
    if (nearestLoot) return this._pickupLoot(nearestLoot);
    if (this.rift && this.rift.tryInteract()) return;
    if (this.dungeon?.chest && !this.dungeon.chest.opened && this.player.pos.distanceTo(this.dungeon.pos) < 3.5) {
      return this._openChest();
    }
    if (this.world.town?.bankPos && this.player.pos.distanceTo(this.world.town.bankPos) < 3.2) {
      return this._openBank();
    }
    for (const portal of this.portals || []) {
      if (this.player.pos.distanceTo(portal.pos) < 3.2) return this._usePortal(portal);
    }
    for (const n of this.npcs) {
      if (n.pos.distanceTo(this.player.pos) < 3.2) {
        return n.def.shop ? this._openShop(n) : this._talkTo(n);
      }
    }
    const wc = this.worldChests?.nearest(this.player.pos, 2.8);
    if (wc) return this._openWorldChest(wc);
    for (const e of this.enemies) {
      if (e.alive && e.pos.distanceTo(this.player.pos) < 3) { this.player.target = e; return; }
    }
  }

  // V4.7 : coffre caché du monde (butin selon le niveau de la zone ; 15 % de piège à éviter)
  _openWorldChest(c) {
    this.worldChests.markOpen(c);
    const p = this.player;
    this.audio.play('open'); this.audio.play('loot', new THREE.Vector3(c.x, 0, c.z));
    this.bus.emit('particles', { pos: new THREE.Vector3(c.x, c.group.position.y + 0.7, c.z), color: 0xffd23f, count: 34, speed: 3.5, life: 0.8, up: 3 });
    const trapped = Math.random() < 0.15;
    if (trapped) {
      this.hud.notify('⚠ Coffre piégé ! Écartez-vous vite !', 'boss');
      this.bus.emit('hazard', { x: c.x, z: c.z, radius: 3.2, delay: 1.1, damage: Math.round((6 + c.level * 4.233) * 0.9), color: 0xff5a2a });
    }
    const n = 1 + (Math.random() < 0.4 ? 1 : 0) + (c.tier >= 3 && Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.6;
      this._spawnGroundItem({ gen: rollLootItem({ sourceLevel: c.level, tierShift: 5 + c.tier }) }, c.x + Math.cos(a) * 1.3, c.z + Math.sin(a) * 1.3, true);
    }
    const st = computeEnemyStats(c.level, 'elite');
    p.addCoins(Math.round(st.coins[1] * 2)); p.gainXp(Math.round(st.xp * 0.6));
    this.hud.notify(`Coffre au trésor ouvert ! ${n} objet${n > 1 ? 's' : ''} au sol.`, 'quest');
    this._tut('chest');
    this._doSave();
  }

  _pickupLoot(drop) {
    const idx = this.lootDrops.indexOf(drop);
    if (idx === -1) return;
    const view = resolveItem(drop.item);
    // inventaire plein : on laisse l'objet au sol (rien n'est perdu)
    if (drop.item.gen) {
      if (this.inventory.firstEmpty() === -1) { this.hud.notify('Inventaire plein !', 'boss'); return; }
      this.inventory.addGenerated(drop.item.gen);
    } else {
      const left = this.inventory.add(drop.item.defId, drop.item.qty);
      if (left === false || left > 0) {
        const kept = left === false ? drop.item.qty : left;
        if (kept >= drop.item.qty) { this.hud.notify('Inventaire plein !', 'boss'); return; }
        drop.item.qty = kept; // une partie seulement a pu être ramassée
        this.hud.notify('Inventaire presque plein : une partie reste au sol.', 'boss');
        this.audio.play('pickup');
        return;
      }
    }
    this.lootDrops.splice(idx, 1);
    drop.dispose(this.scene);
    const big = view.rarityInfo.tier >= 13;
    this.hud.notify(`Objet ramassé : ${view.icon} ${view.name}${drop.item.qty > 1 ? ' x' + drop.item.qty : ''}`, big ? 'quest' : 'info');
    this.audio.play('pickup');
    this.particles.emit(drop.pos.x, drop.pos.y + 0.4, drop.pos.z, { count: 16, color: parseInt(view.rarityInfo.color.slice(1), 16), speed: 2.2, life: 0.5, up: 2 });
    this._tut('loot');
  }

  _openChest() {
    if (this.dungeonChief && this.dungeonChief.alive) {
      this.hud.notify('Le chef bandit garde ce coffre — vainquez-le d\'abord.', 'boss');
      return;
    }
    const chest = this.dungeon.chest;
    chest.opened = true;
    chest.lid.rotation.x = -1.9;
    chest.glow.intensity = 0;
    const drops = LootSystem.rollForChest();
    for (const d of drops) {
      if (d.gen) this.inventory.addGenerated(d.gen);
      else this.inventory.add(d.defId, d.qty);
      const view = resolveItem(d);
      this.hud.notify(`Objet obtenu : ${view.icon} ${view.name}`, 'quest');
    }
    this.audio.play('quest');
    this.particles.emit(this.dungeon.pos.x, this.dungeon.pos.y + 1.2, this.dungeon.pos.z, { count: 40, color: 0xffcf6a, speed: 4, life: 1, up: 2 });
  }

  _openShop(npc) {
    this._tut('shop');
    document.exitPointerLock?.();
    this.modalOpen = true;
    const lines = npc.def.dialogues?.intro;
    if (lines?.length) this.hud.notify(lines[Math.floor(Math.random() * lines.length)], 'info');
    this.hud.showScreen('shop-screen');
    const refresh = () => this.hud.renderShop(npc.def, this.player, (entry) => {
      if (this.player.coins < entry.price) return;
      this.player.addCoins(-entry.price);
      this.audio.play('coin');
      this.inventory.add(entry.itemId, 1);
      refresh();
    });
    refresh();
  }

  _talkTo(npc) {
    document.exitPointerLock?.();
    if (npc.def.questChain) return this._talkToQuestGiver(npc);
    this.dialogueOpen = true;
    let key = 'intro';
    if (npc.id === 'guard') {
      const q = this.quests.active.get('commencement');
      if (q) {
        const step = this.quests.currentStep(q);
        key = step?.id === 'return_guard' ? 'report' : 'hunt';
      } else key = this.quests.completed.has('commencement') ? 'done' : 'hunt';
    }
    let lines = npc.def.dialogues[key] || npc.def.dialogues.intro;
    if (npc.id === 'guard' && this.quests.tutorialStep()?.target === 'guard') {
      lines = ['Bienvenue à Korvalune, voyageur ! Moi, c\'est Halvar. Je veille sur cette place.',
        'Tu n\'as presque rien sur toi, je le vois bien. Tiens, voici trois potions de soin.',
        'J\'ai aussi posé une armure à tes pieds : ramasse-la avec E, puis équipe-la depuis ton inventaire.'];
    }
    this.hud.showDialogue(npc.def, lines, {
      onEnd: () => {
        this.dialogueOpen = false;
        this.bus.emit('talk', npc.id);
      }
    });
  }

  // Dialogue générique pour tout PNJ déclarant une "questChain" (Hugo,
  // Sébastien, Morgane, Laurine) : propose la prochaine quête non terminée
  // de sa chaîne (si le niveau suffit), rappelle l'objectif si elle est en
  // cours, remet la récompense si l'objectif est atteint, ou félicite le
  // joueur une fois toute la chaîne terminée.
  _talkToQuestGiver(npc) {
    this.dialogueOpen = true;
    const close = () => { this.dialogueOpen = false; };
    const nextId = npc.def.questChain.find((id) => !this.quests.completed.has(id));
    if (!nextId) {
      this.hud.showDialogue(npc.def, npc.def.dialogues.all_done || ['Merci pour ton aide.'], { onEnd: close });
      return;
    }
    const def = this.quests.defs.find((d) => d.id === nextId);
    const active = this.quests.active.get(nextId);
    if (!active && def && this.player.level < def.level) {
      this.hud.showDialogue(npc.def, [`J'aurais bien besoin de toi, mais tu n'es pas encore prêt. Reviens me voir quand tu auras atteint le niveau ${def.level}.`], { onEnd: close });
      return;
    }
    const readyToTurnIn = !!active && this.quests.currentStep(active)?.type === 'talk';
    const lines = readyToTurnIn
      ? ["Tu as réussi, je n'en attendais pas moins de toi !", 'Voici ta récompense, tu l\'as bien méritée.']
      : (npc.def.dialogues[active ? `progress_${nextId}` : `offer_${nextId}`] || ['...']);
    this.hud.showDialogue(npc.def, lines, {
      onEnd: () => {
        close();
        if (!active) this.quests.start(nextId);
        this.bus.emit('talk', npc.id);
      }
    });
  }

  // ---------- Boucle ----------
  _loop = () => {
    if (!this._running) return;
    requestAnimationFrame(this._loop);
    const cap = this.settings.fpsCap;
    if (cap > 0) { const nowT = performance.now(); if (nowT - (this._lastFrameT || 0) < 1000 / cap - 3) return; this._lastFrameT = nowT; }
    const dt0 = Math.min(0.05, this.clock.getDelta());
    // arrêt sur image très bref à l'impact (sensation de coup)
    const dt = this._hitStop > 0 && this._v25 ? dt0 * 0.06 : dt0;
    if (this._hitStop > 0) this._hitStop -= dt0;
    this._fpsAcc += dt0; this._fpsN++;
    if (this._fpsAcc > 0.5) { this._fps = Math.round(this._fpsN / this._fpsAcc); this._fpsAcc = 0; this._fpsN = 0; this._adaptResolution(this._fps); if (this._fpsEl && this.settings.showFps) this._fpsEl.textContent = this._fps + ' FPS'; }
    if (this.paused) return;

    const blocked = this.dialogueOpen || this.modalOpen;
    const look = blocked ? { dx: 0, dy: 0 } : this.input.lookDelta();
    const wheel = this.input.consumeWheel();
    this._lowHpFx(dt);
    if (!blocked) this.player.update(dt, this.input, this.cameraRig.yaw);
    else this.player.update(0, { moveVector: () => ({ x: 0, y: 0 }), held: () => false, down: () => false, action: () => false, actions: new Set() }, this.cameraRig.yaw);

    this.combat.update(dt);
    this.enemyProj.update(dt, this.player, this.world);
    this.hazards?.update(dt, this.player);
    if (this.worldChests) {
      this.worldChests.update(dt, this.player.pos, this.bus);
      const near = !this.modalOpen && !this.rift?.active && this.worldChests.nearest(this.player.pos, 2.8);
      if (near) { this.hud.setHint(`${this.keyText('interact')} — Ouvrir le coffre`); this._chestHint = true; }
      else if (this._chestHint) { this._chestHint = false; this.hud.setHint(null); }
    }
    this._updateMeteorEvent(dt);
    this.caravan?.update(dt);
    const cullDistSq = ((this._q?.fogFar || 200) * (this.settings.viewDist || 100) / 100 * 0.9) ** 2;
    this.gw.update(dt);
    const gwHost = this.gw.isHost;
    for (const e of this.enemies) {
      if (e.alive && (gwHost && e.netKey ? this.gw.nearestDist(e.pos) ** 2 : this.player.pos.distanceToSquared(e.pos)) > cullDistSq) continue;
      e.update(dt, gwHost ? this.gw.pick(e) : this.player);
    }
    let nearestActiveBoss = null;
    for (const b of this.bosses) {
      if (b.alive) b.update(dt, gwHost ? this.gw.pick(b) : this.player);
      if (!b.activated && !b.netProxy && this.gw.activeTargets().some((t) => t.pos.distanceTo(b.home) < 20)) { b.activate(); b.activated = true; }
      if (b.state !== 'dormant' && b.alive) nearestActiveBoss = nearestActiveBoss || b;
    }
    this._camQuat.copy(this.camera.quaternion);
    for (const n of this.npcs) n.update(dt, this._camQuat);
    for (const e of this.enemies) e.label.quaternion.copy(this._camQuat);
    this._updateAutoTarget();
    this._updateTreasureGoblin(dt);
    this._updateEnemyStreaming(dt);
    this._updatePoiDiscovery(dt);
    if (this.rift) this.rift.update(dt);
    for (const rp of this.remotePlayers.values()) rp.update(dt, this._camQuat);
    for (const ld of this.lootDrops) ld.update(dt, this._camQuat);
    for (const portal of this.portals || []) updatePortal(portal, dt);

    const animState = this.player.dead ? 'dead' : this.player.action || (this.player.speed > 0.3 ? (this.player.running ? 'run' : 'walk') : 'idle');
    this.net.tickMove(dt, this.player.pos, this.player.yaw, animState, this.player.hp, this.player.maxHp, this.player.level, this.gw.room);
    // V9.0 : ramassage automatique (option) — jamais pendant un menu/dialogue, sans spam si l'inventaire est plein
    this._autoLootT = (this._autoLootT || 0) + dt;
    if (this._autoLootT > 0.35 && this.settings.autoLoot && this.settings.autoLoot !== 'off' && !this.player.dead && !this.dialogueOpen && !this.modalOpen) {
      this._autoLootT = 0;
      for (const ld of this.lootDrops) {
        if (ld.pos.distanceTo(this.player.pos) > 2.2) continue;
        if (ld.item.gen && this.settings.autoLoot !== 'all') continue;
        if (this.inventory.firstEmpty() === -1) continue;
        const n0 = this.lootDrops.length;
        this._pickupLoot(ld);
        if (this.lootDrops.length < n0) break; // un objet par passage
      }
    }
    this._autoSaveAcc += dt;
    const asv = this.settings.autosave ?? 60;
    if (asv > 0 && this._autoSaveAcc > asv) { this._autoSaveAcc = 0; this._doSave(); }
    if (this.group.length) {
      const rows = this.group.filter((m) => m.id !== this.net.id).map((m) => ({
        name: m.name, level: m.level, hp: m.hp, maxHp: m.maxHp,
        dist: this.player.pos.distanceTo(new THREE.Vector3(m.pos[0], m.pos[1], m.pos[2]))
      }));
      this.hud.renderParty(rows);
    } else this.hud.renderParty(null);

    try { this._separateBodies(); } catch (e) { /* collision entre corps : non bloquant */ }
    this.particles.update(dt);
    this.dayNight.update(dt, this.player.pos, this.camera);
    this.zones.update(this.player.pos, this.scene.fog);
    this.weather.setAllowSnow(this.zones.current?.id === 'ironpeaks');
    this.weather.update(dt, this.camera, this.dayNight.sun, this.dayNight.hemi);
    if (this.rift) this.rift.postUpdate();
    this._updateAudio(dt0);
    this.world.update(dt, this.dayNight.night, this.particles);
    if (this._v25) this._updateVisualsV25(dt);
    { // caméra libre verrouillée : elle ne tourne derrière le joueur que lorsqu'il avance (évite de tourner en rond en se déplaçant sur le côté)
      const mv = blocked ? { x: 0, y: 0 } : this.input.moveVector();
      this.cameraRig.follow = mv.y > 0.35 && Math.abs(mv.x) < 0.7;
    }
    this.cameraRig.update(this.player.pos, dt, look, wheel, this.player.yaw);
    updateOcclusion(this.camera.position, this.player.pos, !this.rift?.active);
    if (this.quests) this._tutTick(look, wheel);
    if (this._shake) {
      const s = this._shake;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this._shake *= 0.86;
      if (this._shake < 0.002) this._shake = 0;
    }

    // le HUD (DOM) n'a pas besoin d'être réécrit 60 fois par seconde : ~15 fois suffisent
    this._hudT = (this._hudT || 0) + dt0;
    if (this._hudT > 0.066) {
      this._hudT = 0;
      this.hud.updatePlayer(this.player);
      this.hud.updateSkillCooldowns(this.player);
      this.hud.renderBuffs(this.player);
      this.hud.setClock(this.dayNight.timeString, this.dayNight.night > 0.5);
      this.hud.showTarget(this.player.target);
      this.hud.showBossBar(nearestActiveBoss);
    }
    if (this.player.target && !this.player.target.alive) this.player.target = null;
    if (!this._mmWorld) {
      this._mmWorld = { mapCanvas: this.world.mapCanvas, size: CONFIG.world.size };
      this._mmExtra = { zone: '', portals: [{ x: 0, z: -29.5, color: '#8fd0ff', name: 'Portails' }] };
    }
    const inRift = !!this.rift?.active;
    // V8.7 — anti-blocage : si le joueur se retrouve dans l'eau / hors du terrain (ancienne sauvegarde, téléportation, bug), il est remis sur la terre ferme la plus proche
    this._stuckT = (this._stuckT || 0) + dt;
    if (this._stuckT > 0.6 && !this.rift?.active && !this.player.dead) { this._stuckT = 0; this._ensureOnLand(); }
    this._mmExtra.zone = this._zoneNameAt(this.player.pos.x, this.player.pos.z);
    if (inRift) { this.rift.mmExtra.zone = this.rift.zoneName; this.rift.mmExtra.players = this._mapPlayers(); this.hud.drawMinimap(this.player, this.rift.mmWorld, this.enemies, [], [], this.rift.mmExtra); }
    else { this._mmExtra.players = this._mapPlayers(); this.hud.drawMinimap(this.player, this._mmWorld, this.enemies, this.npcs, this._questSpots(), this._mmExtra); }

    // vue aérienne : la caméra est loin du joueur → on repousse le brouillard d'autant (rendu uniquement)
    const fog = this.scene.fog, fogOff = this.cameraRig.isIso ? Math.max(0, this.cameraRig.dist - 6) : 0;
    if (fog && fogOff) { fog.near += fogOff; fog.far += fogOff; }
    this.renderer.render(this.scene, this.camera);
    if (fog && fogOff) { fog.near -= fogOff; fog.far -= fogOff; }
  };
}
