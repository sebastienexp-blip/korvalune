// V10.57 — fenêtres « Mot de passe oublié » et « Sécurité du compte » (question secrète, code de secours, e-mail, mot de passe).
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class AccountSecurity {
  constructor(root, net, bus) {
    this.net = net; this.bus = bus;
    this.el = document.createElement('div');
    this.el.className = 'sec-modal hidden';
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => this._click(e));
    bus.on('net:acct', (m) => this._onMsg(m));
    bus.on('net:shopMsg', (m) => this._onMsg({ ...m, t: 'shop:msg' }));
  }
  get open() { return !this.el.classList.contains('hidden'); }
  close() { this.el.classList.add('hidden'); this.el.innerHTML = ''; this.mode = null; }
  _show(html) { this.el.innerHTML = `<div class="sec-card">${html}</div>`; this.el.classList.remove('hidden'); }
  _msg(text, ok) { const p = this.el.querySelector('.sec-msg'); if (p) { p.textContent = text || ''; p.classList.toggle('ok', !!ok); } }
  v(id) { return (this.el.querySelector('#' + id)?.value || '').trim(); }

  // ----- Mot de passe oublié -----
  openRecover(username = '') {
    this.mode = 'recover'; this.info = null;
    this._show(`<h3>Mot de passe oublié</h3>
      <p class="sec-hint">Entre ton identifiant : on te demandera ta question secrète ou ton code de secours.</p>
      <input id="sec-user" maxlength="20" placeholder="Identifiant" value="${esc(username)}" autocomplete="username">
      <p class="sec-msg"></p>
      <div class="sec-btns"><button class="btn-primary" data-s="rec-info">Continuer</button><button data-s="close">Annuler</button></div>`);
  }
  _recoverForm(m) {
    this.info = m;
    if (!m.hasQuestion && !m.hasCode) {
      this._show(`<h3>Mot de passe oublié</h3><p class="sec-hint">Aucune récupération n’est configurée pour ce compte (ou il n’existe pas).<br>Contacte le créateur du jeu pour qu’il te donne un mot de passe temporaire.</p><div class="sec-btns"><button data-s="close">Fermer</button></div>`);
      return;
    }
    const opts = [m.hasQuestion ? '<option value="question">Ma question secrète</option>' : '', m.hasCode ? '<option value="code">Mon code de secours</option>' : ''].join('');
    this._show(`<h3>Récupérer « ${esc(m.username)} »</h3>
      <select id="sec-method">${opts}</select>
      <p class="sec-hint" id="sec-q"></p>
      <input id="sec-secret" maxlength="60" placeholder="Ta réponse" autocomplete="off">
      <input id="sec-new" type="password" maxlength="64" placeholder="Nouveau mot de passe (8 caractères min.)" autocomplete="new-password">
      <p class="sec-msg"></p>
      <div class="sec-btns"><button class="btn-primary" data-s="rec-go">Changer le mot de passe</button><button data-s="close">Annuler</button></div>`);
    const upd = () => { const q = this.el.querySelector('#sec-q'); const code = this.v('sec-method') === 'code'; q.textContent = code ? 'Code de secours (format XXXX-XXXX-XXXX)' : m.question; this.el.querySelector('#sec-secret').placeholder = code ? 'XXXX-XXXX-XXXX' : 'Ta réponse'; };
    this.el.querySelector('#sec-method').addEventListener('change', upd); upd();
  }

  // ----- Code cadeau -----
  openCode() {
    this.mode = 'code';
    this._show(`<h3>🎟️ Entrer un code</h3><p class="sec-hint">Un code reçu de l’équipe (Discord, événement) ? Entre-le ici : tickets double XP / butin ×2, Lunes… Chaque code ne sert qu’une seule fois. Il faut être connecté à ton compte.</p>
      <input id="sec-gift" maxlength="24" placeholder="KORV-XXXX-XXXX-XXXX" autocomplete="off" style="text-transform:uppercase">
      <p class="sec-msg"></p><div class="sec-btns"><button class="btn-primary" data-s="gift-go">Valider</button><button data-s="close">Fermer</button></div>`);
  }

  // ----- Contacter l'administrateur -----
  openSupport() {
    this.mode = 'support'; this._show('<h3>Contacter l’administrateur</h3><p class="sec-hint">Chargement…</p>');
    this.net.sendRaw({ t: 'support:get' });
  }
  _supportForm(m) {
    const fmt = (t) => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const thread = (m.msgs || []).map((x) => `<div class="sup-m ${x.me ? 'me' : 'adm'}"><small>${x.me ? 'Toi' : 'Administrateur'} · ${fmt(x.at)}</small><br>${esc(x.text)}</div>`).join('') || '<p class="sec-hint">Pose ta question, signale un problème ou un bug : l’administrateur te répondra ici.</p>';
    const prev = this.el.querySelector('#sup-text')?.value || '';
    this._show(`<h3>Contacter l’administrateur</h3><div class="sup-thread">${thread}</div>
      <textarea id="sup-text" maxlength="600" rows="3" placeholder="Ton message…">${esc(prev)}</textarea>
      <p class="sec-msg"></p>
      <div class="sec-btns"><button class="btn-primary" data-s="sup-send">Envoyer</button><button data-s="close">Fermer</button></div>`);
    const th = this.el.querySelector('.sup-thread'); th.scrollTop = th.scrollHeight;
  }

  // ----- Sécurité du compte (connecté) -----
  openSecurity() {
    this.mode = 'security'; this._show('<h3>Sécurité du compte</h3><p class="sec-hint">Chargement…</p>');
    this.net.sendRaw({ t: 'acct:secInfo' });
  }
  _secForm(m) {
    this.sec = m;
    const qs = (m.questions || []).map((q) => `<option ${q === m.question ? 'selected' : ''}>${esc(q)}</option>`).join('');
    this._show(`<h3>Sécurité du compte</h3>
      <p class="sec-hint">Si tu oublies ton mot de passe, ta question secrète ou ton code de secours te permettront de le changer toi-même. ${m.hasQuestion ? '✅ Question secrète définie.' : '⚠️ Aucune question secrète.'} ${m.hasCode ? '✅ Code de secours actif.' : '⚠️ Pas de code de secours.'}</p>
      <label>Question secrète</label><select id="sec-qsel">${qs}</select>
      <input id="sec-ans" maxlength="60" placeholder="${m.hasQuestion ? 'Nouvelle réponse (laisser vide = inchangée)' : 'Ta réponse'}" autocomplete="off">
      <label>E-mail de contact (facultatif${m.email ? ' — actuel : ' + esc(m.email) : ''})</label><input id="sec-mail" maxlength="120" placeholder="exemple@mail.fr" autocomplete="email">
      <label>Mot de passe actuel (pour valider)</label><input id="sec-pw" type="password" maxlength="64" autocomplete="current-password">
      <p class="sec-msg"></p>
      <div class="sec-btns"><button class="btn-primary" data-s="sec-save">Enregistrer</button><button data-s="sec-code">Générer un code de secours</button></div>
      <details><summary>Changer mon mot de passe</summary>
        <input id="sec-pw2" type="password" maxlength="64" placeholder="Nouveau mot de passe (8 caractères min.)" autocomplete="new-password">
        <button data-s="sec-pass">Changer (utilise le mot de passe actuel ci-dessus)</button></details>
      <div class="sec-btns"><button data-s="close">Fermer</button></div>`);
  }

  _click(e) {
    const b = e.target.closest('[data-s]'); if (!b) { if (e.target === this.el) this.close(); return; }
    const a = b.dataset.s;
    if (a === 'close') return this.close();
    if (a === 'rec-info') { const u = this.v('sec-user'); if (u.length < 3) return this._msg('Entre ton identifiant.'); this._user = u; this.net.sendRaw({ t: 'acct:recoverInfo', username: u }); return; }
    if (a === 'rec-go') {
      const secret = this.v('sec-secret'), np = this.v('sec-new');
      if (!secret || !np) return this._msg('Remplis les deux champs.');
      if (np.length < 8) return this._msg('Mot de passe trop court (8 caractères minimum).');
      this.net.sendRaw({ t: 'acct:recover', username: this.info.username, method: this.v('sec-method'), secret, newPassword: np }); return;
    }
    if (a === 'gift-go') { const c = this.v('sec-gift'); if (c.length < 4) return this._msg('Entre ton code.'); this._msg('Vérification…', true); this.net.sendRaw({ t: 'shop:code', code: c }); return; }
    if (a === 'sup-send') { const t = (this.el.querySelector('#sup-text')?.value || '').trim(); if (t.length < 2) return this._msg('Écris ton message.'); this.net.sendRaw({ t: 'support:send', text: t }); return; }
    if (a === 'sec-save') {
      const pw = this.v('sec-pw'); if (!pw) return this._msg('Entre ton mot de passe actuel.');
      const o = { t: 'acct:secSet', password: pw, question: this.v('sec-qsel'), answer: this.v('sec-ans'), email: this.v('sec-mail') };
      if (!o.email) delete o.email;
      this.net.sendRaw(o); return;
    }
    if (a === 'sec-code') { const pw = this.v('sec-pw'); if (!pw) return this._msg('Entre ton mot de passe actuel.'); this.net.sendRaw({ t: 'acct:genCode', password: pw }); return; }
    if (a === 'sec-pass') {
      const pw = this.v('sec-pw'), np = this.v('sec-pw2');
      if (!pw) return this._msg('Entre ton mot de passe actuel.');
      if (np.length < 8) return this._msg('Nouveau mot de passe trop court (8 caractères minimum).');
      this.net.sendRaw({ t: 'acct:passChange', password: pw, newPassword: np });
    }
  }

  _onMsg(m) {
    if (!this.open) return;
    if (m.t === 'acct:recoverInfo' && this.mode === 'recover') this._recoverForm(m);
    else if (m.t === 'acct:recoverResult') {
      if (m.ok) this._show(`<h3>C’est fait ✅</h3><p class="sec-hint">${esc(m.text)}</p><div class="sec-btns"><button class="btn-primary" data-s="close">Me connecter</button></div>`);
      else this._msg(m.text);
    } else if (m.t === 'acct:sec' && this.mode === 'security') { const keep = this.el.querySelector('.sec-msg')?.textContent; if (!this.el.querySelector('.sec-code')) this._secForm(m); else this.sec = m; if (keep) this._msg(keep, true); }
    else if (m.t === 'acct:code') {
      this._show(`<h3>Ton code de secours</h3><p class="sec-code">${esc(m.code)}</p><p class="sec-hint">Note-le (papier, capture d’écran) : il ne sera <b>plus jamais affiché</b>. Il sert une seule fois à changer ton mot de passe. Un nouveau code remplace l’ancien.</p><div class="sec-btns"><button class="btn-primary" data-s="sec-back">J’ai noté mon code</button></div>`);
      this.el.querySelector('[data-s="sec-back"]').onclick = () => this.openSecurity();
    } else if (m.t === 'acct:msg') this._msg(m.text, m.ok);
    else if (m.t === 'support' && this.mode === 'support') {
      const keep = this.el.querySelector('.sec-msg')?.textContent || ''; const sent = keep.startsWith('Message envoy');
      if (sent) { const ta = this.el.querySelector('#sup-text'); if (ta) ta.value = ''; }
      this._supportForm(m); if (sent) this._msg(keep, true);
    } else if (m.t === 'support:msg' && this.mode === 'support') this._msg(m.text, m.ok);
    else if (m.t === 'shop:msg' && this.mode === 'code') { this._msg(m.text, m.ok); if (m.ok) { const i = this.el.querySelector('#sec-gift'); if (i) i.value = ''; } }
  }
}
