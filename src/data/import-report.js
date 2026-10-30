import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { finishReport, normalizeRow } from "./report.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: true,
});
const array = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const text = (v) =>
  typeof v === "object" && v !== null
    ? String(v["#text"] ?? "")
    : String(v ?? "");
const decodeEntities = (s) =>
  s.replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (match, code) => {
    const n =
      code[0].toLowerCase() === "x"
        ? parseInt(code.slice(1), 16)
        : Number(code);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
  });
const richText = (v) =>
  decodeEntities(
    v?.t != null
      ? text(v.t)
      : array(v?.r)
          .map((r) => text(r.t))
          .join(""),
  );
export function parseWorkbook(buffer, fileName, onProgress = () => {}) {
  if (buffer.byteLength > 30 * 1024 * 1024)
    throw new Error("Файл больше 30 МБ. Сократите период выгрузки.");
  const entries = unzipSync(new Uint8Array(buffer), {
    filter: (entry) => {
      if (entry.originalSize > 150 * 1024 * 1024)
        throw new Error(
          "Лист Excel слишком большой. Сократите период выгрузки.",
        );
      return /^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet[^/]*\.xml))$/.test(
        entry.name,
      );
    },
  });
  if (!entries["xl/workbook.xml"])
    throw new Error("Нужен файл Excel в формате .xlsx.");
  const workbook = parser.parse(strFromU8(entries["xl/workbook.xml"]));
  const sheets = array(workbook.workbook?.sheets?.sheet);
  const sheet = sheets.find((s) => s["@name"] === "По товарам");
  if (!sheet)
    throw new Error(
      "В книге нет листа «По товарам». Загрузите ежедневную аналитику Ozon по товарам.",
    );
  const rels = array(
    parser.parse(strFromU8(entries["xl/_rels/workbook.xml.rels"])).Relationships
      ?.Relationship,
  );
  const target = rels.find((r) => r["@Id"] === sheet["@r:id"])?.["@Target"];
  const path = target?.startsWith("/") ? target.slice(1) : `xl/${target}`;
  if (!entries[path])
    throw new Error("Не удалось прочитать лист «По товарам».");
  const shared = entries["xl/sharedStrings.xml"]
    ? array(
        parser.parse(strFromU8(entries["xl/sharedStrings.xml"])).sst?.si,
      ).map(richText)
    : [];
  const xml = strFromU8(entries[path]);
  const rowPattern = /<row\b[^>]*>[\s\S]*?<\/row>/g;
  let match,
    seller = "",
    summary = null,
    headers = false,
    count = 0;
  const rows = [];
  while ((match = rowPattern.exec(xml))) {
    const row = parser.parse(match[0]).row;
    const values = {};
    for (const c of array(row.c)) {
      const col = c["@r"]?.replace(/\d/g, "");
      if (!col) continue;
      const type = c["@t"];
      values[col] =
        type === "s"
          ? shared[Number(text(c.v))]
          : type === "inlineStr"
            ? richText(c.is)
            : text(c.v);
    }
    if (values.A?.startsWith("Продавец:"))
      seller = values.A.replace("Продавец:", "").trim();
    if (values.A === "Товары" && values.H === "SKU" && values.J === "День")
      headers = true;
    if (values.A === "Итого и среднее") summary = values;
    else if (headers && values.H && values.J) {
      const data = normalizeRow(values);
      if (data.date) rows.push(data);
    }
    if (++count % 500 === 0)
      onProgress(Math.round((rowPattern.lastIndex / xml.length) * 100));
  }
  if (!headers)
    throw new Error(
      "Структура отчёта не поддерживается: ожидаются столбцы «Товары», «SKU», «День».",
    );
  return finishReport(rows, summary, { seller, fileName });
}
