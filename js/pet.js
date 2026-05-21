// js/pet.js
//宠物状态逻辑：衰减、喂食、互动、进化、AI对话、生病

import { dbGet, dbSet } from './db.js';
import { DEFAULT_PET, DEFAULT_SETTINGS, PERSONALITY_PRESETS, runtime, bus, EVENTS } from './state.js';
import { callAI, buildSystemPrompt } from './ai.js';
import { logInfo, logError, logWarn } from './logger.js';
import { showToast } from './ui.js';

// ── 食物定义 ─────────────────────────────────────────────────
export const FOOD_LIST = [
  {
    id:'normal',
    icon:     '🍖',
    label:    '普通饭',
    desc:     '基础食物，随时可用',
    effects:  { hunger: 25, bond: 3 },
    cooldown: 0,          // 无冷却（毫秒）
  },
  {
    id:       'cake',
    icon:     '🍰',
    label:    '小蛋糕',
    desc:     '心情大增，每天限1次',
    effects:  { hunger: 15, mood: 25, bond: 8 },
    cooldown: 24* 3600000, // 24 小时
  },
  {
    id:       'soup',
    icon:     '🍵',
    label:    '热汤',
    desc:     '营养丰富，8小时1次',
    effects:  { hunger: 30, health: 15, bond: 4 },
    cooldown: 8 * 3600000,  // 8 小时
  },
  {
    id:       'snack',
    icon:     '🍬',
    label:    '零食',
    desc:     '哄心情用，4小时1次',
    effects:  { hunger: 10, mood: 20, bond: 5 },
    cooldown: 4 * 3600000,  // 4 小时
  },
  {
    id:       'medicine',
    icon:     '💊',
    label:    '营养剂',
    desc:     '生病时才能用',
    effects:  { health: 50, bond: 2 },
    cooldown: 24 * 3600000, // 24 小时
    sickOnly: true,         // 只有 health < 80 时才能用
  },
];

// ── 食物冷却管理（localStorage）─────────────────────────────
export function getFoodCooldownRemaining(foodId) {
  const key = `petos-food-cd-${foodId}`;
  const lastUsed = parseInt(localStorage.getItem(key) || '0', 10);
  const food = FOOD_LIST.find(f => f.id === foodId);
  if (!food || !food.cooldown) return 0;
  const remaining = (lastUsed + food.cooldown) - Date.now();
  return Math.max(0, remaining);
}

export function setFoodUsed(foodId) {
  const key = `petos-food-cd-${foodId}`;
  localStorage.setItem(key, String(Date.now()));
}

export function canUseFood(foodId) {
  const food = FOOD_LIST.find(f => f.id === foodId);
  if (!food) return false;
  const pet = runtime.pet || {};

  // 营养剂：只有生病时才能用
  if (food.sickOnly && (pet.health ?? 100) >= 80) return false;

  // 冷却检查
  if (food.cooldown && getFoodCooldownRemaining(foodId) > 0) return false;

  return true;
}

// ── 喂食（通用，按foodId）───────────────────────────────────
export async function feedWithFood(foodId) {
  const food = FOOD_LIST.find(f => f.id === foodId);
  if (!food) throw new Error('未知食物');
  if (!canUseFood(foodId)) throw new Error('该食物当前不可用');

  const pet = runtime.pet;
  const clamp = v => Math.max(0, Math.min(100, v));
  const patch = {};

  for (const [key, val] of Object.entries(food.effects)) {
    if (key in pet) {
      patch[key] = clamp((pet[key] || 0) + val);
    }
  }

  // 记录冷却
  if (food.cooldown) setFoodUsed(foodId);

  await savePet(patch);
  logInfo('pet', `Fed with ${food.label}: ${JSON.stringify(food.effects)}`);
  return food;
}

// ── 加载宠物数据 ─────────────────────────────────────────────
export async function loadPet() {
  let pet = await dbGet('pet', 'singleton');
  if (!pet) {
    pet = { ...DEFAULT_PET };
    await dbSet('pet', pet);
    logInfo('pet', 'Created default pet');
  }
  runtime.pet = pet;
  return pet;
}

// ── 保存宠物数据 ─────────────────────────────────────────────
export async function savePet(patch = {}) {
  const pet = { ...runtime.pet, ...patch };
  runtime.pet = pet;
  await dbSet('pet', pet);
  bus.emit(EVENTS.PET_UPDATED, pet);
  return pet;
}

// ── 离线衰减结算 + 生病检查 ──────────────────────────────────
export async function applyDecay() {
  const pet      = runtime.pet;
  const settings = runtime.settings || await dbGet('settings', 'singleton') || DEFAULT_SETTINGS;
  const rates    = settings.decayRates || DEFAULT_SETTINGS.decayRates;

  const now      = Date.now();
  const lastAt= pet.lastOnlineAt || now;
  const gapHours = Math.max(0, (now - lastAt) / 3600000);

  if (gapHours < 0.01) return; // 不足 36秒，跳过

  const clamp = v => Math.max(0, Math.min(100, v));

  // hunger / mood / clean 正常衰减
  const newHunger = clamp(pet.hunger - gapHours * rates.hunger);
  const newMood   = clamp(pet.mood   - gapHours * rates.mood);
  const newClean  = clamp(pet.clean  - gapHours * rates.clean);

  // ★ health 不自然衰减，只通过生病事件下降
  let newHealth = pet.health;

  // ── 生病检查 ──────────────────────────────────────────────
  // 只有 health >= 80（没在生病中）才检查是否触发新的生病事件
  if (newHealth >= 80 && gapHours >= 1) {
    const sickResult = _checkSickness(newHunger, newMood, newClean, gapHours);
    if (sickResult.sick) {
      newHealth = clamp(newHealth - sickResult.damage);
      logInfo('pet', `Pet got sick! damage=${sickResult.damage}, reason=${sickResult.reason}, health=${newHealth}`);

      // 发出生病事件（UI 层监听后显示气泡 + 通知）
      bus.emit(EVENTS.PET_SICK, {
        damage: sickResult.damage,
        reason: sickResult.reason,
        health: newHealth,
      });
    }
  }

  // ── 生病中自然恢复（非常缓慢）──────────────────────────
  // health< 80 且 hunger > 60 且 clean > 60 时，每小时恢复 0.5
  if (newHealth < 80 && newHunger > 60 && newClean > 60) {
    newHealth = clamp(newHealth + gapHours * 0.5);
  }

  const patch = {
    hunger:newHunger,
    mood:         newMood,
    health:       newHealth,
    clean:        newClean,
    lastOnlineAt: now,
  };

  logInfo('pet', `Decay applied: gap=${gapHours.toFixed(2)}h, hunger-=${(gapHours * rates.hunger).toFixed(1)}, health=${newHealth.toFixed(1)}`);

  await savePet(patch);
}

// ── 生病概率计算 ─────────────────────────────────────────────
function _checkSickness(hunger, mood, clean, gapHours) {
  // 需要持续一段时间才会触发（gapHours 越长概率越高）
  const timeFactor = Math.min(1, gapHours / 8); // 8小时达到最大概率

  let probability = 0;
  const reasons = [];

  if (hunger < 20) {
    probability += 0.30;
    reasons.push('饥饿');
  }
  if (clean < 20) {
    probability += 0.25;
    reasons.push('不卫生');
  }
  if (mood < 15) {
    probability += 0.15;
    reasons.push('心情极差');
  }

  // 多个条件叠加时概率更高（但不超过 0.7）
  probability = Math.min(0.7, probability);

  //乘以时间因子
  probability *= timeFactor;

  if (probability <= 0) return { sick: false };

  // 掷骰子
  const roll = Math.random();
  if (roll >= probability) return { sick: false };

  // 生病了！伤害 30~50 随机
  const damage = 30 + Math.floor(Math.random() * 21);
  const reason = reasons.join(' + ') || '未知原因';

  return { sick: true, damage, reason };
}

// ──旧的喂食函数（保留兼容，内部改为调用 feedWithFood）──────
export async function feedPet() {
  return feedWithFood('normal');
}

// ──玩耍 ─────────────────────────────────────────────────────
export async function playWithPet() {
  const pet = runtime.pet;
  const clamp = v => Math.min(100, v);
  await savePet({
    mood:clamp(pet.mood   + 20),
    hunger: Math.max(0, pet.hunger - 5),
    bond:   clamp(pet.bond   + 6),
  });
  logInfo('pet', 'Played with pet +20 mood +6 bond');
}

// ── 洗澡 ─────────────────────────────────────────────────────
export async function cleanPet() {
  const pet = runtime.pet;
  const clamp = v => Math.min(100, v);
  await savePet({
    clean: clamp(pet.clean + 30),
    mood:  clamp(pet.mood  + 5),
    bond:  clamp(pet.bond  + 3),
  });
  logInfo('pet', 'Cleaned pet +30 clean +3 bond');
}

// ── 治疗（保留兼容，改为调用营养剂）─────────────────────────
export async function healPet() {
  return feedWithFood('medicine');
}

// ── 获取宠物当前状态描述（注入 AI prompt）────────────────────
export function getPetStatusContext(pet, memoryContext = '') {
  const p = pet || runtime.pet;
  if (!p) return '';

  const isSick = (p.health ?? 100) < 80;

  const statusDesc = [
    `饱食度:${Math.round(p.hunger)}/100`,
    `心情:${Math.round(p.mood)}/100`,
    `健康:${Math.round(p.health)}/100${isSick ? '（生病中！）' : ''}`,
    `清洁:${Math.round(p.clean)}/100`,
    `亲密度:${Math.round(p.bond)}/100`,
  ].join('，');

  const moodDesc   = p.mood   > 70 ? '心情很好'   : p.mood   > 40 ? '心情一般' : '心情很差';
  const hungerDesc = p.hunger < 30 ? '非常饥饿'   : p.hunger < 60 ? '有点饿'   : '不饿';
  const sickDesc   = isSick ? '身体不舒服，需要主人照顾。' : '';

  const base = `【当前状态】${statusDesc}。${moodDesc}，${hungerDesc}。${sickDesc}`;

  // 注入记忆
  if (memoryContext) {
    return `${base}\n\n${memoryContext}`;
  }
  return base;
}


// ── 获取性格 prompt ──────────────────────────────────────────
export function getPersonalityPrompt(pet) {
  const p = pet || runtime.pet;
  if (!p) return '';
  if (p.customPrompt) return p.customPrompt;
  const preset = PERSONALITY_PRESETS[p.personality];
  return preset ? preset.prompt : PERSONALITY_PRESETS.genki.prompt;
}
// ── 查询近期日记摘要，用于记忆注入 ──────────────────────────
async function _getMemoryContext() {
  try {
    const { dbQuery } = await import('./db.js');

    // 宠物日记：最近3篇，有 summary 的
    const diaries = await dbQuery('sceneHistory',
      r => r.type === 'diary' && r.summary
    );
    const recentDiaries = diaries
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 3);

    if (!recentDiaries.length) return '';

    const lines = recentDiaries.map(r => {
      const d = new Date(r.createdAt);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      return `${dateStr} ${r.summary}`;
    });

    return `【近期记忆】\n${lines.join('\n')}`;
  } catch (_) {
    return '';
  }
}
// ── AI 对话（宠物回复）───────────────────────────────────────
export async function petChat({ userText, onChunk, signal }) {
  const pet = runtime.pet;
  if (!pet) throw new Error('宠物数据未加载');

  const personalityPrompt = getPersonalityPrompt(pet);
  const statusContext     = getPetStatusContext(pet);

  const rolePrompt = [
    `你是一只名叫「${pet.name}」的电子宠物。`,
    personalityPrompt,
    '回复要简短自然，不超过80字，可以用颜文字。',
  ].join('\n');

  const systemPrompt = await buildSystemPrompt({
    rolePrompt,
    statusContext,
    promptKeys: ['petExtra'],
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',content: userText },
  ];

  logInfo('pet', `petChat: "${userText.slice(0, 30)}..."`);

  const reply = await callAI({
    messages,
    stream:!!onChunk,
    onChunk,
    signal,
  });

  //聊天增加亲密度
  await savePet({ bond: Math.min(100, pet.bond + 2) });

  return reply;
}

// ── 随机情绪气泡 ─────────────────────────────────────────────
export async function triggerEmotionBubble() {
  const pet = runtime.pet;
  if (!pet) return;

  const statusContext     = getPetStatusContext(pet);
  const personalityPrompt = getPersonalityPrompt(pet);

  const rolePrompt = [
    `你是「${pet.name}」，用一句话（15字以内）表达当前心情，只输出这句话本身。`,
    personalityPrompt,
  ].join('\n');

  const systemPrompt = await buildSystemPrompt({
    rolePrompt,
    statusContext,
    promptKeys: ['petExtra', 'bubbleStyle'],
  });

  try {
    const text = await callAI({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: '现在心情怎么样？' },
      ],
      stream: false,
    });
    return text.trim();
  } catch (err) {
    logWarn('pet', `Emotion bubble failed: ${err.message}`);
    return null;
  }
}

// ── 获得经验值 ───────────────────────────────────────────────
export async function gainExp(amount) {
  const pet      = runtime.pet;
  const settings = runtime.settings || await dbGet('settings', 'singleton') || {};

  if (settings.neverGrow) {
    await savePet({ exp: (pet.exp || 0) + amount });
    return { leveledUp: false, oldLevel: pet.level, newLevel: pet.level };
  }

  const { getExpForLevel, getGrowthStage } = await import('./state.js');

  let exp   = (pet.exp   || 0) + amount;
  let level = pet.level  || 1;
  let leveledUp = false;

  while (true) {
    const needed = getExpForLevel(level);
    if (exp >= needed && level < 99) {
      exp -= needed;
      level++;
      leveledUp = true;} else {
      break;
    }
  }

  const stage = getGrowthStage(level);
  await savePet({ exp, level });

  if (leveledUp) {
    logInfo('pet', `Level up! ${pet.level} → ${level}, stage: ${stage.label}`);
  }

  return { leveledUp, oldLevel: pet.level, newLevel: level, stage };
}
// ── 暴露到 window（供内联脚本访问）─────────────────────────
// 已有的：
// window.FOOD_LIST = FOOD_LIST;
// window.canUseFood = canUseFood;
// ...

// 新增：暴露日记所需的辅助函数
window._petHelpers = {
  getPersonalityPrompt,
  getPetStatusContext,
};

