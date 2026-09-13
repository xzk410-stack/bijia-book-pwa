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
      return{product,store,qty,total:productTotal,orderTotal};
    };

    window.onOrderOcrResult=(payload)=>{
      try{
        const result=typeof payload==='string'?JSON.parse(payload):payload;if(!result?.ok)throw new Error(result?.error||'辨識失敗');
        const p=parse(result.text||'');
        if(p.product)$('quickProduct').value=p.product;if(p.store)$('quickStore').value=p.store;if(p.qty)$('quickQty').value=p.qty;if(p.total)$('quickTotal').value=p.total;
        if(p.orderTotal&&p.total&&p.orderTotal!==p.total)$('quickNote').value=`訂單實付 $${p.orderTotal}；商品總額 $${p.total}`;
        const evt=new Event('input',{bubbles:true});$('quickQty')?.dispatchEvent(evt);$('quickTotal')?.dispatchEvent(evt);
        setStatus('已辨識並帶入可判斷的欄位，請確認商品名稱、數量與商品總額後再儲存。','ok');
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
  }
  boot();
})();
