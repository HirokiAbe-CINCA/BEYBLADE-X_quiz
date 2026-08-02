import test from 'node:test';
import assert from 'node:assert/strict';

import { BUNDLED_DATA_URL, isValidQuizData, loadQuizData } from '../src/quizData.js';

const CONFIG_WITH_REMOTE = { apiBaseUrl: '', dataUrl: 'https://example.test/beyblades.json' };
const CONFIG_WITHOUT_REMOTE = { apiBaseUrl: '', dataUrl: '' };

test('loadQuizData uses the remote payload when it is valid', async () => {
  const calls = [];
  const fetchImpl = createFetch(calls, {
    'https://example.test/beyblades.json': jsonResponse(buildPayload()),
  });

  const data = await loadQuizData(CONFIG_WITH_REMOTE, { fetchImpl });

  assert.equal(data.source, 'remote');
  assert.equal(data.items.length, 12);
  assert.equal(data.blades.length, 4);
  assert.equal(data.ratchets.length, 4);
  assert.equal(data.bits.length, 4);
  assert.deepEqual(calls, ['https://example.test/beyblades.json']);
});

test('loadQuizData falls back to the bundled JSON when the remote payload fails validation', async () => {
  const calls = [];
  const fetchImpl = createFetch(calls, {
    // ラチェットが3件しかない = quizEngine の4択要件を満たさない
    'https://example.test/beyblades.json': jsonResponse(buildPayload({ ratchet: 3 })),
    [BUNDLED_DATA_URL]: jsonResponse(buildPayload()),
  });

  const data = await loadQuizData(CONFIG_WITH_REMOTE, { fetchImpl });

  assert.equal(data.source, 'bundled');
  assert.deepEqual(calls, ['https://example.test/beyblades.json', BUNDLED_DATA_URL]);
});

test('loadQuizData falls back when a required field is missing', async () => {
  const payload = buildPayload();
  delete payload.items[0].choiceLabel;

  const fetchImpl = createFetch([], {
    'https://example.test/beyblades.json': jsonResponse(payload),
    [BUNDLED_DATA_URL]: jsonResponse(buildPayload()),
  });

  const data = await loadQuizData(CONFIG_WITH_REMOTE, { fetchImpl });
  assert.equal(data.source, 'bundled');
});

test('loadQuizData falls back when the remote request times out', async () => {
  const calls = [];
  const fetchImpl = (url) => {
    calls.push(url);
    if (url === BUNDLED_DATA_URL) {
      return Promise.resolve(jsonResponse(buildPayload()));
    }
    return new Promise(() => {});
  };

  const data = await loadQuizData(CONFIG_WITH_REMOTE, { fetchImpl, timeoutMs: 10 });

  assert.equal(data.source, 'bundled');
  assert.deepEqual(calls, ['https://example.test/beyblades.json', BUNDLED_DATA_URL]);
});

test('loadQuizData falls back when the remote responds with a non-2xx status', async () => {
  const fetchImpl = createFetch([], {
    'https://example.test/beyblades.json': { ok: false, status: 500, json: async () => ({}) },
    [BUNDLED_DATA_URL]: jsonResponse(buildPayload()),
  });

  const data = await loadQuizData(CONFIG_WITH_REMOTE, { fetchImpl });
  assert.equal(data.source, 'bundled');
});

test('loadQuizData skips the network when dataUrl is empty', async () => {
  const calls = [];
  const fetchImpl = createFetch(calls, {
    [BUNDLED_DATA_URL]: jsonResponse(buildPayload()),
  });

  const data = await loadQuizData(CONFIG_WITHOUT_REMOTE, { fetchImpl });

  assert.equal(data.source, 'bundled');
  assert.deepEqual(calls, [BUNDLED_DATA_URL]);
});

test('loadQuizData throws when both the remote and the bundled JSON fail', async () => {
  const fetchImpl = () => Promise.reject(new Error('offline'));

  await assert.rejects(
    () => loadQuizData(CONFIG_WITH_REMOTE, { fetchImpl }),
    /出題データを読みこめませんでした/,
  );
});

test('the shipped data/beyblades.json passes validation', async () => {
  const { readFile } = await import('node:fs/promises');
  const url = new URL('../data/beyblades.json', import.meta.url);
  const payload = JSON.parse(await readFile(url, 'utf8'));

  assert.equal(isValidQuizData(payload), true);
});

function buildPayload(counts = {}) {
  const { blade = 4, ratchet = 4, bit = 4 } = counts;
  const items = [
    ...buildItems('blade', 'ブレード', blade),
    ...buildItems('ratchet', 'ラチェット', ratchet),
    ...buildItems('bit', 'ビット', bit),
  ];

  return { version: 1, updatedAt: '2026-08-02T00:00:00.000Z', source: 'test', items };
}

function buildItems(type, partLabel, count) {
  return Array.from({ length: count }, (_value, index) => ({
    id: `${type}-${index}`,
    code: `BX-${index}`,
    line: 'BX',
    type,
    partLabel,
    questionText: `この${partLabel}は？`,
    name: `${type}${index}`,
    choiceLabel: `${type}${index}`,
    imageUrl: `https://example.test/${type}${index}.png`,
  }));
}

function jsonResponse(payload) {
  return { ok: true, status: 200, json: async () => payload };
}

function createFetch(calls, routes) {
  return async (url) => {
    calls.push(url);
    const response = routes[url];
    if (!response) {
      throw new Error(`Unexpected fetch: ${url}`);
    }
    return response;
  };
}
