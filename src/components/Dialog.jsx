import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export default function Dialog({ children, title, onClose, wide = false }) {
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
