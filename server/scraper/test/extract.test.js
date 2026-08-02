import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractLineupEntries } from '../src/extract.js';

const here = path.dirname(fileURLToPath(import.meta.url));

async function loadFixture() {
  return readFile(path.join(here, 'fixtures/lineup.html'), 'utf8');
}

test('フィクスチャHTMLから全商品エントリを抽出できる', async () => {
  const entries = extractLineupEntries(await loadFixture());
  assert.ok(entries.length >= 140, `十分な件数が抽出できる（got ${entries.length}）`);

  const byCode = new Map(entries.map((e) => [e.code, e]));

  // 先頭のスターター
  const bx01 = byCode.get('BX-01');
  assert.deepEqual(bx01, {
    code: 'BX-01',
    name: 'ドランソード3-60F',
    category: 'スターター',
    slug: 'bx01.html',
  });

  // CX系
  const cx15 = byCode.get('CX-15');
  assert.equal(cx15.name, 'ラグナレイジFE4-55Y');
  assert.equal(cx15.slug, 'cx15.html');

  // 一体型
  const ux19 = byCode.get('UX-19');
  assert.equal(ux19.name, 'バレットグリフォンH');

  // ツール類もエントリとしては抽出される（除外はclassify側の責務）
  const bx10 = byCode.get('BX-10');
  assert.equal(bx10.name, 'エクストリームスタジアム');
  assert.equal(bx10.category, 'ツール');
});

test('商品名内の<br>や空白が除去される', async () => {
  const entries = extractLineupEntries(await loadFixture());
  const withBr = entries.find((e) => e.slug === 'bx00-hc.html');
  assert.ok(withBr);
  assert.equal(withBr.name.includes('\n'), false);
  assert.equal(/\s/.test(withBr.name), false);
});

test('想定構造でないHTMLからは0件（サイト構造変更の検知に使う）', () => {
  assert.deepEqual(extractLineupEntries('<html><body><p>maintenance</p></body></html>'), []);
  assert.deepEqual(extractLineupEntries(''), []);
});
