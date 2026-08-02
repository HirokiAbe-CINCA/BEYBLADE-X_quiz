import { compareScoreEntries } from './compare.js';

/**
 * LOCAL_DEV=1 用のインメモリストア。FirestoreStore と同一インターフェース。
 * プロセス再起動で消える。ローカルe2e／テスト専用。
 */
export function createMemoryStore({ now = Date.now } = {}) {
  /** @type {Map<string, {token: string, startedAt: Date, expireAt: Date, used: boolean}>} */
  const sessions = new Map();
  /** @type {Array<{name: string, score: number, date: Date, sessionId: string}>} */
  const scores = [];

  return {
    kind: 'memory',

    async createSession({ token, startedAt, expireAt }) {
      sessions.set(token, { token, startedAt, expireAt, used: false });
    },

    async getSession(token) {
      const session = sessions.get(token);
      if (!session) return null;
      // TTL相当（Firestore側は TTL ポリシーが消す）
      if (session.expireAt.getTime() <= now()) {
        sessions.delete(token);
        return null;
      }
      return { ...session };
    },

    /** used=false のときだけ used=true にする。戻り値: 'ok' | 'not_found' | 'already_used' */
    async consumeSession(token) {
      const session = sessions.get(token);
      if (!session) return 'not_found';
      if (session.used) return 'already_used';
      session.used = true;
      return 'ok';
    },

    async addScore(entry) {
      scores.push({ ...entry });
    },

    /** 自分より高いスコアの件数（順位 = これ + 1） */
    async countHigherScores(score) {
      return scores.reduce((count, entry) => (entry.score > score ? count + 1 : count), 0);
    },

    /** score降順 → date昇順 で上位 limit 件 */
    async topScores(limit) {
      return [...scores].sort(compareScoreEntries).slice(0, limit);
    },

    async close() {},
  };
}
