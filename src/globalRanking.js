import { CONFIG } from './config.js';
import { MAX_NAME_LENGTH } from './ranking.js';

export const API_TIMEOUT_MS = 5000;
export const MAX_GLOBAL_ENTRIES = 30;

/**
 * 全国ランキングAPIクライアント。
 * ネットワーク不通・タイムアウト・非2xx・不正レスポンスでも例外は投げず、
 * null（＝機能なし）を返してアプリ本体の動作を止めない。
 */

export function isGlobalRankingEnabled(config = CONFIG) {
  return getApiBase(config) !== '';
}

/** @returns {Promise<string|null>} セッショントークン */
export async function createSession(config = CONFIG, options = {}) {
  const body = await requestJson(config, '/api/session', { method: 'POST' }, options);
  const token = body?.token;

  return typeof token === 'string' && token !== '' ? token : null;
}

/** @returns {Promise<{ok: boolean, rank: number|null}|null>} */
export async function submitScore(config = CONFIG, entry = {}, options = {}) {
  const token = typeof entry.token === 'string' ? entry.token : '';
  const name = String(entry.name ?? '').trim().slice(0, MAX_NAME_LENGTH);
  const score = Number(entry.score);

  if (!token || !name || !Number.isInteger(score) || score <= 0) {
    return null;
  }

  const body = await requestJson(
    config,
    '/api/scores',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name, score }),
    },
    options,
  );

  if (!body || body.ok !== true) {
    return null;
  }

  return {
    ok: true,
    rank: Number.isInteger(body.rank) ? body.rank : null,
  };
}

/** @returns {Promise<Array<{name: string, score: number, date: string}>|null>} */
export async function fetchRanking(config = CONFIG, options = {}) {
  const body = await requestJson(config, '/api/ranking', { method: 'GET' }, options);

  if (!Array.isArray(body?.entries)) {
    return null;
  }

  return body.entries
    .map((entry) => ({
      name: String(entry?.name ?? '').trim().slice(0, MAX_NAME_LENGTH),
      score: Number(entry?.score),
      date: typeof entry?.date === 'string' ? entry.date : '',
    }))
    .filter((entry) => entry.name !== '' && Number.isFinite(entry.score))
    .slice(0, MAX_GLOBAL_ENTRIES);
}

function getApiBase(config) {
  const base = typeof config?.apiBaseUrl === 'string' ? config.apiBaseUrl.trim() : '';
  return base.replace(/\/+$/, '');
}

async function requestJson(config, path, init, options) {
  const base = getApiBase(config);
  if (!base) {
    return null;
  }

  const { fetchImpl = globalThis.fetch, timeoutMs = API_TIMEOUT_MS } = options;
  if (typeof fetchImpl !== 'function') {
    return null;
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timeoutId = null;

  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Timed out after ${timeoutMs}ms: ${path}`));
    }, timeoutMs);
    timeoutId?.unref?.();
  });

  try {
    const response = await Promise.race([
      fetchImpl(`${base}${path}`, controller ? { ...init, signal: controller.signal } : init),
      timeout,
    ]);

    if (!response?.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}
