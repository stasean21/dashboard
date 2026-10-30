import { useState, useEffect, useMemo, useRef, useDeferredValue } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Upload,
  Download,
  Search,
  X,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  SlidersHorizontal,
  Box,
  Eye,
  MousePointer2,
  ShoppingCart,
  ArrowUpDown,
  Info,
  Check,
  RotateCcw,
  FileSpreadsheet,
  AlertCircle,
  CircleHelp,
} from "lucide-react";
import { gunzipSync, strFromU8 } from "fflate";
import {
  getView,
  groupDays,
  rangePreset,
  previousRange,
  ratio,
  fmt,
  money,
  percent,
  dateLabel,
  shortName,
} from "./data/report.js";

const tabs = ["Обзор", "Товары", "Воронка", "Качество"];
const titles = [
  "Обзор продаж",
  "Ваши товары",
  "Воронка продаж",
  "Качество заказов",
];
const labels = {
  amount: "Сумма заказов",
  orders: "Заказано товаров",
  bought: "Выкуплено",
  cancelled: "Отменено",
  returned: "Возвращено",
  impressions: "Показы",
  visits: "Посещения карточек",
  cart: "Добавления в корзину",
};
const defaults = { query: "", abc: "all", scheme: "all" };
const displayValue = (key, n) => (key === "amount" ? money(n) : fmt(n));

function Logo() {
  return (
    <div className="brand">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path fill="currentColor" d="m20 1 17 9v20L20 39 3 30V10z" />
        <path fill="white" d="m20 9 9 5-13 7v10l-6-3V17z" />
      </svg>
      <div>
        <span>FORMULA</span>
        <small>Ozon · аналитика магазина</small>
      </div>
    </div>
  );
}
function Card({ children, className = "", ...props }) {
  return (
    <section className={`card ${className}`} {...props}>
      {children}
    </section>
  );
}
function Empty({ text = "За этот период данных нет", reset }) {
  return (
    <div className="empty">
      <Box size={30} />
      <h3>{text}</h3>
      <p>Попробуйте другой период или измените фильтры.</p>
      {reset && (
        <button className="button" onClick={reset}>
          <RotateCcw size={14} />
          Сбросить фильтры
        </button>
      )}
    </div>
  );
}
function Tip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span>
        {dateLabel(label, { day: "numeric", month: "long", year: "numeric" })}
      </span>
      {payload.map((p) => (
        <div key={p.dataKey}>
          <i style={{ background: p.color }} />
          {labels[p.dataKey]}
          <strong>{displayValue(p.dataKey, p.value)}</strong>
        </div>
      ))}
    </div>
  );
}
function Chart({
  days,
  metric = "amount",
  group = "day",
  height = 220,
  type = "area",
  quality = false,
  onClick,
}) {
  const data = useMemo(() => groupDays(days, group), [days, group]);
  const ChartTag = type === "bar" ? BarChart : AreaChart;
  const axisFormat = (v) =>
    Math.abs(v) >= 1e6
      ? `${fmt(v / 1e6, 1)} млн`
      : Math.abs(v) >= 1000
        ? `${fmt(v / 1000, 0)} тыс.`
        : fmt(v);
  return (
    <div style={{ height }} className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <ChartTag
          data={data}
          margin={{ top: 12, right: 15, left: 0, bottom: 0 }}
          onClick={(state) =>
            onClick && state?.activeLabel && onClick(state.activeLabel)
          }
        >
          <defs>
            <linearGradient id="orangeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff742e" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#ff742e" stopOpacity={0.015} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 5"
            vertical={false}
            stroke="var(--grid)"
          />
          <XAxis
            dataKey="date"
            tickFormatter={(d) =>
              dateLabel(d, group === "month" ? { month: "short" } : undefined)
            }
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            minTickGap={30}
            dy={9}
          />
          <YAxis
            tickFormatter={axisFormat}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            width={56}
          />
          <Tooltip
            content={<Tip metric={metric} />}
            cursor={{ stroke: "#ffb28b", strokeDasharray: "4 4" }}
          />
          {quality ? (
            <>
              <Bar dataKey="cancelled" fill="#ff7839" radius={[4, 4, 0, 0]} />
              <Bar dataKey="returned" fill="#343b52" radius={[4, 4, 0, 0]} />
            </>
          ) : type === "bar" ? (
            <Bar
              dataKey={metric}
              fill="#ff7b39"
              radius={[5, 5, 0, 0]}
              maxBarSize={40}
            />
          ) : (
            <Area
              type="linear"
              dataKey={metric}
              stroke="#ff7028"
              strokeWidth={2.5}
              animationDuration={450}
              fill="url(#orangeFill)"
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 3 }}
              dot={
                data.length <= 12
                  ? { r: 3.5, fill: "#ff7028", stroke: "#fff", strokeWidth: 2 }
                  : false
              }
            />
          )}
        </ChartTag>
      </ResponsiveContainer>
    </div>
  );
}
function Gauge({ value, bought, orders }) {
  const safe = Math.max(0, Math.min(100, value));
  const angle = Math.PI - (safe / 100) * Math.PI;
  const ux = Math.cos(angle),
    uy = -Math.sin(angle);
  const px = 130 + ux * 77,
    py = 125 + uy * 77;
  return (
    <div className="gauge">
      <svg
        viewBox="0 0 260 165"
        role="img"
        aria-label={`Процент выкупа ${percent(value)}`}
      >
        <path
          d="M 22 125 A 108 108 0 0 1 238 125"
          pathLength="100"
          fill="none"
          stroke="var(--track)"
          strokeWidth="19"
        />
        <path
          d="M 22 125 A 108 108 0 0 1 238 125"
          pathLength="100"
          fill="none"
          stroke="#ff7734"
          strokeWidth="19"
          strokeDasharray={`${safe} 100`}
        />
        <path
          d={`M ${130 - uy * 5} ${125 + ux * 5} L ${px} ${py} L ${130 + uy * 5} ${125 - ux * 5} Z`}
          fill="#283148"
        />
        <circle cx="130" cy="125" r="6" fill="#283148" />
        <text x="14" y="155">
          0%
        </text>
        <text x="216" y="155">
          100%
        </text>
      </svg>
      <strong>{orders ? percent(value) : "—"}</strong>
      <p>
        {fmt(bought)} из {fmt(orders)} товаров
      </p>
    </div>
  );
}
function Funnel({ total, expanded = false }) {
  const steps = [
    { k: "impressions", name: "Показы", icon: Eye },
    { k: "visits", name: "Посещения карточек", icon: MousePointer2 },
    { k: "cart", name: "Добавления в корзину", icon: ShoppingCart },
    { k: "orders", name: "Заказано товаров", icon: Box },
  ];
  return (
    <div className={`funnel ${expanded ? "expanded" : ""}`}>
      {steps.map(({ k, name, icon: Icon }, i) => (
        <div key={k} className="funnel-step">
          <div className="step-main">
            <span className="icon-bubble">
              <Icon size={18} />
            </span>
            <span>{name}</span>
            <strong>{fmt(total[k])}</strong>
          </div>
          {expanded && (
            <div className="step-extra">
              <div className="funnel-track">
                <span
                  style={{
                    width: `${Math.max(1, ratio(total[k], total.impressions))}%`,
                  }}
                />
              </div>
              {i > 0 && (
                <small>
                  {percent(ratio(total[k], total[steps[i - 1].k]))} к
                  предыдущему этапу
                </small>
              )}
            </div>
          )}
        </div>
      ))}
      <p className="fineprint">События, не уникальные покупатели</p>
    </div>
  );
}
function Metric({ title, value, suffix, accent, children }) {
  return (
    <Card className={`metric ${accent ? "accent" : ""}`}>
      <span>{title}</span>
      <div>
        {value}
        {suffix && <small>{suffix}</small>}
      </div>
      <p>{children || "\u00a0"}</p>
    </Card>
  );
}
function Ring({ value }) {
  return (
    <div
      className="ring"
      style={{
        background: `conic-gradient(#ff7734 ${Math.min(100, value)}%, var(--track) 0)`,
      }}
      aria-hidden="true"
    >
      <div />
    </div>
  );
}
function Insights({ view, onQuality }) {
  const { total, products } = view,
    top = products[0];
  const buyout = ratio(total.bought, total.orders),
    cancel = ratio(total.cancelled, total.orders),
    returned = ratio(total.returned, total.orders);
  const statusTotal = total.bought + total.cancelled + total.returned;
  return (
    <Card className="insights">
      <div className="card-heading">
        <h2>На что обратить внимание</h2>
        {onQuality && (
          <button
            className="icon-button"
            title="Подробнее о качестве заказов"
            onClick={onQuality}
          >
            <ArrowUpRight size={17} />
          </button>
        )}
      </div>
      <div className="quality-numbers">
        <div>
          <strong>{percent(cancel)}</strong>
          <span>Отменено · {fmt(total.cancelled)} товаров</span>
        </div>
        <div>
          <strong>{percent(returned)}</strong>
          <span>Возвращено · {fmt(total.returned)} товаров</span>
        </div>
      </div>
      <div
        className="status-bar"
        aria-label="Соотношение выкупа, отмен и возвратов"
      >
        <span style={{ flex: total.bought || 0.001, background: "#ffc69f" }} />
        <span
          style={{ flex: total.cancelled || 0.001, background: "#ff7032" }}
        />
        <span
          style={{ flex: total.returned || 0.001, background: "#283148" }}
        />
      </div>
      <div className="legend">
        <span>
          <i style={{ background: "#ffc69f" }} />
          Выкуп · {percent(buyout)}
        </span>
        <span>
          <i style={{ background: "#ff7032" }} />
          Отмены · {percent(cancel)}
        </span>
        <span>
          <i style={{ background: "#283148" }} />
          Возвраты · {percent(returned)}
        </span>
      </div>
      {total.orders > 0 && statusTotal !== total.orders && (
        <p className="fineprint">
          Сумма статусов отличается от числа заказанных товаров в детализации
          отчёта.
        </p>
      )}
      <div className="concentration">
        <Ring value={ratio(top?.amount || 0, total.amount)} />
        <div>
          <p>
            <strong>{percent(ratio(top?.amount || 0, total.amount))}</strong>{" "}
            суммы заказов — один SKU
          </p>
          <span>
            {top ? shortName(top.name) : "Нет заказов в выбранном периоде"}
          </span>
        </div>
      </div>
    </Card>
  );
}
function ProductTable({
  products,
  compact = false,
  onProduct,
  onAll,
  sort,
  onSort,
}) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [products, sort]);
  const sorted = useMemo(
    () =>
      [...products].sort((a, b) => {
        const av = a[sort.key],
          bv = b[sort.key];
        return (
          (typeof av === "string" ? av.localeCompare(bv, "ru") : av - bv) *
          (sort.dir === "asc" ? 1 : -1)
        );
      }),
    [products, sort],
  );
  const limit = compact ? 4 : 12,
    maxPage = Math.max(0, Math.ceil(sorted.length / limit) - 1);
  const currentPage = Math.min(page, maxPage),
    visible = sorted.slice(currentPage * limit, (currentPage + 1) * limit);
  const cols = [
    { key: "name", label: "Товар" },
    { key: "abc", label: "ABC" },
    { key: "orders", label: "Заказано, шт." },
    ...(!compact ? [{ key: "cancelled", label: "Отмены" }] : []),
    { key: "amount", label: "Сумма заказов" },
  ];
  return (
    <Card className="products-card">
      <div className="card-heading">
        <h2>{compact ? "Топ товаров" : "Товары и показатели"}</h2>
        <div className="inline">
          <span className="chip">{fmt(products.length)} SKU</span>
          {compact && (
            <button className="text-button" onClick={onAll}>
              Все товары <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      </div>
      {!products.length ? (
        <Empty text="Товары не найдены" />
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c.key}>
                      <button
                        onClick={() => onSort(c.key)}
                        className={sort.key === c.key ? "sorted" : ""}
                      >
                        {c.label}
                        <ArrowUpDown size={12} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.sku}>
                    <td>
                      <button
                        className="product-button"
                        onClick={() => onProduct(p.sku)}
                      >
                        <span className="product-icon">
                          <Box size={21} />
                        </span>
                        <span>
                          <span className="product-name">
                            {shortName(p.name)}
                          </span>
                          {!compact && (
                            <small>
                              SKU {p.sku} · {p.article}
                            </small>
                          )}
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className={`abc abc-${p.abc}`}>{p.abc}</span>
                    </td>
                    <td>{fmt(p.orders)}</td>
                    {!compact && <td>{fmt(p.cancelled)}</td>}
                    <td>
                      <button
                        className="amount-button"
                        onClick={() => onProduct(p.sku)}
                      >
                        {money(p.amount)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!compact && (
            <div className="pagination">
              <span>
                {currentPage * limit + 1}–
                {Math.min((currentPage + 1) * limit, products.length)} из{" "}
                {fmt(products.length)} товаров
              </span>
              <div className="inline">
                <button
                  aria-label="Предыдущая страница"
                  className="icon-button"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <span>
                  {currentPage + 1} / {maxPage + 1}
                </span>
                <button
                  aria-label="Следующая страница"
                  className="icon-button"
                  disabled={currentPage >= maxPage}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
function Dialog({ children, title, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-top">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Закрыть" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function App() {
  const [report, setReport] = useState(null),
    [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState({ start: "", end: "", ...defaults });
  const [tab, setTab] = useState(0),
    [periodOpen, setPeriodOpen] = useState(false),
    [draftDates, setDraftDates] = useState({ start: "", end: "" });
  const [funnelMetric, setFunnelMetric] = useState("impressions");
  const [metric, setMetric] = useState("amount"),
    [group, setGroup] = useState("day"),
    [chartType, setChartType] = useState("area"),
    [chartRange, setChartRange] = useState("7");
  const [productSku, setProductSku] = useState(null),
    [info, setInfo] = useState(false),
    [importing, setImporting] = useState(false),
    [progress, setProgress] = useState(0),
    [toast, setToast] = useState("");
  const [sort, setSort] = useState({ key: "amount", dir: "desc" });
  const [qualitySort, setQualitySort] = useState({
    key: "cancelled",
    dir: "desc",
  });
  const inputRef = useRef(),
    workerRef = useRef();
  const deferredQuery = useDeferredValue(filters.query);
  const effectiveFilters = useMemo(
    () => ({ ...filters, query: deferredQuery }),
    [filters, deferredQuery],
  );
  function applyReport(next) {
    setReport(next);
    setFilters({ ...defaults, start: next.minDate, end: next.maxDate });
    setProductSku(null);
  }
  useEffect(() => {
    let active = true;
    fetch("/data/report.json.gz")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.arrayBuffer();
      })
      .then((b) =>
        JSON.parse(
          strFromU8(
            new Uint8Array(b)[0] === 0x1f && new Uint8Array(b)[1] === 0x8b
              ? gunzipSync(new Uint8Array(b))
              : new Uint8Array(b),
          ),
        ),
      )
      .then((r) => {
        if (active) applyReport(r);
      })
      .catch(() => {
        if (active)
          setLoadError(
            "Не удалось загрузить исходный отчёт. Попробуйте обновить страницу или загрузить Excel.",
          );
      });
    return () => {
      active = false;
      workerRef.current?.terminate();
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  const view = useMemo(
    () => (report ? getView(report, effectiveFilters) : null),
    [report, effectiveFilters],
  );
  const chartFilters = useMemo(() => {
    if (!report) return effectiveFilters;
    const d = new Date(filters.end + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 6);
    return {
      ...effectiveFilters,
      start:
        chartRange === "7"
          ? [filters.start, d.toISOString().slice(0, 10)].sort().at(-1)
          : filters.start,
    };
  }, [report, effectiveFilters, chartRange]);
  const chartView = useMemo(
    () => (report ? getView(report, chartFilters) : null),
    [report, chartFilters],
  );
  const previous = useMemo(() => {
    if (!report) return null;
    const prev = previousRange(chartFilters.start, chartFilters.end);
    return prev.start >= report.minDate
      ? getView(report, { ...effectiveFilters, ...prev })
      : null;
  }, [report, effectiveFilters, chartFilters]);
  const selectedProduct = view?.products.find((p) => p.sku === productSku);
  const productDays = useMemo(() => {
    if (!view || !productSku) return [];
    const days = view.days.map((d) => ({
      date: d.date,
      ...Object.fromEntries(Object.keys(labels).map((k) => [k, 0])),
    }));
    const byDate = new Map(days.map((d) => [d.date, d]));
    for (const r of view.rows)
      if (r.sku === productSku)
        for (const k of Object.keys(labels)) byDate.get(r.date)[k] += r[k];
    return days;
  }, [view, productSku]);
  const update = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const reset = () =>
    setFilters({ ...defaults, start: report.minDate, end: report.maxDate });
  async function importFile(file) {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      setToast(
        "Поддерживается Excel .xlsx — ежедневный отчёт Ozon «По товарам».",
      );
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setToast("Файл больше 30 МБ. Сократите период выгрузки.");
      return;
    }
    setImporting(true);
    setProgress(0);
    setLoadError("");
    try {
      const buffer = await file.arrayBuffer();
      const worker = new Worker(
        new URL("./data/import.worker.js", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;
      worker.onmessage = ({ data }) => {
        if (data.progress != null) setProgress(data.progress);
        if (data.report) {
          applyReport(data.report);
          setImporting(false);
          setToast(
            `Загружено ${fmt(data.report.rows.length)} строк. Файл обработан локально; после обновления страницы вернётся исходная выгрузка.`,
          );
          worker.terminate();
        }
        if (data.error) {
          setImporting(false);
          setToast(data.error);
          worker.terminate();
        }
      };
      worker.onerror = () => {
        setImporting(false);
        setToast("Не удалось обработать Excel. Проверьте формат выгрузки.");
        worker.terminate();
      };
      worker.postMessage({ buffer, fileName: file.name }, [buffer]);
    } catch {
      setImporting(false);
      setToast("Не удалось прочитать файл. Попробуйте ещё раз.");
    }
  }
  function exportCsv() {
    const rows = [
      [
        "Товар",
        "SKU",
        "Артикул",
        "ABC",
        "Заказано, шт.",
        "Сумма заказов, ₽",
        "Выкуплено, шт.",
        "Отменено, шт.",
        "Возвращено, шт.",
      ],
      ...view.products.map((p) => [
        p.name,
        p.sku,
        p.article,
        p.abc,
        p.orders,
        p.amount,
        p.bought,
        p.cancelled,
        p.returned,
      ]),
    ];
    const escape = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const url = URL.createObjectURL(
      new Blob(
        ["\ufeff" + rows.map((r) => r.map(escape).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `formula_${filters.start}_${filters.end}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("Таблица выбранных товаров выгружена в CSV.");
  }
  const onSort = (key) =>
    setSort((s) => ({
      key,
      dir: s.key === key && s.dir === "desc" ? "asc" : "desc",
    }));
  if (!report)
    return (
      <main className="loading-page">
        <Logo />
        {loadError ? (
          <>
            <AlertCircle size={30} />
            <h1>Не удалось открыть отчёт</h1>
            <p>{loadError}</p>
            <button
              className="button primary"
              onClick={() => inputRef.current.click()}
            >
              Загрузить Excel
            </button>
          </>
        ) : (
          <>
            <div className="loader" />
            <h1>Собираем вашу аналитику</h1>
            <p>Читаем данные магазина FORMULA…</p>
          </>
        )}
        <input
          hidden
          type="file"
          ref={inputRef}
          accept=".xlsx"
          onChange={(e) => importFile(e.target.files[0])}
        />
        {toast && <p role="status">{toast}</p>}
      </main>
    );
  const total = view.total,
    buyout = ratio(total.bought, total.orders);
  const change =
    previous?.total[metric] > 0
      ? (chartView.total[metric] / previous.total[metric] - 1) * 100
      : null;
  const activeFilters =
    filters.query || filters.abc !== "all" || filters.scheme !== "all";
  return (
    <div className="app-shell">
      <header className="topbar">
        <Logo />
        <nav aria-label="Главная навигация">
          {tabs.map((name, i) => (
            <button
              key={name}
              className={tab === i ? "active" : ""}
              onClick={() => setTab(i)}
            >
              {name}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="icon-button"
            title="О данных и расчётах"
            aria-label="О данных и расчётах"
            onClick={() => setInfo(true)}
          >
            <CircleHelp size={20} />
          </button>
          <span className="avatar" title={report.seller}>
            {report.seller.slice(0, 1)}
          </span>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">ВАШ МАГАЗИН · {report.seller}</div>
            <h1>{titles[tab]}</h1>
            <p>
              {tab === 0
                ? "Каждая цифра — часть большой картины"
                : tab === 1
                  ? "Найдите точки роста в каждом SKU"
                  : tab === 2
                    ? "От первого показа до заказа"
                    : "Выкуп, отмены и возвраты под контролем"}
            </p>
          </div>
          <div className="page-actions">
            <button
              className="button date-button"
              onClick={() => {
                setDraftDates({ start: filters.start, end: filters.end });
                setPeriodOpen(true);
              }}
            >
              <CalendarDays size={17} />
              {dateLabel(filters.start, {
                day: "2-digit",
                month: "2-digit",
              })}{" "}
              —{" "}
              {dateLabel(filters.end, {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
              <ChevronDown size={14} />
            </button>
            <button
              className="button upload-button"
              disabled={importing}
              onClick={() => inputRef.current.click()}
            >
              <Upload size={16} />
              {importing ? `${progress}%` : "Загрузить Excel"}
            </button>
          </div>
        </div>
        <input
          hidden
          ref={inputRef}
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            importFile(e.target.files[0]);
            e.target.value = "";
          }}
        />
        <div className="filter-bar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Поиск товаров"
              placeholder="Название, артикул или SKU"
              value={filters.query}
              onChange={(e) => update("query", e.target.value)}
            />
            {filters.query && (
              <button
                className="bare-button"
                aria-label="Очистить поиск"
                onClick={() => update("query", "")}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <div className="filters">
            <SlidersHorizontal size={15} />
            <label>
              <span className="sr-only">Класс ABC</span>
              <select
                aria-label="Класс ABC"
                value={filters.abc}
                onChange={(e) => update("abc", e.target.value)}
              >
                <option value="all">Все классы ABC</option>
                <option value="A">Класс A</option>
                <option value="B">Класс B</option>
                <option value="C">Класс C</option>
                <option value="—">Без класса</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Схема работы</span>
              <select
                aria-label="Схема работы"
                value={filters.scheme}
                onChange={(e) => update("scheme", e.target.value)}
              >
                <option value="all">FBO + FBS</option>
                <option value="FBO">Есть FBO</option>
                <option value="FBS">Есть FBS</option>
              </select>
            </label>
            {activeFilters && (
              <button className="text-button" onClick={reset}>
                <RotateCcw size={13} />
                Сбросить
              </button>
            )}
          </div>
          <button
            className="text-button export-button"
            onClick={exportCsv}
            disabled={view.empty}
          >
            <Download size={15} />
            Экспорт CSV
          </button>
        </div>
        <div className="metrics-grid">
          <Metric title="Заказано на сумму" value={money(total.amount)} accent>
            Включая отмены и возвраты
          </Metric>
          <Metric
            title="Заказано товаров"
            value={fmt(total.orders)}
            suffix="шт."
          >
            {fmt(view.products.length)} SKU в выбранных данных
          </Metric>
          <Metric
            title="Выкуплено товаров"
            value={fmt(total.bought)}
            suffix="шт."
          >
            <span className="green-dot" />
            {percent(buyout)} от заказанных
          </Metric>
          <Metric
            title="Средняя цена"
            value={
              total.orders
                ? money(Math.round(total.amount / total.orders))
                : "—"
            }
          >
            Сумма заказов / количество товаров
          </Metric>
        </div>
        {view.empty ? (
          <Card>
            <Empty reset={reset} />
          </Card>
        ) : (
          <>
            {(tab === 0 || tab === 3) && (
              <div className="overview-grid">
                <Card className="trend-card">
                  <div className="card-heading">
                    <div>
                      <h2>
                        {tab === 3 ? "Отмены и возвраты" : "Заказы по дням"}
                      </h2>
                      <p>
                        {dateLabel(chartFilters.start)} —{" "}
                        {dateLabel(chartFilters.end, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <select
                      aria-label="Период графика"
                      className="pill-select"
                      value={chartRange}
                      onChange={(e) => setChartRange(e.target.value)}
                    >
                      <option value="7">Последние 7 дней</option>
                      <option value="all">Весь выбранный период</option>
                    </select>
                  </div>
                  <div className="chart-controls">
                    <div className="segmented">
                      <button
                        className={group === "day" ? "selected" : ""}
                        onClick={() => setGroup("day")}
                      >
                        Дни
                      </button>
                      <button
                        className={group === "week" ? "selected" : ""}
                        onClick={() => setGroup("week")}
                      >
                        Недели
                      </button>
                      <button
                        className={group === "month" ? "selected" : ""}
                        onClick={() => setGroup("month")}
                      >
                        Месяцы
                      </button>
                    </div>
                    {tab === 0 && (
                      <select
                        aria-label="Показатель графика"
                        value={metric}
                        onChange={(e) => setMetric(e.target.value)}
                      >
                        <option value="amount">Сумма заказов, ₽</option>
                        <option value="orders">Заказано, шт.</option>
                        <option value="bought">Выкуплено, шт.</option>
                      </select>
                    )}
                  </div>
                  {tab === 0 && (
                    <div className="chart-summary">
                      <strong>
                        {displayValue(metric, chartView.total[metric])}
                      </strong>
                      {change != null && (
                        <span
                          className={`change ${change < 0 ? "negative" : "positive"}`}
                        >
                          {change < 0 ? (
                            <ArrowDownRight size={13} />
                          ) : (
                            <ArrowUpRight size={13} />
                          )}{" "}
                          {change > 0 ? "+" : ""}
                          {fmt(change, 1)}% <small>к предыдущему периоду</small>
                        </span>
                      )}
                    </div>
                  )}
                  {tab === 3 && (
                    <div className="legend">
                      <span>
                        <i style={{ background: "#ff7839" }} />
                        Отменено
                      </span>
                      <span>
                        <i style={{ background: "#343b52" }} />
                        Возвращено
                      </span>
                    </div>
                  )}
                  <Chart
                    days={chartView.days}
                    metric={metric}
                    group={group}
                    quality={tab === 3}
                    type={tab === 3 ? "bar" : chartType}
                    height={215}
                  />
                  <div className="chart-bottom">
                    <span>Наведите на график, чтобы увидеть значения</span>
                    {tab === 0 && (
                      <button
                        className="text-button"
                        onClick={() =>
                          setChartType((v) => (v === "area" ? "bar" : "area"))
                        }
                      >
                        {chartType === "area" ? "Столбцы" : "Линия"}
                        <ArrowUpDown size={12} />
                      </button>
                    )}
                  </div>
                </Card>
                <Card className="gauge-card">
                  <div className="card-heading">
                    <h2>Процент выкупа</h2>
                    <span title="Выкуплено / заказано × 100%">
                      <Info size={15} />
                    </span>
                  </div>
                  <Gauge
                    value={buyout}
                    bought={total.bought}
                    orders={total.orders}
                  />
                  <p className="gauge-caption">
                    Доля товаров, которые не отменили
                    <br />и не вернули после заказа
                  </p>
                </Card>
                {tab === 0 ? (
                  <Card className="funnel-card">
                    <div className="card-heading">
                      <h2>Воронка за период</h2>
                      <button
                        className="icon-button"
                        aria-label="Подробнее о воронке"
                        onClick={() => setTab(2)}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </div>
                    <Funnel total={total} />
                  </Card>
                ) : (
                  <Insights view={view} />
                )}
              </div>
            )}
            {tab === 0 && (
              <div className="bottom-grid">
                <ProductTable
                  products={view.products}
                  compact
                  sort={sort}
                  onSort={onSort}
                  onProduct={setProductSku}
                  onAll={() => setTab(1)}
                />
                <Insights view={view} onQuality={() => setTab(3)} />
              </div>
            )}
            {tab === 1 && (
              <ProductTable
                products={view.products}
                sort={sort}
                onSort={onSort}
                onProduct={setProductSku}
              />
            )}
            {tab === 2 && (
              <div className="funnel-page">
                <Card>
                  <div className="card-heading">
                    <h2>От показа к заказу</h2>
                    <span className="chip">
                      {fmt(view.products.length)} SKU
                    </span>
                  </div>
                  <Funnel total={total} expanded />
                  <p className="method-note">
                    <Info size={16} />
                    Отношения рассчитаны из суммарных событий выбранного
                    периода. Это не путь уникального покупателя: заказ может
                    прийти из другого канала, поэтому отношения могут превышать
                    100%.
                  </p>
                </Card>
                <Card className="funnel-dynamics">
                  <div className="card-heading">
                    <h2>Динамика воронки</h2>
                    <select
                      aria-label="Этап воронки"
                      value={funnelMetric}
                      onChange={(e) => setFunnelMetric(e.target.value)}
                    >
                      <option value="impressions">Показы</option>
                      <option value="visits">Посещения</option>
                      <option value="cart">Корзина</option>
                      <option value="orders">Заказы</option>
                      <option value="amount">Сумма заказов</option>
                    </select>
                  </div>
                  <Chart days={view.days} metric={funnelMetric} height={345} />
                </Card>
              </div>
            )}
            {tab === 3 && (
              <ProductTable
                products={[...view.products].filter(
                  (p) => p.cancelled || p.returned,
                )}
                sort={qualitySort}
                onSort={(key) =>
                  setQualitySort((s) => ({
                    key,
                    dir: s.key === key && s.dir === "desc" ? "asc" : "desc",
                  }))
                }
                onProduct={setProductSku}
              />
            )}
          </>
        )}
        <footer>
          <button onClick={() => setInfo(true)}>
            <Info size={13} />
            {view.useSummary
              ? "Сводка по итоговой строке Excel"
              : "Расчёт по выбранным строкам Excel"}
            {report.discrepancies.length > 0
              ? " · есть расхождения с детализацией"
              : ""}
          </button>
          <span>{report.fileName}</span>
        </footer>
      </main>
      {periodOpen && (
        <Dialog title="Выберите период" onClose={() => setPeriodOpen(false)}>
          <p className="dialog-description">
            Данные доступны с {dateLabel(report.minDate)} по{" "}
            {dateLabel(report.maxDate, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            .
          </p>
          <div className="preset-grid">
            {[
              ["7", "7 дней"],
              ["30", "30 дней"],
              ["month", "Последний месяц"],
              ["all", "Весь период"],
            ].map(([key, label]) => (
              <button
                className="button"
                key={key}
                onClick={() => setDraftDates(rangePreset(report, key))}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="date-inputs">
            <label>
              Начало
              <input
                type="date"
                min={report.minDate}
                max={report.maxDate}
                value={draftDates.start}
                onChange={(e) =>
                  setDraftDates((d) => ({ ...d, start: e.target.value }))
                }
              />
            </label>
            <label>
              Конец
              <input
                type="date"
                min={report.minDate}
                max={report.maxDate}
                value={draftDates.end}
                onChange={(e) =>
                  setDraftDates((d) => ({ ...d, end: e.target.value }))
                }
              />
            </label>
          </div>
          <button
            className="button primary full-width"
            disabled={
              !draftDates.start ||
              !draftDates.end ||
              draftDates.start > draftDates.end ||
              draftDates.start < report.minDate ||
              draftDates.end > report.maxDate
            }
            onClick={() => {
              setFilters((f) => ({ ...f, ...draftDates }));
              setPeriodOpen(false);
            }}
          >
            Применить период <Check size={16} />
          </button>
        </Dialog>
      )}
      {selectedProduct && (
        <Dialog
          title="Карточка товара"
          wide
          onClose={() => setProductSku(null)}
        >
          <div className="product-detail-title">
            <span className="product-icon large">
              <Box size={28} />
            </span>
            <div>
              <h3>{selectedProduct.name}</h3>
              <p>
                SKU {selectedProduct.sku} · Артикул {selectedProduct.article}
              </p>
            </div>
            <span className={`abc abc-${selectedProduct.abc}`}>
              {selectedProduct.abc}
            </span>
          </div>
          <div className="detail-metrics">
            <div>
              <span>Сумма заказов</span>
              <strong>{money(selectedProduct.amount)}</strong>
            </div>
            <div>
              <span>Заказано</span>
              <strong>{fmt(selectedProduct.orders)} шт.</strong>
            </div>
            <div>
              <span>Выкуплено</span>
              <strong>{fmt(selectedProduct.bought)} шт.</strong>
            </div>
            <div>
              <span>Отменено / возвращено</span>
              <strong>
                {fmt(selectedProduct.cancelled)} /{" "}
                {fmt(selectedProduct.returned)}
              </strong>
            </div>
          </div>
          <h3 className="detail-chart-title">Сумма заказов по дням</h3>
          <Chart days={productDays} height={230} />
          <p className="fineprint">
            Период: {dateLabel(filters.start)} — {dateLabel(filters.end)}.
            Рейтинг на последнюю доступную дату:{" "}
            {selectedProduct.rating
              ? fmt(selectedProduct.rating, 1)
              : "нет данных"}
            . ABC — класс из отчёта, не пересчитывается при фильтрации.
          </p>
        </Dialog>
      )}
      {info && (
        <Dialog title="О данных и расчётах" wide onClose={() => setInfo(false)}>
          <div className="info-content">
            <div className="source-box">
              <FileSpreadsheet size={26} />
              <div>
                <strong>{report.fileName}</strong>
                <span>
                  {fmt(report.rows.length)} строк ·{" "}
                  {fmt(new Set(report.rows.map((r) => r.sku)).size)} SKU ·{" "}
                  {report.seller}
                </span>
              </div>
            </div>
            <h3>Откуда берутся цифры</h3>
            <p>
              За весь период без фильтров сводные показатели берутся из строки
              «Итого и среднее». После выбора дат, класса, схемы или поиска
              показатели рассчитываются по строкам товаров. Графики и таблицы
              всегда строятся по детализации.
            </p>
            {report.discrepancies.length > 0 && (
              <>
                <h3>Расхождения исходной выгрузки</h3>
                <div className="discrepancy-list">
                  {report.discrepancies.map((d) => (
                    <div key={d.key}>
                      <span>{labels[d.key] || d.key}</span>
                      <span>
                        Итог: <strong>{displayValue(d.key, d.summary)}</strong>
                      </span>
                      <span>
                        Строки: <strong>{displayValue(d.key, d.detail)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <h3>Как читать показатели</h3>
            <ul>
              <li>
                Сумма заказов включает отмены и возвраты. Это не чистая выручка
                и не прибыль.
              </li>
              <li>
                Средняя цена — сумма заказов, делённая на число заказанных
                товаров.
              </li>
              <li>
                Процент выкупа — выкупленные товары / заказанные товары. Доля
                отмен и возвратов считается от заказанных товаров.
              </li>
              <li>
                Остатки, рейтинги и отзывы нельзя складывать по дням. Здесь
                остатки не суммируются, а ABC берётся из исходного отчёта.
              </li>
              <li>
                FBO и FBS могут быть указаны вместе в одной строке. Фильтр «Есть
                FBO/FBS» выбирает такие строки и не разделяет их продажи между
                схемами.
              </li>
              <li>
                Сравнение графика — с предыдущим периодом той же длины, только
                если он целиком есть в выгрузке. Для последних дней возможны
                более поздние отмены и возвраты.
              </li>
            </ul>
            <h3>Ваши файлы остаются у вас</h3>
            <p>
              Excel обрабатывается в браузере и не отправляется на сервер.
              Загруженный файл действует до обновления страницы. После
              обновления открывается исходная выгрузка. CSV содержит только
              выбранные товары.
            </p>
          </div>
        </Dialog>
      )}
      {importing && (
        <div className="import-overlay" role="status">
          <div>
            <div className="loader" />
            <h2>Разбираем Excel</h2>
            <p>Обработка на вашем устройстве · {progress}%</p>
            <div className="import-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <button
              className="text-button"
              onClick={() => {
                workerRef.current?.terminate();
                setImporting(false);
              }}
            >
              Отменить загрузку
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Info size={18} />
          <span>{toast}</span>
          <button
            className="bare-button"
            aria-label="Закрыть уведомление"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
export default App;
