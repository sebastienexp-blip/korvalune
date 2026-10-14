// V10.48 — Mouvements supplémentaires du squelette « veilleur » (le corps .glb ne contenait que 9 clips :
// repos, marche, course, 2 attaques, coup reçu, mort, saut, monture). Ceux-ci sont construits en code, image par image,
// à partir de poses clés (angles en degrés, interpolation lissée) :
//   roll          roulade (esquive)                     shoot / shoot2   tir à l'arc (normal / puissant)
//   cast / cast2  incantation (sort simple / grand sort) interact         invocation (bonus, soins, cris de guerre)
//   emote_*       émotes sociales, visibles par les autres joueurs
// Convention (squelette face à +Z, gauche = +X) : X négatif = bras/cuisse vers l'avant, X positif = genou/buste/tête qui plie vers l'avant,
// Z positif = bras gauche vers l'extérieur (négatif à droite), Y = rotation autour de la verticale.
import * as THREE from 'three';

const D = Math.PI / 180;
const HIP_Y = 0.975;
const BONES = ['Spine', 'Chest', 'Neck', 'Head', 'Shoulder_L', 'Shoulder_R', 'UpperArm_L', 'UpperArm_R', 'LowerArm_L', 'LowerArm_R', 'Hand_L', 'Hand_R',
  'UpperLeg_L', 'UpperLeg_R', 'LowerLeg_L', 'LowerLeg_R', 'Foot_L', 'Foot_R'];
const NEUTRAL = { UpperArm_L: [0, 0, 4], UpperArm_R: [0, 0, -4], LowerArm_L: [-12, 0, 0], LowerArm_R: [-12, 0, 0] };

// ---- construction d'un clip à partir de poses clés ----
// keys : [{ t, p: { Os: [x, y, z] }, h: [x, y, z] rotation du bassin, y: hauteur du bassin, hx/hz: décalage du bassin }]
function build(name, keys, { fps = 30 } = {}) {
  keys = keys.slice().sort((a, b) => a.t - b.t);
  const dur = keys[keys.length - 1].t;
  const chan = (get) => keys.map(get);
  const hermite = (vals, t) => {
    const n = keys.length;
    if (t <= keys[0].t) return vals[0];
    if (t >= keys[n - 1].t) return vals[n - 1];
    let i = 0; while (i < n - 2 && t > keys[i + 1].t) i++;
    const t0 = keys[i].t, t1 = keys[i + 1].t, h = t1 - t0, u = (t - t0) / h;
    // tangentes monotones (Fritsch–Carlson) : aucune oscillation, et deux poses identiques consécutives donnent un vrai maintien
    const tan = (j) => {
      if (j <= 0 || j >= n - 1) return 0;
      const d0 = (vals[j] - vals[j - 1]) / (keys[j].t - keys[j - 1].t), d1 = (vals[j + 1] - vals[j]) / (keys[j + 1].t - keys[j].t);
      return d0 * d1 <= 0 ? 0 : (2 * d0 * d1) / (d0 + d1);
    };
    const m0 = tan(i) * h, m1 = tan(i + 1) * h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * vals[i] + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * vals[i + 1] + (u3 - u2) * m1;
  };
  const steps = Math.max(2, Math.round(dur * fps));
  const times = new Float32Array(steps + 1);
  for (let s = 0; s <= steps; s++) times[s] = (s / steps) * dur;
  const tracks = [];
  const e = new THREE.Euler(0, 0, 0, 'XYZ'), q = new THREE.Quaternion();
  const quatTrack = (bone, get) => {
    const cx = chan((k) => get(k)[0]), cy = chan((k) => get(k)[1]), cz = chan((k) => get(k)[2]);
    const out = new Float32Array((steps + 1) * 4);
    for (let s = 0; s <= steps; s++) {
      e.set(hermite(cx, times[s]) * D, hermite(cy, times[s]) * D, hermite(cz, times[s]) * D, 'XYZ');
      q.setFromEuler(e); q.toArray(out, s * 4);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, out));
  };
  for (const b of BONES) quatTrack(b, (k) => (k.p && k.p[b]) || NEUTRAL[b] || [0, 0, 0]);
  quatTrack('Hips', (k) => k.h || [0, 0, 0]);
  const hy = chan((k) => (k.y != null ? k.y : HIP_Y)), hx = chan((k) => k.hx || 0), hz = chan((k) => k.hz || 0);
  const pos = new Float32Array((steps + 1) * 3);
  for (let s = 0; s <= steps; s++) { pos[s * 3] = hermite(hx, times[s]); pos[s * 3 + 1] = hermite(hy, times[s]); pos[s * 3 + 2] = hermite(hz, times[s]); }
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, pos));
  return new THREE.AnimationClip(name, dur, tracks);
}

const K = (t, p = {}, o = {}) => ({ t, p, ...o });
const mirrorArms = (x, z, lx = -12) => ({ UpperArm_L: [x, 0, z], UpperArm_R: [x, 0, -z], LowerArm_L: [lx, 0, 0], LowerArm_R: [lx, 0, 0] });

// ---------------------------------------------------------------- roulade
function rollClip() {
  const tuck = { Spine: [55, 0, 0], Chest: [30, 0, 0], Neck: [45, 0, 0], Head: [10, 0, 0], UpperLeg_L: [-120, 0, 0], UpperLeg_R: [-120, 0, 0], LowerLeg_L: [135, 0, 0], LowerLeg_R: [135, 0, 0], Foot_L: [30, 0, 0], Foot_R: [30, 0, 0],
    UpperArm_L: [-75, 0, 14], UpperArm_R: [-75, 0, -14], LowerArm_L: [-115, 0, 0], LowerArm_R: [-115, 0, 0] };
  const dive = { Spine: [30, 0, 0], Chest: [15, 0, 0], Neck: [20, 0, 0], UpperLeg_L: [-62, 0, 0], UpperLeg_R: [-62, 0, 0], LowerLeg_L: [90, 0, 0], LowerLeg_R: [90, 0, 0], Foot_L: [-20, 0, 0], Foot_R: [-20, 0, 0],
    UpperArm_L: [-65, 0, 8], UpperArm_R: [-65, 0, -8], LowerArm_L: [-35, 0, 0], LowerArm_R: [-35, 0, 0] };
  const land = { Spine: [28, 0, 0], Chest: [12, 0, 0], UpperLeg_L: [-65, 0, 0], UpperLeg_R: [-65, 0, 0], LowerLeg_L: [90, 0, 0], LowerLeg_R: [90, 0, 0], ...mirrorArms(-35, 12, -40) };
  return build('roll', [
    K(0, {}, { y: HIP_Y }),
    K(0.07, dive, { y: 0.78, h: [0, 0, 0] }),
    K(0.16, tuck, { y: 0.56, h: [80, 0, 0] }),
    K(0.25, tuck, { y: 0.52, h: [170, 0, 0] }),
    K(0.34, tuck, { y: 0.52, h: [260, 0, 0] }),
    K(0.43, tuck, { y: 0.58, h: [340, 0, 0] }),
    K(0.5, land, { y: 0.78, h: [360, 0, 0] }),
    K(0.56, {}, { y: HIP_Y, h: [360, 0, 0] })
  ]);
}

// ---------------------------------------------------------------- tir à l'arc (la flèche part à 35 % du clip, comme la compétence)
function shootClip(power) {
  const turn = { Spine: [0, -30, 0], Chest: [0, -35, 0], Neck: [0, 40, 0], Head: [0, 45, 0] };
  const legs = { UpperLeg_L: [-6, 0, 8], UpperLeg_R: [10, 0, -8], LowerLeg_L: [6, 0, 0], LowerLeg_R: [10, 0, 0] };
  const bowArm = { UpperArm_L: [-6, 0, 84], LowerArm_L: [-4, 0, 0], Hand_L: [0, 0, -85] };
  const ready = { ...turn, ...legs, ...bowArm, UpperArm_R: [-18, 0, -62], LowerArm_R: [-80, 0, 0] };
  const draw = { ...turn, ...legs, ...bowArm, UpperArm_R: [-29, 31, -113], LowerArm_R: [-138, 0, 0] };   // main de corde à la joue (calculée par cinématique inverse)
  const rel = { ...turn, ...legs, ...bowArm, UpperArm_L: [-2, 0, 86], UpperArm_R: [-22, 14, -120], LowerArm_R: [-100, 0, 0] };
  const follow = { ...turn, ...legs, ...bowArm, UpperArm_L: [-8, 0, 72], UpperArm_R: [-15, 10, -75], LowerArm_R: [-80, 0, 0] };
  const hy = HIP_Y - 0.03 - 0.03 * power;
  return build(power > 1 ? 'shoot2' : 'shoot', [
    K(0),
    K(0.1, ready, { y: hy, h: [0, -20, 0] }),
    K(0.32, draw, { y: hy, h: [0, -20, 0] }),
    K(0.36, rel, { y: hy, h: [0, -20, 0] }),
    K(0.58, follow, { y: hy + 0.01, h: [0, -16, 0] }),
    K(0.8, { ...follow, UpperArm_L: [-4, 0, 40], UpperArm_R: [-8, 0, -25], LowerArm_R: [-50, 0, 0], Spine: [0, -12, 0], Chest: [0, -12, 0], Neck: [0, 14, 0], Head: [0, 14, 0], Hand_L: [0, 0, -35] }, { y: HIP_Y - 0.01, h: [0, -6, 0] }),
    K(1.0)
  ]);
}

// ---------------------------------------------------------------- incantation (le sort part à 35 %)
function castClip(big) {
  const lunge = { UpperLeg_L: [-22, 0, 3], LowerLeg_L: [24, 0, 0], UpperLeg_R: [16, 0, -3], LowerLeg_R: [12, 0, 0] };
  if (!big) {
    const gather = { UpperArm_R: [-55, 0, -18], LowerArm_R: [-85, 0, 0], UpperArm_L: [-45, 0, 12], LowerArm_L: [-70, 0, 0], Spine: [-6, 0, 0], Chest: [-4, 0, 0], Head: [-8, 0, 0], UpperLeg_L: [-6, 0, 2], UpperLeg_R: [8, 0, -2] };
    const thrust = { UpperArm_R: [-95, 0, -6], LowerArm_R: [-12, 0, 0], UpperArm_L: [-100, 0, 10], LowerArm_L: [-10, 0, 0], Spine: [12, 0, 0], Chest: [8, 0, 0], Head: [4, 0, 0], ...lunge };
    return build('cast', [K(0), K(0.18, gather, { y: 0.96 }), K(0.35, thrust, { y: 0.92 }), K(0.55, { ...thrust, UpperArm_R: [-90, 0, -8], UpperArm_L: [-92, 0, 10] }, { y: 0.92 }), K(0.8, { ...gather, UpperArm_R: [-30, 0, -10], UpperArm_L: [-25, 0, 8], LowerArm_R: [-50, 0, 0], LowerArm_L: [-45, 0, 0] }, { y: 0.96 }), K(1.0)]);
  }
  const up = { UpperArm_R: [-150, 0, -18], UpperArm_L: [-150, 0, 18], LowerArm_R: [-18, 0, 0], LowerArm_L: [-18, 0, 0], Spine: [-18, 0, 0], Chest: [-10, 0, 0], Head: [-22, 0, 0], UpperLeg_L: [-10, 0, 3], UpperLeg_R: [10, 0, -3] };
  const slam = { UpperArm_R: [-80, 0, -8], UpperArm_L: [-80, 0, 8], LowerArm_R: [-10, 0, 0], LowerArm_L: [-10, 0, 0], Spine: [22, 0, 0], Chest: [12, 0, 0], Head: [12, 0, 0], ...lunge };
  return build('cast2', [K(0), K(0.2, up, { y: 0.93 }), K(0.35, slam, { y: 0.88 }), K(0.58, { ...slam, Spine: [16, 0, 0] }, { y: 0.9 }), K(0.82, { ...up, UpperArm_R: [-40, 0, -10], UpperArm_L: [-40, 0, 10], Spine: [4, 0, 0], Chest: [2, 0, 0], Head: [0, 0, 0] }, { y: 0.95 }), K(1.0)]);
}

// ---------------------------------------------------------------- invocation : bonus, soins, cris (l'effet part à 35 %)
function invokeClip() {
  const pray = { UpperArm_L: [-40, 0, 14], UpperArm_R: [-40, 0, -14], LowerArm_L: [-105, 0, 0], LowerArm_R: [-105, 0, 0], Head: [14, 0, 0], Spine: [8, 0, 0] };
  const rise = { UpperArm_L: [-15, 0, 150], UpperArm_R: [-15, 0, -150], LowerArm_L: [-6, 0, 0], LowerArm_R: [-6, 0, 0], Spine: [-14, 0, 0], Chest: [-10, 0, 0], Head: [-22, 0, 0], UpperLeg_L: [-4, 0, 3], UpperLeg_R: [4, 0, -3] };
  return build('interact', [K(0), K(0.2, pray, { y: 0.95 }), K(0.38, rise, { y: 0.99 }), K(0.62, { ...rise, UpperArm_L: [-12, 0, 142], UpperArm_R: [-12, 0, -142] }, { y: 0.99 }), K(0.85, { ...mirrorArms(-20, 30, -20), Spine: [-4, 0, 0] }), K(1.0)]);
}

// ---------------------------------------------------------------- émotes (durée propre au clip)
const EMOTE_CLIPS = {
  wave() {
    const up = { UpperArm_R: [0, 0, -125], LowerArm_R: [-20, 0, 0], Head: [0, 10, 0], Spine: [0, -4, 0] };
    const w = (a) => ({ ...up, LowerArm_R: [-20, 0, a] });
    return build('emote_wave', [K(0), K(0.4, up), K(0.65, w(-22)), K(0.9, w(18)), K(1.15, w(-22)), K(1.4, w(18)), K(1.65, w(-22)), K(1.9, up), K(2.4)]);
  },
  cheer() {
    const hi = { UpperArm_L: [-10, 0, 160], UpperArm_R: [-10, 0, -160], LowerArm_L: [-8, 0, 0], LowerArm_R: [-8, 0, 0], Head: [-18, 0, 0], Spine: [-8, 0, 0] };
    const crouch = { ...hi, UpperLeg_L: [-35, 0, 4], UpperLeg_R: [-35, 0, -4], LowerLeg_L: [60, 0, 0], LowerLeg_R: [60, 0, 0], Foot_L: [-20, 0, 0], Foot_R: [-20, 0, 0], Spine: [10, 0, 0] };
    const air = { ...hi, UpperLeg_L: [-8, 0, 4], UpperLeg_R: [-8, 0, -4], LowerLeg_L: [18, 0, 0], LowerLeg_R: [18, 0, 0], Foot_L: [30, 0, 0], Foot_R: [30, 0, 0] };
    return build('emote_cheer', [K(0), K(0.3, hi), K(0.55, crouch, { y: 0.8 }), K(0.8, air, { y: 1.2 }), K(1.05, hi), K(1.3, crouch, { y: 0.8 }), K(1.55, air, { y: 1.2 }), K(1.8, hi), K(2.3)]);
  },
  clap() {
    // poses des mains calculées par cinématique inverse : les paumes se rejoignent devant la poitrine
    const open = { UpperArm_L: [7, -35, 17], UpperArm_R: [7, 35, -17], LowerArm_L: [-117, 0, 0], LowerArm_R: [-117, 0, 0], Head: [8, 0, 0], Spine: [3, 0, 0] };
    const shut = { UpperArm_L: [-4, -61, 12], UpperArm_R: [-4, 61, -12], LowerArm_L: [-102, 0, 0], LowerArm_R: [-102, 0, 0], Head: [8, 0, 0], Spine: [3, 0, 0] };
    const keys = [K(0), K(0.3, open)];
    let t = 0.3; for (let i = 0; i < 5; i++) { keys.push(K(t += 0.2, shut), K(t += 0.2, open)); }
    keys.push(K(t + 0.35));
    return build('emote_clap', keys);
  },
  bow() {
    const deep = { Spine: [38, 0, 0], Chest: [22, 0, 0], Neck: [14, 0, 0], Head: [8, 0, 0], UpperArm_R: [-45, 0, 22], LowerArm_R: [-105, 0, 0], UpperArm_L: [18, 0, -12], LowerArm_L: [-30, 0, 0], UpperLeg_R: [14, 0, -3], UpperLeg_L: [-6, 0, 3] };
    return build('emote_bow', [K(0), K(0.5, deep, { y: 0.95 }), K(1.7, deep, { y: 0.95 }), K(2.3)]);
  },
  dance() {
    const a = { h: [0, 0, 7], y: HIP_Y - 0.04, p: { UpperArm_L: [-30, 0, 110], UpperArm_R: [-10, 0, -50], LowerArm_L: [-50, 0, 0], LowerArm_R: [-80, 0, 0], UpperLeg_L: [-8, 0, 6], UpperLeg_R: [6, 0, -4], LowerLeg_L: [22, 0, 0], LowerLeg_R: [4, 0, 0], Spine: [0, 8, 6], Chest: [0, 10, -6], Head: [0, -8, 6] } };
    const b = { h: [0, 0, -7], y: HIP_Y - 0.04, p: { UpperArm_R: [-30, 0, -110], UpperArm_L: [-10, 0, 50], LowerArm_R: [-50, 0, 0], LowerArm_L: [-80, 0, 0], UpperLeg_R: [-8, 0, -6], UpperLeg_L: [6, 0, 4], LowerLeg_R: [22, 0, 0], LowerLeg_L: [4, 0, 0], Spine: [0, -8, -6], Chest: [0, -10, 6], Head: [0, 8, -6] } };
    const keys = [K(0)]; let t = 0;
    for (let i = 0; i < 8; i++) { t += 0.5; const s = i % 2 ? b : a; keys.push(K(t, s.p, { h: s.h, y: s.y + (i % 2 ? 0 : 0.04) })); }
    keys.push(K(t + 0.5));
    return build('emote_dance', keys);
  },
  point() {
    const pt = { UpperArm_R: [-90, 0, 22], LowerArm_R: [-3, 0, 0], Head: [0, 4, 0], Spine: [0, -6, 0], Chest: [0, -5, 0] };   // (les os du bras sont légèrement écartés au repos : on compense pour viser droit devant)
    return build('emote_point', [K(0), K(0.35, pt), K(1.5, pt), K(2.0)]);
  },
  laugh() {
    const base = { UpperArm_L: [-25, 0, 10], UpperArm_R: [-25, 0, -10], LowerArm_L: [-75, 0, 0], LowerArm_R: [-75, 0, 0], Head: [-26, 0, 0], Neck: [-8, 0, 0], Spine: [-8, 0, 0] };
    const keys = [K(0), K(0.3, base)]; let t = 0.3;
    for (let i = 0; i < 10; i++) { t += 0.16; keys.push(K(t, { ...base, Chest: [i % 2 ? 7 : -3, 0, 0], Head: [i % 2 ? -30 : -22, 0, 0] }, { y: HIP_Y + (i % 2 ? 0.012 : -0.012) })); }
    keys.push(K(t + 0.4));
    return build('emote_laugh', keys);
  },
  sit() {   // assis au sol, genoux relevés, les bras posés dessus
    const s = { Spine: [14, 0, 0], Chest: [8, 0, 0], Head: [-6, 0, 0], UpperLeg_L: [-98, 0, 10], UpperLeg_R: [-98, 0, -10], LowerLeg_L: [128, 0, 0], LowerLeg_R: [128, 0, 0], Foot_L: [15, 0, 0], Foot_R: [15, 0, 0], UpperArm_L: [-55, 0, 6], UpperArm_R: [-55, 0, -6], LowerArm_L: [-48, 0, 0], LowerArm_R: [-48, 0, 0] };
    return build('emote_sit', [K(0), K(0.35, { ...s, Spine: [24, 0, 0], UpperLeg_L: [-70, 0, 8], UpperLeg_R: [-70, 0, -8], LowerLeg_L: [100, 0, 0], LowerLeg_R: [100, 0, 0] }, { y: 0.5 }), K(0.8, s, { y: 0.05, hz: -0.12 })]);
  },
  salute() {
    const sl = { UpperArm_R: [-45, 47, -95], LowerArm_R: [-113, 0, 0], Head: [-4, 0, 0], Chest: [-4, 0, 0], Spine: [-3, 0, 0] };
    return build('emote_salute', [K(0), K(0.3, sl), K(1.6, sl), K(2.0)]);
  },
  flex() {
    const f = { UpperArm_L: [0, 0, 92], UpperArm_R: [0, 0, -92], LowerArm_L: [0, 0, 105], LowerArm_R: [0, 0, -105], Chest: [-6, 0, 0], Head: [-6, 0, 0], UpperLeg_L: [-4, 0, 9], UpperLeg_R: [-4, 0, -9] };
    return build('emote_flex', [K(0), K(0.4, f), K(0.75, { ...f, Chest: [-9, 0, 0] }), K(1.1, f), K(1.45, { ...f, Chest: [-9, 0, 0] }), K(1.8, f), K(2.4)]);
  },
  shrug() {
    const sh = { Shoulder_L: [0, 0, -14], Shoulder_R: [0, 0, 14], UpperArm_L: [-20, 0, 42], UpperArm_R: [-20, 0, -42], LowerArm_L: [-65, 0, 0], LowerArm_R: [-65, 0, 0], Head: [0, 0, 8], Neck: [0, 0, 4] };
    return build('emote_shrug', [K(0), K(0.35, sh), K(1.4, sh), K(1.9)]);
  }
};

// Durée (s) de chaque émote, nom affiché et tenue : `hold` = reste dans la pose finale tant qu'on ne bouge pas
export const EMOTES = [
  { id: 'wave', name: 'Saluer', icon: '👋', dur: 2.4 },
  { id: 'cheer', name: 'Victoire', icon: '🙌', dur: 2.3 },
  { id: 'clap', name: 'Applaudir', icon: '👏', dur: 2.9 },
  { id: 'bow', name: 'Révérence', icon: '🙇', dur: 2.3 },
  { id: 'dance', name: 'Danser', icon: '💃', dur: 4.5 },
  { id: 'point', name: 'Pointer', icon: '👉', dur: 2.0 },
  { id: 'laugh', name: 'Rire', icon: '😄', dur: 2.3 },
  { id: 'sit', name: 'S’asseoir', icon: '🪑', dur: 600, hold: true },
  { id: 'salute', name: 'Salut militaire', icon: '🫡', dur: 2.0 },
  { id: 'flex', name: 'Muscles', icon: '💪', dur: 2.4 },
  { id: 'shrug', name: 'Hausser les épaules', icon: '🤷', dur: 1.9 }
];
export const EMOTE_BY_ANIM = Object.fromEntries(EMOTES.map((e) => ['emote_' + e.id, e]));

// Construit tous les clips supplémentaires (une seule fois) → liste de THREE.AnimationClip
let _cache = null;
export function buildExtraClips() {
  if (_cache) return _cache;
  _cache = [rollClip(), shootClip(1), shootClip(2), castClip(false), castClip(true), invokeClip()];
  for (const e of EMOTES) _cache.push(EMOTE_CLIPS[e.id]());
  return _cache;
}

// Mots tapés dans le chat (« /danse », « /emote salut ») → émote
const ALIAS = { wave: ['salut', 'saluer', 'coucou', 'bonjour', 'wave'], cheer: ['victoire', 'hourra', 'cheer', 'bravo'], clap: ['applaudir', 'applaudis', 'clap'], bow: ['reverence', 'inclinaison', 'bow'],
  dance: ['danse', 'danser', 'dance'], point: ['pointer', 'montrer', 'point'], laugh: ['rire', 'rigole', 'laugh'], sit: ['assis', 'asseoir', 'sasseoir', 'sit'], salute: ['militaire', 'garde-a-vous', 'salute'],
  flex: ['muscles', 'muscle', 'flex'], shrug: ['epaules', 'shrug', 'aucune-idee'] };
const plain = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f'’]/g, '').trim();
export function findEmote(word) {
  const w = plain(word); if (!w) return null;
  for (const e of EMOTES) if (plain(e.name) === w || e.id === w || (ALIAS[e.id] || []).includes(w)) return e;
  return null;
}
