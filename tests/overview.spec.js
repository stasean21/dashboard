import { test, expect } from "@playwright/test";
const nav = (p) => p.getByRole("navigation", { name: "Главная навигация" });
async function ready(page) {
  await page.goto("/");
  await page.locator(".overview-middle").waitFor();
}
async function chooseMockPeriod(page) {
  await page.locator(".date-button").click();
  await page
    .locator('.range-month [data-calendar-date="2026-09-01"]')
    .first()
    .click();
  await page
    .locator('.range-month [data-calendar-date="2026-10-29"]')
    .first()
    .click();
  await page
    .getByRole("button", { name: "Применить период", exact: true })
    .click();
}
test("approved Overview 01 renders real selected-period totals, five leaders, pulse and inventory panels", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await chooseMockPeriod(page);
  await expect(page.locator(".metric").first()).toContainText(/7\s*325\s*999/);
  for (const title of [
    "Динамика продаж",
    "Выкуп и статусы",
    "Требуют проверки",
    "Пульс продаж",
    "Остатки товаров",
    "Пять лидеров",
    "Индекс цен",
  ])
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  await expect(page.locator(".overview-main-grid .gauge>strong")).toHaveText(
    "82,53%",
  );
  await expect(page.locator(".inventory-rings strong")).toHaveText(/31\s*048/);
  await expect(page.locator(".inventory-counts strong")).toHaveText([
    "111",
    "194",
    "8",
  ]);
  await expect(page.locator(".price-index-row>strong")).toHaveText([
    "13",
    "14",
    "16",
    "87",
    "183",
  ]);
  await expect(page.locator(".leaders-card tbody tr")).toHaveCount(5);
  await expect(page.locator(".pulse-peak")).toContainText("74 шт.");
  await expect(page.locator(".trend-card .chart")).toHaveAttribute(
    "data-group",
    "week",
  );
  await expect(page.locator(".trend-card .chart")).toHaveAttribute(
    "data-buckets",
    "9",
  );
  expect(errors).toEqual([]);
});
test("inventory groups and price-index rows open scrollable real SKU lists, preserving product drilldown", async ({
  page,
}) => {
  await ready(page);
  await page.locator(".priority-row").nth(1).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await expect(modal.locator("tbody tr")).toHaveCount(2);
  await expect(modal).toContainText("5567049848");
  await expect(modal).toContainText("5557063985");
  await modal.locator(".product-button").first().click();
  await expect(page.locator(".catalog-product-dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Закрыть карточку товара", exact: true })
    .click();
  await page.locator(".inventory-counts button").last().click();
  await expect(page.getByRole("dialog").locator("tbody tr")).toHaveCount(8);
  await expect(
    page.getByRole("dialog").locator("tbody tr td:nth-child(2)").first(),
  ).toHaveText("Нет данных");
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page
    .locator(".price-index-row")
    .filter({ hasText: "Невыгодный" })
    .click();
  await expect(page.getByRole("dialog").locator("tbody tr")).toHaveCount(12);
  const first = await page
    .getByRole("dialog")
    .locator("tbody tr")
    .first()
    .textContent();
  await page
    .getByRole("dialog")
    .locator(".infinite-list-status")
    .scrollIntoViewIfNeeded();
  await expect(page.getByRole("dialog").locator("tbody tr")).toHaveCount(24);
  await expect(page.getByRole("dialog").locator("tbody tr").first()).toHaveText(
    first,
  );
});
test("pulse month and day selection update the common range and sales; growth priority navigates to its current-period list", async ({
  page,
}) => {
  await ready(page);
  await chooseMockPeriod(page);
  await page
    .getByRole("combobox", { name: "Месяц активности", exact: true })
    .click();
  await page.getByRole("option", { name: /сентябрь 2026/ }).click();
  await expect(page.locator(".pulse-grid button")).toHaveCount(30);
  await page
    .getByRole("combobox", { name: "Месяц активности", exact: true })
    .click();
  await page.getByRole("option", { name: /октябрь 2026/ }).click();
  await page.locator(".pulse-grid button").filter({ hasText: /^7$/ }).click();
  await expect(page.locator(".date-button")).toContainText(/07.10.*07.10.2026/);
  await expect(page.locator(".metric").nth(1)).toContainText("74");
  await page.locator(".date-button").click();
  await page.getByRole("button", { name: "Весь период", exact: true }).click();
  await page
    .getByRole("button", { name: "Применить период", exact: true })
    .click();
  await page.locator(".priority-row").first().click();
  await expect(
    page.getByRole("heading", { name: "Воронка продаж", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".growth-list")).toContainText("9 SKU");
});
test("all Overview panels and inventory dialogs stay within a 390px viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const name of [
    "Заказано товаров",
    "Выкуплено товаров",
    "Средняя цена",
    "Заказано на сумму",
  ]) {
    await page
      .locator(".metrics-grid")
      .getByRole("button", { name, exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.locator(".inventory-counts button").last().click();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
