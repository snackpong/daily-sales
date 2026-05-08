// ===== 홈 대시보드 모듈 =====
const home = (() => {
  let _year = new Date().getFullYear();
  let _month = new Date().getMonth();
  let _selectedDate = null;
  let _busEntries = [];
  let _reservations = [];
  let _cashflows = [];

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

    await _refresh();
  }

  async function _refresh() {
    document.getElementById('home-month-label').textContent = `${_year}년 ${_month + 1}월`;
    document.getElementById('home-day-detail').classList.add('hidden');
    _selectedDate = null;

    const startDate = `${_year}-${String(_month + 1).padStart(2, '0')}-01`;
    const endDate = `${_year}-${String(_month + 1).padStart(2, '0')}-31`;

    try {
      const [busSnap, resSnap, cfSnap] = await Promise.all([
        userCol('busEntries').where('date', '>=', startDate).where('date', '<=', endDate).get(),
        userCol('reservations').where('date', '>=', startDate).where('date', '<=', endDate).get(),
        userCol('cashflowEntries').where('date', '>=', startDate).where('date', '<=', endDate).get()
      ]);
      _busEntries = busSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      _reservations = resSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      _cashflows = cfSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      _renderStats();
      _renderCalendar();
    } catch (e) {
      console.error(e);
    }
  }

  function _renderStats() {
    const totalBuses = _busEntries.length;
    const totalRes = _reservations.length;
    const visitedRes = _reservations.filter(r => r.status === 'visited').length;
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
            ? `<img src="${b.logoURL}" class="home-band-logo" alt="${b.name}">`
            : `<span class="home-band-initials">${b.name.slice(0, 2)}</span>`;
          return `<span class="home-band-chip">${logo}${b.name} <strong>${b.count}대</strong></span>`;
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
      const dayBuses = _busEntries.filter(e => e.date === dateStr);
      const dayRes = _reservations.filter(r => r.date === dateStr);

      let dotsHTML = '';
      if (dayBuses.length > 0) {
        dotsHTML += `<div class="cal-res-dot home-bus-dot">🚌 ${dayBuses.length}대</div>`;
      }
      dayRes.slice(0, 2).forEach(r => {
        const label = [r.driverName, r.busCompany].filter(Boolean).join('/') || '예약';
        dotsHTML += `<div class="cal-res-dot ${r.status}">${r.time ? r.time + ' ' : ''}${label}</div>`;
      });
      if (dayRes.length > 2) {
        dotsHTML += `<div class="cal-res-dot">+${dayRes.length - 2}건</div>`;
      }

      cellsHTML += `
        <div class="cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}"
             onclick="home.selectDate('${dateStr}')">
          <div class="cal-date">${day}</div>
          ${dotsHTML}
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

    const dayBuses = _busEntries.filter(e => e.date === dateStr);
    const dayRes = _reservations.filter(r => r.date === dateStr);
    const statusLabel = { pending: '예약중', visited: '방문완료', noshow: '미방문' };

    const busHTML = dayBuses.length > 0
      ? `<div class="home-detail-section">
          <div class="home-detail-title">🚌 버스 (${dayBuses.length}대)</div>
          ${dayBuses.map(e => `
            <div class="home-detail-item">
              <span>${[e.busCompany, e.driverName].filter(Boolean).join(' · ') || '기사 미정'}</span>
              ${e.passengerCount ? `<span class="home-detail-badge">${e.passengerCount}명</span>` : ''}
            </div>
          `).join('')}
        </div>` : '';

    const resHTML = dayRes.length > 0
      ? `<div class="home-detail-section">
          <div class="home-detail-title">📅 예약 (${dayRes.length}건)</div>
          ${dayRes.map(r => `
            <div class="home-detail-item">
              <span>${r.time ? r.time + ' · ' : ''}${[r.driverName, r.busCompany].filter(Boolean).join('/') || '기사 미정'}</span>
              <span class="home-res-badge ${r.status}">${statusLabel[r.status] || '예약중'}</span>
            </div>
          `).join('')}
        </div>` : '';

    document.getElementById('home-detail-content').innerHTML =
      (busHTML + resHTML) || '<p style="color:var(--text-light);font-size:14px">이날 기록이 없습니다.</p>';
  }

  return { load, selectDate };
})();
