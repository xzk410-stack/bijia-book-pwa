(() => {
  if (window.__pricebookUx169) return;
  window.__pricebookUx169 = true;

  const $ = id => document.getElementById(id);
  const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const UNIT_DEFAULTS = ['個','包','袋','盒','箱','串','捲','瓶','罐','組','入','件','張','抽','片','顆','份','台','公尺','ml','L','g','kg'];
  const CATEGORY_DEFAULTS = ['未分類','日用品','廚房紙巾','衛生紙','清潔用品','衛生用品','食品','飲料','美妝','保養','居家用品','寵物用品','3C','家電','服飾','母嬰','文具','其他'];

  const style = document.createElement('style');
  style.id = 'pricebook-ux-169-style';
  style.textContent = `
    #homeView .hero{padding:12px 14px;border-radius:17px;margin-bottom:10px;box-shadow:0 4px 14px rgba(45,76,59,.06)}
    #homeView .hero-title{display:none}
    #homeView .hero-big{font-size:16px;line-height:1.3}
    #homeView .hero-sub{font-size:11px;margin-top:3px}
    #homeView .stats{display:flex;gap:7px;margin-top:9px}
    #homeView .stat{flex:1;padding:7px 6px;border-radius:11px}
    #homeView .stat b{display:inline;font-size:14px;margin-right:3px}
    #homeView .stat span{font-size:10px}
    .pb-combo{position:relative}
    .pb-combo-input{width:100%;min-height:46px;border:1px solid var(--line);border-radius:13px;background:#fff;padding:11px 38px 11px 12px;outline:none;color:var(--text)}
    .pb-combo-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(79,139,104,.11)}
    .pb-combo-arrow{position:absolute;right:11px;top:13px;color:var(--muted);pointer-events:none}
    .pb-combo-menu{display:none;position:absolute;left:0;right:0;z-index:40;margin-top:5px;max-height:210px;overflow:auto;border:1px solid var(--line);border-radius:13px;background:#fff;box-shadow:0 10px 28px rgba(45,76,59,.14)}
    .pb-combo.open .pb-combo-menu{display:block}
    .pb-combo-option{display:block;width:100%;border:0;border-bottom:1px solid #f0ede6;background:#fff;text-align:left;padding:10px 12px;color:var(--text)}
    .pb-combo-option:last-child{border-bottom:0}
    .pb-combo-add{color:var(--accent);font-weight:800;background:#f3f8f3}
    .pb-combo-hint{font-size:10px;color:var(--muted);margin-top:4px}
    @media(max-width:520px){#homeView .hero{padding:11px 12px}#homeView .hero-big{font-size:15px}}
  `;
  document.head.appendChild(style);

  function productUnits(){
    try { return (db.products || []).map(p => clean(p.unit)).filter(Boolean); } catch { return []; }
  }
  function recordPackUnits(){
    try { return (db.products || []).flatMap(p => (p.records || []).map(r => clean(r.packUnit))).filter(Boolean); } catch { return []; }
  }
  function productCategories(){
    try { return (db.products || []).map(p => clean(p.category)).filter(Boolean); } catch { return []; }
  }
  function uniq(values){ return [...new Set(values.map(clean).filter(Boolean))]; }

  function bindSelect(id, valuesFn, hint){
    const select = $(id);
    if (!select || select.dataset.comboBound === '1') return;
    select.dataset.comboBound = '1';
    select.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.className = 'pb-combo';
    wrap.innerHTML = '<input class="pb-combo-input" autocomplete="off"><span class="pb-combo-arrow">⌄</span><div class="pb-combo-menu"></div>' + (hint ? '<div class="pb-combo-hint">'+escHtml(hint)+'</div>' : '');
    select.insertAdjacentElement('afterend', wrap);
    const input = wrap.querySelector('input'), menu = wrap.querySelector('.pb-combo-menu');
    input.value = select.value || '';

    const commit = value => {
      value = clean(value);
      if (!value) return;
      let option = [...select.options].find(o => clean(o.value).toLowerCase() === value.toLowerCase());
      if (!option) { option = new Option(value, value); select.add(option); }
      select.value = option.value;
      input.value = option.value;
      select.dispatchEvent(new Event('input', {bubbles:true}));
      select.dispatchEvent(new Event('change', {bubbles:true}));
      wrap.classList.remove('open');
    };
    const render = () => {
      const q = clean(input.value).toLowerCase();
      const vals = uniq([...valuesFn(), ...[...select.options].map(o => o.value)])
        .filter(v => !q || v.toLowerCase().includes(q)).slice(0, 18);
      menu.innerHTML = vals.map(v => '<button type="button" class="pb-combo-option" data-value="'+escHtml(v)+'">'+escHtml(v)+'</button>').join('');
      const exact = q && vals.some(v => v.toLowerCase() === q);
      if (q && !exact) menu.insertAdjacentHTML('beforeend','<button type="button" class="pb-combo-option pb-combo-add" data-add="1">＋ 新增「'+escHtml(clean(input.value))+'」</button>');
      menu.querySelectorAll('[data-value]').forEach(b => {
        b.onmousedown = e => e.preventDefault();
        b.onclick = () => commit(b.dataset.value);
      });
      const add = menu.querySelector('[data-add]');
      if (add) { add.onmousedown=e=>e.preventDefault(); add.onclick=()=>commit(input.value); }
      wrap.classList.add('open');
    };
    input.addEventListener('focus', render);
    input.addEventListener('input', render);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commit(input.value); }
      if (e.key === 'Escape') wrap.classList.remove('open');
    });
    input.addEventListener('blur', () => setTimeout(() => {
      if (clean(input.value)) commit(input.value); else input.value = select.value || '';
      wrap.classList.remove('open');
    }, 120));
    select.addEventListener('change', () => { if (document.activeElement !== input) input.value = select.value || ''; });
  }

  function bindTextInput(id, valuesFn){
    const input=$(id);
    if(!input || input.dataset.uxSuggest==='1' || input.dataset.smart==='1' || input.dataset.pbSuggest==='1') return;
    input.dataset.uxSuggest='1';
    const menu=document.createElement('div'); menu.className='pb-combo-menu'; input.parentElement.classList.add('pb-combo'); input.insertAdjacentElement('afterend',menu);
    const render=()=>{
      const q=clean(input.value).toLowerCase();
      const vals=uniq(valuesFn()).filter(v=>!q||v.toLowerCase().includes(q)).slice(0,18);
      menu.innerHTML=vals.map(v=>'<button type="button" class="pb-combo-option" data-value="'+escHtml(v)+'">'+escHtml(v)+'</button>').join('');
      if(q&&!vals.some(v=>v.toLowerCase()===q))menu.insertAdjacentHTML('beforeend','<div class="pb-combo-option pb-combo-add">可直接新增「'+escHtml(clean(input.value))+'」</div>');
      menu.querySelectorAll('[data-value]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>{input.value=b.dataset.value;input.dispatchEvent(new Event('change',{bubbles:true}));input.parentElement.classList.remove('open')}});
      input.parentElement.classList.add('open');
    };
    input.addEventListener('focus',render); input.addEventListener('input',render);
    input.addEventListener('blur',()=>setTimeout(()=>input.parentElement.classList.remove('open'),120));
  }

  function install(){
    bindSelect('newUnit', () => [...UNIT_DEFAULTS,...productUnits()], '可搜尋；沒有的單位可直接輸入新增');
    bindSelect('recordPackUnit', () => [...UNIT_DEFAULTS,...recordPackUnits()], '可搜尋；沒有的包裝單位可直接輸入新增');
    bindSelect('cmpPackUnit', () => [...UNIT_DEFAULTS,...recordPackUnits()], '可搜尋；沒有的包裝單位可直接輸入新增');
    bindSelect('quickUnit', () => [...UNIT_DEFAULTS,...productUnits()], '可搜尋；沒有的單位可直接輸入新增');
    bindSelect('editProductUnit', () => [...UNIT_DEFAULTS,...productUnits()], '可搜尋；沒有的單位可直接輸入新增');
    bindTextInput('newCategory', () => [...CATEGORY_DEFAULTS,...productCategories()]);
    bindTextInput('editProductCategory', () => [...CATEGORY_DEFAULTS,...productCategories()]);
  }

  function smartPrice(value){
    const n=Number(value);
    if(!Number.isFinite(n))return '—';
    const digits=Math.abs(n)<1?4:Math.abs(n)<10?3:2;
    return '$'+n.toLocaleString('zh-TW',{minimumFractionDigits:0,maximumFractionDigits:digits});
  }
  window.displayUnitPrice = (p,val) => val==null ? '—' : smartPrice(val)+' / '+(typeof esc==='function'?esc(p.unit||'件'):(p.unit||'件'));

  const originalRenderHome=typeof renderHome==='function'?renderHome:null;
  if(originalRenderHome){
    renderHome=function(...args){const out=originalRenderHome(...args);install();return out;};
  }
  const originalOpenRecordModal=typeof openRecordModal==='function'?openRecordModal:null;
  if(originalOpenRecordModal){
    openRecordModal=function(...args){const out=originalOpenRecordModal(...args);setTimeout(install,0);return out;};
  }

  function version(){
    document.querySelectorAll('.version-note').forEach(el=>{if(/比價簿\s*v/i.test(el.textContent||''))el.textContent='比價簿 v1.6.9';});
  }
  install(); version();
  try{renderHome();}catch{}
  document.addEventListener('click',()=>setTimeout(()=>{install();version();},30),true);
  setInterval(()=>{install();version();},2500);
})();