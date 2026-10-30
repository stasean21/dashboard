import { openWorkbook } from "./read-xlsx.js";
import { finishReport, normalizeRow, reportSchema, normalizeDate } from "./report.js";
import { parseAdWorkbook } from "./advertising.js";
import { parseWildberriesCatalog } from "./wildberries.js";
export function parseWorkbook(buffer, fileName, onProgress = () => {}) {
  const book = openWorkbook(buffer);
  if (book.has("Statistics"))
    return parseAdWorkbook(book, fileName, onProgress);
  if (book.has("Товары") && book.has("Общая информация"))
    return parseWildberriesCatalog(book, fileName);
  if (!book.has("По товарам"))
    throw new Error(
      "В книге нет листа поддерживаемого отчёта. Нужен Ozon «По товарам», Statistics или воронка WB с листами «Товары» и «Общая информация».",
    );
  let seller = "",
    summary = null,
    headers = false,
    columnLabels = {},
    schema;
  const rows = [];
  for (const values of book.rows("По товарам", onProgress)) {
    if (values.A?.startsWith("Продавец:"))
      seller = values.A.replace("Продавец:", "").trim();
    if (values.A === "Товары" && values.H === "SKU" && values.J === "День")
      headers = true;
    if (headers && !values.H && !values.J)
      for (const [column, label] of Object.entries(values))
        if (label && !columnLabels[column]) columnLabels[column] = label;
    if (values.A === "Итого и среднее") summary = values;
    else if (headers && values.H && normalizeDate(values.J)) {
      schema ||= reportSchema(columnLabels);
      const data = normalizeRow(values, schema);
      if (data.date) rows.push(data);
    }
  }
  if (!headers)
    throw new Error(
      "Структура отчёта не поддерживается: ожидаются столбцы «Товары», «SKU», «День».",
    );
  return finishReport(rows, summary, {
    seller,
    fileName,
    schema: schema || reportSchema(columnLabels),
  });
}
