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
  report.kind === "advertising"
    ? "public/data/advertising.json.gz"
    : report.kind === "catalog" && report.marketplace === "wb"
      ? "public/data/catalog-wb.json.gz"
      : "public/data/report.json.gz",
  gzipSync(strToU8(JSON.stringify(report))),
);
console.log(
  report.kind === "catalog"
    ? `Подготовлен каталог WB: ${report.rows.length} SKU, период ${report.start} — ${report.end}.`
    : `Подготовлено ${report.rows.length} строк, ${new Set(report.rows.filter((r) => report.kind !== "advertising" || r.sku !== "0").map((r) => r.sku)).size} SKU. Расхождений с итогом: ${report.discrepancies.length}.`,
);
