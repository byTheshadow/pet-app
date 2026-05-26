// js/db.js
// IndexedDB 轻量封装
// 支持 8 张表：settings / pet / aiParent / petFriends /
//              chatHistory / actionLog / sceneHistory / errorLog

const DB_NAME = 'PetDB';
const DB_VERSION = 3;

const STORES = {
  settings:    { keyPath: 'id' },
  pet:         { keyPath: 'id' },
  aiParent:    { keyPath: 'id' },
  petFriends:  { keyPath: 'id', autoIncrement: true },
  chatHistory: { keyPath: 'id', autoIncrement: true },
  actionLog:   { keyPath: 'id', autoIncrement: true },
  sceneHistory:{ keyPath: 'id', autoIncrement: true },
  errorLog:    { keyPath: 'id', autoIncrement: true },
  parentChatHistory: { keyPath: 'id', autoIncrement: true }, 
  visitHistory: { keyPath: 'id', autoIncrement: true },
};

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, opts] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const storeOpts = {};
          if (opts.keyPath)       storeOpts.keyPath       = opts.keyPath;
          if (opts.autoIncrement) storeOpts.autoIncrement = true;
          db.createObjectStore(name, storeOpts);
        }
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = (e) => {
      reject(new Error('IndexedDB open failed: ' + e.target.error));
    };
  });
}

// ── 单条 get（key-value 表用 id='singleton'）──────────────────
export async function dbGet(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

// ── 单条 set（upsert）────────────────────────────────────────
export async function dbSet(store, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── 删除单条 ─────────────────────────────────────────────────
export async function dbDelete(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── 列出全部（倒序，最新在前）────────────────────────────────
export async function dbList(store, { limit = 500, reverse = true } = {}) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(store, 'readonly');
    const objStore = tx.objectStore(store);
    const results = [];

    const direction = reverse ? 'prev' : 'next';
    const req = objStore.openCursor(null, direction);

    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// ── 清空整张表 ───────────────────────────────────────────────
export async function dbClear(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── 按条件查询（简单 filter）────────────────────────────────
export async function dbQuery(store, filterFn, { limit = 200 } = {}) {
  const all = await dbList(store, { limit: 9999, reverse: true });
  const filtered = all.filter(filterFn);
  return filtered.slice(0, limit);
}

// ── 统计条数 ─────────────────────────────────────────────────
export async function dbCount(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── 便捷：追加一条日志类记录 ─────────────────────────────────
export async function dbAppend(store, record) {
  const entry = { ...record, createdAt: Date.now() };
  return dbSet(store, entry);
}
