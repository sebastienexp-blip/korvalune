import * as THREE from 'three';
import { STORY_QUESTS, STORY_TALKS, STORY_FIRST, STORY_START_AFTER, STORY_LINES, CINEMATICS, SPEAKERS } from '../data/story.js';
import { VoiceOver, readTime } from './VoiceOver.js';
import { REGION_BY_ID, regionAt } from '../world/Continent.js';

// V10.46 — Chef d'orchestre du mode histoire : démarre les quêtes, fournit les dialogues de quête,
// joue les cinématiques (dans le moteur du jeu : même monde, même personnage, caméra dirigée) avec sous-titres et voix off.

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class StoryDirector {
  constructor(game) {
    this.game = game;
    this.voice = new VoiceOver(() => game.settings || {});
    this.playing = false;
    this._poll = 0;
    this._shot = null; this._shotT = 0; this._shotDur = 1;
    this._light = null;
    this._offs = [
      game.bus.on('questCompleted', (def) => {
        if (def.id === STORY_START_AFTER) setTimeout(() => this._ensureStarted(), 2500);
        if (def.id === 'story_p3') setTimeout(() => this.play('c2'), 1800);
        if (def.id === 'story_a1_3') setTimeout(() => this.play('c4'), 1800);
      })
    ];
    setTimeout(() => this._ensureStarted(), 5000);
  }

  dispose() { for (const off of this._offs) off(); this._offs = []; this.skip(); this._closeDom(); if (this._spire) { this.game.scene.remove(this._spire); this._spire = null; } }

  static get quests() { return STORY_QUESTS; }

  // l'histoire commence quand la quête d'accueil de Halvar est terminée (les anciens personnages rattrapent aussi)
  _ensureStarted() {
    const q = this.game.quests;
    if (!q || !q.completed.has(STORY_START_AFTER)) return;
    if (q.completed.has(STORY_FIRST) || q.active.has(STORY_FIRST)) return;
    if (STORY_QUESTS.some((d) => q.completed.has(d.id) || q.active.has(d.id))) return;
    q.start(STORY_FIRST);
  }

  // lignes de dialogue si le PNJ est l'objectif actuel d'une quête d'histoire (sinon null)
  talkLines(npcId) {
    const qm = this.game.quests;
    if (!qm) return null;
    for (const q of qm.active.values()) {
      if (!q.def.story) continue;
      const step = qm.currentStep(q);
      if (!step || step.type !== 'talk' || step.target !== npcId) continue;
      const lines = STORY_TALKS[q.def.id]?.[step.id];
      if (lines) return lines;
    }
    return null;
  }

  // ---------------------------------------------------------------- boucle (appelée par Game à chaque image)
  update(dt) {
    const g = this.game;
    if (this._shot) this._applyCamera(dt);
    if (this._spireCrystal) this._spireCrystal.rotation.y += dt * 0.8;
    const now = performance.now();
    if (now < (this._nextPoll || 0) || this.playing || !g.player || g.player.dead) return;
    this._nextPoll = now + 500;
    this._syncSpire();
    this._regionEvents();
    // cinématique 3 : la première spire
    const qs = g.quests?.active.get('story_a1_2');
    if (qs && g.quests.currentStep(qs)?.id === 'spire' && this._spire && !g.dialogueOpen && !g.modalOpen) {
      const sp = this._spire.position;
      if (Math.hypot(sp.x - g.player.pos.x, sp.z - g.player.pos.z) < 22) this.play('c3').then(() => g.bus.emit('tut', 'spire_1'));
    }
    // cinématique 1 : quand le joueur s'approche du Monolithe pendant l'étape « cine » de story_p1
    const q = g.quests?.active.get('story_p1');
    if (q && g.quests.currentStep(q)?.id === 'cine' && !g.dialogueOpen && !g.modalOpen) {
      const m = this._monolith();
      if (m && Math.hypot(m.x - g.player.pos.x, m.z - g.player.pos.z) < 26) this.play('c1').then(() => g.bus.emit('tut', 'cine_c1'));
    }
  }

  // émet region_<id> quand le joueur est dans la région visée par l'étape en cours d'une quête d'histoire
  _regionEvents() {
    const g = this.game, qm = g.quests;
    if (!qm) return;
    let rid = null;
    for (const q of qm.active.values()) {
      if (!q.def.story) continue;
      const st = qm.currentStep(q);
      if (st?.type === 'event' && /^region_/.test(st.target)) { rid = rid || regionAt(g.player.pos.x, g.player.pos.z).id; if ('region_' + rid === st.target) g.bus.emit('tut', st.target); }
    }
  }

  // la spire de la Forêt des Ombres : une tour de pierre sombre couronnée d'un cristal violet, visible de loin ; présente tant que sa quête est active ou terminée
  _syncSpire() {
    const g = this.game, qm = g.quests;
    if (!qm || !g.world) return;
    const want = qm.active.has('story_a1_2') || qm.completed.has('story_a1_2');
    if (!want && this._spire) { g.scene.remove(this._spire); this._spire = null; return; }
    if (!want || this._spire) return;
    const site = REGION_BY_ID.forest.site; let pos = null;
    for (let r = 40; r < 120 && !pos; r += 10) {
      for (let a = 0; a < 16; a++) {
        const x = site[0] + Math.cos(a * 0.3927 + 0.6) * r, z = site[1] + Math.sin(a * 0.3927 + 0.6) * r;
        const y = g.world.heightAt(x, z);
        if (y > g.world.waterLevel + 0.6 && g.world.isWalkable(x, z, 2.5)) { pos = new THREE.Vector3(x, y, z); break; }
      }
    }
    if (!pos) pos = new THREE.Vector3(site[0], g.world.heightAt(site[0], site[1]), site[1]);
    const grp = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x3a3548, roughness: 0.9, metalness: 0.05 });
    const glow = new THREE.MeshStandardMaterial({ color: 0xb48cff, emissive: 0x8a4dff, emissiveIntensity: 2.2, roughness: 0.3 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.6, 2.4, 10), stone); base.position.y = 1.2; grp.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 3.2, 16, 8), stone); shaft.position.y = 10.4; grp.add(shaft);
    for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(3.0 - i * 0.35, 0.28, 8, 24), glow); ring.rotation.x = Math.PI / 2; ring.position.y = 6 + i * 4.2; grp.add(ring); }
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(2.1, 0), glow); crystal.position.y = 21; crystal.scale.y = 1.7; grp.add(crystal);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.4, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xa87aff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 52; grp.add(beam);
    const light = new THREE.PointLight(0xa87aff, 3.5, 45, 1.5); light.position.y = 21; grp.add(light);
    grp.position.copy(pos);
    g.scene.add(grp);
    this._spire = grp; this._spireCrystal = crystal;
  }

  _monolith() { return this.game.npcs?.find((n) => n.id === 'monolith')?.pos || null; }

  // ---------------------------------------------------------------- cinématique
  async play(id) {
    const g = this.game, cin = CINEMATICS[id], lines = STORY_LINES[id];
    if (this.playing || !cin || !lines) return;
    const base = ((cin.at === 'spire' && this._spire ? this._spire.position : this._monolith()) || g.player.pos).clone();
    this.playing = true; this.skipped = false;
    g.dialogueOpen = true;
    document.exitPointerLock?.();
    this._buildDom(cin);
    this._base = base;
    this._addLight(base);
    g.audio?.play('levelup');
    await wait(900);
    for (const shot of cin.shots) {
      if (this.skipped) break;
      this._startShot(shot);
      const t0 = performance.now();
      for (const idx of shot.say) {
        if (this.skipped) break;
        const line = lines[idx];
        if (!line) continue;
        await this._sayLine(line);
      }
      const rest = shot.dur * 1000 - (performance.now() - t0);
      if (rest > 0 && !this.skipped) await wait(rest);
    }
    if (cin.card && !this.skipped) await this._showCard(cin.card);
    this._finish();
  }

  skip() { this.skipped = true; this.voice.stop(); this._skipResolve?.(); }

  async _sayLine(line) {
    const sp = SPEAKERS[line.who];
    this._setSub(sp?.name || '', line.t);
    const min = readTime(line.t) * 1000;
    const t0 = performance.now();
    const skipP = new Promise((r) => { this._skipResolve = r; });
    await Promise.race([this.voice.speak(line), skipP]);
    const left = min - (performance.now() - t0);
    if (left > 0 && !this.skipped) await Promise.race([wait(left), skipP]);
    if (!this.skipped) await Promise.race([wait(450), skipP]);
    this._setSub('', '');
  }

  _startShot(shot) {
    const b = this._base;
    const v = (a) => new THREE.Vector3(b.x + a[0], b.y + a[1], b.z + a[2]);
    this._shot = { fromP: v(shot.from.p), toP: v(shot.to.p), fromL: v(shot.from.l), toL: v(shot.to.l), fx: shot.fx };
    this._shotT = 0; this._shotDur = Math.max(2, shot.dur);
    if (shot.fx === 'pulse') { this._flash(); this.game.audio?.play('talk'); }
  }

  _applyCamera(dt) {
    const s = this._shot, cam = this.game.camera;
    this._shotT += dt;
    const k = smooth(this._shotT / this._shotDur);
    cam.position.lerpVectors(s.fromP, s.toP, k);
    const look = new THREE.Vector3().lerpVectors(s.fromL, s.toL, k);
    cam.lookAt(look);
    if (this._light) {
      const t = performance.now() / 1000;
      const target = s.fx === 'glow' ? 3.2 : s.fx === 'pulse' ? 1.6 + Math.sin(t * 9) * 1.4 : 0.7;
      this._light.intensity += (target - this._light.intensity) * Math.min(1, dt * 3);
    }
  }

  _addLight(base) {
    this._light = new THREE.PointLight(0x9fd8ff, 0.2, 60, 1.6);
    this._light.position.set(base.x, base.y + 6, base.z);
    this.game.scene.add(this._light);
  }

  _finish() {
    const g = this.game;
    this.voice.stop();
    this._shot = null;
    if (this._light) { g.scene.remove(this._light); this._light.dispose?.(); this._light = null; }
    this._closeDom();
    g.dialogueOpen = false;
    this.playing = false;
    g.cameraRig?.update?.(g.player.pos, 0.016, { x: 0, y: 0 }, 0, g.player.yaw);
  }

  // ---------------------------------------------------------------- interface
  _buildDom(cin) {
    this._closeDom();
    if (!document.getElementById('story-cine-style')) {
      const st = document.createElement('style'); st.id = 'story-cine-style';
      st.textContent = `
#story-cine{position:fixed;inset:0;z-index:9000;pointer-events:none;font-family:Georgia,'Palatino Linotype',serif;color:#eef1ff}
#story-cine .sc-bar{position:absolute;left:0;right:0;height:0;background:#000;transition:height 1.4s ease}
#story-cine .sc-bar.t{top:0}#story-cine .sc-bar.b{bottom:0}
#story-cine.on .sc-bar{height:9vh}
#story-cine .sc-who{position:absolute;left:0;right:0;bottom:calc(9vh + 76px);text-align:center;font-size:clamp(13px,2.2vw,18px);letter-spacing:.12em;color:#9fd8ff;text-shadow:0 2px 8px #000;opacity:0;transition:opacity .4s}
#story-cine .sc-sub{position:absolute;left:5vw;right:5vw;bottom:calc(9vh + 18px);text-align:center;font-size:clamp(17px,3vw,28px);line-height:1.35;text-shadow:0 2px 12px #000,0 0 3px #000;opacity:0;transition:opacity .4s}
#story-cine .sc-title{position:absolute;left:0;right:0;top:calc(9vh + 18px);text-align:center;font-size:clamp(14px,2.4vw,20px);letter-spacing:.3em;text-transform:uppercase;opacity:.8;text-shadow:0 2px 8px #000}
#story-cine .sc-flash{position:absolute;inset:0;background:#dff3ff;opacity:0}
#story-cine .sc-flash.go{animation:scflash 1.1s ease-out}
@keyframes scflash{0%{opacity:.85}100%{opacity:0}}
#story-cine .sc-card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.82);opacity:0;transition:opacity 1.2s;text-align:center;gap:14px}
#story-cine .sc-card.on{opacity:1}
#story-cine .sc-card b{font-size:clamp(22px,5vw,44px);letter-spacing:.25em;font-weight:400}
#story-cine .sc-card span{font-size:clamp(14px,2.6vw,22px);opacity:.8;letter-spacing:.08em}
#story-cine .sc-skip{position:absolute;right:16px;top:calc(9vh + 12px);pointer-events:auto;background:rgba(10,14,30,.7);color:#dfe8ff;border:1px solid rgba(160,200,255,.4);border-radius:8px;padding:8px 14px;font:inherit;font-size:14px;cursor:pointer}
@media (prefers-reduced-motion:reduce){#story-cine .sc-flash.go{animation:none}}`;
      document.head.appendChild(st);
    }
    const el = document.createElement('div'); el.id = 'story-cine';
    el.innerHTML = `<div class="sc-bar t"></div><div class="sc-bar b"></div><div class="sc-title">${cin.title}</div><div class="sc-who"></div><div class="sc-sub"></div><div class="sc-flash"></div><div class="sc-card"></div><button class="sc-skip" type="button">Passer ▸▸</button>`;
    document.body.appendChild(el);
    el.querySelector('.sc-skip').onclick = () => this.skip();
    this._key = (e) => { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); this.skip(); } };
    window.addEventListener('keydown', this._key, true);
    document.querySelector('#game-ui')?.classList.add('cine-hide');
    this._el = el;
    requestAnimationFrame(() => el.classList.add('on'));
  }

  _closeDom() {
    if (this._key) { window.removeEventListener('keydown', this._key, true); this._key = null; }
    this._el?.remove(); this._el = null;
    document.querySelector('#game-ui')?.classList.remove('cine-hide');
  }

  _setSub(who, text) {
    const e = this._el; if (!e) return;
    const s = e.querySelector('.sc-sub'), w = e.querySelector('.sc-who');
    s.textContent = text; w.textContent = who;
    s.style.opacity = text ? 1 : 0; w.style.opacity = who ? 1 : 0;
  }

  _flash() { const f = this._el?.querySelector('.sc-flash'); if (!f) return; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

  async _showCard(card) {
    const c = this._el?.querySelector('.sc-card'); if (!c) return;
    c.innerHTML = `<b>${card[0]}</b><span>${card[1]}</span>`;
    c.classList.add('on');
    const skipP = new Promise((r) => { this._skipResolve = r; });
    await Promise.race([wait(4200), skipP]);
  }
}
