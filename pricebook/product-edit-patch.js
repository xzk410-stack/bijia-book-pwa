(() => {
  if (window.__pricebookProductEditPatchLoaded) return;
  window.__pricebookProductEditPatchLoaded = true;

  const $ = id => document.getElementById(id);

  const style = document.createElement('style');
  style.id = 'pricebook-product-edit-style';
  style.textContent = `
    #productEditModal .edit-product-form{display:grid;gap:12px}
    #productEditModal .edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    #productEditModal .edit-field{display:grid;gap:6px;min-width:0}
    #productEditModal .edit-field.full{grid-column:1/-1}
    #productEditModal label{font-size:12px;color:var(--muted)}
    #productEditModal input,#productEditModal select,#productEditModal textarea{width:100%;min-width:0;border:1px solid var(--line);border-radius:13px;background:#fff;padding:11px 12px;outline:none}
    #productEditModal textarea{min-height:72px;resize:vertical}
    #productEditModal .edit-hint{font-size:11px;line-height:1.5;color:var(--muted)}
    #productEditModal .unit-warning{padding:10px 12px;border-radius:13px;background:#FFF8E9;color:#8C6432;font-size:11px;line-height:1.55}
    @media(max-width:520px){#productEditModal .edit-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'productEditModal';
  modal.innerHTML = `
    <div class="sheet">
      <div class="sheet-head"><h2>編輯商品資料</h2><button class="close" type="button" aria-label="關閉">×</button></div>
      <div class="edit-product-form">
        <div class="edit-field full"><label>商品名稱 *</label><input id="editProductName"></div>
        <div class="edit-grid">
          <div class="edit-field"><label>品牌</label><input id="editProductBrand"></div>
          <div class="edit-field"><label>分類</label><input id="editProductCategory" list="editProductCategoryList" placeholder="例如 日用品、清潔用品"><datalist id="editProductCategoryList"></datalist><div class="edit-hint">可直接輸入，也可從以前用過的分類中選擇。</div></div>
          <div class="edit-field"><label>比較單位 *</label><input id="editProductUnit" list="editProductUnitList" autocomplete="off" placeholder="例如 組、張、抽"><datalist id="editProductUnitList"></datalist><div class="edit-hint">可搜尋或直接輸入新的比較單位。</div></div>
        </div>
        <div class="edit-field full"><label>商品備註</label><textarea id="editProductNote"></textarea></div>
        <div class="unit-warning">比較單位是拿來統一比價的單位，例如 690g × 5罐，這裡應選「g」；「罐」是在價格紀錄的包裝單位裡填。</div>
        <div class="form-actions"><button class="btn ghost" id="editProductCancel" type="button">取消</button><button class="btn primary" id="editProductSave" type="button">儲存</button></div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => modal.classList.remove('show');
  modal.querySelector('.close').onclick = close;
  $('editProductCancel').onclick = close;
  modal.onclick = e => { if (e.target === modal) close(); };

  const defaultCategories = ['未分類','日用品','清潔用品','衛生用品','食品','飲料','美妝','保養','居家用品','寵物用品','3C','家電','服飾','母嬰','文具','其他'];
  const defaultUnits = ['組','張','抽','片','捲','個','包','袋','盒','箱','串','顆','入','瓶','罐','件','份','g','kg','ml','L','公尺','cm'];
  let editingPid = '';
  let originalUnit = '';

  function fillSelect(input, values, current) {
    const list = $('editProductUnitList');
    const existing = (db?.products || []).map(x => String(x.unit || '').trim()).filter(Boolean);
    const all = Array.from(new Set([current, ...existing, ...values].filter(Boolean)));
    list.innerHTML = '';
    all.forEach(v => {
      const op = document.createElement('option');
      op.value = v;
      list.appendChild(op);
    });
    input.value = current || '個';
  }

  function fillCategorySuggestions(current) {
    const list = $('editProductCategoryList');
    const existing = (db?.products || []).map(x => String(x.category || '').trim()).filter(Boolean);
    const all = Array.from(new Set([current, ...existing, ...defaultCategories].filter(Boolean)));
    list.innerHTML = '';
    all.forEach(v => {
      const op = document.createElement('option');
      op.value = v;
      list.appendChild(op);
    });
  }

  function openProductEdit(pid) {
    const p = typeof getProduct === 'function' ? getProduct(pid) : null;
    if (!p) return;
    editingPid = pid;
    originalUnit = p.unit || '個';

    $('editProductName').value = p.name || '';
    $('editProductBrand').value = p.brand || '';
    $('editProductCategory').value = p.category || '未分類';
    $('editProductNote').value = p.note || '';

    fillCategorySuggestions(p.category || '未分類');
    fillSelect($('editProductUnit'), defaultUnits, p.unit || '個');
    modal.classList.add('show');
  }

  $('editProductSave').onclick = () => {
    const p = typeof getProduct === 'function' ? getProduct(editingPid) : null;
    if (!p) return close();
    const name = $('editProductName').value.trim();
    if (!name) return toast('商品名稱要填喔');

    p.name = name;
    p.brand = $('editProductBrand').value.trim();
    p.category = $('editProductCategory').value.trim() || '未分類';
    p.unit = $('editProductUnit').value || '個';
    p.targetPrice = 0;
    p.targetQty = 0;
    p.note = $('editProductNote').value.trim();

    saveDB('修改商品資料');
    close();
    openDetail(editingPid);
    if (originalUnit !== p.unit && (p.records || []).length) {
      toast(`商品已更新；比較單位已改成 ${p.unit}，請確認舊價格紀錄的總數量是否仍正確`);
    } else {
      toast('商品資料已更新 ✓');
    }
  };

  window.editProduct = openProductEdit;
})();
