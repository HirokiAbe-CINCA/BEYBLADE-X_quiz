/**
 * 通知。SLACK_WEBHOOK_URL があればPOST、無くてもstdoutへサマリJSONを常時出力
 * （Cloud Run Job では stdout が Cloud Logging に入る）。
 */

function fmtList(list, fmt) {
  return list.length === 0 ? '（なし）' : list.map(fmt).join('\n');
}

export function buildSlackText(summary) {
  const lines = [];
  const head = summary.status === 'ok' ? '✅' : summary.status === 'noop' ? 'ℹ️' : '🚨';
  lines.push(`${head} BEYBLADE X 出題データ自動更新 [${summary.status}]${summary.dryRun ? '（DRY_RUN）' : ''}`);
  lines.push(`件数: 現行 ${summary.currentCount} → 新 ${summary.nextCount}（+${summary.added.length}）`);
  lines.push('');
  lines.push(`■ 新規登録 (${summary.added.length})`);
  lines.push(fmtList(summary.added, (i) => `・[${i.type}] ${i.name}（${i.code} ${i.productName}）`));
  lines.push('');
  lines.push(`■ スキップ（分解不能・重複） (${summary.skipped.length})`);
  lines.push(fmtList(summary.skipped, (s) => `・${s.code} ${s.name} — ${s.reason}`));
  lines.push('');
  lines.push(`■ 除外（ベイ本体でない） (${summary.excluded.length})`);
  lines.push(fmtList(summary.excluded, (s) => `・${s.code} ${s.name} — ${s.reason}`));
  if (summary.imageFailures.length > 0) {
    lines.push('');
    lines.push(`■ 画像死活NGで未登録 (${summary.imageFailures.length})`);
    lines.push(fmtList(summary.imageFailures, (s) => `・${s.id} ${s.name}`));
  }
  if (summary.dictionaryMissing.length > 0) {
    lines.push('');
    lines.push(`■ ビット辞書に無い名称（辞書追加を検討）: ${summary.dictionaryMissing.join(', ')}`);
  }
  if (summary.violations.length > 0) {
    lines.push('');
    lines.push(`■ 安全弁違反（更新中止） (${summary.violations.length})`);
    lines.push(fmtList(summary.violations, (v) => `・${v}`));
  }
  if (summary.errors.length > 0) {
    lines.push('');
    lines.push(`■ エラー`);
    lines.push(fmtList(summary.errors, (e) => `・${e}`));
  }
  return lines.join('\n');
}

export async function notify(summary) {
  // stdout（Cloud Logging）へ常時出力
  console.log(JSON.stringify({ scraperSummary: summary }, null, 2));

  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: buildSlackText(summary) }),
    });
    if (!res.ok) {
      console.error(`Slack通知に失敗: HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`Slack通知に失敗: ${err.message}`);
  }
}
