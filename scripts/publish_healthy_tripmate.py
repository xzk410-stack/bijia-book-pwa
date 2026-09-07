from pathlib import Path
import re

src = Path('/tmp/tripmate.html').read_text(encoding='utf-8')
src = src.replace('<head>', '<head>\n<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n<meta http-equiv="Pragma" content="no-cache">\n<meta http-equiv="Expires" content="0">', 1)
src = re.sub(r'<link rel="apple-touch-icon"[^>]*>', '<link rel="apple-touch-icon" href="./icon.svg?v=20260907">', src, count=1)
src = re.sub(r'<link rel="icon"[^>]*>', '<link rel="icon" type="image/svg+xml" href="./icon.svg?v=20260907">', src, count=1)

google_patch = r'''
<style id="tripmateGoogleStyle">
#tripmateGoogleWrap{width:100%;margin:3px 0 0}
#tripmateGoogleDivider{display:flex;align-items:center;gap:10px;color:#9aa19e;font-size:12px;margin:3px 0 10px}
#tripmateGoogleDivider:before,#tripmateGoogleDivider:after{content:"";height:1px;background:#ebe9e5;flex:1}
#tripmateGoogleLogin{width:100%;min-height:48px;border:1px solid #deddd9;border-radius:13px;background:#fff;color:#25322d;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 2px 8px rgba(53,104,89,.05)}
#tripmateGoogleLogin:disabled{opacity:.6}
#tripmateGoogleError{font-size:11px;color:#8a5c22;background:#fff7e8;border:1px solid #f0dfba;border-radius:11px;padding:8px 10px;line-height:1.5;margin-top:8px}
</style>
<script data-tripmate-google-auth="stable-20260907">
(()=>{
  const SB_URL='https://dfvrlddywisvlnsqdjuf.supabase.co';
  const SB_KEY='sb_publishable_RO7yssf3v-kRdtI12fVx8w_gnpcKK5I';
  const APP_SESSION_KEY='tripmate_ios_session_v120';
  const G='<svg aria-hidden="true" viewBox="0 0 18 18" style="width:20px;height:20px;display:block"><path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.482h4.844c-.209 1.125-.844 2.078-1.797 2.716v2.258h2.908c1.702-1.567 2.685-3.878 2.685-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.955-2.18l-2.908-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.713H.956v2.332A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.963 10.708A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.281-1.708V4.96H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.04l3.007-2.332z"/><path fill="#EA4335" d="M9 3.579c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.96l3.007 2.332C4.672 5.164 6.656 3.579 9 3.579z"/></svg>';
  let client=null,loading=null,syncing=false;
  const cleanUrl=()=>location.origin+location.pathname;
  const toAppSession=s=>({access_token:s.access_token,refresh_token:s.refresh_token,expires_in:s.expires_in,expires_at:s.expires_at,token_type:s.token_type||'bearer',user:s.user});
  const acceptSession=s=>{
    if(!s?.access_token||!s?.user||syncing)return false;
    syncing=true;
    localStorage.setItem(APP_SESSION_KEY,JSON.stringify(toAppSession(s)));
    history.replaceState(null,'',cleanUrl());
    location.reload();
    return true;
  };
  const loadSdk=()=>{
    if(window.supabase?.createClient)return Promise.resolve();
    if(loading)return loading;
    loading=new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload=resolve;s.onerror=()=>reject(new Error('Google 登入元件載入失敗'));
      document.head.appendChild(s);
    });
    return loading;
  };
  async function getClient(){
    await loadSdk();
    if(!client){
      client=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,detectSessionInUrl:true,flowType:'pkce'}});
      client.auth.onAuthStateChange((_event,session)=>{if(session)acceptSession(session)});
    }
    return client;
  }
  async function recoverOAuth(){
    if(!/[?&]code=/.test(location.search)&&!location.hash.includes('access_token='))return;
    try{
      const c=await getClient();
      for(let i=0;i<12;i++){
        const {data}=await c.auth.getSession();
        if(acceptSession(data?.session))return;
        await new Promise(r=>setTimeout(r,250));
      }
    }catch(e){console.warn('Google OAuth recovery',e)}
  }
  function ensureButton(){
    const auth=document.querySelector('.login-card .authbox');
    if(!auth||document.getElementById('tripmateGoogleWrap'))return;
    const wrap=document.createElement('div');wrap.id='tripmateGoogleWrap';
    wrap.innerHTML='<div id="tripmateGoogleDivider">或</div><button type="button" id="tripmateGoogleLogin">'+G+'<span>使用 Google 登入</span></button>';
    const meta=auth.querySelector('.meta');
    if(meta)auth.insertBefore(wrap,meta);else auth.appendChild(wrap);
    wrap.querySelector('#tripmateGoogleLogin').addEventListener('click',async()=>{
      const btn=wrap.querySelector('#tripmateGoogleLogin');const label=btn.querySelector('span');
      btn.disabled=true;label.textContent='正在前往 Google…';
      document.getElementById('tripmateGoogleError')?.remove();
      try{
        const c=await getClient();
        const {error}=await c.auth.signInWithOAuth({provider:'google',options:{redirectTo:cleanUrl()}});
        if(error)throw error;
      }catch(e){
        btn.disabled=false;label.textContent='使用 Google 登入';
        const box=document.createElement('div');box.id='tripmateGoogleError';box.textContent=e?.message||'Google 登入目前無法使用';wrap.appendChild(box);
      }
    });
  }
  const boot=()=>{
    ensureButton();recoverOAuth();
    new MutationObserver(ensureButton).observe(document.documentElement,{subtree:true,childList:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
</script>
'''

src = src.replace('</body>', google_patch + '\n</body>', 1)
out = Path('tripmate-live')
out.mkdir(exist_ok=True)
(out / 'index.html').write_text(src, encoding='utf-8')
(out / 'icon.svg').write_text(Path('travelmate/app/icon.svg').read_text(encoding='utf-8'), encoding='utf-8')
(out / 'manifest.webmanifest').write_text('{"name":"旅伴","short_name":"旅伴","start_url":"./","scope":"./","display":"standalone","background_color":"#fffaf6","theme_color":"#fffaf6","icons":[]}', encoding='utf-8')

assert '歡迎回到旅伴' in src
assert '使用 Google 登入' in src
assert '}tate' not in src
assert 'a}ync' not in src
print('published healthy TripMate', len(src))
