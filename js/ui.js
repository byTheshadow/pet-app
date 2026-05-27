// js/ui.js
// 全局 UI 工具：Toast、Modal 确认框、打字动效

import { bus, EVENTS } from './state.js';

// ── Toast ────────────────────────────────────────────────────
// type: 'success' | 'error' | 'info' | 'warn'
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✓', error: '✕', info: 'ℹ', warn: '⚠' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconEl = document.createElement('span');
  iconEl.className = 'toast-icon';
  iconEl.textContent = icons[type] || 'ℹ';

  const msgEl = document.createElement('span');
  msgEl.className = 'toast-msg';
  msgEl.textContent = message; // textContent 防 XSS

  toast.appendChild(iconEl);
  toast.appendChild(msgEl);
  container.appendChild(toast);

  // 自动消失
  const timer = setTimeout(() => _removeToast(toast), duration);

  // 点击提前关闭
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    _removeToast(toast);
  });
}

function _removeToast(toast) {
  toast.classList.add('toast-out');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

// ── Modal 确认框 ─────────────────────────────────────────────
export function showModal({ title, body, confirmText = '确认', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) { resolve(false); return; }

    // 清空旧内容
    overlay.innerHTML = '';

    const box = document.createElement('div');
    box.className = 'modal-box';

    const titleEl = document.createElement('div');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'modal-body';
    bodyEl.textContent = body;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
    confirmBtn.textContent = confirmText;

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    box.appendChild(titleEl);
    box.appendChild(bodyEl);
    box.appendChild(actions);
    overlay.appendChild(box);

    overlay.classList.add('show');

    const close = (result) => {
      overlay.classList.remove('show');
      resolve(result);
    };

    cancelBtn.addEventListener('click',  () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });
  });
}

// ── 打字动效节点 ─────────────────────────────────────────────
export function createTypingIndicator() {
  const wrap = document.createElement('span');
  wrap.className = 'typing-dots';
  wrap.innerHTML = '<span></span><span></span><span></span>';
  return wrap;
}

// ── 按钮 loading 状态 ────────────────────────────────────────
export function setButtonLoading(btn, loading, loadingText = '处理中...', originalText = '') {
  if (!btn) return;
  btn.disabled = loading;

  if (loading) {
    btn.dataset.originalText = originalText || btn.textContent;
    btn.textContent = loadingText;
    btn.classList.add('is-loading');
  } else {
    btn.textContent = btn.dataset.originalText || originalText || btn.textContent;
    btn.classList.remove('is-loading');
  }
}

// ── 更新进度条 ───────────────────────────────────────────────
export function updateStatusBar(key, value) {
  const fill = document.querySelector(`.status-bar-fill.${key}`);
  const val  = document.querySelector(`.status-value[data-key="${key}"]`);
  if (fill) {
    fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
    fill.classList.toggle('low', value < 25);
  }
  if (val) val.textContent = Math.round(value);
}

// ── 更新所有状态条 ───────────────────────────────────────────
export function updateAllStatusBars(pet) {
  if (!pet) return;
  updateStatusBar('hunger', pet.hunger);
  updateStatusBar('mood',   pet.mood);
  updateStatusBar('health', pet.health);
  updateStatusBar('clean',  pet.clean);
  updateStatusBar('bond',   pet.bond);
}

// ── 显示情绪气泡 ─────────────────────────────────────────────
export function showEmotionBubble(text, duration = 4000) {
  const bubble = document.getElementById('emotion-bubble');
  if (!bubble) return;
  bubble.textContent = text;
  bubble.classList.add('show');
  setTimeout(() => bubble.classList.remove('show'), duration);
}

// ── 时钟更新 ─────────────────────────────────────────────────
export function startClock() {
  const el = document.getElementById('top-time');
  if (!el) return;
  const update = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    el.textContent = `${h}:${m}`;
  };
  update();
  setInterval(update, 10000);
}

// ── 监听 bus 事件自动 toast ──────────────────────────────────
bus.on(EVENTS.TOAST, ({ message, type, duration }) => {
  showToast(message, type, duration);
});
/* ============================================================
   Species Group UI
   ============================================================ */
.friend-species-badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  margin-top: 4px;
  margin-bottom: 6px;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  background: var(--bg-card-alt);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
  border: 1px solid var(--border-color);
}

.friend-actions {
  align-self: stretch;
}

.friend-actions .icon-btn,
.friend-actions .visit-btn {
  flex-shrink: 0;
}
/* === 区块结束：宠物分类 UI === */
