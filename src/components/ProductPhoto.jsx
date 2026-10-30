import { useEffect, useMemo, useState } from "react";
import { Image } from "lucide-react";
import { readCatalogPhoto } from "../data/catalog-storage.js";

export function photoCandidates(row, settings = {}) {
  const preferred = settings.photoOfferId;
  return [...row.offers]
    .sort((a, b) =>
      a.id === preferred
        ? -1
        : b.id === preferred
          ? 1
          : a.deleted - b.deleted ||
            (a.marketplace === "ozon" ? 0 : 1) -
              (b.marketplace === "ozon" ? 0 : 1),
    )
    .filter((o) =>
      settings.photoSource === "ozon" || settings.photoSource === "wb"
        ? o.marketplace === settings.photoSource
        : true,
    )
    .flatMap((o) => o.photos || []);
}
export default function ProductPhoto({
  row,
  settings = {},
  revision = 0,
  className = "",
  previewBlob,
  sourceOverride,
  decorative = false,
}) {
  const [blob, setBlob] = useState(null),
    [blobUrl, setBlobUrl] = useState(""),
    [failed, setFailed] = useState([]);
  const source = sourceOverride || settings.photoSource || "auto";
  useEffect(() => {
    let active = true;
    setBlob(null);
    if (previewBlob !== undefined) setBlob(previewBlob);
    else if (row)
      readCatalogPhoto(row.id).then((next) => {
        if (active) setBlob(next);
      });
    return () => {
      active = false;
    };
  }, [row?.id, revision, previewBlob]);
  useEffect(() => {
    if (!blob) {
      setBlobUrl("");
      return;
    }
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  const urls = useMemo(
    () =>
      row && source !== "manual"
        ? photoCandidates(row, { ...settings, photoSource: source })
        : [],
    [row, settings.photoOfferId, source],
  );
  useEffect(
    () => setFailed([]),
    [row?.id, revision, source, settings.photoOfferId],
  );
  const url =
    blobUrl && ["manual", "auto"].includes(source) && !failed.includes(blobUrl)
      ? blobUrl
      : urls.find((u) => !failed.includes(u));
  return (
    <span
      className={`product-photo ${className}`}
      data-photo-ratio="3:4"
      aria-hidden={decorative || undefined}
    >
      {url ? (
        <img
          src={url}
          alt={decorative ? "" : row?.name || "Фотография товара"}
          loading="lazy"
          onError={() => setFailed((list) => [...list, url])}
        />
      ) : (
        <>
          <Image aria-hidden="true" size={25} />
          <span className="photo-empty-label">Фото ещё не загружено</span>
        </>
      )}
    </span>
  );
}
