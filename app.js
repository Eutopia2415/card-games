import {GameRuntime,seed,storedGame,saveGame} from './runtime.js';
import {Rooms} from './rooms.js';
import {initUI,setState,lobbyState,setBusy,setLocked,showError} from './ui.js';
const $=id=>document.getElementById(id);
let runtime,room,state,mode='solo',timer,paused=false,actionId=0,epoch=0,chain=Promise.resolve();
function banner(message){$('connection').textContent=message||'';}
function clear(){clearTimeout(timer);}
function schedule(){
  clear();if(paused||mode==='guest'||(mode==='host'&&!room?.started)||!state||state.phase==='done'||state.phase==='lobby'||state.humans.includes(state.turn))return;
  timer=setTimeout(()=>dispatch({command:'step'}).catch(error=>{showError(error.message);banner('Bot turn stopped. Reload to resume.');}),500);
}
function publish(result){
  if(mode==='guest')return;
  state=result.views[0];setState(state);setLocked(paused);showError('');
  if(mode==='solo'&&result.saved)saveGame(result.saved);
  if(mode==='host'&&room?.started)room.sendViews(result.views);
  schedule();
}
function dispatch(payload){
  const ticket=epoch;clear();
  const task=async()=>{if(ticket!==epoch)throw Error('Session changed.');const r=await runtime.request({...payload,solo:mode==='solo'});if(ticket===epoch)publish(r);return r;};
  const result=chain.then(task);chain=result.catch(()=>{});return result;
}
async function solo(){
  epoch++;clear();room?.close();room=null;runtime?.close();chain=Promise.resolve();mode='solo';paused=false;
  $('room-active').hidden=true;$('room-choice').hidden=false;$('start-room').hidden=true;
  setLocked(true);banner('Loading game…');runtime=new GameRuntime(banner);const ticket=epoch;
  try{await dispatch({command:'init',seed:seed(),saved:storedGame(),humans:[0],names:['You','Leo','Mira']});if(ticket===epoch){setLocked(false);banner('Solo practice · expert bots');}}
  catch(e){if(ticket===epoch)showError(e.message);}
}
function pause(message){paused=true;clear();setLocked(true);banner(message);if(mode==='host')room.pause(message);}
function roomCallbacks(){return{
  error:message=>{showError(message);$('room-error').textContent=message;},
  paused:pause,
  welcome:data=>{try{sessionStorage.setItem('kvp-room-'+room.code,data.token);}catch{};},
  lobby:info=>{
    $('room-active').hidden=false;$('room-choice').hidden=true;$('code-display').textContent=info.code;
    $('members').replaceChildren(...info.names.map((name,p)=>{const li=document.createElement('li');li.textContent=name+(info.humans.includes(p)?' · connected':' · bot seat');return li;}));
    $('start-room').hidden=mode!=='host';$('start-room').disabled=info.humans.length<2;
    const p=mode==='host'?0:room.player??0;lobbyState(info,p);setLocked(true);
    banner(mode==='host'?'Room '+info.code+' · invite one or two friends':'Room '+info.code+' · waiting for the host');
  },
  view:view=>{if(mode!=='guest')return;paused=false;state=view;setState(view);setLocked(false);showError('');banner('Room '+room.code+' · '+view.names[view.player]);if($('room-dialog').open)$('room-dialog').close();},
  action:async(p,body,conn)=>{
    if(!room.connected()){conn.send({type:'error',error:'A player is disconnected. Wait for them to reconnect.'});return;}
    try{await dispatch({command:'action',player:p,action:body.action,cards:body.cards,rank:body.rank,seed:seed()});}
    catch(e){if(conn.open)conn.send({type:'error',error:e.message});}
  },
  rejoin:async()=>{paused=!room.connected();try{await dispatch({command:'seats',humans:room.humans,names:room.names});banner(paused?'Waiting for disconnected players.':'Room '+room.code+' · everyone connected');}catch(e){showError(e.message);}}
};}
async function createRoom(){
  $('room-error').textContent='';$('create-room').disabled=true;
  try{
    room?.close();const newRoom=new Rooms(roomCallbacks());room=newRoom;
    epoch++;clear();runtime?.close();chain=Promise.resolve();mode='host';paused=false;setLocked(true);
    runtime=new GameRuntime(banner);
    await room.create($('player-name').value||'Host');
    await dispatch({command:'init',seed:seed(),humans:[0],names:room.names});
    room.lobby();
  }catch(e){$('room-error').textContent=e.message;showError(e.message);}
  finally{$('create-room').disabled=false;}
}
async function joinRoom(){
  $('room-error').textContent='';$('join-room').disabled=true;
  try{
    const code=$('room-code').value.trim().toUpperCase().replace(/[^A-Z2-9]/g,'');
    if(code.length!==10)throw Error('Enter the ten-character room code.');
    epoch++;clear();runtime?.close();chain=Promise.resolve();room?.close();mode='guest';paused=false;setLocked(true);
    room=new Rooms(roomCallbacks());let token;try{token=sessionStorage.getItem('kvp-room-'+code);}catch{}
    banner('Connecting to room…');await room.join(code,$('player-name').value||'Player',token);
  }catch(e){$('room-error').textContent=e.message;showError(e.message);}
  finally{$('join-room').disabled=false;}
}
async function action(action,extra={}){
  if(paused){showError('Wait for disconnected players to reconnect.');return;}
  setBusy(true);showError('');setBusy(true);
  try{
    if(mode==='guest')room.sendAction({action,...extra},++actionId);
    else await dispatch({command:'action',player:0,action,...extra,seed:seed()});
  }catch(e){showError(e.message);}
}
initUI({action});
$('friends').onclick=()=>$('room-dialog').showModal();$('close-room').onclick=()=>$('room-dialog').close();
$('create-room').onclick=createRoom;$('join-room').onclick=joinRoom;
$('start-room').onclick=async()=>{
  if(!room?.host||room.humans.length<2||!room.connected())return;
  $('start-room').disabled=true;
  try{await dispatch({command:'seats',humans:room.humans,names:room.names});room.started=true;paused=false;const r=await runtime.request({command:'view'});publish(r);$('room-dialog').close();banner('Room '+room.code+' · keep the host’s tab open');}
  catch(e){showError(e.message);$('room-error').textContent=e.message;$('start-room').disabled=false;}
};
$('solo').onclick=()=>{if(mode!=='solo'&&!confirm('Leave this room and return to solo practice?'))return;$('room-dialog').close();solo();};
$('copy-room').onclick=async()=>{
  if(!room?.code)return;
  const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('room',room.code);
  try{await navigator.clipboard.writeText(url.href);$('copy-room').textContent='Invite link copied';}catch{$('invite-link').value=url.href;$('invite-link').hidden=false;$('invite-link').select();}
};
const invite=new URL(location.href).searchParams.get('room');
if(invite){$('room-code').value=invite;$('room-dialog').showModal();}
solo();
