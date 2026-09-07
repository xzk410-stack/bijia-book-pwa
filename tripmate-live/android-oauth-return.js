(()=>{
  const ua=navigator.userAgent||'';
  const isAndroid=/Android/i.test(ua);
  const isTripMate=/TripMateAndroid\//i.test(ua);
  const params=new URLSearchParams(location.search);
  const hasOAuth=params.has('code')||params.has('error')||params.has('error_code');
  if(!isAndroid||isTripMate||!hasOAuth)return;

  const deep=new URL('tripmate://auth/callback');
  for(const [k,v] of params.entries()) deep.searchParams.append(k,v);
  if(location.hash) deep.hash=location.hash;

  const style=document.createElement('style');
  style.textContent=`
    #tripmateOauthReturn{position:fixed;inset:0;z-index:2147483647;background:#fffaf6;display:grid;place-items:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif;color:#25322d}
    #tripmateOauthReturn .box{width:min(420px,100%);background:#fff;border:1px solid #eee7e2;border-radius:26px;padding:28px 22px;box-shadow:0 16px 44px rgba(54,63,58,.12);text-align:center}
    #tripmateOauthReturn .ico{font-size:46px;margin-bottom:10px}#tripmateOauthReturn h1{font-size:24px;margin:0 0 8px}#tripmateOauthReturn p{font-size:14px;line-height:1.7;color:#7d8984;margin:0 0 20px}
    #tripmateOauthReturn a{display:flex;min-height:54px;align-items:center;justify-content:center;border-radius:16px;background:#356859;color:#fff;text-decoration:none;font-weight:800;font-size:16px}
    #tripmateOauthReturn button{margin-top:12px;border:0;background:transparent;color:#6f7b76;font-size:13px;padding:10px}
  `;
  document.head.appendChild(style);

  const overlay=document.createElement('div');
  overlay.id='tripmateOauthReturn';
  overlay.innerHTML=`<div class="box"><div class="ico">🧳</div><h1>Google 登入完成</h1><p>回到旅伴 App 繼續使用。</p><a id="tripmateReturnApp" href="${deep.toString()}">回到旅伴 App</a><button id="tripmateStayWeb" type="button">留在網頁版</button></div>`;
  document.documentElement.appendChild(overlay);

  document.getElementById('tripmateStayWeb')?.addEventListener('click',()=>overlay.remove());

  // Chrome may allow the first handoff automatically after the OAuth redirect.
  // If it blocks automatic app launching, the visible button provides a reliable user gesture fallback.
  setTimeout(()=>{try{location.href=deep.toString()}catch(_){ }},180);
})();
