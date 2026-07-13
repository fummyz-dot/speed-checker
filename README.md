# Speed Checker

Cloudflare のエッジネットワークを利用し、ブラウザだけで現在のインターネット回線品質を測定する静的 Web アプリです。FAST.com の分かりやすさを参考にしつつ、独自のダークテーマと詳細指標の表示を備えています。バックエンドや API キーは不要です。

## 主な機能

- ダウンロード／アップロード速度の測定と Mbps 表示
- アイドル時レイテンシ、ジッター、ダウンロード／アップロード負荷時レイテンシの ms 表示
- 測定フェーズごとの状態表示と測定中のボタン無効化
- エラー表示と再測定
- モバイル、タブレット、PC に対応したレスポンシブデザイン
- キーボード操作、ライブリージョン、Reduced Motion などのアクセシビリティ対応
- 測定中断を伴うアンマウント時のクリーンアップ

パケットロス測定は実装していません。

## 使用技術

- React 19
- TypeScript
- Vite
- CSS
- `@cloudflare/speedtest`
- Node.js LTS / npm

## ローカル起動方法

Node.js 20.19 以上の LTS 環境を用意してください。

```bash
npm install
npm run dev
```

ターミナルに表示される URL（通常は `http://localhost:5173`）をブラウザで開きます。

## 本番ビルド方法

```bash
npm run lint
npm run build
```

ビルド成果物は `dist` ディレクトリへ出力されます。ローカルで成果物を確認する場合は `npm run preview` を実行してください。

## Cloudflare Pages への公開設定

Git リポジトリを Cloudflare Pages に接続し、次の値を設定します。

| 項目 | 設定値 |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node.js version | `20` 以上の LTS |

`public/_redirects` に SPA フォールバックを設定済みです。環境変数や外部 API キーの設定は必要ありません。

## ディレクトリ構成

```text
.
├── public/
│   └── _redirects             # Cloudflare Pages の SPA フォールバック
├── src/
│   ├── components/            # 表示コンポーネント
│   ├── hooks/
│   │   └── useSpeedTest.ts    # 測定処理と状態管理
│   ├── types/                 # アプリ内の型定義
│   ├── utils/                 # 単位変換・表示丸め
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── eslint.config.js
├── index.html
├── package.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

## 注意事項

- 測定では Cloudflare の公開測定エンドポイントとの間でデータを送受信するため、回線速度に応じて一定量の通信が発生します。モバイル回線や通信量制限のある環境では特に注意してください。
- `@cloudflare/speedtest` の仕様により、測定結果が集計・分析目的で Cloudflare へ送信される場合があります。
- ブラウザの Performance Resource Timing API を利用するため、拡張機能、VPN、プロキシ、端末負荷などが結果へ影響する場合があります。
- 結果は測定時点の目安です。Wi-Fi の電波状況や同一回線上の通信により変動します。

## 今後追加予定の機能

- 測定履歴の端末内保存と比較
- 結果の共有用画像生成
- 測定時間・推定通信量の表示
- 多言語表示
- PWA 対応とオフライン時の案内

