// ==========================================
// service-worker.js — PWA 오프라인 캐시
// 역할: 앱 파일을 미리 저장해두어
//       인터넷이 없어도 앱이 열리게 합니다
// ==========================================

// 캐시 이름 (버전 올리면 캐시 갱신됨)
var CACHE_NAME = 'checkout-pwa-v1';

// 오프라인에서도 작동하게 캐시할 파일 목록
var FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

// ── install 이벤트: 처음 설치될 때 파일을 캐시에 저장 ──
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        console.log('캐시 저장 중...');
        return cache.addAll(FILES_TO_CACHE);
      })
  );
  // 새 Service Worker 즉시 활성화
  self.skipWaiting();
});

// ── activate 이벤트: 오래된 캐시 삭제 ──────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keyList) {
      return Promise.all(
        keyList.map(function (key) {
          if (key !== CACHE_NAME) {
            console.log('오래된 캐시 삭제:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ── fetch 이벤트: 네트워크 요청 가로채기 ──────────────
// 캐시에 있으면 캐시에서 응답, 없으면 네트워크에서 가져옴
self.addEventListener('fetch', function (event) {
  // Apps Script 전송 요청은 캐시하지 않음 (항상 네트워크 사용)
  if (event.request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function (response) {
        // 캐시에 있으면 캐시 반환
        if (response) {
          return response;
        }
        // 없으면 네트워크에서 가져옴
        return fetch(event.request);
      })
  );
});

