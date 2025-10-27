import * as fs from 'fs';
import * as XLSX from 'xlsx';

// 都道府県情報
interface Prefecture {
  name: string;
  code: string;
  cities: {
    [cityCode: string]: City;
  };
}

// 市区町村情報
interface City {
  code: string;      // 6桁の団体コード
  name: string;      // 都道府県名及び市町村名
  cityName?: string; // 市町村名のみ（都道府県名を除く）
}

// 階層構造のマスターデータ
interface HierarchicalCityCodeMap {
  [prefectureCode: string]: Prefecture;
}

// 都道府県名を市町村名から抽出
function extractPrefectureName(fullName: string): string {
  const prefectures = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
    '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
    '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
    '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
  ];

  for (const pref of prefectures) {
    if (fullName.startsWith(pref)) {
      return pref;
    }
  }

  return '';
}

// シートからデータを処理して階層マップに追加
function processSheetData(
  data: any[][],
  hierarchicalMap: HierarchicalCityCodeMap,
  sheetName: string
): number {
  let processedCount = 0;

  // 最初の数行をデバッグ出力
  console.log(`  最初の5行のデータ構造:`);
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    console.log(`    行${i}: [${row ? row.slice(0, 4).map((v: any) => `"${v}"`).join(', ') : 'empty'}]`);
  }

  // ヘッダー行をスキップして、データ行を処理
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row && row.length >= 2) {
      const fullCode = String(row[0] || '').trim(); // 1列目: 団体コード（6桁）
      const prefectureName = String(row[1] || '').trim(); // 2列目: 都道府県名（漢字）
      const cityNameOnly = String(row[2] || '').trim(); // 3列目: 市区町村名（漢字）

      // フルネーム（都道府県名 + 市区町村名）を生成
      const fullName = prefectureName + cityNameOnly;

      // 最初の数件をデバッグ出力
      if (i <= 3) {
        console.log(`  行${i} - fullCode: "${fullCode}", prefName: "${prefectureName}", cityOnly: "${cityNameOnly}", fullName: "${fullName}"`);
      }

      if (fullName && fullCode && fullCode.length >= 6) {
        // 団体コードから都道府県コード（上2桁）と市区町村コード（下4桁）を抽出
        const prefectureCode = fullCode.substring(0, 2);
        const cityCode = fullCode.substring(2, 6);

        // 都道府県がまだ存在しない場合は作成
        if (!hierarchicalMap[prefectureCode]) {
          hierarchicalMap[prefectureCode] = {
            name: prefectureName,
            code: prefectureCode,
            cities: {}
          };
        }

        // 市区町村を追加
        hierarchicalMap[prefectureCode].cities[cityCode] = {
          code: fullCode,
          name: fullName,
          cityName: cityNameOnly
        };

        processedCount++;
      }
    }
  }

  return processedCount;
}

// Excelファイルから階層構造の市区町村コードマスターをJSON化
function convertExcelToHierarchicalJSON(excelFilePath: string, outputJsonPath: string): void {
  console.log(`Excelファイル読み込み: ${excelFilePath}`);

  const workbook = XLSX.readFile(excelFilePath);
  const hierarchicalMap: HierarchicalCityCodeMap = {};
  let totalProcessedCount = 0;

  console.log(`\n利用可能なシート: ${workbook.SheetNames.join(', ')}\n`);

  // 全シートを処理
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    console.log(`シート "${sheetName}" を処理中...`);
    console.log(`  行数: ${data.length}`);

    const processedCount = processSheetData(data, hierarchicalMap, sheetName);
    totalProcessedCount += processedCount;

    console.log(`  処理件数: ${processedCount}件\n`);
  }

  // code-to-city.json（階層構造）として出力
  fs.writeFileSync(outputJsonPath, JSON.stringify(hierarchicalMap, null, 2), 'utf-8');

  const prefectureCount = Object.keys(hierarchicalMap).length;
  console.log(`JSON変換完了:`);
  console.log(`  都道府県数: ${prefectureCount}`);
  console.log(`  市区町村数合計: ${totalProcessedCount}`);
  console.log(`出力ファイル (code-to-city): ${outputJsonPath}`);

  // city-to-code.json（逆引き用）を生成
  // フルネーム（都道府県名 + 市区町村名）をキーとして団体コードを引く
  const cityToCodeMap: { [fullName: string]: string } = {};
  for (const prefCode in hierarchicalMap) {
    const prefecture = hierarchicalMap[prefCode];
    for (const cityCode in prefecture.cities) {
      const city = prefecture.cities[cityCode];
      if (city.name) {
        cityToCodeMap[city.name] = city.code;
      }
    }
  }

  // city-to-code.json のパスを生成（同じディレクトリに出力）
  const outputDir = outputJsonPath.substring(0, outputJsonPath.lastIndexOf('/') + 1) ||
                    outputJsonPath.substring(0, outputJsonPath.lastIndexOf('\\') + 1) ||
                    '';
  const cityToCodePath = outputDir + 'city-to-code.json';

  fs.writeFileSync(cityToCodePath, JSON.stringify(cityToCodeMap, null, 2), 'utf-8');
  console.log(`出力ファイル (city-to-code): ${cityToCodePath}`);
  console.log(`  逆引きマップ件数: ${Object.keys(cityToCodeMap).length}件`);
}

// メイン処理
function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('使用方法: node excel-to-json.js <入力Excelファイルパス> [出力JSONファイルパス]');
    console.error('例: node excel-to-json.js 都道府県コード及び市区町村コード.xls code-to-city.json');
    process.exit(1);
  }

  const excelFilePath = args[0];
  const outputJsonPath = args[1] || 'code-to-city.json';

  if (!fs.existsSync(excelFilePath)) {
    console.error(`エラー: ファイルが見つかりません: ${excelFilePath}`);
    process.exit(1);
  }

  try {
    convertExcelToHierarchicalJSON(excelFilePath, outputJsonPath);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
