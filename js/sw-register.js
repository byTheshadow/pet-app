// js/sw-register.js
// Service Worker 注册 + 定时触发通知检查
// 每 30 分钟向 SW 发一次 CHECK_PET_STATUS 消息
//
// ⚠️ GitHub Pages 子路径兼容：
//    sw.js 必须放在仓库根目录（和 index.html 同级）
//    scope 动态从当前页面 URL 推算，不硬编码 /pet-app/

const SW_CHECK_INTERVAL = 30 * 60 * 1000; // 30 分钟

// 动态算出 sw.js 的绝对路径（和 index.html 同目录）
// import.meta.url = "https://xxx.github.io/pet-app/js/sw-register.js"
// → swUrl          = "https://xxx.github.io/pet-app/sw.js"
// → swScope        = "https://xxx.github.io/pet-app/"
function _getSwPaths() {
  const base  = new URL('./', import.meta.url);          // js/ 目录
  const root  = new URL('../', base);                    // 仓库根目录（index.html 所在）
  const swUrl = new URL('sw.js', root).href;
  const scope = root.href;
  return { swUrl, scope };
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

  // 只在通知权限已授权时才发，避免无效调用
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    navigator.serviceWorker.controller.postMessage({ type: 'CHECK_PET_STATUS' });
    console.debug('[sw-register] CHECK_PET_STATUS sent');
  } catch (err) {
    console.warn('[sw-register] Failed to send check message:', err);
  }
}

// ── 启动定时检查 ─────────────────────────────────────────────
// 页面加载后延迟 5 秒发第一次（等 SW 激活），之后每 30 分钟一次
export function startNotifyScheduler() {
  setTimeout(sendCheckMessage, 5000);
  setInterval(sendCheckMessage, SW_CHECK_INTERVAL);
}

