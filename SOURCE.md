# Source and transformation

## Official sources

- Provider: 厚生労働省
- Current table: <https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/minimumichiran/index.html>
- 2025 edition PDF: <https://www.mhlw.go.jp/content/11200000/001571192.pdf>
- Minimum wage Q&A: <https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/faq/faq_saiteichingin.html>
- Edition: 2025年度（令和7年度）
- Current-table verification: 2026-08-02
- PDF: 41,566 bytes; SHA-256 `a65722d895c2d69dcf370600d7ec115289e8db9d3355836a08df6c475032c6e2`
- Terms: 公共データ利用規約（第1.0版）
- Terms page: <https://www.mhlw.go.jp/chosakuken/index.html>

出典：厚生労働省「地域別最低賃金の全国一覧」を加工して作成。

## Verified dimensions

- 47都道府県、9地域
- 全国加重平均 1,121円（前年度 1,055円、66円・6.3%引上げ）
- 最高 1,226円、最低 1,023円
- 時間額、前年度額、引上げ額・率、発効日の欠損0
- 都道府県名とIDの重複0
- 全行で「時間額 − 前年度額 ＝ 引上げ額」が一致
- 全行で引上げ率の小数第1位丸めが一致

全国加重平均は公式表の値を保持します。人口・雇用者数などの重みをこのリポジトリで再構成していないため、都道府県値から独自に算出し直しません。

## Transformation / 加工

1. PDFの47行を都道府県コード順に転記する。
2. 和暦の発効年月日を西暦ISO日付へ変換する。
3. 都道府県を北海道、東北、関東、北陸甲信越、東海、近畿、中国、四国、九州・沖縄へ分類する。
4. 入力時間との単純な積をブラウザで計算する。
5. 都道府県コード由来の公開IDを比較リストの端末保存に使う。

金額、率、発効日を推測・補完しません。公式PDFのハッシュが変わった場合は更新内容を人が確認します。

## Interpretation boundary

収録値は地域別最低賃金です。地域別と特定（産業別）の最低賃金が両方適用される場合は高い方が基準になります。派遣労働者は派遣先の事業場に適用される最低賃金が基準です。最低賃金との比較から除外される手当や割増部分があるため、入力時間との積は月給・日給の適法性を判定しません。個別判断は公式Q&Aまたは都道府県労働局で確認してください。
