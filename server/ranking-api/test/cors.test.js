import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { startServer } from './helpers.js';

const LOCAL = 'http://localhost:5173';
const PROD = 'https://beyblade-quiz.example.com';
const OTHER = 'https://second.example.com';
const EVIL = 'https://evil.example.com';

describe('CORS', () => {
  let api;
  before(async () => {
    api = await startServer({
      ALLOWED_ORIGINS: `${PROD}, ${OTHER}/ `,
      RATE_LIMIT_MAX: '1000',
    });
  });
  after(async () => {
    await api.close();
  });

  it('http://localhost:5173 は ALLOWED_ORIGINS 未指定でも常に許可される', async () => {
    const bare = await startServer();
    try {
      const res = await bare.request('/api/ranking', { headers: { origin: LOCAL } });
      assert.equal(res.headers.get('access-control-allow-origin'), LOCAL);
    } finally {
      await bare.close();
    }
  });

  it('ALLOWED_ORIGINS のオリジンを許可する（末尾スラッシュは無視）', async () => {
    for (const origin of [PROD, OTHER]) {
      const res = await api.request('/api/ranking', { headers: { origin } });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('access-control-allow-origin'), origin);
    }
  });

  it('許可外オリジンには Access-Control-Allow-Origin を付けない', async () => {
    const res = await api.request('/api/ranking', { headers: { origin: EVIL } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  it('常に Vary: Origin を付ける', async () => {
    const res = await api.request('/api/ranking');
    assert.match(res.headers.get('vary') ?? '', /Origin/i);
  });

  it('プリフライトは 204 でメソッドとヘッダを返す', async () => {
    const res = await api.request('/api/scores', {
      method: 'OPTIONS',
      headers: {
        origin: PROD,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), PROD);
    assert.match(res.headers.get('access-control-allow-methods'), /POST/);
    assert.match(res.headers.get('access-control-allow-headers'), /content-type/i);
    assert.ok(Number(res.headers.get('access-control-max-age')) > 0);
  });

  it('プリフライト（許可外オリジン）は ACAO 無しで返す', async () => {
    const res = await api.request('/api/scores', {
      method: 'OPTIONS',
      headers: { origin: EVIL, 'access-control-request-method': 'POST' },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  it('実リクエスト（POST）にも CORS ヘッダが付く', async () => {
    const token = await api.newToken();
    api.clock.advance(5000);
    const res = await api.postJson(
      '/api/scores',
      { token, name: 'コルス', score: 5 },
      { headers: { origin: PROD } },
    );
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('access-control-allow-origin'), PROD);
  });

  it('エラー応答にも CORS ヘッダが付く', async () => {
    const res = await api.postJson(
      '/api/scores',
      { token: 'unknown-token', name: 'A', score: 5 },
      { headers: { origin: PROD } },
    );
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('access-control-allow-origin'), PROD);
  });
});
