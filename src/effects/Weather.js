import * as THREE from 'three';
import { clamp, lerp } from '../core/math.js';

const STATES = ['clear', 'cloudy', 'rain', 'storm'];
const SNOW_STATE = 'snow';

function streakTexture() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Cycle météo dynamique : ciel dégagé, nuageux, pluie, orage (éclairs + tonnerre),
// et neige (réservée aux Montagnes de Fer). Purement visuel/sonore — n'affecte
// pas encore le gameplay (glissade, dégâts de foudre...), ce qui reste ouvert
// pour une future étape.
export class Weather {
  constructor(scene, bus, audio) {
    this.scene = scene; this.bus = bus; this.audio = audio;
    this.state = 'clear';
    this.intensity = 0; // 0..1, monte/descend en douceur vers l'intensité cible
    this.targetIntensity = 0;
    this.nextChangeT = 14 + Math.random() * 10;
    this.nextLightningT = 6;
    this.count = 900;

    const rainGeo = new THREE.BufferGeometry();
    this._rainPos = new Float32Array(this.count * 3);
    this._rainVel = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) this._resetDrop(i, true);
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this._rainPos, 3));
    this.rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ map: streakTexture(), size: 1.1, color: 0xaecbe0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.rain.frustumCulled = false;
    scene.add(this.rain);

    const snowGeo = new THREE.BufferGeometry();
    this._snowPos = new Float32Array(this.count * 3);
    this._snowPhase = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) this._resetFlake(i, true);
    snowGeo.setAttribute('position', new THREE.BufferAttribute(this._snowPos, 3));
    this.snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: softDot(), size: 0.5, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.snow.frustumCulled = false;
    scene.add(this.snow);

    this.flashEl = document.createElement('div');
    Object.assign(this.flashEl.style, { position: 'fixed', inset: '0', background: '#fff', opacity: '0', pointerEvents: 'none', zIndex: '25', transition: 'opacity 0.08s ease-out' });
    document.body.appendChild(this.flashEl);
  }

  _resetDrop(i, initial) {
    this._rainPos[i * 3] = (Math.random() - 0.5) * 90;
    this._rainPos[i * 3 + 1] = initial ? Math.random() * 40 : 40;
    this._rainPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    this._rainVel[i] = 18 + Math.random() * 10;
  }
  _resetFlake(i, initial) {
    this._snowPos[i * 3] = (Math.random() - 0.5) * 70;
    this._snowPos[i * 3 + 1] = initial ? Math.random() * 35 : 35;
    this._snowPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    this._snowPhase[i] = Math.random() * 10;
  }

  // Appelée par ZoneManager quand la zone change — la neige n'apparaît qu'en montagne.
  setAllowSnow(v) { this.allowSnow = v; }

  _pickNextState() {
    if (this.state === 'rain' || this.state === 'storm') return Math.random() < 0.7 ? 'clear' : 'cloudy'; // la pluie ne s'enchaîne plus
    if (this.allowSnow && Math.random() < 0.25) return SNOW_STATE;
    const weights = { clear: 0.66, cloudy: 0.27, rain: 0.06, storm: 0.01 };
    let r = Math.random(), acc = 0;
    for (const s of STATES) { acc += weights[s]; if (r <= acc) return s; }
    return 'clear';
  }

  _enterState(s) {
    this.state = s;
    this.targetIntensity = { clear: 0, cloudy: 0.25, rain: 0.5, storm: 0.9, snow: 0.5 }[s] ?? 0;
    if (s === 'rain' || s === 'storm') this.bus.emit('notify', { text: s === 'storm' ? '⛈ Un orage approche…' : '🌧 Il commence à pleuvoir…', kind: 'info' });
    else if (s === SNOW_STATE) this.bus.emit('notify', { text: '❄ La neige tombe sur les cimes.', kind: 'info' });
    else if (s === 'clear' && this.intensity > 0.3) this.bus.emit('notify', { text: '☀ Le ciel se dégage.', kind: 'info' });
  }

  update(dt, camera, sun, hemi) {
    this.nextChangeT -= dt;
    if (this.nextChangeT <= 0) {
      this.nextChangeT = this.state === 'rain' || this.state === 'storm' ? 35 + Math.random() * 30 : 70 + Math.random() * 80;
      const next = this._pickNextState();
      if (next !== this.state) this._enterState(next);
    }
    this.intensity = lerp(this.intensity, this.targetIntensity, Math.min(1, dt * 0.35));

    const isRain = this.state === 'rain' || this.state === 'storm';
    const isSnow = this.state === SNOW_STATE;
    this.rain.material.opacity = isRain ? clamp(this.intensity, 0, 0.85) : Math.max(0, this.rain.material.opacity - dt);
    this.snow.material.opacity = isSnow ? clamp(this.intensity, 0, 0.9) : Math.max(0, this.snow.material.opacity - dt);
    this.rain.visible = this.rain.material.opacity > 0.01;
    this.snow.visible = this.snow.material.opacity > 0.01;

    if (this.rain.visible) {
      this.rain.position.set(camera.position.x, 0, camera.position.z);
      for (let i = 0; i < this.count; i++) {
        this._rainPos[i * 3 + 1] -= this._rainVel[i] * dt;
        if (this._rainPos[i * 3 + 1] < -2) this._resetDrop(i, false);
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    if (this.snow.visible) {
      this.snow.position.set(camera.position.x, 0, camera.position.z);
      const t = performance.now() * 0.001;
      for (let i = 0; i < this.count; i++) {
        this._snowPos[i * 3 + 1] -= 1.6 * dt;
        this._snowPos[i * 3] += Math.sin(t * 0.6 + this._snowPhase[i]) * 0.35 * dt;
        if (this._snowPos[i * 3 + 1] < -2) this._resetFlake(i, false);
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }

    // Lumière plus tamisée par mauvais temps (l'assombrissement du ciel est
    // déjà géré par le cycle jour/nuit ; on ne touche ici qu'à l'intensité).
    const dim = this.intensity * (this.state === 'storm' ? 0.55 : 0.3);
    if (sun) sun.intensity *= (1 - dim);
    if (hemi) hemi.intensity *= (1 - dim * 0.6);

    // Ambiance sonore : gérée par Game (audio.setEnvironment) à partir de this.state / this.intensity

    if (this.state === 'storm') {
      this.nextLightningT -= dt;
      if (this.nextLightningT <= 0) {
        this.nextLightningT = 5 + Math.random() * 9;
        this._lightning();
      }
    }
  }

  _lightning() {
    this.flashEl.style.transition = 'opacity 0.05s ease-out';
    this.flashEl.style.opacity = '0.55';
    setTimeout(() => { this.flashEl.style.opacity = '0'; }, 90);
    setTimeout(() => { this.flashEl.style.opacity = '0.25'; setTimeout(() => (this.flashEl.style.opacity = '0'), 70); }, 160);
    setTimeout(() => this.audio.thunder(), 250 + Math.random() * 900); // le tonnerre arrive après l'éclair
  }
}
