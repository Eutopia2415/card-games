import {friendlyError} from './messages.js?v=midnight-v1';
export class GameRuntime{
  constructor(onLoading=()=>{}){
    this.pending=new Map();this.id=0;this.worker=new Worker(new URL('./game-worker.js?v=midnight-v1',import.meta.url),{type:'module'});
    this.ready=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});
    this.worker.onmessage=({data})=>{
      if(data.type==='ready'){onLoading('');this.resolve();return;}
      if(data.type==='fatal'){this.reject(Error(data.error));onLoading(friendlyError(data.error));return;}
      const p=this.pending.get(data.id);if(!p)return;this.pending.delete(data.id);
      data.error?p.reject(Error(data.error)):p.resolve(data.result);
    };
    this.worker.onerror=()=>{this.reject(Error('The game worker stopped. Reload to retry.'));};
    onLoading('Loading game engine… First visit may take a moment.');
  }
  async request(payload){await this.ready;return new Promise((resolve,reject)=>{const id=++this.id;this.pending.set(id,{resolve,reject});this.worker.postMessage({id,payload});});}
  close(){this.reject(Error('Game session ended.'));this.worker.terminate();for(const p of this.pending.values())p.reject(Error('Game session ended.'));this.pending.clear();}
}
export const seed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
export function storedGame(){try{return JSON.parse(localStorage.getItem('kvp-solo-v1'));}catch{return null;}}
export function saveGame(value){try{localStorage.setItem('kvp-solo-v1',JSON.stringify(value));}catch{}}
