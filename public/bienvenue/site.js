// Site vitrine Korvalune : inscription / connexion reliées au serveur du jeu, état du serveur, téléchargements, nouveautés.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const SESSION_KEY = 'aetheria.session'; // même clé que le jeu : après connexion, le jeu te reconnaît automatiquement
  let mode = 'login';

  // ---- état du serveur (réveil Render possible) ----
  const live = $('live');
  const t0 = Date.now();
  fetch('/healthz', { cache: 'no-store' }).then((r) => r.json()).then((h) => {
    const n = Number(h.players) || 0;
    live.innerHTML = '<b>Serveur en ligne</b>' + (n > 0 ? ` · ${n} joueur${n > 1 ? 's' : ''} connecté${n > 1 ? 's' : ''} en ce moment` : '');
  }).catch(() => { live.textContent = 'Le serveur démarre, réessaie dans un instant.'; });
  setTimeout(() => { if (live.textContent.startsWith('Vérification')) live.textContent = 'Le serveur se réveille, quelques secondes…'; }, 4000);

  // ---- onglets connexion / création ----
  const form = $('authForm'), msg = $('msg'), go = $('go');
  function setMode(m) {
    mode = m;
    $('tabLogin').setAttribute('aria-selected', m === 'login');
    $('tabReg').setAttribute('aria-selected', m === 'reg');
    $('p2wrap').hidden = m === 'login';
    $('forgot').hidden = m !== 'login';
    $('p').autocomplete = m === 'login' ? 'current-password' : 'new-password';
    go.textContent = m === 'login' ? 'Se connecter et jouer' : 'Créer mon compte et jouer';
    show('');
  }
  function show(t, ok) { msg.textContent = t; msg.className = 'msg' + (ok ? ' ok' : ''); }
  $('tabLogin').addEventListener('click', () => setMode('login'));
  $('tabReg').addEventListener('click', () => setMode('reg'));
  document.querySelector('.cta a[href="#compte"]')?.addEventListener('click', () => setMode('reg'));

  // ---- échange avec le serveur du jeu (WebSocket, même adresse) ----
  let busy = false;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) return;
    const u = $('u').value.trim(), p = $('p').value;
    if (u.length < 3) return show('Le nom de compte doit faire au moins 3 caractères.');
    if (!p) return show('Entre ton mot de passe.');
    if (mode === 'reg') {
      if (p.length < 8) return show('Mot de passe trop court (8 caractères minimum).');
      if (p !== $('p2').value) return show('Les deux mots de passe sont différents.');
    }
    busy = true; go.disabled = true; show('Connexion au serveur…', true);
    let ws, done = false;
    const finish = (text, ok) => { done = true; busy = false; go.disabled = false; show(text, ok); try { ws.close(); } catch { /* ignoré */ } };
    const timer = setTimeout(() => { if (!done) finish('Le serveur ne répond pas. S’il dormait, réessaie dans quelques secondes.'); }, 45000);
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host); } catch { clearTimeout(timer); finish('Connexion impossible depuis ce navigateur.'); return; }
    ws.addEventListener('open', () => { show(mode === 'reg' ? 'Création du compte…' : 'Vérification…', true); ws.send(JSON.stringify({ t: mode === 'reg' ? 'register' : 'login', username: u, password: p })); });
    ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t !== 'authResult') return;
      clearTimeout(timer);
      if (m.ok && m.token) {
        try { localStorage.setItem(SESSION_KEY, m.token); } catch { finish('Ton navigateur bloque le stockage : autorise-le pour jouer.'); return; }
        finish('Bienvenue ' + (m.username || u) + ' ! Lancement du jeu…', true);
        setTimeout(() => { location.href = '/'; }, 700);
      } else finish(m.error || 'Échec de la connexion.');
    });
    ws.addEventListener('error', () => { if (!done) { clearTimeout(timer); finish('Le serveur est injoignable pour le moment. Réessaie dans un instant.'); } });
    ws.addEventListener('close', () => { if (!done) { clearTimeout(timer); finish('Connexion interrompue. Réessaie.'); } });
  });

  // ---- téléchargements : grisés si le fichier n'est pas publié ----
  for (const id of ['dl-apk', 'dl-win']) {
    const a = $(id); if (!a) continue;
    fetch(a.getAttribute('href'), { method: 'HEAD' }).then((r) => {
      const ok = r.ok && !/text\/html/i.test(r.headers.get('content-type') || '');
      if (!ok) { a.classList.add('off'); a.removeAttribute('href'); a.nextElementSibling.textContent = 'Bientôt disponible'; }
      else { const n = Number(r.headers.get('content-length')); if (n > 100000) a.nextElementSibling.textContent = (n / 1048576).toFixed(1).replace('.', ',') + ' Mo'; }
    }).catch(() => {});
  }

  // ---- nouveautés ----
  fetch('/bienvenue/news.json').then((r) => r.json()).then((list) => {
    const box = $('news'); box.textContent = '';
    for (const n of list) {
      const art = document.createElement('article');
      const h = document.createElement('h3'); h.textContent = n.title; const v = document.createElement('span'); v.textContent = 'version ' + n.version; h.appendChild(v);
      const ul = document.createElement('ul');
      for (const it of n.items) { const li = document.createElement('li'); li.textContent = it; ul.appendChild(li); }
      art.append(h, ul); box.appendChild(art);
    }
  }).catch(() => { $('news').textContent = ''; });

  // ---- partage ----
  const url = location.origin + '/bienvenue/';
  const text = 'Je joue à Korvalune, un jeu d’aventure fantasy gratuit. Rejoins-moi !';
  $('sh-wa').href = 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url);
  $('sh-fb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
  $('sh-x').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
  $('sh-copy').addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(url); e.target.textContent = 'Lien copié ✓'; } catch { e.target.textContent = url; }
  });
})();
