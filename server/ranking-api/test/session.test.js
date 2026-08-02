import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { SESSION_TTL_MS } from '../src/config.js';
import { startServer } from './helpers.js';

describe('POST /api/session と /healthz', () => {
  let api;
  before(async () => {
    api = await startServer();
  });
  after(async () => {
    await api.close();
  });

  it('GET /healthz は 200 を返す', async () => {
    const res = await api.request('/healthz');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.store, 'memory');
  });

  it('201 とトークンを返し、startedAt と used=false を保存する', async () => {
    const res = await api.request('/api/session', { method: 'POST' });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(typeof body.token, 'string');
    assert.match(
      body.token,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const session = await api.store.getSession(body.token);
    assert.equal(session.used, false);
    assert.equal(session.startedAt.getTime(), api.clock.now());
  });

  it('expireAt を発行から24時間後に設定する（Firestore TTLポリシー用）', async () => {
    const issuedAt = api.clock.now();
    const token = await api.newToken();
    const session = await api.store.getSession(token);
    assert.equal(session.expireAt.getTime(), issuedAt + SESSION_TTL_MS);
    assert.equal(SESSION_TTL_MS, 24 * 60 * 60 * 1000);
  });

  it('毎回異なるトークンを発行する', async () => {
    const tokens = new Set([await api.newToken(), await api.newToken(), await api.newToken()]);
    assert.equal(tokens.size, 3);
  });

  it('未定義のルートは 404 を返す', async () => {
    const res = await api.request('/api/nope');
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'not_found');
  });
});
