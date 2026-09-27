/* Account-scoped local drafts. Loaded in both the shell and its editor frame. */
(function(){
  const script=document.currentScript;
  const key=script.dataset.key,ownerKey=script.dataset.owner,empty=script.dataset.empty;
  const prefix=key+':sync:';
  const rawSet=Storage.prototype.setItem;
  const put=(k,v)=>rawSet.call(localStorage,k,v);
  const owner=()=>localStorage.getItem(ownerKey)||'';
  const pending=uid=>!!uid&&localStorage.getItem(prefix+'pending:'+uid)==='1';
  const mark=()=>{const uid=owner();if(uid)put(prefix+'pending:'+uid,'1')};
  function claim(uid){
    const previous=owner();
    if(previous&&previous!==uid){
      put(prefix+'draft:'+previous,localStorage.getItem(key)||empty);
      put(key,localStorage.getItem(prefix+'draft:'+uid)||empty);
    }else if(!previous&&localStorage.getItem(prefix+'draft:'+uid))put(key,localStorage.getItem(prefix+'draft:'+uid));
    put(ownerKey,uid);
  }
  function acknowledge(uid,expected){
    if(owner()!==uid||localStorage.getItem(key)!==expected)return false;
    put(prefix+'draft:'+uid,expected||empty);
    localStorage.removeItem(prefix+'pending:'+uid);
    return true;
  }
  function editing(frame){
    try{
      const doc=frame.contentDocument;
      return !!doc?.querySelector('.modal.show,.sheet-backdrop.show,dialog[open],#add.active') || /^(INPUT|TEXTAREA|SELECT)$/.test(doc?.activeElement?.tagName||'');
    }catch{return true}
  }
  window.AppSyncState={owner,pending,mark,claim,acknowledge,editing};
  if(script.dataset.editor==='true'){
    const boundOwner=owner();
    Storage.prototype.setItem=function(k,v){
      if(this===localStorage&&k===key&&String(v)!==localStorage.getItem(k)){
        if(boundOwner!==owner())throw new Error('帳號已變更，請重新開啟此畫面後再儲存。');
        mark();
      }
      return rawSet.call(this,k,v);
    };
  }
})();
