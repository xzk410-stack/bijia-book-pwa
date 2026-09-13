const CACHE='spendbook-v8';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./cloud.js','./app.html','./status-filter-fix.js','./ui-finish.js'];
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