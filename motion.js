// Flights use only the current seat's hand, public plays, and hidden card backs.
import {visibleEvents} from './events.js?v=midnight-v1';
const $=id=>document.getElementById(id),tasks=new Set();let eventTimer,generation=0;
const rect=el=>el?.getBoundingClientRect();
const middle=r=>({left:r.left+r.width/2,top:r.top+r.height/2,width:0,height:0});
const seat=p=>document.querySelector(`[data-player="${p}"]`);
function handOf(p,v){return p===v.player?$('hand'):seat(p)?.querySelector('.backs');}
export function captureTable(v){
  const hand=new Map([...$('hand').querySelectorAll('.card')].map(el=>[el.dataset.card,{rect:rect(el),node:el.cloneNode(true)}]));
  return {hand,deck:rect($('draw-deck').querySelector('img')),pile:rect($('pile')),pileCards:[...$('pile').querySelectorAll('.card')].map(el=>({rect:rect(el),node:el.cloneNode(true)})),seats:v?v.counts.map((_,p)=>rect(handOf(p,v))):[]};
}
export function cancelMotion(){generation++;for(const task of [...tasks])task.cancel();clearTimeout(eventTimer);$('table-event').textContent='';}
function back(){const el=document.createElement('div');el.className='back';return el;}
function flight(node,source,target,{duration=430,delay=0,kind='play',fade=false,reveal}={}){
  if(!source||!target)return Promise.resolve();
  const el=node.cloneNode(true);el.removeAttribute('id');el.classList.add('flying-card');el.classList.remove('selected');el.setAttribute('aria-hidden','true');el.dataset.motion=kind;el.style.visibility='visible';
  const w=target.width||source.width||66,h=target.height||source.height||94;el.style.width=w+'px';el.style.height=h+'px';el.style.left=target.left+'px';el.style.top=target.top+'px';
  if(reveal)reveal.style.visibility='hidden';$('motion-layer').append(el);
  const dx=source.left+source.width/2-target.left-w/2,dy=source.top+source.height/2-target.top-h/2;
  const start=`translate(${dx}px,${dy}px) rotate(-9deg) scale(${Math.max(.3,source.width/w)})`;
  const a=el.animate([{transform:start,opacity:0,offset:0},{transform:start,opacity:1,offset:.035},{transform:fade?'translate(55px,35px) rotate(15deg) scale(.6)':'translate(0,0) rotate(0deg) scale(1)',opacity:fade?0:1,offset:1}],{duration,delay,easing:'cubic-bezier(.18,.7,.2,1)',fill:'both'});
  return new Promise(resolve=>{let finished=false;const clean=()=>{if(finished)return;finished=true;tasks.delete(task);a.cancel();el.remove();if(reveal){reveal.style.visibility='';reveal.classList.remove('reveal-card','land-card');void reveal.offsetWidth;reveal.classList.add(kind==='play'?'land-card':'reveal-card');}resolve();};const task={cancel:clean};tasks.add(task);a.onfinish=clean;a.oncancel=clean;});
}
function announce(text){$('table-event').textContent=text;$('table-event').classList.remove('event-pop');void $('table-event').offsetWidth;$('table-event').classList.add('event-pop');clearTimeout(eventTimer);eventTimer=setTimeout(()=>{$('table-event').textContent='';},950);}
export function animateUpdate(previous,v,before,makeCard){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return {duration:0,finished:Promise.resolve()};
  const jobs=[];let end=0,offset=0;const pile=rect($('pile')),deck=rect($('draw-deck').querySelector('img'));const events=previous?.phase==='lobby'?[{kind:'deal'}]:visibleEvents(previous,v);
  const add=(node,source,target,opts={})=>{const delay=(opts.delay||0)+offset,duration=opts.duration||430;end=Math.max(end,delay+duration+(opts.reveal?240:0));jobs.push(flight(node,source,target,{...opts,delay,duration}));};
  const targetFor=p=>{const r=rect(handOf(p,v));return r?{left:r.left+r.width/2-26,top:r.top+20,width:52,height:78}:null;};
  for(const event of events){const p=event.player;
    if(event.kind==='deal'){
      $('deck-caption').textContent='Dealing…';const own=[...$('hand').querySelectorAll('.card')],backs=v.counts.map((_,i)=>[...(handOf(i,v)?.querySelectorAll('.back')||[])]);
      for(let n=0;n<10;n++)for(let i=0;i<3;i++){const native=i===v.player?own[n]:backs[i][n];if(native)add(back(),deck,rect(native),{kind:'deal',delay:(n*3+i)*30,duration:390,reveal:native});}offset=end;
    }else if(event.kind==='play'||event.kind==='discard'){
      before.pileCards.forEach((c,i)=>add(c.node,c.rect,{left:pile.left+pile.width/2-40,top:pile.top+40,width:80,height:118},{kind:'collect',fade:true,duration:220,delay:i*25}));
      const source=before.seats[p]?middle(before.seats[p]):targetFor(p),nativeCards=[...$('pile').querySelectorAll('.card')];
      (event.cards||[]).forEach((c,i)=>{const native=event.kind==='play'&&!event.cleared?nativeCards[i]:null,destination=native?rect(native):{left:pile.left+pile.width/2-56+i*20,top:pile.top+30,width:112,height:168},origin=p===v.player?before.hand.get(c)?.rect||source:source,node=makeCard(c);
        if(event.cleared||event.kind==='discard'){add(node,origin,event.kind==='discard'?deck:destination,{kind:event.kind,delay:i*65,duration:470});if(event.cleared)add(node,destination,{...destination,left:destination.left+75,top:destination.top+30},{kind:'clear',delay:590+i*40,duration:260,fade:true});}
        else add(node,origin,destination,{kind:'play',delay:i*65,duration:470,reveal:native});
      });if(event.cleared){announce(event.cards.length===4?'Bomb! Table cleared':'Ace clears the table');$('pile').classList.remove('table-flash');void $('pile').offsetWidth;$('pile').classList.add('table-flash');}offset=end;
    }else if(event.kind==='pass'){
      announce(v.names[p]+' passed');end=Math.max(end,450);if(event.cleared){before.pileCards.forEach((c,i)=>add(c.node,c.rect,{left:pile.left+pile.width/2-40,top:pile.top+40,width:80,height:118},{kind:'clear',fade:true,duration:350,delay:i*30}));announce('Table cleared');}offset=end;
    }else if(event.kind==='draw'||event.kind==='transfer'){
      const added=p===v.player?v.hand.filter(c=>!previous?.hand.includes(c)):[],src=event.kind==='draw'?deck:before.seats[event.source]?middle(before.seats[event.source]):targetFor(event.source);
      for(let i=0;i<event.count;i++){const native=p===v.player?$('hand').querySelector(`[data-card="${added[i]}"] .card`):handOf(p,v)?.querySelectorAll('.back')[v.counts[p]-event.count+i];add(back(),src,native?rect(native):targetFor(p),{kind:event.kind,delay:i*115,duration:480,reveal:native});}offset=end;
    }
  }
  const ticket=generation,finished=Promise.all(jobs).then(()=>{if(ticket===generation&&events.some(e=>e.kind==='deal'))$('deck-caption').textContent=v.phase==='villager'?'Cards drawn':'2 aside';});return {duration:end,finished};
}
