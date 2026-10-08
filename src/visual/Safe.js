import * as THREE from 'three';

// Mode compatibilité V2.5 : si un shader personnalisé échoue à la compilation
// sur un téléphone, on le mémorise et, au prochain lancement, tous les shaders
// personnalisés V2.5 sont désactivés (le jeu reste jouable avec les matériaux
// standards de Three.js).
const KEY = 'aetheria.v25.safe';

let safe = false;
try { safe = localStorage.getItem(KEY) === '1'; } catch (e) { /* stockage indisponible */ }

export const isSafeMode = () => safe;

export function setSafeMode(v) {
  safe = !!v;
  try { if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

// Uniforms partagés (temps, position du joueur) pour le vent / la distance.
export const VU = {
  uTime: { value: 0 },
  uPlayer: { value: new THREE.Vector3() }
};

export function updateVisualUniforms(t, playerPos) {
  VU.uTime.value = t;
  if (playerPos) VU.uPlayer.value.copy(playerPos);
}

// Ajoute à un matériau un balancement (vent) et un fondu par distance
// au joueur. Ne fait rien en mode compatibilité.
//  amp    : amplitude du vent (m)
//  height : hauteur de référence pour pondérer le vent (m)
//  fadeR  : rayon (m) au-delà duquel les instances rétrécissent (0 = aucun)
export function addSway(material, { amp = 0.08, height = 0.5, fadeR = 0, speed = 1.7 } = {}) {
  if (safe) return material;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = VU.uTime;
    shader.uniforms.uPlayer = VU.uPlayer;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
uniform vec3 uPlayer;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
    vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  #else
    vec3 ip = vec3(0.0);
  #endif
  float hw = clamp(position.y / ${height.toFixed(3)}, 0.0, 1.5);
  hw = hw * hw;
  float ph = ip.x * 0.55 + ip.z * 0.43;
  transformed.x += sin(uTime * ${speed.toFixed(2)} + ph) * ${amp.toFixed(3)} * hw;
  transformed.z += cos(uTime * ${(speed * 0.8).toFixed(2)} + ph * 1.3) * ${amp.toFixed(3)} * 0.7 * hw;
  ${fadeR > 0 ? `float dd = distance(ip.xz, uPlayer.xz);
  transformed *= 1.0 - smoothstep(${(fadeR - 7).toFixed(1)}, ${fadeR.toFixed(1)}, dd);` : ''}
}`);
  };
  material.customProgramCacheKey = () => `sway_${amp}_${height}_${fadeR}_${speed}`;
  return material;
}
