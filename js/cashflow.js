// ===== 수입/지출 모듈 =====
const cashflow = (() => {
  let _date = getTodayStr();
  let _entries = [];
  let _qs = {};
  let _viewMode = 'day'; // 'day' | 'month'
  let _viewMonth = getMonthStr();

  async function load() {
    document.getElementById('cf-date').value = _date;

    document.getElementById('cf-date').onchange = e => {
      _date = e.target.value; _fetch();
    };
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

    document.getElementById('cf-prev-month').onclick = () => {
      _viewMonth = addMonths(_viewMonth, -1);
      _fetchMonth();
    };
    document.getElementById('cf-next-month').onclick = () => {
      _viewMonth = addMonths(_viewMonth, 1);
      _fetchMonth();
    };

    document.getElementById('cf-view-day-btn').onclick = () => _setView('day');
    document.getElementById('cf-view-month-btn').onclick = () => _setView('month');

    document.getElementById('btn-add-cf').onclick = () => {
      if (_viewMode === 'month') {
        const today = getTodayStr();
        _date = today.slice(0, 7) === _viewMonth ? today : _viewMonth + '-01';
        document.getElementById('cf-date').value = _date;
      }
      openForm(null);
    };

    _qs = await loadQuickSelect();
    await _fetch();
  }

  function _setView(mode) {
    _viewMode = mode;
    document.getElementById('cf-view-day-btn').classList.toggle('active', mode === 'day');
    document.getElementById('cf-view-month-btn').classList.toggle('active', mode === 'month');
    document.getElementById('cf-day-nav').classList.toggle('hidden', mode === 'month');
    document.getElementById('cf-month-nav').classList.toggle('hidden', mode === 'day');
    if (mode === 'day') {
      _fetch();
    } else {
      _viewMonth = _date.slice(0, 7);
      _fetchMonth();
    }
  }

  async function _fetch() {
    const list = document.getElementById('cashflow-list');
    list.innerHTML = '<p class="loading-msg">불러오는 중...</p>';
    try {
      const snap = await userCol('cashflowEntries')
        .where('date', '==', _date)
        .get();
      _entries = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
      _render();
    } catch (e) {
      list.innerHTML = `<p class="error-msg">오류: ${e.message}</p>`;
    }
  }

  async function _fetchMonth() {
    const [y, m] = _viewMonth.split('-');
    document.getElementById('cf-month-label').textContent = `${y}년 ${parseInt(m)}월`;

    const list = document.getElementById('cashflow-list');
    list.innerHTML = '<p class="loading-msg">불러오는 중...</p>';
    try {
      const snap = await userCol('cashflowEntries')
        .where('date', '>=', _viewMonth + '-01')
        .where('date', '<=', _viewMonth + '-31')
        .get();
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      let totalIncome = 0, totalExpense = 0;
      entries.forEach(e => {
        if (e.type === 'income') totalIncome += Number(e.amount) || 0;
        else totalExpense += Number(e.amount) || 0;
      });
      const balance = totalIncome - totalExpense;
      document.getElementById('cf-total-income').textContent = formatWon(totalIncome);
      document.getElementById('cf-total-expense').textContent = formatWon(totalExpense);
      const balEl = document.getElementById('cf-balance');
      balEl.textContent = formatWon(Math.abs(balance)) + (balance < 0 ? ' (적자)' : '');
      balEl.style.color = balance >= 0 ? 'var(--income)' : 'var(--expense)';

      if (entries.length === 0) {
        list.innerHTML = '<p class="empty-msg">이달 수입/지출 기록이 없습니다.</p>';
        return;
      }

      const byDate = {};
      entries.forEach(e => {
        if (!byDate[e.date]) byDate[e.date] = { income: 0, expense: 0, items: [] };
        byDate[e.date].items.push(e);
        if (e.type === 'income') byDate[e.date].income += Number(e.amount) || 0;
        else byDate[e.date].expense += Number(e.amount) || 0;
      });

      list.innerHTML = `<div class="entry-list">${Object.entries(byDate)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, data]) => {
          const net = data.income - data.expense;
          const itemsHTML = data.items.map(e => {
            const safeType = e.type === 'income' ? 'income' : 'expense';
            return `
            <div class="cf-month-entry">
              <span class="cf-type-badge type-${safeType}">${safeType === 'income' ? '수입' : '지출'}</span>
              <div class="cf-month-entry-info">
                <span class="cf-month-entry-cat">${escapeHTML(e.category || '')}</span>
                ${e.notes ? `<span class="cf-month-entry-memo">${escapeHTML(e.notes)}</span>` : ''}
              </div>
              <span class="cf-amount ${safeType}">${formatWon(e.amount)}</span>
            </div>
          `;
          }).join('');

          return `
            <div class="cf-month-day-card">
              <div class="cf-month-day-header" onclick="cashflow.switchToDay('${date}')">
                <span class="cf-month-day-date">${formatDateKo(date)}</span>
                <div class="cf-month-day-totals">
                  ${data.income > 0 ? `<span class="cf-month-chip income-chip">↑ ${formatWon(data.income)}</span>` : ''}
                  ${data.expense > 0 ? `<span class="cf-month-chip expense-chip">↓ ${formatWon(data.expense)}</span>` : ''}
                  <span class="cf-month-net ${net >= 0 ? 'net-pos' : 'net-neg'}">${net >= 0 ? '+' : ''}${formatWon(net)}</span>
                </div>
              </div>
              <div class="cf-month-entries">${itemsHTML}</div>
            </div>
          `;
        }).join('')}</div>`;
    } catch (e) {
      list.innerHTML = `<p class="error-msg">오류: ${e.message}</p>`;
    }
  }

  function switchToDay(date) {
    _date = date;
    document.getElementById('cf-date').value = date;
    _setView('day');
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

    list.innerHTML = `<div class="entry-list">${_entries.map(e => {
      const safeType = e.type === 'income' ? 'income' : 'expense';
      return `
      <div class="cf-entry-card">
        <span class="cf-type-badge type-${safeType}">${safeType === 'income' ? '수입' : '지출'}</span>
        <div class="cf-info">
          <div class="cf-category">${escapeHTML(e.category || '항목 미입력')}</div>
          ${e.notes ? `<div class="cf-memo-text">${escapeHTML(e.notes)}</div>` : ''}
        </div>
        <div class="cf-amount ${safeType}">${formatWon(e.amount)}</div>
        <div class="cf-entry-btns">
          <button class="btn-sm btn-outline" onclick="cashflow.openModal('${e.id}')">수정</button>
          <button class="btn-sm btn-danger" onclick="cashflow.remove('${e.id}')">삭제</button>
        </div>
      </div>
    `;
    }).join('')}</div>`;
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
          <input type="text" name="category" maxlength="50" value="${escapeAttr(e?.category || '')}" placeholder="예: 판매수입, 전기세, 포장재">
        </div>
        <div class="form-group">
          <label>금액 (원)</label>
          <input type="text" inputmode="numeric" name="amount" maxlength="15" value="${e?.amount ? Number(e.amount).toLocaleString('ko-KR') : ''}" placeholder="0">
        </div>
        <div class="form-group full">
          <label>메모</label>
          <input type="text" name="notes" maxlength="500" value="${escapeAttr(e?.notes || '')}" placeholder="간단한 메모">
        </div>
      </form>
    `;

    const footer = `
      <button class="btn-outline" onclick="closeModal()">취소</button>
      <button class="btn-primary" onclick="cashflow.save('${entryId || ''}')">
        ${isEdit ? '수정 저장' : '추가'}
      </button>
    `;

    openModal(isEdit ? '수입/지출 수정' : '수입/지출 추가', body, footer);

    initMoneyInput(document.querySelector('#cf-form [name="amount"]'));

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
    const amount = parseMoneyInput(form.querySelector('[name="amount"]').value);

    if (!category) { showToast('항목명을 입력하세요', 'error'); return; }
    if (!amount) { showToast('금액을 입력하세요', 'error'); return; }

    const data = {
      date: form.querySelector('[name="date"]').value,
      type, category, amount,
      notes: form.querySelector('[name="notes"]').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!isEdit) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

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
      if (_viewMode === 'month') {
        _viewMonth = data.date.slice(0, 7);
        await _fetchMonth();
      } else {
        _date = data.date;
        document.getElementById('cf-date').value = _date;
        await _fetch();
      }
    } catch (e) {
      showToast('저장 실패: ' + e.message, 'error');
    }
  }

  async function remove(entryId) {
    if (!await confirmDialog('이 기록을 삭제하시겠습니까?')) return;
    try {
      await userCol('cashflowEntries').doc(entryId).delete();
      showToast('삭제되었습니다');
      if (_viewMode === 'month') await _fetchMonth();
      else await _fetch();
    } catch (e) {
      showToast('삭제 실패: ' + e.message, 'error');
    }
  }

  return { load, openModal: openForm, save, remove, switchToDay, _onTypeChange: () => {} };
})();
