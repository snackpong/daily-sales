// ===== 검색 모듈 =====
const search = (() => {
  function init() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('btn-search');

    btn.onclick = () => _doSearch(input.value.trim());
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') _doSearch(input.value.trim());
    });
  }

  async function _doSearch(keyword) {
    if (!keyword) { showToast('검색어를 입력하세요', 'info'); return; }

    const resultsEl = document.getElementById('search-results');
    resultsEl.innerHTML = '<p class="loading-msg">검색 중...</p>';

    try {
      // 버스 기사 장부 전체 로드 후 클라이언트에서 필터링
      const snap = await userCol('busEntries').orderBy('date', 'desc').get();
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const kw = keyword.toLowerCase();
      const matched = all.filter(e =>
        (e.busCompany || '').toLowerCase().includes(kw) ||
        (e.driverName || '').toLowerCase().includes(kw) ||
        (e.phoneNumber || '').replace(/-/g, '').includes(kw.replace(/-/g, '')) ||
        (e.departureFrom || '').toLowerCase().includes(kw) ||
        (e.notes || '').toLowerCase().includes(kw) ||
        _bandNamesMatch(e.bandIds, kw)
      );

      if (matched.length === 0) {
        resultsEl.innerHTML = `<p class="no-results">검색 결과가 없습니다.<br><small>"${keyword}"에 해당하는 버스 기록을 찾지 못했습니다.</small></p>`;
        return;
      }

      resultsEl.innerHTML = `
        <p style="font-size:13px;color:var(--text-light);margin-bottom:10px">총 ${matched.length}건 검색됨</p>
        ${matched.map(e => {
          const bandStr = (e.bandIds || []).map(bid => {
            const b = bands.getById(bid);
            return b ? b.name : '';
          }).filter(Boolean).join(', ');

          return `
            <div class="search-result-item">
              <div class="search-result-date">${formatDateKo(e.date)}</div>
              <div class="search-result-main">
                ${e.busCompany || ''}
                ${e.driverName ? '· ' + e.driverName : ''}
                ${e.phoneNumber ? '· ' + e.phoneNumber : ''}
              </div>
              <div class="search-result-detail">
                ${e.departureFrom ? '출발지: ' + e.departureFrom : ''}
                ${e.passengerCount ? ' · ' + e.passengerCount + '명' : ''}
                ${e.salesAmount ? ' · 판매 ' + formatWon(e.salesAmount) : ''}
                ${e.commissionCash ? ' · 수고비 ' + formatWon(e.commissionCash) : ''}
              </div>
              ${bandStr ? `<div class="search-result-detail">밴드: ${bandStr}</div>` : ''}
              ${e.notes ? `<div class="search-result-detail">메모: ${e.notes}</div>` : ''}
            </div>
          `;
        }).join('')}
      `;
    } catch (err) {
      resultsEl.innerHTML = `<p class="error-msg">검색 오류: ${err.message}</p>`;
    }
  }

  function _bandNamesMatch(bandIds, kw) {
    if (!bandIds || bandIds.length === 0) return false;
    return bandIds.some(bid => {
      const b = bands.getById(bid);
      return b && b.name.toLowerCase().includes(kw);
    });
  }

  return { init };
})();
