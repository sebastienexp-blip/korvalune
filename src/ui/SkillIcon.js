// V10.22 — Icônes de compétences uniques : chaque compétence a son propre pictogramme (emoji distinct) posé sur un cadre
// généré à partir de son identifiant (forme, ornements, teinte). Deux compétences n'ont jamais la même image.
import { skillColor } from '../visual/Fx.js';

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const hex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
function shade(n, k) { const r = Math.min(255, Math.round(((n >> 16) & 255) * k)), g = Math.min(255, Math.round(((n >> 8) & 255) * k)), b = Math.min(255, Math.round((n & 255) * k)); return `rgb(${r},${g},${b})`; }

const SHAPES = [
  (s) => `<circle cx="32" cy="32" r="${s}"/>`,
  (s) => `<rect x="${32 - s}" y="${32 - s}" width="${2 * s}" height="${2 * s}" rx="${s * 0.28}"/>`,
  (s) => { const p = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; p.push(`${(32 + Math.cos(a) * s).toFixed(1)},${(32 + Math.sin(a) * s).toFixed(1)}`); } return `<polygon points="${p.join(' ')}"/>`; },
  (s) => `<polygon points="32,${32 - s} ${32 + s},32 32,${32 + s} ${32 - s},32"/>`,
  (s) => `<path d="M${32 - s},${32 - s * 0.85} H${32 + s} V${32 + s * 0.1} Q${32 + s},${32 + s * 0.8} 32,${32 + s} Q${32 - s},${32 + s * 0.8} ${32 - s},${32 + s * 0.1} Z"/>`,
  (s) => { const p = []; for (let i = 0; i < 8; i++) { const a = Math.PI / 4 * i + Math.PI / 8; p.push(`${(32 + Math.cos(a) * s).toFixed(1)},${(32 + Math.sin(a) * s).toFixed(1)}`); } return `<polygon points="${p.join(' ')}"/>`; }
];

// ornements autour du cadre (choisis par l'identifiant ; plus le niveau requis est haut, plus il y en a)
const ORN = [
  (c) => [0, 1, 2, 3].map((i) => { const a = Math.PI / 2 * i + Math.PI / 4; return `<circle cx="${(32 + Math.cos(a) * 29).toFixed(1)}" cy="${(32 + Math.sin(a) * 29).toFixed(1)}" r="2.6" fill="${c}"/>`; }).join(''),
  (c) => { let o = ''; for (let i = 0; i < 12; i++) { const a = Math.PI / 6 * i, x1 = 32 + Math.cos(a) * 27, y1 = 32 + Math.sin(a) * 27, x2 = 32 + Math.cos(a) * 31, y2 = 32 + Math.sin(a) * 31; o += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="1.6"/>`; } return o; },
  (c) => `<path d="M3,30 L10,24 L9,32 L3,34 Z M61,30 L54,24 L55,32 L61,34 Z" fill="${c}" opacity=".85"/>`,
  (c) => `<polygon points="32,1 36,8 28,8" fill="${c}"/><polygon points="32,63 36,56 28,56" fill="${c}"/>`,
  (c) => `<circle cx="32" cy="32" r="30.5" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="3 3"/>`,
  (c) => [0, 1, 2].map((i) => { const a = Math.PI * 2 / 3 * i - Math.PI / 2; return `<circle cx="${(32 + Math.cos(a) * 30).toFixed(1)}" cy="${(32 + Math.sin(a) * 30).toFixed(1)}" r="3" fill="${c}"/>`; }).join(''),
  (c) => `<path d="M6,8 L14,8 M6,8 L6,16 M58,8 L50,8 M58,8 L58,16 M6,56 L14,56 M6,56 L6,48 M58,56 L50,56 M58,56 L58,48" stroke="${c}" stroke-width="2.2" fill="none"/>`,
  (c) => `<path d="M32,2 L35,9 L29,9 Z M2,32 L9,35 L9,29 Z M62,32 L55,35 L55,29 Z M32,62 L35,55 L29,55 Z" fill="${c}"/>`
];

const cache = new Map();
export function skillIconHTML(skill, classId) {
  if (!skill) return '';
  const key = skill.id;
  let html = cache.get(key);
  if (html) return html;
  const col = typeof skill.color === 'number' ? skill.color : skillColor(skill, skill.classId || classId);
  const h = hash(skill.id);
  const shape = SHAPES[h % SHAPES.length], orn = ORN[(h >>> 3) % ORN.length], orn2 = ORN[(h >>> 7) % ORN.length];
  const lv = skill.levelReq || 1;
  const tier = lv >= 150 ? 3 : lv >= 80 ? 2 : lv >= 30 ? 1 : 0;
  const c = hex(col), cd = shade(col, 0.35), cm = shade(col, 0.7), cl = shade(col, 1.25);
  const gid = 'g' + h.toString(36);
  const rot = (h >>> 11) % 4 === 0 ? 0 : 0;
  const svg = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`
    + `<defs><radialGradient id="${gid}" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${cm}" stop-opacity=".95"/><stop offset=".6" stop-color="${cd}"/><stop offset="1" stop-color="#05070f"/></radialGradient></defs>`
    + `<g fill="none" stroke="${c}" stroke-width="1.4" opacity=".55" transform="rotate(${rot} 32 32)">${tier >= 1 ? orn2(c) : ''}</g>`
    + `<g fill="url(#${gid})" stroke="${cl}" stroke-width="${2.2 + tier * 0.5}" stroke-linejoin="round">${shape(24)}</g>`
    + `<g fill="none" stroke="${c}" stroke-width="1" opacity=".6" stroke-linejoin="round">${shape(20)}</g>`
    + (tier >= 1 ? orn(c) : '')
    + (tier >= 3 ? `<g fill="none" stroke="${cl}" stroke-width="1" opacity=".8">${shape(28.5)}</g>` : '')
    + `</svg>`;
  html = `<span class="sk-ico" style="--ic:${c}">${svg}<span class="sk-emo">${skill.icon}</span></span>`;
  cache.set(key, html);
  return html;
}
