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

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getMonthStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
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
async function loadQuickSelect() {
  try {
    const doc = await db.collection('store').doc('main')
      .collection('settings').doc('quickSelect').get();
    return doc.exists ? doc.data() : {};
  } catch { return {}; }
}

async function saveQuickSelect(data) {
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
  return `<a href="tel:${clean}" class="phone-link" onclick="event.stopPropagation()" title="전화하기">${phone}</a><button class="phone-copy-btn" onclick="event.stopPropagation();navigator.clipboard.writeText('${phone}').then(()=>showToast('번호 복사됨'))" title="복사">📋</button>`;
}

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
