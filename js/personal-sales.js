// ===== 개인매출 모듈 =====
const personalSales = (() => {
  let _year = new Date().getFullYear();
  let _month = new Date().getMonth();
  let _entries = [];
  let _bound = false;

  async function load() {
    if (!_bound) {
      document.getElementById('ps-prev-month').onclick = () => {
        _month--;
        if (_month < 0) { _month = 11; _year--; }
        _refresh();
      };
      document.getElementById('ps-next-month').onclick = () => {
        _month++;
        if (_month > 11) { _month = 0; _year++; }
        _refresh();
      };
      _bound = true;
    }

    await _refresh();
  }

  async function _refresh() {
    document.getElementById('ps-month-label').textContent = `${_year}년 ${_month + 1}월`;
    const startDate = `${_year}-${String(_month + 1).padStart(2, '0')}-01`;
    const endDate = `${_year}-${String(_month + 1).padStart(2, '0')}-31`;

    async function _doFetch(source) {
      const opts = source ? { source } : undefined;
      const snap = await userCol('personalSales')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get(opts);
      _entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _renderSummary();
      _renderCalendar();
    }

    try { await _doFetch('cache'); } catch (_) {}
    try { await _doFetch(); } catch (e) {
      console.error(e);
      showToast('개인매출 불러오기 실패: ' + e.message, 'error');
    }
  }

  function _entryTotal(entry) {
    return (Number(entry?.cash) || 0) + (Number(entry?.card) || 0) + (Number(entry?.total) || 0);
  }

  function _renderSummary() {
    const cash = _entries.reduce((sum, entry) => sum + (Number(entry.cash) || 0), 0);
    const card = _entries.reduce((sum, entry) => sum + (Number(entry.card) || 0), 0);
    const totalOnly = _entries.reduce((sum, entry) => sum + (Number(entry.total) || 0), 0);
    const all = cash + card + totalOnly;

    document.getElementById('ps-summary').innerHTML = `
      <div class="ps-summary-card">
        <span>현금 합계</span>
        <strong>${formatWon(cash)}</strong>
      </div>
      <div class="ps-summary-card">
        <span>카드 합계</span>
        <strong>${formatWon(card)}</strong>
      </div>
      <div class="ps-summary-card">
        <span>매출 합계</span>
        <strong>${formatWon(totalOnly)}</strong>
      </div>
      <div class="ps-summary-card ps-summary-total">
        <span>전체 합계</span>
        <strong>${formatWon(all)}</strong>
      </div>
    `;
  }

  function _renderCalendar() {
    const cal = document.getElementById('ps-calendar');
    const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
    const headerHTML = daysOfWeek.map(day => `<div class="cal-day-name">${day}</div>`).join('');

    const firstDay = new Date(_year, _month, 1);
    const lastDay = new Date(_year, _month + 1, 0);
    const startWeekday = firstDay.getDay();
    const today = getTodayStr();
    let cellsHTML = '';

    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(_year, _month, -(startWeekday - i - 1));
      cellsHTML += `<div class="cal-cell other-month"><div class="cal-date">${d.getDate()}</div></div>`;
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${_year}-${String(_month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const entry = _entries.find(item => item.date === dateStr);
      const amount = _entryTotal(entry);
      const isToday = dateStr === today;

      cellsHTML += `
        <div class="cal-cell ps-cell${isToday ? ' today' : ''}" onclick="personalSales.openModal('${dateStr}')">
          <div class="cal-date-row">
            <div class="cal-date">${day}</div>
          </div>
          ${amount ? `<div class="ps-day-amount">${formatWon(amount)}</div>` : ''}
        </div>
      `;
    }

    const totalCells = startWeekday + lastDay.getDate();
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cellsHTML += `<div class="cal-cell other-month"><div class="cal-date">${i}</div></div>`;
    }

    cal.innerHTML = `
      <div class="calendar-header">${headerHTML}</div>
      <div class="calendar-body">${cellsHTML}</div>
    `;
  }

  function openForm(dateStr) {
    const entry = _entries.find(item => item.date === dateStr) || null;
    const body = `
      <form class="entry-form" id="ps-form">
        <div class="form-group">
          <label>날짜</label>
          <input type="date" name="date" value="${escapeAttr(dateStr)}" required>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>현금 매출</label>
            <input type="text" inputmode="numeric" name="cash" value="${entry?.cash ? Number(entry.cash).toLocaleString('ko-KR') : ''}" placeholder="0">
          </div>
          <div class="form-group">
            <label>카드 매출</label>
            <input type="text" inputmode="numeric" name="card" value="${entry?.card ? Number(entry.card).toLocaleString('ko-KR') : ''}" placeholder="0">
          </div>
          <div class="form-group">
            <label>매출</label>
            <input type="text" inputmode="numeric" name="total" value="${entry?.total ? Number(entry.total).toLocaleString('ko-KR') : ''}" placeholder="0">
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn-outline" onclick="closeModal()">닫기</button>
      ${entry ? `<button class="btn-danger" onclick="personalSales.remove('${escapeInlineJS(entry.id)}')">삭제</button>` : ''}
      <button class="btn-primary" onclick="personalSales.save('${escapeInlineJS(entry?.id || '')}')">저장</button>
    `;

    openModal('개인매출 입력', body, footer);
    initMoneyInput(document.querySelector('#ps-form [name="cash"]'));
    initMoneyInput(document.querySelector('#ps-form [name="card"]'));
    initMoneyInput(document.querySelector('#ps-form [name="total"]'));
  }

  async function save(entryId) {
    const form = document.getElementById('ps-form');
    const date = form.querySelector('[name="date"]').value;
    if (!date) { showToast('날짜를 선택하세요', 'error'); return; }

    const data = {
      date,
      cash: parseMoneyInput(form.querySelector('[name="cash"]').value),
      card: parseMoneyInput(form.querySelector('[name="card"]').value),
      total: parseMoneyInput(form.querySelector('[name="total"]').value),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      if (entryId) {
        await userCol('personalSales').doc(entryId).set(data, { merge: true });
      } else {
        const existing = _entries.find(entry => entry.date === date);
        const docId = existing?.id || date;
        await userCol('personalSales').doc(docId).set(data, { merge: true });
      }
      showToast('개인매출이 저장되었습니다');
      closeModal();
      await _refresh();
      document.dispatchEvent(new CustomEvent('dailySales:dataChanged', {
        detail: { type: 'personalSales', date }
      }));
    } catch (e) {
      showToast('저장 실패: ' + e.message, 'error');
    }
  }

  async function remove(entryId) {
    if (!entryId) return;
    if (!await confirmDialog('이 개인매출 기록을 삭제하시겠습니까?')) return;

    const target = _entries.find(entry => entry.id === entryId);
    try {
      await userCol('personalSales').doc(entryId).delete();
      showToast('삭제되었습니다');
      closeModal();
      await _refresh();
      document.dispatchEvent(new CustomEvent('dailySales:dataChanged', {
        detail: { type: 'personalSales', date: target?.date }
      }));
    } catch (e) {
      showToast('삭제 실패: ' + e.message, 'error');
    }
  }

  return { load, openModal: openForm, save, remove };
})();
