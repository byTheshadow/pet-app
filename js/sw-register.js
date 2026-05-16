// js/sw-register.js
// Service Worker 注册 + 定时触发状态检查

import { logInfo, logWarn, logError } from './logger.js';

export async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    logWarn('sw', 'Service Worker not supported');
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    logInfo('sw', `SW registered, scope: ${reg.scope}`);

    // 每 30 分钟向 SW 发送检查指令
    setInterval(() => {
      if (reg.active) {
        reg.active.postMessage({ type: 'CHECK_PET_STATUS' });
        logInfo('sw', 'Sent CHECK_PET_STATUS to SW');
      }
    }, 30 * 60 * 1000);

    // 页面可见性变化时也触发一次检查
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && reg.active) {
        reg.active.postMessage({ type: 'CHECK_PET_STATUS' });
      }
    });

  } catch (err) {
    logError('sw', 'SW registration failed: ' + err.message, { stack: err.stack });
  }
}
