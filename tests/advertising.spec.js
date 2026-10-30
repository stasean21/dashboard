import { test, expect } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
const main = (page) =>
  page.getByRole("navigation", { name: "Главная навигация" });
const sections = (page) =>
  page.getByRole("navigation", { name: "Разделы рекламы" });
async function ready(page) {
  await page.goto("/");
  await page
    .getByRole("heading", { name: "Обзор продаж", exact: true })
    .waitFor();
  await main(page)
    .getByRole("button", { name: "Реклама", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Показать весь рекламный отчёт", exact: true })
    .click();
  await expect(page.locator(".ad-metrics")).toBeVisible();
}
async function select(page, label, option) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
test("advertising totals and campaign/tool filters use the correct attribution scope", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(page.locator(".metrics-grid")).toHaveCount(0);
  await expect(page.locator(".ad-metric")).toHaveCount(4);
  await expect(page.locator(".ad-metric").nth(0)).toContainText(/159\s*216,09/);
  await expect(page.locator(".ad-metric").nth(1)).toContainText(
    /4\s*141\s*767/,
  );
  await expect(page.locator(".ad-metric").nth(2)).toContainText("3,84%");
  await expect(page.locator(".ad-report-period")).toContainText(
    /01.07.*28.09.2026/,
  );
  await expect(page.locator(".date-button")).toContainText(/01.07.*28.09.2026/);
  await select(page, "Рекламный инструмент", "Оплата за клик");
  await expect(page.locator(".ad-metric").first()).toContainText(
    /129\s*747,64/,
  );
  await select(page, "Рекламная кампания", "Кампания 35268477");
  await expect(page.locator(".ad-metric").first()).toContainText(/10\s*631,2/);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Сбросить", exact: true }).click();
  await select(page, "Рекламный инструмент", "Оплата за заказ");
  await expect(page.locator(".ad-metric").first()).toContainText(/29\s*468,45/);
  await expect(page.locator(".ad-metric").nth(3)).toContainText("79");
  await expect(
    page.getByRole("heading", {
      name: "Нет данных в выбранной группе",
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("SKU detail, model attribution, sorting, attention list and CSV work", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Зоны внимания", exact: true })
    .click();
  await expect(page.locator(".ad-attention-intro")).toContainText("35 SKU");
  await expect(page.locator(".ad-attention-intro")).toContainText(/7\s*993,5/);
  await sections(page)
    .getByRole("button", { name: "Товары", exact: true })
    .click();
  await page.getByLabel("Поиск рекламных товаров").fill("5330035142");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator(".ad-metric").first()).toContainText(/12\s*814,83/);
  await expect(page.locator(".ad-metric").nth(1)).toContainText(/666\s*546/);
  await page
    .getByRole("button", { name: /Гарри Поттер Большой Замок Хогвартс/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(/48\s*985/);
  await expect(page.getByRole("dialog")).toContainText("Реклама товара");
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toBe(
    "formula_ads_2026-07-01_2026-09-28_products.csv",
  );
  await page.getByRole("button", { name: "Очистить рекламный поиск" }).click();
  await page
    .getByRole("button", { name: "ДРР в продвижении", exact: true })
    .click();
  await expect(
    page.getByRole("columnheader", { name: "ДРР", exact: true }),
  ).toHaveAttribute("aria-sort", "descending");
  await sections(page)
    .getByRole("button", { name: "Сводка", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "ДРР по кампаниям", exact: true }),
  ).toBeVisible();
});
function fixture() {
  const cell = (c, r, v) =>
    `<c r="${c}${r}" t="inlineStr"><is><t>${v}</t></is></c>`;
  const row = (n, vals) =>
    `<row r="${n}">${Object.entries(vals)
      .map(([c, v]) => cell(c, n, v))
      .join("")}</row>`;
  const xml = `<worksheet><dimension ref="A1:A1"/><sheetData>${row(1, { A: "Период: 01.08.2026 - 31.08.2026" })}${row(2, { A: "SKU", F: "Расход, ₽", H: "Продажи в продвижении, ₽", I: "Продано товаров, шт", M: "Показы", N: "Клики" })}${row(3, { A: "123", B: "Тест рекламы", C: "Оплата за клик", E: "7", F: "100", H: "1000", I: "2", M: "100", N: "10", O: "3" })}</sheetData></worksheet>`;
  return zipSync({
    "xl/workbook.xml": strToU8(
      '<workbook><sheets><sheet name="Statistics" r:id="r1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="r1" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet2.xml": strToU8(xml),
  });
}
test("advertising Excel imports independently and refresh restores bundled data", async ({
  page,
}) => {
  await ready(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "ads-test.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(fixture()),
  });
  await expect(page.locator(".ad-report-period")).toContainText(
    /01.08.*31.08.2026/,
  );
  await expect(page.locator(".ad-metric").first()).toContainText("100,00 ₽");
  await expect(page.locator(".ad-metric").nth(2)).toContainText("10%");
  await main(page).getByRole("button", { name: "Обзор", exact: true }).click();
  await expect(page.locator(".date-button")).toContainText(/01.08.*31.08.2026/);
  await expect(page.locator(".period-coverage")).toHaveCount(0);
  await expect(page.locator(".metric").first()).toContainText(/825\s*739/);
  await main(page)
    .getByRole("button", { name: "Реклама", exact: true })
    .click();
  await expect(page.locator(".ad-metric").first()).toContainText("100,00 ₽");
  await page.reload();
  await main(page)
    .getByRole("button", { name: "Реклама", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Показать весь рекламный отчёт", exact: true })
    .click();
  await expect(page.locator(".ad-metric").first()).toContainText(
    /159\s*216,09/,
  );
});

test("one calendar drives sales, advertising and export; aggregate totals never appear under other dates", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("heading", { name: "Обзор продаж", exact: true })
    .waitFor();
  const initial = await page.locator(".date-button").innerText();
  await main(page)
    .getByRole("button", { name: "Реклама", exact: true })
    .click();
  await expect(page.locator(".date-button")).toHaveText(initial);
  await expect(page.locator(".ad-period-unavailable")).toContainText(
    "В файле нет разбивки по дням",
  );
  await expect(page.locator(".ad-metric,table")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Показать весь рекламный отчёт", exact: true })
    .click();
  await expect(page.locator(".date-button")).toContainText(/01.07.*28.09.2026/);
  await expect(page.locator(".ad-metric").first()).toContainText(
    /159\s*216,09/,
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toBe(
    "formula_ads_2026-07-01_2026-09-28_overview.csv",
  );
  await main(page).getByRole("button", { name: "Обзор", exact: true }).click();
  await expect(page.locator(".date-button")).toContainText(/01.07.*28.09.2026/);
  await expect(page.locator(".period-coverage")).toHaveCount(0);
  await expect(page.locator(".metric").first()).toContainText(/4\s*305\s*440/);
  await main(page)
    .getByRole("button", { name: "Реклама", exact: true })
    .click();
  await page.locator(".date-button").click();
  await page
    .getByRole("button", { name: "Предыдущий месяц", exact: true })
    .click();
  await page
    .locator('.range-month [data-calendar-date="2026-07-01"]')
    .first()
    .click();
  await page
    .locator('.range-month [data-calendar-date="2026-07-01"]')
    .first()
    .click();
  await page
    .getByRole("button", { name: "Применить период", exact: true })
    .click();
  await expect(page.locator(".date-button")).toContainText(/01.07.*01.07.2026/);
  await expect(page.locator(".ad-metric,table")).toHaveCount(0);
  await expect(page.locator(".ad-period-unavailable")).toContainText(
    "Выбрано: 01.07 — 01.07.2026",
  );
  await main(page).getByRole("button", { name: "Обзор", exact: true }).click();
  await expect(page.locator(".date-button")).toContainText(/01.07.*01.07.2026/);
  await expect(page.locator(".metric").first()).toContainText("0 ₽");
  await expect(page.locator(".period-coverage")).toHaveCount(0);
  await expect(page.locator(".trend-card .chart")).toHaveAttribute(
    "data-buckets",
    "1",
  );
  await main(page)
    .getByRole("button", { name: "Реклама", exact: true })
    .click();
  await page.locator(".date-button").click();
  await page.getByRole("button", { name: "7 дней", exact: true }).click();
  await page
    .getByRole("button", { name: "Применить период", exact: true })
    .click();
  await expect(page.locator(".ad-period-unavailable")).toContainText(
    "За выбранный период нет рекламных данных",
  );
  await main(page).getByRole("button", { name: "Товары", exact: true }).click();
  await expect(page.locator(".date-button")).toContainText(/23.10.*29.10.2026/);
});
test("advertising mobile layout, custom menus and explanatory dialog work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  for (const label of ["Сводка", "Кампании", "Товары", "Зоны внимания"]) {
    await sections(page)
      .getByRole("button", { name: label, exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "О данных и расчётах", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("О рекламных данных");
  await expect(page.getByRole("dialog")).toContainText("Union");
  await page.keyboard.press("Escape");
  await select(page, "Рекламный инструмент", "Оплата за клик");
  await expect(page.locator("select,input[type=date]")).toHaveCount(0);
});
