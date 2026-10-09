// V10.24 — Gestes sur les cases d'objets (inventaire, coffre) :
//  • appui long (≈ 0,4 s) sur un objet = active la sélection multiple avec cet objet déjà coché ;
//  • appui long puis glisser (ou, à la souris, simple glisser) = déplacer l'objet vers une autre case.
// Les cases portent data-scope ("inv" | "bank") et data-i (numéro de case). Le contrôleur ne fait que détecter
// les gestes : le déplacement réel est confié à ctx.move / ctx.equip, fournis par l'écran affiché.
const HOLD_MS = 420, MOVE_PX = 10;

export class ItemGestures {
  constructor(ms, getCtx) {
    this.ms = ms; this.getCtx = getCtx; this.st = null; this._bound = new WeakSet();
  }

  bind(grid) {
    if (!grid || this._bound.has(grid)) return;
    this._bound.add(grid);
    grid.addEventListener('contextmenu', (e) => { if (e.target.closest('.inv-cell[data-scope]')) e.preventDefault(); });
    grid.addEventListener('touchstart', (e) => {
      const cell = e.target.closest('.inv-cell[data-scope]');
      if (!cell || e.touches.length !== 1 || this.st) return;
      const t = e.touches[0];
      this._begin(cell, t.clientX, t.clientY, true, t.identifier);
    }, { passive: true });
    grid.addEventListener('mousedown', (e) => {
      const cell = e.target.closest('.inv-cell[data-scope]');
      if (!cell || e.button !== 0 || this.st) return;
      this._begin(cell, e.clientX, e.clientY, false);
    });
    // écoute globale (installée une fois) : le doigt peut sortir de la grille pendant le glissement
    if (!ItemGestures._global) {
      ItemGestures._global = true;
      window.addEventListener('touchmove', (e) => ItemGestures.cur?._move(e, true), { passive: false });
      window.addEventListener('touchend', (e) => ItemGestures.cur?._end(e, true), { passive: false });
      window.addEventListener('touchcancel', (e) => ItemGestures.cur?._cancel(), { passive: true });
      window.addEventListener('mousemove', (e) => ItemGestures.cur?._move(e, false));
      window.addEventListener('mouseup', (e) => ItemGestures.cur?._end(e, false));
    }
  }

  _begin(cell, x, y, touch, id) {
    const scope = cell.dataset.scope, i = Number(cell.dataset.i);
    const slots = this.getCtx()?.slotsOf?.(scope);
    if (!slots || !slots[i]) return; // case vide : rien à saisir
    ItemGestures.cur = this;
    const st = this.st = { cell, scope, i, x0: x, y0: y, touch, id, held: false, dragging: false, ms: false, ghost: null, over: null };
    st.timer = setTimeout(() => this._hold(), HOLD_MS);
  }

  _pt(e, touch) {
    if (!touch) return { x: e.clientX, y: e.clientY };
    const t = [...e.touches, ...e.changedTouches].find((q) => q.identifier === this.st.id) || e.touches[0];
    return t ? { x: t.clientX, y: t.clientY } : null;
  }

  _hold() {
    const st = this.st; if (!st) return;
    st.held = true;
    try { navigator.vibrate?.(18); } catch { /* facultatif */ }
    st.cell.classList.add('holding');
    const ms = this.ms;
    if (!ms.on) { ms.on = true; ms.clearSel(); ms.toggle(st.scope, st.i); st.ms = true; } // sélection multiple activée par l'appui long
    else if (!ms.isSel(st.scope, st.i)) { ms.toggle(st.scope, st.i); st.ms = 'add'; }
    st.cell.classList.add('ms-sel');
  }

  _startDrag() {
    const st = this.st; if (st.dragging) return;
    // c'était un glissement : on annule l'activation de la sélection multiple faite par l'appui long
    if (st.ms === true) { this.ms.on = false; this.ms.clearSel(); }
    else if (st.ms === 'add') this.ms.toggle(st.scope, st.i);
    st.ms = false;
    st.cell.classList.remove('ms-sel', 'holding');
    st.dragging = true; st.cell.classList.add('dragging');
    const g = document.createElement('div'); g.className = 'item-ghost';
    g.innerHTML = st.cell.querySelector('.inv-icon')?.outerHTML || '';
    document.body.appendChild(g); st.ghost = g;
  }

  _move(e, touch) {
    const st = this.st; if (!st) return;
    const p = this._pt(e, touch); if (!p) return;
    const far = Math.hypot(p.x - st.x0, p.y - st.y0) > MOVE_PX;
    if (!st.dragging) {
      if (!far) return;
      if (touch && !st.held) { this._cancel(); return; } // glissement avant l'appui long = défilement de la liste
      if (!touch && !st.held) { clearTimeout(st.timer); st.held = true; } // souris : glisser tout de suite
      this._startDrag();
    }
    if (e.cancelable) e.preventDefault();
    st.ghost.style.left = p.x + 'px'; st.ghost.style.top = p.y + 'px';
    const el = document.elementFromPoint(p.x, p.y);
    const tgt = el && (el.closest('.inv-cell[data-scope]') || el.closest('.eq-cell'));
    if (st.over !== tgt) { st.over?.classList.remove('drop-target'); st.over = tgt || null; tgt?.classList.add('drop-target'); }
  }

  _end(e, touch) {
    const st = this.st; if (!st) return;
    clearTimeout(st.timer);
    const ctx = this.getCtx();
    const wasHeld = st.held, wasDrag = st.dragging;
    const p = this._pt(e, touch);
    this._clean();
    if (wasDrag && p && ctx) {
      const el = document.elementFromPoint(p.x, p.y);
      const cell = el && el.closest('.inv-cell[data-scope]');
      if (cell) ctx.move?.(st.scope, st.i, cell.dataset.scope, Number(cell.dataset.i));
      else if (el && el.closest('.eq-cell') && st.scope === 'inv') ctx.equip?.(st.i);
      else if (el && el.closest('#bank-grid, #bank-inv-grid')) { // dépôt sur la grille d'en face (hors case) = transfert
        const other = el.closest('#bank-grid') ? 'bank' : 'inv';
        if (other !== st.scope) ctx.transfer?.(st.scope, st.i);
      }
      ctx.rerender?.();
    } else if (wasHeld) ctx?.rerender?.(); // appui long sans glisser : la sélection multiple s'affiche
    if (wasHeld || wasDrag) { // ni clic ni menu après un geste long
      if (e.cancelable) e.preventDefault();
      const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', stop, true), 400);
    }
  }

  _cancel() { const st = this.st; if (!st) return; clearTimeout(st.timer); const wasHeld = st.held; if (st.ms === true) { this.ms.on = false; this.ms.clearSel(); } else if (st.ms === 'add') this.ms.toggle(st.scope, st.i); this._clean(); if (wasHeld) this.getCtx()?.rerender?.(); }

  _clean() {
    const st = this.st; if (!st) return;
    st.ghost?.remove(); st.over?.classList.remove('drop-target'); st.cell.classList.remove('holding', 'dragging');
    this.st = null; ItemGestures.cur = null;
  }
}
