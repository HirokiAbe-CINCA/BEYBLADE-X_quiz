#!/usr/bin/env bash
#
# infra/setup.sh — BEYBLADE X QUIZ 初回GCPプロビジョニング
#
# 個人利用範囲の限定公開ファンアプリ用インフラを一括構築する。
# 既存リソースがある場合はスキップ／上書き更新して、再実行してもなるべく
# 壊れないようにしている（完全な冪等性は保証しない。特に予算アラートと
# Cloud Schedulerジョブの一部確認はベストエフォート）。
#
# 使い方:
#   PROJECT_ID=my-project BILLING_ACCOUNT_ID=0X0X0X-0X0X0X-0X0X0X ./infra/setup.sh
#
set -euo pipefail

# ==== 必須変数（環境変数として渡す。デフォルト値なし＝未設定ならexit） ====
PROJECT_ID="${PROJECT_ID:-}"
BILLING_ACCOUNT_ID="${BILLING_ACCOUNT_ID:-}"

# ==== 任意変数 ====
REGION="${REGION:-asia-northeast1}"
BUCKET="${BUCKET:-${PROJECT_ID}-data}"

# ==== 固定のリソース名 ====
SCRAPER_SA_NAME="lineup-scraper-sa"
SCHEDULER_SA_NAME="scheduler-invoker"
SCRAPER_JOB_NAME="lineup-scraper"
SCHEDULER_JOB_NAME="lineup-scraper-weekly"
BUDGET_DISPLAY_NAME="beyblade-x-quiz-monthly-budget"
BUDGET_AMOUNT="500JPY"

usage() {
  cat <<'EOF'
使い方:
  PROJECT_ID=<GCPプロジェクトID> BILLING_ACCOUNT_ID=<請求先アカウントID> ./infra/setup.sh

必須環境変数:
  PROJECT_ID           新規作成するGCPプロジェクトID
                        （6〜30文字、小文字英数字とハイフン、先頭は英字）
  BILLING_ACCOUNT_ID    請求先アカウントID（例: 0X0X0X-0X0X0X-0X0X0X）
                        `gcloud billing accounts list` で確認できる

任意環境変数:
  REGION                デフォルト: asia-northeast1
  BUCKET                デフォルト: ${PROJECT_ID}-data

前提:
  - gcloud / firebase CLI にログイン済みで、プロジェクト作成・請求先リンク
    ・IAM変更ができる権限（組織管理者 or Project Creator + Billing Account
    User 相当）を持つアカウントでログインしていること
  - リポジトリ直下で実行すること（相対パス data/beyblades.json, infra/cors.json
    を参照する）
EOF
}

if [[ -z "${PROJECT_ID}" || -z "${BILLING_ACCOUNT_ID}" ]]; then
  usage
  exit 1
fi

SCRAPER_SA_EMAIL="${SCRAPER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_SA_EMAIL="${SCHEDULER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

step() {
  echo ""
  echo "==> $*"
}

# ---------------------------------------------------------------------------
# 1. プロジェクト作成 + 請求先リンク
# ---------------------------------------------------------------------------
step "[1/9] プロジェクト作成 + 請求先リンク"
if gcloud projects describe "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "プロジェクト ${PROJECT_ID} は既に存在します。作成をスキップします。"
else
  gcloud projects create "${PROJECT_ID}" --name="BEYBLADE X QUIZ"
fi
gcloud billing projects link "${PROJECT_ID}" \
  --billing-account="${BILLING_ACCOUNT_ID}"

# ---------------------------------------------------------------------------
# 2. API有効化
# ---------------------------------------------------------------------------
step "[2/9] 必要APIの有効化"
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  billingbudgets.googleapis.com \
  --project="${PROJECT_ID}"

# ---------------------------------------------------------------------------
# 3. Firestore作成（native, asia-northeast1） + sessionsコレクションのTTL
# ---------------------------------------------------------------------------
step "[3/9] Firestore(Native)作成 + TTLポリシー設定"
if gcloud firestore databases describe --database="(default)" \
    --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "Firestore(default)データベースは既に存在します。作成をスキップします。"
else
  gcloud firestore databases create \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --type=firestore-native
fi

# sessions コレクションの expireAt フィールドをTTL対象にする。
# （ranking-api側でセッションドキュメントにexpireAtを書き込む実装が前提。
#   TTL自体は該当フィールドを持つドキュメントだけに作用するため、
#   フィールド未実装の間は無害）
gcloud firestore fields ttls update expireAt \
  --project="${PROJECT_ID}" \
  --database="(default)" \
  --collection-group=sessions \
  --enable-ttl

# GET /api/ranking の二段ソート(score降順→date昇順)に必要な複合インデックス。
# 未作成だとランキング取得がFAILED_PRECONDITIONで失敗する。
gcloud firestore indexes composite create \
  --project="${PROJECT_ID}" \
  --database="(default)" \
  --collection-group=scores \
  --field-config=field-path=score,order=descending \
  --field-config=field-path=date,order=ascending

# ---------------------------------------------------------------------------
# 4. GCSバケット作成 + 公開読み取り + CORS + シードデータアップロード
# ---------------------------------------------------------------------------
step "[4/9] GCSバケット作成 + 公開設定 + CORS + シードアップロード"
if gcloud storage buckets describe "gs://${BUCKET}" \
    --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "バケット gs://${BUCKET} は既に存在します。作成をスキップします。"
else
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --uniform-bucket-level-access
fi

# allUsersに読み取り権限（出題データを匿名公開配信するため）
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="allUsers" \
  --role="roles/storage.objectViewer"

# CORS設定（全オリジンGET許可。infra/cors.json参照）
gcloud storage buckets update "gs://${BUCKET}" \
  --cors-file="infra/cors.json"

# シードデータアップロード（フロントの同梱データを初期値として配置）
gcloud storage cp "data/beyblades.json" "gs://${BUCKET}/beyblades.json" \
  --cache-control="public,max-age=3600"

# ---------------------------------------------------------------------------
# 5. スクレイパー用サービスアカウント（バケットへのobjectAdminのみ）
# ---------------------------------------------------------------------------
step "[5/9] スクレイパー用サービスアカウント作成"
if gcloud iam service-accounts describe "${SCRAPER_SA_EMAIL}" \
    --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "サービスアカウント ${SCRAPER_SA_EMAIL} は既に存在します。作成をスキップします。"
else
  gcloud iam service-accounts create "${SCRAPER_SA_NAME}" \
    --project="${PROJECT_ID}" \
    --display-name="Lineup Scraper (Cloud Run Job)"
fi

# プロジェクト全体ではなく、対象バケットのみにobjectAdminを付与
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${SCRAPER_SA_EMAIL}" \
  --role="roles/storage.objectAdmin"

# ---------------------------------------------------------------------------
# 6. Scheduler用サービスアカウント（run.jobs実行権限）
# ---------------------------------------------------------------------------
step "[6/9] Cloud Scheduler用サービスアカウント作成"
if gcloud iam service-accounts describe "${SCHEDULER_SA_EMAIL}" \
    --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "サービスアカウント ${SCHEDULER_SA_EMAIL} は既に存在します。作成をスキップします。"
else
  gcloud iam service-accounts create "${SCHEDULER_SA_NAME}" \
    --project="${PROJECT_ID}" \
    --display-name="Cloud Scheduler Invoker"
fi

# Cloud Run Job "lineup-scraper" をjobs.run APIで起動するための権限
# 条件なし（無条件）バインディングとして付与する
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SCHEDULER_SA_EMAIL}" \
  --role="roles/run.invoker"

# ---------------------------------------------------------------------------
# 7. Cloud Scheduler: 毎週月曜09:00 Asia/Tokyo にlineup-scraperをHTTP起動
# ---------------------------------------------------------------------------
step "[7/9] Cloud Schedulerジョブ作成"
# Cloud Run Jobs Admin API の jobs.run エンドポイント
# https://cloud.google.com/run/docs/execute/jobs-on-schedule 参照
SCRAPER_RUN_URI="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${SCRAPER_JOB_NAME}:run"

if gcloud scheduler jobs describe "${SCHEDULER_JOB_NAME}" \
    --project="${PROJECT_ID}" --location="${REGION}" >/dev/null 2>&1; then
  echo "Schedulerジョブ ${SCHEDULER_JOB_NAME} は既に存在します。設定を更新します。"
  gcloud scheduler jobs update http "${SCHEDULER_JOB_NAME}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --schedule="0 9 * * 1" \
    --time-zone="Asia/Tokyo" \
    --uri="${SCRAPER_RUN_URI}" \
    --http-method=POST \
    --oauth-service-account-email="${SCHEDULER_SA_EMAIL}" \
    --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform"
else
  # 注意: Cloud Run Job "lineup-scraper" 自体は infra/deploy.sh scraper で
  # 先にデプロイしておく必要がある（未デプロイでもScheduler登録自体は可能）
  gcloud scheduler jobs create http "${SCHEDULER_JOB_NAME}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --schedule="0 9 * * 1" \
    --time-zone="Asia/Tokyo" \
    --uri="${SCRAPER_RUN_URI}" \
    --http-method=POST \
    --oauth-service-account-email="${SCHEDULER_SA_EMAIL}" \
    --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform"
fi

# ---------------------------------------------------------------------------
# 8. 予算アラート: 月500円（50%/90%/100%で通知）
# ---------------------------------------------------------------------------
step "[8/9] 予算アラート作成"
if gcloud billing budgets list --billing-account="${BILLING_ACCOUNT_ID}" \
    --format="value(displayName)" 2>/dev/null | grep -qx "${BUDGET_DISPLAY_NAME}"; then
  echo "予算 ${BUDGET_DISPLAY_NAME} は既に存在します。作成をスキップします。"
  echo "（内容を変更したい場合は Cloud Console から手動編集するか、"
  echo " 'gcloud billing budgets list/update' を使用してください）"
else
  gcloud billing budgets create \
    --billing-account="${BILLING_ACCOUNT_ID}" \
    --display-name="${BUDGET_DISPLAY_NAME}" \
    --budget-amount="${BUDGET_AMOUNT}" \
    --filter-projects="projects/${PROJECT_ID}" \
    --threshold-rule=percent=0.5 \
    --threshold-rule=percent=0.9 \
    --threshold-rule=percent=1.0
fi

# ---------------------------------------------------------------------------
# 9. Firebase Hostingの有効化
# ---------------------------------------------------------------------------
step "[9/9] Firebase Hostingの有効化"
# 既にFirebase有効化済みのプロジェクトに対して実行するとエラーになるが、
# その場合は「既に有効」という意味なので無視して続行する
if ! firebase projects:addfirebase "${PROJECT_ID}"; then
  echo "firebase projects:addfirebase が失敗しました。"
  echo "既にFirebaseが有効化済みの場合は無視して問題ありません。"
  echo "未確認の場合は 'firebase projects:list' で確認してください。"
fi

step "セットアップ完了"
cat <<EOF
プロジェクト: ${PROJECT_ID}
リージョン:   ${REGION}
バケット:     gs://${BUCKET}
出題データURL: https://storage.googleapis.com/${BUCKET}/beyblades.json

次のステップ:
  1. .firebaserc の "REPLACE_WITH_PROJECT_ID" を "${PROJECT_ID}" に置き換える
  2. infra/deploy.sh api で ranking-api をデプロイし、発行されたURLを
     src/config.js の apiBaseUrl に反映する
  3. infra/deploy.sh scraper で lineup-scraper をデプロイする
     （Cloud SchedulerのHTTP起動先ジョブが存在する必要があるため、
       このステップの後に本スクリプトのステップ7を再実行してもよい）
  4. infra/deploy.sh hosting で Firebase Hosting にデプロイする
EOF
