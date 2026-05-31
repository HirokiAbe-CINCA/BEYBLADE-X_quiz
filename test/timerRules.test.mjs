import test from 'node:test';
import assert from 'node:assert/strict';

import { getQuestionTimeLimitSeconds } from '../src/timerRules.js';

test('getQuestionTimeLimitSeconds uses 10 seconds until 10 correct answers', () => {
  assert.equal(getQuestionTimeLimitSeconds({ score: 0 }), 10);
  assert.equal(getQuestionTimeLimitSeconds({ score: 9 }), 10);
});

test('getQuestionTimeLimitSeconds uses 5 seconds after 10 correct answers', () => {
  assert.equal(getQuestionTimeLimitSeconds({ score: 10 }), 5);
  assert.equal(getQuestionTimeLimitSeconds({ score: 27 }), 5);
});
