// V10.79 — halo lumineux (bloom) : les néons, cristaux, sorts et runes rayonnent. Réservé aux profils Élevé/Ultra ; tout échec → rendu direct.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.ok = false;
    try {
      const w = renderer.domElement.width, h = renderer.domElement.height;
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(renderer, rt);
      this.composer.addPass(new RenderPass(scene, camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.34, 0.6, 0.9);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      this.ok = true;
    } catch (e) { console.warn('[V10.79] halo lumineux ignoré', e); this.ok = false; }
  }
  resize() { if (!this.ok) return; const pr = this.renderer.getPixelRatio(); const s = new THREE.Vector2(); this.renderer.getSize(s); this.composer.setPixelRatio(pr); this.composer.setSize(s.x, s.y); }
  render() {
    try { this.composer.render(); } catch (e) { this.ok = false; console.warn('[V10.79] halo désactivé', e); this.renderer.render(this.scene, this.camera); }
  }
}
