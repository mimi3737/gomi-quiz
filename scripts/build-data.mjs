// 世田谷区のごみ分別CSVを、クイズ用の data.js に変換するスクリプト。
// 実行: node scripts/build-data.mjs
//
// 重要: CSV はヘッダー名と実データの列が入れ替わっている。
//   3列目「品目」          -> 実際は分別区分
//   4列目「分別区分」      -> 実際は品目名
// そのため列はヘッダー名ではなく位置で扱う。

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const CSV_PATH = join(root, '131121_setagayaku_garbage_separate.csv');
const OUT_PATH = join(root, 'data.js');

const CATEGORIES = [
  '可燃ごみ',
  '不燃ごみ',
  '資源',
  '粗大ごみ',
  '拠点回収',
  '区では収集していません',
];

// --- RFC 4180 の最小パーサ ---
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      // CRLF の CR はここで捨てる
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// 元の区分表記から、含まれている区分名を取り出す。
// 例: "陶器製は不燃ごみ、プラスチック製は可燃ごみ" -> ["不燃ごみ", "可燃ごみ"]
//     "可燃ごみ（厚紙に包んで）"                    -> ["可燃ごみ"]
function extractCategories(raw) {
  const found = [];
  for (const name of CATEGORIES) {
    let from = 0;
    for (;;) {
      const at = raw.indexOf(name, from);
      if (at === -1) break;
      if (!found.includes(name)) found.push(name);
      from = at + name.length;
    }
  }
  // 表記どおりの順序に並べ替える
  found.sort((a, b) => raw.indexOf(a) - raw.indexOf(b));
  return found;
}

const text = readFileSync(CSV_PATH, 'utf8');
const rows = parseCsv(text);
const header = rows.shift();
const dataRows = rows.filter((r) => r.length > 1 && r.some((c) => c.trim() !== ''));

if (header.length !== 9) {
  throw new Error(`ヘッダーが9列ではありません: ${header.length}列`);
}

const records = [];
const seenItems = new Set();
const errors = [];

for (const r of dataRows) {
  const [code, id, rawCategory, rawItem, , feeType, , , remark] = r;
  const item = (rawItem ?? '').trim();
  const originalCategory = (rawCategory ?? '').trim();
  const categories = extractCategories(originalCategory);
  const fee = (feeType ?? '').trim();

  if (!item) {
    errors.push(`品目名が空の行があります (ID: ${id})`);
    continue;
  }
  if (categories.length === 0) {
    errors.push(`区分を判別できません: "${originalCategory}" (品目: ${item})`);
    continue;
  }
  if (fee !== '無料' && fee !== '有料') {
    errors.push(`料金種別が想定外です: "${fee}" (品目: ${item})`);
  }
  if (seenItems.has(item)) {
    errors.push(`品目名が重複しています: ${item}`);
  }
  seenItems.add(item);

  records.push({
    id: (id ?? '').trim(),
    item,
    categories,
    note: (remark ?? '').trim(),
    fee,
    originalCategory,
  });
}

if (errors.length > 0) {
  console.error('変換できませんでした:');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}

records.sort((a, b) => a.id.localeCompare(b.id));

const body = records
  .map((rec) => '  ' + JSON.stringify(rec, null, 0))
  .join(',\n');

const js = `// このファイルは scripts/build-data.mjs が生成します。直接編集しないでください。
// 出典: 世田谷区 ごみの分別方法 (131121)
window.GARBAGE_DATA = [
${body}
];
`;

writeFileSync(OUT_PATH, js, 'utf8');

// --- 検証用の集計を表示 ---
console.log(`出力: ${OUT_PATH}`);
console.log(`品目数: ${records.length}`);

const byCategory = new Map(CATEGORIES.map((c) => [c, 0]));
for (const rec of records) {
  for (const c of rec.categories) byCategory.set(c, byCategory.get(c) + 1);
}
for (const [c, n] of byCategory) console.log(`  ${c}: ${n}`);
console.log(`複数正解: ${records.filter((r) => r.categories.length > 1).length}`);
console.log(`備考あり: ${records.filter((r) => r.note !== '').length}`);
console.log(`有料: ${records.filter((r) => r.fee === '有料').length}`);
console.log(`区の表記と区分名が異なる: ${records.filter((r) => r.originalCategory !== r.categories.join('、')).length}`);
