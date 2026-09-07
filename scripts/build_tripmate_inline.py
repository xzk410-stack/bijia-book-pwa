from pathlib import Path
import base64
import gzip
import json
import re

root = Path(__file__).resolve().parents[1]
app = root / 'travelmate' / 'app'
parts = [app / 'payload' / f'part0{i}.txt' for i in range(1, 7)]
payload = ''.join(p.read_text(encoding='utf-8') for p in parts)
payload = ''.join(payload.split())
patch = (app / 'google-auth-patch.js').read_text(encoding='utf-8')

# Decode the full app at build time. The browser receives the actual app HTML directly,
# so it no longer needs fetch(), DecompressionStream, or the old loader screen.
raw = gzip.decompress(base64.b64decode(payload)).decode('utf-8')

# Add explicit no-cache metadata for the fresh route.
if '<head>' in raw:
    raw = raw.replace(
        '<head>',
        '<head>\n<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n<meta http-equiv="Pragma" content="no-cache">\n<meta http-equiv="Expires" content="0">',
        1,
    )

cleanup = r'''
<script data-tripmate-fresh-ui>
(() => {
  const hideOldAndroidCard = () => {
    const all = [...document.querySelectorAll('body *')];
    for (const el of all) {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/Android\s*1\.2\.7|定位修復版|安裝最新版/.test(text)) continue;
      let node = el;
      for (let i = 0; i < 5 && node.parentElement && node.parentElement !== document.body; i++) {
        const parent = node.parentElement;
        const pt = (parent.textContent || '').replace(/\s+/g, ' ').trim();
        if (pt.length <= 650) node = parent;
        else break;
      }
      node.style.display = 'none';
      break;
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideOldAndroidCard, {once:true});
  } else {
    hideOldAndroidCard();
  }
  setTimeout(hideOldAndroidCard, 250);
  setTimeout(hideOldAndroidCard, 1000);
})();
</script>
'''

injected = '\n<script data-tripmate-google-inline>\n' + patch + '\n</script>\n' + cleanup
if '</body>' in raw:
    direct_html = raw.replace('</body>', injected + '</body>', 1)
else:
    direct_html = raw + injected

# Publish to the old route too, but more importantly publish to a totally new route
# outside the old service-worker/cache scope.
(app / 'index.html').write_text(direct_html, encoding='utf-8')

fresh = root / 'tripmate-live'
fresh.mkdir(exist_ok=True)
(fresh / 'index.html').write_text(direct_html, encoding='utf-8')
(fresh / '.nojekyll').write_text('', encoding='utf-8')
(fresh / 'icon.svg').write_text((app / 'icon.svg').read_text(encoding='utf-8'), encoding='utf-8')
manifest = (app / 'manifest.webmanifest').read_text(encoding='utf-8')
manifest = re.sub(r'"start_url"\s*:\s*"[^"]*"', '"start_url":"./"', manifest)
(fresh / 'manifest.webmanifest').write_text(manifest, encoding='utf-8')

print(f'generated direct TripMate HTML: {len(direct_html)} bytes')
print(f'old route: {app / "index.html"}')
print(f'fresh route: {fresh / "index.html"}')
