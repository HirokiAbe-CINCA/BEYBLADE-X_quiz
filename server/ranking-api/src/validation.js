import { MAX_NAME_LENGTH, MAX_SCORE, MIN_SCORE } from './config.js';

/**
 * name: trim後 1〜MAX_NAME_LENGTH 文字。
 * 文字数は Array.from でコードポイント単位に数える（絵文字・サロゲートペア対策）。
 * @returns {{ok: true, value: string} | {ok: false, message: string}}
 */
export function validateName(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, message: 'name must be a string' };
  }
  const value = raw.trim();
  const length = Array.from(value).length;
  if (length < 1 || length > MAX_NAME_LENGTH) {
    return { ok: false, message: `name must be 1-${MAX_NAME_LENGTH} characters after trim` };
  }
  // 制御文字は保存前に弾く（ランキング表示崩れ防止）
  if (/[\p{Cc}\p{Cf}]/u.test(value)) {
    return { ok: false, message: 'name must not contain control characters' };
  }
  return { ok: true, value };
}

/**
 * score: 整数 MIN_SCORE〜MAX_SCORE。
 * @returns {{ok: true, value: number} | {ok: false, message: string}}
 */
export function validateScore(raw) {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    return { ok: false, message: 'score must be an integer' };
  }
  if (raw < MIN_SCORE || raw > MAX_SCORE) {
    return { ok: false, message: `score must be between ${MIN_SCORE} and ${MAX_SCORE}` };
  }
  return { ok: true, value: raw };
}
