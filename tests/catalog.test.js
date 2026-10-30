import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync, strFromU8, zipSync, strToU8 } from "fflate";
import {
  buildCatalog,
  emptyCatalogState,
  resolveCatalogCheck,
  reopenCatalogCheck,
  linkCatalogOffers,
  unlinkCatalogRow,
  normalizeArticle,
  costInput,
  costToMinor,
  checksForMarket,
} from "../src/data/catalog.js";
import { parseWorkbook } from "../src/data/import-report.js";
const read = (name) =>
  JSON.parse(
    strFromU8(
      gunzipSync(
        readFileSync(
          new URL(`../public/data/${name}.json.gz`, import.meta.url),
        ),
      ),
    ),
  );
const ozon = read("report"),
  wb = read("catalog-wb");
test("real catalogs reconcile 704 offers, 310 exact pairs and 5 actual checks without confirmed links", () => {
  const c = buildCatalog(ozon, wb);
  assert.deepEqual(c.sourceCounts, { ozon: 313, wb: 391 });
  assert.equal(c.offers.size, 704);
  assert.equal(c.candidates, 310);
  assert.equal(c.checks.filter((i) => i.kind === "duplicate").length, 1);
  assert.equal(c.checks.filter((i) => i.kind === "article").length, 2);
  assert.equal(c.checks.filter((i) => i.kind === "deleted").length, 2);
  assert.equal(c.rows.filter((r) => r.status === "linked").length, 0);
  assert.equal(checksForMarket(c, "ozon").length, 3);
  assert.equal(checksForMarket(c, "all").length, 5);
  assert.equal(new Set(c.rows.flatMap((r) => r.offerIds)).size, 704);
});
test("identity preserves punctuation, leading zeros, variants and account namespace", () => {
  assert.equal(normalizeArticle(" 001/AbC/ "), "001/abc/");
  const c = buildCatalog(
    {
      accountId: "seller-a",
      minDate: "2026-01-01",
      maxDate: "2026-01-01",
      rows: [
        { sku: "123", article: "001/A", name: "Same", date: "2026-01-01" },
      ],
    },
    {
      accountId: "seller-b",
      start: "2026-01-01",
      end: "2026-01-01",
      rows: [{ sku: "123", article: "different", name: "Same" }],
    },
  );
  assert.equal(c.rows.length, 2);
  assert.equal(c.candidates, 0);
  assert.ok(c.offers.has("ozon:seller-a:123"));
  assert.ok(c.offers.has("wb:seller-b:123"));
});
test("duplicate review links active WB only, preserves deleted history and reopens for new source IDs", () => {
  let state = emptyCatalogState(),
    c = buildCatalog(ozon, wb, state);
  const issue = c.checks.find((i) => i.kind === "duplicate");
  const row = c.owner.get(issue.offerIds[0]);
  state.cards[row.id] = { costMinor: 125050, photoSource: "manual" };
  state = resolveCatalogCheck(state, issue, "active", c);
  c = buildCatalog(ozon, wb, state);
  assert.equal(c.checks.filter((i) => !i.resolved).length, 4);
  assert.equal(c.owner.get("wb:default:567591682").id, row.id);
  assert.notEqual(c.owner.get("wb:default:478513135").id, row.id);
  assert.deepEqual(state.cards[row.id], {
    costMinor: 125050,
    photoSource: "manual",
  });
  const changed = {
    ...wb,
    rows: [
      ...wb.rows,
      {
        sku: "9990001",
        article: "31838/X1967",
        name: "New card",
        deleted: false,
      },
    ],
  };
  assert.equal(
    buildCatalog(ozon, changed, state).checks.find(
      (i) => i.kind === "duplicate",
    ).resolved,
    false,
  );
});
test("explicit one-to-many links and separation survive serialization without automatic re-merging", () => {
  let state = emptyCatalogState(),
    c = buildCatalog(ozon, wb, state);
  const issue = c.checks.find(
    (i) => i.kind === "article" && i.article.includes("100019"),
  );
  state = resolveCatalogCheck(state, issue, "together", c);
  c = buildCatalog(ozon, wb, JSON.parse(JSON.stringify(state)));
  assert.equal(new Set(issue.offerIds.map((id) => c.owner.get(id).id)).size, 1);
  assert.equal(c.owner.get(issue.offerIds[0]).status, "linked");
  state = resolveCatalogCheck(state, issue, "separate", c);
  c = buildCatalog(ozon, wb, state);
  assert.equal(new Set(issue.offerIds.map((id) => c.owner.get(id).id)).size, 3);
  state = reopenCatalogCheck(state, issue);
  assert.equal(
    buildCatalog(ozon, wb, state).checks.find((i) => i.id === issue.id)
      .resolved,
    false,
  );
});
test("unlinking preserves own metadata and prevents an automatic candidate from undoing the decision", () => {
  let state = emptyCatalogState(),
    c = buildCatalog(ozon, wb, state);
  let row = c.owner.get("ozon:default:3063202481");
  state.cards[row.id] = { costMinor: 10000, photoSource: "manual" };
  state = linkCatalogOffers(state, row, row.offerIds, c);
  c = buildCatalog(ozon, wb, state);
  row = c.owner.get(row.id);
  state = unlinkCatalogRow(state, row);
  c = buildCatalog(ozon, wb, state);
  assert.equal(c.owner.get(row.offerIds[0]).status, "single");
  assert.notEqual(c.owner.get(row.offerIds[0]), c.owner.get(row.offerIds[1]));
  assert.equal(state.cards[row.id].costMinor, 10000);
});
test("an already linked offer cannot silently move to another product", () => {
  let state = emptyCatalogState(),
    c = buildCatalog(ozon, wb, state);
  const first = c.owner.get("ozon:default:3063202481");
  state = linkCatalogOffers(state, first, first.offerIds, c);
  c = buildCatalog(ozon, wb, state);
  const other = c.rows.find((r) => r.status === "single");
  assert.throws(
    () =>
      linkCatalogOffers(
        state,
        other,
        [...other.offerIds, first.offerIds[0]],
        c,
      ),
    /уже привязана/,
  );
});
test("cost uses exact kopecks, keeps zero distinct from absent and validates precision", () => {
  assert.equal(costToMinor("1 250,50"), 125050);
  assert.equal(costToMinor("0"), 0);
  assert.equal(costToMinor(""), null);
  assert.equal(costInput(0), "0,00");
  assert.equal(costInput(null), "");
  assert.equal(costInput(125050), "1250,50");
  for (const value of [
    "-1",
    "2,001",
    "NaN",
    "Infinity",
    "9e10",
    "999999999999999999999",
  ])
    assert.throws(() => costToMinor(value));
});
function fixture({
  duplicateId = false,
  period = "С 01-09-2026 по 30-10-2026",
} = {}) {
  const cell = (c, n, v) =>
      `<c r="${c}${n}" t="inlineStr"><is><t>${v}</t></is></c>`,
    row = (n, data) =>
      `<row r="${n}">${Object.entries(data)
        .map(([c, v]) => cell(c, n, v))
        .join("")}</row>`;
  const info = `<worksheet><dimension ref="A1:A1"/><sheetData>${row(2, { A: "Значение за текущий период", B: period })}</sheetData></worksheet>`;
  const products = `<worksheet><dimension ref="A1:A1"/><sheetData>${row(2, { A: "Артикул продавца", B: "Артикул WB", C: "Название", F: "Удаленный товар" })}${row(3, { A: "001/A", B: "123", C: "First", F: "Да" })}${row(4, { A: "001/A", B: duplicateId ? "123" : "124", C: "Second", F: "Нет" })}</sheetData></worksheet>`;
  return zipSync({
    "xl/workbook.xml": strToU8(
      '<workbook><sheets><sheet name="Общая информация" r:id="r1"/><sheet name="Товары" r:id="r2"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="r1" Target="worksheets/sheet2.xml"/><Relationship Id="r2" Target="worksheets/sheet3.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet2.xml": strToU8(info),
    "xl/worksheets/sheet3.xml": strToU8(products),
  });
}
test("WB Excel parser ignores broken dimensions, preserves deleted cards and repeated seller articles", () => {
  const parsed = parseWorkbook(fixture(), "wb.xlsx");
  assert.equal(parsed.kind, "catalog");
  assert.equal(parsed.marketplace, "wb");
  assert.equal(parsed.start, "2026-09-01");
  assert.equal(parsed.end, "2026-10-30");
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].deleted, true);
  assert.equal(parsed.rows[1].deleted, false);
  assert.equal(parsed.rows[0].article, "001/A");
  assert.throws(
    () => parseWorkbook(fixture({ duplicateId: true }), "bad.xlsx"),
    /повторяется/,
  );
  assert.throws(
    () =>
      parseWorkbook(
        fixture({ period: "С 31-02-2026 по 30-10-2026" }),
        "bad.xlsx",
      ),
    /корректный период/,
  );
});
