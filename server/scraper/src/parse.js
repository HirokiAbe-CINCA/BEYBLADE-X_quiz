/**
 * 商品名の分解（純粋関数）。
 *
 * 標準形:   <ブレード名><ラチェット><ビット>            例: ドランソード3-60F
 * CX系:     <ブレード名><アシストブレード英字><ラチェット><ビット>
 *                                                       例: ドランブレイブS6-60V
 * 一体型:   ラチェット表記なし（末尾に英字のみ）        例: バレットグリフォンH
 *
 * ラチェット: `X-NN`（X は数字1桁または英大文字1文字、NN は数字2桁）例: 3-60, 9-60, M-85
 * ビット:     末尾の英字1〜3文字（先頭は大文字）例: F, GF, TP, WW, LR, FB
 *
 * 分解できない商品名は { ok: false, reason } を返す。呼び出し側は推測で登録せず
 * スキップして通知に含めること。
 */

// ラチェットの区切りに使われうるハイフン類（全角・各種ダッシュ・半角長音記号）。
// カタカナの長音「ー」はブレード名に頻出するため、英数字と数字2桁に挟まれた
// 位置に限って区切りとして扱う（normalizeName 参照）。
const HYPHEN_LIKE = 'ー－‐‑‒–—―−ｰ';

const RATCHET_RE = /[0-9A-Z]-[0-9]{2}/;

// 標準形 / CX系: ブレード名（最短一致・非ASCII必須）＋アシスト英字0〜2＋ラチェット＋ビット
const FULL_RE = /^(.+?)([A-Z]{0,2})([0-9A-Z]-[0-9]{2})([A-Z][A-Za-z]{0,2})$/;

// 一体型: ブレード名＋末尾英字1〜3文字（ラチェット表記なしの場合のみ適用）
const INTEGRATED_RE = /^(.+?)([A-Z][A-Za-z]{0,2})$/;

/**
 * 商品名を比較・分解可能な形に正規化する。
 * - NFKC（全角英数字→半角 等）
 * - 空白除去
 * - 「英数字 + ハイフン類 + 数字2桁」の並びに限りハイフンをASCII "-" に統一
 */
export function normalizeName(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.normalize('NFKC').replace(/\s+/g, '');
  s = s.replace(
    new RegExp(`([0-9A-Za-z])[${HYPHEN_LIKE}]([0-9]{2})`, 'g'),
    '$1-$2',
  );
  return s;
}

// ブレード名は純粋な和文（カタカナ・中黒等）であること。
// ASCII文字が混ざる場合（例: ダブルスターターの「…4-80B/サノス」）は
// ブレード名として信用しない。
function isPlausibleBladeName(s) {
  return s.length > 0 && /[^\x00-\x7F]/.test(s) && !/[\x21-\x7E]/.test(s);
}

/**
 * @param {string} rawName 商品名（例: "ドランブレイブS6-60V"）
 * @returns {{ok: true, blade: string, assist: string|null, ratchet: string|null,
 *            bit: string|null, integrated: boolean, normalized: string}
 *          | {ok: false, reason: string, normalized: string}}
 */
export function parseProductName(rawName) {
  const name = normalizeName(rawName);
  if (!name) {
    return { ok: false, reason: 'empty', normalized: name };
  }

  if (RATCHET_RE.test(name)) {
    const m = name.match(FULL_RE);
    if (!m) {
      // ラチェットらしき表記はあるが標準形に一致しない（例: 末尾に余計な語句）
      return { ok: false, reason: 'ratchet-like but not standard form', normalized: name };
    }
    const [, blade, assist, ratchet, bit] = m;
    if (!isPlausibleBladeName(blade)) {
      return { ok: false, reason: 'blade name is not pure Japanese', normalized: name };
    }
    return {
      ok: true,
      blade,
      assist: assist || null,
      ratchet,
      bit,
      integrated: false,
      normalized: name,
    };
  }

  // 一体型（ラチェット表記なし）
  const m = name.match(INTEGRATED_RE);
  if (!m) {
    return { ok: false, reason: 'no ratchet and no trailing bit letters', normalized: name };
  }
  const [, blade, tail] = m;
  if (!isPlausibleBladeName(blade)) {
    return { ok: false, reason: 'integrated form but blade name is suspicious', normalized: name };
  }
  return {
    ok: true,
    blade,
    assist: null,
    ratchet: null,
    // 一体型はブレードのみ登録するため、末尾英字はビットとして扱わない
    bit: null,
    integratedTail: tail,
    integrated: true,
    normalized: name,
  };
}
