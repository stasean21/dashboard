import { useEffect, useMemo, useRef, useState } from "react";
import { gunzipSync, strFromU8 } from "fflate";
import {
  buildCatalog,
  linkCatalogOffers,
  resolveCatalogCheck,
  reopenCatalogCheck,
  unlinkCatalogRow,
} from "./catalog.js";
import {
  readCatalogState,
  writeCatalogState,
  writeCatalogPhoto,
} from "./catalog-storage.js";

export default function useCatalog(ozon, notify) {
  const [state, setState] = useState(readCatalogState),
    stateRef = useRef(state);
  const [wb, setWb] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [photoRevision, setPhotoRevision] = useState(0),
    imported = useRef(false);
  useEffect(() => {
    let active = true;
    fetch("/data/catalog-wb.json.gz")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.arrayBuffer();
      })
      .then((buffer) => {
        const bytes = new Uint8Array(buffer);
        return JSON.parse(
          strFromU8(
            bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes,
          ),
        );
      })
      .then((report) => {
        if (
          report.kind !== "catalog" ||
          report.marketplace !== "wb" ||
          !Array.isArray(report.rows)
        )
          throw new Error();
        if (active && !imported.current) setWb(report);
      })
      .catch(() => {
        if (active && !imported.current)
          setError(
            "Каталог WB не загрузился. Можно загрузить воронку продаж WB в Excel.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const catalog = useMemo(
    () => buildCatalog(ozon, wb, state),
    [ozon, wb, state.links, state.reviews, state.separated],
  );
  function update(fn, message) {
    const next = fn(stateRef.current),
      durable = writeCatalogState(next);
    stateRef.current = next;
    setState(next);
    if (message)
      notify(
        durable
          ? message
          : `${message} Хранилище браузера недоступно: изменение действует до обновления страницы.`,
      );
    return durable;
  }
  return {
    state,
    catalog,
    wb,
    loading,
    error,
    photoRevision,
    applyWb(report) {
      imported.current = true;
      setWb(report);
      setLoading(false);
      setError("");
    },
    link(row, ids) {
      update(
        (current) => linkCatalogOffers(current, row, ids, catalog),
        "Карточки связаны с нашим товаром.",
      );
    },
    unlink(row) {
      update(
        (current) => unlinkCatalogRow(current, row),
        "Связь разъединена. Себестоимость и фото остались у основной карточки.",
      );
    },
    resolve(check, decision) {
      update(
        (current) => resolveCatalogCheck(current, check, decision, catalog),
        "Решение сохранено, список проверок обновлён.",
      );
    },
    reopen(check) {
      update(
        (current) => reopenCatalogCheck(current, check),
        "Пункт возвращён в список проверки.",
      );
    },
    async saveCard(row, settings, photo) {
      let durablePhoto = true;
      if (photo !== undefined) {
        durablePhoto = await writeCatalogPhoto(row.id, photo);
        setPhotoRevision((v) => v + 1);
      }
      const durable = update((current) => ({
        ...current,
        cards: {
          ...current.cards,
          [row.id]: { ...current.cards[row.id], ...settings },
        },
      }));
      notify(
        durable && durablePhoto
          ? "Карточка сохранена на этом устройстве."
          : "Карточка обновлена. Хранилище недоступно: часть изменений действует до обновления страницы.",
      );
    },
  };
}
