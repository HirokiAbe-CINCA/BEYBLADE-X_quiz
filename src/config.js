// デプロイ環境の設定。空文字はその機能を無効化する（アプリはローカル動作を継続）。
export const CONFIG = {
  // Cloud Run ranking-api のベースURL（例: 'https://ranking-api-xxxx-an.a.run.app'）
  apiBaseUrl: 'https://ranking-api-yxyll2z6kq-an.a.run.app',
  // GCS上の出題データURL（例: 'https://storage.googleapis.com/<bucket>/beyblades.json'）
  dataUrl: 'https://storage.googleapis.com/beyblade-x-quiz-data/beyblades.json',
};
