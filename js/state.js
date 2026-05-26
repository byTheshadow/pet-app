// js/state.js
// 全局状态管理 —— 纯 JS 对象 + 自定义事件总线

// ── 默认宠物状态 ─────────────────────────────────────────────
export const DEFAULT_PET = {
  id:          'singleton',
  name:        '小幽',
  avatarUrl:   '',
  personality: 'genki',       // 预设性格 key
  customPrompt:'',
  speciesGroup: 'mammal',
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
  maxTokens:       100000, 
  globalPrompt:    '你是一只可爱的电子宠物，用简短活泼的语气说话，喜欢用颜文字。',
  notifyEnabled:   false,
  aiParentMode:    'timer',
  aiParentInterval: 4,
  letterEnabled:  false,   // ← 新增
  letterInterval: 8,       // ← 新增，单位小时
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
  PET_SICK: 'pet:sick',
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
    id: 'park', label: '公园散步', icon: '🌳',
    desc: '阳光明媚的下午，去公园里溜达溜达',
    stageReq: null,
    effects: { mood: +15, hunger: -8, health: +5, clean: -5 },
    expReward: 20, duration: 20,
  },
  {
    id: 'library', label: '图书馆', icon: '📖',
    desc: '安静地翻翻书，说不定能学到新东西',
    stageReq: ['primary', 'middle', 'high', 'adult'],
    effects: { mood: +8, hunger: -5, health: +3, clean: 0 },
    expReward: 35, duration: 25,
  },
  {
    id: 'playground', label: '游乐场', icon: '🎡',
    desc: '滑梯、秋千、旋转木马，玩个够！',
    stageReq: ['baby', 'primary'],
    effects: { mood: +25, hunger: -15, health: +5, clean: -10 },
    expReward: 30, duration: 30,
  },
  {
    id: 'cafe', label: '下午茶', icon: '☕',
    desc: '找个安静的咖啡馆，享受悠闲时光',
    stageReq: ['middle', 'high', 'adult'],
    effects: { mood: +20, hunger: +15, health: 0, clean: 0 },
    expReward: 25, duration: 20,
  },
  {
    id: 'hospital', label: '体检', icon: '🏥',
    desc: '定期检查身体，保持健康最重要',
    stageReq: null,
    effects: { mood: -5, hunger: -5, health: +30, clean: +5 },
    expReward: 40, duration: 15,
  },
  {
    id: 'beach', label: '海边玩耍', icon: '🏖️',
    desc: '踩踩浪花，捡捡贝壳，心情超好',
    stageReq: null,
    effects: { mood: +30, hunger: -10, health: +8, clean: -15 },
    expReward: 35, duration: 30,
  },
  {
    id: 'exam', label: '考试', icon: '📝',
    desc: '紧张又刺激，结果如何全看平时积累',
    stageReq: ['primary', 'middle', 'high'],
    effects: { mood: -10, hunger: -10, health: -5, clean: 0 },
    expReward: 60, duration: 45,
  },
  {
    id: 'sleepover', label: '朋友家过夜', icon: '🌙',
    desc: '在好朋友家玩到很晚，超级开心',
    stageReq: ['primary', 'middle', 'high'],
    effects: { mood: +20, hunger: -10, health: -5, clean: -10 },
    expReward: 30, duration: 45,
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
// ── 宠物分类 / 串门系统配置 ─────────────────────────────────

export const SPECIES_GROUPS = {
  mammal:    { label: '哺乳动物', icon: '🐶' },
  amphibian: { label: '两栖动物', icon: '🐸' },
  reptile:   { label: '爬行动物', icon: '🦎' },
  bird:      { label: '鸟类', icon: '🐦' },
  fish:      { label: '鱼类', icon: '🐟' },
  generic:   { label: '通用', icon: '🐾' },
};

export const VISIT_MODES = {
  INCOMING_CHAT: 'incoming-chat',
  OUTGOING_CHAT: 'outgoing-chat',
  OUTGOING_FOCUS: 'outgoing-focus',
};

export const VISIT_STATUS = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  ACTIVE: 'active',
  AUTO_CHAT: 'auto-chat',
  FOCUS: 'focus',
  ENDING: 'ending',
  ERROR: 'error',
  COMPLETED: 'completed',
};

export const VISIT_TOY_ITEMS = [
  {
    id: 'ball',
    label: '球球',
    icon: '⚽',
    desc: '热闹追逐，适合活泼型互动',
    species: ['mammal', 'bird', 'generic'],
    effects: { mood: 4, intimacy: 2 },
    promptTag: '一起追逐球球，气氛很热闹',
  },
  {
    id: 'pond_set',
    label: '迷你水池',
    icon: '💧',
    desc: '适合喜欢水边或湿润环境的宠物',
    species: ['amphibian', 'fish', 'generic'],
    effects: { mood: 4, intimacy: 2 },
    promptTag: '一起围着迷你水池玩耍，气氛清凉轻松',
  },
  {
    id: 'warm_stone',
    label: '暖石台',
    icon: '🪨',
    desc: '适合晒晒暖暖石头的宠物',
    species: ['reptile', 'generic'],
    effects: { mood: 3, intimacy: 2 },
    promptTag: '一起趴在暖石台旁边放松，气氛安稳',
  },
  {
    id: 'feather_wand',
    label: '羽毛逗逗棒',
    icon: '🪶',
    desc: '轻快灵活，很适合跳跃扑抓',
    species: ['bird', 'mammal', 'generic'],
    effects: { mood: 5, intimacy: 1 },
    promptTag: '被羽毛逗逗棒逗得很开心，笑闹不停',
  },
  {
    id: 'storybook',
    label: '绘本',
    icon: '📖',
    desc: '安静陪伴型互动',
    species: ['generic'],
    effects: { mood: 2, intimacy: 3 },
    promptTag: '一起翻看绘本，小声交流',
  },
  {
    id: 'plush',
    label: '毛绒玩偶',
    icon: '🧸',
    desc: '治愈温柔型互动',
    species: ['mammal', 'bird', 'generic'],
    effects: { mood: 3, intimacy: 3 },
    promptTag: '抱着毛绒玩偶聊天，氛围柔和',
  },
];

export const VISIT_GIFT_ITEMS = [
  {
    id: 'snack_box',
    label: '零食礼盒',
    icon: '🎁',
    desc: '大多数宠物都会喜欢的小礼物',
    species: ['generic'],
    effects: { intimacy: 4, mood: 2 },
    promptTag: '带来了一份零食礼盒，对方很开心',
  },
  {
    id: 'fruit_jelly',
    label: '果冻小杯',
    icon: '🍮',
    desc: '清凉小点心，适合湿润型宠物',
    species: ['amphibian', 'fish', 'generic'],
    effects: { intimacy: 3, mood: 3 },
    promptTag: '带来果冻小杯作为伴手礼，让对方眼前一亮',
  },
  {
    id: 'sun_card',
    label: '晒太阳卡片',
    icon: '☀️',
    desc: '适合喜欢温暖环境的宠物',
    species: ['reptile', 'generic'],
    effects: { intimacy: 4, mood: 1 },
    promptTag: '带来了一张暖洋洋主题的小卡片，对方觉得很贴心',
  },
  {
    id: 'seed_mix',
    label: '种子拼配包',
    icon: '🌾',
    desc: '轻巧可爱，适合鸟类朋友',
    species: ['bird', 'generic'],
    effects: { intimacy: 4, mood: 2 },
    promptTag: '带来了一个种子拼配包，对方非常喜欢',
  },
];

export const VISIT_OUTING_PACK_ITEMS = [
  {
    id: 'water_bottle',
    label: '小水壶',
    icon: '🥤',
    desc: '出门补水更安心',
    species: ['generic'],
    effects: { mood: 1, health: 1 },
    promptTag: '带着自己的小水壶，出门更安心',
  },
  {
    id: 'comfort_toy',
    label: '安抚玩偶',
    icon: '🧸',
    desc: '陌生环境也不紧张',
    species: ['mammal', 'bird', 'generic'],
    effects: { mood: 2 },
    promptTag: '抱着熟悉的安抚玩偶，心里更踏实',
  },
  {
    id: 'mist_spray',
    label: '保湿喷雾',
    icon: '🌫️',
    desc: '适合潮湿感偏好的宠物',
    species: ['amphibian', 'generic'],
    effects: { mood: 2, health: 1 },
    promptTag: '带着保湿喷雾，状态舒服很多',
  },
  {
    id: 'heat_pad',
    label: '暖暖垫',
    icon: '🔥',
    desc: '适合偏好温暖的小伙伴',
    species: ['reptile', 'generic'],
    effects: { mood: 2, health: 1 },
    promptTag: '带着暖暖垫，出门也能保持舒适',
  },
];

export const VISIT_FALLBACK_EASTER_EGGS = [
  {
    id: 'toy_love',
    text: '它们居然同时喜欢上了同一个玩具，围着它开心地转来转去。',
    effects: { intimacy: 2, mood: 2 },
  },
  {
    id: 'secret_whisper',
    text: '它们凑在一起嘀嘀咕咕，像是交换了一个只有宠物才懂的小秘密。',
    effects: { intimacy: 3, mood: 1 },
  },
  {
    id: 'nap_together',
    text: '玩累之后，它们并排靠着休息了一会儿，气氛安静又温柔。',
    effects: { intimacy: 2, mood: 2 },
  },
  {
    id: 'gift_hit',
    text: '伴手礼意外特别对胃口，对方一下子就对这次做客更期待了。',
    effects: { intimacy: 3, mood: 2 },
  },
];

export function getSpeciesMeta(speciesGroup = 'generic') {
  return SPECIES_GROUPS[speciesGroup] || SPECIES_GROUPS.generic;
}

export function getCompatibleVisitItems(items, speciesGroup = 'generic') {
  return items.filter(item => {
    const list = item.species || ['generic'];
    return list.includes('generic') || list.includes(speciesGroup);
  });
}
