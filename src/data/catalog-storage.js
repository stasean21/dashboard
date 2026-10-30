import { emptyCatalogState } from "./catalog.js";
export const CATALOG_STORAGE_KEY = "formula.catalog.v1";
export function readCatalogState() {
  try {
    const value = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY));
    if (value?.version !== 1) return emptyCatalogState();
    return {
      ...emptyCatalogState(),
      links: Array.isArray(value.links)
        ? value.links.filter(
            (l) =>
              l &&
              typeof l.id === "string" &&
              Array.isArray(l.offerIds) &&
              l.offerIds.every((id) => typeof id === "string"),
          )
        : [],
      separated: Array.isArray(value.separated)
        ? value.separated.filter(
            (s) =>
              s &&
              typeof s.id === "string" &&
              Array.isArray(s.offerIds) &&
              s.offerIds.every((id) => typeof id === "string") &&
              typeof s.signature === "string",
          )
        : [],
      reviews:
        value.reviews && typeof value.reviews === "object" ? value.reviews : {},
      cards: Object.fromEntries(
        Object.entries(
          value.cards && typeof value.cards === "object" ? value.cards : {},
        )
          .filter(
            ([, card]) =>
              card && typeof card === "object" && !Array.isArray(card),
          )
          .map(([id, card]) => [
            id,
            {
              costMinor:
                Number.isSafeInteger(card.costMinor) && card.costMinor >= 0
                  ? card.costMinor
                  : null,
              photoSource: ["auto", "manual", "ozon", "wb"].includes(
                card.photoSource,
              )
                ? card.photoSource
                : "auto",
              photoOfferId:
                typeof card.photoOfferId === "string" ? card.photoOfferId : "",
            },
          ]),
      ),
    };
  } catch {
    return emptyCatalogState();
  }
}
export function writeCatalogState(state) {
  try {
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

let database;
const photoCache = new Map();
function openPhotos() {
  if (!database)
    database = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error("Хранилище фотографий недоступно."));
        return;
      }
      const request = indexedDB.open("formula-catalog", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("photos");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(
          new Error("Хранилище фотографий заблокировано другой вкладкой."),
        );
    });
  return database;
}
export function readCatalogPhoto(id) {
  if (!photoCache.has(id))
    photoCache.set(
      id,
      openPhotos()
        .then(
          (db) =>
            new Promise((resolve, reject) => {
              const request = db
                .transaction("photos")
                .objectStore("photos")
                .get(id);
              request.onsuccess = () => resolve(request.result || null);
              request.onerror = () => reject(request.error);
            }),
        )
        .catch(() => null),
    );
  return photoCache.get(id);
}
export async function writeCatalogPhoto(id, blob) {
  // Keep an in-memory copy even if private browsing/quota prevents persistence.
  photoCache.set(id, Promise.resolve(blob));
  try {
    const db = await openPhotos();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("photos", "readwrite");
      if (blob) transaction.objectStore("photos").put(blob, id);
      else transaction.objectStore("photos").delete(id);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function validateCatalogPhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Выберите фотографию JPG, PNG или WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Фотография больше 5 МБ.");
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Не удалось прочитать фотографию. Выберите другой файл.");
  }
  bitmap.close();
}
