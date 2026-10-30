import "./advertising.css";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowUpDown,
  Box,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import Select from "./Select.jsx";
import Dialog from "./Dialog.jsx";
import {
  adMetricLabels,
  adToolLabels,
  adTotals,
  adValue,
  adView,
  groupAdCampaigns,
} from "../data/advertising.js";
import {
  fmt,
  money,
  percent,
  ratio,
  shortName,
  dateLabel,
} from "../data/report.js";

const tabOptions = [
  ["overview", "Сводка"],
  ["campaigns", "Кампании"],
  ["products", "Товары"],
  ["attention", "Зоны внимания"],
];
const format = (key, value) =>
  value == null
    ? "—"
    : key === "spend"
      ? money2(value)
      : key === "sales"
        ? money(value)
        : key === "drr"
          ? percent(value)
          : fmt(value);
const expenseFormat = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const money2 = (value) => `${expenseFormat.format(value || 0)} ₽`;
const Card = ({ children, className = "" }) => (
  <section className={`card ${className}`}>{children}</section>
);
const sortRows = (rows, sort) =>
  [...rows].sort((a, b) => {
    const av = adValue(a, sort.key),
      bv = adValue(b, sort.key);
    if (av == null) return bv == null ? 0 : 1;
    if (bv == null) return -1;
    return (av - bv) * (sort.dir === "asc" ? 1 : -1);
  });
function exportCSV(rows, filename) {
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
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AdTable({
  rows,
  kind = "products",
  compact = false,
  sort,
  onSort,
  onRow,
  onAll,
  renderPhoto,
}) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows, sort]);
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const limit = compact ? 5 : 12,
    maxPage = Math.max(0, Math.ceil(rows.length / limit) - 1),
    current = Math.min(page, maxPage),
    visible = sorted.slice(current * limit, (current + 1) * limit);
  const columns = [
    ["spend", "Расход, ₽"],
    ["sales", "Продажи, ₽"],
    ["drr", "ДРР"],
    ["units", "Продано, шт."],
    ["clicks", "Клики"],
  ];
  return (
    <Card className="ad-table-card">
      <div className="card-heading">
        <div>
          <h2>
            {kind === "campaigns"
              ? "Кампании и инструменты"
              : kind === "attention"
                ? "Товары без рекламных продаж"
                : "Товары · эффективность продвижения"}
          </h2>
          <p>
            {kind === "campaigns"
              ? "Названия кампаний в файле отсутствуют · используем ID"
              : "Сгруппировано по SKU · оплата за клик"}
          </p>
        </div>
        <div className="inline">
          <span className="chip">
            {rows.length} {kind === "campaigns" ? "групп" : "SKU"}
          </span>
          {compact && (
            <button className="text-button" onClick={onAll}>
              Все товары <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </div>
      {!rows.length ? (
        <div className="empty">
          <Box size={25} />
          <h3>Нет данных в выбранной группе</h3>
          <p>Измените фильтры или поисковый запрос.</p>
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    {kind === "campaigns" ? "Кампания / инструмент" : "Товар"}
                  </th>
                  {columns.map(([key, label]) => (
                    <th
                      key={key}
                      aria-sort={
                        sort.key === key
                          ? sort.dir === "desc"
                            ? "descending"
                            : "ascending"
                          : "none"
                      }
                    >
                      <button
                        onClick={() => onSort(key)}
                        className={sort.key === key ? "sorted" : ""}
                      >
                        {label}
                        <ArrowUpDown size={12} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={kind === "campaigns" ? row.key : row.sku}>
                    <td>
                      <button
                        className="product-button"
                        onClick={() => onRow(row)}
                      >
                        {kind !== "campaigns" &&
                          (renderPhoto ? (
                            renderPhoto(row.sku)
                          ) : (
                            <span className="product-icon">
                              <Box size={20} />
                            </span>
                          ))}
                        <span>
                          <span className="product-name">
                            {kind === "campaigns"
                              ? row.name
                              : shortName(row.name)}
                          </span>
                          <small>
                            {kind === "campaigns"
                              ? row.id === "0"
                                ? "Агрегат без разбивки по SKU"
                                : adToolLabels[row.toolKey]
                              : `SKU ${row.sku}`}
                          </small>
                        </span>
                      </button>
                    </td>
                    {columns.map(([key]) => (
                      <td
                        key={key}
                        className={sort.key === key ? "ad-number" : ""}
                      >
                        {format(key, adValue(row, key))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!compact && (
            <div className="pagination">
              <span>
                {current * limit + 1}–
                {Math.min((current + 1) * limit, rows.length)} из {rows.length}
              </span>
              <div className="inline">
                <button
                  className="icon-button"
                  aria-label="Предыдущая страница"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <span>
                  {current + 1} / {maxPage + 1}
                </span>
                <button
                  className="icon-button"
                  aria-label="Следующая страница"
                  disabled={current === maxPage}
                  onClick={() => setPage(current + 1)}
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
export function AdvertisingMethod({ report }) {
  return (
    <div className="info-content">
      {report && (
        <div className="source-box">
          <Info size={25} />
          <div>
            <strong>{report.fileName}</strong>
            <span>
              {dateLabel(report.start)} —{" "}
              {dateLabel(report.end, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              · {report.rows.length} строк
            </span>
          </div>
        </div>
      )}
      <h3>Период рекламного отчёта</h3>
      <p>
        Выбранный период общий для всех разделов. Этот файл содержит только итог
        за весь период, без дат в строках. Его показатели доступны только при
        точном совпадении выбранных дат с периодом файла. Для просмотра
        отдельных дней нужна рекламная выгрузка с дневной детализацией.
      </p>
      <h3>Показатели</h3>
      <ul>
        <li>
          Расходы и продажи суммируются по строкам Statistics. ДРР — расход /
          продажи в продвижении × 100%, ROAS — продажи / расход. Проценты строк
          не усредняются.
        </li>
        <li>
          Продано товаров — единицы товара, а не количество отдельных заказов.
        </li>
        <li>
          Средний CPC и CTR рассчитываются только по строкам «Оплата за клик»:
          расход / клики и клики / показы.
        </li>
        <li>
          ROAS не является прибылью: здесь нет себестоимости, комиссий и
          логистики.
        </li>
      </ul>
      <h3>Объединённые карточки</h3>
      <p>
        Продажи модели из Statistics показаны отдельно от основных продаж. Union
        — детализация этих же продаж, она не прибавляется повторно. Поиск товара
        и фильтр кампании применяются к рекламируемому SKU, а не к SKU, который
        был куплен из объединённой карточки.
      </p>
      {report?.discrepancies.length > 0 && (
        <p>
          Есть расхождения между Statistics и Union:{" "}
          {report.discrepancies
            .map(
              (d) =>
                `${d.key === "sales" ? "продажи" : "товары"}: Statistics ${fmt(d.statistics, 2)}, Union ${fmt(d.union, 2)}`,
            )
            .join("; ")}
          . Сводные показатели берутся из Statistics.
        </p>
      )}
      <h3>Ограничения детализации</h3>
      <p>
        Строка «Оплата за заказ: все товары» с SKU 0 — общий итог инструмента.
        Он включён в рекламную сводку, но не распределяется между товарами и
        исключается при поиске конкретного SKU. Зоны внимания относятся только к
        зафиксированным продажам по оплате за клик; они не доказывают отсутствие
        органических продаж или продаж в других инструментах.
      </p>
      <p>
        Файлы обрабатываются локально. Загруженный отчёт действует до обновления
        страницы; затем восстанавливается встроенный. Отчёты продаж и рекламы
        хранятся раздельно.
      </p>
    </div>
  );
}
function ProductDetail({ product, report, onClose, renderPhoto }) {
  const union = report.union.filter(
    (r) =>
      r.sourceSku === product.sku &&
      product.detail.some(
        (p) => p.campaign === r.campaign && p.tool === r.tool,
      ),
  );
  const cpc = adTotals(product.detail.filter((r) => r.toolKey === "cpc"));
  return (
    <Dialog title="Реклама товара" wide onClose={onClose}>
      <div className="product-detail-title">
        {renderPhoto ? (
          renderPhoto(product.sku, true)
        ) : (
          <span className="product-icon large">
            <Box size={27} />
          </span>
        )}
        <div>
          <h3>{product.name}</h3>
          <p>SKU {product.sku}</p>
        </div>
      </div>
      <div className="detail-metrics">
        <div>
          <span>Расход</span>
          <strong>{money2(product.spend)}</strong>
        </div>
        <div>
          <span>Продажи в продвижении</span>
          <strong>{money(product.sales)}</strong>
        </div>
        <div>
          <span>ДРР</span>
          <strong>{format("drr", adValue(product, "drr"))}</strong>
        </div>
        <div>
          <span>Продано товаров</span>
          <strong>{fmt(product.units)} шт.</strong>
        </div>
      </div>
      <div className="ad-product-secondary">
        <span>
          Клики <strong>{fmt(cpc.clicks)}</strong>
        </span>
        <span>
          Средний CPC{" "}
          <strong>{cpc.clicks ? money2(cpc.spend / cpc.clicks) : "—"}</strong>
        </span>
        <span>
          CTR{" "}
          <strong>
            {cpc.impressions
              ? percent(ratio(cpc.clicks, cpc.impressions))
              : "—"}
          </strong>
        </span>
      </div>
      <h3 className="detail-chart-title">
        Продажи объединённых карточек · отдельно
      </h3>
      <p className="ad-model-total">
        {money(product.modelSales)} · {fmt(product.modelUnits)} шт.
      </p>
      {union.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Купленный товар</th>
                <th>Продажи, ₽</th>
                <th>Товары, шт.</th>
              </tr>
            </thead>
            <tbody>
              {union.map((r, i) => (
                <tr key={i}>
                  <td>
                    {shortName(r.name)}
                    <small className="ad-sku">SKU {r.sku}</small>
                  </td>
                  <td>{money(r.sales)}</td>
                  <td>{fmt(r.units)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="fineprint">
        Показатели за период рекламного отчёта с текущими фильтрами. Продажи
        Union не прибавляются к Statistics повторно.
      </p>
    </Dialog>
  );
}

export default function Advertising({
  report,
  range,
  loading,
  error,
  onInfo,
  onUpload,
  onReportPeriod,
  renderPhoto,
}) {
  const [tab, setTab] = useState("overview"),
    [tool, setTool] = useState("all"),
    [campaign, setCampaign] = useState("all"),
    [query, setQuery] = useState(""),
    [metric, setMetric] = useState("spend"),
    [sort, setSort] = useState({ key: "spend", dir: "desc" }),
    [sku, setSku] = useState(null);
  const deferredQuery = useDeferredValue(query);
  useEffect(() => setSku(null), [range?.start, range?.end]);
  useEffect(() => {
    setTool("all");
    setCampaign("all");
    setQuery("");
    setSku(null);
  }, [report]);
  const view = useMemo(
    () =>
      report
        ? adView(report, { tool, campaign, query: deferredQuery, ...range })
        : null,
    [report, tool, campaign, deferredQuery, range?.start, range?.end],
  );
  const allCampaigns = useMemo(
    () =>
      report
        ? groupAdCampaigns(
            report.rows.filter((r) => tool === "all" || r.toolKey === tool),
          )
        : [],
    [report, tool],
  );
  const products = view?.products || [],
    selected = products.find((p) => p.sku === sku);
  if (loading && !report)
    return (
      <Card>
        <div className="empty">
          <div className="loader" />
          <p>Читаем рекламный отчёт…</p>
        </div>
      </Card>
    );
  if (!report)
    return (
      <Card>
        <div className="empty">
          <Info size={28} />
          <h3>Нужен рекламный отчёт</h3>
          <p>
            {error || "Загрузите аналитику продвижения Ozon в формате Excel."}
          </p>
          <button className="button" onClick={onUpload}>
            Загрузить Excel
          </button>
        </div>
      </Card>
    );
  if (!view.period.available)
    return (
      <Card className="ad-period-unavailable">
        <div className="empty">
          <Info size={28} />
          <h2>
            {view.period.reason === "outside"
              ? "За выбранный период нет рекламных данных"
              : "В файле нет разбивки по дням"}
          </h2>
          <p>
            Выбрано:{" "}
            {dateLabel(view.period.start, { day: "2-digit", month: "2-digit" })}{" "}
            —{" "}
            {dateLabel(view.period.end, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
            .
          </p>
          <p className="ad-source-period">
            Выгрузка рекламы:{" "}
            {dateLabel(report.start, { day: "2-digit", month: "2-digit" })} —{" "}
            {dateLabel(report.end, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
            .
          </p>
          <p>
            В этом Excel есть только общий итог. Для выбранных дат нужен отчёт
            за тот же период, а для просмотра по дням — выгрузка с дневной
            детализацией.
          </p>
          <div className="ad-period-actions">
            <button
              className="button primary"
              onClick={() =>
                onReportPeriod({ start: report.start, end: report.end })
              }
            >
              Показать весь рекламный отчёт
            </button>
            <button className="button" onClick={onUpload}>
              Загрузить Excel
            </button>
          </div>
          <p className="fineprint">
            Выбранные даты будут одинаковыми во всех разделах.
          </p>
        </div>
      </Card>
    );
  const total = view.total,
    cpc = view.cpc,
    rows =
      tab === "campaigns"
        ? view.campaigns
        : tab === "attention"
          ? view.zero
          : products;
  const onSort = (key) =>
    setSort((s) => ({
      key,
      dir: s.key === key && s.dir === "desc" ? "asc" : "desc",
    }));
  function selectMetric(key) {
    setMetric(key);
    setSort({ key, dir: "desc" });
  }
  function drillCampaign(row) {
    setCampaign(row.id);
    setTab("campaigns");
  }
  function reset() {
    setTool("all");
    setCampaign("all");
    setQuery("");
  }
  function exportCurrent() {
    const sorted = sortRows(rows, sort);
    exportCSV(
      [
        [
          "Название",
          "SKU / ID кампании",
          "Расход, ₽",
          "Продажи, ₽",
          "ДРР, %",
          "Продано, шт.",
          "Клики",
          "Продажи модели, ₽",
        ],
        ...sorted.map((r) => [
          r.name,
          tab === "campaigns" ? r.id : r.sku,
          r.spend,
          r.sales,
          adValue(r, "drr") ?? "",
          r.units,
          r.clicks,
          r.modelSales,
        ]),
      ],
      `formula_ads_${view.period.start}_${view.period.end}_${tab}.csv`,
    );
  }
  const sortedCampaigns = sortRows(view.campaigns, {
    key: metric,
    dir: "desc",
  });
  const budget = sortedCampaigns.slice(0, 4);
  if (sortedCampaigns.length > 4) {
    const rest = sortedCampaigns.slice(4);
    budget.push({ name: "Остальные кампании", id: null, ...adTotals(rest) });
  }
  const budgetMax = Math.max(1, ...budget.map((r) => adValue(r, metric) || 0));
  return (
    <div className="advertising">
      <div className="ad-toolbar">
        <nav className="ad-subnav" aria-label="Разделы рекламы">
          {tabOptions.map(([key, name]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              aria-pressed={tab === key}
              onClick={() => {
                setTab(key);
                setSku(null);
              }}
            >
              {name}
            </button>
          ))}
        </nav>
        <span className="ad-period-note ad-report-period">
          <Info size={13} />
          Выгрузка:{" "}
          {dateLabel(report.start, { day: "2-digit", month: "2-digit" })} —{" "}
          {dateLabel(report.end, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}{" "}
          · без дневной разбивки
        </span>
      </div>
      <div className="ad-filter-bar">
        <div className="ad-filter-selects">
          <Select
            label="Рекламный инструмент"
            value={tool}
            onChange={(value) => {
              setTool(value);
              setCampaign("all");
            }}
            options={[
              { value: "all", label: "Все инструменты" },
              ...Object.keys(adToolLabels)
                .filter((k) => report.rows.some((r) => r.toolKey === k))
                .map((k) => ({ value: k, label: adToolLabels[k] })),
            ]}
          />
          <Select
            label="Рекламная кампания"
            value={campaign}
            onChange={setCampaign}
            options={[
              { value: "all", label: "Все кампании" },
              ...allCampaigns.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          {(tool !== "all" || campaign !== "all" || query) && (
            <button className="text-button" onClick={reset}>
              <RotateCcw size={13} />
              Сбросить
            </button>
          )}
        </div>
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Поиск рекламных товаров"
            placeholder="Название или SKU"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="bare-button"
              aria-label="Очистить рекламный поиск"
              onClick={() => setQuery("")}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          className="text-button"
          onClick={exportCurrent}
          disabled={!rows.length}
        >
          <Download size={14} />
          Экспорт CSV
        </button>
      </div>
      <div className="ad-metrics">
        {Object.entries(adMetricLabels).map(([key, title]) => (
          <button
            key={key}
            type="button"
            className={`card ad-metric ${metric === key ? "accent" : ""}`}
            aria-label={title}
            aria-pressed={metric === key}
            onClick={() => selectMetric(key)}
          >
            <span>{title}</span>
            <strong>
              {format(key, adValue(total, key))}
              {key === "units" && <small> шт.</small>}
            </strong>
            <p>
              {key === "spend"
                ? "Все выбранные инструменты"
                : key === "sales"
                  ? "Без продаж объединённых карточек"
                  : key === "drr"
                    ? "Расход / продажи в продвижении"
                    : "По рекламируемым SKU"}
            </p>
          </button>
        ))}
      </div>
      {view.rows.length === 0 ? (
        <Card>
          <div className="empty">
            <Search size={26} />
            <h3>Нет данных по выбранным фильтрам</h3>
            <button className="button" onClick={reset}>
              Сбросить фильтры
            </button>
          </div>
        </Card>
      ) : tab === "overview" ? (
        <>
          <div className="ad-middle">
            <Card className="ad-budget">
              <div className="card-heading">
                <div>
                  <h2>
                    {metric === "spend"
                      ? "Куда уходит бюджет"
                      : metric === "sales"
                        ? "Продажи по кампаниям"
                        : metric === "units"
                          ? "Проданные товары по кампаниям"
                          : "ДРР по кампаниям"}
                  </h2>
                  <p>
                    {metric === "drr"
                      ? "Расход / продажи · без усреднения процентов"
                      : "Сравнение за выбранный период"}
                  </p>
                </div>
                <span className="chip">
                  {
                    view.campaigns.filter(
                      (c) => c.id !== "0" && c.toolKey === "cpc",
                    ).length
                  }{" "}
                  кампаний CPC
                </span>
              </div>
              {budget.map((c, i) => {
                const value = adValue(c, metric);
                const width =
                  metric === "drr"
                    ? ratio(value || 0, budgetMax)
                    : ratio(value || 0, adValue(total, metric));
                return (
                  <button
                    className="ad-budget-row"
                    key={c.id ?? "others"}
                    disabled={c.id == null}
                    onClick={() => drillCampaign(c)}
                  >
                    <span className="ad-budget-meta">
                      <span>{c.name}</span>
                      <strong>
                        {format(metric, value)}
                        {metric !== "drr" && <small> · {percent(width)}</small>}
                      </strong>
                    </span>
                    <span className="ad-track">
                      <span
                        style={{
                          width: `${Math.min(100, width)}%`,
                          background: i === 0 ? "#ff792f" : "#ffa475",
                        }}
                      />
                    </span>
                  </button>
                );
              })}
            </Card>
            <Card>
              <div className="card-heading">
                <h2>Рекламные инструменты</h2>
              </div>
              <div
                className="ad-donut"
                style={{
                  background: `conic-gradient(#ff792f 0 ${ratio(cpc.spend, total.spend)}%, #ffd5bd 0)`,
                }}
              >
                <div>
                  <strong>{percent(ratio(cpc.spend, total.spend))}</strong>
                  <span>оплата за клик</span>
                </div>
              </div>
              <div className="ad-tool-row">
                <i />
                За клик<strong>{money(cpc.spend)}</strong>
              </div>
              <div className="ad-tool-row">
                <i style={{ background: "#ffd5bd" }} />
                {report.rows.some((r) => r.toolKey === "other")
                  ? "Другие инструменты"
                  : "За заказ"}
                <strong>{money(total.spend - cpc.spend)}</strong>
              </div>
            </Card>
            <Card>
              <div className="card-heading">
                <h2>Отдача продвижения</h2>
                <button
                  className="icon-button"
                  aria-label="Как считаются рекламные показатели"
                  onClick={onInfo}
                >
                  <Info size={15} />
                </button>
              </div>
              <span className="ad-secondary-label">Продажи на 1 ₽ расхода</span>
              <div className="ad-roas">
                {total.spend ? fmt(total.sales / total.spend, 2) : "—"}{" "}
                <span>×</span>
              </div>
              <p className="fineprint">ROAS по рекламируемым товарам</p>
              <div className="ad-efficiency">
                <div>
                  <strong>
                    {cpc.clicks ? money2(cpc.spend / cpc.clicks) : "—"}
                  </strong>
                  <span>Средний CPC</span>
                </div>
                <div>
                  <strong>
                    {cpc.impressions
                      ? percent(ratio(cpc.clicks, cpc.impressions))
                      : "—"}
                  </strong>
                  <span>CTR</span>
                </div>
              </div>
              <p className="fineprint">
                CPC и CTR — по инструменту «Оплата за клик». ROAS не является
                прибылью.
              </p>
            </Card>
          </div>
          <div className="ad-bottom">
            <AdTable
              renderPhoto={renderPhoto}
              rows={products}
              compact
              sort={sort}
              onSort={onSort}
              onRow={(r) => setSku(r.sku)}
              onAll={() => setTab("products")}
            />
            <Card>
              <div className="card-heading">
                <h2>На что обратить внимание</h2>
                <button
                  className="icon-button"
                  aria-label="Открыть зоны внимания"
                  onClick={() => setTab("attention")}
                >
                  <ArrowUpRight size={16} />
                </button>
              </div>
              <span className="ad-attention-chip">
                <Info size={12} />
                Проверить эффективность
              </span>
              <div className="ad-zero-amount">{money2(view.zeroSpend)}</div>
              <p className="ad-description">
                Потрачено на{" "}
                <strong>
                  {view.zero.length} SKU без продаж по оплате за клик
                </strong>{" "}
                — с учётом объединённых карточек.
              </p>
              <p className="fineprint">
                Это список для анализа, а не автоматическая рекомендация
                отключить рекламу.
              </p>
              <div className="ad-model-row">
                <span>
                  Продажи объединённых карточек
                  <small>Отдельно от основных KPI</small>
                </span>
                <strong>+{money(total.modelSales)}</strong>
              </div>
            </Card>
          </div>
        </>
      ) : (
        <>
          {tab === "attention" && (
            <Card className="ad-attention-intro">
              <div className="card-heading">
                <h2>Расход без зафиксированных продаж</h2>
                <span className="chip">{view.zero.length} SKU</span>
              </div>
              <p>
                В инструменте «Оплата за клик» на эти товары потрачено{" "}
                <strong>{money2(view.zeroSpend)}</strong>. Нет зафиксированных
                продаж по рекламируемому SKU и через объединённые карточки.
                Перед решением об отключении стоит проверить ставки, карточку,
                наличие и срок атрибуции.
              </p>
            </Card>
          )}
          <AdTable
            renderPhoto={renderPhoto}
            rows={rows}
            kind={tab}
            sort={sort}
            onSort={onSort}
            onRow={tab === "campaigns" ? drillCampaign : (r) => setSku(r.sku)}
          />
        </>
      )}
      <footer>
        <button onClick={onInfo}>
          <Info size={13} />
          Продажи объединённых карточек показаны отдельно · оплата за заказ —
          агрегат без SKU
        </button>
        <span>{report.fileName}</span>
      </footer>
      {selected && (
        <ProductDetail
          renderPhoto={renderPhoto}
          product={selected}
          report={report}
          onClose={() => setSku(null)}
        />
      )}
    </div>
  );
}
