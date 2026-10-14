const $=id=>document.getElementById(id);let ws,tries=0;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function connect(){
 ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);
 ws.onopen=()=>ws.send(JSON.stringify({t:'login',username:$('u').value.trim(),password:$('p').value}));
 ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.t==='authResult'){ if(!m.ok){$('msg').textContent=m.error||'Connexion refusée.';return}
   $('login').style.display='none';$('msg').textContent='Connecté.';ws.send(JSON.stringify({t:'shop:donAdmin'}));}
  if(m.t==='shop:donList')render(m.list);
  if(m.t==='shop:msg'&&m.text)$('msg').textContent=m.text;};
 ws.onclose=()=>{$('msg').textContent+=' (connexion fermée)'};
}
function render(list){
 $('list').innerHTML=list.length?list.map(d=>`<div class="row"><b>${esc(d.amount)} €</b> — compte <b>${esc(d.account)}</b> → ${esc(d.lunes)} Lunes<br><small>${esc(d.note||'')} · ${new Date(d.at).toLocaleString('fr-FR')}</small>
 <div class="btns"><button data-ok="1" data-id="${esc(d.id)}" data-a="${esc(d.account)}" data-m="${esc(d.amount)}">Valider</button><button class="no" data-id="${esc(d.id)}" data-a="${esc(d.account)}">Refuser</button></div></div>`).join(''):'<p>Aucun don en attente.</p>';
}
$('list').onclick=e=>{const b=e.target.closest('button');if(!b)return;const ok=!!b.dataset.ok;
 if(!confirm(ok?'Tu as bien reçu '+b.dataset.m+' € sur PayPal ?':'Refuser cette demande ?'))return;
 ws.send(JSON.stringify({t:'shop:donResolve',id:b.dataset.id,account:b.dataset.a,ok,amount:ok?Number(b.dataset.m):undefined}));};
$('go').onclick=connect;$('p').onkeydown=e=>{if(e.key==='Enter')connect()};
