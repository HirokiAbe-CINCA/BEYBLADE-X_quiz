# ranking-api

BEYBLADE X クイズの全国ランキングAPI（Cloud Run / Node.js）。
API契約の正本は [`docs/architecture.md`](../../docs/architecture.md) の「ランキングAPI契約」節。

## 起動方法

```bash
cd server/ranking-api
npm install

# ローカル（インメモリストア。GCP認証不要）
npm run dev            # = LOCAL_DEV=1 node src/index.js → http://localhost:8080

# Firestoreに接続して起動（ADCが必要）
gcloud auth application-default login
GOOGLE_CLOUD_PROJECT=<project-id> npm start

# テスト
npm test               # node --test（LOCAL_DEV相当のインメモリ＋実HTTPでの統合テスト）
```

## 環境変数

| 変数 | 必須 | 既定値 | 説明 |
|---|---|---|---|
| `PORT` | - | `8080` | 待受ポート。Cloud Runが自動で渡す |
| `LOCAL_DEV` | - | （未設定） | `1` でインメモリストア。それ以外はFirestore |
| `ALLOWED_ORIGINS` | 本番で実質必須 | （空） | 許可オリジンのカンマ区切り。`http://localhost:5173` は常に許可。末尾スラッシュは無視 |
| `GOOGLE_CLOUD_PROJECT` | - | Cloud Run上は自動 | FirestoreのプロジェクトID。`FIRESTORE_PROJECT_ID` でも可 |
| `FIRESTORE_DATABASE_ID` | - | `(default)` | 既定以外のデータベースを使う場合 |
| `RANKING_CACHE_TTL_MS` | - | `30000` | `GET /api/ranking` のインメモリキャッシュ有効期間 |
| `RATE_LIMIT_MAX` | - | `10` | POST系のレート制限（同一IPあたりの上限） |
| `RATE_LIMIT_WINDOW_MS` | - | `60000` | レート制限のウィンドウ |

`FIRESTORE_EMULATOR_HOST` を設定すればエミュレータにも接続できる（`@google-cloud/firestore` の標準挙動）。

## エンドポイント

| メソッド | パス | 応答 |
|---|---|---|
| `GET` | `/healthz` | `200 {"ok":true,"store":"memory\|firestore"}` |
| `POST` | `/api/session` | `201 {"token":"<uuid>"}` |
| `POST` | `/api/scores` | `201 {"ok":true,"rank":<1始まり>}` |
| `GET` | `/api/ranking` | `200 {"entries":[{"name","score","date"}]}` 上位30件 |

エラー応答は一律 `{"error":"<code>","message":"..."}`。

### POST /api/scores の検証順序

`{"token","name","score"}` を受け取り、以下の順に検証する（先に失敗したものを返す）。

| 順 | 条件 | ステータス | `error` |
|---|---|---|---|
| 1 | ボディがJSONオブジェクトでない | 400 | `invalid_json` / `invalid_body` |
| 2 | `token` が非空文字列でない | 400 | `token_required` |
| 3 | トークンが未発行・期限切れ | 401 | `invalid_token` |
| 4 | トークンが使用済み | 409 | `token_used` |
| 5 | `name` がtrim後1〜11文字でない（制御文字も不可） | 400 | `invalid_name` |
| 6 | `score` が整数1〜999でない | 400 | `invalid_score` |
| 7 | `now - startedAt < score × 1000ms` | 422 | `implausible_score` |
| - | レート制限超過（POST系のみ） | 429 | `rate_limited` |

- 失敗時はトークンを消費しない（再送で成功できる）。成功時のみ `used=true` にする。
- `rank` = 自分より高いスコアの件数 + 1。同点は同順位。
- 文字数はコードポイント単位（`Array.from`）で数える。

## 構成

```
src/
  index.js               エントリポイント。設定読込・ストア生成・listen・SIGTERM処理
  app.js                 express アプリ（ルーティング／ランキングキャッシュ／エラーハンドラ）
  config.js              定数と環境変数のパース
  cors.js                CORSミドルウェア（プリフライト対応）
  rate-limit.js          IP単位のスライディングウィンドウ制限＋X-Forwarded-For解決
  validation.js          name / score の検証
  stores/
    index.js             LOCAL_DEV に応じてストアを選択
    memory-store.js      インメモリ実装
    firestore-store.js   Firestore実装（同一インターフェース）
    compare.js           ランキング順の比較関数（score降順 → date昇順）
test/
  helpers.js             テスト用サーバ起動＋操作可能な時計
  session.test.js        POST /api/session, /healthz, 404
  scores.test.js         正常系と 400/401/409/422 の全検証ルール
  ranking.test.js        上位30件・並び順・順位計算・キャッシュ挙動
  rate-limit.test.js     429・IP単位・ウィンドウ経過・対象メソッド
  cors.test.js           許可/非許可オリジン・プリフライト・エラー応答のヘッダ
```

ストアは以下のインターフェースを満たせば差し替え可能。

```
createSession({token, startedAt: Date, expireAt: Date})
getSession(token) -> {token, startedAt, expireAt, used} | null
consumeSession(token) -> 'ok' | 'not_found' | 'already_used'   // 原子的にused=trueへ
addScore({name, score, date: Date, sessionId})
countHigherScores(score) -> number
topScores(limit) -> [{name, score, date: Date}]
close()
```

## Firestore

### コレクション

```
sessions/{token} = { startedAt: Timestamp, used: boolean, expireAt: Timestamp, usedAt?: Timestamp }
scores/{autoId}  = { name: string, score: number, date: Timestamp, sessionId: string }
```

ドキュメントIDにトークンを使うので、トークン検証はキー参照1回で済む。
`used` の更新はトランザクションで行うため、同一トークンの同時POSTでも1回しか記録されない。

### 必要な複合インデックス

`GET /api/ranking` の `orderBy('score','desc').orderBy('date','asc')` に必要。

```bash
gcloud firestore indexes composite create \
  --collection-group=scores \
  --field-config=field-path=score,order=descending \
  --field-config=field-path=date,order=ascending \
  --database='(default)'
```

`countHigherScores` の `where('score','>',x).count()` は単一フィールドの自動インデックスで動くため追加設定は不要。

### TTLポリシー

`sessions.expireAt`（発行から24時間後のTimestamp）をアプリが書き込む。削除ポリシー自体はインフラ側で設定する。

```bash
gcloud firestore fields ttls update expireAt \
  --collection-group=sessions \
  --enable-ttl \
  --database='(default)'
```

TTLの削除は最大24時間遅延しうるので、アプリ側でも `getSession` 時に `expireAt` を判定して期限切れを401扱いにしている。
`scores` にはTTLを設定しない（ランキングは永続）。

## デプロイ

```bash
gcloud run deploy ranking-api \
  --source server/ranking-api \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars ALLOWED_ORIGINS=https://<firebase-hosting-domain>
```

- Node.jsビルドパックが `npm start` を実行する（`engines.node >= 20`）。
- サービスアカウントに `roles/datastore.user` が必要。
- レート制限とランキングキャッシュはインスタンスローカル。複数インスタンスに分散すると上限は緩くなるため、`--max-instances` を小さく（例: 2）しておくと想定に近くなる。
- クライアントIPは `X-Forwarded-For` の先頭を使う。Cloud Runの外に別のプロキシを挟む構成では、この値が信用できるか確認すること。
- `--source` でのアップロード対象からは、リポジトリルートの `.gitignore`（`node_modules/`）により `node_modules` が除外される。
