const $=id=>document.getElementById(id);let ws,tab='dons',qT;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S=o=>ws.send(JSON.stringify(o));
function connect(){
 ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);
 ws.onopen=()=>S({t:'login',username:$('u').value.trim(),password:$('p').value});
 ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.t==='authResult'){ if(!m.ok){$('msg').textContent=m.error||'Connexion refusée.';return}
   $('login').classList.add('hidden');$('app').classList.remove('hidden');$('msg').textContent='Connecté.';S({t:'shop:donAdmin'});S({t:'adm:inbox'});S({t:'adm:state'});}
  else if(m.t==='shop:donList')renderDons(m.list);
  else if(m.t==='adm:list')renderAccounts(m);
  else if(m.t==='adm:row'){const el=document.querySelector(`[data-acc="${CSS.escape(m.row.name)}"]`);if(el)el.outerHTML=accRow(m.row)}
  else if(m.t==='adm:log')renderLog(m.list);
  else if(m.t==='adm:inbox')renderInbox(m);
  else if(m.t==='adm:state')renderState(m);
  else if(m.t==='adm:online')renderOnline(m.list);
  else if(m.t==='adm:codes')renderCodes(m.list);
  else if(m.t==='adm:thread')renderThread(m);
  else if((m.t==='shop:msg'||m.t==='adm:res')&&m.text){$('msg').textContent=m.text;if(m.t==='adm:res'&&tab==='joueurs')setTimeout(()=>S({t:'adm:online'}),400)}};
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
let cur=null;
const dur=s=>{const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?h+' h '+m+' min':m+' min'};
function renderState(m){
 if(m.enemies&&!$('senemy').options.length)$('senemy').innerHTML=m.enemies.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}${e.boss?' 👑':''} (${esc(e.id)})</option>`).join('');
 $('stats2').innerHTML=`<small>${m.accounts} comptes · ${m.online} connectés · ${m.players} joueurs dans le monde<br>Serveur démarré depuis ${dur(m.uptime)} · mémoire ${m.memMb} Mo</small>`;
 $('maintState').textContent=m.maint.on?'🔴 ACTIVÉE — '+(m.maint.text||''):'🟢 Désactivée';
 $('boostState').textContent=m.boost?` — en cours : XP ×${m.boost.xp}, butin ×${m.boost.drop}, jusqu’à ${new Date(m.boost.until).toLocaleTimeString('fr-FR')}`:' — aucun en cours';
 if(document.activeElement!==$('motd'))$('motd').value=m.motd||'';
}
function renderOnline(l){
 $('olist').innerHTML=l.length?l.map(p=>`<div class="row"><b>${esc(p.name)}</b> <small>compte ${esc(p.account||'(invité)')} · niv. ${p.level}${p.muted?' · 🔇 muet':''}</small>
 ${p.account?`<div class="btns"><button class="alt" data-do="whisper" data-a="${esc(p.account)}">Message</button><button class="alt" data-do="mute" data-a="${esc(p.account)}">${p.muted?'Rendre la parole':'Faire taire'}</button><button class="alt" data-do="kick" data-a="${esc(p.account)}">Déconnecter</button><button class="alt" data-do="spawnOn" data-a="${esc(p.account)}">Invasion ici</button></div>`:''}</div>`).join(''):'<p>Personne dans le monde en ce moment.</p>';
}
function renderCodes(l){
 $('clistc').innerHTML=l.length?l.map(c=>`<div class="row"><b>${esc(c.code)}</b>${c.off?'<span class="tag bad">désactivé</span>':''}<br><small>${c.lunes} Lunes · ${c.used}/${c.max} utilisations${c.until?' · expire le '+new Date(c.until).toLocaleDateString('fr-FR'):''}</small>${c.off?'':`<div class="btns"><button class="no" data-do="codeOff" data-a="${esc(c.code)}">Désactiver</button></div>`}</div>`).join(''):'<p>Aucun code pour l’instant.</p>';
}
function renderInbox(m){
 $('tabMsg').textContent=m.waiting?`Messages (${m.waiting})`:'Messages';
 $('inbox').innerHTML=m.list.length?m.list.map(r=>`<div class="row" data-do="open" data-a="${esc(r.name)}" style="cursor:pointer"><b>${esc(r.name)}</b>${r.waiting?'<span class="tag new">à répondre</span>':''}<br><small>${esc(r.last)} · ${new Date(r.at).toLocaleString('fr-FR')}</small></div>`).join(''):'<p>Aucun message pour l’instant.</p>';
}
function renderThread(m){
 cur=m.account;
 $('thread').innerHTML=`<div class="row"><b>Conversation avec ${esc(m.account)}</b>${m.msgs.map(x=>`<div class="bub ${x.admin?'adm':''}"><small>${x.admin?'Toi':esc(m.account)} · ${new Date(x.at).toLocaleString('fr-FR')}</small><br>${esc(x.text)}</div>`).join('')}
 <textarea id="rtext" rows="3" maxlength="600" placeholder="Ta réponse…"></textarea><button id="rsend" style="width:100%">Répondre</button></div>`;
 $('rsend').onclick=()=>{const t=$('rtext').value.trim();if(t.length>=2)S({t:'adm:reply',account:cur,text:t}),setTimeout(()=>S({t:'adm:inbox'}),400)};
 $('thread').scrollIntoView({behavior:'smooth'});
}
function renderLog(l){$('journal').innerHTML=l.length?l.map(x=>`<div class="row"><b>${esc(x.action)}</b> ${esc(x.target)} <small>${esc(x.extra)}<br>${new Date(x.at).toLocaleString('fr-FR')} · ${esc(x.by)}</small></div>`).join(''):'<p>Rien pour l’instant.</p>'}
function show(t){tab=t;for(const id of['dons','messages','comptes','joueurs','events','codes','reglages','journal'])$(id).classList.toggle('hidden',id!==t);document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
 if(t==='dons')S({t:'shop:donAdmin'});if(t==='comptes')S({t:'adm:list',q:$('q').value});if(t==='journal')S({t:'adm:log'});if(t==='messages')S({t:'adm:inbox'});if(t==='joueurs')S({t:'adm:online'});if(t==='codes')S({t:'adm:codes'});if(t==='events'||t==='reglages')S({t:'adm:state'})}
document.querySelector('nav').onclick=e=>{const b=e.target.closest('button');if(b)show(b.dataset.tab)};
$('q').oninput=()=>{clearTimeout(qT);qT=setTimeout(()=>S({t:'adm:list',q:$('q').value}),250)};
$('bGo').onclick=()=>S({t:'adm:boost',xp:$('bxp').value,drop:$('bdrop').value,minutes:$('bmin').value,label:$('blabel').value});
$('bOff').onclick=()=>S({t:'adm:boost',off:true});
$('sGo').onclick=()=>{if(confirm('Lancer l’invasion ?'))S({t:'adm:spawn',enemy:$('senemy').value,count:Number($('scount').value),boss:!!$('sboss').value,target:$('starget').value.trim()||'*',label:$('slabel').value})};
$('gGo').onclick=()=>{if(confirm('Offrir '+$('glunes').value+' Lunes à tous les joueurs connectés ?'))S({t:'adm:giftAll',lunes:Number($('glunes').value),text:$('gtext').value})};
$('cGo').onclick=()=>S({t:'adm:codeNew',code:$('ccode').value,lunes:Number($('clunes').value),uses:Number($('cuses').value),days:Number($('cdays').value)});
$('mOn').onclick=()=>{if(confirm('Activer la maintenance ? Plus personne (sauf toi) ne pourra se connecter.'))S({t:'adm:maint',on:true,text:$('mtext').value})};
$('mOff').onclick=()=>S({t:'adm:maint',on:false});
$('motdGo').onclick=()=>S({t:'adm:motd',text:$('motd').value});$('motdOff').onclick=()=>{$('motd').value='';S({t:'adm:motd',text:''})};
$('annGo').onclick=()=>{const text=$('ann').value.trim();if(text.length<3)return;if(confirm('Envoyer à tous les joueurs connectés ?')){S({t:'adm:announce',text,secs:Number($('annsecs').value)});$('ann').value=''}};
document.addEventListener('click',e=>{const b=e.target.closest('[data-do]');if(!b)return;const a=b.dataset.a,d=b.dataset.do;
 if(d==='open'){S({t:'adm:thread',account:a});return}
 if(d==='don'){const ok=!!b.dataset.ok;if(!confirm(ok?'Tu as bien reçu '+b.dataset.m+' € sur PayPal ?':'Refuser cette demande ?'))return;S({t:'shop:donResolve',id:b.dataset.id,account:a,ok,amount:ok?Number(b.dataset.m):undefined})}
 else if(d==='reset'){if(confirm('Générer un mot de passe temporaire pour '+a+' ? L’ancien ne marchera plus.'))S({t:'adm:reset',account:a})}
 else if(d==='lunes'){const v=prompt('Lunes à ajouter à '+a+' (négatif pour retirer) :','100');if(v&&Number(v))S({t:'adm:lunes',account:a,delta:Number(v)})}
 else if(d==='ban'){const r=prompt('Raison du blocage (affichée au joueur) :','');if(r!==null)S({t:'adm:ban',account:a,on:true,reason:r})}
 else if(d==='unban')S({t:'adm:ban',account:a,on:false})
 else if(d==='kick')S({t:'adm:kick',account:a})
 else if(d==='whisper'){const t=prompt('Message privé à '+a+' :');if(t)S({t:'adm:whisper',account:a,text:t})}
 else if(d==='mute'){const v=prompt('Durée du silence en minutes pour '+a+' (0 = rendre la parole) :','30');if(v!==null)S({t:'adm:mute',account:a,minutes:Number(v)})}
 else if(d==='spawnOn'){$('starget').value=a;show('events');window.scrollTo(0,0)}
 else if(d==='codeOff'){if(confirm('Désactiver le code '+a+' ?'))S({t:'adm:codeOff',code:a})}});
$('go').onclick=connect;$('p').onkeydown=e=>{if(e.key==='Enter')connect()};
