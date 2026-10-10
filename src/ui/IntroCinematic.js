import * as THREE from 'three';

// V10.32 — Cinématique de lancement : un petit film en 3D joué avant l'écran principal.
// Deux lunes, aurores, citadelle flottante et Cœur d'Éther qui se fracture. Musique et sons synthétisés (aucun fichier à charger).
// Un rendu à part (son propre canvas) qui est libéré à la fin ; bouton « Passer » à tout moment.

const DURATION = 54; // secondes
const KEY_STEP = 4;  // un point de caméra toutes les 4 s
const FRACTURE_T = 28;

// ---------------------------------------------------------------- narration (temps en secondes)
const SUBS = [
  [1.6, 6.8, 'Il fut un temps où deux lunes veillaient sur Korvalune.'],
  [7.8, 13.4, 'Leur lumière nourrissait le Cœur d’Éther, source de toute magie.'],
  [14.4, 20.4, 'Les peuples vivaient en paix, sous la garde des spires anciennes.'],
  [21.4, 27.2, 'Mais l’équilibre qui tenait le monde ne pouvait durer…'],
  [29.2, 34.6, 'Le Cœur s’est fracturé. Les failles se sont ouvertes.'],
  [35.6, 41.0, 'Des ténèbres rampent hors des spires, et les royaumes retiennent leur souffle.'],
  [42.0, 46.0, 'Il faut un héros pour refermer le ciel.']
];

// trajectoire de caméra : positions et points visés, un par pas de KEY_STEP
const CAM_POS = [[-70, 8, 190], [-60, 14, 140], [-40, 30, 60], [-25, 48, -20], [-10, 62, -110], [15, 78, -200], [40, 92, -265],
  [62, 110, -330], [20, 125, -395], [-45, 112, -370], [-60, 95, -290], [-30, 140, -150], [0, 150, -20], [0, 100, 60]];
const CAM_LOOK = [[-150, 150, -600], [-120, 130, -560], [-60, 110, -450], [-20, 100, -380], [0, 100, -340], [0, 100, -330], [0, 112, -330],
  [0, 118, -330], [0, 120, -330], [0, 118, -330], [0, 118, -330], [0, 105, -330], [-30, 110, -400], [-60, 130, -500]];
const CITADEL = new THREE.Vector3(0, 95, -330);

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// bruit de valeur 2D (pour le relief)
function makeNoise(seed = 7) {
  const rnd = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const n = (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    return mix(mix(rnd(xi, zi), rnd(xi + 1, zi), u), mix(rnd(xi, zi + 1), rnd(xi + 1, zi + 1), u), v);
  };
  return (x, z) => n(x, z) * 0.55 + n(x * 2.1, z * 2.1) * 0.28 + n(x * 4.3, z * 4.3) * 0.12 + n(x * 8.7, z * 8.7) * 0.05;
}

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = (stops) => canvasTex(128, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
});

export class IntroCinematic {
  constructor(game) {
    this.game = game;
    this.t = 0; this.skipping = false; this.done = false;
    this._disp = [];
  }

  // joue la cinématique ; la promesse se résout à la fin (ou quand le joueur la passe)
  play() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._buildDom();
    });
  }

  // ---------------------------------------------------------------- interface
  _buildDom() {
    const style = document.createElement('style');
    style.textContent = `
#intro-screen{position:fixed;inset:0;z-index:99999;background:#000;overflow:hidden;font-family:Georgia,'Palatino Linotype',serif;color:#eef1ff;user-select:none;-webkit-user-select:none}
#intro-screen canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#intro-screen .in-bar{position:absolute;left:0;right:0;height:0;background:#000;transition:height 2.2s ease;z-index:2}
#intro-screen .in-bar.top{top:0}#intro-screen .in-bar.bot{bottom:0}
#intro-screen.play .in-bar{height:9vh}
#intro-sub{position:absolute;left:4vw;right:4vw;bottom:calc(9vh + 12px);padding:26px 2vw 12px;background:radial-gradient(ellipse at 50% 70%,rgba(2,4,16,.55),rgba(2,4,16,0) 72%);text-align:center;font-size:clamp(17px,3.4vw,30px);letter-spacing:.04em;line-height:1.35;text-shadow:0 2px 14px #000,0 0 3px #000;opacity:0;transition:opacity .9s ease;z-index:3;pointer-events:none}
#intro-sub.on{opacity:1}
#intro-title{position:absolute;left:0;right:0;top:36%;text-align:center;z-index:3;pointer-events:none;opacity:0;transition:opacity 2.4s ease}
#intro-title.on{opacity:1}
#intro-title b{display:block;font-weight:400;font-size:clamp(40px,11vw,128px);letter-spacing:.28em;margin-right:-.28em;text-shadow:0 0 28px #9fb4ff,0 0 80px #6f7dff,0 3px 10px #000}
#intro-title i{display:block;margin-top:.5em;font-style:normal;font-size:clamp(13px,2.4vw,22px);letter-spacing:.5em;color:#c9d4ff;text-shadow:0 0 12px #000,0 0 4px #000,0 2px 8px #000;font-weight:bold}
#intro-flash{position:absolute;inset:0;background:#fff;opacity:0;z-index:4;pointer-events:none}
#intro-fade{position:absolute;inset:0;background:#000;opacity:1;z-index:5;pointer-events:none;transition:opacity 1.6s ease}
#intro-skip{position:absolute;right:max(14px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:6;background:rgba(10,14,32,.55);color:#dfe6ff;border:1px solid rgba(190,205,255,.45);border-radius:20px;padding:8px 18px;font:inherit;font-size:15px;letter-spacing:.06em;cursor:pointer;backdrop-filter:blur(3px)}
#intro-skip:hover{background:rgba(40,52,100,.7)}
#intro-start{position:absolute;inset:0;z-index:7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:#02030a;cursor:pointer;text-align:center;padding:0 24px}
#intro-start h1{margin:0;font-weight:400;font-size:clamp(30px,8vw,76px);letter-spacing:.3em;margin-right:-.3em;color:#dfe6ff;text-shadow:0 0 24px #6f7dff}
#intro-start p{margin:0;font-size:clamp(14px,2.6vw,20px);letter-spacing:.14em;color:#9fb0ee;animation:inpulse 2.2s ease-in-out infinite}
#intro-start small{font-size:13px;color:#6c7aa8;letter-spacing:.08em}
@keyframes inpulse{0%,100%{opacity:.35}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){#intro-start p{animation:none}}`;
    document.head.appendChild(style);
    this._style = style;
    const el = document.createElement('div');
    el.id = 'intro-screen';
    el.innerHTML = `<canvas></canvas><div class="in-bar top"></div><div class="in-bar bot"></div>
      <div id="intro-sub" aria-live="polite"></div>
      <div id="intro-title"><b>KORVALUNE</b><i>LA LÉGENDE DE L’ÉTHER</i></div>
      <div id="intro-flash"></div><div id="intro-fade"></div>
      <button id="intro-skip" type="button" hidden>Passer ▸</button>
      <div id="intro-start" role="button" tabindex="0"><h1>KORVALUNE</h1><p>Touche l’écran pour lancer l’introduction</p><small>(le son sera activé)</small>
        <button id="intro-skip0" type="button" style="margin-top:18px;background:none;border:1px solid #4b5788;color:#9fb0ee;border-radius:18px;padding:7px 18px;font:inherit;cursor:pointer">Passer</button></div>`;
    document.body.appendChild(el);
    this.el = el;
    const start = el.querySelector('#intro-start');
    const skip0 = el.querySelector('#intro-skip0');
    skip0.addEventListener('click', (e) => { e.stopPropagation(); this._finish(true); });
    start.addEventListener('click', () => this._start());
    start.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._start(); } });
    this._onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { if (this.started) { e.preventDefault(); this._finish(true); } } };
    window.addEventListener('keydown', this._onKey);
    el.querySelector('#intro-skip').addEventListener('click', () => this._finish(true));
    this.$sub = el.querySelector('#intro-sub'); this.$title = el.querySelector('#intro-title');
    this.$flash = el.querySelector('#intro-flash'); this.$fade = el.querySelector('#intro-fade');
    setTimeout(() => start.focus && start.focus(), 50);
  }

  _start() {
    if (this.started) return;
    this.started = true;
    const el = this.el;
    el.querySelector('#intro-start').remove();
    el.querySelector('#intro-skip').hidden = false;
    try { this._initScene(); } catch (e) { console.warn('[intro] rendu indisponible', e); this._finish(true); return; }
    try { this._initAudio(); } catch (e) { console.warn('[intro] audio indisponible', e); }
    el.classList.add('play');
    requestAnimationFrame(() => { this.$fade.style.opacity = '0'; });
    this.t0 = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  _finish(fast) {
    if (this.done) return;
    this.done = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('resize', this._onResize);
    const end = () => {
      try { this._stopAudio(0); } catch (e) { /* ignoré */ }
      this._dispose();
      if (this.el) this.el.remove();
      if (this._style) this._style.remove();
      this._resolve && this._resolve();
    };
    if (!this.started) { end(); return; }
    this.$fade.style.transition = `opacity ${fast ? 0.45 : 1.2}s ease`;
    this.$fade.style.opacity = '1';
    try { this._stopAudio(fast ? 0.45 : 1.2); } catch (e) { /* ignoré */ }
    setTimeout(end, fast ? 480 : 1250);
  }

  // ---------------------------------------------------------------- scène 3D
  _track(o) { this._disp.push(o); return o; }

  _initScene() {
    const canvas = this.el.querySelector('canvas');
    const r = this._track(new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'default' }));
    this.renderer = r;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    r.setClearColor(0x02030a, 1);
    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0c1233, 0.0021);
    const cam = this.cam = new THREE.PerspectiveCamera(58, 1, 1, 3000);
    this._onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w / h < 0.8 ? 74 : 58; cam.updateProjectionMatrix();
    };
    window.addEventListener('resize', this._onResize); this._onResize();

    // ciel : dégradé + étoiles
    const sky = new THREE.Mesh(this._track(new THREE.SphereGeometry(1800, 24, 16)), this._track(new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { flash: { value: 0 }, tint: { value: new THREE.Color(0x000000) } },
      vertexShader: 'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec3 vp;uniform float flash;uniform vec3 tint;void main(){float h=clamp(vp.y,-.1,1.);vec3 top=vec3(.006,.01,.04);vec3 mid=vec3(.05,.05,.17);vec3 low=vec3(.16,.12,.36);vec3 c=mix(low,mid,smoothstep(0.,.25,h));c=mix(c,top,smoothstep(.2,.9,h));c+=tint*(1.-h)*.9;c+=vec3(.55,.6,.9)*flash;gl_FragColor=vec4(c,1.);}'
    })));
    this.skyMat = sky.material;
    scene.add(sky);
    const N = 1400, sp = new Float32Array(N * 3), sc = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, y = Math.pow(Math.random(), 0.7) * 0.98 + 0.02, rr = Math.sqrt(1 - y * y) * 1700;
      sp[i * 3] = Math.cos(a) * rr; sp[i * 3 + 1] = y * 1700; sp[i * 3 + 2] = Math.sin(a) * rr;
      const b = 0.55 + Math.random() * 0.45, w = Math.random(); sc[i * 3] = b * (0.8 + 0.2 * w); sc[i * 3 + 1] = b * 0.9; sc[i * 3 + 2] = b;
    }
    const sg = this._track(new THREE.BufferGeometry());
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    this.stars = new THREE.Points(sg, this._track(new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false })));
    scene.add(this.stars);

    // deux lunes
    const moonTex = this._track(canvasTex(256, (g, s) => {
      g.fillStyle = '#d9e2ff'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 90; i++) { const x = Math.random() * s, y = Math.random() * s, rr = 3 + Math.random() * 20; g.fillStyle = `rgba(110,125,175,${0.1 + Math.random() * 0.25})`; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); }
    }));
    const mkMoon = (pos, rad, col, glowCol) => {
      const m = new THREE.Mesh(this._track(new THREE.SphereGeometry(rad, 28, 20)), this._track(new THREE.MeshBasicMaterial({ map: moonTex, color: col, fog: false })));
      m.position.copy(pos); scene.add(m);
      const gl = new THREE.Sprite(this._track(new THREE.SpriteMaterial({ map: this._track(glowTex([[0, glowCol + 'cc'], [0.25, glowCol + '55'], [1, glowCol + '00']])), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true })));
      gl.position.copy(pos); gl.scale.setScalar(rad * 7); scene.add(gl);
      return m;
    };
    this.moonA = mkMoon(new THREE.Vector3(-170, 165, -640), 56, 0xffffff, '#9fb8ff');
    this.moonB = mkMoon(new THREE.Vector3(150, 215, -650), 26, 0xd2b8ff, '#b58cff');

    // aurores
    const auMat = (a, b) => this._track(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { time: { value: 0 }, ca: { value: new THREE.Color(a) }, cb: { value: new THREE.Color(b) }, k: { value: 1 } },
      vertexShader: 'varying vec2 uv_;uniform float time;void main(){uv_=uv;vec3 p=position;p.y+=sin(p.x*.02+time*.5)*10.+sin(p.x*.05-time*.9)*4.;p.z+=sin(p.x*.03+time*.3)*30.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
      fragmentShader: 'varying vec2 uv_;uniform float time,k;uniform vec3 ca,cb;void main(){float v=smoothstep(0.,.12,uv_.y)*pow(1.-uv_.y,1.5);float s=.6+.4*sin(uv_.x*38.+time*1.7)*sin(uv_.x*13.-time*.8);vec3 c=mix(ca,cb,clamp(uv_.y+.25*sin(uv_.x*9.+time),0.,1.));gl_FragColor=vec4(c*v*s*k,v*s*k*.8);}'
    }));
    this.auroras = [];
    for (const [x, y, z, w, ry, a, b] of [[-60, 190, -520, 900, 0.12, 0x38ffb4, 0x6a7bff], [120, 215, -560, 800, -0.2, 0x56d9ff, 0xb070ff], [-260, 160, -420, 650, 0.45, 0x2fffa0, 0x4aa8ff]]) {
      const m = new THREE.Mesh(this._track(new THREE.PlaneGeometry(w, 130, 80, 1)), auMat(a, b));
      m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); this.auroras.push(m);
    }

    // relief : montagnes éclairées par la lune, vallée au centre
    const noise = makeNoise(11);
    const SX = 1100, SZ = 1100, GX = 120, GZ = 120;
    const tg = this._track(new THREE.PlaneGeometry(SX, SZ, GX, GZ)); tg.rotateX(-Math.PI / 2);
    const pos = tg.attributes.position;
    const hgt = (x, z) => {
      const side = clamp01((Math.abs(x) - 55) / 260), far = clamp01((-z - 120) / 520);
      const ridge = 1 - Math.abs(noise(x * 0.006 + 3, z * 0.006 + 9) * 2 - 1);
      return noise(x * 0.008, z * 0.008) * 28 - 6 + (ridge * 95 * side + ridge * 70 * far) * (0.45 + 0.55 * noise(x * 0.015, z * 0.015));
    };
    for (let i = 0; i < pos.count; i++) pos.setY(i, hgt(pos.getX(i), pos.getZ(i) - 150));
    tg.computeVertexNormals();
    const col = new Float32Array(pos.count * 3), nor = tg.attributes.normal, L = new THREE.Vector3(-0.3, 0.55, -0.75).normalize();
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i), sh = 0.28 + 0.72 * Math.max(0, nor.getX(i) * L.x + nor.getY(i) * L.y + nor.getZ(i) * L.z);
      const t = clamp01(h / 90), snow = smooth(72, 95, h) * (0.35 + 0.65 * nor.getY(i));
      const r0 = mix(0.045, 0.2, t), g0 = mix(0.07, 0.25, t), b0 = mix(0.16, 0.42, t);
      col[i * 3] = mix(r0, 0.6, snow) * sh * 0.95; col[i * 3 + 1] = mix(g0, 0.68, snow) * sh * 0.95; col[i * 3 + 2] = mix(b0, 0.9, snow) * sh * 1.05;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const terrain = new THREE.Mesh(tg, this._track(new THREE.MeshBasicMaterial({ vertexColors: true })));
    terrain.position.z = -150; scene.add(terrain);
    // lac au creux de la vallée
    const lake = new THREE.Mesh(this._track(new THREE.PlaneGeometry(500, 700).rotateX(-Math.PI / 2)), this._track(new THREE.MeshBasicMaterial({ color: 0x0b1a40 })));
    lake.position.set(0, -1.2, -50); scene.add(lake);
    const refl = new THREE.Mesh(this._track(new THREE.PlaneGeometry(36, 520).rotateX(-Math.PI / 2)), this._track(new THREE.MeshBasicMaterial({ map: this._track(glowTex([[0, '#bcd0ffaa'], [0.5, '#7d9bff44'], [1, '#7d9bff00']])), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })));
    refl.position.set(-95, -1, -150); refl.rotation.y = -0.12; scene.add(refl);
    // brumes
    const mistTex = this._track(glowTex([[0, '#9fb0ff55'], [1, '#9fb0ff00']]));
    this.mists = [];
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Sprite(this._track(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.5, fog: false })));
      m.position.set((Math.random() - 0.5) * 520, 6 + Math.random() * 20, -80 - Math.random() * 480);
      m.scale.set(160 + Math.random() * 120, 36 + Math.random() * 20, 1); m.userData.sp = (Math.random() - 0.5) * 3;
      scene.add(m); this.mists.push(m);
    }

    // citadelle flottante
    this._buildCitadel(noise);

    // lumières
    scene.add(new THREE.AmbientLight(0x3b4780, 1.15));
    const moonL = new THREE.DirectionalLight(0xb6ccff, 1.15); moonL.position.set(-170, 165, -300); scene.add(moonL);
    this.crystalLight = new THREE.PointLight(0x7fe8ff, 3, 260, 1.4); this.crystalLight.position.copy(this.crystal.position); scene.add(this.crystalLight);

    // failles (apparaissent après la fracture)
    this.rifts = [];
    const swirl = this._track(canvasTex(256, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, '#ffe6ff'); gr.addColorStop(0.2, '#d04aff'); gr.addColorStop(0.55, '#5a1090aa'); gr.addColorStop(1, '#2a005000');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(255,170,255,.55)'; g.lineWidth = 3;
      for (let k = 0; k < 4; k++) { g.beginPath(); for (let a = 0; a < 5.5; a += 0.1) { const rr = 8 + a * 20 + k * 2, an = a + k * 1.57; g.lineTo(s / 2 + Math.cos(an) * rr, s / 2 + Math.sin(an) * rr); } g.stroke(); }
    }));
    const riftPts = [[-150, 62, -250], [130, 48, -300], [-90, 95, -430], [170, 85, -420], [20, 40, -190], [-30, 150, -480], [95, 20, -150]];
    for (const [x, y, z] of riftPts) {
      const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(0.001);
      const disc = new THREE.Mesh(this._track(new THREE.CircleGeometry(24, 28)), this._track(new THREE.MeshBasicMaterial({ map: swirl, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })));
      const ring = new THREE.Mesh(this._track(new THREE.TorusGeometry(24, 1.2, 8, 40)), this._track(new THREE.MeshBasicMaterial({ color: 0xff5ae0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
      const pillar = new THREE.Mesh(this._track(new THREE.CylinderGeometry(3, 8, 260, 10, 1, true)), this._track(new THREE.MeshBasicMaterial({ color: 0xb04aff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })));
      pillar.position.y = 110; g.add(disc, ring, pillar); g.userData = { disc, ring, d: 1 + Math.random() * 0.8, at: FRACTURE_T + 1.6 + this.rifts.length * 0.8 };
      g.lookAt(0, y, 200); scene.add(g); this.rifts.push(g);
    }
    // éclairs
    this.bolts = [];
    for (let i = 0; i < 3; i++) {
      const gm = this._track(new THREE.BufferGeometry());
      gm.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
      const ln = new THREE.Line(gm, this._track(new THREE.LineBasicMaterial({ color: 0xe7d0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, fog: false })));
      ln.frustumCulled = false; scene.add(ln); this.bolts.push({ ln, until: 0, next: 0 });
    }
    // particules d'éther
    const EN = 240, ep = new Float32Array(EN * 3), seed = new Float32Array(EN * 3);
    for (let i = 0; i < EN; i++) { seed[i * 3] = Math.random() * 6.28; seed[i * 3 + 1] = 20 + Math.random() * 120; seed[i * 3 + 2] = Math.random(); }
    const eg = this._track(new THREE.BufferGeometry()); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    this.motes = new THREE.Points(eg, this._track(new THREE.PointsMaterial({ size: 9, map: this._track(glowTex([[0, '#ffffffff'], [0.35, '#ffffff88'], [1, '#ffffff00']])), sizeAttenuation: false, color: 0x9ff0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    this.motes.frustumCulled = false; this.moteSeed = seed; scene.add(this.motes);
  }

  _buildCitadel(noise) {
    const scene = this.scene, g = this.citadel = new THREE.Group(); g.position.copy(CITADEL).add(new THREE.Vector3(0, -38, 0));
    // île : icosaèdre déformé, pointe vers le bas
    const ig = this._track(new THREE.IcosahedronGeometry(40, 3)), p = ig.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = noise(x * 0.08 + 5, z * 0.08 + y * 0.05);
      if (y > 0) y *= 0.16; else { const k = 1 + (-y / 40) * 1.6; y *= 2.1; x /= k; z /= k; }
      const f = 0.84 + n * 0.34; x *= f; z *= f; y += (n - 0.5) * 6;
      p.setXYZ(i, x, y, z);
      const top = y > -2, sh = 0.5 + n * 0.5;
      c[i * 3] = (top ? 0.3 : 0.4) * sh; c[i * 3 + 1] = (top ? 0.36 : 0.38) * sh; c[i * 3 + 2] = (top ? 0.4 : 0.56) * sh;
    }
    ig.setAttribute('color', new THREE.BufferAttribute(c, 3)); ig.computeVertexNormals();
    g.add(new THREE.Mesh(ig, this._track(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x10163a }))));
    const stone = this._track(new THREE.MeshLambertMaterial({ color: 0x7a86c0, emissive: 0x161c44 })), roof = this._track(new THREE.MeshLambertMaterial({ color: 0x4a50a0, emissive: 0x12163a }));
    const tower = (x, z, r, h, rh) => {
      const t = new THREE.Mesh(this._track(new THREE.CylinderGeometry(r * 0.85, r, h, 9)), stone); t.position.set(x, 6 + h / 2, z); g.add(t);
      const cn = new THREE.Mesh(this._track(new THREE.ConeGeometry(r * 1.25, rh, 9)), roof); cn.position.set(x, 6 + h + rh / 2, z); g.add(cn);
    };
    tower(0, 0, 6.5, 34, 20);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3; tower(Math.cos(a) * 22, Math.sin(a) * 22, 3.2, 12 + (i % 2) * 7, 8 + i % 3 * 2); }
    const wall = new THREE.Mesh(this._track(new THREE.CylinderGeometry(23, 24, 5, 24, 1, true)), stone); wall.material = this._track(new THREE.MeshLambertMaterial({ color: 0x6a76b0, emissive: 0x141a40, side: THREE.DoubleSide })); wall.position.y = 7; g.add(wall);
    // fenêtres allumées
    const wp = [];
    for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, r = Math.random() < 0.5 ? 6.6 : 22, y = 10 + Math.random() * 28; wp.push(Math.cos(a) * r * 1.02, y, Math.sin(a) * r * 1.02); }
    const wg = this._track(new THREE.BufferGeometry()); wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wp), 3));
    g.add(new THREE.Points(wg, this._track(new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, color: 0xffd98a, blending: THREE.AdditiveBlending, depthWrite: false }))));
    // rochers qui flottent autour
    this.rocks = [];
    for (let i = 0; i < 9; i++) {
      const rk = new THREE.Mesh(this._track(new THREE.IcosahedronGeometry(2 + Math.random() * 4.5, 1)), this._track(new THREE.MeshLambertMaterial({ color: 0x6a74b0, emissive: 0x12183c, flatShading: true })));
      rk.userData = { a: Math.random() * 6.28, r: 52 + Math.random() * 30, y: -10 + Math.random() * 40, s: 0.06 + Math.random() * 0.1 }; g.add(rk); this.rocks.push(rk);
    }
    // Cœur d'Éther
    const cr = this.crystal = new THREE.Group(); cr.position.copy(CITADEL).add(new THREE.Vector3(0, 8, 0));
    this.coreMat = this._track(new THREE.MeshBasicMaterial({ color: 0x9ff4ff }));
    const core = new THREE.Mesh(this._track(new THREE.OctahedronGeometry(6, 0)), this.coreMat); core.scale.set(1, 1.9, 1); cr.add(core);
    this.crystalCore = core;
    this.ringMat = this._track(new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
    this.ringA = new THREE.Mesh(this._track(new THREE.TorusGeometry(11, 0.35, 8, 48)), this.ringMat); this.ringB = new THREE.Mesh(this._track(new THREE.TorusGeometry(15, 0.28, 8, 48)), this.ringMat);
    cr.add(this.ringA, this.ringB);
    this.glowMat = this._track(new THREE.SpriteMaterial({ map: this._track(glowTex([[0, '#c8fbffff'], [0.3, '#5fd8ff66'], [1, '#5fd8ff00']])), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    this.glow = new THREE.Sprite(this.glowMat); this.glow.scale.setScalar(70); cr.add(this.glow);
    this.beamMat = this._track(new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.beam = new THREE.Mesh(this._track(new THREE.CylinderGeometry(1.4, 3.2, 700, 16, 1, true)), this.beamMat); this.beam.position.y = 350; cr.add(this.beam);
    this.shock = new THREE.Mesh(this._track(new THREE.TorusGeometry(1, 0.03, 6, 64)), this._track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    this.shock.rotation.x = Math.PI / 2; cr.add(this.shock);
    scene.add(g, cr);
  }

  _bolt(b, now) {
    const a = this.rifts[Math.floor(Math.random() * this.rifts.length)];
    if (!a) return;
    const arr = b.ln.geometry.attributes.position, sx = a.position.x + (Math.random() - 0.5) * 30, sy = a.position.y + 60 + Math.random() * 120, sz = a.position.z;
    let x = sx, y = sy, z = sz; const ty = Math.max(0, a.position.y - 60);
    for (let i = 0; i < 24; i++) {
      arr.setXYZ(i, x, y, z); y -= (sy - ty) / 23; x += (Math.random() - 0.5) * 14; z += (Math.random() - 0.5) * 10;
    }
    arr.needsUpdate = true; b.until = now + 0.18; b.ln.material.opacity = 1;
  }

  // ---------------------------------------------------------------- boucle
  _tick = () => {
    if (this.done) return;
    this._raf = requestAnimationFrame(this._tick);
    const t = (performance.now() - this.t0) / 1000, dt = Math.min(0.1, t - this.t); this.t = t;
    if (t >= DURATION) { this._finish(false); return; }
    this._update(t, dt);
    this.renderer.render(this.scene, this.cam);
  };

  _catmull(arr, u, out) {
    const n = arr.length, i = Math.min(n - 2, Math.max(0, Math.floor(u))), f = Math.min(1, u - i);
    const p0 = arr[Math.max(0, i - 1)], p1 = arr[i], p2 = arr[i + 1], p3 = arr[Math.min(n - 1, i + 2)];
    for (let k = 0; k < 3; k++) {
      const a = p0[k], b = p1[k], c = p2[k], d = p3[k];
      out[k] = 0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
    }
    return out;
  }

  _update(t, dt) {
    const cam = this.cam, u = Math.min(CAM_POS.length - 1, t / KEY_STEP);
    // courbe douce : on ralentit légèrement au début et à la fin
    const pu = this._catmull(CAM_POS, u, this._pu || (this._pu = [0, 0, 0])), lu = this._catmull(CAM_LOOK, u, this._lu || (this._lu = [0, 0, 0]));
    const after = t - FRACTURE_T, shake = after > 0 ? Math.exp(-after * 0.7) * 1.6 : 0;
    cam.position.set(pu[0] + Math.sin(t * 31) * shake * 0.5, pu[1] + Math.sin(t * 27 + 1) * shake * 0.5, pu[2]);
    cam.up.set(Math.sin(t * 0.3) * 0.03, 1, 0);
    cam.lookAt(lu[0] + Math.sin(t * 23) * shake * 0.8, lu[1] + Math.cos(t * 29) * shake * 0.6, lu[2]);

    // éveil du cristal, puis fracture
    const calm = 1 - smooth(FRACTURE_T - 0.2, FRACTURE_T + 0.3, t);
    const pulse = 0.5 + 0.5 * Math.sin(t * (1.6 + smooth(18, 28, t) * 5));
    const dark = smooth(FRACTURE_T, FRACTURE_T + 2.5, t), ring = new THREE.Color();
    const cCalm = new THREE.Color(0x8ff3ff), cDark = new THREE.Color(0xc060ff), cRed = new THREE.Color(0xff3a6a);
    ring.copy(cCalm).lerp(cDark, dark).lerp(cRed, smooth(36, 44, t) * 0.5);
    this.coreMat.color.copy(ring); this.ringMat.color.copy(ring); this.beamMat.color.copy(ring);
    this.glowMat.color.copy(ring); this.crystalLight.color.copy(ring);
    this.crystalCore.rotation.y += dt * (0.5 + dark * 2.5); this.crystalCore.scale.set(1 + 0.06 * pulse, 1.9 + 0.12 * pulse, 1 + 0.06 * pulse);
    this.ringA.rotation.set(Math.PI / 2 + Math.sin(t * 0.7) * 0.4, t * 0.6, 0); this.ringB.rotation.set(Math.PI / 2.4, -t * 0.45, t * 0.3);
    const wake = smooth(5, 12, t), bright = (0.25 + 0.75 * wake) * calm + dark * 1.1;
    this.glow.scale.setScalar(55 + pulse * 16 + dark * 55 * Math.exp(-after * 0.15)); this.glowMat.opacity = Math.min(1, 0.35 + bright * 0.65);
    this.crystalLight.intensity = 1.2 + bright * 3.4 + pulse * 0.8;
    this.beamMat.opacity = (0.06 + wake * 0.16) * calm + dark * (0.26 + 0.1 * pulse);
    this.beam.scale.set(1 + dark * 0.9, 1, 1 + dark * 0.9);
    // onde de choc
    const sh = after > 0 && after < 3.2 ? after / 3.2 : -1;
    this.shock.material.opacity = sh >= 0 ? (1 - sh) * 0.9 : 0; if (sh >= 0) this.shock.scale.setScalar(4 + sh * 520);
    // flash au moment de la fracture
    const fl = after > -0.05 && after < 1.4 ? Math.pow(1 - clamp01(after / 1.4), 2.2) * (after < 0 ? 1 : 1) : 0;
    let extra = 0;
    for (const b of this.bolts) {
      if (t > FRACTURE_T + 3 && t > b.next) { b.next = t + 0.8 + Math.random() * 2.4; this._bolt(b, t); }
      if (b.until > t) { b.ln.material.opacity = (b.until - t) / 0.18; extra = Math.max(extra, 0.22 * b.ln.material.opacity); } else b.ln.material.opacity = 0;
    }
    this.$flash.style.opacity = String(Math.min(0.95, fl * 0.95 + extra * 0.25));
    this.skyMat.uniforms.flash.value = extra * 0.5; this.skyMat.uniforms.tint.value.setRGB(dark * 0.16, 0, dark * 0.12);
    this.scene.fog.color.setRGB(0.05 + dark * 0.1, 0.07, 0.2 - dark * 0.04);

    // failles
    for (const g of this.rifts) {
      const k = smooth(g.userData.at, g.userData.at + 2.6, t), s = k * g.userData.d;
      g.scale.setScalar(Math.max(0.001, s)); g.userData.disc.rotation.z += dt * 1.6; g.userData.ring.rotation.z -= dt * 0.8;
    }
    // décor vivant
    for (const a of this.auroras) { a.material.uniforms.time.value = t; a.material.uniforms.k.value = 1 - dark * 0.55; }
    this.stars.rotation.y = t * 0.002; this.moonA.rotation.y = t * 0.01;
    for (const m of this.mists) { m.position.x += m.userData.sp * dt; if (m.position.x > 300) m.position.x = -300; if (m.position.x < -300) m.position.x = 300; }
    this.citadel.position.y = CITADEL.y - 38 + Math.sin(t * 0.5) * 1.4; this.crystal.position.y = CITADEL.y + 8 + Math.sin(t * 0.5) * 1.4; this.crystalLight.position.copy(this.crystal.position);
    for (const rk of this.rocks) { const d = rk.userData; d.a += dt * d.s; rk.position.set(Math.cos(d.a) * d.r, d.y + Math.sin(t + d.a * 3) * 2, Math.sin(d.a) * d.r); rk.rotation.x += dt * 0.2; rk.rotation.y += dt * 0.3; }
    const mp = this.motes.geometry.attributes.position, sd = this.moteSeed;
    for (let i = 0; i < mp.count; i++) {
      const a = sd[i * 3] + t * (0.15 + sd[i * 3 + 2] * 0.25), r = 14 + sd[i * 3 + 2] * 70, y = ((sd[i * 3 + 1] + t * (6 + sd[i * 3 + 2] * 10)) % 150) - 20;
      mp.setXYZ(i, CITADEL.x + Math.cos(a) * r, CITADEL.y - 20 + y, CITADEL.z + Math.sin(a) * r);
    }
    mp.needsUpdate = true; this.motes.material.color.copy(ring);

    // sous-titres et titre
    let line = '';
    for (const [a, b, txt] of SUBS) if (t >= a && t < b) line = txt;
    if (line !== this._line) { this._line = line; if (line) this.$sub.textContent = line; this.$sub.classList.toggle('on', !!line); }
    if (t > 46.2 && !this._titleOn) { this._titleOn = true; this.$title.classList.add('on'); }
    if (t > DURATION - 1.7 && !this._fadingOut) { this._fadingOut = true; this.$fade.style.transition = 'opacity 1.6s ease'; this.$fade.style.opacity = '1'; }
  }

  _dispose() {
    for (const o of this._disp) { try { o.dispose && o.dispose(); } catch (e) { /* ignoré */ } }
    this._disp = [];
    if (this.renderer) { try { this.renderer.forceContextLoss(); } catch (e) { /* ignoré */ } this.renderer = null; }
    this.scene = null;
  }

  // ---------------------------------------------------------------- musique et sons (synthèse)
  _initAudio() {
    const a = this.game.audio;
    if (!a) return;
    a.resume();
    const ctx = a.ctx;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this.ac = ctx;
    const out = this.out = ctx.createGain(); out.gain.value = 0; out.connect(a.master || ctx.destination);
    const t0 = this.at0 = ctx.currentTime + 0.15;
    out.gain.setValueAtTime(0.0001, t0); out.gain.linearRampToValueAtTime(0.9 * (a.mix?.music ?? 0.7) + 0.2, t0 + 2.5);
    const rev = a._revIn; if (rev) { this.send = ctx.createGain(); this.send.gain.value = 0.5; this.send.connect(rev); out.connect(this.send); }
    this.nodes = [];
    const hold = (n) => { this.nodes.push(n); return n; };
    // bruit
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = (start, dur, f0, f1, type, vol, q = 0.8) => {
      const s = hold(ctx.createBufferSource()); s.buffer = nb; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0 + start); f.frequency.exponentialRampToValueAtTime(f1, t0 + start + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0 + start); g.gain.linearRampToValueAtTime(vol, t0 + start + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t0 + start); s.stop(t0 + start + dur + 0.1);
    };
    const tone = (start, dur, freq, type, vol, o = {}) => {
      const osc = hold(ctx.createOscillator()); osc.type = type; osc.frequency.value = freq; if (o.det) osc.detune.value = o.det;
      if (o.sweep) { osc.frequency.setValueAtTime(freq, t0 + start); osc.frequency.exponentialRampToValueAtTime(o.sweep, t0 + start + dur); }
      const g = ctx.createGain(), at = o.attack ?? 0.05, rl = o.release ?? dur * 0.4;
      g.gain.setValueAtTime(0.0001, t0 + start); g.gain.linearRampToValueAtTime(vol, t0 + start + at);
      g.gain.setValueAtTime(vol, t0 + start + Math.max(at, dur - rl)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      let nd = osc;
      if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp[0], t0 + start); f.frequency.linearRampToValueAtTime(o.lp[1], t0 + start + dur); osc.connect(f); nd = f; }
      nd.connect(g); g.connect(out); osc.start(t0 + start); osc.stop(t0 + start + dur + 0.1);
    };
    // nappes d'accords
    const pad = (start, dur, freqs, vol, lp) => { for (const f of freqs) for (const det of [-8, 7]) tone(start, dur, f, 'sawtooth', vol / freqs.length, { det, attack: dur * 0.35, release: dur * 0.4, lp }); };
    const Am = [110, 164.81, 220, 261.63], F = [87.31, 130.81, 174.61, 261.63], C = [130.81, 164.81, 196, 261.63], G = [98, 146.83, 196, 246.94];
    pad(0, 9, Am, 0.34, [260, 900]); pad(8, 9, F, 0.34, [300, 1100]); pad(16, 9, C, 0.36, [320, 1300]); pad(24, 5, G, 0.36, [350, 1500]);
    const dis = [73.42, 103.83, 146.83, 207.65]; pad(28, 13, dis, 0.5, [900, 180]); pad(40, 7, [110, 164.81, 207.65, 261.63], 0.4, [260, 1100]);
    pad(46, 9, [110, 164.81, 220, 329.63, 392], 0.5, [500, 2600]);
    tone(0, 12, 55, 'sine', 0.5, { attack: 4, release: 3 }); tone(12, 16, 55, 'sine', 0.55, { attack: 2, release: 3 }); tone(28, 14, 41.2, 'sine', 0.7, { attack: 0.5, release: 4 }); tone(42, 12, 55, 'sine', 0.6, { attack: 2, release: 4 });
    // cloches pentatoniques
    const pent = [440, 523.25, 659.25, 783.99, 880, 1046.5];
    const bell = (start, f, v = 0.16) => { tone(start, 3.2, f, 'sine', v, { attack: 0.01, release: 3 }); tone(start, 2.2, f * 2.76, 'sine', v * 0.25, { attack: 0.01, release: 2 }); };
    for (let s = 3, i = 0; s < 27; s += 1.5 + (i % 3) * 0.5, i++) bell(s, pent[(i * 2 + (i >> 1)) % pent.length], 0.1 + Math.min(0.1, s / 200));
    for (let s = 46.5, i = 0; s < 52; s += 0.7, i++) bell(s, pent[i % pent.length] * (i > 3 ? 2 : 1), 0.12);
    // cœur d'éther : vibrato lumineux
    tone(5, 22, 880, 'sine', 0.045, { attack: 5, release: 4 }); tone(5, 22, 1318.5, 'sine', 0.03, { attack: 7, release: 4 });
    // montée, fracture, grondements
    noise(23, 5, 400, 7000, 'highpass', 0.34, 0.6);
    for (let k = 0; k < 7; k++) { const s = 21.2 + k * (1 - k * 0.05); tone(s, 0.5, 95, 'sine', 0.7, { attack: 0.005, release: 0.45, sweep: 42 }); }
    tone(28, 3.2, 62, 'sine', 1, { attack: 0.01, release: 3, sweep: 26 }); tone(28, 2.6, 130, 'sawtooth', 0.4, { attack: 0.01, release: 2.4, lp: [2400, 120] });
    noise(28, 3.4, 5000, 140, 'lowpass', 0.9, 0.5); noise(28, 1.2, 9000, 2000, 'bandpass', 0.5, 1.2);
    for (let s = 32; s < 44; s += 2.4) tone(s, 1.4, 70, 'sine', 0.8, { attack: 0.005, release: 1.3, sweep: 34 });
    for (let s = 31, i = 0; s < 43; s += 3.1, i++) noise(s, 1.6, 300, 4200, 'bandpass', 0.18, 2);
    // révélation du titre
    noise(44.5, 2.2, 600, 9000, 'highpass', 0.3, 0.7); tone(46, 8, 220, 'sine', 0.22, { attack: 0.8, release: 6 }); tone(46, 8, 440, 'sine', 0.12, { attack: 1.2, release: 6 }); tone(46, 8, 659.25, 'sine', 0.08, { attack: 1.5, release: 6 });
    noise(46, 1.4, 5000, 12000, 'highpass', 0.14, 0.5);
  }

  _stopAudio(fade) {
    if (!this.ac || !this.out) return;
    const ctx = this.ac, now = ctx.currentTime;
    try {
      this.out.gain.cancelScheduledValues(now); this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), now);
      this.out.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.05, fade));
    } catch (e) { /* ignoré */ }
    const nodes = this.nodes || []; this.nodes = [];
    setTimeout(() => {
      for (const n of nodes) { try { n.stop(); } catch (e) { /* déjà arrêté */ } try { n.disconnect(); } catch (e) { /* ignoré */ } }
      try { this.out.disconnect(); this.send && this.send.disconnect(); } catch (e) { /* ignoré */ }
    }, Math.max(100, fade * 1000 + 150));
  }
}
