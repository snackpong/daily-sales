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
    if (!cacheHit) tbody.innerHTML = '<tr class="loading-row"><td colspan="13">불러오는 중...</td></tr>';

    // 서버에서 최신 데이터로 갱신
    try { await _doFetch(); } catch (e) {
      if (!cacheHit)
        tbody.innerHTML = `<tr><td colspan="13" class="error-msg">오류: ${e.message}</td></tr>`;
      console.error(e);
    }
  }

  function _renderTable() {
    const tbody = document.getElementById('bus-tbody');
    if (_entries.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="13">이날 기록이 없습니다. "+ 버스 추가" 버튼으로 추가하세요.</td></tr>';
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

      return `
        <tr>
          <td><span class="seq-badge">${i + 1}</span></td>
          <td><div class="band-badges">${bandHTML}</div></td>
          <td>${escapeHTML(e.busCompany || '-')}</td>
          <td>${driverNameHTML}</td>
          <td>${phoneHTML}</td>
          <td>${escapeHTML(e.departureFrom || '-')}</td>
          <td>${e.passengerCount ? e.passengerCount + '명' : '-'}</td>
          <td class="amount-cell">${e.salesAmount ? formatWon(e.salesAmount) : '-'}</td>
          <td class="amount-cell">${e.commissionCash ? formatWon(e.commissionCash) : '-'}</td>
          <td>${escapeHTML(e.commissionGoods || '-')}</td>
          <td style="text-align:left">${escapeHTML(e.notes || '-')}</td>
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

  function _bandBadges(bandIds) {
    if (!bandIds || bandIds.length === 0) return '<span style="color:var(--text-light);font-size:11px">무소속</span>';
    return bandIds.map(bid => {
      const b = bands.getById(bid);
      if (!b) return '';
      return b.logoURL
        ? `<img src="${escapeAttr(b.logoURL)}" class="band-badge-img" title="${escapeAttr(b.name)}" alt="${escapeAttr(b.name)}">`
        : `<span class="band-badge-text" title="${escapeAttr(b.name)}">${escapeHTML(b.name.slice(0, 2))}</span>`;
    }).join('');
  }

  function _updateSummary() {
    document.getElementById('summary-count').textContent = _entries.length + '대';
    document.getElementById('summary-sales').textContent =
      formatWon(_entries.reduce((s, e) => s + (Number(e.salesAmount) || 0), 0));
    document.getElementById('summary-commission').textContent =
      formatWon(_entries.reduce((s, e) => s + (Number(e.commissionCash) || 0), 0));
    document.getElementById('summary-passengers').textContent =
      _entries.reduce((s, e) => s + (Number(e.passengerCount) || 0), 0) + '명';
  }

  async function openEntryModal(entryId) {
    _removedPhotoUrls = new Set();
    await bands.ensureLoaded();
    const isEdit = !!entryId;
    const entry = isEdit ? _entries.find(e => e.id === entryId) : null;
    const allBands = bands.getAll();

    const places = _qs.departurePlaces || [];
    const placeChips = places.length > 0
      ? `<div class="quick-chips" id="from-chips"></div>`
      : '';

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
            <input type="text" name="busCompany" value="${escapeAttr(entry?.busCompany || '')}" placeholder="예: 금화고속, 우성여행사" required>
          </div>
          <div class="form-group">
            <label>기사명</label>
            <input type="text" name="driverName" value="${escapeAttr(entry?.driverName || '')}" placeholder="기사님 성함">
          </div>
          <div class="form-group">
            <label>전화번호</label>
            <input type="tel" name="phoneNumber" value="${escapeAttr(entry?.phoneNumber || '')}" placeholder="010-0000-0000">
          </div>
          <div class="form-group">
            <label>출발지 (관광지)</label>
            ${placeChips}
            <input type="text" name="departureFrom" id="input-from" value="${escapeAttr(entry?.departureFrom || '')}" placeholder="예: 해남, 강진, 완도">
          </div>
          <div class="form-group">
            <label>손님 수 (명)</label>
            <input type="number" name="passengerCount" value="${entry?.passengerCount || ''}" placeholder="0" min="0">
          </div>
          <div class="form-group">
            <label>판매금액 (원)</label>
            <input type="text" inputmode="numeric" name="salesAmount" value="${entry?.salesAmount ? Number(entry.salesAmount).toLocaleString('ko-KR') : ''}" placeholder="0">
          </div>
          <div class="form-group">
            <label>커미션 - 현금 (원)</label>
            <input type="text" inputmode="numeric" name="commissionCash" value="${entry?.commissionCash ? Number(entry.commissionCash).toLocaleString('ko-KR') : ''}" placeholder="0">
          </div>
          <div class="form-group">
            <label>커미션 - 물건</label>
            <input type="text" name="commissionGoods" value="${escapeAttr(entry?.commissionGoods || '')}" placeholder="예: 홍어 1마리, 갈치 3마리">
          </div>
        </div>

        <div class="form-group full">
          <label>밴드 선택 (복수 선택 가능)</label>
          <div class="band-checkboxes">${bandChecks}</div>
        </div>

        <div class="form-group full">
          <label>메모 / 비고</label>
          <textarea name="notes" placeholder="특이사항, 드린 물건, 손님 관련 메모 등">${escapeHTML(entry?.notes || '')}</textarea>
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

    initMoneyInput(document.querySelector('#bus-form [name="salesAmount"]'));
    initMoneyInput(document.querySelector('#bus-form [name="commissionCash"]'));

    const chipsEl = document.getElementById('from-chips');
    if (chipsEl && places.length > 0) {
      renderChips(chipsEl, places, val => {
        document.getElementById('input-from').value = val;
      });
    }

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
      departureFrom: form.querySelector('[name="departureFrom"]').value.trim(),
      passengerCount: Number(form.querySelector('[name="passengerCount"]').value) || 0,
      salesAmount: parseMoneyInput(form.querySelector('[name="salesAmount"]').value),
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

      if (data.departureFrom) {
        const places = _qs.departurePlaces || [];
        if (!places.includes(data.departureFrom)) {
          places.unshift(data.departureFrom);
          _qs.departurePlaces = places.slice(0, 15);
          saveQuickSelect({ departurePlaces: _qs.departurePlaces });
        }
      }

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
    if (!await confirmDialog('이 기록을 삭제하시겠습니까?')) return;
    try {
      await userCol('busEntries').doc(entryId).delete();
      showToast('삭제되었습니다');
      await load();
    } catch (e) {
      showToast('삭제 실패: ' + e.message, 'error');
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
    _galleryState = { urls: photoURLs, idx: 0 };
    _renderGalleryModal();
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
      <button class="btn-outline" onclick="busLedger.downloadCurrentPhoto()">⬇ 다운로드</button>
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
  }

  function _removeExistingPhoto(url, idx) {
    _removedPhotoUrls.add(url);
    const el = document.getElementById('cp-' + idx);
    if (el) el.style.display = 'none';
  }

  async function downloadCurrentPhoto() {
    const { urls, idx } = _galleryState;
    const url = urls[idx];
    showToast('다운로드 중...', 'info');

    function _getStorageRef() {
      const m = url.match(/\/o\/([^?#]+)/);
      if (m) return storage.ref(decodeURIComponent(m[1]));
      return storage.refFromURL(url);
    }

    // blob 획득
    let blob = null;
    try {
      const ref = _getStorageRef();
      blob = typeof ref.getBlob === 'function'
        ? await ref.getBlob()
        : new Blob([await ref.getBytes()], { type: 'image/jpeg' });
    } catch (e1) {
      console.warn('[download] SDK:', e1.message);
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(resp.status);
        blob = await resp.blob();
      } catch (e2) {
        console.warn('[download] fetch:', e2.message);
      }
    }

    if (!blob) {
      window.open(url, '_blank');
      showToast('새 탭에서 사진을 길게 눌러 저장하세요', 'info');
      return;
    }

    const filename = `photo_${idx + 1}.jpg`;

    // 모바일: 네이티브 공유 시트 → "사진에 저장" 선택 가능
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && navigator.canShare) {
      const file = new File([blob], filename, { type: 'image/jpeg' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (e) {
          if (e.name === 'AbortError') return; // 사용자가 취소
          console.warn('[download] share:', e.message);
        }
      }
    }

    // PC: 파일 직접 다운로드
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
      const totalSales = visits.reduce((s, v) => s + (Number(v.salesAmount) || 0), 0);
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
      v.salesAmount ? '판매 ' + formatWon(v.salesAmount) : '',
      v.commissionCash ? '커미션 ' + formatWon(v.commissionCash) : '',
      v.passengerCount ? v.passengerCount + '명' : ''
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
