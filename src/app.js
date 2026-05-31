import { BEYBLADE_X_BLADES, BEYBLADE_X_BITS, BEYBLADE_X_QUIZ_ITEMS, BEYBLADE_X_RATCHETS } from './beyblades.js';
import {
  advanceQuestion,
  answerCurrentQuestion,
  createStreakQuiz,
  getCurrentQuestion,
  getQuizResult,
  timeOutCurrentQuestion,
} from './quizEngine.js';
import {
  getLeaderboard,
  isFirstPlaceScore,
  saveLeaderboardEntry,
} from './ranking.js';

const OPTIONS_PER_QUESTION = 4;
const QUESTION_TIME_LIMIT_SECONDS = 10;
const app = document.querySelector('#app');

let quiz = null;
let timerDeadline = 0;
let timerInterval = null;

renderStart();

function renderStart() {
  clearQuestionTimer();
  const leaderboard = getLeaderboard();

  app.innerHTML = `
    <section class="start-screen">
      <div class="start-grid" aria-hidden="true"></div>
      <div class="brand-row">
        <span class="spark">X</span>
        <span>BLADE / RATCHET / BIT</span>
      </div>
      <div class="title-lockup">
        <h1>
          <span>BEYBLADE X</span>
          <strong>QUIZ</strong>
        </h1>
      </div>
      <div class="start-art" aria-hidden="true">
        <span class="arena-orbit orbit-outer"></span>
        <span class="arena-orbit orbit-inner"></span>
        <img class="start-art-main" src="${BEYBLADE_X_BLADES[0].imageUrl}" alt="">
        <img class="start-art-ratchet" src="${BEYBLADE_X_RATCHETS[0].imageUrl}" alt="">
        <img class="start-art-bit" src="${BEYBLADE_X_BITS[0].imageUrl}" alt="">
      </div>
      <dl class="start-rules" aria-label="チャレンジルール">
        <div>
          <dt>モード</dt>
          <dd>∞<span>まで</span></dd>
        </div>
        <div>
          <dt><ruby>制限<rt aria-hidden="true">せいげん</rt></ruby></dt>
          <dd>${QUESTION_TIME_LIMIT_SECONDS}<span>秒</span></dd>
        </div>
        <div>
          <dt><ruby>記録<rt aria-hidden="true">きろく</rt></ruby></dt>
          <dd>TOP<span>1</span></dd>
        </div>
      </dl>
      ${renderLeaderboard(leaderboard)}
      <button class="primary-action" type="button" data-start>
        START
      </button>
      <p class="source-note"><ruby>画像<rt aria-hidden="true">がぞう</rt></ruby>: タカラトミー<ruby>公式<rt aria-hidden="true">こうしき</rt></ruby>サイト</p>
    </section>
  `;

  app.querySelector('[data-start]').addEventListener('click', startGame);
}

function startGame() {
  try {
    clearQuestionTimer();
    quiz = createStreakQuiz(BEYBLADE_X_QUIZ_ITEMS, {
      optionsPerQuestion: OPTIONS_PER_QUESTION,
      seed: `${Date.now()}-${Math.random()}`,
    });
    renderQuestion();
  } catch (error) {
    renderError(error);
  }
}

function renderQuestion({ focusNext = false } = {}) {
  clearQuestionTimer();

  const question = getCurrentQuestion(quiz);
  if (!question) {
    renderResult();
    return;
  }

  const result = getQuizResult(quiz);
  const questionNumber = quiz.questionNumber ?? quiz.currentIndex + 1;
  const answered = Boolean(question.selectedId);
  const progress = Math.min(100, result.score * 10);

  app.innerHTML = `
    <section class="${getQuizScreenClass(question)}">
      ${question.isCorrect ? renderCorrectCelebration() : ''}
      <header class="quiz-header">
        <div>
          <p class="eyebrow">STREAK ${result.score}</p>
          <h1>${escapeHtml(question.answer.questionText)}</h1>
        </div>
        <div class="score-pill">${result.score}<span>点</span></div>
      </header>

      <div class="progress-track" aria-label="連続正解 ${result.score}">
        <span style="width: ${progress}%"></span>
      </div>

      ${renderTimer(question)}

      <figure class="blade-stage">
        <div class="part-chip type-${question.answer.type}">
          <span>${escapeHtml(question.answer.partLabel)}</span>
        </div>
        <div class="blade-image-wrap">
          <span class="x-ring" aria-hidden="true"></span>
          <img class="blade-image part-${question.answer.type}" src="${question.answer.imageUrl}" alt="ベイブレードXの${escapeHtml(question.answer.partLabel)}画像" data-blade-image>
          <div class="image-fallback" hidden>
            <ruby>画像<rt aria-hidden="true">がぞう</rt></ruby>を読みこめません
          </div>
        </div>
        <figcaption>${questionNumber}問目 / ${question.answer.code} / ${question.answer.line} LINE</figcaption>
      </figure>

      <div class="answer-grid" data-answer-grid></div>

      <div class="feedback-slot" data-feedback>
        ${renderFeedback(question)}
      </div>

      <div class="footer-actions">
        ${answered ? renderNextButton() : '<p class="hint">4つからえらんでね</p>'}
      </div>
    </section>
  `;

  wireImageFallback();
  renderAnswerButtons(question);

  if (!answered) {
    startQuestionTimer();
  }

  const nextButton = app.querySelector('[data-next]');
  if (nextButton) {
    nextButton.addEventListener('click', goNext);
    if (focusNext) {
      nextButton.focus();
    }
  }
}

function renderAnswerButtons(question) {
  const answerGrid = app.querySelector('[data-answer-grid]');

  for (const option of question.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = getAnswerClass(question, option.id);
    button.disabled = Boolean(question.selectedId);
    button.textContent = option.choiceLabel;
    button.addEventListener('click', () => {
      clearQuestionTimer();
      quiz = answerCurrentQuestion(quiz, option.id);
      renderQuestion({ focusNext: true });
    });
    answerGrid.append(button);
  }
}

function getAnswerClass(question, optionId) {
  const classes = ['answer-button'];

  if (!question.selectedId) {
    return classes.join(' ');
  }

  if (optionId === question.answer.id) {
    classes.push('correct');
  } else if (optionId === question.selectedId) {
    classes.push('wrong');
  }

  return classes.join(' ');
}

function renderTimer(question) {
  const timerText = question.isTimedOut
    ? '<ruby>時間切れ<rt aria-hidden="true">じかんぎれ</rt></ruby>'
    : question.selectedId
      ? 'ストップ'
      : `${QUESTION_TIME_LIMIT_SECONDS}<ruby>秒<rt aria-hidden="true">びょう</rt></ruby>`;

  return `
    <div class="timer-panel${question.isTimedOut ? ' is-time-up' : ''}" aria-live="polite">
      <span><ruby>残<rt aria-hidden="true">のこ</rt></ruby>り</span>
      <strong data-timer-text>${timerText}</strong>
      <div class="timer-track" aria-hidden="true">
        <span data-timer-bar style="width: ${question.selectedId ? 0 : 100}%"></span>
      </div>
    </div>
  `;
}

function renderFeedback(question) {
  if (!question.selectedId) {
    return '';
  }

  if (question.isCorrect) {
    return `
      <p class="feedback correct-text">
        やったね！ <ruby>正解<rt aria-hidden="true">せいかい</rt></ruby>！ ${escapeHtml(question.answer.choiceLabel)}
      </p>
    `;
  }

  if (question.isTimedOut) {
    return `
      <p class="feedback wrong-text">
        <ruby>時間切れ<rt aria-hidden="true">じかんぎれ</rt></ruby>。<ruby>正解<rt aria-hidden="true">せいかい</rt></ruby>は ${escapeHtml(question.answer.choiceLabel)}
      </p>
    `;
  }

  return `
    <p class="feedback wrong-text">
      ざんねん。<ruby>正解<rt aria-hidden="true">せいかい</rt></ruby>は ${escapeHtml(question.answer.choiceLabel)}
    </p>
  `;
}

function renderCorrectCelebration() {
  return `
    <div class="correct-burst" aria-hidden="true">
      <span class="burst-ring"></span>
      <span class="burst-ray ray-1"></span>
      <span class="burst-ray ray-2"></span>
      <span class="burst-ray ray-3"></span>
      <span class="burst-ray ray-4"></span>
      <span class="burst-spark spark-1">X</span>
      <span class="burst-spark spark-2">X</span>
      <span class="burst-spark spark-3">X</span>
      <span class="burst-spark spark-4">X</span>
    </div>
  `;
}

function renderNextButton() {
  if (quiz.status === 'complete') {
    return '<button class="primary-action compact" type="button" data-next><ruby>記録<rt aria-hidden="true">きろく</rt></ruby>を見る</button>';
  }

  return '<button class="primary-action compact" type="button" data-next><ruby>次<rt aria-hidden="true">つぎ</rt></ruby>へ</button>';
}

function getQuizScreenClass(question) {
  const classes = ['quiz-screen', `type-${question.answer.type}`];

  if (question.selectedId) {
    classes.push('answered');
    classes.push(question.isCorrect ? 'is-correct' : 'is-wrong');
    if (question.isTimedOut) {
      classes.push('time-up');
    }
  }

  return classes.join(' ');
}

function goNext() {
  clearQuestionTimer();

  if (quiz.status === 'complete') {
    renderResult();
    return;
  }

  quiz = advanceQuestion(quiz);
  renderQuestion();
}

function renderResult() {
  clearQuestionTimer();

  const result = getQuizResult(quiz);
  const leaderboard = getLeaderboard();
  const firstPlace = isFirstPlaceScore(result.score, leaderboard);
  const resultClass = result.score > 0 ? 'passed' : 'failed';
  const headline = firstPlace ? 'NEW RECORD' : 'GAME OVER';
  const message = result.score > 0
    ? `${result.score}問れんぞく正解！`
    : 'まずは1問正解をねらおう。';

  app.innerHTML = `
    <section class="result-screen ${resultClass}">
      <p class="eyebrow"><ruby>記録<rt aria-hidden="true">きろく</rt></ruby></p>
      <h1>${headline}</h1>
      <div class="result-score">
        <span>${result.score}</span>
        <small><ruby>問<rt aria-hidden="true">もん</rt></ruby>れんぞく</small>
      </div>
      <p>${message}</p>
      ${firstPlace ? renderNameEntryForm(result.score) : renderLeaderboard(leaderboard)}
      <button class="primary-action" type="button" data-restart>もう一回</button>
    </section>
  `;

  app.querySelector('[data-restart]').addEventListener('click', startGame);
  const form = app.querySelector('[data-ranking-form]');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = new FormData(form).get('player-name');
      const updatedLeaderboard = saveLeaderboardEntry(localStorage, {
        name,
        score: result.score,
      });
      renderSavedRanking(updatedLeaderboard);
    });
  }
}

function renderSavedRanking(leaderboard) {
  app.innerHTML = `
    <section class="result-screen passed">
      <p class="eyebrow">RANKING SAVED</p>
      <h1><ruby>保存<rt aria-hidden="true">ほぞん</rt></ruby>したよ</h1>
      ${renderLeaderboard(leaderboard)}
      <button class="primary-action" type="button" data-restart>もう一回</button>
      <button class="secondary-action" type="button" data-title><ruby>タイトル<rt aria-hidden="true">たいとる</rt></ruby>へ</button>
    </section>
  `;

  app.querySelector('[data-restart]').addEventListener('click', startGame);
  app.querySelector('[data-title]').addEventListener('click', renderStart);
}

function renderNameEntryForm(score) {
  return `
    <form class="ranking-form" data-ranking-form>
      <label for="player-name">1<ruby>位<rt aria-hidden="true">い</rt></ruby>の<ruby>名前<rt aria-hidden="true">なまえ</rt></ruby></label>
      <input id="player-name" name="player-name" maxlength="11" autocomplete="nickname" required placeholder="NAME">
      <button class="primary-action compact" type="submit">${score}<ruby>問<rt aria-hidden="true">もん</rt></ruby>で<ruby>保存<rt aria-hidden="true">ほぞん</rt></ruby></button>
    </form>
  `;
}

function renderLeaderboard(leaderboard) {
  const rows = leaderboard.length > 0
    ? leaderboard.map((entry, index) => `
        <li>
          <span>${index + 1}</span>
          <strong>${escapeHtml(entry.name)}</strong>
          <em>${entry.score}<ruby>問<rt aria-hidden="true">もん</rt></ruby></em>
        </li>
      `).join('')
    : '<li class="empty-ranking"><strong>NO RECORD</strong><em>まだ記録なし</em></li>';

  return `
    <section class="leaderboard" aria-label="ランキング">
      <div class="leaderboard-head">
        <p class="eyebrow">RANKING</p>
        <span>LOCAL TOP 5</span>
      </div>
      <ol>${rows}</ol>
    </section>
  `;
}

function renderError(error) {
  clearQuestionTimer();

  app.innerHTML = `
    <section class="result-screen failed">
      <p class="eyebrow">エラー</p>
      <h1>クイズをはじめられません</h1>
      <p>${escapeHtml(error.message)}</p>
      <button class="primary-action" type="button" data-restart>もどる</button>
    </section>
  `;

  app.querySelector('[data-restart]').addEventListener('click', renderStart);
}

function startQuestionTimer() {
  timerDeadline = Date.now() + QUESTION_TIME_LIMIT_SECONDS * 1000;
  updateQuestionTimer();
  timerInterval = window.setInterval(updateQuestionTimer, 100);
}

function updateQuestionTimer() {
  const currentQuestion = quiz ? getCurrentQuestion(quiz) : null;
  if (!currentQuestion || currentQuestion.selectedId || quiz.status !== 'playing') {
    clearQuestionTimer();
    return;
  }

  const duration = QUESTION_TIME_LIMIT_SECONDS * 1000;
  const remaining = Math.max(0, timerDeadline - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  const percentage = Math.max(0, Math.min(100, (remaining / duration) * 100));
  const timerText = app.querySelector('[data-timer-text]');
  const timerBar = app.querySelector('[data-timer-bar]');

  if (timerText) {
    timerText.innerHTML = `${seconds}<ruby>秒<rt aria-hidden="true">びょう</rt></ruby>`;
  }

  if (timerBar) {
    timerBar.style.width = `${percentage}%`;
    timerBar.classList.toggle('is-low', remaining <= 3000);
  }

  if (remaining === 0) {
    clearQuestionTimer();
    quiz = timeOutCurrentQuestion(quiz);
    renderQuestion({ focusNext: true });
  }
}

function clearQuestionTimer() {
  if (timerInterval) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
  timerDeadline = 0;
}

function wireImageFallback() {
  const image = app.querySelector('[data-blade-image]');
  const fallback = app.querySelector('.image-fallback');
  const showFallback = () => {
    image.hidden = true;
    fallback.hidden = false;
  };

  image.addEventListener('error', showFallback, { once: true });

  if (image.complete && image.naturalWidth === 0) {
    showFallback();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
