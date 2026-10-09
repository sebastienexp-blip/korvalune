// V10.21 — Sélection multiple et vente groupée (inventaire, coffre, vendeur).
// Le contrôleur ne connaît que des « portées » (scope) : { scope:'inv'|'bank', slots, from, to }.
// La vente réelle est faite par le jeu (hud.onSellMany) ; ici : sélection, total, barre d'outils.
import { resolveItem } from '../inventory/Item.js';

const QUICK = [
  { label: 'Commun', tier: 1 },
  { label: '≤ Magique', tier: 4 },
  { label: '≤ Rare', tier: 8 }
];

export function sellValueOf(slot) {
  if (!slot) return 0;
  const v = resolveItem(slot);
  const unit = Math.max(0, Math.floor(v.value || 0));
  return v.isGenerated ? unit : unit * Math.max(1, slot.qty || 1);
}

export class MultiSell {
  constructor() {
    this.on = false;
    this.sel = { inv: new Set(), bank: new Set() };
    this.confirmUntil = 0;
  }

  reset() {
    this.on = false;
    this.sel.inv.clear(); this.sel.bank.clear();
    this.confirmUntil = 0;
  }

  isSel(scope, i) { return this.sel[scope]?.has(i); }
  toggle(scope, i) {
    const s = this.sel[scope]; if (!s) return;
    if (s.has(i)) s.delete(i); else s.add(i);
    this.confirmUntil = 0;
  }
  clearSel() { this.sel.inv.clear(); this.sel.bank.clear(); this.confirmUntil = 0; }

  // retire de la sélection les cases devenues vides
  prune(scopes) {
    for (const sc of scopes) for (const i of [...this.sel[sc.scope]]) if (!sc.slots[i]) this.sel[sc.scope].delete(i);
  }

  entries() {
    const out = [];
    for (const scope of ['inv', 'bank']) for (const index of this.sel[scope]) out.push({ scope, index });
    return out;
  }

  summary(scopes) {
    let n = 0, total = 0, high = false;
    for (const sc of scopes) for (const i of this.sel[sc.scope]) {
      const slot = sc.slots[i]; if (!slot) continue;
      const v = resolveItem(slot);
      n += v.isGenerated ? 1 : (slot.qty || 1);
      total += sellValueOf(slot);
      if (v.rarityInfo && v.rarityInfo.tier >= 13) high = true;
    }
    return { n, total, high };
  }

  // sélection rapide : équipement (armes/armures) jusqu'à une rareté, sur la partie visible de chaque portée
  quickSelect(scopes, maxTier) {
    for (const sc of scopes) {
      for (let i = sc.from; i < sc.to; i++) {
        const slot = sc.slots[i]; if (!slot) continue;
        const v = resolveItem(slot);
        if ((v.type === 'weapon' || v.type === 'armor') && v.rarityInfo.tier <= maxTier) this.sel[sc.scope].add(i);
      }
    }
    this.confirmUntil = 0;
  }
  selectAll(scopes) {
    for (const sc of scopes) for (let i = sc.from; i < sc.to; i++) if (sc.slots[i]) this.sel[sc.scope].add(i);
    this.confirmUntil = 0;
  }

  // Barre d'outils. always = vendeur (mode toujours actif, pas de bouton « Terminer »).
  renderBar(el, scopes, rerender, onSell, always = false) {
    if (!el) return;
    el.innerHTML = '';
    el.classList.add('sellbar');
    const btn = (txt, fn, cls = '') => {
      const b = document.createElement('button');
      b.className = 'ms-btn ' + cls; b.textContent = txt; b.onclick = fn; el.appendChild(b); return b;
    };
    if (!this.on && !always) {
      btn('☑ Sélection multiple', () => { this.on = true; rerender(); }, 'ms-toggle');
      return;
    }
    this.prune(scopes);
    const { n, total, high } = this.summary(scopes);
    const info = document.createElement('span');
    info.className = 'ms-info';
    info.textContent = n ? `${n} sélectionné${n > 1 ? 's' : ''} · +${total.toLocaleString('fr-FR')} 🪙` : 'Touchez les objets à vendre';
    el.appendChild(info);
    const q = document.createElement('div'); q.className = 'ms-quick'; el.appendChild(q);
    const lab = document.createElement('small'); lab.textContent = 'Équipement :'; q.appendChild(lab);
    for (const k of QUICK) {
      const b = document.createElement('button'); b.className = 'ms-btn'; b.textContent = k.label;
      b.onclick = () => { this.quickSelect(scopes, k.tier); rerender(); };
      q.appendChild(b);
    }
    const bAll = document.createElement('button'); bAll.className = 'ms-btn'; bAll.textContent = 'Tout'; bAll.onclick = () => { this.selectAll(scopes); rerender(); }; q.appendChild(bAll);
    const bNone = document.createElement('button'); bNone.className = 'ms-btn'; bNone.textContent = 'Aucun'; bNone.onclick = () => { this.clearSel(); rerender(); }; q.appendChild(bNone);

    const confirming = this.confirmUntil > Date.now();
    const sell = document.createElement('button');
    sell.className = 'ms-btn ms-sell' + (confirming ? ' confirm' : '');
    sell.disabled = !n;
    sell.textContent = confirming ? `Confirmer la vente (+${total.toLocaleString('fr-FR')} 🪙)` : 'Vendre la sélection';
    sell.onclick = () => {
      if (!n) return;
      if (!confirming) {
        this.confirmUntil = Date.now() + 4000;
        rerender();
        clearTimeout(this._ct);
        this._ct = setTimeout(() => { if (this.confirmUntil && this.confirmUntil <= Date.now() + 50) { this.confirmUntil = 0; try { rerender(); } catch { /* écran fermé */ } } }, 4100);
        return;
      }
      this.confirmUntil = 0;
      onSell(this.entries());
    };
    el.appendChild(sell);
    if (high && !confirming) {
      const w = document.createElement('small'); w.className = 'ms-warn'; w.textContent = '⚠ La sélection contient des objets Légendaires ou mieux.'; el.appendChild(w);
    }
    if (!always) btn('Terminer', () => { this.on = false; this.clearSel(); rerender(); });
  }
}
