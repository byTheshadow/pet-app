/* ============================================
   UI 渲染模块
   负责：页面导航、宠物渲染、气泡控制、
         状态栏更新、弹窗管理、Toast、粒子效果
   ============================================ */

/* [UI-STATE] */
const UI = (() => {
  let _currentPage = 'pagePet';
  let _bubbleTimer = null;
  let _bubbleHideTimer = null;
  let _currentTheme = 'cream';

  // DOM 元素缓存
  const $ = id => document.getElementById(id);
/* [/UI-STATE] */

/* ============================================
   导航系统
   ============================================ */
/* [UI-NAV] */
  function _initNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const pageId = btn.dataset.page;
        if (pageId) _switchPage(pageId);
      });
    });
  }

  function _switchPage(pageId) {
    if (_currentPage === pageId) return;

    // 隐藏当前页
    const current = $(_currentPage);
    if (current) {
      current.classList.remove('active');
    }

        // 显示目标页
    const target = $(pageId);
    if (target) {
      target.classList.add('active');
    }

    // 更新导航按钮状态
    document.querySelectorAll('.nav-item').forEach(btn => {
      const isActive = btn.dataset.page === pageId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    _currentPage = pageId;

    // 切换到好友页时刷新列表
    if (pageId === 'pageFriends' && typeof FriendsManager !== 'undefined') {
      FriendsManager.renderAll();
    }

    // 切换到设置页时刷新徽章
    if (pageId === 'pageSettings') {
      Logger.initBadge();
    }
  }
/* [/UI-NAV] */

/* ============================================
   主题系统
   ============================================ */
/* [UI-THEME] */
  function _initTheme() {
    const saved = localStorage.getItem('petapp_theme') || 'cream';
    _applyTheme(saved, false);

    // 顶部主题切换按钮（快速切换 cream/mono）
    $('themeToggleBtn')?.addEventListener('click', () => {
      const next = _currentTheme === 'mono' ? 'cream' : 'mono';
      _applyTheme(next, true);
    });
  }

  function _applyTheme(theme, animate = true) {
    if (animate) {
      document.documentElement.classList.add('theme-transitioning');
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, 400);
    }
    document.documentElement.setAttribute('data-theme', theme);
    _currentTheme = theme;
    localStorage.setItem('petapp_theme', theme);

    // 更新设置页显示值
    const themeNames = {
      cream:    '奶油粉白',
      mono:     '黑白极简',
      lavender: '薰衣草紫',
      matcha:   '抹茶绿'
    };
    const val = $('settingThemeVal');
    if (val) val.textContent = themeNames[theme] || theme;

    // 同步 manifest theme-color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const themeColors = {
      cream:    '#fdf6f0',
      mono:     '#0f0f0f',
      lavender: '#f5f0ff',
      matcha:   '#f2f7f2'
    };
    if (metaTheme) metaTheme.content = themeColors[theme] || '#fdf6f0';
  }

  function _applyBgImage(url) {
    if (url) {
      document.documentElement.style.setProperty('--app-bg-image', `url("${url}")`);
    } else {
      document.documentElement.style.removeProperty('--app-bg-image');
    }
    localStorage.setItem('petapp_bg_image', url || '');
  }
/* [/UI-THEME] */

/* ============================================
   宠物渲染
   ============================================ */
/* [UI-PET-RENDER] */
  function _renderPet() {
    const pet = PetState.get();
    const wrapper   = $('petWrapper');
    const placeholder = $('petPlaceholder');
    const petImg    = $('petImage');
    const nameEl    = $('headerPetName');
    const stageEl   = $('headerPetStage');

    if (!pet) {
      wrapper?.classList.add('hidden');
      placeholder?.classList.remove('hidden');
      if (nameEl) nameEl.textContent = '小宠物';
      if (stageEl) stageEl.textContent = '';
      return;
    }

    wrapper?.classList.remove('hidden');
    placeholder?.classList.add('hidden');

    // 更新头部信息
    if (nameEl) nameEl.textContent = pet.name || '小宠物';

    const stageLabels = {
      egg:   '蛋蛋期',
      baby:  '幼年期',
      child: '少年期',
      adult: '成年期'
    };
    if (stageEl) stageEl.textContent = stageLabels[pet.stage] || '';

    // 更新宠物图片
    if (petImg) {
      if (pet.avatarUrl) {
        petImg.src = pet.avatarUrl;
        petImg.classList.remove('hidden');
        petImg.onerror = () => {
          petImg.src = '';
          petImg.classList.add('hidden');
          Logger.warn('宠物图片加载失败', pet.avatarUrl);
        };
      } else {
        petImg.src = '';
        petImg.classList.add('hidden');
      }

      // 根据心情切换浮动动画类
      const mood = PetState.getMoodState();
      petImg.classList.remove('happy', 'sad', 'sleeping', 'sick');
      if (mood === 'happy')  petImg.classList.add('happy');
      if (mood === 'sad' || mood === 'sick') petImg.classList.add('sad');
    }
  }
/* [/UI-PET-RENDER] */

/* ============================================
   状态栏更新
   ============================================ */
/* [UI-STATS] */
  function _updateStats() {
    const stats = PetState.getStats();
    if (!stats) return;

    const statMap = {
      hunger:   { fill: 'statHunger',   val: 'statHungerVal' },
      mood:     { fill: 'statMood',      val: 'statMoodVal' },
      health:   { fill: 'statHealth',    val: 'statHealthVal' },
      clean:    { fill: 'statClean',     val: 'statCleanVal' },
      intimacy: { fill: 'statIntimacy',  val: 'statIntimacyVal' }
    };

    Object.entries(statMap).forEach(([key, ids]) => {
      const fillEl = $(ids.fill);
      const valEl  = $(ids.val);
      const value  = Math.round(stats[key] ?? 0);

      if (fillEl) {
        fillEl.style.width = `${value}%`;
        // 危急状态加闪烁
        fillEl.classList.toggle('critical', value < 20);
      }
      if (valEl) valEl.textContent = value;
    });
  }
/* [/UI-STATS] */

/* ============================================
   操作按钮冷却显示
   ============================================ */
/* [UI-COOLDOWNS] */
  function _updateActionCooldowns() {
    const actionBtnMap = {
      feed:  'btnFeed',
      play:  'btnPlay',
      clean: 'btnClean'
    };

    Object.entries(actionBtnMap).forEach(([actionKey, btnId]) => {
      const btn = $(btnId);
      if (!btn) return;

      const remaining = PetState.getCooldownRemaining(actionKey);
      if (remaining > 0) {
        const mins = Math.ceil(remaining / 60000);
        btn.disabled = true;
        const labelEl = btn.querySelector('.action-label');
        if (labelEl) labelEl.textContent = `${mins}分钟`;
      } else {
        btn.disabled = false;
        const labelEl = btn.querySelector('.action-label');
        const labels = { feed: '喂食', play: '玩耍', clean: '清洁' };
        if (labelEl) labelEl.textContent = labels[actionKey] || actionKey;
      }
    });
  }
/* [/UI-COOLDOWNS] */

/* ============================================
   气泡系统
   ============================================ */
/* [UI-BUBBLE] */
  function _showBubble(text, duration = 4000) {
    const bubble = $('speechBubble');
    const bubbleText = $('bubbleText');
    if (!bubble || !bubbleText) return;

    // 清除之前的隐藏计时器
    if (_bubbleHideTimer) {
      clearTimeout(_bubbleHideTimer);
      _bubbleHideTimer = null;
    }

    bubbleText.textContent = text;
    bubble.classList.remove('hidden', 'hide');
    bubble.classList.add('show');

    _bubbleHideTimer = setTimeout(() => {
      bubble.classList.remove('show');
      bubble.classList.add('hide');
      setTimeout(() => {
        bubble.classList.add('hidden');
        bubble.classList.remove('hide');
      }, 250);
    }, duration);
  }

  function _triggerAutoBubble() {
    if (!PetState.exists()) return;
    const stats    = PetState.getStats();
    const mood     = PetState.getMoodState();
    const text     = BubbleGenerator.generate(stats, mood);
    _showBubble(text, 5000);
  }
/* [/UI-BUBBLE] */

/* ============================================
   粒子效果
   ============================================ */
/* [UI-PARTICLES] */
  function _spawnParticles(emojis, originEl) {
    if (!originEl) return;
    const rect = originEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const count = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'particle';
        el.textContent = emojis[Math.floor(Math.random() * emojis.length)];

        const angle = (Math.random() * 360) * (Math.PI / 180);
        const dist  = 40 + Math.random() * 60;
        el.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
        el.style.setProperty('--dy', `${Math.sin(angle) * dist - 40}px`);
        el.style.left = `${cx}px`;
        el.style.top  = `${cy}px`;

        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1100);
      }, i * 60);
    }
  }
/* [/UI-PARTICLES] */

/* ============================================
   宠物互动按钮
   ============================================ */
/* [UI-ACTIONS] */
  function _initActionButtons() {
    // 喂食
    $('btnFeed')?.addEventListener('click', async () => {
      await _handleAction('feed');
    });

    // 玩耍
    $('btnPlay')?.addEventListener('click', async () => {
      await _handleAction('play');
    });

    // 清洁
    $('btnClean')?.addEventListener('click', async () => {
      await _handleAction('clean');
    });

    // 场景出行
    $('btnScene')?.addEventListener('click', () => {
      if (!PetState.exists()) {
        showToast('先创建宠物吧 (´• ω •`)', 'warning');
        return;
      }
      openSceneModal();
    });

    // 聊天
    $('btnChat')?.addEventListener('click', () => {
      if (!PetState.exists()) {
        showToast('先创建宠物吧 (´• ω •`)', 'warning');
        return;
      }
      if (typeof ChatManager !== 'undefined') {
        ChatManager.open('pet');
      }
    });

    // 点击宠物本体触发互动
    $('petWrapper')?.addEventListener('click', () => {
      if (!PetState.exists()) return;
      const petImg = $('petImage');
      petImg?.classList.add('pet-bounce');
      setTimeout(() => petImg?.classList.remove('pet-bounce'), 600);

      const mood = PetState.getMoodState();
      const text = BubbleGenerator.generate(PetState.getStats(), mood);
      _showBubble(text, 4000);

      _spawnParticles(['💕', '✨', '⭐'], petImg);
    });

    // 创建宠物按钮
    $('createPetBtn')?.addEventListener('click', () => {
      if (typeof SettingsManager !== 'undefined') {
        SettingsManager.openPetProfile();
      }
    });
  }

  async function _handleAction(actionKey) {
    if (!PetState.exists()) {
      showToast('先创建宠物吧 (´• ω •`)', 'warning');
      return;
    }

    const btn = $(`btn${actionKey.charAt(0).toUpperCase() + actionKey.slice(1)}`);
    if (btn) btn.disabled = true;

    try {
      const result = await PetState.doAction(actionKey);
      const action = ACTIONS[actionKey];

      // 播放动画
      const petImg = $('petImage');
      if (petImg && action.animation) {
        petImg.classList.add(`pet-${action.animation}`);
        setTimeout(() => petImg.classList.remove(`pet-${action.animation}`), 700);
      }

      // 粒子效果
      _spawnParticles(action.particles, petImg);

      // 气泡反馈
      const bubbleText = BubbleGenerator.actionFeedback(actionKey);
      _showBubble(bubbleText, 4000);

      // 更新状态栏
      _updateStats();
      _updateActionCooldowns();

      showToast(`${action.label}成功！`, 'success');
    } catch (e) {
      showToast(e.message, 'warning');
      Logger.warn(`互动失败: ${actionKey}`, e.message);
    } finally {
      _updateActionCooldowns();
    }
  }
/* [/UI-ACTIONS] */

/* ============================================
   通知系统
   ============================================ */
/* [UI-NOTIF] */
  async function _updateNotifBadge() {
    const count = await DB.notification.getUnreadCount();
    const dot = $('notifDot');
    if (dot) dot.classList.toggle('hidden', count === 0);
  }

  function _initNotifBtn() {
    $('notifBtn')?.addEventListener('click', async () => {
      const notifications = await DB.notification.getAll();
      await DB.notification.markAllRead();
      await _updateNotifBadge();
      _openNotifPanel(notifications);
    });
  }

  function _openNotifPanel(notifications) {
    const body = notifications.length === 0
      ? `<div class="empty-state">
           <div class="empty-icon">( ´ ▽ ` )</div>
           <p>暂无通知</p>
         </div>`
      : `<div class="notif-list">
           ${notifications.map(n => `
             <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
               <div class="notif-icon">${n.icon || '📢'}</div>
               <div class="notif-body">
                 <div class="notif-text">${_escHtml(n.content)}</div>
                 <div class="notif-time">${_formatTime(n.createdAt)}</div>
               </div>
               <button class="btn btn-sm btn-outline" onclick="DB.notification.deleteOne(${n.id}).then(()=>UI.closeModal())">删除</button>
             </div>
           `).join('')}
         </div>`;

    openModal('通知', body, [
      { label: '全部删除', class: 'btn-outline', onClick: async () => {
        await DB.notification.clearAll();
        closeModal();
      }}
    ]);
  }
/* [/UI-NOTIF] */

/* ============================================
   离线补算报告
   ============================================ */
/* [UI-OFFLINE-REPORT] */
  function _showOfflineReport(minutesPassed) {
    if (minutesPassed < 10) return; // 少于10分钟不提示
    const hours = Math.floor(minutesPassed / 60);
    const mins  = minutesPassed % 60;
    const timeStr = hours > 0 ? `${hours}小时${mins}分钟` : `${mins}分钟`;

    const pet = PetState.get();
    const stats = PetState.getStats();
    if (!pet || !stats) return;

    // 检查是否有危急状态
    const criticals = [];
    if (stats.hunger < 30)   criticals.push('有点饿了');
    if (stats.mood < 30)     criticals.push('心情不太好');
    if (stats.health < 30)   criticals.push('健康下降了');
    if (stats.clean < 30)    criticals.push('需要清洁');

    const msg = criticals.length > 0
      ? `你离开了 ${timeStr}，${pet.name} ${criticals.join('、')}，快去照顾它吧！`
      : `你离开了 ${timeStr}，${pet.name} 一直在等你～`;

    showToast(msg, criticals.length > 0 ? 'warning' : 'info', 6000);
    _showBubble(
      criticals.length > 0 ? '(；ω；) 你终于回来了...' : '(≧▽≦) 你回来啦！',
      5000
    );
  }
/* [/UI-OFFLINE-REPORT] */

/* ============================================
   场景弹窗
   ============================================ */
/* [UI-SCENE-MODAL] */
  function _openSceneModal() {
    const overlay = $('sceneOverlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');

    // 渲染场景网格
    if (typeof SceneManager !== 'undefined') {
      SceneManager.renderGrid($('sceneGrid'));
    }

    $('sceneClose')?.addEventListener('click', _closeSceneModal, { once: true });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) _closeSceneModal();
    }, { once: true });
  }

  function _closeSceneModal() {
    $('sceneOverlay')?.classList.add('hidden');
  }
/* [/UI-SCENE-MODAL] */

/* ============================================
   通用弹窗
   ============================================ */
/* [UI-MODAL] */
  function _openModal(title, bodyHtml, footerBtns = []) {
    const overlay  = $('modalOverlay');
    const titleEl  = $('modalTitle');
    const bodyEl   = $('modalBody');
    const footerEl = $('modalFooter');
    if (!overlay) return;

    if (titleEl) titleEl.textContent = title;
    if (bodyEl)  bodyEl.innerHTML = bodyHtml;

    // 渲染底部按钮
    if (footerEl) {
      footerEl.innerHTML = '';
      footerBtns.forEach(btn => {
        const el = document.createElement('button');
        el.className = `btn ${btn.class || 'btn-outline'} btn-block`;
        el.textContent = btn.label;
        el.addEventListener('click', () => {
          if (btn.onClick) btn.onClick();
        });
        footerEl.appendChild(el);
      });
    }

    overlay.classList.remove('hidden');

    // 关闭按钮
    const closeBtn = $('modalClose');
    const closeHandler = () => _closeModal();
    closeBtn?.addEventListener('click', closeHandler, { once: true });

    // 点击遮罩关闭
    overlay.addEventListener('click', e => {
      if (e.target === overlay) _closeModal();
    }, { once: true });
  }

  function _closeModal() {
    $('modalOverlay')?.classList.add('hidden');
    const bodyEl = $('modalBody');
    const footerEl = $('modalFooter');
    if (bodyEl)   bodyEl.innerHTML = '';
    if (footerEl) footerEl.innerHTML = '';
  }
/* [/UI-MODAL] */

/* ============================================
   Toast 通知
   ============================================ */
/* [UI-TOAST] */
  function _showToast(message, type = 'info', duration = 3000) {
    const container = $('toastContainer');
    if (!container) return;

    const icons = {
      success: '✓',
      warning: '⚠',
      error:   '✕',
      info:    '✦'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || '✦'}</span>
      <span class="toast-msg">${_escHtml(message)}</span>
    `;
    toast.setAttribute('role', 'alert');

    container.appendChild(toast);

    // 自动消失
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 280);
    }, duration);

    // 点击提前关闭
    toast.addEventListener('click', () => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 280);
    });
  }
/* [/UI-TOAST] */

/* ============================================
   加载遮罩
   ============================================ */
/* [UI-LOADING] */
  function _showLoading(text = '加载中...') {
    const overlay = $('loadingOverlay');
    const textEl  = $('loadingText');
    if (overlay) overlay.classList.remove('hidden');
    if (textEl)  textEl.textContent = text;
  }

  function _hideLoading() {
    $('loadingOverlay')?.classList.add('hidden');
  }
/* [/UI-LOADING] */

/* ============================================
   工具函数
   ============================================ */
/* [UI-UTILS] */
  function _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000)           return '刚刚';
    if (diff < 3600000)         return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000)        return `${Math.floor(diff / 3600000)}小时前`;
    return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
/* [/UI-UTILS] */

/* ============================================
   公开 API
   ============================================ */
/* [UI-PUBLIC] */
  return {
    // 初始化
    async init() {
      _initNav();
      _initTheme();
      _initActionButtons();
      _initNotifBtn();

      // 恢复背景图
      const savedBg = localStorage.getItem('petapp_bg_image');
      if (savedBg) _applyBgImage(savedBg);

      // 初始渲染
      _renderPet();
      _updateStats();
      _updateActionCooldowns();
      await _updateNotifBadge();

      Logger.info('UI 初始化完成');
    },

    // 宠物相关
    renderPet:             _renderPet,
    updateStats:           _updateStats,
    updateActionCooldowns: _updateActionCooldowns,

    // 气泡
    showBubble:      _showBubble,
    triggerAutoBubble: _triggerAutoBubble,

    // 粒子
    spawnParticles: _spawnParticles,

    // 弹窗
    openModal:  _openModal,
    closeModal: _closeModal,
    openSceneModal: _openSceneModal,
    closeSceneModal: _closeSceneModal,

    // Toast
    showToast: _showToast,

    // 加载
    showLoading: _showLoading,
    hideLoading: _hideLoading,

    // 通知
    updateNotifBadge: _updateNotifBadge,

    // 离线报告
    showOfflineReport: _showOfflineReport,

    // 主题
    applyTheme:   _applyTheme,
    applyBgImage: _applyBgImage,
    getCurrentTheme() { return _currentTheme; },

    // 导航
    switchPage: _switchPage,
    getCurrentPage() { return _currentPage; },

    // 工具
    escHtml:    _escHtml,
    formatTime: _formatTime
  };
/* [/UI-PUBLIC] */

})();

/* ============================================
   全局快捷方法（供其他模块调用）
   ============================================ */
/* [UI-GLOBALS] */
function showToast(msg, type = 'info', duration = 3000) {
  UI.showToast(msg, type, duration);
}

function openModal(title, body, btns) {
  UI.openModal(title, body, btns);
}

function closeModal() {
  UI.closeModal();
}

function openSceneModal() {
  UI.openSceneModal();
}

function showLoading(text) {
  UI.showLoading(text);
}

function hideLoading() {
  UI.hideLoading();
}
/* [/UI-GLOBALS] */
