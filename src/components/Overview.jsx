import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Box,
  Search,
  Sparkles,
  Info,
  Tag,
  CircleHelp,
} from "lucide-react";
import { PanelTitle } from "./DashboardUI.jsx";
import Select from "./Select.jsx";
import Dialog from "./Dialog.jsx";
import ListProduct from "./ListProduct.jsx";
import InfiniteList, { useInfiniteList } from "./InfiniteList.jsx";
import { inventoryView, growthProducts, priceGroup } from "../data/overview.js";
import { fmt, dateLabel, percent, ratio, shortName } from "../data/report.js";
import { monthGrid } from "../data/calendar.js";

function InventoryList({ rows, onProduct, renderPhoto }) {
  const { visible, more, load } = useInfiniteList(rows);
  return (
    <>
      <div className="table-scroll">
        <table className="dashboard-list inventory-list">
          <thead>
            <tr>
              <th>Товар</th>
              <th>Остаток, шт.</th>
              <th>Дата остатка</th>
              <th>Запас, дней</th>
              <th>Индекс цен</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.sku}>
                <td>
                  <ListProduct
                    name={shortName(p.name)}
                    sku={p.sku}
                    article={p.article}
                    onOpen={() => onProduct(p.sku)}
                    photo={renderPhoto(p.sku)}
                  />
                </td>
                <td>{p.stock == null ? "Нет данных" : fmt(p.stock)}</td>
                <td>
                  {p.stockDate
                    ? dateLabel(p.stockDate, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </td>
                <td>{p.daysOfStock == null ? "—" : fmt(p.daysOfStock, 1)}</td>
                <td>{p.priceIndex || "Без индекса"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <InfiniteList
        shown={visible.length}
        total={rows.length}
        more={more}
        onLoad={load}
      />
      {!rows.length && (
        <p className="overview-note">В выбранной группе товаров нет.</p>
      )}
    </>
  );
}
function SalesPulse({ days, onDay }) {
  const months = useMemo(
    () => [
      ...new Set(
        days.filter((d) => !d.unavailable).map((d) => d.date.slice(0, 7)),
      ),
    ],
    [days],
  );
  const [choice, setChoice] = useState("");
  const month = months.includes(choice) ? choice : months.at(-1);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cells = month ? monthGrid(month + "-01") : [];
  const active = days.filter((d) => d.date.startsWith(month) && !d.unavailable);
  const peak = active.reduce(
    (best, d) => (!best || d.orders > best.orders ? d : best),
    null,
  );
  const max = Math.max(1, ...active.map((d) => d.orders || 0));
  return (
    <section className="card sales-pulse">
      <PanelTitle
        icon={CalendarDays}
        label="Активность по дням"
        title="Пульс продаж"
      />
      <Select
        label="Месяц активности"
        value={month || ""}
        onChange={setChoice}
        options={months.map((m) => ({
          value: m,
          label: dateLabel(m + "-01", { month: "long", year: "numeric" }),
        }))}
      />
      <div className="pulse-weekdays">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="pulse-grid">
        {cells.map((d) => {
          const row = byDate.get(d.date),
            enabled = d.inMonth && row && !row.unavailable;
          const orders = row?.orders || 0;
          return (
            <div key={d.date}>
              {d.inMonth && (
                <button
                  type="button"
                  disabled={!enabled}
                  aria-label={`${dateLabel(d.date, { day: "numeric", month: "long", year: "numeric" })}: ${enabled ? fmt(orders) + " заказано" : "вне выбранного периода"}`}
                  className={d.date === peak?.date ? "peak" : ""}
                  style={
                    enabled
                      ? {
                          "--pulse": ratio(orders, max) / 100,
                          "--pulse-size":
                            26 + 13 * Math.sqrt(orders / max) + "px",
                        }
                      : {}
                  }
                  onClick={() => onDay(d.date)}
                >
                  {d.day}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="pulse-peak">
        <span>{peak ? `Пик: ${dateLabel(peak.date)}` : "Нет данных"}</span>
        <strong>{peak ? fmt(peak.orders) + " шт." : "—"}</strong>
      </div>
      <p className="overview-note">
        Размер круга — заказанные товары. За видимые даты месяца:{" "}
        {fmt(active.reduce((s, d) => s + (d.orders || 0), 0))} шт.
      </p>
    </section>
  );
}
export default function Overview({
  report,
  view,
  filters,
  leaders,
  onProduct,
  renderPhoto,
  onGrowth,
  onDay,
}) {
  const inventory = useMemo(
    () => inventoryView(report, filters),
    [report, filters],
  );
  const growth = useMemo(() => growthProducts(view.products), [view.products]);
  const [detail, setDetail] = useState(null);
  const open = (kind, label) => setDetail({ kind, label });
  const rows = useMemo(
    () =>
      !detail
        ? []
        : detail.kind === "prices"
          ? inventory.items.filter(
              (p) => priceGroup(p.priceIndex) === detail.label,
            )
          : inventory[detail.kind] || inventory.items,
    [inventory, detail],
  );
  const stockDates = inventory.dates.length
    ? `${dateLabel(inventory.dates[0])} — ${dateLabel(inventory.dates.at(-1))}`
    : "Нет дат остатков";
  return (
    <>
      <div className="overview-middle">
        <section className="card dark-panel overview-priorities">
          <PanelTitle
            icon={Sparkles}
            label="Приоритеты по данным"
            title="Требуют проверки"
          />
          <button className="priority-row" onClick={onGrowth}>
            <span className="dashboard-icon">
              <Search size={20} />
            </span>
            <span>
              <strong>Есть интерес, нет заказов</strong>
              <small>От 100 посещений за период</small>
            </span>
            <b>{growth.length}</b>
            <ArrowUpRight size={17} />
          </button>
          <button
            className="priority-row"
            onClick={() => open("risks", "Проверить пополнение")}
          >
            <span className="dashboard-icon">
              <Box size={20} />
            </span>
            <span>
              <strong>Проверить пополнение</strong>
              <small>Оценка запаса меньше 14 дней</small>
            </span>
            <b>{inventory.available ? inventory.risks.length : "—"}</b>
            <ArrowUpRight size={17} />
          </button>
          <button
            className="priority-row"
            onClick={() => open("unknown", "Остаток неизвестен")}
          >
            <span className="dashboard-icon">
              <Info size={20} />
            </span>
            <span>
              <strong>Остаток неизвестен</strong>
              <small>Пропуски и противоречивые значения отдельно</small>
            </span>
            <b>{inventory.available ? inventory.unknown.length : "—"}</b>
            <ArrowUpRight size={17} />
          </button>
        </section>
        <SalesPulse days={view.days} onDay={onDay} />
        <section className="card inventory-card">
          <PanelTitle
            icon={Box}
            label="Ассортимент"
            title="Остатки товаров"
            onOpen={() => open("items", "Остатки товаров")}
          />
          {inventory.available ? (
            <>
              <button
                className="inventory-rings"
                aria-label="Открыть остатки всех товаров"
                onClick={() => open("items", "Остатки товаров")}
              >
                <svg viewBox="0 0 220 220" aria-hidden="true">
                  {[
                    [96, inventory.positive.length, "#ff9958"],
                    [81, inventory.zero.length, "#5a5e74"],
                    [66, inventory.unknown.length, "#c3b3dc"],
                  ].map(([radius, count, color]) => (
                    <g key={radius}>
                      <circle
                        cx="110"
                        cy="110"
                        r={radius}
                        fill="none"
                        stroke="#efedf5"
                        strokeWidth="7"
                      />
                      <circle
                        cx="110"
                        cy="110"
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth="7"
                        strokeLinecap="round"
                        pathLength="100"
                        strokeDasharray={`${Math.min(100, ratio(count, inventory.items.length))} 100`}
                        transform="rotate(-90 110 110)"
                      />
                    </g>
                  ))}
                </svg>
                <span>
                  <strong>{fmt(inventory.units)}</strong>
                  <small>шт. известно</small>
                </span>
              </button>
              <div className="inventory-counts">
                {[
                  ["positive", "В наличии"],
                  ["zero", "Нулевой остаток"],
                  ["unknown", "Нет данных"],
                ].map(([key, title]) => (
                  <button key={key} onClick={() => open(key, title)}>
                    <strong>{inventory[key].length}</strong>
                    <span>{title}</span>
                  </button>
                ))}
              </div>
              <div className="inventory-caption">
                <span>Срез разных дат</span>
                <button
                  className="text-button"
                  onClick={() => open("risks", "Проверить пополнение")}
                >
                  {inventory.risks.length} SKU на пополнение{" "}
                  <ArrowUpRight size={14} />
                </button>
              </div>
              <p className="overview-note">
                Последние известные значения до {dateLabel(filters.end)}. Даты
                остатков: {stockDates}.
              </p>
            </>
          ) : (
            <div className="overview-missing">
              <CircleHelp size={32} />
              <p>
                В этом отчёте нет данных об остатках. Загрузите подробный Excel
                Ozon.
              </p>
            </div>
          )}
        </section>
      </div>
      <div className="overview-bottom">
        {leaders}
        <section className="card price-index-card">
          <PanelTitle icon={Tag} label="Цены ассортимента" title="Индекс цен" />
          {inventory.prices.map(({ label, count }) => (
            <button
              className="price-index-row"
              key={label}
              onClick={() => open("prices", label)}
            >
              <span>{label}</span>
              <i>
                <b
                  style={{
                    width: `${ratio(count, Math.max(1, ...inventory.prices.map((p) => p.count)))}%`,
                    background:
                      label === "Невыгодный"
                        ? "#ffb082"
                        : label === "Без индекса"
                          ? "#dce0e9"
                          : "#d4c5e9",
                  }}
                />
              </i>
              <strong>{count}</strong>
            </button>
          ))}
          <p className="overview-note">
            По последнему значению каждого SKU до {dateLabel(filters.end)}. Даты
            срезов могут различаться. Нажмите на группу, чтобы увидеть товары.
          </p>
        </section>
      </div>
      {detail && (
        <Dialog
          title={detail.label}
          className="inventory-dialog"
          wide
          onClose={() => setDetail(null)}
        >
          <p className="overview-note">
            Остатки не суммируются по дням. Запас в днях — оценка по заказам за
            28 дней до даты остатка, без учёта будущих поставок.
          </p>
          <InventoryList
            rows={rows}
            renderPhoto={renderPhoto}
            onProduct={(sku) => {
              setDetail(null);
              onProduct(sku);
            }}
          />
        </Dialog>
      )}
    </>
  );
}
