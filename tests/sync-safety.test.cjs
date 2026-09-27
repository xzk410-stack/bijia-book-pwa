const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
class Store{constructor(){this.data=new Map()}getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,String(v))}removeItem(k){this.data.delete(k)}key(i){return [...this.data.keys()][i]}get length(){return this.data.size}}
function harness(app,request=async()=>({data:null,error:null})){
 const storage=new Store(),key=app==='pricebook'?'priceBook_v1':'spend_records',owner=app==='pricebook'?'priceBook_owner_user_id':'spend_owner_user_id';
 const nodes=new Map();const node=()=>({hidden:false,textContent:'',classList:{toggle(){}},addEventListener(){},contentDocument:{querySelector(){return null}},contentWindow:{location:{reload(){}}}});
 let signedOut=0;const alerts=[];
 const db={auth:{onAuthStateChange(){},signOut:async()=>{signedOut++;return {error:null}}},from(table){const q={table,op:'read'};const p=new Proxy({}, {get(_,k){if(k==='then')return(resolve,reject)=>Promise.resolve(request(q)).then(resolve,reject);return(...a)=>{if(['insert','update','upsert','delete'].includes(k)){q.op=k;q.value=a[0]}return p}}});return p}};
 const c={console:{log(){},warn(){},error(){}},structuredClone,Date,Map,Set,Promise,URL,Storage:Store,localStorage:storage,alert:x=>alerts.push(x),setTimeout(){return 1},clearTimeout(){},setInterval(){},supabase:{createClient:()=>db},document:{hidden:false,currentScript:{dataset:{key,owner,empty:app==='pricebook'?'{}':'[]'}},getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},addEventListener(){}},addEventListener(){}};c.window=c;vm.createContext(c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../local-sync-state.js'),'utf8'),c);
 let src=fs.readFileSync(path.join(__dirname,'..',app,'cloud.js'),'utf8');const a=src.indexOf('\n(async()=>{'),b=src.indexOf('\n'+(app==='pricebook'?'dbClient':'db')+'.auth.onAuthStateChange(',a);src=src.slice(0,a)+src.slice(b);
 vm.runInContext(src+`;window.testApi={login(id){session={user:{id}};syncState.claim(id)},setSession(id){session={user:{id}}},initialSync,logout,pullIfNewer,push:${app==='pricebook'?'pushNow':'syncLocalToCloud'},getLocal,mark:syncState.mark};`,c);
 return {c,storage,key,owner,api:c.testApi,alerts,signedOut:()=>signedOut};
}
for(const app of ['pricebook','spendbook']){
 const payload=app==='pricebook'?{products:[{id:'one',name:'new',records:[]}]}:[{createdAt:1,name:'new',payments:[]}];
 test(app+': account switch keeps drafts isolated',()=>{const h=harness(app);h.api.login('a');h.storage.setItem(h.key,JSON.stringify(payload));h.api.mark();h.api.login('b');assert.notEqual(h.storage.getItem(h.key),JSON.stringify(payload));h.api.login('a');assert.equal(h.storage.getItem(h.key),JSON.stringify(payload));assert.equal(h.c.AppSyncState.pending('a'),true)});
 test(app+': failed sync prevents logout without deleting local data',async()=>{const h=harness(app,async()=>{throw Error('offline')});h.api.login('a');const text=JSON.stringify(payload);h.storage.setItem(h.key,text);h.api.mark();await h.api.logout();assert.equal(h.signedOut(),0);assert.equal(h.storage.getItem(h.key),text);assert.equal(h.c.AppSyncState.pending('a'),true);assert.equal(h.alerts.length,1)});
 test(app+': pending edits survive initial sync failure',async()=>{const h=harness(app,async()=>{throw Error('offline')});h.api.login('a');const text=JSON.stringify(payload);h.storage.setItem(h.key,text);h.api.mark();await h.api.initialSync();assert.equal(h.storage.getItem(h.key),text);assert.equal(h.c.AppSyncState.pending('a'),true)});
 test(app+': slow cloud read cannot overwrite a new local edit',async()=>{let resume;const wait=new Promise(r=>resume=r);const h=harness(app,async()=>{await wait;return {data:app==='pricebook'?{snapshot:{products:[]},updated_at:'2099'}:[],error:null}});h.api.login('a');h.storage.setItem(h.key,app==='pricebook'?'{}':'[]');const p=h.api.pullIfNewer();h.storage.setItem(h.key,JSON.stringify(payload));h.api.mark();resume();await p;assert.equal(h.storage.getItem(h.key),JSON.stringify(payload))});
}
test('acknowledge cannot clear a newer local edit',()=>{const h=harness('pricebook');h.api.login('a');h.storage.setItem(h.key,'new');h.api.mark();assert.equal(h.c.AppSyncState.acknowledge('a','old'),false);assert.equal(h.c.AppSyncState.pending('a'),true)});
test('spendbook saves two identical legitimate payments once each',async()=>{
 const payments=[];const row={id:'r1',created_at:new Date(1).toISOString(),updated_at:'2026-01-01'};
 const h=harness('spendbook',async q=>{
  if(q.table==='spend_records')return {data:q.op==='read'?[row]:row,error:null};
  if(q.op==='insert'){payments.push(q.value);return {data:null,error:null}}
  return {data:payments,error:null};
 });h.api.login('a');h.storage.setItem(h.key,JSON.stringify([{createdAt:1,name:'x',paid:20,payments:[{amount:10,method:'cash',date:'2026-01-01'},{amount:10,method:'cash',date:'2026-01-01'}]}]));h.api.mark();await h.api.push();await h.api.push();assert.equal(payments.length,2);
});
test('pricebook upload retries the latest edit made during its request',async()=>{
 let release,started;const began=new Promise(r=>started=r);const gate=new Promise(r=>release=r);let row=null,writes=0;
 const h=harness('pricebook',async q=>{
  if(q.table==='pricebook_cloud_backups')return {data:[],error:null};
  if(q.op==='upsert'){writes++;row={snapshot:q.value.snapshot,updated_at:q.value.updated_at};if(writes===1){started();await gate}return {data:{updated_at:q.value.updated_at},error:null}}
  return {data:row,error:null};
 });h.api.login('a');h.storage.setItem(h.key,JSON.stringify({products:[{id:'1',name:'first'}]}));h.api.mark();const p=h.api.push();await began;h.storage.setItem(h.key,JSON.stringify({products:[{id:'1',name:'second'}]}));h.api.mark();release();assert.equal(await p,true);assert.equal(row.snapshot.products[0].name,'second');assert.equal(h.api.getLocal().products[0].name,'second');assert.equal(writes,2);
});
test('spendbook edit reopens the saved item after closing its sheet',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../spendbook/app.html'),'utf8');
 const fn=html.match(/function saveEditRecord\(\)[^\n]*/)[0];
 let opened=null;
 const fields={editName:'edited',editSeller:'seller',editPlatform:'IG',editTotal:'100',editStatus:'已完成',editShipdate:'',editPaymethod:'現金',editNote:'note'};
 const c={editingRecordIndex:0,records:[{name:'old',paid:0,payments:[]}],document:{getElementById:id=>({value:fields[id]||''})},alert(){},persist(){},hideSheet(){c.editingRecordIndex=null},openDetail:i=>opened=i};
 for(const [id,value] of Object.entries(fields))c[id]={value};vm.createContext(c);vm.runInContext(fn,c);c.saveEditRecord();assert.equal(opened,0);assert.equal(c.records[0].name,'edited');
});
