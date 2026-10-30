import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename } from "node:path";
import { gzipSync, strToU8 } from "fflate";
import { parseWorkbook } from "../src/data/import-report.js";
const input = process.argv[2];
if (!input) {
  console.error(
    "Использование: node scripts/prepare-data.js /path/to/report.xlsx",
  );
  process.exit(1);
}
const report = parseWorkbook(readFileSync(input), basename(input));
mkdirSync("public/data", { recursive: true });
writeFileSync(
  "public/data/report.json.gz",
  gzipSync(strToU8(JSON.stringify(report))),
);
console.log(
  `Подготовлено ${report.rows.length} строк, ${new Set(report.rows.map((r) => r.sku)).size} SKU. Расхождений с итогом: ${report.discrepancies.length}.`,
);
