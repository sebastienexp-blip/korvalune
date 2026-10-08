import * as THREE from 'three';
// État partagé du « monde de groupe » (V6.0).
// Un groupe a UN hôte qui simule les monstres et les boss ; les autres membres voient des copies
// (« proxys ») et lui envoient leurs dégâts. Chacun garde son propre butin, son XP et ses quêtes.
//   role : 'solo' (aucun groupe, comportement inchangé) | 'host' | 'guest'
export const share = {
  role: 'solo',
  localPlayer: null,      // le joueur de CET appareil (récompenses, portée)
  range: 90,              // distance max pour être récompensé d'une mort
  sendDmg: null,          // (netKey, dmg, crit) => void   (invité → hôte)
  sendStatus: null,       // (netKey, kind, a, b) => void
  onKill: null,           // (entité) => void              (hôte → groupe)
  onBossDie: null
};

// Un membre distant vu comme une cible par les monstres de l'hôte.
export class RemoteTarget {
  constructor(id, sendHit) {
    this.id = id; this.sendHit = sendHit;
    this.pos = new THREE.Vector3();
    this.dead = false; this.isRemote = true;
  }
  set(p, hp) {
    this.pos.set(p[0], p[1], p[2]);
    this.dead = !(hp > 0);
  }
  takeDamage(dmg) { if (this.dead) return 0; this.sendHit(this.id, Math.round(dmg)); return Math.round(dmg * 0.8); }
  gainXp() {} addCoins() {}
}
