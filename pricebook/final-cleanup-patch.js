(() => {
  if(window.__pricebookFinalCleanupLoaded)return;
  window.__pricebookFinalCleanupLoaded=true;

  function run(){
    try{
      const pdoc=parent&&parent.document;
      if(pdoc){
        [...pdoc.querySelectorAll('.tools button')].forEach(b=>{
          if(b.textContent.trim()==='匯入' && b.style.display!=='none') b.style.display='none';
        });
      }
    }catch{}

    const backupPanel=[...document.querySelectorAll('#settingsView .panel')].find(p=>p.querySelector('#backupList'));
    if(!backupPanel)return;

    const title=backupPanel.querySelector('h3');
    if(title && title.textContent.includes('自動備份')) title.textContent=title.textContent.replace('自動備份','本機版本備份');

    const cloud=backupPanel.querySelector('.cloud-backup');
    if(cloud){
      const b=cloud.querySelector('b');
      if(b && b.textContent.includes('雲端備份')) b.textContent=b.textContent.replace('雲端備份','另存備份檔');
      const note=cloud.querySelector('.smallnote');
      const noteText='可把完整 JSON 備份存到 Google Drive、OneDrive 或手機其他位置，之後需要時可再匯入。';
      if(note && note.textContent!==noteText) note.textContent=noteText;
      const btn=document.getElementById('cloudBackupBtn');
      if(btn && btn.textContent!=='選擇備份位置') btn.textContent='選擇備份位置';
    }
  }

  run();
  setTimeout(run,300);
  setTimeout(run,1000);
  document.addEventListener('click',()=>setTimeout(run,30),true);
})();