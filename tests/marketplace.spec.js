import { test, expect } from "@playwright/test";

const picker = (page) =>
  page.getByRole("combobox", { name: "Маркетплейс", exact: true });
const main = (page) =>
  page.getByRole("navigation", { name: "Главная навигация" });
async function ready(page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Обзор продаж", exact: true }),
  ).toBeVisible();
}
async function select(page, name) {
  await picker(page).click();
  await page.getByRole("option", { name, exact: true }).click();
}

test("marketplace control is beside the profile and general mode preserves actual Ozon filters", async ({
  page,
}) => {
  await ready(page);
  await expect(picker(page)).toContainText("Ozon");
  const trigger = await picker(page).boundingBox();
  const avatar = await page.locator(".header-actions .avatar").boundingBox();
  expect(trigger.x + trigger.width).toBeLessThan(avatar.x);
  await picker(page).click();
  await expect(page.getByRole("option")).toHaveCount(4);
  for (const name of ["Общий", "Ozon", "Wildberries", "Яндекс Маркет"]) {
    await expect(page.getByRole("option", { name, exact: true })).toBeVisible();
  }
  const menu = await page
    .getByRole("listbox", { name: "Маркетплейс" })
    .boundingBox();
  expect(
    Math.abs(menu.x + menu.width - trigger.x - trigger.width),
  ).toBeLessThan(1);
  await page.keyboard.press("Escape");
  await page.getByLabel("Поиск товаров").fill("5330035142");
  await expect(page.locator(".metric").first()).toContainText(/1\s*557\s*747/);
  await select(page, "Общий");
  await expect(page.locator(".marketplace-coverage")).toContainText(
    "доступен только Ozon",
  );
  await expect(page.locator(".metric").first()).toContainText(/1\s*557\s*747/);
  await main(page)
    .getByRole("button", { name: "Реклама", exact: true })
    .click();
  await expect(page.locator(".ad-period-unavailable")).toContainText(
    "В файле нет разбивки по дням",
  );
  await expect(page.locator(".date-button")).toContainText(
    /03.11.2025.*29.10.2026/,
  );
  await select(page, "Ozon");
  await expect(page.locator(".marketplace-coverage")).toHaveCount(0);
  await main(page).getByRole("button", { name: "Обзор", exact: true }).click();
  await expect(page.getByLabel("Поиск товаров")).toHaveValue("5330035142");
  await expect(page.locator(".metric").first()).toContainText(/1\s*557\s*747/);
});

test("unconnected marketplaces hide Ozon sales and advertising in every section", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  for (const marketplace of ["Wildberries", "Яндекс Маркет"]) {
    await select(page, marketplace);
    for (const section of [
      "Обзор",
      "Товары",
      "Воронка",
      "Качество",
      "Реклама",
    ]) {
      await main(page)
        .getByRole("button", { name: section, exact: true })
        .click();
      if (marketplace === "Wildberries" && section === "Товары") {
        await expect(page.locator(".catalog-page")).toBeVisible();
        await expect(
          page.getByText("WB · 391 SKU", { exact: true }),
        ).toBeVisible();
        await expect(
          page.locator(".metrics-grid,.ad-metrics,.chart"),
        ).toHaveCount(0);
        continue;
      }
      await expect(page.locator(".marketplace-empty")).toContainText(
        `Данные ${marketplace} ещё не загружены`,
      );
      await expect(page.locator(".marketplace-empty")).toContainText(
        `Раздел «${section}»`,
      );
      await expect(
        page.locator(
          ".metrics-grid,.ad-metrics,.chart,table,.page-actions,.filter-bar",
        ),
      ).toHaveCount(0);
    }
    await page
      .getByRole("button", { name: "О данных и расчётах", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      `Отчёты ${marketplace} пока не подключены`,
    );
    await expect(page.getByRole("dialog")).not.toContainText("Statistics");
    await page.keyboard.press("Escape");
  }
  await page.reload();
  await expect(picker(page)).toContainText("Яндекс Маркет");
  await expect(page.locator(".marketplace-empty")).toContainText(
    "Яндекс Маркет",
  );
  await page
    .getByRole("button", { name: "Перейти в Ozon", exact: true })
    .click();
  await expect(page.locator(".metric").first()).toContainText(/8\s*493\s*010/);
  expect(errors).toEqual([]);
});

test("marketplace keyboard, outside dismissal and mobile layout work with every label", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await picker(page).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(picker(page)).toContainText("Яндекс Маркет");
  for (const width of [360, 390, 768, 1512]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const marketplace of [
      "Общий",
      "Ozon",
      "Wildberries",
      "Яндекс Маркет",
    ]) {
      await select(page, marketplace);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await picker(page).click();
      const box = await page
        .getByRole("listbox", { name: "Маркетплейс" })
        .boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await page.locator(".brand").click();
      await expect(picker(page)).toHaveAttribute("aria-expanded", "false");
    }
  }
});

test("blocked browser storage does not prevent switching", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("Storage blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("Storage blocked");
    };
  });
  await ready(page);
  await expect(picker(page)).toContainText("Ozon");
  await select(page, "Wildberries");
  await expect(page.locator(".marketplace-empty")).toContainText("Wildberries");
  await select(page, "Ozon");
  await expect(page.locator(".metric").first()).toContainText(/8\s*493\s*010/);
});
