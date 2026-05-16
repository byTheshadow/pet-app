/* ============================================
   数据库模块
   使用 Dexie.js 封装 IndexedDB
   负责：所有持久化数据的读写
   ============================================ */

/* [DB-SCHEMA] */
const db = new Dexie('PetAppDB');

db.version(1).stores({
  // 宠物表
  pets: '++id, name, createdAt',

  // AI 家长表（单条记录，id 固定为 1）
  aiParent: '++id',

  // 聊天记录表
  chatHistory: '++id, petId, mode, createdAt',

  // 事件日志表（场景冒险、AI家长行动等）
  eventLogs: '++id, petId, type, createdAt',

  // 场景表
  scenes: '++id, name',

  // AI 好友宠物表（最多3条）
  friendPets: '++id, name, createdAt',

  // 通知表
  notifications: '++id, read, createdAt',

  // 全局配置表（单条记录，id 固定为 1）
  config: '++id'
});
/* [/DB-SCHEMA] */

/* ============================================
   数据库操作封装
   ============================================ */
/* [DB-OPS] */
const DB = {

  /* ---------- 宠物 ---------- */
  pet: {
    async get() {
      try {
        return await db.pets.toCollection().first();
      } catch (e) {
        Logger.error('DB.pet.get 失败', e.message);
        return null;
      }
    },

    async save(petData) {
      try {
        const existing = await db.pets.toCollection().first();
        if (existing) {
          await db.pets.update(existing.id, { ...petData, updatedAt: Date.now() });
          return existing.id;
        } else {
          return await db.pets.add({ ...petData, createdAt: Date.now(), updatedAt: Date.now() });
        }
      } catch (e) {
        Logger.error('DB.pet.save 失败', e.message);
        throw e;
      }
    },

    async delete() {
      try {
        await db.pets.clear();
      } catch (e) {
        Logger.error('DB.pet.delete 失败', e.message);
        throw e;
      }
    }
  },

  /* ---------- AI 家长 ---------- */
  aiParent: {
    async get() {
      try {
        return await db.aiParent.toCollection().first();
      } catch (e) {
        Logger.error('DB.aiParent.get 失败', e.message);
        return null;
      }
    },

    async save(data) {
      try {
        const existing = await db.aiParent.toCollection().first();
        if (existing) {
          await db.aiParent.update(existing.id, { ...data, updatedAt: Date.now() });
          return existing.id;
        } else {
          return await db.aiParent.add({ ...data, createdAt: Date.now(), updatedAt: Date.now() });
        }
      } catch (e) {
        Logger.error('DB.aiParent.save 失败', e.message);
        throw e;
      }
    },

    async delete() {
      try {
        await db.aiParent.clear();
      } catch (e) {
        Logger.error('DB.aiParent.delete 失败', e.message);
        throw e;
      }
    }
  },

  /* ---------- 聊天记录 ---------- */
  chat: {
    async getByPet(petId, mode = null, limit = 50) {
      try {
        let query = db.chatHistory.where('petId').equals(petId);
        const all = await query.toArray();
        const filtered = mode ? all.filter(m => m.mode === mode) : all;
        return filtered.slice(-limit);
      } catch (e) {
        Logger.error('DB.chat.getByPet 失败', e.message);
        return [];
      }
    },

    async add(record) {
      try {
        return await db.chatHistory.add({ ...record, createdAt: Date.now() });
      } catch (e) {
        Logger.error('DB.chat.add 失败', e.message);
        throw e;
      }
    },

    async deleteOne(id) {
      try {
        await db.chatHistory.delete(id);
      } catch (e) {
        Logger.error('DB.chat.deleteOne 失败', e.message);
        throw e;
      }
    },

    async clearByPet(petId) {
      try {
        await db.chatHistory.where('petId').equals(petId).delete();
      } catch (e) {
        Logger.error('DB.chat.clearByPet 失败', e.message);
        throw e;
      }
    },

    async clearAll() {
      try {
        await db.chatHistory.clear();
      } catch (e) {
        Logger.error('DB.chat.clearAll 失败', e.message);
        throw e;
      }
    }
  },

  /* ---------- 事件日志 ---------- */
  eventLog: {
    async getByPet(petId, limit = 30) {
      try {
        const all = await db.eventLogs.where('petId').equals(petId).toArray();
        return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
      } catch (e) {
        Logger.error('DB.eventLog.getByPet 失败', e.message);
        return [];
      }
    },

    async add(record) {
      try {
        return await db.eventLogs.add({ ...record, createdAt: Date.now() });
      } catch (e) {
        Logger.error('DB.eventLog.add 失败', e.message);
        throw e;
      }
    },

    async deleteOne(id) {
      try {
        await db.eventLogs.delete(id);
      } catch (e) {
        Logger.error('DB.eventLog.deleteOne 失败', e.message);
        throw e;
      }
    },

    async clearByPet(petId) {
      try {
        await db.eventLogs.where('petId').equals(petId).delete();
      } catch (e) {
        Logger.error('DB.eventLog.clearByPet 失败', e.message);
        throw e;
      }
    }
  },

  /* ---------- 场景 ---------- */
  scene: {
    async getAll() {
      try {
        return await db.scenes.toArray();
      } catch (e) {
        Logger.error('DB.scene.getAll 失败', e.message);
        return [];
      }
    },

    async save(sceneData) {
      try {
        if (sceneData.id) {
          await db.scenes.update(sceneData.id, sceneData);
          return sceneData.id;
        } else {
          return await db.scenes.add(sceneData);
        }
      } catch (e) {
        Logger.error('DB.scene.save 失败', e.message);
        throw e;
      }
    },

    async deleteOne(id) {
      try {
        await db.scenes.delete(id);
      } catch (e) {
        Logger.error('DB.scene.deleteOne 失败', e.message);
        throw e;
      }
    },

    async clearAll() {
      try {
        await db.scenes.clear();
      } catch (e) {
        Logger.error('DB.scene.clearAll 失败', e.message);
        throw e;
      }
    }
  },

  /* ---------- AI 好友宠物 ---------- */
  friend: {
    async getAll() {
      try {
        return await db.friendPets.toArray();
      } catch (e) {
        Logger.error('DB.friend.getAll 失败', e.message);
        return [];
      }
    },

    async save(data) {
      try {
        if (data.id) {
          await db.friendPets.update(data.id, { ...data, updatedAt: Date.now() });
          return data.id;
        } else {
          return await db.friendPets.add({ ...data, createdAt: Date.now(), updatedAt: Date.now() });
        }
      } catch (e) {
        Logger.error('DB.friend.save 失败', e.message);
        throw e;
      }
    },

    async deleteOne(id) {
      try {
        await db.friendPets.delete(id);
      } catch (e) {
        Logger.error('DB.friend.deleteOne 失败', e.message);
        throw e;
      }
    },

    async clearAll() {
      try {
        await db.friendPets.clear();
      } catch (e) {
        Logger.error('DB.friend.clearAll 失败', e.message);
        throw e;
      }
    }
  },

  /* ---------- 通知 ---------- */
  notification: {
    async getAll() {
      try {
        const all = await db.notifications.toArray();
        return all.sort((a, b) => b.createdAt - a.createdAt);
      } catch (e) {
        Logger.error('DB.notification.getAll 失败', e.message);
        return [];
      }
    },

    async add(data) {
      try {
        return await db.notifications.add({ ...data, read: false, createdAt: Date.now() });
      } catch (e) {
        Logger.error('DB.notification.add 失败', e.message);
        throw e;
      }
    },

    async markRead(id) {
      try {
        await db.notifications.update(id, { read: true });
      } catch (e) {
        Logger.error('DB.notification.markRead 失败', e.message);
      }
    },

    async markAllRead() {
      try {
        const all = await db.notifications.toArray();
        await Promise.all(all.map(n => db.notifications.update(n.id, { read: true })));
      } catch (e) {
        Logger.error('DB.notification.markAllRead 失败', e.message);
      }
    },

    async deleteOne(id) {
      try {
        await db.notifications.delete(id);
      } catch (e) {
        Logger.error('DB.notification.deleteOne 失败', e.message);
        throw e;
      }
    },

    async clearAll() {
      try {
        await db.notifications.clear();
      } catch (e) {
        Logger.error('DB.notification.clearAll 失败', e.message);
        throw e;
      }
    },

    async getUnreadCount() {
      try {
        const all = await db.notifications.toArray();
        return all.filter(n => !n.read).length;
      } catch (e) {
        return 0;
      }
    }
  },

  /* ---------- 全局配置 ---------- */
  config: {
    async get() {
      try {
        return await db.config.toCollection().first();
      } catch (e) {
        Logger.error('DB.config.get 失败', e.message);
        return null;
      }
    },

    async save(data) {
      try {
        const existing = await db.config.toCollection().first();
        if (existing) {
          await db.config.update(existing.id, { ...data, updatedAt: Date.now() });
          return existing.id;
        } else {
          return await db.config.add({ ...data, createdAt: Date.now(), updatedAt: Date.now() });
        }
      } catch (e) {
        Logger.error('DB.config.save 失败', e.message);
        throw e;
      }
    }
  },

  /* ---------- 全库操作 ---------- */
  global: {
    // 导出所有数据为 JSON
    async exportAll() {
      try {
        const [pet, aiParent, chatHistory, eventLogs, scenes, friendPets, notifications, config] =
          await Promise.all([
            db.pets.toArray(),
            db.aiParent.toArray(),
            db.chatHistory.toArray(),
            db.eventLogs.toArray(),
            db.scenes.toArray(),
            db.friendPets.toArray(),
            db.notifications.toArray(),
            db.config.toArray()
          ]);
        return {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          pet, aiParent, chatHistory, eventLogs,
          scenes, friendPets, notifications, config
        };
      } catch (e) {
        Logger.error('DB.global.exportAll 失败', e.message);
        throw e;
      }
    },

    // 从 JSON 导入数据（覆盖模式）
    async importAll(data) {
      try {
        await db.transaction('rw',
          db.pets, db.aiParent, db.chatHistory, db.eventLogs,
          db.scenes, db.friendPets, db.notifications, db.config,
          async () => {
            await db.pets.clear();
            await db.aiParent.clear();
            await db.chatHistory.clear();
            await db.eventLogs.clear();
            await db.scenes.clear();
            await db.friendPets.clear();
            await db.notifications.clear();
            await db.config.clear();

            if (data.pet?.length)           await db.pets.bulkAdd(data.pet);
            if (data.aiParent?.length)       await db.aiParent.bulkAdd(data.aiParent);
            if (data.chatHistory?.length)    await db.chatHistory.bulkAdd(data.chatHistory);
            if (data.eventLogs?.length)      await db.eventLogs.bulkAdd(data.eventLogs);
            if (data.scenes?.length)         await db.scenes.bulkAdd(data.scenes);
            if (data.friendPets?.length)     await db.friendPets.bulkAdd(data.friendPets);
            if (data.notifications?.length)  await db.notifications.bulkAdd(data.notifications);
            if (data.config?.length)         await db.config.bulkAdd(data.config);
          }
        );
      } catch (e) {
        Logger.error('DB.global.importAll 失败', e.message);
        throw e;
      }
    },

    // 清空所有数据
    async clearAll() {
      try {
        await db.transaction('rw',
          db.pets, db.aiParent, db.chatHistory, db.eventLogs,
          db.scenes, db.friendPets, db.notifications, db.config,
          async () => {
            await Promise.all([
              db.pets.clear(),
              db.aiParent.clear(),
              db.chatHistory.clear(),
              db.eventLogs.clear(),
              db.scenes.clear(),
              db.friendPets.clear(),
              db.notifications.clear(),
              db.config.clear()
            ]);
          }
        );
      } catch (e) {
        Logger.error('DB.global.clearAll 失败', e.message);
        throw e;
      }
    }
  }
};
/* [/DB-OPS] */
