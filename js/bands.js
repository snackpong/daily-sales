// ===== 밴드 관리 모듈 =====
const bands = (() => {
  let _all = [];
  let _loaded = false;

  async function load() {
    const grid = document.getElementById('band-grid');
    grid.innerHTML = '<p class="loading-msg">불러오는 중...</p>';
    try {
      const snap = await userCol('bands').get();
      _all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
      _loaded = true;
      _renderGrid();
    } catch (e) {
      console.error('bands.load 실패:', e);
      grid.innerHTML = `<p class="error-msg">밴드 불러오기 실패: ${e.message}<br><small>Firebase Console에서 Firestore 규칙을 확인하세요.</small></p>`;
    }
  }

  async function ensureLoaded() {
    if (_loaded) return;
    try {
      const snap = await userCol('bands').get();
      _all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
      _loaded = true;
    } catch (e) {
      console.error('bands.ensureLoaded 실패:', e);
    }
  }

  function _renderGrid() {
    const grid = document.getElementById('band-grid');
    if (_all.length === 0) {
      grid.innerHTML = '<p class="empty-msg">등록된 밴드가 없습니다.<br>+ 밴드 추가 버튼으로 추가하세요.</p>';
      return;
    }
    grid.innerHTML = _all.map(b => `
      <div class="band-card">
        <div class="band-card-top">
          ${b.logoURL
            ? `<img src="${escapeAttr(b.logoURL)}" class="band-logo-img" alt="${escapeAttr(b.name)}">`
            : `<div class="band-logo-placeholder">${escapeHTML(b.name.slice(0, 2))}</div>`}
          <div class="band-card-info">
            <div class="band-card-name">${escapeHTML(b.name)}</div>
            <span class="band-membership${b.isMember ? ' is-member' : ''}">
              ${b.isMember ? '✓ 내 밴드' : '외부/무소속'}
            </span>
          </div>
        </div>
        <div class="band-card-stats" onclick="bands.showStats('${b.id}')">
          📊 방문 통계 보기 →
        </div>
        <div class="band-card-actions">
          <button class="btn-outline btn-sm" onclick="bands.openModal('${b.id}')">수정</button>
          <button class="btn-danger btn-sm" onclick="bands.remove('${b.id}')">삭제</button>
        </div>
      </div>
    `).join('');
  }

  async function openForm(bandId) {
    const isEdit = !!bandId;
    const b = isEdit ? _all.find(x => x.id === bandId) : null;

    const body = `
      <form class="entry-form" id="band-form">
        <div class="form-group">
          <label>밴드 이름 *</label>
          <input type="text" name="name" value="${escapeAttr(b?.name || '')}" placeholder="예: 우송, 처음처럼, 너와누리" required>
        </div>
        <div class="form-group">
          <label>
            <span style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" name="isMember" ${b?.isMember ? 'checked' : ''}>
              우리 가게가 가입된 밴드 (내 밴드)
            </span>
          </label>
        </div>
        <div class="form-group">
          <label>밴드 로고 이미지</label>
          ${b?.logoURL ? `<div class="current-photo"><img src="${escapeAttr(b.logoURL)}" alt="현재 로고"><p>현재 로고</p></div>` : ''}
          <input type="file" name="logo" accept="image/*" id="band-logo-file">
          <div id="band-logo-preview" class="photo-preview"></div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn-outline" onclick="closeModal()">취소</button>
      <button class="btn-primary" onclick="bands.save('${bandId || ''}')">
        ${isEdit ? '수정 저장' : '추가'}
      </button>
    `;

    openModal(isEdit ? '밴드 수정' : '밴드 추가', body, footer);

    document.getElementById('band-logo-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        document.getElementById('band-logo-preview').innerHTML =
          `<img src="${ev.target.result}" alt="미리보기" style="max-height:80px;border-radius:8px;">`;
      };
      reader.readAsDataURL(file);
    });
  }

  async function save(bandId) {
    const form = document.getElementById('band-form');
    const name = form.querySelector('[name="name"]').value.trim();
    if (!name) { showToast('밴드 이름을 입력하세요', 'error'); return; }

    const isEdit = !!bandId;
    const data = {
      name,
      isMember: form.querySelector('[name="isMember"]').checked,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!isEdit) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    const btn = document.querySelector('#modal-footer .btn-primary');
    btn.disabled = true; btn.textContent = '저장 중...';

    try {
      const logoFile = document.getElementById('band-logo-file').files[0];
      if (logoFile) {
        data.logoURL = await uploadPhoto(logoFile, `photos/${getUserId()}/bands/${Date.now()}_${logoFile.name}`);
      } else if (!isEdit) {
        data.logoURL = '';
      }

      if (isEdit) {
        await userCol('bands').doc(bandId).update(data);
        showToast('밴드가 수정되었습니다');
      } else {
        await userCol('bands').add(data);
        showToast('밴드가 추가되었습니다');
      }
      _loaded = false;
      closeModal();
      load();
    } catch (e) {
      showToast('저장 실패: ' + e.message, 'error');
      btn.disabled = false;
      btn.textContent = isEdit ? '수정 저장' : '추가';
    }
  }

  async function remove(bandId) {
    if (!await confirmDialog('이 밴드를 삭제하시겠습니까?')) return;
    try {
      await userCol('bands').doc(bandId).delete();
      _loaded = false;
      showToast('삭제되었습니다');
      load();
    } catch (e) {
      showToast('삭제 실패: ' + e.message, 'error');
    }
  }

  async function showStats(bandId) {
    const b = _all.find(x => x.id === bandId);
    if (!b) return;

    const now = new Date();
    const thisMonth = getMonthStr(now);
    const thisYear = String(now.getFullYear());

    try {
      const snap = await userCol('busEntries')
        .where('bandIds', 'array-contains', bandId)
        .get();

      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const monthVisits = all.filter(v => v.date.startsWith(thisMonth));
      const yearVisits = all.filter(v => v.date.startsWith(thisYear));

      const historyHTML = all.length === 0
        ? '<p class="empty-msg">방문 기록이 없습니다</p>'
        : all.map(v => `
            <div class="visit-item">
              <span class="visit-date">${formatDateKo(v.date)}</span>
              <span class="visit-info">
                ${escapeHTML(v.busCompany || '')}
                ${v.driverName ? ' · ' + escapeHTML(v.driverName) : ''}
              </span>
              <span class="visit-amount">${_visitSales(v) ? formatWon(_visitSales(v)) : ''}</span>
            </div>
          `).join('');

      const body = `
        <div class="stats-grid">
          <div class="stat-box">
            <span class="stat-num">${monthVisits.length}</span>
            <span class="stat-label">이번달 방문</span>
          </div>
          <div class="stat-box">
            <span class="stat-num">${yearVisits.length}</span>
            <span class="stat-label">올해 방문</span>
          </div>
          <div class="stat-box">
            <span class="stat-num">${all.length}</span>
            <span class="stat-label">전체 방문</span>
          </div>
        </div>
        <h4 style="margin:0 0 10px;color:var(--primary)">방문 이력</h4>
        <div class="visit-history">${historyHTML}</div>
      `;

      openModal(`${b.name} 밴드 통계`, body,
        '<button class="btn-outline" onclick="closeModal()">닫기</button>');
    } catch (e) {
      showToast('통계 조회 실패: ' + e.message, 'error');
    }
  }

  function getAll() { return _all; }
  function getById(id) { return _all.find(b => b.id === id); }
  function invalidate() { _loaded = false; }
  function _visitSales(v) {
    return (Number(v.salesCash) || Number(v.salesAmount) || 0) +
      (Number(v.salesCard) || 0);
  }

  return { load, ensureLoaded, openModal: openForm, save, remove, showStats, getAll, getById, invalidate };
})();
