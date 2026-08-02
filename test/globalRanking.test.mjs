import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSession,
  fetchRanking,
  isGlobalRankingEnabled,
  submitScore,
} from '../src/globalRanking.js';

const CONFIG = { apiBaseUrl: 'https://ranking-api.test', dataUrl: '' };
const DISABLED_CONFIG = { apiBaseUrl: '', dataUrl: '' };

test('isGlobalRankingEnabled reflects apiBaseUrl', () => {
  assert.equal(isGlobalRankingEnabled(CONFIG), true);
  assert.equal(isGlobalRankingEnabled(DISABLED_CONFIG), false);
  assert.equal(isGlobalRankingEnabled({ apiBaseUrl: '   ' }), false);
});

test('createSession returns the issued token', async () => {
  const calls = [];
  const fetchImpl = recordingFetch(calls, jsonResponse({ token: 'tok-1' }, 201));

  const token = await createSession(CONFIG, { fetchImpl });

  assert.equal(token, 'tok-1');
  assert.equal(calls[0].url, 'https://ranking-api.test/api/session');
  assert.equal(calls[0].init.method, 'POST');
});

test('createSession trims a trailing slash from apiBaseUrl', async () => {
  const calls = [];
  const fetchImpl = recordingFetch(calls, jsonResponse({ token: 'tok-1' }, 201));

  await createSession({ apiBaseUrl: 'https://ranking-api.test/' }, { fetchImpl });

  assert.equal(calls[0].url, 'https://ranking-api.test/api/session');
});

test('createSession returns null when the API is disabled, errors, or times out', async () => {
  const neverCalled = () => {
    throw new Error('fetch must not be called');
  };
  assert.equal(await createSession(DISABLED_CONFIG, { fetchImpl: neverCalled }), null);

  assert.equal(
    await createSession(CONFIG, { fetchImpl: async () => jsonResponse({}, 500, false) }),
    null,
  );

  assert.equal(
    await createSession(CONFIG, { fetchImpl: async () => jsonResponse({ token: 42 }, 201) }),
    null,
  );

  assert.equal(
    await createSession(CONFIG, { fetchImpl: () => Promise.reject(new Error('offline')) }),
    null,
  );

  assert.equal(
    await createSession(CONFIG, { fetchImpl: () => new Promise(() => {}), timeoutMs: 10 }),
    null,
  );
});

test('submitScore posts the payload and returns the rank', async () => {
  const calls = [];
  const fetchImpl = recordingFetch(calls, jsonResponse({ ok: true, rank: 7 }, 201));

  const result = await submitScore(CONFIG, { token: 'tok-1', name: 'ヒロキ', score: 12 }, { fetchImpl });

  assert.deepEqual(result, { ok: true, rank: 7 });
  assert.equal(calls[0].url, 'https://ranking-api.test/api/scores');
  assert.deepEqual(JSON.parse(calls[0].init.body), { token: 'tok-1', name: 'ヒロキ', score: 12 });
});

test('submitScore truncates names to the 11 character limit', async () => {
  const calls = [];
  const fetchImpl = recordingFetch(calls, jsonResponse({ ok: true, rank: 1 }, 201));

  await submitScore(
    CONFIG,
    { token: 'tok-1', name: '  Champion Name That Is Long  ', score: 3 },
    { fetchImpl },
  );

  assert.equal(JSON.parse(calls[0].init.body).name, 'Champion Na');
});

test('submitScore returns null for invalid input or unhappy responses', async () => {
  const okFetch = async () => jsonResponse({ ok: true, rank: 1 }, 201);

  assert.equal(await submitScore(DISABLED_CONFIG, { token: 't', name: 'a', score: 1 }, { fetchImpl: okFetch }), null);
  assert.equal(await submitScore(CONFIG, { token: '', name: 'a', score: 1 }, { fetchImpl: okFetch }), null);
  assert.equal(await submitScore(CONFIG, { token: 't', name: '   ', score: 1 }, { fetchImpl: okFetch }), null);
  assert.equal(await submitScore(CONFIG, { token: 't', name: 'a', score: 0 }, { fetchImpl: okFetch }), null);

  assert.equal(
    await submitScore(CONFIG, { token: 't', name: 'a', score: 1 }, {
      fetchImpl: async () => jsonResponse({ error: 'conflict' }, 409, false),
    }),
    null,
  );

  assert.equal(
    await submitScore(CONFIG, { token: 't', name: 'a', score: 1 }, {
      fetchImpl: () => new Promise(() => {}),
      timeoutMs: 10,
    }),
    null,
  );
});

test('fetchRanking returns at most 30 sanitized entries', async () => {
  const entries = Array.from({ length: 42 }, (_value, index) => ({
    name: `P${index}`,
    score: 100 - index,
    date: '2026-08-02T00:00:00.000Z',
  }));
  entries.push({ name: '   ', score: 5, date: '2026-08-02T00:00:00.000Z' });

  const fetchImpl = async () => jsonResponse({ entries });
  const result = await fetchRanking(CONFIG, { fetchImpl });

  assert.equal(result.length, 30);
  assert.deepEqual(result[0], { name: 'P0', score: 100, date: '2026-08-02T00:00:00.000Z' });
});

test('fetchRanking returns null when disabled, non-2xx, malformed, or timed out', async () => {
  const neverCalled = () => {
    throw new Error('fetch must not be called');
  };

  assert.equal(await fetchRanking(DISABLED_CONFIG, { fetchImpl: neverCalled }), null);
  assert.equal(await fetchRanking(CONFIG, { fetchImpl: async () => jsonResponse({}, 503, false) }), null);
  assert.equal(await fetchRanking(CONFIG, { fetchImpl: async () => jsonResponse({ entries: 'nope' }) }), null);
  assert.equal(await fetchRanking(CONFIG, { fetchImpl: () => Promise.reject(new Error('offline')) }), null);
  assert.equal(
    await fetchRanking(CONFIG, { fetchImpl: () => new Promise(() => {}), timeoutMs: 10 }),
    null,
  );
});

function jsonResponse(payload, status = 200, ok = true) {
  return { ok, status, json: async () => payload };
}

function recordingFetch(calls, response) {
  return async (url, init) => {
    calls.push({ url, init });
    return response;
  };
}
