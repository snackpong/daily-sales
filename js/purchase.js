// ===== 사입 장부 모듈 =====
const purchase = (() => {
  let _month = getMonthStr();
  let _entries = [];
  let _qs = {};
  let _suppliers = [];
  let _suppliersLoaded = false;

  async function load() {
    const el = document.getElementById('pur-month');
    if (!el.value) el.value = _month;
    _month = el.value || _month;

    document.getElementById('pur-prev-month').onclick = () => {
      _month = addMonths(_month, -1);
      el.value = _month;
      _fetch();
    };
    document.getElementById('pur-next-month').onclick = () => {
      _month = addMonths(_month, 1);
      el.value = _month;
      _fetch();
    };
    el.onchange = e => { _month = e.target.value; _fetch(); };
    document.getElementById('btn-add-purchase').onclick = () => openForm(null);

    _qs = await loadQuickSelect();
    await _loadSuppliers();
    await _fetch();
  }

  async function _loadSuppliers(force = false) {
    if (_suppliersLoaded && !force) return;
    try {
      const snap = await userCol('suppliers').orderBy('name').get();
      _suppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _suppliersLoaded = true;
    } catch (e) {
      console.error(e);
      _suppliers = [];
      _suppliersLoaded = true;
    }
  }

  async function _fetch() {
    const list = document.getElementById('purchase-list');
    list.innerHTML = '<p class="loading-msg">불러오는 중...</p>';
    try {
      const snap = await userCol('purchaseEntries')
        .where('date', '>=', _month + '-01')
        .where('date', '<=', _month + '-31')
        .orderBy('date', 'desc')
        .get();
      _entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _render();
    } catch (e) {
      list.innerHTML = `<p class="error-msg">오류: ${e.message}</p>`;
    }
  }

  function _render() {
    const list = document.getElementById('purchase-list');
    const total = _entries.reduce((s, e) => s + (Number(e.totalAmount) || 0), 0);
    document.getElementById('pur-total').textContent = formatWon(total);

    if (_entries.length === 0) {
      list.innerHTML = '<p class="empty-msg">이달 사입 기록이 없습니다.</p>';
      return;
    }

    list.innerHTML = _entries.map(e => {
      const itemRows = (e.items || []).map(it =>
        `<tr>
          <td class="name-cell">${escapeHTML(it.name || '-')}</td>
          <td>${it.boxes || '-'}</td>
          <td>${escapeHTML(it.kg || '-')}</td>
          <td>${escapeHTML(it.count || '-')}</td>
          <td>${it.unitPrice ? formatWon(it.unitPrice) : '-'}</td>
          <td style="font-weight:700;color:var(--primary)">${it.amount ? formatWon(it.amount) : '-'}</td>
        </tr>`
      ).join('');
      const supplierPhone = e.supplierPhone || e.phone || '';

      return `
        <div class="entry-card">
          <div class="entry-card-header">
            <div>
              <div class="entry-date">${formatDateKo(e.date)}</div>
              <div class="entry-supplier">${escapeHTML(e.supplier || '거래처 미입력')}</div>
              ${supplierPhone ? `
                <div class="entry-phone">
                  ${escapeHTML(supplierPhone)}
                  <button class="phone-copy-btn" onclick="event.stopPropagation();purchase.copyText('${escapeInlineJS(supplierPhone)}')" title="복사">📋</button>
                </div>
              ` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <div class="entry-total">${formatWon(e.totalAmount)}</div>
              <div class="entry-actions">
                <button class="btn-sm btn-outline" onclick="purchase.openModal('${e.id}')">수정</button>
                <button class="btn-sm btn-danger" onclick="purchase.remove('${e.id}')">삭제</button>
              </div>
            </div>
          </div>
          ${e.items && e.items.length > 0 ? `
            <table class="purchase-items-table">
              <thead><tr><th>품목</th><th>박스</th><th>kg</th><th>개수</th><th>단가</th><th>합계</th></tr></thead>
              <tbody>${itemRows}</tbody>
            </table>
          ` : ''}
          ${e.notes ? `<p style="font-size:13px;color:var(--text-light);margin-top:6px">📝 ${escapeHTML(e.notes)}</p>` : ''}
        </div>
      `;
    }).join('');
  }

  function openForm(entryId) {
    const isEdit = !!entryId;
    const e = isEdit ? _entries.find(x => x.id === entryId) : null;
    const items = e?.items?.length > 0 ? e.items : [{ name: '', boxes: '', kg: '', count: '', unitPrice: '', amount: '' }];

    const quickItems = (_qs.purchaseItems || []);
    const chipsHTML = quickItems.length > 0
      ? `<div class="quick-chips" id="pur-quick-chips"></div>` : '';
    const supplierChipsHTML = _suppliers.length > 0
      ? _suppliers.map(s => `
          <button type="button" class="supplier-chip" onclick="purchase.selectSupplier('${escapeInlineJS(s.id)}')">
            ${escapeHTML(s.name)}
          </button>
        `).join('')
      : '<span class="supplier-empty">등록된 거래처 없음</span>';
    const supplierPhone = e?.supplierPhone || e?.phone || '';

    const body = `
      <form class="entry-form" id="pur-form">
        <div class="form-group full">
          <label>자주 쓰는 거래처</label>
          <div class="supplier-quick-row">
            <div class="supplier-chip-list">${supplierChipsHTML}</div>
            <button type="button" class="btn-outline-sm" onclick="purchase.openSupplierManager()">관리</button>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>날짜 *</label>
            <input type="date" name="date" value="${e?.date || getTodayStr()}" required>
          </div>
          <div class="form-group">
            <label>거래처 (공급업체)</label>
            <input type="text" name="supplier" maxlength="50" value="${escapeAttr(e?.supplier || '')}" placeholder="예: 청풍운, 남해수산">
          </div>
          <div class="form-group">
            <label>전화번호</label>
            <div class="input-with-copy">
              <input type="tel" name="supplierPhone" maxlength="20" value="${escapeAttr(supplierPhone)}" placeholder="010-0000-0000">
              <button type="button" class="phone-copy-btn" onclick="purchase.copySupplierPhone()" title="복사">📋</button>
            </div>
          </div>
        </div>

        <div class="form-group full">
          <label>품목 목록</label>
          ${chipsHTML}
          <div class="item-row-headers">
            <span>품목명</span><span>박스 수</span><span>kg</span><span>개수</span><span>단가(원)</span><span>합계</span><span></span>
          </div>
          <div id="pur-items">
            ${items.map((it, i) => _itemRowHTML(it, i)).join('')}
          </div>
          <button type="button" class="add-item-btn" onclick="purchase.addItemRow()">+ 품목 추가</button>
        </div>

        <div class="form-group full">
          <label>메모</label>
          <textarea name="notes" maxlength="500" placeholder="특이사항">${escapeHTML(e?.notes || '')}</textarea>
        </div>

        <div class="form-group full">
          <label>합계</label>
          <div style="font-size:18px;font-weight:700;color:var(--primary)" id="pur-total-display">계산 중...</div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn-outline" onclick="closeModal()">취소</button>
      <button class="btn-primary" onclick="purchase.save('${entryId || ''}')">
        ${isEdit ? '수정 저장' : '추가'}
      </button>
    `;

    openModal(isEdit ? '사입 기록 수정' : '사입 추가', body, footer); // global openModal (utils.js)

    // 빠른선택 칩
    const chipsEl = document.getElementById('pur-quick-chips');
    if (chipsEl && quickItems.length > 0) {
      renderChips(chipsEl, quickItems, val => {
        // 현재 포커스된 품목명 입력 또는 새 행 첫 번째 입력에 채움
        const nameInputs = document.querySelectorAll('#pur-items .item-name');
        const empty = Array.from(nameInputs).find(i => !i.value);
        if (empty) { empty.value = val; _calcTotal(); }
      });
    }

    _calcTotal();
    document.getElementById('pur-items').addEventListener('input', _calcTotal);
  }

  function _itemRowHTML(item, idx) {
    return `
      <div class="purchase-item-row" id="item-row-${idx}">
        <input type="text" class="item-name" maxlength="50" placeholder="품목명" value="${escapeAttr(item.name || '')}" oninput="purchase._calcTotal()">
        <input type="number" class="item-boxes" placeholder="박스 수" value="${item.boxes || ''}" min="0" step="0.01" oninput="purchase._calcRowAmount(this)">
        <input type="text" class="item-kg" maxlength="50" placeholder="kg" value="${escapeAttr(item.kg || '')}">
        <input type="text" class="item-count" maxlength="50" placeholder="개수" value="${escapeAttr(item.count || '')}">
        <input type="text" inputmode="numeric" class="item-price" maxlength="15" placeholder="단가" value="${item.unitPrice ? Number(item.unitPrice).toLocaleString('ko-KR') : ''}" oninput="purchase._onPriceInput(this)">
        <div class="auto-amount" id="row-amount-${idx}">${item.amount ? formatWon(item.amount) : '-'}</div>
        <button type="button" class="remove-item-btn" onclick="this.closest('.purchase-item-row').remove();purchase._calcTotal()">×</button>
      </div>
    `;
  }

  function addItemRow() {
    const container = document.getElementById('pur-items');
    const idx = container.children.length;
    const div = document.createElement('div');
    div.innerHTML = _itemRowHTML({}, idx);
    container.appendChild(div.firstElementChild);
  }

  function _onPriceInput(el) {
    const raw = el.value.replace(/[^0-9]/g, '');
    el.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
    _calcRowAmount(el);
  }

  function _calcRowAmount(input) {
    const row = input.closest('.purchase-item-row');
    const boxes = Number(row.querySelector('.item-boxes').value) || 0;
    const price = parseMoneyInput(row.querySelector('.item-price').value);
    const amount = boxes * price;
    const amountEl = row.querySelector('.auto-amount');
    if (amountEl) amountEl.textContent = amount > 0 ? formatWon(amount) : '-';
    _calcTotal();
  }

  function _calcTotal() {
    const rows = document.querySelectorAll('#pur-items .purchase-item-row');
    let total = 0;
    rows.forEach(row => {
      const boxes = Number(row.querySelector('.item-boxes')?.value) || 0;
      const price = parseMoneyInput(row.querySelector('.item-price')?.value);
      total += boxes * price;
    });
    const el = document.getElementById('pur-total-display');
    if (el) el.textContent = formatWon(total);
  }

  async function save(entryId) {
    const form = document.getElementById('pur-form');
    const isEdit = !!entryId;
    const date = form.querySelector('[name="date"]').value;
    if (!date) { showToast('날짜를 입력하세요', 'error'); return; }

    const rows = document.querySelectorAll('#pur-items .purchase-item-row');
    const items = [];
    let totalAmount = 0;

    rows.forEach(row => {
      const name = row.querySelector('.item-name')?.value.trim();
      if (!name) return;
      const boxes = Number(row.querySelector('.item-boxes')?.value) || 0;
      const kg = row.querySelector('.item-kg')?.value.trim() || '';
      const count = row.querySelector('.item-count')?.value.trim() || '';
      const unitPrice = parseMoneyInput(row.querySelector('.item-price')?.value);
      const amount = boxes * unitPrice;
      totalAmount += amount;
      items.push({ name, boxes, kg, count, unitPrice, amount });
    });

    const data = {
      date,
      supplier: form.querySelector('[name="supplier"]').value.trim(),
      supplierPhone: form.querySelector('[name="supplierPhone"]').value.trim(),
      items,
      totalAmount,
      notes: form.querySelector('[name="notes"]').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!isEdit) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    // 품목명 빠른선택 자동 저장
    const newItems = items.map(it => it.name).filter(Boolean);
    const existing = _qs.purchaseItems || [];
    const merged = [...new Set([...newItems, ...existing])].slice(0, 20);
    if (JSON.stringify(merged) !== JSON.stringify(existing)) {
      _qs.purchaseItems = merged;
      saveQuickSelect({ purchaseItems: merged });
    }

    try {
      await _ensureSupplierSaved(data.supplier, data.supplierPhone);
      if (isEdit) {
        await userCol('purchaseEntries').doc(entryId).update(data);
        showToast('수정되었습니다');
      } else {
        await userCol('purchaseEntries').add(data);
        showToast('추가되었습니다');
      }
      closeModal();
      await _fetch();
    } catch (e) {
      showToast('저장 실패: ' + e.message, 'error');
    }
  }

  async function remove(entryId) {
    if (!await confirmDialog('이 기록을 삭제하시겠습니까?')) return;
    try {
      await userCol('purchaseEntries').doc(entryId).delete();
      showToast('삭제되었습니다');
      await _fetch();
    } catch (e) {
      showToast('삭제 실패: ' + e.message, 'error');
    }
  }

  function selectSupplier(supplierId) {
    const supplier = _suppliers.find(s => s.id === supplierId);
    const form = document.getElementById('pur-form');
    if (!supplier || !form) return;
    form.querySelector('[name="supplier"]').value = supplier.name || '';
    form.querySelector('[name="supplierPhone"]').value = supplier.phone || '';
  }

  function copyText(text) {
    navigator.clipboard.writeText(text || '').then(() => showToast('복사되었습니다'));
  }

  function copySupplierPhone() {
    const phone = document.querySelector('#pur-form [name="supplierPhone"]')?.value.trim();
    if (!phone) { showToast('복사할 전화번호가 없습니다', 'error'); return; }
    copyText(phone);
  }

  function openSupplierManager() {
    const rows = _suppliers.length > 0
      ? _suppliers.map(s => `
          <div class="supplier-manage-row">
            <div>
              <strong>${escapeHTML(s.name)}</strong>
              ${s.phone ? `<span>${escapeHTML(s.phone)}</span>` : ''}
            </div>
            <button class="btn-danger" onclick="purchase.removeSupplier('${escapeInlineJS(s.id)}')">삭제</button>
          </div>
        `).join('')
      : '<p class="empty-msg">등록된 거래처가 없습니다.</p>';

    openModal('거래처 관리', `
      <form class="entry-form" id="supplier-form">
        <div class="form-grid">
          <div class="form-group">
            <label>거래처명</label>
            <input type="text" name="name" maxlength="50" placeholder="예: 남해수산">
          </div>
          <div class="form-group">
            <label>전화번호</label>
            <input type="tel" name="phone" maxlength="20" placeholder="010-0000-0000">
          </div>
        </div>
        <button type="button" class="btn-primary" onclick="purchase.addSupplier()">거래처 추가</button>
      </form>
      <div class="supplier-manage-list">${rows}</div>
    `, '<button class="btn-outline" onclick="closeModal()">닫기</button>');
  }

  async function addSupplier() {
    const form = document.getElementById('supplier-form');
    const name = form.querySelector('[name="name"]').value.trim();
    const phone = form.querySelector('[name="phone"]').value.trim();
    if (!name) { showToast('거래처명을 입력하세요', 'error'); return; }
    await _ensureSupplierSaved(name, phone);
    showToast('거래처가 추가되었습니다');
    openSupplierManager();
  }

  async function removeSupplier(supplierId) {
    if (!await confirmDialog('이 거래처를 삭제하시겠습니까?')) return;
    try {
      await userCol('suppliers').doc(supplierId).delete();
      _suppliers = _suppliers.filter(s => s.id !== supplierId);
      showToast('삭제되었습니다');
      openSupplierManager();
    } catch (e) {
      showToast('삭제 실패: ' + e.message, 'error');
    }
  }

  async function _ensureSupplierSaved(name, phone) {
    if (!name) return;
    const existing = _suppliers.find(s => s.name === name);
    if (existing) {
      if (phone && existing.phone !== phone) {
        await userCol('suppliers').doc(existing.id).set({
          name,
          phone,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        existing.phone = phone;
      }
      return;
    }
    const ref = await userCol('suppliers').add({
      name,
      phone: phone || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    _suppliers.push({ id: ref.id, name, phone: phone || '' });
    _suppliers.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }

  return {
    load, openModal: openForm, addItemRow, _calcRowAmount, _onPriceInput,
    _calcTotal, save, remove, selectSupplier, copyText, copySupplierPhone,
    openSupplierManager, addSupplier, removeSupplier
  };
})();
