/**
 * スキーマ検証と安全弁（純粋関数）。docs/architecture.md 準拠。
 * 1. スキーマ検証: 全アイテムが必須フィールドを満たす
 * 2. 件数ガード: 新データの件数が現行以上、かつ1回の増加は +MAX_INCREASE 件以内
 * いずれか失敗時は更新中止（呼び出し側が exit 1）。
 */

export const MAX_INCREASE = 20;

const LINES = new Set(['BX', 'UX', 'CX']);
const TYPES = {
  blade: 'ブレード',
  ratchet: 'ラチェット',
  bit: 'ビット',
};

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isHttpsUrl(v) {
  if (!isNonEmptyString(v)) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 1アイテムのスキーマ検証。
 * @returns {string[]} 違反メッセージ（空配列 = OK）
 */
export function validateItem(item) {
  const errors = [];
  if (!item || typeof item !== 'object') return ['item is not an object'];

  for (const field of ['id', 'code', 'line', 'type', 'partLabel', 'questionText', 'name', 'choiceLabel', 'productName']) {
    if (!isNonEmptyString(item[field])) errors.push(`${field} が空`);
  }
  if (isNonEmptyString(item.code) && !/^(BX|UX|CX)-[0-9]{2,3}$/.test(item.code)) {
    errors.push(`code の形式不正: ${item.code}`);
  }
  if (isNonEmptyString(item.line) && !LINES.has(item.line)) {
    errors.push(`line の値不正: ${item.line}`);
  }
  if (isNonEmptyString(item.type)) {
    const label = TYPES[item.type];
    if (!label) errors.push(`type の値不正: ${item.type}`);
    else if (item.partLabel !== label) errors.push(`partLabel が type と不一致: ${item.partLabel}`);
  }
  if (item.type === 'blade' && !isNonEmptyString(item.bladeName)) {
    errors.push('blade に bladeName が無い');
  }
  if (!isHttpsUrl(item.imageUrl)) errors.push(`imageUrl 不正: ${item.imageUrl}`);
  if (!isHttpsUrl(item.sourceUrl)) errors.push(`sourceUrl 不正: ${item.sourceUrl}`);
  return errors;
}

/**
 * データセット全体の検証＋安全弁。
 * @param {object} currentData 現行データ（{items: []}）
 * @param {object} nextData 新データ（{version, updatedAt, source, items: []}）
 * @returns {{ok: boolean, violations: string[]}}
 */
export function checkSafety(currentData, nextData, { maxIncrease = MAX_INCREASE } = {}) {
  const violations = [];

  const cur = currentData?.items;
  const next = nextData?.items;
  if (!Array.isArray(cur)) violations.push('現行データの items が配列でない');
  if (!Array.isArray(next)) violations.push('新データの items が配列でない');
  if (violations.length > 0) return { ok: false, violations };

  if (!Number.isInteger(nextData.version)) violations.push('version が整数でない');
  if (!isNonEmptyString(nextData.updatedAt) || Number.isNaN(Date.parse(nextData.updatedAt))) {
    violations.push('updatedAt がISO8601でない');
  }
  if (!isNonEmptyString(nextData.source)) violations.push('source が空');

  // スキーマ検証全件
  for (const item of next) {
    const errs = validateItem(item);
    for (const e of errs) violations.push(`item ${item?.id ?? '?'}: ${e}`);
  }

  // id 重複
  const ids = new Set();
  for (const item of next) {
    if (ids.has(item?.id)) violations.push(`id 重複: ${item.id}`);
    ids.add(item?.id);
  }

  // 件数ガード
  if (next.length < cur.length) {
    violations.push(`件数減少: 現行${cur.length}件 → 新${next.length}件`);
  }
  if (next.length - cur.length > maxIncrease) {
    violations.push(`増加が+${maxIncrease}件を超過: +${next.length - cur.length}件`);
  }

  // 現行アイテムが欠落していないこと（追加のみを許可）
  const nextIds = new Set(next.map((i) => i?.id));
  for (const item of cur) {
    if (!nextIds.has(item.id)) violations.push(`現行アイテムが欠落: ${item.id}`);
  }

  return { ok: violations.length === 0, violations };
}
