(() => {
  function boot(){
    if(!window.__pricebookEnhancementsLoaded || !document.getElementById('quickProduct')){
      setTimeout(boot,80);return;
    }
    if(window.__pricebookEnhancementsPatchLoaded)return;
    window.__pricebookEnhancementsPatchLoaded=true;

    const $=id=>document.getElementById(id);
    const setStatus=(text,cls='')=>{const el=$('quickOcrStatus');if(!el)return;el.hidden=false;el.className='quick-ocr'+(cls?' '+cls:'');el.textContent=text;};
    const money=(text,labels)=>{
      const re=new RegExp('(?:'+labels+')[^0-9]{0,16}([0-9][0-9,]*(?:\\.[0-9]+)?)','i');
      const m=String(text||'').match(re);return m?Number(m[1].replace(/,/g,'')):0;
    };
    const isoDateFromText=(text)=>{
      const s=String(text||'');
      let m=s.match(/((?:19|20)\d{2})\s*[\/\.\-年]\s*(\d{1,2})\s*[\/\.\-月]\s*(\d{1,2})(?:\s*日)?/);
      if(!m)m=s.match(/\b((?:19|20)\d{2})(\d{2})(\d{2})\b/);
      if(!m)return '';
      const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
      const dt=new Date(Date.UTC(y,mo-1,d));
      if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d)return '';
      return `${String(y).padStart(4,'0')}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    };
    const detectDate=(lines)=>{
      const explicit=/(訂單成立|下單|付款時間|付款日期|購買日期|訂購日期|交易日期|訂單日期|成立時間)/;
      for(let i=0;i<lines.length;i++){
        if(!explicit.test(lines[i]))continue;
        const d=isoDateFromText(lines[i]+' '+(lines[i+1]||''));
        if(d)return {date:d,dateKind:'order'};
      }
      const found=[];
      for(const line of lines){
        const d=isoDateFromText(line);
        if(d&&!found.includes(d))found.push(d);
      }
      if(!found.length)return {date:'',dateKind:''};
      found.sort();
      return {date:found[0],dateKind:'visible'};
    };
    const parse=(text)=>{
      const lines=String(text||'').split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
      const all=lines.join('\n');
      const productTotal=money(all,'商品總金額|商品總額|商品金額');
      const orderTotal=money(all,'訂單金額|實付金額|付款金額');
      let qty=0,qtyIndex=-1;
      lines.forEach((line,i)=>{const m=line.match(/(?:^|\s)[xX×]\s*(\d+(?:\.\d+)?)(?:\s|$)/);if(m&&!qty){qty=Number(m[1]);qtyIndex=i;}});
      if(!qty){const m=all.match(/數量[^0-9]{0,8}(\d+(?:\.\d+)?)/);if(m)qty=Number(m[1]);}
      let product='';
      if(qtyIndex>=0){
        const candidates=lines.slice(Math.max(0,qtyIndex-6),qtyIndex).filter(line=>line.length>=5&&!/^[$NT\d\s.,-]+$/.test(line)&&!/蝦皮優選|運送資訊|收件資訊|買家取件|商品總|運費|優惠券|訂單金額|更多/.test(line));
        product=candidates.sort((a,b)=>b.length-a.length)[0]||'';
      }
      if(!product)product=lines.filter(line=>line.length>=8&&/[A-Za-z\u4e00-\u9fff]/.test(line)&&!/運送資訊|收件資訊|地址|訂單|運費|優惠券|買家|更多/.test(line)).sort((a,b)=>b.length-a.length)[0]||'';
      const shopLine=lines.find(line=>/旗艦|商城|商店|生活|賣場|官方/.test(line)&&!/商品|訂單/.test(line));
      let store='';if(/蝦皮|Shopee/i.test(all))store=shopLine?`蝦皮／${shopLine}`:'蝦皮';else if(shopLine)store=shopLine;
      const dateInfo=detectDate(lines);
      return{product,store,qty,total:productTotal,orderTotal,...dateInfo};
    };

    window.onOrderOcrResult=(payload)=>{
      try{
        const result=typeof payload==='string'?JSON.parse(payload):payload;
        if(!result?.ok){
          setStatus(result?.error||'沒有成功辨識文字，可直接手動填寫；截圖仍可一起保存。','warn');
          return;
        }
        const p=parse(result.text||'');
        if(p.product)$('quickProduct').value=p.product;
        if(p.store)$('quickStore').value=p.store;
        if(p.qty)$('quickQty').value=p.qty;
        if(p.total)$('quickTotal').value=p.total;
        if(p.date)$('quickDate').value=p.date;
        if(p.orderTotal&&p.total&&p.orderTotal!==p.total)$('quickNote').value=`訂單實付 $${p.orderTotal}；商品總額 $${p.total}`;
        const evt=new Event('input',{bubbles:true});$('quickQty')?.dispatchEvent(evt);$('quickTotal')?.dispatchEvent(evt);$('quickProduct')?.dispatchEvent(evt);
        const dateHint=p.dateKind==='visible'?' 日期是從截圖可見時間推測，請確認是否為實際購買日。':'';
        setStatus(`已辨識並帶入可判斷的欄位，請確認商品名稱、數量、商品總額${p.date?'與日期':''}後再儲存。${dateHint}`,'ok');
      }catch(e){setStatus('沒有成功辨識文字，可直接手動填寫；截圖仍可一起保存。','warn');}
    };

    $('quickProduct')?.addEventListener('input',()=>{
      try{
        const name=$('quickProduct').value.trim().toLowerCase();
        const p=(db.products||[]).find(x=>String(x.name||'').trim().toLowerCase()===name);
        if(p?.unit)$('quickUnit').value=p.unit;
        $('quickUnit')?.dispatchEvent(new Event('change',{bubbles:true}));
      }catch{}
    });

    const media=()=>{try{return parent&&parent.pricebookMedia?parent.pricebookMedia:null}catch{return null}};
    const nativeOcr=()=>{try{return parent&&parent.OrderOCR?parent.OrderOCR:(window.OrderOCR||null)}catch{return window.OrderOCR||null}};
    const fileToImage=file=>new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file),img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('無法讀取照片'))};
      img.src=url;
    });
    const canvasToBlob=(canvas,q)=>new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',q));
    const compressJpeg=async(file,maxDim=1600,maxBytes=500*1024)=>{
      const img=await fileToImage(file);
      let scale=Math.min(1,maxDim/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
      for(let round=0;round<4;round++){
        const c=document.createElement('canvas');
        c.width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));
        c.height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
        c.getContext('2d',{alpha:false}).drawImage(img,0,0,c.width,c.height);
        for(const q of [0.82,0.72,0.62,0.52]){
          const blob=await canvasToBlob(c,q);
          if(blob&&blob.size<=maxBytes)return blob;
        }
        scale*=0.78;
      }
      throw new Error('照片壓縮失敗');
    };
    const blobToDataUrl=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)});

    let ocrMode=false;
    let preparedPath='';
    let preparePromise=null;
    let prepareGeneration=0;
    let committed=false;
    let modalWasOpen=false;

    const removePrepared=async(path=preparedPath)=>{
      if(!path)return;
      try{await media()?.remove(path)}catch{}
      if(preparedPath===path)preparedPath='';
    };

    $('openQuickOcr')?.addEventListener('click',()=>{ocrMode=true;});
    $('openQuickManual')?.addEventListener('click',()=>{ocrMode=false;});

    const originalReceipt=$('quickReceipt');
    if(originalReceipt){
      const receipt=originalReceipt.cloneNode(true);
      originalReceipt.replaceWith(receipt);
      receipt.addEventListener('change',async e=>{
        const file=e.target.files?.[0];
        if(!file)return;
        const gen=++prepareGeneration;
        const old=preparedPath;preparedPath='';if(old)removePrepared(old);
        const preview=$('quickPreview'),previewImg=preview?.querySelector('img');
        if(preview&&previewImg){const url=URL.createObjectURL(file);previewImg.src=url;preview.classList.add('show');previewImg.onload=()=>URL.revokeObjectURL(url);}
        if(ocrMode)setStatus('正在辨識並準備照片…','working');
        preparePromise=(async()=>{
          const blob=await compressJpeg(file,1600,500*1024);
          if(gen!==prepareGeneration)throw new Error('照片已更換');
          const api=media();if(!api)throw new Error('照片雲端尚未就緒，請稍後再試');
          const draftId='draft-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
          const uploadPromise=api.upload(blob,'receipts',draftId);
          if(ocrMode){
            try{
              const ocr=nativeOcr();
              if(ocr&&typeof ocr.recognizeOrderImage==='function'){
                const dataUrl=await blobToDataUrl(blob);
                ocr.recognizeOrderImage(String(dataUrl));
              }else setStatus('目前這個 App 版本沒有訂單文字辨識功能；可以手動填寫並保存截圖。','warn');
            }catch{setStatus('文字辨識失敗，可手動確認欄位；截圖仍會保存。','warn');}
          }
          const path=await uploadPromise;
          if(gen!==prepareGeneration){try{await api.remove(path)}catch{};throw new Error('照片已更換');}
          preparedPath=path;
          return path;
        })();
        preparePromise.catch(e=>{
          if(gen===prepareGeneration&&!/照片已更換/.test(String(e?.message||'')))setStatus('照片準備失敗：'+(e?.message||'請再選一次'),'warn');
        });
      });
    }

    const findProductByName=name=>{
      const needle=String(name||'').trim().toLowerCase();
      return (db.products||[]).find(p=>String(p.name||'').trim().toLowerCase()===needle)||null;
    };
    const fastSave=async()=>{
      const name=$('quickProduct')?.value.trim()||'';
      const qty=Number($('quickQty')?.value),total=Number($('quickTotal')?.value);
      const store=$('quickStore')?.value.trim()||'',unit=$('quickUnit')?.value||'個';
      if(!name)return toast('商品名稱要填喔');
      if(!(qty>0))return toast('數量要大於 0');
      if(!(total>=0))return toast('商品總額要填喔');
      const btn=$('quickSave');if(!btn)return;
      btn.disabled=true;btn.textContent=preparePromise?'完成照片中…':'儲存中…';
      try{
        const file=$('quickReceipt')?.files?.[0];
        let receiptPath='';
        if(file){
          if(preparePromise)receiptPath=await preparePromise;
          else receiptPath=preparedPath;
          if(!receiptPath)throw new Error('照片尚未準備完成，請稍後再試');
        }
        let p=findProductByName(name);
        if(!p){p={id:id(),name,brand:'',category:'未分類',unit,barcode:'',barcodes:[],targetPrice:0,targetQty:0,note:'',favorite:false,image:'',imagePath:'',records:[]};db.products.push(p)}
        const rid=id();
        const r={id:rid,type:'bought',date:$('quickDate')?.value||new Date().toISOString().slice(0,10),store,price:total,currency:'TWD',exchange:1,twdPrice:total,unitSize:0,packCount:0,packUnit:unit,qty,spec:`${qty} ${p.unit||unit}`,promo:false,special:false,note:$('quickNote')?.value.trim()||'',receiptPath,createdAt:Date.now()};
        p.records=p.records||[];p.records.push(r);
        committed=true;preparedPath='';preparePromise=null;
        $('quickRecordModal')?.classList.remove('show');
        saveDB('快速新增價格紀錄');
        openDetail(p.id);
        toast('已快速記下這筆價格 ✓');
      }catch(e){toast('儲存失敗：'+(e?.message||'請再試一次'))}
      finally{btn.disabled=false;btn.textContent='儲存';}
    };
    if($('quickSave'))$('quickSave').onclick=fastSave;

    const style=document.createElement('style');
    style.id='pricebook-modal-scroll-lock-style';
    style.textContent=`
      html.pb-modal-open,body.pb-modal-open{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none}
      .modal.show{overscroll-behavior:contain!important}
      .modal.show .sheet{overscroll-behavior-y:contain!important;-webkit-overflow-scrolling:touch;touch-action:pan-y}
    `;
    document.head.appendChild(style);
    const syncModalLock=()=>{
      const any=!!document.querySelector('.modal.show');
      document.documentElement.classList.toggle('pb-modal-open',any);
      document.body.classList.toggle('pb-modal-open',any);
      const q=$('quickRecordModal');
      const now=!!q?.classList.contains('show');
      if(now&&!modalWasOpen){committed=false;modalWasOpen=true;}
      if(!now&&modalWasOpen){
        modalWasOpen=false;
        if(!committed){
          const p=preparePromise;prepareGeneration++;preparePromise=null;
          p?.then(path=>removePrepared(path)).catch(()=>{});
          if(preparedPath)removePrepared(preparedPath);
        }else committed=false;
      }
    };
    const mo=new MutationObserver(syncModalLock);
    mo.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
    syncModalLock();

    if(typeof window.openNewProductForBarcode==='function'){
      window.openNewProductForBarcode=function(code,data=null){
        closeModal('barcodeModal');
        openRecordModal('__barcode_new__');
        setAddMode('new');
        document.getElementById('newBarcode').value=normalizeBarcode(code);
        if(data){
          document.getElementById('newName').value=data.name||'';
          document.getElementById('newBrand').value=data.brand||'';
          const cat=data.productType==='food'?'食品':data.productType==='beauty'?'美妝':data.productType==='petfood'?'寵物用品':'未分類';
          document.getElementById('newCategory').value=cat;
        }
      };
    }
  }
  boot();
})();
