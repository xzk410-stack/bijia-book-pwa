(()=>{
  const SUPABASE_URL='https://dfvrlddywisvlnsqdjuf.supabase.co';
  const SUPABASE_KEY='sb_publishable_RO7yssf3v-kRdtI12fVx8w_gnpcKK5I';
  const RETURNING_FROM_OAUTH=location.hash.includes('access_token=')||/[?&]code=/.test(location.search);
  let client=null,observer=null;

  function visible(el){
    if(!el)return false;
    const s=getComputedStyle(el);
    const r=el.getBoundingClientRect();
    return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
  }

  function loadSupabase(){
    if(window.supabase&&typeof window.supabase.createClient==='function')return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src&&s.src.includes('@supabase/supabase-js'));
      if(existing){
        let tries=0;
        const timer=setInterval(()=>{
          if(window.supabase&&typeof window.supabase.createClient==='function'){clearInterval(timer);resolve();}
          else if(++tries>100){clearInterval(timer);reject(new Error('登入元件載入逾時'));}
        },50);
        return;
      }
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
  }

  async function getClient(){
    await loadSupabase();
    if(!client)client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    return client;
  }

  function showError(text){
    let box=document.getElementById('travelGoogleError');
    if(!box){
      box=document.createElement('div');box.id='travelGoogleError';
      box.style.cssText='font-size:12px;line-height:1.55;color:#8a5c22;background:#fff7e8;border:1px solid #f0dfba;border-radius:12px;padding:9px 11px;margin:8px 0;';
      const btn=document.getElementById('travelGoogleLogin');
      btn?.parentNode?.insertBefore(box,btn.nextSibling);
    }
    box.textContent=text;
  }

  async function googleLogin(){
    const btn=document.getElementById('travelGoogleLogin');
    if(btn){btn.disabled=true;btn.textContent='正在前往 Google…';}
    try{
      const c=await getClient();
      const redirectTo=location.origin+location.pathname;
      const {error}=await c.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
      if(error)throw error;
    }catch(e){
      if(btn){btn.disabled=false;btn.innerHTML='<span style="font-size:18px;font-weight:900">G</span><span>使用 Google 登入</span>';}
      showError(e?.message||'Google 登入目前無法使用，請先用原本 Email／密碼登入。');
    }
  }

  function addButton(){
    if(document.getElementById('travelGoogleLogin')){observer?.disconnect();return true;}
    const email=[...document.querySelectorAll('input[type="email"],input[autocomplete="email"]')].find(visible);
    const password=[...document.querySelectorAll('input[type="password"]')].find(visible);
    if(!email||!password)return false;

    const form=email.closest('form');
    const anchor=form||email.closest('label')||email;
    if(!anchor.parentNode)return false;

    const wrap=document.createElement('div');
    wrap.id='travelGoogleWrap';
    wrap.style.cssText='width:100%;margin:0 0 14px;';
    const btn=document.createElement('button');
    btn.id='travelGoogleLogin';btn.type='button';
    btn.style.cssText='width:100%;min-height:48px;border-radius:14px;border:1px solid #dce5e1;background:#fff;color:#25322d;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 2px 8px rgba(53,104,89,.06);';
    btn.innerHTML='<span style="font-size:18px;font-weight:900">G</span><span>使用 Google 登入</span>';
    btn.addEventListener('click',googleLogin);
    wrap.appendChild(btn);

    const divider=document.createElement('div');
    divider.textContent='或使用 Email／密碼';
    divider.style.cssText='text-align:center;color:#8a9590;font-size:11px;margin:10px 0 0;';
    wrap.appendChild(divider);
    anchor.parentNode.insertBefore(wrap,anchor);
    observer?.disconnect();
    return true;
  }

  function boot(){
    if(!addButton()){
      observer=new MutationObserver(addButton);
      observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','style','class']});
    }
    getClient().then(c=>c.auth.getSession()).then(({data})=>{
      if(RETURNING_FROM_OAUTH&&data?.session){
        sessionStorage.setItem('travel_google_oauth_ok','1');
        location.reload();
      }
    }).catch(()=>{});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
