import { COLLECTIONS } from '../config.js';

/**
 * Firestore ストア。memory-store.js と同一インターフェース。
 *
 * ドキュメント構造:
 *   sessions/{token} = { startedAt: Timestamp, used: boolean, expireAt: Timestamp, usedAt?: Timestamp }
 *   scores/{autoId}  = { name: string, score: number, date: Timestamp, sessionId: string }
 *
 * expireAt は Firestore の TTL ポリシー用フィールド（ポリシー自体はインフラ側で設定）。
 */
export async function createFirestoreStore({ projectId, databaseId, now = Date.now } = {}) {
  // ローカル(LOCAL_DEV=1)では読み込まれないよう遅延import
  const { Firestore, Timestamp } = await import('@google-cloud/firestore');

  const db = new Firestore({
    projectId,
    databaseId,
    ignoreUndefinedProperties: true,
  });
  const sessions = db.collection(COLLECTIONS.sessions);
  const scores = db.collection(COLLECTIONS.scores);

  const toDate = (value) => (value?.toDate ? value.toDate() : new Date(value));

  return {
    kind: 'firestore',

    async createSession({ token, startedAt, expireAt }) {
      await sessions.doc(token).create({
        startedAt: Timestamp.fromDate(startedAt),
        expireAt: Timestamp.fromDate(expireAt),
        used: false,
      });
    },

    async getSession(token) {
      const snap = await sessions.doc(token).get();
      if (!snap.exists) return null;
      const data = snap.data();
      const expireAt = toDate(data.expireAt);
      // TTLポリシーの削除は最大24時間遅れることがあるので自前でも判定する
      if (expireAt.getTime() <= now()) return null;
      return {
        token,
        startedAt: toDate(data.startedAt),
        expireAt,
        used: data.used === true,
      };
    },

    /** トランザクションで used=false → true。戻り値: 'ok' | 'not_found' | 'already_used' */
    async consumeSession(token) {
      const ref = sessions.doc(token);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return 'not_found';
        if (snap.get('used') === true) return 'already_used';
        tx.update(ref, { used: true, usedAt: Timestamp.now() });
        return 'ok';
      });
    },

    async addScore({ name, score, date, sessionId }) {
      await scores.add({
        name,
        score,
        date: Timestamp.fromDate(date),
        sessionId,
      });
    },

    async countHigherScores(score) {
      // 集計クエリ（単一フィールドの自動インデックスで動く）
      const snap = await scores.where('score', '>', score).count().get();
      return snap.data().count;
    },

    async topScores(limit) {
      // 複合インデックス (score DESC, date ASC) が必要
      const snap = await scores
        .orderBy('score', 'desc')
        .orderBy('date', 'asc')
        .limit(limit)
        .get();
      return snap.docs.map((doc) => {
        const data = doc.data();
        return {
          name: data.name,
          score: data.score,
          date: toDate(data.date),
          sessionId: data.sessionId,
        };
      });
    },

    async close() {
      await db.terminate();
    },
  };
}
