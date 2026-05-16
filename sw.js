/* ============================================
   Service Worker
   负责：离线缓存 + 后台保活心跳
   ============================================ */

/* [SW-CONFIG] */
const SW_VERSION = 'v1.0.0';
const CACHE_NAME = `petapp-${SW_VERSION}`;

// 需要预缓存的静态资源
const PRECACHE_URLS = [
  './',
  './index.html',
  './css/main.css',
  './css/themes.css',
  './css/animations.css',
  './js/logger.js',
  './js/db.js',
  './js/prompts.js',
  './js/ai.js',
  './js/pet.js',
  './js/timer.js',
  './js/aiParent.js',
  './js/chat.js',
  './js/scenes.js',
  './js/friends.js',
  './js/settings.js',
  './js/ui.js',
  './js/app.js',
  'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js'
];
/* [/SW-CONFIG] */

/* ============================================
   安装事件：预缓存静态资源
   ============================================ */
/* [SW-INSTALL] */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] 预缓存部分失败:', err))
  );
});
/* [/SW-INSTALL] */

/* ============================================
   激活事件：清理旧缓存
   ============================================ */
/* [SW-ACTIVATE] */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});
/* [/SW-ACTIVATE] */

/* ============================================
   请求拦截：缓存优先策略
   网络请求失败时回退到缓存
   ============================================ */
/* [SW-FETCH] */
self.addEventListener('fetch', event => {
  // 只处理 GET 请求，跳过 API 调用
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // AI API 请求不走缓存，直接放行
  if (
    url.pathname.includes('/v1/') ||
    url.hostname.includes('openai.com') ||
    url.hostname.includes('deepseek.com') ||
    url.hostname.includes('api.')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          // 只缓存成功的响应
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => {
          // 离线时返回 index.html 兜底
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
/* [/SW-FETCH] */

/* ============================================
   后台心跳：定时触发宠物状态衰减
   通过 postMessage 与主页面通信
   ============================================ */
/* [SW-HEARTBEAT] */
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 每 5 分钟一次
let heartbeatTimer = null;

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(async () => {
    const clients = await self.clients.matchAll({ type: 'window' });
    if (clients.length === 0) return;

    clients.forEach(client => {
      client.postMessage({
        type: 'SW_HEARTBEAT',
        timestamp: Date.now()
      });
    });
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// 监听主页面消息
self.addEventListener('message', event => {
  const { type } = event.data || {};

  switch (type) {
    case 'START_HEARTBEAT':
      startHeartbeat();
      event.source.postMessage({ type: 'SW_READY', version: SW_VERSION });
      break;

    case 'STOP_HEARTBEAT':
      stopHeartbeat();
      break;

    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.source.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
      break;

    default:
      break;
  }
});
/* [/SW-HEARTBEAT] */

/* ============================================
   推送通知（预留，暂未启用）
   ============================================ */
/* [SW-PUSH] */
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || '小宠物', {
    body: data.body || '',
    icon: './assets/icon-192.png',
    badge: './assets/icon-192.png',
    tag: 'pet-notification',
    renotify: true
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow('./');
      }
    })
  );
});
/* [/SW-PUSH] */

