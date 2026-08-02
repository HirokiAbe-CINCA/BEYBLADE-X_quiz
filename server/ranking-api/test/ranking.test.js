import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { RANKING_LIMIT } from '../src/config.js';
import { startServer } from './helpers.js';

describe('GET /api/ranking', () => {
  let api;
  beforeEach(async () => {
    api = await startServer({ RATE_LIMIT_MAX: '1000' });
  });
  afterEach(async () => {
    await api.close();
  });

  it('データが無ければ空配列', async () => {
    const res = await api.request('/api/ranking');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { entries: [] });
  });

  it('score降順で返す', async () => {
    for (const [name, score] of [['A', 10], ['B', 90], ['C', 50]]) {
      const { res } = await api.playAndSubmit(name, score);
      assert.equal(res.status, 201);
    }
    const { entries } = await (await api.request('/api/ranking')).json();
    assert.deepEqual(entries.map((e) => e.name), ['B', 'C', 'A']);
    assert.deepEqual(entries.map((e) => e.score), [90, 50, 10]);
  });

  it('同点は date 昇順（先に登録した方が上）', async () => {
    await api.playAndSubmit('さき', 42);
    await api.playAndSubmit('あと', 42);
    await api.playAndSubmit('もっとあと', 42);

    const { entries } = await (await api.request('/api/ranking')).json();
    assert.deepEqual(entries.map((e) => e.name), ['さき', 'あと', 'もっとあと']);
    const dates = entries.map((e) => Date.parse(e.date));
    assert.ok(dates[0] < dates[1] && dates[1] < dates[2]);
  });

  it('上位30件だけ返す', async () => {
    // score 1..35 を登録（登録順は昇順なので、上位30件は 35..6）
    for (let score = 1; score <= 35; score += 1) {
      const { res } = await api.playAndSubmit(`P${score}`, score);
      assert.equal(res.status, 201);
    }

    const { entries } = await (await api.request('/api/ranking')).json();
    assert.equal(RANKING_LIMIT, 30);
    assert.equal(entries.length, 30);
    assert.equal(entries[0].score, 35);
    assert.equal(entries[29].score, 6);

    for (let i = 1; i < entries.length; i += 1) {
      assert.ok(entries[i - 1].score >= entries[i].score, 'score は降順');
    }
  });

  it('31位以下でも rank は正しく返る', async () => {
    for (let score = 100; score > 100 - 32; score -= 1) {
      await api.playAndSubmit(`P${score}`, score);
    }
    const { res } = await api.playAndSubmit('さいか', 1);
    assert.equal((await res.json()).rank, 33);
  });

  it('POST後はキャッシュが無効化され、即座に反映される', async () => {
    await api.playAndSubmit('A', 10);
    const before = await (await api.request('/api/ranking')).json();
    assert.equal(before.entries.length, 1);

    await api.playAndSubmit('B', 20);
    const after = await (await api.request('/api/ranking')).json();
    assert.equal(after.entries.length, 2);
    assert.equal(after.entries[0].name, 'B');
  });

  it('30秒間はキャッシュを返し、経過後に更新される', async () => {
    await api.playAndSubmit('A', 10);
    const first = await (await api.request('/api/ranking')).json();
    assert.equal(first.entries.length, 1);

    // HTTPを経由せず直接ストアへ追加（= キャッシュ無効化されない）
    await api.store.addScore({
      name: 'ちょくせつ',
      score: 999,
      date: new Date(api.clock.now()),
      sessionId: 'direct',
    });

    api.clock.advance(29_000);
    const cached = await (await api.request('/api/ranking')).json();
    assert.equal(cached.entries.length, 1, 'キャッシュ有効期間内は古い結果');

    api.clock.advance(2_000);
    const fresh = await (await api.request('/api/ranking')).json();
    assert.equal(fresh.entries.length, 2, 'TTL経過後は再取得');
    assert.equal(fresh.entries[0].name, 'ちょくせつ');
  });

  it('date は ISO8601 文字列', async () => {
    await api.playAndSubmit('A', 3);
    const { entries } = await (await api.request('/api/ranking')).json();
    assert.match(entries[0].date, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('GET はレート制限の対象外', async () => {
    const app = await startServer(); // 既定 10req/分
    try {
      for (let i = 0; i < 20; i += 1) {
        const res = await app.request('/api/ranking');
        assert.equal(res.status, 200);
      }
    } finally {
      await app.close();
    }
  });
});
