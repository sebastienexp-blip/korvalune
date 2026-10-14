const $=id=>document.getElementById(id);let ws,tab='dons',qT;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S=o=>ws.send(JSON.stringify(o));
function connect(){
 ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);
 ws.onopen=()=>S({t:'login',username:$('u').value.trim(),password:$('p').value});
 ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.t==='authResult'){ if(!m.ok){$('msg').textContent=m.error||'Connexion refusée.';return}
   $('login').classList.add('hidden');$('app').classList.remove('hidden');$('msg').textContent='Connecté.';S({t:'shop:donAdmin'});}
  else if(m.t==='shop:donList')renderDons(m.list);
  else if(m.t==='adm:list')renderAccounts(m);
  else if(m.t==='adm:row'){const el=document.querySelector(`[data-acc="${CSS.escape(m.row.name)}"]`);if(el)el.outerHTML=accRow(m.row)}
  else if(m.t==='adm:log')renderLog(m.list);
  else if((m.t==='shop:msg'||m.t==='adm:res')&&m.text)$('msg').textContent=m.text;};
 ws.onclose=()=>{$('msg').textContent+=' (connexion fermée)'};
}
function renderDons(list){
 $('dons').innerHTML=list.length?list.map(d=>`<div class="row"><b>${esc(d.amount)} €</b> — compte <b>${esc(d.account)}</b> → ${esc(d.lunes)} Lunes<br><small>${esc(d.note||'')} · ${new Date(d.at).toLocaleString('fr-FR')}</small>
 <div class="btns"><button data-do="don" data-ok="1" data-id="${esc(d.id)}" data-a="${esc(d.account)}" data-m="${esc(d.amount)}">Valider</button><button class="no" data-do="don" data-id="${esc(d.id)}" data-a="${esc(d.account)}">Refuser</button></div></div>`).join(''):'<p>Aucun don en attente.</p>';
}
function accRow(r){
 return `<div class="row" data-acc="${esc(r.name)}"><b>${esc(r.name)}</b>${r.online?'<span class="tag good">en ligne</span>':''}${r.banned?`<span class="tag bad">bloqué : ${esc(r.banned)}</span>`:''}${r.recovery?'':'<span class="tag">sans récupération</span>'}
 <br><small>${r.lunes} Lunes · ${r.chars} personnage(s) · créé le ${r.createdAt?new Date(r.createdAt).toLocaleDateString('fr-FR'):'?'}${r.email?' · '+esc(r.email):''}</small>
 <div class="btns"><button class="alt" data-do="reset" data-a="${esc(r.name)}">Nouveau mot de passe</button><button class="alt" data-do="lunes" data-a="${esc(r.name)}">± Lunes</button>
 ${r.banned?`<button class="alt" data-do="unban" data-a="${esc(r.name)}">Débloquer</button>`:`<button class="no" data-do="ban" data-a="${esc(r.name)}">Bloquer</button>`}${r.online?`<button class="alt" data-do="kick" data-a="${esc(r.name)}">Déconnecter</button>`:''}</div></div>`;
}
function renderAccounts(m){
 $('stats').innerHTML=`<p><small>${m.accounts} compte(s) · ${m.onlineAccounts} connecté(s) · ${m.players} joueur(s) dans le monde</small></p>`;
 $('clist').innerHTML=m.list.length?m.list.map(accRow).join('')+(m.total>m.list.length?`<p><small>${m.total-m.list.length} autre(s) : affine la recherche.</small></p>`:''):'<p>Aucun compte trouvé.</p>';
}
function renderLog(l){$('journal').innerHTML=l.length?l.map(x=>`<div class="row"><b>${esc(x.action)}</b> ${esc(x.target)} <small>${esc(x.extra)}<br>${new Date(x.at).toLocaleString('fr-FR')} · ${esc(x.by)}</small></div>`).join(''):'<p>Rien pour l’instant.</p>'}
function show(t){tab=t;for(const id of['dons','comptes','annonce','journal'])$(id).classList.toggle('hidden',id!==t);document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
 if(t==='dons')S({t:'shop:donAdmin'});if(t==='comptes')S({t:'adm:list',q:$('q').value});if(t==='journal')S({t:'adm:log'})}
document.querySelector('nav').onclick=e=>{const b=e.target.closest('button');if(b)show(b.dataset.tab)};
$('q').oninput=()=>{clearTimeout(qT);qT=setTimeout(()=>S({t:'adm:list',q:$('q').value}),250)};
$('annGo').onclick=()=>{const text=$('ann').value.trim();if(text.length<3)return;if(confirm('Envoyer à tous les joueurs connectés ?')){S({t:'adm:announce',text});$('ann').value=''}};
document.addEventListener('click',e=>{const b=e.target.closest('[data-do]');if(!b)return;const a=b.dataset.a,d=b.dataset.do;
 if(d==='don'){const ok=!!b.dataset.ok;if(!confirm(ok?'Tu as bien reçu '+b.dataset.m+' € sur PayPal ?':'Refuser cette demande ?'))return;S({t:'shop:donResolve',id:b.dataset.id,account:a,ok,amount:ok?Number(b.dataset.m):undefined})}
 else if(d==='reset'){if(confirm('Générer un mot de passe temporaire pour '+a+' ? L’ancien ne marchera plus.'))S({t:'adm:reset',account:a})}
 else if(d==='lunes'){const v=prompt('Lunes à ajouter à '+a+' (négatif pour retirer) :','100');if(v&&Number(v))S({t:'adm:lunes',account:a,delta:Number(v)})}
 else if(d==='ban'){const r=prompt('Raison du blocage (affichée au joueur) :','');if(r!==null)S({t:'adm:ban',account:a,on:true,reason:r})}
 else if(d==='unban')S({t:'adm:ban',account:a,on:false})
 else if(d==='kick')S({t:'adm:kick',account:a})});
$('go').onclick=connect;$('p').onkeydown=e=>{if(e.key==='Enter')connect()};
