import { randomUUID } from 'node:crypto';
import express from 'express';

import { RANKING_LIMIT, SESSION_TTL_MS } from './config.js';
import { createCors } from './cors.js';
import { createRateLimiter } from './rate-limit.js';
import { validateName, validateScore } from './validation.js';

function fail(res, status, error, message) {
  res.status(status).json({ error, message });
}

/** async ハンドラの reject を express のエラーハンドラへ流す */
function wrap(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * @param {{store: object, config: object, now?: () => number, logger?: Console}} deps
 * @returns {import('express').Express}
 */
export function createApp({ store, config, now = Date.now, logger = console }) {
  const app = express();
  app.disable('x-powered-by');

  // ---- ランキングのインメモリキャッシュ（書き込み時に無効化） ----
  let rankingCache = null; // { at: number, entries: Array }

  const invalidateRankingCache = () => {
    rankingCache = null;
  };

  app.use(createCors({ allowedOrigins: config.allowedOrigins }));
  app.use(
    createRateLimiter({
      max: config.rateLimitMax,
      windowMs: config.rateLimitWindowMs,
      methods: ['POST'],
      now,
    }),
  );
  app.use(express.json({ limit: '4kb' }));

  // ---- Cloud Run ヘルスチェック ----
  app.get('/healthz', (req, res) => {
    res.status(200).json({ ok: true, store: store.kind });
  });

  // ---- POST /api/session ----
  app.post(
    '/api/session',
    wrap(async (req, res) => {
      const token = randomUUID();
      const startedAt = new Date(now());
      const expireAt = new Date(now() + SESSION_TTL_MS);
      await store.createSession({ token, startedAt, expireAt });
      res.status(201).json({ token });
    }),
  );

  // ---- POST /api/scores ----
  app.post(
    '/api/scores',
    wrap(async (req, res) => {
      const body = req.body;
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        return fail(res, 400, 'invalid_body', 'body must be a JSON object');
      }

      const { token } = body;
      if (typeof token !== 'string' || token.length === 0) {
        return fail(res, 400, 'token_required', 'token must be a non-empty string');
      }

      // 1. 発行済みトークンか（未知は401）
      const session = await store.getSession(token);
      if (!session) {
        return fail(res, 401, 'invalid_token', 'unknown or expired token');
      }

      // 2. 未使用か（使用済みは409）
      if (session.used) {
        return fail(res, 409, 'token_used', 'token has already been used');
      }

      // 3. name / score の形式（400）
      const name = validateName(body.name);
      if (!name.ok) {
        return fail(res, 400, 'invalid_name', name.message);
      }
      const score = validateScore(body.score);
      if (!score.ok) {
        return fail(res, 400, 'invalid_score', score.message);
      }

      // 4. 経過時間チェック（1問1秒以上かかるはず。速すぎるものは偽造とみなす）
      const elapsedMs = now() - session.startedAt.getTime();
      if (elapsedMs < score.value * 1000) {
        return fail(
          res,
          422,
          'implausible_score',
          `elapsed time ${elapsedMs}ms is too short for score ${score.value}`,
        );
      }

      // 5. トークンを消費（同時POSTの競合はここで409）
      const consumed = await store.consumeSession(token);
      if (consumed === 'not_found') {
        return fail(res, 401, 'invalid_token', 'unknown or expired token');
      }
      if (consumed === 'already_used') {
        return fail(res, 409, 'token_used', 'token has already been used');
      }

      const date = new Date(now());
      await store.addScore({ name: name.value, score: score.value, date, sessionId: token });
      invalidateRankingCache();

      const rank = (await store.countHigherScores(score.value)) + 1;
      res.status(201).json({ ok: true, rank });
    }),
  );

  // ---- GET /api/ranking ----
  app.get(
    '/api/ranking',
    wrap(async (req, res) => {
      const current = now();
      if (rankingCache && current - rankingCache.at < config.rankingCacheMs) {
        return res.status(200).json({ entries: rankingCache.entries });
      }

      const rows = await store.topScores(RANKING_LIMIT);
      const entries = rows.map((row) => ({
        name: row.name,
        score: row.score,
        date: row.date.toISOString(),
      }));
      rankingCache = { at: current, entries };
      res.status(200).json({ entries });
    }),
  );

  // ---- 404 ----
  app.use((req, res) => {
    fail(res, 404, 'not_found', `no route for ${req.method} ${req.path}`);
  });

  // ---- エラーハンドラ ----
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // express.json() の SyntaxError / サイズ超過
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return fail(res, 400, 'invalid_json', 'request body is not valid JSON');
    }
    if (err?.type === 'entity.too.large') {
      return fail(res, 413, 'payload_too_large', 'request body is too large');
    }
    logger.error('[ranking-api] unhandled error', err);
    if (res.headersSent) return next(err);
    return fail(res, 500, 'internal_error', 'internal server error');
  });

  return app;
}
