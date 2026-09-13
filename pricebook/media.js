(() => {
  const BUCKET = 'pricebook-media';
  const signedCache = new Map();

  function requireSession(){
    if(!session?.user?.id) throw new Error('請先登入後再使用照片功能');
    return session.user.id;
  }
  function safePart(v){
    return String(v || 'item').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80) || 'item';
  }
  function isOwnPath(path, uid){
    return typeof path === 'string' && path.startsWith(uid + '/');
  }
  async function normalizeBlob(blob){
    if(blob instanceof Blob) return blob;
    if(blob && typeof blob.arrayBuffer === 'function' && typeof blob.size === 'number'){
      const bytes = await blob.arrayBuffer();
      return new Blob([bytes], {type: blob.type || 'image/jpeg'});
    }
    throw new Error('沒有可上傳的照片');
  }

  async function upload(blob, kind, objectId, oldPath=''){
    const uid = requireSession();
    const uploadBlob = await normalizeBlob(blob);
    if(uploadBlob.size > 1048576) throw new Error('照片壓縮後仍超過 1 MB，請換一張或重新選擇');
    const folder = safePart(kind);
    const item = safePart(objectId);
    const name = `${uid}/${folder}/${item}/${Date.now()}-${Math.random().toString(36).slice(2,10)}.jpg`;
    const {error} = await dbClient.storage.from(BUCKET).upload(name, uploadBlob, {
      contentType: uploadBlob.type || 'image/jpeg',
      cacheControl: '3600',
      upsert: false
    });
    if(error) throw error;
    signedCache.delete(name);
    if(oldPath && isOwnPath(oldPath, uid)){
      remove(oldPath).catch(() => {});
    }
    return name;
  }

  async function getUrl(path){
    if(!path) return '';
    const now = Date.now();
    const cached = signedCache.get(path);
    if(cached && cached.expiresAt > now + 60_000) return cached.url;
    const {data,error} = await dbClient.storage.from(BUCKET).createSignedUrl(path, 3600);
    if(error) throw error;
    const url = data?.signedUrl || '';
    if(url) signedCache.set(path,{url,expiresAt:now + 50*60*1000});
    return url;
  }

  async function remove(path){
    if(!path || String(path).startsWith('data:')) return;
    const uid = requireSession();
    if(!isOwnPath(path, uid)) throw new Error('無法刪除不屬於目前帳號的照片');
    const {error} = await dbClient.storage.from(BUCKET).remove([path]);
    if(error) throw error;
    signedCache.delete(path);
  }

  async function usage(){
    requireSession();
    const {data,error} = await dbClient.rpc('pricebook_media_usage');
    if(error) throw error;
    const row = Array.isArray(data) ? (data[0] || {}) : (data || {});
    return {
      fileCount: Number(row.file_count || 0),
      totalBytes: Number(row.total_bytes || 0)
    };
  }

  window.pricebookMedia = {upload,getUrl,remove,usage,bucket:BUCKET};

  function injectRefinement(){
    try{
      const frame=document.getElementById('appFrame');
      const doc=frame&&frame.contentDocument;
      if(!doc||!doc.body)return;

      if(!doc.getElementById('pricebook-enhancements-patch')){
        const script=doc.createElement('script');
        script.id='pricebook-enhancements-patch';
        script.src='./enhancements-patch.js?v=20260914-speed1';
        doc.body.appendChild(script);
      }

      if(!doc.getElementById('pricebook-product-edit-patch')){
        const script=doc.createElement('script');
        script.id='pricebook-product-edit-patch';
        script.src='./product-edit-patch.js?v=20260914-edit3';
        doc.body.appendChild(script);
      }

      if(!doc.getElementById('pricebook-chart-readability-patch')){
        const script=doc.createElement('script');
        script.id='pricebook-chart-readability-patch';
        script.src='./chart-readability-patch.js?v=20260914-chart1';
        doc.body.appendChild(script);
      }

      if(!doc.getElementById('pricebook-detail-ui-patch')){
        const script=doc.createElement('script');
        script.id='pricebook-detail-ui-patch';
        script.src='./detail-ui-patch.js?v=20260914-detail1';
        doc.body.appendChild(script);
      }

      if(!doc.getElementById('pricebook-ui-polish-patch')){
        const script=doc.createElement('script');
        script.id='pricebook-ui-polish-patch';
        script.src='./ui-polish-patch.js?v=20260914-ui2';
        doc.body.appendChild(script);
      }
    }catch(e){}
  }
  const frame=document.getElementById('appFrame');
  if(frame){
    frame.addEventListener('load',()=>setTimeout(injectRefinement,120));
    setTimeout(injectRefinement,180);
  }
})();