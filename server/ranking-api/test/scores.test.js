import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { SESSION_TTL_MS } from '../src/config.js';
import { startServer } from './helpers.js';

describe('POST /api/scores', () => {
  let api;
  beforeEach(async () => {
    // 検証ルールのテストなのでレート制限は緩めておく（429は専用テストで検証）
    api = await startServer({ RATE_LIMIT_MAX: '1000' });
  });
  afterEach(async () => {
    await api.close();
  });

  describe('正常系', () => {
    it('セッション発行 → スコア送信 → ランキング反映', async () => {
      const { res } = await api.playAndSubmit('アベ', 12);
      assert.equal(res.status, 201);
      assert.deepEqual(await res.json(), { ok: true, rank: 1 });

      const ranking = await (await api.request('/api/ranking')).json();
      assert.equal(ranking.entries.length, 1);
      assert.equal(ranking.entries[0].name, 'アベ');
      assert.equal(ranking.entries[0].score, 12);
      assert.equal(typeof ranking.entries[0].date, 'string');
      assert.ok(!Number.isNaN(Date.parse(ranking.entries[0].date)));
    });

    it('rank は「自分より高スコアの件数 + 1」', async () => {
      const first = await api.playAndSubmit('A', 10);
      assert.equal((await first.res.json()).rank, 1);

      const second = await api.playAndSubmit('B', 30);
      assert.equal((await second.res.json()).rank, 1);

      const third = await api.playAndSubmit('C', 20);
      assert.equal((await third.res.json()).rank, 2);

      const fourth = await api.playAndSubmit('D', 5);
      assert.equal((await fourth.res.json()).rank, 4);
    });

    it('同点は同じ rank になる', async () => {
      await api.playAndSubmit('A', 50);
      const b = await api.playAndSubmit('B', 20);
      const c = await api.playAndSubmit('C', 20);
      assert.equal((await b.res.json()).rank, 2);
      assert.equal((await c.res.json()).rank, 2);
    });

    it('name は trim して保存される', async () => {
      const token = await api.newToken();
      api.clock.advance(3000);
      const res = await api.postJson('/api/scores', { token, name: '  ゼロ  ', score: 3 });
      assert.equal(res.status, 201);
      const ranking = await (await api.request('/api/ranking')).json();
      assert.equal(ranking.entries[0].name, 'ゼロ');
    });

    it('境界値: name 11文字 / score 1 / score 999 を受け付ける', async () => {
      const a = await api.playAndSubmit('あいうえおかきくけこさ', 1);
      assert.equal(a.res.status, 201);
      const b = await api.playAndSubmit('B', 999);
      assert.equal(b.res.status, 201);
    });

    it('経過時間がちょうど score×1000ms なら通る', async () => {
      const token = await api.newToken();
      api.clock.advance(7000);
      const res = await api.postJson('/api/scores', { token, name: 'ぴったり', score: 7 });
      assert.equal(res.status, 201);
    });

    it('スコア送信後、トークンは used=true になる', async () => {
      const { token } = await api.playAndSubmit('A', 2);
      const session = await api.store.getSession(token);
      assert.equal(session.used, true);
    });
  });

  describe('401 未知のトークン', () => {
    it('発行していないトークンは 401', async () => {
      const res = await api.postJson('/api/scores', {
        token: randomUUID(),
        name: 'にせもの',
        score: 10,
      });
      assert.equal(res.status, 401);
      assert.equal((await res.json()).error, 'invalid_token');
    });

    it('期限切れのトークンは 401', async () => {
      const token = await api.newToken();
      api.clock.advance(SESSION_TTL_MS + 1000);
      const res = await api.postJson('/api/scores', { token, name: 'A', score: 5 });
      assert.equal(res.status, 401);
    });

    it('token が無い/文字列でない場合は 400', async () => {
      for (const token of [undefined, '', 123, null, {}]) {
        const res = await api.postJson('/api/scores', { token, name: 'A', score: 5 });
        assert.equal(res.status, 400, `token=${JSON.stringify(token)}`);
        assert.equal((await res.json()).error, 'token_required');
      }
    });
  });

  describe('409 使用済みトークン', () => {
    it('同じトークンで2回送ると 409', async () => {
      const { token } = await api.playAndSubmit('A', 4);
      api.clock.advance(10_000);
      const res = await api.postJson('/api/scores', { token, name: 'A', score: 4 });
      assert.equal(res.status, 409);
      assert.equal((await res.json()).error, 'token_used');

      // 2回目は保存されていない
      const ranking = await (await api.request('/api/ranking')).json();
      assert.equal(ranking.entries.length, 1);
    });
  });

  describe('422 経過時間が短すぎる', () => {
    it('now - startedAt < score×1000ms は 422', async () => {
      const token = await api.newToken();
      api.clock.advance(3000);
      const res = await api.postJson('/api/scores', { token, name: 'チート', score: 999 });
      assert.equal(res.status, 422);
      assert.equal((await res.json()).error, 'implausible_score');
    });

    it('1ms 足りないだけでも 422', async () => {
      const token = await api.newToken();
      api.clock.advance(9999);
      const res = await api.postJson('/api/scores', { token, name: 'おしい', score: 10 });
      assert.equal(res.status, 422);
    });

    it('422 の場合トークンは消費されない（再送で成功できる）', async () => {
      const token = await api.newToken();
      api.clock.advance(1000);
      const bad = await api.postJson('/api/scores', { token, name: 'A', score: 20 });
      assert.equal(bad.status, 422);

      api.clock.advance(19_000);
      const good = await api.postJson('/api/scores', { token, name: 'A', score: 20 });
      assert.equal(good.status, 201);
    });
  });

  describe('400 name / score の検証', () => {
    const invalidNames = [
      ['空文字', ''],
      ['空白のみ', '   '],
      ['12文字', 'あいうえおかきくけこさし'],
      ['文字列でない', 42],
      ['null', null],
      ['改行入り', 'あ\nい'],
    ];

    for (const [label, name] of invalidNames) {
      it(`name: ${label} は 400`, async () => {
        const token = await api.newToken();
        api.clock.advance(10_000);
        const res = await api.postJson('/api/scores', { token, name, score: 5 });
        assert.equal(res.status, 400);
        assert.equal((await res.json()).error, 'invalid_name');
      });
    }

    const invalidScores = [
      ['0', 0],
      ['負数', -1],
      ['1000', 1000],
      ['小数', 1.5],
      ['文字列', '10'],
      ['NaN相当(null)', null],
    ];

    for (const [label, score] of invalidScores) {
      it(`score: ${label} は 400`, async () => {
        const token = await api.newToken();
        api.clock.advance(1_000_000);
        const res = await api.postJson('/api/scores', { token, name: 'A', score });
        assert.equal(res.status, 400);
        assert.equal((await res.json()).error, 'invalid_score');
      });
    }

    it('400 の場合トークンは消費されない', async () => {
      const token = await api.newToken();
      api.clock.advance(10_000);
      const bad = await api.postJson('/api/scores', { token, name: '', score: 5 });
      assert.equal(bad.status, 400);

      const good = await api.postJson('/api/scores', { token, name: 'A', score: 5 });
      assert.equal(good.status, 201);
    });

    it('壊れたJSONは 400', async () => {
      const res = await api.request('/api/scores', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ not json',
      });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error, 'invalid_json');
    });

    it('配列ボディは 400', async () => {
      const res = await api.postJson('/api/scores', []);
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error, 'invalid_body');
    });
  });
});
