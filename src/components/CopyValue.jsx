import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyValue({ value, label, highlightEnd = false }) {
  const [copied, setCopied] = useState(false),
    [failed, setFailed] = useState(false);
  const ref = useRef(),
    timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(String(value));
        ok = true;
      }
    } catch {
      /* Try the selection fallback. */
    }
    if (!ok) {
      const field = document.createElement("textarea");
      field.value = String(value);
      field.readOnly = true;
      field.style.position = "fixed";
      field.style.opacity = "0";
      (ref.current.closest("dialog") || document.body).append(field);
      field.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        /* Selection remains available below. */
      }
      field.remove();
      ref.current.focus();
    }
    clearTimeout(timer.current);
    setCopied(ok);
    setFailed(!ok);
    if (!ok) {
      const range = document.createRange();
      range.selectNodeContents(ref.current.querySelector(".copy-value"));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    timer.current = setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, 2500);
  }
  const text = String(value);
  return (
    <button
      type="button"
      ref={ref}
      className={`copy-id ${copied ? "copied" : ""}`}
      onClick={copy}
      aria-label={`Скопировать ${label}: ${text}`}
      title="Нажмите, чтобы скопировать"
    >
      <span className="copy-value">
        {highlightEnd && text.endsWith("/") ? (
          <>
            {text.slice(0, -1)}
            <mark className="article-mark">/</mark>
          </>
        ) : (
          text
        )}
      </span>
      {copied ? <Check size={17} /> : <Copy size={17} />}
      {(copied || failed) && (
        <span className="copy-feedback" role="status">
          {copied ? "Скопировано" : "Выделено — Ctrl+C"}
        </span>
      )}
    </button>
  );
}
