(() => {
  if(window.__pricebookEnhancementsLoaded) return;
  window.__pricebookEnhancementsLoaded = true;

  const $ = (id) => document.getElementById(id);
  const media = () => {
    try { return parent && parent.pricebookMedia ? parent.pricebookMedia : null; } catch { return null; }
  };
  const nativeOcr = () => {
    try { return parent && parent.OrderOCR ? parent.OrderOCR : (window.OrderOCR || null); } catch { return window.OrderOCR || null; }
  };
  const dateToday = () => typeof today === 'function' ? today() : new Date().toISOString().slice(0,10);

  const style = document.createElement('style');
  style.id = 'pricebook-enhancements-style';
  style.textContent = `
    .quick-choice-grid{display:grid;gap:10px;margin-top:12px}
    .quick-choice{display:flex;align-items:center;gap:12px;text-align:left;width:100%;border:1px solid var(--line);background:#fff;border-radius:16px;padding:14px;color:var(--text)}
    .quick-choice b{display:block;font-size:15px}.quick-choice small{display:block;color:var(--muted);font-size:11px;margin-top:3px;line-height:1.45}
    .quick-choice.primary-choice{background:#EEF5EF;border-color:#D7E7D9}
    .quick-icon{width:40px;height:40px;border-radius:13px;background:#F3F5EF;display:grid;place-items:center;font-size:20px;flex:0 0 auto}
    .quick-form{display:grid;gap:11px}.quick-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.quick-field{display:grid;gap:6px;min-width:0}
    .quick-field label{font-size:12px;color:var(--muted)}.quick-field input,.quick-field select,.quick-field textarea{width:100%;min-width:0;border:1px solid var(--line);border-radius:13px;background:#fff;padding:11px 12px;outline:none}
    .quick-total{padding:12px 13px;border-radius:15px;background:linear-gradient(135deg,#EEF6EF,#FFF7EC);font-size:13px}.quick-total b{font-size:18px;color:#246645}
    .quick-ocr{border:1px solid #E2E8E1;background:#FAFCF9;border-radius:14px;padding:11px 12px;font-size:12px;color:#66736A;line-height:1.55}.quick-ocr.working{color:#9A6B30;background:#FFF8E9}.quick-ocr.ok{color:#2F7654;background:#F0F8F1}.quick-ocr.warn{color:#9A5548;background:#FFF5F2}
    .quick-preview{display:none;margin-top:8px}.quick-preview.show{display:block}.quick-preview img{width:100%;max-height:220px;object-fit:contain;border-radius:14px;border:1px solid var(--line);background:#fff}
    .cloud-photo-bar{display:flex;gap:8px;flex-wrap:wrap;margin:-2px 0 12px}.cloud-photo-bar .btn{font-size:12px;padding:8px 11px}
    .receipt-thumb{width:100%;max-height:170px;object-fit:contain;border-radius:12px;border:1px solid var(--line);background:#fff;margin-top:9px}
    .receipt-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.receipt-actions .btn{font-size:11px;padding:7px 10px}
    .media-usage{display:grid;gap:6px}.media-meter{height:8px;border-radius:999px;background:#E8ECE7;overflow:hidden}.media-meter i{display:block;height:100%;border-radius:999px;background:#6C9A7D;min-width:2px}.media-usage.warn .media-meter i{background:#D18A44}.media-usage.danger .media-meter i{background:#CF665C}
    .image-viewer .sheet{background:#111;color:#fff;padding:12px}.image-viewer img{display:block;width:100%;max-height:82vh;object-fit:contain;border-radius:14px}.image-viewer .sheet-head{background:#111}.image-viewer .close{background:#2b2b2b;color:#fff}
    @media(max-width:520px){.quick-two{grid-template-columns:1fr}.quick-form .form-actions{position:sticky;bottom:0;background:#FFFCF7;padding-top:8px}.cloud-photo-bar{margin-top:2px}}
  `;
  document.head.appendChild(style);

  function addModal(id, title, body){
    if($(id)) return $(id);
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = id;
    modal.innerHTML = `<div class="sheet"><div class="sheet-head"><h2>${title}</h2><button class="close" type="button" aria-label="關閉">×</button></div>${body}</div>`;
    document.body.appendChild(modal);
    modal.querySelector('.close').onclick = () => modal.classList.remove('show');
    modal.onclick = e => { if(e.target === modal) modal.classList.remove('show'); };
    return modal;
  }

  const chooser = addModal('quickChoiceModal','新增價格紀錄',`
    <div class="quick-choice-grid">
      <button class="quick-choice primary-choice" id="openQuickManual" type="button"><span class="quick-icon">⚡</span><span><b>快速記價格</b><small>商品、店家、數量、商品總額，幾秒就存好</small></span></button>
      <button class="quick-choice" id="openQuickOcr" type="button"><span class="quick-icon">🧾</span><span><b>從訂單截圖辨識</b><small>Android 新版可自動讀取蝦皮／購物訂單，再由你確認</small></span></button>
      <button class="quick-choice" id="openFullRecord" type="button"><span class="quick-icon">✍️</span><span><b>完整新增</b><small>條碼、分類、包裝換算等完整資料</small></span></button>
    </div>
  `);

  const quick = addModal('quickRecordModal','快速記價格',`
    <div class="quick-form">
      <div class="quick-field"><label>商品 *</label><input id="quickProduct" list="quickProductList" placeholder="輸入商品名稱；已有商品會直接沿用"><datalist id="quickProductList"></datalist></div>
      <div class="quick-two">
        <div class="quick-field"><label>店家</label><input id="quickStore" placeholder="例如 蝦皮／可可生活好食尚"></div>
        <div class="quick-field"><label>日期</label><input id="quickDate" type="date"></div>
      </div>
      <div class="quick-two">
        <div class="quick-field"><label>數量 *</label><input id="quickQty" type="number" min="0" step="0.01" inputmode="decimal" placeholder="例如 5"></div>
        <div class="quick-field"><label>比較單位</label><select id="quickUnit"><option>個</option><option>包</option><option>抽</option><option>片</option><option>顆</option><option>入</option><option>瓶</option><option>罐</option><option>盒</option><option>ml</option><option>g</option><option>kg</option><option>L</option></select></div>
      </div>
      <div class="quick-field"><label>商品總額 *</label><input id="quickTotal" type="number" min="0" step="0.01" inputmode="decimal" placeholder="例如 445"></div>
      <div id="quickUnitPreview" class="quick-total">填入數量與商品總額後，自動計算單位價</div>
      <div class="quick-field"><label>訂單截圖／價格憑證（選填）</label><input id="quickReceipt" type="file" accept="image/*"></div>
      <div id="quickPreview" class="quick-preview"><img alt="訂單截圖預覽"></div>
      <div id="quickOcrStatus" class="quick-ocr" hidden></div>
      <div class="quick-field"><label>備註（選填）</label><input id="quickNote" placeholder="例如 券後價、第二件折扣"></div>
      <div class="form-actions"><button class="btn ghost" id="quickCancel" type="button">取消</button><button class="btn primary" id="quickSave" type="button">儲存</button></div>
    </div>
  `);

  const viewer = addModal('cloudImageViewer','照片',`<div style="padding:4px 0 10px"><img id="cloudImageViewerImg" style="display:block;width:100%;max-height:78vh;object-fit:contain;border-radius:14px;background:#111" alt="照片"></div>`);
  viewer.classList.add('image-viewer');

  let quickOcrRequested = false;
  let quickOcrText = '';
  let pendingFullProductImage = null;

  function refreshProductDatalist(){
    const list = $('quickProductList');
    if(!list || typeof db === 'undefined') return;
    list.innerHTML = (db.products || []).map(p => `<option value="${String(p.name||'').replace(/"/g,'&quot;')}">${String(p.brand||'')}</option>`).join('');
  }
  function resetQuick(){
    refreshProductDatalist();
    $('quickProduct').value=''; $('quickStore').value=''; $('quickQty').value=''; $('quickTotal').value=''; $('quickUnit').value='個';
    $('quickDate').value=dateToday(); $('quickReceipt').value=''; $('quickNote').value=''; quickOcrText=''; quickOcrRequested=false;
    $('quickUnitPreview').textContent='填入數量與商品總額後，自動計算單位價';
    $('quickOcrStatus').hidden=true; $('quickOcrStatus').className='quick-ocr';
    $('quickPreview').classList.remove('show'); $('quickPreview').querySelector('img').removeAttribute('src');
  }
  function openQuick(ocr=false){
    chooser.classList.remove('show'); resetQuick(); quickOcrRequested=ocr; quick.classList.add('show');
    if(ocr) setTimeout(()=>$('quickReceipt').click(),100);
  }
  function updateQuickPreview(){
    const q=Number($('quickQty').value), total=Number($('quickTotal').value), unit=$('quickUnit').value||'個';
    if(q>0 && total>=0){ $('quickUnitPreview').innerHTML=`單位價約 <b>$${(total/q).toFixed((total/q)%1?2:0)}</b>／${unit}`; }
    else $('quickUnitPreview').textContent='填入數量與商品總額後，自動計算單位價';
  }
  $('quickQty').addEventListener('input',updateQuickPreview); $('quickTotal').addEventListener('input',updateQuickPreview); $('quickUnit').addEventListener('change',updateQuickPreview);
  $('quickCancel').onclick=()=>quick.classList.remove('show');
  $('openQuickManual').onclick=()=>openQuick(false);
  $('openQuickOcr').onclick=()=>openQuick(true);

  function findExistingProductByName(name){
    const needle=String(name||'').trim().toLowerCase();
    if(!needle) return null;
    return (db.products||[]).find(p=>String(p.name||'').trim().toLowerCase()===needle) || null;
  }

  async function fileToImage(file){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file), img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('無法讀取照片'))};
      img.src=url;
    });
  }
  function canvasToBlob(canvas,quality){return new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));}
  async function compressJpeg(file,maxDim,maxBytes){
    const img=await fileToImage(file);
    let scale=Math.min(1,maxDim/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
    for(let round=0;round<4;round++){
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));
      canvas.height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
      canvas.getContext('2d',{alpha:false}).drawImage(img,0,0,canvas.width,canvas.height);
      for(const q of [0.82,0.72,0.62,0.52]){
        const blob=await canvasToBlob(canvas,q);
        if(blob && blob.size<=maxBytes) return blob;
      }
      scale*=0.78;
    }
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=Math.max(1,Math.round(900*(img.naturalHeight||img.height)/(img.naturalWidth||img.width)));
    canvas.getContext('2d',{alpha:false}).drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await canvasToBlob(canvas,.48);
    if(!blob) throw new Error('照片壓縮失敗');
    return blob;
  }
  function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)});}
  function dataUrlToBlob(dataUrl){
    const [head,data]=String(dataUrl).split(','); if(!data) return null;
    const mime=(head.match(/data:([^;]+)/)||[])[1]||'image/jpeg'; const bin=atob(data); const arr=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i); return new Blob([arr],{type:mime});
  }

  function setOcrStatus(text,cls=''){
    const el=$('quickOcrStatus'); el.hidden=false; el.className='quick-ocr'+(cls?' '+cls:''); el.textContent=text;
  }
  function parseMoneyNear(text,label){
    const re=new RegExp(label+'[^0-9]{0,12}([0-9][0-9,]*(?:\\.[0-9]+)?)','i'); const m=String(text).match(re); return m?Number(m[1].replace(/,/g,'')):0;
  }
  function parseOrderOcr(text){
    const lines=String(text||'').split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
    const all=lines.join('\n');
    const productTotal=parseMoneyNear(all,'商品總金額|商品總額|商品金額');
    const orderTotal=parseMoneyNear(all,'訂單金額|實付金額|付款金額');
    let qty=0, qtyIndex=-1;
    lines.forEach((line,i)=>{const m=line.match(/(?:^|\s)[xX×]\s*(\d+(?:\.\d+)?)(?:\s|$)/);if(m&&!qty){qty=Number(m[1]);qtyIndex=i;}});
    if(!qty){const m=all.match(/數量[^0-9]{0,8}(\d+(?:\.\d+)?)/);if(m)qty=Number(m[1]);}
    let product='';
    if(qtyIndex>=0){
      const candidates=lines.slice(Math.max(0,qtyIndex-5),qtyIndex).filter(line=>
        line.length>=5 && !/^[$NT\d\s.,-]+$/.test(line) && !/蝦皮優選|運送資訊|收件資訊|買家取件|商品總|運費|優惠券|訂單金額|更多/.test(line)
      );
      product=candidates.sort((a,b)=>b.length-a.length)[0]||'';
    }
    if(!product){
      product=lines.filter(line=>line.length>=8 && /[A-Za-z\u4e00-\u9fff]/.test(line) && !/運送資訊|收件資訊|地址|訂單|運費|優惠券|買家|更多/.test(line)).sort((a,b)=>b.length-a.length)[0]||'';
    }
    let store='';
    const shopLine=lines.find(line=>/旗艦|商城|商店|生活|賣場|官方/.test(line) && !/商品|訂單/.test(line));
    if(/蝦皮|Shopee/i.test(all)) store=shopLine?`蝦皮／${shopLine}`:'蝦皮'; else if(shopLine) store=shopLine;
    return {product,store,qty,total:productTotal||0,orderTotal};
  }

  window.onOrderOcrResult = (payload) => {
    try{
      const result=typeof payload==='string'?JSON.parse(payload):payload;
      if(!result?.ok) throw new Error(result?.error||'辨識失敗');
      quickOcrText=result.text||'';
      const parsed=parseOrderOcr(quickOcrText);
      if(parsed.product) $('quickProduct').value=parsed.product;
      if(parsed.store) $('quickStore').value=parsed.store;
      if(parsed.qty) $('quickQty').value=parsed.qty;
      if(parsed.total) $('quickTotal').value=parsed.total;
      if(parsed.orderTotal && parsed.total && parsed.orderTotal!==parsed.total) $('quickNote').value=`訂單實付 $${parsed.orderTotal}；商品總額 $${parsed.total}`;
      updateQuickPreview();
      setOcrStatus('已辨識並帶入可判斷的欄位，請確認商品名稱、數量與金額後再儲存。','ok');
    }catch(e){ setOcrStatus('沒有成功辨識文字，可直接手動填寫；截圖仍可一起保存。','warn'); }
  };

  async function runOcrForFile(file){
    const ocr=nativeOcr();
    if(!ocr || typeof ocr.recognizeOrderImage!=='function'){
      setOcrStatus('目前這個 App 版本沒有訂單文字辨識功能；可以先手動填寫並保存截圖。','warn'); return;
    }
    try{
      setOcrStatus('正在辨識訂單截圖…','working');
      const blob=await compressJpeg(file,1800,750*1024); const dataUrl=await blobToDataUrl(blob); ocr.recognizeOrderImage(String(dataUrl));
    }catch(e){setOcrStatus('辨識前處理失敗，請換一張截圖再試。','warn');}
  }

  $('quickReceipt').addEventListener('change',async e=>{
    const file=e.target.files?.[0]; if(!file)return;
    const url=URL.createObjectURL(file); const img=$('quickPreview').querySelector('img'); img.src=url; $('quickPreview').classList.add('show'); img.onload=()=>URL.revokeObjectURL(url);
    if(quickOcrRequested) await runOcrForFile(file);
  });

  async function saveQuick(){
    const name=$('quickProduct').value.trim(), qty=Number($('quickQty').value), total=Number($('quickTotal').value), store=$('quickStore').value.trim(), unit=$('quickUnit').value||'個';
    if(!name) return toast('商品名稱要填喔'); if(!(qty>0)) return toast('數量要大於 0'); if(!(total>=0)) return toast('商品總額要填喔');
    const btn=$('quickSave'); btn.disabled=true; btn.textContent='儲存中…';
    try{
      let p=findExistingProductByName(name);
      if(!p){p={id:id(),name,brand:'',category:'未分類',unit,barcode:'',barcodes:[],targetPrice:0,targetQty:0,note:'',favorite:false,image:'',imagePath:'',records:[]};db.products.push(p)}
      const rid=id(); let receiptPath=''; const file=$('quickReceipt').files?.[0];
      if(file){
        const api=media(); if(!api) throw new Error('照片雲端尚未就緒，請稍後再試');
        const blob=await compressJpeg(file,1600,500*1024); receiptPath=await api.upload(blob,'receipts',rid);
      }
      const r={id:rid,type:'bought',date:$('quickDate').value||dateToday(),store,price:total,currency:'TWD',exchange:1,twdPrice:total,unitSize:0,packCount:0,packUnit:unit,qty,spec:`${qty} ${p.unit||unit}`,promo:false,special:false,note:$('quickNote').value.trim(),receiptPath,createdAt:Date.now()};
      p.records=p.records||[];p.records.push(r); quick.classList.remove('show'); saveDB('快速新增價格紀錄'); openDetail(p.id); toast('已快速記下這筆價格 ✓');
    }catch(e){toast('儲存失敗：'+(e.message||'請再試一次'))}
    finally{btn.disabled=false;btn.textContent='儲存'}
  }
  $('quickSave').onclick=saveQuick;

  const originalOpenRecordModal = typeof openRecordModal==='function' ? openRecordModal : null;
  if(originalOpenRecordModal){
    openRecordModal = function(pid=null){ if(pid) return originalOpenRecordModal(pid); refreshProductDatalist(); chooser.classList.add('show'); };
    $('openFullRecord').onclick=()=>{chooser.classList.remove('show');originalOpenRecordModal(null)};
  }

  async function cloudThumb(el,path){
    if(!el||!path)return; el.dataset.mediaPath=path;
    try{const url=await media()?.getUrl(path);if(!url||el.dataset.mediaPath!==path)return;el.innerHTML=`<img src="${url}" alt="商品照片">`;}catch{}
  }
  function hydrateHomePhotos(){
    if(typeof db==='undefined')return;
    document.querySelectorAll('.product[data-open]').forEach(card=>{const p=getProduct(card.dataset.open),thumb=card.querySelector('.thumb');if(p?.imagePath)cloudThumb(thumb,p.imagePath)});
  }

  async function chooseAndUploadProductImage(pid){
    const p=getProduct(pid);if(!p)return;
    const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return;
      try{toast('正在上傳商品照片…');const blob=await compressJpeg(file,1200,320*1024);const path=await media().upload(blob,'products',p.id,p.imagePath||'');p.imagePath=path;p.image='';saveDB('更新商品照片');openDetail(pid);toast('商品照片已存到雲端 ✓');}catch(e){toast('照片上傳失敗：'+(e.message||'請再試一次'))}
    };input.click();
  }
  async function removeProductImage(pid){
    const p=getProduct(pid);if(!p||(!p.imagePath&&!p.image))return;if(!confirm('移除這張商品照片？'))return;
    try{if(p.imagePath)await media()?.remove(p.imagePath);p.imagePath='';p.image='';saveDB('移除商品照片');openDetail(pid);toast('商品照片已移除')}catch(e){toast('移除失敗：'+(e.message||'請再試一次'))}
  }

  async function showCloudImage(path,title='照片'){
    try{const url=await media()?.getUrl(path);if(!url)throw new Error('找不到照片');viewer.querySelector('h2').textContent=title;$('cloudImageViewerImg').src=url;viewer.classList.add('show')}catch(e){toast('照片讀取失敗')}
  }
  async function attachReceipt(pid,rid){
    const p=getProduct(pid),r=p&&(p.records||[]).find(x=>x.id===rid);if(!r)return;
    const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return;
      try{toast('正在上傳訂單截圖…');const blob=await compressJpeg(file,1600,500*1024);const path=await media().upload(blob,'receipts',r.id,r.receiptPath||'');r.receiptPath=path;saveDB('更新價格憑證');openDetail(pid);toast('訂單截圖已存到雲端 ✓')}catch(e){toast('截圖上傳失敗：'+(e.message||'請再試一次'))}
    };input.click();
  }
  async function removeReceipt(pid,rid){
    const p=getProduct(pid),r=p&&(p.records||[]).find(x=>x.id===rid);if(!r?.receiptPath)return;if(!confirm('移除這張訂單截圖？'))return;
    try{await media()?.remove(r.receiptPath);r.receiptPath='';saveDB('移除價格憑證');openDetail(pid);toast('截圖已移除')}catch(e){toast('移除失敗：'+(e.message||'請再試一次'))}
  }

  function enhanceDetail(pid){
    const p=getProduct(pid);if(!p)return;
    const detail=$('detailContent'),title=detail?.querySelector('.detail-title');if(!detail||!title)return;
    if(p.imagePath)cloudThumb(title.querySelector('.thumb'),p.imagePath);
    if(!detail.querySelector('.cloud-photo-bar')){
      const bar=document.createElement('div');bar.className='cloud-photo-bar';
      bar.innerHTML=`<button class="btn soft" type="button">📷 ${p.imagePath||p.image?'更換':'新增'}商品照片</button>${p.imagePath||p.image?'<button class="btn ghost" type="button">移除照片</button>':''}`;
      const buttons=bar.querySelectorAll('button');buttons[0].onclick=()=>chooseAndUploadProductImage(pid);if(buttons[1])buttons[1].onclick=()=>removeProductImage(pid);title.insertAdjacentElement('afterend',bar);
    }
    const rs=recordsOf(p),rows=detail.querySelectorAll('.history .hrow');
    rows.forEach((row,i)=>{
      const r=rs[i];if(!r||row.querySelector('.receipt-actions'))return;
      const actions=document.createElement('div');actions.className='receipt-actions';
      if(r.receiptPath){
        actions.innerHTML='<button class="btn soft" type="button">🧾 查看截圖</button><button class="btn ghost" type="button">更換截圖</button><button class="btn ghost danger" type="button">移除截圖</button>';
        const b=actions.querySelectorAll('button');b[0].onclick=()=>showCloudImage(r.receiptPath,'訂單截圖');b[1].onclick=()=>attachReceipt(pid,r.id);b[2].onclick=()=>removeReceipt(pid,r.id);
      }else{
        actions.innerHTML='<button class="btn soft" type="button">＋ 訂單截圖</button>';actions.querySelector('button').onclick=()=>attachReceipt(pid,r.id);
      }
      row.appendChild(actions);
    });
  }

  const originalRenderHome = typeof renderHome==='function'?renderHome:null;
  if(originalRenderHome){renderHome=function(...args){const out=originalRenderHome(...args);setTimeout(hydrateHomePhotos,0);return out;}}
  const originalOpenDetail = typeof openDetail==='function'?openDetail:null;
  if(originalOpenDetail){openDetail=function(pid){const out=originalOpenDetail(pid);setTimeout(()=>enhanceDetail(pid),0);return out;}}

  // 舊完整版新增商品也改成雲端商品照片，不再把 base64 原圖塞進 snapshot。
  const originalCompressImage = typeof compressImage==='function'?compressImage:null;
  const originalSaveRecord = typeof saveRecord==='function'?saveRecord:null;
  if(originalCompressImage && originalSaveRecord && $('saveRecord')){
    compressImage = async function(file){
      if(file && media()){pendingFullProductImage=file;return ''}
      return originalCompressImage(file);
    };
    $('saveRecord').onclick=async()=>{
      pendingFullProductImage=null;const before=new Set((db.products||[]).map(p=>p.id));await originalSaveRecord();
      const file=pendingFullProductImage;if(!file)return;
      const created=(db.products||[]).find(p=>!before.has(p.id));if(!created)return;
      try{const blob=await compressJpeg(file,1200,320*1024);created.imagePath=await media().upload(blob,'products',created.id);created.image='';saveDB('新增商品照片');openDetail(created.id);toast('商品照片已存到雲端 ✓')}catch(e){toast('商品已儲存，但照片上傳失敗，可在商品詳情重新加入')}
    };
  }

  // 刪除資料時同步清理雲端照片，避免 Storage 越堆越大。
  deleteRecord = async function(pid,rid){
    if(!confirm('刪掉這筆價格紀錄？'))return;const p=getProduct(pid),r=p&&(p.records||[]).find(x=>x.id===rid);if(!p)return;
    const path=r?.receiptPath||'';p.records=p.records.filter(x=>x.id!==rid);saveDB('刪除價格紀錄');openDetail(pid);if(path){try{await media()?.remove(path)}catch{toast('紀錄已刪除，但雲端截圖清理失敗')}}
  };
  deleteProduct = async function(pid){
    if(!confirm('會連同這個商品的所有價格紀錄一起刪除，確定嗎？'))return;const p=getProduct(pid);if(!p)return;
    const paths=[p.imagePath,...(p.records||[]).map(r=>r.receiptPath)].filter(Boolean);db.products=db.products.filter(x=>x.id!==pid);closeModal('detailModal');saveDB('刪除商品');toast('商品已刪除');
    for(const path of paths){try{await media()?.remove(path)}catch{}}
  };

  async function migrateLegacyImages(){
    const api=media();if(!api||typeof db==='undefined')return;let changed=false;
    for(const p of db.products||[]){
      if(p.imagePath||!String(p.image||'').startsWith('data:image/'))continue;
      try{const raw=dataUrlToBlob(p.image);if(!raw)continue;const blob=raw.size>320*1024?await compressJpeg(new File([raw],'legacy.jpg',{type:raw.type||'image/jpeg'}),1200,320*1024):raw;p.imagePath=await api.upload(blob,'products',p.id);p.image='';changed=true;}catch(e){console.warn('legacy image migration failed',p.id,e)}
    }
    if(changed){saveDB('商品照片轉雲端');renderHome();}
  }

  function installUsageCard(){
    const settings=$('settingsView');if(!settings||$('pricebookMediaUsage'))return;
    const panel=document.createElement('div');panel.className='panel';panel.id='pricebookMediaUsage';panel.innerHTML='<h3>照片雲端空間</h3><div class="media-usage"><div id="mediaUsageText" class="smallnote">正在讀取…</div><div class="media-meter"><i id="mediaUsageBar" style="width:1%"></i></div><div class="smallnote">商品照片會壓到約 320 KB 以下；訂單截圖約 500 KB 以下。刪除照片／紀錄時也會同步清理雲端檔案。</div></div>';settings.appendChild(panel);
  }
  async function refreshUsage(){
    installUsageCard();const box=$('pricebookMediaUsage'),text=$('mediaUsageText'),bar=$('mediaUsageBar'),api=media();if(!box||!api)return;
    try{const u=await api.usage(),mb=u.totalBytes/1024/1024,pct=Math.min(100,mb/700*100);text.textContent=`目前 ${u.fileCount} 張／約 ${mb.toFixed(mb<10?2:1)} MB；建議比價簿照片控制在 700 MB 以下。`;bar.style.width=Math.max(1,pct)+'%';box.querySelector('.media-usage').classList.toggle('warn',mb>=500&&mb<700);box.querySelector('.media-usage').classList.toggle('danger',mb>=700);}catch{if(text)text.textContent='目前無法讀取照片用量';}
  }
  const originalSwitchView=typeof switchView==='function'?switchView:null;
  if(originalSwitchView){switchView=function(idn){const out=originalSwitchView(idn);if(idn==='settingsView')refreshUsage();return out;}}

  setTimeout(()=>{hydrateHomePhotos();installUsageCard();refreshUsage();migrateLegacyImages();},250);
})();
