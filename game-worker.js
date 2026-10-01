/* The existing rule engine and expert search stay inside a dedicated worker. */
const RUNTIME=new URL('vendor/pyodide/',self.location.href).href;
let engine;
const ready=(async()=>{
  try{
    const {loadPyodide}=await import(RUNTIME+'pyodide.mjs');
    const py=await loadPyodide({indexURL:RUNTIME});
    py.FS.mkdir('/game');
    for(const name of ['game','bot','expert_bot','previous_bot','endgame','browser_bridge']){
      const r=await fetch(new URL('python/'+name+'.py',self.location.href));
      if(!r.ok)throw Error('Unable to load game rules.');
      py.FS.writeFile('/game/'+name+'.py',await r.text());
    }
    py.runPython("import sys; sys.path.insert(0, '/game'); import browser_bridge");
    engine=py.globals.get('browser_bridge').handle;
    postMessage({type:'ready'});
  }catch(error){console.error(error);postMessage({type:'fatal',error:'Engine loading failed: '+String(error.message||error)});throw error;}
})();
let queue=Promise.resolve();
onmessage=({data})=>{
  queue=queue.then(async()=>{
    try{await ready;const result=JSON.parse(engine(JSON.stringify(data.payload)));postMessage({id:data.id,result});}
    catch(error){postMessage({id:data.id,error:String(error.message||error).split('\n').filter(Boolean).at(-1)});}
  });
};
