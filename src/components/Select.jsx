import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export default function Select({
  label,
  value,
  onChange,
  options,
  className = "",
}) {
  const [open, setOpen] = useState(false),
    [index, setIndex] = useState(0);
  const ref = useRef(null),
    id = useId();
  const selected = options.find((o) => o.value === value) || options[0];
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    if (open)
      ref.current
        ?.querySelector(`[data-index="${index}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [index, open]);
  function toggle() {
    setIndex(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen((v) => !v);
  }
  function choose(option) {
    onChange(option.value);
    setOpen(false);
    ref.current?.querySelector('[role="combobox"]')?.focus();
  }
  function keydown(e) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setIndex(
          Math.max(
            0,
            options.findIndex((o) => o.value === value),
          ),
        );
        setOpen(true);
      } else
        setIndex(
          (i) =>
            (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) %
            options.length,
        );
      return;
    }
    if (e.key === "Home" && open) {
      e.preventDefault();
      setIndex(0);
    }
    if (e.key === "End" && open) {
      e.preventDefault();
      setIndex(options.length - 1);
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) choose(options[index]);
      else toggle();
    }
  }
  return (
    <div
      className={`ui-select ${open ? "is-open" : ""} ${className}`}
      ref={ref}
    >
      <button
        type="button"
        className="ui-select-trigger"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-${index}` : undefined}
        onClick={toggle}
        onKeyDown={keydown}
      >
        <span>{selected.label}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div
          id={id}
          role="listbox"
          aria-label={label}
          className="ui-select-menu"
        >
          {options.map((option, i) => (
            <button
              type="button"
              role="option"
              id={`${id}-${i}`}
              aria-selected={option.value === value}
              key={option.value}
              data-index={i}
              tabIndex={-1}
              className={`${option.value === value ? "chosen" : ""} ${i === index ? "highlighted" : ""}`}
              onPointerMove={() => setIndex(i)}
              onClick={() => choose(option)}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
