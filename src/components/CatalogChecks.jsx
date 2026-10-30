import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Info, TriangleAlert } from "lucide-react";
import Dialog from "./Dialog.jsx";
import { OfferCard } from "./CatalogProduct.jsx";

export const checkName = (check) =>
  check.kind === "duplicate"
    ? "Повтор артикула"
    : check.kind === "article"
      ? "Артикулы отличаются"
      : "Удалена в WB";
export function checkCount(n) {
  return `${n} ${n % 100 >= 11 && n % 100 <= 14 ? "пунктов" : n % 10 === 1 ? "пункт" : n % 10 >= 2 && n % 10 <= 4 ? "пункта" : "пунктов"}`;
}
export function CheckMark({ check }) {
  const Icon = check.severity === "info" ? Info : TriangleAlert;
  return (
    <span className={`catalog-check-symbol ${check.severity}`}>
      <Icon size={14} />
    </span>
  );
}
export function CheckBadge({ check, onClick }) {
  return (
    <button
      type="button"
      className={`catalog-issue-label ${check.severity}`}
      onClick={onClick}
    >
      {check.severity === "info" ? (
        <Info size={12} />
      ) : (
        <TriangleAlert size={12} />
      )}{" "}
      {checkName(check)}
    </button>
  );
}

export function CatalogAlert({ checks, onOpen, onAll }) {
  const [open, setOpen] = useState(false),
    root = useRef(),
    popover = useRef(),
    button = useRef();
  const active = checks.filter((i) => !i.resolved);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!root.current?.contains(e.target)) setOpen(false);
    };
    const key = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = popover.current,
        r = button.current.getBoundingClientRect();
      el.style.left =
        Math.max(
          12,
          Math.min(innerWidth - el.offsetWidth - 12, r.right - el.offsetWidth),
        ) + "px";
      el.style.top =
        Math.max(
          12,
          Math.min(r.bottom + 12, innerHeight - el.offsetHeight - 12),
        ) + "px";
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, active.length]);
  return (
    <div className="catalog-alert" ref={root}>
      <button
        type="button"
        ref={button}
        className={`catalog-alert-trigger ${active.length ? "" : "clear"}`}
        aria-label={`Проверка каталога: ${checkCount(active.length)}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <TriangleAlert size={18} />
        {active.length > 0 && (
          <span className="catalog-alert-count">{active.length}</span>
        )}
      </button>
      {open && (
        <div
          className="catalog-alert-popover"
          ref={popover}
          role="region"
          aria-label="Проверки каталога"
        >
          <header>
            <strong>Проверка каталога</strong>
            <span>{checkCount(active.length)}</span>
          </header>
          <p>
            Связи: {active.filter((i) => i.severity === "review").length} ·
            статусы WB: {active.filter((i) => i.kind === "deleted").length}
          </p>
          <div className="catalog-alert-list">
            {active.map((i) => (
              <button
                type="button"
                key={i.id}
                onClick={() => {
                  setOpen(false);
                  onOpen(i.id);
                }}
              >
                <CheckMark check={i} />
                <span>
                  <strong>{i.name}</strong>
                  <small>{i.title}</small>
                  <em>{i.article}</em>
                </span>
                <ArrowUpRight size={12} />
              </button>
            ))}
            {!active.length && (
              <div className="catalog-no-checks">
                <Check size={22} />
                <span>Все пункты проверены</span>
              </div>
            )}
          </div>
          <footer>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAll("all");
              }}
            >
              Все проверки в товарах <ArrowUpRight size={12} />
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
export function CatalogSummary({ checks, onAll }) {
  const active = checks.filter((i) => !i.resolved);
  return (
    <section className="catalog-summary">
      <div className="catalog-summary-title">
        <span className="catalog-check-symbol review">
          {active.length ? <TriangleAlert size={18} /> : <Check size={18} />}
        </span>
        <div>
          <h2>Проверка товаров</h2>
          <p>
            {active.length
              ? `${checkCount(active.length)} ${active.length === 1 ? "требует" : "требуют"} внимания`
              : "Активных проверок нет"}
          </p>
        </div>
      </div>
      <div className="catalog-summary-groups">
        {[
          ["duplicate", "Повтор артикула"],
          ["article", "Написание артикула"],
          ["deleted", "Удалённые WB"],
        ].map(([kind, label]) => {
          const count = active.filter((i) => i.kind === kind).length;
          return (
            count > 0 && (
              <button type="button" key={kind} onClick={() => onAll(kind)}>
                {label}
                <small>{count}</small>
              </button>
            )
          );
        })}
      </div>
      <button
        type="button"
        className="text-button"
        onClick={() => onAll("all")}
      >
        Все проверки <ArrowUpRight size={13} />
      </button>
    </section>
  );
}

export function CatalogCheckDialog({
  check,
  catalog,
  onClose,
  onResolve,
  onReopen,
}) {
  const [decision, setDecision] = useState(""),
    [error, setError] = useState("");
  const offers = check.offerIds.map((id) => catalog.offers.get(id));
  const activeWb = offers.filter((o) => o.marketplace === "wb" && !o.deleted),
    hasOzon = offers.some((o) => o.marketplace === "ozon");
  const explanation =
    check.kind === "duplicate"
      ? "Один артикул продавца встречается у нескольких карточек. Проверьте модель и вариант перед созданием связи."
      : check.kind === "article"
        ? "Артикулы отличаются слешем в конце. Похожее название не подтверждает, что это один товар и вариант."
        : "В выгрузке WB стоит «Удалённый товар: Да». Это статус источника, а не ошибка загрузки. История продаж сохраняется.";
  const choices =
    check.kind === "deleted"
      ? []
      : [
          ...(check.kind === "duplicate" &&
          activeWb.length === 1 &&
          hasOzon &&
          offers.some((o) => o.deleted)
            ? [
                [
                  "active",
                  "Связать с действующей карточкой WB",
                  `WB ${activeWb[0].sku}. Удалённая карточка остаётся отдельно в истории.`,
                ],
              ]
            : []),
          [
            "together",
            "Это один товар — привязать все карточки",
            "Сохранить исходные SKU и артикулы площадок.",
          ],
          [
            "separate",
            "Это разные товары — оставить отдельно",
            "Не создавать связь по похожему названию или артикулу.",
          ],
        ];
  return (
    <Dialog
      className="catalog-check-dialog"
      title={check.title}
      closeLabel="Закрыть проверку"
      onClose={onClose}
    >
      <p className="catalog-check-product">{check.name}</p>
      <p className={`catalog-check-explanation ${check.severity}`}>
        <Info size={15} />
        {explanation}
      </p>
      <div className={`product-offer-grid ${offers.length > 2 ? "three" : ""}`}>
        {offers.map((o) => (
          <OfferCard
            key={o.id}
            offer={o}
            highlight={check.kind === "article"}
          />
        ))}
      </div>
      {check.resolved ? (
        <p className="catalog-checked-note">
          Этот пункт отмечен проверенным. Его можно вернуть в работу.
        </p>
      ) : (
        choices.length > 0 && (
          <fieldset className="catalog-check-choices">
            <legend>Как поступить с карточками?</legend>
            {choices.map(([value, label, hint]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="catalog-decision"
                  value={value}
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
              </label>
            ))}
          </fieldset>
        )
      )}
      {error && (
        <p role="alert" className="catalog-form-error">
          {error}
        </p>
      )}
      <div className="catalog-check-actions">
        <p>
          Решение сохраняется на этом устройстве. Исходные карточки площадок не
          удаляются.
        </p>
        <button type="button" className="button" onClick={onClose}>
          Закрыть
        </button>
        <button
          type="button"
          className="button primary"
          disabled={!check.resolved && choices.length > 0 && !decision}
          onClick={() => {
            try {
              check.resolved ? onReopen() : onResolve(decision || "reviewed");
              onClose();
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          {check.resolved
            ? "Вернуть в проверку"
            : choices.length
              ? "Сохранить решение"
              : "Отметить проверенным"}
        </button>
      </div>
    </Dialog>
  );
}
