(() => {
  if(window.__pbQuickNewProduct)return;
  window.__pbQuickNewProduct=true;
  const $=id=>document.getElementById(id);
  const tidy=v=>String(v||'').replace(/\s+/g,' ').trim();
  const nameKey=v=>tidy(v).normalize('NFKC').toLowerCase();
  const norm=v=>tidy(v).normalize('NFKC').toLowerCase().replace(/＆/g,'&').replace(/\s+/g,'');
  const products=()=>Array.isArray(window.db?.products)?window.db.products:[];
  const existing=name=>products().find(p=>nameKey(p.name)===nameKey(name));
  function canonical(value,type){
    const k=norm(value);if(!k)return '';
    const vals=type==='brand'?products().map(p=>p.brand):products().map(p=>p.category);
    return vals.map(tidy).find(v=>v&&norm(v)===k)||tidy(value);
  }
  function installFields(){
    const input=$('quickProduct');if(!input)return false;
    let box=$('quickNewMeta');
    if(!box){
      box=document.createElement('div');box.id='quickNewMeta';box.className='quick-form';
      box.style.display='none';box.style.padding='11px 12px';box.style.border='1px dashed #DDE5DC';box.style.borderRadius='14px';box.style.background='#FAFCF9';
      box.innerHTML='<div style="font-size:12px;color:#5F7468;font-weight:700">新商品資料（選填）</div><div class="quick-field"><label>品牌</label><input id="quickBrand" placeholder="例如 P&G"></div><div class="quick-field"><label>分類</label><input id="quickCategory" placeholder="例如 清潔用品"></div>';
      input.closest('.quick-field')?.insertAdjacentElement('afterend',box);
    }
    const sync=()=>{const isNew=!!tidy(input.value)&&!existing(input.value);box.style.display=isNew?'grid':'none';};
    if(input.dataset.quickMeta!=='1'){
      input.dataset.quickMeta='1';input.addEventListener('input',sync);input.addEventListener('change',sync);
    }
    sync();return true;
  }
  function wrapSave(){
    const btn=$('quickSave');if(!btn||typeof btn.onclick!=='function'||btn.onclick.__quickMeta)return false;
    const old=btn.onclick;
    const wrapped=async function(e){
      const name=tidy($('quickProduct')?.value),wasExisting=!!existing(name);
      const brand=canonical($('quickBrand')?.value,'brand'),category=canonical($('quickCategory')?.value,'category');
      await old.call(this,e);
      if(!wasExisting){
        const p=existing(name);
        if(p){
          if(brand)p.brand=brand;
          if(category)p.category=category;
          try{saveDB('補充快速新增商品資料');openDetail(p.id)}catch{}
        }
      }
    };
    wrapped.__quickMeta=true;btn.onclick=wrapped;return true;
  }
  function run(){installFields();wrapSave();}
  run();let n=0;const t=setInterval(()=>{run();if(++n>20)clearInterval(t)},300);
})();
