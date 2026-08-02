import { CONFIG } from './config.js';
import {
  createSession,
  fetchRanking,
  isGlobalRankingEnabled,
  submitScore,
} from './globalRanking.js';
import { loadQuizData } from './quizData.js';
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
  MAX_NAME_LENGTH,
  saveLeaderboardEntry,
} from './ranking.js';
import {
  EXPERT_TIME_LIMIT_SECONDS,
  EXPERT_TIME_START_SCORE,
  getQuestionTimeLimitSeconds,
  INITIAL_TIME_LIMIT_SECONDS,
} from './timerRules.js';

const OPTIONS_PER_QUESTION = 4;
const app = document.querySelector('#app');

let quiz = null;
let quizData = null;
let timerDeadline = 0;
let timerInterval = null;
let sessionPromise = null;
let rankingTab = isGlobalRankingEnabled(CONFIG) ? 'global' : 'local';
let globalRankingState = { status: 'idle', entries: [] };

bootstrap();

async function bootstrap() {
  renderLoading();

  try {
    quizData = await loadQuizData(CONFIG);
    renderStart();
  } catch (error) {
    renderBootError(error);
  }
}

function renderLoading() {
  app.innerHTML = `
    <section class="boot-screen">
      <p class="eyebrow">LOADING</p>
      <div class="boot-spinner" aria-hidden="true"></div>
      <p><ruby>準備<rt aria-hidden="true">じゅんび</rt></ruby>ちゅう…</p>
    </section>
  `;
}

function renderBootError(error) {
  app.innerHTML = `
    <section class="boot-screen is-error">
      <p class="eyebrow">エラー</p>
      <h1>データをよみこめないよ</h1>
      <p>${escapeHtml(error?.message ?? 'よみこみに失敗しました。')}</p>
      <p class="hint">つうしんかんきょうをたしかめてね</p>
      <button class="primary-action" type="button" data-retry><ruby>再<rt aria-hidden="true">さい</rt></ruby>チャレンジ</button>
    </section>
  `;

  app.querySelector('[data-retry]').addEventListener('click', bootstrap);
}

function renderStart() {
  clearQuestionTimer();

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
        <img class="start-art-main" src="${escapeHtml(quizData.blades[0].imageUrl)}" alt="">
        <img class="start-art-ratchet" src="${escapeHtml(quizData.ratchets[0].imageUrl)}" alt="">
        <img class="start-art-bit" src="${escapeHtml(quizData.bits[0].imageUrl)}" alt="">
      </div>
      <dl class="start-rules" aria-label="チャレンジルール">
        <div>
          <dt>モード</dt>
          <dd>∞<span>まで</span></dd>
        </div>
        <div>
          <dt><ruby>制限<rt aria-hidden="true">せいげん</rt></ruby></dt>
          <dd>${INITIAL_TIME_LIMIT_SECONDS}<span>→${EXPERT_TIME_LIMIT_SECONDS}秒</span></dd>
        </div>
        <div>
          <dt><ruby>記録<rt aria-hidden="true">きろく</rt></ruby></dt>
          <dd>TOP<span>1</span></dd>
        </div>
      </dl>
      ${renderRankingPanel()}
      <button class="primary-action" type="button" data-start>
        START
      </button>
      <p class="source-note"><ruby>画像<rt aria-hidden="true">がぞう</rt></ruby>: タカラトミー<ruby>公式<rt aria-hidden="true">こうしき</rt></ruby>サイト</p>
      <p class="disclaimer-note">
        <ruby>非公式<rt aria-hidden="true">ひこうしき</rt></ruby>ファンメイドアプリです<br>
        <span>Not affiliated with TAKARA TOMY</span>
      </p>
    </section>
  `;

  app.querySelector('[data-start]').addEventListener('click', startGame);
  wireRankingTabs();
}

function startGame() {
  try {
    clearQuestionTimer();
    quiz = createStreakQuiz(quizData.items, {
      optionsPerQuestion: OPTIONS_PER_QUESTION,
      seed: `${Date.now()}-${Math.random()}`,
    });
    // 全国ランキング用セッションは撃ちっぱなし。プレイはブロックしない。
    sessionPromise = isGlobalRankingEnabled(CONFIG)
      ? createSession(CONFIG).catch(() => null)
      : null;
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
  const timeLimitSeconds = getQuestionTimeLimitSeconds(quiz);
  const timerText = question.isTimedOut
    ? '<ruby>時間切れ<rt aria-hidden="true">じかんぎれ</rt></ruby>'
    : question.selectedId
      ? 'ストップ'
      : `${timeLimitSeconds}<ruby>秒<rt aria-hidden="true">びょう</rt></ruby>`;
  const timerMode = quiz.score >= EXPERT_TIME_START_SCORE ? 'EXPERT' : `${EXPERT_TIME_START_SCORE}問後5秒`;

  return `
    <div class="timer-panel${question.isTimedOut ? ' is-time-up' : ''}" aria-live="polite">
      <span><ruby>残<rt aria-hidden="true">のこ</rt></ruby>り</span>
      <strong data-timer-text>${timerText}</strong>
      <span class="timer-mode">${timerMode}</span>
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
  const canSaveScore = result.score > 0;
  const resultClass = canSaveScore ? 'passed' : 'failed';
  const headline = isFirstPlaceScore(result.score, leaderboard) ? 'NEW RECORD' : 'GAME OVER';
  const message = canSaveScore
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
      ${canSaveScore ? renderNameEntryForm(result.score) : renderLeaderboard(leaderboard)}
      <button class="primary-action" type="button" data-restart>もう一回</button>
    </section>
  `;

  app.querySelector('[data-restart]').addEventListener('click', startGame);
  const form = app.querySelector('[data-ranking-form]');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      handleScoreSubmit(form, result.score);
    });
  }
}

async function handleScoreSubmit(form, score) {
  const name = String(new FormData(form).get('player-name') ?? '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);

  if (!name) {
    return;
  }

  setFormBusy(form, true);

  const updatedLeaderboard = saveLeaderboardEntry(localStorage, { name, score });
  const globalResult = await sendGlobalScore({ name, score });

  renderSavedRanking(updatedLeaderboard, globalResult);
}

async function sendGlobalScore({ name, score }) {
  if (!isGlobalRankingEnabled(CONFIG)) {
    return { enabled: false, rank: null, failed: false };
  }

  const token = await (sessionPromise ?? Promise.resolve(null));
  // トークンは1回きり。二重送信を防ぐ。
  sessionPromise = null;

  if (!token) {
    return { enabled: true, rank: null, failed: true };
  }

  const response = await submitScore(CONFIG, { token, name, score });
  if (!response?.ok) {
    return { enabled: true, rank: null, failed: true };
  }

  // 送信できたら全国ランキングのキャッシュを捨てて次回再取得させる
  globalRankingState = { status: 'idle', entries: [] };
  return { enabled: true, rank: response.rank, failed: false };
}

function setFormBusy(form, isBusy) {
  const submitButton = form.querySelector('button[type="submit"]');
  const input = form.querySelector('input');

  if (submitButton) {
    submitButton.disabled = isBusy;
    if (isBusy) {
      submitButton.textContent = 'おくっています…';
    }
  }

  if (input) {
    input.disabled = isBusy;
  }
}

function renderSavedRanking(leaderboard, globalResult = { enabled: false, rank: null, failed: false }) {
  app.innerHTML = `
    <section class="result-screen passed">
      <p class="eyebrow">RANKING SAVED</p>
      <h1><ruby>保存<rt aria-hidden="true">ほぞん</rt></ruby>したよ</h1>
      ${renderGlobalResultNote(globalResult)}
      ${renderLeaderboard(leaderboard)}
      <button class="primary-action" type="button" data-restart>もう一回</button>
      <button class="secondary-action" type="button" data-title><ruby>タイトル<rt aria-hidden="true">たいとる</rt></ruby>へ</button>
    </section>
  `;

  app.querySelector('[data-restart]').addEventListener('click', startGame);
  app.querySelector('[data-title]').addEventListener('click', renderStart);
}

function renderGlobalResultNote(globalResult) {
  if (!globalResult?.enabled) {
    return '';
  }

  if (globalResult.failed) {
    return `
      <p class="global-note is-failed">
        <ruby>全国<rt aria-hidden="true">ぜんこく</rt></ruby>ランキングにつながらないよ。この<ruby>端末<rt aria-hidden="true">たんまつ</rt></ruby>には<ruby>保存<rt aria-hidden="true">ほぞん</rt></ruby>できたよ。
      </p>
    `;
  }

  if (Number.isInteger(globalResult.rank)) {
    return `
      <p class="global-note is-ranked">
        ぜんこく<strong>${globalResult.rank}</strong><ruby>位<rt aria-hidden="true">い</rt></ruby>！
      </p>
    `;
  }

  return `
    <p class="global-note is-ranked">
      ぜんこくランキングに<ruby>登録<rt aria-hidden="true">とうろく</rt></ruby>したよ！
    </p>
  `;
}

function renderNameEntryForm(score) {
  return `
    <form class="ranking-form" data-ranking-form>
      <label for="player-name"><ruby>名前<rt aria-hidden="true">なまえ</rt></ruby>をいれてね</label>
      <input id="player-name" name="player-name" maxlength="${MAX_NAME_LENGTH}" autocomplete="nickname" required placeholder="NAME">
      <button class="primary-action compact" type="submit">${score}<ruby>問<rt aria-hidden="true">もん</rt></ruby>で<ruby>保存<rt aria-hidden="true">ほぞん</rt></ruby></button>
    </form>
  `;
}

function renderRankingPanel() {
  if (!isGlobalRankingEnabled(CONFIG)) {
    return renderLeaderboard(getLeaderboard());
  }

  return `
    <section class="leaderboard has-tabs" aria-label="ランキング" data-ranking-panel>
      <div class="leaderboard-head">
        <p class="eyebrow">RANKING</p>
        <div class="ranking-tabs" role="tablist">
          <button class="ranking-tab${rankingTab === 'global' ? ' is-active' : ''}" type="button" role="tab" aria-selected="${rankingTab === 'global'}" data-ranking-tab="global">ぜんこく</button>
          <button class="ranking-tab${rankingTab === 'local' ? ' is-active' : ''}" type="button" role="tab" aria-selected="${rankingTab === 'local'}" data-ranking-tab="local">このたんまつ</button>
        </div>
      </div>
      <div data-ranking-body>${renderRankingBody()}</div>
    </section>
  `;
}

function renderRankingBody() {
  if (rankingTab === 'local') {
    return `
      <p class="ranking-caption">LOCAL TOP 5</p>
      ${renderRankingList(getLeaderboard())}
    `;
  }

  if (globalRankingState.status === 'loading') {
    return `
      <p class="ranking-caption">NATIONAL TOP 30</p>
      <p class="ranking-status">よみこみちゅう…</p>
    `;
  }

  if (globalRankingState.status === 'error') {
    return `
      <p class="ranking-caption">NATIONAL TOP 30</p>
      <p class="ranking-status is-error">つながらないよ。あとでもういちどためしてね。</p>
    `;
  }

  return `
    <p class="ranking-caption">NATIONAL TOP 30</p>
    ${renderRankingList(globalRankingState.entries)}
  `;
}

function renderRankingList(entries) {
  const rows = entries.length > 0
    ? entries.map((entry, index) => `
        <li>
          <span>${index + 1}</span>
          <strong>${escapeHtml(entry.name)}</strong>
          <em>${escapeHtml(entry.score)}<ruby>問<rt aria-hidden="true">もん</rt></ruby></em>
        </li>
      `).join('')
    : '<li class="empty-ranking"><strong>NO RECORD</strong><em>まだ記録なし</em></li>';

  return `<ol>${rows}</ol>`;
}

function wireRankingTabs() {
  const panel = app.querySelector('[data-ranking-panel]');
  if (!panel) {
    return;
  }

  for (const button of panel.querySelectorAll('[data-ranking-tab]')) {
    button.addEventListener('click', () => {
      rankingTab = button.dataset.rankingTab;
      updateRankingPanel();
      if (rankingTab === 'global') {
        ensureGlobalRanking();
      }
    });
  }

  if (rankingTab === 'global') {
    ensureGlobalRanking();
  }
}

function updateRankingPanel() {
  const panel = app.querySelector('[data-ranking-panel]');
  if (!panel) {
    return;
  }

  for (const button of panel.querySelectorAll('[data-ranking-tab]')) {
    const isActive = button.dataset.rankingTab === rankingTab;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  }

  const body = panel.querySelector('[data-ranking-body]');
  if (body) {
    body.innerHTML = renderRankingBody();
  }
}

async function ensureGlobalRanking() {
  if (globalRankingState.status === 'loading' || globalRankingState.status === 'ready') {
    return;
  }

  globalRankingState = { status: 'loading', entries: [] };
  updateRankingPanel();

  const entries = await fetchRanking(CONFIG);
  globalRankingState = entries
    ? { status: 'ready', entries }
    : { status: 'error', entries: [] };

  updateRankingPanel();
}

function renderLeaderboard(leaderboard) {
  return `
    <section class="leaderboard" aria-label="ランキング">
      <div class="leaderboard-head">
        <p class="eyebrow">RANKING</p>
        <span>LOCAL TOP 5</span>
      </div>
      ${renderRankingList(leaderboard)}
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
  timerDeadline = Date.now() + getQuestionTimeLimitSeconds(quiz) * 1000;
  updateQuestionTimer();
  timerInterval = window.setInterval(updateQuestionTimer, 100);
}

function updateQuestionTimer() {
  const currentQuestion = quiz ? getCurrentQuestion(quiz) : null;
  if (!currentQuestion || currentQuestion.selectedId || quiz.status !== 'playing') {
    clearQuestionTimer();
    return;
  }

  const duration = getQuestionTimeLimitSeconds(quiz) * 1000;
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
