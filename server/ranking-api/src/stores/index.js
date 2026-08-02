import { createMemoryStore } from './memory-store.js';
import { createFirestoreStore } from './firestore-store.js';

/**
 * 設定に応じてストアを生成する。
 * LOCAL_DEV=1 → インメモリ / それ以外 → Firestore
 */
export async function createStore(config, { now = Date.now } = {}) {
  if (config.localDev) {
    return createMemoryStore({ now });
  }
  return createFirestoreStore({
    projectId: config.firestoreProjectId,
    databaseId: config.firestoreDatabaseId,
    now,
  });
}

export { createMemoryStore, createFirestoreStore };
