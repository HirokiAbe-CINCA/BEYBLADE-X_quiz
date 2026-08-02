/**
 * BEYBLADE X 出題データ自動更新（Cloud Run Job エントリポイント）。
 *
 * フロー:
 *  1. 現行データ取得（GCS / SEED_PATH）
 *  2. 公式ラインナップページ取得
 *  3. 商品エントリ抽出 → ベイ本体判定 → 商品名分解 → 追加候補生成
 *  4. 新規アイテムの画像死活チェック（HEAD, 1秒間隔）
 *  5. 安全弁（スキーマ全件・件数ガード）を全通過したらGCSへアップロード
 *  6. 通知（Slack任意＋stdoutサマリ常時）
 *
 * 疑わしきは更新しない: 分解不能・画像NG・安全弁違反はすべて登録見送り＋通知。
 * 安全弁違反時は終了コード1。
 */
import { loadCurrentData, uploadData } from './store.js';
import { fetchText, headImageOk } from './http.js';
import { extractLineupEntries } from './extract.js';
import { buildCandidates, LINEUP_BASE_URL } from './build.js';
import { checkSafety } from './validate.js';
import { notify } from './notify.js';

const LINEUP_URL = process.env.LINEUP_URL || `${LINEUP_BASE_URL}index.html`;
const DRY_RUN = process.env.DRY_RUN === '1';

function newSummary() {
  return {
    status: 'ok',
    dryRun: DRY_RUN,
    startedAt: new Date().toISOString(),
    lineupUrl: LINEUP_URL,
    currentCount: 0,
    nextCount: 0,
    added: [],
    skipped: [],
    excluded: [],
    imageFailures: [],
    dictionaryMissing: [],
    violations: [],
    errors: [],
  };
}

async function main() {
  const summary = newSummary();
  try {
    // 1. 現行データ
    const { data: currentData, from } = await loadCurrentData();
    if (!Array.isArray(currentData?.items) || currentData.items.length === 0) {
      throw new Error(`現行データが不正（items が空）: ${from}`);
    }
    summary.currentSource = from;
    summary.currentCount = currentData.items.length;
    console.error(`現行データ: ${from}（${currentData.items.length}件）`);

    // 2. ラインナップページ
    console.error(`取得: ${LINEUP_URL}`);
    const html = await fetchText(LINEUP_URL);

    // 3. 抽出
    const entries = extractLineupEntries(html);
    summary.lineupEntryCount = entries.length;
    console.error(`ラインナップ抽出: ${entries.length}件`);
    if (entries.length === 0) {
      throw new Error('ラインナップページから商品を1件も抽出できません（サイト構造変更の疑い）');
    }

    // 4. 追加候補
    const { candidates, excluded, skipped, dictionaryMissing } = buildCandidates(
      currentData.items,
      entries,
    );
    summary.excluded = excluded;
    summary.skipped = skipped;
    summary.dictionaryMissing = dictionaryMissing;

    // 5. 画像死活チェック（大文字規約→小文字規約の順で確認）
    const newItems = [];
    for (const { item, imageUrlCandidates } of candidates) {
      let resolvedUrl = null;
      for (const url of imageUrlCandidates) {
        // eslint-disable-next-line no-await-in-loop
        if (await headImageOk(url)) {
          resolvedUrl = url;
          break;
        }
      }
      if (resolvedUrl) {
        newItems.push({ ...item, imageUrl: resolvedUrl });
      } else {
        summary.imageFailures.push({
          id: item.id,
          name: item.name,
          tried: imageUrlCandidates,
        });
      }
    }

    summary.added = newItems.map((i) => ({
      id: i.id,
      type: i.type,
      code: i.code,
      name: i.name,
      productName: i.productName,
      imageUrl: i.imageUrl,
    }));

    // 6. 新データ組み立て
    const nextData = {
      version: currentData.version ?? 1,
      updatedAt: new Date().toISOString(),
      source: 'scraper',
      items: [...currentData.items, ...newItems],
    };
    summary.nextCount = nextData.items.length;

    // 7. 安全弁
    const safety = checkSafety(currentData, nextData);
    if (!safety.ok) {
      summary.status = 'blocked';
      summary.violations = safety.violations;
      await notify(summary);
      process.exitCode = 1;
      return;
    }

    if (newItems.length === 0) {
      summary.status = 'noop';
      console.error('新規アイテムなし。アップロードしません。');
      await notify(summary);
      return;
    }

    // 8. 反映
    if (DRY_RUN) {
      console.error('--- DRY_RUN: アップロードなし。差分は以下 ---');
      console.error(JSON.stringify({ diff: newItems }, null, 2));
    } else {
      const dest = await uploadData(nextData);
      summary.uploadedTo = dest;
      console.error(`アップロード完了: ${dest}（${nextData.items.length}件）`);
    }
    await notify(summary);
  } catch (err) {
    summary.status = 'error';
    summary.errors.push(err?.stack ?? String(err));
    await notify(summary);
    process.exitCode = 1;
  }
}

main();
