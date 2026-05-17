// sw.js
// Service Worker — 后台通知检查
// 每 30 分钟检查宠物状态，低于阈值时推送通知

const SW_VERSION = 'petos-sw-v1';

// ── 安装 & 激活 ──────────────────────────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// ── 定时检查（通过 periodicsync 或 message 触发）────────────
self.addEventListener('message', async (e) => {
  if (e.data?.type === 'CHECK_PET_STATUS') {
    await checkAndNotify();
  }
});

// ── 打开 IndexedDB（SW 内独立读取）──────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('PetDB', 1);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function getRecord(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

// ── 检查状态并推送 ───────────────────────────────────────────
async function checkAndNotify() {
  let db;
  try {
    db = await openDB();
  } catch (_) {
    return; // DB 未初始化，跳过
  }

  const [pet, settings] = await Promise.all([
    getRecord(db, 'pet',      'singleton'),
    getRecord(db, 'settings', 'singleton'),
  ]);

  if (!pet || !settings?.notifyEnabled) return;

  const thresholds = settings.notifyThresholds || {
    hunger: 20, mood: 20, health: 20, clean: 20,
  };

  const alerts = [];
  if (pet.hunger < thresholds.hunger) alerts.push(`🍖 饱食度过低 (${Math.round(pet.hunger)})`);
  if (pet.mood   < thresholds.mood)   alerts.push(`😢 心情很差 (${Math.round(pet.mood)})`);
  if (pet.health < thresholds.health) alerts.push(`❤️ 健康告急 (${Math.round(pet.health)})`);
  if (pet.clean  < thresholds.clean)  alerts.push(`🚿 需要洗澡 (${Math.round(pet.clean)})`);

  if (!alerts.length) return;

  const petName = pet.name || '宠物';
  self.registration.showNotification(`${petName} 需要你！`, {
    body:    alerts.join('\n'),
    icon:    pet.avatarUrl || '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     'pet-status-alert',
    renotify: true,
    data:    { url: '/' },
  });
}

// ── 点击通知跳转 ─────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(e.notification.data?.url || '/');
    })
  );
});
// sw.js
// Service Worker — 后台通知检查
const SW_VERSION = 'petos-sw-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', async (e) => {
  if (e.data?.type === 'CHECK_PET_STATUS')  await checkAndNotify();
  if (e.data?.type === 'CHECK_ADVENTURE')   await checkAdventureEnd();
});

// ── IndexedDB 工具 ───────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('PetDB', 1);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function getRecord(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

// ── 宠物状态检查 ─────────────────────────────────────────────
async function checkAndNotify() {
  let db;
  try { db = await openDB(); } catch (_) { return; }

  const [pet, settings] = await Promise.all([
    getRecord(db, 'pet',      'singleton'),
    getRecord(db, 'settings', 'singleton'),
  ]);

  if (!pet || !settings?.notifyEnabled) return;

  const thresholds = settings.notifyThresholds || {
    hunger: 20, mood: 20, health: 20, clean: 20,
  };

  const alerts = [];
  if (pet.hunger < thresholds.hunger) alerts.push(`🍖 饱食度过低 (${Math.round(pet.hunger)})`);
  if (pet.mood   < thresholds.mood)   alerts.push(`😢 心情很差 (${Math.round(pet.mood)})`);
  if (pet.health < thresholds.health) alerts.push(`❤️ 健康告急 (${Math.round(pet.health)})`);
  if (pet.clean  < thresholds.clean)  alerts.push(`🚿 需要洗澡 (${Math.round(pet.clean)})`);

  if (!alerts.length) return;

  const petName = pet.name || '宠物';
  self.registration.showNotification(`${petName} 需要你！`, {
    body:     alerts.join('\n'),
    icon:     pet.avatarUrl || '/icon-192.png',
    badge:    '/icon-192.png',
    tag:      'pet-status-alert',
    renotify: true,
    data:     { url: '/', type: 'status' },
  });
}

// ── 冒险结束检查 ─────────────────────────────────────────────
async function checkAdventureEnd() {
  let db;
  try { db = await openDB(); } catch (_) { return; }

  const settings = await getRecord(db, 'settings', 'singleton');
  const adv = settings?.activeAdventure;

  if (!adv || !adv.endAt) return;
  if (Date.now() < adv.endAt) return;  // 还没到时间

  // 已结束，推送通知
  const pet     = await getRecord(db, 'pet', 'singleton');
  const petName = pet?.name || '宠物';
  const icon    = adv.sceneIcon || '🗺';

  const body = adv.pomodoro && adv.taskName
    ? `「${adv.taskName}」专注完成！${petName} 等你回来夸你 ✨`
    : `${petName} 的「${adv.sceneLabel}」冒险结束啦，快回来看看！`;

  self.registration.showNotification(`${icon} 冒险结束！`, {
    body,
    icon:     pet?.avatarUrl || '/icon-192.png',
    badge:    '/icon-192.png',
    tag:      'adventure-end',
    renotify: true,
    data:     { url: '/', type: 'adventure' },
  });
}

// ── 点击通知跳转 ─────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(e.notification.data?.url || '/');
    })
  );
});

