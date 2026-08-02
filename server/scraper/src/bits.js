/**
 * ビット名称辞書（既存データ由来）。
 * 辞書に無いビットは登録せず保留し、通知で辞書追加を促す。
 */
export const BIT_DICTIONARY = Object.freeze({
  F: 'フラット',
  T: 'テーパー',
  B: 'ボール',
  N: 'ニードル',
  P: 'ポイント',
  GF: 'ギヤフラット',
  U: 'ユナイト',
  C: 'サイクロン',
  A: 'アクセル',
  H: 'ヘキサ',
  DB: 'ディスクボール',
  GN: 'ギヤニードル',
  UN: 'アンダーニードル', // UX-13 ゴーレムロック1-60UN（公式レビュー等で表記確認済み）
});

/**
 * ビット表示名を返す。例: "F" → "F（フラット）"、辞書に無ければ "LR" → "LR"
 * @returns {{name: string, inDictionary: boolean}}
 */
export function bitDisplayName(letters) {
  const reading = BIT_DICTIONARY[letters];
  if (reading) return { name: `${letters}（${reading}）`, inDictionary: true };
  return { name: letters, inDictionary: false };
}

/**
 * ビット表示名からビット英字キーを取り出す。
 * "GF（ギヤフラット）" → "GF" / "LR" → "LR"
 */
export function bitKeyFromName(name) {
  return String(name).split('（')[0].trim();
}
