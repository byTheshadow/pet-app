// js/logger.js
// 全局错误捕获 + 运行日志写入 errorLog / actionLog

import { dbAppend, dbList, dbDelete, dbClear } from './db.js';

// ── 写入日志 ─────────────────────────────────────────────────
export async function log(level, source, message, extra = {}) {
  const entry = {
    id:        Date.now() + Math.random(),
    level,     // 'info' | 'warn' | 'error' | 'debug'
    source,    // 模块名，如 'pet.js' / 'ai.js'
    message,
    stack:     extra.stack || null,
    detail:    extra.detail || null,
    createdAt: Date.now(),
  };

  // 控制台同步输出
  const consoleFn = {
    info:  console.info,
    warn:  console.warn,
    error: console.error,
    debug: console.debug,
  }[level] || console.log;
  consoleFn(`[${source}] ${message}`, extra.detail || '');

  try {
    await dbAppend('errorLog', entry);
  } catch (e) {
    console.error('[logger] Failed to write log:', e);
  }

  // 超过 500 条自动清理最旧的
  try {
    const all = await dbList('errorLog', { limit: 9999 });
    if (all.length > 500) {
      const toDelete = all.slice(400); // 保留最新 400 条
      for (const item of toDelete) {
        await dbDelete('errorLog', item.id);
      }
    }
  } catch (_) { /* 清理失败不影响主流程 */ }
}

export const logInfo  = (src, msg, extra) => log('info',  src, msg, extra);
export const logWarn  = (src, msg, extra) => log('warn',  src, msg, extra);
export const logError = (src, msg, extra) => log('error', src, msg, extra);
export const logDebug = (src, msg, extra) => log('debug', src, msg, extra);

// ── 全局错误捕获 ─────────────────────────────────────────────
export function initGlobalErrorCapture() {
  window.addEventListener('error', (e) => {
    logError('global', e.message || 'Unknown error', {
      stack:  e.error?.stack || null,
      detail: `${e.filename}:${e.lineno}:${e.colno}`,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason?.message || String(e.reason) || 'Unhandled Promise rejection';
    logError('promise', msg, {
      stack: e.reason?.stack || null,
    });
  });
}
