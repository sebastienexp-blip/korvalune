// V10.12 — Éditeur d'apparence (création du personnage et barbier de Korvalune).
// Onglets Corps / Visage / Cheveux. Ne gère pas la race ni le teint (propres à la création).
//   const ed = new LookEditor(container, { state:{ look, hairCol, eyeCol }, prices, onChange, onTab });
//   ed.state → apparence courante
import {
  LOOK_SEXES, HEIGHT_RANGE, WEIGHT_RANGE, MUSCLE_RANGE, FACE_SHAPES, EYE_STYLES, NOSE_STYLES, FACIAL_HAIR,
  HAIR_STYLES, HAIR_COLORS, EYE_COLORS, normalizeLook, defaultLook
} from '../data/looks.js';

const TABS = [['corps', 'Corps'], ['visage', 'Visage'], ['cheveux', 'Cheveux']];
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const weightTxt = (v) => (v < 18 ? 'Très mince' : v < 36 ? 'Mince' : v < 58 ? 'Moyenne' : v < 80 ? 'Robuste' : 'Forte');
const muscleTxt = (v) => (v < 22 ? 'Frêle' : v < 50 ? 'Normale' : v < 76 ? 'Athlétique' : 'Colosse');
const cmTxt = (v) => (v / 100).toFixed(2).replace('.', ',') + ' m';

export class LookEditor {
  constructor(container, { state, prices = null, keepBody = false, onChange = () => {}, onTab = () => {} } = {}) {
    this.keepBody = keepBody; // barbier : changer de sexe ne modifie pas la silhouette (payée à part)
    this.el = container;
    this.state = { look: normalizeLook(state?.look), hairCol: state?.hairCol ?? HAIR_COLORS[0], eyeCol: state?.eyeCol ?? EYE_COLORS[0] };
    this.prices = prices;
    this.onChange = onChange;
    this.onTab = onTab;
    this.tab = 'corps';
    this.hairFilter = this.state.look.sex;
    this.el.classList.add('look-editor');
    this.render();
  }

  set(patch, rerender = false) {
    if ('hairCol' in patch || 'eyeCol' in patch) Object.assign(this.state, patch);
    else this.state.look = normalizeLook({ ...this.state.look, ...patch });
    if (rerender) this.render();
    this.onChange(this.state);
  }

  _sex(sex) {
    const prev = this.state.look.sex;
    if (sex === prev) return;
    const d = defaultLook(sex), L = this.state.look, patch = { sex };
    // valeurs encore « par défaut » : elles suivent le nouveau sexe
    if (!this.keepBody) {
      if (L.height === HEIGHT_RANGE.def[prev]) patch.height = d.height;
      if (L.weight === WEIGHT_RANGE.def[prev]) patch.weight = d.weight;
      if (L.muscle === MUSCLE_RANGE.def[prev]) patch.muscle = d.muscle;
    }
    this.hairFilter = sex;
    this.set(patch, true);
  }

  render() {
    const L = this.state.look;
    this.el.innerHTML = `<div class="le-tabs">${TABS.map(([id, t]) => `<button type="button" class="le-tab${id === this.tab ? ' active' : ''}" data-le-tab="${id}">${t}</button>`).join('')}</div><div class="le-body"></div>`;
    this.el.querySelectorAll('[data-le-tab]').forEach((b) => { b.onclick = () => { this.tab = b.dataset.leTab; this.render(); this.onTab(this.tab); }; });
    const body = this.el.querySelector('.le-body');
    if (this.tab === 'corps') {
      body.append(
        this._chips('Sexe', LOOK_SEXES, L.sex, (v) => this._sex(v), 'sex'),
        this._slider('Taille', HEIGHT_RANGE, L.height, cmTxt, (v) => this.set({ height: v }), 'body'),
        this._slider('Corpulence', WEIGHT_RANGE, L.weight, weightTxt, (v) => this.set({ weight: v }), 'body'),
        this._slider('Musculature', MUSCLE_RANGE, L.muscle, muscleTxt, (v) => this.set({ muscle: v }), 'body')
      );
    } else if (this.tab === 'visage') {
      body.append(
        this._chips('Forme du visage', FACE_SHAPES, L.face, (v) => this.set({ face: v }), 'face'),
        this._chips('Yeux', EYE_STYLES, L.eyes, (v) => this.set({ eyes: v }), 'face'),
        this._chips('Nez', NOSE_STYLES, L.nose, (v) => this.set({ nose: v }), 'face'),
        this._swatches('Couleur des yeux', EYE_COLORS, this.state.eyeCol, (v) => this.set({ eyeCol: v }), 'eyeCol'),
        this._chips('Barbe et moustache', FACIAL_HAIR, L.beard, (v) => this.set({ beard: v }), 'beard')
      );
    } else {
      const filters = [{ id: 'homme', label: 'Hommes' }, { id: 'femme', label: 'Femmes' }, { id: 'toutes', label: 'Toutes' }];
      const list = HAIR_STYLES.filter((h) => this.hairFilter === 'toutes' || h.category === 'mixte' || h.category === this.hairFilter);
      body.append(
        this._chips('Coupes', filters, this.hairFilter, (v) => { this.hairFilter = v; this.render(); }, null),
        this._chips('Coupe', list, L.hair, (v) => this.set({ hair: v }), 'hair'),
        this._swatches('Couleur', HAIR_COLORS, this.state.hairCol, (v) => this.set({ hairCol: v }), 'hairCol')
      );
    }
  }

  _field(label, priceKey) {
    const f = document.createElement('div');
    f.className = 'cc-field';
    const price = this.prices && priceKey && this.prices[priceKey] ? ` <span class="le-price">${this.prices[priceKey].price} 🪙</span>` : '';
    f.innerHTML = `<label>${label}${price}</label>`;
    return f;
  }

  _chips(label, options, value, pick, priceKey) {
    const f = this._field(label, priceKey);
    const row = document.createElement('div');
    row.className = 'choice-grid';
    for (const o of options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (o.id === value ? ' active' : '');
      b.textContent = o.label;
      b.onclick = () => { row.querySelectorAll('.chip').forEach((x) => x.classList.remove('active')); b.classList.add('active'); pick(o.id); };
      row.appendChild(b);
    }
    f.appendChild(row);
    return f;
  }

  _slider(label, range, value, fmt, change, priceKey) {
    const f = this._field(label, priceKey);
    const w = document.createElement('div');
    w.className = 'le-slider';
    w.innerHTML = `<input type="range" min="${range.min}" max="${range.max}" step="1" value="${value}"><output>${fmt(value)}</output>`;
    const inp = w.querySelector('input'), out = w.querySelector('output');
    inp.oninput = () => { const v = +inp.value; out.textContent = fmt(v); change(v); };
    f.appendChild(w);
    return f;
  }

  _swatches(label, colors, value, pick, priceKey) {
    const f = this._field(label, priceKey);
    const row = document.createElement('div');
    row.className = 'swatches le-swatches';
    colors.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cc-swatch' + (c === value ? ' active' : '');
      b.style.background = hex(c);
      b.setAttribute('aria-label', label + ' ' + (i + 1));
      b.onclick = () => { row.querySelectorAll('.cc-swatch').forEach((x) => x.classList.remove('active')); b.classList.add('active'); pick(c); };
      row.appendChild(b);
    });
    f.appendChild(row);
    return f;
  }
}
