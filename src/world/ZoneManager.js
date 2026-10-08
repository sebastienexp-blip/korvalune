import * as THREE from 'three';
import zoneDefs from './zones.json';
import { REGIONS, regionAt, isLand } from './Continent.js';

// Détecte dans quelle région nommée se trouve le joueur (par distance à un
// centre + priorité pour les zones imbriquées comme un donjon dans une forêt),
// notifie le changement, et teinte légèrement le brouillard pour l'ambiance.
export class ZoneManager {
  constructor(bus, scene) {
    this.bus = bus;
    this.scene = scene;
    this.zones = zoneDefs.map((z) => ({ ...z, tintColor: new THREE.Color(z.tint) })); // zones locales (donjons)
    this.regions = REGIONS.map((r) => ({ id: r.id, name: r.name, levels: `${r.levels[0]}-${r.levels[1]}`, tintColor: new THREE.Color(r.tint) }));
    this.current = null;
    this._tmp = new THREE.Color();
  }

  zoneAt(x, z) {
    for (const zone of this.zones) if (Math.hypot(x - zone.center[0], z - zone.center[1]) <= zone.radius) return zone;
    if (!isLand(x, z)) return null;
    return this.regions[REGIONS.indexOf(regionAt(x, z))];
  }

  update(playerPos, fog) {
    const zone = this.zoneAt(playerPos.x, playerPos.z);
    if (zone !== this.current) {
      this.current = zone;
      if (zone) this.bus.emit('notify', { text: `― ${zone.name} ―${zone.levels ? '  niv. ' + zone.levels : ''}`, kind: 'zone' });
      this.bus.emit('zoneChanged', zone);
    }
    if (zone && fog) fog.color.lerp(this._tmp.copy(zone.tintColor), 0.12);
  }
}
