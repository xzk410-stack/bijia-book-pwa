(() => {
  if(window.__pricebookFinalQuickPatchLoaded)return;
  window.__pricebookFinalQuickPatchLoaded=true;

  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const products=()=>{try{return typeof db!=='undefined'&&Array.isArray(db.products)?db.products:[]}catch{return[]}};

  const style=document.createElement('style');
  style.id='pricebook-final-quick-style';
  style.textContent='#quickRecordModal .quick-pack-note{font-size:11px;color:var(--muted);line-height:1.45;margin-top:-2px}@media(max-width:520px){#quickRecordModal .quick-two{grid-template-columns:1fr!important}}';
  document.head.appendChild(style);

  function install(){
    const qty=$('quickQty'),unit=$('quickUnit'),preview=$('quickUnitPreview');
    if(!qty||!unit||!preview)return false;

    let size=$('quickUnitSize'),pack=$('quickPackUnit');
    if(!size||!pack){
      const row=qty.closest('.quick-two');
      if(!row)return false;
      if(row.dataset.pbPack!=='1'){
        row.dataset.pbPack='1';
        const qf=qty.closest('.quick-field'),uf=unit.closest('.quick-field');
        if(!qf||!uf)return false;
        const ql=qf.querySelector('label'),ul=uf.querySelector('label');
        if(ql)ql.textContent='件數 *';
        if(ul)ul.textContent='比較單位 *';

        const sf=document.createElement('div');
        sf.className='quick-field';
        sf.innerHTML='<label>單件內容量（選填）</label><input id="quickUnitSize" type="number" min="0" step="0.01" inputmode="decimal" placeholder="例如 690"><div class="quick-pack-note">商品以 g、ml 等單位比價時填這裡。</div>';
        row.insertBefore(sf,qf);

        const cr=document.createElement('div');
        cr.className='quick-two';
        const pf=document.createElement('div');
        pf.className='quick-field';
        pf.innerHTML='<label>包裝單位</label><select id="quickPackUnit"><option>件</option><option>瓶</option><option>罐</option><option>包</option><option>盒</option><option>袋</option><option>個</option><option>卷</option><option>組</option><option>入</option></select>';
        cr.appendChild(qf);
        cr.appendChild(pf);
        row.insertAdjacentElement('afterend',cr);
      }
      size=$('quickUnitSize');
      pack=$('quickPackUnit');
    }
    if(!size||!pack)return false;

    const refresh=()=>{
      const s=Number(size.value)||0;
      const c=Number(qty.value)||0;
      const raw=$('quickTotal')?.value;
      const t=raw===''?null:Number(raw);
      const u=unit.value||'個';
      const pu=pack.value||'件';
      if(c<=0){
        const text='填入件數與商品總額後，自動計算單位價';
        if(preview.textContent!==text)preview.textContent=text;
        return;
      }
      const total=s>0?s*c:c;
      const spec=s>0?`${s}${u} × ${c}${pu} = ${Number(total.toFixed(4))}${u}`:`${c}${pu}`;
      const prices=t==null?'':`NT$${Number((t/c).toFixed(2))}/${pu}　·　NT$${Number((t/total).toFixed(3))}/${u}`;
      const html=`<b>${spec}</b>${prices?`<div style="margin-top:4px;font-size:12px;color:var(--muted)">${prices}</div>`:''}`;
      if(preview.innerHTML!==html)preview.innerHTML=html;
    };

    if(!qty.dataset.pbPackListeners){
      qty.dataset.pbPackListeners='1';
      ['quickUnitSize','quickQty','quickTotal'].forEach(id=>$(id)?.addEventListener('input',refresh));
      ['quickUnit','quickPackUnit'].forEach(id=>$(id)?.addEventListener('change',refresh));
      $('quickProduct')?.addEventListener('input',()=>{
        try{
          const p=products().find(x=>clean(x.name).toLowerCase()===clean($('quickProduct').value).toLowerCase());
          if(p){
            if(p.unit)unit.value=p.unit;
            const latest=(p.records||[]).slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).find(r=>Number(r.unitSize)>0);
            if(latest&&!size.value)size.value=latest.unitSize;
            if(latest?.packUnit)pack.value=latest.packUnit;
          }
        }catch{}
        setTimeout(refresh,0);
      });
      ['openQuickManual','openQuickOcr'].forEach(id=>$(id)?.addEventListener('click',()=>setTimeout(()=>{
        size.value='';
        pack.value='件';
        refresh();
      },0)));
    }

    const btn=$('quickSave');
    if(btn&&typeof btn.onclick==='function'&&!btn.onclick.__pbPackWrapper){
      const old=btn.onclick;
      const wrapped=async function(e){
        const name=clean($('quickProduct')?.value);
        const count=Number(qty.value)||0;
        const unitSize=Number(size.value)||0;
        const packUnit=pack.value||'件';
        const beforeProduct=products().find(p=>clean(p.name).toLowerCase()===name.toLowerCase());
        const compareUnit=beforeProduct?.unit||unit.value||'個';
        if(['g','kg','ml','L','cm','公尺'].includes(compareUnit)&&count>0&&!(unitSize>0)){
          toast(`這個商品以 ${compareUnit} 比價，請填「單件內容量」`);
          return;
        }
        const totalQty=unitSize>0?unitSize*count:count;
        const oldQty=qty.value;
        const beforeIds=new Set((beforeProduct?.records||[]).map(r=>r.id));
        qty.value=String(totalQty||'');
        try{
          await old.call(this,e);
        }finally{
          qty.value=oldQty;
        }
        const p=products().find(p=>clean(p.name).toLowerCase()===name.toLowerCase());
        if(!p)return;
        const r=(p.records||[]).filter(x=>!beforeIds.has(x.id)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0];
        if(!r)return;
        r.unitSize=unitSize;
        r.packCount=count;
        r.packUnit=packUnit;
        r.qty=totalQty;
        r.spec=unitSize>0?`${unitSize}${p.unit||compareUnit} × ${count}${packUnit}`:`${count}${packUnit}`;
        try{saveDB('補充快速價格包裝資訊');openDetail(p.id)}catch{}
      };
      wrapped.__pbPackWrapper=true;
      btn.onclick=wrapped;
    }

    refresh();
    return true;
  }

  function run(){
    if(window.__pricebookEnhancementsPatchLoaded)install();
  }

  run();
  let tries=0;
  const bootTimer=setInterval(()=>{
    run();
    tries++;
    if(tries>=20)clearInterval(bootTimer);
  },400);
  document.addEventListener('click',()=>setTimeout(run,30),true);
  document.addEventListener('focusin',()=>setTimeout(run,20),true);
  setInterval(run,5000);
})();