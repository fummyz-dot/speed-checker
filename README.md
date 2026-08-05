# Speed Checker

[Speed Checker](https://speed-checker.web-tools-jp.workers.dev/) は、Cloudflare のエッジネットワークを使って現在のインターネット回線品質を測定する Web アプリです。ダークテーマのシンプルな画面で、速度測定と接続元ネットワーク情報を確認できます。

## 主な機能

- ダウンロード／アップロード速度（Mbps）
- アイドル時レイテンシ、ジッター、ダウンロード／アップロード負荷時レイテンシ（ms）
- 測定フェーズ、エラー、再測定の表示
- ダウンロード完了後に始まる3頭の速度レース（下り速度＝走行時間、上り速度＝ジャンプ高）
- Web閲覧、動画、Web会議、オンラインゲーム、ファイル送信の用途別参考評価
- 測定値から直接確認できる範囲に限定した安全なコメント
- 同じブラウザに保存した前回測定との比較（最大30件）
- ブラウザ内で生成する1200 × 630pxの結果共有PNG
- 接続元 ASN の所有組織、AS 番号、地域、Cloudflare 拠点、HTTP プロトコルの表示
- 320px 幅から PC まで対応するレスポンシブ UI
- キーボード操作、ライブリージョン、Reduced Motion への対応
- SEO メタデータ、`robots.txt`、`sitemap.xml`

接続元ネットワークの名称は、契約サービスのブランド名ではなく、Cloudflare がリクエストの ASN 情報から判定した「ASN の所有組織」です。VPN、プロキシ、法人回線では、実際の契約プロバイダと異なる場合があります。クライアントの IP アドレスは API レスポンスへ含めず、画面への表示や保存も行いません。

## 測定結果の見方

コースには標準馬、高速馬、ユーザー回線を表す馬の3頭が待機します。ダウンロード測定が完了してアップロード測定へ移るとレースが始まり、ユーザー馬の走行時間はダウンロード速度から9.5〜18秒の範囲で決まります。先着馬はゴールで待機し、最後の馬が到着するとゴール側へフォーカスして3頭が横並びになります。その後、基準馬は固定高、ユーザー馬はアップロード速度に応じた高さで同時にジャンプします。「もう一度見る」ではコースと3頭を初期位置へ戻し、測定済みの値だけを使って再生します。OSでモーション軽減が有効な場合は馬体の小刻みな動きを省略しますが、パン・走行・ジャンプは再生します。

5種類の用途別評価と測定コメントは、今回取得した速度とPingだけを基にした目安です。利用サービス、時間帯、通信経路、端末などによって実際の品質は変わります。回線、Wi-Fi、ルーターなどの原因・故障診断を行う機能ではありません。

## 測定履歴と共有画像

正常に完了した測定のID、日時、ダウンロード速度、アップロード速度、Pingだけを、同じ端末・ブラウザのLocalStorageへ最大30件保存します。サーバーやデータベースへ測定履歴を送信せず、IPアドレス、接続元ネットワーク名、位置情報、端末・ブラウザ情報は保存しません。LocalStorageが利用できない場合も速度測定は利用できます。

保存済みの結果は、測定完了後の「前回測定との比較」にある「履歴を削除」ボタンから、確認ダイアログを経て削除できます。

「結果を画像で共有」は、Canvas APIを使ってブラウザ内でPNGを生成します。画像には測定値、測定日時、代表的な用途別評価だけを含み、接続情報や保存済み履歴は含めません。画像ファイルを扱えるWeb Share APIが利用可能な端末では共有画面を開き、それ以外ではPNGをダウンロードします。

## 使用技術

- React 19 / TypeScript / Vite
- `@cloudflare/speedtest`
- Cloudflare Workers
- Workers Static Assets
- Worker API (`GET /api/connection`)
- Vitest / React Testing Library
- Node.js 24 / npm

## ローカル開発

Node.js 24 を使用します。nvm を使う場合は `.nvmrc` を利用できます。

```bash
nvm use
npm ci
npm run dev
```

`npm run dev` は Vite のフロントエンド開発サーバーです。`/api/connection` を含む Worker とビルド成果物をまとめて確認する場合は、次を実行します。

```bash
npm run dev:worker
```

## npm scripts

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | Vite 開発サーバー |
| `npm run build` | 型チェックと本番ビルド |
| `npm run lint` | ESLint |
| `npm test` | テストを1回実行 |
| `npm run test:watch` | テストの watch 実行 |
| `npm run preview` | `dist` の Vite プレビュー |
| `npm run dev:worker` | ビルド後に Wrangler 開発サーバーを起動 |
| `npm run deploy:dry-run` | ビルドとデプロイ構成の検証（公開しない） |
| `npm run deploy` | ビルドして Cloudflare Workers へデプロイ |

## ビルド・テスト

```bash
npm run lint
npm test
npm run build
npm run deploy:dry-run
```

Vite の成果物は `dist/` に出力されます。GitHub Actions の CI では Node.js 24 上で `npm ci`、lint、test、build、Wrangler dry-run を実行し、Secret や実デプロイは使用しません。

## Cloudflare Workers へのデプロイ

`wrangler.jsonc` は `dist/` を Workers Static Assets として配信し、`/api/*` だけ Worker を先に実行します。静的な JavaScript、CSS、画像はアセット配信を優先し、SPA ナビゲーションは `index.html` へフォールバックします。

Cloudflare アカウントへログインした環境で実行してください。

```bash
npm run deploy:dry-run
npm run deploy
```

API キー、環境変数、KV、D1 などの追加 binding は不要です。Cloudflare ダッシュボードで既存の `speed-checker` Worker を Git 連携している場合は、Node.js 24、ビルドコマンド `npm run build`、デプロイコマンド `npx wrangler deploy` を設定します。旧 Cloudflare Pages の `wrangler pages deploy` は使用しません。

## API

`GET /api/connection` は `request.cf` から次の項目だけを返します。

```json
{
  "provider": "Example Network",
  "asn": 12345,
  "country": "JP",
  "region": "Tokyo",
  "city": "Tokyo",
  "cloudflareColo": "NRT",
  "protocol": "HTTP/3"
}
```

値がない項目は `null` です。外部 IP 情報 API、Cookie、識別子、API キーは使いません。IP アドレス、緯度、経度、郵便番号は読み取ってレスポンスへコピーする設計にしていません。GET 以外は 405、未定義の `/api/*` は 404 を返します。

## ディレクトリ構成

```text
.
├── .github/workflows/ci.yml
├── public/                 # favicon、robots.txt、sitemap.xml
├── src/
│   ├── components/         # UI コンポーネント
│   ├── hooks/              # 速度測定・接続情報の状態管理
│   ├── lib/                # 判定、アニメーション変換、履歴、画像生成
│   ├── services/           # API 通信と実行時 JSON 検証
│   ├── types/              # フロントエンド型
│   └── test/               # テストセットアップ
├── worker/
│   ├── connectionInfo.ts   # request.cf の純粋な変換処理
│   └── index.ts            # Worker のルーティング
├── wrangler.jsonc
└── worker-configuration.d.ts
```

## 制約事項

- 測定では回線速度に応じて一定量の通信が発生します。通信量制限のある回線では注意してください。
- `@cloudflare/speedtest` の仕様により、測定結果が集計・分析目的で Cloudflare へ送信される場合があります。
- 拡張機能、VPN、プロキシ、Wi-Fi の電波状況、端末負荷、同一回線上の通信が結果へ影響します。
- 接続情報 API は Cloudflare Workers 上の `request.cf` を前提とするため、Vite 単体の開発サーバーでは取得できません。
- パケットロス測定は実装していません。
- 用途別評価とコメントは今回の測定値に基づく参考情報であり、原因や故障を診断するものではありません。
