import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync, strFromU8, zipSync, strToU8 } from "fflate";
import { parseWorkbook } from "../src/data/import-report.js";
import { inventoryView, growthProducts } from "../src/data/overview.js";
import { getView, sumFields } from "../src/data/report.js";
const report = JSON.parse(
  strFromU8(
    gunzipSync(
      readFileSync(new URL("../public/data/report.json.gz", import.meta.url)),
    ),
  ),
);
function fixture(detailed = false, moveOrders = false, omitBought = false) {
  const columns = detailed
    ? {
        M: "amount",
        Q: "impressions",
        T: "searchImpressions",
        X: "visits",
        AB: "cart",
        AD: "orders",
        AE: "delivered",
        AG: "bought",
        AH: "cancelled",
        AI: "returned",
        V: "searchCart",
        Z: "cardCart",
        AP: "stock",
        AL: "priceIndex",
        AQ: "reviews",
        AR: "rating",
      }
    : {
        M: "amount",
        Q: "impressions",
        S: "searchImpressions",
        W: "visits",
        AA: "cart",
        AC: "orders",
        AD: "delivered",
        AF: "bought",
        AG: "cancelled",
        AH: "returned",
        U: "searchCart",
        Y: "cardCart",
        AO: "stock",
        AK: "priceIndex",
        AP: "reviews",
        AQ: "rating",
      };
  if (moveOrders) {
    delete columns.AD;
    columns.AZ = "orders";
  }
  if (omitBought) delete columns.AG;
  const names = {
    amount: "Заказано на сумму\n(по цене реализации)",
    impressions: "Показы всего",
    searchImpressions: "Показы в поиске и\nкаталоге",
    visits: "Посещения карточки товара",
    cart: "Добавления в\nкорзину всего",
    orders: "Заказано товаров",
    delivered: "Доставлено\nтоваров",
    bought: "Выкуплено\nтоваров",
    cancelled: "Отменено товаров (на\nдату заказа)",
    returned: "Возвращено товаров (на дату заказа)",
    searchCart: "Добавления из\nпоиска и каталога\nв корзину",
    cardCart: "Добавления из\nкарточки в\nкорзину",
    stock: "Остаток на конец\nпериода",
    priceIndex: "Индекс цен",
    reviews: "Отзывы",
    rating: "Рейтинг товара",
  };
  const values = {
    amount: "900",
    impressions: "100",
    searchImpressions: "50",
    visits: "20",
    cart: "5",
    orders: "3",
    delivered: "2",
    bought: "2",
    cancelled: "1",
    returned: "0",
    searchCart: "1",
    cardCart: "4",
    stock: "–",
    priceIndex: "Невыгодный",
    reviews: "8",
    rating: "4.9",
  };
  const row = (n, data) =>
    `<row r="${n}">${Object.entries(data)
      .map(([c, v]) => `<c r="${c}${n}" t="inlineStr"><is><t>${v}</t></is></c>`)
      .join("")}</row>`;
  const headers = Object.fromEntries(
    Object.entries(columns).map(([c, key]) => [c, names[key]]),
  );
  const numbers = Object.fromEntries(
    Object.entries(columns).map(([c, key]) => [c, values[key]]),
  );
  if (detailed) {
    headers.R = "Уникальные\nпосетители, всего";
    numbers.R = "9";
  }
  if (moveOrders) {
    headers.AD = "Новый неиспользуемый столбец";
    numbers.AD = "9999";
  }
  return zipSync({
    "xl/workbook.xml": strToU8(
      '<workbook><sheets><sheet name="По товарам" r:id="r1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<worksheet><sheetData>${row(10, { A: "Товары", H: "SKU", J: "День" })}${row(11, headers)}${row(12, { R: "Подробное описание, которое не заменяет заголовок" })}${row(13, { ...numbers, A: "Итого и среднее" })}${row(14, { ...numbers, A: "Тест", H: "0001", I: "ABC/", J: "2026-10-29", K: "A" })}</sheetData></worksheet>`,
    ),
  });
}
test("Excel maps legacy, visitor-expanded and reordered columns by labels before reading any data", () => {
  for (const [expanded, moved] of [
    [false, false],
    [true, false],
    [true, true],
  ]) {
    const r = parseWorkbook(fixture(expanded, moved), "source.xlsx");
    assert.equal(r.rows[0].sku, "0001");
    assert.equal(r.rows[0].article, "ABC/");
    assert.equal(r.summary.orders, 3);
    assert.equal(r.rows[0].bought, 2);
    assert.equal(r.rows[0].cancelled, 1);
    assert.equal(r.rows[0].cart, 5);
    assert.equal(r.rows[0].searchCart, 1);
    assert.equal(r.rows[0].cardCart, 4);
    assert.equal(r.rows[0].rating, 4.9);
    assert.equal(r.rows[0].reviews, 8);
    assert.equal(r.rows[0].stock, null);
    assert.equal(r.rows[0].priceIndex, "Невыгодный");
    assert.equal(r.capabilities.stock, true);
  }
  assert.equal(sumFields.includes("uniqueVisitors"), false);
  assert.throws(
    () => parseWorkbook(fixture(true, false, true), "bad.xlsx"),
    /обязательный столбец/,
  );
});
test("annual report matches approved September–October mockup and source inventory without summing daily stock", () => {
  const filters = { start: "2026-09-01", end: "2026-10-29" };
  const v = getView(report, filters),
    i = inventoryView(report, filters);
  assert.equal(v.total.amount, 7325999);
  assert.equal(v.total.orders, 2335);
  assert.equal(v.total.bought, 1927);
  assert.equal(growthProducts(v.products).length, 9);
  assert.equal(i.units, 31048);
  assert.equal(i.positive.length, 111);
  assert.equal(i.zero.length, 194);
  assert.equal(i.unknown.length, 8);
  assert.equal(i.risks.length, 2);
  assert.deepEqual(
    i.risks.map((p) => p.sku),
    ["5567049848", "5557063985"],
  );
  assert.deepEqual(
    i.prices.map((p) => p.count),
    [13, 14, 16, 87, 183],
  );
  const flagship = i.items.find((p) => p.sku === "5330035142");
  assert.equal(flagship.stockDate, "2026-10-27");
  assert.equal(flagship.stock, 964);
});
test("inventory preserves unknown vs zero, ignores future rows, exposes same-date conflicts and filters exact SKU", () => {
  const row = (sku, date, stock, orders = 0, priceIndex = "Выгодный") => ({
    sku,
    date,
    stock,
    orders,
    priceIndex,
    name: sku,
    article: sku,
    scheme: "FBO",
    abc: "A",
  });
  const r = {
    capabilities: { stock: true },
    rows: [
      row("A", "2026-10-01", 2, 28),
      row("B", "2026-10-01", 0),
      row("C", "2026-10-01", null),
      row("A", "2026-10-02", 100),
      row("A", "2026-10-02", 10),
      row("A", "2026-10-03", null, 0, ""),
    ],
  };
  const early = inventoryView(r, { end: "2026-10-01" });
  assert.equal(early.units, 2);
  assert.equal(early.zero.length, 1);
  assert.equal(early.unknown.length, 1);
  assert.equal(early.risks[0].daysOfStock, 2);
  const later = inventoryView(r, { end: "2026-10-03" });
  assert.equal(later.items.find((i) => i.sku === "A").conflict, true);
  assert.equal(later.items.find((i) => i.sku === "A").stock, null);
  assert.equal(later.units, 0);
  assert.equal(later.unknown.length, 2);
  const filtered = inventoryView(r, { end: "2026-10-01", query: "B" });
  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.items[0].stock, 0);
});
