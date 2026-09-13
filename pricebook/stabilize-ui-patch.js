(() => {
  if(window.__pricebookStabilizeUiLoaded)return;
  window.__pricebookStabilizeUiLoaded=true;
  const $=id=>document.getElementById(id);

  const style=document.createElement('style');
  style.id='pricebook-stabilize-ui-style';
  style.textContent=`
    #statsContent .rank-row{grid-template-columns:28px minmax(0,1fr) auto;align-items:center}
    #statsContent .rank-row>div>b{display:block;font-size:14px;font-weight:750;line-height:1.45;letter-spacing:-.01em;color:#28493B}
    #statsContent .rank-row .meta{font-size:11.5px;line-height:1.45}
    #statsContent .rank-row>b:last-child{font-size:14px;font-weight:750}
    .pb-help-panel details{border-top:1px solid var(--line)}
    .pb-help-panel details:first-of-type{border-top:0}
    .pb-help-panel summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;font-weight:800;cursor:pointer}
    .pb-help-panel summary::-webkit-details-marker{display:none}
    .pb-help-panel summary:after{content:'＋';font-size:18px;color:#7B8B82}
    .pb-help-panel details[open] summary:after{content:'－'}
    .pb-help-body{padding:0 0 12px;color:var(--muted);font-size:12px;line-height:1.65}
    .pb-help-example{margin-top:7px;padding:9px 10px;border-radius:11px;background:#F5F8F3;color:#446052}
  `;
  document.head.appendChild(style);

  function fieldOf(id){const el=$(id);return el?el.closest('.field'):null}

  function fixCompareLayout(){
    const view=$('compareView');
    const panel=view?.querySelector(':scope > .panel:first-child');
    const grid=panel?.querySelector('.form-grid');
    if(!view||!panel||!grid||view.dataset.finalLayout==='1')return false;

    const product=fieldOf('cmpProduct');
    const price=fieldOf('cmpPrice');
    const store=fieldOf('cmpStore');
    const unitSize=fieldOf('cmpUnitSize');
    const packCount=fieldOf('cmpPackCount');
    const packUnit=fieldOf('cmpPackUnit');
    const qty=fieldOf('cmpQty');
    const spec=fieldOf('cmpSpec');
    const calc=$('cmpCalcPreview');

    if(!product||!price||!store||!unitSize||!packCount||!packUnit||!qty||!spec)return false;

    const core=document.createElement('div');
    core.className='compare-core';
    [product,price,store].forEach(x=>core.appendChild(x));
    const note=document.createElement('div');
    note.id='compareUnitNote';
    note.className='compare-unit-note';
    core.appendChild(note);

    const details=document.createElement('details');
    details.className='compare-specs';
    details.innerHTML='<summary>包裝規格與數量（選填）</summary><div class="compare-spec-grid"></div>';
    const specGrid=details.querySelector('.compare-spec-grid');
    [unitSize,packCount,packUnit,qty,spec,calc].filter(Boolean).forEach(x=>specGrid.appendChild(x));

    grid.replaceWith(core);
    core.insertAdjacentElement('afterend',details);
    view.dataset.finalLayout='1';
    try{syncComparePackageCalc()}catch{}
    return true;
  }

  function addHelp(){
    const settings=$('settingsView');
    if(!settings||settings.querySelector('.pb-help-panel'))return;
    const advanced=[...settings.querySelectorAll(':scope > .panel')].find(p=>/進階設定/.test(p.querySelector('h3')?.textContent||''));
    const panel=document.createElement('div');
    panel.className='panel pb-help-panel';
    panel.innerHTML=`
      <h3 class="panel-title">使用說明</h3>
      <details><summary>記一筆價格</summary><div class="pb-help-body">首頁按「新增價格」可完整記錄；只想快速留下訂單價格時，可用快速記價格。既有商品直接選商品，新商品才需要補名稱、分類與比較單位。</div></details>
      <details><summary>比較單位與包裝怎麼填？</summary><div class="pb-help-body">比較單位是最後拿來換算的單位，例如 g、ml、抽。包裝單位則是瓶、罐、包、盒。<div class="pb-help-example">例：690g × 5罐 → 比較單位 g、單件內容量 690、件數 5、包裝單位 罐。</div></div></details>
      <details><summary>快速比價怎麼用？</summary><div class="pb-help-body">選商品後填「現在看到的價格」和商店即可。若同一商品只是包裝大小不同，再展開「包裝規格與數量」填內容量與件數，系統會用單位價判斷是否划算。</div></details>
      <details><summary>照片與訂單截圖</summary><div class="pb-help-body">商品可放主圖；每筆價格可附訂單截圖。Android 快速記價格可先辨識截圖文字。看到照片成功存入雲端後，手機原圖即可刪除。</div></details>
      <details><summary>雲端同步與備份差在哪？</summary><div class="pb-help-body">「雲端已同步」是日常自動同步，同帳號換手機仍能取回資料；設定裡的備份則是額外保留一份 JSON 檔，適合重要資料定期留存。匯入備份會取代目前資料，使用前請確認。</div></details>
    `;
    if(advanced)advanced.insertAdjacentElement('beforebegin',panel);else settings.appendChild(panel);
  }

  function run(){
    fixCompareLayout();
    addHelp();
  }

  let tries=0;
  const timer=setInterval(()=>{
    run();
    tries++;
    if(tries>=12)clearInterval(timer);
  },250);
  run();
})();
