import { number } from "./report.js";
export const adSumKeys = [
  "spend",
  "sales",
  "units",
  "modelSales",
  "modelUnits",
  "impressions",
  "clicks",
  "cart",
];
export const adMetricLabels = {
  spend: "Расход на продвижение",
  sales: "Продажи в продвижении",
  drr: "ДРР в продвижении",
  units: "Продано товаров",
};
export const adToolLabels = {
  cpc: "Оплата за клик",
  cpa: "Оплата за заказ",
  other: "Другой инструмент",
};
export function adTotals(rows) {
  return Object.fromEntries(
    adSumKeys.map((k) => [k, rows.reduce((s, r) => s + r[k], 0)]),
  );
}
export const adValue = (row, key) =>
  key === "drr"
    ? row.sales > 0
      ? (row.spend / row.sales) * 100
      : null
    : row[key];
export function groupAdProducts(rows) {
  const map = new Map();
  for (const r of rows) {
    if (r.sku === "0" || !r.sku) continue;
    if (!map.has(r.sku)) map.set(r.sku, []);
    map.get(r.sku).push(r);
  }
  return [...map].map(([sku, rr]) => ({
    sku,
    name: rr[0].name,
    detail: rr,
    ...adTotals(rr),
  }));
}
export function groupAdCampaigns(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.campaign + "|" + r.toolKey;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return [...map].map(([key, rr]) => ({
    key,
    id: rr[0].campaign,
    toolKey: rr[0].toolKey,
    name:
      rr[0].campaign === "0"
        ? adToolLabels[rr[0].toolKey] || rr[0].tool
        : "Кампания " + rr[0].campaign,
    ...adTotals(rr),
  }));
}
export function adView(
  report,
  { tool = "all", campaign = "all", query = "" } = {},
) {
  const needle = query.trim().toLocaleLowerCase("ru");
  const rows = report.rows.filter(
    (r) =>
      (tool === "all" || r.toolKey === tool) &&
      (campaign === "all" || r.campaign === campaign) &&
      (!needle ||
        (r.sku !== "0" &&
          `${r.name} ${r.sku}`.toLocaleLowerCase("ru").includes(needle))),
  );
  const products = groupAdProducts(rows),
    cpc = adTotals(rows.filter((r) => r.toolKey === "cpc"));
  const zero = products.filter(
    (p) => p.spend > 0 && p.sales === 0 && p.modelSales === 0,
  );
  return {
    rows,
    total: adTotals(rows),
    cpc,
    products,
    campaigns: groupAdCampaigns(rows),
    zero,
    zeroSpend: zero.reduce((s, p) => s + p.spend, 0),
  };
}
function extractPeriod(text) {
  const m =
    /([0-9]{2})\.([0-9]{2})\.([0-9]{4})\s*[–—-]\s*([0-9]{2})\.([0-9]{2})\.([0-9]{4})/.exec(
      text || "",
    );
  if (!m) return null;
  const start = `${m[3]}-${m[2]}-${m[1]}`,
    end = `${m[6]}-${m[5]}-${m[4]}`;
  for (const d of [start, end]) {
    const stamp = Date.parse(d + "T00:00:00Z");
    if (
      !Number.isFinite(stamp) ||
      new Date(stamp).toISOString().slice(0, 10) !== d
    )
      return null;
  }
  return start <= end ? { start, end } : null;
}
export function parseAdWorkbook(book, fileName, onProgress = () => {}) {
  let period = null,
    header = false;
  const rows = [];
  for (const v of book.rows("Statistics", onProgress)) {
    if (v.A?.startsWith("Период:")) period = extractPeriod(v.A);
    if (v.A === "SKU" && v.F?.includes("Расход")) {
      if (
        !v.H?.includes("Продажи в продвижении") ||
        !v.I?.includes("Продано товаров") ||
        v.M !== "Показы" ||
        v.N !== "Клики"
      )
        throw new Error(
          "Структура рекламного отчёта изменилась: проверьте столбцы продаж, показов и кликов.",
        );
      header = true;
      continue;
    }
    if (!header || !/^\d+$/.test(v.A || "")) continue;
    const tool = v.C || "",
      toolKey = tool.includes("за клик")
        ? "cpc"
        : tool.includes("за заказ")
          ? "cpa"
          : "other";
    rows.push({
      sku: v.A,
      name: v.B || "",
      tool,
      toolKey,
      placement: v.D || "Не указано",
      campaign: v.E || "0",
      spend: number(v.F),
      sales: number(v.H),
      units: number(v.I),
      modelSales: number(v.J),
      modelUnits: number(v.K),
      impressions: number(v.M),
      clicks: number(v.N),
      cart: number(v.O),
    });
  }
  if (!period)
    throw new Error("В рекламном отчёте не найден корректный период.");
  if (!header || !rows.length)
    throw new Error("В листе Statistics не найдены рекламные показатели.");
  const union = [];
  let unionHeader = false,
    unionPeriod = null;
  if (book.has("Union"))
    for (const v of book.rows("Union")) {
      if (v.A?.startsWith("Период:")) unionPeriod = extractPeriod(v.A);
      if (
        v.A === "SKU в продвижении" &&
        v.F === "SKU из объединенной карточки"
      ) {
        unionHeader = true;
        continue;
      }
      if (unionHeader && /^\d+$/.test(v.A || ""))
        union.push({
          sourceSku: v.A,
          sourceName: v.B || "",
          tool: v.C || "",
          placement: v.D || "",
          campaign: v.E || "0",
          sku: v.F || "",
          name: v.G || "",
          sales: number(v.H),
          units: number(v.I),
        });
    }
  if (
    unionPeriod &&
    (unionPeriod.start !== period.start || unionPeriod.end !== period.end)
  )
    throw new Error(
      "Периоды листов Statistics и Union отличаются. Загрузите согласованный отчёт.",
    );
  const totals = adTotals(rows),
    unionSales = union.reduce((s, r) => s + r.sales, 0),
    unionUnits = union.reduce((s, r) => s + r.units, 0);
  const discrepancies = unionHeader
    ? ["sales", "units"]
        .filter(
          (k) =>
            Math.abs(
              (k === "sales" ? totals.modelSales : totals.modelUnits) -
                (k === "sales" ? unionSales : unionUnits),
            ) > 0.01,
        )
        .map((k) => ({
          key: k,
          statistics: k === "sales" ? totals.modelSales : totals.modelUnits,
          union: k === "sales" ? unionSales : unionUnits,
        }))
    : [];
  return {
    kind: "advertising",
    version: 1,
    fileName,
    ...period,
    rows,
    union,
    unionAvailable: unionHeader,
    discrepancies,
  };
}
