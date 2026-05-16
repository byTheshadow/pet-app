// js/router.js
// Hash 路由 —— 切换 .page-section 的 active 状态

import { runtime, bus, EVENTS } from './state.js';
import { logInfo } from './logger.js';

const PAGES = ['pet', 'friends', 'adventure', 'settings'];
const DEFAULT_PAGE = 'pet';

export function initRouter() {
  window.addEventListener('hashchange', _handleHash);
  _handleHash(); // 初始化时处理当前 hash
}

export function navigateTo(page) {
  if (!PAGES.includes(page)) page = DEFAULT_PAGE;
  location.hash = page;
}

function _handleHash() {
  const hash = location.hash.replace('#', '') || DEFAULT_PAGE;
  const page = PAGES.includes(hash) ? hash : DEFAULT_PAGE;

  // 隐藏所有页面
  document.querySelectorAll('.page-section').forEach(el => {
    el.classList.remove('active');
  });

  // 显示目标页面
  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
  }

  // 更新底部导航高亮
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // 更新运行时状态
  runtime.currentPage = page;

  // 触发页面切换事件（各模块可监听做懒加载）
  bus.emit(EVENTS.PAGE_CHANGED, { page });

  logInfo('router', `Navigated to #${page}`);
}

