// ⬆️ MỖI KHI CẬP NHẬT APP, CHỈ CẦN ĐỔI SỐ VERSION NÀY
const APP_VERSION = '1.7.0';
const CACHE_NAME = `attendance-v${APP_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './design-system.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('attendance-v') && k !== CACHE_NAME)
        .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
