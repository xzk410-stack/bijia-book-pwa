(() => {
  if(window.__pricebookQuickModalHotfixLoaded)return;
  window.__pricebookQuickModalHotfixLoaded=true;

  const style=document.createElement('style');
  style.id='pricebook-quick-modal-hotfix-style';
  style.textContent=`
    #quickRecordModal .quick-form .form-actions{
      position:static!important;
      bottom:auto!important;
      z-index:auto!important;
      padding-top:8px!important;
      background:transparent!important;
    }
    #quickRecordModal .pb-suggest-panel{
      margin-top:4px!important;
    }
    #quickRecordModal .pb-suggest-panel:empty{
      display:none!important;
    }
  `;
  document.head.appendChild(style);

  function hideEmptyPanels(){
    document.querySelectorAll('#quickRecordModal .pb-suggest-panel').forEach(panel=>{
      const hasOption=!!panel.querySelector('.pb-suggest-option');
      const onlyEmpty=!!panel.querySelector('.pb-suggest-empty')&&!hasOption;
      if(onlyEmpty){
        panel.classList.remove('show');
        panel.innerHTML='';
      }
    });
  }

  function run(){
    hideEmptyPanels();
    const actions=document.querySelector('#quickRecordModal .form-actions');
    if(actions)actions.style.position='static';
  }

  document.addEventListener('focusin',e=>{
    if(e.target?.closest?.('#quickRecordModal'))setTimeout(hideEmptyPanels,0);
  },true);
  document.addEventListener('input',e=>{
    if(e.target?.closest?.('#quickRecordModal'))setTimeout(hideEmptyPanels,0);
  },true);

  run();
  setTimeout(run,250);
  setTimeout(run,900);
})();
