// js/pet.js
// 宠物状态逻辑：衰减、喂食、互动、进化、AI 对话

import { dbGet, dbSet } from './db.js';
import { DEFAULT_PET, DEFAULT_SETTINGS, PERSONALITY_PRESETS, runtime, bus, EVENTS } from './state.js';
import { callAI, buildSystemPrompt } from './ai.js';
import { logInfo, logError, logWarn } from './logger.js';
import { showToast } from './ui.js';

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

// ── 离线衰减结算 ─────────────────────────────────────────────
export async function applyDecay() {
  const pet      = runtime.pet;
  const settings = runtime.settings || await dbGet('settings', 'singleton') || DEFAULT_SETTINGS;
  const rates    = settings.decayRates || DEFAULT_SETTINGS.decayRates;

  const now      = Date.now();
  const lastAt   = pet.lastOnlineAt || now;
  const gapHours = Math.max(0, (now - lastAt) / 3600000);

  if (gapHours < 0.01) return; // 不足 36 秒，跳过

  const clamp = v => Math.max(0, Math.min(100, v));

  const patch = {
    hunger:       clamp(pet.hunger  - gapHours * rates.hunger),
    mood:         clamp(pet.mood    - gapHours * rates.mood),
    health:       clamp(pet.health  - gapHours * rates.health),
    clean:        clamp(pet.clean   - gapHours * rates.clean),
    lastOnlineAt: now,
  };

  logInfo('pet', `Decay applied: gap=${gapHours.toFixed(2)}h, hunger-=${(gapHours * rates.hunger).toFixed(1)}`);

  await savePet(patch);
}

// ── 喂食 ─────────────────────────────────────────────────────
export async function feedPet() {
  const pet = runtime.pet;
  const clamp = v => Math.min(100, v);
  await savePet({
    hunger: clamp(pet.hunger + 25),
    mood:   clamp(pet.mood   + 5),
  });
  logInfo('pet', 'Fed pet +25 hunger');
}

// ── 玩耍 ─────────────────────────────────────────────────────
export async function playWithPet() {
  const pet = runtime.pet;
  const clamp = v => Math.min(100, v);
  await savePet({
    mood:   clamp(pet.mood   + 20),
    hunger: Math.max(0, pet.hunger - 5),
    bond:   clamp(pet.bond   + 3),
  });
  logInfo('pet', 'Played with pet +20 mood');
}

// ── 洗澡 ─────────────────────────────────────────────────────
export async function cleanPet() {
  const pet = runtime.pet;
  await savePet({
    clean: Math.min(100, pet.clean + 30),
    mood:  Math.min(100, pet.mood  + 5),
  });
  logInfo('pet', 'Cleaned pet +30 clean');
}

// ── 治疗 ─────────────────────────────────────────────────────
export async function healPet() {
  const pet = runtime.pet;
  await savePet({
    health: Math.min(100, pet.health + 20),
  });
  logInfo('pet', 'Healed pet +20 health');
}

// ── 获取宠物当前状态描述（注入 AI prompt）────────────────────
export function getPetStatusContext(pet) {
  const p = pet || runtime.pet;
  if (!p) return '';
  const statusDesc = [
    `饱食度:${Math.round(p.hunger)}/100`,
    `心情:${Math.round(p.mood)}/100`,
    `健康:${Math.round(p.health)}/100`,
    `清洁:${Math.round(p.clean)}/100`,
    `亲密度:${Math.round(p.bond)}/100`,
  ].join('，');

  const moodDesc   = p.mood   > 70 ? '心情很好'   : p.mood   > 40 ? '心情一般' : '心情很差';
  const hungerDesc = p.hunger < 30 ? '非常饥饿'   : p.hunger < 60 ? '有点饿'   : '不饿';

  return `【当前状态】${statusDesc}。${moodDesc}，${hungerDesc}。`;
}

// ── 获取性格 prompt ──────────────────────────────────────────
export function getPersonalityPrompt(pet) {
  const p = pet || runtime.pet;
  if (!p) return '';
  if (p.customPrompt) return p.customPrompt;
  const preset = PERSONALITY_PRESETS[p.personality];
  return preset ? preset.prompt : PERSONALITY_PRESETS.genki.prompt;
}

// ── AI 对话（宠物回复）───────────────────────────────────────
// promptKeys 注入：petExtra（宠物角色补充）
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

  // 注入 petExtra（宠物角色补充），statusContext 由 buildSystemPrompt 末尾追加
  const systemPrompt = await buildSystemPrompt({
    rolePrompt,
    statusContext,
    promptKeys: ['petExtra'],
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userText },
  ];

  logInfo('pet', `petChat: "${userText.slice(0, 30)}..."`);

  const reply = await callAI({
    messages,
    stream:  !!onChunk,
    onChunk,
    signal,
  });

  // 对话增加亲密度
  await savePet({ bond: Math.min(100, pet.bond + 1) });

  return reply;
}

// ── 随机情绪气泡 ─────────────────────────────────────────────
// promptKeys 注入：petExtra（宠物角色补充）+ bubbleStyle（气泡语气风格）
export async function triggerEmotionBubble() {
  const pet = runtime.pet;
  if (!pet) return;

  const statusContext     = getPetStatusContext(pet);
  const personalityPrompt = getPersonalityPrompt(pet);

  const rolePrompt = [
    `你是「${pet.name}」，用一句话（15字以内）表达当前心情，只输出这句话本身。`,
    personalityPrompt,
  ].join('\n');

  // 注入 petExtra + bubbleStyle，让气泡语气也受提示词控制中心控制
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
// ── 获得经验值（冒险结算后调用）────────────────────────────
// returns: { leveledUp: bool, oldLevel, newLevel, stage }
export async function gainExp(amount) {
  const pet      = runtime.pet;
  const settings = runtime.settings || await dbGet('settings', 'singleton') || {};

  // 永不成长模式：只记录经验，不升级
  if (settings.neverGrow) {
    await savePet({ exp: (pet.exp || 0) + amount });
    return { leveledUp: false, oldLevel: pet.level, newLevel: pet.level };
  }

  const { getExpForLevel, getGrowthStage } = await import('./state.js');

  let exp   = (pet.exp   || 0) + amount;
  let level = pet.level  || 1;
  let leveledUp = false;

  // 连续升级（一次冒险可能跨多级）
  while (true) {
    const needed = getExpForLevel(level);
    if (exp >= needed && level < 99) {
      exp -= needed;
      level++;
      leveledUp = true;
    } else {
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

