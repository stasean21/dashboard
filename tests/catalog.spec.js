import { test, expect } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
const nav = (page) =>
  page.getByRole("navigation", { name: "Главная навигация" });
const sections = (page) =>
  page.getByRole("navigation", { name: "Разделы товаров" });
async function ready(page) {
  await page.goto("/");
  await page
    .getByRole("heading", { name: "Обзор продаж", exact: true })
    .waitFor();
  await nav(page).getByRole("button", { name: "Товары", exact: true }).click();
  await expect(page.getByText("WB · 391 SKU", { exact: true })).toBeVisible();
}
async function market(page, name) {
  await page
    .getByRole("combobox", { name: "Маркетплейс", exact: true })
    .click();
  await page.getByRole("option", { name, exact: true }).click();
}
async function bmw(page) {
  await page.getByLabel("Поиск в каталоге", { exact: true }).fill("3063202481");
  await page.locator(".catalog-row-product").click();
  await expect(page.locator(".catalog-product-dialog")).toBeVisible();
}
const alertButton = (page) =>
  page.getByRole("button", { name: /^Проверка каталога:/ });
function wbFixture() {
  const cell = (c, n, v) =>
      `<c r="${c}${n}" t="inlineStr"><is><t>${v}</t></is></c>`,
    row = (n, d) =>
      `<row r="${n}">${Object.entries(d)
        .map(([c, v]) => cell(c, n, v))
        .join("")}</row>`;
  return zipSync({
    "xl/workbook.xml": strToU8(
      '<workbook><sheets><sheet name="Общая информация" r:id="r1"/><sheet name="Товары" r:id="r2"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="r1" Target="worksheets/sheet2.xml"/><Relationship Id="r2" Target="worksheets/sheet3.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet2.xml": strToU8(
      `<worksheet><dimension ref="A1:A1"/><sheetData>${row(2, { A: "Значение за текущий период", B: "С 01-09-2026 по 30-10-2026" })}</sheetData></worksheet>`,
    ),
    "xl/worksheets/sheet3.xml": strToU8(
      `<worksheet><dimension ref="A1:A1"/><sheetData>${row(2, { A: "Артикул продавца", B: "Артикул WB", C: "Название", F: "Удаленный товар" })}${row(3, { A: "FK1988/8800/78002", B: "298628396", C: "Обновлённое название BMW", F: "Нет" })}</sheetData></worksheet>`,
    ),
  });
}
test("catalog checks use actual source cases, persist decisions and keep history with undo", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await market(page, "Общий");
  await expect(alertButton(page)).toHaveAccessibleName(
    "Проверка каталога: 5 пунктов",
  );
  await nav(page).getByRole("button", { name: "Обзор", exact: true }).click();
  await expect(page.locator(".catalog-summary")).toContainText("5 пунктов");
  await alertButton(page).click();
  await expect(page.locator(".catalog-alert-list>button")).toHaveCount(5);
  await page
    .locator(".catalog-alert-list>button")
    .filter({ hasText: "Повтор артикула у нескольких карточек" })
    .click();
  await expect(
    page.locator(".catalog-check-dialog .catalog-source-card"),
  ).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Сохранить решение", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("radio", { name: /Связать с действующей карточкой WB/ })
    .check();
  await page
    .getByRole("button", { name: "Сохранить решение", exact: true })
    .click();
  await expect(alertButton(page)).toHaveAccessibleName(
    "Проверка каталога: 4 пункта",
  );
  await expect(page.locator(".catalog-summary")).toContainText("4 пункта");
  await page.reload();
  await nav(page).getByRole("button", { name: "Товары", exact: true }).click();
  await expect(page.getByText("WB · 391 SKU", { exact: true })).toBeVisible();
  await expect(alertButton(page)).toHaveAccessibleName(
    "Проверка каталога: 4 пункта",
  );
  await sections(page)
    .getByRole("button", { name: /Требует внимания/ })
    .click();
  await page.getByRole("button", { name: /^Проверенные/ }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Проверено", exact: true }).click();
  await page
    .getByRole("button", { name: "Вернуть в проверку", exact: true })
    .click();
  await expect(alertButton(page)).toHaveAccessibleName(
    "Проверка каталога: 5 пунктов",
  );
  expect(errors).toEqual([]);
});
test("modal cost, clipboard and manual photo survive reload and WB re-import in a 3:4 frame", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await ready(page);
  await bmw(page);
  await expect(
    page.getByLabel("Себестоимость товара", { exact: true }),
  ).toHaveValue("");
  const box = await page.locator(".product-photo-large").boundingBox();
  expect(box.width / box.height).toBeCloseTo(3 / 4, 2);
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "Скопировать SKU Ozon: 3063202481",
      exact: true,
    })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "3063202481",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Скопировано" }),
  ).toBeVisible();
  await page.getByLabel("Себестоимость товара", { exact: true }).fill("-1");
  await page
    .getByRole("button", { name: "Сохранить карточку", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("сумму от 0");
  await page
    .getByLabel("Себестоимость товара", { exact: true })
    .fill("1250,50");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 30;
    canvas.height = 40;
    const c = canvas.getContext("2d");
    c.fillStyle = "#ff883d";
    c.fillRect(0, 0, 30, 40);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Фотография товара", { exact: true }).setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(page.locator(".product-photo-large img")).toBeVisible();
  await page
    .getByRole("button", { name: "Сохранить карточку", exact: true })
    .click();
  await expect(page.locator(".catalog-product-dialog")).toHaveCount(0);
  await expect(
    page.locator(".catalog-product-grid .product-photo img"),
  ).toHaveCount(1);
  await page.reload();
  await nav(page).getByRole("button", { name: "Товары", exact: true }).click();
  await expect(page.getByText("WB · 391 SKU", { exact: true })).toBeVisible();
  await bmw(page);
  await expect(
    page.getByLabel("Себестоимость товара", { exact: true }),
  ).toHaveValue("1250,50");
  await expect(page.locator(".product-photo-large img")).toBeVisible();
  await page
    .getByRole("button", { name: "Подтвердить связь", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Карточки связаны с нашим товаром.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Закрыть карточку товара", exact: true })
    .click();
  await market(page, "Wildberries");
  await bmw(page);
  await expect(
    page.getByLabel("Себестоимость товара", { exact: true }),
  ).toHaveValue("1250,50");
  await expect(page.locator(".product-photo-large img")).toBeVisible();
  await page
    .getByRole("button", { name: "Закрыть карточку товара", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "wb.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(wbFixture()),
  });
  await expect(page.getByText("WB · 1 SKU", { exact: true })).toBeVisible();
  await bmw(page);
  await expect(
    page.getByLabel("Себестоимость товара", { exact: true }),
  ).toHaveValue("1250,50");
  await expect(page.locator(".product-photo-large img")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Вручную", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Закрыть карточку товара", exact: true })
    .click();
  await nav(page).getByRole("button", { name: "Обзор", exact: true }).click();
  await expect(page.locator(".marketplace-empty")).toBeVisible();
  await market(page, "Ozon");
  await expect(page.locator(".metric").first()).toContainText(/8\s*151\s*692/);
});
test("catalog row identifiers copy exact values without opening product cards", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await ready(page);
  await market(page, "Общий");
  const search = page.getByLabel("Поиск в каталоге", { exact: true });
  await search.fill("100019/6998");
  for (const [label, value] of [
    ["артикул продавца", "100019/6998/"],
    ["SKU Ozon", "5766192752"],
    ["артикул WB", "587575764"],
  ]) {
    const button = page.getByRole("button", {
      name: `Скопировать ${label}: ${value}`,
      exact: true,
    });
    await button.click();
    await expect(button.getByRole("status")).toHaveText("Скопировано");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      value,
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await search.fill("368909043");
  for (const [label, value] of [
    ["артикул продавца", "0001"],
    ["артикул WB", "368909043"],
  ]) {
    await page
      .getByRole("button", {
        name: `Скопировать ${label}: ${value}`,
        exact: true,
      })
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      value,
    );
  }
  expect(await page.locator("button button").count()).toBe(0);
  await page.locator(".catalog-row-product").click();
  await expect(page.locator(".catalog-product-dialog")).toBeVisible();
});
test("photos, large identifiers and check popover fit phone and tablet; backdrop closes only outside", async ({
  page,
}) => {
  await ready(page);
  await market(page, "Общий");
  for (const width of [360, 390, 768, 1512]) {
    await page.setViewportSize({ width, height: 1000 });
    await sections(page)
      .getByRole("button", { name: "Каталог", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await alertButton(page).click();
    const menu = await page.locator(".catalog-alert-popover").boundingBox();
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(width);
    await page.keyboard.press("Escape");
    await bmw(page);
    const dialog = page.locator(".catalog-product-dialog");
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    const photo = await page.locator(".product-photo-large").boundingBox();
    expect(photo.width / photo.height).toBeCloseTo(3 / 4, 2);
    expect(
      parseFloat(
        await page
          .getByRole("dialog")
          .getByRole("button", {
            name: "Скопировать SKU Ozon: 3063202481",
            exact: true,
          })
          .locator(".copy-value")
          .evaluate((el) => getComputedStyle(el).fontSize),
      ),
    ).toBeGreaterThanOrEqual(18);
    await page.mouse.click(1, 1);
    await expect(dialog).toHaveCount(0);
    await page.getByLabel("Поиск в каталоге", { exact: true }).fill("");
  }
});
test("blocked local storage keeps catalog usable and reports temporary persistence", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await ready(page);
  await bmw(page);
  await page.getByLabel("Себестоимость товара", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Сохранить карточку", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Хранилище недоступно");
  await bmw(page);
  await expect(
    page.getByLabel("Себестоимость товара", { exact: true }),
  ).toHaveValue("0,00");
});
