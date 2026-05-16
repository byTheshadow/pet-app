/* ============================================
   宠物状态机模块
   负责：宠物数据管理、状态衰减、互动行为、
         成长阶段判断、气泡触发
   ============================================ */

/* [PET-DEFAULTS] */
const PET_DEFAULTS = {
  name: '小宠物',
  avatarUrl: '',
  stage: 'baby',       // egg | baby | child | adult
  stats: {
    hunger:   80,      // 饥饿度（越高越饱）
    mood:     70,      // 心情
    health:   90,      // 健康
    clean:    80,      // 清洁
    intimacy: 30       // 亲密度
  },
  personality: {
    preset: 'gentle',  // 预设性格 key
    customPrompt: ''   // 自定义补充
  },
  currentScene: null,  // 当前场景 id
  totalAge: 0,         // 累计存活分钟数（用于成长判断）
  memoryLog: [],       // 压缩记忆摘要数组
  createdAt: null
};

// 成长阶段阈值（累计分钟）
const STAGE_THRESHOLDS = {
  egg:   0,
  baby:  60,       // 1 小时后变幼年
  child: 60 * 24,  // 1 天后变少年
  adult: 60 * 24 * 7 // 7 天后变成年
};

// 预设性格列表（前端展示 + 注入提示词）
const PERSONALITY_PRESETS = [
  { key: 'gentle',   label: '温柔',   emoji: '🌸', prompt: '你性格温柔体贴，说话轻声细语，喜欢撒娇，容易害羞。' },
  { key: 'tsundere', label: '傲娇',   emoji: '😤', prompt: '你性格傲娇，嘴硬心软，表面冷淡但内心在意主人，偶尔会说反话。' },
  { key: 'lively',   label: '活泼',   emoji: '⚡', prompt: '你性格活泼开朗，精力充沛，喜欢玩耍，说话充满感叹号和颜文字。' },
  { key: 'lazy',     label: '慵懒',   emoji: '😴', prompt: '你性格慵懒，喜欢睡觉和发呆，说话慢悠悠的，但偶尔会突然来劲。' },
  { key: 'curious',  label: '好奇',   emoji: '🔍', prompt: '你性格好奇，对什么都感兴趣，喜欢问问题，充满探索欲。' },
  { key: 'cool',     label: '酷',     emoji: '🌙', prompt: '你性格冷静酷炫，话不多但每句都很有分量，偶尔会说出意想不到的话。' },
  { key: 'custom',   label: '自定义', emoji: '✏️', prompt: '' }
];

// 状态衰减速率（每次心跳衰减量，心跳间隔 5 分钟）
const DECAY_RATES = {
  hunger:   2.5,   // 每5分钟 -2.5
  mood:     1.5,
  health:   0.5,   // 健康衰减最慢
  clean:    1.8,
  intimacy: 0.8
};

// 互动行为配置
const ACTIONS = {
  feed: {
    label: '喂食',
    statDeltas: { hunger: +25, mood: +5, health: +3 },
    cooldown: 30 * 60 * 1000,  // 30 分钟冷却
    particles: ['🍖', '🍎', '🍰', '🐟'],
    animation: 'wiggle'
  },
  play: {
    label: '玩耍',
    statDeltas: { mood: +20, intimacy: +10, hunger: -8, clean: -5 },
    cooldown: 20 * 60 * 1000,
    particles: ['⭐', '✨', '🎮', '🎈'],
    animation: 'bounce'
  },
  clean: {
    label: '清洁',
    statDeltas: { clean: +30, mood: +5, health: +5 },
    cooldown: 60 * 60 * 1000,
    particles: ['🛁', '✨', '💧', '🫧'],
    animation: 'spin'
  },
  medicine: {
    label: '喂药',
    statDeltas: { health: +30, mood: -5 },
    cooldown: 4 * 60 * 60 * 1000,
    particles: ['💊', '💉'],
    animation: 'shake'
  }
};
/* [/PET-DEFAULTS] */

/* ============================================
   宠物状态机
   ============================================ */
/* [PET-STATE] */
const PetState = (() => {
  let _pet = null;           // 当前宠物数据（内存缓存）
  let _cooldowns = {};       // 行为冷却计时 { actionKey: timestamp }
  let _listeners = [];       // 状态变化监听器

  // 通知所有监听器
  function _emit(event, data) {
    _listeners.forEach(fn => {
      try { fn(event, data); } catch (e) { Logger.error('PetState listener 错误', e.message); }
    });
  }

  // 将数值限制在 0-100
  function _clamp(val) {
    return Math.max(0, Math.min(100, val));
  }

  // 根据状态判断当前情绪
  function _calcMood(stats) {
    const avg = (stats.hunger + stats.mood + stats.health + stats.clean) / 4;
    if (stats.health < 20) return 'sick';
    if (avg < 25)          return 'sad';
    if (stats.hunger < 20) return 'hungry';
    if (avg > 75)          return 'happy';
    return 'normal';
  }

  // 根据累计年龄判断成长阶段
  function _calcStage(totalAge) {
    if (totalAge >= STAGE_THRESHOLDS.adult) return 'adult';
    if (totalAge >= STAGE_THRESHOLDS.child) return 'child';
    if (totalAge >= STAGE_THRESHOLDS.baby)  return 'baby';
    return 'egg';
  }

  return {
    /* ---- 初始化 ---- */
    async init() {
      try {
        _pet = await DB.pet.get();
        if (_pet) {
          // 读取冷却数据
          try {
            _cooldowns = JSON.parse(localStorage.getItem('petapp_cooldowns') || '{}');
          } catch { _cooldowns = {}; }
          Logger.info('宠物数据加载成功', _pet.name);
        }
        return _pet;
      } catch (e) {
        Logger.error('PetState.init 失败', e.message);
        return null;
      }
    },

    /* ---- 创建宠物 ---- */
    async create(data) {
      try {
        const now = Date.now();
        _pet = {
          ...PET_DEFAULTS,
          ...data,
          stats: { ...PET_DEFAULTS.stats, ...(data.stats || {}) },
          personality: { ...PET_DEFAULTS.personality, ...(data.personality || {}) },
          createdAt: now,
          updatedAt: now,
          totalAge: 0,
          stage: 'baby',
          memoryLog: []
        };
        await DB.pet.save(_pet);
        _emit('created', _pet);
        Logger.info('宠物创建成功', _pet.name);
        return _pet;
      } catch (e) {
        Logger.error('PetState.create 失败', e.message);
        throw e;
      }
    },

    /* ---- 更新宠物数据 ---- */
    async update(patch) {
      if (!_pet) return null;
      try {
        _pet = { ..._pet, ...patch, updatedAt: Date.now() };
        // 深合并 stats
        if (patch.stats) {
          _pet.stats = { ..._pet.stats, ...patch.stats };
          // 确保所有值在合法范围
          Object.keys(_pet.stats).forEach(k => {
            _pet.stats[k] = _clamp(_pet.stats[k]);
          });
        }
        await DB.pet.save(_pet);
        _emit('updated', _pet);
        return _pet;
      } catch (e) {
        Logger.error('PetState.update 失败', e.message);
        throw e;
      }
    },

    /* ---- 状态衰减（由 Timer 定时调用）---- */
    async decay(minutesPassed = 5) {
      if (!_pet) return;
      try {
        const factor = minutesPassed / 5; // 以5分钟为基准单位
        const newStats = { ..._pet.stats };

        Object.keys(DECAY_RATES).forEach(key => {
          newStats[key] = _clamp(newStats[key] - DECAY_RATES[key] * factor);
        });

        // 累计年龄
        const newAge = (_pet.totalAge || 0) + minutesPassed;
        const newStage = _calcStage(newAge);
        const stageChanged = newStage !== _pet.stage;

        await this.update({
          stats: newStats,
          totalAge: newAge,
          stage: newStage
        });

        if (stageChanged) {
          _emit('stageChanged', { from: _pet.stage, to: newStage });
          Logger.info(`宠物成长阶段变化: ${newStage}`);
        }

        // 检查危急状态
        const critical = Object.entries(newStats).filter(([, v]) => v < 20);
        if (critical.length > 0) {
          _emit('critical', critical.map(([k]) => k));
        }

        _emit('decayed', { stats: newStats, minutesPassed });
      } catch (e) {
        Logger.error('PetState.decay 失败', e.message);
      }
    },

    /* ---- 执行互动行为 ---- */
    async doAction(actionKey) {
      if (!_pet) throw new Error('没有宠物');

      const action = ACTIONS[actionKey];
      if (!action) throw new Error(`未知行为: ${actionKey}`);

      // 检查冷却
      const lastTime = _cooldowns[actionKey] || 0;
      const elapsed = Date.now() - lastTime;
      if (elapsed < action.cooldown) {
        const remaining = Math.ceil((action.cooldown - elapsed) / 60000);
        throw new Error(`${action.label}还需要冷却 ${remaining} 分钟`);
      }

      try {
        // 应用数值变化
        const newStats = { ..._pet.stats };
        Object.entries(action.statDeltas).forEach(([key, delta]) => {
          if (newStats[key] !== undefined) {
            newStats[key] = _clamp(newStats[key] + delta);
          }
        });

        await this.update({ stats: newStats });

        // 记录冷却
        _cooldowns[actionKey] = Date.now();
        localStorage.setItem('petapp_cooldowns', JSON.stringify(_cooldowns));

        // 记录事件日志
        await DB.eventLog.add({
          petId: _pet.id,
          type: 'action',
          action: actionKey,
          label: action.label,
          statsDelta: action.statDeltas,
          content: `对${_pet.name}进行了${action.label}`
        });

        _emit('action', { actionKey, action, newStats });
        return { action, newStats };
      } catch (e) {
        Logger.error(`PetState.doAction(${actionKey}) 失败`, e.message);
        throw e;
      }
    },

    /* ---- 获取冷却剩余时间（毫秒）---- */
    getCooldownRemaining(actionKey) {
      const action = ACTIONS[actionKey];
      if (!action) return 0;
      const lastTime = _cooldowns[actionKey] || 0;
      const elapsed = Date.now() - lastTime;
      return Math.max(0, action.cooldown - elapsed);
    },

    /* ---- 添加记忆摘要 ---- */
    async addMemory(summary) {
      if (!_pet) return;
      try {
        const memoryLog = [...(_pet.memoryLog || []), {
          summary,
          timestamp: Date.now()
        }];
        // 最多保留 20 条摘要
        if (memoryLog.length > 20) memoryLog.splice(0, memoryLog.length - 20);
        await this.update({ memoryLog });
      } catch (e) {
        Logger.error('PetState.addMemory 失败', e.message);
      }
    },

    /* ---- 删除宠物 ---- */
    async deletePet() {
      try {
        if (_pet) {
          await DB.chat.clearByPet(_pet.id);
          await DB.eventLog.clearByPet(_pet.id);
        }
        await DB.pet.delete();
        _pet = null;
        _cooldowns = {};
        localStorage.removeItem('petapp_cooldowns');
        _emit('deleted', null);
        Logger.info('宠物已删除');
      } catch (e) {
        Logger.error('PetState.deletePet 失败', e.message);
        throw e;
      }
    },

    /* ---- Getters ---- */
    get()         { return _pet; },
    getStats()    { return _pet?.stats || null; },
    getMoodState(){ return _pet ? _calcMood(_pet.stats) : 'normal'; },
    getStage()    { return _pet?.stage || 'baby'; },
    exists()      { return !!_pet; },

    /* ---- 监听器 ---- */
    on(fn)  { _listeners.push(fn); },
    off(fn) { _listeners = _listeners.filter(f => f !== fn); }
  };
})();
/* [/PET-STATE] */

/* ============================================
   气泡内容生成器
   根据当前状态返回合适的颜文字气泡文本
   ============================================ */
/* [BUBBLE-GENERATOR] */
const BubbleGenerator = (() => {
  // 各状态对应的气泡文本池
  const BUBBLE_POOL = {
    hungry: [
      '(´；ω；`) 肚子好饿...',
      '( ˘ω˘ ) 想吃东西...',
      'ヽ(；▽；)ノ 饿饿饿！',
      '(´-ω-`) 好想吃鱼...'
    ],
    sad: [
      '(´；ω；`) 好难过...',
      '( ╥ω╥ ) 呜呜呜...',
      '(´•ω•̥`) 没精神...',
      '(；ω；) 想被抱抱...'
    ],
    sick: [
      '(´x ω x`) 好难受...',
      '( ˘•ω•˘ ) 头好晕...',
      '(´；ω；`) 生病了...',
      '(x_x) 需要吃药...'
    ],
    happy: [
      '(≧▽≦) 今天好开心！',
      '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ 超级快乐！',
      '(*´▽`*) 嘻嘻嘻～',
      '(o^▽^o) 好喜欢你！',
      '٩(◕‿◕｡)۶ 最幸福了！'
    ],
    normal: [
      '( ´ ▽ ` ) 今天也要加油～',
      '(˘ω˘) 发呆中...',
      '(*ﾟ▽ﾟ*) 在想什么呢',
      '(´• ω •`) 嗯嗯嗯～',
      '( ˘ ³˘)♥ 想和你玩～',
      '(◡ ‿ ◡ ✿) 心情不错哦'
    ],
    dirty: [
      '(；一_一) 好脏脏...',
      '(´-ω-`) 想洗澡...',
      '(ﾉ；ω；)ﾉ 帮我洗澡嘛！'
    ],
    bored: [
      '(－_－) zzZ 好无聊...',
      '(´ー`) 想玩游戏...',
      '( ˘ω˘ ) 陪我玩嘛～'
    ],
    sleeping: [
      'zzZ (˘ω˘ )',
      '(－ω－) zzZ',
      '(´ ▽｀).｡ｏ♡ 做梦中...'
    ]
  };

  // 根据当前状态选择合适的气泡池
  function _selectPool(stats, moodState) {
    if (moodState === 'sick')    return BUBBLE_POOL.sick;
    if (moodState === 'sad')     return BUBBLE_POOL.sad;
    if (moodState === 'hungry')  return BUBBLE_POOL.hungry;
    if (moodState === 'happy')   return BUBBLE_POOL.happy;
    if (stats.clean < 30)        return BUBBLE_POOL.dirty;
    if (stats.mood < 40)         return BUBBLE_POOL.bored;
    return BUBBLE_POOL.normal;
  }

  // 随机选一条
  function _pick(pool) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return {
    // 根据状态生成气泡文本
    generate(stats, moodState) {
      const pool = _selectPool(stats, moodState);
      return _pick(pool);
    },

    // 互动后的反馈气泡
    actionFeedback(actionKey) {
      const feedbacks = {
        feed:     ['(≧▽≦) 好好吃！', '(*´▽`*) 谢谢喂饭！', '(o^▽^o) 饱饱的～'],
        play:     ['(ﾉ◕ヮ◕)ﾉ 好好玩！', '(≧∇≦)/ 再玩一次！', '٩(◕‿◕｡)۶ 开心！'],
        clean:    ['(´• ω •`) 好清爽～', '(*ﾟ▽ﾟ*) 香香的！', '(˘ω˘) 舒服多了'],
        medicine: ['(´；ω；`) 好苦...', '(；一_一) 不想吃药...', '(´-ω-`) 谢谢...']
      };
      const pool = feedbacks[actionKey] || BUBBLE_POOL.normal;
      return _pick(pool);
    },

    // 场景冒险后的气泡
    adventureFeedback(sceneName) {
      const pool = [
        `(≧▽≦) ${sceneName}好好玩！`,
        `(*´▽`*) 想再去${sceneName}！`,
        `(o^▽^o) 今天去了${sceneName}～`,
        `٩(◕‿◕｡)۶ ${sceneName}的冒险好棒！`
      ];
      return _pick(pool);
    }
  };
})();
/* [/BUBBLE-GENERATOR] */
