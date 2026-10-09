// V10.19 — Interface des ateliers : forge (réparation, emplacements, runes, démantèlement),
// Monolithe des Métamorphoses (refonte, élévation, panoplie, libération, pouvoirs, runes, matériaux) et mystique (enchantement, apparence).
// Une seule vue, générée en JS : onglets, liste d'objets, panneau d'action. Toute la logique est dans crafting/Crafting.js.
import * as C from '../crafting/Crafting.js';
import {
  MATS, RUNES, RUNE_BY_ID, SOCKET_CAP, LITANIES, CATEGORY_LABEL, slotCategory, durOf, durMaxOf, repairCost, salvageYield, clsIndex, socketCost, unsocketCost,
  insertCost, enchantCost, MAX_ENCH, tmogCost, reforgeCost, upgradeCost, convertSetCost, freeLevelCost, extractCost, fuseCost, FUSE_COUNT, engraveCost, engraveTierMax,
  DISTILL_IN, distillOut, fmtBonusMap, fmtBonus, MAT_BY_ID, POWER_SLOTS
} from '../data/crafting.js';
import { SLOT_LABELS } from '../inventory/Equipment.js';
import { getItem } from '../inventory/Item.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CLS_NAMES = ['Commun', 'Magique', 'Rare', 'Légendaire', 'Mythique', 'Absolu'];

const TABS = {
  forge: [['repair', '🔧 Réparer'], ['sockets', '⭕ Emplacements'], ['runes', '🔶 Runes'], ['salvage', '♻️ Démanteler']],
  monolith: [['reforge', '🔁 Refonte'], ['upgrade', '⬆️ Élévation'], ['set', '🧩 Panoplie'], ['free', '🔓 Libération'], ['power', '⚡ Pouvoirs'], ['rune', '🔶 Runes'], ['mats', '⚗️ Matériaux']],
  mystic: [['enchant', '🔮 Enchanter'], ['look', '🎨 Apparence']]
};
const TITLES = { forge: 'Forge de Korvalune', monolith: 'Monolithe des Métamorphoses', mystic: 'Mystique de Korvalune' };
const BLURB = {
  forge: 'Répare ton équipement, creuse des emplacements, sertis des runes ou démantèle ce qui ne sert plus.',
  monolith: 'Un artefact ancien : il refond, élève et transforme tes équipements, lie des pouvoirs et fusionne les runes.',
  mystic: 'Remplace une propriété d’un objet par une autre, ou change son apparence.'
};

export class Workshop {
  constructor(game) {
    this.g = game;
    this.root = game.root.querySelector('#workshop-screen');
    this.kind = 'forge'; this.tab = 'repair';
    this.sel = null;       // uid de l'objet choisi
    this.msg = null;       // { ok, text }
    this.proposal = null;  // enchantement en attente de choix
    this.pick = {};        // choix temporaires (matériaux à distiller, teinte, etc.)
    this.root.addEventListener('click', (e) => this._click(e));
  }

  open(kind, intro) {
    this.kind = kind; this.tab = TABS[kind][0][0]; this.sel = null; this.proposal = null; this.pick = {};
    this.msg = intro ? { ok: true, text: intro } : null;
    this.render();
  }
  get ctx() { return this.g._craftCtx(); }

  // ------------------------------------------------------------ rendu
  render() {
    if (!this.root) return;
    const ctx = this.ctx, p = ctx.player;
    const mats = MATS.map((m) => `<span class="ws-mat" title="${esc(m.name)}">${m.icon}<b>${C.countItem(ctx.inventory, m.id)}</b></span>`).join('');
    const tabs = TABS[this.kind].map(([id, label]) => `<button class="ws-tab${id === this.tab ? ' on' : ''}" data-ws="tab" data-v="${id}">${label}</button>`).join('');
    const msg = this.msg ? `<div class="ws-msg ${this.msg.ok ? 'ok' : 'ko'}">${esc(this.msg.text)}</div>` : '';
    let body = '';
    try { body = this['_t_' + this.tab](ctx); } catch (e) { console.warn('[V10.19] atelier', e); body = '<p class="ws-empty">Cet onglet est indisponible.</p>'; }
    this.root.innerHTML = `
      <h2>${esc(TITLES[this.kind])}</h2>
      <p class="ws-blurb">${esc(BLURB[this.kind])}</p>
      <div class="ws-bar"><span class="ws-coins">🪙 <b>${p.coins}</b></span>${mats}</div>
      <div class="ws-tabs">${tabs}</div>
      ${msg}
      <div class="ws-body">${body}</div>
      <button data-act="close-workshop">Partir</button>`;
  }

  // ------------------------------------------------------------ éléments communs
  _gear(ctx, opts, filter) { return C.listGear(ctx, opts).filter((x) => !filter || filter(x.gen, x)); }
  _desc(gen, view) {
    const bits = [`Niv. ${gen.itemLevel}`, CLS_NAMES[clsIndex(gen)]];
    if (gen.sockets) bits.push(`${(gen.gems || []).filter(Boolean).length}/${gen.sockets} ⭕`);
    const d = durOf(gen), m = durMaxOf(gen);
    if (d < m) bits.push(d <= 0 ? '💥 brisé' : `🔧 ${d}/${m}`);
    if (gen.ench) bits.push(`🔮×${gen.ench}`);
    return bits.join(' · ');
  }
  _row(x, selected, extra = '') {
    const { gen, view, ref } = x;
    const where = ref.where === 'eq' ? `<small class="ws-eq">équipé · ${esc(SLOT_LABELS[ref.slot] || '')}</small>` : '';
    return `<button class="ws-item${selected ? ' on' : ''}${view.broken ? ' broken' : ''}" data-ws="sel" data-v="${esc(gen.uid)}" style="border-color:${view.rarityInfo.color}">
      <span class="ws-ic">${esc(view.icon)}</span><span class="ws-nm"><b style="color:${view.rarityInfo.color}">${esc(view.name)}</b><small>${esc(this._desc(gen, view))}</small>${where}${extra}</span></button>`;
  }
  _list(items, empty) {
    if (!items.length) return `<p class="ws-empty">${empty}</p>`;
    return `<div class="ws-list">${items.map((x) => this._row(x, x.gen.uid === this.sel)).join('')}</div>`;
  }
  _cost(cost, ctx) {
    const miss = C.missing(ctx, cost);
    return `<span class="ws-cost${miss ? ' no' : ''}">${esc(C.costText(cost))}</span>`;
  }
  _btn(label, act, v, cost, ctx, extraData = '') {
    const miss = cost ? C.missing(ctx, cost) : null;
    return `<button class="ws-act" data-ws="${act}" data-v="${esc(v ?? '')}" ${extraData} ${miss ? 'data-miss="1"' : ''}>${label}${cost ? `<br>${this._cost(cost, ctx)}` : ''}</button>`;
  }
  _selected(ctx, list) { return list.find((x) => x.gen.uid === this.sel) || null; }

  // ------------------------------------------------------------ forge
  _t_repair(ctx) {
    const all = this._gear(ctx, {}, (g) => repairCost(g) > 0);
    const tot = C.repairAllCost(ctx);
    const rows = all.map((x) => this._row(x, false, `<span class="ws-line">${this._btn('Réparer', 'repair1', x.gen.uid, { gold: repairCost(x.gen), mats: {} }, ctx)}</span>`)).join('');
    return `${tot ? this._btn('Tout réparer', 'repairAll', '', { gold: tot, mats: {} }, ctx) : ''}
      <p class="ws-hint">L’équipement s’use quand tu subis des coups, en combattant, et perd 10 % de sa durabilité à chaque mort. À 0, il est brisé et ne donne plus rien.</p>
      ${all.length ? `<div class="ws-list">${rows}</div>` : '<p class="ws-empty">Tout ton équipement est en parfait état. ✔</p>'}`;
  }
  _t_sockets(ctx) {
    const all = this._gear(ctx, {}, (g) => (SOCKET_CAP[g.slot] || 0) > 0);
    const rows = all.map((x) => {
      const g = x.gen, cap = SOCKET_CAP[g.slot], full = (g.sockets || 0) >= cap;
      return this._row(x, false, `<span class="ws-line">Emplacements : ${'⭕'.repeat(g.sockets || 0)}${'·'.repeat(cap - (g.sockets || 0))} (${g.sockets || 0}/${cap}) ${full ? '<i>maximum</i>' : this._btn('Creuser', 'socket1', g.uid, socketCost(g), ctx)}</span>`);
    }).join('');
    return `<p class="ws-hint">Un emplacement permet de sertir une rune. Armes, plastrons : jusqu’à 3 ; casques, jambières, boucliers, bijoux : 2 ; autres pièces : 1. Garnis tous les emplacements avec les bonnes runes dans le bon ordre pour réveiller une <b>litanie</b> (bonus supplémentaire).</p>
      ${all.length ? `<div class="ws-list">${rows}</div>` : '<p class="ws-empty">Aucun équipement généré à améliorer.</p>'}`;
  }
  _t_runes(ctx) {
    const list = this._gear(ctx, {}, (g) => g.sockets > 0);
    const sel = this._selected(ctx, list);
    let panel = '';
    if (sel) {
      const g = sel.gen, cat = slotCategory(g.slot);
      const sock = Array.from({ length: g.sockets }, (_, i) => {
        const r = g.gems && g.gems[i] && RUNE_BY_ID[g.gems[i]];
        return r
          ? `<button class="ws-sock full" data-ws="unsock" data-v="${i}" style="border-color:${r.color}" title="Retirer"><span>🔶</span><small>${esc(r.short)}</small><small>${esc(fmtBonusMap(r.bonus[cat]))}</small></button>`
          : `<button class="ws-sock empty" data-ws="pickSock" data-v="${i}"><span>⭕</span><small>vide</small></button>`;
      }).join('');
      const lit = sel.view.litany;
      const hints = LITANIES.filter((l) => l.cat === cat && (!l.slots || l.slots.includes(g.slot)) && l.runes.length === g.sockets)
        .map((l) => `<div class="ws-lit${lit && lit.id === l.id ? ' on' : ''}"><b>${esc(l.name)}</b> — ${l.runes.map((r) => esc(RUNE_BY_ID['rune_' + r].short)).join(' + ')}<br><small>${esc(fmtBonusMap(l.bonus))}</small></div>`).join('');
      const runes = C.listRunes(ctx);
      const pickIdx = this.pick.sock;
      const picker = Number.isInteger(pickIdx) && !(g.gems && g.gems[pickIdx])
        ? `<div class="ws-sub">Choisis la rune à sertir (${this._cost(insertCost(g), ctx)} en plus) :</div>
           ${runes.length ? `<div class="ws-runes">${runes.map((x) => `<button class="ws-rune" data-ws="insert" data-v="${x.rune.id}" style="border-color:${x.rune.color}"><b>${esc(x.rune.short)}</b> ×${x.qty}<small>${esc(fmtBonusMap(x.rune.bonus[cat]))}</small></button>`).join('')}</div>` : '<p class="ws-empty">Tu n’as aucune rune. Elles tombent sur les monstres et dans les coffres, ou se gravent au Monolithe.</p>'}`
        : '<div class="ws-sub">Touche un emplacement vide pour sertir une rune, ou une rune sertie pour la retirer (' + esc(C.costText(unsocketCost(g))) + ').</div>';
      panel = `<div class="ws-panel"><h3>${esc(sel.view.name)}</h3><div class="ws-socks">${sock}</div>
        ${lit ? `<div class="ws-lit on">✨ Litanie active : <b>${esc(lit.name)}</b><br><small>${esc(fmtBonusMap(lit.bonus))}</small></div>` : ''}
        ${picker}${hints ? `<div class="ws-sub">Litanies possibles avec ${g.sockets} emplacement(s) :</div>${hints}` : ''}</div>`;
    }
    return `${this._list(list, 'Aucune pièce n’a d’emplacement. Creuses-en un dans l’onglet « Emplacements ».')}${panel}`;
  }
  _t_salvage(ctx) {
    const inv = this._gear(ctx, { eq: false }, (g) => true);
    const rows = inv.map((x) => {
      const ok = C.canSalvage(x.gen), y = salvageYield(x.gen);
      return this._row(x, false, `<span class="ws-line">${ok ? this._btn('Démanteler', 'salv1', x.gen.uid, null, ctx) : '<i>retire les runes d’abord</i>'}</span>`);
    }).join('');
    const bulk = [[0, 'Tous les Communs'], [1, 'Jusqu’aux Magiques'], [2, 'Jusqu’aux Rares']].map(([i, l]) => `<button class="ws-act" data-ws="salvBulk" data-v="${i}">${l}</button>`).join('');
    return `<p class="ws-hint">Détruit un objet de ton inventaire et en récupère des matériaux (Ferraille, Poussière, Essence, Cristal, Âme selon la rareté). Les panoplies et les pièces serties sont épargnées par le démantèlement groupé.</p>
      <div class="ws-bulk">${bulk}</div>
      ${inv.length ? `<div class="ws-list">${rows}</div>` : '<p class="ws-empty">Aucun équipement dans ton inventaire.</p>'}`;
  }

  // ------------------------------------------------------------ Monolithe
  _single(ctx, { filter, eqToo, empty, hint, action, label, costFn, extra }) {
    const list = this._gear(ctx, { eq: !!eqToo }, filter);
    const sel = this._selected(ctx, list);
    let panel = '';
    if (sel) {
      const cost = costFn(sel.gen);
      panel = `<div class="ws-panel"><h3>${esc(sel.view.name)}</h3>${extra ? extra(sel) : ''}${this._btn(label, action, sel.gen.uid, cost, ctx)}</div>`;
    }
    return `<p class="ws-hint">${hint}</p>${this._list(list, empty)}${panel}`;
  }
  _t_reforge(ctx) {
    return this._single(ctx, { filter: (g) => clsIndex(g) >= 1, eqToo: true, empty: 'Aucun objet Magique ou mieux à refondre.',
      hint: 'Retire au sort <b>toutes</b> les propriétés d’un objet (statistiques, affixes, effets) en gardant sa rareté, son niveau, ses emplacements et ses runes. Parfait pour viser de meilleurs jets.',
      action: 'reforge', label: '🔁 Refondre', costFn: reforgeCost });
  }
  _t_upgrade(ctx) {
    return this._single(ctx, { filter: (g) => clsIndex(g) >= 1 && clsIndex(g) < 5 && !g.setId, eqToo: true, empty: 'Aucun objet à élever (les panoplies ne le peuvent pas).',
      hint: 'Fait passer un objet à la rareté supérieure (Magique → Rare → Légendaire → Mythique → Absolu), avec de nouvelles propriétés. Famille d’arme, niveau, emplacements et runes sont conservés.',
      action: 'upgrade', label: '⬆️ Élever', costFn: upgradeCost,
      extra: (s) => { const u = C.upgradeInfo(s.gen); return u ? `<p>${esc(u.from.name)} → <b style="color:${u.to.color}">${esc(u.to.name)}</b></p>` : ''; } });
  }
  _t_set(ctx) {
    return this._single(ctx, { filter: (g) => !!g.setId, empty: 'Tu ne possèdes aucune pièce de panoplie dans ton inventaire.',
      hint: 'Transforme une pièce de panoplie (de ton inventaire) en une autre pièce de la même panoplie, tirée au hasard. Retire d’abord ses runes.',
      action: 'convertSet', label: '🧩 Transformer', costFn: convertSetCost });
  }
  _t_free(ctx) {
    return this._single(ctx, { filter: (g) => (g.levelReq || 1) > 1, eqToo: true, empty: 'Aucun objet n’a de niveau requis.',
      hint: 'Supprime le niveau requis d’un objet : tu peux le porter dès maintenant, quel que soit ton niveau. Ses statistiques ne changent pas.',
      action: 'freeLevel', label: '🔓 Libérer', costFn: freeLevelCost,
      extra: (s) => `<p>Niveau requis : ${s.gen.levelReq} → <b>1</b></p>` });
  }
  _t_power(ctx) {
    const cp = ctx.player.cubePowers || {};
    const slots = Object.entries(POWER_SLOTS).map(([cat, label]) => {
      const e = cp[cat];
      return `<div class="ws-pow"><b>${label}</b> : ${e ? `<span class="pow">${esc(e.name)}</span> <small>${Math.round(e.chance * 1000) / 10} % · recharge ${e.cooldown} s</small> <button class="ws-act small" data-ws="clearPow" data-v="${cat}">Dissiper</button>` : '<i>vide</i>'}</div>`;
    }).join('');
    const list = this._gear(ctx, { eq: false }, (g) => clsIndex(g) >= 3 && !g.setId && g.effects && g.effects.length);
    const sel = this._selected(ctx, list);
    let panel = '';
    if (sel) {
      const cat = slotCategory(sel.gen.slot);
      panel = `<div class="ws-panel"><h3>${esc(sel.view.name)}</h3><p>Pouvoir lié à l’emplacement <b>${POWER_SLOTS[cat]}</b>. <b>L’objet sera détruit.</b></p>` +
        sel.gen.effects.map((e, i) => this._btn(`⚡ ${esc(e.name)}`, 'extract', sel.gen.uid, extractCost(sel.gen), ctx, `data-i="${i}"`)).join('') + '</div>';
    }
    return `<p class="ws-hint">Extrais le pouvoir d’un objet Légendaire (ou mieux) : il reste lié au Monolithe et agit en permanence, comme si tu le portais, même sans l’objet. Un seul pouvoir par catégorie (arme, armure, bijou) ; un nouveau remplace l’ancien.</p>
      <div class="ws-pows">${slots}</div>${this._list(list, 'Aucun objet Légendaire non-panoplie avec un effet spécial dans ton inventaire.')}${panel}`;
  }
  _t_rune(ctx) {
    const runes = RUNES.map((r) => ({ r, q: C.countItem(ctx.inventory, r.id) })).filter((x) => x.q > 0);
    const rows = runes.map(({ r, q }) => {
      const can = r.tier < RUNES.length;
      return `<div class="ws-rrow" style="border-color:${r.color}"><span><b style="color:${r.color}">${esc(r.name)}</b> ×${q}<br><small>rang ${r.tier}</small></span>${can ? this._btn(`Fusionner ${FUSE_COUNT} → rang ${r.tier + 1}`, 'fuse', r.id, { gold: fuseCost(r.tier).gold, mats: { [r.id]: FUSE_COUNT } }, ctx) : '<i>rang max</i>'}</div>`;
    }).join('');
    return `<p class="ws-hint">Fusionne ${FUSE_COUNT} runes identiques en une rune de rang supérieur, ou grave une rune au hasard (rang 1 à ${engraveTierMax(ctx.player.level)} selon ton niveau ; les petits rangs sont plus fréquents).</p>
      ${this._btn('🔨 Graver une rune', 'engrave', '', engraveCost(), ctx)}
      ${runes.length ? `<div class="ws-rlist">${rows}</div>` : '<p class="ws-empty">Tu n’as aucune rune pour l’instant.</p>'}`;
  }
  _t_mats(ctx) {
    const from = this.pick.from || 'mat_ferraille', to = this.pick.to || 'mat_poussiere';
    const mk = (cur, key) => MATS.map((m) => `<button class="ws-chip${cur === m.id ? ' on' : ''}" data-ws="pickMat" data-k="${key}" data-v="${m.id}">${m.icon} ${esc(m.name)}</button>`).join('');
    const out = distillOut(from, to), have = C.countItem(ctx.inventory, from);
    return `<p class="ws-hint">Distille ${DISTILL_IN} unités d’un matériau pour en obtenir un autre (≈ 60 % de leur valeur).</p>
      <div class="ws-sub">Donner :</div><div class="ws-chips">${mk(from, 'from')}</div>
      <div class="ws-sub">Recevoir :</div><div class="ws-chips">${mk(to, 'to')}</div>
      <div class="ws-panel"><p>${DISTILL_IN} × ${esc(MAT_BY_ID[from].name)} (tu en as ${have}) → <b>${out} × ${esc(MAT_BY_ID[to].name)}</b></p>
      ${this._btn('⚗️ Distiller', 'distill', '', null, ctx, out < 1 || from === to || have < DISTILL_IN ? 'data-miss="1"' : '')}</div>`;
  }

  // ------------------------------------------------------------ mystique
  _t_enchant(ctx) {
    const list = this._gear(ctx, {}, (g) => g.affixes && g.affixes.length);
    const sel = this._selected(ctx, list);
    let panel = '';
    if (sel) {
      const g = sel.gen, cost = enchantCost(g), left = MAX_ENCH - (g.ench || 0);
      if (this.proposal && this.proposal.uid === g.uid) {
        const pr = this.proposal, f = (a) => (a.kind === 'percent' ? `+${Math.round(a.value * 1000) / 10} % ${a.label}` : `+${a.value} ${a.label}`);
        panel = `<div class="ws-panel"><h3>${esc(sel.view.name)}</h3><p>La mystique te propose :</p>
          <div class="ws-cmp"><div><small>Actuelle</small><br><b>${esc(f(pr.old))}</b></div><div class="arrow">➜</div><div><small>Nouvelle</small><br><b class="neu">${esc(f(pr.neu))}</b></div></div>
          <button class="ws-act" data-ws="enchKeep">✔ Garder la nouvelle</button><button class="ws-act" data-ws="enchDrop">✖ Garder l’actuelle</button></div>`;
      } else {
        panel = `<div class="ws-panel"><h3>${esc(sel.view.name)}</h3><p>Choisis la propriété à remplacer (${left} enchantement(s) restant(s) sur cet objet). Chaque tirage coûte plus cher que le précédent.</p>` +
          g.affixes.map((a, i) => this._btn(`${esc(a.kind === 'percent' ? '+' + Math.round(a.value * 1000) / 10 + ' %' : '+' + a.value)} ${esc(a.label)}`, 'enchRoll', g.uid, left > 0 ? cost : null, ctx, `data-i="${i}"${left <= 0 ? ' data-miss="1"' : ''}`)).join('') + '</div>';
      }
    }
    return `<p class="ws-hint">Remplace UNE propriété (affixe) d’un objet par une autre au hasard. Tu vois le résultat avant de choisir : garde la nouvelle ou conserve l’actuelle (le tirage reste payé). Les âmes oubliées viennent du démantèlement d’objets Légendaires ou mieux, des boss et de la distillation.</p>
      ${this._list(list, 'Aucun objet n’a de propriété à enchanter (les objets Communs n’en ont pas).')}${panel}`;
  }
  _t_look(ctx) {
    const list = this._gear(ctx, {}, () => true);
    const sel = this._selected(ctx, list);
    let panel = '';
    if (sel) {
      const g = sel.gen, opt = C.tmogOptions(g), cur = g.tmog || {};
      const c = this.pick.c !== undefined ? this.pick.c : (cur.c || null), v = this.pick.v !== undefined ? this.pick.v : (cur.v || null);
      const sw = opt.colors.map((x) => `<button class="ws-sw${(c || null) === x.id ? ' on' : ''}" data-ws="pickLook" data-k="c" data-v="${x.id || ''}" title="${esc(x.name)}" style="${x.id ? 'background:' + x.id : ''}">${x.id ? '' : '⦸'}</button>`).join('');
      const vis = opt.visuals.length ? `<div class="ws-sub">Forme :</div><div class="ws-chips"><button class="ws-chip${!v ? ' on' : ''}" data-ws="pickLook" data-k="v" data-v="">D’origine</button>${opt.visuals.map((x) => `<button class="ws-chip${v === x ? ' on' : ''}" data-ws="pickLook" data-k="v" data-v="${x}">${x === 'sword' ? 'Épée' : 'Poignard'}</button>`).join('')}</div>` : '';
      const same = (cur.c || null) === c && (cur.v || null) === v;
      const reset = !c && !v;
      panel = `<div class="ws-panel"><h3>${esc(sel.view.name)}</h3><div class="ws-sub">Teinte :</div><div class="ws-sws">${sw}</div>${vis}
        ${this._btn(reset ? 'Rétablir l’apparence d’origine' : '🎨 Appliquer', 'look', sel.gen.uid, reset ? null : tmogCost(g), ctx, same ? 'data-miss="1"' : '')}</div>`;
    }
    return `<p class="ws-hint">Change la couleur de ton équipement (et la forme d’une arme de mêlée) sans toucher à ses statistiques. Visible sur ton personnage.</p>
      ${this._list(list, 'Aucun équipement généré.')}${panel}`;
  }

  // ------------------------------------------------------------ actions
  _find(ctx, uid) { return C.listGear(ctx).find((x) => x.gen.uid === uid) || null; }
  _done(r, keepSel = true) {
    this.msg = { ok: r.ok, text: r.msg };
    if (r.ok) {
      const ev = { repair1: 'repair', repairAll: 'repair', socket1: 'socket', insert: 'rune', salv1: 'salvage', salvBulk: 'salvage', enchRoll: 'enchant', look: 'look' }[this._lastAct] || (this.kind === 'monolith' ? 'cube' : null);
      if (ev) this.g._tut(ev);
    }
    if (r.ok) { this.g.audio.play('coin'); this.g.player.refreshGearVisuals?.(this.g.equipment); try { this.g._doSave(); } catch { /* ignoré */ } if (!keepSel) this.sel = null; }
    else this.g.audio.play('click');
    this.g._refreshEquipPanels?.();
    this.render();
  }
  _click(e) {
    const t = e.target.closest('[data-ws]'); if (!t || !this.root.contains(t)) return;
    const a = t.dataset.ws, v = t.dataset.v, ctx = this.ctx;
    this._lastAct = a;
    const need = (uid) => this._find(ctx, uid);
    switch (a) {
      case 'close': this.g.bus.emit('ui:close-workshop'); return;
      case 'tab': this.tab = v; this.sel = null; this.proposal = null; this.pick = {}; this.msg = null; return this.render();
      case 'sel': this.sel = this.sel === v ? null : v; this.pick = {}; this.proposal = null; return this.render();
      case 'repair1': { const x = need(v); return x && this._done(C.repairOne(ctx, x.ref)); }
      case 'repairAll': return this._done(C.repairAll(ctx));
      case 'socket1': { const x = need(v); return x && this._done(C.addSocket(ctx, x.ref)); }
      case 'pickSock': this.pick.sock = Number(v); return this.render();
      case 'insert': { const x = need(this.sel); if (!x) return; const r = C.socketRune(ctx, x.ref, v, this.pick.sock); this.pick = {}; return this._done(r); }
      case 'unsock': { const x = need(this.sel); if (!x) return; this.pick = {}; return this._done(C.unsocketRune(ctx, x.ref, Number(v))); }
      case 'salv1': { const x = need(v); return x && this._done(C.salvageOne(ctx, x.ref)); }
      case 'salvBulk': return this._done(C.salvageBulk(ctx, Number(v)));
      case 'reforge': { const x = need(v); if (!x) return; const r = C.reforge(ctx, x.ref); const ng = C.genOf(ctx, x.ref); if (r.ok && ng) this.sel = ng.uid; return this._done(r); }
      case 'upgrade': { const x = need(v); if (!x) return; const r = C.upgrade(ctx, x.ref); const ng = C.genOf(ctx, x.ref); if (r.ok && ng) this.sel = ng.uid; return this._done(r); }
      case 'convertSet': { const x = need(v); if (!x) return; const r = C.convertSet(ctx, x.ref); return this._done(r, false); }
      case 'freeLevel': { const x = need(v); return x && this._done(C.freeLevel(ctx, x.ref)); }
      case 'extract': { const x = need(v); if (!x) return; const r = C.extractPower(ctx, x.ref, Number(t.dataset.i)); return this._done(r, false); }
      case 'clearPow': return this._done(C.clearPower(ctx, v));
      case 'fuse': return this._done(C.fuseRunes(ctx, v));
      case 'engrave': return this._done(C.engraveRune(ctx));
      case 'pickMat': this.pick[t.dataset.k] = v; return this.render();
      case 'distill': return this._done(C.distill(ctx, this.pick.from || 'mat_ferraille', this.pick.to || 'mat_poussiere'));
      case 'enchRoll': {
        const x = need(v); if (!x) return;
        const r = C.enchantRoll(ctx, x.ref, Number(t.dataset.i));
        if (r.ok) this.proposal = { uid: v, ...r.proposal };
        return this._done(r);
      }
      case 'enchKeep': { const pr = this.proposal; this.proposal = null; if (!pr) return; const x = need(pr.uid); if (!x) return; return this._done(C.enchantApply(ctx, { ...pr, ref: x.ref })); }
      case 'enchDrop': this.proposal = null; this.msg = { ok: true, text: 'Tu gardes la propriété actuelle.' }; return this.render();
      case 'pickLook': this.pick[t.dataset.k] = v || null; return this.render();
      case 'look': {
        const x = need(v); if (!x) return;
        const cur = x.gen.tmog || {};
        const c = this.pick.c !== undefined ? this.pick.c : (cur.c || null), vv = this.pick.v !== undefined ? this.pick.v : (cur.v || null);
        this.pick = {};
        return this._done(C.applyTransmog(ctx, x.ref, { c, v: vv }));
      }
      default:
    }
  }
}
