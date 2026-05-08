// ===== 메인 앱 초기화 =====

// 허가된 구글 이메일 목록 — 이 세 개 계정만 앱 사용 가능
const ALLOWED_EMAILS = [
  'snackpong25@gmail.com',  // 본인
  'ymin2741@gmail.com',     // 엄마
  'suhyn7314@gmail.com',    // 누나
];

let _tabInitialized = {};

function _checkInAppBrowser() {
  const ua = navigator.userAgent || '';
  const isInApp = /KAKAOTALK|NAVER|Line\/|Instagram|FBAN|FBAV/i.test(ua);
  if (!isInApp) return;

  const box = document.querySelector('.login-box');
  box.insertAdjacentHTML('afterbegin', `
    <div class="inapp-warning">
      <strong>⚠️ 카카오톡 브라우저에서는 로그인이 되지 않습니다.</strong><br>
      아래 버튼을 눌러 외부 브라우저(Chrome / Safari)에서 열어주세요.
      <button class="btn-open-browser" onclick="_openInSystemBrowser()">외부 브라우저로 열기</button>
    </div>
  `);
}

function _openInSystemBrowser() {
  const url = location.href;
  // Android: intent scheme으로 Chrome 강제 실행
  const intentUrl = 'intent://' + url.replace(/https?:\/\//, '') +
    '#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end;';
  location.href = intentUrl;
  // iOS는 intent가 안 되므로 일정 시간 후 안내 toast
  setTimeout(() => {
    alert('iOS의 경우: 화면 하단 메뉴(···) → "Safari로 열기" 를 선택해 주세요.');
  }, 1500);
}

document.addEventListener('DOMContentLoaded', () => {
  _checkInAppBrowser();
  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 구글 로그인
  document.getElementById('btn-google-login').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => {
      showToast('로그인 실패: ' + e.message, 'error');
    });
  });

  // 로그아웃
  document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm('로그아웃 하시겠습니까?')) auth.signOut();
  });

  // 모달 닫기
  document.getElementById('btn-modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Auth 상태 감지
  auth.onAuthStateChanged(user => {
    if (user) {
      if (!ALLOWED_EMAILS.filter(Boolean).includes(user.email)) {
        auth.signOut();
        _showAccessDenied(user.email);
        return;
      }
      _hideAccessDenied();
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('user-name').textContent = user.displayName || user.email;
      _onSignIn();
    } else {
      document.getElementById('login-screen').classList.remove('hidden');
      document.getElementById('app').classList.add('hidden');
      _tabInitialized = {};
    }
  });
});

function _showAccessDenied(email) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  let el = document.getElementById('access-denied-screen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'access-denied-screen';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="access-denied-box">
      <div class="access-denied-icon">🔒</div>
      <h2>접근 권한이 없습니다</h2>
      <p>이 서비스는 허가된 가족 계정만 사용할 수 있습니다.</p>
      <p class="access-denied-email">${email}</p>
      <p class="access-denied-hint">위 계정은 허가되지 않은 계정입니다.</p>
      <button class="btn-google" onclick="_retryLogin()">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.93 2.31-8.16 2.31-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        다른 계정으로 로그인
      </button>
    </div>
  `;
  el.classList.remove('hidden');
}

function _hideAccessDenied() {
  const el = document.getElementById('access-denied-screen');
  if (el) el.classList.add('hidden');
}

function _retryLogin() {
  _hideAccessDenied();
  document.getElementById('login-screen').classList.remove('hidden');
}

async function _onSignIn() {
  await bands.ensureLoaded();
  await home.load();
  _tabInitialized['home'] = true;
  document.getElementById('btn-add-band').addEventListener('click', () => bands.openModal(null));
  search.init();
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));

  if (_tabInitialized[tab]) {
    if (tab === 'home') home.load();
    if (tab === 'bus') busLedger.load();
    return;
  }

  _tabInitialized[tab] = true;

  switch (tab) {
    case 'bus': busLedger.init(); break;
    case 'reservation': reservation.load(); break;
    case 'purchase': purchase.load(); break;
    case 'cashflow': cashflow.load(); break;
    case 'band': bands.load(); break;
    case 'search': break;
  }
}
