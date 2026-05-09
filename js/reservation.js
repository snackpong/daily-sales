// ===== 예약/일정 모듈 =====
const reservation = (() => {
  let _year = new Date().getFullYear();
  let _month = new Date().getMonth(); // 0-indexed
  let _selectedDate = null;
  let _allReservations = [];

  const _PALETTE = [
    '#e74c3c', '#3498db', '#27ae60', '#f39c12',
    '#9b59b6', '#1abc9c', '#e67e22', '#2980b9',
  ];

  function _resColor(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
    return _PALETTE[h % _PALETTE.length];
  }

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
      openForm(_selectedDate || getTodayStr());
    };
  }

  async function _loadMonth() {
    const startDate = `${_year}-${String(_month + 1).padStart(2, '0')}-01`;
    const endDate = `${_year}-${String(_month + 1).padStart(2, '0')}-31`;
    try {
      const snap = await userCol('reservations')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
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
      const isHol = holidays.isHoliday(dateStr);
      const noteText = holidays.getName(dateStr) || dateNotes.get(dateStr) || '';
      const dayRes = _allReservations.filter(r => r.date === dateStr);

      const cntPending = dayRes.filter(r => !r.status || r.status === 'pending').length;
      const cntVisited = dayRes.filter(r => r.status === 'visited').length;
      const cntNoshow  = dayRes.filter(r => r.status === 'noshow').length;

      const dotGroup = (cls, cnt) => cnt > 0
        ? `<span class="cal-dot-group"><span class="cal-dot ${cls}"></span>${cnt > 1 ? `<span class="cal-dot-num">${cnt}</span>` : ''}</span>`
        : '';

      const dotHTML = (cntPending || cntVisited || cntNoshow)
        ? `<div class="cal-dots-row">${dotGroup('dot-pending', cntPending)}${dotGroup('dot-visited', cntVisited)}${dotGroup('dot-noshow', cntNoshow)}</div>`
        : '';

      const dateRowHTML = `
        <div class="cal-date-row">
          <div class="cal-date">${day}</div>
          ${noteText ? `<span class="cal-note">${noteText}</span>` : ''}
        </div>`;

      cellsHTML += `
        <div class="cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${isHol ? ' holiday' : ''}"
             onclick="reservation.selectDate('${dateStr}')">
          ${dateRowHTML}
          ${dotHTML}
          <button class="cal-note-btn" onclick="event.stopPropagation();reservation.editNote('${dateStr}')" title="메모">✎</button>
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

    listEl.innerHTML = dayRes.map(r => `
      <div class="res-item res-item-clickable" style="border-left: 4px solid ${_resColor(r.id)}" onclick="reservation.showDetail('${r.id}')">
        <div class="res-info">
          <div class="res-main">${r.time ? r.time + ' · ' : ''}${[r.driverName, r.busCompany].filter(Boolean).join(' / ') || '기사 미정'} ${r.estimatedPassengers ? r.estimatedPassengers + '명' : ''}</div>
          ${r.phoneNumber ? `<div class="res-sub">📞 ${phoneLink(r.phoneNumber)}</div>` : ''}
          ${r.requests ? `<div class="res-sub">${r.requests}</div>` : ''}
        </div>
        <div class="res-actions" onclick="event.stopPropagation()">
          <div class="res-status-group">
            <button class="res-status-btn${r.status === 'pending' ? ' active pending' : ''}" onclick="reservation.setStatus('${r.id}','pending')">예약중</button>
            <button class="res-status-btn${r.status === 'visited' ? ' active visited' : ''}" onclick="reservation.setStatus('${r.id}','visited')">방문완료</button>
            <button class="res-status-btn${r.status === 'noshow' ? ' active noshow' : ''}" onclick="reservation.setStatus('${r.id}','noshow')">미방문</button>
          </div>
          <button class="btn-sm btn-outline" onclick="reservation.openModal('${r.date}','${r.id}')">수정</button>
          <button class="btn-sm btn-danger" onclick="reservation.remove('${r.id}')">삭제</button>
        </div>
      </div>
    `).join('');

    listEl.innerHTML += `<button class="btn-outline btn-sm" style="margin-top:8px" onclick="reservation.openModal('${dateStr}')">+ 이날 예약 추가</button>`;
  }

  function openForm(dateStr, resId) {
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
            <label>기사명</label>
            <input type="text" name="driverName" value="${r?.driverName || ''}" placeholder="모를 경우 공란">
          </div>
          <div class="form-group">
            <label>버스회사</label>
            <input type="text" name="busCompany" value="${r?.busCompany || ''}" placeholder="예: 금화고속">
          </div>
          <div class="form-group">
            <label>기사 전화번호</label>
            <input type="tel" name="phoneNumber" value="${r?.phoneNumber || ''}" placeholder="010-0000-0000">
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

    openModal(isEdit ? '예약 수정' : '예약 추가', body, footer); // global openModal (utils.js)
  }

  async function save(resId) {
    const form = document.getElementById('res-form');
    const isEdit = !!resId;

    const data = {
      date: form.querySelector('[name="date"]').value,
      time: form.querySelector('[name="time"]').value,
      driverName: form.querySelector('[name="driverName"]').value.trim(),
      busCompany: form.querySelector('[name="busCompany"]').value.trim(),
      phoneNumber: form.querySelector('[name="phoneNumber"]').value.trim(),
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

  function showDetail(resId) {
    const r = _allReservations.find(x => x.id === resId);
    if (!r) return;

    const statusLabel = { pending: '예약중', visited: '방문완료', noshow: '미방문' };
    const statusColor = { pending: '#856404', visited: '#0a3622', noshow: '#383d41' };
    const statusBg = { pending: '#fff3cd', visited: '#d1e7dd', noshow: '#e2e3e5' };

    const rows = [
      ['날짜', formatDateKo(r.date)],
      ['시간', r.time || '-'],
      ['기사명', r.driverName || '-'],
      ['버스회사', r.busCompany || '-'],
      ['전화번호', r.phoneNumber ? phoneLink(r.phoneNumber) : '-'],
      ['예상 인원', r.estimatedPassengers ? r.estimatedPassengers + '명' : '-'],
      ['요청사항', r.requests || '-'],
    ];

    const body = `
      <div style="margin-bottom:14px">
        <span style="display:inline-block;padding:4px 14px;border-radius:12px;font-weight:700;font-size:14px;background:${statusBg[r.status]};color:${statusColor[r.status]}">
          ${statusLabel[r.status] || '예약중'}
        </span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${rows.map(([label, val]) => `
          <tr>
            <td style="padding:8px 12px;color:var(--text-light);font-weight:600;width:90px;border-bottom:1px solid var(--border)">${label}</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">${val}</td>
          </tr>
        `).join('')}
      </table>
    `;

    const footer = `
      <button class="btn-outline" onclick="closeModal()">닫기</button>
      <button class="btn-primary" onclick="closeModal();reservation.openModal('${r.date}','${r.id}')">수정</button>
    `;

    openModal('예약 상세', body, footer);
  }

  function editNote(dateStr) {
    dateNotes.openEditor(dateStr, () => _renderCalendar());
  }

  return { load, selectDate, openModal: openForm, save, setStatus, remove, showDetail, editNote };
})();
