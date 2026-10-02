// Older relay versions filter animation metadata. Reconstruct only observable
// events from the private seat view and already-public activity log.
export function visibleEvents(previous,next){
  if(Array.isArray(next.events))return next.events;
  if(previous&&previous.player!==next.player&&previous.phase!=='lobby')return [];
  if(!previous||previous.phase==='lobby'||previous.round!==next.round)return [{kind:'deal'}];
  const cues=[],p=previous.turn;
  if(previous.phase==='play'){
    const removed=previous.counts[p]-next.counts[p];
    if(removed>0){
      let cards=next.top;
      if(!cards){
        const prefix=next.names[p]+': ',line=next.log.slice().reverse().find(s=>s.startsWith(prefix)&&!s.startsWith(prefix+'pass'));
        const values=line?.slice(prefix.length).split(' — ')[0].split(', ');
        cards=values?.map(s=>{const m=/^(7|8|9|10|J|Q|K|A)([♣♦♥♠])$/.exec(s);return m?(m[1]==='10'?'T':m[1])+({'♣':'C','♦':'D','♥':'H','♠':'S'})[m[2]]:null;});
      }
      if(cards?.length===removed&&cards.every(Boolean))cues.push({kind:'play',player:p,cards,cleared:next.top===null});
    }else if(previous.top&&next.log.at(-1)!==previous.log.at(-1)&&next.log.slice(-2).includes(next.names[p]+': pass'))cues.push({kind:'pass',player:p,cleared:next.top===null});
  }else if(previous.phase==='questions'&&next.received>previous.received)cues.push({kind:'transfer',source:next.roles.indexOf('Peasant'),player:p,count:1});
  else if(previous.phase==='return'&&next.phase!==previous.phase)cues.push({kind:'transfer',source:p,player:next.roles.indexOf('Peasant'),count:previous.received});
  else if(previous.phase==='villager'&&next.phase==='play')cues.push({kind:'discard',player:p,cards:next.exposed});
  if(previous.phase!=='villager'&&next.phase==='villager')cues.push({kind:'draw',player:next.turn,count:2});
  return cues;
}
