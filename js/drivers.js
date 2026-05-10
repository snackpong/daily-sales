const drivers = (() => {
  let _list = [];

  function _driverKey(v) {
    return (v.phoneNumber || '').replace(/\D/g, '') || v.driverName || v.busCompany || '';
  }

  function _ensureDriver(map, v) {
    const key = _driverKey(v);
    if (!key) return null;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: v.driverName || '',
        phone: v.phoneNumber || '',
        busCompany: v.busCompany || '',
        lastDate: v.date || '',
        visits: 0,
        reservations: 0,
        totalComm: 0,
      });
    }
    const r = map.get(key);
    if (!r.name && v.driverName) r.name = v.driverName;
    if (!r.phone && v.phoneNumber) r.phone = v.phoneNumber;
    if (!r.busCompany && v.busCompany) r.busCompany = v.busCompany;
    if ((v.date || '') > r.lastDate) r.lastDate = v.date;
    return r;
  }

  async function load() {
    const container = document.getElementById('drivers-list');
    container.innerHTML = '<p class="loading-msg">불러오는 중...</p>';
    try {
      const [busSnap, resSnap] = await Promise.all([
        userCol('busEntries').get(),
        userCol('reservations').get()
      ]);
      const map = new Map();

      busSnap.docs.forEach(d => {
        const v = { id: d.id, ...d.data() };
        const r = _ensureDriver(map, v);
        if (!r) return;
        r.visits++;
        r.totalComm += Number(v.commissionCash) || 0;
      });

      resSnap.docs.forEach(d => {
        const v = { id: d.id, ...d.data() };
        const r = _ensureDriver(map, v);
        if (!r) return;
        r.reservations++;
      });

      const profiles = await userCol('driverProfiles').get();
      profiles.docs.forEach(d => {
        const p = d.data();
        if (map.has(d.id)) {
          Object.assign(map.get(d.id), {
            notes: p.notes || '',
            incidents: p.incidents || '',
            reservationMemo: p.reservationMemo || '',
            businessCardURL: p.businessCardURL || '',
          });
        }
      });

      _list = Array.from(map.values())
        .sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''));

      document.getElementById('drivers-search').oninput = _onSearch;
      _render(_list);
    } catch (e) {
      container.innerHTML = `<p class="error-msg">불러오기 실패: ${escapeHTML(e.message)}</p>`;
    }
  }

  function _onSearch(e) {
    const q = e.target.value.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    _render(q ? _list.filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.phone || '').includes(q) ||
      (qDigits && (d.phone || '').replace(/\D/g, '').includes(qDigits))
    ) : _list);
  }

  function _render(list) {
    const container = document.getElementById('drivers-list');
    if (list.length === 0) {
      container.innerHTML = '<p class="empty-msg">기사님 정보가 없습니다. 버스장부에 기록이 쌓이면 자동으로 나타납니다.</p>';
      return;
    }
    container.innerHTML = list.map(d => `
      <div class="driver-card" onclick="busLedger.openDriverProfile('${escapeInlineJS(d.phone)}','${escapeInlineJS(d.name)}','${escapeInlineJS(d.busCompany)}')">
        <div class="driver-card-left">
          ${d.businessCardURL
            ? `<img src="${escapeAttr(d.businessCardURL)}" class="driver-card-thumb" alt="명함">`
            : '<div class="driver-card-thumb-placeholder">👤</div>'}
        </div>
        <div class="driver-card-info">
          <div class="driver-card-name">${escapeHTML(d.name || '이름 없음')}</div>
          <div class="driver-card-sub">${escapeHTML(d.busCompany || '-')} ${escapeHTML(d.phone || '-')}</div>
          <div class="driver-card-meta">
            최근 기록: ${d.lastDate ? formatDateKo(d.lastDate) : '-'} &nbsp;&nbsp;
            방문 ${d.visits}회 &nbsp;&nbsp;
            예약 ${d.reservations}건 &nbsp;&nbsp;
            커미션 평균 ${d.visits ? formatWon(Math.round(d.totalComm / d.visits)) : '-'}
          </div>
          ${d.incidents ? `<div class="driver-card-incident">${escapeHTML(d.incidents.slice(0, 40))}${d.incidents.length > 40 ? '...' : ''}</div>` : ''}
          ${d.notes ? `<div class="driver-card-notes">💬 ${escapeHTML(d.notes.slice(0, 40))}${d.notes.length > 40 ? '...' : ''}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  return { load };
})();
