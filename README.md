# BEYBLADE X QUIZ

スマホのブラウザで遊ぶ、BEYBLADE Xのパーツ画像4択クイズです。1問10秒以内に答え、間違えるまで連続正解に挑戦します。

ブレードはBX/UX/CXの35種類からランダムに出題されます。ラチェット、ビットも出題されます。1位記録を出すと名前を入力して、端末内ランキングに保存できます。

## ローカルで動かす

```bash
npm run serve
```

ブラウザで `http://localhost:5173` を開きます。

テストは次で実行できます。

```bash
npm test
```

## 画像について

クイズ画像はタカラトミー公式BEYBLADE X製品ページのパーツ画像URLを参照しています。ローカル試作用の実装なので、公開デプロイ前には画像利用条件を確認してください。

主な参照元:

- https://beyblade.takaratomy.co.jp/gear/
- https://beyblade.takaratomy.co.jp/beyblade-x/lineup/index.html

## デプロイ

このリポジトリはGitHub Pages用のワークフローを含みます。`main` ブランチへpushすると、静的ファイルがGitHub Pagesへデプロイされます。

ランキングはブラウザの `localStorage` に保存される端末内ランキングです。全プレイヤー共通ランキングにする場合は、Cloudflare Pages Functions + D1/KV、またはSupabaseなどのバックエンドを追加します。
