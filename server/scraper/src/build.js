/**
 * ラインナップのエントリ一覧と現行データから、追加候補アイテムを組み立てる（純粋関数）。
 * ネットワークI/O（画像死活チェック）は行わない。呼び出し側が imageUrl を検証して
 * NGアイテムを落とす。
 */
import { classifyEntry } from './classify.js';
import { parseProductName } from './parse.js';
import { bitDisplayName, bitKeyFromName } from './bits.js';

export const LINEUP_BASE_URL = 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/';
export const IMAGE_BASE_URL = `${LINEUP_BASE_URL}_image/`;

// 画像URL規約: _image/<コードのハイフン無し>_<index>@1.png
// index: 01=ブレード, 03=ラチェット, 04=ビット
// 既存データ（グラウンドトゥルース）は大文字（BX01_01@1.png）を使用しているため
// 大文字を第一候補、docs/architecture.md 記載の小文字を第二候補とする。
export function imageUrlCandidates(code, index) {
  const compact = code.replace(/-/g, '');
  return [
    `${IMAGE_BASE_URL}${compact.toUpperCase()}_${index}@1.png`,
    `${IMAGE_BASE_URL}${compact.toLowerCase()}_${index}@1.png`,
  ];
}

function baseFields(entry) {
  return {
    code: entry.code,
    line: entry.code.split('-')[0],
    sourceUrl: `${LINEUP_BASE_URL}${entry.slug}`,
  };
}

/**
 * @param {object[]} currentItems 現行 beyblades.json の items
 * @param {{code,name,category,slug}[]} entries 抽出済みラインナップ
 * @returns {{
 *   candidates: {item: object, imageUrlCandidates: string[]}[],
 *   excluded: {code,name,reason}[],
 *   skipped: {code,name,reason}[],
 *   dictionaryMissing: string[],
 * }}
 */
export function buildCandidates(currentItems, entries) {
  const existingCodes = new Set(currentItems.map((i) => i.code));
  const existingBladeNames = new Set(
    currentItems.filter((i) => i.type === 'blade').map((i) => i.bladeName ?? i.name),
  );
  const existingRatchetNames = new Set(
    currentItems.filter((i) => i.type === 'ratchet').map((i) => i.name),
  );
  const existingBitKeys = new Set(
    currentItems.filter((i) => i.type === 'bit').map((i) => bitKeyFromName(i.name)),
  );
  const existingIds = new Set(currentItems.map((i) => i.id));

  const candidates = [];
  const excluded = [];
  const skipped = [];
  const dictionaryMissing = new Set();
  const seenCodesThisRun = new Set();

  for (const entry of entries) {
    // 現行データに既にある商品コードは対象外
    if (existingCodes.has(entry.code)) continue;

    const cls = classifyEntry(entry);
    if (!cls.beyCandidate) {
      excluded.push({ code: entry.code, name: entry.name, reason: cls.reason });
      continue;
    }

    if (seenCodesThisRun.has(entry.code)) {
      skipped.push({ code: entry.code, name: entry.name, reason: '同一コードの重複エントリ' });
      continue;
    }
    seenCodesThisRun.add(entry.code);

    const parsed = parseProductName(entry.name);
    if (!parsed.ok) {
      skipped.push({
        code: entry.code,
        name: entry.name,
        reason: `商品名を分解できない（${parsed.reason}）`,
      });
      continue;
    }

    const base = baseFields(entry);
    const idBase = entry.code.toLowerCase();

    // --- ブレード ---
    if (existingBladeNames.has(parsed.blade)) {
      // 同名ブレードの再録（ブースター化・色替え等）は追加しない
      skipped.push({
        code: entry.code,
        name: entry.name,
        reason: `既存ブレード「${parsed.blade}」の重複`,
      });
    } else if (existingIds.has(idBase)) {
      skipped.push({ code: entry.code, name: entry.name, reason: `id「${idBase}」が既に存在` });
    } else {
      candidates.push({
        item: {
          id: idBase,
          ...base,
          type: 'blade',
          partLabel: 'ブレード',
          questionText: 'このブレードは？',
          name: parsed.blade,
          choiceLabel: parsed.blade,
          bladeName: parsed.blade,
          productName: parsed.normalized,
        },
        imageUrlCandidates: imageUrlCandidates(entry.code, '01'),
      });
      existingBladeNames.add(parsed.blade);
      existingIds.add(idBase);
    }

    // --- ラチェット（名前でユニーク）---
    if (parsed.ratchet && !existingRatchetNames.has(parsed.ratchet)) {
      const id = `${idBase}-ratchet`;
      if (!existingIds.has(id)) {
        candidates.push({
          item: {
            id,
            ...base,
            type: 'ratchet',
            partLabel: 'ラチェット',
            questionText: 'このラチェットは？',
            name: parsed.ratchet,
            choiceLabel: parsed.ratchet,
            productName: parsed.ratchet,
          },
          imageUrlCandidates: imageUrlCandidates(entry.code, '03'),
        });
        existingRatchetNames.add(parsed.ratchet);
        existingIds.add(id);
      }
    }

    // --- ビット（英字キーでユニーク）---
    if (parsed.bit && !existingBitKeys.has(parsed.bit)) {
      const id = `${idBase}-bit`;
      if (!existingIds.has(id)) {
        const { name, inDictionary } = bitDisplayName(parsed.bit);
        if (!inDictionary) dictionaryMissing.add(parsed.bit);
        candidates.push({
          item: {
            id,
            ...base,
            type: 'bit',
            partLabel: 'ビット',
            questionText: 'このビットは？',
            name,
            choiceLabel: name,
            productName: name,
          },
          imageUrlCandidates: imageUrlCandidates(entry.code, '04'),
        });
        existingBitKeys.add(parsed.bit);
        existingIds.add(id);
      }
    }
  }

  return {
    candidates,
    excluded,
    skipped,
    dictionaryMissing: [...dictionaryMissing],
  };
}
