import { useEffect, useRef, useState } from "react";

export function useInfiniteList(items, batch = 12) {
  const [window, setWindow] = useState({ items, count: batch });
  // Reset before painting so a new filter never shows the previous list's depth.
  if (window.items !== items) setWindow({ items, count: batch });
  const count = window.items === items ? window.count : batch;
  return {
    visible: items.slice(0, count),
    more: count < items.length,
    load: () =>
      setWindow((current) => ({
        items,
        count: (current.items === items ? current.count : batch) + batch,
      })),
  };
}

export default function InfiniteList({ shown, total, more, onLoad }) {
  const sentinel = useRef();
  useEffect(() => {
    if (!more || !sentinel.current || !globalThis.IntersectionObserver) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoad();
      },
      { rootMargin: "180px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [more, onLoad]);
  return (
    <div className="infinite-list-status" ref={sentinel}>
      <span aria-live="polite">
        {more
          ? `Показано ${shown} из ${total}`
          : `Все товары показаны · ${total}`}
      </span>
      {more && (
        <button type="button" className="text-button" onClick={onLoad}>
          Показать ещё
        </button>
      )}
    </div>
  );
}
