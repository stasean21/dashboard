export const toISO = (d) => d.toISOString().slice(0, 10);
export const dateUTC = (value) => new Date(value + "T00:00:00Z");
export const monthStart = (value) => value.slice(0, 7) + "-01";
export function shiftMonth(value, delta) {
  const date = dateUTC(monthStart(value));
  date.setUTCMonth(date.getUTCMonth() + delta);
  return toISO(date);
}
export function monthGrid(value) {
  const first = dateUTC(monthStart(value));
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(first);
    d.setUTCDate(1 - offset + i);
    return {
      date: toISO(d),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === first.getUTCMonth(),
      weekend: i % 7 >= 5,
    };
  });
}
export function moscowToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function dayBefore(value) {
  const d = dateUTC(value);
  d.setUTCDate(d.getUTCDate() - 1);
  return toISO(d);
}
export function rangeLength(start, end) {
  return start && end
    ? Math.round((dateUTC(end) - dateUTC(start)) / 86400000) + 1
    : 0;
}
export function dayCountLabel(n) {
  const tail = n % 100;
  return `${n} ${tail >= 11 && tail <= 14 ? "дней" : n % 10 === 1 ? "день" : n % 10 >= 2 && n % 10 <= 4 ? "дня" : "дней"}`;
}
