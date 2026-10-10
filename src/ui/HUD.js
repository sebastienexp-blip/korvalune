import skillDefs from '../data/skills.json';
import { DIFFICULTIES } from '../data/difficulty.js';
import { EVENT, eventActive as hwEventActive, shopOpen as hwShopOpen } from '../data/halloween.js';
import { ITEMS, RARITY, resolveItem } from '../inventory/Item.js';
import { SATCHEL_IDS } from '../data/satchel.js';
import { NODES, NODE_BY_ID, CONSTELLATION_INFO, CORE_ID, MAX_LEVEL, spentOf, canInvest, zenithBonus, describeZenith, respecCost } from '../data/zenith.js';
import { activeBuildBonuses, describeMods, BUILDS_BY_CLASS } from '../data/builds.js';
import { describeSkillMod, SKILL_TEMPLATES, MAX_RANK, rankCost, rankLevelNeeded, upgradable, progMult, rankDmg } from '../combat/SkillRanks.js';
import { rarityGlow } from '../data/rarities.js';
import { PRIMARY_STAT } from '../combat/Classes.js';
import { countSets, describeBonus } from '../data/sets.js';
import { SLOTS, SLOT_LABELS } from '../inventory/Equipment.js';
import { CATALOG, CATEGORIES, CATALOG_BY_ID, COSMETIC_SLOTS } from '../data/shopCatalog.js';
import { PATCH_NOTES, LATEST_VERSION } from '../data/patchNotes.js';
import { MultiSell } from './MultiSell.js';
import { ItemGestures } from './ItemGestures.js';
import { POTION_INFO, potionCooldown, potionServes } from '../data/potions.js';
import { skillIconHTML } from './SkillIcon.js';
import { slotCategory, RUNE_BY_ID, fmtBonusMap } from '../data/crafting.js';
const byId = Object.fromEntries(skillDefs.map((s) => [s.id, s]));

// Résumé lisible des effets d'une compétence (écran Compétences)
function skillFxTags(f, num) {
  const t = [], pc = (v) => `${Math.round(v * 100)} %`;
  if (f.at === 'target') t.push(`Zone sur cible (${f.radius} m)`);
  if (f.arc) t.push('Cône');
  if (f.pierce) t.push(`Perce ${f.pierce} cibles`);
  if (f.stun) t.push(`Étourdit ${num(f.stun)} s`);
  if (f.slow) t.push(`Ralentit ${num(f.slow[1])} s`);
  if (f.dot) t.push(`${f.dot[2] === 'burn' ? 'Brûlure' : f.dot[2] === 'bleed' ? 'Saignement' : 'Poison'} ${num(f.dot[1])} s`);
  if (f.vuln) t.push(`Vulnérable +${pc(f.vuln[0])}`);
  if (f.knock) t.push(f.knock < 0 ? 'Attire' : 'Repousse');
  if (f.lifesteal) t.push(`Vol de vie ${pc(f.lifesteal)}`);
  if (f.execute) t.push(`Exécute <${pc(f.execute[0])} PV`);
  if (f.crit) t.push(`+${pc(f.crit)} critique`);
  if (f.dash) t.push(f.dash.to === 'back' ? 'Recul' : 'Bond');
  if (f.blink) t.push('Téléportation');
  if (f.shield) t.push(`Bouclier ${pc(f.shield[0])} PV`);
  if (f.invuln) t.push(`Invulnérable ${num(f.invuln)} s`);
  if (f.restore) { const r = f.restore; t.push(`Rend ${[r.mana && 'mana', r.stamina && 'endurance', r.hp && 'PV'].filter(Boolean).join(' + ')}`); }
  if (f.zone) t.push(`Zone au sol ${num(f.zone.t)} s${f.zone.heal ? ' (soigne)' : ''}${f.zone.pull ? ' · attire' : ''}${f.zone.stun ? ' · étourdit' : ''}`);
  if (f.rain) t.push(`Pluie de ${f.rain.n} impacts (${f.rain.r} m)`);
  if (f.waves) t.push(`${f.waves.n} onde${f.waves.n > 1 ? 's' : ''} de choc (${f.waves.r} m)${f.waves.heal ? ' · soigne' : ''}`);
  if (f.buff) {
    const b = f.buff, u = [];
    if (b.dmg) u.push(`dégâts +${pc(b.dmg)}`); if (b.speed) u.push(`vitesse ${b.speed > 0 ? '+' : ''}${pc(b.speed)}`);
    if (b.taken) u.push(`dégâts subis −${pc(1 - b.taken)}`); if (b.cdr) u.push(`recharges −${pc(b.cdr)}`);
    if (b.crit) u.push(`critique +${pc(b.crit)}`); if (b.regen) u.push('régénération'); if (b.lifesteal) u.push(`vol de vie ${pc(b.lifesteal)}`);
    t.push(`${num(b.t)} s : ${u.join(', ')}`);
  }
  return t;
}
const STAT_LABEL = {
  atk: 'Attaque', def: 'Défense', hp: 'PV', mana: 'Mana', crit: 'Critique', str: 'Force', agi: 'Agilité',
  int: 'Intelligence', vit: 'Endurance', spi: 'Esprit', luck: 'Chance', healPct: 'Soin', manaPct: 'Mana',
  atkSpeedPct: "Vitesse d'attaque", critDmgPct: 'Dégâts critiques', fireResPct: 'Résistance au feu',
  iceResPct: 'Résistance à la glace', lightningResPct: 'Résistance à la foudre', dmgReductionPct: 'Réduction des dégâts',
  hpRegen: 'Régénération de PV', manaRegen: 'Régénération de mana'
};
const PCT_STATS = new Set(['crit', 'atkSpeedPct', 'critDmgPct', 'fireResPct', 'iceResPct', 'lightningResPct', 'dmgReductionPct']);
function formatStatValue(key, v) { return PCT_STATS.has(key) ? `${Math.round(v * 1000) / 10}%` : v; }

// Sigil d'Aether : motif décoratif (anneaux, étoile à huit pointes) utilisé derrière les titres.
const SIGIL = `<svg class="sigil" viewBox="-100 -100 200 200" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width=".7"><circle r="96"/><circle r="89" stroke-dasharray="1.2 4.3"/><circle r="71"/><circle r="54" stroke-dasharray="14 5"/><path d="M0-71L16-16 71 0 16 16 0 71-16 16-71 0-16-16Z"/><path d="M0-96V-71M0 96V71M-96 0H-71M96 0H71"/><rect x="-38" y="-38" width="76" height="76" transform="rotate(45)"/><rect x="-38" y="-38" width="76" height="76"/></g></svg>`;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

// Toute l'interface DOM (HUD, menus, textes flottants) — pas de dépendance à Three.js ici.
// V10.16 — affiche d'Halloween de l'écran de démarrage (dates calculées depuis EVENT : une seule source de vérité)
const HW_ART = `<svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="hwsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0f33"/><stop offset="0.7" stop-color="#5a2410"/><stop offset="1" stop-color="#b8480e"/></linearGradient>
    <radialGradient id="hwmoon"><stop offset="0" stop-color="#fff0c4"/><stop offset="1" stop-color="#ffb347"/></radialGradient>
    <radialGradient id="hwglow"><stop offset="0" stop-color="#ffb347" stop-opacity="0.55"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="320" height="120" fill="url(#hwsky)"/>
  <circle cx="238" cy="42" r="46" fill="url(#hwglow)"/><circle cx="238" cy="42" r="24" fill="url(#hwmoon)"/>
  <g fill="#0b0716"><path d="M0 120V84l10-4 6 8 12-12 8 10 10-6 12 14 14-8 10 10 16-14 12 12 14-6 10 8 14-10 12 12 16-4 12 8 14-12 12 10 14-6 10 8 14-10 12 8 16-4 12 10 12-6V120z"/>
  <path d="M150 90l4-16 4 16zM148 90h12v30h-12z"/><path d="M60 82h4v38h-4z"/><path d="M52 90l12-10 12 10z"/>
  <path d="M262 28q8-10 18-4-6 2-8 8 8-2 12 4-10 0-16-2-6 2-6-6z"/><path d="M196 18q6-8 14-3-5 1-6 6 6-1 9 3-8 0-12-1-5 2-5-5z"/></g>
  <g transform="translate(150 98)"><ellipse cx="0" cy="8" rx="30" ry="6" fill="#000" opacity="0.35"/>
    <path d="M-28 -2c0-18 14-26 28-26s28 8 28 26-12 12-28 12S-28 16-28-2z" fill="#f5821f"/>
    <path d="M-12-26c-4 6-6 22 0 34M0-28c-3 8-3 26 0 38M12-26c4 6 6 22 0 34" stroke="#c4600e" stroke-width="2" fill="none" opacity="0.7"/>
    <rect x="-3" y="-34" width="6" height="9" rx="2" fill="#4a7a2a"/>
    <path d="M-18-6l8-8 6 7zM18-6l-8-8-6 7z" fill="#2a0e00"/><path d="M-16 4l5 4 5-4 6 4 6-4 5 4 5-4v-1l-4-3-7 3-5-3-5 3-7-3z" fill="#2a0e00"/>
    <circle cx="-11" cy="-8" r="6" fill="#ffd36a" opacity="0.35"/><circle cx="11" cy="-8" r="6" fill="#ffd36a" opacity="0.35"/></g>
</svg>`;
const hwDate = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(/^1 /, '1er ');
const hwBanner = () => {
  const now = Date.now();
  if (now >= EVENT.shopEnd) return '';
  const when = now < EVENT.start ? 'Bientôt' : hwEventActive(now) ? 'En cours' : 'Boutique de Jack ouverte jusqu’au ' + hwDate(EVENT.shopEnd - 864e5);
  return `<div class="hw-banner">${HW_ART}<span class="hw-badge">${when}</span><div class="hw-banner-txt"><b>🎃 Événement Halloween</b><small>Du ${hwDate(EVENT.start)} au ${hwDate(EVENT.end - 864e5)} inclus</small></div></div>`;
};

export class HUD {
  constructor(root, bus, game) {
    this.root = root; this.bus = bus; this.game = game;
    this.el = {};
    this.ms = new MultiSell(); // V10.21 : sélection multiple / vente groupée
    this.onSellMany = null;
    this.onMoveItem = null; this.onTransferItem = null; this._gctx = null;
    this.gest = new ItemGestures(this.ms, () => this._gctx); // V10.24 : appui long = sélection multiple, glisser = déplacer
    this.onPotionSelect = null;
    this._buildDom();
    this._bindEvents();
  }

  q(sel) { return this.root.querySelector(sel); }

  _buildDom() {
    this.root.innerHTML = `
      <div id="loading-screen">
        <div class="bg-sky"></div>
        <div class="mm-sigil">${SIGIL}</div>
        <div class="title-logo"><span>Korvalune</span></div>
        <div class="loading-bar"><div id="loading-fill"></div></div>
        <div id="loading-text">Initialisation…</div>
      </div>

      <div id="main-menu" class="hidden">
        <div class="bg-sky"></div>
        <button id="fs-corner" data-act="fullscreen" aria-label="Plein écran" title="Plein écran">⛶</button>
        <div class="mm-sigil">${SIGIL}</div>
        <div class="mm-left">
          <div class="title-logo"><span>Korvalune</span></div>
          <p class="mm-tag">Un monde ouvert à explorer, seul ou à plusieurs.</p>
          ${hwBanner()}
        </div>
        <div class="mm-right">
          <div id="account-status">Mode invité</div>
          <div class="menu-buttons">
            <button data-act="new">Nouvelle partie</button>
            <button data-act="continue">Continuer</button>
            <button data-act="lune">🌙 Boutique des Lunes</button>
            <button data-act="account">Compte</button>
            <button data-act="options">Options</button>
            <button data-act="credits">Crédits</button>
          </div>
          <button id="mm-news" class="news-card" data-act="patch" aria-label="Voir les nouveautés"><span class="news-badge" id="news-badge">Nouveau</span><b>Nouveautés · V${LATEST_VERSION}</b><small>${PATCH_NOTES[0].title}</small></button>
          <div class="menu-hint">Jouable au clavier et à la souris, ou au tactile.</div>
          <div class="menu-hint" id="build-version">Version V10.29 — Korvalune</div>
        </div>
      </div>

      <div id="account-screen" class="hidden panel-screen">
        <h2>Compte</h2>
        <button class="news-link" data-act="patch">🆕 Nouveautés</button>
        <div id="account-logged-in" class="hidden">
          <p>Connecté en tant que <b id="account-name-display"></b>.</p>
          <div class="menu-buttons">
            <button data-act="account-logout">Se déconnecter</button>
            <button data-act="account-back">Retour</button>
          </div>
        </div>
        <div id="account-form-wrap">
          <div id="account-tabs">
            <button class="acc-tab active" data-mode="login">Connexion</button>
            <button class="acc-tab" data-mode="register">Créer un compte</button>
          </div>
          <div class="cc-row"><label>Identifiant</label><input id="acc-username" maxlength="20" autocomplete="username" /></div>
          <div class="cc-row"><label>Mot de passe</label><input id="acc-password" type="password" maxlength="64" autocomplete="current-password" /></div>
          <p id="account-error"></p>
          <button id="account-submit" class="btn-primary">Se connecter</button>
          <p class="menu-hint" id="account-hint">Un compte permet de retrouver votre personnage depuis n'importe quel appareil.<br>Facultatif : vous pouvez toujours jouer en invité (sauvegarde locale sur l'appareil).</p>
        </div>
        <button data-act="account-back">Retour</button>
      </div>

      <div id="patch-screen" class="hidden panel-screen">
        <h2>Nouveautés</h2>
        <div id="patch-body">${PATCH_NOTES.map((n) => `<section class="patch-entry"><h3>V${n.version} <span>${n.title}</span></h3><ul>${n.items.map((i) => `<li>${i}</li>`).join('')}</ul></section>`).join('')}</div>
        <button data-act="patch-back">Retour</button>
      </div>

      <div id="char-select" class="hidden panel-screen">
        <h2>Tes personnages</h2>
        <p class="menu-hint" id="cs-info">5 personnages par compte · le coffre est partagé entre eux.</p>
        <div id="cs-list"></div>
        <button data-act="cs-back">Retour</button>
      </div>

      <div id="char-create" class="hidden panel-screen">
        <div class="cc-stage">
          <canvas id="cc-preview" width="300" height="380"></canvas>
          <div class="cc-stage-hint">Glissez pour faire tourner le personnage</div>
          <button id="cc-start" class="btn-primary">Commencer l'aventure</button>
          <button data-act="cc-back">Retour</button>
        </div>
        <div class="cc-form">
          <h2>Création du personnage</h2>
          <div class="cc-field cc-field-inline"><label for="cc-name">Nom</label><input id="cc-name" maxlength="16" value="Aventurier" /></div>
          <div class="cc-field"><label>Race</label><div id="cc-race" class="choice-grid race-grid"></div></div>
          <div class="cc-field"><label>Classe</label><div id="cc-class" class="choice-grid class-grid"></div></div>
          <p id="cc-desc" class="cc-desc"></p>
          <div class="cc-field cc-field-inline"><label>Teint</label><div id="cc-skin" class="swatches"></div></div>
          <div class="cc-field"><label>Apparence</label><div id="cc-look"></div></div>
        </div>
      </div>

      <div id="credits" class="hidden panel-screen">
        <h2>Crédits</h2>
        <p class="credits-text">Korvalune — prototype technique.<br>Monde, personnages et musique originaux.<br>Construit avec Three.js.</p>
        <button data-act="back">Retour</button>
      </div>

      <div id="game-ui" class="hidden">
        <div id="top-left" class="panel">
          <div id="portrait">🛡️</div>
          <div class="pl-info">
            <div id="pl-name">Aventurier</div>
            <div class="bar hp"><div id="bar-hp" class="fill"></div><span id="txt-hp"></span></div>
            <div class="bar mana"><div id="bar-mana" class="fill"></div><span id="txt-mana"></span></div>
            <div class="bar stam"><div id="bar-stam" class="fill"></div></div>
            <div class="bar xp"><div id="bar-xp" class="fill"></div></div>
          </div>
          <div id="lvl-badge">1</div>
        </div>

        <div id="top-right" class="panel">
          <div id="clock">☀ 09:00</div>
          <div id="coins">🪙 0</div>
        </div>

        <div id="boss-bar" class="hidden">
          <div id="boss-name">Le Gardien des Ruines</div>
          <div class="bar boss"><div id="bar-boss" class="fill"></div></div>
        </div>

        <div id="notifications"></div>
        <div id="zone-banner"></div>
        <div id="floattext-layer"></div>

        <div id="quest-panel" class="panel">
          <div class="qp-title">Quêtes</div>
          <div id="quest-list"></div>
        </div>

        <div id="minimap-wrap">
          <canvas id="minimap" width="176" height="176"></canvas>
          <button id="map-expand" aria-label="Carte du monde">🗺️</button>
          <button id="map-mode" aria-label="Orientation de la mini-carte">🧭</button>
          <div id="minimap-zone">Korvalune</div>
        </div>

        <div id="rift-hud" class="hidden"></div>
        <div id="interact-hint" class="hidden"></div>
        <div id="buff-bar"></div>
        <div id="skillbar"></div>

        <div id="dialogue-box" class="hidden panel">
          <div id="dlg-name"></div>
          <div id="dlg-text"></div>
          <div id="dlg-actions"></div>
        </div>

        <div id="crosshair"></div>
        <div id="target-frame" class="hidden">
          <div id="target-name"></div>
          <div class="bar target"><div id="bar-target" class="fill"></div></div>
        </div>

        <button id="btn-pause">⏸</button>

        <div id="side-buttons">
          <button id="btn-inv" class="tbtn small">🎒</button>
          <button id="btn-char" class="tbtn small">🧍</button>
          <button id="btn-skills" class="tbtn small">✨</button>
          <button id="btn-quests" class="tbtn small">📜</button>
          <button id="btn-ach" class="tbtn small">🏆</button>
          <button id="btn-social" class="tbtn small">👥</button>
          <button id="btn-mount" class="tbtn small hidden" aria-label="Monter ou descendre de monture" title="Monture (H)">🐎</button>
          <button id="btn-pass" class="tbtn small" aria-label="Pass de combat" title="Pass de combat">🏅<i class="pass-dot hidden"></i></button>
          <button id="btn-lune" class="tbtn small" aria-label="Boutique des Lunes" title="Boutique des Lunes"><span class="bl-ico">🌙</span><span class="bl-txt">Boutique</span></button>
          <button id="btn-chat" class="tbtn small">💬</button>
        </div>

        <div id="net-status" class="hidden">Mode solo — serveur multijoueur non détecté</div>

        <div id="party-frame" class="hidden panel"></div>
        <div id="invite-pop" class="hidden panel"></div>

        <div id="chat-panel" class="hidden panel">
          <div id="chat-tabs">
            <button class="chat-tab active" data-chan="general">Général</button>
            <button class="chat-tab" data-chan="group">Groupe</button>
          </div>
          <div id="chat-log"></div>
          <form id="chat-form">
            <input id="chat-input" maxlength="240" autocomplete="off" placeholder="Message… ( /help pour les commandes )" />
            <button type="submit">➤</button>
          </form>
        </div>

        <div id="potion-quick">
          <button id="pq-heal" class="pq pq-heal" title="Potion de vie (V)"><span class="pq-ic">🧪</span><span class="pq-n">30s</span><span class="pq-k">V</span></button>
          <button id="pq-mana" class="pq pq-mana" title="Potion de mana (B)"><span class="pq-ic">🔷</span><span class="pq-n">30s</span><span class="pq-k">B</span></button>
        </div>

        <div id="float-layer"></div>
        <div id="touch-edit-bar" class="hidden"><span>Faites glisser les boutons où vous voulez</span><button id="te-reset" class="st-btn">Rétablir</button><button id="te-done" class="st-btn primary">Terminer</button></div>
        <div id="fps-counter" class="hidden">-- FPS</div>

        <div id="touch-controls">
          <div id="touch-joystick"><div id="touch-stick"></div></div>
          <div id="touch-actions">
            <button id="t-jump" class="tbtn round" title="Roulade">🌀</button>
            <button id="t-run" class="tbtn round">⚡</button>
            <button id="t-crouch" class="tbtn round">⬇</button>
            <button id="t-interact" class="tbtn round">✋</button>
            <button id="t-attack" class="tbtn big">⚔</button>
          </div>
          <button id="t-lock" class="tbtn small">🔒</button>
        </div>
      </div>

      <div id="inventory-screen" class="hidden panel-screen">
        <h2>Inventaire</h2>
        <div id="inv-layout">
          <div class="eq-box"><div class="bank-col-title">Équipé</div><div class="eq-mini" id="inv-eq"></div><small class="eq-hint">Touchez pour retirer</small></div>
          <div id="inv-main">
            <div id="inv-grid"></div>
            <div id="inv-potions"></div>
            <div id="inv-sellbar"></div>
            <div id="inv-coins">🪙 <span id="inv-coins-val">0</span></div>
            <div id="inv-pet"></div>
            <div id="inv-sat"></div>
            <div id="inv-cos"></div>
          </div>
        </div>
        <button data-act="close-inv">Fermer</button>
      </div>

      <div id="character-screen" class="hidden panel-screen">
        <h2>Personnage</h2>
        <div id="char-columns">
          <div id="equip-list"></div>
          <div id="stat-list"></div>
        </div>
        <button data-act="open-zenith">✨ Constellations (Zénith)</button>
        <button data-act="close-char">Fermer</button>
      </div>

      <div id="shop-screen" class="hidden panel-screen">
        <h2 id="shop-title">Boutique</h2>
        <div id="shop-coins">🪙 <span id="shop-coins-val">0</span></div>
        <div id="shop-list"></div>
        <div id="shop-sell">
          <div class="bank-col-title">Vendre vos objets</div>
          <div id="shop-sellbar"></div>
          <div id="shop-sell-grid"></div>
        </div>
        <button data-act="close-shop">Fermer</button>
      </div>

      <div id="skills-screen" class="hidden panel-screen">
        <h2>Compétences</h2>
        <div id="skills-rail">
          <div id="skills-bar-preview"></div>
          <p class="menu-hint">Touchez un emplacement pour le vider. Touchez une compétence débloquée pour la placer dans le premier emplacement libre.</p>
        </div>
        <div id="skills-pool"></div>
        <button data-act="close-skills">Fermer</button>
      </div>

      <div id="quests-screen" class="hidden panel-screen">
        <h2>Tableau des contrats</h2>
        <p class="menu-hint">Quêtes secondaires par monde. <span id="quests-active-count"></span></p>
        <div id="quests-tabs"></div>
        <div id="quests-list"></div>
        <button data-act="close-quests">Fermer</button>
      </div>

      <div id="social-screen" class="hidden panel-screen">
        <h2>Amis &amp; groupe</h2>
        <div id="social-body">
          <h3>Mon groupe</h3>
          <div id="social-rift"></div>
          <div id="social-group"></div>
          <h3>Amis</h3>
          <div class="social-add"><input id="friend-input" placeholder="Nom de compte de ton ami" maxlength="24" autocomplete="off" autocapitalize="off"><button id="friend-add" class="soc-btn">Ajouter</button></div>
          <div id="social-requests"></div>
          <div id="social-friends"></div>
          <h3>Joueurs connectés près de toi</h3>
          <div id="social-players"></div>
        </div>
        <button data-act="close-social">Fermer</button>
      </div>

      <div id="barber-screen" class="hidden panel-screen">
        <div class="cc-stage">
          <canvas id="barber-preview" width="300" height="380"></canvas>
          <div class="cc-stage-hint">Glissez pour faire tourner le personnage</div>
        </div>
        <div class="cc-form">
          <h2>Barbier de Korvalune</h2>
          <div id="barber-head"></div>
          <div id="barber-look"></div>
          <div id="barber-cost"></div>
          <div class="barber-actions">
            <button data-act="close-barber">Partir</button>
            <button id="barber-pay" class="btn-primary" disabled>Payer</button>
          </div>
        </div>
      </div>

      <div id="halloween-screen" class="hidden panel-screen hw-screen">
        <h2>🎃 Jack Tête-de-Citrouille</h2>
        <div id="hw-head"></div>
        <div id="hw-quests"></div>
        <h3>Boutique d’Halloween</h3>
        <div id="hw-list"></div>
        <h3>Classement des bonbons</h3>
        <div id="hw-top"></div>
        <button data-act="close-halloween">Fermer</button>
      </div>

      <div id="pass-screen" class="hidden panel-screen pass-screen">
        <div id="pass-head"></div>
        <div id="pass-msg" class="menu-hint"></div>
        <div id="pass-missions"></div>
        <div id="pass-track"></div>
        <button data-act="close-pass">Fermer</button>
      </div>

      <div id="zenith-screen" class="hidden panel-screen zenith-screen">
        <div id="zn-head"></div>
        <div id="zn-msg" class="menu-hint"></div>
        <div id="zn-info"></div>
        <div id="zn-map"></div>
        <button data-act="close-zenith">Fermer</button>
      </div>

      <div id="difficulty-screen" class="hidden panel-screen diff-screen">
        <h2>⚔️ Difficulté</h2>
        <p class="menu-hint" id="diff-hint"></p>
        <div id="diff-list"></div>
        <button data-act="close-difficulty">Retour</button>
      </div>

      <div id="workshop-screen" class="hidden panel-screen"></div>

      <div id="stable-screen" class="hidden panel-screen">
        <h2>Écurie de Korvalune</h2>
        <div id="stable-head"></div>
        <div id="stable-list"></div>
        <button data-act="close-stable">Fermer</button>
      </div>

      <div id="trade-screen" class="hidden panel-screen">
        <h2 id="trade-title">Échange</h2>
        <div id="trade-body">
          <h3>Ton offre</h3>
          <div id="trade-mine" class="trade-grid"></div>
          <h3 id="trade-their-h">Son offre</h3>
          <div id="trade-theirs" class="trade-grid"></div>
          <div id="trade-status"></div>
          <h3>Ton inventaire <small>(touche un objet pour l’ajouter ou le retirer, 6 maximum)</small></h3>
          <div id="trade-inv" class="trade-grid"></div>
        </div>
        <div class="trade-btns"><button id="trade-ok" class="soc-btn lune-go">Confirmer l’échange</button><button data-act="cancel-trade">Annuler</button></div>
      </div>

      <div id="dm-screen" class="hidden panel-screen">
        <h2 id="dm-title">Messages</h2>
        <div id="dm-list"></div>
        <div class="social-add dm-add"><input id="dm-input" placeholder="Ton message…" maxlength="240" autocomplete="off"><button id="dm-send" class="soc-btn">Envoyer</button></div>
        <button data-act="close-dm">Retour aux amis</button>
      </div>

      <div id="lune-screen" class="hidden panel-screen">
        <h2>Boutique des Lunes</h2>
        <div id="lune-body">
          <div id="lune-head"></div>
          <div id="lune-tabs"></div>
          <div id="lune-msg"></div>
          <div id="lune-list"></div>
          <div id="lune-pay"></div>
          <div id="lune-legal"><a href="/legal/cgv.html" target="_blank" rel="noopener">Conditions de vente</a> · <a href="/legal/confidentialite.html" target="_blank" rel="noopener">Confidentialité</a> · <a href="/legal/mentions.html" target="_blank" rel="noopener">Mentions légales</a></div>
        </div>
        <button data-act="close-lune">Fermer</button>
      </div>

      <div id="ach-screen" class="hidden panel-screen">
        <h2>Succès</h2>
        <p class="menu-hint" id="ach-count"></p>
        <div id="ach-list"></div>
        <button data-act="close-ach">Fermer</button>
      </div>

      <div id="bank-screen" class="hidden panel-screen">
        <h2>Coffre de Korvalune</h2>
        <p class="menu-hint">Touchez un objet pour le faire passer de l'autre côté.</p>
        <div id="bank-columns">
          <div class="bank-col">
            <div class="bank-col-title">Coffre</div>
            <div id="bank-grid"></div>
            <div id="bank-sellbar"></div>
            <div id="bank-pager">
              <button id="bank-prev" class="tbtn small">◀</button>
              <span id="bank-page-label">Page 1/4</span>
              <button id="bank-next" class="tbtn small">▶</button>
            </div>
          </div>
          <div class="bank-col">
            <div class="bank-col-title">Inventaire</div>
            <div id="bank-inv-grid"></div>
          </div>
          <div class="bank-col">
            <div class="bank-col-title">Équipé</div>
            <div class="eq-mini" id="bank-eq"></div>
            <small class="eq-hint">Touchez pour retirer</small>
          </div>
        </div>
        <button data-act="close-bank">Fermer</button>
      </div>

      <div id="rift-screen" class="hidden panel-screen"></div>
      <div id="rift-result" class="hidden panel-screen"></div>

      <div id="item-sheet" class="hidden">
        <div id="item-sheet-inner">
          <div id="is-header"><span id="is-icon"></span><div><div id="is-name"></div><div id="is-rarity"></div></div></div>
          <div id="is-levels"></div>
          <div id="is-stats"></div>
          <div id="is-affixes"></div>
          <div id="is-craft"></div>
          <div id="is-effects"></div>
          <div id="is-set"></div>
          <div id="is-compare"></div>
          <div id="is-value"></div>
          <div id="is-desc"></div>
          <div id="is-actions"></div>
        </div>
      </div>

      <div id="worldmap-screen" class="hidden panel-screen">
        <h2>Carte du monde</h2>
        <div id="worldmap-canvas-wrap"><canvas id="worldmap-canvas" width="640" height="640"></canvas></div>
        <div id="worldmap-legend"><span>⚔️ Armes</span><span>🛡️ Armures</span><span>🧪 Potions</span><span>🐎 Écurie</span><span>✂️ Barbier</span><span>🏦 Banque</span><span>🗿 Spires</span><span>🎃 Événement</span><span>🍬 Bonbons</span><span>📦 Coffre</span><span>💀 Boss</span><span>👺 Gobelin</span><span>👑 Roi Citrouille</span><span>◆ PNJ de quêtes</span><span>❗ Quête</span><span>🟢 Groupe</span><span>🔵 Joueurs</span></div>
        <button data-act="close-map">Fermer</button>
      </div>

      <div id="pause-menu" class="hidden panel-screen">
        <h2>Pause</h2>
        <div class="menu-buttons">
          <button data-act="resume">Reprendre</button>
          <button data-act="teleport-town" id="btn-teleport">Téléportation vers Korvalune — <span id="teleport-cost">?</span> 🪙</button>
          <button data-act="difficulty" id="btn-difficulty">⚔️ Difficulté</button>
          <button data-act="lune">🌙 Boutique des Lunes</button>
          <button data-act="fullscreen">Plein écran</button>
          <button data-act="settings">Paramètres</button>
          <button data-act="save">Sauvegarder</button>
          <button data-act="quit">Quitter vers le menu</button>
        </div>
      </div>

      <div id="settings-menu" class="hidden panel-screen"></div>

      <div id="levelup-banner" class="hidden">Niveau supérieur !</div>
      <div id="death-screen" class="hidden panel-screen">
        <h2>Vous êtes tombé au combat</h2>
        <p class="menu-hint">Votre équipement est intact. Korvalune vous attend.</p>
        <button data-act="respawn">Revenir à Korvalune</button>
      </div>
    `;
  }

  _bindEvents() {
    try { this._mmRotate = localStorage.getItem('aetheria.mmRotate') !== '0'; } catch (e) { this._mmRotate = true; }
    const modeBtn = this.q('#map-mode'), mmCanvas = this.q('#minimap');
    const syncMode = () => { modeBtn.classList.toggle('fixed', !this._mmRotate); modeBtn.title = this._mmRotate ? 'Carte tournante (flèche vers le haut)' : 'Carte fixe (nord en haut)'; };
    syncMode();
    modeBtn.addEventListener('click', () => {
      this._mmRotate = !this._mmRotate; syncMode();
      try { localStorage.setItem('aetheria.mmRotate', this._mmRotate ? '1' : '0'); } catch (e) { /* ignore */ }
    });
    const ZOOMS = [45, 70, 110];
    mmCanvas.addEventListener('pointerdown', (e) => e.stopPropagation());
    mmCanvas.addEventListener('click', () => { const i = ZOOMS.indexOf(this._mmRange || 70); this._mmRange = ZOOMS[(i + 1) % ZOOMS.length]; this._mmT = 0; });
    this.root.addEventListener('click', (e) => {
      const el = e.target.closest ? e.target.closest('[data-act]') : null;
      const act = el?.dataset?.act;
      const au = this.game?.audio;
      if (au && e.target.closest && !e.target.closest('#touch-controls, #skillbar, #float-layer, #potion-quick') && e.target.closest('button, [data-act], .menu-btn, select, .tab')) au.play('click');
      if (act) this.bus.emit('ui:' + act, el);
    });
  }

  showScreen(id) {
    const au = this.game?.audio, prev = this._curScreen;
    if (au && prev && prev !== id) {
      if (id === 'game-ui' && prev !== 'loading-screen') au.play('close');
      else if (prev === 'game-ui' && id !== 'loading-screen') au.play('open');
    }
    this._curScreen = id;
    if (prev !== id) this.ms.reset();
    for (const s of ['loading-screen', 'main-menu', 'char-select', 'char-create', 'credits', 'game-ui', 'pause-menu', 'settings-menu', 'death-screen', 'worldmap-screen', 'inventory-screen', 'character-screen', 'shop-screen', 'account-screen', 'patch-screen', 'bank-screen', 'skills-screen', 'quests-screen', 'ach-screen', 'social-screen', 'dm-screen', 'trade-screen', 'stable-screen', 'workshop-screen', 'halloween-screen', 'pass-screen', 'zenith-screen', 'difficulty-screen', 'barber-screen', 'lune-screen', 'rift-screen', 'rift-result']) {
      this.q('#' + s).classList.toggle('hidden', s !== id);
    }
  }

  // indication « E — … » près d'un objet interactif (statue, obélisque, coffre…)
  setHint(text) {
    const el = this._hintEl || (this._hintEl = this.q('#interact-hint'));
    if (!el) return;
    if (!text) { el.classList.add('hidden'); return; }
    el.textContent = text; el.classList.remove('hidden');
  }

  setLoading(frac, text) {
    this.q('#loading-fill').style.width = `${Math.round(frac * 100)}%`;
    this.q('#loading-text').textContent = text;
  }

  buildSkillbar(skillBar) {
    this._slotEls = null;
    const bar = this.q('#skillbar');
    bar.innerHTML = '';
    skillBar.forEach((id, i) => {
      const b = document.createElement('button');
      b.className = 'skill-slot';
      const keyLabel = (this.game && this.game.skillKeyLabel) ? this.game.skillKeyLabel(i) : (i < 9 ? String(i + 1) : '0');
      if (id && byId[id]) {
        const s = byId[id];
        b.dataset.skill = id;
        b.innerHTML = `<span class="sk-icon">${skillIconHTML(s)}</span><span class="sk-key">${keyLabel}</span><div class="sk-cd"></div>`;
        // V10.24 : « pointerdown » et non « click » : un second doigt posé pendant que le joystick est tenu ne produit pas toujours de clic
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.bus.emit('skillPressed', id); });
      } else {
        b.className += ' skill-slot-empty';
        b.innerHTML = `<span class="sk-key">${keyLabel}</span>`;
      }
      bar.appendChild(b);
    });
  }

  // V3.8 : icônes des améliorations temporaires (buffs) et du bouclier
  renderBuffs(player) {
    const el = this._buffEl || (this._buffEl = this.q('#buff-bar'));
    if (!el) return;
    const items = [];
    if (player.shieldHp > 0) items.push({ key: 'shield', icon: '🛡️', name: 'Bouclier', left: player.shieldT, extra: String(Math.ceil(player.shieldHp)) });
    for (const b of player.buffs) items.push({ key: b.id, icon: b.icon || '✨', name: b.name, left: b.left });
    const sig = items.map((i) => i.key).join('|');
    if (sig !== this._buffSig) {
      this._buffSig = sig;
      el.innerHTML = items.map((i) => `<div class="buff-ic" data-k="${i.key}" title="${i.name}"><span>${i.icon}</span><b></b></div>`).join('');
    }
    for (const i of items) {
      const n = el.querySelector(`[data-k="${i.key}"] b`);
      if (n) n.textContent = i.extra || String(Math.ceil(i.left));
    }
  }

  updateSkillCooldowns(player) {
    if (!this._slotEls) this._slotEls = [...this.q('#skillbar').querySelectorAll('.skill-slot[data-skill]')];
    for (const el of this._slotEls) {
      const s = byId[el.dataset.skill];
      if (!s) continue;
      const cd = player.cooldowns[s.id] || 0;
      const cdEl = el.querySelector('.sk-cd');
      const frac = cd / s.cooldown;
      cdEl.style.height = `${Math.max(0, frac) * 100}%`;
      el.classList.toggle('unusable', frac > 0);
    }
  }

  updatePlayer(p) {
    const key = `${p.name}|${p.level}|${Math.ceil(p.hp)}|${p.maxHp}|${Math.ceil(p.mana)}|${p.maxMana}|${Math.round(p.stamina)}|${Math.round(p.xp)}|${p.coins}|${p.statPoints > 0}|${p.zenith ? p.zenith.lvl : 0}`;
    this._coins = p.coins;
    if (key === this._plKey) return;
    this._plKey = key;
    this.q('#pl-name').textContent = p.name;
    this.q('#lvl-badge').textContent = p.level >= MAX_LEVEL && p.zenith && p.zenith.lvl > 0 ? 'Z' + p.zenith.lvl : p.level;
    this._coins = p.coins;
    this._bar('bar-hp', p.hp, p.maxHp);
    this._bar('bar-mana', p.mana, p.maxMana);
    this._bar('bar-stam', p.stamina, p.maxStamina);
    this._bar('bar-xp', p.xp, p.xpNeeded);
    this.q('#txt-hp').textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    this.q('#txt-mana').textContent = `${Math.ceil(p.mana)}/${p.maxMana}`;
    this.q('#coins').textContent = `🪙 ${p.coins}`;
    this.q('#btn-char').classList.toggle('has-points', p.statPoints > 0);
  }

  _bar(id, v, max) { this.q('#' + id).style.width = `${Math.max(0, Math.min(1, v / Math.max(1, max))) * 100}%`; }

  setClock(str, isNight) {
    const el = this.q('#clock');
    el.textContent = `${isNight ? '🌙' : '☀'} ${str}`;
  }

  showTarget(t) {
    const frame = this.q('#target-frame');
    if (!t || !t.alive || (!t.def && !this.q('#boss-bar').classList.contains('hidden'))) { frame.classList.add('hidden'); return; }
    frame.classList.remove('hidden');
    this.q('#target-name').textContent = t.def ? `${t.def.name} · Nv.${t.level}` : t.name;
    this._bar('bar-target', t.hp, t.maxHp);
  }

  showBossBar(boss) {
    const bar = this.q('#boss-bar');
    if (!boss || boss.state === 'dormant' || !boss.alive) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    this.q('#bar-boss').style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    this.q('#boss-name').textContent = boss.name + (boss.phase ? ` — Phase ${boss.phase + 1}` : '');
  }

  zoneBanner(text) {
    const b = this.q('#zone-banner');
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(this._zoneT);
    this._zoneT = setTimeout(() => b.classList.remove('show'), 3200);
  }

  notify(text, kind = 'info') {
    if (kind === 'info' && this.game?.settings?.notifInfo === false) return;
    const n = document.createElement('div');
    n.className = `notif notif-${kind}`;
    n.textContent = text;
    this.q('#notifications').appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 400); }, 3800);
  }

  floatText(worldToScreen, { pos, text, color, big }) {
    const p = worldToScreen(pos);
    if (!p) return;
    const el = document.createElement('div');
    el.className = 'floattext' + (big ? ' big' : '');
    el.textContent = text;
    el.style.color = color || '#fff';
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    this.q('#floattext-layer').appendChild(el);
    requestAnimationFrame(() => { el.style.transform = 'translate(-50%, -120px)'; el.style.opacity = '0'; });
    setTimeout(() => el.remove(), 1100);
  }

  levelupBanner() {
    const b = this.q('#levelup-banner');
    b.classList.remove('hidden');
    b.classList.add('show');
    setTimeout(() => { b.classList.remove('show'); setTimeout(() => b.classList.add('hidden'), 500); }, 1600);
  }

  renderQuests(qm) {
    if (!qm || !qm.active) return; // le journal n'existe pas encore (démarrage) : rien à afficher
    const list = this.q('#quest-list');
    list.innerHTML = '';
    if (!qm.active.size) { list.innerHTML = '<div class="quest-empty">Aucune quête active</div>'; return; }
    for (const [id, q] of qm.active) {
      const step = qm.currentStep(q);
      const div = document.createElement('div');
      div.className = 'quest-item';
      const need = step.need ? ` (${q.counts[step.id] || 0}/${step.need})` : '';
      const txt = String(step.text).replace(/\{k:(\w+)\}/g, (m, a) => (this.game?.keyText ? this.game.keyText(a) : ''));
      div.innerHTML = `<div class="quest-name">${q.def.name}</div><div class="quest-step">▸ ${txt}${need}</div>`;
      list.appendChild(div);
    }
  }

  showDialogue(npc, lines, opts = {}) {
    const box = this.q('#dialogue-box');
    box.classList.remove('hidden');
    this.q('#dlg-name').textContent = npc.name;
    this.q('#dlg-text').textContent = lines[opts.index || 0];
    const actions = this.q('#dlg-actions');
    actions.innerHTML = '';
    const idx = opts.index || 0;
    if (idx < lines.length - 1) {
      const btn = document.createElement('button');
      btn.textContent = 'Continuer ▸';
      btn.onclick = () => this.showDialogue(npc, lines, { index: idx + 1, onEnd: opts.onEnd });
      actions.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.textContent = 'Fermer';
      btn.onclick = () => { this.hideDialogue(); opts.onEnd?.(); };
      actions.appendChild(btn);
    }
  }
  hideDialogue() { this.q('#dialogue-box').classList.add('hidden'); }

  // V10.14 — garde-robe : cosmétiques possédés (liés au compte : ni vendables ni échangeables), équipables d'un toucher
  renderWardrobe() {
    const el = this.q('#inv-cos'); if (!el) return;
    const sh = this.game?._shop;
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const SLOTS_UI = [['skin', '🧥', 'Skins'], ['pet', '🐾', 'Compagnons'], ['wings', '🪽', 'Ailes'], ['aura', '🗡️', 'Auras d’arme'], ['ring', '⭕', 'Cercles'], ['trail', '✨', 'Traînées'], ['title', '🏷️', 'Titres']];
    const own = sh ? sh.owned.map((id) => CATALOG_BY_ID[id]).filter((it) => it && COSMETIC_SLOTS.includes(it.cat)) : [];
    const cell = (it, ico) => { const on = sh.eq[it.cat] === it.id; return `<button class="cos-cell${on ? ' on' : ''}" data-cos="${it.id}" data-slot="${it.cat}" data-on="${on ? 1 : 0}" title="${esc(it.desc)}"><span class="cos-ico">${ico}</span><b>${esc(it.name)}</b><small>${on ? '✔ équipé · toucher pour retirer' : 'toucher pour équiper'}</small></button>`; };
    let html = '';
    for (const [slot, ico, lab] of SLOTS_UI) {
      const mine = own.filter((it) => it.cat === slot);
      if (!mine.length) continue;
      const cur = sh.eq[slot] && CATALOG_BY_ID[sh.eq[slot]];
      html += `<h4 class="cos-slot">${ico} ${lab} <small>${mine.length} · ${cur ? 'équipé : ' + esc(cur.name) : 'rien d’équipé'}</small></h4><div class="cos-grid">${mine.map((it) => cell(it, ico)).join('')}</div>`;
    }
    el.innerHTML = `<div class="bank-col-title">🎨 Garde-robe</div><small class="eq-hint">🔒 Liée à ton compte : ni vendable, ni échangeable. Touche un objet pour l’équiper à la place de l’ancien (un seul par catégorie).</small>${html || '<p class="menu-hint">Aucun cosmétique pour l’instant : boutique des Lunes, événement d’Halloween ou récompenses de niveau.</p>'}`;
  }

  renderInventory(inventory, equipment, player, onAction) {
    this.renderWardrobe();
    const rerender = () => this.renderInventory(inventory, equipment, player, onAction);
    const grid = this.q('#inv-grid');
    grid.innerHTML = '';
    this._gctx = { rerender, slotsOf: (sc) => (sc === 'inv' ? inventory.slots : null), move: (fs, fi, ts, ti) => this.onMoveItem && this.onMoveItem(fs, fi, ts, ti), equip: (i) => onAction('equip', i) };
    this.gest.bind(grid);
    inventory.slots.forEach((slot, i) => {
      const cell = document.createElement('button');
      cell.className = 'inv-cell';
      cell.dataset.scope = 'inv'; cell.dataset.i = i;
      if (slot) {
        const view = resolveItem(slot);
        cell.style.borderColor = view.rarityInfo.color;
        cell.style.boxShadow = rarityGlow(view.rarityInfo).box;
        if (view.rarityInfo.prismatic) cell.classList.add('prismatic-border');
        const betterBadge = this._isUpgrade(view, equipment) ? '<span class="inv-upgrade">▲</span>' : '';
        cell.innerHTML = `<span class="inv-icon">${view.icon}</span>${slot.qty > 1 ? `<span class="inv-qty">${slot.qty}</span>` : ''}${betterBadge}`;
        cell.onclick = () => this.openItemSheet(slot, i, equipment, player, onAction);
        if (this.ms.on) this._msDecorate(cell, 'inv', i, rerender);
      }
      grid.appendChild(cell);
    });
    this.ms.renderBar(this.q('#inv-sellbar'), [{ scope: 'inv', slots: inventory.slots, from: 0, to: inventory.slots.length }], rerender, (e) => this._doSellMany(e, rerender));
    this.q('#inv-coins-val').textContent = this._coins || 0;
    this.renderEquipMini('#inv-eq', equipment);
    this.renderPotionPanel(player);
    this.renderPetPanel();
    this.renderSatchel(player);
  }

  // V10.26 — Besace des matériaux : ingrédients et runes, quantité illimitée, hors des cases de l'inventaire
  renderSatchel(player) {
    const el = this.q('#inv-sat'); if (!el || !player) return;
    const sat = player.satchel || {};
    const rows = SATCHEL_IDS.filter((id) => sat[id] > 0).map((id) => { const d = ITEMS[id]; return `<span class="sat-it" title="${d.name}">${d.icon || '▫️'}<b>${sat[id]}</b></span>`; }).join('');
    el.innerHTML = `<details class="sat-box" ${this._satOpen ? 'open' : ''}><summary>🎒 Besace des matériaux <small>illimitée</small></summary><div class="sat-grid">${rows || '<i>Vide : les ingrédients et runes ramassés s’y rangent seuls.</i>'}</div></details>`;
    const d = el.querySelector('details'); if (d) d.ontoggle = () => { this._satOpen = d.open; };
  }

  // V10.24 — réglage du compagnon directement dans l'inventaire (mêmes options que Options > Interface & jeu)
  renderPetPanel() {
    const el = this.q('#inv-pet'); if (!el) return;
    const g = this.game, st = g.settings, sh = g._shop;
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const pet = sh && sh.eq && sh.eq.pet && CATALOG_BY_ID[sh.eq.pet];
    const on = st.petLoot !== false;
    const chip = (k, label) => `<button class="pet-chip${st[k] ? ' on' : ''}" data-pk="${k}">${label}</button>`;
    const vchip = (k, v, label) => `<button class="pet-chip${String(st[k]) === String(v) ? ' on' : ''}" data-pv="${k}|${v}">${label}</button>`;
    const tierChips = (k, withOff) => (withOff ? vchip(k, 'off', 'Aucun') : '') + vchip(k, 1, 'Tout') + vchip(k, 4, 'Magique') + vchip(k, 8, 'Rare') + vchip(k, 13, 'Légendaire') + vchip(k, 19, 'Mythique') + vchip(k, 25, 'Absolu');
    const maxChips = vchip('petGearMax', 'all', 'Sans limite') + vchip('petGearMax', 19, '≤ Mythique') + vchip('petGearMax', 13, '≤ Légendaire') + vchip('petGearMax', 8, '≤ Rare') + vchip('petGearMax', 4, '≤ Magique');
    el.innerHTML = `<div class="pot-head">🐾 Compagnon ramasseur <small>${pet ? esc(pet.name) : 'aucun compagnon équipé'}</small></div>
      <div class="pet-row"><button class="pet-chip pet-main${on ? ' on' : ''}" data-pk="petLoot">${on ? '✔ Il ramasse mon butin' : 'Il ne ramasse rien'}</button></div>
      ${on ? `<div class="pet-row"><span class="pet-lab">Il ramasse :</span>${chip('petLootCons', '🧪 Consommables')}${chip('petLootMat', '🪵 Matériaux')}${chip('petLootRune', '🔶 Runes')}</div>
      <div class="pet-row"><span class="pet-lab">Équipement dès :</span>${tierChips('petGearMin', true)}</div>
      <div class="pet-row"><span class="pet-lab">Équipement jusqu’à :</span>${maxChips}</div>
      <div class="pet-row"><span class="pet-lab">Types :</span>${chip('petLootWeapon', '⚔️ Armes')}${chip('petLootArmor', '🛡️ Armures')}${chip('petLootJewel', '💍 Bijoux')}</div>
      <div class="pet-row"><span class="pet-lab">Consommables dès :</span>${tierChips('petConsMin', false)}</div>` : ''}
      <div class="pot-head" style="margin-top:8px">🔔 Notifications de ramassage</div>
      <div class="pet-row"><span class="pet-lab">Objets :</span>${vchip('lootNotif', 'all', 'Tous')}${vchip('lootNotif', 4, 'Magique+')}${vchip('lootNotif', 8, 'Rare+')}${vchip('lootNotif', 13, 'Légendaire+')}${vchip('lootNotif', 'none', 'Aucun')}</div>
      <div class="pet-row">${chip('lootNotifMats', '🪵 Matériaux, runes, consommables')}</div>
      ${pet ? '' : '<small class="eq-hint">Équipe un compagnon dans la garde-robe ci-dessous pour qu’il se mette au travail.</small>'}`;
    el.querySelectorAll('[data-pk]').forEach((b) => { b.onclick = () => { const k = b.dataset.pk; st[k] = k === 'petLoot' ? !on : !st[k]; g.applySettings(k); this.renderPetPanel(); }; });
    el.querySelectorAll('[data-pv]').forEach((b) => { b.onclick = () => { const [k, v] = b.dataset.pv.split('|'); st[k] = (v === 'off' || v === 'all' || v === 'none') ? v : Number(v); g.applySettings(k); this.renderPetPanel(); }; });
  }

  // V10.22 : potions permanentes — choix de la potion associée à chaque bouton (vie / mana)
  renderPotionPanel(player) {
    const el = this.q('#inv-potions');
    if (!el || !player || !player.potions) return;
    const rows = [['heal', '🧪 Potion de vie (V)'], ['mana', '🔷 Potion de mana (B)']].map(([kind, title]) => {
      const list = player.potions.owned.filter((id) => potionServes(id, kind)).map((id) => ({ id, def: ITEMS[id] })).filter((x) => x.def)
        .sort((a, b) => (POTION_INFO[a.id].idx - POTION_INFO[b.id].idx) || (a.id < b.id ? -1 : 1));
      const btns = list.map(({ id, def }) => {
        const r = resolveItem({ defId: id, qty: 1 }), on = player.potions[kind] === id;
        return `<button class="pot-btn${on ? ' on' : ''}" data-pot="${kind}:${id}" style="--pc:${r.rarityInfo.color}" title="${def.desc || ''}"><span>${def.icon}</span><b>${def.name}</b><small>${r.rarityInfo.name} · recharge ${potionCooldown(id)} s</small></button>`;
      }).join('');
      return `<div class="pot-row"><div class="pot-title">${title}</div><div class="pot-list">${btns}</div></div>`;
    }).join('');
    el.innerHTML = `<div class="pot-head">Potions permanentes <small>(illimitées, avec recharge)</small></div>${rows}`;
    el.querySelectorAll('[data-pot]').forEach((b) => { b.onclick = () => { const [k, id] = b.dataset.pot.split(':'); if (this.onPotionSelect) this.onPotionSelect(k, id); }; });
  }

  // V4.0 : panneau « Équipé » compact (inventaire et coffre). Toucher un objet le retire (this.onUnequip).
  renderEquipMini(sel, equipment) {
    const box = this.q(sel);
    if (!box || !equipment) return;
    box.innerHTML = '';
    const ICONS = { head: '⛑️', shoulders: '🧥', chest: '🛡️', gloves: '🧤', legs: '👖', boots: '🥾', cape: '🧣', mainhand: '⚔️', offhand: '🛡', ring: '💍', necklace: '📿' };
    for (const s of SLOTS) {
      const item = equipment.slots[s];
      const cell = document.createElement('button');
      cell.className = 'inv-cell eq-cell';
      if (item) {
        const view = resolveItem(item);
        cell.style.borderColor = view.rarityInfo.color;
        cell.style.boxShadow = rarityGlow(view.rarityInfo).box;
        cell.title = `${SLOT_LABELS[s]} : ${view.name}${view.broken ? ' (brisé)' : ''}`;
        cell.innerHTML = `<span class="inv-icon">${view.icon}</span><span class="eq-tag">${view.broken ? '💥 ' : view.isGenerated && view.dur / view.durMax <= 0.25 ? '⚠ ' : ''}${SLOT_LABELS[s]}</span>`;
        if (view.broken) cell.classList.add('broken');
        cell.onclick = () => this.onUnequip && this.onUnequip(s);
      } else {
        cell.classList.add('eq-empty');
        cell.title = `${SLOT_LABELS[s]} : vide`;
        cell.innerHTML = `<span class="inv-icon">${ICONS[s] || '·'}</span><span class="eq-tag">${SLOT_LABELS[s]}</span>`;
      }
      box.appendChild(cell);
    }
  }

  // Un objet équipable est-il meilleur que celui actuellement équipé dans son
  // emplacement (petit repère "▲" dans l'inventaire) ? Comparaison grossière
  // sur la somme des stats principales, suffisante comme indice visuel.
  _isUpgrade(view, equipment) {
    if (view.type !== 'weapon' && view.type !== 'armor') return false;
    const equipped = equipment.slots[view.slot];
    if (!equipped) return true;
    const equippedView = resolveItem(equipped);
    const sum = (v) => Object.values(v.stats || {}).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) + (v.affixes || []).reduce((a, af) => a + (af.kind === 'flat' ? af.value : 0), 0);
    return sum(view) > sum(equippedView);
  }

  openItemSheet(slot, index, equipment, player, onAction) {
    const view = resolveItem(slot);
    const sheet = this.q('#item-sheet');
    sheet.classList.remove('hidden');
    this.q('#is-icon').textContent = view.icon;
    const nameEl = this.q('#is-name');
    nameEl.textContent = view.name;
    nameEl.style.color = view.rarityInfo.color;
    nameEl.style.textShadow = rarityGlow(view.rarityInfo).text;
    nameEl.classList.toggle('prismatic-text', !!view.rarityInfo.prismatic);
    const rEl = this.q('#is-rarity');
    rEl.textContent = view.rarityInfo.name;
    rEl.style.color = view.rarityInfo.color;

    const levelsEl = this.q('#is-levels');
    if (view.isGenerated) {
      const insufficient = player && player.level < view.levelReq;
      levelsEl.innerHTML = `<span>Niveau de l'objet : ${view.itemLevel}</span><span class="${insufficient ? 'insufficient' : ''}">Niveau requis : ${view.levelReq}${insufficient ? ' — Niveau insuffisant' : ''}</span>`;
    } else if (view.levelReq > 1) {
      const insufficient = player && player.level < view.levelReq;
      levelsEl.innerHTML = `<span class="${insufficient ? 'insufficient' : ''}">Niveau requis : ${view.levelReq}${insufficient ? ' — Niveau insuffisant' : ''}</span>`;
    } else levelsEl.innerHTML = '';

    const statLine = Object.entries(view.stats || {}).filter(([, v]) => v).map(([k, v]) => `${STAT_LABEL[k] || k} +${formatStatValue(k, v)}`).join(' · ');
    this.q('#is-stats').textContent = statLine;

    const affixEl = this.q('#is-affixes');
    if (view.affixes && view.affixes.length) {
      affixEl.innerHTML = '<div class="is-section-title">Affixes</div>' + view.affixes.map((a) => `<div class="is-affix-line">+${a.kind === 'percent' ? Math.round(a.value * 1000) / 10 + '%' : a.value} ${a.label}</div>`).join('');
    } else affixEl.innerHTML = '';
    if (view.skills && view.skills.length) affixEl.innerHTML += '<div class="is-section-title">Empreintes de compétence</div>' + view.skills.map((k) => `<div class="is-affix-line" style="color:#ffd98a">✦ ${(byId[k.id] || {}).name || k.id} — ${(SKILL_TEMPLATES[k.t] || {}).label || ''} : ${describeSkillMod(k, view.itemLevel)}</div>`).join('');
    if (view.bmods) affixEl.innerHTML += '<div class="is-section-title">Bonus de la voie</div>' + Object.entries(view.bmods).map(([k, v]) => `<div class="is-affix-line">${describeMods({ [k]: v })}</div>`).join('');

    // V10.19 : usure, emplacements / runes, litanie, enchantement
    const crEl = this.q('#is-craft');
    if (view.isGenerated) {
      const cat = slotCategory(view.slot);
      const parts = [];
      const low = view.dur / view.durMax <= 0.25;
      parts.push(`<div class="is-dur${view.broken ? ' broken' : low ? ' low' : ''}">${view.broken ? '💥 Brisé — ne donne plus rien (à réparer chez le forgeron)' : `🔧 Durabilité : ${view.dur} / ${view.durMax}`}</div>`);
      if (view.sockets) {
        parts.push('<div class="is-section-title">Emplacements</div>' + view.gems.slice(0, view.sockets).map((id) => {
          const r = id && RUNE_BY_ID[id];
          return r ? `<div class="is-affix-line" style="color:${r.color}">🔶 ${r.name} — ${fmtBonusMap(r.bonus[cat])}</div>` : '<div class="is-affix-line" style="opacity:.6">⭕ Emplacement vide</div>';
        }).join(''));
        if (view.litany) parts.push(`<div class="is-affix-line" style="color:#ffd98a">✨ Litanie « ${view.litany.name} » — ${fmtBonusMap(view.litany.bonus)}</div>`);
      }
      if (view.ench) parts.push(`<div class="is-affix-line" style="opacity:.75">🔮 Enchanté ${view.ench} fois</div>`);
      if (view.gen.tmog) parts.push('<div class="is-affix-line" style="opacity:.75">🎨 Apparence modifiée</div>');
      if (view.gen.free) parts.push('<div class="is-affix-line" style="opacity:.75">🔓 Niveau requis supprimé</div>');
      crEl.innerHTML = parts.join('');
    } else crEl.innerHTML = '';

    const fxEl = this.q('#is-effects');
    if (view.effects && view.effects.length) {
      fxEl.innerHTML = '<div class="is-section-title">Effets spéciaux</div>' + view.effects.map((e) => `
        <div class="is-effect-card">
          <div class="is-effect-name">${e.name}</div>
          <div class="is-effect-detail">${Math.round(e.chance * 1000) / 10}% de chance de se déclencher ${e.triggerOn === 'hit' ? 'en infligeant des dégâts' : 'en subissant des dégâts'}${e.cooldown ? ` · Recharge : ${e.cooldown}s` : ''}</div>
        </div>`).join('');
    } else fxEl.innerHTML = '';

    const setEl = this.q('#is-set');
    if (view.setDef) {
      const sd = view.setDef;
      const cs = countSets(equipment ? equipment.slots : {}).find((c) => c.set.id === sd.id);
      const cnt = cs ? cs.count : 0;
      const pcs = sd.pieces.map((n, i) => `<div class="set-piece${cs && cs.owned.has(i) ? ' on' : ''}">${cs && cs.owned.has(i) ? '✔' : '•'} ${n}</div>`).join('');
      const bon = [2, 4, 6].map((n) => `<div class="set-bonus${cnt >= n ? ' on' : ''}"><b>(${n}) pièces</b>${describeBonus(sd.bonuses[n]).map((l) => `<div>${l}</div>`).join('')}</div>`).join('');
      setEl.innerHTML = `<div class="is-section-title set-title">${sd.name} (${cnt}/6)</div>${pcs}${bon}`;
    } else if (view.build) { // V10.26 : voie d'objets de build, bonus de lignée 2 / 4 / 5 pièces
      const b = view.build;
      const ab = equipment ? activeBuildBonuses(equipment.slots, resolveItem).find((x) => x.build.id === b.id) : null;
      const cnt = ab ? ab.count : 0;
      const row = (n, m) => `<div class="set-bonus${cnt >= n ? ' on' : ''}"><b>(${n}) pièces</b><div>${describeMods(m)}</div></div>`;
      const pieces = BUILDS_BY_CLASS[b.classId].length ? '' : '';
      setEl.innerHTML = `<div class="is-section-title set-title">Voie « ${b.name} » — ${b.wayLabel} (${cnt}/5)</div><div class="set-piece">${b.blurb}</div>${pieces}${row(2, b.b2)}${row(4, b.b4)}${row(5, b.b5)}`;
    } else setEl.innerHTML = '';

    const cmpEl = this.q('#is-compare');
    cmpEl.innerHTML = '';
    if ((view.type === 'weapon' || view.type === 'armor') && equipment) {
      const equipped = equipment.slots[view.slot];
      if (equipped) {
        const eqView = resolveItem(equipped);
        const keys = new Set([...Object.keys(view.stats || {}), ...Object.keys(eqView.stats || {})]);
        const rows = [...keys].map((k) => {
          const diff = (view.stats?.[k] || 0) - (eqView.stats?.[k] || 0);
          if (!diff) return '';
          const cls = diff > 0 ? 'is-compare-pos' : 'is-compare-neg';
          return `<div class="is-compare-row"><span>${STAT_LABEL[k] || k}</span><span class="${cls}">${diff > 0 ? '+' : ''}${PCT_STATS.has(k) ? Math.round(diff * 1000) / 10 + '%' : Math.round(diff * 10) / 10}</span></div>`;
        }).join('');
        cmpEl.innerHTML = `<div class="is-section-title">Par rapport à l'objet équipé</div>${rows || '<div style="opacity:.6">Statistiques identiques</div>'}`;
      }
    }

    this.q('#is-value').textContent = `Valeur : ${view.value} 🪙`;
    this.q('#is-desc').textContent = view.desc || '';

    const actions = this.q('#is-actions');
    actions.innerHTML = '';
    const addBtn = (label, fn, disabled) => { const b = document.createElement('button'); b.textContent = label; b.disabled = !!disabled; b.onclick = () => { fn(); sheet.classList.add('hidden'); }; actions.appendChild(b); };
    if (view.type === 'weapon' || view.type === 'armor') {
      const insufficient = player && player.level < view.levelReq;
      addBtn('Équiper', () => onAction('equip', index), insufficient);
    }
    if (view.type === 'consumable') addBtn('Utiliser', () => onAction('use', index));
    addBtn('Vendre — ' + view.value + '🪙', () => onAction('sell', index));
    addBtn('Jeter', () => onAction('drop', index));
    addBtn('Annuler', () => {});
  }

  renderCharacter(player, equipment, onUnequip, onSpend) {
    const list = this.q('#equip-list');
    list.innerHTML = '';
    for (const s of SLOTS) {
      const item = equipment.slots[s];
      const row = document.createElement('button');
      row.className = 'equip-row';
      if (item) {
        const view = resolveItem(item);
        row.style.borderColor = view.rarityInfo.color;
        row.style.boxShadow = rarityGlow(view.rarityInfo).box;
        row.innerHTML = `<span class="inv-icon">${view.icon}</span><span class="eq-text"><small>${SLOT_LABELS[s]}</small><b style="color:${view.rarityInfo.color}">${view.name}</b></span>`;
        row.onclick = () => onUnequip(s);
      } else {
        row.classList.add('equip-empty');
        row.innerHTML = `<span class="inv-icon">·</span><span class="eq-text"><small>${SLOT_LABELS[s]}</small><i>Vide</i></span>`;
      }
      list.appendChild(row);
    }
    const st = this.q('#stat-list');
    const hasPoints = player.statPoints > 0;
    const prim = PRIMARY_STAT[player.classId] || 'str';
    const STAT_INFO = {
      str: 'Dégâts · Guerrier, Paladin',
      agi: 'Dégâts · Archer, Assassin — aussi esquive et endurance',
      int: 'Dégâts · Mage — aussi mana max',
      vit: 'PV max et défense · toutes les classes',
      spi: 'Régénération de mana · toutes les classes',
      luck: 'Dégâts des coups critiques · toutes les classes'
    };
    const statRow = (key, label) => `
      <div class="stat-row stat-row-info${key === prim ? ' stat-main' : ''}">
        <span>${key === prim ? '⭐ ' : ''}${label}<small class="stat-hint">${key === prim ? 'Attribut principal de votre classe — ' : ''}${STAT_INFO[key]}</small></span>
        <span class="stat-val"><b>${player.stats[key]}</b>${hasPoints ? `<button class="stat-plus" data-stat="${key}" aria-label="Ajouter un point : ${label}">+</button>` : ''}</span>
      </div>`;
    st.innerHTML = `
      <div class="stat-block">
        <div class="stat-title">Combat</div>
        <div class="stat-row"><span>Niveau</span><b>${player.level}${player.zenith && player.zenith.lvl ? ` · Zénith ${player.zenith.lvl}` : ''}</b></div>
        <div class="stat-row"><span>PV max</span><b>${player.maxHp}</b></div>
        <div class="stat-row"><span>Mana max</span><b>${player.maxMana}</b></div>
        <div class="stat-row"><span>Attaque</span><b>${player.atk}</b></div>
        <div class="stat-row"><span>Défense</span><b>${player.def}</b></div>
        <div class="stat-row"><span>Critique</span><b>${Math.round(player.critChance * 100)}%</b></div>
        <div class="stat-row"><span>Dégâts critiques</span><b>×${player.critMult.toFixed(2)}</b></div>
        <div class="stat-row"><span>Esquive</span><b>${Math.round(player.dodge * 100)}%</b></div>
        <div class="stat-row"><span>Vitesse d'attaque</span><b>+${Math.round((1 - player.cooldownMult) * 100)}%</b></div>
        ${(player.fireRes || player.iceRes || player.lightningRes) ? `<div class="stat-row"><span>Résistances (feu/glace/foudre)</span><b>${Math.round(player.fireRes * 100)}/${Math.round(player.iceRes * 100)}/${Math.round(player.lightningRes * 100)}%</b></div>` : ''}
        ${player.dmgReduction ? `<div class="stat-row"><span>Réduction des dégâts</span><b>${Math.round(player.dmgReduction * 100)}%</b></div>` : ''}
        ${(player.hpRegen || player.manaRegen) ? `<div class="stat-row"><span>Régén. PV/Mana par sec.</span><b>${player.hpRegen.toFixed(1)}/${player.manaRegen.toFixed(1)}</b></div>` : ''}
      </div>
      <div class="stat-block">
        <div class="stat-title">Attributs</div>
        ${hasPoints ? `<div class="stat-points-banner">✨ ${player.statPoints} point(s) à distribuer</div>` : ''}
        ${statRow('str', 'Force')}
        ${statRow('agi', 'Agilité')}
        ${statRow('int', 'Intelligence')}
        ${statRow('vit', 'Endurance')}
        ${statRow('spi', 'Esprit')}
        ${statRow('luck', 'Chance')}
      </div>
    `;
    for (const btn of st.querySelectorAll('.stat-plus')) {
      btn.onclick = () => onSpend(btn.dataset.stat);
    }
  }

  // V10.28 — Zénith : arbre des Constellations. sel = nœud sélectionné, msg = dernier message.
  renderZenith(player, sel, msg) {
    const z = player.zenith, prim = player.classId ? ({ warrior: 'str', paladin: 'str', mage: 'int', archer: 'agi', assassin: 'agi' }[player.classId] || 'str') : 'str';
    const spent = spentOf(z.ranks), free = z.lvl - spent, max = player.level >= MAX_LEVEL;
    const pct = Math.min(100, (player.xp / Math.max(1, player.xpNeeded)) * 100);
    const bon = describeZenith(zenithBonus(z, prim), prim);
    this.q('#zn-head').innerHTML = `<h2>✨ Constellations</h2>
      <div class="zn-top"><div class="zn-lvl"><b>Zénith ${z.lvl}</b><small>${max ? 'illimité — chaque niveau donne 1 point' : `débloqué au niveau ${MAX_LEVEL} (tu es niveau ${player.level})`}</small></div>
      <div class="zn-pts ${free > 0 ? 'has' : ''}"><b>${free}</b><small>point${free > 1 ? 's' : ''} à investir</small></div></div>
      <div class="zn-xp"><i style="width:${max ? pct : 0}%"></i></div>
      <div class="zn-bonus">${bon || 'Aucun bonus pour l’instant : investis tes premiers points.'}</div>
      <button class="soc-btn" data-zn="respec"${spent ? '' : ' disabled'}>↺ Réinitialiser l’arbre (${respecCost(z.lvl)} 🪙)</button>`;
    this.q('#zn-msg').textContent = msg || 'Touche une étoile pour la sélectionner, puis investis un point. Chaque branche s’ouvre dans l’ordre.';
    const stateOf = (n) => ((z.ranks[n.id] || 0) >= n.max ? 'max' : (z.ranks[n.id] || 0) > 0 ? 'on' : canInvest({ lvl: 9e9, ranks: z.ranks }, n.id).ok ? 'open' : 'lock');
    let edges = '', dots = '';
    for (const n of NODES) {
      const pre = n.pre ? NODE_BY_ID[n.pre] : (n.c ? NODE_BY_ID[CORE_ID] : null);
      if (pre) edges += `<line x1="${pre.x}" y1="${pre.y}" x2="${n.x}" y2="${n.y}" class="zn-edge${(z.ranks[n.id] || 0) > 0 ? ' on' : ''}" ${n.c ? `style="--c:${CONSTELLATION_INFO[n.c].color}"` : ''}/>`;
    }
    for (const n of NODES) {
      const r = n.kind === 'c' ? 30 : n.kind === 'k' ? 24 : n.kind === 'm' ? 20 : 15, rk = z.ranks[n.id] || 0, col = n.c ? CONSTELLATION_INFO[n.c].color : '#ffe9a6';
      dots += `<g class="zn-node ${stateOf(n)}${sel === n.id ? ' sel' : ''}" data-zn="pick" data-v="${n.id}" style="--c:${col}"><circle cx="${n.x}" cy="${n.y}" r="${r + 10}" class="zn-hit"/><circle cx="${n.x}" cy="${n.y}" r="${r}" class="zn-disc"/>${n.kind === 'k' ? `<path d="M${n.x} ${n.y - r - 7}L${n.x + 5} ${n.y - r}H${n.x - 5}Z" class="zn-tip"/>` : ''}<text x="${n.x}" y="${n.y + 4}" class="zn-t">${n.kind === 'c' ? rk : n.max > 1 ? rk + '/' + n.max : (rk ? '✓' : '')}</text></g>`;
    }
    const LAB = { fureur: [500, 34, 'middle'], rempart: [975, 490, 'end'], savoir: [500, 980, 'middle'], fortune: [25, 490, 'start'] };
    const labels = Object.entries(CONSTELLATION_INFO).map(([id, c]) => `<text x="${LAB[id][0]}" y="${LAB[id][1]}" class="zn-lab" text-anchor="${LAB[id][2]}" style="fill:${c.color}">${c.name}</text>`).join('');
    this.q('#zn-map').innerHTML = `<div class="zn-scroll"><svg viewBox="0 0 1000 1000" width="1000" height="1000">${edges}${labels}${dots}</svg></div>`;
    const n = NODE_BY_ID[sel];
    const info = this.q('#zn-info');
    if (!n) { info.innerHTML = ''; return; }
    const rk = z.ranks[n.id] || 0, can = canInvest(z, n.id);
    const inf = n.max === Infinity;
    info.innerHTML = `<div class="zn-card" style="--c:${n.c ? CONSTELLATION_INFO[n.c].color : '#ffe9a6'}"><b>${n.name}</b> <small>${n.c ? CONSTELLATION_INFO[n.c].name + (n.arm ? ' · ' + n.arm : '') : 'Centre — rangs illimités'}${n.kind === 'k' ? ' · Clé de voûte' : ''}</small>
      <div class="zn-mods">${n.kind === 'k' || inf || n.max === 1 ? '' : 'Par rang : '}${describeZenith(n.mods, prim)}${rk && n.max > 1 ? `<br><small>Actuellement (×${rk}) : ${describeZenith(Object.fromEntries(Object.entries(n.mods).map(([k, v]) => [k, v * rk])), prim)}</small>` : ''}</div>
      <div class="zn-act"><span>Rang ${rk}${inf ? '' : '/' + n.max}</span><button class="soc-btn" data-zn="inv" data-v="${n.id}"${can.ok ? '' : ' disabled'}>+1 point</button>${inf || n.max > 2 ? `<button class="soc-btn" data-zn="inv5" data-v="${n.id}"${can.ok ? '' : ' disabled'}>+5</button>` : ''}</div>
      ${can.ok ? '' : `<small class="zn-why">${can.msg}</small>`}</div>`;
  }

  renderSkills(player, onToggleBarSlot, onToggleSkill, onUpgrade) {
    const barEl = this.q('#skills-bar-preview');
    barEl.innerHTML = '';
    player.skillBar.forEach((id, i) => {
      const cell = document.createElement('button');
      cell.className = 'skill-slot' + (id ? '' : ' skill-slot-empty');
      const keyLabel = i < 9 ? String(i + 1) : '0';
      cell.innerHTML = id && byId[id] ? `<span class="sk-icon">${skillIconHTML(byId[id])}</span><span class="sk-key">${keyLabel}</span>` : `<span class="sk-key">${keyLabel}</span>`;
      if (id) { cell.onclick = () => onToggleBarSlot(i); cell.title = 'Retirer de la barre'; }
      barEl.appendChild(cell);
    });

    const COST = { stamina: 'endurance', mana: 'mana', hp: 'PV' };
    const num = (v) => String(v).replace('.', ',');
    const pool = this.q('#skills-pool');
    pool.innerHTML = '';
    for (const s of player.getSkillPool()) {
      const unlocked = s.levelReq <= player.level;
      const equipped = player.skillBar.includes(s.id);
      const card = document.createElement('button');
      card.className = 'skill-card' + (unlocked ? (equipped ? ' sk-equipped' : ' sk-unlocked') : ' sk-locked');
      const meta = [];
      if (s.cooldown) meta.push(`Recharge ${num(s.cooldown)} s`);
      for (const [k, v] of Object.entries(s.cost || {})) if (v) meta.push(`${v} ${COST[k] || k}`);
      if (s.damage) meta.push(`Dégâts ×${num(s.damage)}${s.fx && s.fx.hits > 1 ? ` ×${s.fx.hits} coups` : ''}`);
      if (s.heal) meta.push(`Soigne ${Math.round(s.heal * 100)} %`);
      if (s.aoe) meta.push('Zone');
      if (s.fx) meta.push(...skillFxTags(s.fx, num));
      const modLine = unlocked && player.skillMods && player.skillMods[s.id] ? `<span class="sk-rank max">✦ ${describeSkillMod({ ...player.skillMods[s.id], __raw: 1 }, 0)}</span>` : '';
      const tag = unlocked ? (equipped ? 'Dans la barre' : 'Disponible') : `Niveau ${s.levelReq}`;
      let rankHTML = '';
      if (unlocked && upgradable(s)) {
        const r = (player.skillRanks && player.skillRanks[s.id]) | 0, mo = player.skillMods && player.skillMods[s.id], bo = mo ? 1 : 0;
        const dmgNow = s.damage ? ` · Dégâts ×${num((s.damage * progMult(s.levelReq) * rankDmg(r) * (1 + ((mo && mo.dmg) || 0))).toFixed(1))}` : '';
        if (r >= MAX_RANK) rankHTML = `<span class="sk-rank max">★ Rang ${r}/${MAX_RANK}${bo ? ' ✦' : ''} — maîtrisée${dmgNow}</span>`;
        else {
          const need = rankLevelNeeded(s.levelReq, r + 1), cost = rankCost(s.levelReq, r), lvlOk = player.level >= need, coinOk = player.coins >= cost;
          rankHTML = `<span class="sk-rank">Rang ${r}/${MAX_RANK}${bo ? ' ✦' : ''}${dmgNow}<span class="sk-up${lvlOk && coinOk ? '' : ' off'}" data-up="${s.id}">${lvlOk ? `⬆ ${cost} 🪙` : `Niv. ${need}`}</span></span>`;
        }
      }
      card.innerHTML = `
        <span class="sk-card-icon">${skillIconHTML(s)}</span>
        <span class="sk-card-info"><b>${s.name}</b><small>${s.desc || ''}</small><span class="sk-meta">${meta.join(' · ')}</span>${rankHTML}${modLine}</span>
        <span class="sk-card-tag">${tag}</span>
      `;
      const up = card.querySelector('[data-up]');
      if (up && onUpgrade) up.onclick = (ev) => { ev.stopPropagation(); onUpgrade(s.id); };
      if (unlocked) { card.onclick = () => onToggleSkill(s.id); card.title = equipped ? 'Retirer de la barre' : 'Ajouter à la barre'; }
      else card.disabled = true;
      pool.appendChild(card);
    }
  }

  // tiers: WORLD_TIERS ; selectedTierId: onglet courant ; quests: quêtes secondaires du monde ;
  // qm: QuestManager ; onSelectTier(id) / onAccept(questId): callbacks.
  // ---------- Amis & groupe (V6.0) ----------
  // d : { meId, leaderId, group:[{id,name,level,classId}], friends:[{name,online,char,level}], requests:[nom], players:[{id,name,level}], inGroup }
  // V10.1 — Boutique des Lunes. d : { shop:{gems,owned,eq,bankTabs,dailyReady,dailyAmount}|null, tab, preview:{slot,id}|null, msg:{ok,text}|null }
  renderLune(d) {
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const sh = d.shop;
    const head = this.q('#lune-head'), tabs = this.q('#lune-tabs'), list = this.q('#lune-list'), msg = this.q('#lune-msg');
    if (!sh) { head.innerHTML = ''; tabs.innerHTML = ''; msg.textContent = ''; list.innerHTML = '<p class="menu-hint">Chargement de la boutique… Si rien n\u2019apparaît, connecte-toi à ton compte (menu principal → Compte).</p>'; return; }
    head.innerHTML = `<div class="lune-bal"><span class="lune-gem">🌙</span><b>${sh.gems}</b><small>Lunes</small></div>` +
      `<button class="soc-btn" data-la="daily"${sh.dailyReady ? '' : ' disabled'}>${sh.dailyReady ? `Récompense du jour : +${sh.dailyAmount}` : 'Récompense du jour récupérée'}</button>`;
    msg.className = d.msg ? (d.msg.ok ? 'lune-ok' : 'lune-ko') : '';
    msg.textContent = d.msg ? d.msg.text : 'Les Lunes sont rares : récompense du jour et prime tous les 5 niveaux. Aucun objet de la boutique ne donne de puissance au combat.';
    tabs.innerHTML = CATEGORIES.map((c) => `<button class="lune-tab${c.id === d.tab ? ' on' : ''}" data-la="tab" data-v="${c.id}">${c.icon} ${esc(c.label)}</button>`).join('');
    // V10.2 : achat de Lunes par carte (affiché seulement si le serveur a les paiements activés — voir STRIPE.md)
    const payEl = this.q('#lune-pay');
    if (sh.pay && sh.pay.enabled) {
      const eur = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €';
      payEl.innerHTML = `<h3>Acheter des Lunes</h3>${sh.pay.test ? '<p class="lune-test">Mode test : aucun vrai paiement n\u2019est effectué (carte de test 4242 4242 4242 4242).</p>' : ''}` +
        sh.pay.packs.map((p) => `<div class="soc-row lune-item"><div class="soc-name"><b>${esc(p.label)}</b><small>${p.lunes} Lunes · ${eur(p.cents)}</small></div><div class="lune-btns"><button class="soc-btn lune-buy" data-la="pay" data-v="${esc(p.id)}">Payer ${eur(p.cents)}</button></div></div>`).join('') +
        `<label class="lune-consent"><input type="checkbox" id="lune-consent"${d.consent ? ' checked' : ''}> J\u2019accepte les <a href="/legal/cgv.html" target="_blank" rel="noopener">conditions de vente</a>. Je demande la livraison immédiate des Lunes et je reconnais perdre mon droit de rétractation. Les achats ne sont ni échangeables ni remboursables.</label>` +
        '<p class="menu-hint">Paiement sécurisé par Stripe : le jeu ne voit jamais votre numéro de carte. Les Lunes n\u2019ont aucune valeur monétaire : ni échange ni remboursement, sauf obligation légale.</p>';
    } else payEl.innerHTML = '';
    const items = CATALOG.filter((c) => c.cat === d.tab);
    list.innerHTML = items.map((it) => {
      const owned = sh.owned.includes(it.id);
      const eqd = it.cat !== 'perk' && sh.eq[it.cat] === it.id;
      const prev = d.preview && d.preview.id === it.id;
      const locked = it.requires && !sh.owned.includes(it.requires);
      const btns = [];
      if (it.cat !== 'perk') {
        if (d.canTry !== false) btns.push(`<button class="soc-btn" data-la="try" data-v="${it.id}">${prev ? 'Aperçu en cours' : 'Essayer'}</button>`);
        if (owned) btns.push(eqd ? `<button class="soc-btn" data-la="unequip" data-v="${it.cat}">Retirer</button>` : `<button class="soc-btn lune-go" data-la="equip" data-v="${it.id}">Équiper</button>`);
      }
      if (!owned && it.unlock) btns.push(`<button class="soc-btn lune-buy" disabled>🔒 Se débloque au niveau ${it.unlock.level}</button>`);
      else if (!owned) btns.push(`<button class="soc-btn lune-buy" data-la="buy" data-v="${it.id}"${locked || sh.gems < it.price ? ' disabled' : ''}>${locked ? 'Verrouillé' : `Acheter · ${it.price} 🌙`}</button>`);
      return `<div class="soc-row lune-item${owned ? ' soc-on' : ''}"><div class="soc-name"><b>${esc(it.name)}${eqd ? ' <em>(équipé)</em>' : owned ? ' <em>(possédé)</em>' : ''}</b><small>${esc(it.desc)}</small></div><div class="lune-btns">${btns.join('')}</div></div>`;
    }).join('');
  }

  // V10.18 — choix de la difficulté. d : { cur, level, canChange, why }
  renderDifficulty(d) {
    this.q('#diff-hint').textContent = d.canChange ? 'Plus la difficulté est haute, plus les monstres sont forts… et plus l’or, l’expérience et les objets rares abondent. Ton choix est enregistré avec ton personnage.' : d.why;
    this.q('#diff-list').innerHTML = DIFFICULTIES.map((x) => {
      const locked = d.level < x.lvl, on = d.cur === x.id;
      const pc = (v) => (v >= 1 ? `×${v}` : '');
      return `<div class="soc-row lune-item diff-row${on ? ' soc-on' : ''}"><div class="soc-name"><b style="color:${x.color}">${x.name}${on ? ' <em>(actuelle)</em>' : ''}</b>` +
        `<small>Monstres : PV ${pc(x.hp)} · dégâts ${pc(x.dmg)} — Récompenses : XP ${pc(x.xp)} · or ${pc(x.gold)} · chance d’objet ${pc(x.drop)}${x.shift ? ` · raretés +${x.shift}` : ''}</small></div>` +
        `<div class="lune-btns"><button class="soc-btn${on ? '' : ' lune-go'}" data-diff="${x.id}"${on || locked || !d.canChange ? ' disabled' : ''}>${on ? 'Choisie' : locked ? `🔒 Niveau ${x.lvl}` : 'Choisir'}</button></div></div>`;
    }).join('');
  }

  // V10.13 — boutique d'Halloween de Jack. d : { st: état serveur, shop: état boutique (équipement), top: classement }
  renderHalloween(d) {
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const st = d.st;
    if (!st) { this.q('#hw-head').innerHTML = '<p class="menu-hint">Chargement…</p>'; this.q('#hw-quests').innerHTML = ''; this.q('#hw-list').innerHTML = ''; return; }
    const end = new Date(st.endsAt - 1).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    this.q('#hw-head').innerHTML = `<div class="lune-bal"><span class="lune-gem">🍬</span><b>${st.candy}</b><small>bonbons</small></div><p class="menu-hint">${st.active ? `Événement jusqu’au ${esc(end)} inclus.` : st.shopOpen ? 'L’événement est terminé : dépense tes derniers bonbons avant la fermeture de la boutique.' : 'L’événement est terminé.'} Ce que tu achètes est à toi pour toujours.</p>`;
    const bar = (v, m) => `<span class="hw-bar"><i style="width:${Math.min(100, Math.round((v / m) * 100))}%"></i></span>`;
    this.q('#hw-quests').innerHTML = st.active ? `
      <div class="soc-row lune-item"><div class="soc-name"><b>🎒 Sac de bonbons du jour</b><small>+8 🍬 une fois par jour</small></div><div class="lune-btns"><button class="soc-btn lune-go" data-hw="daily"${st.dailyBag ? ' disabled' : ''}>${st.dailyBag ? 'Déjà pris' : 'Prendre'}</button></div></div>
      <div class="soc-row lune-item${st.huntBonus ? ' soc-on' : ''}"><div class="soc-name"><b>🔍 Chasse aux bonbons : ${st.hunt.length}/${st.huntTotal}</b><small>Des bonbons brillent dans la ville (2 🍬 chacun). Ils reviennent chaque jour. Tous ramassés : +10 🍬. ${st.huntBonus ? '✔ Bonus reçu.' : ''}</small>${bar(st.hunt.length, st.huntTotal)}</div></div>
      <div class="soc-row lune-item${st.killBonus ? ' soc-on' : ''}"><div class="soc-name"><b>💀 Monstres vaincus : ${Math.min(st.kills, st.killGoal)}/${st.killGoal}</b><small>Squelettes, citrouilles, spectres, loups-garous, sorcières. Défi accompli : +10 🍬. ${st.killBonus ? '✔ Bonus reçu.' : ''} Gains de combat du jour : ${st.killCandy}/${st.killCap} 🍬. Le Roi Citrouille laisse 30 🍬.</small>${bar(st.kills, st.killGoal)}</div></div>` : '';
    const sh = d.shop || { owned: [], eq: {} };
    const items = d.items || [];
    const catName = { aura: 'Auras d’arme', ring: 'Cercles', trail: 'Traînées', wings: 'Ailes', title: 'Titres', pet: 'Compagnons', skin: 'Skins' };
    const order = Object.keys(catName);
    const sorted = [...items].sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
    let html = '', last = '';
    for (const it of sorted) {
      if (it.cat !== last) { last = it.cat; html += `<h4 class="hw-cat">${catName[it.cat] || it.cat}</h4>`; }
      const owned = sh.owned.includes(it.id), eqd = sh.eq[it.cat] === it.id;
      const btn = owned ? (eqd ? `<button class="soc-btn" data-hw="unequip" data-v="${it.cat}">Retirer</button>` : `<button class="soc-btn lune-go" data-hw="equip" data-v="${it.id}" data-c="${it.cat}">Équiper</button>`)
        : it.unlock ? `<button class="soc-btn lune-buy" disabled>🔒 Vaincre le Roi Citrouille${it.unlock.hwBoss > 1 ? ` (${st.bossKills || 0}/${it.unlock.hwBoss})` : ''}</button>`
        : `<button class="soc-btn lune-buy" data-hw="buy" data-v="${it.id}"${!st.shopOpen || st.candy < it.candy ? ' disabled' : ''}>Acheter · ${it.candy} 🍬</button>`;
      html += `<div class="soc-row lune-item${owned ? ' soc-on' : ''}"><div class="soc-name"><b>${esc(it.name)}${eqd ? ' <em>(équipé)</em>' : owned ? ' <em>(possédé)</em>' : ''}</b><small>${esc(it.desc)}</small></div><div class="lune-btns">${btn}</div></div>`;
    }
    this.q('#hw-list').innerHTML = html;
    const top = d.top;
    this.q('#hw-top').innerHTML = top && top.length ? top.map((r, i) => `<div class="soc-row"><div class="soc-name"><b>${i + 1}. ${esc(r.name)}</b><small>${r.total} 🍬 gagnés${r.boss ? ` · ${r.boss} Roi(s) vaincu(s)` : ''}</small></div></div>`).join('') : '<p class="menu-hint">Personne n’a encore de bonbons. Sois le premier !</p>';
  }


  // V10.23 — Pass de combat. d : { st (état serveur), msg }
  renderPass(d) {
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const st = d.st;
    const head = this.q('#pass-head'), ms = this.q('#pass-missions'), tr = this.q('#pass-track');
    if (!st) { head.innerHTML = '<p class="menu-hint">Chargement…</p>'; ms.innerHTML = ''; tr.innerHTML = ''; return; }
    const days = Math.max(0, Math.ceil((st.endsAt - Date.now()) / 86400000));
    const into = st.tier >= st.tiers ? st.xpPerTier : st.xp - st.tier * st.xpPerTier;
    const pct = st.tier >= st.tiers ? 100 : Math.round((into / st.xpPerTier) * 100);
    const claimable = (() => { let n = 0; for (let t = 1; t <= st.tier; t++) { if (!st.free.includes(t)) n++; if (st.premium && !st.prem.includes(t)) n++; } return n; })();
    head.innerHTML = `
      <div class="pass-title"><h2>🏅 ${esc(st.name)}</h2><small>Saison ${st.season} · encore ${days} jour${days > 1 ? 's' : ''}</small></div>
      <div class="pass-level"><b>Palier ${st.tier}<span> / ${st.tiers}</span></b><span class="pass-bar"><i style="width:${pct}%"></i></span><small>${st.tier >= st.tiers ? 'Pass terminé !' : `${into.toLocaleString('fr-FR')} / ${st.xpPerTier.toLocaleString('fr-FR')} XP`} · XP de jeu aujourd’hui : ${st.dayXp}/${st.dayXpCap}</small></div>
      <div class="pass-actions">
        <span class="lune-bal"><span class="lune-gem">🌙</span><b>${st.gems}</b></span>
        <button class="soc-btn lune-go" data-ps="claimAll"${claimable ? '' : ' disabled'}>Tout récupérer${claimable ? ` (${claimable})` : ''}</button>
        ${st.premium ? '<span class="pass-prem-on">★ Premium actif</span>' : `<button class="soc-btn pass-prem" data-ps="premium"${st.gems < st.premiumPrice ? ' disabled' : ''}>★ Débloquer le premium · ${st.premiumPrice} 🌙</button>`}
        ${st.tier < st.tiers ? `<button class="soc-btn lune-buy" data-ps="tier"${st.gems < st.tierPrice ? ' disabled' : ''}>Palier suivant · ${st.tierPrice} 🌙</button>` : ''}
      </div>
      ${!st.premium ? '<p class="menu-hint">La voie premium ne change que l’apparence et les Lunes : aucune puissance de combat. Une fois débloquée, tout ce que tu as déjà atteint se récupère.</p>' : ''}`;
    const mrow = (m, wk) => `<div class="soc-row lune-item${m.claimed ? ' soc-on' : ''}"><div class="soc-name"><b>${esc(m.label)}</b><small>${m.progress}/${m.goal} · +${m.xp} XP de pass</small><span class="hw-bar"><i style="width:${Math.round(100 * m.progress / m.goal)}%"></i></span></div><div class="lune-btns"><button class="soc-btn lune-go" data-ps="mission" data-v="${m.id}"${m.claimed || m.progress < m.goal ? ' disabled' : ''}>${m.claimed ? 'Récupérée' : m.progress >= m.goal ? 'Récupérer' : 'En cours'}</button></div></div>`;
    ms.innerHTML = `<h3>Missions du jour</h3>${st.daily.map((m) => mrow(m)).join('')}<h3>Missions de la semaine</h3>${st.weekly.map((m) => mrow(m, true)).join('')}`;
    const itemName = (id) => d.items?.[id]?.name || id;
    const icon = { aura: '🗡️', ring: '⭕', trail: '✨', wings: '🪽', title: '🏷️', pet: '🐾', skin: '🧥', perk: '🎒' };
    const cell = (track, t) => {
      const r = d.rewards(track, t); const got = (track === 'free' ? st.free : st.prem).includes(t);
      const reach = t <= st.tier, lockedPrem = track === 'premium' && !st.premium;
      const cls = 'pass-cell' + (got ? ' got' : reach && !lockedPrem ? ' ready' : '') + (lockedPrem ? ' lock' : '') + (r.item || r.perk ? ' big' : '');
      const parts = [];
      if (r.item) parts.push(`<span class="pc-item">${icon[d.items?.[r.item]?.cat] || '🎁'} ${esc(itemName(r.item))}</span>`);
      if (r.perk) parts.push(`<span class="pc-item">🎒 ${esc(itemName(r.perk))}</span>`);
      if (r.lunes) parts.push(`<span class="pc-lunes">+${r.lunes} 🌙</span>`);
      const act = got ? '<em>✔</em>' : reach && !lockedPrem ? `<button class="soc-btn lune-go" data-ps="claim" data-track="${track}" data-v="${t}">Prendre</button>` : lockedPrem ? '<em>🔒</em>' : '';
      return `<div class="${cls}">${parts.join('')}${act}</div>`;
    };
    let rows = '';
    for (let t = 1; t <= st.tiers; t++) rows += `<div class="pass-row${t === st.tier ? ' cur' : ''}${t <= st.tier ? ' reached' : ''}" data-tier="${t}"><div class="pass-t">${t}</div>${cell('free', t)}${cell('premium', t)}</div>`;
    tr.innerHTML = `<div class="pass-row pass-colhead"><div class="pass-t"></div><div>Gratuit</div><div>★ Premium</div></div>${rows}`;
    this.q('#pass-msg').textContent = d.msg?.text || '';
    this.q('#pass-msg').className = 'menu-hint' + (d.msg ? (d.msg.ok ? ' lune-ok' : ' lune-ko') : '');
    const dot = this.q('#btn-pass .pass-dot'); if (dot) dot.classList.toggle('hidden', !claimable);
  }

  // V10.10 — écurie. d : { coins, level, list:[{ def, owned, sel }] }
  renderStable(d) {
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    this.q('#stable-head').innerHTML = `<div class="lune-bal"><span class="lune-gem">🪙</span><b>${d.coins}</b><small>pièces</small></div><p class="menu-hint">Monte avec le bouton 🐎 (ou la touche H). Les chevaux vont vite au sol ; les griffons volent au-dessus de l’eau et des falaises. On ne se bat pas en vol.</p>`;
    this.q('#stable-list').innerHTML = d.list.map(({ def, owned, sel }) => {
      const need = def.levelReq > d.level ? `Niveau ${def.levelReq} requis` : '';
      const btn = owned ? (sel ? '<button class="soc-btn" disabled>Active ✔</button>' : `<button class="soc-btn lune-go" data-st="sel" data-v="${def.id}">Choisir</button>`)
        : `<button class="soc-btn lune-buy" data-st="buy" data-v="${def.id}"${need || d.coins < def.price ? ' disabled' : ''}>${need || `Acheter · ${def.price} 🪙`}</button>`;
      return `<div class="soc-row lune-item${owned ? ' soc-on' : ''}"><div class="soc-name"><b>${def.kind === 'griffon' ? '🦅' : '🐎'} ${esc(def.name)}${owned ? ' <em>(possédé)</em>' : ''}</b><small>${esc(def.desc)} · Vitesse ×${def.speed}${def.fly ? ' · Vol' : ''} · Niv. ${def.levelReq}</small></div><div class="lune-btns">${btn}</div></div>`;
    }).join('');
  }

  // V10.9 — fenêtre d'échange. d : { name, mine, theirs, okMe, okThem, inv:[slots], sel:[index] }
  renderTrade(d) {
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    this.q('#trade-title').textContent = 'Échange avec ' + d.name;
    this.q('#trade-their-h').textContent = 'Offre de ' + d.name;
    const cell = (slot, attrs = '') => {
      const v = resolveItem(slot.gen ? { gen: slot.gen } : { defId: slot.defId, qty: slot.qty });
      if (!v) return '';
      return `<button class="inv-cell trade-cell" style="border-color:${v.rarityInfo.color}" title="${esc(v.name)}" ${attrs}><span class="inv-icon">${v.icon}</span>${slot.qty > 1 ? `<span class="inv-qty">${slot.qty}</span>` : ''}<small>${esc(v.name)}</small></button>`;
    };
    this.q('#trade-mine').innerHTML = d.mine.length ? d.mine.map((s) => cell(s)).join('') : '<p class="menu-hint">Rien pour l’instant.</p>';
    this.q('#trade-theirs').innerHTML = d.theirs.length ? d.theirs.map((s) => cell(s)).join('') : '<p class="menu-hint">Rien pour l’instant.</p>';
    this.q('#trade-inv').innerHTML = d.inv.map((s, i) => (s ? cell(s, `data-ti="${i}"${d.sel.includes(i) ? ' data-on="1"' : ''}`) : '')).join('') || '';
    const st = this.q('#trade-status');
    st.textContent = d.okMe && d.okThem ? 'Échange en cours…' : d.okMe ? `Tu as confirmé. En attente de ${d.name}…` : d.okThem ? `${d.name} a confirmé. À toi de vérifier puis confirmer.` : 'Choisis tes objets, vérifie l’offre, puis confirme. Si l’offre change, les confirmations sont annulées.';
    const ok = this.q('#trade-ok'); ok.disabled = !!d.okMe; ok.textContent = d.okMe ? 'Confirmé ✔' : 'Confirmer l’échange';
  }

  // V10.8 — conversation privée avec un ami. d : { name, msgs:[{me,text,at}] }
  renderDm(d) {
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    this.q('#dm-title').textContent = 'Messages · ' + d.name;
    const el = this.q('#dm-list');
    el.innerHTML = d.msgs.length ? d.msgs.map((m) => `<div class="dm-msg ${m.me ? 'me' : 'them'}"><span>${esc(m.text)}</span><small>${new Date(m.at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></div>`).join('') : '<p class="menu-hint">Aucun message pour l\u2019instant. Ton ami le verra à sa prochaine connexion s\u2019il est hors ligne.</p>';
    el.scrollTop = el.scrollHeight;
  }

  renderSocial(d) {
    this.q('#social-rift').innerHTML = d.rift ? `<div class="soc-row soc-on"><div class="soc-name"><b>🌀 ${String(d.rift.from).replace(/[<>&]/g, '')} est dans une spire</b><small>${d.rift.label}</small></div><button class="soc-btn" data-sa="join-rift">Rejoindre</button></div>` : '';
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const g = this.q('#social-group');
    if (!d.group.length) g.innerHTML = '<p class="menu-hint">Tu n\'es dans aucun groupe. Invite un ami ou un joueur ci-dessous (jusqu\'à 5 joueurs) : vous combattez les mêmes monstres et les mêmes boss, chacun garde son butin et son XP.</p>';
    else {
      const iLead = d.leaderId === d.meId;
      g.innerHTML = d.group.map((m) => `<div class="soc-row"><div class="soc-name"><b>${m.id === d.leaderId ? '👑 ' : ''}${esc(m.name)}</b><small>Nv.${m.level} · ${esc(m.classId || '')}${m.id === d.meId ? ' · toi' : ''}${m.inst ? ' · en spire' : ''}</small></div>${iLead && m.id !== d.meId ? `<button class="soc-btn" data-sa="kick" data-v="${esc(m.id)}">Exclure</button>` : ''}</div>`).join('')
        + '<div class="soc-row"><button class="soc-btn" data-sa="leave">Quitter le groupe</button></div>';
    }
    this.q('#social-requests').innerHTML = d.requests.length ? '<h4>Demandes reçues</h4>' + d.requests.map((n) => `<div class="soc-row"><div class="soc-name"><b>${esc(n)}</b><small>veut devenir ton ami</small></div><button class="soc-btn" data-sa="accept" data-v="${esc(n)}">Accepter</button><button class="soc-btn" data-sa="decline" data-v="${esc(n)}">Refuser</button></div>`).join('') : '';
    this.q('#social-friends').innerHTML = d.friends.length ? d.friends.map((f) => `<div class="soc-row${f.online ? ' soc-on' : ''}"><div class="soc-name"><b>${f.online ? '🟢' : '⚫'} ${esc(f.name)}</b><small>${f.online ? (f.char ? esc(f.char) + ' · Nv.' + f.level : 'en ligne') : 'hors ligne'}</small></div><button class="soc-btn dm-btn" data-sa="dm" data-v="${esc(f.name)}">✉️ Message${f.unread ? ` <span class="dm-badge">${f.unread}</span>` : ''}</button>${f.online ? `<button class="soc-btn" data-sa="invite" data-v="${esc(f.name)}">Inviter</button>` : ''}${f.online && f.char ? `<button class="soc-btn" data-sa="trade" data-v="${esc(f.char)}">🔁 Échanger</button>` : ''}<button class="soc-btn" data-sa="remove" data-v="${esc(f.name)}">Retirer</button></div>`).join('') : '<p class="menu-hint">Aucun ami pour l\'instant. Écris le nom de compte de ton ami ci-dessus puis « Ajouter » : il recevra ta demande.</p>';
    this.q('#social-players').innerHTML = d.players.length ? d.players.map((p) => `<div class="soc-row"><div class="soc-name"><b>${esc(p.name)}</b><small>Nv.${p.level}</small></div><button class="soc-btn" data-sa="invite-id" data-v="${esc(p.id)}">Inviter</button><button class="soc-btn" data-sa="trade-id" data-v="${esc(p.id)}">🔁 Échanger</button></div>`).join('') : '<p class="menu-hint">Personne d\'autre en vue.</p>';
  }

  hideInvite() { const el = this.q('#invite-pop'); clearTimeout(this._invT); if (el) { el.classList.add('hidden'); el.innerHTML = ''; } }

  // Fenêtre d'invitation de groupe avec Accepter / Refuser (disparaît seule après 25 s)
  showInvite(from, onAccept, onDecline, label = 't\'invite dans son groupe') {
    const el = this.q('#invite-pop');
    clearTimeout(this._invT);
    el.classList.remove('hidden');
    el.innerHTML = `<div><b>${String(from).replace(/[<>&]/g, '')}</b> ${label}</div><div class="inv-btns"><button class="soc-btn" data-i="ok">Accepter</button><button class="soc-btn" data-i="no">Refuser</button></div>`;
    const done = () => { clearTimeout(this._invT); el.classList.add('hidden'); el.innerHTML = ''; };
    el.querySelector('[data-i=ok]').onclick = () => { done(); onAccept(); };
    el.querySelector('[data-i=no]').onclick = () => { done(); onDecline(); };
    this._invT = setTimeout(() => { done(); onDecline(); }, 25000);
  }

  renderAchievements(list) {
    this.q('#ach-count').textContent = `${list.filter((a) => a.done).length} / ${list.length} débloqués`;
    const el = this.q('#ach-list');
    el.innerHTML = list.slice().sort((a, b) => (a.done - b.done) || ((b.value / b.goal) - (a.value / a.goal))).map((a) => `
      <div class="ach-row${a.done ? ' ach-done' : ''}">
        <div class="ach-icon">${a.icon}</div>
        <div class="ach-info"><b>${a.name}</b><small>${a.desc} · +${a.reward.xp} XP, +${a.reward.coins} 🪙</small>
          <div class="ach-bar"><div style="width:${Math.round(100 * a.value / a.goal)}%"></div></div></div>
        <div class="ach-val">${a.done ? '✔' : a.value + '/' + a.goal}</div>
      </div>`).join('');
  }

  renderQuestBoard(tiers, playerLevel, selectedTierId, quests, qm, activeCount, maxActive, onSelectTier, onAccept) {
    this.q('#quests-active-count').textContent = `Contrats actifs : ${activeCount}/${maxActive}`;
    const tabs = this.q('#quests-tabs');
    tabs.innerHTML = '';
    for (const t of tiers) {
      const unlocked = playerLevel >= t.unlockLevel;
      const btn = document.createElement('button');
      btn.className = 'quest-tab' + (t.id === selectedTierId ? ' active' : '');
      btn.textContent = unlocked ? t.name : `${t.name} 🔒 Nv.${t.unlockLevel}`;
      if (unlocked) btn.onclick = () => onSelectTier(t.id); else btn.disabled = true;
      tabs.appendChild(btn);
    }
    const list = this.q('#quests-list');
    list.innerHTML = '';
    for (const q of quests) {
      const status = qm.status(q.id);
      const row = document.createElement('div');
      row.className = 'quest-row quest-row-' + status;
      row.innerHTML = `<div class="quest-row-info"><b>${q.name}</b><small>${q.steps[0].text} · 🏆 ${q.reward.xp} XP, 🪙 ${q.reward.coins}</small></div>`;
      const btn = document.createElement('button');
      btn.className = 'tbtn small';
      if (status === 'done') { btn.textContent = 'Terminée'; btn.disabled = true; }
      else if (status === 'active') { btn.textContent = 'En cours'; btn.disabled = true; }
      else { btn.textContent = 'Accepter'; btn.disabled = activeCount >= maxActive; btn.onclick = () => onAccept(q.id); }
      row.appendChild(btn);
      list.appendChild(row);
    }
  }

  renderBank(bank, inventory, page, pageCount, onTransfer, equipment) {
    const PAGE_SIZE = 30;
    const rerender = () => this.renderBank(bank, inventory, page, pageCount, onTransfer, equipment);
    this._gctx = { rerender, slotsOf: (sc) => (sc === 'bank' ? bank.slots : sc === 'inv' ? inventory.slots : null), move: (fs, fi, ts, ti) => this.onMoveItem && this.onMoveItem(fs, fi, ts, ti), transfer: (sc, i) => onTransfer(sc, i) };
    const drawGrid = (elId, slots, startIdx, onTap, scope) => {
      const grid = this.q(elId);
      grid.innerHTML = '';
      this.gest.bind(grid);
      slots.forEach((slot, i) => {
        const cell = document.createElement('button');
        cell.className = 'inv-cell';
        cell.dataset.scope = scope; cell.dataset.i = startIdx + i;
        if (slot) {
          const view = resolveItem(slot);
          cell.style.borderColor = view.rarityInfo.color;
          cell.style.boxShadow = rarityGlow(view.rarityInfo).box;
          cell.innerHTML = `<span class="inv-icon">${view.icon}</span>${slot.qty > 1 ? `<span class="inv-qty">${slot.qty}</span>` : ''}`;
          cell.onclick = () => onTap(startIdx + i);
          if (this.ms.on) this._msDecorate(cell, scope, startIdx + i, rerender);
        }
        grid.appendChild(cell);
      });
    };
    const pageSlots = bank.slots.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    drawGrid('#bank-grid', pageSlots, page * PAGE_SIZE, (idx) => onTransfer('bank', idx), 'bank');
    drawGrid('#bank-inv-grid', inventory.slots, 0, (idx) => onTransfer('inv', idx), 'inv');
    this.ms.renderBar(this.q('#bank-sellbar'), [
      { scope: 'bank', slots: bank.slots, from: page * PAGE_SIZE, to: Math.min(bank.slots.length, page * PAGE_SIZE + PAGE_SIZE) },
      { scope: 'inv', slots: inventory.slots, from: 0, to: inventory.slots.length }
    ], rerender, (e) => this._doSellMany(e, rerender));
    this.q('#bank-page-label').textContent = `Page ${page + 1}/${pageCount}`;
    if (equipment) this.renderEquipMini('#bank-eq', equipment);
  }

  renderShop(npc, player, onBuy, inventory, isOwned) {
    this.q('#shop-title').textContent = npc.name;
    this.q('#shop-coins-val').textContent = player.coins;
    const list = this.q('#shop-list');
    list.innerHTML = '';
    for (const entry of npc.shop) {
      const def = ITEMS[entry.itemId];
      const row = document.createElement('div');
      row.className = 'shop-row';
      const owned = !!(isOwned && POTION_INFO[entry.itemId] && isOwned(entry.itemId));
      const afford = player.coins >= entry.price && !owned;
      const perm = POTION_INFO[entry.itemId] ? `<br><small>Permanente · recharge ${potionCooldown(entry.itemId)} s · ${def.desc || ''}</small>` : '';
      row.innerHTML = `
        <span class="inv-icon" style="border-color:${RARITY[def.rarity]?.color || '#666'}">${def.icon}</span>
        <div class="shop-info"><b>${def.name}</b><br><span style="color:${RARITY[def.rarity]?.color}">${RARITY[def.rarity]?.label}</span>${perm}</div>
        <button class="shop-buy" ${afford ? '' : 'disabled'}>${owned ? 'Possédée ✓' : entry.price + ' 🪙'}</button>
      `;
      row.querySelector('.shop-buy').onclick = () => onBuy(entry);
      list.appendChild(row);
    }
    // V10.21 : vente groupée chez le vendeur (mode de sélection toujours actif)
    const sellBox = this.q('#shop-sell');
    if (sellBox) sellBox.classList.toggle('hidden', !inventory);
    if (inventory) {
      this.ms.on = true;
      const rerender = () => this.renderShop(npc, player, onBuy, inventory, isOwned);
      const grid = this.q('#shop-sell-grid');
      grid.innerHTML = '';
      inventory.slots.forEach((slot, i) => {
        const cell = document.createElement('button');
        cell.className = 'inv-cell';
        if (slot) {
          const view = resolveItem(slot);
          cell.style.borderColor = view.rarityInfo.color;
          cell.style.boxShadow = rarityGlow(view.rarityInfo).box;
          cell.innerHTML = `<span class="inv-icon">${view.icon}</span>${slot.qty > 1 ? `<span class="inv-qty">${slot.qty}</span>` : ''}`;
          cell.title = `${view.name} — ${(view.isGenerated ? view.value : view.value * slot.qty).toLocaleString('fr-FR')} 🪙`;
          this._msDecorate(cell, 'inv', i, rerender);
        }
        grid.appendChild(cell);
      });
      this.ms.renderBar(this.q('#shop-sellbar'), [{ scope: 'inv', slots: inventory.slots, from: 0, to: inventory.slots.length }], rerender, (e) => this._doSellMany(e, rerender), true);
    }
  }

  // V10.21 : en mode sélection, toucher une case la (dé)sélectionne au lieu de l'ouvrir
  _msDecorate(cell, scope, index, rerender) {
    const on = this.ms.isSel(scope, index);
    cell.classList.toggle('ms-sel', !!on);
    if (on) cell.insertAdjacentHTML('beforeend', '<span class="ms-check">✓</span>');
    cell.onclick = () => { this.ms.toggle(scope, index); rerender(); };
  }
  _doSellMany(entries, rerender) {
    if (!entries.length) return;
    if (this.onSellMany) this.onSellMany(entries);
    this.ms.clearSel();
    rerender();
  }

  // ---------- Réseau : chat, groupe, statut de connexion ----------
  initChat(onSend) {
    this._chatLines = this._chatLines || { general: [], group: [] }; // conserve les messages reçus avant le début de la partie
    this._chatChannel = 'general';
    for (const tab of this.root.querySelectorAll('.chat-tab')) {
      tab.addEventListener('click', () => {
        this.root.querySelectorAll('.chat-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this._chatChannel = tab.dataset.chan;
        this._renderChatLog();
      });
    }
    const form = this.q('#chat-form'), input = this.q('#chat-input');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      onSend(this._chatChannel, text);
    });
  }

  toggleChat() {
    const panel = this.q('#chat-panel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) this.q('#chat-input').focus();
  }

  appendChat({ channel = 'general', from, to, text, system, whisper, self }) {
    const target = channel === 'group' ? 'group' : 'general';
    const line = { from, to, text, system, whisper, self };
    this._chatLines = this._chatLines || { general: [], group: [] };
    this._chatLines[target].push(line);
    if (this._chatLines[target].length > 60) this._chatLines[target].shift();
    if (this._chatChannel === undefined) return;
    if (this._chatChannel === target) this._renderChatLog();
    else this._flashChatTab(target);
  }

  _flashChatTab(target) {
    const tab = this.root.querySelector(`.chat-tab[data-chan="${target}"]`);
    tab?.classList.add('flash');
    setTimeout(() => tab?.classList.remove('flash'), 1500);
  }

  _renderChatLog() {
    const log = this.q('#chat-log');
    log.innerHTML = '';
    for (const line of this._chatLines[this._chatChannel]) {
      const el = document.createElement('div');
      el.className = 'chat-line' + (line.system ? ' chat-system' : '') + (line.whisper ? ' chat-whisper' : '');
      if (line.system) el.textContent = line.text;
      else if (line.whisper) el.textContent = `${line.self ? '→ ' + line.to : line.from + ' →'} ${line.text}`;
      else el.innerHTML = `<b>${line.from}:</b> ${line.text}`;
      log.appendChild(el);
    }
    log.scrollTop = log.scrollHeight;
  }

  setNetStatus(connected) {
    this.q('#net-status').classList.toggle('hidden', connected);
  }

  renderParty(rows) {
    const el = this.q('#party-frame');
    if (!rows || !rows.length) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = rows.map((r) => `
      <div class="party-row">
        <span class="party-name">${r.name} <small>Nv.${r.level}</small></span>
        <div class="bar hp party-hp"><div class="fill" style="width:${Math.max(0, Math.min(1, r.hp / Math.max(1, r.maxHp))) * 100}%"></div></div>
        <span class="party-dist">${r.dist != null ? Math.round(r.dist) + 'm' : ''}</span>
      </div>
    `).join('');
  }

  // ---------- Compte (ÉTAPE 6) ----------
  initAccountScreen(onSubmit) {
    this._accMode = 'login';
    for (const tab of this.root.querySelectorAll('.acc-tab')) {
      tab.addEventListener('click', () => {
        this.root.querySelectorAll('.acc-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this._accMode = tab.dataset.mode;
        this.q('#account-submit').textContent = this._accMode === 'login' ? 'Se connecter' : 'Créer le compte';
        this.q('#account-error').textContent = '';
      });
    }
    this.q('#account-submit').addEventListener('click', () => {
      const username = this.q('#acc-username').value.trim();
      const password = this.q('#acc-password').value;
      onSubmit(this._accMode, username, password);
    });
  }

  setAccountError(text) { this.q('#account-error').textContent = text || ''; }

  setAccountState(username) {
    const loggedIn = !!username;
    this.q('#account-logged-in').classList.toggle('hidden', !loggedIn);
    this.q('#account-form-wrap').classList.toggle('hidden', loggedIn);
    if (loggedIn) this.q('#account-name-display').textContent = username;
    this.q('#account-status').textContent = loggedIn ? `Connecté : ${username}` : 'Mode invité';
  }

  // Mini-carte (V3.4). Par défaut la carte tourne : la flèche pointe toujours vers le haut (devant le joueur).
  // 🧭 : carte fixe nord en haut (la flèche tourne) ; toucher la carte : zoom 45 / 70 / 110 m.
  // Repère monde : « devant » = (sin yaw, cos yaw) ; sur la carte x → droite, z → bas, donc le nord est en haut.
  drawMinimap(player, world, enemies, npcs, questSpots, extra = {}) {
    const now = performance.now();
    if (now - (this._mmT || 0) < 30) return; // ~30 i/s : largement assez, et ça ménage le téléphone
    this._mmT = now;
    const c = this._mmCanvas || (this._mmCanvas = this.q('#minimap'));
    const g = this._mmCtx || (this._mmCtx = c.getContext('2d'));
    const S = c.width, H = S / 2, TAU = Math.PI * 2;
    const range = this._mmRange || 70;
    const rot = this._mmRotate !== false;
    const th = rot ? player.yaw - Math.PI : 0;       // rotation de la carte
    const cs = Math.cos(th), sn = Math.sin(th);
    const k = H / range;                              // pixels par mètre
    const px0 = player.pos.x, pz0 = player.pos.z;
    if (extra.zone && extra.zone !== this._mmZone) { this._mmZone = extra.zone; this.q('#minimap-zone').textContent = extra.zone; }

    if (!this._mmGrad) {
      const vig = g.createRadialGradient(H, H, H * 0.62, H, H, H);
      vig.addColorStop(0, 'rgba(6,10,20,0)'); vig.addColorStop(1, 'rgba(6,10,20,0.55)');
      const cone = g.createRadialGradient(H, H, 4, H, H, H * 0.8);
      cone.addColorStop(0, 'rgba(94,230,208,0.42)'); cone.addColorStop(1, 'rgba(94,230,208,0)');
      this._mmGrad = { vig, cone };
    }

    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(H, H, H - 1, 0, TAU); g.clip();
    g.fillStyle = '#0c1424'; g.fillRect(0, 0, S, S);
    const mc = world.mapCanvas;
    if (mc) {
      const ws = world.size || 400;
      const px = (px0 / ws + 0.5) * mc.width, pz = (pz0 / ws + 0.5) * mc.height;
      const zx = (range / ws) * mc.width, zz = (range / ws) * mc.height;
      g.save(); g.translate(H, H); g.rotate(th);
      try { g.drawImage(mc, px - zx, pz - zz, zx * 2, zz * 2, -H, -H, S, S); } catch (e) { /* hors carte */ }
      g.restore();
    }
    g.fillStyle = this._mmGrad.vig; g.fillRect(0, 0, S, S);

    const sx = (wx, wz) => { const dx = (wx - px0) * k, dz = (wz - pz0) * k; return H + dx * cs - dz * sn; };
    const sy = (wx, wz) => { const dx = (wx - px0) * k, dz = (wz - pz0) * k; return H + dx * sn + dz * cs; };

    if (extra.under) extra.under(g, sx, sy, k, H);

    // ennemis : points rouges (un seul tracé)
    g.fillStyle = '#ff5a4a';
    g.beginPath();
    const lim = (H - 4) * (H - 4);
    for (const e of enemies) {
      if (!e.alive) continue;
      const x = sx(e.pos.x, e.pos.z), y = sy(e.pos.x, e.pos.z);
      const ddx = x - H, ddy = y - H;
      if (ddx * ddx + ddy * ddy > lim) continue;
      g.moveTo(x + 2.4, y); g.arc(x, y, 2.4, 0, TAU);
    }
    g.fill();

    // autres joueurs : groupe = vert (plus gros, avec contour), autres = bleu clair ; accrochés au bord si hors de portée
    if (extra.players && extra.players.length) {
      for (const o of extra.players) {
        let x = sx(o.x, o.z), y = sy(o.x, o.z);
        const ddx = x - H, ddy = y - H, d = Math.hypot(ddx, ddy), maxR = H - 8;
        const far = d > maxR;
        if (far) { if (!o.group) continue; x = H + (ddx / d) * maxR; y = H + (ddy / d) * maxR; }
        g.globalAlpha = far ? 0.8 : 1;
        g.fillStyle = o.group ? '#7dff9a' : '#8fd3ff'; g.strokeStyle = 'rgba(6,12,22,0.95)'; g.lineWidth = 1.6;
        g.beginPath(); g.arc(x, y, o.group ? 4.6 : 3.4, 0, TAU); g.fill(); g.stroke();
        g.globalAlpha = 1;
      }
    }

    // PNJ : losanges dorés
    g.fillStyle = '#f2cf6e'; g.strokeStyle = 'rgba(10,14,28,0.85)'; g.lineWidth = 1.2;
    for (const n of npcs) {
      const x = sx(n.pos.x, n.pos.z), y = sy(n.pos.x, n.pos.z);
      const ddx = x - H, ddy = y - H;
      if (ddx * ddx + ddy * ddy > lim) continue;
      g.beginPath(); g.moveTo(x, y - 4.5); g.lineTo(x + 3.6, y); g.lineTo(x, y + 4.5); g.lineTo(x - 3.6, y); g.closePath(); g.fill(); g.stroke();
    }

    // V10.14 — petites images : boutiques, écurie, banque, événement, coffres, gobelin, boss… (extra.icons = [{ x, z, ch, edge?, pulse? }])
    if (extra.icons && extra.icons.length) {
      g.font = '11px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const ic of extra.icons) {
        let x = sx(ic.x, ic.z), y = sy(ic.x, ic.z);
        const ddx = x - H, ddy = y - H, d = Math.hypot(ddx, ddy), maxR = H - 12;
        let far = false;
        if (d > maxR) { if (!ic.edge) continue; x = H + (ddx / d) * maxR; y = H + (ddy / d) * maxR; far = true; }
        if (ic.small) { g.fillStyle = ic.color || '#ff9a3c'; g.strokeStyle = 'rgba(8,12,24,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, 3.3, 0, TAU); g.fill(); g.stroke(); continue; } // petit point : bonbons (nombreux)
        g.globalAlpha = far ? 0.8 : 1;
        if (ic.pulse) { g.strokeStyle = 'rgba(255,214,90,' + (0.35 + 0.35 * Math.sin(now / 200)) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 9.5 + Math.sin(now / 200) * 1.2, 0, TAU); g.stroke(); }
        g.fillStyle = 'rgba(8,12,24,0.84)'; g.strokeStyle = ic.color || 'rgba(226,184,102,0.75)'; g.lineWidth = 1.2;
        g.beginPath(); g.arc(x, y, 7.2, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#fff'; g.fillText(ic.ch, x, y + 0.8);
        g.globalAlpha = 1;
      }
    }

    // marqueurs qui restent accrochés au bord quand ils sont hors de portée (portails, quêtes)
    const edge = (wx, wz, draw) => {
      let x = sx(wx, wz), y = sy(wx, wz);
      let ddx = x - H, ddy = y - H;
      const d = Math.hypot(ddx, ddy), maxR = H - 11;
      let clamped = false;
      if (d > maxR) { x = H + (ddx / d) * maxR; y = H + (ddy / d) * maxR; clamped = true; }
      draw(x, y, clamped);
    };
    for (const p of extra.portals || []) {
      const wd = Math.hypot(p.x - px0, p.z - pz0);
      if (wd > 170) continue;
      edge(p.x, p.z, (x, y, clamped) => {
        g.globalAlpha = clamped ? 0.75 : 1;
        g.fillStyle = 'rgba(8,12,24,0.8)'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill();
        g.strokeStyle = p.color || '#9fe0ff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 4.6, 0, TAU); g.stroke();
        g.fillStyle = p.color || '#9fe0ff'; g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill();
        g.globalAlpha = 1;
      });
    }
    for (const q of questSpots || []) {
      edge(q.x, q.z, (x, y) => {
        g.fillStyle = 'rgba(8,12,24,0.8)'; g.beginPath(); g.arc(x, y, 6.5, 0, TAU); g.fill();
        g.fillStyle = '#ffd23f'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', x, y + 0.5);
      });
    }

    // cône de vision + flèche du joueur
    const aTheta = rot ? 0 : Math.PI - player.yaw; // la flèche « haut » tournée de π − yaw regarde devant le joueur
    const ang = aTheta - Math.PI / 2;
    g.fillStyle = this._mmGrad.cone;
    g.beginPath(); g.moveTo(H, H); g.arc(H, H, H * 0.8, ang - 0.6, ang + 0.6); g.closePath(); g.fill();
    g.restore();

    g.save();
    g.translate(H, H); g.rotate(aTheta);
    const pulse = 11.5 + Math.sin(now / 320) * 1.2;
    g.strokeStyle = 'rgba(94,230,208,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, pulse, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(0, 1, 8.5, 0, TAU); g.fill();
    g.lineJoin = 'round';
    g.beginPath(); g.moveTo(0, -11); g.lineTo(7.5, 8); g.lineTo(0, 4); g.lineTo(-7.5, 8); g.closePath();
    g.fillStyle = '#f2fffc'; g.fill();
    g.beginPath(); g.moveTo(0, -11); g.lineTo(0, 4); g.lineTo(-7.5, 8); g.closePath();
    g.fillStyle = '#4fd8c4'; g.fill();
    g.beginPath(); g.moveTo(0, -11); g.lineTo(7.5, 8); g.lineTo(0, 4); g.lineTo(-7.5, 8); g.closePath();
    g.strokeStyle = '#0a1620'; g.lineWidth = 1.6; g.stroke();
    g.restore();

    // lunette : graduations + points cardinaux (N en rouge-orangé)
    g.save();
    g.strokeStyle = 'rgba(226,184,102,0.75)'; g.lineWidth = 1.4;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + th, ca = Math.cos(a), sa = Math.sin(a);
      g.moveTo(H + ca * (H - 2), H + sa * (H - 2)); g.lineTo(H + ca * (H - (i % 2 ? 6 : 9)), H + sa * (H - (i % 2 ? 6 : 9)));
    }
    g.stroke();
    const R = H - 14;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 10px sans-serif';
    const card = [['N', sn, -cs, '#ff8466'], ['E', cs, sn, '#e9dfc6'], ['S', -sn, cs, '#e9dfc6'], ['W', -cs, -sn, '#e9dfc6']];
    for (const [ch, vx, vy, col] of card) {
      const x = H + vx * R, y = H + vy * R;
      g.fillStyle = 'rgba(8,12,24,0.78)'; g.beginPath(); g.arc(x, y, ch === 'N' ? 7.5 : 6, 0, TAU); g.fill();
      g.fillStyle = col; g.fillText(ch, x, y + 0.5);
    }
    g.restore();
  }
}
