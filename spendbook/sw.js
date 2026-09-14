const CACHE='spendbook-v9';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./cloud.js','./notification-cloud.js','./app.html','./deadline-reminder.js','./status-filter-fix.js','./ui-finish.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('spendbook-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
async function injectAppScripts(response){
  if(!response||!response.ok)return response;
  let text=await response.text();
  if(!text.includes('status-filter-fix.js'))text=text.replace('</body>','<script src="./status-filter-fix.js?v=20260914-status2"></script></body>');
  if(!text.includes('ui-finish.js'))text=text.replace('</body>','<script src="./ui-finish.js?v=20260914-ui2"></script></body>');
  return new Response(text,{status:response.status,statusText:response.statusText,headers:response.headers});
}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  const isApp=u.pathname.endsWith('/spendbook/app.html');
  const fresh=async()=>{
    const raw=await fetch(e.request,{cache:'no-store'});
    const response=isApp?await injectAppScripts(raw):raw;
    const c=response.clone();
    caches.open(CACHE).then(x=>x.put(e.request,c));
    return response;
  };
  if(e.request.mode==='navigate'){
    e.respondWith(fresh().catch(async()=>{
      const cached=await caches.match(e.request);
      if(cached)return isApp?injectAppScripts(cached):cached;
      return caches.match('./index.html');
    }));
    return;
  }
  e.respondWith(fresh().catch(async()=>{
    const cached=await caches.match(e.request);
    if(cached)return isApp?injectAppScripts(cached):cached;
    return Response.error();
  }));
});
self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{try{data={body:event.data?.text()||''}}catch{}}
  const title=data.title||'我的消費簿';
  const url=(data.url&&data.url!=='/')?data.url:'/bijia-book-pwa/spendbook/';
  event.waitUntil(self.registration.showNotification(title,{body:data.body||'',icon:'./icon.svg',badge:'./icon.svg',tag:data.tag||'spend-reminder',data:{url},renotify:true}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification?.data?.url||'/bijia-book-pwa/spendbook/';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){if('focus' in client&&client.url.includes('/bijia-book-pwa/spendbook/')){client.navigate(target);return client.focus()}}
    return clients.openWindow?clients.openWindow(target):undefined;
  }));
});
