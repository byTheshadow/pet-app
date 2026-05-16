// js/state.js
// 全局状态管理 —— 纯 JS 对象 + 自定义事件总线

// ── 默认宠物状态 ─────────────────────────────────────────────
export const DEFAULT_PET = {
  id:          'singleton',
  name:        '小幽',
  avatarUrl:   '',
  personality: 'genki',       // 预设性格 key
  customPrompt:'',
  hunger:      80,
  mood:        80,
  health:      80,
  clean:       80,
  bond:        50,
  level:       1,
  exp:         0,
  lastOnlineAt: Date.now(),
  createdAt:   Date.now(),
};

// ── 默认设置 ─────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  id:              'singleton',
  apiBase:         'https://api.openai.com',
  apiKey:          '',
  selectedModel:   'gpt-4o',
  globalPrompt:    '你是一只可爱的电子宠物，用简短活泼的语气说话，喜欢用颜文字。',
  notifyEnabled:   false,
  aiParentMode:    'timer',
  aiParentInterval: 4,
  decayRates: {
    hunger: 2,    // 每小时衰减值
    mood:   1.5,
    health: 0.5,
    clean:  1,
  },
  notifyThresholds: {
    hunger: 20,
    mood:   20,
    health: 20,
    clean:  20,
  },
};

// ── 默认 AI 家长 ─────────────────────────────────────────────
export const DEFAULT_AI_PARENT = {
  id:           'singleton',
  name:         '妈妈',
  avatarUrl:    '',
  personality:  '温柔体贴，偶尔严格',
  customPrompt: '',
  lastVisitAt:  null,
};

// ── 性格预设 ─────────────────────────────────────────────────
export const PERSONALITY_PRESETS = {
  tsundere: { label: '傲娇',   prompt: '表面冷淡实则关心，说话时经常用"才、才不是"等傲娇语气，偶尔脸红。' },
  genki:    { label: '元气',   prompt: '活泼开朗，充满正能量，说话语速快，喜欢用感叹号和开心的颜文字。' },
  lazy:     { label: '慵懒',   prompt: '慵懒随性，说话简短，经常表示困倦，但对喜欢的事会突然来劲。' },
  kuudere:  { label: '腹黑',   prompt: '表面温和，内心腹黑，偶尔说出意想不到的毒舌话，但不是恶意的。' },
  airhead:  { label: '天然呆', prompt: '天然呆萌，经常误解意思，反应慢半拍，但非常可爱真诚。' },
  calm:     { label: '冷静',   prompt: '冷静理性，说话简洁有条理，不轻易表露情绪，但内心细腻。' },
};

// ── 运行时状态（不持久化）────────────────────────────────────
export const runtime = {
  pet:      null,   // 当前宠物数据
  settings: null,   // 当前设置
  aiParent: null,   // AI 家长数据
  currentPage: 'pet',
  isAIBusy: false,  // AI 是否正在生成
};

// ── 事件总线 ─────────────────────────────────────────────────
const _listeners = {};

export const bus = {
  on(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
  },
  off(event, fn) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(f => f !== fn);
  },
  emit(event, data) {
    (_listeners[event] || []).forEach(fn => {
      try { fn(data); } catch (e) { console.error('[bus]', e); }
    });
  },
};

// ── 事件名常量 ───────────────────────────────────────────────
export const EVENTS = {
  PET_UPDATED:      'pet:updated',
  SETTINGS_UPDATED: 'settings:updated',
  PARENT_UPDATED:   'parent:updated',
  PAGE_CHANGED:     'page:changed',
  TOAST:            'ui:toast',
  MODAL_CONFIRM:    'ui:modal:confirm',
};
