// ===== 메인 앱 초기화 =====
let _tabInitialized = {};

document.addEventListener('DOMContentLoaded', () => {
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
  // 밴드 데이터를 먼저 로드 (다른 모듈에서 참조)
  await bands.ensureLoaded();
  // 버스 기사 장부 초기화
  await busLedger.init();
  _tabInitialized['bus'] = true;
  // 밴드 추가 버튼
  document.getElementById('btn-add-band').addEventListener('click', () => bands.openModal(null));
  // 검색 초기화
  search.init();
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));

  if (_tabInitialized[tab]) {
    // 이미 초기화된 탭: 버스장부는 현재 날짜 데이터 새로고침
    if (tab === 'bus') busLedger.load();
    return;
  }

  _tabInitialized[tab] = true;

  switch (tab) {
    case 'reservation': reservation.load(); break;
    case 'purchase': purchase.load(); break;
    case 'cashflow': cashflow.load(); break;
    case 'band': bands.load(); break;
    case 'search': break;
  }
}
