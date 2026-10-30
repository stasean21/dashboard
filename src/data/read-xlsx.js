import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
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
const decode = (s) =>
  s.replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (match, code) => {
    const n =
      code[0].toLowerCase() === "x"
        ? parseInt(code.slice(1), 16)
        : Number(code);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
  });
const richText = (v) =>
  decode(
    v?.t != null
      ? text(v.t)
      : array(v?.r)
          .map((r) => text(r.t))
          .join(""),
  );
export function openWorkbook(buffer) {
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
  const sheets = array(
    parser.parse(strFromU8(entries["xl/workbook.xml"])).workbook?.sheets?.sheet,
  );
  const relations = array(
    parser.parse(strFromU8(entries["xl/_rels/workbook.xml.rels"])).Relationships
      ?.Relationship,
  );
  const shared = entries["xl/sharedStrings.xml"]
    ? array(
        parser.parse(strFromU8(entries["xl/sharedStrings.xml"])).sst?.si,
      ).map(richText)
    : [];
  return {
    has: (name) => sheets.some((s) => s["@name"] === name),
    *rows(name, onProgress = () => {}) {
      const sheet = sheets.find((s) => s["@name"] === name);
      if (!sheet) throw new Error(`В книге нет листа «${name}».`);
      const target = relations.find((r) => r["@Id"] === sheet["@r:id"])?.[
        "@Target"
      ];
      const path = target?.startsWith("/") ? target.slice(1) : `xl/${target}`;
      if (!entries[path])
        throw new Error(`Не удалось прочитать лист «${name}».`);
      const xml = strFromU8(entries[path]),
        pattern = /<row\b[^>]*>[\s\S]*?<\/row>/g;
      let match,
        count = 0;
      while ((match = pattern.exec(xml))) {
        const row = parser.parse(match[0]).row,
          values = {};
        for (const c of array(row.c)) {
          const col = c["@r"]?.replace(/\d/g, "");
          if (!col) continue;
          values[col] =
            c["@t"] === "s"
              ? shared[Number(text(c.v))]
              : c["@t"] === "inlineStr"
                ? richText(c.is)
                : text(c.v);
        }
        yield values;
        if (++count % 500 === 0)
          onProgress(Math.round((pattern.lastIndex / xml.length) * 100));
      }
      onProgress(100);
    },
  };
}
