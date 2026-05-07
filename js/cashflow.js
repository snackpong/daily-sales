// ===== 수입/지출 모듈 =====
const cashflow = (() => {
  let _date = getTodayStr();
  let _entries = [];
  let _qs = {};

  async function load() {
    document.getElementById('cf-date').value = _date;

    document.getElementById('cf-date').addEventListener('change', e => {
      _date = e.target.value; _fetch();
    });
    document.getElementById('cf-prev-day').onclick = () => {
      _date = addDays(_date, -1);
      document.getElementById('cf-date').value = _date;
      _fetch();
    };
    document.getElementById('cf-next-day').onclick = () => {
      _date = addDays(_date, 1);
      document.getElementById('cf-date').value = _date;
      _fetch();
    };
    document.getElementById('cf-today').onclick = () => {
      _date = getTodayStr();
      document.getElementById('cf-date').value = _date;
      _fetch();
    };
    document.getElementById('btn-add-cf').onclick = () => openForm(null);

    _qs = await loadQuickSelect();
    await _fetch();
  }

  async function _fetch() {
    const list = document.getElementById('cashflow-list');
    list.innerHTML = '<p class="loading-msg">불러오는 중...</p>';
    try {
      const snap = await userCol('cashflowEntries')
        .where('date', '==', _date)
        .orderBy('createdAt', 'asc')
        .get();
      _entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _render();
    } catch (e) {
      list.innerHTML = `<p class="error-msg">오류: ${e.message}</p>`;
    }
  }

  function _render() {
    const list = document.getElementById('cashflow-list');
    let totalIncome = 0, totalExpense = 0;

    _entries.forEach(e => {
      if (e.type === 'income') totalIncome += Number(e.amount) || 0;
      else totalExpense += Number(e.amount) || 0;
    });

    const balance = totalIncome - totalExpense;
    document.getElementById('cf-total-income').textContent = formatWon(totalIncome);
    document.getElementById('cf-total-expense').textContent = formatWon(totalExpense);
    const balEl = document.getElementById('cf-balance');
    balEl.textContent = formatWon(Math.abs(balance)) + (balance < 0 ? ' (적자)' : '');
    balEl.style.color = balance >= 0 ? 'var(--income)' : 'var(--expense)';

    if (_entries.length === 0) {
      list.innerHTML = '<p class="empty-msg">이날 수입/지출 기록이 없습니다.</p>';
      return;
    }

    list.innerHTML = `<div class="entry-list">${_entries.map(e => `
      <div class="cf-entry-card">
        <span class="cf-type-badge type-${e.type}">${e.type === 'income' ? '수입' : '지출'}</span>
        <div class="cf-info">
          <div class="cf-category">${e.category || '항목 미입력'}</div>
          ${e.notes ? `<div class="cf-memo-text">${e.notes}</div>` : ''}
        </div>
        <div class="cf-amount ${e.type}">${formatWon(e.amount)}</div>
        <div style="display:flex;gap:6px">
          <button class="btn-sm btn-outline" onclick="cashflow.openModal('${e.id}')">수정</button>
          <button class="btn-sm btn-danger" onclick="cashflow.remove('${e.id}')">삭제</button>
        </div>
      </div>
    `).join('')}</div>`;
  }

  function openForm(entryId) {
    const isEdit = !!entryId;
    const e = isEdit ? _entries.find(x => x.id === entryId) : null;

    const incomeItems = _qs.incomeCategories || [];
    const expenseItems = _qs.expenseCategories || [];

    const body = `
      <form class="entry-form" id="cf-form">
        <div class="form-grid">
          <div class="form-group">
            <label>날짜</label>
            <input type="date" name="date" value="${e?.date || _date}" required>
          </div>
          <div class="form-group">
            <label>유형</label>
            <select name="type" id="cf-type-select" onchange="cashflow._onTypeChange()">
              <option value="income" ${!e || e.type === 'income' ? 'selected' : ''}>💚 수입</option>
              <option value="expense" ${e?.type === 'expense' ? 'selected' : ''}>❤️ 지출</option>
            </select>
          </div>
        </div>
        <div class="form-group full">
          <label>카테고리 / 항목명</label>
          <div class="quick-chips" id="cf-cat-chips"></div>
          <input type="text" name="category" value="${e?.category || ''}" placeholder="예: 판매수입, 전기세, 포장재">
        </div>
        <div class="form-group">
          <label>금액 (원)</label>
          <input type="number" name="amount" value="${e?.amount || ''}" placeholder="0" min="0" step="100">
        </div>
        <div class="form-group full">
          <label>메모</label>
          <input type="text" name="notes" value="${e?.notes || ''}" placeholder="간단한 메모">
        </div>
      </form>
    `;

    const footer = `
      <button class="btn-outline" onclick="closeModal()">취소</button>
      <button class="btn-primary" onclick="cashflow.save('${entryId || ''}')">
        ${isEdit ? '수정 저장' : '추가'}
      </button>
    `;

    openModal(isEdit ? '수입/지출 수정' : '수입/지출 추가', body, footer); // global openModal (utils.js)

    function _renderCategoryChips() {
      const type = document.getElementById('cf-type-select').value;
      const items = type === 'income' ? incomeItems : expenseItems;
      const chipsEl = document.getElementById('cf-cat-chips');
      renderChips(chipsEl, items, val => {
        document.querySelector('#cf-form [name="category"]').value = val;
      });
    }
    _renderCategoryChips();
    window.cashflow._onTypeChange = _renderCategoryChips;
  }

  async function save(entryId) {
    const form = document.getElementById('cf-form');
    const isEdit = !!entryId;

    const type = form.querySelector('[name="type"]').value;
    const category = form.querySelector('[name="category"]').value.trim();
    const amount = Number(form.querySelector('[name="amount"]').value);

    if (!category) { showToast('항목명을 입력하세요', 'error'); return; }
    if (!amount) { showToast('금액을 입력하세요', 'error'); return; }

    const data = {
      date: form.querySelector('[name="date"]').value,
      type, category, amount,
      notes: form.querySelector('[name="notes"]').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!isEdit) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    // 카테고리 빠른선택 자동 저장
    const key = type === 'income' ? 'incomeCategories' : 'expenseCategories';
    const existing = _qs[key] || [];
    if (!existing.includes(category)) {
      const updated = [category, ...existing].slice(0, 15);
      _qs[key] = updated;
      saveQuickSelect({ [key]: updated });
    }

    try {
      if (isEdit) {
        await userCol('cashflowEntries').doc(entryId).update(data);
        showToast('수정되었습니다');
      } else {
        await userCol('cashflowEntries').add(data);
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
      await userCol('cashflowEntries').doc(entryId).delete();
      showToast('삭제되었습니다');
      await _fetch();
    } catch (e) {
      showToast('삭제 실패: ' + e.message, 'error');
    }
  }

  return { load, openModal: openForm, save, remove, _onTypeChange: () => {} };
})();
