from pathlib import Path
import base64
import json
import re
import zlib

root = Path(__file__).resolve().parents[1]
app = root / 'travelmate' / 'app'
parts = [app / 'payload' / f'part0{i}.txt' for i in range(1, 7)]
payload = ''.join(p.read_text(encoding='utf-8') for p in parts)
payload = ''.join(payload.split())
patch = (app / 'google-auth-patch.js').read_text(encoding='utf-8')

# Decode the gzip payload at build time, but ignore a stale/bad gzip CRC trailer.
# The DEFLATE body itself is still usable, and this avoids any browser-side loader/fetch step.
data = base64.b64decode(payload)
if data[:2] != b'\x1f\x8b':
    raise RuntimeError('TripMate payload is not gzip data')
flg = data[3]
pos = 10
if flg & 0x04:
    xlen = int.from_bytes(data[pos:pos+2], 'little')
    pos += 2 + xlen
if flg & 0x08:
    while pos < len(data) and data[pos] != 0:
        pos += 1
    pos += 1
if flg & 0x10:
    while pos < len(data) and data[pos] != 0:
        pos += 1
    pos += 1
if flg & 0x02:
    pos += 2
compressed = data[pos:-8] if len(data) >= pos + 8 else data[pos:]
dec = zlib.decompressobj(-zlib.MAX_WBITS)
raw_bytes = dec.decompress(compressed) + dec.flush()
raw = raw_bytes.decode('utf-8')
if '<html' not in raw.lower():
    raise RuntimeError('Decoded TripMate payload is not HTML')

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

# Publish the direct HTML both to the old route and a brand-new route outside the old SW/cache scope.
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
