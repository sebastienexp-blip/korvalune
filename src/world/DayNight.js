import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { smoothstep } from '../core/math.js';
import { isSafeMode } from '../visual/Safe.js';
import { glowTexture, cloudTexture, safeTexture } from '../visual/Textures.js';

// h, ciel haut, ciel horizon, lumière, intensité, hémisphère, brouillard
const K = (h, top, hor, light, li, hemi, fog) => ({ h, top: new THREE.Color(top), hor: new THREE.Color(hor), light: new THREE.Color(light), li, hemi, fog: new THREE.Color(fog) });
const MOON = 0x8ea6e6;
const KEYS = [
  K(0, 0x050a1c, 0x101a36, MOON, 0.35, 0.28, 0x0c1428),
  K(5, 0x050a1c, 0x101a36, MOON, 0.35, 0.28, 0x0c1428),
  K(6, 0x1e2f5a, 0xb0603f, MOON, 0.06, 0.3, 0x6b4a4a),
  K(6.6, 0x3a5c9a, 0xff9660, 0xffa562, 2.0, 0.6, 0xd8a17c),
  K(8.5, 0x3a86d8, 0xcfe3f5, 0xfff0d8, 3.2, 1.0, 0xc3d9ea),
  K(12, 0x2c78d2, 0xbfdcf6, 0xffffff, 3.6, 1.1, 0xbcd6ea),
  K(16.5, 0x3a86d8, 0xcfe3f5, 0xfff0d8, 3.2, 1.0, 0xc3d9ea),
  K(17.4, 0x3c5c9a, 0xff8048, 0xff9a5a, 2.0, 0.6, 0xd68a68),
  K(18, 0x232f5e, 0xb5533f, MOON, 0.06, 0.3, 0x5a3f4a),
  K(19.5, 0x0a1230, 0x1e2140, MOON, 0.35, 0.28, 0x101830),
  K(24, 0x050a1c, 0x101a36, MOON, 0.35, 0.28, 0x0c1428)
];

export class DayNight {
  constructor(scene, quality, v25 = true) {
    this.scene = scene;
    this.v25 = !!v25;
    this.hour = CONFIG.dayNight.startHour;
    this.night = 0;
    this.sunDir = new THREE.Vector3();
    this._white = new THREE.Color(0xffffff);
    this._moonDir = new THREE.Vector3();
    this.cur = { top: new THREE.Color(), hor: new THREE.Color(), light: new THREE.Color(), fog: new THREE.Color() };

    this.real = true; // V9.3 : rendu réaliste (soleil plus bas, lumière chaude, lumière de contre-jour froide)
    this._lightDir = new THREE.Vector3(); this._warm = new THREE.Color(0xffc98a);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3327, 1);
    this.fill = new THREE.DirectionalLight(0x9bbcff, 0); // contre-jour bleuté sans ombre : détache les silhouettes
    this.fill.castShadow = false;
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.05;
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -55;
    cam.right = cam.top = 55;
    cam.near = 1;
    cam.far = 320;
    scene.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);

    const richSky = this.v25 && !isSafeMode();
    this.skyUniforms = {
      top: { value: this.cur.top }, hor: { value: this.cur.hor },
      sunDir: { value: this.sunDir }, sunCol: { value: new THREE.Color(0xffd9a0) }, sunAmt: { value: 1 }
    };
    const skyFrag = richSky
      ? `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunAmt; varying vec3 vP;
void main(){
  vec3 d = normalize(vP);
  float h = d.y;
  float t = pow(clamp(h, 0.0, 1.0), 0.5);
  vec3 col = mix(hor, top, t);
  // voile de brume à l'horizon
  col = mix(col, hor * 1.08, (1.0 - smoothstep(0.0, 0.22, abs(h))) * 0.45);
  // halo solaire : large (diffusion) + cœur
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunCol * (pow(s, 5.0) * 0.20 + pow(s, 48.0) * 0.55 + pow(s, 600.0) * 1.2) * sunAmt;
  // sous l'horizon : fondu vers la couleur de brume
  col = mix(col, hor * 0.85, 1.0 - smoothstep(-0.25, 0.0, h));
  gl_FragColor = vec4(col, 1.0);
#include <colorspace_fragment>
}`
      : 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = normalize(vP).y; float t = pow(clamp(h, 0.0, 1.0), 0.55); gl_FragColor = vec4(mix(hor, top, t), 1.0);\n#include <colorspace_fragment>\n}';
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(450, 32, 20),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
        uniforms: this.skyUniforms,
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: skyFrag
      })
    );
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1c4, fog: false }));
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false }));
    scene.add(this.sunMesh, this.moonMesh);
    this.sunGlow = this.moonGlow = null;
    if (this.v25) {
      const gt = safeTexture(glowTexture, 128, 0.1);
      if (gt) {
        const mk = (color, size) => {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
          sp.scale.setScalar(size); sp.renderOrder = -9; sp.frustumCulled = false; scene.add(sp); return sp;
        };
        this.sunGlow = mk(0xffe6b0, 150);
        this.moonGlow = mk(0x9fb8ff, 70);
      }
    }

    const sp = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      sp[i * 3] = Math.cos(a) * r * 420; sp[i * 3 + 1] = Math.abs(u) * 420; sp[i * 3 + 2] = Math.sin(a) * r * 420;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Nuages : un seul InstancedMesh
    const clouds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, fog: false, depthWrite: false }), 110);
    const d = new THREE.Object3D();
    let n = 0;
    for (let c = 0; c < 22; c++) {
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 260, cy = 110 + Math.random() * 60;
      for (let k = 0; k < 5; k++, n++) {
        d.position.set(Math.cos(a) * r + (k - 2) * 22 * Math.random(), cy + Math.random() * 6, Math.sin(a) * r + Math.random() * 20);
        const s = 16 + Math.random() * 20;
        d.scale.set(s * 1.6, s * 0.45, s);
        d.updateMatrix();
        clouds.setMatrixAt(n, d.matrix);
      }
    }
    clouds.frustumCulled = false;
    this.clouds = clouds;
    this.cloudPlanes = null;
    const ct = this.v25 ? safeTexture(cloudTexture) : null;
    if (ct) {
      // nuages cotonneux : plans horizontaux texturés (un seul draw call), plus doux que des sphères
      const planeGeo = new THREE.PlaneGeometry(1, 0.5).rotateX(-Math.PI / 2);
      const cp = new THREE.InstancedMesh(planeGeo, new THREE.MeshBasicMaterial({ map: ct, transparent: true, opacity: 0.85, depthWrite: false, fog: false, side: THREE.DoubleSide }), 46);
      for (let i = 0; i < 46; i++) {
        const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 330, sz = 90 + Math.random() * 150;
        d.position.set(Math.cos(a) * r, 120 + Math.random() * 70, Math.sin(a) * r);
        d.rotation.set(0, Math.random() * Math.PI, 0);
        d.scale.set(sz, 1, sz * (0.5 + Math.random() * 0.4));
        d.updateMatrix();
        cp.setMatrixAt(i, d.matrix);
      }
      cp.frustumCulled = false;
      cp.renderOrder = -8;
      this.cloudPlanes = cp;
      scene.add(cp);
      clouds.visible = false; // l'ancien nuage en sphères est remplacé
    }
    scene.add(clouds);

    scene.fog = new THREE.Fog(0xbfd6e8, 30, 200);
    this.setShadows(quality.shadows, quality.shadowMap);
  }

  setShadows(enabled, size) {
    this.sun.castShadow = enabled;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
  }

  update(dt, focus, camera) {
    // jour long, nuit courte : le temps s'écoule ~2,6x plus vite quand il fait noir
    const h0 = this.hour;
    const dark = h0 >= 19 || h0 < 5.2 ? 1 : h0 >= 17.4 ? smoothstep(17.4, 19, h0) : h0 >= 5.2 && h0 < 6.6 ? 1 - smoothstep(5.2, 6.6, h0) : 0;
    const rate = 1 + dark * 1.6;
    this.hour = (this.hour + (dt * 24 * rate) / CONFIG.dayNight.cycleSeconds) % 24;
    let i = 0;
    while (i < KEYS.length - 2 && this.hour >= KEYS[i + 1].h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = (this.hour - a.h) / (b.h - a.h);
    this.cur.top.lerpColors(a.top, b.top, t);
    this.cur.hor.lerpColors(a.hor, b.hor, t);
    this.cur.light.lerpColors(a.light, b.light, t);
    this.cur.fog.lerpColors(a.fog, b.fog, t);
    const li = a.li + (b.li - a.li) * t, hemi = a.hemi + (b.hemi - a.hemi) * t;

    const ang = ((this.hour - 6) / 12) * Math.PI;
    this.sunDir.set(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    this.night = smoothstep(0.12, -0.2, this.sunDir.y);

    const dir = this.sunDir.y >= 0 ? this.sunDir : this._moonDir.copy(this.sunDir).negate();
    this.sun.color.copy(this.cur.light);
    this.sun.intensity = li;
    const dayK = smoothstep(0.05, 0.45, this.sunDir.y);
    if (this.real) {
      // soleil plus rasant (ombres longues), teinte dorée, ombres plus contrastées
      const ld = this._lightDir.copy(dir); if (this.sunDir.y >= 0) { ld.y *= 0.62; ld.z += 0.28; ld.normalize(); }
      this.sun.color.lerp(this._warm, 0.42 * dayK);
      this.sun.intensity = li * (1 + 0.08 * dayK);
      this.sun.position.copy(focus).addScaledVector(ld, 140);
      this.fill.color.setRGB(0.55, 0.68, 1).lerp(this.cur.hor, 0.25);
      this.fill.intensity = 0.55 * dayK + 0.12;
      this.fill.position.copy(focus).addScaledVector(ld, -90); this.fill.position.y = focus.y + 45;
      this.fill.target.position.copy(focus);
    } else {
      this.fill.intensity = 0;
      this.sun.position.copy(focus).addScaledVector(dir, 140);
    }
    this.sun.target.position.copy(focus);
    if (this.real) this.hemi.groundColor.setRGB(0.2 + 0.22 * dayK, 0.15 + 0.14 * dayK, 0.1 + 0.07 * dayK); else this.hemi.groundColor.setHex(0x3a3327);
    this.hemi.intensity = this.real ? hemi * (1 - 0.14 * dayK) : hemi;
    this.hemi.color.copy(this.cur.hor).lerp(this.cur.top, 0.5).lerp(this._white, 0.3);

    this.scene.fog.color.copy(this.cur.fog);
    this.dome.position.copy(camera.position);
    this.sunMesh.position.copy(camera.position).addScaledVector(this.sunDir, 400);
    this.moonMesh.position.copy(camera.position).addScaledVector(this.sunDir, -400);
    this.stars.position.copy(camera.position);
    this.stars.material.opacity = this.night * 0.95;
    this.clouds.position.set(camera.position.x, 0, camera.position.z);
    this.clouds.rotation.y += dt * 0.004;
    this.clouds.material.color.setScalar(0.25 + 0.75 * (1 - this.night));
    this.skyUniforms.sunAmt.value = smoothstep(-0.12, 0.12, this.sunDir.y);
    this.skyUniforms.sunCol.value.copy(this.cur.light).lerp(this._white, 0.25);
    if (this.sunGlow) {
      this.sunGlow.position.copy(camera.position).addScaledVector(this.sunDir, 380);
      this.sunGlow.material.opacity = smoothstep(-0.1, 0.15, this.sunDir.y) * 0.8;
      this.moonGlow.position.copy(camera.position).addScaledVector(this.sunDir, -380);
      this.moonGlow.material.opacity = smoothstep(0.0, -0.3, this.sunDir.y) * 0.55;
    }
    if (this.cloudPlanes) {
      this.cloudPlanes.position.set(camera.position.x, 0, camera.position.z);
      this.cloudPlanes.rotation.y += dt * 0.003;
      const tint = this._tint || (this._tint = new THREE.Color());
      tint.copy(this.cur.hor).lerp(this._white, 0.55 + 0.45 * smoothstep(0.1, 0.5, this.sunDir.y)).multiplyScalar(0.18 + 0.82 * (1 - this.night));
      this.cloudPlanes.material.color.copy(tint);
    }
    this.stars.material.opacity = this.night * (0.82 + 0.13 * Math.sin(performance.now() * 0.0031));
  }

  get timeString() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
