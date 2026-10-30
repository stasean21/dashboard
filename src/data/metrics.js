import { money, fmt } from "./report.js";

export const metrics = {
  amount: {
    label: "Сумма заказов",
    unit: "₽",
    title: "Динамика суммы заказов",
    table: "Товары по сумме заказов",
  },
  orders: {
    label: "Заказано товаров",
    unit: "шт.",
    title: "Динамика заказанных товаров",
    table: "Товары по количеству заказанных",
  },
  bought: {
    label: "Выкуплено товаров",
    unit: "шт.",
    title: "Динамика выкупленных товаров",
    table: "Товары по количеству выкупленных",
  },
  averagePrice: {
    label: "Средняя цена",
    unit: "₽",
    title: "Динамика средней цены",
    table: "Товары по средней цене",
  },
  cancelled: { label: "Отменено", unit: "шт." },
  returned: { label: "Возвращено", unit: "шт." },
};

export const metricValue = (row, key) =>
  key === "averagePrice"
    ? row.orders > 0
      ? row.amount / row.orders
      : null
    : row[key];

export const formatMetric = (key, value) =>
  value == null
    ? "—"
    : key === "amount" || key === "averagePrice"
      ? money(value)
      : fmt(value);

export function metricProducts(products, key) {
  return products.filter((p) =>
    key === "averagePrice" ? p.orders > 0 : metricValue(p, key) > 0,
  );
}

export function recommendedGroup(days) {
  return days > 180 ? "month" : days > 31 ? "week" : "day";
}

// Calculate prices after summing the bucket, never by summing/averaging daily prices.
export function chartBuckets(days, group) {
  const buckets = new Map();
  for (const day of days) {
    let date = day.date;
    if (group === "month") date = date.slice(0, 7) + "-01";
    if (group === "week") {
      const d = new Date(date + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      date = d.toISOString().slice(0, 10);
    }
    if (!buckets.has(date))
      buckets.set(date, { date, startDate: day.date, endDate: day.date });
    const bucket = buckets.get(date);
    bucket.endDate = day.date;
    for (const [key, value] of Object.entries(day)) {
      if (typeof value === "number") bucket[key] = (bucket[key] || 0) + value;
    }
  }
  return [...buckets.values()].map((b) => ({
    ...b,
    averagePrice: metricValue(b, "averagePrice"),
  }));
}
