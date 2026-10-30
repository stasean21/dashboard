const periodFrom = (value) => {
  const m = /С\s+(\d{2})-(\d{2})-(\d{4})\s+по\s+(\d{2})-(\d{2})-(\d{4})/i.exec(
    value || "",
  );
  if (!m) return null;
  const start = `${m[3]}-${m[2]}-${m[1]}`,
    end = `${m[6]}-${m[5]}-${m[4]}`;
  const valid = (d) =>
    Number.isFinite(Date.parse(d)) &&
    new Date(d).toISOString().slice(0, 10) === d;
  return valid(start) && valid(end) && start <= end ? { start, end } : null;
};

export function parseWildberriesCatalog(book, fileName) {
  let period, headers;
  for (const row of book.rows("Общая информация"))
    if (row.A === "Значение за текущий период") period = periodFrom(row.B);
  if (!period)
    throw new Error(
      "В отчёте WB не найден корректный период на листе «Общая информация».",
    );
  const rows = [],
    seen = new Set();
  for (const values of book.rows("Товары")) {
    if (Object.values(values).includes("Артикул WB")) {
      headers = Object.fromEntries(
        Object.entries(values).map(([column, name]) => [name, column]),
      );
      for (const key of ["Артикул WB", "Артикул продавца", "Название"])
        if (!headers[key])
          throw new Error(`В каталоге WB отсутствует столбец «${key}».`);
      continue;
    }
    if (!headers) continue;
    const get = (name) => values[headers[name]],
      sku = String(get("Артикул WB") || "").trim();
    if (!sku) continue;
    if (!/^\d+$/.test(sku))
      throw new Error("Некорректный артикул WB в строке товара.");
    if (seen.has(sku))
      throw new Error(
        `Артикул WB ${sku} повторяется в файле. Нужна одна строка на карточку.`,
      );
    seen.add(sku);
    const article = String(get("Артикул продавца") || "").trim(),
      name = String(get("Название") || "").trim();
    if (!article || !name)
      throw new Error(`У WB ${sku} отсутствует название или артикул продавца.`);
    rows.push({
      sku,
      article,
      name,
      deleted:
        String(get("Удаленный товар") || "").toLocaleLowerCase("ru") === "да",
      rating: Number(get("Рейтинг по отзывам")) || null,
    });
  }
  if (!rows.length)
    throw new Error("В листе «Товары» не найдены карточки Wildberries.");
  return {
    kind: "catalog",
    marketplace: "wb",
    accountId: "default",
    version: 1,
    fileName,
    ...period,
    rows,
    discrepancies: [],
  };
}
