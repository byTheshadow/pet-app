/* ============================================
   定时任务管理模块
   负责：状态衰减心跳、AI家长触发调度、
         Service Worker 通信、页面可见性处理
   ============================================ */

/* [TIMER-CONFIG] */
const TIMER_CONFIG = {
  DECAY_INTERVAL:      5 * 60 * 1000,   // 状态衰减间隔：5分钟
  BUBBLE_INTERVAL:     45 * 1000,        // 气泡自动弹出间隔：45秒
  COOLDOWN_CHECK:      30 * 1000,        // 冷却按钮刷新间隔：30秒
  NOTIF_CHECK:         60 * 1000,        // 通知检查间隔：1分钟
  OFFLINE_CALC_KEY:    'petapp_last_tick' // 离线时间记录 key
};
/* [/TIMER-CONFIG] */

/* ============================================
   定时器管理器
   ============================================ */
/* [TIMER-MANAGER] */
const TimerManager = (() => {
  let _timers = {};          // { key: intervalId }
  let _swRegistration = null;
  let _isVisible = true;
  let _lastTickTime = null;

  /* ---- Service Worker 注册 ---- */
  async function _registerSW() {
    if (!('serviceWorker' in navigator)) {
      Logger.warn('Service Worker 不支持，后台保活不可用');
      return;
    }
    try {
      _swRegistration = await navigator.serviceWorker.register('./sw.js');
      Logger.info('Service Worker 注册成功');

      // 监听 SW 消息
      navigator.serviceWorker.addEventListener('message', _handleSWMessage);

      // 等待 SW 激活后发送启动心跳指令
      const sw = _swRegistration.active ||
                 _swRegistration.waiting ||
                 _swRegistration.installing;
      if (sw) {
        sw.postMessage({ type: 'START_HEARTBEAT' });
      }

      _swRegistration.addEventListener('updatefound', () => {
        Logger.info('Service Worker 有新版本');
      });
    } catch (e) {
      Logger.warn('Service Worker 注册失败', e.message);
    }
  }

  /* ---- 处理 SW 心跳消息 ---- */
  function _handleSWMessage(event) {
    const { type } = event.data || {};
    if (type === 'SW_HEARTBEAT') {
      // SW 后台心跳触发衰减
      _onTick('sw');
    } else if (type === 'SW_READY') {
      Logger.info('Service Worker 就绪', event.data.version);
    }
  }

  /* ---- 计算离线期间的衰减 ---- */
  function _calcOfflineDecay() {
    const lastTick = parseInt(localStorage.getItem(TIMER_CONFIG.OFFLINE_CALC_KEY) || '0');
    if (!lastTick) return 0;

    const now = Date.now();
    const elapsed = now - lastTick;
    const minutesPassed = Math.floor(elapsed / 60000);

    // 最多补算 24 小时的衰减，防止离线太久直接归零
    return Math.min(minutesPassed, 24 * 60);
  }

  /* ---- 记录本次 tick 时间 ---- */
  function _saveTick() {
    _lastTickTime = Date.now();
    localStorage.setItem(TIMER_CONFIG.OFFLINE_CALC_KEY, String(_lastTickTime));
  }

  /* ---- 核心 tick 处理 ---- */
  async function _onTick(source = 'interval') {
    if (!PetState.exists()) return;

    try {
      await PetState.decay(5); // 每次 tick 衰减 5 分钟量
      _saveTick();

      // 触发 AI 家长检查
      if (typeof AIParentManager !== 'undefined') {
        await AIParentManager.checkAndTrigger();
      }

      // 更新 UI
      if (typeof UI !== 'undefined') {
        UI.updateStats();
        UI.updateActionCooldowns();
      }

      Logger.info(`定时 tick 完成 [${source}]`);
    } catch (e) {
      Logger.error('TimerManager._onTick 失败', e.message);
    }
  }

  /* ---- 页面可见性变化处理 ---- */
  function _handleVisibilityChange() {
    if (document.hidden) {
      _isVisible = false;
      _saveTick();
      Logger.info('页面隐藏，记录 tick 时间');
    } else {
      _isVisible = true;
      // 页面重新可见时，补算离线期间的衰减
      const offlineMinutes = _calcOfflineDecay();
      if (offlineMinutes > 0 && PetState.exists()) {
        Logger.info(`补算离线衰减: ${offlineMinutes} 分钟`);
        PetState.decay(offlineMinutes).then(() => {
          if (typeof UI !== 'undefined') {
            UI.updateStats();
            UI.showOfflineReport(offlineMinutes);
          }
        });
      }
    }
  }

  return {
    /* ---- 初始化 ---- */
    async init() {
      // 注册 Service Worker
      await _registerSW();

      // 补算离线衰减
      const offlineMinutes = _calcOfflineDecay();
      if (offlineMinutes > 0 && PetState.exists()) {
        Logger.info(`启动时补算离线衰减: ${offlineMinutes} 分钟`);
        await PetState.decay(offlineMinutes);
      }
      _saveTick();

      // 启动各定时器
      this.startAll();

      // 监听页面可见性
      document.addEventListener('visibilitychange', _handleVisibilityChange);

      Logger.info('TimerManager 初始化完成');
    },

    /* ---- 启动所有定时器 ---- */
    startAll() {
      // 状态衰减定时器
      this.start('decay', async () => {
        if (_isVisible) await _onTick('interval');
      }, TIMER_CONFIG.DECAY_INTERVAL);

      // 气泡自动弹出定时器
      this.start('bubble', () => {
        if (_isVisible && PetState.exists() && typeof UI !== 'undefined') {
          UI.triggerAutoBubble();
        }
      }, TIMER_CONFIG.BUBBLE_INTERVAL);

      // 冷却按钮刷新定时器
      this.start('cooldown', () => {
        if (_isVisible && typeof UI !== 'undefined') {
          UI.updateActionCooldowns();
        }
      }, TIMER_CONFIG.COOLDOWN_CHECK);

      // 通知检查定时器
      this.start('notif', async () => {
        if (typeof UI !== 'undefined') {
          await UI.updateNotifBadge();
        }
      }, TIMER_CONFIG.NOTIF_CHECK);
    },

    /* ---- 启动单个定时器 ---- */
    start(key, fn, interval) {
      this.stop(key);
      _timers[key] = setInterval(fn, interval);
      Logger.info(`定时器 [${key}] 已启动，间隔 ${interval}ms`);
    },

    /* ---- 停止单个定时器 ---- */
    stop(key) {
      if (_timers[key]) {
        clearInterval(_timers[key]);
        delete _timers[key];
      }
    },

    /* ---- 停止所有定时器 ---- */
    stopAll() {
      Object.keys(_timers).forEach(key => this.stop(key));
      if (_swRegistration?.active) {
        _swRegistration.active.postMessage({ type: 'STOP_HEARTBEAT' });
      }
      document.removeEventListener('visibilitychange', _handleVisibilityChange);
      Logger.info('所有定时器已停止');
    },

    /* ---- 手动触发一次 tick（调试用）---- */
    async manualTick() {
      await _onTick('manual');
    },

    /* ---- 获取运行状态 ---- */
    getStatus() {
      return {
        runningTimers: Object.keys(_timers),
        isVisible: _isVisible,
        lastTick: _lastTickTime,
        swActive: !!_swRegistration?.active
      };
    }
  };
})();
/* [/TIMER-MANAGER] */
