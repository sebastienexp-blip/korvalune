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
      // V10.93 : sur téléphone, cibles de rendu moins lourdes (MSAA 4× en demi-flottant + résolution ×3 saturaient la carte graphique → carrés noirs)
      this.touch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 1;
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.touch ? 2 : 4 });
      this.composer = new EffectComposer(renderer, rt);
      this.composer.addPass(new RenderPass(scene, camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.34, 0.6, 0.9);
      // V10.93 : une valeur invalide (NaN / infini, p. ex. d'un matériau à normales dégénérées) était étalée par le flou en grands carrés noirs : on l'écarte avant le halo
      try {
        const hp = this.bloom.materialHighPassFilter;
        hp.fragmentShader = hp.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );', 'vec4 texel = texture2D( tDiffuse, vUv ); if (any(isnan(texel)) || any(isinf(texel))) texel = vec4(0.0); texel.rgb = min(texel.rgb, vec3(12.0));');
        hp.needsUpdate = true;
      } catch (e) { /* facultatif */ }
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      this.ok = true;
    } catch (e) { console.warn('[V10.79] halo lumineux ignoré', e); this.ok = false; }
  }
  resize() { if (!this.ok) return; const pr = Math.min(this.renderer.getPixelRatio(), this.touch ? 2 : 4); const s = new THREE.Vector2(); this.renderer.getSize(s); this.composer.setPixelRatio(pr); this.composer.setSize(s.x, s.y); }
  render() {
    try { this.composer.render(); } catch (e) { this.ok = false; console.warn('[V10.79] halo désactivé', e); this.renderer.render(this.scene, this.camera); }
  }
}
