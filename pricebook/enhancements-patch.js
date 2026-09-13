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
      // 若截圖只有物流／完成時間，仍先帶入可辨識日期讓使用者確認。
      // 有多個日期時取最早的一個，通常會比取件／完成日更接近實際購買日。
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

    // 條碼查不到商品時仍直接進「完整新增」，不要被快速新增選單攔住。
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
