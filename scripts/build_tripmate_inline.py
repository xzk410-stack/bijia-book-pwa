from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
app = root / 'travelmate' / 'app'
parts = [app / 'payload' / f'part0{i}.txt' for i in range(1, 7)]
payload = ''.join(p.read_text(encoding='utf-8') for p in parts)
payload = ''.join(payload.split())
patch = (app / 'google-auth-patch.js').read_text(encoding='utf-8')

# The generated launcher contains the whole compressed app payload and Google-login UI patch.
# That removes all runtime fetch() calls that previously failed on some Android browsers.
html = f'''<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta name="theme-color" content="#356859">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./icon.svg">
<title>旅伴｜載入中</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#fffaf6;color:#25322d;font-family:-apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC","Segoe UI",sans-serif}}.box{{text-align:center;padding:28px}}.mark{{width:82px;height:82px;margin:0 auto 15px;border-radius:26px;display:grid;place-items:center;background:#e9f4ef;font-size:44px;box-shadow:0 10px 28px rgba(53,104,89,.12)}}b{{font-size:18px}}.spin{{width:28px;height:28px;border:3px solid #d9e8e1;border-top-color:#356859;border-radius:50%;animation:s .8s linear infinite;margin:18px auto}}@keyframes s{{to{{transform:rotate(360deg)}}}}small{{color:#7d8984;line-height:1.6}}
</style>
</head>
<body><div class="box"><div class="mark">🧳</div><b>正在開啟旅伴…</b><div class="spin"></div><small id="msg">載入正式完整版</small></div>
<script>
(async()=>{{
 try{{
  if(!('DecompressionStream' in window)) throw new Error('瀏覽器版本較舊，請更新 Chrome 後再開啟');
  const b64={json.dumps(payload)};
  const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const ds=new DecompressionStream('gzip');
  const source=await new Response(new Blob([bin]).stream().pipeThrough(ds)).text();
  const parsed=new DOMParser().parseFromString(source,'text/html');

  // Remove the old Android version/download promo card from the login screen.
  const candidates=[...parsed.body.querySelectorAll('*')];
  for(const el of candidates){{
    const t=(el.textContent||'').replace(/\\s+/g,' ').trim();
    if(/Android\\s*1\\.2\\.7|定位修復版|安裝最新版/.test(t)){{
      let node=el;
      for(let i=0;i<4&&node.parentElement&&node.parentElement!==parsed.body;i++){{
        const pt=(node.parentElement.textContent||'').replace(/\\s+/g,' ').trim();
        if(pt.length<=220) node=node.parentElement; else break;
      }}
      node.remove();
      break;
    }}
  }}

  const google=parsed.createElement('script');
  google.setAttribute('data-travel-google-patch','inline-standalone');
  google.textContent={json.dumps(patch)};
  parsed.body.appendChild(google);

  // Defensive cleanup after original app scripts finish rendering.
  const cleanup=parsed.createElement('script');
  cleanup.textContent=`(()=>{{
    const run=()=>{{
      const els=[...document.querySelectorAll('body *')];
      for(const el of els){{
        const t=(el.textContent||'').replace(/\\s+/g,' ').trim();
        if(/Android\\s*1\\.2\\.7|定位修復版|安裝最新版/.test(t)){{
          let node=el;
          for(let i=0;i<4&&node.parentElement&&node.parentElement!==document.body;i++){{
            const pt=(node.parentElement.textContent||'').replace(/\\s+/g,' ').trim();
            if(pt.length<=220) node=node.parentElement; else break;
          }}
          node.remove(); break;
        }}
      }}
    }};
    run(); setTimeout(run,250); setTimeout(run,1000);
  }})();`;
  parsed.body.appendChild(cleanup);

  const out='<!doctype html>\\n'+parsed.documentElement.outerHTML;
  document.open();document.write(out);document.close();
 }}catch(e){{
  document.getElementById('msg').textContent='旅伴載入失敗：'+((e&&e.message)||'請重新整理');
 }}
}})();
</script></body></html>'''

(app / 'index.html').write_text(html, encoding='utf-8')
print(f'generated {{app / "index.html"}} ({{len(html)}} bytes)')
