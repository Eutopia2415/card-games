/* Host engine stays local; the relay routes only per-seat messages. */
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(10)),b=>alphabet[b%32]).join('');
export class Rooms{
 constructor(callbacks,{endpoint,WebSocketClass=WebSocket}={}){
  this.cb=callbacks;this.endpoint=endpoint;this.WS=WebSocketClass;this.started=false;this.closed=false;this.names=['Host','Leo','Mira'];this.humans=[0];this.connections=[false,false,false];this.revision=-1;this.lastAction=0;this.retries=0;
 }
 async create(name){this.host=true;this.player=0;this.code=randomCode();this.name=name||'Host';return this.open('create');}
 async join(code,name,token){this.host=false;this.code=code.toUpperCase();if(!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(this.code))throw Error('Enter the ten-character room code.');this.name=name||'Player';this.token=token;return this.open(token?'resume':'join');}
 open(mode){
  if(!this.endpoint)throw Error('Shared-room relay has not been configured.');
  const url=new URL(this.endpoint);if(!['wss:','ws:'].includes(url.protocol)||(url.protocol==='ws:'&&!['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Secure relay URL required.');
  url.pathname='/rooms/'+this.code;url.search='';url.hash='';
  return new Promise((resolve,reject)=>{
   const ws=new this.WS(url.href);this.socket=ws;let welcomed=false;
   const timeout=setTimeout(()=>{if(!welcomed){reject(Error('Room service did not respond.'));ws.close();}},15000);
   ws.onopen=()=>ws.send(JSON.stringify({type:'hello',version:1,code:this.code,mode,name:this.name,token:this.token}));
   ws.onmessage=event=>{
    if(this.socket!==ws||this.closed)return;
    let d;try{d=JSON.parse(event.data);}catch{return;}
    if(d.type==='welcome'){
     if(d.player===0&&!this.host){clearTimeout(timeout);this.token=null;reject(Error('The host engine cannot be restored after a tab reload. Create a new room.'));this.cb.error('Create a new room from the host tab.');ws.close();return;}
     welcomed=true;clearTimeout(timeout);this.player=d.player;this.host=d.player===0;this.token=d.token;this.session=d.session;this.started=d.started;this.lastAction=d.lastAction;this.retries=0;this.cb.welcome?.(d);resolve(this.code);
     clearInterval(this.heartbeat);this.pong=Date.now();this.heartbeat=setInterval(()=>{if(Date.now()-this.pong>45000){ws.close();return;}if(ws.readyState===1)ws.send('{"type":"ping"}');},15000);
    }else if(d.type==='pong')this.pong=Date.now();
    else if(d.type==='lobby'){
     if(d.session!==this.session)return;
     this.names=d.names;this.humans=d.humans;this.connections=d.connected;this.started=d.started;
     if(!this.started)this.cb.lobby(d);else if(!this.connected())this.cb.paused('Waiting for disconnected players to reconnect.');
    }else if(d.type==='refresh'&&this.host&&this.started)this.cb.rejoin?.();
    else if(d.type==='view'&&!this.host){if(d.view?.player!==this.player||d.view.revision<=this.revision)return;this.started=true;this.revision=d.view.revision;this.cb.view(d.view);}
    else if(d.type==='published'&&this.host)this.revision=Math.max(this.revision,d.revision);
    else if(d.type==='action'&&this.host){const proxy={get open(){return ws.readyState===1;},send:body=>this.send({type:'reject',player:d.player,id:d.id,error:body.error})};this.cb.action(d.player,{...d.body,relayRevision:d.revision},proxy);}
    else if(d.type==='error'){if(!welcomed){clearTimeout(timeout);reject(Error(d.error));this.token=null;ws.close();}this.cb.error(d.error);}
    else if(d.type==='paused')this.cb.paused(d.message);
   };
   ws.onerror=()=>{if(!welcomed)reject(Error('Room connection failed.'));};
   ws.onclose=()=>{clearTimeout(timeout);clearInterval(this.heartbeat);if(this.closed||this.socket!==ws)return;this.connections=[false,false,false];this.cb.paused('Relay disconnected. Reconnecting…');if(this.token){clearTimeout(this.retry);this.retry=setTimeout(()=>this.open('resume').catch(e=>this.cb.error(e.message)),Math.min(1000*2**this.retries++,10000));}};
  });
 }
 send(message){if(this.socket?.readyState!==1)throw Error('Reconnect to the room first.');this.socket.send(JSON.stringify({...message,session:this.session}));}
 lobby(){} // Presence is supplied by the relay.
 connected(){return this.socket?.readyState===1&&this.humans.every(p=>this.connections[p]);}
 sendViews(views){this.revision=views[0].revision;this.send({type:'views',views});}
 pause(message){if(this.host&&this.socket?.readyState===1)this.send({type:'pause',message});}
 sendAction(body,id){this.lastAction=Math.max(this.lastAction+1,id);this.send({type:'action',id:this.lastAction,revision:this.revision,body});}
 close(){this.closed=true;clearTimeout(this.retry);clearInterval(this.heartbeat);this.socket?.close();}
}
