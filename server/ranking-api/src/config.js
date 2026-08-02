/**
 * 設定・定数。docs/architecture.md「ランキングAPI契約」が正本。
 */

/** name の最大長（trim後） */
export const MAX_NAME_LENGTH = 11;
/** score の許容範囲（整数） */
export const MIN_SCORE = 1;
export const MAX_SCORE = 999;
/** GET /api/ranking で返す最大件数 */
export const RANKING_LIMIT = 30;
/** セッションの寿命（Firestore TTLポリシー用 expireAt の算出に使用） */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
/** 常に許可するオリジン */
export const DEFAULT_ALLOWED_ORIGIN = 'http://localhost:5173';

/** Firestore コレクション名 */
export const COLLECTIONS = {
  sessions: 'sessions',
  scores: 'scores',
};

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseOrigins(raw) {
  const origins = new Set([DEFAULT_ALLOWED_ORIGIN]);
  for (const part of String(raw ?? '').split(',')) {
    const trimmed = part.trim().replace(/\/+$/, '');
    if (trimmed) origins.add(trimmed);
  }
  return origins;
}

/**
 * 環境変数から設定を組み立てる。
 * @param {Record<string, string | undefined>} env
 */
export function loadConfig(env = process.env) {
  return {
    port: toInt(env.PORT, 8080),
    localDev: env.LOCAL_DEV === '1',
    allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    /** GET /api/ranking のインメモリキャッシュ有効期間 */
    rankingCacheMs: toInt(env.RANKING_CACHE_TTL_MS, 30_000),
    /** POST系のレート制限（同一IPあたり） */
    rateLimitMax: toInt(env.RATE_LIMIT_MAX, 10),
    rateLimitWindowMs: toInt(env.RATE_LIMIT_WINDOW_MS, 60_000),
    firestoreProjectId: env.GOOGLE_CLOUD_PROJECT || env.FIRESTORE_PROJECT_ID || undefined,
    firestoreDatabaseId: env.FIRESTORE_DATABASE_ID || undefined,
  };
}
