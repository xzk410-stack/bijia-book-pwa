from pathlib import Path

# ---- cloud.js ----
p=Path('pricebook/cloud.js')
s=p.read_text(encoding='utf-8')
old="const dbClient=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);"
new="const dbClient=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});"
if old not in s:
    raise SystemExit('createClient line not found')
s=s.replace(old,new,1)

marker="const $=id=>document.getElementById(id);\n"
helpers="""const $=id=>document.getElementById(id);

function saveNativeSession(s){
  try{
    if(window.Android&&typeof Android.saveAuthSession==='function'&&s?.access_token&&s?.refresh_token){
      Android.saveAuthSession(s.access_token,s.refresh_token);
    }
  }catch{}
}

async function restoreNativeSession(){
  try{
    if(!(window.Android&&typeof Android.loadAuthSession==='function'))return null;
    const raw=JSON.parse(Android.loadAuthSession()||'{}');
    if(!raw.access_token||!raw.refresh_token)return null;
    const {data,error}=await dbClient.auth.setSession({access_token:raw.access_token,refresh_token:raw.refresh_token});
    if(error||!data?.session)return null;
    saveNativeSession(data.session);
    return data.session;
  }catch(e){
    console.warn('native auth restore failed',e);
    return null;
  }
}

function clearNativeSession(){
  try{if(window.Android&&typeof Android.clearAuthSession==='function')Android.clearAuthSession()}catch{}
}
"""
if marker not in s:
    raise SystemExit('helper marker not found')
s=s.replace(marker,helpers,1)

old="async function logout(){try{if(dirty)await pushNow('登出前備份',true)}catch{}await dbClient.auth.signOut();session=null;localStorage.removeItem(DATA_KEY);showApp(false);setMessage('已登出；此裝置畫面資料已清除，雲端資料仍保留。')}"
new="async function logout(){try{if(dirty)await pushNow('登出前備份',true)}catch{}clearNativeSession();await dbClient.auth.signOut();session=null;localStorage.removeItem(DATA_KEY);showApp(false);setMessage('已登出；此裝置畫面資料已清除，雲端資料仍保留。')}"
if old not in s:
    raise SystemExit('logout block not found')
s=s.replace(old,new,1)

old="(async()=>{const {data}=await dbClient.auth.getSession();session=data.session||null;if(session)await initialSync();else showApp(false)})();\ndbClient.auth.onAuthStateChange(async(_event,newSession)=>{if(newSession&&!session){session=newSession;await initialSync()}else if(!newSession&&session){session=null;showApp(false)}});"
new="""(async()=>{
  const {data}=await dbClient.auth.getSession();
  session=data.session||null;
  if(!session)session=await restoreNativeSession();
  if(session){saveNativeSession(session);await initialSync()}else showApp(false);
})();
dbClient.auth.onAuthStateChange(async(event,newSession)=>{
  if(newSession){
    saveNativeSession(newSession);
    const first=!session;
    session=newSession;
    if(first)await initialSync();
  }else if(event==='SIGNED_OUT'&&session){
    session=null;
    showApp(false);
  }
});"""
if old not in s:
    raise SystemExit('startup auth block not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# ---- MainActivity.java ----
p=Path('android/pricebook/app/src/main/java/com/bijiabu/app/MainActivity.java')
s=p.read_text(encoding='utf-8')
if 'import android.content.SharedPreferences;' not in s:
    s=s.replace('import android.content.Intent;\n','import android.content.Intent;\nimport android.content.SharedPreferences;\n',1)

old='private static final String AUTH_REDIRECT_PATH = "/login";\n'
new='private static final String AUTH_REDIRECT_PATH = "/login";\n    private static final String AUTH_PREFS = "bijiabu_auth_session";\n    private static final String APP_HOST = "xzk410-stack.github.io";\n    private static final String APP_PATH_PREFIX = "/bijia-book-pwa/pricebook/";\n'
if old not in s:
    raise SystemExit('auth constants marker not found')
s=s.replace(old,new,1)

old='private String pendingCloudMimeType;\n'
new='private String pendingCloudMimeType;\n    private volatile String currentPageUrl = START_URL;\n'
if old not in s:
    raise SystemExit('field marker not found')
s=s.replace(old,new,1)

client_marker='''        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {'''
client_repl='''        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                currentPageUrl = url == null ? "" : url;
                super.onPageFinished(view, url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {'''
if client_marker not in s:
    raise SystemExit('WebViewClient marker not found')
s=s.replace(client_marker,client_repl,1)

bridge_marker='''    private class AndroidBridge {
        @JavascriptInterface
        public void openGoogleLogin(String url) {'''
bridge_repl='''    private boolean isTrustedPricebookPage() {
        try {
            Uri uri = Uri.parse(currentPageUrl == null ? "" : currentPageUrl);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && APP_HOST.equalsIgnoreCase(uri.getHost())
                    && uri.getPath() != null
                    && uri.getPath().startsWith(APP_PATH_PREFIX);
        } catch (Exception e) {
            return false;
        }
    }

    private class AndroidBridge {
        @JavascriptInterface
        public void saveAuthSession(String accessToken, String refreshToken) {
            if (!isTrustedPricebookPage()) return;
            if (accessToken == null || accessToken.isEmpty() || refreshToken == null || refreshToken.isEmpty()) return;
            getSharedPreferences(AUTH_PREFS, MODE_PRIVATE)
                    .edit()
                    .putString("access_token", accessToken)
                    .putString("refresh_token", refreshToken)
                    .apply();
        }

        @JavascriptInterface
        public String loadAuthSession() {
            if (!isTrustedPricebookPage()) return "{}";
            try {
                SharedPreferences prefs = getSharedPreferences(AUTH_PREFS, MODE_PRIVATE);
                JSONObject out = new JSONObject();
                out.put("access_token", prefs.getString("access_token", ""));
                out.put("refresh_token", prefs.getString("refresh_token", ""));
                return out.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public void clearAuthSession() {
            if (!isTrustedPricebookPage()) return;
            getSharedPreferences(AUTH_PREFS, MODE_PRIVATE).edit().clear().apply();
        }

        @JavascriptInterface
        public void openGoogleLogin(String url) {'''
if bridge_marker not in s:
    raise SystemExit('AndroidBridge marker not found')
s=s.replace(bridge_marker,bridge_repl,1)
if 'BijiaBook/1.6.6 (Android)' not in s:
    raise SystemExit('user agent version marker not found')
s=s.replace('BijiaBook/1.6.6 (Android)','BijiaBook/1.6.7 (Android)',1)
p.write_text(s,encoding='utf-8')

# ---- build.gradle.kts ----
p=Path('android/pricebook/app/build.gradle.kts')
s=p.read_text(encoding='utf-8')
if 'versionCode = 26' not in s or 'versionName = "1.6.6"' not in s:
    raise SystemExit('build version markers not found')
s=s.replace('versionCode = 26','versionCode = 27',1)
s=s.replace('versionName = "1.6.6"','versionName = "1.6.7"',1)
p.write_text(s,encoding='utf-8')
