# アーキテクチャ（全国ランキング＋出題データ自動更新）

個人利用範囲の限定公開運用。インフラはすべてGCP（リージョン: asia-northeast1）。

```
[ブラウザ]
  ├─ Firebase Hosting: 静的フロントエンド
  ├─ GCS公開オブジェクト: 出題データ beyblades.json（フォールバック: 同梱 data/beyblades.json）
  └─ Cloud Run "ranking-api": 全国ランキングAPI ── Firestore

[Cloud Scheduler 週1] → Cloud Run Job "lineup-scraper"
  タカラトミー公式ラインナップ取得 → 検証 → GCS beyblades.json 更新（完全自動）→ 通知
```

## 出題データJSONスキーマ（data/beyblades.json / GCSオブジェクト共通）

```json
{
  "version": 1,
  "updatedAt": "ISO8601",
  "source": "seed | scraper",
  "items": [
    {
      "id": "bx-01",
      "code": "BX-01",
      "line": "BX",
      "type": "blade",            // "blade" | "ratchet" | "bit"
      "partLabel": "ブレード",     // ブレード | ラチェット | ビット
      "questionText": "このブレードは？",
      "name": "ドランソード",
      "choiceLabel": "ドランソード",
      "bladeName": "ドランソード",  // bladeのみ
      "productName": "ドランソード3-60F",
      "imageUrl": "https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/bx01_01@1.png",
      "sourceUrl": "https://beyblade.takaratomy.co.jp/beyblade-x/lineup/bx01.html"
    }
  ]
}
```

- 画像URL規約: `_image/<codeハイフン無し>_<index>@1.png`、index: `01`=ブレード, `03`=ラチェット, `04`=ビット。コード部は大文字が第一候補（実データは`BX01_01@1.png`形式。スクレイパーは大文字→小文字の順にHEAD確認）
- この規約が信頼できるのは**BX/UXのみ**。CX系はアシストブレード等で画像枚数が多く（実測でCX-01は_01〜_08の8枚）indexの意味が特定できないため、CXのラチェット/ビットは自動登録しない
- ラチェット/ビットは名前でユニーク（例: ラチェット `3-60` は1エントリのみ）

## ランキングAPI契約（Cloud Run, Node.js）

ベースパス `/api`。CORSは環境変数 `ALLOWED_ORIGINS`（カンマ区切り）＋ `http://localhost:5173` を許可。

| エンドポイント | リクエスト | レスポンス |
|---|---|---|
| `POST /api/session` | なし | `201 {"token": "..."}` サーバー側で開始時刻を記録 |
| `POST /api/scores` | `{"token", "name", "score"}` | `201 {"ok": true, "rank": <1始まり順位>}` |
| `GET /api/ranking` | なし | `200 {"entries": [{"name", "score", "date"}]}` **上位30件**、score降順→date昇順 |

検証ルール（`POST /api/scores`）:
- token: 発行済み・未使用であること（使用済みは409）
- 経過時間: `now - session.startedAt >= score × 1000ms` 未満は422（チート簡易対策）
- name: trim後1〜11文字（`MAX_NAME_LENGTH = 11`）
- score: 整数 1〜999
- レート制限: 同一IP 10リクエスト/分（インスタンスローカルで可）

Firestore: `sessions/{id}` = `{startedAt, used}` / `scores/{id}` = `{name, score, date, sessionId}`
環境変数 `LOCAL_DEV=1` でFirestoreの代わりにインメモリストア（ローカルe2e用）。

## フロントエンド設定（src/config.js）

```js
export const CONFIG = {
  apiBaseUrl: '',   // 空 = 全国ランキング無効（ローカルのみで動作）
  dataUrl: '',      // 空 = 同梱 data/beyblades.json のみ使用
};
```

リモート取得は5秒タイムアウト。失敗時は同梱JSONへフォールバックし、アプリは必ず起動する。

## スクレイパー安全弁（完全自動反映の条件）

1. スキーマ検証: 全アイテムが必須フィールドを満たす
2. 画像死活: 新規アイテムの imageUrl がHTTP 200かつimage系Content-Type
3. 件数ガード: 新データの件数が現行以上、かつ1回の増加は+20件以内。既存アイテムの変更・削除は行わない（追加のみ）
4. いずれか失敗時は更新中止・通知のみ（現行データ維持）
5. `DRY_RUN=1` で差分表示のみ（アップロードなし）
6. 通知: `SLACK_WEBHOOK_URL`（任意）＋Cloud Loggingへ常時サマリ出力

自動登録せず保留（skipped＋通知）にするケース:
- CX系商品のラチェット・ビット（画像index規約が不明なため。ブレードは登録する）
- ビット名称辞書に無いビット（誤名称での出題を防ぐ。辞書追加後の実行で登録される）
- 商品名が分解ルールに合致しないもの（推測で登録しない）
- ラインナップ上でカテゴリが取得できないエントリ（サイト構造変更の兆候として保守的に扱う）

## 運用メモ

- 非公式ファンメイドアプリの明記をタイトル画面に表示
- GCP予算アラート: 月500円
- ホスティングはFirebase Hostingへ移行（GitHub Pagesワークフローは廃止）
