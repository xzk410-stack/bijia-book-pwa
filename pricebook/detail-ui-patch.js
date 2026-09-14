(() => {
  if (window.__pricebookDetailUiPatchLoaded) return;
  window.__pricebookDetailUiPatchLoaded = true;

  const style=document.createElement('style');
  style.id='pricebook-detail-ui-style';
  style.textContent=`
    .product-data-edit-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0 12px;padding:11px 12px;border:1px solid var(--line);border-radius:14px;background:#F7FAF6}
    .product-data-edit-bar b{display:block;font-size:13px;color:var(--text)}
    .product-data-edit-bar small{display:block;margin-top:3px;font-size:11px;color:var(--muted);line-height:1.45}
    .product-data-edit-bar button{flex:0 0 auto;border:0;border-radius:11px;background:#EAF4EC;color:#357554;padding:8px 10px;font-size:11px;font-weight:800}
    .record-product-helper{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 11px;margin:0 0 12px;border-radius:13px;background:#F2F7F2;border:1px solid #DDE9DF}
    .record-product-helper span{min-width:0}
    .record-product-helper b{display:block;font-size:12px}
    .record-product-helper small{display:block;margin-top:2px;color:var(--muted);font-size:10.5px;line-height:1.4}
    .record-product-helper button{flex:0 0 auto;border:0;border-radius:10px;background:#fff;color:#397656;padding:7px 9px;font-size:10.5px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.04)}
    .history-actions-single{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-top:9px;padding-bottom:1px}
    .history-actions-single::-webkit-scrollbar{display:none}
    .history-actions-single .btn,.history-actions-single button{flex:0 0 auto!important;white-space:nowrap!important;font-size:10.5px!important;padding:7px 8px!important;border-radius:11px!important}
    .history-actions-single .danger{color:var(--bad)!important}
    @media(max-width:420px){
      .product-data-edit-bar{align-items:flex-start}
      .product-data-edit-bar button{padding:7px 8px}
      .history-actions-single{gap:5px}
      .history-actions-single .btn,.history-actions-single button{font-size:10px!important;padding:6px 7px!important}
    }
  `;
  document.head.appendChild(style);

  function getCurrentProduct(){
    try{
      if(typeof currentDetailId==='undefined' || !currentDetailId || typeof getProduct!=='function') return null;
      return getProduct(currentDetailId);
    }catch{return null;}
  }

  function openProductEditor(pid){
    try{
      if(typeof window.editProduct==='function') window.editProduct(pid);
    }catch{}
  }

  function decorateDetail(){
    const detail=document.getElementById('detailContent');
    const p=getCurrentProduct();
    if(!detail || !p) return;

    const title=detail.querySelector('.detail-title');
    if(title){
      let bar=detail.querySelector('.product-data-edit-bar');
      if(!bar){
        bar=document.createElement('div');
        bar.className='product-data-edit-bar';
        title.insertAdjacentElement('afterend',bar);
      }
      bar.innerHTML=`<span><b>商品資料</b><small>分類：${String(p.category||'未分類')}　·　比較單位：${String(p.unit||'個')}</small></span><button type="button">編輯商品資料</button>`;
      bar.querySelector('button').onclick=()=>openProductEditor(p.id);
    }

    detail.querySelectorAll('.section-title button').forEach(btn=>{
      if(btn.textContent.trim()==='編輯商品') btn.textContent='編輯商品資料';
    });

    detail.querySelectorAll('.history .hrow').forEach(row=>{
      let single=row.querySelector(':scope > .history-actions-single');
      if(!single){
        const buttons=[...row.querySelectorAll('button')];
        if(!buttons.length) return;
        single=document.createElement('div');
        single.className='history-actions-single';
        row.appendChild(single);
        buttons.forEach(btn=>single.appendChild(btn));
      }
      [...single.querySelectorAll('button')].forEach(btn=>{
        const t=btn.textContent.replace(/\s+/g,' ').trim();
        if(t==='編輯') btn.textContent='編輯價格';
        else if(/更換截圖/.test(t)) btn.textContent='更換';
        else if(/移除截圖/.test(t)) btn.textContent='移除';
        else if(/查看截圖/.test(t)) btn.textContent='查看截圖';
      });
      row.querySelectorAll('.receipt-actions').forEach(x=>{if(!x.children.length)x.remove();});
    });
  }

  function decorateRecordModal(){
    const modal=document.getElementById('recordModal');
    if(!modal || !modal.classList.contains('show')) return;
    const sheet=modal.querySelector('.sheet');
    const head=modal.querySelector('.sheet-head');
    if(!sheet || !head) return;

    let pid='';
    try{
      if(typeof editingRecord!=='undefined' && editingRecord?.pid) pid=editingRecord.pid;
      if(!pid) pid=document.getElementById('recordProduct')?.value||'';
    }catch{}
    if(!pid || typeof getProduct!=='function') return;
    const p=getProduct(pid); if(!p) return;

    let helper=modal.querySelector('.record-product-helper');
    if(!helper){
      helper=document.createElement('div');
      helper.className='record-product-helper';
      head.insertAdjacentElement('afterend',helper);
    }
    helper.innerHTML=`<span><b>這裡是價格紀錄</b><small>商品分類：${String(p.category||'未分類')}　·　比較單位：${String(p.unit||'個')}</small></span><button type="button">改分類／單位</button>`;
    helper.querySelector('button').onclick=()=>{
      modal.classList.remove('show');
      openProductEditor(pid);
    };
  }

  // Do not observe our own DOM writes; coalesce external changes into one task.
  let pending = false;
  const options = {subtree:true,childList:true,attributes:true,attributeFilter:['class']};
  function schedule(){
    if(pending)return;
    pending=true;
    setTimeout(run,30);
  }
  const mo=new MutationObserver(schedule);
  function run(){
    pending=false;
    mo.disconnect();
    try { decorateDetail(); decorateRecordModal(); }
    finally { mo.observe(document.body,options); }
  }
  mo.observe(document.body,options);
  document.addEventListener('click',schedule,true);
  schedule();
})();
