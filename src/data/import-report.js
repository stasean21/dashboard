import { openWorkbook } from "./read-xlsx.js";
import { finishReport, normalizeRow } from "./report.js";
import { parseAdWorkbook } from "./advertising.js";
export function parseWorkbook(buffer, fileName, onProgress = () => {}) {
  const book = openWorkbook(buffer);
  if (book.has("Statistics"))
    return parseAdWorkbook(book, fileName, onProgress);
  if (!book.has("По товарам"))
    throw new Error(
      "В книге нет листа «По товарам» или Statistics. Нужен отчёт Ozon по товарам или аналитика продвижения.",
    );
  let seller = "",
    summary = null,
    headers = false;
  const rows = [];
  for (const values of book.rows("По товарам", onProgress)) {
    if (values.A?.startsWith("Продавец:"))
      seller = values.A.replace("Продавец:", "").trim();
    if (values.A === "Товары" && values.H === "SKU" && values.J === "День")
      headers = true;
    if (values.A === "Итого и среднее") summary = values;
    else if (headers && values.H && values.J) {
      const data = normalizeRow(values);
      if (data.date) rows.push(data);
    }
  }
  if (!headers)
    throw new Error(
      "Структура отчёта не поддерживается: ожидаются столбцы «Товары», «SKU», «День».",
    );
  return finishReport(rows, summary, { seller, fileName });
}
