const SUPABASE_URL='https://izvrvlufxajezukyvgue.supabase.co';
const SUPABASE_KEY='sb_publishable_5BCOeBUUn-U5c8_i3LUqmQ_MZF5eIx_';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const KEY='spend_records';
let mode='login',session=null,syncTimer=null,dirty=false,initializing=false;
const el=id=>document.getElementById(id);
function setMessage(text=''){const m=el('message');m.textContent=text;m.hidden=!text}
function setSync(text=''){el('syncStatus').textContent=text;const b=el('cloudState');if(b)b.textContent=text||'雲端同步'}
function getLocal(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function saveLocal(arr){localStorage.setItem(KEY,JSON.stringify(arr))}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function dateMs(v){const x=Date.parse(v);return Number.isFinite(x)?x:0}
function stableKey(r){return n(r.createdAt)?`t:${n(r.createdAt)}`:`f:${[r.name||'',r.seller||'',r.total||0,r.status||'',r.shipdate||''].join('|')}`}
function mergePreferSecond(first,second){const map=new Map();for(const r of first||[])map.set(stableKey(r),r);for(const r of second||[])map.set(stableKey(r),r);return [...map.values()].sort((a,b)=>n(b.createdAt)-n(a.createdAt))}
function paymentFingerprint(p){return [n(p.amount).toFixed(2),p.method||'',p.date||''].join('|')}
async function fetchCloudBundle(){
  const [{data:rows,error:rErr},{data:pays,error:pErr}]=await Promise.all([
    db.from('spend_records').select('*').is('deleted_at',null).order('created_at',{ascending:false}),
    db.from('spend_payments').select('*').order('created_at',{ascending:true})
  ]);
  if(rErr)throw rErr;if(pErr)throw pErr;
  const byRecord=new Map();
  for(const p of pays||[]){if(!byRecord.has(p.record_id))byRecord.set(p.record_id,[]);byRecord.get(p.record_id).push({amount:n(p.amount),method:p.method||'',date:p.paid_on||''})}
  const records=(rows||[]).map(r=>({
    name:r.name||'未命名商品',seller:r.seller||'未填寫',platform:r.platform||'其他',
    total:n(r.total_amount),paid:n(r.paid_amount),status:r.logistics_status||'尚未出貨',
    shipdate:r.ship_date||'',paymethod:r.payment_method||'',note:r.note||'',
    payments:byRecord.get(r.id)||[],createdAt:dateMs(r.created_at)||Date.now()
  }));
  const newest=(rows||[]).reduce((m,r)=>r.updated_at&&r.updated_at>m?r.updated_at:m,'');
  return {records,rows:rows||[],payments:pays||[],newest};
}
async function syncLocalToCloud(local){
  if(!session)return;
  setSync('同步中…');
  const bundle=await fetchCloudBundle();
  const rowByCreated=new Map(bundle.rows.map(r=>[dateMs(r.created_at),r]));
  const paymentsByRecord=new Map();
  for(const p of bundle.payments){
    if(!paymentsByRecord.has(p.record_id))paymentsByRecord.set(p.record_id,[]);
    paymentsByRecord.get(p.record_id).push(p);
  }
  const usedCreated=new Set(rowByCreated.keys());
  for(let i=0;i<local.length;i++){
    const r=local[i];let created=n(r.createdAt);
    if(!created){created=Date.now()+i;r.createdAt=created}
    while(usedCreated.has(created)&&!rowByCreated.has(created)){created++;r.createdAt=created}
    let dbRow=rowByCreated.get(created);
    const common={
      name:r.name||'未命名商品',seller:r.seller||'未填寫',platform:r.platform||'其他',
      total_amount:Math.max(0,n(r.total)),logistics_status:r.status||'尚未出貨',
      ship_date:r.shipdate||null,payment_method:r.paymethod||'',note:r.note||''
    };
    if(dbRow){
      const {data,error}=await db.from('spend_records').update(common).eq('id',dbRow.id).select('*').single();
      if(error)throw error;dbRow=data;
    }else{
      const insert={...common,user_id:session.user.id,base_amount:Math.max(0,n(r.total)),second_amount:0,fee_amount:0,shipping_amount:0,discount_amount:0,paid_amount:0,created_at:new Date(created).toISOString()};
      const {data,error}=await db.from('spend_records').insert(insert).select('*').single();
      if(error)throw error;dbRow=data;rowByCreated.set(created,data);usedCreated.add(created)
    }
    const existingRows=paymentsByRecord.get(dbRow.id)||[];
    const existingKeys=new Set(existingRows.map(p=>paymentFingerprint({amount:p.amount,method:p.method,date:p.paid_on})));
    let existingTotal=existingRows.reduce((s,p)=>s+n(p.amount),0);
    for(const p of Array.isArray(r.payments)?r.payments:[]){
      const fp=paymentFingerprint(p);if(existingKeys.has(fp)||n(p.amount)<=0)continue;
      const pay={record_id:dbRow.id,user_id:session.user.id,amount:n(p.amount),method:p.method||r.paymethod||'',paid_on:p.date||new Date(created).toISOString().slice(0,10)};
      const {error}=await db.from('spend_payments').insert(pay);if(error)throw error;
      existingKeys.add(fp);existingTotal+=n(p.amount)
    }
    const wanted=Math.max(0,n(r.paid));
    if(wanted>existingTotal+0.005){
      const delta=Number((wanted-existingTotal).toFixed(2));
      const {error}=await db.from('spend_payments').insert({record_id:dbRow.id,user_id:session.user.id,amount:delta,method:r.paymethod||'舊資料匯入',paid_on:new Date().toISOString().slice(0,10)});
      if(error)throw error
    }
  }
  saveLocal(local);
  const latest=await fetchCloudBundle();
  dirty=false;
  localStorage.setItem('spend_cloud_seen_'+session.user.id,latest.newest||new Date().toISOString());
  localStorage.setItem('spend_migrated_'+session.user.id,'1');
  setSync('雲端已同步');
}
async function initialSync(){
  if(initializing||!session)return;initializing=true;
  try{
    setSync('同步中…');
    const local=getLocal();const cloud=await fetchCloudBundle();const migrated=localStorage.getItem('spend_migrated_'+session.user.id)==='1';
    if(!migrated&&local.length){const merged=mergePreferSecond(local,cloud.records);saveLocal(merged);await syncLocalToCloud(merged)}
    else if(cloud.records.length){saveLocal(cloud.records);localStorage.setItem('spend_cloud_seen_'+session.user.id,cloud.newest||new Date().toISOString());localStorage.setItem('spend_migrated_'+session.user.id,'1');setSync('雲端已同步')}
    else if(local.length){await syncLocalToCloud(local)}
    else{saveLocal([]);localStorage.setItem('spend_migrated_'+session.user.id,'1');setSync('雲端已同步')}
    showApp(true)
  }catch(e){console.error(e);setSync('同步失敗');setMessage('雲端同步暫時失敗，本機資料沒有被刪除。');showApp(true)}finally{initializing=false}
}
function showApp(ok){el('auth').classList.toggle('hidden',ok);el('topbar').classList.toggle('show',ok);el('appFrame').hidden=!ok;if(ok){el('accountEmail').textContent=session?.user?.email||'';try{el('appFrame').contentWindow.location.reload()}catch{}}}
function setMode(next){mode=next;el('loginTab').classList.toggle('on',mode==='login');el('signupTab').classList.toggle('on',mode==='signup');el('nameWrap').hidden=mode!=='signup';el('submitBtn').textContent=mode==='signup'?'建立帳號':'登入';setMessage('')}
async function submitAuth(){const email=el('email').value.trim(),password=el('password').value;if(!email||!password)return setMessage('請輸入 Email 和密碼。');el('submitBtn').disabled=true;setMessage('');try{if(mode==='signup'){const name=el('displayName').value.trim();const {data,error}=await db.auth.signUp({email,password,options:{data:{display_name:name||email.split('@')[0]}}});if(error)throw error;if(data.session){session=data.session;await initialSync()}else{setMessage('註冊完成，請先到信箱點確認連結，再回來登入。');setMode('login')}}else{const {data,error}=await db.auth.signInWithPassword({email,password});if(error)throw error;session=data.session;await initialSync()}}catch(e){setMessage(e.message||'發生錯誤，請稍後再試。')}finally{el('submitBtn').disabled=false}}
async function resetPassword(){const email=el('email').value.trim();if(!email)return setMessage('先輸入註冊時使用的 Email。');try{const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:'https://save-radar-gold.vercel.app/reset-password'});if(error)throw error;setMessage('重設信已寄出，請到信箱查看。')}catch(e){setMessage(e.message||'無法寄出重設信。')}}
async function logout(){await db.auth.signOut();session=null;showApp(false);setMessage('已登出。')}
async function pullIfNewer(){if(!session||dirty||document.hidden)return;try{const cloud=await fetchCloudBundle();const seen=localStorage.getItem('spend_cloud_seen_'+session.user.id)||'';if(cloud.newest&&cloud.newest>seen){saveLocal(cloud.records);localStorage.setItem('spend_cloud_seen_'+session.user.id,cloud.newest);try{el('appFrame').contentWindow.location.reload()}catch{}setSync('已更新雲端資料')}}catch(e){console.error(e)}}
function schedulePush(){dirty=true;clearTimeout(syncTimer);syncTimer=setTimeout(async()=>{try{await syncLocalToCloud(getLocal())}catch(e){console.error(e);setSync('同步失敗')}},800)}
window.addEventListener('storage',e=>{if(e.key===KEY&&session)schedulePush()});document.addEventListener('visibilitychange',()=>{if(!document.hidden)pullIfNewer()});window.addEventListener('focus',pullIfNewer);
el('legacyFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const obj=JSON.parse(await f.text());const arr=Array.isArray(obj)?obj:Array.isArray(obj.records)?obj.records:null;if(!arr)throw new Error();const merged=mergePreferSecond(arr,getLocal());saveLocal(merged);if(session)await syncLocalToCloud(merged);setMessage(`已匯入 ${arr.length} 筆舊資料，並與現有資料合併，不會清空雲端紀錄。`);if(session){try{el('appFrame').contentWindow.location.reload()}catch{}}}catch{setMessage('這個檔案不是可用的「我的消費簿」備份。')}finally{e.target.value=''}});
(async()=>{const {data}=await db.auth.getSession();session=data.session||null;if(session)await initialSync();else showApp(false)})();
db.auth.onAuthStateChange(async(_event,newSession)=>{if(newSession&&!session){session=newSession;await initialSync()}else if(!newSession&&session){session=null;showApp(false)}});
window.setMode=setMode;window.submitAuth=submitAuth;window.resetPassword=resetPassword;window.logout=logout;