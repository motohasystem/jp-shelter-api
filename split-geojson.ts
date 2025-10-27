import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

// GeoJSON型定義
interface FeatureProperties {
  "津波"?: string;
  "施設・場所名"?: string;
  "NO"?: number;
  "内水氾濫"?: string;
  "洪水"?: string;
  "住所"?: string;
  "共通ID"?: string;
  "指定避難所との住所同一"?: string;
  "大規模な火事"?: string;
  "地震"?: string;
  "高潮"?: string;
  "崖崩れ、土石流及び地滑り"?: string;
  "都道府県名及び市町村名"?: string;
  "火山現象"?: string;
  "備考"?: string;
}

interface Geometry {
  type: string;
  coordinates: number[];
}

interface Feature {
  type: string;
  properties: FeatureProperties;
  geometry: Geometry;
}

interface GeoJSON {
  type: string;
  name?: string;
  features: Feature[];
}

// 市区町村情報
interface City {
  code: string;      // 6桁の団体コード
  name: string;      // 都道府県名及び市町村名
  cityName?: string; // 市町村名のみ（都道府県名を除く）
}

// 都道府県情報
interface Prefecture {
  name: string;
  code: string;
  cities: {
    [cityCode: string]: City;
  };
}

// 階層構造のマスターデータ
interface HierarchicalCityCodeMap {
  [prefectureCode: string]: Prefecture;
}

// 市区町村コードマスター（フラット版：検索用）
interface CityCodeMap {
  [cityName: string]: string; // 市町村名 -> 団体コード（6桁）
}

// 市区町村コードマスターを読み込む（ExcelまたはJSON）
function loadCityCodeMaster(filePath: string): CityCodeMap {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    // JSONファイルから読み込む
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(fileContent);

    // 階層構造かフラット構造かを判定
    const firstKey = Object.keys(jsonData)[0];
    if (firstKey && jsonData[firstKey].cities) {
      // 階層構造のJSONをフラットなマップに変換
      const hierarchicalData = jsonData as HierarchicalCityCodeMap;
      const flatMap: CityCodeMap = {};

      for (const prefCode in hierarchicalData) {
        const prefecture = hierarchicalData[prefCode];
        for (const cityCode in prefecture.cities) {
          const city = prefecture.cities[cityCode];
          flatMap[city.name] = city.code;
        }
      }

      console.log(`市区町村コードマスター読み込み完了 (JSON/階層): ${Object.keys(flatMap).length}件`);
      return flatMap;
    } else {
      // フラット構造のJSON
      const cityCodeMap: CityCodeMap = jsonData;
      console.log(`市区町村コードマスター読み込み完了 (JSON/フラット): ${Object.keys(cityCodeMap).length}件`);
      return cityCodeMap;
    }
  } else if (ext === '.xls' || ext === '.xlsx') {
    // Excelファイルから読み込む
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // 最初のシートを使用
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    const cityCodeMap: CityCodeMap = {};

    // ヘッダー行をスキップして、データ行を処理
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row.length >= 2) {
        const cityCode = String(row[0] || '').trim(); // 1列目: 市区町村コード
        const cityName = String(row[1] || '').trim(); // 2列目: 都道府県名及び市町村名

        if (cityName && cityCode) {
          cityCodeMap[cityName] = cityCode;
        }
      }
    }

    console.log(`市区町村コードマスター読み込み完了 (Excel): ${Object.keys(cityCodeMap).length}件`);
    return cityCodeMap;
  } else {
    throw new Error(`未対応のファイル形式です: ${ext} (対応形式: .json, .xls, .xlsx)`);
  }
}

// 市区町村コードから都道府県番号を抽出（先頭2桁）
function extractPrefectureCode(cityCode: string): string {
  return cityCode.substring(0, 2);
}

// GeoJSONファイルを市区町村コードで分類
function splitGeoJSONByCityCode(
  inputFilePath: string,
  cityCodeMasterPath: string,
  outputDir: string = './output'
): void {
  // 市区町村コードマスターを読み込み
  const cityCodeMap = loadCityCodeMaster(cityCodeMasterPath);

  // 入力ファイルを読み込み
  const fileContent = fs.readFileSync(inputFilePath, 'utf-8');
  const geoJson: GeoJSON = JSON.parse(fileContent);

  // 出力ディレクトリが存在しない場合は作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 市区町村コードでグループ化
  const groupedFeatures = new Map<string, Feature[]>();
  let unknownCount = 0;

  geoJson.features.forEach((feature) => {
    const cityName = feature.properties["都道府県名及び市町村名"];

    if (cityName && cityCodeMap[cityName]) {
      const fullCode = cityCodeMap[cityName]; // 6桁の団体コード
      if (!groupedFeatures.has(fullCode)) {
        groupedFeatures.set(fullCode, []);
      }
      groupedFeatures.get(fullCode)!.push(feature);
    } else {
      // 団体コードが見つからない場合
      const unknownKey = "unknown";
      if (!groupedFeatures.has(unknownKey)) {
        groupedFeatures.set(unknownKey, []);
      }
      groupedFeatures.get(unknownKey)!.push(feature);
      unknownCount++;
    }
  });

  if (unknownCount > 0) {
    console.log(`警告: 市区町村コードが見つからないフィーチャー: ${unknownCount}件\n`);
  }

  // 各グループを個別のJSONファイルとして出力
  let processedCount = 0;
  groupedFeatures.forEach((features, cityCode) => {
    const outputGeoJson: GeoJSON = {
      type: geoJson.type,
      name: cityCode === "unknown" ? "不明" : cityCode,
      features: features
    };

    let outputFilePath: string;

    if (cityCode === "unknown") {
      // 団体コードが見つからない場合
      outputFilePath = path.join(outputDir, 'unknown.json');
    } else {
      // 団体コード.json としてフラットに出力
      // 例: 011002.json
      outputFilePath = path.join(outputDir, `${cityCode}.json`);
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(outputGeoJson, null, 2), 'utf-8');

    processedCount++;
    console.log(`[${processedCount}/${groupedFeatures.size}] ${cityCode}: ${features.length}件 → ${outputFilePath}`);
  });

  console.log(`\n処理完了: ${processedCount}ファイルを出力しました`);
  console.log(`合計フィーチャー数: ${geoJson.features.length}`);
}

// メイン処理
function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('使用方法: node split-geojson.js <入力GeoJSONファイルパス> <市区町村コードマスターパス(.xls/.xlsx/.json)> [出力ディレクトリ]');
    console.error('例1: node split-geojson.js input.geojson city-to-code.json ./output  (推奨・高速)');
    console.error('例2: node split-geojson.js input.geojson code-to-city.json ./output');
    console.error('例3: node split-geojson.js input.geojson 都道府県コード及び市区町村コード.xls ./output');
    process.exit(1);
  }

  const inputFilePath = args[0];
  const cityCodeMasterPath = args[1];
  const outputDir = args[2] || './output';

  if (!fs.existsSync(inputFilePath)) {
    console.error(`エラー: 入力ファイルが見つかりません: ${inputFilePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(cityCodeMasterPath)) {
    console.error(`エラー: 市区町村コードマスターファイルが見つかりません: ${cityCodeMasterPath}`);
    process.exit(1);
  }

  console.log(`入力ファイル: ${inputFilePath}`);
  console.log(`市区町村コードマスター: ${cityCodeMasterPath}`);
  console.log(`出力ディレクトリ: ${outputDir}\n`);

  try {
    splitGeoJSONByCityCode(inputFilePath, cityCodeMasterPath, outputDir);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
