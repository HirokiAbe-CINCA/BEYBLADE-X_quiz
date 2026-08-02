# BEYBLADE X QUIZ

スマホのブラウザで遊ぶ、BEYBLADE Xのパーツ画像4択クイズです。最初は1問10秒以内、10問正解後は1問5秒以内に答え、間違えるまで連続正解に挑戦します。

ブレード・ラチェット・ビットが出題されます。記録は端末内ランキング（localStorage）と全国ランキング（上位30件）に保存できます。

非公式のファンメイドアプリであり、タカラトミーとは関係ありません。個人利用範囲の限定公開運用を前提としています。

## 構成

全体設計は [docs/architecture.md](docs/architecture.md) を参照してください。

- `src/` — フロントエンド（Vanilla JS、ビルドなし）。Firebase Hostingで配信
- `data/beyblades.json` — 出題データ（同梱フォールバック。本番はGCS上のJSONを優先取得）
- `server/ranking-api/` — 全国ランキングAPI（Cloud Run + Firestore）
- `server/scraper/` — 出題データ自動更新ジョブ（Cloud Run Job、週1回Cloud Scheduler起動）
- `infra/` — GCPプロビジョニング・デプロイスクリプト（手順は [infra/README.md](infra/README.md)）

## ローカルで動かす

```bash
npm run serve
```

ブラウザで `http://localhost:5173` を開きます。全国ランキングも試す場合はAPIを併せて起動し、`src/config.js` の `apiBaseUrl` を `http://localhost:8080` にします。

```bash
cd server/ranking-api && npm install && LOCAL_DEV=1 npm start
```

## テスト

```bash
npm test                          # フロントエンド
cd server/ranking-api && npm test # ランキングAPI
cd server/scraper && npm test     # スクレイパー
```

## 出題データの更新

週1回、スクレイパーがタカラトミー公式ラインナップから新商品を検知し、安全弁（スキーマ検証・画像死活・件数ガード）を通過したものだけをGCS上の出題データに自動反映します。CX系のラチェット/ビットや未知のビット名称は自動登録せず通知に回します（詳細は docs/architecture.md と server/scraper/README.md）。

## 画像について

クイズ画像はタカラトミー公式BEYBLADE X製品ページのパーツ画像URLを参照しています（自サーバーへの複製はしていません）。利用条件に関する指摘があれば速やかに対応します。

主な参照元:

- https://beyblade.takaratomy.co.jp/beyblade-x/lineup/index.html

## デプロイ

GCP（Cloud Run / Firestore / GCS / Cloud Scheduler / Firebase Hosting）へのセットアップとデプロイは [infra/README.md](infra/README.md) を参照してください。
