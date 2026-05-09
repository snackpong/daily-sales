// ===== 홈 대시보드 모듈 =====
const home = (() => {
  let _year = new Date().getFullYear();
  let _month = new Date().getMonth();
  let _selectedDate = null;
  let _busEntries = [];
  let _reservations = [];
  let _cashflows = [];
  let _personalSales = [];
  let _dataChangeBound = false;

  async function load() {
    _year = new Date().getFullYear();
    _month = new Date().getMonth();
    _selectedDate = null;

    document.getElementById('home-prev-month').onclick = () => {
      _month--;
      if (_month < 0) { _month = 11; _year--; }
      _refresh();
    };
    document.getElementById('home-next-month').onclick = () => {
      _month++;
      if (_month > 11) { _month = 0; _year++; }
      _refresh();
    };

    if (!_dataChangeBound) {
      document.addEventListener('dailySales:dataChanged', () => {
        _refresh(!!_selectedDate);
      });
      _dataChangeBound = true;
    }

    await _refresh();
  }

  async function _refresh(keepSelected = false) {
    const selectedBeforeRefresh = keepSelected ? _selectedDate : null;
    document.getElementById('home-month-label').textContent = `${_year}년 ${_month + 1}월`;
    if (!keepSelected) {
      document.getElementById('home-day-detail').classList.add('hidden');
      _selectedDate = null;
    }

    const startDate = `${_year}-${String(_month + 1).padStart(2, '0')}-01`;
    const endDate = `${_year}-${String(_month + 1).padStart(2, '0')}-31`;

    async function _doFetch(source) {
      const opts = source ? { source } : undefined;
      const [busSnap, resSnap, cfSnap, psSnap] = await Promise.all([
        userCol('busEntries').where('date', '>=', startDate).where('date', '<=', endDate).get(opts),
        userCol('reservations').where('date', '>=', startDate).where('date', '<=', endDate).get(opts),
        userCol('cashflowEntries').where('date', '>=', startDate).where('date', '<=', endDate).get(opts),
        userCol('personalSales').where('date', '>=', startDate).where('date', '<=', endDate).get(opts),
      ]);
      _busEntries = busSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      _reservations = resSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      _cashflows = cfSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      _personalSales = psSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      _renderStats();
      if (selectedBeforeRefresh) _selectedDate = selectedBeforeRefresh;
      _renderCalendar();
      if (selectedBeforeRefresh) _showDayDetail(selectedBeforeRefresh);
    }

    // 캐시에서 즉시 렌더링
    try { await _doFetch('cache'); } catch (_) {}
    // 서버에서 최신 데이터로 갱신 (백그라운드)
    try { await _doFetch(); } catch (e) { console.error(e); }
  }

  function _renderStats() {
    const totalBuses = _busEntries.length;
    const totalRes = _reservations.length;
    const visitedRes = _reservations.filter(r => r.status === 'visited').length;
    const busSales = _busEntries.reduce((s, e) => s + _busTotalSales(e), 0);
    const personalSalesTotal = _personalSales.reduce((s, e) => s + _personalSalesTotal(e), 0);
    const grandSales = busSales + personalSalesTotal;
    const totalIncome = _cashflows.filter(c => c.type === 'income').reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const totalExpense = _cashflows.filter(c => c.type === 'expense').reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const balance = totalIncome - totalExpense;

    const bandCount = {};
    _busEntries.forEach(e => {
      (e.bandIds || []).forEach(bid => {
        bandCount[bid] = (bandCount[bid] || 0) + 1;
      });
    });

    const bandItems = Object.entries(bandCount)
      .map(([bid, count]) => {
        const b = bands.getById(bid);
        return b ? { name: b.name, count } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count);

    const bandHTML = bandItems.length > 0
      ? bandItems.map(b => {
          const logo = b.logoURL
            ? `<img src="${escapeAttr(b.logoURL)}" class="home-band-logo" alt="${escapeAttr(b.name)}">`
            : `<span class="home-band-initials">${escapeHTML(b.name.slice(0, 2))}</span>`;
          return `<span class="home-band-chip">${logo}${escapeHTML(b.name)} <strong>${b.count}대</strong></span>`;
        }).join('')
      : '<span style="color:var(--text-light);font-size:13px">이번달 밴드 기록 없음</span>';

    document.getElementById('home-stats').innerHTML = `
      <div class="home-stat-card">
        <div class="home-stat-label">이번달 버스</div>
        <div class="home-stat-value">${totalBuses}<span class="home-stat-unit">대</span></div>
      </div>
      <div class="home-stat-card">
        <div class="home-stat-label">이번달 예약</div>
        <div class="home-stat-value">${visitedRes}<span class="home-stat-unit">/${totalRes}건</span></div>
        <div class="home-stat-sub">방문완료 / 전체</div>
      </div>
      <div class="home-stat-card home-stat-cf">
        <div class="home-stat-label">이번달 수입/지출</div>
        <div class="home-cf-row">
          <div class="home-cf-item">
            <span class="home-cf-label">수입</span>
            <span class="home-cf-val income">${formatWon(totalIncome)}</span>
          </div>
          <div class="home-cf-item">
            <span class="home-cf-label">지출</span>
            <span class="home-cf-val expense">${formatWon(totalExpense)}</span>
          </div>
          <div class="home-cf-item">
            <span class="home-cf-label">잔액</span>
            <span class="home-cf-val ${balance >= 0 ? 'income' : 'expense'}">${formatWon(Math.abs(balance))}${balance < 0 ? ' 적자' : ''}</span>
          </div>
        </div>
      </div>
      <div class="home-stat-card home-stat-sales">
        <div class="home-stat-label">이번달 총매출</div>
        <div class="home-stat-value income">${formatWon(grandSales)}</div>
        <div class="home-sales-row">
          <span>버스매출 <strong>${formatWon(busSales)}</strong></span>
          <span>개인매출 <strong>${formatWon(personalSalesTotal)}</strong></span>
        </div>
      </div>
      <div class="home-stat-card home-stat-bands">
        <div class="home-stat-label">밴드별 버스</div>
        <div class="home-band-list">${bandHTML}</div>
      </div>
    `;
  }

  function _renderCalendar() {
    const cal = document.getElementById('home-calendar');
    const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
    const headerHTML = daysOfWeek.map(d => `<div class="cal-day-name">${d}</div>`).join('');

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
      const isToday = dateStr === today;
      const isSelected = dateStr === _selectedDate;
      const isHol = holidays.isHoliday(dateStr);
      const noteText = holidays.getName(dateStr) || dateNotes.get(dateStr) || '';
      const dayBuses = _busEntries.filter(e => e.date === dateStr);
      const dayRes = _reservations.filter(r => r.date === dateStr);

      const cntBus     = dayBuses.length;
      const cntPending = dayRes.filter(r => !r.status || r.status === 'pending').length;
      const cntVisited = dayRes.filter(r => r.status === 'visited').length;
      const cntNoshow  = dayRes.filter(r => r.status === 'noshow').length;

      const dotGroup = (cls, cnt) => cnt > 0
        ? `<span class="cal-dot-group"><span class="cal-dot ${cls}"></span>${cnt > 1 ? `<span class="cal-dot-num">${cnt}</span>` : ''}</span>`
        : '';

      const dotsHTML = (cntBus || cntPending || cntVisited || cntNoshow)
        ? `<div class="cal-dots-row">${dotGroup('dot-bus', cntBus)}${dotGroup('dot-pending', cntPending)}${dotGroup('dot-visited', cntVisited)}${dotGroup('dot-noshow', cntNoshow)}</div>`
        : '';

      const dateRowHTML = `
        <div class="cal-date-row">
          <div class="cal-date">${day}</div>
          ${noteText ? `<span class="cal-note">${escapeHTML(noteText)}</span>` : ''}
        </div>`;

      cellsHTML += `
        <div class="cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${isHol ? ' holiday' : ''}"
             onclick="home.selectDate('${dateStr}')">
          ${dateRowHTML}
          ${dotsHTML}
          <button class="cal-note-btn" onclick="event.stopPropagation();home.editNote('${dateStr}')" title="메모">✎</button>
        </div>`;
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

  function selectDate(dateStr) {
    _selectedDate = dateStr;
    _renderCalendar();
    _showDayDetail(dateStr);
  }

  function _showDayDetail(dateStr) {
    const detail = document.getElementById('home-day-detail');
    detail.classList.remove('hidden');
    document.getElementById('home-detail-date').textContent = formatDateKo(dateStr);

    const dayBuses = _busEntries
      .filter(e => e.date === dateStr)
      .sort((a, b) => (a.daySequence || 0) - (b.daySequence || 0));
    const dayRes = _reservations.filter(r => r.date === dateStr);

    // 버스장부 카드 (실제 방문 기록)
    const busCards = dayBuses.map(e => {
      const totalSales = _busTotalSales(e);
      return `
        <div class="hd-card hd-bus hd-card-clickable" onclick="home.showBusDetail('${escapeInlineJS(e.id)}')">
          <div class="hd-card-status">✓ 방문완료</div>
          <div class="hd-card-main">${escapeHTML([e.busCompany, e.driverName].filter(Boolean).join(' · ') || '기사 미정')}</div>
          ${_bandChipsHTML(e.bandIds, 'hd-band-row')}
          <div class="hd-card-meta">
            ${totalSales ? `<span>${formatWon(totalSales)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // 예약 카드 (상태별)
    const resCards = dayRes.map(r => {
      const cls = r.status === 'visited' ? 'hd-res-done'
                : r.status === 'noshow'  ? 'hd-noshow'
                : 'hd-pending';
      const lbl = r.status === 'visited' ? '방문완료'
                : r.status === 'noshow'  ? '✗ 미방문'
                : '📅 예약중';
      return `
        <div class="hd-card ${cls} hd-card-clickable" onclick="home.showReservationDetail('${escapeInlineJS(r.id)}')">
          <div class="hd-card-status">${lbl}</div>
          ${r.time ? `<div class="hd-card-time">${escapeHTML(r.time)}</div>` : ''}
          <div class="hd-card-main">${escapeHTML([r.driverName, r.busCompany].filter(Boolean).join(' / ') || '기사 미정')}</div>
          <div class="hd-card-meta">
            ${r.estimatedPassengers ? `<span>👥 예상 ${r.estimatedPassengers}명</span>` : ''}
          </div>
          ${r.requests ? `<div class="hd-card-note">${escapeHTML(r.requests)}</div>` : ''}
        </div>
      `;
    }).join('');

    const allCards = busCards + resCards;
    document.getElementById('home-detail-content').innerHTML = allCards
      ? `<div class="hd-grid">${allCards}</div>`
      : '<p style="color:var(--text-light);font-size:14px">이날 기록이 없습니다.</p>';
  }

  function _bandChipsHTML(bandIds, className = '') {
    if (!bandIds || bandIds.length === 0) return '';
    const chips = bandIds.map(bid => {
      const b = bands.getById(bid);
      if (!b) return '';
      const mark = b.logoURL
        ? `<img src="${escapeAttr(b.logoURL)}" class="hd-band-logo" alt="${escapeAttr(b.name)}">`
        : `<span class="hd-band-initials">${escapeHTML(b.name.slice(0, 2))}</span>`;
      return `<span class="hd-band-chip">${mark}<span>${escapeHTML(b.name)}</span></span>`;
    }).filter(Boolean).join('');
    return chips ? `<div class="${className}">${chips}</div>` : '';
  }

  function _detailRowsHTML(rows) {
    return `
      <table class="home-detail-table">
        ${rows.map(([label, val]) => `
          <tr>
            <td>${escapeHTML(label)}</td>
            <td>${val || '-'}</td>
          </tr>
        `).join('')}
      </table>
    `;
  }

  function _busCardSales(entry) {
    return _readMoney(entry, 'salesCard', 'cardSalesAmount');
  }

  function _busCashSales(entry) {
    return _readMoney(entry, 'salesCash', 'cashSalesAmount', 'salesAmount');
  }

  function _busTotalSales(entry) {
    return _busCashSales(entry) + _busCardSales(entry);
  }

  function _readMoney(entry, ...fieldNames) {
    if (!entry) return 0;
    for (const fieldName of fieldNames) {
      const value = entry[fieldName];
      if (value !== undefined && value !== null) return Number(value) || 0;
    }
    return 0;
  }

  function _personalSalesTotal(entry) {
    return (Number(entry?.cash) || 0) + (Number(entry?.card) || 0) + (Number(entry?.total) || 0);
  }

  function showBusDetail(entryId) {
    const e = _busEntries.find(x => x.id === entryId);
    if (!e) return;

    const photoURLs = e.photoURLs || (e.photoURL ? [e.photoURL] : []);
    const photoHTML = photoURLs.length > 0
      ? `<div class="home-detail-photos">${photoURLs.slice(0, 4).map(url =>
          `<img src="${escapeAttr(url)}" alt="버스 사진" onclick="busLedger.viewPhoto('${escapeInlineJS(url)}')">`
        ).join('')}</div>`
      : '';

    const body = `
      ${_bandChipsHTML(e.bandIds, 'home-detail-bands')}
      ${_detailRowsHTML([
        ['날짜', formatDateKo(e.date)],
        ['버스회사', escapeHTML(e.busCompany || '-')],
        ['기사명', escapeHTML(e.driverName || '-')],
        ['전화번호', e.phoneNumber ? phoneLink(e.phoneNumber) : '-'],
        ['현금매출', _busCashSales(e) ? formatWon(_busCashSales(e)) : '-'],
        ['카드매출', _busCardSales(e) ? formatWon(_busCardSales(e)) : '-'],
        ['커미션 현금', e.commissionCash ? formatWon(e.commissionCash) : '-'],
        ['커미션 물건', escapeHTML(e.commissionGoods || '-')],
        ['메모', escapeHTML(e.notes || '-')],
      ])}
      ${photoHTML}
    `;

    openModal('버스 방문 상세', body, `
      <button class="btn-outline" onclick="closeModal()">닫기</button>
      <button class="btn-primary" onclick="home.editBusFromDetail('${escapeInlineJS(entryId)}')">수정</button>
      <button class="btn-danger" onclick="home.deleteBusFromDetail('${escapeInlineJS(entryId)}')">삭제</button>
    `);
  }

  function showReservationDetail(resId) {
    const r = _reservations.find(x => x.id === resId);
    if (!r) return;

    const statusLabel = { pending: '예약중', visited: '방문완료', noshow: '미방문' };
    const status = r.status || 'pending';
    const body = `
      <div class="home-detail-status status-${escapeAttr(status)}">${statusLabel[status] || '예약중'}</div>
      ${_detailRowsHTML([
        ['날짜', formatDateKo(r.date)],
        ['시간', escapeHTML(r.time || '-')],
        ['기사명', escapeHTML(r.driverName || '-')],
        ['버스회사', escapeHTML(r.busCompany || '-')],
        ['전화번호', r.phoneNumber ? phoneLink(r.phoneNumber) : '-'],
        ['예상 인원', r.estimatedPassengers ? `${Number(r.estimatedPassengers)}명` : '-'],
        ['요청사항', escapeHTML(r.requests || '-')],
      ])}
    `;

    openModal('예약 상세', body, `
      <button class="btn-outline" onclick="closeModal()">닫기</button>
      <button class="btn-primary" onclick="home.editReservationFromDetail('${escapeInlineJS(resId)}')">수정</button>
      <button class="btn-danger" onclick="home.deleteReservationFromDetail('${escapeInlineJS(resId)}')">삭제</button>
    `);
  }

  async function editBusFromDetail(entryId) {
    closeModal();
    await busLedger.openEntryModal(entryId);
  }

  async function deleteBusFromDetail(entryId) {
    const deleted = await busLedger.remove(entryId);
    if (deleted) {
      const dateStr = _selectedDate;
      _busEntries = _busEntries.filter(e => e.id !== entryId);
      closeModal();
      _renderStats();
      _renderCalendar();
      if (dateStr) _showDayDetail(dateStr);
    }
  }

  async function editReservationFromDetail(resId) {
    closeModal();
    await reservation.openModal(resId);
  }

  async function deleteReservationFromDetail(resId) {
    const deleted = await reservation.remove(resId);
    if (deleted) {
      const dateStr = _selectedDate;
      _reservations = _reservations.filter(r => r.id !== resId);
      closeModal();
      _renderStats();
      _renderCalendar();
      if (dateStr) _showDayDetail(dateStr);
    }
  }

  function editNote(dateStr) {
    dateNotes.openEditor(dateStr, () => _renderCalendar());
  }

  return {
    load, selectDate, editNote, showBusDetail, showReservationDetail,
    editBusFromDetail, deleteBusFromDetail,
    editReservationFromDetail, deleteReservationFromDetail
  };
})();
