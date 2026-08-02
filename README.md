# 最低賃金くらべ

47都道府県の地域別最低賃金を探し、時間額、前年度からの上げ幅、発効日、入力時間との単純な積を最大4地域で比較する日本語Webサービスです。

- Production: <https://saitei-chingin.yhay81.com>
- Source: 厚生労働省「地域別最低賃金の全国一覧」2025年度版（2026年8月1日に現行表として確認）
- Runtime: Cloudflare Workers + Hono JSX + Vite+ + D1
- Account: 不要

## Commands

```powershell
npm install
npm run data:check
npm run check
npm test
npm run build
npm run dev
```

公開前は`npm run release:check`を実行します。D1 migrationを適用してから`npm run deploy`で配信します。

## Data boundary

地域別最低賃金の時間額、前年度額、引上げ額・率、発効日だけを収録します。特定（産業別）最低賃金、個人の賃金構成、税・手当・割増賃金は含みません。入力時間との積は地域差をつかむ参考値で、最低賃金への適合判定ではありません。

コードはMIT Licenseです。データの利用条件は[SOURCE.md](SOURCE.md)を参照してください。
