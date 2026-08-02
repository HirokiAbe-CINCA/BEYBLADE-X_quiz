/**
 * HTTPアクセス。すべてのリクエストで:
 * - User-Agent を明記
 * - リクエスト間隔を最低 REQUEST_INTERVAL_MS（既定1000ms）あける（グローバル直列化）
 */
export const USER_AGENT = 'beyblade-x-quiz-bot/1.0 (personal fan project)';

const intervalMs = Math.max(1000, Number(process.env.REQUEST_INTERVAL_MS) || 1000);
const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS) || 15000;

let lastRequestAt = 0;
let queue = Promise.resolve();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 全リクエストを直列化し、間隔を保証する */
function throttled(fn) {
  const run = queue.then(async () => {
    const wait = lastRequestAt + intervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastRequestAt = Date.now();
    }
  });
  // 失敗しても後続リクエストは続行できるようにする
  queue = run.catch(() => {});
  return run;
}

/** ページ本文を取得する。非2xxは例外。 */
export function fetchText(url) {
  return throttled(async () => {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new Error(`GET ${url} failed: HTTP ${res.status}`);
    }
    return res.text();
  });
}

/**
 * HEADリクエストで画像の死活を確認する。
 * 200 かつ Content-Type が image/* のときのみ true。
 * HEAD が 405 等で拒否された場合のみ GET（Range付き）でフォールバック。
 */
export function headImageOk(url) {
  return throttled(async () => {
    const head = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    }).catch(() => null);

    if (head && head.status === 200) {
      return (head.headers.get('content-type') ?? '').startsWith('image/');
    }
    if (head && head.status !== 405 && head.status !== 501) return false;

    const get = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-0' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    }).catch(() => null);
    if (!get) return false;
    try {
      if (get.status !== 200 && get.status !== 206) return false;
      return (get.headers.get('content-type') ?? '').startsWith('image/');
    } finally {
      await get.body?.cancel?.().catch(() => {});
    }
  });
}
