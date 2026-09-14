(() => {
  if (window.__spendbookDeadlineReminderLoaded) return;
  window.__spendbookDeadlineReminderLoaded = true;

  const $ = id => document.getElementById(id);
  const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const addDays = (dateString, days) => {
    if (!dateString) return '';
    const d = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return localDate(d);
  };
  const dateText = v => v ? (typeof fmtDate === 'function' ? fmtDate(v) : v) : '未設定';

  function installStyles() {
    if ($('spendbook-reminder-style')) return;
    const style = document.createElement('style');
    style.id = 'spendbook-reminder-style';
    style.textContent = `
      .deadline-box{border:1px solid var(--border);background:#fff;border-radius:16px;margin:0 0 12px;overflow:hidden}
      .deadline-box summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 13px;cursor:pointer}
      .deadline-box summary::-webkit-details-marker{display:none}.deadline-box summary b{font-size:13px}.deadline-box summary small{display:block;margin-top:2px;color:var(--muted);font-size:11px;line-height:1.45}
      .deadline-box summary .mark{color:var(--accent);font-size:18px;font-weight:700;transition:transform .15s}.deadline-box[open] summary .mark{transform:rotate(45deg)}
      .deadline-body{border-top:1px solid var(--border);padding:12px 13px 2px}.deadline-help{font-size:11px;line-height:1.55;color:var(--muted);margin:-2px 0 10px}
      .deadline-banner{margin:0 0 12px;padding:12px 13px;border:1px solid #f1d9ab;background:#fff8e8;border-radius:16px;color:#72551d}.deadline-banner b{display:block;font-size:13px;margin-bottom:4px}.deadline-banner div{font-size:12px;line-height:1.55}
      .notice-settings{border:1px solid var(--border);background:#fff;border-radius:16px;margin:0 0 10px;overflow:hidden}.notice-settings summary{list-style:none;display:flex;align-items:center;justify-content:space-between;padding:14px;cursor:pointer}.notice-settings summary::-webkit-details-marker{display:none}.notice-settings summary b{display:block}.notice-settings summary small{display:block;color:var(--muted);font-size:11px;margin-top:3px}.notice-settings-body{border-top:1px solid var(--border);padding:12px 14px 14px}
      .notice-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #f0f1f5}.notice-toggle:last-of-type{border-bottom:0}.notice-toggle span{font-size:13px}.notice-toggle input[type=checkbox]{width:20px;height:20px;accent-color:var(--accent)}
      .notice-hour{display:grid;grid-template-columns:1fr 92px;align-items:center;gap:10px;margin-top:11px}.notice-hour label{font-size:13px}.notice-hour select{width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:12px;background:#fff}
      .notice-actions{display:flex;gap:8px;margin-top:12px}.notice-actions button{flex:1;border:1px solid var(--border);background:#fff;border-radius:12px;padding:10px 8px;font-weight:750;font-size:12px}.notice-actions button.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
      .notice-state{font-size:11px;color:var(--muted);line-height:1.55;margin-top:10px}.notice-state.ok{color:var(--green)}.notice-state.warn{color:var(--yellow)}
    `;
    document.head.appendChild(style);
  }

  function deadlineField(prefix) {
    return `<div class="field" id="${prefix}PaymentDueWrap"><label>尾款期限</label><input id="${prefix}PaymentDueDate" type="date"><div class="deadline-help" style="margin-top:6px">有填日期時，可在前一天與當天提醒尾款；預計出貨提醒沿用上方「預計出貨日」。</div></div>`;
  }

  function installFields() {
    const addShipGrid = $('shipdate')?.closest('.grid2');
    if (addShipGrid && !$('addPaymentDueWrap')) addShipGrid.insertAdjacentHTML('afterend', deadlineField('add'));
    const editShipGrid = $('editShipdate')?.closest('.grid2');
    if (editShipGrid && !$('editPaymentDueWrap')) editShipGrid.insertAdjacentHTML('afterend', deadlineField('edit'));
  }

  function patchDataModel() {
    if (typeof normalizeRecord !== 'function' || normalizeRecord.__deadlineWrapped) return;
    const old = normalizeRecord;
    const wrapped = function(record) {
      const out = old(record);
      out.paymentDueDate = record?.paymentDueDate || record?.payment_due_date || '';
      return out;
    };
    wrapped.__deadlineWrapped = true;
    normalizeRecord = wrapped;
    if (typeof records !== 'undefined' && Array.isArray(records)) records = records.map(normalizeRecord);
  }

  function patchAddFlow() {
    if (typeof saveRecord === 'function' && !saveRecord.__deadlineWrapped) {
      const old = saveRecord;
      const wrapped = function() {
        const due = $('addPaymentDueDate')?.value || '';
        const before = Array.isArray(records) ? records.length : 0;
        const result = old.apply(this, arguments);
        if (Array.isArray(records) && records.length > before) {
          records[0].paymentDueDate = due;
          if (typeof persist === 'function') persist();
        }
        return result;
      };
      wrapped.__deadlineWrapped = true;
      saveRecord = wrapped;
    }
    if (typeof resetForm === 'function' && !resetForm.__deadlineWrapped) {
      const old = resetForm;
      const wrapped = function() {
        const result = old.apply(this, arguments);
        if ($('addPaymentDueDate')) $('addPaymentDueDate').value = '';
        return result;
      };
      wrapped.__deadlineWrapped = true;
      resetForm = wrapped;
    }
  }

  function patchEditFlow() {
    if (typeof openEditSheet === 'function' && !openEditSheet.__deadlineWrapped) {
      const old = openEditSheet;
      const wrapped = function(i) {
        const result = old.apply(this, arguments);
        if ($('editPaymentDueDate')) $('editPaymentDueDate').value = records?.[i]?.paymentDueDate || '';
        return result;
      };
      wrapped.__deadlineWrapped = true;
      openEditSheet = wrapped;
    }
    if (typeof saveEditRecord === 'function' && !saveEditRecord.__deadlineWrapped) {
      const old = saveEditRecord;
      const wrapped = function() {
        const idx = typeof editingRecordIndex !== 'undefined' ? editingRecordIndex : null;
        if (idx !== null && records?.[idx]) records[idx].paymentDueDate = $('editPaymentDueDate')?.value || '';
        return old.apply(this, arguments);
      };
      wrapped.__deadlineWrapped = true;
      saveEditRecord = wrapped;
    }
  }

  function patchDetail() {
    if (typeof openDetail !== 'function' || openDetail.__deadlineWrapped) return;
    const old = openDetail;
    const wrapped = function(i) {
      const result = old.apply(this, arguments);
      const r = records?.[i];
      const full = $('detailContent')?.querySelector('.detail-full');
      if (r && full && !full.querySelector('.payment-due-detail-row')) {
        const row = document.createElement('div');
        row.className = 'row payment-due-detail-row';
        row.innerHTML = `<span>尾款期限</span><span>${dateText(r.paymentDueDate)}</span>`;
        full.appendChild(row);
      }
      return result;
    };
    wrapped.__deadlineWrapped = true;
    openDetail = wrapped;
  }

  function dueItems() {
    if (typeof records === 'undefined' || !Array.isArray(records)) return [];
    const today = localDate(), tomorrow = addDays(today, 1);
    const out = [];
    records.forEach(r => {
      if (!r || r.status === '已完成') return;
      const unpaid = typeof unpaidOf === 'function' ? unpaidOf(r) : Math.max(Number(r.total||0)-Number(r.paid||0),0);
      if (unpaid > 0 && r.paymentDueDate === today) out.push(`${r.name}（今天付尾款）`);
      else if (unpaid > 0 && r.paymentDueDate === tomorrow) out.push(`${r.name}（明天付尾款）`);
      if (r.status === '尚未出貨' && r.shipdate === today) out.push(`${r.name}（預計今天出貨）`);
      else if (r.status === '尚未出貨' && r.shipdate && r.shipdate < today) out.push(`${r.name}（出貨日已過）`);
      if (r.status === '待取貨') out.push(`${r.name}（待取貨）`);
    });
    return out;
  }

  function installBanner() {
    const section = $('home')?.querySelector('.section');
    if (!section || $('deadlineBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'deadlineBanner';
    banner.className = 'deadline-banner';
    banner.hidden = true;
    section.prepend(banner);
  }
  function renderBanner() {
    installBanner();
    const banner = $('deadlineBanner');
    if (!banner) return;
    const items = dueItems();
    if (!items.length) { banner.hidden = true; banner.innerHTML = ''; return; }
    const shown = items.slice(0, 3).join('、');
    banner.innerHTML = `<b>⏰ 有 ${items.length} 項期限提醒</b><div>${typeof esc === 'function' ? esc(shown) : shown}${items.length > 3 ? '…' : ''}</div>`;
    banner.hidden = false;
  }

  function patchRender() {
    if (typeof render !== 'function' || render.__deadlineWrapped) return;
    const old = render;
    const wrapped = function() {
      const result = old.apply(this, arguments);
      renderBanner();
      return result;
    };
    wrapped.__deadlineWrapped = true;
    render = wrapped;
  }

  function settingsMarkup() {
    const hours = Array.from({length:24}, (_,i) => `<option value="${i}">${String(i).padStart(2,'0')}:00</option>`).join('');
    return `<details class="notice-settings" id="noticeSettingsBox">
      <summary><div><b>期限通知</b><small>尾款、出貨與取件提醒</small></div><span style="color:var(--accent);font-weight:800">設定</span></summary>
      <div class="notice-settings-body">
        <label class="notice-toggle"><span>啟用期限通知</span><input id="noticeEnabled" type="checkbox"></label>
        <label class="notice-toggle"><span>尾款前一天</span><input id="noticePaymentBefore" type="checkbox"></label>
        <label class="notice-toggle"><span>尾款到期當天</span><input id="noticePaymentDue" type="checkbox"></label>
        <label class="notice-toggle"><span>預計出貨當天</span><input id="noticeShippingDue" type="checkbox"></label>
        <label class="notice-toggle"><span>超過預計出貨日</span><input id="noticeShippingOverdue" type="checkbox"></label>
        <label class="notice-toggle"><span>待取貨</span><input id="noticePickup" type="checkbox"></label>
        <div class="notice-hour"><label>每天提醒時間</label><select id="noticeHour">${hours}</select></div>
        <div class="notice-actions"><button class="primary" id="noticeSaveBtn">儲存設定</button><button id="noticeEnablePushBtn">啟用背景通知</button></div>
        <div class="notice-actions"><button id="noticeTestBtn">傳送測試通知</button></div>
        <div class="notice-state" id="noticeState">正在讀取通知設定…</div>
      </div>
    </details>`;
  }

  function bridge() {
    try { return window.parent?.spendNotifications || null; } catch { return null; }
  }
  function setNoticeState(text, cls='') {
    const el = $('noticeState');
    if (!el) return;
    el.textContent = text;
    el.className = `notice-state ${cls}`.trim();
  }
  function fillSettings(s) {
    $('noticeEnabled').checked = s?.enabled !== false;
    $('noticePaymentBefore').checked = s?.payment_day_before !== false;
    $('noticePaymentDue').checked = s?.payment_due_day !== false;
    $('noticeShippingDue').checked = s?.shipping_due_day !== false;
    $('noticeShippingOverdue').checked = s?.shipping_overdue !== false;
    $('noticePickup').checked = s?.pickup !== false;
    $('noticeHour').value = String(Number(s?.reminder_hour ?? 9));
  }
  async function loadNoticeSettings() {
    const api = bridge();
    if (!api) { setNoticeState('登入完成後即可使用期限通知設定。'); return; }
    try {
      const s = await api.getSettings();
      fillSettings(s || {});
      const supported = api.supportsPush?.();
      if (supported) setNoticeState('背景通知可啟用；第一次會詢問系統通知權限。');
      else setNoticeState('目前這個開啟方式不支援網頁背景推播；期限仍會在 App 首頁顯示。','warn');
    } catch (e) { setNoticeState(e?.message || '通知設定讀取失敗','warn'); }
  }
  async function saveNoticeSettings() {
    const api = bridge();
    if (!api) return setNoticeState('請先登入。','warn');
    try {
      $('noticeSaveBtn').disabled = true;
      await api.saveSettings({
        enabled:$('noticeEnabled').checked,
        payment_day_before:$('noticePaymentBefore').checked,
        payment_due_day:$('noticePaymentDue').checked,
        shipping_due_day:$('noticeShippingDue').checked,
        shipping_overdue:$('noticeShippingOverdue').checked,
        pickup:$('noticePickup').checked,
        reminder_hour:Number($('noticeHour').value||9)
      });
      setNoticeState('通知設定已儲存。','ok');
    } catch (e) { setNoticeState(e?.message || '通知設定儲存失敗','warn'); }
    finally { $('noticeSaveBtn').disabled = false; }
  }
  async function enablePush() {
    const api = bridge();
    if (!api) return setNoticeState('請先登入。','warn');
    try {
      $('noticeEnablePushBtn').disabled = true;
      await api.ensurePush();
      $('noticeEnabled').checked = true;
      setNoticeState('背景通知已啟用。','ok');
    } catch (e) { setNoticeState(e?.message || '背景通知啟用失敗','warn'); }
    finally { $('noticeEnablePushBtn').disabled = false; }
  }
  async function testPush() {
    const api = bridge();
    if (!api) return setNoticeState('請先登入。','warn');
    try {
      $('noticeTestBtn').disabled = true;
      const out = await api.testPush();
      setNoticeState(`測試通知已送出${out?.sent ? `（${out.sent} 個裝置）` : ''}。`,'ok');
    } catch (e) { setNoticeState(e?.message || '測試通知失敗','warn'); }
    finally { $('noticeTestBtn').disabled = false; }
  }
  function installSettings() {
    const section = $('settings')?.querySelector('.section');
    if (!section || $('noticeSettingsBox')) return;
    section.insertAdjacentHTML('afterbegin', settingsMarkup());
    $('noticeSaveBtn')?.addEventListener('click', saveNoticeSettings);
    $('noticeEnablePushBtn')?.addEventListener('click', enablePush);
    $('noticeTestBtn')?.addEventListener('click', testPush);
    setTimeout(loadNoticeSettings, 100);
  }

  function run() {
    installStyles();
    installFields();
    patchDataModel();
    patchAddFlow();
    patchEditFlow();
    patchDetail();
    patchRender();
    installSettings();
    renderBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true});
  else run();
})();
