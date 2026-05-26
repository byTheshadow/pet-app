# pet-app

### ⚠️ 发现一个高优先级问题（建议尽快修）
`sw.js` 里 `indexedDB.open('PetDB', 1)`，但主项目 `db.js` 是 `DB_VERSION = 2`。

这会导致 Service Worker 可能看不到新版 store 或读写异常（尤其升级后）。  
建议改成一致版本，或更稳妥地不写死版本号。

---

# 启动包 V2

# PetOS 项目启动包 V2

## 1. 项目定位

PetOS 是一个纯前端电子宠物 Web App，核心是“养成 + AI对话 + 冒险成长 + 通知提醒”。

技术形态：

- 前端原生 JS（ES Module）
- Hash 路由单页结构
- IndexedDB 本地持久化
- 自定义事件总线（bus）
- Service Worker 后台通知检查
- 主题系统（pink / mono）

---

## 2. 关键目录

```txt
css/
  main.css
  pet.css
  ui.css

js/
  ai.js
  db.js
  logger.js
  pet.js
  router.js
  state.js
  sw-register.js
  ui.js
  vendor/html2canvas.min.js

index.html
sw.js
```

---

## 3. 状态与事件核心（state.js）

### 3.1 默认数据

#### `DEFAULT_PET`
- id: `singleton`
- name/avatar/personality/customPrompt
- hunger, mood, health, clean, bond
- level, exp
- lastOnlineAt, createdAt

#### `DEFAULT_SETTINGS`
- API: apiBase / apiKey / selectedModel / maxTokens
- prompt: globalPrompt
- 通知: notifyEnabled / notifyThresholds
- 家长模式: aiParentMode / aiParentInterval
- 信件系统: letterEnabled / letterInterval
- 衰减率: decayRates

#### `DEFAULT_AI_PARENT`
- 家长角色配置（name/personality/relation 等）

### 3.2 运行时状态 `runtime`
- pet
- settings
- aiParent
- currentPage
- isAIBusy

### 3.3 事件总线 `bus`
- `on/off/emit` 简单发布订阅

### 3.4 事件常量 `EVENTS`
- `PET_UPDATED`
- `SETTINGS_UPDATED`
- `PARENT_UPDATED`
- `PAGE_CHANGED`
- `TOAST`
- `MODAL_CONFIRM`
- `PET_SICK`

---

## 4. 业务系统定义（state.js）

### 4.1 性格预设 `PERSONALITY_PRESETS`
- tsundere / genki / lazy / kuudere / airhead / calm

### 4.2 成长阶段 `GROWTH_STAGES`
- baby(1-5) → primary(6-15) → middle(16-25) → high(26-40) → adult(41-99)
- 每阶段 `expPerLevel` 不同
- 函数：
  - `getGrowthStage(level)`
  - `getExpForLevel(level)`

### 4.3 冒险场景 `PRESET_SCENES`
每个场景包含：
- id/label/icon/desc
- stageReq（阶段限制）
- effects（对属性影响）
- expReward
- duration

### 4.4 彩蛋事件 `EASTER_EGGS`
每个彩蛋包含：
- prob 概率
- stageReq 阶段限制
- effects
- expReward
- 是否生成信件 `letter`

---

## 5. 数据层（db.js）

数据库：

- 名称：`PetDB`
- 版本：`2`

stores：
- settings
- pet
- aiParent
- petFriends
- chatHistory
- actionLog
- sceneHistory
- errorLog
- parentChatHistory

封装函数：
- `dbGet/dbSet/dbDelete`
- `dbList/dbQuery/dbCount`
- `dbClear/dbAppend`

---

## 6. 宠物核心逻辑（pet.js）

### 6.1 状态行为
- `loadPet/savePet`
- `applyDecay`（离线结算）
- 生病判定 `_checkSickness`
- `feed/play/clean/heal`
- `gainExp`

### 6.2 食物系统
- `FOOD_LIST`（normal/cake/soup/snack/medicine）
- 冷却存储：localStorage `petos-food-cd-*`
- `medicine` 仅健康<80可用

### 6.3 AI交互
- `petChat()`：构建 system prompt + 状态上下文 + 调用 `callAI`
- `triggerEmotionBubble()`：生成短情绪句

### 6.4 Prompt来源
- 全局 prompt（settings.globalPrompt）
- 性格 prompt（preset 或 customPrompt）
- 状态上下文（health/mood/hunger等）
- promptConfig 片段（按 key 注入）

---

## 7. AI 调用层（ai.js）

- API 端点：`{base}/v1/chat/completions`
- 模型来源：settings.selectedModel
- token来源：settings.maxTokens
- 支持流式响应解析（SSE data 行）
- `fetchModels()` 从 `/v1/models` 拉模型
- `buildSystemPrompt()` 拼接全局与角色上下文

---

## 8. UI 工具层（ui.js）

- Toast：`showToast`
- Modal：`showModal`（Promise）
- 打字点：`createTypingIndicator`
- 按钮loading：`setButtonLoading`
- 状态条：`updateStatusBar/updateAllStatusBars`
- 气泡：`showEmotionBubble`
- 时钟：`startClock`
- 自动监听 `EVENTS.TOAST`

---

## 9. 路由层（router.js）

页面集合：
- pet / friends / adventure / settings

逻辑：
- 监听 `hashchange`
- 切换 `.page-section.active`
- 更新 `.nav-item.active`
- 写入 `runtime.currentPage`
- 发射 `EVENTS.PAGE_CHANGED`

---

## 10. SW 与通知（sw-register.js + sw.js）

### 10.1 前台调度
`sw-register.js` 会：
- 注册 SW
- 定时发送 message 给 SW：
  - `CHECK_PET_STATUS`（首5秒，后每30分钟）
  - `CHECK_ADVENTURE`（首3秒，后每1分钟）

### 10.2 后台检查
`sw.js` 收到 message 后：
- `checkAndNotify()`：检查 pet 状态阈值，发状态通知
- `checkAdventureEnd()`：检查 activeAdventure.endAt，发冒险结束通知
- 通知点击时聚焦/打开页面

---

## 11. 高优先级风险（必须让下一位AI先看）

1. **SW DB版本不一致**
   - `db.js`: PetDB version 2
   - `sw.js`: open version 1
   - 建议统一（优先）

2. **大量主流程在 index.html 内联 module**
   - 继续重构前必须阅读主入口脚本，避免逻辑重复

3. **数据存储分散**
   - IndexedDB + localStorage 并存（食物CD/主题等）

4. **事件驱动依赖强**
   - 修改功能时要同步考虑 `bus.emit(EVENTS.*)` 链路

---

## 12. 新功能开发改动导航

- 宠物数值规则：`pet.js` + `state.js`
- 新页面：`index.html` + `router.js` + `ui.css`
- 新通知类型：`sw-register.js` + `sw.js`
- 新AI人格/提示词：`state.js` + `pet.js` + `ai.js`
- 冒险/成长：`state.js` +（主入口 adventure 逻辑）
- 持久化结构：`db.js` + 相关读写模块

---

## 13. 接手顺序（给下一位AI）

1. 读 `state.js`（全局规则）
2. 读 `index.html` 主入口模块脚本（真实流程）
3. 读 `pet.js`（核心业务）
4. 读 `sw.js` 与 `sw-register.js`（通知）
5. 再按需求定位模块改动

---

## 另外给你一条“马上可执行”的修复建议

### `sw.js` 建议改成：

```js
// const req = indexedDB.open('PetDB', 1);
const req = indexedDB.open('PetDB', 2);
```

或者更稳（避免未来再忘记改版本）：
- 在 `sw.js` 里只写 `indexedDB.open('PetDB')`（不传版本），通常可打开现有最新版本。
