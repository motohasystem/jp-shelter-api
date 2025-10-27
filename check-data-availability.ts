import * as fs from 'fs';
import * as path from 'path';

interface CityToCode {
  [cityName: string]: string;
}

interface UnavailableCity {
  code: string;
  name: string;
  evacuation: boolean;
  emergency: boolean;
}

interface DataAvailability {
  unavailable: {
    both: UnavailableCity[];
    evacuationOnly: UnavailableCity[];
    emergencyOnly: UnavailableCity[];
  };
  summary: {
    total: number;
    available: number;
    unavailable: number;
    bothMissing: number;
    evacuationMissing: number;
    emergencyMissing: number;
    evacuationTotal: number;
    emergencyTotal: number;
  };
}

/**
 * 指定されたパスにファイルが存在するかチェック
 */
function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

/**
 * 都道府県名のみの自治体コードを除外（例：「群馬県」→「100005」）
 * これらは実際の市区町村ではないため、避難所データの対象外
 */
function isPrefectureOnly(cityName: string): boolean {
  // 「〇〇県」「〇〇府」「〇〇都」のみで市区町村名がない場合
  return /^(北海道|.*[都道府県])$/.test(cityName);
}

/**
 * 全自治体の避難所データの可用性をチェック
 */
function checkDataAvailability(
  cityToCodePath: string,
  evacuationDir: string,
  emergencyDir: string
): DataAvailability {
  // city-to-code.jsonを読み込む
  const cityToCodeData = fs.readFileSync(cityToCodePath, 'utf-8');
  const cityToCode: CityToCode = JSON.parse(cityToCodeData);

  const bothMissing: UnavailableCity[] = [];
  const evacuationMissing: UnavailableCity[] = [];
  const emergencyMissing: UnavailableCity[] = [];

  let total = 0;
  let availableCount = 0;
  let evacuationTotal = 0;
  let emergencyTotal = 0;

  // 各自治体について避難所データの存在をチェック
  for (const [cityName, code] of Object.entries(cityToCode)) {
    // 都道府県のみのエントリはスキップ
    if (isPrefectureOnly(cityName)) {
      continue;
    }

    total++;

    const evacuationPath = path.join(evacuationDir, `${code}.json`);
    const emergencyPath = path.join(emergencyDir, `${code}.json`);

    const hasEvacuation = fileExists(evacuationPath);
    const hasEmergency = fileExists(emergencyPath);

    if (hasEvacuation) evacuationTotal++;
    if (hasEmergency) emergencyTotal++;

    if (hasEvacuation || hasEmergency) {
      availableCount++;
    }

    // データが欠けている場合は記録
    if (!hasEvacuation && !hasEmergency) {
      bothMissing.push({
        code,
        name: cityName,
        evacuation: false,
        emergency: false,
      });
    } else if (!hasEvacuation) {
      evacuationMissing.push({
        code,
        name: cityName,
        evacuation: false,
        emergency: true,
      });
    } else if (!hasEmergency) {
      emergencyMissing.push({
        code,
        name: cityName,
        evacuation: true,
        emergency: false,
      });
    }
  }

  return {
    unavailable: {
      both: bothMissing,
      evacuationOnly: evacuationMissing,
      emergencyOnly: emergencyMissing,
    },
    summary: {
      total,
      available: availableCount,
      unavailable: total - availableCount,
      bothMissing: bothMissing.length,
      evacuationMissing: evacuationMissing.length,
      emergencyMissing: emergencyMissing.length,
      evacuationTotal,
      emergencyTotal,
    },
  };
}

/**
 * メイン処理
 */
function main() {
  const cityToCodePath = path.join(__dirname, 'docs', 'api', 'v0', 'city-to-code.json');
  const evacuationDir = path.join(__dirname, 'docs', 'api', 'v0', 'evacuation');
  const emergencyDir = path.join(__dirname, 'docs', 'api', 'v0', 'emergency');
  const outputPath = path.join(__dirname, 'docs', 'api', 'v0', 'data-availability.json');

  console.log('避難所データの可用性をチェックしています...');
  console.log(`city-to-code.json: ${cityToCodePath}`);
  console.log(`evacuation dir: ${evacuationDir}`);
  console.log(`emergency dir: ${emergencyDir}`);

  // データの可用性をチェック
  const availability = checkDataAvailability(cityToCodePath, evacuationDir, emergencyDir);

  // 結果を表示
  console.log('\n=== チェック結果 ===');
  console.log(`総自治体数: ${availability.summary.total}`);
  console.log(`データあり: ${availability.summary.available}`);
  console.log(`データなし: ${availability.summary.unavailable}`);
  console.log(`\n指定避難所データあり: ${availability.summary.evacuationTotal}`);
  console.log(`緊急避難所データあり: ${availability.summary.emergencyTotal}`);
  console.log(`\n両方なし: ${availability.summary.bothMissing}`);
  console.log(`指定避難所のみなし: ${availability.summary.evacuationMissing}`);
  console.log(`緊急避難所のみなし: ${availability.summary.emergencyMissing}`);

  // JSONファイルとして保存
  fs.writeFileSync(outputPath, JSON.stringify(availability, null, 2), 'utf-8');
  console.log(`\n結果を保存しました: ${outputPath}`);

  // サンプルを表示
  if (availability.unavailable.both.length > 0) {
    console.log('\n両方のデータがない自治体（最初の5件）:');
    availability.unavailable.both.slice(0, 5).forEach(city => {
      console.log(`  - ${city.name} (${city.code})`);
    });
  }
}

// スクリプトとして実行された場合
if (require.main === module) {
  main();
}

export { checkDataAvailability, DataAvailability, UnavailableCity };
