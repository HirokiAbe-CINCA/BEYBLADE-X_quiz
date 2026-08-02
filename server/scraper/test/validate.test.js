import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateItem, checkSafety, MAX_INCREASE } from '../src/validate.js';

function makeItem(overrides = {}) {
  return {
    id: 'bx-01',
    code: 'BX-01',
    line: 'BX',
    type: 'blade',
    partLabel: 'ブレード',
    questionText: 'このブレードは？',
    name: 'ドランソード',
    choiceLabel: 'ドランソード',
    bladeName: 'ドランソード',
    productName: 'ドランソード3-60F',
    imageUrl: 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/BX01_01@1.png',
    sourceUrl: 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/bx01.html',
    ...overrides,
  };
}

function makeData(items) {
  return {
    version: 1,
    updatedAt: '2026-08-02T00:00:00.000Z',
    source: 'scraper',
    items,
  };
}

function manyItems(n, prefix = 'bx-9') {
  return Array.from({ length: n }, (_, i) =>
    makeItem({ id: `${prefix}${i}`, code: 'BX-99', name: `n${i}`, choiceLabel: `n${i}`, bladeName: `n${i}` }),
  );
}

test('スキーマ: 正常なアイテムはパスする', () => {
  assert.deepEqual(validateItem(makeItem()), []);
  assert.deepEqual(
    validateItem(makeItem({ type: 'ratchet', partLabel: 'ラチェット', bladeName: undefined, name: '3-60' })),
    [],
  );
});

test('スキーマ: 必須フィールド欠落・不正値を検出する', () => {
  assert.ok(validateItem(makeItem({ name: '' })).length > 0, 'name空');
  assert.ok(validateItem(makeItem({ imageUrl: 'not-a-url' })).length > 0, 'imageUrl不正');
  assert.ok(validateItem(makeItem({ imageUrl: 'http://insecure.example/x.png' })).length > 0, 'httpsでない');
  assert.ok(validateItem(makeItem({ line: 'ZZ' })).length > 0, 'line不正');
  assert.ok(validateItem(makeItem({ code: 'XX-1' })).length > 0, 'code形式不正');
  assert.ok(validateItem(makeItem({ type: 'blade', partLabel: 'ビット' })).length > 0, 'partLabel不一致');
  assert.ok(validateItem(makeItem({ bladeName: undefined })).length > 0, 'bladeのbladeName欠落');
  assert.ok(validateItem(null).length > 0);
});

test('安全弁: 全条件を満たせばOK', () => {
  const cur = makeData([makeItem()]);
  const next = makeData([
    makeItem(),
    makeItem({ id: 'ux-13', code: 'UX-13', line: 'UX', name: 'ゴーレムロック', choiceLabel: 'ゴーレムロック', bladeName: 'ゴーレムロック' }),
  ]);
  const result = checkSafety(cur, next);
  assert.deepEqual(result, { ok: true, violations: [] });
});

test('安全弁: スキーマ違反アイテムが1件でもあれば全体NG', () => {
  const cur = makeData([makeItem()]);
  const next = makeData([makeItem(), makeItem({ id: 'bad-1', code: 'UX-90', imageUrl: '' })]);
  const result = checkSafety(cur, next);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((v) => v.includes('bad-1')));
});

test('安全弁: 件数減少はNG', () => {
  const cur = makeData([makeItem(), makeItem({ id: 'bx-02', code: 'BX-02' })]);
  const next = makeData([makeItem()]);
  const result = checkSafety(cur, next);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((v) => v.includes('件数減少')));
});

test('安全弁: +20件を超える増加はNG', () => {
  const cur = makeData([makeItem()]);
  const okNext = makeData([makeItem(), ...manyItems(MAX_INCREASE)]);
  assert.equal(checkSafety(cur, okNext).ok, true, '+20ちょうどはOK');

  const ngNext = makeData([makeItem(), ...manyItems(MAX_INCREASE + 1)]);
  const result = checkSafety(cur, ngNext);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((v) => v.includes('超過')));
});

test('安全弁: 現行アイテムの欠落（すり替わり）はNG', () => {
  const cur = makeData([makeItem(), makeItem({ id: 'bx-02', code: 'BX-02' })]);
  const next = makeData([
    makeItem(),
    makeItem({ id: 'bx-03', code: 'BX-03' }), // bx-02が消えてbx-03に化けた
  ]);
  const result = checkSafety(cur, next);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((v) => v.includes('欠落')));
});

test('安全弁: id重複はNG', () => {
  const cur = makeData([makeItem()]);
  const next = makeData([makeItem(), makeItem()]);
  const result = checkSafety(cur, next);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((v) => v.includes('重複')));
});

test('安全弁: メタデータ不正はNG', () => {
  const cur = makeData([makeItem()]);
  const next = { ...makeData([makeItem()]), updatedAt: 'not-a-date' };
  const result = checkSafety(cur, next);
  assert.equal(result.ok, false);
});
