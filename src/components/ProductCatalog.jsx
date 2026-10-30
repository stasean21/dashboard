import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Image,
  Info,
  Search,
  TriangleAlert,
  Link2,
  LayoutGrid,
  List,
} from "lucide-react";
import { rowsForMarket } from "../data/catalog.js";
import InfiniteList, { useInfiniteList } from "./InfiniteList.jsx";
import ProductPhoto from "./ProductPhoto.jsx";
import CopyValue from "./CopyValue.jsx";
import { CheckBadge, CheckMark, checkCount } from "./CatalogChecks.jsx";

function CatalogRowIdentity({ name, articles, icon, onOpen, children }) {
  return (
    <div className="catalog-product-cell">
      {icon}
      <div className="catalog-product-meta">
        <button type="button" className="catalog-row-product" onClick={onOpen}>
          <strong>{name}</strong>
        </button>
        <div className="catalog-row-articles">
          <span>Артикул{articles.length > 1 ? "ы" : ""}:</span>
          {articles.filter(Boolean).map((article) => (
            <CopyValue key={article} value={article} label="артикул продавца" />
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

export function CatalogTabs({ mode, onChange, count, analytics }) {
  return (
    <nav className="catalog-tabs" aria-label="Разделы товаров">
      {[
        ["catalog", "Каталог"],
        ["checks", "Требует внимания"],
        ...(analytics ? [["analytics", "Аналитика Ozon"]] : []),
      ].map(([key, name]) => (
        <button
          type="button"
          key={key}
          className={mode === key ? "active" : ""}
          onClick={() => onChange(key)}
        >
          {name}
          {key === "checks" && <small>{count}</small>}
        </button>
      ))}
    </nav>
  );
}
export default function ProductCatalog({
  catalog,
  checks,
  mode,
  filter,
  onFilter,
  marketplace,
  state,
  photoRevision,
  loading,
  error,
  onOpen,
  onCheck,
  onUpload,
  onChecks,
}) {
  const [query, setQuery] = useState(""),
    [layout, setLayout] = useState("cards");
  const active = checks.filter((i) => !i.resolved),
    done = checks.filter((i) => i.resolved),
    needle = query.trim().toLocaleLowerCase("ru");
  const rows = useMemo(
    () =>
      mode === "checks"
        ? (filter === "done" ? done : active).filter(
            (i) =>
              (filter === "all" ||
                filter === "done" ||
                (filter === "articles" && i.kind !== "deleted") ||
                i.kind === filter) &&
              (!needle ||
                [i.name, i.article, ...i.offerIds]
                  .join(" ")
                  .toLocaleLowerCase("ru")
                  .includes(needle)),
          )
        : rowsForMarket(catalog, marketplace).filter(
            (row) =>
              !needle ||
              [row.name, ...row.articles, ...row.offers.map((o) => o.sku)]
                .join(" ")
                .toLocaleLowerCase("ru")
                .includes(needle),
          ),
    [catalog, checks, mode, filter, marketplace, needle],
  );
  const { visible, more, load } = useInfiniteList(rows, 6);
  return (
    <div className="catalog-page">
      <div className="catalog-toolbar">
        <div className="catalog-source-counts">
          <span>Ozon · {catalog.sourceCounts.ozon} SKU</span>
          <span>WB · {catalog.sourceCounts.wb} SKU</span>
        </div>
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Поиск в каталоге"
            placeholder="Название, артикул или SKU"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="search-submit"
            onClick={() => document.activeElement?.blur()}
          >
            Найти
          </button>
        </label>
      </div>
      {mode === "checks" && (
        <div className="catalog-check-filters">
          {[
            ["all", "Все", active.length],
            [
              "articles",
              "Артикулы",
              active.filter((i) => i.kind !== "deleted").length,
            ],
            [
              "deleted",
              "Статусы WB",
              active.filter((i) => i.kind === "deleted").length,
            ],
            ["done", "Проверенные", done.length],
          ].map(([key, title, count]) => (
            <button
              type="button"
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => onFilter(key)}
            >
              {title}
              <small>{count}</small>
            </button>
          ))}
        </div>
      )}
      <p className="catalog-context">
        <Info size={14} />
        {mode === "checks"
          ? "Счётчик показывает пункты проверки. Один пункт может относиться к нескольким карточкам."
          : "Каталог показывает весь состав выгрузок, независимо от периода аналитики. Спорные группы требуют подтверждения."}
      </p>
      {loading && (
        <p className="catalog-context" role="status">
          Читаем каталог Wildberries…
        </p>
      )}
      {error && (
        <p className="catalog-load-error" role="status">
          {error}{" "}
          <button type="button" className="text-button" onClick={onUpload}>
            Загрузить Excel WB
          </button>
        </p>
      )}
      <div className={mode === "catalog" ? "catalog-layout-v2" : ""}>
        <section
          className={`card catalog-card ${mode === "catalog" ? "catalog-card-v2" : ""}`}
        >
          <div className="card-heading">
            <div>
              <h2>
                {mode === "checks" ? "Проверка каталога" : "Каталог товаров"}
              </h2>
              <p>
                {mode === "checks"
                  ? "Проверки связей и статусы карточек WB"
                  : "Общие карточки и предложения по сопоставлению"}
              </p>
            </div>
            {mode === "catalog" ? (
              <div className="catalog-view-switch" aria-label="Вид каталога">
                {[
                  ["cards", "Карточки", LayoutGrid],
                  ["list", "Список", List],
                ].map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    className={layout === key ? "active" : ""}
                    aria-pressed={layout === key}
                    onClick={() => setLayout(key)}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="catalog-checked-count">
                Проверено: {done.length}
              </span>
            )}
          </div>
          {!rows.length ? (
            <div className="empty">
              <h3>
                {query
                  ? "Товары не найдены"
                  : mode === "checks"
                    ? "Пунктов для проверки нет"
                    : "В каталоге этой площадки пока нет карточек"}
              </h3>
              <p>
                {query
                  ? "Измените поиск."
                  : "Выберите другой фильтр или загрузите отчёт площадки."}
              </p>
            </div>
          ) : mode === "catalog" && layout === "cards" ? (
            <div className="catalog-product-grid">
              {visible.map((row) => {
                const pending = row.checks.filter(
                  (i) => !i.resolved && checks.some((c) => c.id === i.id),
                );
                return (
                  <article className="catalog-product-card" key={row.id}>
                    <div className="catalog-card-main">
                      <ProductPhoto
                        row={row}
                        settings={state.cards[row.id]}
                        revision={photoRevision}
                        className="catalog-portrait"
                        decorative
                      />
                      <div className="catalog-card-details">
                        <CatalogRowIdentity
                          name={row.name}
                          articles={row.articles}
                          onOpen={() => onOpen(row.id)}
                        />
                        {["ozon", "wb"].map((market) => (
                          <div className="catalog-offer-line" key={market}>
                            <span className={`market-badge ${market}`}>
                              {market === "ozon" ? "Ozon" : "WB"}
                            </span>
                            <div>
                              {row.offers
                                .filter((o) => o.marketplace === market)
                                .map((o) => (
                                  <span
                                    key={o.id}
                                    className={o.deleted ? "deleted" : ""}
                                  >
                                    <CopyValue
                                      value={o.sku}
                                      label={
                                        market === "ozon"
                                          ? "SKU Ozon"
                                          : "артикул WB"
                                      }
                                    />
                                  </span>
                                ))}
                              {!row.offers.some(
                                (o) => o.marketplace === market,
                              ) && <span>Нет пары</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="catalog-card-foot">
                      <div>
                        {pending.map((i) => (
                          <CheckBadge
                            key={i.id}
                            check={i}
                            onClick={() => onCheck(i.id)}
                          />
                        ))}
                        {!pending.length && (
                          <span>
                            {row.status === "linked"
                              ? "Связано"
                              : row.status === "candidate"
                                ? "Связь ещё не подтверждена"
                                : "Нет точной пары"}
                          </span>
                        )}
                      </div>
                      <button
                        className="text-button"
                        onClick={() => onOpen(row.id)}
                      >
                        Открыть <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="table-scroll">
              <table
                className={`catalog-table ${mode === "checks" ? "catalog-check-table" : ""}`}
              >
                <colgroup>
                  {(mode === "checks"
                    ? [41, 26, 23, 10]
                    : [41, 14, 14, 21, 10]
                  ).map((width, i) => (
                    <col key={i} style={{ width: `${width}%` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {(mode === "checks"
                      ? ["Товар", "Что обнаружено", "Карточки", ""]
                      : [
                          "Товар",
                          "Ozon · SKU",
                          "WB · артикул",
                          "Что проверить",
                          "Фото",
                        ]
                    ).map((name, i) => (
                      <th key={i}>{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) =>
                    mode === "checks" ? (
                      <tr key={row.id}>
                        <td>
                          <CatalogRowIdentity
                            name={row.name}
                            articles={[
                              ...new Set(
                                row.offerIds.map(
                                  (id) => catalog.offers.get(id).article,
                                ),
                              ),
                            ]}
                            icon={<CheckMark check={row} />}
                            onOpen={() => onCheck(row.id)}
                          />
                        </td>
                        <td>
                          <p className="catalog-check-title">{row.title}</p>
                        </td>
                        <td>
                          <span className="catalog-sku-stack">
                            {row.offerIds.map((id) => {
                              const o = catalog.offers.get(id);
                              return (
                                <span key={id}>
                                  <span className="catalog-sku-market">
                                    {o.marketplace === "ozon" ? "Ozon" : "WB"}
                                  </span>
                                  <CopyValue
                                    value={o.sku}
                                    label={
                                      o.marketplace === "ozon"
                                        ? "SKU Ozon"
                                        : "артикул WB"
                                    }
                                  />
                                </span>
                              );
                            })}
                          </span>
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => onCheck(row.id)}
                          >
                            {row.resolved ? "Проверено" : "Проверить"}
                            <ArrowUpRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        const pending = row.checks.filter(
                          (i) =>
                            !i.resolved && checks.some((c) => c.id === i.id),
                        );
                        return (
                          <tr key={row.id}>
                            <td>
                              <CatalogRowIdentity
                                name={row.name}
                                articles={row.articles}
                                onOpen={() => onOpen(row.id)}
                                icon={
                                  <ProductPhoto
                                    row={row}
                                    settings={state.cards[row.id]}
                                    revision={photoRevision}
                                    decorative
                                  />
                                }
                              >
                                {pending.length > 0 && (
                                  <em className="catalog-mobile-status">
                                    {pending[0].kind === "duplicate"
                                      ? "Повтор артикула"
                                      : pending[0].kind === "article"
                                        ? "Артикулы отличаются"
                                        : "Удалена в WB"}
                                    {pending.length > 1
                                      ? ` · ещё ${pending.length - 1}`
                                      : ""}
                                  </em>
                                )}
                              </CatalogRowIdentity>
                            </td>
                            {["ozon", "wb"].map((market) => (
                              <td key={market}>
                                <span className="catalog-sku-stack">
                                  {row.offers
                                    .filter((o) => o.marketplace === market)
                                    .map((o) => (
                                      <span
                                        key={o.id}
                                        className={o.deleted ? "deleted" : ""}
                                      >
                                        <CopyValue
                                          value={o.sku}
                                          label={
                                            market === "ozon"
                                              ? "SKU Ozon"
                                              : "артикул WB"
                                          }
                                        />
                                      </span>
                                    ))}
                                  {!row.offers.some(
                                    (o) => o.marketplace === market,
                                  ) && (
                                    <span className="missing">Не найдена</span>
                                  )}
                                </span>
                              </td>
                            ))}
                            <td>
                              <div className="catalog-row-checks">
                                {pending.map((i) => (
                                  <CheckBadge
                                    key={i.id}
                                    check={i}
                                    onClick={() => onCheck(i.id)}
                                  />
                                ))}
                                {!pending.length &&
                                  (row.status === "linked" ? (
                                    <span className="catalog-linked">
                                      <Check size={12} />
                                      Связано
                                    </span>
                                  ) : row.checks.length ? (
                                    <span className="catalog-linked">
                                      Проверено
                                    </span>
                                  ) : (
                                    <span className="catalog-quiet">
                                      {row.status === "candidate"
                                        ? "Совпадает артикул · связь не подтверждена"
                                        : "Нет точной пары"}
                                    </span>
                                  ))}
                              </div>
                            </td>
                            <td>
                              <span className="catalog-quiet">
                                {state.cards[row.id]?.photoSource === "manual"
                                  ? "Ручное фото"
                                  : "Нет фото в Excel"}
                              </span>
                            </td>
                          </tr>
                        );
                      })()
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
          <InfiniteList
            shown={visible.length}
            total={rows.length}
            more={more}
            onLoad={load}
          />
        </section>
        {mode === "catalog" && (
          <aside className="catalog-sidebar">
            <section className="card dark-panel catalog-check-panel">
              <span className="dashboard-icon">
                <TriangleAlert size={20} />
              </span>
              <h2>Проверка сопоставлений</h2>
              <strong>
                {active.length}{" "}
                <small>
                  {checkCount(active.length).split(" ").slice(1).join(" ")}
                </small>
              </strong>
              <p>
                Решение принимается в карточке товара — перед подтверждением
                связи.
              </p>
              {[
                ["duplicate", "Повтор артикула"],
                ["article", "Артикулы отличаются"],
                ["deleted", "Удалена в WB"],
              ].map(([kind, label]) => (
                <button
                  className="catalog-check-line"
                  key={kind}
                  onClick={() => onChecks(kind)}
                >
                  <span>{label}</span>
                  <b>{active.filter((i) => i.kind === kind).length}</b>
                </button>
              ))}
              <button className="button" onClick={() => onChecks("all")}>
                Перейти к проверкам
              </button>
            </section>
            <section className="card catalog-side-info">
              <p>
                <Link2 size={18} />
                Предложения связей
              </p>
              <strong>
                {
                  rowsForMarket(catalog, marketplace).filter(
                    (r) => r.status === "candidate",
                  ).length
                }{" "}
                пар
              </strong>
              <p>
                Совпадение артикулов требует подтверждения. Решения сохраняются
                в карточке.
              </p>
            </section>
            <section className="card catalog-side-info">
              <p>
                <Image size={18} />
                Фото товара
              </p>
              <p>
                Формат 3:4. Если в Excel нет фото, его можно загрузить в
                карточке товара.
              </p>
            </section>
          </aside>
        )}
      </div>
      <p className="catalog-context catalog-photo-status">
        <Image size={13} />
        Отсутствие фотографий в этих Excel — обычный статус. В счётчик проверок
        оно не включено.
      </p>
    </div>
  );
}
