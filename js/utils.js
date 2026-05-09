// ===== 유틸리티 함수 =====

function formatWon(amount) {
  if (!amount && amount !== 0) return '-';
  const n = Number(amount);
  if (n === 0) return '0원';
  return n.toLocaleString('ko-KR') + '원';
}

function formatDateKo(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const date = new Date(y, m - 1, d);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${y}년 ${m}월 ${d}일 (${days[date.getDay()]})`;
}

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateInput(dateStr) {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function getTodayStr() {
  return toDateInputValue(new Date());
}

function getMonthStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function addDays(dateStr, n) {
  const d = parseDateInput(dateStr);
  d.setDate(d.getDate() + n);
  return toDateInputValue(d);
}

function addMonths(monthStr, n) {
  const [y, m] = (monthStr || getMonthStr()).split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  d.setMonth(d.getMonth() + n);
  return getMonthStr(d);
}

function escapeHTML(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function escapeJSString(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeInlineJS(value) {
  return escapeAttr(escapeJSString(value));
}

function getUserId() {
  return auth.currentUser ? auth.currentUser.uid : null;
}

function userCol(colName) {
  return db.collection('store').doc('main').collection(colName);
}

// ===== 토스트 =====
let toastTimer = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ===== 모달 =====
function openModal(title, bodyHTML, footerHTML = '') {
  document.querySelector('.modal-box').style.maxWidth = '';
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-footer').innerHTML = footerHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.addEventListener('keydown', _escHandler);
  // 첫 번째 입력 포커스
  setTimeout(() => {
    const first = document.querySelector('#modal-body input:not([type="file"]):not([type="checkbox"])');
    if (first) first.focus();
  }, 100);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.removeEventListener('keydown', _escHandler);
}

function _escHandler(e) {
  if (e.key === 'Escape') closeModal();
}

// ===== 빠른선택 칩 렌더 =====
let _qsCache = null;

async function loadQuickSelect() {
  if (_qsCache) return { ..._qsCache };
  try {
    const doc = await db.collection('store').doc('main')
      .collection('settings').doc('quickSelect').get();
    _qsCache = doc.exists ? doc.data() : {};
    return { ..._qsCache };
  } catch { return {}; }
}

async function saveQuickSelect(data) {
  if (_qsCache) Object.assign(_qsCache, data);
  await db.collection('store').doc('main')
    .collection('settings').doc('quickSelect').set(data, { merge: true });
}

function renderChips(container, items, onSelect) {
  container.innerHTML = '';
  if (!items || items.length === 0) return;
  items.forEach(item => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = item;
    chip.onclick = () => onSelect(item);
    container.appendChild(chip);
  });
}

// ===== 확인 대화상자 (Promise 기반) =====
function confirmDialog(msg) {
  return new Promise(resolve => resolve(confirm(msg)));
}

// ===== 전화번호 링크 (모바일 통화 + 복사 버튼) =====
function phoneLink(phone) {
  if (!phone) return '-';
  const clean = phone.replace(/\s/g, '');
  return `<a href="tel:${escapeAttr(clean)}" class="phone-link" onclick="event.stopPropagation()" title="전화하기">${escapeHTML(phone)}</a><button class="phone-copy-btn" onclick="event.stopPropagation();navigator.clipboard.writeText('${escapeInlineJS(phone)}').then(()=>showToast('번호 복사됨'))" title="복사">📋</button>`;
}

Object.assign(window, {
  formatWon,
  formatDateKo,
  toDateInputValue,
  parseDateInput,
  getTodayStr,
  getMonthStr,
  addDays,
  addMonths,
  escapeHTML,
  escapeAttr,
  escapeJSString,
  escapeInlineJS,
  getUserId,
  userCol,
  showToast,
  openModal,
  closeModal,
  loadQuickSelect,
  saveQuickSelect,
  renderChips,
  confirmDialog,
  phoneLink,
  initMoneyInput,
  parseMoneyInput,
  uploadPhoto
});

// ===== 금액 입력 콤마 포맷 =====
function initMoneyInput(el) {
  if (!el) return;
  el.addEventListener('input', () => {
    const raw = el.value.replace(/[^0-9]/g, '');
    el.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
  });
}

function parseMoneyInput(val) {
  return Number((val || '').replace(/[^0-9]/g, '')) || 0;
}

// ===== 이미지 압축 후 Firebase Storage 업로드 =====
async function uploadPhoto(file, path) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    showToast('이미지 파일만 업로드할 수 있습니다', 'error');
    throw new Error('Invalid upload file type');
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast('사진은 20MB 이하만 업로드할 수 있습니다', 'error');
    throw new Error('Upload file too large');
  }
  const dataUrl = await _compressImage(file, 1200, 0.80);
  const blob = await fetch(dataUrl).then(r => r.blob());
  const ref = storage.ref(path);
  await ref.put(blob, { contentType: 'image/jpeg' });
  return ref.getDownloadURL();
}

function _compressImage(file, maxW, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
