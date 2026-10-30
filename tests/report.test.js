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

// Regression cases: selected metric and grouped price must not reuse revenue.
test("metric product sets exclude unrelated zero values", async () => {
  const { metricProducts, metricValue } =
    await import("../src/data/metrics.js");
  const products = getView(report, all).products;
  const bought = metricProducts(products, "bought");
  assert.ok(bought.every((p) => p.bought > 0));
  assert.ok(bought.length < products.length);
  const prices = metricProducts(products, "averagePrice");
  assert.ok(prices.every((p) => p.orders > 0));
  assert.equal(metricValue({ amount: 200, orders: 2 }, "averagePrice"), 100);
  assert.equal(metricValue({ amount: 0, orders: 0 }, "averagePrice"), null);
});
test("weekly and monthly price uses volume weighting; missing days are not zero-priced sales", async () => {
  const { chartBuckets } = await import("../src/data/metrics.js");
  const days = [
    { date: "2026-10-20", amount: 100, orders: 1 },
    { date: "2026-10-21", amount: 4500, orders: 9 },
    { date: "2026-10-22", amount: 0, orders: 0 },
  ];
  assert.equal(chartBuckets(days, "day")[2].averagePrice, null);
  assert.equal(chartBuckets(days, "week")[0].averagePrice, 460);
  assert.equal(chartBuckets(days, "month")[0].averagePrice, 460);
  assert.equal(chartBuckets(days, "week")[0].startDate, "2026-10-20");
  assert.equal(chartBuckets(days, "week")[0].endDate, "2026-10-22");
});
test("automatic scale and bucket counts keep long periods readable", async () => {
  const { recommendedGroup, chartBuckets } =
    await import("../src/data/metrics.js");
  assert.equal(recommendedGroup(7), "day");
  assert.equal(recommendedGroup(31), "day");
  assert.equal(recommendedGroup(92), "week");
  assert.equal(recommendedGroup(200), "month");
  const v = getView(report, all),
    buckets = chartBuckets(v.days, "week");
  assert.equal(
    buckets.reduce((s, d) => s + d.cancelled, 0),
    450,
  );
  assert.equal(
    buckets.reduce((s, d) => s + d.returned, 0),
    14,
  );
  assert.equal(buckets.length, 14);
});

test("calendar grids use Monday weeks and handle leap years and year boundaries", async () => {
  const { monthGrid, shiftMonth, dayCountLabel, rangeLength } =
    await import("../src/data/calendar.js");
  const sep = monthGrid("2026-09-01");
  assert.equal(sep[0].date, "2026-08-31");
  assert.equal(sep[1].date, "2026-09-01");
  assert.equal(sep.filter((d) => d.inMonth).length, 30);
  assert.equal(monthGrid("2024-02-01").filter((d) => d.inMonth).length, 29);
  assert.equal(shiftMonth("2026-12-29", 1), "2027-01-01");
  assert.equal(shiftMonth("2026-01-15", -1), "2025-12-01");
  assert.equal(rangeLength("2026-10-23", "2026-10-29"), 7);
  assert.equal(dayCountLabel(1), "1 день");
  assert.equal(dayCountLabel(2), "2 дня");
  assert.equal(dayCountLabel(14), "14 дней");
  assert.equal(dayCountLabel(21), "21 день");
});
test("today and yesterday follow Moscow midnight instead of browser timezone", async () => {
  const { moscowToday, dayBefore } = await import("../src/data/calendar.js");
  assert.equal(moscowToday(new Date("2026-10-29T22:00:00Z")), "2026-10-30");
  assert.equal(dayBefore("2026-03-01"), "2026-02-28");
});

const adsReport = JSON.parse(
  strFromU8(
    gunzipSync(
      readFileSync(
        new URL("../public/data/advertising.json.gz", import.meta.url),
      ),
    ),
  ),
);
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);
test("advertising totals reconcile actual Statistics and Union without double-counting models", async () => {
  const { adView, adValue } = await import("../src/data/advertising.js");
  const v = adView(adsReport);
  assert.equal(adsReport.kind, "advertising");
  assert.equal(adsReport.rows.length, 120);
  assert.equal(adsReport.start, "2026-07-01");
  assert.equal(adsReport.end, "2026-09-28");
  near(v.total.spend, 159216.094866);
  assert.equal(v.total.sales, 4141767);
  assert.equal(v.total.units, 496);
  assert.equal(v.total.modelSales, 230436);
  assert.equal(v.total.modelUnits, 28);
  assert.equal(adsReport.union.length, 25);
  assert.equal(
    adsReport.union.reduce((s, r) => s + r.sales, 0),
    230436,
  );
  assert.deepEqual(adsReport.discrepancies, []);
  near(adValue(v.total, "drr"), (159216.094866 / 4141767) * 100);
  assert.equal(adValue({ sales: 0, spend: 100 }, "drr"), null);
});
test("advertising CPC ratios exclude pay-per-order aggregate and zeros use whole SKU attribution", async () => {
  const { adView } = await import("../src/data/advertising.js");
  const v = adView(adsReport);
  near(v.cpc.spend, 129747.644866);
  assert.equal(v.cpc.clicks, 43117);
  assert.equal(v.cpc.impressions, 823917);
  assert.equal(v.products.length, 102);
  assert.equal(v.campaigns.filter((c) => c.id !== "0").length, 18);
  assert.equal(v.zero.length, 35);
  near(v.zeroSpend, 7993.495507);
  assert.ok(
    v.zero.every((p) => p.spend > 0 && p.sales === 0 && p.modelSales === 0),
  );
  const cpa = adView(adsReport, { tool: "cpa" });
  near(cpa.total.spend, 29468.45);
  assert.equal(cpa.total.units, 79);
  assert.equal(cpa.products.length, 0);
});
test("advertising tool, campaign and SKU filters recompute all metrics and group duplicate SKU rows", async () => {
  const { adView } = await import("../src/data/advertising.js");
  const p = adView(adsReport, { query: "5330035142" });
  assert.equal(p.products.length, 1);
  near(p.total.spend, 12814.833779);
  assert.equal(p.total.sales, 666546);
  assert.equal(p.total.modelSales, 48985);
  const c = adView(adsReport, { campaign: "35268477", query: "5330035142" });
  near(c.total.spend, 10631.196743);
  assert.equal(c.total.sales, 564349);
  assert.equal(
    adView(adsReport, { query: "несуществующий товар" }).rows.length,
    0,
  );
});
function advertisingWorkbook({ unionPeriod = "01.07.2026 - 28.09.2026" } = {}) {
  const cell = (c, r, v) =>
    `<c r="${c}${r}" t="inlineStr"><is><t>${v}</t></is></c>`;
  const row = (n, vals) =>
    `<row r="${n}">${Object.entries(vals)
      .map(([c, v]) => cell(c, n, v))
      .join("")}</row>`;
  const stats = `<worksheet><dimension ref="A1:A1"/><sheetData>${row(1, { A: "Период: 01.07.2026 - 28.09.2026" })}${row(2, { A: "SKU", F: "Расход, ₽", H: "Продажи в продвижении, ₽", I: "Продано товаров, шт", M: "Показы", N: "Клики" })}${row(3, { A: "123", B: "Тест рекламного товара", C: "Оплата за клик", E: "7", F: "100", H: "1000", I: "2", J: "200", K: "1", M: "100", N: "10", O: "3" })}</sheetData></worksheet>`;
  const union = `<worksheet><dimension ref="A1:A1"/><sheetData>${row(1, { A: "Период: " + unionPeriod })}${row(2, { A: "SKU в продвижении", F: "SKU из объединенной карточки" })}${row(3, { A: "123", E: "7", F: "456", H: "200", I: "1" })}</sheetData></worksheet>`;
  return zipSync({
    "xl/workbook.xml": strToU8(
      '<workbook><sheets><sheet name="Statistics" r:id="r1"/><sheet name="Union" r:id="r2"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="r1" Target="/xl/worksheets/sheet2.xml"/><Relationship Id="r2" Target="/xl/worksheets/sheet3.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet2.xml": strToU8(stats),
    "xl/worksheets/sheet3.xml": strToU8(union),
  });
}
test("Excel advertising parser ignores broken dimensions and preserves Union as detail", () => {
  const r = parseWorkbook(advertisingWorkbook(), "ads.xlsx");
  assert.equal(r.kind, "advertising");
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].sales, 1000);
  assert.equal(r.rows[0].modelSales, 200);
  assert.equal(r.union[0].sales, 200);
  assert.deepEqual(r.discrepancies, []);
});
test("advertising parser rejects mismatched reporting periods", () => {
  assert.throws(
    () =>
      parseWorkbook(
        advertisingWorkbook({ unionPeriod: "01.08.2026 - 28.09.2026" }),
        "ads.xlsx",
      ),
    /Периоды листов/,
  );
});

test("shared calendar includes sales and advertising source periods", async () => {
  const { calendarBounds } = await import("../src/data/calendar.js");
  assert.deepEqual(calendarBounds(report, adsReport), {
    minDate: "2026-07-01",
    maxDate: "2026-10-29",
  });
  assert.deepEqual(calendarBounds(report, null), {
    minDate: report.minDate,
    maxDate: report.maxDate,
  });
  assert.deepEqual(
    calendarBounds(null, { start: "2026-05-01", end: "2026-06-01" }),
    { minDate: "2026-05-01", maxDate: "2026-06-01" },
  );
});
test("aggregate advertising cannot be sliced, prorated, or presented as zeros for another period", async () => {
  const { adView } = await import("../src/data/advertising.js");
  const exact = adView(adsReport, {
    start: adsReport.start,
    end: adsReport.end,
  });
  assert.ok(exact.period.available);
  assert.ok(Math.abs(exact.total.spend - 159216.094866) < 1e-6);
  for (const range of [
    { start: "2026-07-01", end: "2026-07-01" },
    { start: "2026-07-30", end: "2026-10-29" },
    { start: "2026-06-01", end: "2026-10-31" },
    { start: "2026-10-23", end: "2026-10-29" },
  ]) {
    const view = adView(adsReport, range);
    assert.equal(view.period.available, false);
    assert.equal(view.total, null);
    assert.equal(view.cpc, null);
    assert.deepEqual(view.rows, []);
  }
  assert.equal(
    adView(adsReport, { start: "2026-10-23", end: "2026-10-29" }).period.reason,
    "outside",
  );
});
test("sales days outside source coverage are unknown rather than zero", () => {
  const view = getView(report, {
    ...all,
    start: "2026-07-01",
    end: report.maxDate,
  });
  assert.equal(view.total.amount, 8151692);
  assert.equal(view.days[0].amount, null);
  assert.equal(view.days[0].unavailable, true);
  assert.equal(view.days[0].missing, true);
  assert.equal(view.days.find((d) => d.date === "2026-07-30").amount, 0);
});
