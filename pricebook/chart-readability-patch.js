(() => {
  function boot(){
    if(typeof window.priceChartSVG !== 'function' || typeof window.chartRecords !== 'function' || typeof window.unitPrice !== 'function'){
      setTimeout(boot,80);
      return;
    }
    if(window.__pricebookChartReadabilityPatchLoaded) return;
    window.__pricebookChartReadabilityPatchLoaded = true;

    const style=document.createElement('style');
    style.id='pricebook-chart-readability-style';
    style.textContent=`
      .chart-wrap{height:230px!important}
      .chart-wrap svg{width:100%;height:100%;display:block;overflow:visible}
      .chart-legend{font-size:12px!important;color:#66736A!important;margin-top:8px!important}
      .chart-head small{font-size:11px!important}
    `;
    document.head.appendChild(style);

    const safe=v=>{
      try{return typeof esc==='function'?esc(String(v??'')):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
      catch{return String(v??'');}
    };
    const shortDate=d=>{
      const s=String(d||'');
      return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(5).replace('-','/'):s;
    };

    window.priceChartSVG=function(p,range='all',store='全部'){
      const rs=chartRecords(p,range,store);
      if(!rs.length)return '<div class="chart-empty">這個範圍還沒有價格資料 📭</div>';

      const vals=rs.map(unitPrice);
      const target=typeof targetUnitPrice==='function'?targetUnitPrice(p):null;
      const allVals=target!=null?[...vals,target]:vals.slice();
      let min=Math.min(...allVals),max=Math.max(...allVals);
      if(min===max){
        const pad=Math.max(Math.abs(max)*0.08,1);
        min-=pad;max+=pad;
      }else{
        const pad=(max-min)*0.10;
        min-=pad;max+=pad;
      }

      const box=document.getElementById('priceChartBox');
      const measured=Math.round((box?.clientWidth||386)-26);
      const W=Math.max(300,Math.min(620,measured));
      const H=230,L=54,R=18,T=24,B=46,iw=W-L-R,ih=H-T-B;
      const x=i=>rs.length===1?L+iw/2:L+iw*i/(rs.length-1);
      const y=v=>T+ih-(v-min)/(max-min)*ih;

      let grid='';
      for(let i=0;i<4;i++){
        const yy=T+ih*i/3;
        const val=max-(max-min)*i/3;
        const label=Math.abs(val)>=100?Math.round(val):Number(val.toFixed(1));
        grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#E4E9E1" stroke-width="1"/>`+
              `<text x="${L-9}" y="${yy+4}" text-anchor="end" font-size="12" font-weight="500" fill="#5F6D65">${label}</text>`;
      }

      let targetLine='';
      if(target!=null){
        const yy=y(target);
        targetLine=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#E39A55" stroke-width="2" stroke-dasharray="6 5"/>`+
                   `<text x="${W-R}" y="${Math.max(14,yy-7)}" text-anchor="end" font-size="11" font-weight="600" fill="#9B652C">理想 ${typeof fmt==='function'?fmt(target,3):target}</text>`;
      }

      const pts=rs.map((r,i)=>`${x(i)},${y(unitPrice(r))}`).join(' ');
      const dots=rs.map((r,i)=>{
        const label=typeof displayUnitPrice==='function'?displayUnitPrice(p,unitPrice(r)):String(unitPrice(r));
        return `<circle cx="${x(i)}" cy="${y(unitPrice(r))}" r="5.5" fill="#4F8B68" stroke="white" stroke-width="2.5"><title>${safe(r.date)} ${safe(r.store||'未填商店')}：${safe(label)}</title></circle>`;
      }).join('');

      let pointLabel='';
      if(rs.length===1){
        const r=rs[0];
        const label=typeof displayUnitPrice==='function'?displayUnitPrice(p,unitPrice(r)):String(unitPrice(r));
        const cx=x(0),cy=y(unitPrice(r));
        const pillW=Math.min(Math.max(112,label.length*9+24),Math.max(120,W-40));
        const rx=Math.max(8,Math.min(W-pillW-8,cx-pillW/2));
        const ry=Math.max(4,cy-38);
        pointLabel=`<rect x="${rx}" y="${ry}" width="${pillW}" height="27" rx="13.5" fill="#EEF6EF" stroke="#D7E7D9"/>`+
                   `<text x="${rx+pillW/2}" y="${ry+18}" text-anchor="middle" font-size="12" font-weight="700" fill="#2E6E4D">${safe(label)}</text>`;
      }

      let xLabels='';
      if(rs.length===1){
        xLabels=`<text x="${x(0)}" y="${H-12}" text-anchor="middle" font-size="12" font-weight="500" fill="#5F6D65">${safe(shortDate(rs[0].date))}</text>`;
      }else{
        const idxs=[0,Math.floor((rs.length-1)/2),rs.length-1].filter((v,i,a)=>a.indexOf(v)===i);
        xLabels=idxs.map((idx,pos)=>{
          const anchor=idx===0?'start':idx===rs.length-1?'end':'middle';
          return `<text x="${x(idx)}" y="${H-12}" text-anchor="${anchor}" font-size="12" font-weight="500" fill="#5F6D65">${safe(shortDate(rs[idx].date))}</text>`;
        }).join('');
      }

      return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${grid}${targetLine}${rs.length>1?`<polyline points="${pts}" fill="none" stroke="#4F8B68" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`:''}${dots}${pointLabel}${xLabels}</svg></div>`;
    };
  }
  boot();
})();
