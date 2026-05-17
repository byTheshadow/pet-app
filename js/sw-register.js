// js/sw-register.js
// Service Worker 注册 + 定时触发通知检查
// 每 30 分钟向 SW 发一次 CHECK_PET_STATUS 消息

const SW_CHECK_INTERVAL = 30 * 60 * 1000; // 30 分钟

export async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[sw-register] Service Worker not supported');
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.info('[sw-register] SW registered, scope:', reg.scope);

    // SW 更新时自动激活
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.info('[sw-register] New SW installed, will activate on next reload');
        }
      });
    });
  } catch (err) {
    console.error('[sw-register] SW registration failed:', err);
  }
}

// ── 向 SW 发送状态检查消息 ───────────────────────────────────
async function sendCheckMessage() {
  if (!navigator.serviceWorker?.controller) return;

  // 只在通知权限已授权时才发
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    navigator.serviceWorker.controller.postMessage({ type: 'CHECK_PET_STATUS' });
    console.debug('[sw-register] CHECK_PET_STATUS sent');
  } catch (err) {
    console.warn('[sw-register] Failed to send check message:', err);
  }
}

// ── 启动定时检查 ─────────────────────────────────────────────
// 页面加载后立即检查一次，之后每 30 分钟检查一次
export function startNotifyScheduler() {
  // 延迟 5 秒再发第一次，等 SW 激活完成
  setTimeout(sendCheckMessage, 5000);
  setInterval(sendCheckMessage, SW_CHECK_INTERVAL);
}
