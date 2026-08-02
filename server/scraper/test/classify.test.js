import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyEntry } from '../src/classify.js';

test('ベイ本体（スターター/ブースター）は候補になる', () => {
  const cases = [
    { code: 'BX-01', name: 'ドランソード3-60F', category: 'スターター' },
    { code: 'UX-13', name: 'ゴーレムロック1-60UN', category: 'ブースター' },
    { code: 'CX-15', name: 'ラグナレイジFE4-55Y', category: 'ブースター' },
  ];
  for (const entry of cases) {
    assert.equal(classifyEntry(entry).beyCandidate, true, entry.name);
  }
});

test('ベイ本体でない商品はキーワードで除外される', () => {
  const cases = [
    ['BX-10', 'エクストリームスタジアム', 'ツール'],
    ['BX-11', 'ランチャーグリップ', 'ツール'],
    ['BX-40', 'ワインダーランチャーL', 'ツール'],
    ['BX-12', '3on3デッキケース', 'ツール'],
    ['BX-25', 'ギアケース', 'ツール'],
    ['BX-09', 'ベイバトルパス', 'ツール'],
    ['UX-10', 'カスタマイズセットU', 'セット'],
    ['BX-14', 'ランダムブースターVol.1', 'ランダムブースター'],
    ['BX-07', 'スタートダッシュセット', 'セット'],
    ['BX-17', 'バトルエントリーセット', 'セット'],
    ['BX-20', 'ドランダガーデッキセット', 'セット'],
    ['BX-22', 'ドランソード3-60Fエントリーパッケージ', 'スターター'],
  ];
  for (const [code, name, category] of cases) {
    const result = classifyEntry({ code, name, category });
    assert.equal(result.beyCandidate, false, `${name} は除外されるはず`);
    assert.ok(result.reason, '除外理由が付く');
  }
});

test('コード末尾00（限定・特殊流通品）は除外される', () => {
  const result = classifyEntry({
    code: 'CX-00',
    name: 'ティガレイジFT3-60T',
    category: 'スターター',
  });
  assert.equal(result.beyCandidate, false);
});

test('【…限定】表記は除外される', () => {
  const result = classifyEntry({
    code: 'BX-99',
    name: '【アプリ・イベント限定】ヘルズサイズ4-60T',
    category: 'ブースター',
  });
  assert.equal(result.beyCandidate, false);
});

test('カテゴリ欠落は保留（hold付きで非候補）になる', () => {
  for (const category of ['', undefined]) {
    const result = classifyEntry({ code: 'BX-98', name: 'テストソード3-65T', category });
    assert.equal(result.beyCandidate, false);
    assert.equal(result.hold, true, 'excludedではなくskippedに回すためのholdフラグ');
    assert.match(result.reason, /カテゴリ欠落/);
  }
});

test('未知カテゴリは保守的に除外される', () => {
  const result = classifyEntry({
    code: 'BX-99',
    name: 'ドランノヴァ5-60F',
    category: 'ダブルスターター',
  });
  assert.equal(result.beyCandidate, false);
});
