import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from "lucide-react";
import { dateLabel, rangePreset } from "../data/report.js";
import {
  dayBefore,
  dayCountLabel,
  moscowToday,
  monthGrid,
  monthStart,
  rangeLength,
  shiftMonth,
} from "../data/calendar.js";

const fullDate = (value) =>
  dateLabel(value, { day: "numeric", month: "long", year: "numeric" });
const shortDate = (value) =>
  dateLabel(value, { day: "numeric", month: "long" });
const monthName = (value) => dateLabel(value, { month: "long" });
export default function DateRangePicker({
  report,
  value,
  onApply,
  onClose,
  hint,
}) {
  const [draft, setDraft] = useState(() => ({ ...value })),
    [anchor, setAnchor] = useState(null),
    [hover, setHover] = useState("");
  const lastMonth = monthStart(report.maxDate),
    firstMonth = monthStart(report.minDate);
  const [left, setLeft] = useState(() => {
    const before = shiftMonth(value.end, -1);
    return before < firstMonth ? firstMonth : before;
  });
  const [focused, setFocused] = useState(value.start);
  const ref = useRef(),
    today = moscowToday(),
    yesterday = dayBefore(today);
  const [activePreset, setActivePreset] = useState(() => {
    if (value.start === report.minDate && value.end === report.maxDate)
      return "all";
    return (
      ["7", "14", "28", "90", "today", "yesterday"].find((key) => {
        const range =
          key === "today" || key === "yesterday"
            ? {
                start: key === "today" ? today : yesterday,
                end: key === "today" ? today : yesterday,
              }
            : rangePreset(report, key);
        return range.start === value.start && range.end === value.end;
      }) || ""
    );
  });
  const validDate = (d) => d >= report.minDate && d <= report.maxDate;
  const validRange =
    draft.start &&
    draft.end &&
    draft.start <= draft.end &&
    validDate(draft.start) &&
    validDate(draft.end);
  const canPrev = left > firstMonth,
    canNext = shiftMonth(left, 1) < lastMonth;
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  function closeBackdrop(e) {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      onClose();
  }
  function chooseDate(date) {
    if (!validDate(date)) return;
    setFocused(date);
    setActivePreset("");
    setHover("");
    if (!anchor) {
      setAnchor(date);
      setDraft({ start: date, end: "" });
    } else {
      const [start, end] = [anchor, date].sort();
      setDraft({ start, end });
      setAnchor(null);
    }
  }
  function preset(key) {
    let range;
    if (key === "today" || key === "yesterday") {
      const d = key === "today" ? today : yesterday;
      if (!validDate(d)) return;
      range = { start: d, end: d };
    } else range = rangePreset(report, key);
    setDraft(range);
    setActivePreset(key);
    setAnchor(null);
    setHover("");
    setFocused(range.start);
    const before = shiftMonth(range.end, -1);
    setLeft(before < firstMonth ? firstMonth : before);
  }
  function isPreset(key) {
    return !anchor && activePreset === key;
  }
  function moveFocus(e, date) {
    let next;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      const d = new Date(date + "T00:00:00Z");
      d.setUTCDate(
        d.getUTCDate() +
          { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key],
      );
      next = d.toISOString().slice(0, 10);
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      const month = shiftMonth(date, e.key === "PageUp" ? -1 : 1);
      const maxDay = new Date(
        Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
      ).getUTCDate();
      next =
        month.slice(0, 8) +
        String(Math.min(Number(date.slice(8)), maxDay)).padStart(2, "0");
    } else return;
    e.preventDefault();
    if (!validDate(next)) return;
    setFocused(next);
    if (monthStart(next) < left) setLeft(monthStart(next));
    else if (monthStart(next) > shiftMonth(left, 1))
      setLeft(shiftMonth(next, -1));
    requestAnimationFrame(() =>
      ref.current?.querySelector(`[data-calendar-date="${next}"]`)?.focus(),
    );
  }
  const months = [left, shiftMonth(left, 1)];
  const focusable =
    validDate(focused) &&
    monthStart(focused) >= left &&
    monthStart(focused) <= months[1]
      ? focused
      : left < report.minDate
        ? report.minDate
        : left;
  const preview =
    anchor && hover ? [anchor, hover].sort() : [draft.start, draft.end];
  const listButton = (key, label, disabled = false) => (
    <button
      key={key}
      type="button"
      disabled={disabled}
      aria-pressed={isPreset(key)}
      className={isPreset(key) ? "active" : ""}
      onClick={() => preset(key)}
      title={disabled ? "За этот день нет данных в отчёте" : undefined}
    >
      {label}
    </button>
  );
  return (
    <dialog
      ref={ref}
      className="dialog range-dialog"
      aria-labelledby="range-title"
      onCancel={onClose}
      onClick={closeBackdrop}
    >
      <div className="range-heading">
        <div>
          <h2 id="range-title">Выберите период</h2>
          <p>
            {hint || (
              <>
                Данные доступны с {shortDate(report.minDate)} по{" "}
                {fullDate(report.maxDate)}
              </>
            )}
          </p>
        </div>
        <button className="icon-button" aria-label="Закрыть" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="range-body">
        <div className="range-calendars" onPointerLeave={() => setHover("")}>
          {months.map((month, i) => (
            <section
              className="range-month"
              key={month}
              aria-label={dateLabel(month, { month: "long", year: "numeric" })}
            >
              <header className="range-month-header">
                <button
                  className={`range-nav ${i === 0 ? "" : "range-nav-spacer"}`}
                  type="button"
                  disabled={!canPrev || i !== 0}
                  aria-label="Предыдущий месяц"
                  onClick={() => setLeft(shiftMonth(left, -1))}
                >
                  <ChevronLeft size={17} />
                </button>
                <h3>
                  {monthName(month)} <span>{month.slice(0, 4)}</span>
                </h3>
                <button
                  className={`range-nav ${i === 1 ? "" : "range-nav-spacer"}`}
                  type="button"
                  disabled={!canNext || i !== 1}
                  aria-label="Следующий месяц"
                  onClick={() => setLeft(shiftMonth(left, 1))}
                >
                  <ChevronRight size={17} />
                </button>
              </header>
              <div className="range-weekdays" aria-hidden="true">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div
                className="range-days"
                role="group"
                aria-label={`Дни: ${dateLabel(month, { month: "long", year: "numeric" })}`}
              >
                {monthGrid(month).map((day) => {
                  const valid = day.inMonth && validDate(day.date);
                  const inRange =
                    valid &&
                    preview[1] &&
                    day.date >= preview[0] &&
                    day.date <= preview[1];
                  const start = valid && day.date === preview[0],
                    end = valid && day.date === preview[1];
                  return (
                    <div
                      key={day.date}
                      className={`range-day ${!day.inMonth ? "other" : ""} ${day.weekend ? "weekend" : ""} ${inRange ? "in-range" : ""} ${start ? "range-start" : ""} ${end ? "range-end" : ""}`}
                    >
                      <button
                        type="button"
                        disabled={!valid}
                        data-calendar-date={day.inMonth ? day.date : undefined}
                        aria-label={fullDate(day.date)}
                        aria-pressed={!!inRange || !!start}
                        tabIndex={valid && focusable === day.date ? 0 : -1}
                        onClick={() => chooseDate(day.date)}
                        onPointerEnter={() =>
                          anchor && valid && setHover(day.date)
                        }
                        onFocus={() => setFocused(day.date)}
                        onKeyDown={(e) => moveFocus(e, day.date)}
                      >
                        {day.day}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <aside className="range-sidebar">
          <h3>Быстрый переход</h3>
          <div className="range-shortcuts">
            {listButton("yesterday", "Вчера", !validDate(yesterday))}
            {listButton("today", "Сегодня", !validDate(today))}
          </div>
          <div className="range-divider" />
          <h3>За последние</h3>
          <div className="range-presets">
            {[
              ["7", "7 дней"],
              ["14", "14 дней"],
              ["28", "28 дней"],
              ["90", "90 дней"],
            ].map(([key, label]) => listButton(key, label))}
          </div>
          <div className="range-shortcuts">
            {listButton("all", "Весь период")}
          </div>
          <div className="range-summary-side">
            <span>Выбранный диапазон</span>
            <strong>
              {draft.end
                ? `${shortDate(draft.start)} — ${shortDate(draft.end)}`
                : "Выберите конец периода"}
            </strong>
            <p>
              <Clock3 size={12} />
              МСК · UTC+3
            </p>
            <small>Быстрые интервалы — по {shortDate(report.maxDate)}</small>
          </div>
        </aside>
      </div>
      <footer className="range-footer">
        <div className="range-selection" aria-live="polite">
          <CalendarDays size={18} />
          <span>
            {draft.end
              ? `${shortDate(draft.start)} — ${shortDate(draft.end)}`
              : `${shortDate(draft.start)} — выберите конец`}
          </span>
          {draft.end && (
            <small>{dayCountLabel(rangeLength(draft.start, draft.end))}</small>
          )}
        </div>
        <div className="range-actions">
          <button className="range-cancel" onClick={onClose}>
            Отмена
          </button>
          <button
            className="button range-apply"
            disabled={!validRange || !!anchor}
            onClick={() => onApply(draft)}
          >
            Применить период <Check size={16} />
          </button>
        </div>
      </footer>
    </dialog>
  );
}
