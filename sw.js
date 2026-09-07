const CACHE='bijiabu-cloud-1.1';
const ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest',
  './pricebook/',
  './pricebook/index.html',
  './pricebook/app.html',
  './pricebook/cloud.js',
  './spendbook/',
  './spendbook/index.html',
  './spendbook/app.html',
  './spendbook/cloud.js',
  './travelmate/app/',
  './travelmate/app/index.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('bijiabu-cloud-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;

  const fetchFresh=async()=>{
    const fresh=await fetch(req,{cache:'no-store'});
    const cache=await caches.open(CACHE);
    cache.put(req,fresh.clone());
    return fresh;
  };

  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{return await fetchFresh();}
      catch(e){
        const exact=await caches.match(req);
        if(exact)return exact;
        if(url.pathname.includes('/travelmate/app'))return (await caches.match('./travelmate/app/index.html'))||Response.error();
        if(url.pathname.includes('/spendbook'))return (await caches.match('./spendbook/index.html'))||Response.error();
        if(url.pathname.includes('/pricebook/app'))return (await caches.match('./pricebook/app.html'))||Response.error();
        if(url.pathname.includes('/pricebook'))return (await caches.match('./pricebook/index.html'))||Response.error();
        return (await caches.match('./index.html'))||Response.error();
      }
    })());
    return;
  }

  event.respondWith(fetchFresh().catch(()=>caches.match(req).then(r=>r||Response.error())));
});