const VERSION='tripmate-live-20260914-r1';
const SCOPE_PATH='/bijia-book-pwa/tripmate-live/';

self.addEventListener('install',event=>{
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    await self.clients.claim();
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      try{
        const url=new URL(client.url);
        if(url.origin!==self.location.origin||!url.pathname.startsWith(SCOPE_PATH))continue;
        if(url.searchParams.get('__tripmate_rev')===VERSION)continue;
        url.searchParams.set('__tripmate_rev',VERSION);
        await client.navigate(url.href);
      }catch(_){ }
    }
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(SCOPE_PATH))return;
  event.respondWith((async()=>{
    try{
      return await fetch(request,{cache:'no-store'});
    }catch(_){
      return fetch(request);
    }
  })());
});
