import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidates, imageUrlCandidates } from '../src/build.js';

const CURRENT = [
  {
    id: 'bx-01', code: 'BX-01', line: 'BX', type: 'blade', partLabel: 'ブレード',
    questionText: 'このブレードは？', name: 'ドランソード', choiceLabel: 'ドランソード',
    bladeName: 'ドランソード', productName: 'ドランソード3-60F',
    imageUrl: 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/BX01_01@1.png',
    sourceUrl: 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/bx01.html',
  },
  {
    id: 'bx-01-ratchet', code: 'BX-01', line: 'BX', type: 'ratchet', partLabel: 'ラチェット',
    questionText: 'このラチェットは？', name: '3-60', choiceLabel: '3-60', productName: '3-60',
    imageUrl: 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/BX01_03@1.png',
    sourceUrl: 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/bx01.html',
  },
  {
    id: 'bx-01-bit', code: 'BX-01', line: 'BX', type: 'bit', partLabel: 'ビット',
    questionText: 'このビットは？', name: 'F（フラット）', choiceLabel: 'F（フラット）',
    productName: 'F（フラット）',
    imageUrl: 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/BX01_04@1.png',
    sourceUrl: 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/bx01.html',
  },
];

test('新ベイからblade/ratchet/bitの3アイテムが生成される（辞書登録済みビット）', () => {
  const entries = [
    { code: 'UX-30', name: 'テストロック1-60GN', category: 'ブースター', slug: 'ux30.html' },
  ];
  const { candidates, skipped, excluded, dictionaryMissing } = buildCandidates(CURRENT, entries);
  assert.equal(excluded.length, 0);
  assert.equal(skipped.length, 0);
  assert.deepEqual(dictionaryMissing, []);
  assert.equal(candidates.length, 3);

  const blade = candidates.find((c) => c.item.type === 'blade').item;
  assert.equal(blade.id, 'ux-30');
  assert.equal(blade.line, 'UX');
  assert.equal(blade.name, 'テストロック');
  assert.equal(blade.bladeName, 'テストロック');
  assert.equal(blade.productName, 'テストロック1-60GN');
  assert.equal(blade.partLabel, 'ブレード');
  assert.equal(blade.sourceUrl, 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/ux30.html');

  const ratchet = candidates.find((c) => c.item.type === 'ratchet').item;
  assert.equal(ratchet.id, 'ux-30-ratchet');
  assert.equal(ratchet.name, '1-60');

  const bit = candidates.find((c) => c.item.type === 'bit').item;
  assert.equal(bit.id, 'ux-30-bit');
  assert.equal(bit.name, 'GN（ギヤニードル）');
});

test('辞書に無いビットは登録されず保留＋辞書追加の通知対象', () => {
  const entries = [
    // 架空の未知ビットZZ（実在ビットは辞書追加され次第このテストの対象外になるため架空にする）
    { code: 'UX-96', name: 'テストロック1-60ZZ', category: 'ブースター', slug: 'ux96.html' },
  ];
  const { candidates, skipped, dictionaryMissing } = buildCandidates(CURRENT, entries);

  // ブレードとラチェットは登録、ビットZZは保留
  assert.deepEqual(
    candidates.map((c) => `${c.item.type}:${c.item.name}`).sort(),
    ['blade:テストロック', 'ratchet:1-60'],
  );
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].code, 'UX-96');
  assert.match(skipped[0].reason, /辞書に未登録のため保留/);
  assert.deepEqual(dictionaryMissing, ['ZZ']);
});

test('辞書登録済みビットUN（アンダーニードル）は自動登録される（UX-13 ゴーレムロック1-60UN）', () => {
  const entries = [
    { code: 'UX-13', name: 'ゴーレムロック1-60UN', category: 'ブースター', slug: 'ux13.html' },
  ];
  const { candidates, skipped, dictionaryMissing } = buildCandidates(CURRENT, entries);

  assert.deepEqual(
    candidates.map((c) => `${c.item.type}:${c.item.name}`).sort(),
    ['bit:UN（アンダーニードル）', 'blade:ゴーレムロック', 'ratchet:1-60'],
  );
  assert.equal(skipped.length, 0);
  assert.deepEqual(dictionaryMissing, []);
});

test('CX系の新商品はブレードのみ登録、ラチェット・ビットはcx-parts-holdで保留', () => {
  const entries = [
    { code: 'CX-20', name: 'テストブレイブS7-75V', category: 'スターター', slug: 'cx20.html' },
  ];
  const { candidates, skipped } = buildCandidates(CURRENT, entries);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].item.type, 'blade');
  assert.equal(candidates[0].item.name, 'テストブレイブ');
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /^cx-parts-hold/);
  assert.match(skipped[0].reason, /7-75/);
  assert.match(skipped[0].reason, /V/);
});

test('CX以外でもアシストブレード構成ならラチェット・ビットは保留', () => {
  const entries = [
    // 仮想ケース: BXコードだがアシストブレード英字あり
    { code: 'BX-96', name: 'テストセイバーW7-75T', category: 'ブースター', slug: 'bx96.html' },
  ];
  const { candidates, skipped } = buildCandidates(CURRENT, entries);
  assert.deepEqual(candidates.map((c) => c.item.type), ['blade']);
  assert.equal(skipped.filter((s) => /^cx-parts-hold/.test(s.reason)).length, 1);
});

test('辞書にあるビットは「X（名称）」形式で生成される', () => {
  const entries = [
    { code: 'BX-90', name: 'テストブレード7-70T', category: 'スターター', slug: 'bx90.html' },
  ];
  const { candidates } = buildCandidates(CURRENT, entries);
  const bit = candidates.find((c) => c.item.type === 'bit').item;
  assert.equal(bit.name, 'T（テーパー）');
});

test('既存と同名のラチェット・ビットは追加されない', () => {
  const entries = [
    // ラチェット3-60・ビットFは既存
    { code: 'BX-91', name: 'テストブレード3-60F', category: 'スターター', slug: 'bx91.html' },
  ];
  const { candidates } = buildCandidates(CURRENT, entries);
  assert.deepEqual(candidates.map((c) => c.item.type), ['blade']);
});

test('既存と同名のブレード（再録・色替え）はスキップされ通知される', () => {
  const entries = [
    { code: 'BX-05', name: 'ドランソード3-60F', category: 'ブースター', slug: 'bx05.html' },
  ];
  const { candidates, skipped } = buildCandidates(CURRENT, entries);
  assert.equal(candidates.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /重複/);
});

test('既存コードの商品は対象外', () => {
  const entries = [
    { code: 'BX-01', name: 'ドランソード3-60F', category: 'スターター', slug: 'bx01.html' },
  ];
  const { candidates, skipped, excluded } = buildCandidates(CURRENT, entries);
  assert.equal(candidates.length, 0);
  assert.equal(skipped.length, 0);
  assert.equal(excluded.length, 0);
});

test('分解不能な商品名はスキップされ通知される', () => {
  const entries = [
    { code: 'BX-92', name: 'ドランソード3-60Fエントリーパッケージ', category: 'スターター', slug: 'bx92.html' },
  ];
  // 「パッケージ」キーワードで除外される（classify側）
  const { candidates, excluded } = buildCandidates(CURRENT, entries);
  assert.equal(candidates.length, 0);
  assert.equal(excluded.length, 1);
});

test('一体型はブレードのみ生成される', () => {
  const entries = [
    { code: 'UX-20', name: 'グローリーワルキューレLF', category: 'スターター', slug: 'ux20.html' },
  ];
  const { candidates } = buildCandidates(CURRENT, entries);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].item.type, 'blade');
  assert.equal(candidates[0].item.name, 'グローリーワルキューレ');
});

test('同一実行内でラチェット・ビット・ブレード名が重複しない', () => {
  const entries = [
    { code: 'BX-93', name: 'アルファテスト5-80T', category: 'スターター', slug: 'bx93.html' },
    { code: 'BX-94', name: 'ベータテスト5-80T', category: 'ブースター', slug: 'bx94.html' },
    { code: 'BX-95', name: 'アルファテスト9-99B', category: 'ブースター', slug: 'bx95.html' },
  ];
  const { candidates, skipped } = buildCandidates(CURRENT, entries);
  const ratchets = candidates.filter((c) => c.item.type === 'ratchet');
  const bits = candidates.filter((c) => c.item.type === 'bit');
  const blades = candidates.filter((c) => c.item.type === 'blade');
  assert.equal(ratchets.length, 2); // 5-80 と 9-99
  assert.equal(bits.length, 2); // T と B（辞書登録済み。BX-94のTは重複で追加なし）
  assert.equal(blades.length, 2); // アルファテスト重複はスキップ
  assert.equal(skipped.filter((s) => /重複/.test(s.reason)).length, 1);
});

test('カテゴリ欠落のエントリは保留（skipped）に回る', () => {
  const entries = [
    { code: 'BX-97', name: 'テストソード3-65T', category: '', slug: 'bx97.html' },
  ];
  const { candidates, skipped, excluded } = buildCandidates(CURRENT, entries);
  assert.equal(candidates.length, 0);
  assert.equal(excluded.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /カテゴリ欠落/);
});

test('画像URL候補は大文字規約（既存データ準拠）→小文字規約（doc準拠）の順', () => {
  assert.deepEqual(imageUrlCandidates('UX-13', '01'), [
    'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/UX13_01@1.png',
    'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/ux13_01@1.png',
  ]);
});
