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
  await expect(metric(page, 0)).toHaveText(/8\s*493\s*010/);
  await expect(page.locator(".gauge>strong")).toHaveText("82,34%");
  await page
    .getByRole("button", { name: /Гарри Поттер Большой Замок Хогвартс/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".detail-metrics")).toContainText(/1\s*557\s*747/);
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("button", { name: /03.11.2025.*29.10.2026/ }).click();
  await page.getByRole("button", { name: "7 дней", exact: true }).click();
  await page.getByRole("button", { name: "Применить период" }).click();
  await expect(metric(page, 0)).toHaveText(/799\s*382/);
  await expect(metric(page, 1)).toHaveText(/243/);
  await page.getByRole("button", { name: "Недели", exact: true }).click();
  await page.getByRole("button", { name: "Линия", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Столбцы", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Воронка", exact: true }).click();
  await page.getByRole("combobox", { name: "Этап воронки" }).click();
  await page.getByRole("option", { name: "Корзина", exact: true }).click();
  await expect(page.locator(".funnel-dynamics .chart")).toHaveAttribute(
    "data-metric",
    "cart",
  );
  await page.getByRole("button", { name: "Качество", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Качество заказов", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("search, ABC, sorting, infinite scrolling work", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Товары", exact: true }).click();
  await page
    .getByRole("button", { name: "Аналитика Ozon", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(12);
  await page.locator(".infinite-list-status").scrollIntoViewIfNeeded();
  await expect(page.locator("tbody tr")).toHaveCount(24);
  await expect(page.locator(".pagination")).toHaveCount(0);
  await page.getByLabel("Поиск товаров").fill("5330035142");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(
    page.locator("tbody tr").first().locator("td").last(),
  ).toHaveText(/1\s*557\s*747/);
  await page.getByLabel("Поиск товаров").fill("такого товара точно нет");
  await expect(
    page.getByRole("heading", { name: "За этот период данных нет" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Сбросить фильтры", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Класс ABC", exact: true }).click();
  await page.getByRole("option", { name: "Класс B", exact: true }).click();
  await expect(page.locator("tbody .abc").first()).toHaveText("B");
  await page
    .getByRole("button", { name: "Сумма заказов", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(12);
});
test("Excel upload runs in worker and replaces report; refresh restores original", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-30T09:00:00Z"));
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
  await page.locator("input[type=file]").setInputFiles({
    name: "test.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(file),
  });
  await expect(page.locator(".eyebrow")).toContainText("TEST");
  await expect(metric(page, 0)).toHaveText("200 ₽");
  await expect(page.locator(".gauge>strong")).toHaveText("50%");
  await page.locator(".date-button").click();
  await expect(page.locator(".range-sidebar [aria-pressed=true]")).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "7 дней", exact: true }).click();
  await expect(page.locator(".range-sidebar [aria-pressed=true]")).toHaveCount(
    1,
  );
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(metric(page, 0)).toHaveText(/8\s*493\s*010/);
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
  await page.getByRole("button", { name: /03.11.2025.*29.10.2026/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator('[data-calendar-date="2026-10-29"]').click();
  await page.locator('[data-calendar-date="2026-10-29"]').click();
  await page.getByRole("button", { name: "Применить период" }).click();
  await expect(metric(page, 0)).toHaveText(/163\s*961/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/formula-mobile.png", fullPage: true });
});

test("KPI cards synchronize active state, chart, product table, and dates", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator(".trend-card .chart")).toHaveAttribute(
    "data-group",
    "month",
  );
  await expect(page.locator(".trend-card .chart")).toHaveAttribute(
    "data-buckets",
    "12",
  );
  for (const [name, key, title] of [
    ["Заказано товаров", "orders", "Товары по количеству заказанных"],
    ["Выкуплено товаров", "bought", "Товары по количеству выкупленных"],
    ["Средняя цена", "averagePrice", "Товары по средней цене"],
    ["Заказано на сумму", "amount", "Товары по сумме заказов"],
  ]) {
    await page
      .locator(".metrics-grid")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(
      page.locator(".metrics-grid").getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".metrics-grid [aria-pressed=true]")).toHaveCount(
      1,
    );
    await expect(page.locator(".trend-card .chart")).toHaveAttribute(
      "data-metric",
      key,
    );
    await expect(page.locator(".leaders-card .table-context")).toHaveText(
      title,
    );
    await expect(page.locator("thead th").last()).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  }
  await page
    .getByRole("button", { name: "Выкуплено товаров", exact: true })
    .click();
  await expect(
    page.locator("tbody tr").first().locator("td").last(),
  ).toHaveText("177");
  await page.getByRole("button", { name: /03.11.2025.*29.10.2026/ }).click();
  await page.getByRole("button", { name: "7 дней", exact: true }).click();
  await page.getByRole("button", { name: "Применить период" }).click();
  await expect(page.locator(".trend-card .chart")).toHaveAttribute(
    "data-group",
    "day",
  );
  await expect(page.locator(".trend-card .chart")).toHaveAttribute(
    "data-buckets",
    "7",
  );
  await expect(page.locator(".chart-summary")).toContainText("222");
  await page.getByRole("button", { name: "Средняя цена", exact: true }).click();
  await expect(page.locator(".trend-card .chart")).toHaveAttribute(
    "data-metric",
    "averagePrice",
  );
  await expect(page.locator("thead th").last()).toContainText("Средняя цена");
});

test("quality long-range chart has useful buckets and status-linked tables; daily mode uses lines", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Поиск товаров").fill("5330035142");
  await page.getByRole("button", { name: "Качество", exact: true }).click();
  await expect(page.locator(".page-stat-grid")).toContainText("39");
  await expect(page.locator(".trend-card .chart")).toHaveAttribute(
    "data-buckets",
    "12",
  );
  await expect(
    page
      .locator(".trend-card .recharts-cartesian-axis-tick-value")
      .filter({ hasText: /^\d+$/ }),
  ).not.toHaveCount(0);
  const ticks = await page
    .locator(".trend-card .recharts-cartesian-axis-tick-value")
    .filter({ hasText: /^\d+$/ })
    .allTextContents();
  expect(new Set(ticks).size).toBe(ticks.length);
  await page.getByRole("button", { name: "Дни", exact: true }).click();
  await expect(page.locator(".trend-card .recharts-area")).toHaveCount(2);
  await expect(page.locator(".chart-dense-note")).toBeVisible();
  await page.getByRole("button", { name: "Возвраты", exact: true }).click();
  await expect(page.locator(".trend-card .recharts-area")).toHaveCount(1);
  await expect(page.locator(".trend-card .chart")).toHaveAttribute(
    "data-metric",
    "returned",
  );
  await expect(
    page.getByRole("heading", { name: "Товары не найдены", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Отмены", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(
    page.locator("tbody tr").first().locator("td").last(),
  ).toHaveText("39");
  await expect(page.locator(".metrics-grid")).toHaveCount(0);
  await page.getByRole("button", { name: "Обзор", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Обзор продаж", exact: true }),
  ).toBeVisible();
});

test("chart lines have rounded cubic bends in daily and weekly modes", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Линия", exact: true }).click();
  const curve = page.locator(".trend-card .recharts-area-curve");
  for (const mode of ["Дни", "Недели"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect(curve).toHaveAttribute("d", /C/);
    const path = await curve.getAttribute("d");
    expect(path).not.toMatch(/L/);
    expect(await curve.getAttribute("stroke-linejoin")).toBe("round");
  }
  await page.getByRole("button", { name: "Качество", exact: true }).click();
  await page.getByRole("button", { name: "Дни", exact: true }).click();
  const lines = page.locator(".trend-card .recharts-area-curve");
  await expect(lines).toHaveCount(2);
  for (const line of await lines.all())
    await expect(line).toHaveAttribute("d", /C/);
});

test("approved calendar 03 supports reverse ranges, preview, cancel and report boundaries", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: /03.11.2025.*29.10.2026/ }).click();
  await expect(page.locator(".range-month")).toHaveCount(2);
  await expect(
    page.locator('[data-calendar-date="2026-10-30"]'),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Следующий месяц", exact: true }),
  ).toBeDisabled();
  await page.locator('[data-calendar-date="2026-10-29"]').click();
  await expect(
    page.getByRole("button", { name: "Применить период" }),
  ).toBeDisabled();
  await page.locator('[data-calendar-date="2026-10-23"]').hover();
  await expect(page.locator(".range-day.in-range")).toHaveCount(7);
  await page.locator('[data-calendar-date="2026-10-23"]').click();
  await expect(page.locator(".range-selection")).toContainText("7 дней");
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(metric(page, 0)).toHaveText(/8\s*493\s*010/);
  await page.getByRole("button", { name: /03.11.2025.*29.10.2026/ }).click();
  await page.getByRole("button", { name: "14 дней", exact: true }).click();
  await expect(page.locator(".range-selection")).toContainText("16 октября");
  await expect(page.locator(".range-selection")).toContainText("14 дней");
  await page.getByRole("button", { name: "Применить период" }).click();
  await expect(metric(page, 0)).toHaveText(/1\s*658\s*063/);
  await expect(page.locator(".trend-card .chart")).toHaveAttribute(
    "data-buckets",
    "14",
  );
});
test("styled dropdowns support click, keyboard, Escape and outside dismissal", async ({
  page,
}) => {
  await ready(page);
  const selector = page.getByRole("combobox", { name: "Показатель графика" });
  await selector.click();
  await expect(
    page.getByRole("listbox", { name: "Показатель графика" }),
  ).toBeVisible();
  await page
    .getByRole("option", { name: "Средняя цена, ₽", exact: true })
    .click();
  await expect(
    page
      .locator(".metrics-grid")
      .getByRole("button", { name: "Средняя цена", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".trend-card .chart")).toHaveAttribute(
    "data-metric",
    "averagePrice",
  );
  const abc = page.getByRole("combobox", { name: "Класс ABC", exact: true });
  await abc.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(abc).toContainText("Класс A");
  await abc.click();
  await page.keyboard.press("Escape");
  await expect(abc).toHaveAttribute("aria-expanded", "false");
  await abc.click();
  await page
    .getByRole("heading", { name: "Обзор продаж", exact: true })
    .click();
  await expect(abc).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("select,input[type=date]")).toHaveCount(0);
});
test("calendar day keyboard navigation and mobile dialog stay within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.getByRole("button", { name: /03.11.2025.*29.10.2026/ }).click();
  const day = page.locator('[data-calendar-date="2026-10-22"]');
  await day.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-calendar-date="2026-10-23"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await page.locator('[data-calendar-date="2026-10-29"]').click();
  expect(
    await page
      .locator(".range-dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.getByRole("button", { name: "Применить период" }).click();
  await expect(metric(page, 0)).toHaveText(/799\s*382/);
});

test("main KPI cards appear only in Overview and all section dropdowns use shared styling", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator(".metrics-grid .metric")).toHaveCount(4);
  for (const tab of ["Товары", "Воронка", "Качество"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    if (tab === "Товары")
      await page
        .getByRole("button", { name: "Аналитика Ozon", exact: true })
        .click();
    await expect(page.locator(".metrics-grid")).toHaveCount(0);
    const abc = page.getByRole("combobox", { name: "Класс ABC", exact: true });
    await abc.click();
    await expect(page.locator(".ui-select-menu")).toBeVisible();
    await page
      .getByRole("option", { name: "Все классы ABC", exact: true })
      .click();
    const scheme = page.getByRole("combobox", {
      name: "Схема работы",
      exact: true,
    });
    await scheme.click();
    await expect(
      page.getByRole("option", { name: "FBO + FBS", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("select,input[type=date]")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Товары", exact: true }).click();
  await page
    .getByRole("button", { name: "Аналитика Ozon", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Показатель таблицы" }).click();
  await page
    .getByRole("option", { name: "Выкуплено товаров", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ваши товары", exact: true }),
  ).toBeVisible();
  await expect(page.locator("thead th").last()).toContainText("Выкуплено");
  await expect(
    page.locator("tbody tr").first().locator("td").last(),
  ).toHaveText("177");
  await page.getByRole("button", { name: "Обзор", exact: true }).click();
  await expect(page.locator(".metrics-grid .metric")).toHaveCount(4);
  await expect(
    page
      .locator(".metrics-grid")
      .getByRole("button", { name: "Выкуплено товаров", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("all pages fit a mobile screen with their own content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  for (const name of ["Товары", "Воронка", "Качество", "Обзор"]) {
    await page.getByRole("button", { name, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
