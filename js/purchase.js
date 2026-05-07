// ===== 사입 장부 모듈 =====
const purchase = (() => {
  let _month = getMonthStr();
  let _entries = [];
  let _qs = {};

  async function load() {
    const el = document.getElementById('pur-month');
    if (!el.value) el.value = _month;
    _month = el.value || _month;

    document.getElementById('pur-prev-month').onclick = () => {
      const d = new Date(_month + '-01');
      d.setMonth(d.getMonth() - 1);
      _month = getMonthStr(d);
      el.value = _month;
      _fetch();
    };
    document.getElementById('pur-next-month').onclick = () => {
      const d = new Date(_month + '-01');
      d.setMonth(d.getMonth() + 1);
      _month = getMonthStr(d);
      el.value = _month;
      _fetch();
    };
    el.onchange = e => { _month = e.target.value; _fetch(); };
    document.getElementById('btn-add-purchase').onclick = () => openModal(null);

    _qs = await loadQuickSelect();
    await _fetch();
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
          <td class="name-cell">${it.name || '-'}</td>
          <td>${it.unit || '-'}</td>
          <td>${it.quantity || '-'}</td>
          <td>${it.unitPrice ? formatWon(it.unitPrice) : '-'}</td>
          <td style="font-weight:700;color:var(--primary)">${it.amount ? formatWon(it.amount) : '-'}</td>
        </tr>`
      ).join('');

      return `
        <div class="entry-card">
          <div class="entry-card-header">
            <div>
              <div class="entry-date">${formatDateKo(e.date)}</div>
              <div class="entry-supplier">${e.supplier || '거래처 미입력'}</div>
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
              <thead><tr><th>품목</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>
              <tbody>${itemRows}</tbody>
            </table>
          ` : ''}
          ${e.notes ? `<p style="font-size:13px;color:var(--text-light);margin-top:6px">📝 ${e.notes}</p>` : ''}
        </div>
      `;
    }).join('');
  }

  function openModal(entryId) {
    const isEdit = !!entryId;
    const e = isEdit ? _entries.find(x => x.id === entryId) : null;
    const items = e?.items?.length > 0 ? e.items : [{ name: '', unit: '', quantity: '', unitPrice: '', amount: '' }];

    const quickItems = (_qs.purchaseItems || []);
    const chipsHTML = quickItems.length > 0
      ? `<div class="quick-chips" id="pur-quick-chips"></div>` : '';

    const body = `
      <form class="entry-form" id="pur-form">
        <div class="form-grid">
          <div class="form-group">
            <label>날짜 *</label>
            <input type="date" name="date" value="${e?.date || getTodayStr()}" required>
          </div>
          <div class="form-group">
            <label>거래처 (공급업체)</label>
            <input type="text" name="supplier" value="${e?.supplier || ''}" placeholder="예: 청풍운, 남해수산">
          </div>
        </div>

        <div class="form-group full">
          <label>품목 목록</label>
          ${chipsHTML}
          <div class="item-row-headers">
            <span>품목명</span><span>단위</span><span>수량</span><span>단가(원)</span><span>금액</span><span></span>
          </div>
          <div id="pur-items">
            ${items.map((it, i) => _itemRowHTML(it, i)).join('')}
          </div>
          <button type="button" class="add-item-btn" onclick="purchase.addItemRow()">+ 품목 추가</button>
        </div>

        <div class="form-group full">
          <label>메모</label>
          <textarea name="notes" placeholder="특이사항">${e?.notes || ''}</textarea>
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

    openModal(isEdit ? '사입 기록 수정' : '사입 추가', body, footer);

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
        <input type="text" class="item-name" placeholder="품목명" value="${item.name || ''}" oninput="purchase._calcTotal()">
        <input type="text" class="item-unit" placeholder="단위" value="${item.unit || ''}">
        <input type="number" class="item-qty" placeholder="수량" value="${item.quantity || ''}" min="0" oninput="purchase._calcRowAmount(this)">
        <input type="number" class="item-price" placeholder="단가" value="${item.unitPrice || ''}" min="0" oninput="purchase._calcRowAmount(this)">
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

  function _calcRowAmount(input) {
    const row = input.closest('.purchase-item-row');
    const qty = Number(row.querySelector('.item-qty').value) || 0;
    const price = Number(row.querySelector('.item-price').value) || 0;
    const amount = qty * price;
    const idx = Array.from(row.parentElement.children).indexOf(row);
    const amountEl = row.querySelector('.auto-amount');
    if (amountEl) amountEl.textContent = amount > 0 ? formatWon(amount) : '-';
    _calcTotal();
  }

  function _calcTotal() {
    const rows = document.querySelectorAll('#pur-items .purchase-item-row');
    let total = 0;
    rows.forEach(row => {
      const qty = Number(row.querySelector('.item-qty')?.value) || 0;
      const price = Number(row.querySelector('.item-price')?.value) || 0;
      total += qty * price;
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
      const unit = row.querySelector('.item-unit')?.value.trim() || '';
      const quantity = Number(row.querySelector('.item-qty')?.value) || 0;
      const unitPrice = Number(row.querySelector('.item-price')?.value) || 0;
      const amount = quantity * unitPrice;
      totalAmount += amount;
      items.push({ name, unit, quantity, unitPrice, amount });
    });

    const data = {
      date,
      supplier: form.querySelector('[name="supplier"]').value.trim(),
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

  return { load, openModal, addItemRow, _calcRowAmount, _calcTotal, save, remove };
})();
