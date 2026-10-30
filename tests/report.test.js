import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync, strFromU8, zipSync, strToU8 } from "fflate";
import {
  getView,
  groupDays,
  normalizeDate,
  previousRange,
  rangePreset,
  ratio,
} from "../src/data/report.js";
import { parseWorkbook } from "../src/data/import-report.js";
const report = JSON.parse(
  strFromU8(
    gunzipSync(
      readFileSync(new URL("../public/data/report.json.gz", import.meta.url)),
    ),
  ),
);
const all = {
  start: report.minDate,
  end: report.maxDate,
  query: "",
  abc: "all",
  scheme: "all",
};
test("initial dataset: 18,047 daily rows and 311 distinct SKU", () => {
  assert.equal(report.rows.length, 18047);
  assert.equal(new Set(report.rows.map((r) => r.sku)).size, 311);
  assert.equal(report.minDate, "2026-07-30");
  assert.equal(report.maxDate, "2026-10-29");
});
test("unfiltered KPIs preserve source summary rather than contradictory details", () => {
  const v = getView(report, all);
  assert.equal(v.total.amount, 8151692);
  assert.equal(v.total.orders, 2605);
  assert.equal(v.total.bought, 2141);
  assert.equal(v.useSummary, true);
  assert.deepEqual(
    report.discrepancies.map((d) => d.difference),
    [46, 28],
  );
  assert.equal(
    v.days.reduce((s, d) => s + d.amount, 0),
    8151738,
  );
});
test("date filter is inclusive and recalculates detail totals", () => {
  const v = getView(report, { ...all, start: "2026-10-23", end: "2026-10-29" });
  assert.equal(v.total.amount, 799382);
  assert.equal(v.total.orders, 243);
  assert.equal(v.useSummary, false);
  assert.deepEqual(
    v.days.map((d) => d.amount),
    [166969, 88127, 55601, 92482, 99239, 133003, 163961],
  );
  const one = getView(report, {
    ...all,
    start: "2026-10-29",
    end: "2026-10-29",
  });
  assert.equal(one.total.amount, 163961);
  assert.equal(one.days.length, 1);
});
test("product search matches exact SKU, aggregates product across dates", () => {
  const v = getView(report, { ...all, query: "5330035142" });
  assert.equal(v.products.length, 1);
  assert.equal(v.total.amount, 1557747);
  assert.equal(v.total.orders, 215);
  assert.equal(v.useSummary, false);
  assert.equal(
    getView(report, { ...all, query: "НЕСУЩЕСТВУЮЩИЙ ТОВАР" }).empty,
    true,
  );
});
test("ABC and mixed fulfillment filters select source rows without double-counting", () => {
  const a = getView(report, { ...all, abc: "A" });
  assert.ok(a.rows.every((r) => r.abc === "A"));
  const fbo = getView(report, { ...all, scheme: "FBO" });
  assert.ok(fbo.rows.every((r) => r.scheme.includes("FBO")));
  assert.equal(
    fbo.total.orders,
    fbo.rows.reduce((s, r) => s + r.orders, 0),
  );
});
test("grouping preserves totals and partial calendar months", () => {
  const days = getView(report, all).days;
  const months = groupDays(days, "month");
  assert.deepEqual(
    months.map((d) => d.amount),
    [0, 825739, 3720987, 3605012],
  );
  assert.equal(
    groupDays(days, "week").reduce((s, d) => s + d.orders, 0),
    2605,
  );
});
test("date helpers are timezone-independent and percentages handle zero", () => {
  assert.equal(normalizeDate("29.10.2026"), "2026-10-29");
  assert.equal(normalizeDate("46324"), "2026-10-29");
  assert.deepEqual(previousRange("2026-10-23", "2026-10-29"), {
    start: "2026-10-16",
    end: "2026-10-22",
  });
  assert.deepEqual(rangePreset(report, "7"), {
    start: "2026-10-23",
    end: "2026-10-29",
  });
  assert.equal(ratio(0, 0), 0);
});
function workbook(sheetName = "По товарам") {
  const cell = (col, row, val) =>
    `<c r="${col}${row}" t="inlineStr"><is><t>${val}</t></is></c>`;
  const row = (i, vals) =>
    `<row r="${i}">${Object.entries(vals)
      .map(([c, v]) => cell(c, i, v))
      .join("")}</row>`;
  const sheet = `<worksheet><sheetData>${row(8, { A: "Продавец: TEST" })}${row(10, { A: "Товары", H: "SKU", J: "День" })}${row(11, { M: "Заказано на сумму", AC: "Заказано товаров" })}${row(13, { A: "Итого и среднее", M: "200", AC: "2", AF: "1" })}${row(14, { A: "Тест &amp; товар", H: "123", J: "2026-10-29", K: "A", M: "200", AC: "2", AF: "1", AG: "1" })}</sheetData></worksheet>`;
  return zipSync({
    "xl/workbook.xml": strToU8(
      `<workbook><sheets><sheet name="${sheetName}" r:id="rId1"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  });
}
test("Excel import reads inline strings and entities without relying on invalid stylesheet", () => {
  const r = parseWorkbook(workbook(), "test.xlsx");
  assert.equal(r.seller, "TEST");
  assert.equal(r.rows[0].name, "Тест & товар");
  assert.equal(r.summary.amount, 200);
  assert.equal(r.rows[0].orders, 2);
});
test("unsupported workbook fails with actionable message", () => {
  assert.throws(
    () => parseWorkbook(workbook("Другой лист"), "bad.xlsx"),
    /нет листа/,
  );
});
