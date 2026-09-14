window.handleAndroidBack=()=>{try{const f=document.getElementById('appFrame').contentWindow;return !!(f&&f.handleAndroidBack&&f.handleAndroidBack())}catch{return false}};
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js?v=9').catch(()=>{})}
(function(){
  const frame=document.getElementById('appFrame');
  if(!frame)return;
  function inject(){
    try{
      const d=frame.contentDocument;
      if(!d||!d.body||d.getElementById('spendbook-deadline-reminder-script'))return;
      const x=d.createElement('script');
      x.id='spendbook-deadline-reminder-script';
      x.src='./deadline-reminder.js?v=20260914';
      d.body.appendChild(x);
    }catch(e){console.warn('deadline reminder loader skipped',e)}
  }
  frame.addEventListener('load',inject);
  setTimeout(inject,0);
  setTimeout(inject,1200);
})();
