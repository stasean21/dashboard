import { test, expect } from "@playwright/test";

test("sales, quality and advertising rows copy exact identifiers independently of product drilldown", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page
    .getByRole("heading", { name: "Обзор продаж", exact: true })
    .waitFor();
  const nav = page.getByRole("navigation", { name: "Главная навигация" });
  async function copySku() {
    const button = page.locator(".dashboard-list").getByRole("button", {
      name: "Скопировать SKU Ozon: 5330035142",
      exact: true,
    });
    await button.click();
    await expect(button.getByRole("status")).toHaveText("Скопировано");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "5330035142",
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await copySku();
  const article = page.getByRole("button", {
    name: "Скопировать артикул продавца: 99939/88817/77001",
    exact: true,
  });
  await article.click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "99939/88817/77001",
  );
  await nav.getByRole("button", { name: "Товары", exact: true }).click();
  await page
    .getByRole("button", { name: "Аналитика Ozon", exact: true })
    .click();
  await copySku();
  await nav.getByRole("button", { name: "Качество", exact: true }).click();
  await copySku();
  await nav.getByRole("button", { name: "Реклама", exact: true }).click();
  await page
    .getByRole("button", { name: "Показать весь рекламный отчёт", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Разделы рекламы" })
    .getByRole("button", { name: "Товары", exact: true })
    .click();
  await page
    .getByLabel("Поиск рекламных товаров", { exact: true })
    .fill("5330035142");
  await copySku();
  expect(await page.locator("button button").count()).toBe(0);
  await page.locator(".dashboard-list .product-button").click();
  await expect(page.getByRole("dialog")).toContainText("Реклама товара");
});
