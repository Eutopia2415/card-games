/* Host-authoritative private views over PeerJS data connections. */
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(10)),b=>alphabet[b%alphabet.length]).join('');
const safeName=n=>String(n||'Player').trim().slice(0,24)||'Player';
export class Rooms{
  constructor(callbacks){this.cb=callbacks;this.guests=new Map();this.started=false;this.closed=false;this.names=['Host','Leo','Mira'];this.humans=[0];this.tokens=new Map();this.lastActions=new Map();}
  async create(name){
    this.host=true;this.player=0;this.names[0]=safeName(name);this.code=roomCode();
    await this.openPeer('kvp-'+this.code);this.peer.on('connection',c=>this.accept(c));this.lobby();return this.code;
  }
  async join(code,name,token){
    this.host=false;this.code=code.toUpperCase().replace(/[^A-Z2-9]/g,'');
    if(this.code.length!==10)throw Error('Enter the ten-character room code.');
    await this.openPeer();this.conn=this.peer.connect('kvp-'+this.code,{reliable:true,serialization:'json'});
    const conn=this.conn;let welcomed=false;
    const timeout=setTimeout(()=>{if(!welcomed){conn.close();this.cb.error('Could not join. Check the code and ask the host to keep their tab open.');}},20000);
    conn.on('open',()=>conn.send({type:'hello',name:safeName(name),token}));
    conn.on('data',data=>{
      if(!data||typeof data!=='object')return;
      if(data.type==='welcome'){welcomed=true;clearTimeout(timeout);this.player=data.player;this.token=data.token;this.cb.welcome?.(data);}
      else if(data.type==='lobby'){this.names=data.names;this.humans=data.humans;this.cb.lobby(data);}
      else if(data.type==='view'){this.started=true;this.cb.view(data.view);}
      else if(data.type==='error'){this.cb.error(data.error);}
      else if(data.type==='paused'){this.cb.paused(data.message);}
    });
    conn.on('close',()=>{clearTimeout(timeout);if(!this.closed)this.cb.paused('Host disconnected. Keep the room code and reconnect when the host is back.');});
    conn.on('error',()=>this.cb.error('Room connection failed. Try reconnecting.'));
  }
  openPeer(id){
    return new Promise((resolve,reject)=>{
      const peer=new Peer(id,{debug:2});this.peer=peer;const timer=setTimeout(()=>reject(Error('Room service did not respond. Try again.')),15000);
      peer.on('open',()=>{clearTimeout(timer);resolve();});
      peer.on('error',e=>{clearTimeout(timer);const msg=e.type==='peer-unavailable'?'Room not found. Check the code and keep the host’s tab open.':'Room service unavailable. Check your connection and try again.';reject(Error(msg));this.cb.error(msg);});
      peer.on('disconnected',()=>{if(!this.closed&&!peer.destroyed)peer.reconnect();});
    });
  }
  accept(conn){
    let seat=null;let timer;conn.on('open',()=>{timer=setTimeout(()=>conn.close(),20000);});
    conn.on('data',data=>{
      if(!data||typeof data!=='object')return;
      if(seat===null){
        if(data.type!=='hello')return;
        clearTimeout(timer);
        const returning=data.token&&this.tokens.get(data.token);
        if(returning&&(!this.guests.get(returning)?.open)){seat=returning;}
        else if(!this.started){seat=[1,2].find(p=>!this.guests.get(p)?.open);}
        if(seat===undefined||seat===null){conn.send({type:'error',error:this.started?'This game has started. Rejoin with your original browser, or wait for a new room.':'Room is full (three players).'});conn.close();return;}
        this.guests.set(seat,conn);this.names[seat]=safeName(data.name);if(!this.humans.includes(seat))this.humans.push(seat);
        const token=data.token&&this.tokens.get(data.token)===seat?data.token:crypto.randomUUID();this.tokens.set(token,seat);
        conn.send({type:'welcome',player:seat,token});this.lastActions.set(conn,0);
        if(this.started)this.cb.rejoin(seat);else this.lobby();
      }else if(data.type==='action'){
        const request=data.id;
        if(!Number.isSafeInteger(request)||request<=this.lastActions.get(conn))return;
        this.lastActions.set(conn,request);
        if(!this.started){conn.send({type:'error',error:'Wait for the host to start.'});return;}
        const body=data.body;
        if(!body||!['play','pass','ask','return'].includes(body.action)){conn.send({type:'error',error:'Only the host can start rounds.'});return;}
        this.cb.action(seat,body,conn);
      }
    });
    conn.on('close',()=>{
      clearTimeout(timer);this.lastActions.delete(conn);
      if(seat===null||this.closed||this.guests.get(seat)!==conn)return;
      if(!this.started){this.guests.delete(seat);this.humans=this.humans.filter(p=>p!==seat);this.names[seat]=seat===1?'Leo':'Mira';this.lobby();}
      else this.cb.paused(this.names[seat]+' disconnected. The game is paused until they reconnect.');
    });
    conn.on('error',()=>{});
  }
  lobby(){const info={type:'lobby',code:this.code,names:this.names,humans:this.humans};this.cb.lobby(info);for(const c of this.guests.values())if(c.open)c.send(info);}
  connected(){return this.humans.every(p=>p===0||this.guests.get(p)?.open);}
  sendViews(views){for(const [p,c] of this.guests)if(c.open)c.send({type:'view',view:views[p]});}
  pause(message){for(const c of this.guests.values())if(c.open)c.send({type:'paused',message});}
  sendAction(body,id){if(!this.conn?.open)throw Error('Reconnect to the room first.');this.conn.send({type:'action',body,id});}
  close(){this.closed=true;for(const c of this.guests.values())c.close();this.conn?.close();this.peer?.destroy();}
}
