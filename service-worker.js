// ==========================================
// service-worker.js — 퇴근확인 PWA 오프라인 캐시
// ==========================================

var CACHE_NAME = 'daily-check-v1';

// 캐시할 파일 목록 (앱 껍데기)
var CACHE_FILES = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

// 설치 시: 캐시 파일 저장
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CACHE_FILES);
    })
  );
  self.skipWaiting();
});

// 활성화 시: 이전 버전 캐시 삭제
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keyList) {
      return Promise.all(
        keyList.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 요청 가로채기: 캐시 우선, 없으면 네트워크
self.addEventListener('fetch', function (event) {
  // GAS(구글 앱스크립트) 전송 요청은 캐시하지 않고 그냥 통과
  if (event.request.url.indexOf('script.google.com') !== -1) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
