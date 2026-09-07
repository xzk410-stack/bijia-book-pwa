(()=>{
  const SUPABASE_URL='https://dfvrlddywisvlnsqdjuf.supabase.co';
  const SUPABASE_KEY='sb_publishable_RO7yssf3v-kRdtI12fVx8w_gnpcKK5I';
  let client=null,scheduled=false;
  const GOOGLE_MARK='<svg aria-hidden="true" viewBox="0 0 18 18" style="width:20px;height:20px;display:block;flex:0 0 auto"><path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.482h4.844c-.209 1.125-.844 2.078-1.797 2.716v2.258h2.908c1.702-1.567 2.685-3.878 2.685-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.955-2.18l-2.908-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.713H.956v2.332A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.963 10.708A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.281-1.708V4.96H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.04l3.007-2.332z"/><path fill="#EA4335" d="M9 3.579c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.96l3.007 2.332C4.672 5.164 6.656 3.579 9 3.579z"/></svg>';

  const text=e=>String(e?.innerText||e?.textContent||'').replace(/\s+/g,' ').trim();
  const visible=e=>{if(!e||!e.isConnected)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};

  function ensureStyle(){
    if(document.getElementById('travelGoogleStyle'))return;
    const s=document.createElement('style');s.id='travelGoogleStyle';s.textContent=`
      #travelGoogleWrap{width:100%;margin:14px 0 0!important}
      #travelGoogleDivider{display:flex;align-items:center;gap:10px;color:#8a9590;font-size:12px;margin:2px 0 10px}
      #travelGoogleDivider:before,#travelGoogleDivider:after{content:"";height:1px;background:#e7ece9;flex:1}
      #travelGoogleLogin{width:100%;min-height:50px;border-radius:15px;border:1px solid #dce5e1;background:#fff;color:#25322d;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 2px 8px rgba(53,104,89,.06)}
      #travelGoogleLogin:disabled{opacity:.62}
      #travelGoogleError{font-size:12px;line-height:1.55;color:#8a5c22;background:#fff7e8;border:1px solid #f0dfba;border-radius:12px;padding:9px 11px;margin-top:8px}
      [data-tripmate-legacy-download="1"]{display:none!important}
    `;document.head.appendChild(s);
  }

  function loadSupabase(){
    if(window.supabase?.createClient)return Promise.resolve();
    return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  }
  async function getClient(){await loadSupabase();if(!client)client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);return client}

  function removeLegacyDownloadCard(){
    [...document.querySelectorAll('div,section,article')].forEach(el=>{
      const t=text(el);
      if(!t||t.length>180)return;
      if((t.includes('Android 1.2.7')||t.includes('定位修復版'))&&t.includes('安裝最新版')){
        el.setAttribute('data-tripmate-legacy-download','1');
      }
    });
  }

  function findLoginCard(){
    const heading=[...document.querySelectorAll('h1,h2,h3,strong')].find(e=>visible(e)&&text(e).includes('歡迎回來'));
    if(!heading)return null;
    let p=heading.parentElement;
    for(let i=0;i<6&&p;i++,p=p.parentElement){
      if(p.querySelector('input[type="email"]')&&p.querySelector('input[type="password"]'))return p;
    }
    return heading.parentElement;
  }

  function makeWrap(){
    const wrap=document.createElement('div');wrap.id='travelGoogleWrap';
    const div=document.createElement('div');div.id='travelGoogleDivider';div.textContent='或';wrap.appendChild(div);
    const btn=document.createElement('button');btn.id='travelGoogleLogin';btn.type='button';btn.innerHTML=GOOGLE_MARK+'<span>使用 Google 登入</span>';wrap.appendChild(btn);
    btn.addEventListener('click',async()=>{
      btn.disabled=true;btn.querySelector('span').textContent='正在前往 Google…';
      document.getElementById('travelGoogleError')?.remove();
      try{const c=await getClient();const {error}=await c.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)throw error}
      catch(e){btn.disabled=false;btn.querySelector('span').textContent='使用 Google 登入';const er=document.createElement('div');er.id='travelGoogleError';er.textContent=e?.message||'Google 登入目前無法使用。';wrap.appendChild(er)}
    });
    return wrap;
  }

  function ensureGoogle(){
    ensureStyle();removeLegacyDownloadCard();
    const old=document.getElementById('travelGoogleWrap');if(old&&visible(old))return;
    old?.remove();
    const card=findLoginCard();if(!card)return;
    const resend=[...card.querySelectorAll('div,p,span')].find(e=>visible(e)&&text(e).includes('還沒收到驗證信'));
    const buttons=[...card.querySelectorAll('button')].filter(visible);
    const create=buttons.find(b=>text(b).includes('建立帳號'));
    const login=buttons.find(b=>/^登入$/.test(text(b)));
    const anchor=resend||create?.parentElement||login?.parentElement;
    const wrap=makeWrap();
    if(anchor&&anchor.parentElement)anchor.insertAdjacentElement('afterend',wrap);else card.appendChild(wrap);
  }

  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;ensureGoogle()})}
  function boot(){ensureGoogle();new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});window.addEventListener('pageshow',schedule);window.addEventListener('focus',schedule)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();