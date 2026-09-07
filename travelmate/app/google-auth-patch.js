(()=>{
  const SUPABASE_URL='https://dfvrlddywisvlnsqdjuf.supabase.co';
  const SUPABASE_KEY='sb_publishable_RO7yssf3v-kRdtI12fVx8w_gnpcKK5I';
  const RETURNING_FROM_OAUTH=location.hash.includes('access_token=')||/[?&]code=/.test(location.search);
  let client=null,observer=null,scheduled=false;

  function visible(el){
    if(!el||!el.isConnected)return false;
    const s=getComputedStyle(el);
    const r=el.getBoundingClientRect();
    return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)!==0&&r.width>0&&r.height>0;
  }

  function cleanText(el){
    return String(el?.innerText||el?.textContent||'').replace(/\s+/g,' ').trim();
  }

  function loadSupabase(){
    if(window.supabase&&typeof window.supabase.createClient==='function')return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src&&s.src.includes('@supabase/supabase-js'));
      if(existing){
        let tries=0;
        const timer=setInterval(()=>{
          if(window.supabase&&typeof window.supabase.createClient==='function'){clearInterval(timer);resolve();}
          else if(++tries>120){clearInterval(timer);reject(new Error('登入元件載入逾時'));}
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

  function ensureStyle(){
    if(document.getElementById('travelGoogleStyle'))return;
    const style=document.createElement('style');
    style.id='travelGoogleStyle';
    style.textContent=`
      #travelGoogleWrap{width:100%;margin:12px 0 2px!important}
      #travelGoogleDivider{display:flex;align-items:center;gap:10px;color:#8a9590;font-size:11px;margin:4px 0 10px}
      #travelGoogleDivider:before,#travelGoogleDivider:after{content:"";height:1px;background:#e7ece9;flex:1}
      #travelGoogleLogin{width:100%;min-height:48px;border-radius:14px;border:1px solid #dce5e1;background:#fff;color:#25322d;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 2px 8px rgba(53,104,89,.06);-webkit-tap-highlight-color:transparent}
      #travelGoogleLogin:disabled{opacity:.62}
      #travelGoogleMark{width:23px;height:23px;border-radius:50%;display:grid;place-items:center;border:1px solid #e0e5e2;background:#fff;color:#4285f4;font-size:14px;font-weight:900}
      #travelGoogleHint{text-align:center;color:#73817a;font-size:11px;line-height:1.5;margin-top:8px}
      #travelGoogleError{font-size:12px;line-height:1.55;color:#8a5c22;background:#fff7e8;border:1px solid #f0dfba;border-radius:12px;padding:9px 11px;margin:8px 0}
      @media(max-width:560px){#travelGoogleLogin{min-height:46px}}
    `;
    document.head.appendChild(style);
  }

  function showError(text){
    let box=document.getElementById('travelGoogleError');
    if(!box){
      box=document.createElement('div');
      box.id='travelGoogleError';
      const wrap=document.getElementById('travelGoogleWrap');
      wrap?.appendChild(box);
    }
    box.textContent=text;
  }

  async function googleLogin(){
    const btn=document.getElementById('travelGoogleLogin');
    if(btn){btn.disabled=true;btn.querySelector('span:last-child').textContent='正在前往 Google…';}
    const err=document.getElementById('travelGoogleError');
    if(err)err.remove();
    try{
      const c=await getClient();
      const redirectTo=location.origin+location.pathname;
      const {error}=await c.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
      if(error)throw error;
    }catch(e){
      if(btn){btn.disabled=false;btn.querySelector('span:last-child').textContent='使用 Google 登入';}
      showError(e?.message||'Google 登入目前無法使用，請先用原本 Email／密碼登入。');
    }
  }

  function makeWrap(){
    const wrap=document.createElement('div');
    wrap.id='travelGoogleWrap';

    const divider=document.createElement('div');
    divider.id='travelGoogleDivider';
    divider.textContent='或';
    wrap.appendChild(divider);

    const btn=document.createElement('button');
    btn.id='travelGoogleLogin';
    btn.type='button';
    btn.innerHTML='<span id="travelGoogleMark">G</span><span>使用 Google 登入</span>';
    btn.addEventListener('click',googleLogin);
    wrap.appendChild(btn);

    const hint=document.createElement('div');
    hint.id='travelGoogleHint';
    hint.textContent='也可以直接用 Google 帳號快速登入';
    wrap.appendChild(hint);
    return wrap;
  }

  function findEmailSurface(){
    const email=[...document.querySelectorAll('input[type="email"],input[autocomplete="email"],input[name*="email" i]')].find(visible);
    const password=[...document.querySelectorAll('input[type="password"],input[autocomplete*="password"]')].find(visible);
    if(!email||!password)return null;
    const form=email.closest('form');
    if(form&&visible(form))return {mode:'after',anchor:form};

    let container=email.parentElement;
    for(let i=0;i<5&&container;i++,container=container.parentElement){
      if(container.contains(password)&&visible(container)){
        const buttons=[...container.querySelectorAll('button,input[type="submit"]')].filter(visible);
        if(buttons.length)return {mode:'append',anchor:container};
      }
    }
    return {mode:'after',anchor:password.closest('label')||password};
  }

  function findWelcomeSurface(){
    const buttons=[...document.querySelectorAll('button,[role="button"],a')].filter(visible);
    const loginButtons=buttons.filter(el=>/^(登入|登 入|建立帳號|建立帳戶|註冊|登入帳號|已有帳號)/.test(cleanText(el)));
    if(!loginButtons.length)return null;

    const primary=loginButtons[0];
    let container=primary.parentElement;
    for(let i=0;i<4&&container;i++,container=container.parentElement){
      const hits=loginButtons.filter(b=>container.contains(b));
      if(hits.length>=2&&visible(container))return {mode:'append',anchor:container};
    }
    return {mode:'after',anchor:primary};
  }

  function placeWrap(target,wrap){
    if(!target?.anchor||!target.anchor.isConnected)return false;
    if(target.mode==='append')target.anchor.appendChild(wrap);
    else target.anchor.insertAdjacentElement('afterend',wrap);
    return visible(wrap);
  }

  function addButton(){
    ensureStyle();
    const existing=document.getElementById('travelGoogleWrap');
    if(existing&&visible(existing))return true;
    if(existing)existing.remove();

    const target=findEmailSurface()||findWelcomeSurface();
    if(!target)return false;
    return placeWrap(target,makeWrap());
  }

  function scheduleAdd(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      addButton();
    });
  }

  function boot(){
    addButton();
    observer=new MutationObserver(scheduleAdd);
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','style','class','aria-hidden']});
    window.addEventListener('pageshow',scheduleAdd);
    window.addEventListener('focus',scheduleAdd);

    getClient().then(c=>c.auth.getSession()).then(({data})=>{
      if(RETURNING_FROM_OAUTH&&data?.session){
        sessionStorage.setItem('travel_google_oauth_ok','1');
        const clean=location.origin+location.pathname;
        history.replaceState(null,'',clean);
        location.reload();
      }
    }).catch(()=>{});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();