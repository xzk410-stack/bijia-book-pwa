(() => {
  if (window.__pricebookFinalUiPatchLoaded) return;
  window.__pricebookFinalUiPatchLoaded = true;
  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const escHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CATS=['未分類','日用品','清潔用品','衛生用品','食品','飲料','美妝','保養','居家用品','寵物用品','3C','家電','服飾','母嬰','文具','其他'];
  const STORES=['蝦皮','momo','PChome','全聯','家樂福','寶雅','屈臣氏','康是美','Costco','好市多'];
  const style=document.createElement('style');
  style.textContent=`
    #compareView .compare-core,#compareView .compare-spec-grid{grid-template-columns:1fr!important}
    #compareView .compare-core .field,#compareView .compare-spec-grid .field{grid-column:auto!important;min-width:0}
    #compareView .compare-core input,#compareView .compare-core select,#compareView .compare-spec-grid input,#compareView .compare-spec-grid select{min-height:50px}
    .pb-suggest-panel{display:none;border:1px solid var(--line);border-radius:13px;background:#fff;box-shadow:0 8px 24px rgba(45,76,59,.10);overflow:hidden;margin-top:5px;max-height:190px;overflow-y:auto}
    .pb-suggest-panel.show{display:block}.pb-suggest-option{display:block;width:100%;border:0;border-bottom:1px solid #F0EDE6;background:#fff;color:#314D40;text-align:left;padding:10px 12px;font-size:13px;font-weight:600}.pb-suggest-option:last-child{border-bottom:0}.pb-suggest-empty{padding:10px 12px;color:var(--muted);font-size:12px}
    .pb-product-picker{display:grid;gap:7px}.pb-product-trigger{width:100%;border:1px solid var(--line);border-radius:14px;background:#fff;color:#29473B;padding:12px 13px;min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:16px;font-weight:650;text-align:left}.pb-product-panel{display:none;border:1px solid var(--line);border-radius:14px;background:#fff;overflow:hidden}.pb-product-panel.show{display:block}.pb-product-search{width:calc(100% - 20px)!important;margin:10px!important;min-height:42px!important;font-size:14px!important}.pb-product-list{max-height:250px;overflow-y:auto;border-top:1px solid #F0EDE6}.pb-product-option{display:block;width:100%;border:0;border-bottom:1px solid #F0EDE6;background:#fff;text-align:left;padding:11px 12px;color:#29473B}.pb-product-option b{display:block;font-size:14px}.pb-product-option small{display:block;margin-top:2px;font-size:11px;color:var(--muted)}.pb-product-option.selected{background:#F0F7F1}
  `;
  document.head.appendChild(style);
  const products=()=>{try{return typeof db!=='undefined'&&Array.isArray(db.products)?db.products:[]}catch{return[]}};
  const cats=()=>[...new Set([...products().map(p=>clean(p.category)).filter(Boolean),...CATS])];
  const stores=()=>{const a=[];products().forEach(p=>(p.records||[]).forEach(r=>{const s=clean(r.store);if(s)a.push(s)}));return [...new Set([...a,...STORES])];};
  const productNames=()=>products().map(p=>clean(p.name)).filter(Boolean);
  function attach(input,valuesFn){
    if(!input||input.dataset.pbSuggest==='1')return;
    input.dataset.pbSuggest='1';input.removeAttribute('list');input.setAttribute('autocomplete','off');
    const panel=document.createElement('div');panel.className='pb-suggest-panel';input.insertAdjacentElement('afterend',panel);
    const render=()=>{const q=clean(input.value).toLowerCase();const vals=[...new Set(valuesFn().map(clean).filter(Boolean))].filter(v=>!q||v.toLowerCase().includes(q)).slice(0,12);panel.innerHTML=vals.length?vals.map(v=>`<button type="button" class="pb-suggest-option" data-val="${escHtml(v)}">${escHtml(v)}</button>`).join(''):'<div class="pb-suggest-empty">可直接輸入新的內容</div>';panel.querySelectorAll('[data-val]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>{input.value=b.dataset.val;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));panel.classList.remove('show')}})};
    input.addEventListener('focus',()=>{render();panel.classList.add('show')});input.addEventListener('input',()=>{render();panel.classList.add('show')});input.addEventListener('blur',()=>setTimeout(()=>panel.classList.remove('show'),140));
  }
  function installSuggestions(){attach($('newCategory'),cats);attach($('editProductCategory'),cats);attach($('cmpStore'),stores);attach($('recordStore'),stores);attach($('quickStore'),stores);attach($('quickProduct'),productNames);['newCategory','editProductCategory','recordStore','quickProduct'].forEach(id=>$(id)?.removeAttribute('list'));}
  function label(p){const n=clean(p?.name),b=clean(p?.brand);if(!n||!b)return n||'';const norm=s=>s.toLowerCase().replace(/[｜|·•・()（）\-\s]/g,'');return norm(n).includes(norm(b))?n:`${n} · ${b}`;}
  function ensurePicker(){
    const select=$('cmpProduct');if(!select)return;const field=select.closest('.field');if(!field)return;let wrap=field.querySelector('.pb-product-picker');
    if(!wrap){select.style.display='none';wrap=document.createElement('div');wrap.className='pb-product-picker';wrap.innerHTML='<button type="button" class="pb-product-trigger"><span class="label">選擇商品</span><span>⌄</span></button><div class="pb-product-panel"><input class="pb-product-search" type="search" placeholder="搜尋商品或品牌"><div class="pb-product-list"></div></div>';select.insertAdjacentElement('afterend',wrap);const trigger=wrap.querySelector('.pb-product-trigger'),panel=wrap.querySelector('.pb-product-panel'),search=wrap.querySelector('.pb-product-search');trigger.onclick=()=>{panel.classList.toggle('show');if(panel.classList.contains('show')){renderPicker();setTimeout(()=>search.focus(),30)}};search.addEventListener('input',renderPicker)}
    syncPicker();
  }
  function syncPicker(){const select=$('cmpProduct'),wrap=select?.closest('.field')?.querySelector('.pb-product-picker');if(!select||!wrap)return;const p=products().find(x=>String(x.id)===String(select.value));wrap.querySelector('.label').textContent=p?label(p):'選擇商品';renderPicker();}
  function renderPicker(){const select=$('cmpProduct'),wrap=select?.closest('.field')?.querySelector('.pb-product-picker');if(!select||!wrap)return;const q=clean(wrap.querySelector('.pb-product-search')?.value).toLowerCase(),list=wrap.querySelector('.pb-product-list'),ps=products().filter(p=>!q||[p.name,p.brand,p.category].join(' ').toLowerCase().includes(q));if(!ps.length){list.innerHTML='<div class="pb-suggest-empty">找不到商品</div>';return}list.innerHTML=ps.map(p=>{const name=clean(p.name),brand=clean(p.brand),showBrand=brand&&!name.toLowerCase().includes(brand.toLowerCase())?brand:'',meta=[showBrand,p.category,p.unit?`比較單位：${p.unit}`:''].filter(Boolean).join(' · ');return `<button type="button" class="pb-product-option ${String(p.id)===String(select.value)?'selected':''}" data-pid="${escHtml(p.id)}"><b>${escHtml(name)}</b>${meta?`<small>${escHtml(meta)}</small>`:''}</button>`}).join('');list.querySelectorAll('[data-pid]').forEach(b=>b.onclick=()=>{select.value=b.dataset.pid;select.dispatchEvent(new Event('change',{bubbles:true}));try{prefillCompare()}catch{}wrap.querySelector('.pb-product-panel').classList.remove('show');wrap.querySelector('.pb-product-search').value='';syncPicker()});}
  function cleanHistory(){document.querySelectorAll('.history .hrow').forEach(row=>[...row.querySelectorAll('button')].forEach(b=>{const t=clean(b.textContent);if(t==='更換'||t==='更換截圖')b.remove();else if(t==='移除')b.textContent='移除截圖';else if(t==='刪除')b.textContent='刪除價格';else if(t==='編輯')b.textContent='編輯價格'}));}
  function version(){document.querySelectorAll('.version-note').forEach(el=>{if(/比價簿\s*v/i.test(el.textContent||''))el.textContent='比價簿 v1.6.8'})}
  function note(){try{const n=$('compareUnitNote'),p=getProduct($('cmpProduct').value);if(n)n.textContent=p?`目前以「${p.unit||'件'}」為比較單位；同商品不同包裝時，再展開下面規格。`:''}catch{}}
  function run(){installSuggestions();ensurePicker();cleanHistory();version();note()}
  run();const mo=new MutationObserver(()=>setTimeout(run,0));mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});setInterval(run,1800);
})();
