import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLeaderboard,
  isFirstPlaceScore,
  saveLeaderboardEntry,
} from '../src/ranking.js';

test('getLeaderboard returns sanitized rankings sorted by score', () => {
  const storage = createStorage({
    'beyblade-x-quiz-ranking-v1': JSON.stringify([
      { name: 'Beta', score: 3, date: '2026-05-31T00:00:00.000Z' },
      { name: '', score: 99, date: 'bad-date' },
      { name: 'Alpha', score: 8, date: '2026-05-31T00:00:00.000Z' },
      { name: 'Negative', score: -1, date: '2026-05-31T00:00:00.000Z' },
    ]),
  });

  assert.deepEqual(getLeaderboard(storage), [
    { name: 'Alpha', score: 8, date: '2026-05-31T00:00:00.000Z' },
    { name: 'Beta', score: 3, date: '2026-05-31T00:00:00.000Z' },
  ]);
});

test('isFirstPlaceScore only prompts for a positive first-place score', () => {
  const leaderboard = [
    { name: 'Alpha', score: 8, date: '2026-05-31T00:00:00.000Z' },
  ];

  assert.equal(isFirstPlaceScore(9, leaderboard), true);
  assert.equal(isFirstPlaceScore(8, leaderboard), true);
  assert.equal(isFirstPlaceScore(7, leaderboard), false);
  assert.equal(isFirstPlaceScore(0, []), false);
});

test('saveLeaderboardEntry trims names and keeps top five rankings', () => {
  const storage = createStorage({
    'beyblade-x-quiz-ranking-v1': JSON.stringify([
      { name: 'A', score: 8, date: '2026-05-31T00:00:00.000Z' },
      { name: 'B', score: 7, date: '2026-05-31T00:00:00.000Z' },
      { name: 'C', score: 6, date: '2026-05-31T00:00:00.000Z' },
      { name: 'D', score: 5, date: '2026-05-31T00:00:00.000Z' },
      { name: 'E', score: 4, date: '2026-05-31T00:00:00.000Z' },
    ]),
  });

  const leaderboard = saveLeaderboardEntry(storage, {
    name: '  Champion Name That Is Very Long  ',
    score: 9,
    date: '2026-05-31T12:00:00.000Z',
  });

  assert.deepEqual(leaderboard.map((entry) => entry.score), [9, 8, 7, 6, 5]);
  assert.equal(leaderboard[0].name, 'Champion Na');
  assert.equal(JSON.parse(storage.getItem('beyblade-x-quiz-ranking-v1')).length, 5);
});

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}
