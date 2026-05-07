// ===== 예약/일정 모듈 =====
const reservation = (() => {
  let _year = new Date().getFullYear();
  let _month = new Date().getMonth(); // 0-indexed
  let _selectedDate = null;
  let _allReservations = [];

  function load() {
    _renderCalendar();
    _loadMonth();
    document.getElementById('res-month-label').textContent = `${_year}년 ${_month + 1}월`;

    document.getElementById('res-prev-month').onclick = () => {
      _month--;
      if (_month < 0) { _month = 11; _year--; }
      load();
    };
    document.getElementById('res-next-month').onclick = () => {
      _month++;
      if (_month > 11) { _month = 0; _year++; }
      load();
    };
    document.getElementById('btn-add-reservation').onclick = () => {
      openModal(_selectedDate || getTodayStr());
    };
  }

  async function _loadMonth() {
    const startDate = `${_year}-${String(_month + 1).padStart(2, '0')}-01`;
    const endDate = `${_year}-${String(_month + 1).padStart(2, '0')}-31`;
    try {
      const snap = await userCol('reservations')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .orderBy('date')
        .get();
      _allReservations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _renderCalendar();
    } catch (e) {
      console.error(e);
    }
  }

  function _renderCalendar() {
    const cal = document.getElementById('res-calendar');
    const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
    const headerHTML = daysOfWeek.map(d =>
      `<div class="cal-day-name">${d}</div>`).join('');

    const firstDay = new Date(_year, _month, 1);
    const lastDay = new Date(_year, _month + 1, 0);
    const startWeekday = firstDay.getDay();
    const today = getTodayStr();

    let cellsHTML = '';

    // 이전달 날짜
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(_year, _month, -(startWeekday - i - 1));
      cellsHTML += `<div class="cal-cell other-month"><div class="cal-date">${d.getDate()}</div></div>`;
    }

    // 이번달 날짜
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${_year}-${String(_month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === today;
      const isSelected = dateStr === _selectedDate;
      const dayRes = _allReservations.filter(r => r.date === dateStr);

      const dotHTML = dayRes.slice(0, 3).map(r =>
        `<div class="cal-res-dot ${r.status}" title="${r.driverName || r.busCompany || '예약'}">${r.time || ''} ${r.driverName || r.busCompany || '예약'}</div>`
      ).join('');

      cellsHTML += `
        <div class="cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}"
             onclick="reservation.selectDate('${dateStr}')">
          <div class="cal-date">${day}</div>
          ${dotHTML}
          ${dayRes.length > 3 ? `<div class="cal-res-dot">+${dayRes.length - 3}건</div>` : ''}
        </div>`;
    }

    // 다음달 채우기 (6주 고정)
    const totalCells = startWeekday + lastDay.getDate();
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cellsHTML += `<div class="cal-cell other-month"><div class="cal-date">${i}</div></div>`;
    }

    cal.innerHTML = `
      <div class="calendar-header">${headerHTML}</div>
      <div class="calendar-body">${cellsHTML}</div>
    `;

    document.getElementById('res-month-label').textContent = `${_year}년 ${_month + 1}월`;
  }

  function selectDate(dateStr) {
    _selectedDate = dateStr;
    _renderCalendar();
    _showDayDetail(dateStr);
  }

  function _showDayDetail(dateStr) {
    const detail = document.getElementById('res-day-detail');
    detail.classList.remove('hidden');
    document.getElementById('res-detail-date').textContent = formatDateKo(dateStr) + ' 예약 목록';

    const dayRes = _allReservations.filter(r => r.date === dateStr);
    const listEl = document.getElementById('res-detail-list');

    if (dayRes.length === 0) {
      listEl.innerHTML = `
        <p style="color:var(--text-light);font-size:14px;margin-bottom:12px">이날 예약이 없습니다.</p>
        <button class="btn-primary btn-sm" onclick="reservation.openModal('${dateStr}')">+ 이날 예약 추가</button>
      `;
      return;
    }

    const statusLabel = { pending: '예약중', visited: '방문완료', noshow: '미방문' };
    listEl.innerHTML = dayRes.map(r => `
      <div class="res-item">
        <span class="res-status-badge status-${r.status}">${statusLabel[r.status] || '예약중'}</span>
        <div class="res-info">
          <div class="res-main">${r.time ? r.time + ' · ' : ''}${r.driverName || r.busCompany || '기사 미정'} ${r.estimatedPassengers ? r.estimatedPassengers + '명' : ''}</div>
          ${r.requests ? `<div class="res-sub">${r.requests}</div>` : ''}
        </div>
        <div class="res-actions">
          ${r.status === 'pending' ? `
            <button class="btn-sm btn-success" onclick="reservation.setStatus('${r.id}','visited')">방문✓</button>
            <button class="btn-sm btn-outline" onclick="reservation.setStatus('${r.id}','noshow')">미방문</button>
          ` : ''}
          <button class="btn-sm btn-outline" onclick="reservation.openModal('${r.date}','${r.id}')">수정</button>
          <button class="btn-sm btn-danger" onclick="reservation.remove('${r.id}')">삭제</button>
        </div>
      </div>
    `).join('');

    listEl.innerHTML += `<button class="btn-outline btn-sm" style="margin-top:8px" onclick="reservation.openModal('${dateStr}')">+ 이날 예약 추가</button>`;
  }

  function openModal(dateStr, resId) {
    const isEdit = !!resId;
    const r = isEdit ? _allReservations.find(x => x.id === resId) : null;

    const body = `
      <form class="entry-form" id="res-form">
        <div class="form-grid">
          <div class="form-group">
            <label>예약 날짜 *</label>
            <input type="date" name="date" value="${r?.date || dateStr || getTodayStr()}" required>
          </div>
          <div class="form-group">
            <label>예정 도착 시간</label>
            <input type="time" name="time" value="${r?.time || ''}">
          </div>
          <div class="form-group">
            <label>기사명 / 버스회사</label>
            <input type="text" name="driverName" value="${r?.driverName || ''}" placeholder="모를 경우 공란">
          </div>
          <div class="form-group">
            <label>버스회사</label>
            <input type="text" name="busCompany" value="${r?.busCompany || ''}" placeholder="예: 금화고속">
          </div>
          <div class="form-group">
            <label>예상 손님 수 (명)</label>
            <input type="number" name="estimatedPassengers" value="${r?.estimatedPassengers || ''}" placeholder="0" min="0">
          </div>
          <div class="form-group">
            <label>상태</label>
            <select name="status">
              <option value="pending" ${!r || r.status === 'pending' ? 'selected' : ''}>예약중</option>
              <option value="visited" ${r?.status === 'visited' ? 'selected' : ''}>방문완료</option>
              <option value="noshow" ${r?.status === 'noshow' ? 'selected' : ''}>미방문</option>
            </select>
          </div>
        </div>
        <div class="form-group full">
          <label>특이사항 / 요청 내용</label>
          <textarea name="requests" placeholder="밥집 추천, 숙소, 관광지, 주차 요청 등">${r?.requests || ''}</textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn-outline" onclick="closeModal()">취소</button>
      <button class="btn-primary" onclick="reservation.save('${resId || ''}')">
        ${isEdit ? '수정 저장' : '예약 추가'}
      </button>
    `;

    openModal(isEdit ? '예약 수정' : '예약 추가', body, footer);
  }

  async function save(resId) {
    const form = document.getElementById('res-form');
    const isEdit = !!resId;

    const data = {
      date: form.querySelector('[name="date"]').value,
      time: form.querySelector('[name="time"]').value,
      driverName: form.querySelector('[name="driverName"]').value.trim(),
      busCompany: form.querySelector('[name="busCompany"]').value.trim(),
      estimatedPassengers: Number(form.querySelector('[name="estimatedPassengers"]').value) || 0,
      status: form.querySelector('[name="status"]').value,
      requests: form.querySelector('[name="requests"]').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.date) { showToast('날짜를 선택하세요', 'error'); return; }
    if (!isEdit) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    try {
      if (isEdit) {
        await userCol('reservations').doc(resId).update(data);
        showToast('수정되었습니다');
      } else {
        await userCol('reservations').add(data);
        showToast('예약이 추가되었습니다');
      }
      closeModal();
      _selectedDate = data.date;
      await _loadMonth();
      _showDayDetail(data.date);
    } catch (e) {
      showToast('저장 실패: ' + e.message, 'error');
    }
  }

  async function setStatus(resId, status) {
    try {
      await userCol('reservations').doc(resId).update({ status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      showToast(status === 'visited' ? '방문완료로 변경되었습니다' : '미방문으로 변경되었습니다');
      await _loadMonth();
      if (_selectedDate) _showDayDetail(_selectedDate);
    } catch (e) {
      showToast('변경 실패: ' + e.message, 'error');
    }
  }

  async function remove(resId) {
    if (!await confirmDialog('이 예약을 삭제하시겠습니까?')) return;
    try {
      await userCol('reservations').doc(resId).delete();
      showToast('삭제되었습니다');
      await _loadMonth();
      if (_selectedDate) _showDayDetail(_selectedDate);
    } catch (e) {
      showToast('삭제 실패: ' + e.message, 'error');
    }
  }

  return { load, selectDate, openModal, save, setStatus, remove };
})();
