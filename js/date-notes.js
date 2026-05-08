// ===== 날짜 메모 (공휴일 이름 + 커스텀 라벨) =====
const dateNotes = (() => {
  let _notes = {};
  let _pendingDate = null;
  let _pendingCb = null;

  async function load() {
    try {
      const doc = await userCol('settings').doc('dateNotes').get();
      _notes = doc.exists ? (doc.data() || {}) : {};
    } catch (e) {
      console.error('dateNotes load error', e);
      _notes = {};
    }
  }

  function get(dateStr) {
    return _notes[dateStr] || null;
  }

  async function set(dateStr, note) {
    const trimmed = (note || '').trim();
    if (trimmed) {
      _notes[dateStr] = trimmed;
    } else {
      delete _notes[dateStr];
    }
    try {
      await userCol('settings').doc('dateNotes').set(_notes);
    } catch (e) {
      showToast('메모 저장 실패: ' + e.message, 'error');
    }
  }

  function openEditor(dateStr, onSaved) {
    _pendingDate = dateStr;
    _pendingCb = onSaved || null;

    const current = _notes[dateStr] || '';
    const holName = holidays.getName(dateStr);

    const body = `
      <div style="font-size:14px;color:var(--text-light);margin-bottom:12px">
        ${holName ? `<span style="color:var(--danger);font-weight:600">${holName}</span> — ` : ''}
        이날에 표시할 짧은 메모를 입력하세요.<br>
        <span style="font-size:12px">(캘린더 날짜 옆에 작게 표시됩니다)</span>
      </div>
      <div class="form-group">
        <label>메모</label>
        <input type="text" id="date-note-input" class="form-control"
          value="${current}" placeholder="예: 할인행사, 단체손님 예정..." maxlength="10"
          style="font-size:16px">
      </div>
    `;

    const footer = `
      <button class="btn-outline" onclick="closeModal()">취소</button>
      ${current ? `<button class="btn-danger btn-sm" onclick="dateNotes._clear()">메모 삭제</button>` : ''}
      <button class="btn-primary" onclick="dateNotes._save()">저장</button>
    `;

    openModal('날짜 메모 편집', body, footer);
    setTimeout(() => {
      const inp = document.getElementById('date-note-input');
      if (inp) inp.focus();
    }, 100);
  }

  async function _save() {
    const val = (document.getElementById('date-note-input')?.value || '').trim();
    await set(_pendingDate, val);
    showToast(val ? '메모가 저장되었습니다' : '메모가 삭제되었습니다');
    closeModal();
    if (typeof _pendingCb === 'function') _pendingCb();
  }

  async function _clear() {
    await set(_pendingDate, '');
    showToast('메모가 삭제되었습니다');
    closeModal();
    if (typeof _pendingCb === 'function') _pendingCb();
  }

  return { load, get, set, openEditor, _save, _clear };
})();
