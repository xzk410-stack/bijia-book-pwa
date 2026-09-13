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

  async function upload(blob, kind, objectId, oldPath=''){
    const uid = requireSession();
    if(!(blob instanceof Blob)) throw new Error('沒有可上傳的照片');
    if(blob.size > 1048576) throw new Error('照片壓縮後仍超過 1 MB，請換一張或重新選擇');
    const folder = safePart(kind);
    const item = safePart(objectId);
    const name = `${uid}/${folder}/${item}/${Date.now()}-${Math.random().toString(36).slice(2,10)}.jpg`;
    const {error} = await dbClient.storage.from(BUCKET).upload(name, blob, {
      contentType: 'image/jpeg',
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
})();
