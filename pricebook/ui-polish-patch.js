(() => {
  if (window.__pricebookUiPolishPatchLoaded) return;
  window.__pricebookUiPolishPatchLoaded = true;

  const $ = id => document.getElementById(id);

  const style = document.createElement('style');
  style.id = 'pricebook-ui-polish-style';
  style.textContent = `
    /* 商品卡：單位價保持一行，避免 NT$0.67 / ml 被拆開 */
    .price-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.08fr)}
    .price-box{min-width:0;padding:10px 9px}
    .price-box b{display:block;white-space:nowrap;font-size:13px;letter-spacing:-.015em;overflow:hidden;text-overflow:ellipsis}
    @media(max-width:390px){.price-box b{font-size:12px}.price-box small{font-size:9px}}

    /* 快速比價：主欄位清楚、次要規格收起來 */
    #compareView>.panel:first-child{padding:18px;border-radius:22px;background:linear-gradient(180deg,#fff 0%,#fbfcf8 100%)}
    #compareView>.panel:first-child .panel-title{margin-bottom:16px;font-size:18px;display:flex;align-items:center;gap:8px}
    #compareView .compare-core{display:grid;grid-template-columns:1fr 1fr;gap:11px}
    #compareView .compare-core .field:first-child{grid-column:1/-1}
    #compareView .compare-core .field input,#compareView .compare-core .field select{min-height:48px;background:#fff}
    #compareView .compare-unit-note{grid-column:1/-1;margin:-2px 2px 1px;color:var(--muted);font-size:11px;line-height:1.45}
    #compareView .compare-specs{margin-top:12px;border:1px solid var(--line);border-radius:16px;background:#f8faf6;overflow:hidden}
    #compareView .compare-specs summary{list-style:none;display:flex;align-items:center;justify-content:space-between;padding:12px 13px;font-weight:800;color:#4f6258;cursor:pointer}
    #compareView .compare-specs summary::-webkit-details-marker{display:none}
    #compareView .compare-specs summary:after{content:'＋';font-size:18px;color:#6f8177}
    #compareView .compare-specs[open] summary:after{content:'－'}
    #compareView .compare-spec-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 12px 12px}
    #compareView .compare-spec-grid .field{min-width:0}
    #compareView .compare-spec-grid #cmpCalcPreview{grid-column:1/-1}
    #compareView #doCompare{min-height:52px;border-radius:15px;margin-top:14px!important;font-size:16px;box-shadow:0 8px 20px rgba(57,118,86,.16)}
    #compareView .compare-help{padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
    #compareView .compare-help details{border:1px solid var(--line);border-radius:15px;background:#fff;overflow:hidden}
    #compareView .compare-help summary{list-style:none;padding:12px 14px;font-weight:800;cursor:pointer}
    #compareView .compare-help summary::-webkit-details-marker{display:none}
    #compareView .compare-help .smallnote{padding:0 14px 13px}
    @media(max-width:520px){
      #compareView .compare-core{grid-template-columns:1fr 1fr}
      #compareView .compare-spec-grid{grid-template-columns:1fr 1fr}
    }
    @media(max-width:380px){
      #compareView .compare-core,#compareView .compare-spec-grid{grid-template-columns:1fr}
      #compareView .compare-core .field:first-child{grid-column:auto}
      #compareView .compare-unit-note,#compareView .compare-spec-grid #cmpCalcPreview{grid-column:auto}
    }

    /* 歷史價格操作：保持清楚且一行橫向捲動 */
    .history .hactions,.history .receipt-actions{display:flex!important;flex-wrap:nowrap!important;gap:7px!important;overflow-x:auto;scrollbar-width:none;padding-bottom:2px;justify-content:flex-start!important}
    .history .hactions::-webkit-scrollbar,.history .receipt-actions::-webkit-scrollbar{display:none}
    .history .hactions .btn,.history .receipt-actions .btn,.history .haction{flex:0 0 auto!important;white-space:nowrap!important}
  `;
  document.head.appendChild(style);

  // 讓單位價更精簡，進一步避免手機卡片換行。
  if (typeof window.displayUnitPrice === 'function' && !window.__compactUnitPricePatched) {
    window.__compactUnitPricePatched = true;
    window.displayUnitPrice = function(p, val){
      return val == null ? '—' : preciseMoney(val) + '/' + esc(p.unit || '件');
    };
    try { renderHome(); } catch(e) {}
  }

  function fieldOf(id){
    const el = $(id);
    return el ? el.closest('.field') : null;
  }

  function polishCompare(){
    const view = $('compareView');
    if (!view || view.dataset.polished === '1') return;
    const panel = view.querySelector(':scope > .panel:first-child');
    const grid = panel && panel.querySelector('.form-grid');
    if (!panel || !grid) return;
    view.dataset.polished = '1';

    const productField = fieldOf('cmpProduct');
    const priceField = fieldOf('cmpPrice');
    const storeField = fieldOf('cmpStore');
    const unitSizeField = fieldOf('cmpUnitSize');
    const packCountField = fieldOf('cmpPackCount');
    const packUnitField = fieldOf('cmpPackUnit');
    const qtyField = fieldOf('cmpQty');
    const specField = fieldOf('cmpSpec');
    const calc = $('cmpCalcPreview');

    const core = document.createElement('div');
    core.className = 'compare-core';
    [productField, priceField, storeField].filter(Boolean).forEach(el => core.appendChild(el));
    const note = document.createElement('div');
    note.className = 'compare-unit-note';
    note.id = 'compareUnitNote';
    core.appendChild(note);
    grid.replaceWith(core);

    const details = document.createElement('details');
    details.className = 'compare-specs';
    details.innerHTML = '<summary>包裝規格與數量（選填）</summary><div class="compare-spec-grid"></div>';
    const specGrid = details.querySelector('.compare-spec-grid');
    [unitSizeField, packCountField, packUnitField, qtyField, specField, calc].filter(Boolean).forEach(el => specGrid.appendChild(el));
    core.insertAdjacentElement('afterend', details);

    const refreshUnitNote = () => {
      try {
        const p = getProduct($('cmpProduct').value);
        note.textContent = p ? `這個商品目前以「${p.unit || '件'}」為比較單位；只有包裝規格不同時才需要展開下面欄位。` : '';
      } catch(e) { note.textContent = ''; }
      setTimeout(() => {
        const hasSpec = ['cmpUnitSize','cmpPackCount','cmpQty','cmpSpec'].some(id => $(id) && String($(id).value || '').trim());
        if (hasSpec) details.open = true;
      }, 20);
    };
    $('cmpProduct')?.addEventListener('change', refreshUnitNote);
    refreshUnitNote();

    // 將說明區改成可收合，讓畫面更乾淨。
    const help = view.querySelectorAll(':scope > .panel')[1];
    if (help && !help.classList.contains('compare-help')) {
      help.classList.add('compare-help');
      const text = help.querySelector('.smallnote')?.innerHTML || '';
      help.innerHTML = `<details><summary>怎麼看比價結果？</summary><div class="smallnote">${text}</div></details>`;
    }
  }

  function syncFab(){
    const fab = $('addBtn');
    const home = $('homeView');
    if (!fab || !home) return;
    fab.style.display = home.classList.contains('active') ? '' : 'none';
  }

  function cleanHistoryActions(root=document){
    root.querySelectorAll('.receipt-actions').forEach(actions => {
      [...actions.querySelectorAll('button')].forEach(btn => {
        const text = btn.textContent.trim();
        if (text === '更換' || text === '更換截圖') btn.remove();
        else if (text === '移除') btn.textContent = '移除截圖';
        else if (text === '刪除') btn.textContent = '刪除價格';
      });
    });
    root.querySelectorAll('.history .hactions button,.history .hrow button').forEach(btn => {
      const text = btn.textContent.trim();
      if (text === '刪除') btn.textContent = '刪除價格';
    });
  }

  polishCompare();
  syncFab();
  cleanHistoryActions();

  const observer = new MutationObserver(() => {
    polishCompare();
    syncFab();
    cleanHistoryActions();
  });
  observer.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['class']});
})();
