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
  getSpeciesMeta,
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
  visitRuntime.friend = friend;
  visitRuntime.mode = VISIT_MODES.INCOMING_CHAT;
  visitRuntime.status = VISIT_STATUS.IDLE;
  visitRuntime.messages = [];
  visitRuntime.intimacyGain = 0;
  visitRuntime.autoRunning = false;
  visitRuntime.autoStop = false;

  const pet = runtime.pet || {};
  const friendSpecies = friend.speciesGroup || 'mammal';

  const toyItems = getCompatibleVisitItems(VISIT_TOY_ITEMS, friendSpecies);
  const giftItems = getCompatibleVisitItems(VISIT_GIFT_ITEMS, friendSpecies);
  const packItems = getCompatibleVisitItems(VISIT_OUTING_PACK_ITEMS, pet.speciesGroup || 'mammal');

  const overlay = document.createElement('div');
  overlay.id = 'visit2-overlay';
  overlay.innerHTML = `
    <div class="visit2-panel">
      <div class="visit2-header">
        <div>
          <div class="visit2-title">宠物做客</div>
          <div class="visit2-sub">${pet.name || '我的宠物'} × ${friend.name}</div>
        </div>
        <button class="visit2-close" id="visit2-close-btn">✕</button>
      </div>

      <div class="visit2-body">
        <div class="visit2-mode-row">
          <button class="visit2-mode active" data-mode="${VISIT_MODES.INCOMING_CHAT}">来我家做客</button>
          <button class="visit2-mode" data-mode="${VISIT_MODES.OUTGOING_CHAT}">去对方家做客</button>
          <button class="visit2-mode" data-mode="${VISIT_MODES.OUTGOING_FOCUS}">做客番茄钟</button>
        </div>

        <div class="visit2-status" id="visit2-status">请选择本次做客方式与准备内容</div>

        <div id="visit2-config-area"></div>

        <div id="visit2-active-area" style="display:none;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#visit2-close-btn')?.addEventListener('click', closeVisitComposer);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeVisitComposer();
  });

  overlay.querySelectorAll('.visit2-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.visit2-mode').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      visitRuntime.mode = btn.dataset.mode;
      renderConfigArea({ toyItems, giftItems, packItems, friend });
    });
  });

  renderConfigArea({ toyItems, giftItems, packItems, friend });
}

function closeVisitComposer() {
  if (visitRuntime.focusTimer) {
    clearInterval(visitRuntime.focusTimer);
    visitRuntime.focusTimer = null;
  }
  const old = document.getElementById('visit2-overlay');
  if (old) old.remove();
}

function renderConfigArea({ toyItems, giftItems, packItems, friend }) {
  const config = document.getElementById('visit2-config-area');
  const active = document.getElementById('visit2-active-area');
  if (!config || !active) return;

  active.style.display = 'none';
  config.style.display = 'block';

  if (visitRuntime.mode === VISIT_MODES.INCOMING_CHAT) {
    config.innerHTML = `
      <div class="visit2-section">
        <div class="visit2-section-title">为来访好友准备玩具箱</div>
        <div class="visit2-grid">
          ${toyItems.map(item => itemCard(item, 'toy')).join('')}
        </div>
      </div>

      <div class="visit2-section">
        <div class="visit2-section-title">自定义玩具（最多 2 个）</div>
        <div class="visit2-custom-wrap">
          <input class="visit2-input" id="visit2-custom-toy-1" maxlength="16" placeholder="例如：彩虹积木" />
          <input class="visit2-input" id="visit2-custom-toy-2" maxlength="16" placeholder="例如：星星小鼓" />
        </div>
      </div>

      <div class="visit2-actions">
        <button class="visit2-primary" id="visit2-start-btn">开始做客聊天</button>
      </div>
    `;
  }

  if (visitRuntime.mode === VISIT_MODES.OUTGOING_CHAT) {
    config.innerHTML = `
      <div class="visit2-section">
        <div class="visit2-section-title">给 ${friend.name} 准备伴手礼</div>
        <div class="visit2-grid">
          ${giftItems.map(item => itemCard(item, 'gift', true)).join('')}
        </div>
      </div>

      <div class="visit2-section">
        <div class="visit2-section-title">整理出门包</div>
        <div class="visit2-grid">
          ${packItems.map(item => itemCard(item, 'pack')).join('')}
        </div>
      </div>

      <div class="visit2-actions">
        <button class="visit2-primary" id="visit2-start-btn">开始去做客</button>
      </div>
    `;
  }

  if (visitRuntime.mode === VISIT_MODES.OUTGOING_FOCUS) {
    config.innerHTML = `
      <div class="visit2-section">
        <div class="visit2-section-title">给 ${friend.name} 准备伴手礼</div>
        <div class="visit2-grid">
          ${giftItems.map(item => itemCard(item, 'gift', true)).join('')}
        </div>
      </div>

      <div class="visit2-section">
        <div class="visit2-section-title">整理出门包</div>
        <div class="visit2-grid">
          ${packItems.map(item => itemCard(item, 'pack')).join('')}
        </div>
      </div>

      <div class="visit2-section">
        <div class="visit2-section-title">我的专注任务</div>
        <input class="visit2-input" id="visit2-focus-task" maxlength="40" placeholder="例如：写报告 / 背单词 / 画图" />
      </div>

      <div class="visit2-section">
        <div class="visit2-section-title">番茄钟时长（分钟）</div>
        <input class="visit2-input" id="visit2-focus-minutes" type="number" min="1" max="300" value="25" placeholder="请输入分钟数" />
      </div>

      <div class="visit2-actions">
        <button class="visit2-primary" id="visit2-start-btn">开始番茄钟</button>
      </div>
    `;
  }

  bindConfigActions(friend);
}

function bindConfigActions(friend) {
  const startBtn = document.getElementById('visit2-start-btn');
  if (!startBtn) return;

  startBtn.addEventListener('click', async () => {
    if (visitRuntime.mode === VISIT_MODES.INCOMING_CHAT) {
      await startIncomingChat(friend, startBtn);
    } else if (visitRuntime.mode === VISIT_MODES.OUTGOING_CHAT) {
      await startOutgoingChat(friend, startBtn);
    } else {
      await startFocusVisit(friend, startBtn);
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

  try {
    setButtonLoading(btn, true, '正在准备待客...');
    setVisitStatus('正在布置玩具箱...');
    const intro = await generateVisitIntro({
      mode: VISIT_MODES.INCOMING_CHAT,
      friend,
      selectedToys,
      customToys,
    });

    showToast('做客开始啦', 'success');
    openChatScene({
      title: `${friend.name} 来做客啦`,
      subtitle: `玩具箱已准备好`,
      intro,
      friend,
      contextData: { selectedToys, customToys },
    });
  } catch (err) {
    showToast(`开始失败：${err.message}`, 'error');
    setVisitStatus(`开始失败：${err.message}`, 'error');
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

  try {
    setButtonLoading(btn, true, '正在整理出门包...');
    setVisitStatus('正在准备伴手礼...');
    const intro = await generateVisitIntro({
      mode: VISIT_MODES.OUTGOING_CHAT,
      friend,
      selectedGift,
      selectedPack,
    });

    showToast('已经出发去做客啦', 'success');
    openChatScene({
      title: `去 ${friend.name} 家做客`,
      subtitle: `带上了伴手礼与出门包`,
      intro,
      friend,
      contextData: { selectedGift, selectedPack },
    });
  } catch (err) {
    showToast(`开始失败：${err.message}`, 'error');
    setVisitStatus(`开始失败：${err.message}`, 'error');
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

  try {
    setButtonLoading(btn, true, '正在启动番茄钟...');
    setVisitStatus('宠物正在出发...');

    openFocusScene({
      friend,
      selectedGift,
      selectedPack,
      focusTask,
      minutes,
    });

    showToast('番茄钟已开始', 'success');
  } catch (err) {
    showToast(`启动失败：${err.message}`, 'error');
    setVisitStatus(`启动失败：${err.message}`, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

function openChatScene({ title, subtitle, intro, friend, contextData }) {
  const config = document.getElementById('visit2-config-area');
  const active = document.getElementById('visit2-active-area');
  if (!config || !active) return;

  config.style.display = 'none';
  active.style.display = 'block';
  visitRuntime.status = VISIT_STATUS.ACTIVE;
  visitRuntime.messages = [];

  active.innerHTML = `
    <div class="visit2-chat-header">
      <div>
        <div class="visit2-section-title">${title}</div>
        <div class="visit2-mini">${subtitle}</div>
      </div>
      <div class="visit2-mini" id="visit2-intimacy-text">亲密度 +0</div>
    </div>

    <div class="visit2-chat-box" id="visit2-chat-box"></div>

    <div class="visit2-auto-row">
      <input class="visit2-input small" id="visit2-auto-rounds" type="number" min="1" max="10" value="3" />
      <button class="visit2-secondary" id="visit2-auto-btn">自动聊天</button>
      <button class="visit2-ghost" id="visit2-stop-auto-btn">停止</button>
    </div>

    <div class="visit2-auto-row">
      <input class="visit2-input" id="visit2-user-input" maxlength="80" placeholder="你也可以插一句话..." />
      <button class="visit2-primary" id="visit2-user-send-btn">发送</button>
    </div>

    <div class="visit2-actions">
      <button class="visit2-secondary" id="visit2-end-chat-btn">结束做客</button>
    </div>
  `;

  appendChatLine('system', intro);

  document.getElementById('visit2-auto-btn')?.addEventListener('click', async (e) => {
    const rounds = Number(document.getElementById('visit2-auto-rounds')?.value || 0);
    if (!rounds || rounds < 1) {
      showToast('请输入有效轮数', 'warn');
      return;
    }
    await runAutoChat(rounds, friend, contextData, e.currentTarget);
  });

  document.getElementById('visit2-stop-auto-btn')?.addEventListener('click', () => {
    visitRuntime.autoStop = true;
    showToast('正在停止自动聊天...', 'info');
  });

  document.getElementById('visit2-user-send-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('visit2-user-input');
    const text = input?.value.trim();
    if (!text) return;
    input.value = '';
    appendChatLine('user', text);
    setVisitStatus('正在生成回应...');
    try {
      const petReply = await generateSingleLine({
        speaker: 'pet',
        friend,
        contextData,
        userText: text,
        mode: visitRuntime.mode,
      });
      appendChatLine('pet', petReply);

      const friendReply = await generateSingleLine({
        speaker: 'friend',
        friend,
        contextData,
        userText: text,
        mode: visitRuntime.mode,
      });
      appendChatLine('friend', friendReply);

      bumpIntimacy(1);
      setVisitStatus('回应完成');
    } catch (err) {
      showToast(`聊天失败：${err.message}`, 'error');
      setVisitStatus(`聊天失败：${err.message}`, 'error');
    }
  });

  document.getElementById('visit2-end-chat-btn')?.addEventListener('click', async () => {
    setVisitStatus('正在结束做客...');
    const egg = await getVisitEasterEgg(friend, contextData);
    appendChatLine('system', `今天的做客结束啦。${egg.text}`);
    bumpIntimacy(egg.effects?.intimacy || 2);
    await persistVisitResult(friend, {
      mode: visitRuntime.mode,
      contextData,
      egg,
      messages: visitRuntime.messages,
    });
    showToast('做客记录已保存', 'success');
  });
}

function openFocusScene({ friend, selectedGift, selectedPack, focusTask, minutes }) {
  const config = document.getElementById('visit2-config-area');
  const active = document.getElementById('visit2-active-area');
  if (!config || !active) return;

  config.style.display = 'none';
  active.style.display = 'block';
  visitRuntime.status = VISIT_STATUS.FOCUS;

  const endAt = Date.now() + minutes * 60 * 1000;
  visitRuntime.focusEndAt = endAt;

  active.innerHTML = `
    <div class="visit2-section-title">${runtime.pet?.name || '宠物'} 正在 ${friend.name} 家做客</div>
    <div class="visit2-mini">专注任务：${escapeHtml(focusTask)}</div>
    <div class="visit2-mini">伴手礼：${escapeHtml(selectedGift.label)}</div>
    <div class="visit2-mini">出门包：${selectedPack.map(x => x.label).join('、') || '轻装出门'}</div>

    <div class="visit2-focus-timer" id="visit2-focus-timer">--:--</div>
    <div class="visit2-status" id="visit2-focus-status">宠物正在开心做客，你也开始专注吧</div>

    <div class="visit2-actions">
      <button class="visit2-secondary" id="visit2-finish-focus-btn">提前结束</button>
    </div>
  `;

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
      if (statusEl) statusEl.textContent = '宠物回家啦，正在整理这次做客的小结...';

      const egg = await getVisitEasterEgg(friend, { selectedGift, selectedPack, focusTask });
      await persistVisitResult(friend, {
        mode: VISIT_MODES.OUTGOING_FOCUS,
        contextData: { selectedGift, selectedPack, focusTask, minutes },
        egg,
        messages: [],
      });

      appendFocusSummary(friend, focusTask, minutes, egg);
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
    showToast('番茄钟已提前结束', 'warn');
    const egg = await getVisitEasterEgg(friend, { selectedGift, selectedPack, focusTask });
    appendFocusSummary(friend, focusTask, minutes, egg, true);
  });
}

function appendFocusSummary(friend, focusTask, minutes, egg, early = false) {
  const active = document.getElementById('visit2-active-area');
  if (!active) return;

  const wrap = document.createElement('div');
  wrap.className = 'visit2-summary';
  wrap.innerHTML = `
    <div class="visit2-section-title">${early ? '提前结束的小结' : '本次番茄钟完成'}</div>
    <div class="visit2-mini">任务：${escapeHtml(focusTask)}</div>
    <div class="visit2-mini">时长：${minutes} 分钟</div>
    <div class="visit2-mini">${friend.name} 家做客反馈：${escapeHtml(egg.text)}</div>
  `;
  active.appendChild(wrap);
}

async function runAutoChat(rounds, friend, contextData, btn) {
  if (visitRuntime.autoRunning) {
    showToast('自动聊天已经在进行中', 'warn');
    return;
  }

  try {
    visitRuntime.autoRunning = true;
    visitRuntime.autoStop = false;
    setButtonLoading(btn, true, '自动聊天中...');
    setVisitStatus(`正在自动聊天（0/${rounds}）`);

    for (let i = 1; i <= rounds; i++) {
      if (visitRuntime.autoStop) {
        setVisitStatus(`自动聊天已停止（完成 ${i - 1}/${rounds} 轮）`, 'warn');
        showToast('自动聊天已停止', 'warn');
        break;
      }

      setVisitStatus(`正在自动聊天（${i}/${rounds}）`);

      const petReply = await generateSingleLine({
        speaker: 'pet',
        friend,
        contextData,
        mode: visitRuntime.mode,
      });
      appendChatLine('pet', petReply);

      const friendReply = await generateSingleLine({
        speaker: 'friend',
        friend,
        contextData,
        mode: visitRuntime.mode,
      });
      appendChatLine('friend', friendReply);

      bumpIntimacy(1);
    }

    if (!visitRuntime.autoStop) {
      const egg = await getVisitEasterEgg(friend, contextData);
      appendChatLine('system', egg.text);
      bumpIntimacy(egg.effects?.intimacy || 1);
      setVisitStatus('自动聊天完成');
      showToast('自动聊天完成', 'success');
    }
  } catch (err) {
    showToast(`自动聊天失败：${err.message}`, 'error');
    setVisitStatus(`自动聊天失败：${err.message}`, 'error');
  } finally {
    visitRuntime.autoRunning = false;
    visitRuntime.autoStop = false;
    setButtonLoading(btn, false);
  }
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
回复要求：
1. 只输出一小段开场，不超过60字
2. 可爱、自然、温暖
3. 点到准备物品
4. 不要解释，不要分点
`,
    userText: `
我的宠物：${pet.name || '小宠物'}
好友宠物：${friend.name}
${textContext}
请生成开场。
`,
    fallback: mode === VISIT_MODES.INCOMING_CHAT
      ? `${friend.name} 带着好奇的小眼神来做客了，看到准备好的玩具箱后明显开心了起来。`
      : `${pet.name || '小宠物'}带着准备好的伴手礼出发去做客啦，看起来有点兴奋又有点期待。`,
  });
}

async function generateSingleLine({ speaker, friend, contextData, userText = '', mode }) {
  const pet = runtime.pet || {};
  const speakerName = speaker === 'pet' ? (pet.name || '小宠物') : friend.name;
  const speciesText = getSpeciesMeta((speaker === 'pet' ? pet.speciesGroup : friend.speciesGroup) || 'generic').label;

  const promptBits = [];
  if (contextData.selectedToys?.length) promptBits.push(`玩具箱：${contextData.selectedToys.map(x => x.label).join('、')}`);
  if (contextData.customToys?.length) promptBits.push(`自定义玩具：${contextData.customToys.join('、')}`);
  if (contextData.selectedGift) promptBits.push(`伴手礼：${contextData.selectedGift.label}`);
  if (contextData.selectedPack?.length) promptBits.push(`出门包：${contextData.selectedPack.map(x => x.label).join('、')}`);

  const rolePrompt = `
你现在扮演一只电子宠物，名字叫 ${speakerName}。
宠物分类：${speciesText}
说话要求：
1. 只说一句话
2. 不超过40字
3. 可爱自然
4. 要像宠物之间聊天，不要像客服
5. 可以带一点颜文字
`;

  const systemPrompt = await buildSystemPrompt({
    rolePrompt,
    statusContext: promptBits.join('\n'),
  });

  const userPrompt = `
场景模式：${mode}
互动对象：${speaker === 'pet' ? friend.name : (pet.name || '小宠物')}
${userText ? `用户刚刚说：${userText}` : '现在请继续自然接话。'}
`;

  return await safeAIText({
    systemPrompt,
    userText: userPrompt,
    fallback: fallbackLine(speaker),
  });
}

async function getVisitEasterEgg(friend, contextData = {}) {
  const shouldTryAI = Math.random() < 0.45;

  if (shouldTryAI) {
    try {
      const pet = runtime.pet || {};
      const prompt = `
请生成一个电子宠物做客中的小彩蛋。
要求：
1. 只输出一句话
2. 不超过50字
3. 温柔可爱
4. 适合作为系统提示
我的宠物：${pet.name || '小宠物'}
好友：${friend.name}
上下文：${JSON.stringify({
  gift: contextData.selectedGift?.label || '',
  pack: (contextData.selectedPack || []).map(x => x.label),
  toys: (contextData.selectedToys || []).map(x => x.label),
  customToys: contextData.customToys || [],
})}
`;
      const text = await safeAIText({
        rolePrompt: '你负责为宠物做客场景生成一句彩蛋提示。',
        userText: prompt,
        fallback: null,
      });

      if (text) {
        return {
          id: 'ai_egg',
          text,
          effects: { intimacy: 2, mood: 1 },
        };
      }
    } catch (_) {}
  }

  return VISIT_FALLBACK_EASTER_EGGS[
    Math.floor(Math.random() * VISIT_FALLBACK_EASTER_EGGS.length)
  ];
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

  const updatedFriend = {
    ...friend,
    intimacy: newIntimacy,
    lastVisitAt: Date.now(),
    memoryContext: buildMemorySnippet(),
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

function buildMemorySnippet() {
  return visitRuntime.messages
    .slice(-6)
    .map(x => x.text)
    .join(' | ')
    .slice(0, 200);
}

function bumpIntimacy(step = 1) {
  visitRuntime.intimacyGain += step;
  const el = document.getElementById('visit2-intimacy-text');
  if (el) el.textContent = `亲密度 +${visitRuntime.intimacyGain}`;
}

function appendChatLine(role, text) {
  const box = document.getElementById('visit2-chat-box');
  if (!box) return;

  const line = document.createElement('div');
  line.className = `visit2-line ${role}`;
  line.textContent = text;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;

  visitRuntime.messages.push({ role, text });
}

function setVisitStatus(text, type = 'info') {
  const el = document.getElementById('visit2-status');
  if (!el) return;
  el.textContent = text;
  el.dataset.type = type;
}

function getSelectedItems(type) {
  return Array.from(document.querySelectorAll(`.visit2-card[data-type="${type}"].selected`))
    .map(el => ({
      id: el.dataset.id,
      label: el.dataset.label,
      promptTag: el.dataset.promptTag || '',
    }));
}

function getSingleSelectedItem(type) {
  return getSelectedItems(type)[0] || null;
}

function getCustomToys() {
  const vals = [
    document.getElementById('visit2-custom-toy-1')?.value.trim(),
    document.getElementById('visit2-custom-toy-2')?.value.trim(),
  ].filter(Boolean);

  if (vals.length > 2) throw new Error('自定义玩具最多 2 个');
  return vals;
}

function itemCard(item, type, single = false) {
  return `
    <button
      type="button"
      class="visit2-card"
      data-id="${escapeHtml(item.id)}"
      data-type="${escapeHtml(type)}"
      data-label="${escapeHtml(item.label)}"
      data-prompt-tag="${escapeHtml(item.promptTag || '')}"
      data-single="${single ? '1' : '0'}"
      onclick="window.__visit2ToggleCard(this)"
    >
      <div class="visit2-card-icon">${item.icon}</div>
      <div class="visit2-card-title">${escapeHtml(item.label)}</div>
      <div class="visit2-card-desc">${escapeHtml(item.desc)}</div>
    </button>
  `;
}

window.__visit2ToggleCard = function (el) {
  const single = el.dataset.single === '1';
  const type = el.dataset.type;

  if (single) {
    document.querySelectorAll(`.visit2-card[data-type="${type}"]`).forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    return;
  }

  el.classList.toggle('selected');
};

function fallbackLine(role) {
  if (role === 'pet') return '嘿嘿，感觉今天会很好玩呀 (≧▽≦)';
  if (role === 'friend') return '我也觉得这里好有趣，想再多玩一会儿～';
  return '今天好像发生了一个小小惊喜。';
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
      position:fixed; inset:0; z-index:9999;
      background:rgba(20,20,24,.42);
      display:flex; align-items:center; justify-content:center;
      padding:18px;
    }
    .visit2-panel{
      width       width:min(920px, 100%);
      max-height:90vh;
      overflow:auto;
      border-radius:24px;
      background:var(--bg-card, #fff);
      box-shadow:0 24px 80px rgba(0,0,0,.18);
      border:1px solid rgba(255,255,255,.55);
    }
    .visit2-header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:16px;
      padding:18px 20px;
      border-bottom:1px solid rgba(0,0,0,.06);
      position:sticky;
      top:0;
      background:var(--bg-card, #fff);
      z-index:2;
      border-radius:24px 24px 0 0;
    }
    .visit2-title{
      font-size:20px;
      font-weight:800;
      color:var(--text-primary, #222);
    }
    .visit2-sub{
      margin-top:4px;
      font-size:13px;
      color:var(--text-secondary, #666);
    }
    .visit2-close{
      border:none;
      background:var(--bg-card-alt, #f5f5f7);
      color:var(--text-primary, #222);
      width:38px;
      height:38px;
      border-radius:999px;
      cursor:pointer;
      font-size:16px;
      font-weight:700;
    }
    .visit2-body{
      padding:18px;
      display:flex;
      flex-direction:column;
      gap:16px;
    }
    .visit2-mode-row{
      display:grid;
      grid-template-columns:repeat(3, 1fr);
      gap:10px;
    }
    .visit2-mode{
      border:none;
      border-radius:16px;
      padding:12px 14px;
      background:var(--bg-card-alt, #f6f6fa);
      color:var(--text-primary, #222);
      cursor:pointer;
      font-weight:700;
      transition:.2s ease;
    }
    .visit2-mode.active{
      background:linear-gradient(135deg, #ffb7d5 0%, #ffd9ea 100%);
      box-shadow:0 8px 18px rgba(255, 170, 205, .35);
    }
    .visit2-status{
      padding:12px 14px;
      border-radius:14px;
      background:rgba(255, 183, 213, .16);
      color:var(--text-secondary, #555);
      font-size:13px;
      line-height:1.5;
    }
          .visit2-status[data-type="error"]{
      background:rgba(255, 90, 90, .12);
      color:#b33a3a;
    }
    .visit2-status[data-type="warn"]{
      background:rgba(255, 193, 7, .14);
      color:#946c00;
    }
    .visit2-status[data-type="info"]{
      background:rgba(255, 183, 213, .16);
      color:#666;
    }
    .visit2-section{
      background:var(--bg-card-alt, #fafafe);
      border-radius:18px;
      padding:14px;
      border:1px solid rgba(0,0,0,.04);
    }
    .visit2-section-title{
      font-size:15px;
      font-weight:800;
      color:var(--text-primary, #222);
      margin-bottom:10px;
    }
    .visit2-grid{
      display:grid;
      grid-template-columns:repeat(auto-fill, minmax(150px, 1fr));
      gap:12px;
    }
    .visit2-card{
      border:none;
      text-align:left;
      border-radius:18px;
      padding:14px;
      background:#fff;
      cursor:pointer;
      box-shadow:0 8px 20px rgba(0,0,0,.05);
      border:2px solid transparent;
      transition:.18s ease;
    }
    .visit2-card:hover{
      transform:translateY(-1px);
    }
    .visit2-card.selected{
      border-color:#ff8ec2;
      background:#fff6fb;
      box-shadow:0 10px 24px rgba(255, 142, 194, .18);
    }
    .visit2-card-icon{
      font-size:24px;
      margin-bottom:8px;
    }
    .visit2-card-title{
      font-size:14px;
      font-weight:800;
      color:#222;
      margin-bottom:5px;
    }
    .visit2-card-desc{
      font-size:12px;
      line-height:1.45;
      color:#666;
    }
    .visit2-custom-wrap{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:10px;
    }
    .visit2-input{
      width:100%;
      border:none;
      outline:none;
      border-radius:14px;
      padding:12px 14px;
      background:#fff;
      box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);
      font-size:14px;
      color:#222;
    }
    .visit2-input.small{
      max-width:100px;
    }
    .visit2-actions{
      display:flex;
      justify-content:flex-end;
      gap:10px;
    }
    .visit2-primary,
    .visit2-secondary,
    .visit2-ghost{
      border:none;
      border-radius:14px;
      padding:12px 16px;
      cursor:pointer;
      font-weight:800;
      transition:.18s ease;
    }
    .visit2-primary{
      background:linear-gradient(135deg, #ff94c7 0%, #ffbedc 100%);
      color:#5d2340;
      box-shadow:0 10px 20px rgba(255, 148, 199, .28);
    }
    .visit2-secondary{
      background:#f3f3f7;
      color:#333;
    }
    .visit2-ghost{
      background:transparent;
      color:#666;
      box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);
    }
    .visit2-chat-header{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      margin-bottom:10px;
    }
    .visit2-mini{
      font-size:12px;
      color:#6a6a78;
      line-height:1.5;
    }
    .visit2-chat-box{
      min-height:260px;
      max-height:46vh;
      overflow:auto;
      background:#fff;
      border-radius:20px;
      padding:14px;
      box-shadow:inset 0 0 0 1px rgba(0,0,0,.06);
      display:flex;
      flex-direction:column;
      gap:10px;
    }
    .visit2-line{
      max-width:82%;
      padding:10px 12px;
      border-radius:16px;
      line-height:1.5;
      font-size:14px;
      word-break:break-word;
      white-space:pre-wrap;
    }
    .visit2-line.system{
      align-self:center;
      background:#f7f7fb;
      color:#666;
      font-size:12px;
      max-width:92%;
    }
    .visit2-line.user{
      align-self:flex-end;
      background:#ffe4f0;
      color:#5c2841;
    }
    .visit2-line.pet{
      align-self:flex-start;
      background:#fff2f8;
      color:#5d2741;
    }
    .visit2-line.friend{
      align-self:flex-start;
      background:#f1f5ff;
      color:#2e4063;
    }
    .visit2-auto-row{
      display:flex;
      gap:10px;
      align-items:center;
      margin-top:10px;
    }
    .visit2-focus-timer{
      margin-top:8px;
      font-size:44px;
      font-weight:900;
      text-align:center;
      color:#ff7fb7;
      letter-spacing:1px;
    }
    .visit2-summary{
      margin-top:14px;
      padding:14px;
      border-radius:18px;
      background:#fff8fc;
      border:1px solid rgba(255, 148, 199, .18);
    }
    .is-loading{
      opacity:.86;
      pointer-events:none;
    }
    @media (max-width: 720px){
      .visit2-mode-row{
        grid-template-columns:1fr;
      }
      .visit2-grid{
        grid-template-columns:1fr 1fr;
      }
      .visit2-custom-wrap{
        grid-template-columns:1fr;
      }
      .visit2-auto-row{
        flex-direction:column;
        align-items:stretch;
      }
      .visit2-line{
        max-width:92%;
      }
    }
  `;
  document.head.appendChild(style);
}
