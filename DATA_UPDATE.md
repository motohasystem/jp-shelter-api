# 避難場所データ更新手順書

Japan Shelter API（https://motohasystem.github.io/jp-shelter-api/ ）が配信する避難場所データを、最新の公開データに更新するための手順書です。

## 自動更新（GitHub Actions）

データ更新は GitHub Actions で自動化されています： [.github/workflows/update-data.yml](.github/workflows/update-data.yml)

- **スケジュール実行**: 毎月2日 05:00 JST に自動実行
- **手動実行**: GitHub リポジトリの Actions タブ → 「Update shelter data」→ 「Run workflow」

ワークフローは本書の手順1〜7と同じ処理を実行します：

1. 国土地理院のサーバーから全国GeoJSONを直接ダウンロード
   - ダウンロードサイトのZIPはブラウザ内で生成されているだけなので、元ファイル
     `https://hinanmap.gsi.go.jp/hinanjocp/defaultFtpData/geoJSON/mergeFromCity_{1,2}.geojson` を直接取得
2. 総務省ページから団体コードExcelのURLをスクレイピングしてダウンロード
   - ExcelのURL（`/main_content/XXXXXXXXX.xlsx`）は更新のたびに変わるため、ページ先頭の Excel リンクを抽出
3. マスター変換 → 旧データクリア → 分割 → 可用性チェック
4. 検証（ファイル数の一致・自治体数の下限・データなし率・サンプル自治体の中身）
5. **検証に合格した場合のみ** `github-actions[bot]` として main にコミット＆プッシュ（GitHub Pages に自動反映）
6. 実行結果を Slack に通知
   - ✅ 更新あり（自治体数の統計付き） / 📭 変更なし / ❌ 失敗（Actions実行ログへのリンク付き）
   - リポジトリの Secrets に `SLACK_WEBHOOK_URL`（Slack Incoming Webhook のURL）の登録が必要

データに変更がなければコミットせずに終了します。更新日時は `docs/api/v0/last-updated.json` で確認できます。

ソースサイトの構成変更などでワークフローが失敗した場合は、Actions のログを確認のうえ、以下の手動手順で更新してください。

---

## 手動更新手順

国土地理院・総務省のデータ更新（年数回程度）に合わせて、この手順を実行します。

## 全体フロー

```
[1] ソースデータの取得
      ├─ 国土地理院: 避難所GeoJSON（mergeFromCity_1 / mergeFromCity_2）
      └─ 総務省: 団体コードマスター（Excel）
            ↓
[2] 団体コードマスターの変換 (excel-to-json.js)
      → docs/api/v0/code-to-city.json
      → docs/api/v0/city-to-code.json
            ↓
[3] 旧データのクリア
            ↓
[4] GeoJSONの分割 (split-geojson.js)
      → docs/api/v0/evacuation/{団体コード}.json
      → docs/api/v0/emergency/{団体コード}.json
            ↓
[5] データ可用性チェック (check-data-availability.js --generate-files)
      → docs/api/v0/data-availability.json
      → データなし自治体の unavailable ファイル生成
            ↓
[6] 検証
            ↓
[7] コミット & プッシュ（GitHub Pages で自動公開）
```

## 前提条件

- Node.js がインストールされていること
- 本リポジトリ（`jp-shelter-api`）のルートで以下を実行済みであること

```bash
npm install
npm run build   # TypeScript → JavaScript (*.js) をコンパイル
```

`*.js` は `.gitignore` 対象のため、クローン直後は必ず `npm run build` が必要です。

## 手順

### 1. ソースデータの取得

#### 1-1. 避難所データ（国土地理院）

[指定緊急避難場所・指定避難所データ | 国土地理院](https://www.gsi.go.jp/bousaichiri/hinanbasho.html) から全国データ（ZIP）をダウンロードし、解凍した GeoJSON をリポジトリのルートに置きます。

| ファイル | 内容 | 対応するAPI |
|---|---|---|
| `mergeFromCity_1.geojson` | 指定避難所 (Evacuation) | `/api/v0/evacuation/` |
| `mergeFromCity_2.geojson` | 指定緊急避難場所 (Emergency) | `/api/v0/emergency/` |

ソースの GeoJSON はサイズが大きいためリポジトリにはコミットしません（作業用の一時ファイルとして扱います）。取得日を控えておき、後で README の出典セクションに反映します。

#### 1-2. 団体コードマスター（総務省）

[全国地方公共団体コード | 総務省](https://www.soumu.go.jp/denshijiti/code.html) から「都道府県コード及び市区町村コード」（Excel、`.xls`）をダウンロードし、リポジトリのルートに置きます。

団体コードは6桁（都道府県コード2桁 + 市区町村コード4桁）で、APIのファイル名・エンドポイントのキーになります。

> 市町村合併・名称変更があった年は必ず最新版を取り直してください。マスターが古いと、分割時に該当自治体が `unknown.json` に落ちます。

### 2. 団体コードマスターの変換

Excel を2種類のJSONに変換します。**出力先は API 配信ディレクトリ（`docs/api/v0/`）を直接指定**します。

```bash
node excel-to-json.js 都道府県コード及び市区町村コード.xls docs/api/v0/code-to-city.json
```

生成されるファイル（どちらもそのままマスターデータAPIとして配信されます）：

- `docs/api/v0/code-to-city.json` — 団体コード → 市区町村名（階層構造）
- `docs/api/v0/city-to-code.json` — 「都道府県名+市町村名」→ 団体コード（逆引き・フラット構造）

`city-to-code.json` は同じディレクトリに自動生成されます（出力パスのディレクトリ部分が使われます）。

### 3. 旧データのクリア

分割スクリプトは既存ファイルを削除しないため、**前回の生成物が残ったままだと、今回のソースに存在しない自治体の古いデータ（廃止団体コードや前回の unavailable ファイルなど）が配信され続けます**。更新前に必ずクリアします。

```bash
rm -rf docs/api/v0/evacuation docs/api/v0/emergency
mkdir -p docs/api/v0/evacuation docs/api/v0/emergency
```

（PowerShell の場合: `Remove-Item -Recurse -Force docs/api/v0/evacuation, docs/api/v0/emergency` の後 `New-Item -ItemType Directory` で再作成）

### 4. GeoJSONの分割

全国 GeoJSON を団体コードごとの個別ファイルに分割し、API配信ディレクトリへ出力します。マスターは高速な `city-to-code.json` を使います。

```bash
# 指定避難所 → evacuation
node split-geojson.js mergeFromCity_1.geojson docs/api/v0/city-to-code.json docs/api/v0/evacuation

# 指定緊急避難場所 → emergency
node split-geojson.js mergeFromCity_2.geojson docs/api/v0/city-to-code.json docs/api/v0/emergency
```

各出力ファイルは `{ type, name: 団体コード, features: [...] }` の FeatureCollection です。

実行ログの末尾に出る **「市区町村コードが見つからないフィーチャー: N件」の警告に注意**してください。該当データは出力先の `unknown.json` に保存されます（`.gitignore` 対象なのでコミットはされません）。

- 数件程度: `unknown.json` の `都道府県名及び市町村名` を確認し、表記ゆれ（スペース・「東京都」vs「東京」など）が原因なら許容範囲か判断
- 大量に発生: 団体コードマスターが古い可能性が高い → 手順1-2からやり直し

### 5. データ可用性チェックと unavailable ファイルの生成

全自治体についてデータの有無をチェックし、データがない自治体には 404 の代わりに返す unavailable レスポンス用 JSON を生成します。

```bash
node check-data-availability.js --generate-files
```

このスクリプトはパス固定（`docs/api/v0/` 配下を参照）なので、**必ずリポジトリのルートで実行**してください。実行結果：

- `docs/api/v0/data-availability.json` — データなし自治体のリストと統計（データ可用性APIとして配信）
- `docs/api/v0/evacuation/{code}.json`, `docs/api/v0/emergency/{code}.json` — データなし自治体分の `"type": "unavailable"` レスポンス

コンソールに統計（総自治体数 / データあり / データなし件数）が表示されるので控えておきます。

> `--generate-files` を付け忘れると `data-availability.json` の更新のみでファイル生成が行われず、データなし自治体へのアクセスが 404 になります。

### 6. 検証

コミット前に以下を確認します。

```bash
# ファイル数の確認（evacuation / emergency とも全自治体数と一致するはず。2025年10月時点で1917件）
ls docs/api/v0/evacuation | wc -l
ls docs/api/v0/emergency | wc -l

# サンプル自治体の中身を目視確認（例: 札幌市）
head -40 docs/api/v0/evacuation/011002.json
```

チェックポイント：

- [ ] evacuation / emergency のファイル数が `data-availability.json` の `summary.total` と一致する
- [ ] 既知の自治体（例: `011002` 札幌市）で features が入っており、座標・施設名が妥当
- [ ] `data-availability.json` の `summary` が前回から極端に変化していない（データなし自治体が急増していたら手順ミスを疑う）
- [ ] `unknown.json` の件数が許容範囲

### 7. コミットとプッシュ

README のデータ取得日（「データの出典」セクションの日付）を今回の取得日に更新してから、生成物をコミットします。

```bash
git add docs/api/v0 README.md
git commit -m "避難所データを更新（国土地理院 YYYY-MM-DD 取得分）"
git push github main   # リモート名は origin ではなく github
```

GitHub Pages が `docs/` をルートとして配信しているため、プッシュ後数分で API に反映されます。

反映確認：

```
https://motohasystem.github.io/jp-shelter-api/api/v0/evacuation/011002.json
https://motohasystem.github.io/jp-shelter-api/api/v0/data-availability.json
```

最後に、作業用の一時ファイル（`mergeFromCity_*.geojson`、`*.xls`、`unknown.json`）をルートから削除して完了です。

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| `unknown.json` に大量のデータが落ちる | 団体コードマスターが古い/表記ゆれ。最新のExcelを取得し直す。詳細は [README.md](README.md) のトラブルシューティング参照 |
| データなし自治体で 404 が返る | 手順5で `--generate-files` を付け忘れ。再実行する |
| 廃止された自治体のファイルが残っている | 手順3のクリアを飛ばした。クリア後に手順4〜5をやり直す |
| Excelの列構成が変わって変換に失敗する | `excel-to-json.ts` の列番号（`row[0]`: 団体コード, `row[1]`: 都道府県名及び市町村名）を調整して `npm run build` |

## 関連ファイル

- [split-geojson.ts](split-geojson.ts) — GeoJSON分割ツール本体
- [excel-to-json.ts](excel-to-json.ts) — 団体コードマスター変換ツール
- [check-data-availability.ts](check-data-availability.ts) — データ可用性チェックツール
- [README.md](README.md) — APIの仕様・各ツールの詳細
