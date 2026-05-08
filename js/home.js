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
      const isHol = holidays.isHoliday(dateStr);
      const noteText = holidays.getName(dateStr) || dateNotes.get(dateStr) || '';
      const dayBuses = _busEntries.filter(e => e.date === dateStr);
      const dayRes = _reservations.filter(r => r.date === dateStr);

      let dotsHTML = '';
      if (dayBuses.length > 0) {
        dotsHTML += `<div class="cal-res-dot home-bus-dot">🚌 ${dayBuses.length}대</div>`;
      }
      dayRes.slice(0, 2).forEach(r => {
        const label = [r.driverName, r.busCompany].filter(Boolean).join('/') || '예약';
        const tag = r.status === 'noshow' ? '<span class="res-dot-tag">✗미방문</span>'
                  : r.status === 'pending' ? '<span class="res-dot-tag">예약중</span>'
                  : '';
        dotsHTML += `<div class="cal-res-dot ${r.status}">${tag}${r.time ? r.time + ' ' : ''}${label}</div>`;
      });
      if (dayRes.length > 2) {
        dotsHTML += `<div class="cal-res-dot">+${dayRes.length - 2}건</div>`;
      }

      const dateRowHTML = `
        <div class="cal-date-row">
          <div class="cal-date">${day}</div>
          ${noteText ? `<span class="cal-note">${noteText}</span>` : ''}
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

    const dayBuses = _busEntries.filter(e => e.date === dateStr);
    const dayRes = _reservations.filter(r => r.date === dateStr);

    // 버스장부 카드 (실제 방문 기록)
    const busCards = dayBuses.map(e => `
      <div class="hd-card hd-bus">
        <div class="hd-card-status">✓ 방문완료</div>
        <div class="hd-card-main">${[e.busCompany, e.driverName].filter(Boolean).join(' · ') || '기사 미정'}</div>
        <div class="hd-card-meta">
          ${e.passengerCount ? `<span>👥 ${e.passengerCount}명</span>` : ''}
          ${e.salesAmount ? `<span>${formatWon(e.salesAmount)}</span>` : ''}
        </div>
      </div>
    `).join('');

    // 예약 카드 (상태별)
    const resCards = dayRes.map(r => {
      const cls = r.status === 'visited' ? 'hd-res-done'
                : r.status === 'noshow'  ? 'hd-noshow'
                : 'hd-pending';
      const lbl = r.status === 'visited' ? '방문완료'
                : r.status === 'noshow'  ? '✗ 미방문'
                : '📅 예약중';
      return `
        <div class="hd-card ${cls}">
          <div class="hd-card-status">${lbl}</div>
          ${r.time ? `<div class="hd-card-time">${r.time}</div>` : ''}
          <div class="hd-card-main">${[r.driverName, r.busCompany].filter(Boolean).join(' / ') || '기사 미정'}</div>
          <div class="hd-card-meta">
            ${r.estimatedPassengers ? `<span>👥 예상 ${r.estimatedPassengers}명</span>` : ''}
          </div>
          ${r.requests ? `<div class="hd-card-note">${r.requests}</div>` : ''}
        </div>
      `;
    }).join('');

    const allCards = busCards + resCards;
    document.getElementById('home-detail-content').innerHTML = allCards
      ? `<div class="hd-grid">${allCards}</div>`
      : '<p style="color:var(--text-light);font-size:14px">이날 기록이 없습니다.</p>';
  }

  function editNote(dateStr) {
    dateNotes.openEditor(dateStr, () => _renderCalendar());
  }

  return { load, selectDate, editNote };
})();
