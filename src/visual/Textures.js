import * as THREE from 'three';

// Textures procédurales (canvas) — V2.5. Toutes petites (≤256 px) pour rester
// légères sur mobile. Chaque fonction est enveloppée par l'appelant dans un
// try/catch : en cas d'échec, le jeu retombe sur l'apparence V2.

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// PRNG déterministe local (textures identiques à chaque lancement)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Détail de sol : bruit à plusieurs échelles, quasi-blanc (multiplie la couleur
// de vertex). Sans coutures (les éléments qui débordent sont redessinés en miroir).
export function groundDetailTexture() {
  const S = 256;
  const [c, g] = canvas(S);
  const r = rng(7);
  g.fillStyle = '#d6d6d6';
  g.fillRect(0, 0, S, S);
  const wrapDraw = (x, y, rad, fn) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      if (x + ox + rad < 0 || x + ox - rad > S || y + oy + rad < 0 || y + oy - rad > S) continue;
      fn(x + ox, y + oy);
    }
  };
  // taches douces
  for (let i = 0; i < 260; i++) {
    const x = r() * S, y = r() * S, rad = 6 + r() * 26, v = 150 + r() * 105;
    wrapDraw(x, y, rad, (px, py) => {
      const gr = g.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.22)`);
      gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr;
      g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
  // brins d'herbe / grain
  for (let i = 0; i < 1500; i++) {
    const x = r() * S, y = r() * S, v = 120 + r() * 120, l = 2 + r() * 5, a = -1.2 + r() * 0.5;
    wrapDraw(x, y, l, (px, py) => {
      g.strokeStyle = `rgba(${v},${v},${v},0.5)`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l * 0.4, py + Math.sin(a) * l); g.stroke();
    });
  }
  // petits cailloux clairs
  for (let i = 0; i < 90; i++) {
    const x = r() * S, y = r() * S;
    wrapDraw(x, y, 3, (px, py) => {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.ellipse(px, py, 1.4 + r() * 1.6, 1 + r(), r() * 3, 0, Math.PI * 2); g.fill();
    });
  }
  return toTexture(c, { repeat: true });
}

// Halo doux (soleil, orbes, flashs)
export function glowTexture(size = 64, inner = 0.15) {
  const [c, g] = canvas(size);
  const h = size / 2;
  const gr = g.createRadialGradient(h, h, 0, h, h, h);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(inner, 'rgba(255,255,255,0.75)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return toTexture(c);
}

// Arc de coup (croissant dégradé) : mappé sur un anneau partiel
export function slashTexture() {
  const W = 128, H = 32;
  const [c, g] = canvas(W, H);
  const gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.92, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  // affine les bords (cœur plus lumineux au centre de la bande)
  const v = g.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, 'rgba(0,0,0,1)');
  v.addColorStop(0.5, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  return toTexture(c);
}

// Anneau d'onde de choc
export function ringTexture() {
  const S = 128;
  const [c, g] = canvas(S);
  const h = S / 2;
  const gr = g.createRadialGradient(h, h, h * 0.55, h, h, h);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.85, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  return toTexture(c);
}

// Cercle magique runique (sol)
export function runeTexture() {
  const S = 256, h = S / 2;
  const [c, g] = canvas(S);
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 3;
  g.beginPath(); g.arc(h, h, h - 6, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(h, h, h - 16, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(h, h, h * 0.55, 0, Math.PI * 2); g.stroke();
  // étoile à 6 branches (deux triangles)
  for (let k = 0; k < 2; k++) {
    g.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + k * Math.PI / 3 - Math.PI / 2;
      const x = h + Math.cos(a) * (h * 0.55), y = h + Math.sin(a) * (h * 0.55);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.stroke();
  }
  // glyphes
  const r = rng(3);
  g.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, rr = h - 11;
    const x = h + Math.cos(a) * rr, y = h + Math.sin(a) * rr;
    g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
    g.beginPath();
    g.moveTo(-3, -4); g.lineTo(r() > 0.5 ? 3 : -3, 0); g.lineTo(3, 4);
    g.stroke(); g.restore();
  }
  const gl = g.createRadialGradient(h, h, 0, h, h, h * 0.55);
  gl.addColorStop(0, 'rgba(255,255,255,0.35)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl;
  g.beginPath(); g.arc(h, h, h * 0.55, 0, Math.PI * 2); g.fill();
  return toTexture(c);
}

// Crépi + colombages (murs de maisons)
export function plasterTexture(timber = true) {
  const S = 128;
  const [c, g] = canvas(S);
  const r = rng(11);
  g.fillStyle = '#e4dccb';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) {
    const v = 190 + r() * 60;
    g.fillStyle = `rgba(${v},${v - 6},${v - 18},0.18)`;
    g.fillRect(r() * S, r() * S, 1 + r() * 4, 1 + r() * 3);
  }
  if (timber) {
    g.fillStyle = '#4d3523';
    g.fillRect(0, 0, S, 8); g.fillRect(0, S - 8, S, 8);
    g.fillRect(0, 0, 8, S); g.fillRect(S - 8, 0, 8, S);
    g.fillRect(S / 2 - 4, 0, 8, S);
    g.save(); g.translate(0, 0);
    g.lineWidth = 7; g.strokeStyle = '#4d3523';
    g.beginPath(); g.moveTo(8, S - 8); g.lineTo(S / 2 - 4, 8); g.moveTo(S - 8, S - 8); g.lineTo(S / 2 + 4, 8); g.stroke();
    g.restore();
    // veinures du bois
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
      const x = r() * S; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 3, S); g.stroke();
    }
  }
  return toTexture(c, { repeat: true });
}

// Tuiles de toit
export function roofTexture() {
  const S = 128;
  const [c, g] = canvas(S);
  const r = rng(5);
  g.fillStyle = '#b8b8b8';
  g.fillRect(0, 0, S, S);
  const rows = 8, rh = S / rows, tw = S / 8;
  for (let y = 0; y < rows; y++) {
    for (let x = -1; x < 9; x++) {
      const v = 150 + r() * 100;
      g.fillStyle = `rgb(${v},${v},${v})`;
      const px = x * tw + (y % 2 ? tw / 2 : 0);
      g.beginPath();
      g.moveTo(px, y * rh); g.lineTo(px + tw - 1, y * rh);
      g.lineTo(px + tw - 1, y * rh + rh * 0.65);
      g.quadraticCurveTo(px + tw / 2, y * rh + rh * 1.15, px, y * rh + rh * 0.65);
      g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, y * rh + rh - 2, S, 2);
  }
  return toTexture(c, { repeat: true });
}

// Pierre appareillée (socles, puits, portail)
export function stoneTexture() {
  const S = 128;
  const [c, g] = canvas(S);
  const r = rng(21);
  g.fillStyle = '#9a968a';
  g.fillRect(0, 0, S, S);
  const rows = 4, rh = S / rows;
  for (let y = 0; y < rows; y++) {
    let x = (y % 2) * -16;
    while (x < S) {
      const w = 28 + r() * 22, v = 150 + r() * 70;
      g.fillStyle = `rgb(${v},${v - 3},${v - 10})`;
      g.fillRect(x + 1.5, y * rh + 1.5, w - 3, rh - 3);
      x += w;
    }
  }
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.12})`;
    g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
  }
  return toTexture(c, { repeat: true });
}

// Écorce / bois
export function barkTexture() {
  const S = 64;
  const [c, g] = canvas(S);
  const r = rng(31);
  g.fillStyle = '#9b9b9b';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x = r() * S, v = 80 + r() * 120;
    g.strokeStyle = `rgba(${v},${v},${v},0.7)`;
    g.lineWidth = 1 + r() * 2;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 6, S); g.stroke();
  }
  return toTexture(c, { repeat: true });
}

// Feuillage : amas de feuilles (alpha-less, sert de bruit de surface)
export function leafTexture() {
  const S = 128;
  const [c, g] = canvas(S);
  const r = rng(41);
  g.fillStyle = '#b4b4b4';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const v = 120 + r() * 135, x = r() * S, y = r() * S, a = r() * 6.28;
    g.fillStyle = `rgba(${v},${v},${v},0.55)`;
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.ellipse(0, 0, 3 + r() * 4, 1.4 + r() * 1.6, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  return toTexture(c, { repeat: true });
}

// Bruit de roche (fissures + grain)
export function rockTexture() {
  const S = 128;
  const [c, g] = canvas(S);
  const r = rng(51);
  g.fillStyle = '#b0b0b0';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 400; i++) {
    const v = 120 + r() * 120;
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    g.beginPath(); g.ellipse(r() * S, r() * S, 2 + r() * 8, 2 + r() * 6, r() * 3, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    let x = r() * S, y = r() * S;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 22; y += (r() - 0.5) * 22; g.lineTo(x, y); }
    g.stroke();
  }
  return toTexture(c, { repeat: true });
}

// Écailles de vagues / reflets (2e couche d'eau)
export function waterSparkleTexture() {
  const S = 128;
  const [c, g] = canvas(S);
  const r = rng(61);
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 160; i++) {
    const x = r() * S, y = r() * S, l = 3 + r() * 10;
    g.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.35})`;
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 2, x + l, y); g.stroke();
  }
  return toTexture(c, { repeat: true });
}

// Nuage cotonneux (sprite)
export function cloudTexture() {
  const S = 128;
  const [c, g] = canvas(S, 64);
  const r = rng(71);
  for (let i = 0; i < 16; i++) {
    const x = 20 + r() * 88, y = 28 + (r() - 0.5) * 14, rad = 12 + r() * 14;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return toTexture(c);
}

// Spirale de portail (bras tournants dégradés)
export function spiralTexture() {
  const S = 256, h = S / 2;
  const [c, g] = canvas(S);
  g.translate(h, h);
  for (let arm = 0; arm < 5; arm++) {
    g.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, a = arm * (Math.PI * 2 / 5) + t * 5.2, r = 8 + t * (h - 14);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 10; g.lineCap = 'round'; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.stroke();
  }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, h);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = gr; g.fillRect(-h, -h, S, S);
  // fondu des bords
  g.globalCompositeOperation = 'destination-in';
  const e = g.createRadialGradient(0, 0, h * 0.55, 0, 0, h);
  e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = e; g.fillRect(-h, -h, S, S);
  return toTexture(c);
}

// Utilitaire : applique une texture en essayant, sans jamais lever d'exception
export function safeTexture(fn, ...args) {
  try { return fn(...args); } catch (e) { console.warn('[V2.5] texture ignorée:', fn.name, e); return null; }
}
