export const DEFAULT_STREAK_OPTIONS = {
  optionsPerQuestion: 4,
};

export const TIMEOUT_SELECTED_ID = '__timeout__';

export function createStreakQuiz(items, options = {}) {
  const settings = {
    ...DEFAULT_STREAK_OPTIONS,
    seed: String(Date.now()),
    ...options,
  };

  validateStreakInputs(items, settings);

  const random = createSeededRandom(settings.seed);
  const quiz = {
    currentIndex: 0,
    items: [...items],
    mode: 'streak',
    optionsPerQuestion: settings.optionsPerQuestion,
    questionNumber: 0,
    questions: [],
    random,
    remainingItems: shuffle(items, random),
    score: 0,
    status: 'playing',
  };

  return buildNextStreakQuestion(quiz);
}

function createQuestion(answer, items, random, questionNumber, optionsPerQuestion) {
  const distractors = shuffle(
    getDistractorCandidates(items, answer),
    random,
  ).slice(0, optionsPerQuestion - 1);

  return {
    id: `${answer.id}-${questionNumber}`,
    answer,
    options: shuffle([...distractors, answer], random),
    selectedId: null,
    isCorrect: null,
  };
}

function buildNextStreakQuestion(quiz) {
  const remainingItems = quiz.remainingItems.length > 0
    ? [...quiz.remainingItems]
    : shuffle(quiz.items, quiz.random);
  const [answer, ...nextRemainingItems] = remainingItems;
  const questionNumber = quiz.questionNumber + 1;
  const question = createQuestion(
    answer,
    quiz.items,
    quiz.random,
    questionNumber,
    quiz.optionsPerQuestion,
  );

  return {
    ...quiz,
    currentIndex: questionNumber - 1,
    questionNumber,
    questions: [question],
    remainingItems: nextRemainingItems,
    status: 'playing',
  };
}

function getDistractorCandidates(items, answer) {
  const sameTypeItems = answer.type
    ? items.filter((item) => item.type === answer.type && item.id !== answer.id)
    : [];

  if (sameTypeItems.length > 0) {
    return sameTypeItems;
  }

  return items.filter((item) => item.id !== answer.id);
}

export function getCurrentQuestion(quiz) {
  return quiz.questions[0] ?? null;
}

export function answerCurrentQuestion(quiz, selectedId) {
  const currentQuestion = getCurrentQuestion(quiz);

  if (!currentQuestion || currentQuestion.selectedId) {
    return quiz;
  }

  if (!currentQuestion.options.some((option) => option.id === selectedId)) {
    return quiz;
  }

  const isCorrect = selectedId === currentQuestion.answer.id;
  const questions = quiz.questions.map((question, index) => {
    if (index !== 0) {
      return question;
    }

    return {
      ...question,
      isCorrect,
      selectedId,
    };
  });

  return {
    ...quiz,
    questions,
    score: quiz.score + (isCorrect ? 1 : 0),
    status: isCorrect ? 'answered' : 'complete',
  };
}

export function timeOutCurrentQuestion(quiz) {
  const currentQuestion = getCurrentQuestion(quiz);

  if (!currentQuestion || currentQuestion.selectedId) {
    return quiz;
  }

  const questions = quiz.questions.map((question, index) => {
    if (index !== 0) {
      return question;
    }

    return {
      ...question,
      isCorrect: false,
      isTimedOut: true,
      selectedId: TIMEOUT_SELECTED_ID,
    };
  });

  return {
    ...quiz,
    questions,
    status: 'complete',
  };
}

export function advanceQuestion(quiz) {
  if (quiz.status === 'complete') {
    return quiz;
  }

  const currentQuestion = getCurrentQuestion(quiz);
  if (!currentQuestion?.selectedId) {
    return quiz;
  }

  if (!currentQuestion.isCorrect) {
    return quiz;
  }

  return buildNextStreakQuestion(quiz);
}

export function getQuizResult(quiz) {
  return {
    answeredCount: quiz.score + (quiz.status === 'complete' ? 1 : 0),
    score: quiz.score,
    streak: quiz.score,
  };
}

function validateStreakInputs(items, settings) {
  if (!Array.isArray(items)) {
    throw new TypeError('Quiz items must be an array.');
  }

  assertPositiveInteger('optionsPerQuestion', settings.optionsPerQuestion);

  if (settings.optionsPerQuestion < 2) {
    throw new RangeError('optionsPerQuestion must be at least 2.');
  }

  if (items.length < settings.optionsPerQuestion) {
    throw new RangeError(`Need at least ${settings.optionsPerQuestion} quiz items.`);
  }

  validateTypeCounts(items, settings.optionsPerQuestion);
}

function validateTypeCounts(items, optionsPerQuestion) {
  const typedItems = items.filter((item) => item.type);
  if (typedItems.length === 0) {
    return;
  }

  const typeCounts = new Map();
  for (const item of typedItems) {
    typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
  }

  for (const [type, count] of typeCounts) {
    if (count < optionsPerQuestion) {
      throw new RangeError(`Need at least ${optionsPerQuestion} ${type} quiz items.`);
    }
  }
}

function assertPositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
}

function shuffle(items, random) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function createSeededRandom(seed) {
  let state = hashSeed(seed);

  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed) {
  let hash = 1779033703 ^ seed.length;

  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return hash >>> 0;
}
