(() => {
  if (window.__spendbookStatusFilterFixLoaded) return;
  window.__spendbookStatusFilterFixLoaded = true;

  const isCompleted = r => (r?.status || '') === '已完成';
  const displayStatus = s => s === '尚未出貨' ? '待出貨' : s;

  const style = document.createElement('style');
  style.textContent = `
    #home .q{cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
    #home .q:active{transform:scale(.98)}
    #home .q[data-filter]{box-shadow:0 4px 14px rgba(40,48,90,.035)}
  `;
  document.head.appendChild(style);

  try {
    const addStatus = document.getElementById('status');
    if (addStatus) {
      const opt = [...addStatus.options].find(o => o.value === '尚未出貨' || o.textContent.trim() === '尚未出貨');
      if (opt) { opt.value = '尚未出貨'; opt.textContent = '待出貨'; }
    }
    const editStatusSel = document.getElementById('editStatus');
    if (editStatusSel) {
      const opt = [...editStatusSel.options].find(o => o.value === '尚未出貨' || o.textContent.trim() === '尚未出貨');
      if (opt) { opt.value = '尚未出貨'; opt.textContent = '待出貨'; }
    }
  } catch {}

  if (typeof recordCard === 'function' && !recordCard.__statusFixWrapped) {
    const old = recordCard;
    const wrapped = function(r, i, compact = false) {
      return old(r, i, compact).replace(/>尚未出貨</g, '>待出貨<');
    };
    wrapped.__statusFixWrapped = true;
    try { recordCard = wrapped; } catch {}
  }

  if (typeof filteredRecords === 'function' && !filteredRecords.__statusFixWrapped) {
    const old = filteredRecords;
    const wrapped = function() {
      const arr = old();
      if (typeof sortMode !== 'undefined' && sortMode === 0) {
        arr.sort((a, b) => {
          const done = Number(isCompleted(a)) - Number(isCompleted(b));
          if (done) return done;
          return Number(b.createdAt || 0) - Number(a.createdAt || 0);
        });
      }
      return arr;
    };
    wrapped.__statusFixWrapped = true;
    try { filteredRecords = wrapped; } catch {}
  }

  function renderHomeRecentActiveFirst() {
    const box = document.getElementById('recent');
    if (!box || typeof records === 'undefined' || typeof recordCard !== 'function') return;
    const list = records.slice().sort((a, b) => {
      const done = Number(isCompleted(a)) - Number(isCompleted(b));
      if (done) return done;
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    }).slice(0, 2);
    box.innerHTML = list.length
      ? list.map(r => recordCard(r, records.indexOf(r), true)).join('')
      : '<div class="empty">按下方＋新增第一筆消費</div>';
  }

  function openFilter(filter) {
    try {
      activeFilter = filter;
      if (typeof go === 'function') go('records');
      if (typeof render === 'function') render();
    } catch {}
  }

  function wireHomeFilters() {
    const map = {
      qPay: '待付款',
      qShip: '待出貨',
      qTransit: '運送中',
      qPickup: '待取貨'
    };
    Object.entries(map).forEach(([id, filter]) => {
      const counter = document.getElementById(id);
      const card = counter?.closest('.q');
      if (!card) return;
      card.dataset.filter = filter;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `查看${filter}紀錄`);
      card.onclick = () => openFilter(filter);
      card.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFilter(filter);
        }
      };
    });
  }

  if (typeof openStatusSheet === 'function' && !openStatusSheet.__statusFixWrapped) {
    const old = openStatusSheet;
    const wrapped = function(i) {
      const out = old(i);
      setTimeout(() => {
        try {
          if (window.statusSheetSub) statusSheetSub.textContent = statusSheetSub.textContent.replace('尚未出貨', '待出貨');
          if (window.statusOptions) [...statusOptions.querySelectorAll('button')].forEach(b => {
            if (b.textContent.trim() === '尚未出貨') b.textContent = '待出貨';
          });
        } catch {}
      }, 0);
      return out;
    };
    wrapped.__statusFixWrapped = true;
    try { openStatusSheet = wrapped; } catch {}
  }

  if (typeof openDetail === 'function' && !openDetail.__statusFixWrapped) {
    const old = openDetail;
    const wrapped = function(i) {
      const out = old(i);
      setTimeout(() => {
        const detail = document.getElementById('detailContent');
        if (detail) detail.querySelectorAll('.badge').forEach(b => {
          if (b.textContent.trim() === '尚未出貨') b.textContent = '待出貨';
        });
      }, 0);
      return out;
    };
    wrapped.__statusFixWrapped = true;
    try { openDetail = wrapped; } catch {}
  }

  if (typeof render === 'function' && !render.__statusFixWrapped) {
    const old = render;
    const wrapped = function() {
      const out = old.apply(this, arguments);
      renderHomeRecentActiveFirst();
      wireHomeFilters();
      return out;
    };
    wrapped.__statusFixWrapped = true;
    try { render = wrapped; } catch {}
  }

  renderHomeRecentActiveFirst();
  wireHomeFilters();
  try { if (typeof render === 'function') render(); } catch {}
})();
