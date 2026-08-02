import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { startServer } from './helpers.js';

const IP_A = { 'x-forwarded-for': '203.0.113.10, 130.211.0.1' };
const IP_B = { 'x-forwarded-for': '203.0.113.99' };

describe('レート制限（同一IP 10リクエスト/分, POST系のみ）', () => {
  let api;
  beforeEach(async () => {
    api = await startServer(); // 既定値を使う
  });
  afterEach(async () => {
    await api.close();
  });

  it('既定は 10req/60s', () => {
    assert.equal(api.config.rateLimitMax, 10);
    assert.equal(api.config.rateLimitWindowMs, 60_000);
  });

  it('11回目のPOSTは 429', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await api.request('/api/session', { method: 'POST', headers: IP_A });
      assert.equal(res.status, 201, `${i + 1}回目`);
    }
    const blocked = await api.request('/api/session', { method: 'POST', headers: IP_A });
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).error, 'rate_limited');
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  });

  it('X-Forwarded-For の先頭IP単位で数える（別IPは影響を受けない）', async () => {
    for (let i = 0; i < 10; i += 1) {
      await api.request('/api/session', { method: 'POST', headers: IP_A });
    }
    assert.equal((await api.request('/api/session', { method: 'POST', headers: IP_A })).status, 429);
    assert.equal((await api.request('/api/session', { method: 'POST', headers: IP_B })).status, 201);
  });

  it('ウィンドウ経過後は再び通る', async () => {
    for (let i = 0; i < 10; i += 1) {
      await api.request('/api/session', { method: 'POST', headers: IP_A });
    }
    assert.equal((await api.request('/api/session', { method: 'POST', headers: IP_A })).status, 429);

    api.clock.advance(61_000);
    assert.equal((await api.request('/api/session', { method: 'POST', headers: IP_A })).status, 201);
  });

  it('制限は POST /api/scores にもかかる', async () => {
    for (let i = 0; i < 10; i += 1) {
      await api.request('/api/session', { method: 'POST', headers: IP_A });
    }
    const res = await api.postJson(
      '/api/scores',
      { token: 'x', name: 'A', score: 1 },
      { headers: IP_A },
    );
    assert.equal(res.status, 429);
  });

  it('GET と OPTIONS は制限されない', async () => {
    for (let i = 0; i < 10; i += 1) {
      await api.request('/api/session', { method: 'POST', headers: IP_A });
    }
    assert.equal((await api.request('/healthz', { headers: IP_A })).status, 200);
    assert.equal((await api.request('/api/ranking', { headers: IP_A })).status, 200);
    const preflight = await api.request('/api/scores', {
      method: 'OPTIONS',
      headers: { ...IP_A, origin: 'http://localhost:5173' },
    });
    assert.equal(preflight.status, 204);
  });
});
