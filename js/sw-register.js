// js/sw-register.js
const SW_CHECK_INTERVAL  = 30 * 60 * 1000;  // 30 分钟：宠物状态检查
const ADV_CHECK_INTERVAL =      60 * 1000;  // 1 分钟：冒险结束检查

function _getSwPaths() {
  const base  = new URL('./', import.meta.url);
  const root  = new URL('../', base);
  return { swUrl: new URL('sw.js', root).href, scope: root.href };
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[sw-register] Service Worker not supported');
    return;
  }
  const { swUrl, scope } = _getSwPaths();
  try {
    const reg = await navigator.serviceWorker.register(swUrl, { scope });
    console.info('[sw-register] SW registered, scope:', reg.scope);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller)
          console.info('[sw-register] New SW ready');
      });
    });
  } catch (err) {
    console.error('[sw-register] SW registration failed:', err);
  }
}

async function _send(type) {
  if (!navigator.serviceWorker?.controller) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    navigator.serviceWorker.controller.postMessage({ type });
  } catch (err) {
    console.warn('[sw-register] postMessage failed:', err);
  }
}

export function startNotifyScheduler() {
  // 宠物状态：延迟5秒首次，之后每30分钟
  setTimeout(() => _send('CHECK_PET_STATUS'), 5000);
  setInterval(() => _send('CHECK_PET_STATUS'), SW_CHECK_INTERVAL);

  // 冒险结束：延迟3秒首次，之后每1分钟
  setTimeout(() => _send('CHECK_ADVENTURE'), 3000);
  setInterval(() => _send('CHECK_ADVENTURE'), ADV_CHECK_INTERVAL);
}


