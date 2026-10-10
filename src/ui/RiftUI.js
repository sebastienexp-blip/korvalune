import { MODES, GEMS, GEM_IDS, GAMBLE, riftMults, themeFor, dangerLabel, gemEffect, gemUpgradeChance, fmtTime, ZENITH_TIME, RIFT_MAX_LEVEL, riftLootShift } from '../rift/RiftData.js';
import { getRarity } from '../data/rarities.js';

const PRESETS = [1, 10, 25, 50, 100, 150, 200, 300, 500, 750, 999];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Interface des spires : écran de la statue (4 onglets), HUD de spire et écran de fin.
export class RiftUI {
  constructor(hud, rift) {
    this.hud = hud; this.rift = rift;
    this.q = (s) => hud.q(s);
    this.screen = this.q('#rift-screen');
    this.result = this.q('#rift-result');
    this.hudEl = this.q('#rift-hud');
    this.tab = 'rift';
    this.mode = 'ascent';
    this.level = Math.max(1, Math.min(RIFT_MAX_LEVEL, rift.g.player.level));
    this.lastGamble = null;
    this._hudCache = '';
    this.screen.addEventListener('click', (e) => this._onClick(e));
    this.result.addEventListener('click', (e) => this._onClick(e));
    this.screen.addEventListener('input', (e) => {
      if (e.target.id === 'rf-range') { this.level = +e.target.value; this._refreshLevel(); }
    });
  }

  // ------------------------------------------------------------------ écran de la statue
  openStatue() {
    this.lastGamble = null;
    this.render();
  }

  render() {
    const m = this.rift.getModel(), d = m.data;
    const tabs = [['rift', '🌀 Spires'], ['gems', '💎 Cristaux'], ['shop', '✨ Éther & sceaux'], ['rec', '🏆 Records'], ['board', '🏅 Classement']];
    this.screen.innerHTML = `
      <h2>Statue de la Spire</h2>
      <div class="rf-res">
        <span title="Sceaux de spire">🗝 <b>${d.keys}</b> sceau${d.keys > 1 ? "x" : ""}</span>
        <span title="Sceaux du zénith">🔱 <b>${d.zkeys}</b> sceau${d.zkeys > 1 ? "x" : ""} du zénith</span>
        <span title="Poussière d’éther">✨ <b>${d.shards}</b> poussière</span>
      </div>
      <div class="rf-tabs">${tabs.map(([id, n]) => `<button class="rf-tab${this.tab === id ? ' on' : ''}" data-rf="tab:${id}">${n}</button>`).join('')}</div>
      <div class="rf-body" id="rf-body">${this._body(m)}</div>
      <button data-act="close-rift" class="rf-close">Fermer</button>`;
    this._refreshLevel();
  }

  _body(m) {
    if (this.tab === 'gems') return this._gemsHtml(m);
    if (this.tab === 'shop') return this._shopHtml(m);
    if (this.tab === 'rec') return this._recHtml(m);
    if (this.tab === 'board') return this._boardHtml();
    return this._riftHtml(m);
  }

  _riftHtml(m) {
    if (m.pending) {
      const mode = MODES[m.pending.modeId];
      return `<div class="rf-card rf-open">
        <div class="rf-big">${mode.icon} ${esc(mode.name)}</div>
        <p>Niveau <b>${m.pending.level}</b> — le portail est ouvert à côté de la statue.</p>
        <p class="rf-sub">Approchez-vous du portail pour entrer.</p>
        <button class="btn-primary" data-rf="close">Aller au portail</button>
        <button class="rf-ghost" data-rf="cancel">Annuler la spire (sceau rendu)</button>
      </div>`;
    }
    const mode = MODES[this.mode];
    const modeBtns = Object.values(MODES).map((x) => `<button class="rf-mode${x.id === this.mode ? ' on' : ''}" data-rf="mode:${x.id}"><span class="rf-mi">${x.icon}</span><b>${esc(x.name)}</b><small>${x.key ? (x.key === 'keys' ? `🗝 ${m.data.keys}` : `🔱 ${m.data.zkeys}`) : 'Gratuit'}</small></button>`).join('');
    return `
      <div class="rf-modes">${modeBtns}</div>
      <p class="rf-desc">${esc(mode.desc)}</p>
      <div class="rf-level">
        <button data-rf="lv:-100">−100</button><button data-rf="lv:-10">−10</button><button data-rf="lv:-1">−1</button>
        <div class="rf-lvnum"><small>Niveau de difficulté</small><b id="rf-lv">${this.level}</b><small>de 1 à ${RIFT_MAX_LEVEL}</small></div>
        <button data-rf="lv:1">+1</button><button data-rf="lv:10">+10</button><button data-rf="lv:100">+100</button>
      </div>
      <input id="rf-range" type="range" min="1" max="${RIFT_MAX_LEVEL}" value="${this.level}" aria-label="Niveau de la spire" />
      <div class="rf-presets">${PRESETS.map((n) => `<button data-rf="set:${n}">${n}</button>`).join('')}<button data-rf="set:me" class="me">Mon niveau (${m.playerLevel})</button></div>
      <div id="rf-info" class="rf-info"></div>
      <button id="rf-go" class="btn-primary" data-rf="open"></button>`;
  }

  _refreshLevel() {
    const lv = this.q('#rf-lv'); if (!lv) return;
    const m = this.rift.getModel(), mode = MODES[this.mode];
    lv.textContent = this.level;
    const range = this.q('#rf-range'); if (range && +range.value !== this.level) range.value = this.level;
    const mult = riftMults(mode.id, this.level), th = themeFor(this.level), dg = dangerLabel(this.level, m.playerLevel);
    const rows = [
      ['Niveau des monstres', `<b>${this.level}</b>`],
      ['Danger pour vous', `<b style="color:${dg.color}">${dg.text}</b>`],
      ['Univers', esc(th.name.replace('Spires ', 'Spire ').replace('Spire des', 'Spire des'))],
      ['Vie des monstres', `×${mult.hp.toFixed(2)}`],
      ['Dégâts des monstres', `×${mult.dmg.toFixed(2)}`],
      ['Temps', mode.timed ? fmtTime(ZENITH_TIME) : 'Illimité'],
      ['Récompenses', mode.rewards ? `XP ×${mult.xp}, butin ×${mult.loot}` : 'Aucune'],
      ['Raretés élevées', mode.rewards ? `plus fréquentes (+${riftLootShift(this.level).toFixed(1)} paliers)` : '—'],
      ['Coût', mode.key ? `1 ${esc(mode.keyName.toLowerCase())} (vous : ${m.data[mode.key]})` : 'Gratuit']
    ];
    this.q('#rf-info').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('');
    const go = this.q('#rf-go');
    const ok = !mode.key || m.data[mode.key] > 0;
    go.disabled = !ok;
    go.textContent = ok ? `Ouvrir : ${mode.id === 'trial' ? 'spire d’entraînement' : mode.name.toLowerCase()} — niveau ${this.level}` : `Il vous faut un ${mode.keyName.toLowerCase()}`;
    this.screen.querySelectorAll('.rf-presets button').forEach((b) => b.classList.toggle('on', b.dataset.rf === `set:${this.level}`));
  }

  _gemsHtml(m) {
    const d = m.data;
    const pend = d.pending > 0
      ? `<div class="rf-card rf-pend">✨ Amélioration disponible : <b>+${d.pending} rang${d.pending > 1 ? 's' : ''}</b> (Zénith niveau ${d.pendingLevel}). Choisissez un cristal.</div>`
      : `<p class="rf-desc">Finissez une <b>Zénith</b> pour améliorer un cristal : en 15 min = +1 rang, en 10 min = +2, en 5 min = +3. Si la spire est de niveau inférieur au rang de la cristal, la réussite baisse de 10 % par niveau d’écart.</p>`;
    const rows = GEM_IDS.map((id) => {
      const gm = GEMS[id], r = d.gems[id];
      const chance = d.pending > 0 ? Math.round(gemUpgradeChance(r, d.pendingLevel) * 100) : null;
      return `<div class="rf-gem" style="--gc:${gm.color}">
        <div class="rf-gi">${gm.icon}</div>
        <div class="rf-gt"><b>${esc(gm.name)}</b><small>Rang ${r} — ${gm.desc(r)}</small></div>
        ${d.pending > 0 ? `<button data-rf="gem:${id}">Améliorer<small>${chance} %</small></button>` : ''}
      </div>`;
    }).join('');
    return `${pend}<div class="rf-gems">${rows}</div>`;
  }

  _shopHtml(m) {
    const d = m.data;
    let last = '';
    if (this.lastGamble) {
      const r = getRarity(this.lastGamble.rarityTier);
      last = `<div class="rf-card rf-last">Dernier objet : <b style="color:${r.color}">${esc(this.lastGamble.icon || '')} ${esc(this.lastGamble.name)}</b> <small>(${esc(r.name)} · niv. ${this.lastGamble.itemLevel})</small></div>`;
    }
    return `
      <div class="rf-sec">✨ Marchande d’éther</div>
      <p class="rf-desc">Dépensez votre poussière d’éther pour un objet mystère de votre niveau — la rareté est un pari. La poussière provient des Gardiens et des élites.</p>
      <div class="rf-gamble">${GAMBLE.map((c) => `<button data-rf="gamble:${c.id}" ${d.shards < c.cost ? 'disabled' : ''}><span class="rf-mi">${c.icon}</span><b>${c.name}</b><small>${c.cost} 🩸</small></button>`).join('')}</div>
      ${last}
      <div class="rf-sec">🗝 Forge de sceaux</div>
      <div class="rf-forge">
        <button data-rf="buykey" ${m.coins < m.keyPrice ? 'disabled' : ''}>Acheter un sceau de spire<small>${m.keyPrice} 🪙 (vous : ${m.coins} 🪙)</small></button>
        <button data-rf="craft" ${d.keys < m.craftCost ? 'disabled' : ''}>Forger un sceau du zénith<small>${m.craftCost} sceaux de spire → 1 sceau du zénith</small></button>
      </div>
      <p class="rf-desc">Les sceaux tombent aussi sur les élites et les boss, et l’Ascension récompense chaque victoire d’un sceau (et parfois d’un sceau du zénith).</p>`;
  }

  // V10.29 — classement : meilleurs niveaux de spire atteints par les joueurs
  setBoard(msg) { this.board = msg; if (this.tab === 'board' && !this.screen.classList.contains('hidden')) this.render(); }
  _boardHtml() {
    const mode = this.boardMode || 'asc', b = this.board, d = this.rift.getModel().data;
    const CI = { warrior: '⚔️', paladin: '🛡️', mage: '🔮', archer: '🏹', assassin: '🗡️' };
    const tabs = `<div class="rf-modes"><button class="rf-mode${mode === 'asc' ? ' on' : ''}" data-rf="boardmode:asc"><b>🌀 Ascension</b></button><button class="rf-mode${mode === 'zen' ? ' on' : ''}" data-rf="boardmode:zen"><b>🔱 Zénith</b></button></div>`;
    if (!b) return `${tabs}<p class="rf-desc">Chargement du classement… (il faut être connecté à ton compte)</p>`;
    const rows = (mode === 'asc' ? b.asc : b.zen) || [];
    const me = mode === 'asc' ? d.bestAscent : d.bestZenith.level;
    const list = rows.length ? rows.map((r, i) => `<div class="rf-hist ${i < 3 ? 'ok' : ''}"><span>${i < 3 ? ['🥇', '🥈', '🥉'][i] : '#' + (i + 1)}</span><span>${CI[r.cls] || ''} ${esc(r.name)}</span><span>Niv. ${mode === 'asc' ? r.asc : r.zl}</span><span>${mode === 'asc' ? 'perso ' + r.lvl : fmtTime(r.zt)}</span></div>`).join('') : '<p class="rf-desc">Personne n’a encore de record.</p>';
    return `${tabs}<p class="rf-desc">Ton record : <b>${me ? 'niveau ' + me : '—'}</b> (sur 999). Le classement se met à jour toutes les 20 secondes.</p><div class="rf-histlist">${list}</div>`;
  }

  _recHtml(m) {
    const d = m.data;
    const hist = d.history.length
      ? d.history.map((h) => `<div class="rf-hist ${h.ok ? 'ok' : 'ko'}"><span>${MODES[h.mode].icon} ${esc(MODES[h.mode].name)}</span><span>Niv. ${h.level}</span><span>${fmtTime(h.time)}</span><span>${h.ok ? '✔ Réussie' : '✖ Échec'}</span></div>`).join('')
      : '<p class="rf-desc">Aucune spire pour l’instant.</p>';
    return `
      <div class="rf-records">
        <div><small>Meilleure Ascension</small><b>${d.bestAscent ? 'Niveau ' + d.bestAscent : '—'}</b></div>
        <div><small>Meilleure Zénith</small><b>${d.bestZenith.level ? 'Niveau ' + d.bestZenith.level + ' · ' + fmtTime(d.bestZenith.time) : '—'}</b></div>
      </div>
      <div class="rf-sec">Dernières spires</div>
      <div class="rf-histlist">${hist}</div>
      <div class="rf-sec">Règles</div>
      <p class="rf-desc">Remplissez la jauge de progression en tuant des monstres (les élites comptent plus), puis battez le Gardien. Obélisques, totems, perles de vie, Ferveur d’éther, coffres piégés et lutins trésor vous aident en chemin. Mourir vous ramène au dernier point de contrôle ; le chronomètre ne s’arrête pas.</p>`;
  }

  _onClick(e) {
    const el = e.target.closest?.('[data-rf]');
    if (!el || el.disabled) return;
    const [cmd, arg] = el.dataset.rf.split(':');
    const r = this.rift, g = r.g;
    switch (cmd) {
      case 'tab': this.tab = arg; if (arg === 'board') { this.board = null; this.rift.g.net.riftBoard(); } this.render(); break;
      case 'boardmode': this.boardMode = arg; this.render(); break;
      case 'mode': this.mode = arg; this.render(); break;
      case 'lv': this.level = Math.max(1, Math.min(RIFT_MAX_LEVEL, this.level + (+arg))); this._refreshLevel(); break;
      case 'set': this.level = arg === 'me' ? Math.max(1, Math.min(RIFT_MAX_LEVEL, g.player.level)) : +arg; this._refreshLevel(); break;
      case 'open': if (r.open(this.mode, this.level)) g._closeModal(); else this.render(); break;
      case 'close': g._closeModal(); break;
      case 'cancel': r.cancelPending(); this.render(); break;
      case 'gem': { const res = r.upgradeGem(arg); if (this.result && !this.result.classList.contains('hidden')) this._renderGemPick(res); this.render(); break; }
      case 'gamble': this.lastGamble = r.gamble(arg) || this.lastGamble; this.render(); break;
      case 'buykey': r.buyKey(); this.render(); break;
      case 'craft': r.craftZenithKey(); this.render(); break;
      case 'rgem': { const res = r.upgradeGem(arg); this._gemResult = res; this._renderGemPick(res); break; }
      case 'result-stay': g._closeModal(); break;
      case 'result-exit': g._closeModal(); r.exit(); break;
      default: break;
    }
  }

  // ------------------------------------------------------------------ HUD en spire
  showHud(on) {
    this.hudEl.classList.toggle('hidden', !on);
    this.q('#game-ui').classList.toggle('rift-on', !!on);
    this._hudCache = '';
    if (!on) this.hudEl.innerHTML = '';
  }

  updateHud(h) {
    const key = `${h.title}|${h.pct}|${Math.floor(h.time)}|${h.buffs.map((b) => b.icon + Math.ceil(b.t)).join(',')}|${h.objective}|${h.deaths}|${h.guardian}|${h.done}`;
    if (key === this._hudCache) return;
    this._hudCache = key;
    const warn = h.timed && h.time < 60;
    this.hudEl.innerHTML = `
      <div class="rh-title">${esc(h.title)}</div>
      <div class="rh-bar${h.guardian ? ' guardian' : ''}${h.done ? ' done' : ''}"><div class="rh-fill" style="width:${(h.frac * 100).toFixed(1)}%"></div><span>${h.done ? 'Terminée' : h.guardian ? '👹 Gardien !' : h.pct + ' %'}</span></div>
      <div class="rh-row"><span class="rh-time${warn ? ' warn' : ''}">${h.timed ? '⏳' : '⏱'} ${fmtTime(h.time)}</span><span class="rh-kd">☠ ${h.deaths}</span></div>
      <div class="rh-obj">${esc(h.objective)}</div>
      ${h.buffs.length ? `<div class="rh-buffs">${h.buffs.map((b) => `<span class="rh-buff" title="${esc(b.name)}"><i>${b.icon}</i><b>${Math.ceil(b.t)}</b><u style="width:${Math.max(0, Math.min(1, b.frac)) * 100}%"></u></span>`).join('')}</div>` : ''}`;
  }

  // ------------------------------------------------------------------ fin de spire
  showResult(r) {
    const g = this.rift.g;
    document.exitPointerLock?.();
    g.modalOpen = true;
    g.hud.showScreen('rift-result');
    this._res = r;
    this._gemResult = null;
    const rw = r.rewards;
    const lines = [];
    if (r.mode.rewards) {
      lines.push(`✨ +${rw.xp} XP`, `🪙 +${rw.coins}`, `✨ +${rw.shards} poussière d’éther`);
      if (rw.keys) lines.push(`🗝 +${rw.keys} sceau de spire`);
      if (rw.zkeys) lines.push(`🔱 +${rw.zkeys} sceau du zénith`);
      lines.push(`🎁 ${rw.items} objets tombent au sol`);
    } else lines.push('Entraînement : aucune récompense.');
    const bracket = r.mode.id === 'zenith'
      ? `<div class="rf-brackets">${[['≤ 5:00', 3], ['≤ 10:00', 2], ['≤ 15:00', 1]].map(([t, n]) => `<span class="${rw.steps === n ? 'on' : ''}">${t} → +${n}</span>`).join('')}</div>` : '';
    this.result.innerHTML = `
      <h2>${r.mode.id === 'trial' ? 'Entraînement terminé' : 'Spire accomplie !'}</h2>
      <div class="rf-res"><span>${r.mode.icon} ${esc(r.mode.name)} · niveau <b>${r.level}</b></span></div>
      <div class="rf-records">
        <div><small>Temps</small><b>${fmtTime(r.elapsed)}</b></div>
        <div><small>Monstres tués</small><b>${r.kills}</b></div>
        <div><small>Morts</small><b>${r.deaths}</b></div>
      </div>
      <div class="rf-card rf-rewards">${lines.map((l) => `<div>${l}</div>`).join('')}</div>
      ${bracket}
      <div id="rf-gempick"></div>
      <div class="rf-endbtns">
        <button class="btn-primary" data-rf="result-exit">Retourner à Korvalune</button>
        <button class="rf-ghost" data-rf="result-stay">Rester ramasser le butin</button>
      </div>`;
    this._renderGemPick(null);
  }

  _renderGemPick(res) {
    const box = this.q('#rf-gempick'); if (!box) return;
    const d = this.rift.data;
    if (res) {
      box.innerHTML = `<div class="rf-card rf-pend">${res.gained ? `✨ Cristal améliorée : +${res.gained} rang${res.gained > 1 ? 's' : ''} !` : 'L’amélioration a échoué.'}</div>`;
      return;
    }
    if (d.pending > 0 && this._res?.mode.id === 'zenith') {
      box.innerHTML = `<div class="rf-sec">Améliorer un cristal (+${d.pending} rang${d.pending > 1 ? 's' : ''})</div>` + GEM_IDS.map((id) => {
        const gm = GEMS[id];
        return `<button class="rf-gempick" style="--gc:${gm.color}" data-rf="rgem:${id}">${gm.icon} ${esc(gm.name)} <small>rang ${d.gems[id]} · ${Math.round(gemUpgradeChance(d.gems[id], d.pendingLevel) * 100)} %</small></button>`;
      }).join('');
    } else box.innerHTML = '';
  }
}
