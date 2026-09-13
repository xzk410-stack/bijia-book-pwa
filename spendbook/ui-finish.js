(() => {
  if (window.__spendbookUiFinishLoaded) return;
  window.__spendbookUiFinishLoaded = true;

  const $ = id => document.getElementById(id);
  const localDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  function installLocalStyles() {
    if ($('spendbook-ui-finish-style')) return;
    const style = document.createElement('style');
    style.id = 'spendbook-ui-finish-style';
    style.textContent = `
      #settings .usage-guide{background:#fff;border:1px solid var(--border);border-radius:16px;margin-bottom:10px;overflow:hidden}
      #settings .usage-guide summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;cursor:pointer}
      #settings .usage-guide summary::-webkit-details-marker{display:none}
      #settings .usage-guide summary b{display:block}
      #settings .usage-guide summary small{display:block;color:var(--muted);margin-top:3px;line-height:1.45}
      #settings .usage-guide .guide-toggle{font-size:21px;color:var(--accent);font-weight:500;line-height:1;transition:transform .15s ease}
      #settings .usage-guide[open] .guide-toggle{transform:rotate(45deg)}
      #settings .usage-guide-body{border-top:1px solid var(--border);padding:12px 14px 14px;color:#58605d;font-size:12px;line-height:1.7}
      #settings .usage-guide-body b{color:var(--text)}
      #settings .usage-guide-body p{margin:0 0 10px}
      #settings .usage-guide-body p:last-child{margin-bottom:0}
      #settings .cloud-note{background:#f7f8ff;border:1px solid #e7e9f7;border-radius:13px;padding:10px 11px;margin-top:10px}
      #editSheet .required-mark{color:#c75b67;font-weight:800;margin-left:3px}
    `;
    document.head.appendChild(style);
  }

  function installUsageGuide() {
    const settings = $('settings');
    const section = settings?.querySelector('.section');
    if (!section || section.querySelector('.usage-guide')) return;

    const guide = document.createElement('details');
    guide.className = 'usage-guide';
    guide.innerHTML = `
      <summary>
        <div><b>使用說明</b><small>新增、付款、物流狀態、篩選與備份</small></div>
        <span class="guide-toggle">＋</span>
      </summary>
      <div class="usage-guide-body">
        <p><b>新增紀錄：</b>「商品明細」與「本體金額」為必填。二補、手續費、運費、折扣、已付金額可依實際情況填寫，系統會自動算出應付總計與未付金額。</p>
        <p><b>付款：</b>尚未付清的訂單可用「新增付款／付尾款」逐次登記；已付清與物流狀態是兩件事，例如可以同時是「已付清＋待出貨」。</p>
        <p><b>物流：</b>待出貨 → 已出貨／運送中 → 已到貨／待取貨 → 已完成。完成的訂單會在預設紀錄排序中自動往下。</p>
        <p><b>快速查看：</b>首頁的「待付款、待出貨、運送中、待取貨」都可以直接點，會跳到紀錄頁並套用對應篩選。</p>
        <p><b>首頁金額：</b>「本月總消費、已付款、待付款」只統計本月新增的消費紀錄；「待到貨」則顯示目前仍在待出貨／運送中的訂單數。</p>
        <p><b>搜尋與排序：</b>紀錄頁可搜尋商品、賣家與平台；也可切換最近新增、金額高低與待付金額排序。</p>
        <div class="cloud-note"><b>雲端與備份：</b>登入後資料會自動同步到自己的雲端帳號；設定裡的 JSON「備份資料」是額外留存用，不需要每次手動備份。</div>
      </div>`;
    section.appendChild(guide);

    if (window.Android) {
      [...section.querySelectorAll('.setting')].forEach(card => {
        const title = card.querySelector('b')?.textContent?.trim();
        if (title === '安裝到主畫面') card.style.display = 'none';
      });
    }
  }

  function installParentHeaderBehavior() {
    if (window.parent === window) return;
    try {
      const pdoc = window.parent.document;
      const topbar = pdoc.getElementById('topbar');
      if (!topbar) return;

      if (!pdoc.getElementById('spendbook-parent-header-style')) {
        const style = pdoc.createElement('style');
        style.id = 'spendbook-parent-header-style';
        style.textContent = `
          .topbar.spendbook-scroll-header{
            max-height:82px;
            overflow:hidden;
            opacity:1;
            transition:max-height .16s ease,padding .16s ease,opacity .12s ease,border-color .12s ease;
          }
          .topbar.spendbook-scroll-header.spendbook-scrolled-away{
            max-height:0!important;
            padding-top:0!important;
            padding-bottom:0!important;
            opacity:0;
            border-bottom-color:transparent!important;
            pointer-events:none;
          }
        `;
        pdoc.head.appendChild(style);
      }

      topbar.classList.add('spendbook-scroll-header');
      let hidden = false;
      const update = () => {
        const y = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        if (!hidden && y > 28) hidden = true;
        else if (hidden && y <= 2) hidden = false;
        topbar.classList.toggle('spendbook-scrolled-away', hidden);
      };
      window.addEventListener('scroll', update, {passive:true});
      window.addEventListener('pageshow', update);
      update();
    } catch (e) {
      console.warn('header behavior setup skipped', e);
    }
  }

  function makeNavigationRestoreHeader() {
    if (typeof go !== 'function' || go.__uiFinishWrapped) return;
    const old = go;
    const wrapped = function(page) {
      const result = old.apply(this, arguments);
      try { window.scrollTo(0, 0); } catch {}
      try {
        const topbar = window.parent?.document?.getElementById('topbar');
        topbar?.classList.remove('spendbook-scrolled-away');
      } catch {}
      return result;
    };
    wrapped.__uiFinishWrapped = true;
    try { go = wrapped; } catch {}
  }

  function updateHomeSummary() {
    if (typeof records === 'undefined' || !Array.isArray(records)) return;
    const now = new Date();
    const monthRecords = records.filter(r => {
      const d = new Date(Number(r?.createdAt || 0));
      return !Number.isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const total = monthRecords.reduce((sum, r) => sum + Math.max(0, Number(r.total || 0)), 0);
    const paid = monthRecords.reduce((sum, r) => sum + Math.min(Math.max(0, Number(r.paid || 0)), Math.max(0, Number(r.total || 0))), 0);
    const unpaid = monthRecords.reduce((sum, r) => sum + Math.max(Number(r.total || 0) - Number(r.paid || 0), 0), 0);
    const waiting = records.filter(r => ['尚未出貨','已出貨','運送中'].includes(r.status)).length;
    if ($('homeTotal') && typeof money === 'function') $('homeTotal').textContent = money(total);
    if ($('homePaid')) $('homePaid').textContent = String(Math.round(paid)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if ($('homeUnpaid')) $('homeUnpaid').textContent = String(Math.round(unpaid)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if ($('homeWaiting')) $('homeWaiting').textContent = `${waiting} 筆`;
  }

  function wrapRenderForSummary() {
    if (typeof render !== 'function' || render.__uiFinishSummaryWrapped) return;
    const old = render;
    const wrapped = function() {
      const result = old.apply(this, arguments);
      updateHomeSummary();
      return result;
    };
    wrapped.__uiFinishSummaryWrapped = true;
    try { render = wrapped; } catch {}
  }

  function fixPaymentLocalDate() {
    if (typeof applyPayment !== 'function' || applyPayment.__uiFinishWrapped) return;
    const old = applyPayment;
    const wrapped = function() {
      const index = typeof editingPaymentIndex !== 'undefined' ? editingPaymentIndex : null;
      const before = index !== null && records?.[index]?.payments ? records[index].payments.length : 0;
      const result = old.apply(this, arguments);
      if (index !== null && records?.[index]?.payments?.length > before) {
        records[index].payments[records[index].payments.length - 1].date = localDate();
        if (typeof persist === 'function') persist();
      }
      return result;
    };
    wrapped.__uiFinishWrapped = true;
    try { applyPayment = wrapped; } catch {}
  }

  function markEditRequired() {
    [['editName','商品明細'],['editTotal','訂單總額']].forEach(([id]) => {
      const input = $(id);
      const label = input?.closest('.field')?.querySelector('label');
      if (label && !label.querySelector('.required-mark')) label.insertAdjacentHTML('beforeend','<span class="required-mark">＊</span>');
    });
  }

  function polishSettingsCopy() {
    const settings = $('settings');
    if (!settings) return;
    [...settings.querySelectorAll('.setting')].forEach(card => {
      const title = card.querySelector('b')?.textContent?.trim();
      const small = card.querySelector('small');
      if (title === '備份資料' && small) small.textContent = '另存 JSON 備份；平常登入後會自動雲端同步';
      if (title === '還原資料' && small) small.textContent = '需要時才匯入「我的消費簿」JSON 備份';
    });
  }

  function run() {
    installLocalStyles();
    installUsageGuide();
    polishSettingsCopy();
    installParentHeaderBehavior();
    makeNavigationRestoreHeader();
    wrapRenderForSummary();
    fixPaymentLocalDate();
    markEditRequired();
    updateHomeSummary();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true});
  else run();
})();
