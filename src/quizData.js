import { CONFIG } from './config.js';

// 同梱データ（リモート取得に失敗したときのフォールバック）
export const BUNDLED_DATA_URL = './data/beyblades.json';
export const DATA_FETCH_TIMEOUT_MS = 5000;
// quizEngine の validateTypeCounts（optionsPerQuestion = 4）と整合させる
export const MIN_ITEMS_PER_TYPE = 4;
export const QUIZ_TYPES = ['blade', 'ratchet', 'bit'];
export const REQUIRED_ITEM_FIELDS = [
  'id',
  'type',
  'name',
  'choiceLabel',
  'imageUrl',
  'questionText',
  'partLabel',
  'code',
  'line',
];

/**
 * 出題データを読み込む。
 * config.dataUrl が指定されていればリモートを優先し、
 * 失敗・タイムアウト・検証NGなら同梱JSONへフォールバックする。
 *
 * @returns {Promise<{items: object[], blades: object[], ratchets: object[], bits: object[], source: 'remote'|'bundled'}>}
 */
export async function loadQuizData(config = CONFIG, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    timeoutMs = DATA_FETCH_TIMEOUT_MS,
    bundledUrl = BUNDLED_DATA_URL,
  } = options;

  const remoteUrl = typeof config?.dataUrl === 'string' ? config.dataUrl.trim() : '';

  if (remoteUrl) {
    const payload = await loadJsonOrNull(fetchImpl, remoteUrl, timeoutMs);
    if (isValidQuizData(payload)) {
      return toQuizData(payload.items, 'remote');
    }
  }

  const bundled = await loadJsonOrNull(fetchImpl, bundledUrl, timeoutMs);
  if (isValidQuizData(bundled)) {
    return toQuizData(bundled.items, 'bundled');
  }

  throw new Error('出題データを読みこめませんでした。');
}

export function isValidQuizData(payload) {
  const items = payload?.items;

  if (!Array.isArray(items) || items.length === 0) {
    return false;
  }

  if (!items.every(isValidQuizItem)) {
    return false;
  }

  return QUIZ_TYPES.every(
    (type) => items.filter((item) => item.type === type).length >= MIN_ITEMS_PER_TYPE,
  );
}

function isValidQuizItem(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }

  return REQUIRED_ITEM_FIELDS.every((field) => {
    const value = item[field];
    return typeof value === 'string' && value.trim() !== '';
  });
}

function toQuizData(items, source) {
  return {
    items,
    blades: items.filter((item) => item.type === 'blade'),
    ratchets: items.filter((item) => item.type === 'ratchet'),
    bits: items.filter((item) => item.type === 'bit'),
    source,
  };
}

async function loadJsonOrNull(fetchImpl, url, timeoutMs) {
  if (typeof fetchImpl !== 'function') {
    return null;
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timeoutId = null;

  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Timed out after ${timeoutMs}ms: ${url}`));
    }, timeoutMs);
    // Node のテストでイベントループを止めないように
    timeoutId?.unref?.();
  });

  try {
    const response = await Promise.race([
      fetchImpl(url, controller ? { signal: controller.signal } : {}),
      timeout,
    ]);

    if (!response?.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}
