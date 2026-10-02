import {friendlyError} from './messages.js?v=midnight-v1';
import {captureTable,animateUpdate,cancelMotion} from './motion.js?v=midnight-v1';
let state,selected=new Set(),busy=false,locked=false,animating=false,controls,motionUntil=0,animationSerial=0;
const $=id=>document.getElementById(id);
const label=c=>(c[0]==='T'?'10':c[0])+({C:'♣',D:'♦',H:'♥',S:'♠'})[c[1]];
const suit=c=>({C:'club',D:'diamond',H:'heart',S:'spade'})[c[1]];
function card(c,interactive=false){
  const el=document.createElement(interactive?'button':'div');el.className='card'+('DH'.includes(c[1])?' red':'');el.dataset.card=c;el.setAttribute('aria-label',label(c));
  if(interactive)el.type='button';
  const rank=document.createElement('span');rank.className='rank';rank.textContent=c[0]==='T'?'10':c[0];
  const icon=document.createElement('img');icon.src='assets/icons/'+suit(c)+'.svg';icon.alt='';icon.className='suit';icon.width=51;icon.height=51;
  const corner=document.createElement('span');corner.className='corner';const small=icon.cloneNode();small.className='';corner.append(small,rank.textContent);el.append(rank,icon,corner);
  if(interactive)el.onclick=()=>{selected.has(c)?selected.delete(c):selected.add(c);showError('');render();};return el;
}
function fan(parent,codes){
  const existing=new Map([...parent.children].map(n=>[n.dataset.card,n]));
  const nodes=codes.map(c=>{let node=existing.get(c);if(!node){node=document.createElement('div');node.className='fan-slot';node.dataset.card=c;node.append(card(c,true));}const button=node.firstElementChild;button.classList.toggle('selected',selected.has(c));button.setAttribute('aria-pressed',selected.has(c));return node;});
  const focused=parent.contains(document.activeElement)?document.activeElement:null;parent.replaceChildren(...nodes);if(focused?.isConnected)focused.focus({preventScroll:true});layoutFan(parent,false);
}
function layoutFan(parent,backs){
  const n=parent.children.length;if(!n)return;const cardWidth=parent.lastElementChild.firstElementChild.offsetWidth;
  const available=parent.clientWidth-(backs?0:24);const step=Math.min(backs?38:100,Math.max(12,(available-cardWidth)/Math.max(1,n-1)));parent.style.setProperty('--fan-step',step+'px');
  const compact=matchMedia('(max-width:700px)').matches;
  [...parent.children].forEach((node,i)=>{const offset=i-(n-1)/2,fraction=offset/Math.max(1,(n-1)/2);node.style.setProperty('--tilt',(backs?offset*1.5:fraction*(compact?6:10))+'deg');node.style.setProperty('--rise',(backs?offset*offset*.45:fraction*fraction*(compact?12:28))+'px');node.style.zIndex=i+1;});
}
export const animationDelay=()=>Math.max(0,motionUntil-performance.now());
export function showError(message,context){$('error').textContent=friendlyError(message);$('feedback').hidden=!message;$('connection').hidden=!!message;$('retry').hidden=!message||context!=='bot';busy=false;renderControls();}
export function setLocked(value){locked=value;renderControls();}
export function setBusy(value){busy=value;renderControls();}
export function setState(v){
  if(!v||!Array.isArray(v.hand)||!v.hand.every(c=>/^[789TJQKA][CDHS]$/.test(c))||!Array.isArray(v.names)||v.names.length!==3||!Array.isArray(v.counts)||v.counts.length!==3||!Number.isInteger(v.player)||v.player<0||v.player>2)throw Error('Invalid game update.');
  const changed=!state||v.revision!==state.revision||v.player!==state.player,previous=state,before=captureTable(state);
  if(changed){selected.clear();cancelMotion();animationSerial++;animating=false;motionUntil=0;}state=v;busy=false;render();
  if(changed&&v.phase!=='lobby'){const serial=animationSerial,motion=animateUpdate(previous,v,before,card);animating=motion.duration>0;motionUntil=performance.now()+motion.duration;renderControls();motion.finished.finally(()=>{if(serial===animationSerial){animating=false;motionUntil=0;renderControls();}});}
}
export function lobbyState(info,player){setState({phase:'lobby',turn:0,round:1,roles:null,scores:[0,0,0],top:null,hand:[],counts:[0,0,0],names:info.names,humans:info.humans,player,log:[],exposed:[],bombs:[],finished:[],revision:-1,events:[]});}
function renderControls(){
  if(!state)return;const own=state.turn===state.player,playing=state.phase==='play',done=state.phase==='done',lobby=state.phase==='lobby',disabled=locked||busy||animating;
  for(const c of $('hand').querySelectorAll('button'))c.disabled=disabled||!own||!['play','return','villager'].includes(state.phase);
  $('play').hidden=done||lobby||state.phase==='questions';$('play').textContent=playing?'Play cards':state.phase==='villager'?'Set aside':'Return cards';$('play').disabled=disabled||!own||selected.size===0;
  $('pass').hidden=!playing;$('pass').disabled=disabled||!own||!state.top;$('next').hidden=!done;$('next').disabled=disabled||state.player!==0;$('new').disabled=disabled||state.player!==0||lobby;for(const b of $('ranks').children)b.disabled=disabled;
  $('hand').setAttribute('aria-busy',String(busy||animating));$('retry').disabled=busy||animating||locked;
}
function render(){
  if(!state)return;const names=state.names,own=state.turn===state.player,playing=state.phase==='play',done=state.phase==='done',lobby=state.phase==='lobby';
  [0,1,2].filter(p=>p!==state.player).forEach((p,i)=>{
    const el=$(i===0?'leo':'mira');el.dataset.player=p;el.classList.toggle('turn-active',state.turn===p&&!done&&!lobby);el.setAttribute('aria-label',names[p]+(state.turn===p&&!done&&!lobby?' — current turn':''));
    if(!el.firstElementChild){const h=document.createElement('h2'),meta=document.createElement('div'),backs=document.createElement('div');meta.className='metadata';backs.className='backs';backs.setAttribute('aria-hidden','true');el.append(h,meta,backs);}
    el.children[0].textContent=names[p];el.children[1].textContent=state.counts[p]+' cards'+(state.roles?' · '+state.roles[p]:'')+(state.humans.includes(p)?'':' · bot');
    const backs=el.children[2];while(backs.children.length>state.counts[p])backs.lastElementChild.remove();while(backs.children.length<state.counts[p]){const slot=document.createElement('div');slot.className='back-slot';const back=document.createElement('span');back.className='back';slot.append(back);backs.append(slot);}layoutFan(backs,true);
  });
  $('human-seat').dataset.player=state.player;$('human-seat').classList.toggle('turn-active',own&&!done&&!lobby);$('self-name').textContent=names[state.player];fan($('hand'),state.hand);
  const current=[...$('pile').querySelectorAll('.card')].map(n=>n.dataset.card).join();if(current!==(state.top||[]).join()||!$('pile').firstChild){$('pile').replaceChildren(...(state.top||[]).map((c,i)=>{const el=card(c);el.style.setProperty('--tilt',(i-(state.top.length-1)/2)*7+'deg');return el;}));if(!state.top){const t=document.createElement('span');t.className='empty';$('pile').append(t);}}
  if(!state.top)$('pile').firstChild.textContent=playing?'Table is clear':lobby?'Waiting for players':'Round '+state.round;
  $('role').textContent=state.roles?'· '+state.roles[state.player]:'';$('count').textContent=state.counts[state.player]+' cards · Round '+state.round;$('bombs').textContent=state.bombs.length?'Bomb announced: '+state.bombs.map(r=>r==='T'?'10':r).join(', '):'';
  $('status').textContent=lobby?'Invite your friends':done?'Round complete':playing?(own?'Your turn':names[state.turn]+'’s turn'):(names[state.turn]+' · exchange');
  $('instruction').textContent=lobby?'Invite one or two friends. The host starts when you’re ready.':done?'Points accumulate across rounds.':playing?'':state.phase==='questions'?`King’s rank questions · ${state.questions} of 3 used`:state.phase==='return'?`Choose ${state.received} card${state.received===1?'':'s'} to return to the Peasant.`:'Choose any two cards to set aside, including the drawn cards.';
  $('ranks').replaceChildren();if(state.phase==='questions'&&own)for(const r of '789TJQKA'){const b=document.createElement('button');b.textContent=r==='T'?'10':r;b.onclick=()=>controls.action('ask',{rank:r});$('ranks').append(b);}
  $('results').replaceChildren();if(done)for(const p of state.finished){const row=document.createElement('div');row.className='result-row';const name=document.createElement('span');name.textContent=names[p];const score=document.createElement('strong');score.textContent=state.roles[p]+' · '+state.scores[p]+' pts';row.append(name,score);$('results').append(row);}
  $('log').replaceChildren(...state.log.slice().reverse().map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));if(state.exposed.length){const li=document.createElement('li');li.textContent='Set aside: '+state.exposed.map(label).join(', ');$('log').prepend(li);}
  $('game-table').dataset.phase=state.phase;$('game-table').classList.toggle('round-done',done);$('draw-deck').classList.toggle('drawn',state.phase==='villager');$('deck-caption').textContent=lobby?'Draw pile':state.phase==='villager'?'Cards drawn':'2 aside';renderControls();
}
export function initUI(callbacks){
  controls=callbacks;$('play').onclick=()=>controls.action(state.phase==='play'?'play':'return',{cards:[...selected]});$('pass').onclick=()=>controls.action('pass');$('next').onclick=()=>controls.action('next');$('retry').onclick=()=>controls.retry();
  $('new').onclick=()=>{if(confirm('Start a new game and reset the round scores?'))controls.action('new');};$('rules').onclick=()=>$('rules-dialog').showModal();$('close-rules').onclick=()=>$('rules-dialog').close();
  const compact=matchMedia('(max-width:700px)'),placeActivity=()=>{const target=compact.matches?document.querySelector('.handheading'):$('game-table');if($('activity').parentElement!==target)target.append($('activity'));};placeActivity();compact.addEventListener('change',placeActivity);
  const resize=new ResizeObserver(()=>{layoutFan($('hand'),false);for(const p of document.querySelectorAll('.backs'))layoutFan(p,true);});resize.observe($('hand'));resize.observe($('leo'));resize.observe($('mira'));
}
