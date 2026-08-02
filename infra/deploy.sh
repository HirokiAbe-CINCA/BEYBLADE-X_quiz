#!/usr/bin/env bash
#
# infra/deploy.sh — BEYBLADE X QUIZ 繰り返しデプロイスクリプト
#
# 使い方:
#   PROJECT_ID=my-project ./infra/deploy.sh all|api|scraper|hosting
#
# api      : ranking-api (Cloud Run サービス) をデプロイ
# scraper  : lineup-scraper (Cloud Run Job) をデプロイ
# hosting  : Firebase Hosting へ静的フロントエンドをデプロイ
# all      : api → scraper → hosting の順に実行
#
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-asia-northeast1}"
BUCKET="${BUCKET:-${PROJECT_ID}-data}"

# ranking-api のCORS許可オリジン。Firebase HostingのURLを指定する。
# 例: https://<project-id>.web.app,https://<project-id>.firebaseapp.com
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-}"

SCRAPER_SA_NAME="${SCRAPER_SA_NAME:-lineup-scraper-sa}"
SCRAPER_SA_EMAIL="${SCRAPER_SA_EMAIL:-${SCRAPER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com}"

RANKING_API_SERVICE="ranking-api"
SCRAPER_JOB_NAME="lineup-scraper"

usage() {
  cat <<'EOF'
使い方:
  PROJECT_ID=<GCPプロジェクトID> ./infra/deploy.sh <all|api|scraper|hosting>

必須環境変数:
  PROJECT_ID       対象GCPプロジェクトID

任意環境変数:
  REGION           デフォルト: asia-northeast1
  BUCKET           デフォルト: ${PROJECT_ID}-data
  ALLOWED_ORIGINS  ranking-apiのCORS許可オリジン（カンマ区切り、api実行時に使用）
                   例: https://<project-id>.web.app,https://<project-id>.firebaseapp.com
  SCRAPER_SA_EMAIL scraperデプロイに使うサービスアカウント
                   デフォルト: lineup-scraper-sa@${PROJECT_ID}.iam.gserviceaccount.com

例:
  PROJECT_ID=my-project ./infra/deploy.sh all
  PROJECT_ID=my-project ALLOWED_ORIGINS=https://my-project.web.app ./infra/deploy.sh api
EOF
}

TARGET="${1:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "エラー: PROJECT_ID が未設定です。" >&2
  usage
  exit 1
fi

case "${TARGET}" in
  all|api|scraper|hosting) ;;
  *)
    echo "エラー: 引数は all|api|scraper|hosting のいずれかを指定してください。" >&2
    usage
    exit 1
    ;;
esac

deploy_api() {
  echo "==> ranking-api (Cloud Run) をデプロイします"

  if [[ -z "${ALLOWED_ORIGINS}" ]]; then
    echo "警告: ALLOWED_ORIGINSが未設定です。Firebase HostingのURLを指定してください。" >&2
    echo "      （未設定のままデプロイすると、フロントからのAPI呼び出しがCORSでブロックされます）" >&2
  fi

  gcloud run deploy "${RANKING_API_SERVICE}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --source="server/ranking-api" \
    --allow-unauthenticated \
    --set-env-vars="ALLOWED_ORIGINS=${ALLOWED_ORIGINS}"

  local api_url
  api_url="$(gcloud run services describe "${RANKING_API_SERVICE}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --format='value(status.url)')"

  echo ""
  echo "ranking-api URL: ${api_url}"
  echo "→ src/config.js の apiBaseUrl を上記URLに更新し、hosting を再デプロイしてください。"
  echo "  export const CONFIG = { apiBaseUrl: '${api_url}', ... };"
}

deploy_scraper() {
  echo "==> lineup-scraper (Cloud Run Job) をデプロイします"

  gcloud run jobs deploy "${SCRAPER_JOB_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --source="server/scraper" \
    --service-account="${SCRAPER_SA_EMAIL}" \
    --set-env-vars="DATA_BUCKET=${BUCKET}"

  echo ""
  echo "lineup-scraper をデプロイしました。手動実行・DRY_RUN確認方法は infra/README.md を参照してください。"
}

deploy_hosting() {
  echo "==> Firebase Hosting へデプロイします"
  echo "（事前に src/config.js の apiBaseUrl / dataUrl が最新であることを確認してください）"

  firebase deploy --only hosting --project="${PROJECT_ID}"
}

case "${TARGET}" in
  api)
    deploy_api
    ;;
  scraper)
    deploy_scraper
    ;;
  hosting)
    deploy_hosting
    ;;
  all)
    deploy_api
    deploy_scraper
    deploy_hosting
    ;;
esac
