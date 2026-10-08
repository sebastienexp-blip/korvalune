import * as THREE from 'three';

// Étiquette 3D (sprite) au-dessus des PNJ / ennemis.
const _cache = new Map();
export function makeLabel(text, { color = '#ffffff', size = 46, width = 512, height = 96, scale = 2.6, cache = false } = {}) {
  const key = cache ? `${text}|${color}|${size}|${width}|${height}` : null;
  if (key && _cache.has(key)) {
    const tex = _cache.get(key);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false }));
    sp.scale.set(scale, (scale * height) / width, 1); sp.renderOrder = 20;
    return sp;
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  g.font = `700 ${size}px "Trebuchet MS", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 9;
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.strokeText(text, width / 2, height / 2);
  g.fillStyle = color;
  g.fillText(text, width / 2, height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (key) {
    tex.userData.shared = true; // partagée : ne pas la libérer avec un sprite
    if (_cache.size > 150) { const k0 = _cache.keys().next().value; _cache.get(k0).dispose(); _cache.delete(k0); }
    _cache.set(key, tex);
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false }));
  sprite.scale.set(scale, (scale * height) / width, 1);
  sprite.renderOrder = 20;
  return sprite;
}
