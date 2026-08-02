# インフラ運用手順

BEYBLADE X QUIZ のGCPインフラ（Firestore / GCS / Cloud Run / Cloud Scheduler / Firebase Hosting）
のセットアップ・デプロイ・運用手順。全リソースはリージョン `asia-northeast1`。

個人利用範囲の限定公開ファンアプリのため、コスト最小・構成最小を優先する。

## 構成の正本

`docs/architecture.md` を参照。以下はその構成を実際に構築・運用するための手順。

## 事前準備

1. `gcloud auth login` / `gcloud auth application-default login` でログイン
2. `firebase login` でログイン
3. 請求先アカウントIDを確認: `gcloud billing accounts list`
4. プロジェクト作成権限（Organization管理者、またはProject Creator + Billing
   Account User相当のロール）を持つアカウントでログインしていること

## 1. 初回セットアップ（infra/setup.sh）

```bash
PROJECT_ID=your-project-id \
BILLING_ACCOUNT_ID=0X0X0X-0X0X0X-0X0X0X \
./infra/setup.sh
```

実行内容（`infra/setup.sh` 内のコメント番号と対応）:

1. プロジェクト作成 + 請求先リンク
2. 必要API有効化（Cloud Run / Firestore / Cloud Storage / Cloud Scheduler /
   Cloud Build / Artifact Registry / Secret Manager / Billing Budgets）
3. Firestore(Native, asia-northeast1)作成 + `sessions` コレクションの
   `expireAt` フィールドにTTLポリシー設定
4. GCSバケット `${PROJECT_ID}-data` 作成 + 公開読み取り(`allUsers` に
   `objectViewer`) + CORS設定(`infra/cors.json`) + `data/beyblades.json` の
   シードアップロード
5. スクレイパー用サービスアカウント作成（対象バケットへの `objectAdmin` のみ）
6. Cloud Scheduler用サービスアカウント作成（`run.invoker`）
7. Cloud Schedulerジョブ作成（毎週月曜09:00 Asia/Tokyo に `lineup-scraper`
   をHTTP起動）
8. 予算アラート作成（月500円、50%/90%/100%で通知）
9. Firebase Hosting有効化（`firebase projects:addfirebase`）

実行後、`.firebaserc` の `"REPLACE_WITH_PROJECT_ID"` を実際のプロジェクトIDに
書き換える。

再実行してもおおむね安全（既存リソースはスキップまたは設定更新のみ）。ただし
以下は完全な冪等性を保証しない:

- 予算アラートは表示名で簡易チェックしているだけなので、表示名を変更した
  場合は重複作成される可能性がある
- Cloud SchedulerのジョブURIは、`lineup-scraper` (Cloud Run Job) が未デプロイ
  でも登録できるが、実行は失敗する。`infra/deploy.sh scraper` を先に実行
  しておくこと

## 2. デプロイ（infra/deploy.sh）

依存関係の順序に注意（**api → config.js反映 → hosting**）。ranking-apiの
URLが確定してから、それをフロントの設定に反映し、最後にHostingへ配信する
必要がある。

```bash
# 1. ranking-api をデプロイし、発行されたURLを確認する
PROJECT_ID=your-project-id \
ALLOWED_ORIGINS=https://your-project-id.web.app,https://your-project-id.firebaseapp.com \
./infra/deploy.sh api

# 2. 出力されたURLを src/config.js の apiBaseUrl に手動で反映する
#    dataUrl も使う場合は https://storage.googleapis.com/<bucket>/beyblades.json を設定する

# 3. lineup-scraper (Cloud Run Job) をデプロイする
PROJECT_ID=your-project-id ./infra/deploy.sh scraper

# 4. Firebase Hosting へデプロイする（src/config.js反映後に実行）
PROJECT_ID=your-project-id ./infra/deploy.sh hosting

# まとめて実行する場合（api→scraper→hostingの順）
PROJECT_ID=your-project-id ALLOWED_ORIGINS=... ./infra/deploy.sh all
```

`all` を使う場合も、初回はapi実行後に一度止めてsrc/config.jsを更新してから
再度 `hosting` のみ実行するほうが安全（`all` は config.js の手動更新を
待たずにhostingまで進んでしまうため、最新のAPI URLが反映されないまま
デプロイされる可能性がある）。2回目以降、URLが変わらない前提であれば
`all` で問題ない。

## 3. スクレイパーの手動実行

Cloud Schedulerを待たずに `lineup-scraper` を手動実行する場合:

```bash
gcloud run jobs execute lineup-scraper \
  --project=your-project-id \
  --region=asia-northeast1 \
  --wait
```

### DRY_RUN確認

本番データを更新せずに差分だけ確認したい場合、環境変数 `DRY_RUN=1` を
一時的に上書きして実行する（ジョブ本体の環境変数は変更しない）:

```bash
gcloud run jobs execute lineup-scraper \
  --project=your-project-id \
  --region=asia-northeast1 \
  --update-env-vars=DRY_RUN=1 \
  --wait
```

`docs/architecture.md` の安全弁（スキーマ検証・画像死活・件数ガード）により、
異常時はGCS更新をスキップし、ログとSlack通知（`SLACK_WEBHOOK_URL` 設定時）
のみ行う。

## 4. ログの見方

Cloud Loggingで `lineup-scraper` のログを確認する:

```bash
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="lineup-scraper"' \
  --project=your-project-id \
  --freshness=7d \
  --limit=50 \
  --format=json
```

`ranking-api` のログ:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="ranking-api"' \
  --project=your-project-id \
  --freshness=1d \
  --limit=50 \
  --format=json
```

Cloud Consoleから確認する場合は「Logging > Logs Explorer」で同様のクエリを
入力するか、Cloud Run > 対象サービス/ジョブ > 「ログ」タブを開く。

## 5. 予算アラートの確認・変更

```bash
gcloud billing budgets list --billing-account=0X0X0X-0X0X0X-0X0X0X
```

しきい値や金額を変更する場合は `gcloud billing budgets update` を使うか、
Cloud Console の「お支払い > 予算とアラート」から編集する。通知は請求先
アカウントの管理者・ユーザーロールを持つメンバーに自動送信される
（`--disable-default-iam-recipients` は指定していないため）。

## トラブルシューティング

- `firebase projects:addfirebase` が失敗する: 既にFirebaseが有効化済みの
  プロジェクトである可能性が高い。`firebase projects:list` で確認する
- `gcloud scheduler jobs create/update http` が404になる: `lineup-scraper`
  (Cloud Run Job) が対象リージョンにまだデプロイされていない。先に
  `infra/deploy.sh scraper` を実行する
- ranking-apiでCORSエラーが出る: `ALLOWED_ORIGINS` にFirebase HostingのURL
  （`https://<project-id>.web.app` と `https://<project-id>.firebaseapp.com`
  の両方）が含まれているか確認し、`infra/deploy.sh api` を再実行する
