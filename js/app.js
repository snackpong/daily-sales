// ===== 메인 앱 초기화 =====
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
