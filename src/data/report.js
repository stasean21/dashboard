export const numericColumns = {
  M: "amount",
  Q: "impressions",
  S: "searchImpressions",
  W: "visits",
  AA: "cart",
  AC: "orders",
  AD: "delivered",
  AF: "bought",
  AG: "cancelled",
  AH: "returned",
};
export const sumFields = Object.values(numericColumns);
export const number = (value) => {
  if (value == null || /^[–—-]$/.test(String(value).trim())) return 0;
  const n = Number(
    String(value)
      .replace(/[\s\u00a0]/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : 0;
};
export function normalizeDate(value) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value || "")) return value.slice(0, 10);
  const ru = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value || "");
  if (ru) return `${ru[3]}-${ru[2]}-${ru[1]}`;
  if (/^\d{5}(\.\d+)?$/.test(value || ""))
    return new Date(
      Date.UTC(1899, 11, 30) + Math.floor(Number(value)) * 86400000,
    )
      .toISOString()
      .slice(0, 10);
  return "";
}
export function normalizeRow(d) {
  const row = {
    name: d.A || "",
    category: d.C || "",
    brand: d.E || "",
    scheme: d.G || "",
    sku: d.H || "",
    article: d.I || "",
    date: normalizeDate(d.J),
    abc: /^[ABC]$/.test(d.K) ? d.K : "—",
    rating: number(d.AQ),
    reviews: number(d.AP),
  };
  for (const [column, key] of Object.entries(numericColumns))
    row[key] = number(d[column]);
  return row;
}
export function finishReport(rows, summary, meta = {}) {
  if (!rows.length)
    throw new Error(
      "Не найдены строки с SKU и датой. Нужен ежедневный отчёт Ozon «По товарам».",
    );
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const sums = Object.fromEntries(
    sumFields.map((k) => [k, rows.reduce((s, r) => s + r[k], 0)]),
  );
  const totals = summary
    ? Object.fromEntries(
        Object.entries(numericColumns).map(([col, key]) => [
          key,
          number(summary[col]),
        ]),
      )
    : sums;
  const discrepancies = sumFields
    .filter((k) => Math.abs(totals[k] - sums[k]) > 0.01)
    .map((k) => ({
      key: k,
      summary: totals[k],
      detail: sums[k],
      difference: sums[k] - totals[k],
    }));
  return {
    version: 1,
    rows,
    summary: totals,
    discrepancies,
    seller: meta.seller || "Мой магазин",
    fileName: meta.fileName || "",
    minDate: rows[0].date,
    maxDate: rows.at(-1).date,
    rating: summary ? number(summary.AQ) : null,
    reviews: summary ? number(summary.AP) : null,
    summaryAvailable: !!summary,
  };
}
export function getView(report, filters) {
  const { start, end, query = "", abc = "all", scheme = "all" } = filters;
  const needle = query.trim().toLocaleLowerCase("ru");
  const rows = report.rows.filter(
    (r) =>
      r.date >= start &&
      r.date <= end &&
      (abc === "all" || r.abc === abc) &&
      (scheme === "all" || r.scheme.includes(scheme)) &&
      (!needle ||
        `${r.name} ${r.sku} ${r.article}`
          .toLocaleLowerCase("ru")
          .includes(needle)),
  );
  const total = Object.fromEntries(sumFields.map((k) => [k, 0]));
  const dailyMap = new Map();
  const productMap = new Map();
  for (const r of rows) {
    if (!dailyMap.has(r.date))
      dailyMap.set(r.date, {
        date: r.date,
        ...Object.fromEntries(sumFields.map((k) => [k, 0])),
      });
    const day = dailyMap.get(r.date);
    if (!productMap.has(r.sku))
      productMap.set(r.sku, {
        ...r,
        ...Object.fromEntries(sumFields.map((k) => [k, 0])),
        latest: "",
      });
    const p = productMap.get(r.sku);
    for (const k of sumFields) {
      total[k] += r[k];
      day[k] += r[k];
      p[k] += r[k];
    }
    if (r.date >= p.latest)
      Object.assign(p, {
        latest: r.date,
        abc: r.abc,
        rating: r.rating,
        reviews: r.reviews,
        scheme: r.scheme,
      });
  }
  const useSummary =
    report.summaryAvailable &&
    start <= report.minDate &&
    end >= report.maxDate &&
    !needle &&
    abc === "all" &&
    scheme === "all";
  if (useSummary) Object.assign(total, report.summary);
  const days = [];
  for (
    let t = Date.parse(start + "T00:00:00Z");
    t <= Date.parse(end + "T00:00:00Z");
    t += 86400000
  ) {
    const date = new Date(t).toISOString().slice(0, 10);
    const unavailable = date < report.minDate || date > report.maxDate;
    days.push(
      dailyMap.get(date) || {
        date,
        ...Object.fromEntries(
          sumFields.map((k) => [k, unavailable ? null : 0]),
        ),
        missing: true,
        unavailable,
      },
    );
  }
  const products = [...productMap.values()].sort(
    (a, b) => b.amount - a.amount || a.sku.localeCompare(b.sku),
  );
  return { rows, total, days, products, useSummary, empty: rows.length === 0 };
}
export const ratio = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);
export function groupDays(days, group) {
  if (group === "day") return days;
  const buckets = new Map();
  for (const day of days) {
    let date = day.date;
    if (group === "month") date = date.slice(0, 7) + "-01";
    else {
      const t = new Date(date + "T00:00:00Z");
      t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
      date = t.toISOString().slice(0, 10);
    }
    if (!buckets.has(date))
      buckets.set(date, {
        date,
        ...Object.fromEntries(sumFields.map((k) => [k, 0])),
      });
    for (const key of sumFields) buckets.get(date)[key] += day[key];
  }
  return [...buckets.values()];
}
export function rangePreset(report, preset) {
  const end = report.maxDate;
  if (preset === "all") return { start: report.minDate, end };
  const d = new Date(end + "T00:00:00Z");
  if (preset === "month") d.setUTCDate(1);
  else d.setUTCDate(d.getUTCDate() - Number(preset) + 1);
  return {
    start: [d.toISOString().slice(0, 10), report.minDate].sort().at(-1),
    end,
  };
}
export function previousRange(start, end) {
  const span = Date.parse(end) - Date.parse(start) + 86400000;
  return {
    start: new Date(Date.parse(start) - span).toISOString().slice(0, 10),
    end: new Date(Date.parse(start) - 86400000).toISOString().slice(0, 10),
  };
}
export const fmt = (n, digits = 0) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(
    n || 0,
  );
export const money = (n) => `${fmt(n)} ₽`;
export const percent = (n) => `${fmt(n, 2)}%`;
export const dateLabel = (d, options = { day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("ru-RU", { ...options, timeZone: "UTC" }).format(
    new Date(d + "T00:00:00Z"),
  );
export const shortName = (s) =>
  s
    .replace(/^Конструктор\s*/i, "")
    .split(/,|\(/)[0]
    .trim();
