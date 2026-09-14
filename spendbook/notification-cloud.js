const SPEND_VAPID_PUBLIC='BKdpCVRPOR7CrG6AVWWxlocVKx3cwZ_bpzw2DNbUBL46OACHoQA4gco4cQEE5YlWlloauGer5Pz0ormLHqokTrk';
function spendUrlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
async function getSpendNotificationSettings(){
  if(!session)return null;
  const {data,error}=await db.from('spend_notification_settings').select('*').eq('user_id',session.user.id).maybeSingle();
  if(error)throw error;
  return data||{user_id:session.user.id,enabled:true,payment_day_before:true,payment_due_day:true,shipping_due_day:true,shipping_overdue:true,pickup:true,reminder_hour:9,timezone:'Asia/Taipei'};
}
async function saveSpendNotificationSettings(patch){
  if(!session)throw new Error('請先登入');
  const current=await getSpendNotificationSettings();
  const row={...current,...patch,user_id:session.user.id,timezone:'Asia/Taipei',updated_at:new Date().toISOString()};
  const {data,error}=await db.from('spend_notification_settings').upsert(row,{onConflict:'user_id'}).select('*').single();
  if(error)throw error;
  return data;
}
function spendPushSupport(){return !!('serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window)}
async function ensureSpendPushSubscription(){
  if(!session)throw new Error('請先登入');
  if(!spendPushSupport())throw new Error('這個開啟方式不支援背景推播');
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('通知權限尚未允許');
  const reg=await navigator.serviceWorker.register('./sw.js');
  await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:spendUrlBase64ToUint8Array(SPEND_VAPID_PUBLIC)});
  const j=sub.toJSON(),p256dh=j.keys?.p256dh||'',authKey=j.keys?.auth||'';
  if(!p256dh||!authKey)throw new Error('無法取得推播金鑰');
  const row={user_id:session.user.id,endpoint:j.endpoint,p256dh,auth_key:authKey,user_agent:navigator.userAgent,active:true,updated_at:new Date().toISOString()};
  const {error}=await db.from('spend_push_subscriptions').upsert(row,{onConflict:'endpoint'});
  if(error)throw error;
  await saveSpendNotificationSettings({enabled:true});
  return true;
}
async function testSpendPush(){
  if(!session)throw new Error('請先登入');
  const current=(await db.auth.getSession()).data.session;
  if(!current?.access_token)throw new Error('登入已失效，請重新登入');
  const res=await fetch(`${SUPABASE_URL}/functions/v1/spend-test-push`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${current.access_token}`,'apikey':SUPABASE_KEY},body:'{}'});
  const out=await res.json().catch(()=>({}));
  if(!res.ok||!out?.ok)throw new Error(out?.error||'測試通知傳送失敗');
  return out;
}
window.spendNotifications={getSettings:getSpendNotificationSettings,saveSettings:saveSpendNotificationSettings,ensurePush:ensureSpendPushSubscription,testPush:testSpendPush,supportsPush:spendPushSupport};
