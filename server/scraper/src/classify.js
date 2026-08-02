/**
 * ラインナップ商品の除外判定（純粋関数）。
 * ベイ本体（スターター/ブースター単品）以外は出題データに登録しない。
 * 疑わしきは除外し、通知に列挙して人間が後から確認できるようにする。
 */

// ベイ本体として扱うカテゴリ（ラインナップページの category 表記）
const BEY_CATEGORIES = new Set(['スターター', 'ブースター']);

// 商品名によるキーワード除外（カテゴリ表記が変わっても効く二重の網）
const EXCLUDE_KEYWORDS = [
  'スタジアム',
  'ランチャー',
  'ワインダー',
  'ケース', // デッキケース・ギアケースを含む
  'デッキケース',
  'バトルパス',
  'カスタマイズ', // カスタマイズセット・カスタムグリップ類
  'カスタム',
  'ランダムブースター',
  'セット', // デッキセット・エントリーセット・ビットセット等
  'グリップ',
  'ステッカー',
  'エンブレム',
  'パッケージ', // エントリーパッケージ・ライトパッケージ
];

// 限定・特殊流通品の目印。code が BX-00 / UX-00 / CX-00 の商品は
// 画像URL規約（<code>_01@1.png）が適用できないため登録しない。
const LIMITED_CODE_RE = /^(BX|UX|CX)-00$/;

/**
 * @param {{code: string, name: string, category?: string}} entry
 * @returns {{beyCandidate: true} | {beyCandidate: false, reason: string}}
 */
export function classifyEntry(entry) {
  const name = entry.name ?? '';
  const category = (entry.category ?? '').trim();

  if (LIMITED_CODE_RE.test(entry.code)) {
    return { beyCandidate: false, reason: '限定・特殊流通品（コード末尾00）' };
  }
  if (/【/.test(name) || /限定/.test(name)) {
    return { beyCandidate: false, reason: '限定・特殊流通品（商品名）' };
  }
  const hit = EXCLUDE_KEYWORDS.find((kw) => name.includes(kw));
  if (hit) {
    return { beyCandidate: false, reason: `除外キーワード「${hit}」` };
  }
  if (category && !BEY_CATEGORIES.has(category)) {
    // 未知のカテゴリも保守的に除外（通知で気付けるようにする）
    return { beyCandidate: false, reason: `カテゴリ「${category}」はベイ本体でない` };
  }
  return { beyCandidate: true };
}
