const SPEND_VAPID_PUBLIC='BKdpCVRPOR7CrG6AVWWxlocVKx3cwZ_bpzw2DNbUBL46OACHoQA4gco4cQEE5YlWlloauGer5Pz0ormLHqokTrk';
function spendUrlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
function androidNativeNotifications(){try{return !!(window.Android&&typeof Android.supportsNativeNotifications==='function'&&Android.supportsNativeNotifications())}catch{return false}}
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
function spendPushSupport(){return androidNativeNotifications()||!!('serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window)}
async function ensureSpendPushSubscription(){
  if(!session)throw new Error('請先登入');
  if(androidNativeNotifications()){
    const result=String(Android.enableNativeNotifications?.()||'');
    if(result==='unavailable')throw new Error('Android 背景通知目前無法啟用');
    await saveSpendNotificationSettings({enabled:true});
    return true;
  }
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
window.spendNotifications={getSettings:getSpendNotificationSettings,saveSettings:saveSpendNotificationSettings,ensurePush:ensureSpendPushSubscription,supportsPush:spendPushSupport};

function removeSpendbookTestNotificationUi(){
  const frame=document.getElementById('appFrame');
  if(!frame)return;
  const observe=()=>{
    try{
      const d=frame.contentDocument;
      if(!d||!d.body)return;
      const clean=()=>{
        const button=d.getElementById('noticeTestBtn');
        if(button){
          const row=button.closest('.notice-actions');
          if(row)row.remove();else button.remove();
        }
      };
      clean();
      if(!d.documentElement.dataset.spendbookNoTestObserver){
        d.documentElement.dataset.spendbookNoTestObserver='1';
        new MutationObserver(clean).observe(d.body,{childList:true,subtree:true});
      }
    }catch{}
  };
  frame.addEventListener('load',()=>setTimeout(observe,0));
  setTimeout(observe,0);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',removeSpendbookTestNotificationUi,{once:true});
else removeSpendbookTestNotificationUi();

function handleSpendbookWidgetAction(){
  const params=new URLSearchParams(location.search);
  const action=(params.get('widget_action')||'').trim();
  if(!action)return;
  const allowed=new Set(['add','pickup','payment','shipping','reminder','month','today','records']);
  if(!allowed.has(action))return;
  const frame=document.getElementById('appFrame');
  if(!frame)return;
  let tries=0;
  const apply=()=>{
    tries++;
    try{
      const w=frame.contentWindow;
      if(w&&typeof w.go==='function'){
        if(action==='add')w.go('add');
        else{
          if(typeof w.setFilter==='function'){
            if(action==='pickup')w.setFilter('待取貨');
            else if(action==='payment')w.setFilter('待付款');
            else if(action==='shipping')w.setFilter('待出貨');
            else w.setFilter('全部');
          }
          w.go('records');
        }
        const cleanUrl=new URL(location.href);
        cleanUrl.searchParams.delete('widget_action');
        history.replaceState({},'',cleanUrl.pathname+(cleanUrl.search||'')+(cleanUrl.hash||''));
        return true;
      }
    }catch{}
    return false;
  };
  if(apply())return;
  const timer=setInterval(()=>{
    if(apply()||tries>40)clearInterval(timer);
  },250);
  frame.addEventListener('load',()=>setTimeout(apply,0),{once:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',handleSpendbookWidgetAction,{once:true});
else handleSpendbookWidgetAction();
