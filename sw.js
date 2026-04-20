// ============================================================
// BUILD_TIME: cập nhật timestamp này mỗi khi bạn deploy
// Cách nhanh: copy giá trị Date.now() hiện tại vào đây
// Hoặc dùng bất kỳ chuỗi version nào, ví dụ: '2026-04-20-v2'
// ============================================================
const BUILD_TIME = '2026-04-20-001';
const CACHE_NAME = 'quiz-app-' + BUILD_TIME;

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './questions.json',
  './manifest.json'
];

// ===== INSTALL: cache tất cả file cần thiết =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      // Kích hoạt ngay, không chờ tab cũ đóng
      return self.skipWaiting();
    }).catch(err => {
      console.warn('[SW] Precache failed:', err);
    })
  );
});

// ===== ACTIVATE: xóa cache cũ, báo trang có bản mới =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => {
      // Claim tất cả client ngay lập tức
      return self.clients.claim();
    }).then(() => {
      // Broadcast cho tất cả tab biết có SW mới
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: BUILD_TIME });
        });
      });
    })
  );
});

// ===== MESSAGE: nhận lệnh SKIP_WAITING từ trang =====
// Khi người dùng bấm "Tải lại" trên banner → trang gửi message này
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ===== FETCH: Network First → Cache Fallback =====
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  // Font Google: Cache First (tránh request không cần thiết)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // File local: Network First → Cache Fallback
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        return new Response('Offline - Không có kết nối mạng', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })
  );
});
