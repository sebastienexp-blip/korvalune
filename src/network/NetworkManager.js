// Client réseau : relie le jeu au serveur WebSocket (server.js). Conçu pour
// échouer en douceur — si aucun serveur n'est trouvé, le jeu continue en
// mode solo et retente la connexion en arrière-plan.
//
// Le socket est ouvert tôt (dès le menu principal) pour permettre de se
// connecter à un compte avant même de lancer une partie. Rejoindre le monde
// multijoueur (visible des autres joueurs) est une étape séparée : joinWorld().
const PORT = 8787;
const RECONNECT_DELAY = 8000;
const MOVE_INTERVAL = 0.11; // ~9 envois/seconde

export class NetworkManager {
  constructor(bus) {
    this.bus = bus;
    this.ws = null;
    this.connected = false;
    this.id = null;
    this.token = null;
    this.username = null;
    this._joinProfile = null;
    this._joined = false;
    this._moveAcc = 0;
    this._reconnectTimer = null;
  }

  // En développement (Vite, ports 5173/4173) le serveur tourne à part sur le port 8787 ; en ligne, le site et
  // le WebSocket partagent la même adresse (wss:// automatiquement sur https).
  get url() {
    try { const q = new URLSearchParams(location.search).get('server'); if (q && /^wss?:\/\//.test(q)) return q; } catch { /* ignoré */ }
    const host = location.hostname || 'localhost';
    if (import.meta.env?.DEV || ['5173', '4173'].includes(location.port) || !location.host) return `ws://${host}:${PORT}`;
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  }

  // Vrai quand le jeu est hébergé sur Internet (pas en local / réseau privé) : le compte est alors obligatoire pour jouer.
  static isOnlineHost() {
    const h = location.hostname || '';
    if (!h || h === 'localhost' || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /\.local$/.test(h)) return false;
    return true;
  }

  // adresse HTTP du même serveur (API de paiement) : ws://hôte -> http://hôte
  get apiBase() { return this.url.replace(/^ws/, 'http'); }

  connect() { this._open(); }

  _open() {
    clearTimeout(this._reconnectTimer);
    let ws;
    try { ws = new WebSocket(this.url); } catch { this._scheduleReconnect(); return; }
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.connected = true;
      this.bus.emit('net:status', { connected: true });
      let saved = null; try { saved = localStorage.getItem('aetheria.session'); } catch { /* ignoré */ }
      if (saved && !this.token) this._send({ t: 'resume', token: saved }); // reconnexion automatique
      if (this._joinProfile) this._send({ t: 'join', ...this._joinProfile });
    });
    ws.addEventListener('message', (e) => this._onMessage(e.data));
    ws.addEventListener('close', () => {
      const wasConnected = this.connected;
      this.connected = false;
      this._joined = false;
      this.bus.emit('net:status', { connected: false });
      if (wasConnected) this.bus.emit('net:disconnected');
      this._scheduleReconnect();
    });
    ws.addEventListener('error', () => {});
  }

  _scheduleReconnect() {
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => this._open(), RECONNECT_DELAY);
  }

  _send(obj) { if (this.connected && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj)); }

  _onMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    switch (msg.t) {
      case 'welcome': this.id = msg.id; this._joined = true; this.bus.emit('net:welcome', msg); break;
      case 'playerJoined': this.bus.emit('net:playerJoined', msg.player); break;
      case 'playerLeft': this.bus.emit('net:playerLeft', msg.id); break;
      case 'playerMoved': this.bus.emit('net:playerMoved', msg); break;
      case 'chat': this.bus.emit('net:chat', msg); break;
      case 'whisper': this.bus.emit('net:whisper', msg); break;
      case 'system': this.bus.emit('net:system', msg); break;
      case 'who': this.bus.emit('net:who', msg.players); break;
      case 'group:update': this.bus.emit('net:group', msg); break;
      case 'gr': this.bus.emit('net:gr', msg); break;
      case 'friends': this.bus.emit('net:friends', msg); break;
      case 'dm': this.bus.emit('net:dm', msg); break;
      case 'dmHistory': this.bus.emit('net:dmHistory', msg); break;
      case 'trade:invited': this.bus.emit('net:tradeInvited', msg); break;
      case 'trade:open': this.bus.emit('net:tradeOpen', msg); break;
      case 'trade:state': this.bus.emit('net:tradeState', msg); break;
      case 'trade:exec': this.bus.emit('net:tradeExec', msg); break;
      case 'trade:final': this.bus.emit('net:tradeFinal', msg); break;
      case 'trade:end': this.bus.emit('net:tradeEnd', msg); break;
      case 'group:invited': this.bus.emit('net:groupInvited', msg); break;
      case 'authResult':
        if (msg.ok) { this.token = msg.token; this.username = msg.username; try { localStorage.setItem('aetheria.session', msg.token); } catch { /* ignoré */ } }
        else if (msg.silent) { try { localStorage.removeItem('aetheria.session'); } catch { /* ignoré */ } }
        this.bus.emit('net:authResult', msg);
        break;
      case 'shop': this.bus.emit('net:shop', msg); break;
      case 'settings': this.bus.emit('net:settings', msg); break;
      case 'shop:msg': this.bus.emit('net:shopMsg', msg); break;
      case 'playerCos': this.bus.emit('net:playerCos', msg); break;
      case 'charsUpdate': this.bus.emit('net:chars', msg); break;
      case 'saveAck': this.bus.emit('net:saveAck', msg); break;
      default: break;
    }
  }

  // Rejoint le monde multijoueur (visible des autres joueurs) avec ce profil.
  // Si le socket n'est pas encore ouvert, le join partira dès la connexion.
  joinWorld(profile) {
    this._joinProfile = profile;
    if (this.connected) this._send({ t: 'join', ...profile });
  }

  // À appeler chaque frame avec dt ; envoie la position au serveur à débit limité.
  tickMove(dt, pos, yaw, anim, hp, maxHp, level, inst = 0) {
    if (!this._joined) return;
    this._moveAcc += dt;
    if (this._moveAcc < MOVE_INTERVAL) return;
    this._moveAcc = 0;
    this._send({ t: 'move', pos: [pos.x, pos.y, pos.z], yaw, anim, hp: Math.round(hp), maxHp: Math.round(maxHp), level, inst: inst | 0 });
  }

  sendChat(channel, text) { this._send({ t: 'chat', channel, text }); }
  sendWhisper(to, text) { this._send({ t: 'whisper', to, text }); }
  requestWho() { this._send({ t: 'who' }); }
  // ---------- Échanges d'objets (V10.9) ----------
  tradeInvite(name, id) { this._send({ t: 'trade:invite', to: name, id }); }
  tradeAccept() { this._send({ t: 'trade:accept' }); }
  tradeDecline() { this._send({ t: 'trade:decline' }); }
  tradeOffer(items) { this._send({ t: 'trade:offer', items }); }
  tradeConfirm() { this._send({ t: 'trade:confirm' }); }
  tradeCancel() { this._send({ t: 'trade:cancel' }); }
  tradeAck(ok) { this._send({ t: 'trade:ack', ok: !!ok }); }
  inviteToGroup(name, id) { this._send({ t: 'group:invite', to: name, id }); }
  acceptGroupInvite() { this._send({ t: 'group:accept' }); }
  leaveGroup() { this._send({ t: 'group:leave' }); }
  kickFromGroup(id) { this._send({ t: 'group:kick', id }); }
  declineGroupInvite() { this._send({ t: 'group:decline' }); }

  // Relais du monde de groupe : k = type, to = 'host' | 'group' | id d'un joueur du groupe
  sendGr(k, to, d) { this._send({ t: 'gr', k, to, d }); }

  // ---------- Amis (V6.0) ----------
  friendMsg(to, text) { this._send({ t: 'friend:msg', to, text }); }
  friendHistory(name) { this._send({ t: 'friend:history', with: name }); }
  friendList() { this._send({ t: 'friend:list' }); }
  friendAdd(name) { this._send({ t: 'friend:add', to: name }); }
  friendAccept(name) { this._send({ t: 'friend:accept', from: name }); }
  friendDecline(name) { this._send({ t: 'friend:decline', from: name }); }
  friendRemove(name) { this._send({ t: 'friend:remove', name }); }

  // ---------- Boutique des Lunes (V10.1) : le serveur valide tout ----------
  saveSettings(s) { this._send({ t: 'settings:save', s }); }
  shopGet() { this._send({ t: 'shop:get' }); }
  shopBuy(id) { this._send({ t: 'shop:buy', id }); }
  shopEquip(slot, id) { this._send({ t: 'shop:equip', slot, id: id || null }); }
  shopDaily() { this._send({ t: 'shop:daily' }); }
  // V10.2 : crée une session de paiement Stripe ; renvoie l'adresse de la page de paiement (le jeu ne touche jamais la carte)
  async startCheckout(pack, consent) {
    const r = await fetch(this.apiBase + '/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: this.token, pack, consent: consent === true }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) throw new Error(j.error || 'Paiement indisponible.');
    return j.url;
  }

  // ---------- Comptes (ÉTAPE 6) ----------
  register(username, password) { this._send({ t: 'register', username, password }); }
  login(username, password) { this._send({ t: 'login', username, password }); }
  logout() { this._send({ t: 'logout' }); this.token = null; this.username = null; try { localStorage.removeItem('aetheria.session'); } catch { /* ignoré */ } }
  get loggedIn() { return !!this.token; }
  saveToServer(data, slot = 0) { if (this.token) this._send({ t: 'save', token: this.token, data, slot }); }
  deleteChar(slot) { if (this.token) this._send({ t: 'delchar', token: this.token, slot }); }
}
