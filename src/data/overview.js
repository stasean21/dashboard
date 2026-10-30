import { ratio } from "./report.js";

export const priceGroups = [
  "Супер-выгодный",
  "Выгодный",
  "Умеренный",
  "Невыгодный",
  "Без индекса",
];
export const priceGroup = (value) =>
  priceGroups.includes(value) ? value : "Без индекса";
export function inventoryView(report, filters) {
  const needle = (filters.query || "").trim().toLocaleLowerCase("ru");
  const history = report.rows.filter((r) => r.date <= filters.end);
  const scope = new Set(
    history
      .filter(
        (r) =>
          (!needle ||
            `${r.name} ${r.sku} ${r.article}`
              .toLocaleLowerCase("ru")
              .includes(needle)) &&
          (!filters.abc || filters.abc === "all" || r.abc === filters.abc) &&
          (!filters.scheme ||
            filters.scheme === "all" ||
            r.scheme.includes(filters.scheme)),
      )
      .map((r) => r.sku),
  );
  const latest = new Map();
  for (const r of history) {
    if (!scope.has(r.sku)) continue;
    if (!latest.has(r.sku))
      latest.set(r.sku, {
        sku: r.sku,
        stock: null,
        stockDate: null,
        stockValues: new Set(),
      });
    const item = latest.get(r.sku);
    Object.assign(item, {
      name: r.name,
      article: r.article,
      date: r.date,
      priceIndex: r.priceIndex || "",
    });
    if (Number.isFinite(r.stock) && r.stock >= 0) {
      if (item.stockDate !== r.date) item.stockValues = new Set();
      item.stockValues.add(r.stock);
      item.stockDate = r.date;
      item.stock = item.stockValues.size === 1 ? r.stock : null;
    }
  }
  const demand = new Map();
  for (const r of history) {
    const item = latest.get(r.sku);
    if (!item?.stockDate) continue;
    const days = (Date.parse(item.stockDate) - Date.parse(r.date)) / 86400000;
    if (days >= 0 && days < 28)
      demand.set(r.sku, (demand.get(r.sku) || 0) + r.orders);
  }
  const items = [...latest.values()].map(({ stockValues, ...item }) => ({
    ...item,
    conflict: stockValues.size > 1,
    daysOfStock:
      item.stock > 0 && demand.get(item.sku) > 0
        ? (item.stock * 28) / demand.get(item.sku)
        : null,
  }));
  const positive = items.filter((i) => i.stock > 0),
    zero = items.filter((i) => i.stock === 0),
    unknown = items.filter((i) => i.stock == null);
  const risks = positive
    .filter((i) => i.daysOfStock != null && i.daysOfStock < 14)
    .sort((a, b) => a.daysOfStock - b.daysOfStock);
  const prices = priceGroups.map((label) => ({
    label,
    count: items.filter((i) => priceGroup(i.priceIndex) === label).length,
  }));
  return {
    items,
    positive,
    zero,
    unknown,
    risks,
    prices,
    units: positive.reduce((s, i) => s + i.stock, 0),
    asOf: filters.end,
    dates: [...new Set(items.map((i) => i.stockDate).filter(Boolean))].sort(),
    available:
      report.capabilities?.stock ||
      history.some((r) => Number.isFinite(r.stock)),
  };
}

export function growthProducts(products) {
  return products
    .filter((p) => p.visits >= 100 && p.orders === 0)
    .sort((a, b) => b.visits - a.visits);
}
