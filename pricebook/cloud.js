const SUPABASE_URL='https://izvrvlufxajezukyvgue.supabase.co';
const SUPABASE_KEY='sb_publishable_5BCOeBUUn-U5c8_i3LUqmQ_MZF5eIx_';
const dbClient=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const DATA_KEY='priceBook_v1';
const BACKUP_KEY='priceBook_backups_v1';
const OWNER_KEY='priceBook_owner_user_id';
const DEFAULT_SNAPSHOT={products:[],settings:{nearLow:5,barcodeLookup:true}};
let authMode='login',session=null,dirty=false,pushTimer=null,lastSeenAt='',initializing=false,lastSerialized='';
const $=id=>document.getElementById(id);
const syncState=window.AppSyncState;
let pushPromise=null;
function assertAccount(uid){if(!uid||session?.user?.id!==uid||syncState.owner()!==uid)throw new Error('帳號已變更，請重新同步。')}
function pending(){return dirty||syncState.pending(session?.user?.id)}


function saveNativeSession(s){
  try{
    if(window.Android&&typeof Android.saveAuthSession==='function'&&s?.access_token&&s?.refresh_token){
      Android.saveAuthSession(s.access_token,s.refresh_token);
    }
  }catch{}
}

async function restoreNativeSession(){
  try{
    if(!(window.Android&&typeof Android.loadAuthSession==='function'))return null;
    const raw=JSON.parse(Android.loadAuthSession()||'{}');
    if(!raw.access_token||!raw.refresh_token)return null;
    const {data,error}=await dbClient.auth.setSession({access_token:raw.access_token,refresh_token:raw.refresh_token});
    if(error||!data?.session)return null;
    saveNativeSession(data.session);
    return data.session;
  }catch(e){
    console.warn('native auth restore failed',e);
    return null;
  }
}

function clearNativeSession(){
  try{if(window.Android&&typeof Android.clearAuthSession==='function')Android.clearAuthSession()}catch{}
}

function normalizeSnapshot(raw){
  const x=raw&&typeof raw==='object'?structuredClone(raw):structuredClone(DEFAULT_SNAPSHOT);
  if(!Array.isArray(x.products))x.products=[];
  if(!x.settings||typeof x.settings!=='object')x.settings={nearLow:5,barcodeLookup:true};
  if(x.settings.nearLow==null)x.settings.nearLow=5;
  if(x.settings.barcodeLookup==null)x.settings.barcodeLookup=true;
  for(const p of x.products){
    if(!Array.isArray(p.records))p.records=[];
    if(!Array.isArray(p.barcodes))p.barcodes=p.barcode?[String(p.barcode)]:[];
  }
  return x;
}
function getLocal(){try{return normalizeSnapshot(JSON.parse(localStorage.getItem(DATA_KEY)||'null'))}catch{return normalizeSnapshot(null)}}
function saveLocal(snapshot){const x=normalizeSnapshot(snapshot);const text=JSON.stringify(x);localStorage.setItem(DATA_KEY,text);lastSerialized=text;return x}
function hasData(x){return !!(x&&Array.isArray(x.products)&&x.products.length)}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function clean(v){return String(v??'').trim()}
function productKey(p){
  if(clean(p.id))return'id:'+clean(p.id);
  const bc=clean(p.barcode)||((p.barcodes||[]).map(clean).find(Boolean)||'');
  if(bc)return'bc:'+bc;
  return'n:'+clean(p.name).toLowerCase()+'|'+clean(p.brand).toLowerCase()+'|'+clean(p.category).toLowerCase();
}
function recordKey(r){
  if(clean(r.id))return'id:'+clean(r.id);
  return'f:'+[
    clean(r.date),clean(r.store),n(r.price),clean(r.currency),n(r.exchange),n(r.qty),clean(r.spec),clean(r.type),n(r.createdAt)
  ].join('|');
}
function productFreshness(p){return Math.max(0,...(p.records||[]).map(r=>n(r.createdAt)))}
function mergeProduct(cloudP,localP){
  const localNewer=productFreshness(localP)>=productFreshness(cloudP);
  const base=localNewer?{...cloudP,...localP}:{...localP,...cloudP};
  const barcodes=[...new Set([...(cloudP.barcodes||[]),cloudP.barcode,...(localP.barcodes||[]),localP.barcode].map(clean).filter(Boolean))];
  const records=new Map();
  for(const r of cloudP.records||[])records.set(recordKey(r),r);
  for(const r of localP.records||[]){
    const k=recordKey(r),old=records.get(k);
    records.set(k,old?{...old,...r}:r);
  }
  return {...base,barcode:clean(base.barcode)||barcodes[0]||'',barcodes,records:[...records.values()].sort((a,b)=>n(a.createdAt)-n(b.createdAt))};
}
function mergeSnapshots(cloudSnap,localSnap){
  const cloud=normalizeSnapshot(cloudSnap),local=normalizeSnapshot(localSnap),products=new Map();
  for(const p of cloud.products)products.set(productKey(p),p);
  for(const p of local.products){const k=productKey(p),old=products.get(k);products.set(k,old?mergeProduct(old,p):p)}
  return normalizeSnapshot({...cloud,...local,settings:{...cloud.settings,...local.settings},products:[...products.values()]});
}
function sameSnapshot(a,b){try{return JSON.stringify(normalizeSnapshot(a))===JSON.stringify(normalizeSnapshot(b))}catch{return false}}
function setMessage(text=''){const m=$('message');m.textContent=text;m.hidden=!text}
function setStatus(text='雲端同步',warn=false){const s=$('syncStatus');if(s)s.textContent=text;const b=$('cloudState');if(b){b.textContent=text;b.classList.toggle('warn',warn)}}
function showApp(ok){const boot=$('boot');if(boot)boot.hidden=true;$('auth').classList.toggle('hidden',ok);$('topbar').classList.toggle('show',ok);$('appFrame').hidden=!ok;if(ok){$('accountEmail').textContent=session?.user?.email||'';try{$('appFrame').contentWindow.location.reload()}catch{}}}
function setMode(next){authMode=next;$('loginTab').classList.toggle('on',next==='login');$('signupTab').classList.toggle('on',next==='signup');$('nameWrap').hidden=next!=='signup';$('submitBtn').textContent=next==='signup'?'建立帳號':'登入';setMessage('')}

async function signInWithGoogle(){
  setMessage('');
  try{
    const inAndroid=!!(window.Android&&typeof Android.openGoogleLogin==='function');
    // 完整沿用收藏雷達 Android 已穩定使用的 Auth Tab 流程：
    // Google 完成後回到同一個 save-radar-gold.vercel.app/login 路徑，
    // Auth Tab 直接把結果交回比價簿，不再另外跳一般 Chrome 或靠 Deep Link 猜回程。
    const redirectTo=inAndroid?'https://save-radar-gold.vercel.app/login?source=bijiabu':location.origin+location.pathname;
    const {data,error}=await dbClient.auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:inAndroid}});
    if(error)throw error;
    if(inAndroid){
      if(!data?.url)throw new Error('無法取得 Google 登入網址。');
      Android.openGoogleLogin(data.url);
    }
  }catch(e){setMessage(e.message||'Google 登入目前無法使用，請先用原本 Email／密碼登入。')}
}
window.handleAndroidOAuthCallback=url=>{
  if(!url)return;
  try{
    const callback=new URL(url);
    location.replace(location.origin+location.pathname+callback.search+callback.hash);
  }catch(e){setMessage('Google 登入回傳資料無法讀取，請再試一次。')}
};

async function fetchCloudRow(){const {data,error}=await dbClient.from('pricebook_cloud').select('snapshot,updated_at').maybeSingle();if(error)throw error;return data?{snapshot:normalizeSnapshot(data.snapshot),updated_at:data.updated_at}:null}
async function createCloudBackup(snapshot,label='自動備份',force=false){if(!session||!snapshot)return;const uid=session.user.id;assertAccount(uid);if(!force){const {data:last,error:lastErr}=await dbClient.from('pricebook_cloud_backups').select('created_at').order('created_at',{ascending:false}).limit(1).maybeSingle();if(lastErr)throw lastErr;if(last?.created_at&&Date.now()-Date.parse(last.created_at)<15*60*1000)return}assertAccount(uid);const {error}=await dbClient.from('pricebook_cloud_backups').insert({user_id:uid,snapshot:normalizeSnapshot(snapshot),label});if(error)throw error;const {data:old,error:oldErr}=await dbClient.from('pricebook_cloud_backups').select('id').order('created_at',{ascending:false}).range(30,199);if(oldErr)throw oldErr;if(old?.length){const {error:delErr}=await dbClient.from('pricebook_cloud_backups').delete().in('id',old.map(x=>x.id));if(delErr)throw delErr}}
async function upsertSnapshot(snapshot,label='自動同步',forceBackup=false){const uid=session?.user?.id;assertAccount(uid);const outgoing=normalizeSnapshot(snapshot);const current=await fetchCloudRow();assertAccount(uid);if(current&&!sameSnapshot(current.snapshot,outgoing))await createCloudBackup(current.snapshot,label==='首次雲端搬家'?'搬家前雲端備份':'同步前備份',forceBackup);assertAccount(uid);const now=new Date().toISOString();const {data,error}=await dbClient.from('pricebook_cloud').upsert({user_id:uid,snapshot:outgoing,updated_at:now},{onConflict:'user_id'}).select('updated_at').single();if(error)throw error;assertAccount(uid);if(!current||forceBackup)await createCloudBackup(outgoing,label,true);lastSeenAt=data.updated_at||now;localStorage.setItem('priceBook_cloud_seen_'+session.user.id,lastSeenAt);return outgoing}
function readLatestNativeBackup(){try{if(!window.Android||typeof Android.listAutoBackups!=='function'||typeof Android.readAutoBackup!=='function')return null;const list=JSON.parse(Android.listAutoBackups()||'[]');if(!Array.isArray(list)||!list.length)return null;const raw=Android.readAutoBackup(list[0].id);if(!raw)return null;const parsed=JSON.parse(raw);return hasData(parsed)?normalizeSnapshot(parsed):null}catch(e){console.warn('native backup read failed',e);return null}}
async function initialSync(){
  if(initializing||!session)return;
  initializing=true;const uid=session.user.id;const previous=syncState.owner();
  $('appFrame').hidden=true;setStatus('同步中…');
  try{
    syncState.claim(uid);dirty=syncState.pending(uid);if(previous&&previous!==uid)localStorage.setItem('priceBook_native_migrated_'+uid,'1');
    lastSeenAt=localStorage.getItem('priceBook_cloud_seen_'+uid)||'';
    let local=getLocal();
    if((!previous||previous===uid)&&localStorage.getItem('priceBook_native_migrated_'+uid)!=='1'){
      const native=readLatestNativeBackup();
      if(native){syncState.mark();saveLocal(mergeSnapshots(local,native));local=getLocal();dirty=true;localStorage.setItem('priceBook_native_migrated_'+uid,'1')}
    }
    if(pending()){if(!await pushNow())throw new Error('待重新同步')}
    else{
      const cloud=await fetchCloudRow();assertAccount(uid);
      const deviceDone=localStorage.getItem('priceBook_device_migrated_'+uid)==='1';
      if(!cloud||(!deviceDone&&hasData(local))){
        syncState.mark();saveLocal(cloud?mergeSnapshots(cloud.snapshot,local):local);
        if(!await pushNow('首次雲端搬家',true))throw new Error('待重新同步');
      }else{saveLocal(cloud.snapshot);lastSeenAt=cloud.updated_at}
    }
    assertAccount(uid);localStorage.setItem('priceBook_device_migrated_'+uid,'1');
    localStorage.setItem('priceBook_cloud_seen_'+uid,lastSeenAt);setStatus('雲端已同步');
  }catch(e){console.error(e);setStatus('待重新同步',true);setMessage('暫時無法同步；這台裝置的修改已保留，連線恢復後會再試。')}
  finally{initializing=false;if(session?.user?.id===uid&&syncState.owner()===uid)showApp(true);else if(session?.user?.id!==uid&&session)setTimeout(initialSync,0)}
}
async function pushNow(label='自動同步',forceBackup=false){
  if(pushPromise)return pushPromise;
  if(!session)return false;
  clearTimeout(pushTimer);pushTimer=null;
  const uid=session.user.id;
  pushPromise=(async()=>{
    try{
      for(let attempt=0;attempt<5;attempt++){
        assertAccount(uid);const source=localStorage.getItem(DATA_KEY);const local=getLocal();
        const remote=await fetchCloudRow();assertAccount(uid);
        const outgoing=remote&&(!lastSeenAt||remote.updated_at>lastSeenAt)?mergeSnapshots(remote.snapshot,local):local;
        if(!remote||!sameSnapshot(remote.snapshot,outgoing))await upsertSnapshot(outgoing,label,forceBackup);
        else lastSeenAt=remote.updated_at;
        assertAccount(uid);
        if(localStorage.getItem(DATA_KEY)!==source)continue;
        saveLocal(outgoing);dirty=!syncState.acknowledge(uid,localStorage.getItem(DATA_KEY));
        localStorage.setItem('priceBook_cloud_seen_'+uid,lastSeenAt);
        setStatus('雲端已同步');return !dirty;
      }
      dirty=true;setStatus('還有修改待同步',true);return false;
    }catch(e){console.error(e);dirty=true;setStatus('待重新同步',true);return false}
  })();
  try{return await pushPromise}finally{pushPromise=null}
}
function schedulePush(){if(!session)return;syncState.mark();dirty=true;setStatus('同步中…');clearTimeout(pushTimer);pushTimer=setTimeout(()=>pushNow(),700)}
async function pullIfNewer(){
  if(!session||initializing||pushPromise||document.hidden)return;
  if(pending()){await pushNow();return}
  if(syncState.editing($('appFrame')))return;
  const uid=session.user.id,source=localStorage.getItem(DATA_KEY);
  try{const remote=await fetchCloudRow();assertAccount(uid);
    if(pending()||pushPromise||source!==localStorage.getItem(DATA_KEY)||syncState.editing($('appFrame')))return;
    if(remote&&(!lastSeenAt||remote.updated_at>lastSeenAt)){
      saveLocal(remote.snapshot);lastSeenAt=remote.updated_at;localStorage.setItem('priceBook_cloud_seen_'+uid,lastSeenAt);
      setStatus('已更新雲端資料');try{$('appFrame').contentWindow.location.reload()}catch{}
    }
  }catch(e){console.warn(e)}
}
async function submitAuth(){const email=$('email').value.trim(),password=$('password').value;if(!email||!password)return setMessage('請輸入 Email 和密碼。');$('submitBtn').disabled=true;setMessage('');try{if(authMode==='signup'){const name=$('displayName').value.trim();const {data,error}=await dbClient.auth.signUp({email,password,options:{data:{display_name:name||email.split('@')[0]}}});if(error)throw error;if(data.session){session=data.session;await initialSync()}else{setMode('login');setMessage('註冊完成！請先到信箱點確認連結，再回來登入。')}}else{const {data,error}=await dbClient.auth.signInWithPassword({email,password});if(error)throw error;session=data.session;await initialSync()}}catch(e){setMessage(e.message||'發生錯誤，請稍後再試。')}finally{$('submitBtn').disabled=false}}
async function resetPassword(){const email=$('email').value.trim();if(!email)return setMessage('先輸入註冊時使用的 Email。');try{const {error}=await dbClient.auth.resetPasswordForEmail(email,{redirectTo:'https://save-radar-gold.vercel.app/reset-password'});if(error)throw error;setMessage('重設信已寄出，請到信箱查看。')}catch(e){setMessage(e.message||'無法寄出重設信。')}}
async function logout(){
  if(initializing)return;
  if((pending()||pushPromise)&&!await pushNow('登出前備份',true)){alert('尚有資料未同步，已保留在此裝置。請連線後再登出。');return}
  const {error}=await dbClient.auth.signOut();if(error){alert('登出失敗，請稍後再試。');return}
  clearNativeSession();session=null;showApp(false);setMessage('已登出。');
}
$('backupFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const raw=JSON.parse(await f.text());const imported=raw?.products?normalizeSnapshot(raw):raw?.data?.products?normalizeSnapshot(raw.data):null;if(!imported)throw new Error('invalid');const merged=mergeSnapshots(getLocal(),imported);syncState.mark();saveLocal(merged);if(session){dirty=true;if(!await pushNow('手動匯入備份',true)){alert('備份已匯入本機，雲端尚未同步，請稍後再試。');return}try{$('appFrame').contentWindow.location.reload()}catch{};setMessage(`已匯入 ${imported.products.length} 個商品並合併到雲端，不會清空原資料。`)}else setMessage('備份已讀取；登入後會自動與雲端資料合併。')}catch{setMessage('這個檔案不是可用的「比價簿」JSON 備份。')}finally{e.target.value=''}});
window.addEventListener('storage',e=>{if(e.key===DATA_KEY&&session){const now=e.newValue||'';if(now&&now!==lastSerialized){lastSerialized=now;schedulePush()}}});window.addEventListener('focus',pullIfNewer);document.addEventListener('visibilitychange',()=>{if(!document.hidden)pullIfNewer()});setInterval(pullIfNewer,45000);
(async()=>{
  const {data}=await dbClient.auth.getSession();
  session=data.session||null;
  if(!session)session=await restoreNativeSession();
  if(session){saveNativeSession(session);await initialSync()}else showApp(false);
})();
dbClient.auth.onAuthStateChange((event,newSession)=>{
  const changed=session?.user?.id!==newSession?.user?.id;
  session=newSession;
  if(newSession){saveNativeSession(newSession);if(changed){showApp(false);setTimeout(initialSync,0)}}
  else if(changed)showApp(false);
});
window.addEventListener('online',pullIfNewer);

window.setMode=setMode;window.submitAuth=submitAuth;window.resetPassword=resetPassword;window.logout=logout;window.signInWithGoogle=signInWithGoogle;
