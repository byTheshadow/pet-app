/* ============================================
   Logger 模块
   负责：全局错误捕获、日志记录、日志查询
   所有模块都应通过此模块记录错误
   ============================================ */

/* [LOGGER-CORE] */
const Logger = (() => {
  const LOG_KEY = 'petapp_error_logs';
  const MAX_LOGS = 200; // 最多保留条数

  const LEVELS = {
    INFO:  'info',
    WARN:  'warn',
    ERROR: 'error'
  };

  // 从 localStorage 读取日志
  function _readLogs() {
    try {
      return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    } catch {
      return [];
    }
  }

  // 写入 localStorage
  function _writeLogs(logs) {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn('[Logger] 写入日志失败:', e);
    }
  }

  // 核心写入方法
  function _log(level, message, detail = null) {
    const entry = {
      id: Date.now() + Math.random().toString(36).slice(2, 6),
      level,
      message: String(message),
      detail: detail ? String(detail).slice(0, 800) : null,
      timestamp: new Date().toISOString(),
      read: false
    };

    // 同时输出到控制台
    if (level === LEVELS.ERROR) {
      console.error(`[PetApp] ${message}`, detail || '');
    } else if (level === LEVELS.WARN) {
      console.warn(`[PetApp] ${message}`, detail || '');
    } else {
      console.log(`[PetApp] ${message}`, detail || '');
    }

    const logs = _readLogs();
    logs.unshift(entry); // 最新的在前

    // 超出上限时裁剪
    if (logs.length > MAX_LOGS) {
      logs.splice(MAX_LOGS);
    }

    _writeLogs(logs);
    _notifyBadge();

    return entry;
  }

  // 更新设置页的错误徽章
  function _notifyBadge() {
    const badge = document.getElementById('errorLogBadge');
    if (!badge) return;
    const unread = _readLogs().filter(l => !l.read && l.level === LEVELS.ERROR).length;
    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.classList.remove('hidden');
    } else {
      badge.textContent = '';
      badge.classList.add('hidden');
    }
  }

  return {
    LEVELS,

    info(message, detail = null) {
      return _log(LEVELS.INFO, message, detail);
    },

    warn(message, detail = null) {
      return _log(LEVELS.WARN, message, detail);
    },

    error(message, detail = null) {
      return _log(LEVELS.ERROR, message, detail);
    },

    // 获取所有日志
    getAll() {
      return _readLogs();
    },

    // 获取未读错误数
    getUnreadErrorCount() {
      return _readLogs().filter(l => !l.read && l.level === LEVELS.ERROR).length;
    },

    // 标记全部已读
    markAllRead() {
      const logs = _readLogs().map(l => ({ ...l, read: true }));
      _writeLogs(logs);
      _notifyBadge();
    },

    // 删除单条
    deleteOne(id) {
      const logs = _readLogs().filter(l => l.id !== id);
      _writeLogs(logs);
      _notifyBadge();
    },

    // 清空所有日志
    clearAll() {
      _writeLogs([]);
      _notifyBadge();
    },

    // 初始化徽章（页面加载时调用）
    initBadge() {
      _notifyBadge();
    }
  };
})();
/* [/LOGGER-CORE] */

/* ============================================
   全局错误捕获
   ============================================ */
/* [GLOBAL-ERROR-CAPTURE] */
window.addEventListener('error', event => {
  Logger.error(
    `未捕获错误: ${event.message}`,
    `${event.filename}:${event.lineno}:${event.colno}\n${event.error?.stack || ''}`
  );
});

window.addEventListener('unhandledrejection', event => {
  Logger.error(
    `未处理的 Promise 拒绝: ${event.reason?.message || event.reason}`,
    event.reason?.stack || String(event.reason)
  );
});
/* [/GLOBAL-ERROR-CAPTURE] */
