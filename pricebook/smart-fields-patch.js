(() => {
  if (window.__pbSmartFields) return;
  window.__pbSmartFields = true;
  const $ = id => document.getElementById(id);
  const defaults = {
    category:['未分類','日用品','清潔用品','衛生用品','食品','飲料','美妝','保養','居家用品','寵物用品','3C','家電','服飾','母嬰','文具','其他'],
    store:['蝦皮','momo','PChome','全聯','家樂福','寶雅','屈臣氏','康是美','Costco','好市多']
  };
  const tidy = v => String(v || '').replace(/\s+/g,' ').trim();
  const key = v => tidy(v).normalize('NFKC').toLowerCase().replace(/＆/g,'&').replace(/\s+/g,'');
  const ps = () => Array.isArray(window.db?.products) ? window.db.products : [];

  const style = document.createElement('style');
  style.textContent = '.smart-suggest{display:none;margin-top:5px;border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}.smart-suggest.show{display:block}.smart-suggest button{display:block;width:100%;border:0;border-bottom:1px solid #f0ede6;background:#fff;text-align:left;padding:9px 11px;color:#314d40;font-size:13px}.smart-suggest button:last-child{border-bottom:0}';
  document.head.appendChild(style);

  function score(v){
    let s=0;
    if(/[A-Z]/.test(v))s+=2;
    if(/[a-z]/.test(v))s+=1;
    if(!/^\s|\s$/.test(v))s+=1;
    return s;
  }
  function rows(type){
    let list=[];
    if(type==='brand') list=ps().map(p=>p.brand);
    if(type==='category') list=[...defaults.category,...ps().map(p=>p.category)];
    if(type==='store') list=[...defaults.store,...ps().flatMap(p=>(p.records||[]).map(r=>r.store))];
    const map=new Map();
    list.map(tidy).filter(Boolean).forEach(v=>{
      const k=key(v);
      if(!map.has(k)) map.set(k,v);
      else if(type==='brand' && score(v)>score(map.get(k))) map.set(k,v);
    });
    return [...map.values()];
  }
  function canonical(v,type){
    const k=key(v);return rows(type).find(x=>key(x)===k)||tidy(v);
  }
  function removeLegacyPanels(input){
    const parent=input.parentElement;
    if(!parent)return;
    [...parent.children].forEach(el=>{
      if(el!==input && el.classList?.contains('pb-suggest-panel')) el.remove();
    });
  }
  function install(id,type){
    const input=$(id);if(!input||input.dataset.smart==='1'||input.dataset.pbSuggest==='1')return;
    input.dataset.smart='1';input.dataset.pbSuggest='1';input.removeAttribute('list');input.autocomplete='off';
    removeLegacyPanels(input);
    const box=document.createElement('div');box.className='smart-suggest';input.insertAdjacentElement('afterend',box);
    const render=()=>{
      removeLegacyPanels(input);
      const q=key(input.value);
      const items=rows(type).filter(v=>!q||key(v).includes(q)).sort((a,b)=>{
        const as=key(a).startsWith(q)?0:1,bs=key(b).startsWith(q)?0:1;
        return as-bs || a.localeCompare(b,'zh-Hant');
      }).slice(0,5);
      if(!items.length){box.classList.remove('show');box.innerHTML='';return;}
      box.innerHTML=items.map(v=>'<button type="button"></button>').join('');
      [...box.children].forEach((b,i)=>{
        b.textContent=items[i];
        b.onmousedown=e=>e.preventDefault();
        b.onclick=()=>{input.value=items[i];box.classList.remove('show');input.dispatchEvent(new Event('change',{bubbles:true}))};
      });
      box.classList.add('show');
    };
    input.addEventListener('focus',render);input.addEventListener('input',render);
    input.addEventListener('blur',()=>setTimeout(()=>{input.value=canonical(input.value,type);box.classList.remove('show')},100));
  }
  function run(){
    install('newBrand','brand');install('editProductBrand','brand');install('quickBrand','brand');
    install('newCategory','category');install('editProductCategory','category');install('quickCategory','category');
    install('recordStore','store');install('quickStore','store');install('cmpStore','store');
  }
  run();let n=0;const t=setInterval(()=>{run();if(++n>20)clearInterval(t)},300);
})();
