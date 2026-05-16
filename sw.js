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
/* [SCENE-GRID 续] */
.scene-card {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  aspect-ratio: 16/10;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color var(--transition), transform var(--transition),
              box-shadow var(--transition);
}

.scene-card:hover {
  transform: scale(1.02);
  box-shadow: var(--shadow-md);
}

.scene-card.active {
  border-color: var(--accent);
}

.scene-card.locked {
  cursor: not-allowed;
  filter: grayscale(0.6);
}

.scene-card-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-color: var(--bg-secondary);
}

.scene-card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%);
}

.scene-card-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 10px;
}

.scene-card-name {
  font-size: 13px;
  font-weight: 600;
  color: white;
  line-height: 1.2;
}

.scene-card-desc {
  font-size: 10px;
  color: rgba(255,255,255,0.75);
  margin-top: 2px;
}

.scene-lock-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 14px;
  opacity: 0.8;
}
/* [/SCENE-GRID] */

/* ============================================
   表单元素
   ============================================ */
/* [FORMS] */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.form-label .required {
  color: var(--danger);
  margin-left: 2px;
}

.form-input {
  width: 100%;
  padding: 10px 13px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
  transition: border-color var(--transition), box-shadow var(--transition);
}

.form-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
  outline: none;
}

.form-input::placeholder {
  color: var(--text-muted);
}

.form-input.error {
  border-color: var(--danger);
  box-shadow: 0 0 0 3px var(--danger-light);
}

.form-textarea {
  width: 100%;
  padding: 10px 13px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-primary);
  resize: vertical;
  min-height: 90px;
  line-height: 1.6;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.form-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
  outline: none;
}

.form-textarea::placeholder {
  color: var(--text-muted);
}

.form-hint {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}

.form-error {
  font-size: 11px;
  color: var(--danger);
}

/* 下拉选择 */
.form-select {
  width: 100%;
  padding: 10px 36px 10px 13px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23aaaaaa' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  cursor: pointer;
  transition: border-color var(--transition);
}

.form-select:focus {
  border-color: var(--accent);
  outline: none;
}

/* 性格预设标签 */
.personality-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.personality-tag {
  padding: 5px 13px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  border: 1.5px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--transition), border-color var(--transition),
              color var(--transition);
}

.personality-tag:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.personality-tag.selected {
  background: var(--text-primary);
  border-color: var(--text-primary);
  color: var(--text-inverse);
}
/* [/FORMS] */

/* ============================================
   Toast 通知
   ============================================ */
/* [TOAST] */
.toast-container {
  position: fixed;
  top: calc(var(--header-height) + 10px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 500;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  width: calc(100% - 32px);
  max-width: 360px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  background: var(--text-primary);
  color: var(--text-inverse);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  box-shadow: var(--shadow-lg);
  animation: toastIn 0.25s ease;
  pointer-events: all;
  line-height: 1.4;
}

.toast.success { background: var(--success); }
.toast.warning { background: var(--warning); color: var(--text-primary); }
.toast.error   { background: var(--danger); }
.toast.info    { background: var(--text-primary); }

.toast-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.toast-msg {
  flex: 1;
}

.toast.fade-out {
  animation: toastOut 0.25s ease forwards;
}
/* [/TOAST] */

/* ============================================
   加载遮罩
   ============================================ */
/* [LOADING] */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(253, 246, 240, 0.85);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 400;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--accent-dark);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.loading-text {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}
/* [/LOADING] */

/* ============================================
   报错日志面板
   ============================================ */
/* [ERROR-LOG] */
.error-log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.error-log-item {
  padding: 10px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-left: 3px solid var(--danger);
  border-radius: var(--radius-sm);
  font-size: 12px;
  line-height: 1.6;
}

.error-log-item.warn {
  border-left-color: var(--warning);
}

.error-log-item.info {
  border-left-color: var(--accent);
}

.error-log-time {
  color: var(--text-muted);
  font-size: 10px;
  margin-bottom: 3px;
  font-family: var(--font-mono);
}

.error-log-msg {
  color: var(--text-primary);
  word-break: break-all;
}

.error-log-stack {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-log-empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 32px 0;
}
/* [/ERROR-LOG] */

/* ============================================
   事件日志 / 冒险日记
   ============================================ */
/* [EVENT-LOG] */
.event-log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.event-log-item {
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 13px;
  line-height: 1.65;
}

.event-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.event-log-type {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-dark);
  background: var(--accent-light);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.event-log-time {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.event-log-content {
  color: var(--text-secondary);
}

.event-log-delta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}

.delta-tag {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.delta-tag.positive { color: var(--success); border-color: var(--success); }
.delta-tag.negative { color: var(--danger);  border-color: var(--danger); }
/* [/EVENT-LOG] */

/* ============================================
   通知面板
   ============================================ */
/* [NOTIF-PANEL] */
.notif-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notif-item {
  display: flex;
  gap: 10px;
  padding: 11px 13px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
  transition: background var(--transition);
}

.notif-item:hover {
  background: var(--border-light);
}

.notif-item.unread {
  border-left: 3px solid var(--accent);
  background: var(--bg-card);
}

.notif-icon {
  font-size: 18px;
  flex-shrink: 0;
  line-height: 1.3;
}

.notif-body {
  flex: 1;
}

.notif-text {
  color: var(--text-primary);
  margin-bottom: 3px;
}

.notif-time {
  font-size: 10px;
  color: var(--text-muted);
}
/* [/NOTIF-PANEL] */

/* ============================================
   工具类
   ============================================ */
/* [UTILS] */
.hidden {
  display: none !important;
}

.invisible {
  visibility: hidden;
  pointer-events: none;
}

.text-center { text-align: center; }
.text-muted  { color: var(--text-muted); }
.text-danger { color: var(--danger); }
.text-success{ color: var(--success); }

.mt-8  { margin-top: 8px; }
.mt-12 { margin-top: 12px; }
.mt-16 { margin-top: 16px; }
.mb-8  { margin-bottom: 8px; }
.mb-12 { margin-bottom: 12px; }
.mb-16 { margin-bottom: 16px; }

.divider {
  height: 1px;
  background: var(--border-light);
  margin: 12px 0;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
  background: var(--accent-light);
  color: var(--accent-dark);
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.flex-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.scroll-y {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
/* [/UTILS] */

/* ============================================
   桌面端适配
   ============================================ */
/* [DESKTOP] */
@media (min-width: 600px) {
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-secondary);
  }

  /* 整体容器限宽，模拟手机 App */
  .app-header,
  .app-main,
  .bottom-nav {
    max-width: 420px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
  }

  .app-header {
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    border-top: 1px solid var(--border);
  }

  .bottom-nav {
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    border-bottom: 1px solid var(--border);
  }

  /* 桌面端给整体加阴影 */
  .app-main {
    box-shadow: var(--shadow-lg);
  }

  .toast-container {
    left: 50%;
    transform: translateX(-50%);
    max-width: 380px;
  }
}

@media (min-width: 600px) and (min-height: 700px) {
  :root {
    --nav-height: 68px;
    --header-height: 56px;
  }
}
/* [/DESKTOP] */
