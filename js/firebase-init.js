// ============================================================
// Firebase 설정
// ============================================================
// Firebase Console (https://console.firebase.google.com) 에서
// 프로젝트 생성 후 아래 값들을 채워주세요.
//
// 설정 방법:
// 1. Firebase Console → 프로젝트 설정 → 앱 추가 → 웹
// 2. 아래 firebaseConfig 객체에 복사해서 붙여넣기
//
// Firebase에서 활성화 필요한 서비스:
// - Authentication → Google 로그인 사용 설정
// - Firestore Database → 데이터베이스 만들기
// - Storage → 사진 저장용 (Firebase Console → Storage → 시작하기)
//
// Storage 보안 규칙 (Firebase Console → Storage → 규칙 탭):
// rules_version = '2';
// service firebase.storage {
//   match /b/{bucket}/o {
//     function isAllowed() {
//       return request.auth != null
//         && request.auth.token.email_verified == true
//         && request.auth.token.email in [
//           'snackpong25@gmail.com',
//           'ymin2741@gmail.com',
//           'suhyn7314@gmail.com'
//         ];
//     }
//     match /photos/{allPaths=**} {
//       allow read, write: if isAllowed();
//     }
//   }
// }
//
// Firestore 보안 규칙 (Firebase Console → Firestore → 규칙 탭에 붙여넣기):
// ※ 이메일 3개를 실제 가족 이메일로 교체 후 적용
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     function isAllowed() {
//       return request.auth != null
//         && request.auth.token.email_verified == true
//         && request.auth.token.email in [
//           'snackpong25@gmail.com',
//           'ymin2741@gmail.com',
//           'suhyn7314@gmail.com'
//         ];
//     }
//     // 가족 공유 데이터 (세 계정 모두 읽기/쓰기 가능)
//     match /store/main/{document=**} {
//       allow read, write: if isAllowed();
//     }
//   }
// }
//
// Firestore 복합 인덱스 필요:
// - 컬렉션: busEntries | 필드: date (오름차순), daySequence (오름차순)
// - 컬렉션: busEntries | 필드: bandIds (배열), date (내림차순)
// → 첫 실행 시 콘솔 오류 메시지에 인덱스 생성 링크가 나타납니다.
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyDBLclaSz-zeI93YVHdGT8o2_NBDzTBHfo",
  authDomain: "daily-sales-dc1a8.firebaseapp.com",
  projectId: "daily-sales-dc1a8",
  storageBucket: "daily-sales-dc1a8.firebasestorage.app",
  messagingSenderId: "543078597400",
  appId: "1:543078597400:web:7917b69d1ad7a262b7946d",
  measurementId: "G-4T8VGCC5XX"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Firestore 오프라인 캐시: IndexedDB에 저장 → 앱 재시작 시 즉시 표시
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code !== 'failed-precondition' && err.code !== 'unimplemented')
    console.warn('Firestore persistence 비활성화:', err.code);
});

// 모바일 브라우저 호환성: localStorage 기반 인증 유지
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
