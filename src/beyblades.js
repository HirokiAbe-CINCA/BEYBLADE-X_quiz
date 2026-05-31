const LINEUP_IMAGE_BASE = 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/';
const LINEUP_PAGE_BASE = 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/';

export const BEYBLADE_X_BLADES = [
  blade('bx-01', 'BX-01', 'BX', 'ドランソード', 'ドランソード3-60F', 'bx01'),
  blade('bx-02', 'BX-02', 'BX', 'ヘルズサイズ', 'ヘルズサイズ4-60T', 'bx02'),
  blade('bx-03', 'BX-03', 'BX', 'ウィザードアロー', 'ウィザードアロー4-80B', 'bx03'),
  blade('bx-04', 'BX-04', 'BX', 'ナイトシールド', 'ナイトシールド3-80N', 'bx04'),
  blade('bx-13', 'BX-13', 'BX', 'ナイトランス', 'ナイトランス4-80HN', 'bx13'),
  blade('bx-15', 'BX-15', 'BX', 'レオンクロー', 'レオンクロー5-60P', 'bx15'),
  blade('bx-19', 'BX-19', 'BX', 'ライノホーン', 'ライノホーン3-80S', 'bx19'),
  blade('bx-23', 'BX-23', 'BX', 'フェニックスウイング', 'フェニックスウイング9-60GF', 'bx23'),
  blade('bx-26', 'BX-26', 'BX', 'ユニコーンスティング', 'ユニコーンスティング5-60GP', 'bx26'),
  blade('bx-33', 'BX-33', 'BX', 'ヴァイスタイガー', 'ヴァイスタイガー3-60U', 'bx33'),
  blade('bx-34', 'BX-34', 'BX', 'コバルトドラグーン', 'コバルトドラグーン2-60C', 'bx34'),
  blade('bx-38', 'BX-38', 'BX', 'クリムゾンガルーダ', 'クリムゾンガルーダ4-70TP', 'bx38'),
  blade('bx-44', 'BX-44', 'BX', 'トリケラプレス', 'トリケラプレスM-85BS', 'bx44'),
  blade('bx-45', 'BX-45', 'BX', 'サムライカリバー', 'サムライカリバー6-70M', 'bx45'),
  blade('bx-49', 'BX-49', 'BX', 'ドランストライク', 'ドランストライク4-50FF', 'bx49'),
  blade('ux-01', 'UX-01', 'UX', 'ドランバスター', 'ドランバスター1-60A', 'ux01'),
  blade('ux-02', 'UX-02', 'UX', 'ヘルズハンマー', 'ヘルズハンマー3-70H', 'ux02'),
  blade('ux-03', 'UX-03', 'UX', 'ウィザードロッド', 'ウィザードロッド5-70DB', 'ux03'),
  blade('ux-06', 'UX-06', 'UX', 'レオンクレスト', 'レオンクレスト7-60GN', 'ux06'),
  blade('ux-08', 'UX-08', 'UX', 'シルバーウルフ', 'シルバーウルフ3-80FB', 'ux08'),
  blade('ux-09', 'UX-09', 'UX', 'サムライセイバー', 'サムライセイバー2-70L', 'ux09'),
  blade('ux-11', 'UX-11', 'UX', 'インパクトドレイク', 'インパクトドレイク9-60LR', 'ux11'),
  blade('ux-14', 'UX-14', 'UX', 'スコーピオスピア', 'スコーピオスピア0-70Z', 'ux14'),
  blade('ux-17', 'UX-17', 'UX', 'メテオドラグーン', 'メテオドラグーン3-70J', 'ux17'),
  blade('ux-19', 'UX-19', 'UX', 'バレットグリフォン', 'バレットグリフォンH', 'ux19'),
  blade('cx-01', 'CX-01', 'CX', 'ドランブレイブ', 'ドランブレイブS6-60V', 'cx01'),
  blade('cx-02', 'CX-02', 'CX', 'ウィザードアーク', 'ウィザードアークR4-55LO', 'cx02'),
  blade('cx-03', 'CX-03', 'CX', 'ペルセウスダーク', 'ペルセウスダークB6-80W', 'cx03'),
  blade('cx-07', 'CX-07', 'CX', 'ペガサスブラスト', 'ペガサスブラストATr', 'cx07'),
  blade('cx-09', 'CX-09', 'CX', 'ソルエクリプス', 'ソルエクリプスD5-70TK', 'cx09'),
  blade('cx-10', 'CX-10', 'CX', 'ウルフハント', 'ウルフハントF0-60DB', 'cx10'),
  blade('cx-12', 'CX-12', 'CX', 'フェニックスフレア', 'フェニックスフレアZ9-80WW', 'cx12'),
  blade('cx-13', 'CX-13', 'CX', 'バハムートブリッツ', 'バハムートブリッツBK1-50I', 'cx13'),
  blade('cx-14', 'CX-14', 'CX', 'ナイトフォートレス', 'ナイトフォートレスGV8-70UN', 'cx14'),
  blade('cx-15', 'CX-15', 'CX', 'ラグナレイジ', 'ラグナレイジFE4-55Y', 'cx15'),
];

export const BEYBLADE_X_RATCHETS = [
  ratchet('bx-01-ratchet', 'BX-01', 'BX', '3-60', 'bx01'),
  ratchet('bx-02-ratchet', 'BX-02', 'BX', '4-60', 'bx02'),
  ratchet('bx-03-ratchet', 'BX-03', 'BX', '4-80', 'bx03'),
  ratchet('bx-04-ratchet', 'BX-04', 'BX', '3-80', 'bx04'),
  ratchet('bx-15-ratchet', 'BX-15', 'BX', '5-60', 'bx15'),
  ratchet('bx-23-ratchet', 'BX-23', 'BX', '9-60', 'bx23'),
  ratchet('bx-34-ratchet', 'BX-34', 'BX', '2-60', 'bx34'),
  ratchet('ux-01-ratchet', 'UX-01', 'UX', '1-60', 'ux01'),
  ratchet('ux-02-ratchet', 'UX-02', 'UX', '3-70', 'ux02'),
  ratchet('ux-03-ratchet', 'UX-03', 'UX', '5-70', 'ux03'),
  ratchet('ux-06-ratchet', 'UX-06', 'UX', '7-60', 'ux06'),
];

export const BEYBLADE_X_BITS = [
  bit('bx-01-bit', 'BX-01', 'BX', 'F（フラット）', 'bx01'),
  bit('bx-02-bit', 'BX-02', 'BX', 'T（テーパー）', 'bx02'),
  bit('bx-03-bit', 'BX-03', 'BX', 'B（ボール）', 'bx03'),
  bit('bx-04-bit', 'BX-04', 'BX', 'N（ニードル）', 'bx04'),
  bit('bx-15-bit', 'BX-15', 'BX', 'P（ポイント）', 'bx15'),
  bit('bx-23-bit', 'BX-23', 'BX', 'GF（ギヤフラット）', 'bx23'),
  bit('bx-33-bit', 'BX-33', 'BX', 'U（ユナイト）', 'bx33'),
  bit('bx-34-bit', 'BX-34', 'BX', 'C（サイクロン）', 'bx34'),
  bit('ux-01-bit', 'UX-01', 'UX', 'A（アクセル）', 'ux01'),
  bit('ux-02-bit', 'UX-02', 'UX', 'H（ヘキサ）', 'ux02'),
  bit('ux-03-bit', 'UX-03', 'UX', 'DB（ディスクボール）', 'ux03'),
  bit('ux-06-bit', 'UX-06', 'UX', 'GN（ギヤニードル）', 'ux06'),
];

export const BEYBLADE_X_QUIZ_ITEMS = [
  ...BEYBLADE_X_BLADES,
  ...BEYBLADE_X_RATCHETS,
  ...BEYBLADE_X_BITS,
];

function blade(id, code, line, bladeName, productName, slug) {
  const imageCode = code.replace('-', '');

  return {
    id,
    code,
    line,
    type: 'blade',
    partLabel: 'ブレード',
    questionText: 'このブレードは？',
    name: bladeName,
    choiceLabel: bladeName,
    bladeName,
    productName,
    imageUrl: `${LINEUP_IMAGE_BASE}${imageCode}_01@1.png`,
    sourceUrl: `${LINEUP_PAGE_BASE}${slug}.html`,
  };
}

function ratchet(id, code, line, name, slug) {
  return part(id, code, line, 'ratchet', 'ラチェット', 'このラチェットは？', name, slug, '03');
}

function bit(id, code, line, name, slug) {
  return part(id, code, line, 'bit', 'ビット', 'このビットは？', name, slug, '04');
}

function part(id, code, line, type, partLabel, questionText, name, slug, imageIndex) {
  const imageCode = code.replace('-', '');

  return {
    id,
    code,
    line,
    type,
    partLabel,
    questionText,
    name,
    choiceLabel: name,
    productName: name,
    imageUrl: `${LINEUP_IMAGE_BASE}${imageCode}_${imageIndex}@1.png`,
    sourceUrl: `${LINEUP_PAGE_BASE}${slug}.html`,
  };
}
