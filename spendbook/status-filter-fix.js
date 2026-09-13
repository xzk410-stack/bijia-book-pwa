(() => {
  if (window.__spendbookStatusFilterFixLoaded) return;
  window.__spendbookStatusFilterFixLoaded = true;

  const isCompleted = r => (r?.status || '') === '已完成';
  const displayStatus = s => s === '尚未出貨' ? '待出貨' : s;
  const $ = id => document.getElementById(id);
  const localDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const style = document.createElement('style');
  style.textContent = `
    #home .q{cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
    #home .q:active{transform:scale(.98)}
    #home .q[data-filter]{box-shadow:0 4px 14px rgba(40,48,90,.035)}
    #add .required-mark{color:#c75b67;font-weight:800;margin-left:3px}
    #add .required-note{font-size:11px;color:#90958f;margin:-2px 0 10px}
    #add .field.invalid input{border-color:#d78a93;box-shadow:0 0 0 3px rgba(199,91,103,.08)}
    #add .add-form-error{display:none;margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#fff2f3;color:#9e4653;font-size:12px;line-height:1.5}
    #add .add-form-error.show{display:block}
  `;
  document.head.appendChild(style);

  function setRequiredLabel(fieldId) {
    const field = $(fieldId)?.closest('.field');
    const label = field?.querySelector('label');
    if (!field || !label || label.querySelector('.required-mark')) return;
    label.insertAdjacentHTML('beforeend', '<span class="required-mark">＊</span>');
    $(fieldId).setAttribute('required', 'required');
  }

  function ensureAddValidationUI() {
    const add = $('add');
    if (!add) return;
    setRequiredLabel('name');
    setRequiredLabel('base');

    const heading = add.querySelector('.row-head');
    if (heading && !add.querySelector('.required-note')) {
      heading.insertAdjacentHTML('afterend', '<div class="required-note">＊為必填欄位</div>');
    }
    const save = add.querySelector('button.save');
    if (save && !$('addFormError')) {
      save.insertAdjacentHTML('beforebegin', '<div id="addFormError" class="add-form-error" role="alert"></div>');
    }
  }

  function clearAddError() {
    const box = $('addFormError');
    if (box) { box.textContent = ''; box.classList.remove('show'); }
    ['name','base'].forEach(id => $(id)?.closest('.field')?.classList.remove('invalid'));
  }

  function failAdd(id, message) {
    clearAddError();
    const field = $(id)?.closest('.field');
    field?.classList.add('invalid');
    const box = $('addFormError');
    if (box) { box.textContent = message; box.classList.add('show'); }
    const input = $(id);
    if (input) {
      try { input.scrollIntoView({behavior:'smooth',block:'center'}); } catch {}
      setTimeout(() => input.focus(), 120);
    }
    return false;
  }

  function safeSaveRecord() {
    ensureAddValidationUI();
    clearAddError();
    try {
      const nameEl = $('name');
      const nameValue = (nameEl?.value || '').trim();
      if (!nameValue) return failAdd('name', '請先填寫商品明細。');

      const num = id => Number($(id)?.value || 0);
      const baseValue = num('base');
      if (!(baseValue > 0)) return failAdd('base', '請填寫本體金額，金額需大於 0。');

      const total = Math.max(baseValue + num('second') + num('fee') + num('shipping') - num('discount'), 0);
      if (!(total > 0)) return failAdd('base', '計算後的訂單總額需大於 0。');

      const paidValue = Math.max(0, num('paid'));
      if (paidValue > total) {
        const box = $('addFormError');
        if (box) { box.textContent = '已付金額不能高於訂單總額。'; box.classList.add('show'); }
        $('paid')?.focus();
        return false;
      }

      if (!Array.isArray(window.records) && typeof records === 'undefined') throw new Error('找不到消費紀錄資料');
      const list = typeof records !== 'undefined' ? records : window.records;
      const record = {
        name: nameValue,
        seller: ($('seller')?.value || '').trim() || '未填寫',
        platform: $('platform')?.value || '其他',
        total,
        paid: paidValue,
        status: $('status')?.value || '尚未出貨',
        shipdate: $('shipdate')?.value || '',
        paymethod: $('paymethod')?.value || '',
        note: $('note')?.value || '',
        payments: paidValue > 0 ? [{amount: paidValue, method: $('paymethod')?.value || '', date: localDate()}] : [],
        createdAt: Date.now()
      };
      list.unshift(typeof normalizeRecord === 'function' ? normalizeRecord(record) : record);
      if (typeof persist === 'function') persist();
      else localStorage.setItem('spend_records', JSON.stringify(list));
      if (typeof resetForm === 'function') resetForm();
      if (typeof go === 'function') go('records');
      return true;
    } catch (err) {
      console.error('save record failed', err);
      const box = $('addFormError');
      if (box) {
        box.textContent = '儲存時發生錯誤，資料尚未送出。請重新開啟 App 後再試一次。';
        box.classList.add('show');
      }
      return false;
    }
  }

  function wireSaveButton() {
    const save = document.querySelector('#add button.save');
    if (!save || save.dataset.safeSave === '1') return;
    save.dataset.safeSave = '1';
    save.removeAttribute('onclick');
    save.addEventListener('click', safeSaveRecord);
  }

  try {
    const addStatus = $('status');
    if (addStatus) {
      const opt = [...addStatus.options].find(o => o.value === '尚未出貨' || o.textContent.trim() === '尚未出貨');
      if (opt) { opt.value = '尚未出貨'; opt.textContent = '待出貨'; }
    }
    const editStatusSel = $('editStatus');
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
    const box = $('recent');
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
      const counter = $(id);
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
        const detail = $('detailContent');
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
      ensureAddValidationUI();
      wireSaveButton();
      return out;
    };
    wrapped.__statusFixWrapped = true;
    try { render = wrapped; } catch {}
  }

  ensureAddValidationUI();
  wireSaveButton();
  renderHomeRecentActiveFirst();
  wireHomeFilters();
  try { if (typeof render === 'function') render(); } catch {}
})();
