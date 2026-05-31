export const DEFAULT_QUIZ_OPTIONS = {
  questionCount: 10,
  optionsPerQuestion: 4,
  passingScore: 7,
};

export const DEFAULT_STREAK_OPTIONS = {
  optionsPerQuestion: 4,
};

export const TIMEOUT_SELECTED_ID = '__timeout__';

export function createQuiz(items, options = {}) {
  const settings = {
    ...DEFAULT_QUIZ_OPTIONS,
    seed: String(Date.now()),
    ...options,
  };

  validateQuizInputs(items, settings);

  const random = createSeededRandom(settings.seed);
  const questionItems = selectQuestionItems(items, settings, random);
  const questions = questionItems.map((answer, index) => {
    return createQuestion(answer, items, random, index + 1, settings.optionsPerQuestion);
  });

  return {
    currentIndex: 0,
    passingScore: settings.passingScore,
    questionCount: settings.questionCount,
    questions,
    score: 0,
    status: 'playing',
  };
}

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

function selectQuestionItems(items, settings, random) {
  const typeGroups = groupItemsByType(items);
  const typeNames = [...typeGroups.keys()];

  if (typeNames.length <= 1 || typeNames.length > settings.questionCount) {
    return shuffle(items, random).slice(0, settings.questionCount);
  }

  const selected = [];
  const selectedIds = new Set();

  for (const type of shuffle(typeNames, random)) {
    const [item] = shuffle(typeGroups.get(type), random);
    selected.push(item);
    selectedIds.add(item.id);
  }

  const remaining = shuffle(
    items.filter((item) => !selectedIds.has(item.id)),
    random,
  ).slice(0, settings.questionCount - selected.length);

  return shuffle([...selected, ...remaining], random);
}

function groupItemsByType(items) {
  const groups = new Map();

  for (const item of items) {
    if (!item.type) {
      continue;
    }

    if (!groups.has(item.type)) {
      groups.set(item.type, []);
    }
    groups.get(item.type).push(item);
  }

  return groups;
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
  if (quiz.mode === 'streak') {
    return quiz.questions[0] ?? null;
  }

  return quiz.questions[quiz.currentIndex] ?? null;
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
    const isCurrent = quiz.mode === 'streak' ? index === 0 : index === quiz.currentIndex;
    if (!isCurrent) {
      return question;
    }

    return {
      ...question,
      isCorrect,
      selectedId,
    };
  });

  if (quiz.mode === 'streak') {
    return {
      ...quiz,
      questions,
      score: quiz.score + (isCorrect ? 1 : 0),
      status: isCorrect ? 'answered' : 'complete',
    };
  }

  const isLastQuestion = quiz.currentIndex === quiz.questions.length - 1;

  return {
    ...quiz,
    questions,
    score: quiz.score + (isCorrect ? 1 : 0),
    status: isLastQuestion ? 'complete' : 'answered',
  };
}

export function timeOutCurrentQuestion(quiz) {
  const currentQuestion = getCurrentQuestion(quiz);

  if (!currentQuestion || currentQuestion.selectedId) {
    return quiz;
  }

  const questions = quiz.questions.map((question, index) => {
    const isCurrent = quiz.mode === 'streak' ? index === 0 : index === quiz.currentIndex;
    if (!isCurrent) {
      return question;
    }

    return {
      ...question,
      isCorrect: false,
      isTimedOut: true,
      selectedId: TIMEOUT_SELECTED_ID,
    };
  });

  const isLastQuestion = quiz.currentIndex === quiz.questions.length - 1;

  return {
    ...quiz,
    questions,
    status: quiz.mode === 'streak' || isLastQuestion ? 'complete' : 'answered',
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

  if (quiz.mode === 'streak') {
    if (!currentQuestion.isCorrect) {
      return quiz;
    }

    return buildNextStreakQuestion(quiz);
  }

  const nextIndex = quiz.currentIndex + 1;
  if (nextIndex >= quiz.questions.length) {
    return {
      ...quiz,
      status: 'complete',
    };
  }

  return {
    ...quiz,
    currentIndex: nextIndex,
    status: 'playing',
  };
}

export function getQuizResult(quiz) {
  if (quiz.mode === 'streak') {
    return {
      answeredCount: quiz.score + (quiz.status === 'complete' ? 1 : 0),
      score: quiz.score,
      streak: quiz.score,
    };
  }

  const answeredCount = quiz.questions.filter((question) => question.selectedId).length;

  return {
    answeredCount,
    passed: answeredCount === quiz.questionCount && quiz.score >= quiz.passingScore,
    passingScore: quiz.passingScore,
    questionCount: quiz.questionCount,
    score: quiz.score,
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

function validateQuizInputs(items, settings) {
  if (!Array.isArray(items)) {
    throw new TypeError('Quiz items must be an array.');
  }

  assertPositiveInteger('questionCount', settings.questionCount);
  assertPositiveInteger('optionsPerQuestion', settings.optionsPerQuestion);
  assertPositiveInteger('passingScore', settings.passingScore);

  if (settings.optionsPerQuestion < 2) {
    throw new RangeError('optionsPerQuestion must be at least 2.');
  }

  if (settings.passingScore > settings.questionCount) {
    throw new RangeError('passingScore cannot be greater than questionCount.');
  }

  if (items.length < settings.questionCount) {
    throw new RangeError(`Need at least ${settings.questionCount} quiz items.`);
  }

  if (items.length < settings.optionsPerQuestion) {
    throw new RangeError(`Need at least ${settings.optionsPerQuestion} quiz items.`);
  }

  const typedItems = items.filter((item) => item.type);
  if (typedItems.length > 0) {
    validateTypeCounts(items, settings.optionsPerQuestion);
  }
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
