import * as THREE from 'three';

// V10.12 — Façade du barbier de Korvalune (maison de la rue sud-ouest, x = -11, z = 15) :
// enseigne au-dessus de la porte + poteau de barbier rayé qui tourne. Purement décoratif.
export function buildBarberDecor(scene, world, { x = -11, z = 15, depth = 5, width = 5.5 } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  const fz = z + depth / 2;
  const y = world.heightAt(x, fz);
  const disposables = [];
  const mat = (o) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.6, ...o }); disposables.push(m); return m; };
  const mesh = (geo, m, px, py, pz) => { const me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); me.castShadow = true; group.add(me); disposables.push(geo); return me; };

  // enseigne
  const signTex = canvasTex(512, 150, (g) => {
    g.fillStyle = '#3b2414'; g.fillRect(0, 0, 512, 150);
    g.strokeStyle = '#d4b04a'; g.lineWidth = 9; g.strokeRect(9, 9, 494, 132);
    g.fillStyle = '#f1d48a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 54px Georgia, serif'; g.fillText('✂ Barbier ✂', 256, 60);
    g.font = 'italic 25px Georgia, serif'; g.fillText('coupes · couleurs · apparence', 256, 112);
  });
  disposables.push(signTex);
  mesh(new THREE.BoxGeometry(1.7, 0.5, 0.06), mat({ map: signTex }), x, y + 3.2, fz + 0.12);
  const brass = mat({ color: 0xc9a74a, metalness: 0.8, roughness: 0.3 });
  for (const sx of [-0.7, 0.7]) mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 5), brass, x + sx, y + 3.55, fz + 0.12);

  // poteau rayé (rouge / blanc / bleu) avec embouts dorés
  const poleTex = canvasTex(64, 128, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 128);
    const cols = ['#c62828', '#ffffff', '#1f4fa8', '#ffffff'];
    for (let i = -4; i < 12; i++) {
      g.fillStyle = cols[((i % 4) + 4) % 4];
      g.beginPath(); g.moveTo(0, i * 16); g.lineTo(64, i * 16 - 32); g.lineTo(64, i * 16 - 16); g.lineTo(0, i * 16 + 16); g.fill();
    }
  });
  poleTex.wrapS = poleTex.wrapT = THREE.RepeatWrapping; poleTex.repeat.set(1, 2);
  disposables.push(poleTex);
  const px = x + width / 2 + 0.25, pz = fz + 0.3;
  mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.3, 18), mat({ map: poleTex, roughness: 0.25 }), px, y + 1.55, pz);
  mesh(new THREE.SphereGeometry(0.14, 12, 9), brass, px, y + 2.28, pz);
  mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.12, 12), brass, px, y + 0.86, pz);
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 6), brass, px, y + 0.4, pz);

  return {
    group,
    update(dt) { poleTex.offset.y = (poleTex.offset.y + dt * 0.3) % 1; },
    dispose() { scene.remove(group); disposables.forEach((d) => d.dispose()); }
  };
}

function canvasTex(w, h, draw) {
  let t = null;
  try {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'));
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  } catch { t = new THREE.Texture(); }
  return t;
}
