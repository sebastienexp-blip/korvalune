// V10.38 — Illustrations de compétences (mobile) : chaque compétence a sa propre image, ombrée façon matière réelle
// (acier, or, bois, flammes, glace…) à l'intérieur du cadre d'origine (forme, ornements, couleur).
// Une image = un objet principal (épée, bouclier, arc, crâne…) + un élément en fond (feu, glace, foudre, ombre…)
// + une variante (angle, nombre, miroir, étincelles) tirée de l'identifiant. Pas de JSON importé : tout est déterministe.

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ------------------------------------------------------------------ dégradés « matière »
function defs(s) {
  const lg = (id, stops, x2 = 1, y2 = 1) => `<linearGradient id="${id}${s}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const rg = (id, stops, cx = 0.5, cy = 0.4) => `<radialGradient id="${id}${s}" cx="${cx}" cy="${cy}" r="0.7">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient>`;
  return lg('st', [[0, '#f6f9fd'], [0.35, '#b7c1cf'], [0.7, '#697587'], [1, '#2c333f']], 1, 0)
    + lg('gd', [[0, '#fff3b8'], [0.45, '#e2ac3d'], [1, '#85561a']])
    + lg('wd', [[0, '#9a6a3e'], [1, '#42250f']], 1, 0)
    + lg('fl', [[0, '#fff7c4'], [0.3, '#ffc83a'], [0.65, '#ff6a18'], [1, '#8a1406']], 0, 1)
    + lg('ic', [[0, '#f2ffff'], [0.5, '#8fe0ff'], [1, '#2f7fc4']])
    + lg('bt', [[0, '#ffffff'], [0.5, '#c9f3ff'], [1, '#5aa8ff']], 0, 1)
    + lg('bn', [[0, '#f4efe4'], [1, '#a8a08c']])
    + lg('bl', [[0, '#ff7a7a'], [1, '#7a0f18']], 0, 1)
    + lg('gr', [[0, '#d6ff8a'], [1, '#2f7a24']])
    + lg('sh', [[0, '#b58cff'], [1, '#1b0f33']], 0, 1)
    + rg('or', [[0, '#ffffff'], [0.35, '#bfe4ff'], [1, '#2a4a8a']], 0.38, 0.32)
    + rg('rk', [[0, '#b39a80'], [0.6, '#6b5440'], [1, '#2a1f17']], 0.35, 0.3)
    + rg('sm', [[0, '#d8d8e2'], [1, '#4a4a58']], 0.4, 0.35);
}
const sw = (c, w = 1) => `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

// ------------------------------------------------------------------ objets principaux (dessinés pointe en haut, centrés en 32,32)
const M = {
  sword: (s) => `<path d="M32 7 L35.4 13 V37 H28.6 V13Z" fill="url(#st${s})" ${sw('#2c333f', .6)}/><path d="M32 11 V36" stroke="rgba(0,0,0,.3)" stroke-width="1.3"/><path d="M30.2 14 V36" stroke="rgba(255,255,255,.65)" stroke-width=".8"/><rect x="21.5" y="37" width="21" height="3.4" rx="1.6" fill="url(#gd${s})" ${sw('#5a3a10', .6)}/><rect x="30.3" y="40" width="3.4" height="9" rx="1.3" fill="url(#wd${s})"/><circle cx="32" cy="51" r="2.8" fill="url(#gd${s})" ${sw('#5a3a10', .6)}/>`,
  twin: (s) => `<g transform="rotate(-32 32 32)">${M.sword(s)}</g><g transform="rotate(32 32 32)">${M.sword(s)}</g>`,
  dagger: (s) => `<path d="M32 12 L35 18 L34 38 H30 L29 18Z" fill="url(#st${s})" ${sw('#2c333f', .6)}/><path d="M30.6 19 V37" stroke="rgba(255,255,255,.65)" stroke-width=".8"/><rect x="25" y="38" width="14" height="3" rx="1.4" fill="url(#gd${s})"/><rect x="30.4" y="41" width="3.2" height="8" rx="1.3" fill="url(#wd${s})"/><circle cx="32" cy="51" r="2.2" fill="url(#gd${s})"/>`,
  knives: (s) => [-34, -17, 0, 17, 34].map((a) => `<g transform="rotate(${a} 32 54) scale(1) translate(0 -6)">${M.dagger(s)}</g>`).join(''),
  axe: (s) => `<rect x="30.6" y="9" width="3" height="44" rx="1.4" fill="url(#wd${s})"/><path d="M33.5 11 C48 8 53 22 46 33 C43 30 38 29.5 33.5 30Z" fill="url(#st${s})" ${sw('#2c333f', .7)}/><path d="M47 14 C51 21 49 28 45 32" stroke="rgba(255,255,255,.8)" stroke-width="1" fill="none"/><path d="M34 14 C41 13 45 17 46 22" stroke="rgba(0,0,0,.25)" stroke-width="1" fill="none"/>`,
  hammer: (s) => `<rect x="30.5" y="22" width="3.2" height="32" rx="1.4" fill="url(#wd${s})"/><rect x="17" y="10" width="30" height="15" rx="2.5" fill="url(#st${s})" ${sw('#2c333f', .7)}/><rect x="17" y="10" width="5" height="15" rx="2" fill="rgba(0,0,0,.22)"/><rect x="42" y="10" width="5" height="15" rx="2" fill="rgba(0,0,0,.22)"/><path d="M23 12 H41" stroke="rgba(255,255,255,.7)" stroke-width="1"/>`,
  shield: (s, c) => `<path d="M32 8 L48 13.5 V30 C48 40.5 41 47.5 32 53 C23 47.5 16 40.5 16 30 V13.5Z" fill="url(#st${s})" ${sw('url(#gd' + s + ')', 2.4)}/><path d="M32 13 L43.5 17 V30 C43.5 38 38.5 43.5 32 48 Z" fill="${c}" opacity=".55"/><path d="M32 13 L20.5 17 V30 C20.5 38 25.5 43.5 32 48 Z" fill="rgba(0,0,0,.28)"/><circle cx="32" cy="29" r="5" fill="url(#gd${s})" ${sw('#5a3a10', .6)}/><circle cx="30.6" cy="27.6" r="1.4" fill="rgba(255,255,255,.8)"/>`,
  bow: (s) => `<path d="M24 8 C47 20 47 44 24 56" fill="none" stroke="url(#wd${s})" stroke-width="3.4" stroke-linecap="round"/><path d="M24 8 L24 56" stroke="#e8e0cc" stroke-width=".9"/><path d="M12 32 H44" stroke="#8a6a44" stroke-width="1.6"/><path d="M44 32 L38 28.5 V35.5Z" fill="url(#st${s})"/><path d="M12 32 L16 28 M12 32 L16 36 M15 32 L19 28.5 M15 32 L19 35.5" stroke="#e8e0cc" stroke-width="1.2" stroke-linecap="round"/>`,
  arrow: (s) => `<path d="M32 8 L36.5 18 H27.5Z" fill="url(#st${s})" ${sw('#2c333f', .5)}/><rect x="31.2" y="17" width="1.7" height="31" fill="#9a7a50"/><path d="M32 46 L27 54 M32 46 L37 54 M32 42 L27 50 M32 42 L37 50" stroke="#e9e2d0" stroke-width="2" stroke-linecap="round"/>`,
  volley: (s) => [-26, -13, 0, 13, 26].map((a, i) => `<g transform="rotate(${a} 32 60) scale(.62) translate(19.6 ${i % 2 ? 8 : 0})">${M.arrow(s)}</g>`).join(''),
  orb: (s, c) => `<circle cx="32" cy="32" r="17" fill="url(#or${s})" ${sw(c, 1.6)}/><circle cx="32" cy="32" r="21" fill="none" stroke="${c}" stroke-width="1" opacity=".5"/><ellipse cx="26" cy="25" rx="5.5" ry="3.4" fill="rgba(255,255,255,.7)" transform="rotate(-30 26 25)"/>`,
  fireball: (s) => `<path d="M36 6 C30 18 24 22 21 30 C18 40 24 50 33 50 C43 50 48 41 44 31 C42 36 39 36 38 33 C41 25 40 14 36 6Z" fill="url(#fl${s})"/><circle cx="35" cy="38" r="8.5" fill="#fff4c0" opacity=".9"/><circle cx="35" cy="38" r="5" fill="#fff"/>`,
  flame: (s) => `<path d="M32 55 C19 55 15 44 19.5 34 C22 29 27 27 26 17 C32 21 34.5 27 33.5 30.5 C36.5 27.5 38 23.5 37 16 C47 24.5 49.5 35.5 45.5 44.5 C43 50.5 38.5 55 32 55Z" fill="url(#fl${s})"/><path d="M32 53 C25 53 22.5 47 25.5 41.5 C27 38.5 30 38 30 33 C34.5 36 37.5 41 36 46 C35.2 50 34 53 32 53Z" fill="#fff4b8" opacity=".92"/>`,
  ice: (s) => `<polygon points="32,6 41,19 39,45 32,57 25,45 23,19" fill="url(#ic${s})" ${sw('#d8f6ff', 1)}/><path d="M32 6 L32 57 M23 19 L39 19 M25 45 L32 28 L39 45" stroke="rgba(255,255,255,.7)" stroke-width=".8" fill="none"/><polygon points="17,34 22,26 25,44 19,48" fill="url(#ic${s})" opacity=".85"/><polygon points="47,36 42,28 39,46 45,50" fill="url(#ic${s})" opacity=".85"/>`,
  bolt: (s) => `<path d="M37 5 L18 35 H29.5 L25 59 L47 26 H35 Z" fill="url(#bt${s})" ${sw('#bfe9ff', 1.4)}/><path d="M37 5 L18 35 H29.5" fill="none" stroke="#fff" stroke-width=".8"/>`,
  cross: (s) => `<path d="M29 8 H35 V25 H49 V31 H35 V56 H29 V31 H15 V25 H29Z" fill="url(#gd${s})" ${sw('#fff3b8', 1)}/><path d="M30.5 10 V54" stroke="rgba(255,255,255,.7)" stroke-width=".8"/><circle cx="32" cy="28" r="3" fill="#fff" opacity=".9"/>`,
  heart: (s) => `<path d="M32 54 C14 41 11 24 21.5 18.5 C27 16 31 19.5 32 23.5 C33 19.5 37 16 42.5 18.5 C53 24 50 41 32 54Z" fill="url(#bl${s})" ${sw('#ffb0b0', 1)}/><ellipse cx="24" cy="24" rx="4.6" ry="2.6" fill="rgba(255,255,255,.65)" transform="rotate(-35 24 24)"/><path d="M32 30 V42 M26 36 H38" stroke="#fff6d8" stroke-width="3" stroke-linecap="round"/>`,
  skull: (s) => `<path d="M32 8 C19 8 13 17 13 27 C13 34 17 38 20 40 V48 H44 V40 C47 38 51 34 51 27 C51 17 45 8 32 8Z" fill="url(#bn${s})" ${sw('#4a4436', 1)}/><ellipse cx="24" cy="29" rx="5.4" ry="6" fill="#16101c"/><ellipse cx="40" cy="29" rx="5.4" ry="6" fill="#16101c"/><path d="M32 34 L29.5 41 H34.5Z" fill="#16101c"/><path d="M25 48 V42 M30 48 V43 M34 48 V43 M39 48 V42" stroke="#4a4436" stroke-width="1.2"/><circle cx="24" cy="29" r="1.6" fill="#ff4040"/><circle cx="40" cy="29" r="1.6" fill="#ff4040"/>`,
  eye: (s, c) => `<path d="M5 32 C14 16 50 16 59 32 C50 48 14 48 5 32Z" fill="#f4f1ea" ${sw('#3a2f20', 1.4)}/><circle cx="32" cy="32" r="11" fill="${c}" ${sw('#101018', 1)}/><circle cx="32" cy="32" r="5.4" fill="#0a0a12"/><circle cx="28.5" cy="28.5" r="2.4" fill="#fff" opacity=".9"/>`,
  wings: (s) => `<path d="M31 46 C26 40 20 37 7 35 C11 29 17 24 27 22 C22 26 21 29 24 31 C21 32 19 33 18 35 C23 36 26 38 31 42Z" fill="url(#bn${s})" ${sw('#d8c898', .8)}/><path d="M33 46 C38 40 44 37 57 35 C53 29 47 24 37 22 C42 26 43 29 40 31 C43 32 45 33 46 35 C41 36 38 38 33 42Z" fill="url(#bn${s})" ${sw('#d8c898', .8)}/><path d="M10 31 C17 31 24 34 28 40 M54 31 C47 31 40 34 36 40" stroke="#c9b88a" stroke-width=".8" fill="none"/><circle cx="32" cy="38" r="4" fill="url(#gd${s})"/>`,
  chains: (s) => `<g transform="rotate(-35 32 32)"><rect x="9" y="24" width="30" height="16" rx="8" fill="none" stroke="url(#st${s})" stroke-width="5"/><rect x="25" y="24" width="30" height="16" rx="8" fill="none" stroke="url(#st${s})" stroke-width="5"/><rect x="9" y="24" width="30" height="16" rx="8" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1"/></g>`,
  rune: (s, c) => `<circle cx="32" cy="32" r="21" fill="none" ${sw(c, 2)}/><circle cx="32" cy="32" r="16" fill="none" ${sw('#fff', .8)} opacity=".7"/><polygon points="32,13 48.5,41.5 15.5,41.5" fill="none" ${sw('#fff', 1.6)}/><polygon points="32,51 15.5,22.5 48.5,22.5" fill="none" ${sw(c, 1.4)}/><circle cx="32" cy="32" r="3" fill="#fff"/>`,
  vortex: (s, c) => `<path d="M32 32 m0 0 c3 -3 8 -1 8 4 c0 7 -9 10 -16 6 c-9 -5 -9 -19 -1 -24 c10 -6 25 0 26 13 c1 12 -9 20 -21 18" fill="none" ${sw(c, 3)}/><path d="M32 32 m0 0 c3 -3 8 -1 8 4 c0 7 -9 10 -16 6" fill="none" ${sw('#fff', 1.3)} opacity=".8"/><circle cx="32" cy="32" r="3.2" fill="#05060c" ${sw('#fff', 1)}/>`,
  meteor: (s) => `<path d="M8 8 C20 14 26 20 34 26 L26 34 C20 26 14 20 8 8Z" fill="url(#fl${s})" opacity=".9"/><path d="M4 22 L24 32 M22 4 L32 24" stroke="#ffd070" stroke-width="2" stroke-linecap="round" opacity=".7"/><circle cx="40" cy="40" r="14" fill="url(#rk${s})" ${sw('#1a120c', 1)}/><circle cx="35" cy="37" r="3" fill="rgba(0,0,0,.35)"/><circle cx="45" cy="45" r="2.2" fill="rgba(0,0,0,.3)"/><circle cx="44" cy="35" r="1.8" fill="rgba(0,0,0,.3)"/>`,
  horn: (s, c) => `<g transform="translate(2 6) scale(.82)"><path d="M10 26 L30 22 C42 20 50 24 52 32 C50 40 42 44 30 42 L10 38Z" fill="url(#gd${s})" ${sw('#5a3a10', .8)}/><ellipse cx="52" cy="32" rx="3" ry="9" fill="#2a1a08"/><path d="M12 28 L30 25 M12 36 L30 39" stroke="rgba(255,255,255,.5)" stroke-width="1"/><path d="M56 22 Q61 32 56 42 M59 17 Q67 32 59 47" fill="none" ${sw(c, 1.6)} opacity=".8"/></g>`,
  whirl: (s) => [0, 1, 2].map((i) => `<g transform="rotate(${i * 120} 32 32)"><path d="M32 32 C32 20 40 10 52 12 C46 14 42 20 42 26 C40 30 36 32 32 32Z" fill="url(#st${s})" ${sw('#2c333f', .6)}/></g>`).join('') + `<circle cx="32" cy="32" r="4" fill="url(#gd${s})"/>`,
  nova: (s, c) => { let p = ''; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 11 : 24; p += `${(32 + Math.cos(a) * r).toFixed(1)},${(32 + Math.sin(a) * r).toFixed(1)} `; } return `<polygon points="${p}" fill="url(#or${s})" ${sw(c, 1.2)}/><circle cx="32" cy="32" r="7" fill="#fff"/>`; },
  hourglass: (s) => `<path d="M17 9 H47 M17 55 H47" stroke="url(#gd${s})" stroke-width="4" stroke-linecap="round"/><path d="M20 11 H44 C44 24 36 28 32 32 C36 36 44 40 44 53 H20 C20 40 28 36 32 32 C28 28 20 24 20 11Z" fill="rgba(200,230,255,.28)" ${sw('#d8f0ff', 1.2)}/><path d="M25 14 H39 C38 21 34 24 32 27 C30 24 26 21 25 14Z" fill="#f5d878"/><path d="M32 33 C35 38 40 42 40 51 H24 C24 42 29 38 32 33Z" fill="#f5d878"/>`,
  clone: (s) => `<g opacity=".55" transform="translate(-9 3)"><circle cx="32" cy="18" r="7" fill="url(#sh${s})"/><path d="M19 52 C19 36 24 28 32 28 C40 28 45 36 45 52Z" fill="url(#sh${s})"/></g><g transform="translate(7 -1)"><circle cx="32" cy="18" r="7" fill="#12091f" ${sw('#b58cff', 1)}/><path d="M19 52 C19 36 24 28 32 28 C40 28 45 36 45 52Z" fill="#12091f" ${sw('#b58cff', 1)}/><circle cx="29.5" cy="18" r="1.3" fill="#d8b8ff"/><circle cx="34.5" cy="18" r="1.3" fill="#d8b8ff"/></g>`,
  smoke: (s) => `<circle cx="22" cy="38" r="12" fill="url(#sm${s})"/><circle cx="40" cy="36" r="13" fill="url(#sm${s})"/><circle cx="31" cy="25" r="12" fill="url(#sm${s})"/><circle cx="31" cy="42" r="10" fill="url(#sm${s})" opacity=".9"/><circle cx="31" cy="33" r="3" fill="#ff9a30"/><path d="M31 30 L33 22" stroke="#ffc060" stroke-width="1.6"/>`,
  trap: (s) => `<path d="M10 40 C10 22 54 22 54 40" fill="none" stroke="url(#st${s})" stroke-width="5" stroke-linecap="round"/><path d="M12 38 l4 -7 l3 7 l4 -8 l3 8 l4 -9 l3 9 l3 -9 l4 9 l3 -8 l4 8 l3 -7 l4 7" fill="url(#st${s})" ${sw('#2c333f', .6)}/><rect x="9" y="40" width="46" height="6" rx="2.5" fill="url(#wd${s})"/><circle cx="32" cy="43" r="3" fill="url(#gd${s})"/>`,
  claw: () => `<path d="M18 8 C26 22 34 36 38 56 M30 6 C37 22 44 36 46 56 M44 8 C48 20 54 32 54 50" fill="none" stroke="#ff4a4a" stroke-width="4" stroke-linecap="round"/><path d="M18 8 C26 22 34 36 38 56 M30 6 C37 22 44 36 46 56 M44 8 C48 20 54 32 54 50" fill="none" stroke="#ffd0c0" stroke-width="1.2" stroke-linecap="round"/>`,
  fang: (s) => `<path d="M16 12 C26 10 38 10 48 12 C46 22 42 32 40 44 C37 34 34 28 32 22 C30 28 27 34 24 44 C22 32 18 22 16 12Z" fill="url(#bn${s})" ${sw('#4a4436', 1)}/><path d="M24 44 L24 52 M40 44 L40 52" stroke="#6fe04a" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="56" r="2.6" fill="#7dff4a"/><circle cx="40" cy="56" r="2.6" fill="#7dff4a"/>`,
  leaf: (s) => `<path d="M12 52 C10 28 28 10 54 10 C56 36 38 54 12 52Z" fill="url(#gr${s})" ${sw('#1c4a16', 1)}/><path d="M12 52 C24 40 36 28 52 14 M26 40 L26 28 M34 33 L40 26 M30 38 L40 40" stroke="rgba(255,255,255,.5)" stroke-width="1" fill="none"/>`,
  streak: (s, c) => `<path d="M6 20 H30 M2 32 H36 M6 44 H30" stroke="${c}" stroke-width="3" stroke-linecap="round" opacity=".7"/><path d="M26 16 L56 32 L26 48 L32 32Z" fill="url(#st${s})" ${sw('#2c333f', .8)}/><path d="M32 32 L52 32" stroke="rgba(255,255,255,.7)" stroke-width="1"/>`,
  aura: (s, c) => `<circle cx="32" cy="32" r="22" fill="none" stroke="${c}" stroke-width="2" opacity=".6"/><circle cx="32" cy="32" r="16" fill="none" stroke="${c}" stroke-width="1.4" opacity=".4"/><circle cx="32" cy="19" r="6" fill="url(#gd${s})"/><path d="M20 50 C20 36 25 28 32 28 C39 28 44 36 44 50Z" fill="url(#gd${s})"/><path d="M24 36 L18 28 M40 36 L46 28" stroke="url(#gd${s})" stroke-width="3" stroke-linecap="round"/>`,
  staff: (s, c) => `<rect x="30.6" y="22" width="3" height="36" rx="1.4" fill="url(#wd${s})"/><circle cx="32" cy="17" r="9" fill="url(#or${s})" ${sw(c, 1.4)}/><path d="M23 22 L26 14 M41 22 L38 14 M26 26 L32 29 L38 26" fill="none" stroke="url(#gd${s})" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="29" cy="14" rx="2.4" ry="1.6" fill="rgba(255,255,255,.8)"/>`,
  beam: (s, c) => `<path d="M26 6 H38 L42 58 H22Z" fill="${c}" opacity=".35"/><path d="M29 6 H35 L37 58 H27Z" fill="#fff" opacity=".85"/><ellipse cx="32" cy="58" rx="14" ry="4" fill="${c}" opacity=".8"/>`
};

// ------------------------------------------------------------------ éléments (décor derrière l'objet)
const E = {
  fire: (s, r) => `<path d="M6 60 C10 44 14 40 12 30 C18 36 20 42 22 40 C22 32 26 28 26 20 C32 28 34 38 36 36 C38 30 42 28 42 22 C48 30 52 40 50 60Z" fill="url(#fl${s})" opacity=".75"/>`,
  ice: (s, r) => `<polygon points="6,60 10,38 16,60" fill="url(#ic${s})" opacity=".8"/><polygon points="16,60 22,30 28,60" fill="url(#ic${s})" opacity=".7"/><polygon points="40,60 46,34 52,60" fill="url(#ic${s})" opacity=".8"/><polygon points="50,60 56,42 62,60" fill="url(#ic${s})" opacity=".7"/>`,
  bolt: (s, r) => `<path d="M10 6 L18 22 L10 24 L22 40 M54 6 L46 20 L54 24 L44 38 M6 44 L16 48 L10 56" fill="none" stroke="#cdeeff" stroke-width="1.6" stroke-linejoin="round" opacity=".85"/>`,
  holy: (s, r) => { let o = ''; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; o += `<path d="M32 32 L${(32 + Math.cos(a - .09) * 40).toFixed(1)} ${(32 + Math.sin(a - .09) * 40).toFixed(1)} L${(32 + Math.cos(a + .09) * 40).toFixed(1)} ${(32 + Math.sin(a + .09) * 40).toFixed(1)}Z" fill="#fff3b8" opacity="${i % 2 ? .28 : .45}"/>`; } return o; },
  shadow: (s, r) => `<circle cx="14" cy="46" r="16" fill="#1b0f33" opacity=".7"/><circle cx="50" cy="44" r="18" fill="#2b1650" opacity=".65"/><circle cx="32" cy="58" r="16" fill="#1b0f33" opacity=".7"/><circle cx="52" cy="14" r="9" fill="#3a1f66" opacity=".5"/>`,
  poison: (s, r) => [[14, 46, 5], [24, 54, 3.4], [48, 48, 6], [54, 36, 3], [40, 56, 3.6], [10, 30, 3]].map(([x, y, q]) => `<circle cx="${x}" cy="${y}" r="${q}" fill="rgba(125,255,74,.35)" ${sw('#9dff6a', 1)}/><circle cx="${x - q * .3}" cy="${y - q * .3}" r="${q * .28}" fill="#eaffd8"/>`).join(''),
  arcane: (s, r, c) => `<circle cx="32" cy="32" r="29" fill="none" ${sw(c, 1)} opacity=".7"/><circle cx="32" cy="32" r="25" fill="none" ${sw(c, .8)} stroke-dasharray="2 3" opacity=".7"/><polygon points="32,4 56,46 8,46" fill="none" ${sw(c, .8)} opacity=".45"/>`,
  nature: (s, r) => `<path d="M4 62 C6 46 14 40 24 40 C20 46 14 52 4 62Z M60 62 C58 46 50 40 40 40 C44 46 50 52 60 62Z" fill="url(#gr${s})" opacity=".7"/><path d="M10 18 C14 12 20 12 24 14 C22 20 16 22 10 18Z M54 22 C50 16 44 16 40 18 C42 24 48 26 54 22Z" fill="url(#gr${s})" opacity=".6"/>`,
  blood: (s, r) => [[12, 14, 3], [52, 20, 2.4], [8, 42, 2.6], [56, 46, 3.2], [20, 58, 2.2], [46, 8, 2]].map(([x, y, q]) => `<path d="M${x} ${y - q * 1.8} C${x + q} ${y - q * .4} ${x + q} ${y + q} ${x} ${y + q} C${x - q} ${y + q} ${x - q} ${y - q * .4} ${x} ${y - q * 1.8}Z" fill="url(#bl${s})"/>`).join(''),
  wind: (s, r) => `<path d="M2 18 C16 10 26 24 40 14 C48 9 56 12 62 8 M0 34 C14 28 22 40 36 32 M10 52 C24 46 34 58 48 50 C54 47 58 48 63 46" fill="none" stroke="#e9fbff" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`,
  earth: (s, r) => `<polygon points="2,62 8,44 16,52 22,40 30,62" fill="url(#rk${s})" opacity=".9"/><polygon points="36,62 44,42 50,50 56,36 64,62" fill="url(#rk${s})" opacity=".9"/><circle cx="14" cy="22" r="2.6" fill="url(#rk${s})"/><circle cx="52" cy="18" r="2" fill="url(#rk${s})"/>`,
  none: (s, r, c) => `<circle cx="32" cy="32" r="26" fill="${c}" opacity=".16"/><circle cx="32" cy="32" r="18" fill="${c}" opacity=".14"/>`
};

// ------------------------------------------------------------------ règles identifiant → objet / élément
const MAIN = [
  [/^strike$/, 'sword'], [/twin_blades|blade_dance|phantom_blades|steel_tempest|blade_cyclone/, 'twin'],
  [/knife_fan|thousand_cuts|dagger_storm|blade_hail|blade_rain|shadow_rain|razor_net/, 'knives'],
  [/backstab|quick_stab|deep_cut|eviscerate|throwing_knife|assassinate|poison_blade|rupture|silent_death|executioner|execute|death_lotus/, 'dagger'],
  [/hamstring|rend\b|bloodthirst|rampage|death_mark/, 'claw'], [/venom_burst|deadly_poison|black_plague|poison_arrow/, 'fang'],
  [/ascendant_blade|judgment|verdict|vengeance|light_blade|holy_strike|celestial/, 'sword'],
  [/axe/, 'axe'], [/chains_of_ruin|chains_of_light|chain(?!_l)/, 'chains'],
  [/shield|aegis|bulwark|sanctuary|stoneskin|iron_will|stance|bastion|guardian|frost_armor/, 'shield'], [/vanish|shadow_veil|smoke/, 'smoke'], [/camouflage/, 'leaf'],
  [/wrath_hammer|hammer|heavy|colossus|sunder|world_breaker|titan_fury|smite|titan_fall|earthquake|fissure|boulder/, 'hammer'],
  [/bear_trap|fire_trap|trap/, 'trap'],
  [/rain_of_arrows|heavens_rain|barrage|volley|storm_quiver|multi_shot|arrow_storm|sacred_hail|cluster|fire_rain|thunder_rain/, 'volley'],
  [/quick_shot|power_shot|piercing|deadeye|precise|crippling|explosive_arrow|flaming_arrow|phantom_shot|dawn_lance|thunder_arrow|meteor_arrow|frost_arrow|rapid_fire|ice_lance|javelin/, 'arrow'],
  [/skyfall|meteor|nightfall|frost_comet|starfall|sunfall|sky_collapse/, 'meteor'], [/hunters_mark|eagle_eye|zenith_mark/, 'eye'],
  [/heal|second_wind|vigor|blessing|redemption|holy_hymn|divine_intervention|life_drain/, 'heart'], [/guardian_light|light_column|sunbeam|energy_ray|blinding|heaven_gate/, 'beam'],
  [/wings|ascension|wrath_of_heaven|archangel|divine_wind/, 'wings'], [/divine_wrath|consecration|eternal_vow|champion/, 'cross'],
  [/skull|oblivion|soul_reaper|void_reap|bloodthirst/, 'skull'], [/shadow_clone|shadow_master|paralyze/, 'clone'], [/timefracture|time/, 'hourglass'],
  [/singularity|gravity_well|eclipse|arcane_apocalypse|void_bolt|arcane_overload/, 'vortex'], [/ice_prison|frost_nova|blizzard|absolute_zero/, 'ice'],
  [/thunderbolt|chain_lightning|spark|shockwave|storm_cage|lightning|thunder_hammer/, 'bolt'], [/firebolt|fireball|cataclysm|ignite/, 'fireball'],
  [/flame_wall|ignite|inferno|wildfire/, 'flame'], [/warcry|roar|horn/, 'horn'],
  [/shuriken|whirlwind|elemental_storm|windrunner|holy_storm|cyclone|storm/, 'whirl'], [/holy_nova|radiant|nova|burst/, 'nova'],
  [/shadow_step|shadow_leap|charge|leap|onslaught|blink|backflip|evasion|dash/, 'streak'],
  [/berserker|warblood|endless_fury|holy_charge|mana_surge|aura/, 'aura'], [/nature_call|leaf/, 'leaf'],
  [/arcane_missile|arcane_devastation|mana_siphon|shadow_swarm/, 'orb']
];
const ELEM = [
  [/fire|flame|ignite|inferno|wildfire|cataclysm|meteor|sunfall|ember|rapid_fire|explosive|firebolt|fireball|berserker|nightfall|phoenix/, 'fire'],
  [/frost|ice|blizzard|zero|prison|comet/, 'ice'], [/thunder|lightning|spark|shock|tempest|storm_cage|chain_lightning|steel/, 'bolt'],
  [/holy|divine|heaven|radiant|light|sun|dawn|sacred|celestial|judgment|verdict|redemption|blessing|ascen|archangel|angel|consecr|vow|guardian|bastion|sanctuary|champion|smite|vengeance|aegis|faith|wrath_of_heaven/, 'holy'],
  [/shadow|void|death|soul|oblivion|assassin|silent|vanish|camouflage|clone|smoke|night|execut|reap|lotus|backstab|phantom|paralyze|eclipse|veil/, 'shadow'],
  [/poison|venom|plague|toxin|deadly/, 'poison'], [/arcane|mana|time|singularity|gravity|apocalypse|overload|elemental|missile|siphon/, 'arcane'],
  [/nature|eagle|hunter|wind|whirl|cyclone|windrunner|evasion|arrow_storm|storm_quiver|volley|rain|multi|barrage/, 'wind'],
  [/earth|quake|fissure|boulder|stone|colossus|titan|world_breaker|sunder|rampage|hamstring|rend|bloodthirst|warblood|warcry|roar|horn|fury|rage|blood|hammer|heavy|iron|axe|bulwark|charge|onslaught|leap|trap|bear/, 'blood'],
  [/leaf|nature_call|trap/, 'nature']
];
const CLASS_ELEM = { warrior: 'blood', paladin: 'holy', mage: 'arcane', archer: 'nature', assassin: 'shadow' };
const CLASS_MAIN = { warrior: 'sword', paladin: 'cross', mage: 'orb', archer: 'arrow', assassin: 'dagger' };

export function artChoice(skill, classId) {
  const id = skill.id || '';
  const cls = skill.classId || classId;
  let main = null, elem = null;
  for (const [re, m] of MAIN) if (re.test(id)) { main = m; break; }
  for (const [re, e] of ELEM) if (re.test(id)) { elem = e; break; }
  return { main: main || CLASS_MAIN[cls] || 'orb', elem: elem || CLASS_ELEM[cls] || 'none' };
}

const ROTATABLE = new Set(['sword', 'dagger', 'axe', 'hammer', 'arrow', 'staff', 'leaf', 'claw', 'fang', 'bolt', 'cross', 'beam']);

// Retourne { defs, art } : à insérer dans le <svg> du cadre ; `clip` = identifiant du clipPath du cadre.
export function skillArt(skill, classId, s, col, clip) {
  const { main, elem } = artChoice(skill, classId);
  const h = hash(skill.id);
  const r = rng(h ^ 0x51ed270b);
  const c = col, flip = (h >>> 5) & 1;
  const rot = ROTATABLE.has(main) ? Math.round((r() - 0.5) * 70) : Math.round((r() - 0.5) * 16);
  const sc = 0.82 + r() * 0.12;
  let spark = '';
  const n = 3 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) { const a = r() * 6.283, d = 20 + r() * 8, x = 32 + Math.cos(a) * d, y = 32 + Math.sin(a) * d, q = 0.8 + r() * 1.4; spark += `<path d="M${x.toFixed(1)} ${(y - q * 2).toFixed(1)} L${(x + q * .5).toFixed(1)} ${(y - q * .5).toFixed(1)} L${(x + q * 2).toFixed(1)} ${y.toFixed(1)} L${(x + q * .5).toFixed(1)} ${(y + q * .5).toFixed(1)} L${x.toFixed(1)} ${(y + q * 2).toFixed(1)} L${(x - q * .5).toFixed(1)} ${(y + q * .5).toFixed(1)} L${(x - q * 2).toFixed(1)} ${y.toFixed(1)} L${(x - q * .5).toFixed(1)} ${(y - q * .5).toFixed(1)}Z" fill="#fff" opacity="${(0.5 + r() * 0.4).toFixed(2)}"/>`; }
  const bgx = 20 + r() * 24, bgy = 14 + r() * 14;
  const art = `<g class="sk-art" clip-path="url(#${clip})">`
    + `<rect width="64" height="64" fill="url(#bg${s})"/>`
    + E[elem](s, r, c)
    + `<g transform="translate(32 32) rotate(${rot}) scale(${flip ? -sc : sc} ${sc}) translate(-32 -32)" filter="url(#ds${s})">${M[main](s, c)}</g>`
    + spark
    + `<rect width="64" height="64" fill="url(#vg${s})"/>`
    + `</g>`;
  const d = defs(s)
    + `<radialGradient id="bg${s}" cx="${(bgx / 64).toFixed(2)}" cy="${(bgy / 64).toFixed(2)}" r="0.95"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset=".55" stop-color="#101626"/><stop offset="1" stop-color="#05070f"/></radialGradient>`
    + `<radialGradient id="vg${s}" cx=".5" cy=".5" r=".6"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>`
    + `<filter id="ds${s}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.1" flood-color="#000" flood-opacity=".6"/></filter>`;
  return { defs: d, art, sig: `${main}|${elem}|${rot}|${flip}|${n}` };
}
