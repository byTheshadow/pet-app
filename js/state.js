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
  relation:     'parent-of-pet',   // 'parent-of-pet' | 'co-owner'
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
// ── 成长阶段定义 ─────────────────────────────────────────────
// neverGrow: true 时宠物永远停在 baby 阶段
export const GROWTH_STAGES = [
  {
    id:       'baby',
    label:    '幼儿园',
    icon:     '🐣',
    minLevel: 1,
    maxLevel: 5,
    desc:     '刚刚来到这个世界，对一切都充满好奇',
    expPerLevel: 100,   // 每级需要的经验值
  },
  {
    id:       'primary',
    label:    '小学',
    icon:     '📚',
    minLevel: 6,
    maxLevel: 15,
    desc:     '开始学习新事物，活力满满',
    expPerLevel: 200,
  },
  {
    id:       'middle',
    label:    '初中',
    icon:     '🎒',
    minLevel: 16,
    maxLevel: 25,
    desc:     '有点叛逆，但内心还是很依赖你',
    expPerLevel: 350,
  },
  {
    id:       'high',
    label:    '高中',
    icon:     '🎓',
    minLevel: 26,
    maxLevel: 40,
    desc:     '即将展翅，每一天都很珍贵',
    expPerLevel: 500,
  },
  {
    id:       'adult',
    label:    '成年',
    icon:     '✨',
    minLevel: 41,
    maxLevel: 99,
    desc:     '已经长大，但永远是你的宠物',
    expPerLevel: 800,
  },
];

// 根据 level 获取当前阶段
export function getGrowthStage(level) {
  for (const stage of GROWTH_STAGES) {
    if (level >= stage.minLevel && level <= stage.maxLevel) return stage;
  }
  return GROWTH_STAGES[GROWTH_STAGES.length - 1];
}

// 当前 level 升到下一级需要多少经验
export function getExpForLevel(level) {
  const stage = getGrowthStage(level);
  return stage.expPerLevel;
}

// ── 预设冒险场景 ─────────────────────────────────────────────
export const PRESET_SCENES = [
  {
    id:       'park',
    label:    '公园散步',
    icon:     '🌳',
    desc:     '阳光明媚的下午，去公园里溜达溜达',
    stageReq: null,   // null = 所有阶段可用
    effects:  { mood: +15, hunger: -8, health: +5, clean: -5 },
    expReward: 20,
  },
  {
    id:       'library',
    label:    '图书馆',
    icon:     '📖',
    desc:     '安静地翻翻书，说不定能学到新东西',
    stageReq: ['primary', 'middle', 'high', 'adult'],
    effects:  { mood: +8, hunger: -5, health: +3, clean: 0 },
    expReward: 35,
  },
  {
    id:       'playground',
    label:    '游乐场',
    icon:     '🎡',
    desc:     '滑梯、秋千、旋转木马，玩个够！',
    stageReq: ['baby', 'primary'],
    effects:  { mood: +25, hunger: -15, health: +5, clean: -10 },
    expReward: 30,
  },
  {
    id:       'cafe',
    label:    '下午茶',
    icon:     '☕',
    desc:     '找个安静的咖啡馆，享受悠闲时光',
    stageReq: ['middle', 'high', 'adult'],
    effects:  { mood: +20, hunger: +15, health: 0, clean: 0 },
    expReward: 25,
  },
  {
    id:       'hospital',
    label:    '体检',
    icon:     '🏥',
    desc:     '定期检查身体，保持健康最重要',
    stageReq: null,
    effects:  { mood: -5, hunger: -5, health: +30, clean: +5 },
    expReward: 40,
  },
  {
    id:       'beach',
    label:    '海边玩耍',
    icon:     '🏖️',
    desc:     '踩踩浪花，捡捡贝壳，心情超好',
    stageReq: null,
    effects:  { mood: +30, hunger: -10, health: +8, clean: -15 },
    expReward: 35,
  },
  {
    id:       'exam',
    label:    '考试',
    icon:     '📝',
    desc:     '紧张又刺激，结果如何全看平时积累',
    stageReq: ['primary', 'middle', 'high'],
    effects:  { mood: -10, hunger: -10, health: -5, clean: 0 },
    expReward: 60,   // 高经验奖励
  },
  {
    id:       'sleepover',
    label:    '朋友家过夜',
    icon:     '🌙',
    desc:     '在好朋友家玩到很晚，超级开心',
    stageReq: ['primary', 'middle', 'high'],
    effects:  { mood: +20, hunger: -10, health: -5, clean: -10 },
    expReward: 30,
  },
];

// ── 彩蛋事件定义 ─────────────────────────────────────────────
// 每次冒险有一定概率触发彩蛋，触发后写入 sceneHistory 并显示特殊 UI
export const EASTER_EGGS = [
  {
    id:       'teacher_visit',
    label:    '老师家访',
    icon:     '👩‍🏫',
    prob:     0.08,   // 8% 触发概率
    stageReq: ['primary', 'middle', 'high'],
    title:    '老师来家访了！',
    letter:   true,   // 触发后生成一封信
    effects:  { mood: -5, bond: +10 },
    expReward: 50,
  },
  {
    id:       'lost_toy',
    label:    '找到失落的玩具',
    icon:     '🧸',
    prob:     0.12,
    stageReq: null,
    title:    '在角落里发现了一个旧玩具！',
    letter:   false,
    effects:  { mood: +20, bond: +5 },
    expReward: 25,
  },
  {
    id:       'stray_cat',
    label:    '遇到流浪猫',
    icon:     '🐱',
    prob:     0.10,
    stageReq: null,
    title:    '路上遇到了一只流浪猫',
    letter:   false,
    effects:  { mood: +15, hunger: -5 },
    expReward: 20,
  },
  {
    id:       'rain',
    label:    '突然下雨',
    icon:     '🌧️',
    prob:     0.10,
    stageReq: null,
    title:    '出门遇到了大雨！',
    letter:   false,
    effects:  { mood: -10, clean: -20, health: -5 },
    expReward: 15,
  },
  {
    id:       'gift',
    label:    '神秘礼物',
    icon:     '🎁',
    prob:     0.06,
    stageReq: null,
    title:    '收到了一份神秘礼物！',
    letter:   true,
    effects:  { mood: +25, bond: +8 },
    expReward: 40,
  },
];
