import test from 'node:test';
import assert from 'node:assert/strict';

import { BEYBLADE_X_BLADES, BEYBLADE_X_QUIZ_ITEMS } from '../src/beyblades.js';
import {
  advanceQuestion,
  answerCurrentQuestion,
  createQuiz,
  createStreakQuiz,
  getCurrentQuestion,
  getQuizResult,
  timeOutCurrentQuestion,
} from '../src/quizEngine.js';

const quizOptions = {
  questionCount: 10,
  optionsPerQuestion: 4,
  passingScore: 7,
  seed: 'kids-challenge',
};

test('blade data uses official BEYBLADE X blade images only', () => {
  assert.ok(BEYBLADE_X_BLADES.length >= 30);

  const ids = new Set();
  for (const item of BEYBLADE_X_BLADES) {
    assert.ok(item.id, 'item needs an id');
    assert.equal(item.type, 'blade');
    assert.ok(item.name, 'item needs a name');
    assert.equal(item.bladeName, item.name);
    assert.match(item.imageUrl, /^https:\/\/beyblade\.takaratomy\.co\.jp\/beyblade-x\/lineup\/_image\/[A-Z0-9]+_01@1\.png$/);
    assert.match(item.sourceUrl, /^https:\/\/beyblade\.takaratomy\.co\.jp\/beyblade-x\/lineup\//);
    assert.doesNotMatch(item.imageUrl, /_0[2-9]@1\.png$/);
    ids.add(item.id);
  }

  assert.equal(ids.size, BEYBLADE_X_BLADES.length);
});

test('blade data has enough variety for random blade questions', () => {
  const names = new Set(BEYBLADE_X_BLADES.map((item) => item.name));
  const lines = new Set(BEYBLADE_X_BLADES.map((item) => item.line));

  assert.ok(names.size >= 30);
  assert.ok(lines.has('BX'));
  assert.ok(lines.has('UX'));
  assert.ok(lines.has('CX'));
});

test('quiz item data includes official blade, ratchet, and bit images', () => {
  const byType = Map.groupBy(BEYBLADE_X_QUIZ_ITEMS, (item) => item.type);

  assert.ok(byType.get('blade').length >= 15);
  assert.ok(byType.get('ratchet').length >= 10);
  assert.ok(byType.get('bit').length >= 10);

  for (const item of BEYBLADE_X_QUIZ_ITEMS) {
    assert.ok(item.name, 'item needs a display name');
    assert.ok(item.partLabel, 'item needs a Japanese category label');
    assert.match(item.sourceUrl, /^https:\/\/beyblade\.takaratomy\.co\.jp\/beyblade-x\/lineup\//);

    if (item.type === 'blade') {
      assert.match(item.imageUrl, /_01@1\.png$/);
    } else if (item.type === 'ratchet') {
      assert.match(item.imageUrl, /_03@1\.png$/);
    } else if (item.type === 'bit') {
      assert.match(item.imageUrl, /_04@1\.png$/);
    } else {
      assert.fail(`Unexpected type ${item.type}`);
    }
  }
});

test('quiz item data exposes part-specific choice labels', () => {
  for (const item of BEYBLADE_X_QUIZ_ITEMS) {
    assert.equal(item.choiceLabel, item.name);

    if (item.type === 'blade') {
      assert.equal(item.choiceLabel, item.bladeName);
      assert.ok(item.productName.includes(item.choiceLabel));
    } else {
      assert.equal(item.choiceLabel, item.productName);
    }
  }
});

test('mixed quiz can ask blade, ratchet, and bit questions', () => {
  const quiz = createQuiz(BEYBLADE_X_QUIZ_ITEMS, {
    ...quizOptions,
    questionCount: 18,
    seed: 'mixed-parts-challenge',
  });
  const types = new Set(quiz.questions.map((question) => question.answer.type));

  assert.deepEqual(types, new Set(['blade', 'ratchet', 'bit']));
  assert.equal(quiz.questions.length, 18);
});

test('default mixed quiz includes every part category in each challenge', () => {
  for (const seed of ['balanced-1', 'balanced-2', 'balanced-3']) {
    const quiz = createQuiz(BEYBLADE_X_QUIZ_ITEMS, {
      ...quizOptions,
      seed,
    });
    const types = new Set(quiz.questions.map((question) => question.answer.type));

    assert.deepEqual(types, new Set(['blade', 'ratchet', 'bit']));
  }
});

test('createQuiz builds 10 unique questions with one correct answer in each 4-choice set', () => {
  const quiz = createQuiz(BEYBLADE_X_QUIZ_ITEMS, quizOptions);

  assert.equal(quiz.questions.length, 10);
  assert.equal(new Set(quiz.questions.map((question) => question.id)).size, 10);

  for (const question of quiz.questions) {
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map((option) => option.id)).size, 4);
    assert.deepEqual(
      new Set(question.options.map((option) => option.type)),
      new Set([question.answer.type]),
    );
    assert.equal(
      question.options.filter((option) => option.id === question.answer.id).length,
      1,
    );
  }
});

test('seeded quiz order is repeatable', () => {
  const first = createQuiz(BEYBLADE_X_QUIZ_ITEMS, quizOptions);
  const second = createQuiz(BEYBLADE_X_QUIZ_ITEMS, quizOptions);

  assert.deepEqual(
    first.questions.map((question) => question.answer.id),
    second.questions.map((question) => question.answer.id),
  );
});

test('answerCurrentQuestion scores once and prevents double-answer scoring', () => {
  const quiz = createQuiz(BEYBLADE_X_QUIZ_ITEMS, quizOptions);
  const firstQuestion = getCurrentQuestion(quiz);
  const wrongOption = firstQuestion.options.find((option) => option.id !== firstQuestion.answer.id);

  const answered = answerCurrentQuestion(quiz, firstQuestion.answer.id);
  assert.equal(answered.score, 1);
  assert.equal(getCurrentQuestion(answered).selectedId, firstQuestion.answer.id);
  assert.equal(getCurrentQuestion(answered).isCorrect, true);

  const answeredAgain = answerCurrentQuestion(answered, wrongOption.id);
  assert.equal(answeredAgain.score, 1);
  assert.equal(getCurrentQuestion(answeredAgain).selectedId, firstQuestion.answer.id);
  assert.equal(getCurrentQuestion(answeredAgain).isCorrect, true);
});

test('answerCurrentQuestion ignores selections that are not in the current options', () => {
  const quiz = createQuiz(BEYBLADE_X_QUIZ_ITEMS, quizOptions);
  const answered = answerCurrentQuestion(quiz, 'not-a-real-blade');

  assert.equal(answered, quiz);
  assert.equal(answered.score, 0);
  assert.equal(getCurrentQuestion(answered).selectedId, null);
});

test('timeOutCurrentQuestion marks unanswered current question as wrong without scoring', () => {
  const quiz = createQuiz(BEYBLADE_X_QUIZ_ITEMS, quizOptions);
  const timedOut = timeOutCurrentQuestion(quiz);
  const question = getCurrentQuestion(timedOut);

  assert.equal(timedOut.score, 0);
  assert.equal(timedOut.status, 'answered');
  assert.equal(question.selectedId, '__timeout__');
  assert.equal(question.isCorrect, false);
  assert.equal(question.isTimedOut, true);
});

test('streak quiz starts without a fixed final question count', () => {
  const quiz = createStreakQuiz(BEYBLADE_X_QUIZ_ITEMS, {
    optionsPerQuestion: 4,
    seed: 'streak-start',
  });
  const question = getCurrentQuestion(quiz);

  assert.equal(quiz.mode, 'streak');
  assert.equal(quiz.score, 0);
  assert.equal(quiz.status, 'playing');
  assert.equal(quiz.questionNumber, 1);
  assert.equal(question.options.length, 4);
  assert.deepEqual(
    new Set(question.options.map((option) => option.type)),
    new Set([question.answer.type]),
  );
});

test('streak quiz continues after correct answers and ends on a wrong answer', () => {
  let quiz = createStreakQuiz(BEYBLADE_X_QUIZ_ITEMS, {
    optionsPerQuestion: 4,
    seed: 'streak-flow',
  });

  const firstQuestion = getCurrentQuestion(quiz);
  quiz = answerCurrentQuestion(quiz, firstQuestion.answer.id);
  assert.equal(quiz.score, 1);
  assert.equal(quiz.status, 'answered');

  quiz = advanceQuestion(quiz);
  assert.equal(quiz.status, 'playing');
  assert.equal(quiz.questionNumber, 2);

  const secondQuestion = getCurrentQuestion(quiz);
  const wrongOption = secondQuestion.options.find((option) => option.id !== secondQuestion.answer.id);
  quiz = answerCurrentQuestion(quiz, wrongOption.id);

  assert.equal(quiz.score, 1);
  assert.equal(quiz.status, 'complete');
  assert.equal(getCurrentQuestion(quiz).isCorrect, false);
});

test('streak quiz time out ends the challenge without adding score', () => {
  const quiz = createStreakQuiz(BEYBLADE_X_QUIZ_ITEMS, {
    optionsPerQuestion: 4,
    seed: 'streak-timeout',
  });
  const timedOut = timeOutCurrentQuestion(quiz);

  assert.equal(timedOut.score, 0);
  assert.equal(timedOut.status, 'complete');
  assert.equal(getCurrentQuestion(timedOut).isTimedOut, true);
});

test('createQuiz rejects invalid quiz settings before building state', () => {
  assert.throws(
    () => createQuiz(BEYBLADE_X_QUIZ_ITEMS, { ...quizOptions, questionCount: 0 }),
    /questionCount/,
  );
  assert.throws(
    () => createQuiz(BEYBLADE_X_QUIZ_ITEMS, { ...quizOptions, questionCount: 2.5 }),
    /questionCount/,
  );
  assert.throws(
    () => createQuiz(BEYBLADE_X_QUIZ_ITEMS, { ...quizOptions, optionsPerQuestion: 1 }),
    /optionsPerQuestion/,
  );
  assert.throws(
    () => createQuiz(BEYBLADE_X_QUIZ_ITEMS, { ...quizOptions, passingScore: 11 }),
    /passingScore/,
  );
});

test('getQuizResult passes at 7 correct answers and fails below 7', () => {
  const passingQuiz = playQuizWithCorrectCount(7);
  const failingQuiz = playQuizWithCorrectCount(6);

  assert.deepEqual(getQuizResult(passingQuiz), {
    answeredCount: 10,
    passed: true,
    passingScore: 7,
    questionCount: 10,
    score: 7,
  });

  assert.deepEqual(getQuizResult(failingQuiz), {
    answeredCount: 10,
    passed: false,
    passingScore: 7,
    questionCount: 10,
    score: 6,
  });
});

function playQuizWithCorrectCount(correctCount) {
  let quiz = createQuiz(BEYBLADE_X_BLADES, quizOptions);

  for (let index = 0; index < quiz.questions.length; index += 1) {
    const question = getCurrentQuestion(quiz);
    const selected = index < correctCount
      ? question.answer.id
      : question.options.find((option) => option.id !== question.answer.id).id;

    quiz = answerCurrentQuestion(quiz, selected);

    if (index < quiz.questions.length - 1) {
      quiz = advanceQuestion(quiz);
    }
  }

  return quiz;
}
