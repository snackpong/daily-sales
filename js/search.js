// ===== 검색 모듈 =====
const search = (() => {
  function init() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('btn-search');
    btn.onclick = () => _doSearch(input.value.trim());
    input.onkeydown = e => {
      if (e.key === 'Enter') _doSearch(input.value.trim());
    };
  }

  async function _doSearch(keyword) {
    if (!keyword) { showToast('검색어를 입력하세요', 'info'); return; }

    const resultsEl = document.getElementById('search-results');
    resultsEl.innerHTML = '<p class="loading-msg">검색 중...</p>';

    try {
      const kw = keyword.toLowerCase();
      const kwPhone = kw.replace(/-/g, '');

      const [busSnap, resSnap, purSnap, cfSnap] = await Promise.all([
        userCol('busEntries').orderBy('date', 'desc').get(),
        userCol('reservations').get(),
        userCol('purchaseEntries').get(),
        userCol('cashflowEntries').get()
      ]);

      const busEntries  = busSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const reservations = resSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const purchases   = purSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const cashflows   = cfSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      const matchedBus = busEntries.filter(e =>
        _m(e.busCompany, kw) || _m(e.driverName, kw) ||
        (e.phoneNumber || '').replace(/-/g, '').includes(kwPhone) ||
        _m(e.notes, kw) ||
        _bandMatch(e.bandIds, kw)
      );

      const matchedRes = reservations.filter(e =>
        _m(e.driverName, kw) || _m(e.busCompany, kw) ||
        (e.phoneNumber || '').replace(/-/g, '').includes(kwPhone) ||
        _m(e.requests, kw)
      );

      const matchedPur = purchases.filter(e =>
        _m(e.supplier, kw) ||
        (e.items || []).some(it => _m(it.name, kw))
      );

      const matchedCf = cashflows.filter(e =>
        _m(e.category, kw) || _m(e.notes, kw)
      );

      const total = matchedBus.length + matchedRes.length + matchedPur.length + matchedCf.length;

      if (total === 0) {
        resultsEl.innerHTML = `<p class="no-results">검색 결과가 없습니다.<br><small>"${escapeHTML(keyword)}"에 해당하는 기록을 찾지 못했습니다.</small></p>`;
        return;
      }

      let html = `<p class="search-total">총 <strong>${total}건</strong> 검색됨</p>`;

      if (matchedBus.length > 0) {
        html += _section('🚌 버스장부', matchedBus.length);
        html += matchedBus.map(_busCard).join('');
      }
      if (matchedRes.length > 0) {
        html += _section('📅 예약일정', matchedRes.length);
        html += matchedRes.map(_resCard).join('');
      }
      if (matchedPur.length > 0) {
        html += _section('📦 사입장부', matchedPur.length);
        html += matchedPur.map(_purCard).join('');
      }
      if (matchedCf.length > 0) {
        html += _section('💰 수입/지출', matchedCf.length);
        html += matchedCf.map(_cfCard).join('');
      }

      resultsEl.innerHTML = html;
    } catch (err) {
      resultsEl.innerHTML = `<p class="error-msg">검색 오류: ${escapeHTML(err.message)}</p>`;
    }
  }

  function _m(val, kw) { return (val || '').toLowerCase().includes(kw); }

  function _bandMatch(bandIds, kw) {
    if (!bandIds || !bandIds.length) return false;
    return bandIds.some(bid => {
      const b = bands.getById(bid);
      return b && b.name.toLowerCase().includes(kw);
    });
  }

  function _section(label, count) {
    return `<div class="search-section-header">${label}<span class="search-section-count">${count}건</span></div>`;
  }

  function _busCard(e) {
    const bandStr = (e.bandIds || []).map(bid => {
      const b = bands.getById(bid);
      return b ? b.name : '';
    }).filter(Boolean).join(', ');
    const cashSales = _readMoney(e, 'salesCash', 'salesAmount');
    const cardSales = _readMoney(e, 'salesCard');

    return `
      <div class="search-result-item">
        <div class="search-result-date">${formatDateKo(e.date)}</div>
        <div class="search-result-main">
          ${escapeHTML(e.busCompany || '')}${e.driverName ? ' · ' + escapeHTML(e.driverName) : ''}${e.phoneNumber ? ' · ' + phoneLink(e.phoneNumber) : ''}
        </div>
        <div class="search-result-detail">
          ${[cashSales ? '현금 ' + formatWon(cashSales) : '',
             cardSales ? '카드 ' + formatWon(cardSales) : '',
             e.commissionCash ? '커미션 ' + formatWon(e.commissionCash) : ''
          ].filter(Boolean).join(' · ')}
        </div>
        ${bandStr ? `<div class="search-result-detail">밴드: ${escapeHTML(bandStr)}</div>` : ''}
        ${e.notes ? `<div class="search-result-detail">📝 ${escapeHTML(e.notes)}</div>` : ''}
      </div>
    `;
  }

  function _readMoney(entry, ...fieldNames) {
    if (!entry) return 0;
    for (const fieldName of fieldNames) {
      const value = entry[fieldName];
      if (value !== undefined && value !== null) return Number(value) || 0;
    }
    return 0;
  }

  function _resCard(e) {
    const statusLabel = { pending: '예약중', visited: '방문완료', noshow: '미방문' };
    const statusClass = { pending: 'status-pending', visited: 'status-visited', noshow: 'status-noshow' };
    return `
      <div class="search-result-item">
        <div class="search-result-date" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${formatDateKo(e.date)}${e.time ? ' ' + escapeHTML(e.time) : ''}
          <span class="res-status-badge ${statusClass[e.status] || 'status-pending'}">${statusLabel[e.status] || '예약중'}</span>
        </div>
        <div class="search-result-main">
          ${escapeHTML(e.driverName || '')}${e.busCompany ? ' · ' + escapeHTML(e.busCompany) : ''}${e.phoneNumber ? ' · ' + phoneLink(e.phoneNumber) : ''}
        </div>
        ${e.estimatedPassengers ? `<div class="search-result-detail">예상 ${e.estimatedPassengers}명</div>` : ''}
        ${e.requests ? `<div class="search-result-detail">요청: ${escapeHTML(e.requests)}</div>` : ''}
      </div>
    `;
  }

  function _purCard(e) {
    const itemStr = (e.items || []).map(it => it.name).filter(Boolean).join(', ');
    return `
      <div class="search-result-item">
        <div class="search-result-date">${formatDateKo(e.date)}</div>
        <div class="search-result-main">${escapeHTML(e.supplier || '거래처 미입력')} · ${formatWon(e.totalAmount)}</div>
        ${itemStr ? `<div class="search-result-detail">품목: ${escapeHTML(itemStr)}</div>` : ''}
        ${e.notes ? `<div class="search-result-detail">📝 ${escapeHTML(e.notes)}</div>` : ''}
      </div>
    `;
  }

  function _cfCard(e) {
    const safeType = e.type === 'income' ? 'income' : 'expense';
    return `
      <div class="search-result-item">
        <div class="search-result-date">${formatDateKo(e.date)}</div>
        <div class="search-result-main" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="cf-type-badge type-${safeType}">${safeType === 'income' ? '수입' : '지출'}</span>
          <span>${escapeHTML(e.category || '')}</span>
          <span style="font-weight:700;color:${safeType === 'income' ? 'var(--income)' : 'var(--expense)'}">${formatWon(e.amount)}</span>
        </div>
        ${e.notes ? `<div class="search-result-detail">📝 ${escapeHTML(e.notes)}</div>` : ''}
      </div>
    `;
  }

  return { init };
})();
