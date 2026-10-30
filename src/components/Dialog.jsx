import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
export default function Dialog({
  children,
  title,
  onClose,
  wide = false,
  className = "",
  heading,
  closeLabel = "Закрыть",
}) {
  const ref = useRef();
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el.showModal();
    return () => {
      el.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""} ${className}`}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          onClose();
      }}
    >
      <div className="dialog-top">
        {heading ? heading(titleId) : <h2 id={titleId}>{title}</h2>}
        <button
          className="icon-button"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
