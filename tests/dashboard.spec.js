import { test, expect } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
async function ready(page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Обзор продаж", exact: true }),
  ).toBeVisible();
}
const metric = (page, index) =>
  page.locator(".metric").nth(index).locator(":scope > div");
test("real report loads, product drilldown and date filters recalculate actual totals", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(metric(page, 0)).toHaveText(/8\s*151\s*692/);
  await expect(page.locator(".gauge>strong")).toHaveText("82,19%");
  await page
    .getByRole("button", { name: /Гарри Поттер Большой Замок Хогвартс/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".detail-metrics")).toContainText(/1\s*557\s*747/);
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("button", { name: /30.07.*29.10.2026/ }).click();
  await page.getByRole("button", { name: "7 дней", exact: true }).click();
  await page.getByRole("button", { name: "Применить период" }).click();
  await expect(metric(page, 0)).toHaveText(/799\s*382/);
  await expect(metric(page, 1)).toHaveText(/243/);
  await page.getByRole("button", { name: "Недели", exact: true }).click();
  await page.getByRole("button", { name: "Столбцы", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Линия", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Воронка", exact: true }).click();
  await page.getByLabel("Этап воронки").selectOption("cart");
  await expect(page.locator(".funnel.expanded")).toContainText(
    "Добавления в корзину",
  );
  await page.getByRole("button", { name: "Качество", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Качество заказов", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("search, ABC, sorting, pagination and CSV work", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Товары", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(12);
  await page.getByRole("button", { name: "Следующая страница" }).click();
  await expect(page.locator(".pagination")).toContainText("13–24");
  await page.getByLabel("Поиск товаров").fill("5330035142");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(metric(page, 0)).toHaveText(/1\s*557\s*747/);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт CSV" }).click();
  expect((await download).suggestedFilename()).toContain(
    "formula_2026-07-30_2026-10-29.csv",
  );
  await page.getByLabel("Поиск товаров").fill("такого товара точно нет");
  await expect(
    page.getByRole("heading", { name: "За этот период данных нет" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Сбросить фильтры", exact: true })
    .click();
  await page.getByLabel("Класс ABC", { exact: true }).selectOption("B");
  await expect(page.locator("tbody .abc").first()).toHaveText("B");
  await page
    .getByRole("button", { name: "Сумма заказов", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(12);
});
test("Excel upload runs in worker and replaces report; refresh restores original", async ({
  page,
}) => {
  await ready(page);
  const cell = (c, r, v) =>
    `<c r="${c}${r}" t="inlineStr"><is><t>${v}</t></is></c>`;
  const row = (n, vals) =>
    `<row r="${n}">${Object.entries(vals)
      .map(([c, v]) => cell(c, n, v))
      .join("")}</row>`;
  const sheet = `<worksheet><sheetData>${row(8, { A: "Продавец: TEST" })}${row(10, { A: "Товары", H: "SKU", J: "День" })}${row(11, { M: "Заказано на сумму", AC: "Заказано товаров" })}${row(13, { A: "Итого и среднее", M: "200", AC: "2", AF: "1", AG: "1" })}${row(14, { A: "Тестовый товар", H: "123", J: "2026-10-29", K: "A", M: "200", AC: "2", AF: "1", AG: "1" })}</sheetData></worksheet>`;
  const file = zipSync({
    "xl/workbook.xml": strToU8(
      '<workbook><sheets><sheet name="По товарам" r:id="rId1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  });
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "test.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(file),
    });
  await expect(page.locator(".eyebrow")).toContainText("TEST");
  await expect(metric(page, 0)).toHaveText("200 ₽");
  await expect(page.locator(".gauge>strong")).toHaveText("50%");
  await page.reload();
  await expect(metric(page, 0)).toHaveText(/8\s*151\s*692/);
});
test("mobile viewport has no page overflow and date dialog works", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: /30.07.*29.10.2026/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Начало", { exact: true }).fill("2026-10-29");
  await page.getByRole("button", { name: "Применить период" }).click();
  await expect(metric(page, 0)).toHaveText(/163\s*961/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/formula-mobile.png", fullPage: true });
});
