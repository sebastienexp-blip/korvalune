import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHumanoid, animateHumanoid } from '../entities/HumanoidModel.js';

// Petite scène Three.js indépendante pour prévisualiser le personnage pendant sa création.
// V3.4 : reflets d'environnement (sans eux les armures métalliques paraissaient noires),
// éclairage à trois points, socle lumineux, rotation lente + rotation au doigt/souris.
// Son propre renderer et sa propre boucle, détruits en quittant l'écran de création.
export class CharPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(canvas.width, canvas.height, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(33, canvas.width / canvas.height, 0.1, 30);
    this.camera.position.set(0, 1.35, 5.4);
    this.camera.lookAt(0, 1.08, 0);

    try {
      const pm = new THREE.PMREMGenerator(this.renderer);
      this._envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      pm.dispose();
      this.scene.environment = this._envTex;
      this.scene.environmentIntensity = 0.75;
    } catch (e) { console.warn('[V3.4] reflets de l\'aperçu ignorés', e); }

    const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a3b2a, 0.9);
    const key = new THREE.DirectionalLight(0xfff0d0, 2.0); key.position.set(2.6, 3.4, 3.2);
    const rim = new THREE.DirectionalLight(0x6ee8d4, 1.5); rim.position.set(-3, 2.2, -2.8);
    const fill = new THREE.DirectionalLight(0x9db8ff, 0.5); fill.position.set(-2.5, 1, 2.5);
    this.scene.add(hemi, key, rim, fill);

    // socle : disque sombre + anneau d'éther
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.1, 40), new THREE.MeshStandardMaterial({ color: 0x1b2540, roughness: 0.7, metalness: 0.3 }));
    disc.position.y = -0.05;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.018, 8, 64), new THREE.MeshBasicMaterial({ color: 0x5ee6d0 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.012;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.01, 6, 48), new THREE.MeshBasicMaterial({ color: 0xe2b866 }));
    ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.012;
    this.scene.add(disc, ring, ring2);
    this._pedestal = [disc, ring, ring2];

    // rotation au doigt / à la souris
    this._yaw = 0.5; this._vel = 0; this._drag = false; this._lastX = 0; this._idle = 0;
    this._onDown = (e) => { this._drag = true; this._lastX = e.clientX; this._vel = 0; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } e.stopPropagation(); };
    this._onMove = (e) => { if (!this._drag) return; const dx = e.clientX - this._lastX; this._lastX = e.clientX; this._yaw += dx * 0.012; this._vel = dx * 0.012; };
    this._onUp = () => { this._drag = false; this._idle = 0; };
    canvas.addEventListener('pointerdown', this._onDown);
    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerup', this._onUp);
    canvas.addEventListener('pointercancel', this._onUp);

    this.rig = null;
    this._running = true;
    this.clock = new THREE.Clock();
    this._tick();
  }

  setAppearance({ skin, cloth, armor, shield, hair, eye, weaponVisual, classId }) {
    if (this.rig) {
      this.scene.remove(this.rig.root);
      this.rig.root.traverse((o) => {
        if (o.isMesh) { if (!o.geometry.userData?.shared) o.geometry.dispose(); if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material.dispose(); }
      });
    }
    this.rig = createHumanoid({ skin, cloth, armor, shield, hair: hair ?? 0x2c1f16, eye: eye ?? 0x3f78b0, weaponVisual: weaponVisual || 'sword', equipVisible: true, role: classId ? 'player:' + classId : undefined });
    this.rig.root.position.y = 0;
    this.rig.root.rotation.y = this._yaw;
    this.scene.add(this.rig.root);
  }

  _tick = () => {
    if (!this._running) return;
    requestAnimationFrame(this._tick);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this._drag) {
      this._idle += dt;
      this._yaw += this._vel; this._vel *= 0.92;          // inertie après le lancer
      if (this._idle > 1.2) this._yaw += dt * 0.55;         // puis rotation lente
    }
    if (this.rig) {
      this.rig.root.rotation.y = this._yaw;
      animateHumanoid(this.rig, { speed: 0, grounded: true, action: null, dead: false, crouch: false }, dt);
    }
    this._pedestal[1].rotation.z += dt * 0.25; this._pedestal[2].rotation.z -= dt * 0.4;
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this._running = false;
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._onDown); c.removeEventListener('pointermove', this._onMove);
    c.removeEventListener('pointerup', this._onUp); c.removeEventListener('pointercancel', this._onUp);
    if (this.rig) this.scene.remove(this.rig.root);
    if (this._envTex) this._envTex.dispose();
    this.renderer.dispose();
  }
}
