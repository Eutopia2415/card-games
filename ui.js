let state,selected=new Set(),busy=false,locked=false,controls;
const $=id=>document.getElementById(id);
const label=c=>(c[0]==='T'?'10':c[0])+({C:'♣',D:'♦',H:'♥',S:'♠'})[c[1]];
function card(c,interactive=false){
  const el=document.createElement(interactive?'button':'div');
  el.className='card'+('DH'.includes(c[1])?' red':'')+(selected.has(c)&&interactive?' selected':'');
  el.setAttribute('aria-label',label(c));el.innerHTML=`${c[0]==='T'?'10':c[0]}<span class="suit">${label(c).slice(-1)}</span><span class="corner">${label(c)}</span>`;
  if(interactive){el.setAttribute('aria-pressed',selected.has(c));el.disabled=locked||busy||state.turn!==state.player||!['play','return','villager'].includes(state.phase);el.onclick=()=>{selected.has(c)?selected.delete(c):selected.add(c);render();};}
  return el;
}
export function showError(message){$('error').textContent=message||'';busy=false;render();}
export function setLocked(value){locked=value;render();}
export function setBusy(value){busy=value;render();}
export function setState(v){
  if(!v||!Array.isArray(v.hand)||!v.hand.every(c=>/^[789TJQKA][CDHS]$/.test(c))||!Array.isArray(v.names)||v.names.length!==3||!Array.isArray(v.counts)||v.counts.length!==3||!Number.isInteger(v.player)||v.player<0||v.player>2)throw Error('Invalid game update.');
  if(!state||v.revision!==state.revision||v.player!==state.player)selected.clear();
  state=v;busy=false;render();
}
export function lobbyState(info,player){setState({phase:'lobby',turn:0,round:1,roles:null,scores:[0,0,0],top:null,hand:[],counts:[0,0,0],names:info.names,humans:info.humans,player,log:[],exposed:[],bombs:[],finished:[],revision:-1});}
function render(){
  if(!state)return;
  const names=state.names,own=state.turn===state.player;
  const opponents=[0,1,2].filter(p=>p!==state.player);
  opponents.forEach((p,i)=>{
    const el=$(i===0?'leo':'mira');const h=document.createElement('h2');h.textContent=names[p]+(state.turn===p&&!['done','lobby'].includes(state.phase)?' · playing':'');
    const meta=document.createElement('div');meta.className='metadata';meta.textContent=state.counts[p]+' cards'+(state.roles?' · '+state.roles[p]:'')+(state.humans.includes(p)?'':' · bot');
    const backs=document.createElement('div');backs.className='backs';backs.setAttribute('aria-hidden','true');
    for(let n=0;n<state.counts[p];n++){const back=document.createElement('span');back.className='back';backs.append(back);}el.replaceChildren(h,meta,backs);
  });
  $('hand').replaceChildren(...state.hand.map(c=>card(c,true)));$('pile').replaceChildren(...(state.top||[]).map(c=>card(c)));
  if(!state.top){const t=document.createElement('span');t.className='empty';t.textContent=state.phase==='play'?'Table is clear':state.phase==='lobby'?'Waiting for players':'Round '+state.round;$('pile').append(t);}
  $('role').textContent=state.roles?'· '+state.roles[state.player]:'';$('count').textContent=state.counts[state.player]+' cards · Round '+state.round;
  $('bombs').textContent=state.bombs.length?'Four of a kind in your hand: '+state.bombs.join(', '):'';
  const playing=state.phase==='play',done=state.phase==='done',lobby=state.phase==='lobby';
  $('status').textContent=lobby?'Invite your friends':done?'Round complete':playing?(own?'Your turn':names[state.turn]+'’s turn'):(names[state.turn]+' · exchange');
  $('instruction').textContent=lobby?'The host starts when everyone is ready. Empty seats can play as bots.':done?'Points accumulate across rounds.':playing?(state.top?'':'Lead a single, pair, triple or bomb.'):state.phase==='questions'?`King’s rank questions · ${state.questions} of 3 used`:state.phase==='return'?`Return ${state.received} card(s) to the Peasant.`:'Choose any two cards to set aside, including the drawn cards.';
  $('play').hidden=done||lobby||state.phase==='questions';$('play').textContent=playing?'Play cards':state.phase==='villager'?'Discard cards':'Return cards';$('play').disabled=locked||busy||!own||selected.size===0;
  $('pass').hidden=!playing;$('pass').disabled=locked||busy||!own||!state.top;
  $('next').hidden=!done;$('next').disabled=locked||busy||state.player!==0;
  $('new').disabled=locked||busy||state.player!==0||lobby;
  $('ranks').replaceChildren();
  if(state.phase==='questions'&&own)for(const r of '789TJQKA'){const b=document.createElement('button');b.textContent=r==='T'?'10':r;b.disabled=locked||busy;b.onclick=()=>controls.action('ask',{rank:r});$('ranks').append(b);}
  $('results').replaceChildren();if(done){const result=document.createElement('div');result.textContent=names.map((n,i)=>`${n}: ${state.roles[i]} · ${state.scores[i]} points`).join(' / ');$('results').append(result);}
  $('log').replaceChildren(...state.log.slice().reverse().map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  if(state.exposed.length){const li=document.createElement('li');li.textContent='Set aside: '+state.exposed.map(label).join(', ');$('log').prepend(li);}
}
export function initUI(callbacks){
  controls=callbacks;
  $('play').onclick=()=>controls.action(state.phase==='play'?'play':'return',{cards:[...selected]});
  $('pass').onclick=()=>controls.action('pass');$('next').onclick=()=>controls.action('next');
  $('new').onclick=()=>{if(confirm('Start a new game and reset the round scores?'))controls.action('new');};
  $('rules').onclick=()=>$('rules-dialog').showModal();$('close-rules').onclick=()=>$('rules-dialog').close();
}
