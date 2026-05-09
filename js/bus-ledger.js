// ===== 버스 기사 장부 모듈 =====
const busLedger = (() => {
  let _date = getTodayStr();
  let _entries = [];
  let _qs = {};
  let _galleryState = { urls: [], idx: 0 };
  let _removedPhotoUrls = new Set();

  async function init() {
    document.getElementById('bus-date').value = _date;

    document.getElementById('bus-date').onchange = e => {
      _date = e.target.value;
      load();
    };
    document.getElementById('bus-prev-day').onclick = () => {
      _date = addDays(_date, -1);
      document.getElementById('bus-date').value = _date;
      load();
    };
    document.getElementById('bus-next-day').onclick = () => {
      _date = addDays(_date, 1);
      document.getElementById('bus-date').value = _date;
      load();
    };
    document.getElementById('bus-today').onclick = () => {
      _date = getTodayStr();
      document.getElementById('bus-date').value = _date;
      load();
    };
    document.getElementById('btn-add-bus').onclick = () => openEntryModal(null);

    _qs = await loadQuickSelect();
    await load();
  }

  async function load() {
    const tbody = document.getElementById('bus-tbody');

    async function _doFetch(source) {
      const opts = source ? { source } : undefined;
      const snap = await userCol('busEntries').where('date', '==', _date).get(opts);
      _entries = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.daySequence || 0) - (b.daySequence || 0));
      _renderTable();
      _updateSummary();
    }

    // 캐시에서 즉시 렌더링 (캐시 미스면 로딩 표시)
    let cacheHit = false;
    try { await _doFetch('cache'); cacheHit = true; } catch (_) {}
    if (!cacheHit) tbody.innerHTML = '<tr class="loading-row"><td colspan="14">불러오는 중...</td></tr>';

    // 서버에서 최신 데이터로 갱신
    try { await _doFetch(); } catch (e) {
      if (!cacheHit)
        tbody.innerHTML = `<tr><td colspan="14" class="error-msg">오류: ${e.message}</td></tr>`;
      console.error(e);
    }
  }

  function _renderTable() {
    const tbody = document.getElementById('bus-tbody');
    if (_entries.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="14">이날 기록이 없습니다. "+ 버스 추가" 버튼으로 추가하세요.</td></tr>';
      return;
    }

    tbody.innerHTML = _entries.map((e, i) => {
      const bandHTML = _bandBadges(e.bandIds);
      const photoURLs = e.photoURLs || (e.photoURL ? [e.photoURL] : []);
      const photoHTML = photoURLs.length > 0
        ? `<div class="photo-thumb-wrap" onclick="busLedger.viewPhotos('${escapeInlineJS(e.id)}')">
             <img src="${escapeAttr(photoURLs[0])}" class="photo-thumb" alt="사진">
             ${photoURLs.length > 1 ? `<span class="photo-count-badge">+${photoURLs.length - 1}</span>` : ''}
           </div>`
        : `<span class="no-photo-text">없음</span>`;

      const p = escapeInlineJS(e.phoneNumber || '');
      const n = escapeInlineJS(e.driverName || '');
      const driverNameHTML = e.driverName
        ? `<span class="driver-link" onclick="busLedger.openDriverProfile('${p}','${n}')">${escapeHTML(e.driverName)}</span>`
        : '-';
      const phoneHTML = e.phoneNumber
        ? `<span class="driver-link" onclick="busLedger.openDriverProfile('${p}','${n}')">${escapeHTML(e.phoneNumber)}</span><button class="phone-copy-btn" onclick="event.stopPropagation();navigator.clipboard.writeText('${p}').then(()=>showToast('번호 복사됨'))" title="복사">📋</button>`
        : '-';
      const cashSales = _cashSales(e);
      const cardSales = _cardSales(e);
      const totalSales = cashSales + cardSales;

      return `
        <tr>
          <td><span class="seq-badge">${i + 1}</span></td>
          <td><div class="band-badges">${bandHTML}</div></td>
          <td>${escapeHTML(e.busCompany || '-')}</td>
          <td>${driverNameHTML}</td>
          <td>${phoneHTML}</td>
          <td class="amount-cell">${cashSales ? formatWon(cashSales) : '-'}</td>
          <td class="amount-cell">${cardSales ? formatWon(cardSales) : '-'}</td>
          <td class="amount-cell total-sales">${totalSales ? formatWon(totalSales) : '-'}</td>
          <td class="amount-cell">${e.commissionCash ? formatWon(e.commissionCash) : '-'}</td>
          <td>${escapeHTML(e.commissionGoods || '-')}</td>
          <td style="text-align:left">${escapeHTML(e.notes || '-')}</td>
          <td class="photo-time-cell">${_photoUploadedAtText(photoURLs[0])}</td>
          <td>${photoHTML}</td>
          <td>
            <div class="action-btns">
              <button class="btn-sm btn-primary" onclick="busLedger.openEntryModal('${e.id}')">수정</button>
              <button class="btn-sm btn-outline" onclick="busLedger.generatePost('${e.id}')" title="밴드 게시 문구 생성">밴드글</button>
              <button class="btn-sm btn-danger" onclick="busLedger.remove('${e.id}')">삭제</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function _cardSales(entry) {
    return _readMoney(entry, 'salesCard', 'cardSalesAmount');
  }

  function _cashSales(entry) {
    return _readMoney(entry, 'salesCash', 'cashSalesAmount', 'salesAmount');
  }

  function _totalSales(entry) {
    return _cashSales(entry) + _cardSales(entry);
  }

  function _readMoney(entry, ...fieldNames) {
    if (!entry) return 0;
    for (const fieldName of fieldNames) {
      const value = entry[fieldName];
      if (value !== undefined && value !== null) return Number(value) || 0;
    }
    return 0;
  }

  function _photoUploadedAtText(url) {
    if (!url) return '-';
    const decoded = decodeURIComponent(url);
    const fileName = decoded.split('/').pop().split('?')[0].split('#')[0];
    const timestamp = fileName.includes('_') ? fileName.split('_')[0] : fileName;
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return '-';
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${day} ${hh}:${mm}`;
  }

  function _bandBadges(bandIds) {
    if (!bandIds || bandIds.length === 0) return '<span style="color:var(--text-light);font-size:11px">무소속</span>';
    return bandIds.map(bid => {
      const b = bands.getById(bid);
      if (!b) return '';
      const mark = b.logoURL
        ? `<img src="${escapeAttr(b.logoURL)}" class="band-badge-img" alt="${escapeAttr(b.name)}">`
        : `<span class="band-badge-text">${escapeHTML(b.name.slice(0, 2))}</span>`;
      return `<span class="band-badge-pill" title="${escapeAttr(b.name)}">${mark}<span class="band-badge-name">${escapeHTML(b.name)}</span></span>`;
    }).join('');
  }

  function _updateSummary() {
    document.getElementById('summary-count').textContent = _entries.length + '대';
    document.getElementById('summary-sales').textContent =
      formatWon(_entries.reduce((s, e) => s + _totalSales(e), 0));
    document.getElementById('summary-commission').textContent =
      formatWon(_entries.reduce((s, e) => s + (Number(e.commissionCash) || 0), 0));
  }

  async function openEntryModal(entryId) {
    _removedPhotoUrls = new Set();
    await bands.ensureLoaded();
    const isEdit = !!entryId;
    let entry = isEdit ? _entries.find(e => e.id === entryId) : null;
    if (isEdit && !entry) {
      const doc = await userCol('busEntries').doc(entryId).get();
      if (!doc.exists) { showToast('기록을 찾을 수 없습니다', 'error'); return; }
      entry = { id: doc.id, ...doc.data() };
      _entries = _entries.filter(e => e.id !== entry.id).concat(entry);
      if (entry.date) {
        _date = entry.date;
        const dateInput = document.getElementById('bus-date');
        if (dateInput) dateInput.value = _date;
      }
    }
    const allBands = bands.getAll();

    const bandChecks = allBands.length === 0
      ? `<p style="font-size:13px;color:var(--text-light)">등록된 밴드가 없습니다. 밴드 관리 탭에서 먼저 추가하세요.</p>`
      : allBands.map(b => `
          <label class="band-check-label">
            <input type="checkbox" name="bandIds" value="${b.id}"
              ${entry?.bandIds?.includes(b.id) ? 'checked' : ''}>
            ${b.logoURL ? `<img src="${escapeAttr(b.logoURL)}" class="band-check-img" alt="">` : ''}
            <span>${escapeHTML(b.name)}</span>
          </label>
        `).join('');

    const existingPhotoURLs = entry?.photoURLs || (entry?.photoURL ? [entry.photoURL] : []);
    const existingPhotosHTML = existingPhotoURLs.length > 0
      ? `<div class="current-photos">${existingPhotoURLs.map((url, i) =>
          `<div class="current-photo-item" id="cp-${i}">
             <img src="${escapeAttr(url)}" class="current-photo-thumb" alt="사진 ${i + 1}"
                  onclick="busLedger.viewPhoto('${escapeInlineJS(url)}')">
             <button type="button" class="photo-del-btn"
                     onclick="busLedger._removeExistingPhoto('${escapeInlineJS(url)}',${i})" title="삭제">×</button>
           </div>`
        ).join('')}</div>`
      : '';

    const body = `
      <form class="entry-form" id="bus-form">
        <div class="form-grid">
          <div class="form-group">
            <label>버스회사명 *</label>
            <input type="text" name="busCompany" maxlength="50" value="${escapeAttr(entry?.busCompany || '')}" placeholder="예: 금화고속, 우성여행사" required>
          </div>
          <div class="form-group">
            <label>기사명</label>
            <input type="text" name="driverName" maxlength="50" value="${escapeAttr(entry?.driverName || '')}" placeholder="기사님 성함">
          </div>
          <div class="form-group">
            <label>전화번호</label>
            <input type="tel" name="phoneNumber" maxlength="20" value="${escapeAttr(entry?.phoneNumber || '')}" placeholder="010-0000-0000">
          </div>
          <div class="form-group">
            <label>현금매출 (원)</label>
            <input type="text" inputmode="numeric" name="salesCash" maxlength="15" value="${_cashSales(entry) ? _cashSales(entry).toLocaleString('ko-KR') : ''}" placeholder="0">
          </div>
          <div class="form-group">
            <label>카드매출 (원)</label>
            <input type="text" inputmode="numeric" name="salesCard" maxlength="15" value="${_cardSales(entry) ? _cardSales(entry).toLocaleString('ko-KR') : ''}" placeholder="0">
          </div>
          <div class="form-group">
            <label>커미션 - 현금 (원)</label>
            <input type="text" inputmode="numeric" name="commissionCash" maxlength="15" value="${entry?.commissionCash ? Number(entry.commissionCash).toLocaleString('ko-KR') : ''}" placeholder="0">
          </div>
          <div class="form-group">
            <label>커미션 - 물건</label>
            <input type="text" name="commissionGoods" maxlength="500" value="${escapeAttr(entry?.commissionGoods || '')}" placeholder="예: 홍어 1마리, 갈치 3마리">
          </div>
        </div>

        <div class="form-group full">
          <label>밴드 선택 (복수 선택 가능)</label>
          <div class="band-checkboxes">${bandChecks}</div>
        </div>

        <div class="form-group full">
          <label>메모 / 비고</label>
          <textarea name="notes" maxlength="500" placeholder="특이사항, 드린 물건, 손님 관련 메모 등">${escapeHTML(entry?.notes || '')}</textarea>
        </div>

        <div class="form-group full">
          <label>버스 사진</label>
          ${existingPhotosHTML}
          <input type="file" name="photo" accept="image/*" id="bus-photo-file" multiple>
          <div id="bus-photo-preview" class="photo-preview"></div>
        </div>

        ${!isEdit ? `
        <div class="form-group full">
          <label class="check-label">
            <input type="checkbox" id="continue-add">
            저장 후 바로 다음 버스 추가
          </label>
        </div>` : ''}
      </form>
    `;

    const footer = `
      <button class="btn-outline" onclick="closeModal()">취소</button>
      <button class="btn-primary" id="bus-save-btn" onclick="busLedger.save('${entryId || ''}')">
        ${isEdit ? '수정 저장' : '추가'}
      </button>
    `;

    openModal(isEdit ? '버스 기록 수정' : '버스 추가', body, footer);

    const cashInput = document.querySelector('#bus-form [name="salesCash"]');
    const cardInput = document.querySelector('#bus-form [name="salesCard"]');
    initMoneyInput(cashInput);
    initMoneyInput(cardInput);
    initMoneyInput(document.querySelector('#bus-form [name="commissionCash"]'));

    document.getElementById('bus-photo-file').addEventListener('change', e => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      const preview = document.getElementById('bus-photo-preview');
      preview.innerHTML = '';
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          const img = document.createElement('img');
          img.src = ev.target.result;
          img.alt = '미리보기';
          preview.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  async function save(entryId) {
    const form = document.getElementById('bus-form');
    const isEdit = !!entryId;

    const busCompany = form.querySelector('[name="busCompany"]').value.trim();
    if (!busCompany) { showToast('버스회사명을 입력하세요', 'error'); return; }

    const bandIds = Array.from(form.querySelectorAll('[name="bandIds"]:checked')).map(cb => cb.value);

    const data = {
      date: _date,
      busCompany,
      driverName: form.querySelector('[name="driverName"]').value.trim(),
      phoneNumber: form.querySelector('[name="phoneNumber"]').value.trim(),
      salesCash: parseMoneyInput(form.querySelector('[name="salesCash"]').value),
      salesCard: parseMoneyInput(form.querySelector('[name="salesCard"]').value),
      commissionCash: parseMoneyInput(form.querySelector('[name="commissionCash"]').value),
      commissionGoods: form.querySelector('[name="commissionGoods"]').value.trim(),
      bandIds,
      notes: form.querySelector('[name="notes"]').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!isEdit) {
      data.daySequence = _entries.length + 1;
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    const btn = document.getElementById('bus-save-btn');
    btn.disabled = true; btn.textContent = '저장 중...';

    try {
      const photoFiles = Array.from(document.getElementById('bus-photo-file').files);
      const existingEntry = isEdit ? _entries.find(e => e.id === entryId) : null;
      const existingUrls = existingEntry?.photoURLs || (existingEntry?.photoURL ? [existingEntry.photoURL] : []);
      const keptUrls = existingUrls.filter(url => !_removedPhotoUrls.has(url));

      let newUrls = [];
      if (photoFiles.length > 0) {
        const ts = Date.now();
        newUrls = await Promise.all(photoFiles.map((file, i) =>
          uploadPhoto(file, `photos/${getUserId()}/bus/${ts}_${i}_${file.name}`)
        ));
      }
      data.photoURLs = [...keptUrls, ...newUrls];
      data.photoURL = data.photoURLs[0] || '';

      if (isEdit) {
        await userCol('busEntries').doc(entryId).update(data);
        showToast('수정되었습니다');
      } else {
        await userCol('busEntries').add(data);
        showToast('버스가 추가되었습니다');
      }
      document.dispatchEvent(new CustomEvent('dailySales:dataChanged', {
        detail: { type: 'bus', date: data.date }
      }));
      const continueAdd = document.getElementById('continue-add');
      const shouldContinue = !isEdit && continueAdd && continueAdd.checked;

      closeModal();
      await load();

      if (shouldContinue) openEntryModal(null);
    } catch (e) {
      showToast('저장 실패: ' + e.message, 'error');
      btn.disabled = false;
      btn.textContent = isEdit ? '수정 저장' : '추가';
    }
  }

  async function remove(entryId) {
    if (!await confirmDialog('이 기록을 삭제하시겠습니까?')) return false;
    const target = _entries.find(e => e.id === entryId);
    try {
      await userCol('busEntries').doc(entryId).delete();
      showToast('삭제되었습니다');
      await load();
      document.dispatchEvent(new CustomEvent('dailySales:dataChanged', {
        detail: { type: 'bus', date: target?.date || _date }
      }));
      return true;
    } catch (e) {
      showToast('삭제 실패: ' + e.message, 'error');
      return false;
    }
  }

  function generatePost(entryId) {
    const e = _entries.find(x => x.id === entryId);
    if (!e) return;

    const selectedBands = (e.bandIds || []).map(bid => bands.getById(bid)).filter(Boolean);

    if (selectedBands.length === 0) {
      showToast('연결된 밴드가 없어 문구를 생성할 수 없습니다', 'info');
      return;
    }

    const dateStr = formatDateKo(e.date);
    const driverStr = [e.busCompany, e.driverName ? e.driverName + ' 기사님' : ''].filter(Boolean).join(' ');

    const postsHTML = selectedBands.map(b => {
      const text = `안녕하세요 😊\n오늘 ${driverStr}께서\n목포 건어물을 방문해 주셨습니다.\n\n${dateStr}\n소중한 발걸음 진심으로 감사드립니다 🙏\n앞으로도 잘 부탁드립니다!`;
      const pid = 'post_' + b.id;
      const photoURLs = e.photoURLs || (e.photoURL ? [e.photoURL] : []);
      return `
        <div class="band-post-item">
          <div class="band-post-header">
            ${b.logoURL ? `<img src="${escapeAttr(b.logoURL)}" class="band-post-logo" alt="">` : ''}
            ${escapeHTML(b.name)} 밴드용
          </div>
          ${photoURLs.length > 0
            ? `<img src="${escapeAttr(photoURLs[0])}" class="band-post-bus-photo" alt="버스 사진">`
            : '<p class="no-photo-note">📷 사진이 없습니다 (사진 첨부 후 다시 시도하세요)</p>'}
          <textarea class="band-post-text" id="${escapeAttr(pid)}" readonly>${escapeHTML(text)}</textarea>
          <button class="btn-sm btn-primary" onclick="navigator.clipboard.writeText(document.getElementById('${pid}').value).then(()=>showToast('복사되었습니다!'))">📋 문구 복사</button>
        </div>
      `;
    }).join('');

    openModal('밴드 게시 문구',
      `<div class="band-posts">${postsHTML}</div>`,
      '<button class="btn-outline" onclick="closeModal()">닫기</button>');
  }

  function viewPhoto(url) {
    openModal('사진',
      `<img src="${escapeAttr(url)}" style="max-width:100%;border-radius:8px;display:block;">`,
      '<button class="btn-outline" onclick="closeModal()">닫기</button>');
  }

  function viewPhotos(entryId) {
    const entry = _entries.find(e => e.id === entryId);
    if (!entry) return;
    const photoURLs = entry.photoURLs || (entry.photoURL ? [entry.photoURL] : []);
    if (photoURLs.length === 0) return;
    _galleryState = { urls: photoURLs, idx: 0, blobs: {} };
    _renderGalleryModal();
    _prefetchBlob(0);
  }

  function _getStorageRef(url) {
    const m = url.match(/\/o\/([^?#]+)/);
    if (m) return storage.ref(decodeURIComponent(m[1]));
    return storage.refFromURL(url);
  }

  function _prefetchBlob(idx) {
    const { urls, blobs } = _galleryState;
    if (!urls[idx] || blobs[idx]) return;
    const url = urls[idx];
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    const _setDlBtn = (ready) => {
      if (!isMobile) return;
      const btn = document.getElementById('gallery-dl-btn');
      if (!btn || _galleryState.idx !== idx) return;
      btn.disabled = !ready;
      btn.textContent = ready ? '⬇ 다운로드' : '⏳ 준비 중...';
    };

    const doFetch = async () => {
      _setDlBtn(false);
      try {
        const ref = _getStorageRef(url);
        const blob = typeof ref.getBlob === 'function'
          ? await ref.getBlob()
          : new Blob([await ref.getBytes()], { type: 'image/jpeg' });
        if (_galleryState.blobs) _galleryState.blobs[idx] = blob;
      } catch {
        try {
          const resp = await fetch(url);
          if (resp.ok && _galleryState.blobs) _galleryState.blobs[idx] = await resp.blob();
        } catch { /* silent */ }
      }
      _setDlBtn(true);
    };
    doFetch();
  }

  function _renderGalleryModal() {
    const { urls, idx } = _galleryState;
    const url = urls[idx];
    const multi = urls.length > 1;
    const body = `
      <div class="gallery-wrap">
        ${multi ? `<button class="gallery-nav gallery-prev" onclick="busLedger._galleryNav(-1)">&#8249;</button>` : ''}
        <img src="${escapeAttr(url)}" class="gallery-main-img" alt="사진">
        ${multi ? `<button class="gallery-nav gallery-next" onclick="busLedger._galleryNav(1)">&#8250;</button>` : ''}
        ${multi ? `<div class="gallery-counter">${idx + 1} / ${urls.length}</div>` : ''}
      </div>
    `;
    const footer = `
      <button class="btn-outline" id="gallery-dl-btn" onclick="busLedger.downloadCurrentPhoto()">⬇ 다운로드</button>
      <button class="btn-outline" onclick="closeModal()">닫기</button>
    `;
    openModal(multi ? `사진 (${idx + 1}/${urls.length})` : '사진', body, footer);
  }

  function _galleryNav(dir) {
    const { urls, idx } = _galleryState;
    _galleryState.idx = (idx + dir + urls.length) % urls.length;
    const i = _galleryState.idx;
    const url = urls[i];
    document.getElementById('modal-title').textContent = `사진 (${i + 1}/${urls.length})`;
    document.getElementById('modal-body').innerHTML = `
      <div class="gallery-wrap">
        <button class="gallery-nav gallery-prev" onclick="busLedger._galleryNav(-1)">&#8249;</button>
        <img src="${escapeAttr(url)}" class="gallery-main-img" alt="사진">
        <button class="gallery-nav gallery-next" onclick="busLedger._galleryNav(1)">&#8250;</button>
        <div class="gallery-counter">${i + 1} / ${urls.length}</div>
      </div>
    `;
    _prefetchBlob(i);
  }

  function _removeExistingPhoto(url, idx) {
    _removedPhotoUrls.add(url);
    const el = document.getElementById('cp-' + idx);
    if (el) el.style.display = 'none';
  }

  async function downloadCurrentPhoto() {
    const { urls, idx, blobs } = _galleryState;
    const url = urls[idx];
    const filename = `photo_${idx + 1}.jpg`;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // 미리 받아둔 blob이 있으면 바로 사용 (user gesture 컨텍스트 유지)
    const cached = blobs && blobs[idx];
    if (cached) {
      if (isMobile && navigator.share) {
        const file = new File([cached], filename, { type: 'image/jpeg' });
        showToast("'이미지 저장'을 눌러 사진첩에 저장하세요", 'info');
        try {
          await navigator.share({ files: [file], title: filename });
          return;
        } catch (e) {
          if (e.name === 'AbortError') return;
        }
      }
      _triggerDownload(cached, filename);
      showToast('다운로드 완료');
      return;
    }

    // 캐시 없으면 기존 방식으로 fallback (blob 비동기 획득)
    showToast('다운로드 중...', 'info');
    let blob = null;
    try {
      const ref = _getStorageRef(url);
      blob = typeof ref.getBlob === 'function'
        ? await ref.getBlob()
        : new Blob([await ref.getBytes()], { type: 'image/jpeg' });
    } catch (e1) {
      try {
        const resp = await fetch(url);
        if (resp.ok) blob = await resp.blob();
      } catch { /* silent */ }
    }

    if (!blob) {
      window.open(url, '_blank');
      showToast('새 탭에서 사진을 길게 눌러 저장하세요', 'info');
      return;
    }

    if (isMobile && navigator.share) {
      const file = new File([blob], filename, { type: 'image/jpeg' });
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }

    _triggerDownload(blob, filename);
    showToast('다운로드 완료');
  }

  function _triggerDownload(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ===== 기사 프로필 =====

  async function openDriverProfile(phone, name) {
    openModal(name ? name + ' 기사님' : '기사 프로필',
      '<p class="loading-msg">불러오는 중...</p>',
      '<button class="btn-outline" onclick="closeModal()">닫기</button>');
    document.querySelector('.modal-box').style.maxWidth = '760px';

    try {
      const profileKey = phone ? phone.replace(/\D/g, '') : name;

      let profile = {};
      if (profileKey) {
        const doc = await userCol('driverProfiles').doc(profileKey).get();
        if (doc.exists) profile = doc.data();
      }

      let snap;
      if (phone) {
        snap = await userCol('busEntries').where('phoneNumber', '==', phone).get();
      } else {
        snap = await userCol('busEntries').where('driverName', '==', name).get();
      }
      const visits = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      const totalVisits = visits.length;
      const totalSales = visits.reduce((s, v) => s + _totalSales(v), 0);
      const totalComm = visits.reduce((s, v) => s + (Number(v.commissionCash) || 0), 0);
      const avgComm = totalVisits > 0 ? Math.round(totalComm / totalVisits) : 0;
      const displayName = name || visits[0]?.driverName || '이름 미상';

      const escapedKey = escapeInlineJS(profileKey || '');

      const bizCardHTML = profile.businessCardURL
        ? `<img src="${escapeAttr(profile.businessCardURL)}" class="dp-biz-img" alt="명함"
             onclick="busLedger.viewPhoto('${escapeInlineJS(profile.businessCardURL)}')">
           <button class="dp-biz-change-btn"
             onclick="document.getElementById('dp-biz-file').click()">📷 교체</button>`
        : `<div class="dp-biz-placeholder"
             onclick="document.getElementById('dp-biz-file').click()">
             <div style="font-size:36px">📇</div>
             <div>명함 사진 등록</div>
             <div style="font-size:12px;opacity:0.6;margin-top:2px">클릭하여 업로드</div>
           </div>`;

      const feedHTML = visits.length === 0
        ? '<p class="empty-msg">방문 기록이 없습니다.</p>'
        : visits.map(v => _visitCardHTML(v)).join('');

      const body = `
        <div class="driver-profile">
          <div class="dp-biz-section">
            ${bizCardHTML}
            <input type="file" id="dp-biz-file" accept="image/*" style="display:none"
              onchange="busLedger._onBizCardChange('${escapedKey}', this)">
          </div>

          <div class="dp-info-section">
            <div class="dp-name">${escapeHTML(displayName)}</div>
            ${phone ? `<div class="dp-phone">📞 ${phoneLink(phone)}</div>` : ''}
            <div class="dp-stats">
              총 ${totalVisits}회 방문 &nbsp;·&nbsp;
              누적 판매 ${formatWon(totalSales)} &nbsp;·&nbsp;
              평균 커미션 ${formatWon(avgComm)}
            </div>
          </div>

          <div class="dp-feed">
            <div class="dp-feed-title">방문 기록</div>
            ${feedHTML}
          </div>
        </div>
      `;

      document.getElementById('modal-title').textContent = displayName + ' 기사님';
      document.getElementById('modal-body').innerHTML = body;

    } catch (e) {
      document.getElementById('modal-body').innerHTML = `<p class="error-msg">오류: ${e.message}</p>`;
      console.error(e);
    }
  }

  function _visitCardHTML(v) {
    const photoURLs = v.photoURLs || (v.photoURL ? [v.photoURL] : []);
    const photoSection = photoURLs.length > 0
      ? _slideshowHTML(v.id, photoURLs) +
        `<label class="dp-add-photo-btn-sm" for="dp-vp-${v.id}">+ 사진 추가</label>`
      : `<label class="dp-add-photo-btn" for="dp-vp-${v.id}">
           <span style="font-size:24px">📷</span>
           <span>사진 추가</span>
         </label>`;

    const infoStr = [
      _cashSales(v) ? '현금 ' + formatWon(_cashSales(v)) : '',
      _cardSales(v) ? '카드 ' + formatWon(_cardSales(v)) : '',
      v.commissionCash ? '커미션 ' + formatWon(v.commissionCash) : '',
    ].filter(Boolean).join('&nbsp;·&nbsp;');

    return `
      <div class="dp-visit-card" id="dp-card-${v.id}">
        <div class="dp-visit-header">
          <span class="dp-visit-date">${formatDateKo(v.date)}</span>
          <button class="btn-sm btn-outline"
            onclick="busLedger._editFromProfile('${v.id}','${v.date}')">수정</button>
        </div>
        ${infoStr ? `<div class="dp-visit-info">${infoStr}</div>` : ''}
        ${v.notes ? `<div class="dp-visit-memo">💬 ${escapeHTML(v.notes)}</div>` : ''}
        <div class="dp-photo-area" id="dp-pa-${v.id}">
          ${photoSection}
        </div>
        <input type="file" id="dp-vp-${v.id}" accept="image/*" style="display:none"
          onchange="busLedger._onVisitPhotoChange('${v.id}', this)">
      </div>
    `;
  }

  function _slideshowHTML(entryId, photoURLs) {
    if (photoURLs.length === 1) {
      return `<div class="dp-slideshow">
        <img src="${escapeAttr(photoURLs[0])}" class="dp-slide-img"
          onclick="busLedger.viewPhoto('${escapeInlineJS(photoURLs[0])}')">
      </div>`;
    }
    const slides = photoURLs.map((url, i) =>
      `<div class="dp-slide${i === 0 ? ' active' : ''}">
        <img src="${escapeAttr(url)}" class="dp-slide-img" onclick="busLedger.viewPhoto('${escapeInlineJS(url)}')">
      </div>`
    ).join('');
    const dots = photoURLs.map((_, i) =>
      `<span class="dp-dot${i === 0 ? ' active' : ''}"
        onclick="busLedger._goSlide('${entryId}',${i})"></span>`
    ).join('');
    return `
      <div class="dp-slideshow" id="dp-ss-${entryId}">
        <button class="dp-slide-btn dp-slide-prev"
          onclick="busLedger._prevSlide('${entryId}')">&#8249;</button>
        <div class="dp-slides">${slides}</div>
        <button class="dp-slide-btn dp-slide-next"
          onclick="busLedger._nextSlide('${entryId}')">&#8250;</button>
        <div class="dp-dots">${dots}</div>
      </div>`;
  }

  function _prevSlide(id) { _moveSlide(id, -1); }
  function _nextSlide(id) { _moveSlide(id, 1); }
  function _goSlide(id, idx) {
    const ss = document.getElementById('dp-ss-' + id);
    if (!ss) return;
    ss.querySelectorAll('.dp-slide').forEach((s, i) => s.classList.toggle('active', i === idx));
    ss.querySelectorAll('.dp-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  }
  function _moveSlide(id, dir) {
    const ss = document.getElementById('dp-ss-' + id);
    if (!ss) return;
    const slides = ss.querySelectorAll('.dp-slide');
    const cur = Array.from(slides).findIndex(s => s.classList.contains('active'));
    _goSlide(id, (cur + dir + slides.length) % slides.length);
  }

  async function _onBizCardChange(profileKey, input) {
    const file = input.files[0];
    if (!file) return;
    try {
      showToast('명함 업로드 중...', 'info');
      const url = await uploadPhoto(file,
        `photos/${getUserId()}/drivers/${profileKey}/businessCard`);
      await userCol('driverProfiles').doc(profileKey).set(
        { businessCardURL: url }, { merge: true });

      const section = document.querySelector('.dp-biz-section');
      if (section) {
        const escaped = escapeInlineJS(profileKey || '');
        section.innerHTML = `
          <img src="${escapeAttr(url)}" class="dp-biz-img" alt="명함"
            onclick="busLedger.viewPhoto('${escapeInlineJS(url)}')">
          <button class="dp-biz-change-btn"
            onclick="document.getElementById('dp-biz-file').click()">📷 교체</button>
          <input type="file" id="dp-biz-file" accept="image/*" style="display:none"
            onchange="busLedger._onBizCardChange('${escaped}', this)">
        `;
      }
      showToast('명함이 등록되었습니다');
    } catch (e) {
      showToast('업로드 실패: ' + e.message, 'error');
    }
  }

  async function _onVisitPhotoChange(entryId, input) {
    const file = input.files[0];
    if (!file) return;
    try {
      showToast('사진 업로드 중...', 'info');
      const url = await uploadPhoto(file,
        `photos/${getUserId()}/bus/${entryId}/${Date.now()}`);

      const entryRef = userCol('busEntries').doc(entryId);
      const snap = await entryRef.get();
      const d = snap.data();
      const prev = d.photoURLs || (d.photoURL ? [d.photoURL] : []);
      const updated = [...prev, url];
      await entryRef.update({ photoURLs: updated, photoURL: updated[0] });

      const local = _entries.find(e => e.id === entryId);
      if (local) { local.photoURLs = updated; local.photoURL = updated[0]; }

      const pa = document.getElementById('dp-pa-' + entryId);
      if (pa) {
        pa.innerHTML = _slideshowHTML(entryId, updated) +
          `<label class="dp-add-photo-btn-sm" for="dp-vp-${entryId}">+ 사진 추가</label>`;
      }
      showToast('사진이 추가되었습니다');
    } catch (e) {
      showToast('업로드 실패: ' + e.message, 'error');
    }
  }

  async function _editFromProfile(entryId, date) {
    closeModal();
    _date = date;
    document.getElementById('bus-date').value = date;
    await load();
    openEntryModal(entryId);
  }

  return {
    init, load, openEntryModal, save, remove, generatePost, viewPhoto,
    viewPhotos, _galleryNav, downloadCurrentPhoto, _removeExistingPhoto,
    openDriverProfile, _prevSlide, _nextSlide, _goSlide,
    _onBizCardChange, _onVisitPhotoChange, _editFromProfile
  };
})();
