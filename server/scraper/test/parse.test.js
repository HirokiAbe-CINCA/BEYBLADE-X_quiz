import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProductName, normalizeName } from '../src/parse.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(here, '../../../data/beyblades.json');

test('グラウンドトゥルース: data/beyblades.json の全ブレードproductNameを正しく分解できる', async () => {
  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const blades = data.items.filter((i) => i.type === 'blade');
  assert.equal(blades.length, 35, 'ブレードは35件のはず（データ更新時はこのテストも見直す）');

  for (const blade of blades) {
    const parsed = parseProductName(blade.productName);
    assert.equal(parsed.ok, true, `${blade.productName} を分解できない: ${parsed.reason ?? ''}`);
    assert.equal(
      parsed.blade,
      blade.bladeName,
      `${blade.productName} のブレード名が不一致: got ${parsed.blade}`,
    );
  }
});

test('グラウンドトゥルース: 既存ラチェット・ビットが分解結果と整合する', async () => {
  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const bladeByCode = new Map(
    data.items.filter((i) => i.type === 'blade').map((i) => [i.code, i]),
  );
  for (const item of data.items) {
    const blade = bladeByCode.get(item.code);
    if (!blade) continue;
    const parsed = parseProductName(blade.productName);
    if (item.type === 'ratchet') {
      assert.equal(parsed.ratchet, item.name, `${blade.productName} のラチェット不一致`);
    }
    if (item.type === 'bit') {
      const letters = item.name.split('（')[0];
      assert.equal(parsed.bit, letters, `${blade.productName} のビット不一致`);
    }
  }
});

const CASES = [
  // 標準形（BX/UX）
  ['ドランソード3-60F', { blade: 'ドランソード', assist: null, ratchet: '3-60', bit: 'F' }],
  ['ナイトランス4-80HN', { blade: 'ナイトランス', assist: null, ratchet: '4-80', bit: 'HN' }],
  ['フェニックスウイング9-60GF', { blade: 'フェニックスウイング', assist: null, ratchet: '9-60', bit: 'GF' }],
  // 英字始まりラチェット
  ['トリケラプレスM-85BS', { blade: 'トリケラプレス', assist: null, ratchet: 'M-85', bit: 'BS' }],
  // 0始まりラチェット
  ['スコーピオスピア0-70Z', { blade: 'スコーピオスピア', assist: null, ratchet: '0-70', bit: 'Z' }],
  // CX系（アシストブレード1文字）
  ['ドランブレイブS6-60V', { blade: 'ドランブレイブ', assist: 'S', ratchet: '6-60', bit: 'V' }],
  ['ウィザードアークR4-55LO', { blade: 'ウィザードアーク', assist: 'R', ratchet: '4-55', bit: 'LO' }],
  // CX系（アシストブレード2文字）
  ['バハムートブリッツBK1-50I', { blade: 'バハムートブリッツ', assist: 'BK', ratchet: '1-50', bit: 'I' }],
  ['ナイトフォートレスGV8-70UN', { blade: 'ナイトフォートレス', assist: 'GV', ratchet: '8-70', bit: 'UN' }],
  ['ラグナレイジFE4-55Y', { blade: 'ラグナレイジ', assist: 'FE', ratchet: '4-55', bit: 'Y' }],
  // ビット2文字（WW）
  ['フェニックスフレアZ9-80WW', { blade: 'フェニックスフレア', assist: 'Z', ratchet: '9-80', bit: 'WW' }],
];

for (const [name, expected] of CASES) {
  test(`分解: ${name}`, () => {
    const parsed = parseProductName(name);
    assert.equal(parsed.ok, true, parsed.reason);
    assert.equal(parsed.blade, expected.blade);
    assert.equal(parsed.assist, expected.assist);
    assert.equal(parsed.ratchet, expected.ratchet);
    assert.equal(parsed.bit, expected.bit);
    assert.equal(parsed.integrated, false);
  });
}

test('一体型: バレットグリフォンH はブレードのみ', () => {
  const parsed = parseProductName('バレットグリフォンH');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.integrated, true);
  assert.equal(parsed.blade, 'バレットグリフォン');
  assert.equal(parsed.ratchet, null);
  assert.equal(parsed.bit, null);
});

test('一体型: ペガサスブラストATr はブレードのみ', () => {
  const parsed = parseProductName('ペガサスブラストATr');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.integrated, true);
  assert.equal(parsed.blade, 'ペガサスブラスト');
});

test('分解不能: ラチェット風の表記があるが標準形でない → skip', () => {
  const cases = [
    'ドランソード3-60Fエントリーパッケージ', // 末尾に余計な語句
    'ヘルズサイズ4-60Tメタルコート:ゴールド',
    'マーベルアイアンマン4-80B/サノス4-60P', // ダブルスターター
  ];
  for (const name of cases) {
    const parsed = parseProductName(name);
    assert.equal(parsed.ok, false, `${name} は分解不能のはず`);
  }
});

test('分解不能: 末尾英字もラチェットも無い商品名 → skip', () => {
  for (const name of ['スタートダッシュセット', 'エクストリームスタジアム', '']) {
    const parsed = parseProductName(name);
    assert.equal(parsed.ok, false, `${name} は分解不能のはず`);
  }
});

test('正規化: 全角英数字・ハイフン類・空白を吸収する', () => {
  assert.equal(normalizeName('ドランソード３－６０Ｆ'), 'ドランソード3-60F');
  assert.equal(normalizeName('エアロペガサス3ｰ70A'), 'エアロペガサス3-70A');
  assert.equal(normalizeName('ドランソード 3-60F'), 'ドランソード3-60F');
  // カタカナ長音はブレード名の一部として保持される
  assert.equal(normalizeName('レオンクロー5-60P'), 'レオンクロー5-60P');
  const parsed = parseProductName('レオンクロー5-60P');
  assert.equal(parsed.blade, 'レオンクロー');
});
