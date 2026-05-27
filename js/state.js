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

  // 宠物房间 MVP：不升级 IndexedDB，只作为 pet 对象的子字段保存
  room: {
    location: 'petPage', // 'petPage' | 'room'
    preset: 'mammal_cozy',
    style: 'cozy_nest',
    bed: 'soft_cushion',
    toy: 'bell_ball',
    decor: 'moon_lamp',
    environment: 'warm',
    facility: 'blanket',
    updatedAt: Date.now(),
  },

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
  {
    id: 'toy_yarn_ball',
    label: '毛茸线球',
    icon: '🧶',
    desc: '软软弹弹的线团，适合扑来扑去',
    species: ['mammal', 'generic'],
    tags: ['playful', 'soft', 'chase'],
    effects: {
      mood: 3,
      intimacy: 2
    },
    promptTag: '一只小爪子轻轻拨动线球，毛线滚来滚去，两只宠物追着跑，尾巴都翘得高高的'
  },
  {
    id: 'toy_feather_wand',
    label: '飘飘逗猫棒',
    icon: '🪶',
    desc: '顶端羽毛轻颤，引得小家伙蹦蹦跳跳',
    species: ['mammal', 'bird', 'generic'],
    tags: ['playful', 'jump', 'flutter'],
    effects: {
      mood: 3,
      intimacy: 3,
      health: 1
    },
    promptTag: '羽毛在空中划出小小的弧线，宠物跳起来想抓住它，每一次扑空都变成软乎乎的翻滚'
  },
  {
    id: 'toy_crinkly_duck',
    label: '嘎嘎小黄鸭',
    icon: '🦆',
    desc: '一捏就发出沙沙声的柔软小鸭',
    species: ['mammal', 'generic'],
    tags: ['sound', 'soft', 'chew'],
    effects: {
      mood: 2,
      intimacy: 2
    },
    promptTag: '小黄鸭被轻轻一咬就发出好笑的嘎嘎声，两只宠物轮流叼着它跑来跑去，客厅里满是欢快的杂音'
  },
  {
    id: 'toy_bubble_maker',
    label: '梦幻泡泡机',
    icon: '🫧',
    desc: '飘出轻盈泡泡，轻轻一碰就化成小水雾',
    species: ['mammal', 'bird', 'generic'],
    tags: ['magical', 'chase', 'gentle'],
    effects: {
      mood: 4,
      intimacy: 2,
      clean: 1
    },
    promptTag: '一串串透明的泡泡慢悠悠飘过，宠物踮起脚去碰，破掉的瞬间它们愣了一下，然后更兴奋地追下一个'
  },
  {
    id: 'toy_shell_rattle',
    label: '贝壳小沙锤',
    icon: '🐚',
    desc: '轻轻晃动就有细沙流淌的温柔声响',
    species: ['bird', 'reptile', 'generic'],
    tags: ['sound', 'calm', 'texture'],
    effects: {
      mood: 2,
      intimacy: 3
    },
    promptTag: '沙锤晃起来沙沙的，像遥远的海浪声，小鸟歪着头听，小爬宠也慢慢爬过来，氛围安静又亲密'
  },
  {
    id: 'toy_mini_tunnel',
    label: '软软钻钻筒',
    icon: '🛝',
    desc: '可以钻来钻去的短隧道，里面有窸窣响纸',
    species: ['mammal', 'reptile', 'generic'],
    tags: ['hide', 'explore', 'cozy'],
    effects: {
      mood: 3,
      intimacy: 2,
      health: 1
    },
    promptTag: '一只宠物钻进隧道里探出脑袋，另一只在外面用爪子轻拍筒壁，你藏我找的游戏让两个小家伙都呼噜呼噜的'
  },
  {
    id: 'toy_floating_lily',
    label: '漂浮小荷叶',
    icon: '🍃',
    desc: '浮在水面轻轻漂荡，可以趴在上面休息',
    species: ['amphibian', 'fish', 'generic'],
    tags: ['water', 'rest', 'float'],
    effects: {
      mood: 3,
      intimacy: 1,
      health: 1
    },
    promptTag: '小青蛙趴在荷叶上随水波轻轻晃，小鱼在下面游来游去，偶尔顶一下叶子，水面上荡开一圈圈温柔的涟漪'
  },
  {
    id: 'toy_basking_platform',
    label: '暖阳小晒台',
    icon: '🪨',
    desc: '表面微微粗糙的平石，适合趴着享受光线',
    species: ['reptile', 'amphibian', 'generic'],
    tags: ['warm', 'rest', 'texture'],
    effects: {
      mood: 2,
      health: 2,
      bond: 1
    },
    promptTag: '小爬宠趴在晒台上把四肢舒展开，暖融融的光照在背上，另一只也挤过来挨着，一起安静地眯起眼睛'
  },
  {
    id: 'toy_jingly_ball',
    label: '叮咚铃铛球',
    icon: '🔔',
    desc: '滚动时会发出清脆叮咚声的小球',
    species: ['mammal', 'bird', 'generic'],
    tags: ['sound', 'chase', 'roll'],
    effects: {
      mood: 3,
      intimacy: 2
    },
    promptTag: '铃铛球滚过地板，叮叮当当响了一路，宠物追着球滑来滑去，偶尔用鼻子把球推给对方，像在邀请一起玩'
  },
  {
    id: 'toy_sand_pit',
    label: '细细沙盘',
    icon: '🏜️',
    desc: '铺满细腻软沙的浅盘，可以刨刨挖挖',
    species: ['reptile', 'mammal', 'generic'],
    tags: ['dig', 'texture', 'calm'],
    effects: {
      mood: 2,
      intimacy: 2,
      clean: -1
    },
    promptTag: '小爪子一下一下地刨着细沙，沙面被画出歪歪扭扭的沟壑，另一只也凑过来用鼻尖拱了拱，两只都沾了一身沙却格外开心'
  },
  {
    id: 'toy_mirror_perch',
    label: '小圆镜栖架',
    icon: '🪞',
    desc: '带一面安全小镜子的站杆，可以歪头照好久',
    species: ['bird', 'generic'],
    tags: ['curious', 'self', 'perch'],
    effects: {
      mood: 3,
      intimacy: 1
    },
    promptTag: '小鸟站在镜子前轻轻啄了一下自己的倒影，然后歪着脑袋左右看，时不时啾啾两声，像在跟新朋友打招呼'
  },
  {
    id: 'toy_water_sprinkler',
    label: '涟漪洒水器',
    icon: '💧',
    desc: '缓缓喷出细密水雾，在掌心接住小水滴',
    species: ['amphibian', 'fish', 'bird', 'generic'],
    tags: ['water', 'gentle', 'play'],
    effects: {
      mood: 3,
      health: 1,
      clean: 1
    },
    promptTag: '细细的水雾洒下来，小青蛙仰起脸接水珠，小鱼在水面下吐泡泡迎接落下的涟漪，空气里湿湿润润的很舒服'
  },
  {
    id: 'toy_snuffle_mat',
    label: '嗅闻藏宝垫',
    icon: '🧩',
    desc: '布条间可以藏小零食，用鼻子拱着找',
    species: ['mammal', 'generic'],
    tags: ['sniff', 'treat', 'focus'],
    effects: {
      mood: 2,
      intimacy: 2,
      hunger: 1
    },
    promptTag: '鼻尖在软布条间拱来拱去，突然找到一颗小零食的惊喜让尾巴摇成了小螺旋，另一只也凑过来帮忙，一起呼哧呼哧地探索'
  },
  {
    id: 'toy_hanging_hoop',
    label: '藤编小吊环',
    icon: '⭕',
    desc: '悬挂的藤环，可以轻轻啄咬或攀抓',
    species: ['bird', 'reptile', 'generic'],
    tags: ['climb', 'swing', 'chew'],
    effects: {
      mood: 2,
      health: 2
    },
    promptTag: '小鸟用喙叼着吊环轻轻荡了一下，爬宠也顺着爬上去绕了一圈，藤环来回摆动，两个小家伙的眼神都亮晶晶的'
  },
  {
    id: 'toy_soft_frisbee',
    label: '软软飞盘',
    icon: '🥏',
    desc: '布面软飞盘，飘得慢悠悠容易接住',
    species: ['mammal', 'bird', 'generic'],
    tags: ['catch', 'outdoor', 'soft'],
    effects: {
      mood: 4,
      intimacy: 3,
      health: 2
    },
    promptTag: '飞盘慢悠悠地飘过，宠物跳起来轻轻衔住又欢快地跑回来，尾巴画着圈，把飞盘放在你脚边时满脸期待'
  },
  {
    id: 'toy_plush_mouse',
    label: '软绒小布鼠',
    icon: '🐭',
    desc: '蓬松柔软的布艺小老鼠，轻轻叼着到处走',
    species: ['mammal', 'generic'],
    tags: ['plush', 'carry', 'gentle'],
    effects: {
      mood: 3,
      intimacy: 2
    },
    promptTag: '小布鼠被轻轻叼在嘴里，从沙发叼到毯子上，又放下用鼻子拱了拱，像在照顾最珍贵的宝贝'
  },
  {
    id: 'toy_ribbon_dancer',
    label: '彩带跳舞棒',
    icon: '🎀',
    desc: '握住一端，几条软彩带会飘出波浪般的弧度',
    species: ['mammal', 'bird', 'generic'],
    tags: ['dance', 'flutter', 'visual'],
    effects: {
      mood: 4,
      intimacy: 3,
      health: 1
    },
    promptTag: '彩带在空中画出缓慢的波浪线，宠物仰头追着光下的影子转圈，尾巴跟着节拍轻轻晃动，像在一起跳舞'
  },
  {
    id: 'toy_peekaboo_box',
    label: '躲猫猫纸箱',
    icon: '📦',
    desc: '挖了几个小洞的厚纸箱，探出头就能吓人一跳',
    species: ['mammal', 'reptile', 'generic'],
    tags: ['hide', 'peek', 'curious'],
    effects: {
      mood: 4,
      intimacy: 2
    },
    promptTag: '一颗毛茸茸的脑袋从纸箱洞口探出来，又嗖地缩回去，另一只马上绕到另一边堵截，两只眼睛在洞口对上的瞬间都愣住了'
  },
  {
    id: 'toy_rainbow_arch',
    label: '彩虹软拱门',
    icon: '🌈',
    desc: '柔软的拱形通道，钻过去就像穿过彩虹',
    species: ['mammal', 'reptile', 'generic'],
    tags: ['crawl', 'cozy', 'colorful'],
    effects: {
      mood: 3,
      intimacy: 2,
      health: 1
    },
    promptTag: '宠物从彩虹拱门这头钻到那头，每穿过一次就回头看一眼，尾巴尖从另一头冒出来时，像刚完成了一场小小的冒险'
  },
  {
    id: 'toy_cuddle_sling',
    label: '拥抱小吊床',
    icon: '🛏️',
    desc: '软棉布做的悬挂小窝，轻轻晃着像怀抱',
    species: ['mammal', 'generic'],
    tags: ['cuddle', 'swing', 'warm'],
    effects: {
      mood: 3,
      intimacy: 3,
      bond: 1
    },
    promptTag: '吊床轻轻晃荡，小家伙蜷在里面半眯着眼，另一只也挤进来贴成一团，呼噜声和小小的体温融在一起'
  },
  {
    id: 'toy_sensory_blanket',
    label: '触感摸摸毯',
    icon: '🟫',
    desc: '拼接不同面料的小毯子，可以踩踩抓抓',
    species: ['mammal', 'generic'],
    tags: ['texture', 'knead', 'snuggle'],
    effects: {
      mood: 2,
      intimacy: 3,
      bond: 1
    },
    promptTag: '小爪子在绒布和灯芯绒之间交替踩踏，发出满足的咕噜声，另一只也凑过来用脸颊蹭了蹭最软的那一块'
  },
  {
    id: 'toy_acorn_puzzle',
    label: '松果藏食塔',
    icon: '🌰',
    desc: '可以塞入零食的小松果塔，转转就有惊喜',
    species: ['mammal', 'bird', 'reptile', 'generic'],
    tags: ['puzzle', 'treat', 'clever'],
    effects: {
      mood: 2,
      intimacy: 2,
      hunger: 1
    },
    promptTag: '宠物用鼻子推着松果塔滚来滚去，一颗小零食啪嗒掉了出来，它愣了一秒后更起劲地拨弄，小脑瓜里全是解谜的快乐'
  },
  {
    id: 'toy_mini_maraca',
    label: '豆豆小沙铃',
    icon: '🪇',
    desc: '轻轻摇晃就有沙沙豆子响的木质小乐器',
    species: ['bird', 'reptile', 'generic'],
    tags: ['sound', 'shake', 'music'],
    effects: {
      mood: 3,
      intimacy: 2
    },
    promptTag: '沙铃一晃，沙沙声像小雨打在叶子上，小鸟跟着节奏点了两下头，小蜥蜴也轻轻摇了一下尾巴回应'
  },
  {
    id: 'toy_water_ripple_toy',
    label: '水下涟漪环',
    icon: '⭕',
    desc: '沉入水中的缓沉圈，推着游会荡开温柔波纹',
    species: ['fish', 'amphibian', 'generic'],
    tags: ['water', 'push', 'visual'],
    effects: {
      mood: 2,
      intimacy: 2,
      health: 1
    },
    promptTag: '小鱼用头顶着圈圈从这头游到那头，圈圈缓缓下沉又浮起，推开的波纹轻轻晃动了水草，像在水里画画'
  },
  {
    id: 'toy_mossy_hide',
    label: '苔藓小山洞',
    icon: '🪸',
    desc: '覆盖软苔藓的洞窟形躲避，趴在里头很安心',
    species: ['reptile', 'amphibian', 'generic'],
    tags: ['hide', 'moist', 'safe'],
    effects: {
      mood: 2,
      health: 2,
      bond: 1
    },
    promptTag: '小爬宠钻进绿茸茸的洞口，只露出一小截尾巴尖，里面湿润又安静，过一会儿它自己爬出来时，眼神放松了很多'
  },
  {
    id: 'toy_sunbeam_prism',
    label: '日光小棱镜',
    icon: '🔮',
    desc: '反射出碎碎彩虹光斑，在墙面地板轻轻跳跃',
    species: ['mammal', 'bird', 'generic'],
    tags: ['light', 'chase', 'magical'],
    effects: {
      mood: 4,
      intimacy: 2
    },
    promptTag: '小块的彩虹光斑在地板上慢慢移动，宠物轻手轻脚地追着，爪子扑到光斑时发现它跳到了自己鼻尖上，茫然地眨了眨眼'
  },
  {
    id: 'toy_wooden_bead_roller',
    label: '木珠滚轨道',
    icon: '🧮',
    desc: '轨道上串着几颗大木珠，可以拨着来回转',
    species: ['bird', 'reptile', 'generic'],
    tags: ['slide', 'tactile', 'focus'],
    effects: {
      mood: 2,
      intimacy: 2,
      health: 1
    },
    promptTag: '一颗木珠被轻轻拨动，沿着轨道咕噜噜滑过去碰到了另一颗，小鹦鹉立刻用喙把珠子又推回来，像在打一场慢悠悠的桌面球赛'
  },
  {
    id: 'toy_willow_ball',
    label: '柳枝编织球',
    icon: '🧺',
    desc: '天然柳枝编的空心球，滚起来轻巧又好啃',
    species: ['mammal', 'bird', 'generic'],
    tags: ['chew', 'natural', 'roll'],
    effects: {
      mood: 2,
      intimacy: 2,
      health: 1
    },
    promptTag: '柳枝球被推了一下便骨碌碌滚远，又被另一只叼回来，球上留着浅浅的齿痕和一点点青草香，玩累了就抱着睡着了'
  },
  {
    id: 'toy_warm_stone',
    label: '暖烘小石板',
    icon: '🪨',
    desc: '安全恒温的光滑石板，趴上去就暖乎乎',
    species: ['reptile', 'amphibian', 'generic'],
    tags: ['warm', 'rest', 'safe'],
    effects: {
      mood: 3,
      health: 2,
      bond: 1
    },
    promptTag: '温温的石板把肚皮烘得暖洋洋的，小家伙把四肢都摊开来，另一只也慢慢爬上来并排趴着，两只都舒服得一动不动'
  },
  {
    id: 'toy_seed_pod_puzzle',
    label: '种荚嗅闻球',
    icon: '🥜',
    desc: '可藏种子的镂空球，用喙或爪探索取出',
    species: ['bird', 'mammal', 'generic'],
    tags: ['forage', 'puzzle', 'reward'],
    effects: {
      mood: 2,
      intimacy: 2,
      hunger: 1
    },
    promptTag: '一颗葵花籽卡在镂空球的缝隙里，小鸟歪头研究了半天，终于用巧劲叼了出来，得意地啾啾了两声才开始享用'
  }
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
  {
    id: 'gift_warm_pebble',
    label: '暖呼呼小石',
    icon: '🪨',
    desc: '被阳光晒得温温的，爬宠最爱贴贴',
    species: ['reptile'],
    tags: ['gift', 'warm', 'comfort'],
    effects: {
      intimacy: 3,
      mood: 2
    },
    promptTag: '小石头被轻轻放进晒背区，小家伙立刻趴上去，眯起眼睛安心地打盹了'
  },
  {
    id: 'gift_bubble_chime',
    label: '泡泡叮咚',
    icon: '🫧',
    desc: '轻轻一碰就吐出彩色小泡泡，鱼缸里的游乐园',
    species: ['fish'],
    tags: ['gift', 'play', 'cute'],
    effects: {
      intimacy: 2,
      mood: 4
    },
    promptTag: '鱼群追着咕噜噜的泡泡绕圈圈，水波里闪过一道小小的彩虹，好开心呀'
  },
  {
    id: 'gift_fluffy_towel',
    label: '绒毛抱抱巾',
    icon: '🧣',
    desc: '软得像云朵，裹住就忍不住呼噜呼噜',
    species: ['mammal'],
    tags: ['gift', 'soft', 'comfort'],
    effects: {
      intimacy: 4,
      mood: 2
    },
    promptTag: '抱抱巾刚拿出来，小鼻子就凑过来嗅了又嗅，然后一脑袋扎进去不肯出来了'
  },
  {
    id: 'gift_gnaw_stick',
    label: '咬咬磨牙棒',
    icon: '🦴',
    desc: '苹果枝编成的小骨头形状，越啃越安心',
    species: ['mammal'],
    tags: ['gift', 'play', 'health'],
    effects: {
      intimacy: 2,
      mood: 3
    },
    promptTag: '两只前爪紧紧抱住磨牙棒，咔哧咔哧的细碎声响，像在说好喜欢这个礼物'
  },
  {
    id: 'gift_sparkle_mobile',
    label: '亮片小风铃',
    icon: '🎐',
    desc: '微风一过就洒下细碎光斑，鸟宝目不转睛',
    species: ['bird'],
    tags: ['gift', 'play', 'shine'],
    effects: {
      intimacy: 2,
      mood: 4
    },
    promptTag: '风铃轻轻晃，羽毛小家伙歪着脑袋跟光点捉迷藏，啾啾的歌声都变得更甜了'
  },
  {
    id: 'gift_leaf_dew_vial',
    label: '叶露晚安瓶',
    icon: '🧴',
    desc: '收集晨间叶尖露水，两栖小伴的保湿香氛',
    species: ['amphibian'],
    tags: ['gift', 'gentle', 'health'],
    effects: {
      intimacy: 3,
      mood: 3
    },
    promptTag: '瓶盖拧开的瞬间，湿润的草木香飘散开来，小青蛙满足地合上了亮晶晶的眼睛'
  },
  {
    id: 'gift_cloud_nest_pad',
    label: '软云窝垫',
    icon: '☁️',
    desc: '陷进去就不想动，所有小可爱的打盹神器',
    species: ['mammal', 'reptile', 'generic'],
    tags: ['gift', 'soft', 'comfort'],
    effects: {
      intimacy: 3,
      mood: 3
    },
    promptTag: '肉垫踩上去陷出一个小坑，随即整个身子都摊成一张毛茸茸的小饼，呼噜声随之响起'
  },
  {
    id: 'gift_cricket_song_box',
    label: '蛐蛐歌谣盒',
    icon: '🎵',
    desc: '播放轻柔蛐蛐声，让爬宠感觉回到夏夜田野',
    species: ['reptile', 'amphibian'],
    tags: ['gift', 'calm', 'nature'],
    effects: {
      intimacy: 2,
      mood: 5
    },
    promptTag: '细微的蛐蛐声从盒中传出，小家伙慢慢放松了爪尖，像被夜晚轻轻抱住了'
  },
  {
    id: 'gift_fish_leaf_hammock',
    label: '叶舟小吊床',
    icon: '🍃',
    desc: '漂浮在水面的叶片状小床，斗鱼最爱歇脚',
    species: ['fish'],
    tags: ['gift', 'rest', 'cute'],
    effects: {
      intimacy: 2,
      mood: 3
    },
    promptTag: '小床刚入水，那条蓝尾巴就悠悠游过来，优雅地卧上去，像一片安静的叶子'
  },
  {
    id: 'gift_feather_whisper',
    label: '羽毛悄悄话',
    icon: '🪶',
    desc: '一根蓬松软羽，用来给鸟宝挠痒痒或当陪睡伙伴',
    species: ['bird'],
    tags: ['gift', 'social', 'gentle'],
    effects: {
      intimacy: 4,
      mood: 2
    },
    promptTag: '羽毛轻轻掠过它的头顶，小鸟眯起眼睛把头靠过来，喉咙里发出一连串咕噜咕噜的撒娇声'
  },
  {
    id: 'gift_fluffy_pawprint',
    label: '绒毛小爪印',
    icon: '🐾',
    desc: '软乎乎的爪印布偶，藏着暖暖心意',
    species: ['mammal'],
    tags: ['gift', 'cuddle', 'social'],
    effects: {
      intimacy: 3,
      mood: 3
    },
    promptTag: '对方轻轻抱住绒毛小爪印，脸上浮现安心的微笑，像是得到了一个温柔的拥抱'
  },
  {
    id: 'gift_dewdrop_bubble',
    label: '露珠泡泡',
    icon: '💧',
    desc: '晶莹小水珠，一碰就开心',
    species: ['amphibian', 'generic'],
    tags: ['gift', 'playful', 'fresh'],
    effects: {
      intimacy: 2,
      mood: 4
    },
    promptTag: '露珠泡泡在掌心轻轻滚动，传来清凉的触感，对方忍不住发出轻轻的笑声'
  },
  {
    id: 'gift_warm_pebble_hug',
    label: '暖石抱抱',
    icon: '🪨',
    desc: '晒过太阳的小石子，捧在手心暖烘烘',
    species: ['reptile', 'generic'],
    tags: ['gift', 'warm', 'cozy'],
    effects: {
      intimacy: 4,
      mood: 2
    },
    promptTag: '暖石抱抱传递着太阳的余温，对方把它贴在脸颊旁，眯起了舒服的眼睛'
  },
  {
    id: 'gift_feather_wobbler',
    label: '羽团摇摇乐',
    icon: '🪶',
    desc: '绒毛小球，轻轻一碰就晃悠',
    species: ['bird'],
    tags: ['gift', 'playful', 'social'],
    effects: {
      intimacy: 2,
      mood: 5
    },
    promptTag: '羽团摇摇乐晃晃悠悠地摆动着，对方好奇地用小爪子拨弄，眼里都是快乐的光'
  },
  {
    id: 'gift_glimmer_bell',
    label: '波光小铃铛',
    icon: '🔔',
    desc: '清脆又柔和，像水面泛起的阳光',
    species: ['fish'],
    tags: ['gift', 'soothing', 'calm'],
    effects: {
      intimacy: 3,
      mood: 3
    },
    promptTag: '波光小铃铛发出叮咚轻响，对方围着转了两圈，心情跟着铃声轻盈起来'
  },
  {
    id: 'gift_star_cotton_candy',
    label: '星星棉花糖',
    icon: '⭐',
    desc: '蓬松像云朵，咬一口是甜甜的梦',
    species: ['generic'],
    tags: ['gift', 'sweet', 'dreamy'],
    effects: {
      intimacy: 4,
      mood: 3
    },
    promptTag: '星星棉花糖在舌尖化开，对方舔舔嘴角，幸福得连尾巴都微微翘了起来'
  },
  {
    id: 'gift_soft_cloud_squeeze',
    label: '软云捏捏',
    icon: '☁️',
    desc: '弹软小玩偶，一捏就回复原样',
    species: ['mammal', 'generic'],
    tags: ['gift', 'playful', 'relax'],
    effects: {
      intimacy: 2,
      mood: 4
    },
    promptTag: '软云捏捏在爪子里被轻轻揉捏，回弹时带来一丝治愈，对方的呼吸都变得舒缓了'
  },
  {
    id: 'gift_moss_ball_nest',
    label: '苔玉小窝',
    icon: '🌿',
    desc: '青苔裹成小圆球，湿润又清新',
    species: ['amphibian', 'reptile'],
    tags: ['gift', 'natural', 'calm'],
    effects: {
      intimacy: 5,
      mood: 2
    },
    promptTag: '苔玉小窝散发着泥土和草叶的香气，对方安静地趴在旁边，仿佛回到林间小溪'
  },
  {
    id: 'gift_coo_whistle',
    label: '咕咕哨笛',
    icon: '🎵',
    desc: '轻轻一吹，像小鸟在打招呼',
    species: ['bird'],
    tags: ['gift', 'musical', 'social'],
    effects: {
      intimacy: 3,
      mood: 3
    },
    promptTag: '咕咕哨笛响起温柔的鸟鸣声，对方歪着脑袋倾听，然后也跟着轻轻叫了一声'
  },
  {
    id: 'gift_seashell_chime',
    label: '贝壳风铃片',
    icon: '🐚',
    desc: '海浪声的小碎片，挂在窝边好安心',
    species: ['fish', 'generic'],
    tags: ['gift', 'soothing', 'calm'],
    effects: {
      intimacy: 3,
      mood: 4
    },
    promptTag: '贝壳风铃片随风轻碰，发出沙沙的潮汐声，对方蜷起身子，慢慢闭上了眼睛'
  }
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
{
id: 'pack_star_soothe_clip',
label: '星光安抚扣',
icon: '⭐',
desc: '一闪一闪的小星星，轻轻别在颈边',
species: ['generic'],
tags: ['calm', 'night', 'soothe'],
effects: { mood: 3, fear: -1 },
promptTag: '星光安抚扣散发着温柔的光，它渐渐放松下来，尾巴也轻轻摇晃了'
},
{
id: 'pack_lotus_water_pillow',
label: '荷叶水珠枕',
icon: '🪷',
desc: '湿润柔软，像躺在雨后池塘边',
species: ['amphibian', 'fish'],
tags: ['wet', 'cool', 'rest'],
effects: { mood: 2, energy: 1 },
promptTag: '枕着荷叶水珠枕，它舒服地翻了个身，小肚皮一起一伏，安心极了'
},
{
id: 'pack_feather_tickler',
label: '羽毛轻摇棒',
icon: '🪶',
desc: '蓬松羽毛逗一逗，小爪子就伸过来',
species: ['bird', 'mammal'],
tags: ['play', 'interact', 'fun'],
effects: { mood: 3, energy: -1 },
promptTag: '羽毛轻摇棒在眼前晃呀晃，它忍不住扑腾追逐，开心得像在云端飞翔'
},
{
id: 'pack_sticky_chew_ring',
label: '糯糯磨牙环',
icon: '🍡',
desc: 'Q弹不伤牙，啃一啃超解压',
species: ['mammal'],
tags: ['chew', 'play', 'gentle'],
effects: { mood: 2, health: 1 },
promptTag: '糯糯磨牙环被它轻轻咬住，小鼻子嗅了嗅，满足地抱着滚了好几圈'
},
  {
    id: 'pack_fluffy_cuddle_cloud',
    label: '绒绒抱抱云',
    icon: '☁️',
    desc: '软绵绵的小云朵，可以抱着蹭蹭',
    species: ['mammal', 'generic'],
    tags: ['soft', 'hug', 'comfort'],
    effects: { mood: 3, health: 0 },
    promptTag: '抱着绒绒抱抱云，它安心地蜷成一团，好像被温柔的云朵轻轻裹住了'
  },
  {
    id: 'pack_twinkle_feather_mirror',
    label: '闪闪羽毛镜',
    icon: '🪶',
    desc: '照一照会自己眨眼睛的小镜子',
    species: ['bird'],
    tags: ['playful', 'shiny', 'curious'],
    effects: { mood: 2, energy: 1 },
    promptTag: '对着闪闪羽毛镜歪歪脑袋，它发现镜子里有个小伙伴也在好奇地看着自己'
  },
  {
    id: 'pack_bubble_jelly_bell',
    label: '泡泡果冻铃',
    icon: '🫧',
    desc: '摇一摇会发出咕噜咕噜的轻响',
    species: ['fish', 'amphibian'],
    tags: ['gentle', 'sound', 'calm'],
    effects: { mood: 2, health: 1 },
    promptTag: '泡泡果冻铃轻轻晃动，水波一样的铃声让它慢慢放松，尾巴也跟着摇了起来'
  },
  {
    id: 'pack_mossy_snug_hideout',
    label: '苔藓小窝窝',
    icon: '🍃',
    desc: '湿湿润润的青苔小屋，躲进去就安心',
    species: ['amphibian', 'reptile'],
    tags: ['damp', 'hide', 'secure'],
    effects: { mood: 2, health: 2 },
    promptTag: '钻进苔藓小窝窝，湿润的凉意刚刚好，它把鼻子埋进去，舒服得眯起了眼'
  },
  {
    id: 'pack_sunny_pebble_buddy',
    label: '阳光小石友',
    icon: '☀️',
    desc: '摸起来暖洋洋的小石头，像好朋友的手心',
    species: ['reptile', 'generic'],
    tags: ['warm', 'friendly', 'steady'],
    effects: { mood: 2, health: 1 },
    promptTag: '趴在小石友旁边，暖意从肚皮慢慢传到心里，它觉得自己被稳稳地陪伴着'
  },
  {
    id: 'pack_chirpy_whisper_ball',
    label: '啾啾呢喃球',
    icon: '🎵',
    desc: '会模仿主人轻声呼唤的绒球',
    species: ['bird', 'mammal'],
    tags: ['sound', 'interactive', 'sweet'],
    effects: { mood: 3, energy: 0 },
    promptTag: '啾啾呢喃球传来熟悉的轻唤，它竖起耳朵，眼睛亮亮地往声音里蹭了蹭'
  },
  {
    id: 'pack_ripple_dream_bottle',
    label: '涟漪梦瓶',
    icon: '🌊',
    desc: '装着会发光的蓝色小水纹',
    species: ['fish', 'amphibian'],
    tags: ['calm', 'glow', 'dreamy'],
    effects: { mood: 2, health: 1 },
    promptTag: '看着瓶里缓缓散开的涟漪光晕，它慢慢闭上眼睛，好像游进了暖暖的睡梦里'
  },
  {
    id: 'pack_snuggle_leaf_tent',
    label: '抱抱叶帐篷',
    icon: '🌿',
    desc: '一片卷起来的大叶子，可以钻进去躲猫猫',
    species: ['mammal', 'reptile', 'generic'],
    tags: ['hide', 'play', 'cozy'],
    effects: { mood: 2, health: 1 },
    promptTag: '钻进抱抱叶帐篷里，只露出一个小鼻子，它在安全的绿意里偷偷地笑了'
  },
];
export const VISIT_FALLBACK_EASTER_EGGS = [
  {
    id: 'toy_love',
    text: '它们居然同时喜欢上了同一个玩具，围着它开心地转来转去。',
    effects: { intimacy: 2, mood: 2 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'mode:incoming-chat', 'playful'],
  },
  {
    id: 'secret_whisper',
    text: '它们凑在一起嘀嘀咕咕，像是交换了一个只有宠物才懂的小秘密。',
    effects: { intimacy: 3, mood: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT, VISIT_MODES.OUTGOING_CHAT],
    tags: ['bond', 'soft'],
  },
  {
    id: 'nap_together',
    text: '玩累之后，它们并排靠着休息了一会儿，气氛安静又温柔。',
    effects: { intimacy: 2, mood: 2 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['cozy', 'soft', 'rest'],
  },
  {
    id: 'gift_hit',
    text: '伴手礼意外特别对胃口，对方一下子就对这次做客更期待了。',
    effects: { intimacy: 3, mood: 2 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'mode:outgoing-chat', 'mode:outgoing-focus', 'surprise'],
  },
  {
    id: 'blanket_share',
    text: '它们不知不觉挤到同一条软毯上，越靠越近，谁都没有先离开。',
    effects: { intimacy: 3, mood: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['soft', 'cozy'],
  },
  {
    id: 'tiny_showoff',
    text: '其中一只宠物认真展示了自己最喜欢的小玩意，另一只看得眼睛都亮了。',
    effects: { intimacy: 2, mood: 2 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'bond', 'curious'],
  },
  {
    id: 'laughing_roll',
    text: '它们不知道玩到了什么有趣的点子，居然一起笑到在地上打了个滚。',
    effects: { intimacy: 2, mood: 3 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['playful', 'toy'],
  },
  {
    id: 'gentle_tail_tap',
    text: '它们轻轻碰了碰彼此，像是在悄悄确认“我们已经是好朋友了”。',
    effects: { intimacy: 3, mood: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT, VISIT_MODES.OUTGOING_CHAT],
    tags: ['bond', 'soft'],
  },
  {
    id: 'shared_snack_moment',
    text: '小零食被认真地分成了两份，连空气里都多了一点甜甜的友好感。',
    effects: { intimacy: 2, mood: 2 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'gift:snack_box', 'food', 'sweet', 'soft'],
  },
  {
    id: 'favorite_corner',
    text: '它们一起发现了房间里最舒服的小角落，然后谁也不肯先挪开。',
    effects: { intimacy: 2, mood: 2 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['cozy', 'bond', 'hide', 'rest'],
  },
  {
    id: 'matching_pace',
    text: '原本还稍微有点拘谨的节奏，慢慢变成了刚刚好的默契。',
    effects: { intimacy: 3, mood: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT],
    tags: ['bond', 'soft'],
  },
  {
    id: 'toy_rescue',
    text: '一个差点滚远的小玩具被及时追回来，它们还因此高兴地碰了碰头。',
    effects: { intimacy: 2, mood: 2 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:ball', 'toy:toy_jingly_ball', 'playful', 'chase', 'roll'],
  },
  {
    id: 'quiet_story_time',
    text: '翻着翻着绘本，它们居然都安静了下来，像是真的听进了故事里。',
    effects: { intimacy: 2, mood: 2 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:storybook', 'soft', 'calm'],
  },
  {
    id: 'gift_pride',
    text: '送出伴手礼时，那一点点小紧张很快就变成了藏不住的开心和骄傲。',
    effects: { intimacy: 3, mood: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'soft', 'surprise'],
  },
  {
    id: 'pack_comfort',
    text: '熟悉的出门包陪在身边，让它在陌生环境里也慢慢放松了下来。',
    effects: { intimacy: 1, mood: 3 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['pack', 'cozy', 'secure', 'soft'],
  },
  {
    id: 'focus_visit_note',
    text: '在你专注的时候，宠物那边也过得很充实，像是一起完成了一次小小成长。',
    effects: { intimacy: 2, mood: 2 },
    modes: [VISIT_MODES.OUTGOING_FOCUS],
    tags: ['focus', 'bond', 'mode:outgoing-focus'],
  },
  {
    id: 'focus_waiting_smile',
    text: '番茄钟快结束时，它像是已经准备好回家后第一时间和你分享今天的小见闻。',
    effects: { intimacy: 2, mood: 2 },
    modes: [VISIT_MODES.OUTGOING_FOCUS],
    tags: ['focus', 'soft', 'mode:outgoing-focus'],
  },
  {
    id: 'borrowed_toy_memory',
    text: '它们还认真讨论了下次要不要继续玩今天最喜欢的那个玩具。',
    effects: { intimacy: 2, mood: 2 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'bond'],
  },
  {
    id: 'tiny_goodbye_pause',
    text: '临近结束时，它们忽然都安静了一下，像是有点舍不得今天的时光。',
    effects: { intimacy: 3, mood: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.INCOMING_CHAT],
    tags: ['soft', 'bond'],
  },

  // === 更多彩蛋：按玩具标签命中 ===
  {
    id: 'egg_yarn_ball_tangle',
    text: '线球滚着滚着绕出一个小小爱心，它们盯着看了好久，谁也舍不得拆开。',
    effects: { intimacy: 3, mood: 2 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:toy_yarn_ball', 'soft', 'playful', 'chase'],
  },
  {
    id: 'egg_feather_wand_jump',
    text: '羽毛轻轻一晃，两只小家伙同时跳起来，落地后还装作什么都没发生。',
    effects: { intimacy: 2, mood: 3 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:feather_wand', 'toy:toy_feather_wand', 'flutter', 'jump', 'playful'],
  },
  {
    id: 'egg_bubble_maker_rainbow',
    text: '泡泡破开的瞬间映出一点彩虹光，它们像发现宝藏一样追着下一颗泡泡跑。',
    effects: { intimacy: 2, mood: 3, clean: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:toy_bubble_maker', 'magical', 'gentle', 'chase'],
  },
  {
    id: 'egg_shell_rattle_sea',
    text: '贝壳沙沙响起来，房间里像飘进一小片海风，连呼吸都慢慢安静了。',
    effects: { intimacy: 3, mood: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:toy_shell_rattle', 'sound', 'calm', 'texture'],
  },
  {
    id: 'egg_mini_tunnel_peekaboo',
    text: '隧道口忽然探出两个脑袋，它们对视一秒后一起笑得缩了回去。',
    effects: { intimacy: 3, mood: 2 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:toy_mini_tunnel', 'hide', 'explore', 'cozy'],
  },
  {
    id: 'egg_lily_float_ripple',
    text: '小荷叶晃出一圈圈涟漪，它们像在水面写悄悄话，气氛软软的。',
    effects: { intimacy: 2, mood: 2, health: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:toy_floating_lily', 'water', 'float', 'rest'],
  },
  {
    id: 'egg_jingly_ball_duet',
    text: '铃铛球叮咚叮咚滚过去，它们居然踩出了像小小合奏一样的节奏。',
    effects: { intimacy: 2, mood: 3 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:toy_jingly_ball', 'sound', 'chase', 'roll'],
  },
  {
    id: 'egg_mirror_perch_self',
    text: '小圆镜前多了两个认真歪头的小影子，它们好像在练习最可爱的打招呼方式。',
    effects: { intimacy: 2, mood: 2 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:toy_mirror_perch', 'curious', 'self', 'perch'],
  },

  // === 更多彩蛋：按礼物标签命中 ===
  {
    id: 'egg_gift_snack_box_shared',
    text: '零食礼盒打开后，它们很认真地挑出最大的一块，推给了对方。',
    effects: { intimacy: 3, mood: 2 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'gift:snack_box', 'food', 'sweet', 'share'],
  },
  {
    id: 'egg_gift_sweet_surprise',
    text: '伴手礼里藏着一点甜甜的小惊喜，对方开心得眼睛都弯了起来。',
    effects: { intimacy: 3, mood: 2 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'sweet', 'surprise', 'soft'],
  },
  {
    id: 'egg_gift_gentle_keepsake',
    text: '对方把礼物轻轻收好，像是把今天的心意也一起收进了小抽屉。',
    effects: { intimacy: 4, mood: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'gentle', 'bond', 'keepsake'],
  },
  {
    id: 'egg_gift_sound_response',
    text: '礼物发出轻轻的声响时，对方立刻凑近回应了一声，像在认真说谢谢。',
    effects: { intimacy: 3, mood: 2 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'sound', 'interactive', 'sweet'],
  },

  // === 更多彩蛋：按出门包标签命中 ===
  {
    id: 'egg_pack_secure_breath',
    text: '出门包里的熟悉气味让它悄悄松了一口气，连脚步都变得轻快了。',
    effects: { intimacy: 2, mood: 3 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['pack', 'secure', 'cozy', 'soft'],
  },
  {
    id: 'egg_pack_hide_peek',
    text: '它从出门包的小角落探出脑袋偷看，对方也配合地小小声打了个招呼。',
    effects: { intimacy: 3, mood: 2 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['pack', 'hide', 'cozy', 'secure'],
  },
  {
    id: 'egg_pack_warm_companion',
    text: '暖暖的小物件贴在身边，它像带着一小团家的温度去见朋友。',
    effects: { intimacy: 2, mood: 3, health: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['pack', 'warm', 'steady', 'friendly'],
  },
  {
    id: 'egg_pack_sound_courage',
    text: '包里传来轻轻的铃声，它像被鼓励了一下，终于主动往前靠近了一步。',
    effects: { intimacy: 3, mood: 2 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['pack', 'sound', 'interactive', 'sweet'],
  },
  {
    id: 'egg_pack_dreamy_return',
    text: '回家路上，它还抱着出门包里的小东西发呆，像是在回味刚刚的做客。',
    effects: { intimacy: 2, mood: 2 },
    modes: [VISIT_MODES.OUTGOING_FOCUS, VISIT_MODES.OUTGOING_CHAT],
    tags: ['pack', 'dreamy', 'calm', 'glow'],
  },
   // === 更多彩蛋 ===
  {
    id: 'toy_ball_bounce_dance',
    text: '小球弹跳着滚到它们脚边，它们轻轻推了一下，开心地追上去。',
    effects: { mood: 3, intimacy: 2 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:ball', 'playful', 'chase']
  },
  {
    id: 'toy_pond_set_splash',
    text: '小爪子拨动池塘里的水花，水珠在阳光下闪闪发光，它们玩得好专注。',
    effects: { mood: 3, clean: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:pond_set', 'water', 'gentle']
  },
  {
    id: 'toy_warm_stone_cuddle',
    text: '它们蜷缩在暖石边，眯着眼睛发出轻柔的呼噜声，看起来很安心。',
    effects: { intimacy: 2, mood: 2, health: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:warm_stone', 'cozy', 'warm']
  },
  {
    id: 'toy_feather_wand_flutter',
    text: '羽毛逗猫棒轻轻一抖，它们立刻竖起耳朵，扑过来抱住晃动的羽毛。',
    effects: { mood: 4, intimacy: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:feather_wand', 'playful', 'chase']
  },
  {
    id: 'toy_storybook_read',
    text: '它们趴在故事书旁边，翻动的书页发出沙沙声，像是真的在听故事。',
    effects: { intimacy: 3, mood: 2 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:storybook', 'calm', 'dreamy']
  },
  {
    id: 'toy_plush_snuggle',
    text: '它们用脑袋蹭了蹭软乎乎的毛绒玩具，然后轻轻叼到窝里一起休息。',
    effects: { intimacy: 2, mood: 2, clean: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:plush', 'soft', 'cozy']
  },
  {
    id: 'toy_yarn_ball_unroll',
    text: '毛线球被拨弄得慢慢散开，它们踩着线头绕圈，玩得不亦乐乎。',
    effects: { mood: 3, intimacy: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:toy_yarn_ball', 'playful', 'chase']
  },
  {
    id: 'toy_crinkly_duck_squeak',
    text: '捏一下鸭子玩具，发出可爱的嘎吱声，它们歪着头，又轻轻碰了一下。',
    effects: { mood: 3, intimacy: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:toy_crinkly_duck', 'sound', 'gentle']
  },
  {
    id: 'toy_shell_rattle_shake',
    text: '贝壳摇铃发出海浪般的沙沙声，它们好奇地拨动，眼睛亮晶晶的。',
    effects: { mood: 3, intimacy: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:toy_shell_rattle', 'sound', 'calm']
  },
  {
    id: 'toy_bubble_maker_floating',
    text: '一串泡泡飘到空中，它们跳起来轻轻戳破，又去追下一颗。',
    effects: { mood: 4, intimacy: 1, clean: 1 },
    modes: [VISIT_MODES.INCOMING_CHAT],
    tags: ['toy', 'toy:toy_bubble_maker', 'magical', 'playful', 'chase']
  },
  {
    id: 'gift_snack_box_share',
    text: '打开零食盒子，它们凑过来用湿湿的鼻子碰碰你的手，然后小口小口吃。',
    effects: { intimacy: 3, mood: 2 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'gift:snack_box', 'sweet', 'bond']
  },
  {
    id: 'gift_cozy_blanket',
    text: '毛毯铺开，它们立刻钻进去，只露出一个毛茸茸的尾巴尖。',
    effects: { mood: 2, intimacy: 2, health: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'soft', 'cozy', 'warm']
  },
  {
    id: 'gift_sunbeam_cushion',
    text: '阳光垫子放在窗边，它们伸个懒腰躺上去，眼睛慢慢眯成一条线。',
    effects: { mood: 3, health: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'warm', 'calm', 'secure']
  },
  {
    id: 'gift_herb_sachet',
    text: '闻到你带来的草药香包，它们轻轻嗅了嗅，打了个小小的哈欠。',
    effects: { mood: 2, health: 2 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'calm', 'gentle', 'dreamy']
  },
  {
    id: 'gift_jingly_bell_collar',
    text: '给小项圈挂上铃铛，每一步都发出清脆的叮当声，它们得意地走来走去。',
    effects: { mood: 3, intimacy: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'sound', 'playful', 'interactive']
  },
  {
    id: 'gift_fluffy_mouse_toy',
    text: '一只软绵绵的小老鼠玩具，它们叼起来抛到空中，又扑住它。',
    effects: { mood: 3, intimacy: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'toy', 'playful', 'chase']
  },
  {
    id: 'gift_scratcher_lounge',
    text: '新的猫抓板带小窝，它们抓了几下，然后舒服地窝在里面打盹。',
    effects: { mood: 2, intimacy: 2, clean: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'cozy', 'secure', 'gentle']
  },
  {
    id: 'gift_starry_night_light',
    text: '小夜灯投出星空，它们抬头看着光点，安静地依偎在你身边。',
    effects: { mood: 2, intimacy: 3 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['gift', 'dreamy', 'calm', 'bond']
  },
  {
    id: 'pack_bubble_jelly_bell_ring',
    text: '从包里掏出果冻铃铛，轻轻一摇，它们就竖着耳朵跑过来。',
    effects: { mood: 3, intimacy: 2 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['pack', 'pack:pack_bubble_jelly_bell', 'sound', 'playful']
  },
  {
    id: 'pack_mossy_snug_hideout_enter',
    text: '苔藓小屋铺开，它们钻进去探索一番，然后露出半张脸张望你。',
    effects: { mood: 2, intimacy: 2, health: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['pack', 'pack:pack_mossy_snug_hideout', 'hide', 'cozy']
  },
  {
    id: 'pack_sunny_pebble_buddy_warm',
    text: '暖阳小石放在它们身边，它们贴着石头闭眼，像在晒太阳。',
    effects: { mood: 2, health: 2 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['pack', 'pack:pack_sunny_pebble_buddy', 'warm', 'gentle']
  },
  {
    id: 'pack_chirpy_whisper_ball_tweet',
    text: '啾语球发出小鸟般的叫声，它们好奇地轻推，又侧耳倾听。',
    effects: { mood: 3, intimacy: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['pack', 'pack:pack_chirpy_whisper_ball', 'sound', 'playful']
  },
  {
    id: 'pack_ripple_dream_bottle_glow',
    text: '涟漪梦境瓶微微发光，它们盯着瓶里流动的光影，慢慢安静下来。',
    effects: { mood: 3, intimacy: 1, health: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['pack', 'pack:pack_ripple_dream_bottle', 'dreamy', 'calm']
  },
  {
    id: 'pack_snuggle_leaf_tent_crawl',
    text: '树叶帐篷搭好后，它们钻进去躺下，伸出一只小爪子搭在外边。',
    effects: { mood: 2, intimacy: 3 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['pack', 'pack:pack_snuggle_leaf_tent', 'cozy', 'hide']
  },
  {
    id: 'pack_cloud_fluff_bed',
    text: '云朵软垫铺开，它们在上边翻滚一圈，然后满足地缩成团。',
    effects: { mood: 3, health: 1, clean: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['pack', 'soft', 'cozy', 'secure']
  },
  {
    id: 'pack_starlight_wand_dot',
    text: '星光棒轻轻一点，空中出现小光点，它们兴奋地跳着去抓。',
    effects: { mood: 4, intimacy: 1 },
    modes: [VISIT_MODES.OUTGOING_CHAT, VISIT_MODES.OUTGOING_FOCUS],
    tags: ['pack', 'magical', 'playful', 'chase']
  },
  {
    id: 'focus_timer_25min_purr',
    text: '番茄钟嘀嗒走着，它们安静趴在你手边，发出轻轻的呼噜声。',
    effects: { intimacy: 3, mood: 2 },
    modes: [VISIT_MODES.OUTGOING_FOCUS],
    tags: ['focus', 'calm', 'bond', 'secure']
  },
  {
    id: 'focus_completion_flower_grow',
    text: '专注完成啦，它们推给你一朵小花，然后快乐地原地转圈。',
    effects: { mood: 3, intimacy: 2, health: 1 },
    modes: [VISIT_MODES.OUTGOING_FOCUS],
    tags: ['focus', 'surprise', 'sweet', 'bond']
  },
  {
    id: 'focus_break_reminder_stretch',
    text: '到休息时间啦，它们伸个懒腰，然后轻轻蹭蹭你的手提醒你。',
    effects: { mood: 2, intimacy: 2, health: 1 },
    modes: [VISIT_MODES.OUTGOING_FOCUS],
    tags: ['focus', 'gentle', 'interactive', 'warm']
  },
  {
    id: 'focus_deep_work_blanket',
    text: '你专心工作时，它们安静趴在旁边，小尾巴偶尔轻轻扫过你的手腕。',
    effects: { intimacy: 3, mood: 1, clean: 1 },
    modes: [VISIT_MODES.OUTGOING_FOCUS],
    tags: ['focus', 'cozy', 'calm', 'secure']
  }
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
