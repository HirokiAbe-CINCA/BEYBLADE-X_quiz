/**
 * インスタンスローカルなレート制限（固定ウィンドウではなくスライディングウィンドウ）。
 * Cloud Run は複数インスタンスに分散しうるので厳密な上限ではなく「雑な連打よけ」。
 */

const SWEEP_THRESHOLD = 5_000;

/**
 * クライアントIPを取得する。
 * Cloud Run(GFE)はクライアント送信のX-Forwarded-Forの「末尾に」実クライアントIPを
 * 追記するため、末尾要素を採用する。先頭はクライアントが自由に偽装できる。
 * ローカル/直アクセス時は socket のアドレスにフォールバックする。
 */
export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

/**
 * @param {{max: number, windowMs: number, methods?: string[], now?: () => number}} options
 */
export function createRateLimiter({ max, windowMs, methods = ['POST'], now = Date.now }) {
  /** @type {Map<string, number[]>} ip -> リクエスト時刻(ms) */
  const hits = new Map();
  const targeted = new Set(methods.map((m) => m.toUpperCase()));

  function sweep(cutoff) {
    for (const [ip, times] of hits) {
      const kept = times.filter((t) => t > cutoff);
      if (kept.length === 0) hits.delete(ip);
      else hits.set(ip, kept);
    }
  }

  return function rateLimit(req, res, next) {
    if (!targeted.has(req.method)) {
      next();
      return;
    }

    const current = now();
    const cutoff = current - windowMs;
    if (hits.size > SWEEP_THRESHOLD) sweep(cutoff);

    const ip = clientIp(req);
    const times = (hits.get(ip) ?? []).filter((t) => t > cutoff);

    if (times.length >= max) {
      hits.set(ip, times);
      const retryAfterMs = Math.max(0, times[0] + windowMs - current);
      res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      res.status(429).json({
        error: 'rate_limited',
        message: `too many requests: max ${max} per ${Math.round(windowMs / 1000)}s`,
      });
      return;
    }

    times.push(current);
    hits.set(ip, times);
    next();
  };
}
