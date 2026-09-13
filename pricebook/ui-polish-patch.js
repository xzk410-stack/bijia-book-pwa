(() => {
  if(window.__pricebookUiPolishLoaderLoaded)return;
  window.__pricebookUiPolishLoaderLoaded=true;
  const add=(id,src)=>{
    if(document.getElementById(id))return;
    const s=document.createElement('script');
    s.id=id;
    s.src=src;
    s.async=false;
    document.body.appendChild(s);
  };
  add('pricebook-stabilize-ui-patch','./stabilize-ui-patch.js?v=20260914-stable1');
  add('pricebook-final-ui-patch','./final-ui-patch.js?v=20260914-final4');
  add('pricebook-final-quick-patch','./final-quick-patch.js?v=20260914-final3');
  add('pricebook-final-cleanup-patch','./final-cleanup-patch.js?v=20260914-final3');
  add('pricebook-quick-modal-hotfix','./quick-modal-hotfix.js?v=20260914-hotfix1');
  add('pricebook-quick-new-product-patch','./quick-new-product-patch.js?v=20260914-quickmeta1');
  add('pricebook-smart-fields-patch','./smart-fields-patch.js?v=20260914-smart2');
})();
