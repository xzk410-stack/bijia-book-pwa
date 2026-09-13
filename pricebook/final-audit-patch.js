(() => {
  if(window.__pricebookFinalAuditLoaded)return;
  window.__pricebookFinalAuditLoaded=true;
  const $=id=>document.getElementById(id);
  const tidy=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>tidy(v).normalize('NFKC').toLowerCase().replace(/＆/g,'&').replace(/\s+/g,'');
  const localToday=()=>{
    const d=new Date();
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };

  try{today=localToday}catch{}
  try{window.today=localToday}catch{}

  function isAndroidApp(){
    try{return /BijiaBook\//i.test(navigator.userAgent)||!!window.Android||!!parent?.Android}catch{return /Android/i.test(navigator.userAgent)}
  }

  function polishSettings(){
    if(isAndroidApp()){
      const ios=$('iosInstallCard');if(ios)ios.style.display='none';
    }
    const backupPanel=[...document.querySelectorAll('#settingsView .panel')].find(p=>p.querySelector('#backupList'));
    if(backupPanel){
      const notes=backupPanel.querySelectorAll('.smallnote');
      if(notes[0])notes[0].textContent='每次新增、修改或刪除資料時，會自動保留最近 30 個本機版本；需要時可直接還原。重要資料建議另外用「另存備份檔」存到 Google Drive、OneDrive 或其他位置。';
    }
  }

  function polishStats(){
    const rows=[...document.querySelectorAll('#statsContent .rank-row')];
    if(!rows.length||typeof statsOf!=='function'||typeof displayUnitPrice!=='function')return;
    const ps=(db?.products||[]).filter(p=>statsOf(p).count).map(p=>{const s=statsOf(p);return{p,s,spread:s.low?((s.high-s.low)/s.low*100):0}}).sort((a,b)=>b.spread-a.spread).slice(0,5);
    rows.forEach((row,i)=>{
      const x=ps[i];if(!x)return;
      const meta=row.querySelector('.meta'),bar=row.querySelector('.bar'),right=row.querySelector(':scope > b:last-child');
      if(x.s.count===1){
        if(meta)meta.textContent=`目前只有 1 筆 · ${displayUnitPrice(x.p,x.s.low)}`;
        if(bar)bar.style.display='none';
        if(right)right.textContent='1筆';
      }else if(bar){bar.style.display='block';}
    });
  }

  if(typeof renderStats==='function'&&!renderStats.__pbAuditWrapped){
    const old=renderStats;
    const wrapped=function(){const out=old.apply(this,arguments);setTimeout(polishStats,0);return out;};
    wrapped.__pbAuditWrapped=true;
    try{renderStats=wrapped}catch{}
  }

  if(typeof openRecordModal==='function'&&!openRecordModal.__pbAuditWrapped){
    const old=openRecordModal;
    const wrapped=function(){const image=$('newImage');if(image)image.value='';return old.apply(this,arguments);};
    wrapped.__pbAuditWrapped=true;
    try{openRecordModal=wrapped}catch{}
  }

  function existingBrands(){return (db?.products||[]).map(p=>p.brand).filter(Boolean)}
  function existingCategories(){return ['未分類','日用品','清潔用品','衛生用品','食品','飲料','美妝','保養','居家用品','寵物用品','3C','家電','服飾','母嬰','文具','其他',...(db?.products||[]).map(p=>p.category)].filter(Boolean)}
  function existingStores(){return ['蝦皮','momo','PChome','全聯','家樂福','寶雅','屈臣氏','康是美','Costco','好市多',...(db?.products||[]).flatMap(p=>(p.records||[]).map(r=>r.store))].filter(Boolean)}
  function canonical(value,list){const k=norm(value);return list.map(tidy).find(v=>v&&norm(v)===k)||tidy(value)}

  const save=$('saveRecord');
  if(save&&typeof save.onclick==='function'&&!save.onclick.__pbAuditWrapped){
    const old=save.onclick;
    const wrapped=async function(e){
      try{
        const store=$('recordStore');if(store)store.value=canonical(store.value,existingStores());
        if(typeof editingRecord!=='undefined'&&!editingRecord&&typeof addMode!=='undefined'&&addMode==='new'){
          const name=$('newName'),brand=$('newBrand'),cat=$('newCategory');
          if(brand)brand.value=canonical(brand.value,existingBrands());
          if(cat)cat.value=canonical(cat.value,existingCategories())||'未分類';
          const n=norm(name?.value||''),b=norm(brand?.value||'');
          const dup=(db?.products||[]).find(p=>norm(p.name)===n&&norm(p.brand||'')===b);
          if(dup){
            const use=confirm(`已有相同名稱與品牌的商品「${dup.name}」。\n\n按「確定」直接把這筆價格記到既有商品；按「取消」回去修改商品名稱。`);
            if(!use)return;
            if(typeof setAddMode==='function')setAddMode('existing');
            const sel=$('recordProduct');if(sel)sel.value=dup.id;
          }
        }
      }catch{}
      return old.call(this,e);
    };
    wrapped.__pbAuditWrapped=true;
    save.onclick=wrapped;
  }

  function run(){polishSettings();polishStats();}
  run();
  setTimeout(run,300);
  setTimeout(run,1200);
  document.addEventListener('click',()=>setTimeout(run,30),true);
})();
