(() => {
  if(window.__pricebookUiPolishLoaderLoaded)return;
  window.__pricebookUiPolishLoaderLoaded=true;
  const add=(id,src)=>{
    if(document.getElementById(id))return;
    const s=document.createElement('script');
    s.id=id;
    s.src=src;
    document.body.appendChild(s);
  };
  add('pricebook-final-ui-patch','./final-ui-patch.js?v=20260914-final3');
  add('pricebook-final-quick-patch','./final-quick-patch.js?v=20260914-final2');
  add('pricebook-final-cleanup-patch','./final-cleanup-patch.js?v=20260914-final2');
})();