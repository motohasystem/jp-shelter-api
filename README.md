# Japan Shelter API - GeoJSON分割ツール

GeoJSONファイルを団体コードで分類し、団体コードごとの個別ファイルとして出力するツールです。

## APIエンドポイント

Japan Shelter APIは、全国の避難所データを団体コード（6桁）ごとに提供します。

**サンプルURL**:
- 緊急避難所（札幌市）: https://motohasystem.github.io/jp-shelter-api/api/v0/emergency/011002.json
- 指定避難所（札幌市）: https://motohasystem.github.io/jp-shelter-api/api/v0/evacuation/011002.json

**エンドポイント形式**:
```
https://motohasystem.github.io/jp-shelter-api/api/v0/{type}/{cityCode}.json
```

- `{type}`: `evacuation` (指定避難所) または `emergency` (緊急避難所)
- `{cityCode}`: 6桁の団体コード (例: `011002` = 北海道札幌市)

### データが存在しない場合のレスポンス

避難所データが公開されていない自治体でも、404エラーの代わりに適切なJSONレスポンスが返ります：

```json
{
  "type": "unavailable",
  "code": "111015",
  "name": "埼玉県さいたま市西区",
  "dataType": "evacuation",
  "message": "この自治体の指定避難所データは公開されていません。",
  "note": "政令指定都市の区の場合、市全体としてデータが提供されている可能性があります。"
}
```

このレスポンスにより、APIを利用するアプリケーションは、データが存在しないことを適切にユーザーに伝えることができます。

### マスターデータAPI

団体コードと市区町村名の変換に使用できるマスターデータも提供しています。以下のURLから直接アクセス可能です：

- **code-to-city.json**: 団体コードから市区町村名を引くためのデータ（階層構造）
  - https://motohasystem.github.io/jp-shelter-api/api/v0/code-to-city.json
- **city-to-code.json**: 市区町村名から団体コードを引くためのデータ（逆引き用）
  - https://motohasystem.github.io/jp-shelter-api/api/v0/city-to-code.json

### データ可用性API

避難所情報を公開していない自治体を確認できるAPIを提供しています：

- **data-availability.json**: 避難所データが存在しない自治体のリスト
  - https://motohasystem.github.io/jp-shelter-api/api/v0/data-availability.json

このAPIは、全国の自治体について指定避難所と緊急避難所のデータの有無をチェックし、以下の情報を返します：

- **unavailable.both**: 指定避難所・緊急避難所の両方のデータがない自治体
- **unavailable.evacuationOnly**: 指定避難所のデータのみがない自治体
- **unavailable.emergencyOnly**: 緊急避難所のデータのみがない自治体
- **summary**: 統計情報（総自治体数、データあり/なしの件数など）

データ構造例：
```json
{
  "unavailable": {
    "both": [
      {
        "code": "111015",
        "name": "埼玉県さいたま市西区",
        "evacuation": false,
        "emergency": false
      }
    ],
    "evacuationOnly": [...],
    "emergencyOnly": [...]
  },
  "summary": {
    "total": 1917,
    "available": 1722,
    "unavailable": 195,
    "bothMissing": 195,
    "evacuationMissing": 10,
    "emergencyMissing": 28,
    "evacuationTotal": 1712,
    "emergencyTotal": 1694
  }
}
```

**注意**: 政令指定都市の区（例：さいたま市西区、千葉市中央区など）は、市全体としてデータが提供されている場合があります。

## データの出典

このツールは、以下の公的データを使用しています（2025年10月27日時点に取得したデータをもとにしています）。

### 1. 避難所データ

**出典**: [指定緊急避難場所・指定避難所データ | 国土地理院](https://www.gsi.go.jp/bousaichiri/hinanbasho.html)

国土地理院では、全国の市町村から提供された指定緊急避難場所および指定避難所のデータを、GeoJSON形式で公開しています。このツールは、そのデータを自治体（団体コード）ごとに分割し、APIとして利用しやすい形式に変換します。

### 2. 市区町村コード

**出典**: [全国地方公共団体コード | 総務省](https://www.soumu.go.jp/denshijiti/code.html)

総務省が公開する「都道府県コード及び市区町村コード」（Excelファイル）を使用して、都道府県名及び市町村名を6桁の団体コードに変換しています。このコードは、都道府県コード（上2桁）と市区町村コード（下4桁）で構成されています。

## データソース

処理対象のGeoJSONファイル：

- **mergeFromCity_1.geojson**: 指定避難所データ (Evacuation)
- **mergeFromCity_2.geojson**: 緊急避難所データ (Emergency Evacuation)

各ファイルの`features[].properties["都道府県名及び市町村名"]`プロパティを使用して、団体コードに変換し分類します。

## 機能

- GeoJSONファイルを`features[].properties["都道府県名及び市町村名"]`の値で分類
- 団体コードマスター（Excel/JSON）を使用してコード変換
  - `code-to-city.json`: 都道府県と市区町村の親子関係を持つ階層構造JSON
  - `city-to-code.json`: フルネーム（都道府県名+市区町村名）から団体コードを検索できる逆引きJSON
  - 全シート（通常の市区町村 + 政令指定都市）を自動処理
- `団体コード.json` のフラット構造で出力
  - ファイル名: 6桁の団体コード
- 団体コードが見つからない場合は `unknown.json` として保存

## 全体の流れ

1. **市区町村コードマスターの準備**: Excelファイル（`都道府県コード及び市区町村コード.xls`）をJSON形式に変換
2. **GeoJSONデータの分割**: 避難所データ（`mergeFromCity_1.geojson`, `mergeFromCity_2.geojson`）を団体コードごとに分割
3. **データ可用性チェック**: 全自治体のデータ可用性を確認し、unavailableファイルを生成
4. **API配信**: 生成されたJSONファイルを `/api/v0/{type}/{cityCode}.json` のエンドポイント構造で公開

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. TypeScriptのコンパイル

```bash
npm run build
```

## 使用方法

### 市区町村コードマスターの準備

#### 団体コードの構造

団体コードは6桁の数字で構成されます:
- **上2桁**: 都道府県コード（例: "01" = 北海道）
- **下4桁**: 市区町村コード（例: "7001"）
- **6桁全体**: 団体コード（例: "017001"）

#### データの取得

[総務省のサイト](https://www.soumu.go.jp/denshijiti/code.html)から「都道府県コード及び市区町村コード」（Excelファイル）をダウンロードしてください。

#### オプション1: Excelファイルをそのまま使用

ダウンロードした `都道府県コード及び市区町村コード.xls` をそのまま使用できます。

#### オプション2: ExcelファイルをJSONに変換（推奨）

処理速度を向上させるため、ExcelファイルをJSON形式に変換することを推奨します。

```bash
node excel-to-json.js 都道府県コード及び市区町村コード.xls code-to-city.json
```

このコマンドを実行すると、2つのJSONファイルが生成されます：

##### 1. code-to-city.json（階層構造）

団体コードから市区町村情報を引くためのJSON:
```json
{
  "01": {
    "name": "北海道",
    "code": "01",
    "cities": {
      "7001": {
        "code": "017001",
        "name": "北海道○○市",
        "cityName": "○○市"
      }
    }
  },
  "13": {
    "name": "東京都",
    "code": "13",
    "cities": {
      "101": {
        "code": "13101",
        "name": "東京都千代田区",
        "cityName": "千代田区"
      }
    }
  }
}
```

**注意**: split-geojson.tsは階層構造とフラット構造の両方のJSONに対応しています。

##### 2. city-to-code.json（逆引き用）

都道府県名及び市町村名（フルネーム）から団体コードを引くためのJSON:
```json
{
  "北海道札幌市": "011002",
  "北海道函館市": "012025",
  "東京都千代田区": "131016",
  "東京都中央区": "131024",
  ...
}
```

このファイルは、都道府県名と市区町村名を結合したフルネームをキーとして、対応する6桁の団体コードを素早く検索できます。

### GeoJSONファイルの分割

#### Excelマスターを使用する場合

```bash
node split-geojson.js <入力GeoJSONファイル> 都道府県コード及び市区町村コード.xls [出力ディレクトリ]
```

例:
```bash
node split-geojson.js input.geojson 都道府県コード及び市区町村コード.xls ./output
```

#### JSONマスターを使用する場合（推奨）

city-to-code.json（フラット構造、高速）またはcode-to-city.json（階層構造）のどちらも使用可能です。

**city-to-code.json を使用（推奨）**:
```bash
node split-geojson.js <入力GeoJSONファイル> city-to-code.json [出力ディレクトリ]
```

実際の使用例:
```bash
# 指定避難所データを処理
node split-geojson.js mergeFromCity_1.geojson city-to-code.json ./output/evacuation

# 緊急避難所データを処理
node split-geojson.js mergeFromCity_2.geojson city-to-code.json ./output/emergency
```

または **code-to-city.json を使用**:
```bash
node split-geojson.js mergeFromCity_1.geojson code-to-city.json ./output/evacuation
```

### データ可用性のチェックとunavailableファイルの生成

GeoJSONの分割後、全自治体のデータ可用性をチェックし、データが存在しない自治体用のunavailableファイルを生成します。

#### 基本的なチェック（ファイル生成なし）

```bash
node check-data-availability.js
```

これにより、`data-availability.json` が生成され、どの自治体のデータが存在しないかがわかります。

#### unavailableファイルの生成

```bash
node check-data-availability.js --generate-files
```

`--generate-files` オプションを付けると、データが存在しない自治体用のJSONファイルが生成されます：

- 指定避難所データがない自治体 → `evacuation/{cityCode}.json` に unavailable レスポンス
- 緊急避難所データがない自治体 → `emergency/{cityCode}.json` に unavailable レスポンス

これにより、すべての自治体コードでアクセスが可能になり、404エラーの代わりに適切なJSONレスポンスが返るようになります。

## 出力構造

split-geojson.jsは、GeoJSONの`"都道府県名及び市町村名"`プロパティを使って、city-to-code.jsonから団体コードを引き、以下のフラット構造で保存します：

### 単一ファイルを処理する場合
```
output/
├── 010006.json  # 団体コード（6桁）: 北海道
├── 011002.json  # 団体コード（6桁）: 北海道札幌市
├── 012025.json  # 団体コード（6桁）: 北海道函館市
├── 131016.json  # 団体コード（6桁）: 東京都千代田区
├── 131024.json  # 団体コード（6桁）: 東京都中央区
├── ...
└── unknown.json # 団体コードが見つからないデータ
```

### 指定避難所と緊急避難所を別々に処理する場合（推奨）
```
output/
├── evacuation/   # 指定避難所 (Evacuation) - mergeFromCity_1.geojson
│   ├── 010006.json
│   ├── 011002.json
│   └── ...
└── emergency/    # 緊急避難所 (Emergency Evacuation) - mergeFromCity_2.geojson
    ├── 010006.json
    ├── 011002.json
    └── ...
```

この構造は、APIエンドポイント `/api/v0/{type}/{cityCode}.json` に対応しています。

**処理の流れ**:
1. GeoJSONから`properties["都道府県名及び市町村名"]`を取得（例: "北海道札幌市"）
2. city-to-code.jsonから団体コードを検索（例: "011002"）
3. `団体コード.json`として保存（例: `011002.json`）

**ファイル名**: 6桁の団体コード

各JSONファイルの構造:
```json
{
  "type": "FeatureCollection",
  "name": "011002",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "都道府県名及び市町村名": "北海道札幌市",
        "施設・場所名": "○○小学校",
        "住所": "北海道札幌市中央区...",
        "津波": "○",
        "洪水": "○",
        "地震": "○",
        ...
      },
      "geometry": {
        "type": "Point",
        "coordinates": [141.347899, 43.064171]
      }
    },
    ...
  ]
}
```

**ファイル名**: `011002.json` (団体コード)
**name**: 団体コード（6桁）
**features**: その団体コードに属する全避難所（Evacuation または Emergency Evacuation）

## ファイル説明

- `split-geojson.ts` - GeoJSONファイルを団体コードで分割するメインツール
  - Excel/JSON両方のマスターファイルに対応
  - 階層構造とフラット構造の両方のJSONに対応
- `excel-to-json.ts` - Excelファイル（団体コードマスター）をJSON形式に変換するツール
  - `code-to-city.json`: 都道府県と市区町村の親子関係を持つ階層構造JSON
  - `city-to-code.json`: フルネーム（都道府県名+市区町村名）から団体コードを検索できる逆引きJSON
  - 全シート（通常の市区町村 + 政令指定都市）を処理
- `check-data-availability.ts` - 避難所データの可用性をチェックするツール
  - 全自治体について指定避難所と緊急避難所のデータの有無を確認
  - データが存在しない自治体のリストをJSON形式で生成
  - `data-availability.json`を`docs/api/v0/`ディレクトリに出力
  - `--generate-files` オプション付きで実行すると、データが存在しない自治体用のunavailableファイルを生成
    - 例: `node check-data-availability.js --generate-files`
    - これにより、すべての自治体コードでアクセス可能になり、404エラーの代わりに適切なJSONレスポンスが返る
- `package.json` - プロジェクト設定と依存パッケージ
- `tsconfig.json` - TypeScript設定

## トラブルシューティング

### 団体コードが見つからない

`unknown` フォルダに出力されたデータを確認し、以下を確認してください:

1. GeoJSONの`都道府県名及び市町村名`の値が正確か
2. 団体コードマスターに該当する市町村名が存在するか
3. 余分なスペースや特殊文字が含まれていないか
4. 都道府県名の表記が一致しているか（例: "東京都" vs "東京"）

### Excelファイルの構造が異なる

`excel-to-json.ts`の列番号（`row[0]`: 団体コード, `row[1]`: 都道府県名及び市町村名）を、
お使いのExcelファイルの構造に合わせて調整してください。

### 階層構造のJSONが正しく読み込めない

`split-geojson.ts`は自動的に階層構造とフラット構造を判定します。
問題がある場合は、JSONファイルの構造を確認してください。

## ライセンス

MIT
