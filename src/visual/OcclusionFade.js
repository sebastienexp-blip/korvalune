import * as THREE from 'three';

// V6.1 — Transparence « à la Diablo 3 » : tout ce qui se trouve entre la caméra et le personnage
// (arbres, rochers, murs, toits…) devient translucide pour que le héros reste toujours visible.
// Aucun objet n'est déplacé ni dupliqué : un petit morceau de shader (tramage) estompe les pixels
// proches du segment caméra → joueur. Coût négligeable, y compris pour les arbres instanciés.
export const OCC = {
  cam: { value: new THREE.Vector3() },
  pl: { value: new THREE.Vector3() },
  rad: { value: 2.3 },
  on: { value: 1 }
};

export function updateOcclusion(camPos, playerPos, on) {
  OCC.cam.value.copy(camPos);
  OCC.pl.value.set(playerPos.x, playerPos.y + 1.1, playerPos.z);
  OCC.on.value = on ? 1 : 0;
}

export function patchOcclusion(material) {
  if (!material || material.userData?.occ || material.isShaderMaterial || material.transparent) return;
  if (!(material.isMeshStandardMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial)) return;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(material, shader, renderer);
    shader.uniforms.uOccCam = OCC.cam; shader.uniforms.uOccPl = OCC.pl; shader.uniforms.uOccR = OCC.rad; shader.uniforms.uOccOn = OCC.on;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOccW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  vec4 ow = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    ow = instanceMatrix * ow;
  #endif
  vOccW = (modelMatrix * ow).xyz;
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vOccW;
uniform vec3 uOccCam; uniform vec3 uOccPl; uniform float uOccR; uniform float uOccOn;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (uOccOn > 0.5) {
  vec3 ab = uOccPl - uOccCam;
  float t = clamp(dot(vOccW - uOccCam, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  float d = distance(vOccW, uOccCam + ab * t);
  float r = uOccR * mix(1.0, 1.9, 1.0 - t);               // le « cône » s'élargit vers la caméra
  float amt = (1.0 - smoothstep(r * 0.45, r, d)) * (1.0 - smoothstep(0.86, 0.97, t)) * 0.88;
  if (amt > 0.02) {
    float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (ign < amt) discard;
  }
}`);
  };
  const prevKey = material.customProgramCacheKey;
  material.customProgramCacheKey = () => (prevKey ? prevKey.call(material) : '') + '|occ1';
  material.userData = material.userData || {};
  material.userData.occ = true;
  material.needsUpdate = true;
}

// Applique l'effet à tous les objets « décor » d'un groupe (sauf terrain, eau, ciel…).
export function applyOcclusionFade(root, skip = []) {
  root.traverse((o) => {
    if (!o.isMesh || skip.includes(o)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) patchOcclusion(m);
  });
}
