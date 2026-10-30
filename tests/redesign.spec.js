import { test, expect } from "@playwright/test";
const nav = (page) =>
  page.getByRole("navigation", { name: "Главная навигация" });
async function ready(page) {
  await page.goto("/");
  await page
    .getByRole("heading", { name: "Обзор продаж", exact: true })
    .waitFor();
}
async function grows(page, selector) {
  const rows = page.locator(selector),
    initial = await rows.count();
  const first = await rows.first().textContent();
  await page.locator(".infinite-list-status").last().scrollIntoViewIfNeeded();
  await expect.poll(() => rows.count()).toBeGreaterThan(initial);
  await expect(rows.first()).toHaveText(first);
  const ids = await rows
    .locator('[aria-label^="Скопировать SKU Ozon:"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label")));
  expect(new Set(ids).size).toBe(ids.length);
  await expect(page.locator(".pagination")).toHaveCount(0);
}
test("catalog cards, list mode, source identity, photo frame and reviews share working navigation", async ({
  page,
}) => {
  await ready(page);
  await nav(page).getByRole("button", { name: "Товары", exact: true }).click();
  await page.getByText("WB · 391 SKU", { exact: true }).waitFor();
  await expect(page.locator(".catalog-product-card")).toHaveCount(6);
  const frame = await page.locator(".catalog-portrait").first().boundingBox();
  expect(frame.width / frame.height).toBeCloseTo(0.75, 2);
  await grows(page, ".catalog-product-card");
  await page.getByLabel("Поиск в каталоге", { exact: true }).fill("3063202481");
  await expect(page.locator(".catalog-product-card")).toHaveCount(1);
  await page
    .locator(".catalog-card-foot")
    .getByRole("button", { name: "Открыть", exact: true })
    .click();
  await expect(page.locator(".catalog-product-dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Закрыть карточку товара", exact: true })
    .click();
  await page.getByRole("button", { name: "Список", exact: true }).click();
  await expect(page.locator(".catalog-table tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Перейти к проверкам", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Проверка каталога", exact: true }),
  ).toBeVisible();
});
test("quality infinite scroll resets for search and sorting; dark panel and smooth charts retain values", async ({
  page,
}) => {
  await ready(page);
  await nav(page)
    .getByRole("button", { name: "Качество", exact: true })
    .click();
  await expect(page.locator(".quality-buyout")).toHaveClass(/dark-panel/);
  await expect(page.locator(".quality-buyout .gauge>strong")).toHaveText(
    "82,34%",
  );
  await grows(page, ".quality-list tbody tr");
  await page.getByLabel("Поиск товаров", { exact: true }).fill("5330035142");
  await expect(page.locator(".quality-list tbody tr")).toHaveCount(1);
  await expect(page.locator(".quality-list tbody tr")).toContainText("39");
  await page
    .getByRole("button", { name: "Очистить поиск", exact: true })
    .click();
  await expect(page.locator(".quality-list tbody tr")).toHaveCount(12);
  await page
    .getByRole("columnheader", { name: /Заказано/ })
    .getByRole("button")
    .click();
  await expect(page.locator(".quality-list tbody tr")).toHaveCount(12);
  await expect(page.locator(".quality-list .product-name").first()).toHaveCSS(
    "color",
    "rgb(32, 35, 44)",
  );
});
test("funnel grouping changes buckets while growth list uses current filters and opens product modal", async ({
  page,
}) => {
  await ready(page);
  await nav(page).getByRole("button", { name: "Воронка", exact: true }).click();
  await expect(page.locator(".page-stat-grid .dashboard-stat")).toHaveCount(4);
  const chart = page.locator(".funnel-dynamics .chart");
  await page.getByRole("button", { name: "Дни", exact: true }).click();
  await expect(chart).toHaveAttribute("data-buckets", "361");
  await page.getByRole("button", { name: "Месяцы", exact: true }).click();
  await expect(chart).toHaveAttribute("data-buckets", "12");
  const rows = page.locator(".growth-table tbody tr");
  await expect(rows).toHaveCount(5);
  await grows(page, ".growth-table tbody tr");
  await expect(rows).toHaveCount(9);
  await rows.first().locator(".product-button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Закрыть карточку товара", exact: true })
    .click();
  await page.getByLabel("Поиск товаров", { exact: true }).fill("5330035142");
  await expect(rows).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "В выбранном периоде таких товаров нет",
    }),
  ).toBeVisible();
});
test("advertising articles filter and copy exact catalog identity, ruble return is explicit, scrolling appends", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await ready(page);
  await nav(page).getByRole("button", { name: "Реклама", exact: true }).click();
  await page
    .getByRole("button", { name: "Показать весь рекламный отчёт", exact: true })
    .click();
  await expect(page.locator(".ad-roas")).toContainText("26,01");
  await expect(page.locator(".ad-roas")).toContainText("₽");
  await expect(page.locator(".ad-roas-meaning")).toContainText("1 ₽ расходов");
  await expect(page.locator(".ad-roas")).not.toContainText("×");
  await grows(page, ".advertising-list tbody tr");
  await page
    .getByLabel("Поиск рекламных товаров", { exact: true })
    .fill("99939/88817/77001");
  await expect(page.locator(".advertising-list tbody tr")).toHaveCount(1);
  const copy = page.locator(".advertising-list").getByRole("button", {
    name: "Скопировать артикул продавца: 99939/88817/77001",
    exact: true,
  });
  await copy.click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "99939/88817/77001",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
