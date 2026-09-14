(() => {
  if (window.__spendbookDeadlineReminderLoaded) return;
  window.__spendbookDeadlineReminderLoaded = true;

  const $ = id => document.getElementById(id);
  const REMINDER_TYPES = ['尾款','預計出貨','取件','自訂'];
  const REPEAT_VALUES = ['none','daily','weekly'];
  const SENT_KEY = 'spendbook_reminder_sent_v1';

  function localDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function addDays(dateString, days) {
    if (!dateString) return '';
    const d = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return localDate(d);
  }
  function normalizeReminder(reminder) {
    const r = reminder && typeof reminder === 'object' ? reminder : {};
    const type = REMINDER_TYPES.includes(r.type) ? r.type : '';
    const remindAt = typeof r.remindAt === 'string' ? r.remindAt : '';
    const repeat = REPEAT_VALUES.includes(r.repeat) ? r.repeat : 'none';
    return { enabled: Boolean(r.enabled && type && remindAt), type, remindAt, repeat };
  }
  function reminderLabel(r) {
    const rem = normalizeReminder(r?.reminder);
    if (!rem.enabled) return '未設定';
    const repeat = rem.repeat === 'daily' ? '・每日' : rem.repeat === 'weekly' ? '・每週' : '';
    return `${rem.type} ${typeof fmtDate === 'function' ? fmtDate(rem.remindAt) : rem.remindAt}${repeat}`;
  }

  function installStyles() {
    if ($('spendbook-reminder-style')) return;
    const style = document.createElement('style');
    style.id = 'spendbook-reminder-style';
    style.textContent = `
      .deadline-box{border:1px solid var(--border);background:#fff;border-radius:16px;margin:0 0 12px;overflow:hidden}
      .deadline-box summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 13px;cursor:pointer}
      .deadline-box summary::-webkit-details-marker{display:none}
      .deadline-box summary b{font-size:13px}.deadline-box summary small{display:block;margin-top:2px;color:var(--muted);font-size:11px}
      .deadline-box summary .mark{color:var(--accent);font-size:18px;font-weight:700}.deadline-box[open] summary .mark{transform:rotate(45deg)}
      .deadline-body{border-top:1px solid var(--border);padding:12px 13px 2px}
      .deadline-help{font-size:11px;line-height:1.55;color:var(--muted);margin:-2px 0 10px}
      .deadline-banner{margin:0 0 12px;padding:12px 13px;border:1px solid #f1d9ab;background:#fff8e8;border-radius:16px;color:#72551d}
      .deadline-banner b{display:block;font-size:13px;margin-bottom:4px}.deadline-banner div{font-size:12px;line-height:1.55}
      .deadline-chip{display:inline-flex;align-items:center;padding:5px 9px;border-radius:99px;background:#fff5d9;color:#8a6412;font-size:11px;margin-top:8px}
    `;
    document.head.appendChild(style);
  }

  function reminderFields(prefix) {
    return `
      <details class="deadline-box" id="${prefix}ReminderBox">
        <summary><div><b>期限提醒</b><small>尾款、預計出貨、取件</small></div><span class="mark">＋</span></summary>
        <div class="deadline-body">
          <div class="grid2">
            <div class="field"><label>提醒類型</label><select id="${prefix}ReminderType"><option value="">不提醒</option><option>尾款</option><option>預計出貨</option><option>取件</option><option>自訂</option></select></div>
            <div class="field"><label>提醒日期</label><input id="${prefix}ReminderDate" type="date"></div>
          </div>
          <div class="field"><label>重複提醒</label><select id="${prefix}ReminderRepeat"><option value="none">只提醒一次</option><option value="daily">每日提醒</option><option value="weekly">每週提醒</option></select></div>
          <div class="deadline-help">選「預計出貨」時，如果已有預計出貨日，會自動帶入前一天；完成訂單後會自動停止提醒。</div>
        </div>
      </details>`;
  }

  function installFields() {
    const addShipGrid = $('shipdate')?.closest('.grid2');
    if (addShipGrid && !$('addReminderBox')) addShipGrid.insertAdjacentHTML('afterend', reminderFields('add'));
    const editShipGrid = $('editShipdate')?.closest('.grid2');
    if (editShipGrid && !$('editReminderBox')) editShipGrid.insertAdjacentHTML('afterend', reminderFields('edit'));

    const bindAutoDate = (prefix, shipId) => {
      const type = $(`${prefix}ReminderType`), date = $(`${prefix}ReminderDate`), ship = $(shipId);
      if (!type || type.dataset.bound) return;
      type.dataset.bound = '1';
      type.addEventListener('change', () => {
        if (type.value === '預計出貨' && !date.value && ship?.value) date.value = addDays(ship.value, -1);
        if (!type.value) date.value = '';
      });
      ship?.addEventListener('change', () => {
        if (type.value === '預計出貨' && ship.value) date.value = addDays(ship.value, -1);
      });
    };
    bindAutoDate('add', 'shipdate');
    bindAutoDate('edit', 'editShipdate');
  }

  function readReminder(prefix) {
    const type = $(`${prefix}ReminderType`)?.value || '';
    const remindAt = $(`${prefix}ReminderDate`)?.value || '';
    const repeat = $(`${prefix}ReminderRepeat`)?.value || 'none';
    return normalizeReminder({ enabled: Boolean(type && remindAt), type, remindAt, repeat });
  }
  function fillReminder(prefix, reminder) {
    const r = normalizeReminder(reminder);
    if ($(`${prefix}ReminderType`)) $(`${prefix}ReminderType`).value = r.enabled ? r.type : '';
    if ($(`${prefix}ReminderDate`)) $(`${prefix}ReminderDate`).value = r.enabled ? r.remindAt : '';
    if ($(`${prefix}ReminderRepeat`)) $(`${prefix}ReminderRepeat`).value = r.repeat;
    const box = $(`${prefix}ReminderBox`);
    if (box) box.open = r.enabled;
  }

  function patchDataModel() {
    if (typeof normalizeRecord !== 'function' || normalizeRecord.__deadlineWrapped) return;
    const oldNormalize = normalizeRecord;
    const wrapped = function(record) {
      const out = oldNormalize(record);
      out.reminder = normalizeReminder(record?.reminder);
      return out;
    };
    wrapped.__deadlineWrapped = true;
    normalizeRecord = wrapped;
    if (typeof records !== 'undefined' && Array.isArray(records)) records = records.map(normalizeRecord);
  }

  function patchAddFlow() {
    if (typeof saveRecord === 'function' && !saveRecord.__deadlineWrapped) {
      const oldSave = saveRecord;
      const wrapped = function() {
        const reminder = readReminder('add');
        if (($('addReminderType')?.value || '') && !reminder.enabled) return alert('請選擇提醒日期');
        const before = Array.isArray(records) ? records.length : 0;
        const result = oldSave.apply(this, arguments);
        if (Array.isArray(records) && records.length > before) {
          records[0].reminder = reminder;
          if (typeof persist === 'function') persist();
          fillReminder('add', null);
          checkReminders();
        }
        return result;
      };
      wrapped.__deadlineWrapped = true;
      saveRecord = wrapped;
    }
    if (typeof resetForm === 'function' && !resetForm.__deadlineWrapped) {
      const oldReset = resetForm;
      const wrapped = function() {
        const result = oldReset.apply(this, arguments);
        fillReminder('add', null);
        return result;
      };
      wrapped.__deadlineWrapped = true;
      resetForm = wrapped;
    }
  }

  function patchEditFlow() {
    if (typeof openEditSheet === 'function' && !openEditSheet.__deadlineWrapped) {
      const oldOpen = openEditSheet;
      const wrapped = function(i) {
        const result = oldOpen.apply(this, arguments);
        fillReminder('edit', records?.[i]?.reminder);
        return result;
      };
      wrapped.__deadlineWrapped = true;
      openEditSheet = wrapped;
    }
    if (typeof saveEditRecord === 'function' && !saveEditRecord.__deadlineWrapped) {
      const oldSave = saveEditRecord;
      const wrapped = function() {
        const idx = typeof editingRecordIndex !== 'undefined' ? editingRecordIndex : null;
        const reminder = readReminder('edit');
        if (($('editReminderType')?.value || '') && !reminder.enabled) return alert('請選擇提醒日期');
        if (idx !== null && records?.[idx]) records[idx].reminder = reminder;
        const result = oldSave.apply(this, arguments);
        checkReminders();
        return result;
      };
      wrapped.__deadlineWrapped = true;
      saveEditRecord = wrapped;
    }
  }

  function patchDetail() {
    if (typeof openDetail !== 'function' || openDetail.__deadlineWrapped) return;
    const oldOpen = openDetail;
    const wrapped = function(i) {
      const result = oldOpen.apply(this, arguments);
      const r = records?.[i];
      const full = $('detailContent')?.querySelector('.detail-full');
      if (r && full && !full.querySelector('.reminder-detail-row')) {
        const row = document.createElement('div');
        row.className = 'row reminder-detail-row';
        row.innerHTML = `<span>期限提醒</span><span>${typeof esc === 'function' ? esc(reminderLabel(r)) : reminderLabel(r)}</span>`;
        full.appendChild(row);
      }
      return result;
    };
    wrapped.__deadlineWrapped = true;
    openDetail = wrapped;
  }

  function isDue(record) {
    const rem = normalizeReminder(record?.reminder);
    return rem.enabled && record?.status !== '已完成' && rem.remindAt <= localDate();
  }
  function dueRecords() {
    if (typeof records === 'undefined' || !Array.isArray(records)) return [];
    return records.map((r,i) => ({r,i})).filter(x => isDue(x.r));
  }

  function installBanner() {
    const homeSection = $('home')?.querySelector('.section');
    if (!homeSection || $('deadlineBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'deadlineBanner';
    banner.className = 'deadline-banner';
    banner.hidden = true;
    homeSection.prepend(banner);
  }
  function renderBanner() {
    installBanner();
    const banner = $('deadlineBanner');
    if (!banner) return;
    const due = dueRecords();
    if (!due.length) { banner.hidden = true; banner.innerHTML = ''; return; }
    const names = due.slice(0,3).map(x => `${x.r.name}（${normalizeReminder(x.r.reminder).type}）`).join('、');
    banner.innerHTML = `<b>⏰ 有 ${due.length} 筆期限提醒</b><div>${typeof esc === 'function' ? esc(names) : names}${due.length>3?'…':''}</div>`;
    banner.hidden = false;
  }

  function sentMap() {
    try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}') || {}; } catch { return {}; }
  }
  function shouldNotify(record) {
    const rem = normalizeReminder(record.reminder);
    if (!isDue(record)) return false;
    const today = localDate();
    const id = String(record.createdAt || record.name || Math.random());
    const map = sentMap();
    const last = map[id] || '';
    if (rem.repeat === 'none') return !last;
    if (rem.repeat === 'daily') return last !== today;
    if (rem.repeat === 'weekly') {
      if (!last) return true;
      const a = new Date(`${last}T12:00:00`), b = new Date(`${today}T12:00:00`);
      return (b-a) >= 7*86400000;
    }
    return false;
  }
  function markNotified(record) {
    const id = String(record.createdAt || record.name || Math.random());
    const map = sentMap();
    map[id] = localDate();
    localStorage.setItem(SENT_KEY, JSON.stringify(map));
  }
  function notify(record) {
    const rem = normalizeReminder(record.reminder);
    const title = `我的消費簿・${rem.type}提醒`;
    const body = `${record.name}｜提醒日期 ${typeof fmtDate === 'function' ? fmtDate(rem.remindAt) : rem.remindAt}`;
    try {
      if (window.Android && typeof Android.showReminderNotification === 'function') {
        Android.showReminderNotification(title, body, Number(record.createdAt || Date.now()) % 2147483647);
        return true;
      }
    } catch {}
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: './icon.svg' });
        return true;
      }
    } catch {}
    return false;
  }
  function checkReminders() {
    renderBanner();
    dueRecords().forEach(({r}) => {
      if (!shouldNotify(r)) return;
      if (notify(r)) markNotified(r);
    });
  }

  function patchRender() {
    if (typeof render !== 'function' || render.__deadlineWrapped) return;
    const oldRender = render;
    const wrapped = function() {
      const result = oldRender.apply(this, arguments);
      renderBanner();
      return result;
    };
    wrapped.__deadlineWrapped = true;
    render = wrapped;
  }

  function run() {
    installStyles();
    installFields();
    patchDataModel();
    patchAddFlow();
    patchEditFlow();
    patchDetail();
    patchRender();
    renderBanner();
    checkReminders();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
    setInterval(checkReminders, 60 * 60 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true});
  else run();
})();
