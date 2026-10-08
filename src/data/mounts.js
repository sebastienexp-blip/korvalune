// V10.10 — Écurie de Korvalune : catalogue des montures (partagé client + serveur).
// Achetées en PIÈCES D'OR du jeu (jamais en Lunes) : elles se gagnent en jouant, rien de payant n'accélère la progression.
// speed = multiplicateur de vitesse de déplacement ; fly = monture volante (survole l'eau, les falaises et les obstacles).
export const MOUNTS = [
  { id: 'horse_brun', kind: 'horse', name: 'Cheval brun', desc: 'Robuste et fiable : la monture des voyageurs.', price: 400, levelReq: 5, speed: 1.55, colors: { body: 0x8a5a33, mane: 0x2e1d10 } },
  { id: 'horse_blanc', kind: 'horse', name: 'Destrier blanc', desc: 'Plus rapide, élevé dans les plaines de Korvalune.', price: 1500, levelReq: 15, speed: 1.75, colors: { body: 0xf1ede4, mane: 0xcfc6b4 } },
  { id: 'horse_noir', kind: 'horse', name: 'Étalon noir', desc: 'Un galop de tempête, réservé aux cavaliers aguerris.', price: 3500, levelReq: 25, speed: 1.95, colors: { body: 0x1e1a22, mane: 0x6b4fa8 } },
  { id: 'griffon_fauve', kind: 'griffon', fly: true, name: 'Griffon fauve', desc: 'Vole au-dessus de l’eau, des falaises et des forêts.', price: 8000, levelReq: 30, speed: 1.9, colors: { body: 0xb7864a, feather: 0xe9e1cf, beak: 0xf2c14e } },
  { id: 'griffon_royal', kind: 'griffon', fly: true, name: 'Griffon royal', desc: 'Le plus rapide du ciel, plumage d’or et d’azur.', price: 20000, levelReq: 45, speed: 2.3, colors: { body: 0xd9b24c, feather: 0x5aa8ff, beak: 0xffe07a } }
];
export const MOUNT_BY_ID = Object.assign(Object.create(null), Object.fromEntries(MOUNTS.map((m) => [m.id, m])));
export const isMountId = (id) => typeof id === 'string' && !!MOUNT_BY_ID[id];
export const MAX_MOUNTS = MOUNTS.length;
