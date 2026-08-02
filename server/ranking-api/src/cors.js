/**
 * 許可オリジンのみ反映するCORSミドルウェア。プリフライト(OPTIONS)は204で即返す。
 * 資格情報(Cookie)は使わないので Access-Control-Allow-Credentials は付けない。
 */
export function createCors({ allowedOrigins }) {
  return function cors(req, res, next) {
    // Origin ごとに応答が変わるのでキャッシュ汚染を防ぐ
    res.setHeader('Vary', 'Origin');

    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin.replace(/\/+$/, ''))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '3600');
      res.status(204).end();
      return;
    }

    next();
  };
}
