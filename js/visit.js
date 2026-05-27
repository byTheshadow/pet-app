import { dbSet, dbAppend } from './db.js';
import {
  runtime,
  VISIT_MODES,
  VISIT_STATUS,
  VISIT_TOY_ITEMS,
  VISIT_GIFT_ITEMS,
  VISIT_OUTING_PACK_ITEMS,
  VISIT_FALLBACK_EASTER_EGGS,
  getCompatibleVisitItems,
} from './state.js';
import { callAI, buildSystemPrompt } from './ai.js';
import { savePet } from './pet.js';
import { showToast, setButtonLoading } from './ui.js';

const visitRuntime = {
  friend: null,
  mode: VISIT_MODES.INCOMING_CHAT,
  status: VISIT_STATUS.IDLE,
  messages: [],
  intimacyGain: 0,
  autoRunning: false,
  autoStop: false,
  focusTimer: null,
  focusEndAt: null,
  startedContext: null,
  typingMap: new Map(),
};
// === 区块结束：visitRuntime ===

const VISIT_LEGACY_FALLBACKS = {
  pet: [
    '（开心地摇尾巴）',
    '哇，你来了！',
    '嗯嗯！',
    '（好奇地看着）',
    '一起玩吧！',
    '（蹭了蹭）',
    '下次还要来玩哦！(´▽`)',
    '今天好开心，拜拜～',
  ],
  friend: [
    '你好你好！',
    '（友好地打招呼）',
    '嗯！',
    '好有趣哦！',
    '（开心地转圈）',
    '我们做朋友吧！',
    '今天玩得好开心，下次再来！(≧▽≦)',
    '拜拜～记得想我哦！',
  ],
};

const VISIT_EXTRA_FALLBACKS = {
  pet: [
    '嘿嘿，和你一起待着就很开心呀～',
    '今天的时间过得好快呀 (´▽`)',
    '我会记得这次做客的！',
  ],
  friend: [
    '这里真的好温暖，我很喜欢！',
    '今天的相处让我心情超好～',
    '下次我们还要继续一起玩！',
  ],
};

const VISIT_FAREWELL_FALLBACKS = {
  pet: [
    '下次还要来玩哦！(´▽`)',
    '今天好开心，拜拜～',
    '路上要小心呀，下次再一起玩～',
  ],
  friend: [
    '今天玩得好开心，下次再来！(≧▽≦)',
    '拜拜～记得想我哦！',
    '谢谢招待呀，我下次再来找你玩～',
  ],
};


export function initVisitSystem() {
  injectVisitStyles();
}

export async function openVisitComposer(friend) {
  if (!friend) {
    showToast('未找到目标好友', 'error');
    return;
  }

  closeVisitComposer();
  resetVisitRuntime(friend);

  const overlay = document.createElement('div');
  overlay.id = 'visit2-overlay';
  overlay.innerHTML = `
    <div class="visit2-modal">
      <div class="visit2-shell">
        <div class="visit2-topbar">
          <div class="visit2-topbar-left">
            <div class="visit2-title">宠物做客</div>
            <div class="visit2-subtitle">${escapeHtml((runtime.pet?.name || '我的宠物'))} × ${escapeHtml(friend.name || '好友')}</div>
          </div>
          <button class="visit2-icon-btn" id="visit2-close-btn" aria-label="关闭">✕</button>
        </div>

        <div class="visit2-content" id="visit2-content"></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#visit2-close-btn')?.addEventListener('click', closeVisitComposer);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeVisitComposer();
  });

  renderPreparationView();
}

function pickVisitFallback(role, scene = 'general') {
  if (scene === 'farewell') {
    const pool = VISIT_FAREWELL_FALLBACKS[role] || VISIT_FAREWELL_FALLBACKS.friend;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const legacyPool = VISIT_LEGACY_FALLBACKS[role] || VISIT_LEGACY_FALLBACKS.friend;
  const extraPool  = VISIT_EXTRA_FALLBACKS[role]  || VISIT_EXTRA_FALLBACKS.friend;
  const merged = [...legacyPool, ...extraPool];

  return merged[Math.floor(Math.random() * merged.length)];
}

function clearAllVisitTypingIndicators() {
  if (!visitRuntime.typingMap) {
    visitRuntime.typingMap = new Map();
    return;
  }

  for (const node of visitRuntime.typingMap.values()) {
    node?.remove();
  }
  visitRuntime.typingMap.clear();
}
// === 区块结束：clearAllVisitTypingIndicators ===


function resetVisitRuntime(friend) {
  if (visitRuntime.focusTimer) {
    clearInterval(visitRuntime.focusTimer);
    visitRuntime.focusTimer = null;
  }

  clearAllVisitTypingIndicators();

  visitRuntime.friend = friend;
  visitRuntime.mode = VISIT_MODES.INCOMING_CHAT;
  visitRuntime.status = VISIT_STATUS.IDLE;
  visitRuntime.messages = [];
  visitRuntime.intimacyGain = 0;
  visitRuntime.autoRunning = false;
  visitRuntime.autoStop = false;
  visitRuntime.focusEndAt = null;
  visitRuntime.startedContext = null;
}
// === 区块结束：resetVisitRuntime ===

function closeVisitComposer() {
  if (visitRuntime.focusTimer) {
    clearInterval(visitRuntime.focusTimer);
    visitRuntime.focusTimer = null;
  }
  const old = document.getElementById('visit2-overlay');
  if (old) old.remove();
}

function renderPreparationView() {
  const root = document.getElementById('visit2-content');
  if (!root) return;

  const pet = runtime.pet || {};
  const friend = visitRuntime.friend || {};
  const friendSpecies = friend.speciesGroup || 'mammal';
  const petSpecies = pet.speciesGroup || 'mammal';

  const toyItems = getCompatibleVisitItems(VISIT_TOY_ITEMS, friendSpecies);
  const giftItems = getCompatibleVisitItems(VISIT_GIFT_ITEMS, friendSpecies);
  const packItems = getCompatibleVisitItems(VISIT_OUTING_PACK_ITEMS, petSpecies);

  root.innerHTML = `
    <div class="visit2-prep-stack">
      <section class="visit2-card">
        <div class="visit2-mode-switch">
          <button class="visit2-mode-chip active" data-mode="${VISIT_MODES.INCOMING_CHAT}">来我家做客</button>
          <button class="visit2-mode-chip" data-mode="${VISIT_MODES.OUTGOING_CHAT}">去对方家做客</button>
          <button class="visit2-mode-chip" data-mode="${VISIT_MODES.OUTGOING_FOCUS}">做客番茄钟</button>
        </div>
        <div class="visit2-soft-tip" id="visit2-soft-tip">先准备待客内容，然后进入可爱的聊天界面</div>
      </section>

      <div id="visit2-prep-body"></div>
    </div>
  `;

  root.querySelectorAll('.visit2-mode-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.visit2-mode-chip').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      visitRuntime.mode = btn.dataset.mode;
      renderPreparationBody({ toyItems, giftItems, packItems });
    });
  });

  renderPreparationBody({ toyItems, giftItems, packItems });
}

function renderPreparationBody({ toyItems, giftItems, packItems }) {
  const body = document.getElementById('visit2-prep-body');
  if (!body) return;

  if (visitRuntime.mode === VISIT_MODES.INCOMING_CHAT) {
    body.innerHTML = `
      <section class="visit2-card">
        <div class="visit2-section-title">玩具箱</div>
        <div class="visit2-card-grid">
          ${toyItems.map(item => renderSelectCard(item, 'toy')).join('')}
        </div>
      </section>

      <section class="visit2-card">
        <div class="visit2-section-title">自定义玩具（最多 2 个）</div>
        <div class="visit2-field-stack">
          <input class="visit2-input" id="visit2-custom-toy-1" maxlength="16" placeholder="例如：彩虹积木" />
          <input class="visit2-input" id="visit2-custom-toy-2" maxlength="16" placeholder="例如：星星小鼓" />
        </div>
      </section>

      <section class="visit2-card visit2-action-card">
        <button class="visit2-primary-btn" id="visit2-start-btn">开始做客聊天</button>
      </section>
    `;
  }

  if (visitRuntime.mode === VISIT_MODES.OUTGOING_CHAT) {
    body.innerHTML = `
      <section class="visit2-card">
        <div class="visit2-section-title">伴手礼</div>
        <div class="visit2-card-grid">
          ${packSingleSelectCards(VISIT_GIFT_ITEMS, getCompatibleVisitItems(VISIT_GIFT_ITEMS, visitRuntime.friend?.speciesGroup || 'mammal'), 'gift')}
        </div>
      </section>

      <section class="visit2-card">
        <div class="visit2-section-title">出门包</div>
        <div class="visit2-card-grid">
          ${packItems.map(item => renderSelectCard(item, 'pack')).join('')}
        </div>
      </section>

      <section class="visit2-card visit2-action-card">
        <button class="visit2-primary-btn" id="visit2-start-btn">开始去做客</button>
      </section>
    `;
  }

  if (visitRuntime.mode === VISIT_MODES.OUTGOING_FOCUS) {
    body.innerHTML = `
      <section class="visit2-card">
        <div class="visit2-section-title">伴手礼</div>
        <div class="visit2-card-grid">
          ${packSingleSelectCards(VISIT_GIFT_ITEMS, getCompatibleVisitItems(VISIT_GIFT_ITEMS, visitRuntime.friend?.speciesGroup || 'mammal'), 'gift')}
        </div>
      </section>

      <section class="visit2-card">
        <div class="visit2-section-title">出门包</div>
        <div class="visit2-card-grid">
          ${packItems.map(item => renderSelectCard(item, 'pack')).join('')}
        </div>
      </section>

      <section class="visit2-card">
        <div class="visit2-section-title">我的专注任务</div>
        <input class="visit2-input" id="visit2-focus-task" maxlength="40" placeholder="例如：写报告 / 读书 / 背单词" />
      </section>

      <section class="visit2-card">
        <div class="visit2-section-title">番茄钟时长（分钟）</div>
        <input class="visit2-input" id="visit2-focus-minutes" type="number" min="1" max="300" value="25" placeholder="请输入分钟数" />
      </section>

      <section class="visit2-card visit2-action-card">
        <button class="visit2-primary-btn" id="visit2-start-btn">开始番茄钟</button>
      </section>
    `;
  }

  bindPreparationActions();
}

function bindPreparationActions() {
  const startBtn = document.getElementById('visit2-start-btn');
  if (!startBtn) return;

  startBtn.addEventListener('click', async () => {
    const friend = visitRuntime.friend;
    if (!friend) return;

    try {
      if (visitRuntime.mode === VISIT_MODES.INCOMING_CHAT) {
        await startIncomingChat(friend, startBtn);
      } else if (visitRuntime.mode === VISIT_MODES.OUTGOING_CHAT) {
        await startOutgoingChat(friend, startBtn);
      } else {
        await startFocusVisit(friend, startBtn);
      }
    } catch (err) {
      showToast(`启动失败：${err.message}`, 'error');
    }
  });
}

async function startIncomingChat(friend, btn) {
  const selectedToys = getSelectedItems('toy');
  const customToys = getCustomToys();

  if (!selectedToys.length && !customToys.length) {
    showToast('请至少准备一个玩具', 'warn');
    return;
  }

  setButtonLoading(btn, true, '正在准备待客...');
  try {
    const intro = await generateVisitIntro({
      mode: VISIT_MODES.INCOMING_CHAT,
      friend,
      selectedToys,
      customToys,
    });

    visitRuntime.startedContext = {
      selectedToys,
      customToys,
      selectedGift: null,
      selectedPack: [],
      focusTask: '',
      focusMinutes: 0,
    };

    renderChatView({
      title: `${friend.name} 来做客啦`,
      intro,
    });
appendVisitMessage('system', 'system', '聊天开始啦，宠物们已经见面了。');
appendVisitMessage('friend', friend.name, intro);

await generateVisitLineWithTyping({
  speaker: 'pet',
  friend,
  contextData: visitRuntime.startedContext,
  mode: visitRuntime.mode,
});
// === 区块结束：来访开场消息 ===
    bumpIntimacy(1);
    showToast('做客开始啦', 'success');
  } finally {
    setButtonLoading(btn, false);
  }
}

async function startOutgoingChat(friend, btn) {
  const selectedGift = getSingleSelectedItem('gift');
  const selectedPack = getSelectedItems('pack');

  if (!selectedGift) {
    showToast('请先选择一个伴手礼', 'warn');
    return;
  }

  setButtonLoading(btn, true, '正在安排出发...');
  try {
    const intro = await generateVisitIntro({
      mode: VISIT_MODES.OUTGOING_CHAT,
      friend,
      selectedGift,
      selectedPack,
    });

    visitRuntime.startedContext = {
      selectedToys: [],
      customToys: [],
      selectedGift,
      selectedPack,
      focusTask: '',
      focusMinutes: 0,
    };

    renderChatView({
      title: `去 ${friend.name} 家做客`,
      intro,
    });
appendVisitMessage('system', 'system', '你的小宠物已经带着礼物出发了。');
appendVisitMessage('pet', runtime.pet?.name || '宠物', intro);

await generateVisitLineWithTyping({
  speaker: 'friend',
  friend,
  contextData: visitRuntime.startedContext,
  mode: visitRuntime.mode,
});
// === 区块结束：出访开场消息 ===
    bumpIntimacy(1);
    showToast('已经出发去做客啦', 'success');
  } finally {
    setButtonLoading(btn, false);
  }
}

async function startFocusVisit(friend, btn) {
  const selectedGift = getSingleSelectedItem('gift');
  const selectedPack = getSelectedItems('pack');
  const focusTask = document.getElementById('visit2-focus-task')?.value.trim() || '专注任务';
  const minutes = Number(document.getElementById('visit2-focus-minutes')?.value || 0);

  if (!selectedGift) {
    showToast('请先选择一个伴手礼', 'warn');
    return;
  }
  if (!minutes || minutes < 1) {
    showToast('请输入有效的番茄钟时长', 'warn');
    return;
  }

  setButtonLoading(btn, true, '正在启动番茄钟...');
  try {
    visitRuntime.startedContext = {
      selectedToys: [],
      customToys: [],
      selectedGift,
      selectedPack,
      focusTask,
      focusMinutes: minutes,
    };

    renderFocusView({
      friend,
      selectedGift,
      selectedPack,
      focusTask,
      minutes,
    });

    showToast('番茄钟已开始', 'success');
  } finally {
    setButtonLoading(btn, false);
  }
}

function renderChatView({ title, intro }) {
  const root = document.getElementById('visit2-content');
  const pet = runtime.pet || {};
  const friend = visitRuntime.friend || {};
  if (!root) return;

  visitRuntime.status = VISIT_STATUS.ACTIVE;
  visitRuntime.messages = [];

  root.innerHTML = `
    <div class="visit2-chat-layout">
      <section class="visit2-chat-header-card">
        <div class="visit2-chat-header-main">
          <div class="visit2-dual-avatars">
            <div class="visit2-entity">
              ${renderAvatarNode('pet', pet.avatarUrl, '🐱')}
              <div class="visit2-entity-name">${escapeHtml(pet.name || '我的宠物')}</div>
            </div>
            <div class="visit2-entity visit2-entity-right">
              ${renderAvatarNode('friend', friend.avatarUrl, '🐾')}
              <div class="visit2-entity-name">${escapeHtml(friend.name || '好友')}</div>
            </div>
          </div>

          <div class="visit2-chat-header-text">
            <div class="visit2-chat-title">${escapeHtml(title)}</div>
            <div class="visit2-chat-sub" id="visit2-chat-sub">${escapeHtml(intro)}</div>
          </div>
        </div>

        <div class="visit2-chat-header-actions">
          <div class="visit2-intimacy" id="visit2-intimacy-badge">亲密度 +0</div>
          <button class="visit2-icon-btn" id="visit2-settings-btn" aria-label="设置">⚙</button>
        </div>
      </section>

      <section class="visit2-drawer-card" id="visit2-settings-drawer" hidden>
        <div class="visit2-settings-grid">
          <div class="visit2-settings-block">
            <div class="visit2-settings-title">自动聊天轮数</div>
            <div class="visit2-inline-row">
              <input class="visit2-input visit2-round-input" id="visit2-auto-rounds" type="number" min="1" max="10" value="3" />
              <button class="visit2-secondary-btn" id="visit2-auto-btn">自动聊天</button>
              <button class="visit2-ghost-btn" id="visit2-stop-auto-btn">停止</button>
            </div>
          </div>

          <div class="visit2-settings-block">
            <div class="visit2-settings-title">本次做客准备</div>
            <div class="visit2-setting-summary" id="visit2-setting-summary">${escapeHtml(buildSettingSummaryText(visitRuntime.startedContext || {}))}</div>
          </div>

          <div class="visit2-settings-block visit2-settings-danger">
            <button class="visit2-danger-btn" id="visit2-end-chat-btn">结束做客</button>
          </div>
        </div>
      </section>

      <section class="visit2-chat-stream-card">
        <div class="visit2-chat-stream" id="visit2-chat-stream"></div>
      </section>

      <section class="visit2-input-card">
        <div class="visit2-input-row">
          <input class="visit2-input visit2-chat-input" id="visit2-user-input" maxlength="80" placeholder="你也可以插一句话..." />
          <button class="visit2-primary-btn visit2-send-btn" id="visit2-user-send-btn">发送</button>
        </div>
        <div class="visit2-inline-tip" id="visit2-inline-status">准备好后就可以开始聊天啦</div>
      </section>
    </div>
  `;

  bindChatActions();
}

function renderFocusView({ friend, selectedGift, selectedPack, focusTask, minutes }) {
  const root = document.getElementById('visit2-content');
  if (!root) return;

  visitRuntime.status = VISIT_STATUS.FOCUS;

  root.innerHTML = `
    <div class="visit2-focus-layout">
      <section class="visit2-chat-header-card">
        <div class="visit2-chat-header-main">
          <div class="visit2-dual-avatars">
            <div class="visit2-entity">
              ${renderAvatarNode('pet', runtime.pet?.avatarUrl, '🐱')}
              <div class="visit2-entity-name">${escapeHtml(runtime.pet?.name || '我的宠物')}</div>
            </div>
            <div class="visit2-entity visit2-entity-right">
              ${renderAvatarNode('friend', friend.avatarUrl, '🐾')}
              <div class="visit2-entity-name">${escapeHtml(friend.name || '好友')}</div>
            </div>
          </div>

          <div class="visit2-chat-header-text">
            <div class="visit2-chat-title">做客番茄钟进行中</div>
            <div class="visit2-chat-sub">${escapeHtml(runtime.pet?.name || '宠物')} 正在 ${escapeHtml(friend.name)} 家做客</div>
          </div>
        </div>
      </section>

      <section class="visit2-card">
        <div class="visit2-focus-meta">
          <div class="visit2-focus-line">专注任务：${escapeHtml(focusTask)}</div>
          <div class="visit2-focus-line">伴手礼：${escapeHtml(selectedGift.label)}</div>
          <div class="visit2-focus-line">出门包：${escapeHtml(selectedPack.map(x => x.label).join('、') || '轻装出门')}</div>
        </div>
      </section>

      <section class="visit2-card visit2-focus-card">
        <div class="visit2-focus-time" id="visit2-focus-timer">--:--</div>
        <div class="visit2-inline-tip" id="visit2-focus-status">宠物正在别人家里玩，你也开始专注吧</div>
      </section>

      <section class="visit2-card visit2-action-card">
        <button class="visit2-danger-btn" id="visit2-finish-focus-btn">提前结束</button>
      </section>
    </div>
  `;

  const endAt = Date.now() + minutes * 60 * 1000;
  visitRuntime.focusEndAt = endAt;

  const timerEl = document.getElementById('visit2-focus-timer');
  const statusEl = document.getElementById('visit2-focus-status');

  const tick = async () => {
    const diff = Math.max(0, endAt - Date.now());
    const mm = String(Math.floor(diff / 60000)).padStart(2, '0');
    const ss = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    if (timerEl) timerEl.textContent = `${mm}:${ss}`;

    if (diff <= 0) {
      clearInterval(visitRuntime.focusTimer);
      visitRuntime.focusTimer = null;
      if (statusEl) statusEl.textContent = '宠物回家啦，正在触发小彩蛋...';

const egg = await getVisitEasterEgg(friend, visitRuntime.startedContext || {});

if (statusEl) statusEl.textContent = '小彩蛋已出现，正在整理这次做客的小结...';

const summary = await generateFocusReturnSummary(friend, visitRuntime.startedContext || {}, egg);


      await persistVisitResult(friend, {
        mode: VISIT_MODES.OUTGOING_FOCUS,
        contextData: visitRuntime.startedContext || {},
        egg,
        messages: [{ role: 'system', text: summary }],
      });

      appendFocusSummary(summary, egg.text);
      showToast('番茄钟完成，宠物回家啦', 'success');
    }
  };

  tick();
  visitRuntime.focusTimer = setInterval(tick, 1000);

  document.getElementById('visit2-finish-focus-btn')?.addEventListener('click', async () => {
    if (visitRuntime.focusTimer) {
      clearInterval(visitRuntime.focusTimer);
      visitRuntime.focusTimer = null;
    }

    const statusEl = document.getElementById('visit2-focus-status');
if (statusEl) statusEl.textContent = '正在触发提前结束的小彩蛋...';

const egg = await getVisitEasterEgg(friend, visitRuntime.startedContext || {});

if (statusEl) statusEl.textContent = '小彩蛋已出现，正在生成提前结束小结...';

const summary = await generateFocusReturnSummary(friend, visitRuntime.startedContext || {}, egg, true);
appendFocusSummary(summary, egg.text, true);
showToast('番茄钟已提前结束，小彩蛋已出现', 'warn');

  });
}

function appendFocusSummary(summary, eggText, early = false) {
  const root = document.querySelector('.visit2-focus-layout');
  if (!root) return;

  const card = document.createElement('section');
  card.className = 'visit2-card visit2-summary-card';
  card.innerHTML = `
    <div class="visit2-section-title">${early ? '提前结束的小结' : '做客结束啦'}</div>
    <div class="visit2-summary-text">${escapeHtml(summary)}</div>
    <div class="visit2-summary-mini">${escapeHtml(eggText)}</div>
  `;
  root.appendChild(card);
}

function bindChatActions() {
  document.getElementById('visit2-settings-btn')?.addEventListener('click', () => {
    const drawer = document.getElementById('visit2-settings-drawer');
    if (!drawer) return;
    drawer.hidden = !drawer.hidden;
  });

  document.getElementById('visit2-user-send-btn')?.addEventListener('click', async () => {
    await handleUserSend();
  });

  document.getElementById('visit2-user-input')?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await handleUserSend();
    }
  });

  document.getElementById('visit2-auto-btn')?.addEventListener('click', async (e) => {
    const rounds = Number(document.getElementById('visit2-auto-rounds')?.value || 0);
    if (!rounds || rounds < 1) {
      showToast('请输入有效轮数', 'warn');
      return;
    }
    await runAutoChat(rounds, e.currentTarget);
  });

  document.getElementById('visit2-stop-auto-btn')?.addEventListener('click', () => {
    visitRuntime.autoStop = true;
    setInlineStatus('正在停止自动聊天...');
    showToast('正在停止自动聊天...', 'info');
  });

  document.getElementById('visit2-end-chat-btn')?.addEventListener('click', async (e) => {
    await finishVisitWithFarewell(e.currentTarget);
  });
}

async function handleUserSend() {
  const input = document.getElementById('visit2-user-input');
  const text = input?.value.trim();
  if (!text) return;
  if (visitRuntime.autoRunning) {
    showToast('自动聊天进行中，请先停止', 'warn');
    return;
  }

  input.value = '';
  appendVisitMessage('user', '你', text);
  setInlineStatus('正在生成回应...');

  try {
    const friend = visitRuntime.friend;
    const ctx = visitRuntime.startedContext || {};
await generateVisitLineWithTyping({
  speaker: 'pet',
  friend,
  contextData: ctx,
  userText: text,
  mode: visitRuntime.mode,
});

await generateVisitLineWithTyping({
  speaker: 'friend',
  friend,
  contextData: ctx,
  userText: text,
  mode: visitRuntime.mode,
});
// === 区块结束：用户发言后的双回应 ===

    bumpIntimacy(1);
    setInlineStatus('回应完成');
  } catch (err) {
    setInlineStatus(`生成失败：${err.message}`);
    showToast(`聊天失败：${err.message}`, 'error');
  }
}

async function runAutoChat(rounds, btn) {
  if (visitRuntime.autoRunning) {
    showToast('自动聊天已经在进行中', 'warn');
    return;
  }

  const friend = visitRuntime.friend;
  const ctx = visitRuntime.startedContext || {};

  try {
    visitRuntime.autoRunning = true;
    visitRuntime.autoStop = false;
    setButtonLoading(btn, true, '自动聊天中...');
    setInlineStatus(`正在自动聊天（0/${rounds}）`);

    for (let i = 1; i <= rounds; i++) {
      if (visitRuntime.autoStop) {
        setInlineStatus(`自动聊天已停止（${i - 1}/${rounds}）`);
        showToast('自动聊天已停止', 'warn');
        break;
      }

      setInlineStatus(`正在自动聊天（${i}/${rounds}）`);

     await generateVisitLineWithTyping({
  speaker: 'pet',
  friend,
  contextData: ctx,
  mode: visitRuntime.mode,
});

await generateVisitLineWithTyping({
  speaker: 'friend',
  friend,
  contextData: ctx,
  mode: visitRuntime.mode,
});
// === 区块结束：自动聊天单轮 ===

      bumpIntimacy(1);
    }

    if (!visitRuntime.autoStop) {
  setInlineStatus('正在触发小彩蛋...');
  const egg = await getVisitEasterEgg(friend, ctx);
  appendVisitMessage('system', 'system', egg.text);
  bumpIntimacy(egg.effects?.intimacy || 1);
  setInlineStatus('自动聊天完成，小彩蛋已出现');
  showToast('自动聊天完成，小彩蛋已出现', 'success');
}
  } catch (err) {
    setInlineStatus(`自动聊天失败：${err.message}`);
    showToast(`自动聊天失败：${err.message}`, 'error');
  } finally {
    visitRuntime.autoRunning = false;
    visitRuntime.autoStop = false;
    setButtonLoading(btn, false);
  }
}

async function finishVisitWithFarewell(btn) {
  if (visitRuntime.autoRunning) {
    showToast('请先停止自动聊天', 'warn');
    return;
  }

  const friend = visitRuntime.friend;
  if (!friend) return;

  setButtonLoading(btn, true, '正在告别...');
  setInlineStatus('正在生成告别...');

  try {
   appendVisitMessage('system', 'system', '今天的做客要结束啦。');

await generateFarewellLineWithTyping('friend', friend);
await generateFarewellLineWithTyping('pet', friend);
// === 区块结束：做客告别消息 ===

    setInlineStatus('正在触发告别小彩蛋...');
const egg = await getVisitEasterEgg(friend, visitRuntime.startedContext || {});
appendVisitMessage('system', 'system', egg.text);
setInlineStatus('告别小彩蛋已出现');


    bumpIntimacy(5);
    await persistVisitResult(friend, {
      mode: visitRuntime.mode,
      contextData: visitRuntime.startedContext || {},
      egg,
      messages: visitRuntime.messages,
    });

        visitRuntime.status = VISIT_STATUS.COMPLETED;
    setInlineStatus('做客已经结束啦，可以手动关闭页面');
    showToast('做客记录已保存，请手动关闭', 'success');

    const endBtnEl = document.getElementById('visit2-end-chat-btn');
    if (endBtnEl) {
      endBtnEl.disabled = true;
      endBtnEl.textContent = '已结束';
    }

    const inputEl = document.getElementById('visit2-user-input');
    const sendBtnEl = document.getElementById('visit2-user-send-btn');
    const autoBtnEl = document.getElementById('visit2-auto-btn');
    const stopBtnEl = document.getElementById('visit2-stop-auto-btn');

    if (inputEl) {
      inputEl.disabled = true;
      inputEl.placeholder = '本次做客已结束';
    }
    if (sendBtnEl) {
      sendBtnEl.disabled = true;
      sendBtnEl.textContent = '已结束';
    }
    if (autoBtnEl) {
      autoBtnEl.disabled = true;
      autoBtnEl.textContent = '已结束';
    }
    if (stopBtnEl) {
      stopBtnEl.disabled = true;
    }

    appendVisitMessage('system', 'system', '本次做客已结束，你可以手动关闭页面。');

   } catch (err) {
    clearAllVisitTypingIndicators();
    showToast(`结束做客失败：${err.message}`, 'error');
    setInlineStatus(`结束失败：${err.message}`);
  } finally {
    clearAllVisitTypingIndicators();
    setButtonLoading(btn, false);
  }
// === 区块结束：结束做客收尾 ===
}

async function generateFarewellLine(role, friend) {
  const pet = runtime.pet || {};

  const messages = role === 'friend'
    ? buildFriendFarewellMessages(friend, pet)
    : buildPetFarewellMessages(pet, friend);

  const fallback = pickVisitFallback(role, 'farewell');


  try {
    const reply = await callAI({
      messages,
      stream: false,
    });
    return (reply || '').trim() || fallback;
  } catch (_) {
    return fallback;
  }
}

function buildFriendFarewellMessages(friend, pet) {
  const pc = runtime.settings?.promptConfig || {};
  const interactionRule = pc.friendInteraction || pc.interaction || '';

  const system = [
    `你是一只名叫「${friend.name}」的电子宠物，在好友「${pet.name || '宠物'}」家玩了一段时间。`,
    friend.customPrompt || `性格：${friend.personality || '活泼可爱'}`,
    pc.friendInteraction || '',
    interactionRule ? `互动规则：${interactionRule}` : '',
    '现在要回家了，说一句温暖的告别语（30字以内），表达今天玩得很开心，下次还要来。可以用颜文字。只输出这句话本身。',
  ].filter(Boolean).join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: '你要回家了，说一句告别的话。' },
  ];
}

function buildPetFarewellMessages(pet, friend) {
  const { getPersonalityPrompt, getPetStatusContext } = window._petHelpers || {};
  const personalityPrompt = getPersonalityPrompt ? getPersonalityPrompt(pet) : '';
  const statusContext = getPetStatusContext ? getPetStatusContext(pet) : '';
  const pc = runtime.settings?.promptConfig || {};
  const interactionRule = pc.friendInteraction || pc.interaction || '';

  const system = [
    `你是一只名叫「${pet.name || '宠物'}」的电子宠物。`,
    personalityPrompt,
    pc.petExtra || '',
    statusContext,
    `你的好友「${friend.name}」今天来做客，现在要回家了。`,
    interactionRule ? `互动规则：${interactionRule}` : '',
    '说一句依依不舍的送别语（30字以内），表达今天很开心，欢迎下次再来。可以用颜文字。只输出这句话本身。',
  ].filter(Boolean).join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: `${friend.name} 要回家了，你怎么送别？` },
  ];
}


function pickFarewellFallback(role) {
  const pool = VISIT_FAREWELL_FALLBACKS[role] || VISIT_FAREWELL_FALLBACKS.friend;
  return pool[Math.floor(Math.random() * pool.length)];
}
function appendVisitMessage(role, name, text) {
  const stream = document.getElementById('visit2-chat-stream');
  if (!stream) return null;

  const item = document.createElement('div');
  item.className = `visit2-msg visit2-msg-${role} is-entering`;
  item.dataset.role = role;

  if (role === 'system') {
    item.innerHTML = `<div class="visit2-system-pill">${escapeHtml(text)}</div>`;
  } else {
    const avatarHtml = role === 'pet'
      ? renderAvatarNode('pet', runtime.pet?.avatarUrl, '🐱')
      : role === 'friend'
        ? renderAvatarNode('friend', visitRuntime.friend?.avatarUrl, '🐾')
        : renderAvatarNode('user', getUserAvatarUrl(), '👤');

    item.innerHTML = `
      <div class="visit2-msg-avatar-wrap">${avatarHtml}</div>
      <div class="visit2-msg-body">
        <div class="visit2-msg-name">${escapeHtml(name)}</div>
        <div class="visit2-msg-bubble">${escapeHtml(text)}</div>
      </div>
    `;
  }

  stream.appendChild(item);

  requestAnimationFrame(() => {
    item.classList.remove('is-entering');
  });

  scrollVisitStreamToBottom();
  visitRuntime.messages.push({ role, name, text });
  return item;
}
// === 区块结束：appendVisitMessage ===
function scrollVisitStreamToBottom() {
  const stream = document.getElementById('visit2-chat-stream');
  if (!stream) return;
  stream.scrollTop = stream.scrollHeight;
}
// === 区块结束：scrollVisitStreamToBottom ===
function appendVisitTypingIndicator(role, name = '') {
  const stream = document.getElementById('visit2-chat-stream');
  if (!stream || role === 'system') return null;

  removeVisitTypingIndicator(role);

  const item = document.createElement('div');
  item.className = `visit2-msg visit2-msg-${role} visit2-msg-typing is-entering`;
  item.dataset.role = role;
  item.dataset.typing = '1';

  const avatarHtml = role === 'pet'
    ? renderAvatarNode('pet', runtime.pet?.avatarUrl, '🐱')
    : role === 'friend'
      ? renderAvatarNode('friend', visitRuntime.friend?.avatarUrl, '🐾')
      : renderAvatarNode('user', getUserAvatarUrl(), '👤');

  item.innerHTML = `
    <div class="visit2-msg-avatar-wrap">${avatarHtml}</div>
    <div class="visit2-msg-body">
      <div class="visit2-msg-name">${escapeHtml(name)}</div>
      <div class="visit2-msg-bubble visit2-typing-bubble" aria-label="正在输入">
        <span class="visit2-typing-dots">
          <span class="visit2-typing-dot"></span>
          <span class="visit2-typing-dot"></span>
          <span class="visit2-typing-dot"></span>
        </span>
      </div>
    </div>
  `;

  stream.appendChild(item);

  requestAnimationFrame(() => {
    item.classList.remove('is-entering');
  });

  visitRuntime.typingMap.set(role, item);
  scrollVisitStreamToBottom();
  return item;
}
// === 区块结束：appendVisitTypingIndicator ===

function removeVisitTypingIndicator(roleOrNode) {
  if (!roleOrNode) return;

  if (roleOrNode instanceof HTMLElement) {
    roleOrNode.remove();
    return;
  }

  const node = visitRuntime.typingMap.get(roleOrNode);
  if (node) {
    node.remove();
    visitRuntime.typingMap.delete(roleOrNode);
  }
}
// === 区块结束：removeVisitTypingIndicator ===

async function generateVisitLineWithTyping({
  speaker,
  friend,
  contextData,
  userText = '',
  mode,
}) {
  const name = speaker === 'pet'
    ? (runtime.pet?.name || '宠物')
    : (friend?.name || '好友');

  appendVisitTypingIndicator(speaker, name);

  try {
    const reply = await generateSingleLine({
      speaker,
      friend,
      contextData,
      userText,
      mode,
    });
    removeVisitTypingIndicator(speaker);
    appendVisitMessage(speaker, name, reply);
    return reply;
  } catch (err) {
    removeVisitTypingIndicator(speaker);
    throw err;
  }
}
// === 区块结束：generateVisitLineWithTyping ===

async function generateFarewellLineWithTyping(role, friend) {
  const name = role === 'pet'
    ? (runtime.pet?.name || '宠物')
    : (friend?.name || '好友');

  appendVisitTypingIndicator(role, name);

  try {
    const reply = await generateFarewellLine(role, friend);
    removeVisitTypingIndicator(role);
    appendVisitMessage(role, name, reply);
    return reply;
  } catch (err) {
    removeVisitTypingIndicator(role);
    throw err;
  }
}
// === 区块结束：generateFarewellLineWithTyping ===

function renderAvatarNode(type, avatarUrl, fallback) {
  const cls = `visit2-avatar visit2-avatar-${type}`;
  if (avatarUrl) {
    return `<div class="${cls}"><img src="${escapeHtml(avatarUrl)}" alt="" onerror="this.parentNode.innerHTML='${escapeHtml(fallback)}'" /></div>`;
  }
  return `<div class="${cls}">${escapeHtml(fallback)}</div>`;
}

function getUserAvatarUrl() {
  const s = runtime.settings || {};
  const u = s.userInfo || {};
  return u.avatarUrl || u.avatar || u.photo || s.userAvatar || s.avatarUrl || '';
}

function setInlineStatus(text) {
  const el = document.getElementById('visit2-inline-status');
  if (el) el.textContent = text;
}

function bumpIntimacy(step = 1) {
  visitRuntime.intimacyGain += step;
  const badge = document.getElementById('visit2-intimacy-badge');
  if (badge) badge.textContent = `亲密度 +${visitRuntime.intimacyGain}`;
}

function getSelectedItems(type) {
  return Array.from(document.querySelectorAll(`.visit2-select-card[data-type="${type}"].selected`))
    .map(el => ({
      id: el.dataset.id,
      label: el.dataset.label,
      promptTag: el.dataset.promptTag || '',
      tags: safeParseVisitTags(el.dataset.tags),
      species: safeParseVisitTags(el.dataset.species),
    }));
}
function safeParseVisitTags(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch (_) {
    return [];
  }
}


function getSingleSelectedItem(type) {
  return getSelectedItems(type)[0] || null;
}

function getCustomToys() {
  const vals = [
    document.getElementById('visit2-custom-toy-1')?.value.trim(),
    document.getElementById('visit2-custom-toy-2')?.value.trim(),
  ].filter(Boolean);

  return vals.slice(0, 2);
}

function renderSelectCard(item, type, single = false) {
  return `
    <button
      type="button"
      class="visit2-select-card"
      data-id="${escapeHtml(item.id)}"
      data-type="${escapeHtml(type)}"
      data-label="${escapeHtml(item.label)}"
      data-prompt-tag="${escapeHtml(item.promptTag || '')}"
      data-tags="${escapeHtml(JSON.stringify(item.tags || []))}"
      data-species="${escapeHtml(JSON.stringify(item.species || []))}"
      data-single="${single ? '1' : '0'}"
      onclick="window.__visit2ToggleSelect(this)"
    >

      <div class="visit2-select-icon">${item.icon}</div>
      <div class="visit2-select-title">${escapeHtml(item.label)}</div>
      <div class="visit2-select-desc">${escapeHtml(item.desc)}</div>
    </button>
  `;
}

function packSingleSelectCards(_all, compatible, type) {
  return compatible.map(item => renderSelectCard(item, type, true)).join('');
}

window.__visit2ToggleSelect = function(el) {
  const type = el.dataset.type;
  const isSingle = el.dataset.single === '1';

  if (isSingle) {
    document.querySelectorAll(`.visit2-select-card[data-type="${type}"]`).forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    return;
  }
  el.classList.toggle('selected');
};

function buildSettingSummaryText(ctx) {
  const arr = [];
  if (ctx.selectedToys?.length) arr.push(`玩具：${ctx.selectedToys.map(x => x.label).join('、')}`);
  if (ctx.customToys?.length) arr.push(`自定义：${ctx.customToys.join('、')}`);
  if (ctx.selectedGift) arr.push(`伴手礼：${ctx.selectedGift.label}`);
  if (ctx.selectedPack?.length) arr.push(`出门包：${ctx.selectedPack.map(x => x.label).join('、')}`);
  if (ctx.focusTask) arr.push(`任务：${ctx.focusTask}`);
  if (ctx.focusMinutes) arr.push(`时长：${ctx.focusMinutes} 分钟`);
  return arr.join(' ｜ ') || '本次没有额外准备';
}

async function generateVisitIntro({ mode, friend, selectedToys = [], customToys = [], selectedGift = null, selectedPack = [] }) {
  const pet = runtime.pet || {};
  const textContext = [
    mode === VISIT_MODES.INCOMING_CHAT ? '场景：对方来我家做客。' : '场景：我的宠物去对方家做客。',
    selectedToys.length ? `准备的玩具：${selectedToys.map(x => x.label).join('、')}` : '',
    customToys.length ? `自定义玩具：${customToys.join('、')}` : '',
    selectedGift ? `伴手礼：${selectedGift.label}` : '',
    selectedPack.length ? `出门包：${selectedPack.map(x => x.label).join('、')}` : '',
  ].filter(Boolean).join('\n');

  return await safeAIText({
    rolePrompt: `
你要生成一个电子宠物做客开场。
要求：
1. 只输出一句自然的小开场
2. 不超过50字
3. 可爱、温柔、像聊天
4. 点到准备的物品
`,
    userText: `
我的宠物：${pet.name || '小宠物'}
好友宠物：${friend.name}
${textContext}
请生成开场。
`,
    fallback: mode === VISIT_MODES.INCOMING_CHAT
      ? `${friend.name} 带着亮晶晶的眼神来做客了，一看到准备好的玩具就开心起来。`
      : `${pet.name || '小宠物'}带着准备好的伴手礼出发啦，看起来期待又兴奋。`,
  });
}

async function generateSingleLine({ speaker, friend, contextData, userText = '', mode }) {
  const pet = runtime.pet || {};
  const speakerName = speaker === 'pet' ? (pet.name || '小宠物') : friend.name;

  const promptBits = [];
  if (contextData.selectedToys?.length) promptBits.push(`玩具箱：${contextData.selectedToys.map(x => x.label).join('、')}`);
  if (contextData.customToys?.length) promptBits.push(`自定义玩具：${contextData.customToys.join('、')}`);
  if (contextData.selectedGift) promptBits.push(`伴手礼：${contextData.selectedGift.label}`);
  if (contextData.selectedPack?.length) promptBits.push(`出门包：${contextData.selectedPack.map(x => x.label).join('、')}`);

  const rolePrompt = `
你现在扮演一只电子宠物，名字叫 ${speakerName}。
要求：
1. 只说一句话
2. 不超过32字
3. 语气可爱自然
4. 像宠物聊天，不要像解释说明
`;

  const systemPrompt = await buildSystemPrompt({
    rolePrompt,
    statusContext: promptBits.join('\n'),
  });

  const userPrompt = `
场景模式：${mode}
互动对象：${speaker === 'pet' ? friend.name : (pet.name || '小宠物')}
${userText ? `用户刚刚说：${userText}` : '请自然接一句。'}
`;

   return await safeAIText({
    systemPrompt,
    userText: userPrompt,
    fallback: pickVisitFallback(speaker, 'general'),
  });

}
function normalizeVisitModeTag(mode) {
  if (mode === VISIT_MODES.INCOMING_CHAT) return 'incoming';
  if (mode === VISIT_MODES.OUTGOING_CHAT) return 'outgoing';
  if (mode === VISIT_MODES.OUTGOING_FOCUS) return 'focus';
  return '';
}

function buildVisitEggMatchTags(contextData = {}, mode = visitRuntime.mode, friend = null) {
  const tags = new Set();

  const modeShort = normalizeVisitModeTag(mode);
  if (mode) tags.add(`mode:${mode}`);
  if (modeShort) tags.add(modeShort);

  if (mode === VISIT_MODES.INCOMING_CHAT) tags.add('toy');

  if (mode === VISIT_MODES.OUTGOING_CHAT || mode === VISIT_MODES.OUTGOING_FOCUS) {
    tags.add('gift');
    tags.add('pack');
  }

  if (mode === VISIT_MODES.OUTGOING_FOCUS) {
    tags.add('focus');
  }

  const petSpecies = runtime.pet?.speciesGroup || '';
  const friendSpecies = friend?.speciesGroup || '';

  if (petSpecies) {
    tags.add(`species:${petSpecies}`);
    tags.add(petSpecies);
  }

  if (friendSpecies) {
    tags.add(`friend:${friendSpecies}`);
    tags.add(`species:${friendSpecies}`);
    tags.add(friendSpecies);
  }

  if (petSpecies && friendSpecies) {
    tags.add(`pair:${petSpecies}-${friendSpecies}`);
    tags.add(`pair:${friendSpecies}-${petSpecies}`);
  }

  const pushItemTags = (prefix, item) => {
    if (!item) return;

    if (item.id) {
      tags.add(prefix);
      tags.add(`${prefix}:${item.id}`);
    }

    if (Array.isArray(item.tags)) {
      item.tags.forEach(tag => {
        if (!tag) return;
        const value = String(tag);
        tags.add(value);
        tags.add(`${prefix}:${value}`);
      });
    }

    if (Array.isArray(item.species)) {
      item.species.forEach(sp => {
        if (!sp) return;
        tags.add(`item-species:${sp}`);
        tags.add(`${prefix}-species:${sp}`);
      });
    }

    if (item.promptTag) {
      String(item.promptTag)
        .split(/[，,、\s]+/)
        .map(x => x.trim())
        .filter(Boolean)
        .forEach(word => tags.add(word));
    }
  };

  (contextData.selectedToys || []).forEach(item => pushItemTags('toy', item));

  if (contextData.selectedGift) {
    pushItemTags('gift', contextData.selectedGift);
  }

  (contextData.selectedPack || []).forEach(item => pushItemTags('pack', item));

  (contextData.customToys || []).forEach(name => {
    if (!name) return;
    tags.add('toy');
    tags.add('custom-toy');
    tags.add(String(name).trim());
  });

  return tags;
}

function getVisitEggScore(egg, matchTags, mode) {
  if (!egg) return -999;

  if (Array.isArray(egg.modes) && egg.modes.length && !egg.modes.includes(mode)) {
    return -999;
  }

  const eggTags = Array.isArray(egg.tags) ? egg.tags : [];
  let score = 0;

  if (!Array.isArray(egg.modes) || !egg.modes.length) {
    score += 1;
  } else if (egg.modes.includes(mode)) {
    score += 6;
  }

  eggTags.forEach(tag => {
    if (!tag) return;
    if (matchTags.has(tag)) score += 4;
  });

  eggTags.forEach(tag => {
    if (/^(toy|gift|pack):/.test(tag) && matchTags.has(tag)) {
      score += 8;
    }
  });

  return score;
}

function pickWeightedVisitEgg(candidates) {
  if (!candidates.length) return null;

  const weighted = candidates.map(item => ({
    egg: item.egg,
    weight: Math.max(1, item.score + (item.egg.weight || 0)),
  }));

  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.egg;
  }

  return weighted[weighted.length - 1].egg;
}

function pickContextualVisitEgg(friend, contextData = {}, mode = visitRuntime.mode) {
  const matchTags = buildVisitEggMatchTags(contextData, mode, friend);

  const scored = VISIT_FALLBACK_EASTER_EGGS
    .map(egg => ({
      egg,
      score: getVisitEggScore(egg, matchTags, mode),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const bestScore = scored[0]?.score || 0;

  const candidates = scored.filter(item => {
    return item.score >= Math.max(1, bestScore - 6);
  });

  return pickWeightedVisitEgg(candidates) || VISIT_FALLBACK_EASTER_EGGS[
    Math.floor(Math.random() * VISIT_FALLBACK_EASTER_EGGS.length)
  ];
}

async function getVisitEasterEgg(friend, contextData = {}) {
  const mode = visitRuntime.mode || contextData.mode || VISIT_MODES.INCOMING_CHAT;
  const fallbackEgg = pickContextualVisitEgg(friend, contextData, mode);
  const shouldTryAI = Math.random() < 0.45;

  if (shouldTryAI) {
    try {
      const pet = runtime.pet || {};

      const text = await safeAIText({
        rolePrompt: '你负责生成一句宠物做客场景的小彩蛋提示。',
        userText: `
请根据“候选彩蛋”和“上下文”生成一句宠物做客彩蛋。

要求：
1. 不超过40字
2. 温柔可爱
3. 像系统旁白
4. 不要解释规则
5. 优先体现当前模式、玩具、礼物或出门包
6. 只输出一句话

我的宠物：${pet.name || '小宠物'}
好友：${friend?.name || '好友'}
模式：${mode}
候选彩蛋：${fallbackEgg?.text || ''}
上下文：${JSON.stringify({
  gift: contextData.selectedGift?.label || '',
  giftTags: contextData.selectedGift?.tags || [],
  pack: (contextData.selectedPack || []).map(x => x.label),
  packTags: (contextData.selectedPack || []).flatMap(x => x.tags || []),
  toys: (contextData.selectedToys || []).map(x => x.label),
  toyTags: (contextData.selectedToys || []).flatMap(x => x.tags || []),
  customToys: contextData.customToys || [],
})}
`,
        fallback: null,
      });

      if (text) {
        return {
          id: `ai_${fallbackEgg?.id || 'egg'}`,
          text,
          effects: fallbackEgg?.effects || { intimacy: 2, mood: 1 },
          sourceEggId: fallbackEgg?.id || '',
          tags: fallbackEgg?.tags || [],
        };
      }
    } catch (err) {
      console.warn('[visit] easter egg AI failed, use contextual fallback', err);
    }
  }

  return fallbackEgg;
}


async function generateFocusReturnSummary(friend, ctx, egg, early = false) {
  const pet = runtime.pet || {};
  return await safeAIText({
    rolePrompt: `
你要生成一句宠物做客回家总结。
要求：
1. 不超过50字
2. 像宠物回家后轻轻分享今天发生的事
3. 温柔可爱
`,
    userText: `
宠物：${pet.name || '小宠物'}
好友：${friend.name}
任务：${ctx.focusTask || ''}
时长：${ctx.focusMinutes || 0}
彩蛋：${egg?.text || ''}
${early ? '这是提前结束的番茄钟。' : '这是完整完成的番茄钟。'}
`,
    fallback: early
      ? `${pet.name || '小宠物'}提前回家了，看起来还是很想和你分享刚刚的小见闻。`
      : `${pet.name || '小宠物'}回家啦，像是带着今天做客时的小开心一起回来了。`,
  });
}

async function safeAIText({ rolePrompt = '', systemPrompt = '', userText = '', fallback = '' }) {
  try {
    const finalSystemPrompt = systemPrompt || await buildSystemPrompt({ rolePrompt });
    const reply = await callAI({
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: userText },
      ],
      stream: false,
    });
    return (reply || '').trim() || fallback;
  } catch (_) {
    if (fallback === null) throw _;
    return fallback;
  }
}

async function persistVisitResult(friend, payload) {
  const pet = runtime.pet || {};
  const newIntimacy = Math.min(100, (friend.intimacy || 0) + visitRuntime.intimacyGain);

  const recentTexts = (visitRuntime.messages || [])
    .filter(x => x.role !== 'system')
    .slice(-6)
    .map(x => x.text)
    .join(' | ')
    .slice(0, 200);

  const updatedFriend = {
    ...friend,
    intimacy: newIntimacy,
    lastVisitAt: Date.now(),
    memoryContext: recentTexts,
  };

  await dbSet('petFriends', updatedFriend);

  await dbAppend('visitHistory', {
    type: 'visit',
    friendId: friend.id,
    friendName: friend.name,
    mode: payload.mode,
    intimacyGain: visitRuntime.intimacyGain,
    egg: payload.egg?.text || '',
    messages: payload.messages || [],
    contextData: payload.contextData || {},
  });

  await dbAppend('actionLog', {
    type: 'VISIT_V2',
    source: 'visit2',
    message: `${pet.name || '宠物'} 与 ${friend.name} 完成一次做客，亲密度 +${visitRuntime.intimacyGain}`,
  });

  await savePet({
    mood: Math.min(100, (pet.mood || 0) + 2),
    bond: Math.min(100, (pet.bond || 0) + 1),
  });
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function injectVisitStyles() {
  if (document.getElementById('visit2-style')) return;

  const style = document.createElement('style');
  style.id = 'visit2-style';
  style.textContent = `
    #visit2-overlay{
      position:fixed;
      inset:0;
      z-index:9999;
      background:rgba(0,0,0,.18);
      backdrop-filter:blur(8px);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:18px;
    }
.visit2-modal{
  width:min(860px, 100%);
  height:min(92vh, 920px);
  max-height:92vh;
  display:flex;
  min-height:0;
}

.visit2-shell{
  background:var(--bg-shell);
  color:var(--text-primary);
  border:1px solid var(--border-color);
  border-radius:28px;
  box-shadow:var(--shadow-shell);
  overflow:hidden;
  display:flex;
  flex-direction:column;
  width:100%;
  height:100%;
  min-height:0;
}

.visit2-content{
  flex:1;
  min-height:0;
  padding:18px;
  overflow-y:auto;
  overflow-x:hidden;
  -webkit-overflow-scrolling:touch;
  background:var(--bg-screen);
}


    .visit2-topbar{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:16px;
      padding:20px 22px;
      border-bottom:1px solid var(--border-subtle);
      background:var(--bg-shell);
    }

    .visit2-title{
      font-size:24px;
      font-weight:800;
      letter-spacing:-0.02em;
    }

    .visit2-subtitle{
      margin-top:4px;
      font-size:13px;
      color:var(--text-secondary);
    }

    .visit2-icon-btn{
      width:40px;
      height:40px;
      border:none;
      border-radius:999px;
      background:var(--bg-card-alt);
      color:var(--text-primary);
      cursor:pointer;
      flex-shrink:0;
    }

    .visit2-content{
      padding:18px;
      overflow:auto;
      background:var(--bg-screen);
    }

    .visit2-prep-stack,
    .visit2-chat-layout,
    .visit2-focus-layout{
      display:flex;
      flex-direction:column;
      gap:16px;
    }

    .visit2-card,
    .visit2-chat-header-card,
    .visit2-drawer-card,
    .visit2-chat-stream-card,
    .visit2-input-card{
      background:var(--bg-card);
      border:1px solid var(--border-color);
      border-radius:24px;
      padding:18px;
      box-shadow:var(--shadow-card);
    }

    .visit2-action-card{
      display:flex;
      justify-content:flex-end;
    }

    .visit2-mode-switch{
      display:flex;
      flex-wrap:wrap;
      gap:12px;
    }

    .visit2-mode-chip{
      border:none;
      background:var(--bg-card-alt);
      color:var(--text-primary);
      padding:12px 16px;
      border-radius:999px;
      cursor:pointer;
      font-weight:700;
    }

    .visit2-mode-chip.active{
      background:var(--accent-primary);
      color:var(--text-on-accent);
    }

    .visit2-soft-tip{
      margin-top:14px;
      padding:12px 14px;
      border-radius:18px;
      background:var(--bg-card-alt);
      color:var(--text-secondary);
      font-size:13px;
      line-height:1.6;
    }

    .visit2-section-title{
      font-size:18px;
      font-weight:800;
      margin-bottom:14px;
      letter-spacing:-0.02em;
    }

    .visit2-card-grid{
      display:grid;
      grid-template-columns:repeat(auto-fill, minmax(160px, 1fr));
      gap:14px;
    }

    .visit2-select-card{
      border:1px solid var(--border-color);
      border-radius:20px;
      background:var(--bg-card);
      padding:16px;
      text-align:left;
      cursor:pointer;
      color:var(--text-primary);
      min-height:138px;
      transition:transform .15s ease, border-color .15s ease, background .15s ease;
    }

    .visit2-select-card:hover{
      transform:translateY(-1px);
    }

    .visit2-select-card.selected{
      border-color:var(--accent-primary);
      background:var(--bg-card-alt);
    }

    .visit2-select-icon{
      font-size:24px;
      margin-bottom:10px;
    }

    .visit2-select-title{
      font-size:15px;
      font-weight:800;
      margin-bottom:6px;
    }

    .visit2-select-desc{
      font-size:12px;
      line-height:1.65;
      color:var(--text-secondary);
    }

    .visit2-field-stack{
      display:flex;
      flex-direction:column;
      gap:14px;
    }

    .visit2-input{
      width:100%;
      border:1px solid var(--border-color);
      background:var(--bg-card);
      color:var(--text-primary);
      border-radius:18px;
      padding:14px 16px;
      outline:none;
      font-size:14px;
    }

    .visit2-input::placeholder{
      color:var(--text-secondary);
    }

    .visit2-primary-btn,
    .visit2-secondary-btn,
    .visit2-ghost-btn,
    .visit2-danger-btn{
      border:none;
      border-radius:18px;
      padding:13px 18px;
      font-weight:800;
      cursor:pointer;
    }

    .visit2-primary-btn{
      background:var(--accent-primary);
      color:var(--text-on-accent);
    }

    .visit2-secondary-btn{
      background:var(--bg-card-alt);
      color:var(--text-primary);
    }

    .visit2-ghost-btn{
      background:transparent;
      color:var(--text-secondary);
      border:1px solid var(--border-color);
    }

    .visit2-danger-btn{
      background:var(--bg-card-alt);
      color:var(--text-primary);
      border:1px solid var(--border-color);
    }

    .visit2-chat-header-card{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:18px;
    }

    .visit2-chat-header-main{
      display:flex;
      align-items:center;
      gap:16px;
      min-width:0;
    }

    .visit2-dual-avatars{
      display:flex;
      align-items:flex-start;
      gap:14px;
      flex-shrink:0;
    }

    .visit2-entity{
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:8px;
    }

    .visit2-entity-name{
      font-size:12px;
      color:var(--text-secondary);
      text-align:center;
      max-width:84px;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }

    .visit2-chat-title{
      font-size:20px;
      font-weight:800;
      margin-bottom:4px;
      letter-spacing:-0.02em;
    }

    .visit2-chat-sub{
      font-size:13px;
      color:var(--text-secondary);
      line-height:1.6;
    }

    .visit2-chat-header-actions{
      display:flex;
      align-items:center;
      gap:10px;
      flex-shrink:0;
    }

    .visit2-intimacy{
      font-size:13px;
      color:var(--text-secondary);
      padding:10px 12px;
      border-radius:999px;
      background:var(--bg-card-alt);
      white-space:nowrap;
    }

    .visit2-avatar{
      width:52px;
      height:52px;
      border-radius:18px;
      overflow:hidden;
      display:flex;
      align-items:center;
      justify-content:center;
      background:var(--bg-card-alt);
      color:var(--text-primary);
      font-size:24px;
      border:1px solid var(--border-color);
    }

    .visit2-avatar img{
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
    }

    .visit2-drawer-card{
      background:var(--bg-card);
    }

    .visit2-settings-grid{
      display:flex;
      flex-direction:column;
      gap:16px;
    }

    .visit2-settings-block{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .visit2-settings-title{
      font-size:14px;
      font-weight:800;
    }

    .visit2-inline-row{
      display:flex;
      gap:10px;
      align-items:center;
      flex-wrap:wrap;
    }

    .visit2-round-input{
      max-width:96px;
    }

    .visit2-setting-summary{
      font-size:13px;
      line-height:1.7;
      color:var(--text-secondary);
      background:var(--bg-card-alt);
      border-radius:16px;
      padding:12px 14px;
    }

   .visit2-chat-stream{
  min-height:340px;
  max-height:46vh;
  overflow-y:auto;
  overflow-x:hidden;
  -webkit-overflow-scrolling:touch;
  display:flex;
  flex-direction:column;
  gap:16px;
  padding:4px;
}


    .visit2-msg{
      display:flex;
      gap:12px;
      align-items:flex-end;
    }

    .visit2-msg-pet{
      justify-content:flex-start;
    }

    .visit2-msg-friend{
      justify-content:flex-end;
      flex-direction:row-reverse;
    }

    .visit2-msg-user{
      justify-content:flex-end;
      flex-direction:row-reverse;
    }

    .visit2-msg-system{
      justify-content:center;
    }

    .visit2-msg-avatar-wrap{
      flex-shrink:0;
    }

    .visit2-msg-body{
      max-width:min(74%, 520px);
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    .visit2-msg-pet .visit2-msg-body{
      align-items:flex-start;
    }

    .visit2-msg-friend .visit2-msg-body,
    .visit2-msg-user .visit2-msg-body{
      align-items:flex-end;
    }

    .visit2-msg-name{
      font-size:12px;
      color:var(--text-secondary);
      padding:0 4px;
    }

    .visit2-msg-bubble{
      border-radius:20px;
      padding:12px 14px;
      line-height:1.7;
      font-size:14px;
      word-break:break-word;
      border:1px solid var(--border-color);
      background:var(--bg-card-alt);
      color:var(--text-primary);
    }

    .visit2-msg-pet .visit2-msg-bubble{
      background:var(--bg-card);
    }

    .visit2-msg-friend .visit2-msg-bubble{
      background:var(--bg-card-alt);
    }

    .visit2-msg-user .visit2-msg-bubble{
      background:var(--accent-primary);
      color:var(--text-on-accent);
      border-color:transparent;
    }
          .visit2-msg{
      display:flex;
      gap:12px;
      align-items:flex-end;
      transition:opacity .22s ease, transform .22s ease;
      will-change:transform, opacity;
    }

    .visit2-msg.is-entering{
      opacity:0;
      transform:translateY(10px);
    }

    .visit2-msg-avatar-wrap{
      flex-shrink:0;
      transform-origin:bottom center;
      animation:visit2AvatarPop .28s cubic-bezier(.2,.9,.2,1);
    }

    .visit2-msg-body{
      max-width:min(74%, 520px);
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    .visit2-msg-bubble{
      border-radius:20px;
      padding:12px 14px;
      line-height:1.7;
      font-size:14px;
      word-break:break-word;
      border:1px solid var(--border-color);
      background:var(--bg-card-alt);
      color:var(--text-primary);
      box-shadow:0 6px 16px rgba(0,0,0,.04);
    }

    .visit2-msg-system .visit2-system-pill{
      animation:visit2SystemFade .22s ease;
    }

    .visit2-msg-typing .visit2-msg-bubble{
      min-width:62px;
      padding:12px 14px;
    }

    .visit2-typing-bubble{
      display:flex;
      align-items:center;
      justify-content:flex-start;
    }

    .visit2-typing-dots{
      display:inline-flex;
      align-items:center;
      gap:6px;
    }

    .visit2-typing-dot{
      width:7px;
      height:7px;
      border-radius:999px;
      background:currentColor;
      opacity:.35;
      animation:visit2TypingBounce 1s infinite ease-in-out;
    }

    .visit2-typing-dot:nth-child(2){
      animation-delay:.16s;
    }

    .visit2-typing-dot:nth-child(3){
      animation-delay:.32s;
    }

    @keyframes visit2AvatarPop{
      0%{
        transform:scale(.86);
        opacity:0;
      }
      100%{
        transform:scale(1);
        opacity:1;
      }
    }

    @keyframes visit2TypingBounce{
      0%, 80%, 100%{
        transform:translateY(0);
        opacity:.3;
      }
      40%{
        transform:translateY(-4px);
        opacity:1;
      }
    }

    @keyframes visit2SystemFade{
      0%{
        opacity:0;
        transform:translateY(6px);
      }
      100%{
        opacity:1;
        transform:translateY(0);
      }
    }


    .visit2-system-pill{
      font-size:12px;
      color:var(--text-secondary);
      background:var(--bg-card-alt);
      border-radius:999px;
      padding:8px 12px;
      line-height:1.4;
    }

    .visit2-input-row{
      display:flex;
      gap:12px;
      align-items:center;
    }

    .visit2-chat-input{
      flex:1;
    }

    .visit2-send-btn{
      flex-shrink:0;
      min-width:90px;
    }

    .visit2-inline-tip{
      margin-top:12px;
      font-size:12px;
      color:var(--text-secondary);
    }

    .visit2-focus-meta{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .visit2-focus-line{
      font-size:14px;
      color:var(--text-secondary);
      line-height:1.7;
    }

    .visit2-focus-card{
      text-align:center;
      padding-top:24px;
      padding-bottom:24px;
    }

    .visit2-focus-time{
      font-size:52px;
      font-weight:900;
      line-height:1;
      letter-spacing:0.04em;
      margin-bottom:12px;
    }

    .visit2-summary-card{
      margin-top:4px;
    }

    .visit2-summary-text{
      font-size:14px;
      line-height:1.8;
      color:var(--text-primary);
      margin-bottom:10px;
    }

    .visit2-summary-mini{
      font-size:12px;
      line-height:1.7;
      color:var(--text-secondary);
    }

    .is-loading{
      opacity:.7;
      pointer-events:none;
    }

    @media (max-width: 768px){
      .visit2-content{
        padding:14px;
      }
        .visit2-modal{
  width:100%;
  height:94vh;
  max-height:94vh;
}


      .visit2-topbar{
        padding:16px;
      }

      .visit2-chat-header-card{
        flex-direction:column;
        align-items:stretch;
      }

      .visit2-chat-header-main{
        align-items:flex-start;
      }

      .visit2-chat-header-actions{
        justify-content:space-between;
      }

      .visit2-card-grid{
        grid-template-columns:1fr 1fr;
      }

      .visit2-input-row{
        flex-direction:column;
        align-items:stretch;
      }

      .visit2-send-btn{
        width:100%;
      }

      .visit2-inline-row{
        flex-direction:column;
        align-items:stretch;
      }

      .visit2-round-input{
        max-width:none;
      }

      .visit2-msg-body{
        max-width:84%;
      }
    }

    @media (max-width: 520px){
      .visit2-card-grid{
        grid-template-columns:1fr;
      }

      .visit2-title{
        font-size:22px;
      }

      .visit2-chat-title{
        font-size:18px;
      }

      .visit2-avatar{
        width:46px;
        height:46px;
        border-radius:16px;
      }
    }
  `;
  document.head.appendChild(style);
}
