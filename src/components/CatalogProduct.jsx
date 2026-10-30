import { useEffect, useRef, useState } from "react";
import { Info, Upload, Link2, Unlink, Search } from "lucide-react";
import Dialog from "./Dialog.jsx";
import Select from "./Select.jsx";
import CopyValue from "./CopyValue.jsx";
import ProductPhoto from "./ProductPhoto.jsx";
import { validateCatalogPhoto } from "../data/catalog-storage.js";
import { costInput, costToMinor } from "../data/catalog.js";
import { dateLabel } from "../data/report.js";

export function OfferCard({ offer, highlight = false }) {
  return (
    <section className={`catalog-source-card ${offer.marketplace}`}>
      <header>
        <span>{offer.marketplace === "ozon" ? "Ozon" : "Wildberries"}</span>
        <small>Из Excel</small>
      </header>
      <p className="source-title">{offer.name}</p>
      <div className="source-field">
        <span>{offer.marketplace === "ozon" ? "SKU Ozon" : "Артикул WB"}</span>
        <CopyValue
          value={offer.sku}
          label={offer.marketplace === "ozon" ? "SKU Ozon" : "артикул WB"}
        />
      </div>
      <div className="source-field">
        <span>Артикул продавца</span>
        <CopyValue
          value={offer.article}
          label={`артикул продавца ${offer.marketplace === "ozon" ? "Ozon" : "WB"}`}
          highlightEnd={highlight}
        />
      </div>
      {offer.marketplace === "wb" && (
        <span className={`source-state ${offer.deleted ? "" : "present"}`}>
          {offer.deleted ? "Помечена удалённой" : "Не помечена удалённой"}
        </span>
      )}
      <p className="source-period">
        {dateLabel(offer.period.start)} — {dateLabel(offer.period.end)}
      </p>
    </section>
  );
}

function LinkPicker({ catalog, row, onLink, onClose }) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const choices = catalog.rows
    .filter((r) => r.status === "single" && r.id !== row.id)
    .flatMap((r) => r.offers)
    .filter(
      (o) =>
        !row.offerIds.includes(o.id) &&
        `${o.name} ${o.article} ${o.sku}`
          .toLocaleLowerCase("ru")
          .includes(query.toLocaleLowerCase("ru")),
    );
  return (
    <section className="catalog-link-picker">
      <div className="card-heading">
        <h3>Добавить карточки к товару</h3>
        <button type="button" className="text-button" onClick={onClose}>
          Отмена
        </button>
      </div>
      <p>
        Доступны карточки без подтверждённой связи и без спорного сопоставления.
        Проверьте модель и вариант товара.
      </p>
      <label className="search-field">
        <Search size={15} />
        <input
          aria-label="Поиск карточек для связи"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Название, артикул или SKU"
        />
      </label>
      <div className="link-picker-options">
        {choices.map((o) => (
          <label key={o.id}>
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={() =>
                setSelected((ids) =>
                  ids.includes(o.id)
                    ? ids.filter((id) => id !== o.id)
                    : [...ids, o.id],
                )
              }
            />
            <span>
              <strong>{o.name}</strong>
              <small>
                {o.marketplace === "ozon" ? "Ozon" : "WB"} · {o.sku} ·{" "}
                {o.article}
              </small>
            </span>
          </label>
        ))}
        {!choices.length && <p>Свободных карточек по этому запросу нет.</p>}
      </div>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        className="button primary"
        disabled={!selected.length || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onLink([...row.offerIds, ...selected]);
            onClose();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Добавить выбранные карточки
      </button>
    </section>
  );
}

export default function CatalogProduct({
  row,
  catalog,
  settings = {},
  photoRevision,
  onClose,
  onSave,
  onLink,
  onUnlink,
  onCheck,
  children,
}) {
  const [cost, setCost] = useState(() => costInput(settings.costMinor)),
    [source, setSource] = useState(settings.photoSource || "auto"),
    [photoOfferId, setPhotoOfferId] = useState(settings.photoOfferId || ""),
    [preview, setPreview] = useState(undefined),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [linking, setLinking] = useState(false);
  const file = useRef();
  const actual = row.checks.filter((i) => !i.resolved),
    sourceOffers = row.offers.filter((o) => o.marketplace === source);
  useEffect(() => {
    setCost(costInput(settings.costMinor));
    setSource(settings.photoSource || "auto");
    setPhotoOfferId(settings.photoOfferId || "");
    setPreview(undefined);
    setError("");
    setLinking(false);
  }, [row.id]);
  async function save() {
    setError("");
    setBusy(true);
    try {
      const costMinor = costToMinor(cost);
      await onSave({ costMinor, photoSource: source, photoOfferId }, preview);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      className="catalog-product-dialog"
      closeLabel="Закрыть карточку товара"
      onClose={onClose}
      heading={(id) => (
        <div className="catalog-product-heading">
          <div className="eyebrow">КАРТОЧКА ТОВАРА · FORMULA</div>
          <h2 id={id}>{row.name}</h2>
          <div className="product-header-article">
            <span>
              {row.articles.length > 1
                ? "Артикулы продавца"
                : "Артикул продавца"}
            </span>
            {row.articles.map((article) => (
              <CopyValue
                key={article}
                value={article}
                label="артикул продавца"
              />
            ))}
          </div>
        </div>
      )}
    >
      <div className="product-cost-row">
        <label className="product-cost-label" htmlFor="catalog-cost">
          <strong>Себестоимость товара</strong>
          <span>Общее значение для карточек Ozon и WB</span>
        </label>
        <div className="product-cost-input">
          <input
            id="catalog-cost"
            aria-label="Себестоимость товара"
            aria-describedby="catalog-cost-unit"
            inputMode="decimal"
            autoComplete="off"
            value={cost}
            onChange={(e) => {
              setCost(e.target.value);
              setError("");
            }}
            placeholder="Не указана"
          />
          <span id="catalog-cost-unit">₽ / шт.</span>
        </div>
        <p className="product-cost-note">
          Укажите своё значение за одну штуку.
          <br />В исходных выгрузках себестоимости нет.
        </p>
      </div>
      <div className="product-modal-body">
        <section className="product-modal-photo">
          <ProductPhoto
            row={row}
            settings={{ ...settings, photoOfferId }}
            sourceOverride={source}
            previewBlob={preview}
            revision={photoRevision}
            className="product-photo-large"
          />
          <div className="product-photo-label">Источник фотографии</div>
          <div className="product-photo-sources">
            {[
              ["auto", "Авто"],
              ["ozon", "Ozon"],
              ["wb", "WB"],
              ["manual", "Вручную"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={source === value ? "active" : ""}
                aria-pressed={source === value}
                disabled={
                  ["ozon", "wb"].includes(value) &&
                  !row.offers.some((o) => o.marketplace === value)
                }
                onClick={() => {
                  setSource(value);
                  setPhotoOfferId("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {sourceOffers.length > 1 && (
            <Select
              label="Карточка-источник фото"
              value={
                sourceOffers.some((o) => o.id === photoOfferId)
                  ? photoOfferId
                  : sourceOffers[0].id
              }
              onChange={setPhotoOfferId}
              options={sourceOffers.map((o) => ({
                value: o.id,
                label: `${o.sku}${o.deleted ? " · удалена" : ""}`,
              }))}
            />
          )}
          <p className="product-photo-hint">
            Фото в формате 3:4. API пока не подключён; фотографию можно
            загрузить вручную. Ручное фото не заменяется автоматическим
            обновлением.
          </p>
          <button
            type="button"
            className="product-upload-photo"
            onClick={() => file.current.click()}
          >
            <Upload size={13} />
            Загрузить своё фото
          </button>
          <input
            hidden
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Фотография товара"
            onChange={async (e) => {
              const selected = e.target.files[0];
              e.target.value = "";
              if (!selected) return;
              setBusy(true);
              try {
                await validateCatalogPhoto(selected);
                setPreview(selected);
                setSource("manual");
                setError("");
              } catch (err) {
                setError(err.message);
              } finally {
                setBusy(false);
              }
            }}
          />
          <button
            type="button"
            className="text-button remove-catalog-photo"
            onClick={() => {
              setPreview(null);
              if (source === "manual") setSource("auto");
            }}
          >
            Удалить ручное фото
          </button>
          <small className="photo-upload-formats">
            JPG, PNG, WebP · до 5 МБ
          </small>
        </section>
        <section>
          <h3 className="product-sources-heading">Карточки на маркетплейсах</h3>
          <div
            className={`product-offer-grid ${row.offers.length > 2 ? "three" : ""}`}
          >
            {row.offers.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
          <p className="product-photo-scope">
            <Info size={14} />
            Артикулы и SKU копируются по нажатию на значение. Фото и
            себестоимость принадлежат нашей общей карточке.
          </p>
          {actual.length > 0 && (
            <div className="product-card-checks">
              <span>Требует внимания:</span>
              {actual.map((i) => (
                <button
                  type="button"
                  key={i.id}
                  className={`catalog-issue-label ${i.severity === "info" ? "info" : ""}`}
                  onClick={() => onCheck(i.id)}
                >
                  {i.kind === "duplicate"
                    ? "Повтор артикула"
                    : i.kind === "article"
                      ? "Артикулы отличаются"
                      : "Удалена в WB"}
                </button>
              ))}
            </div>
          )}
          {row.missingOfferIds?.length > 0 && (
            <p className="catalog-context">
              <Info size={14} />В текущей выгрузке нет связанных карточек:{" "}
              {row.missingOfferIds
                .map((id) => {
                  const [market, , sku] = id.split(":");
                  return `${market === "ozon" ? "Ozon" : "WB"} ${sku}`;
                })
                .join(", ")}
              . Сохранённая связь не удалена.
            </p>
          )}
          <div className="product-link-actions">
            {row.status === "candidate" && (
              <>
                <span>Совпадение артикула ещё не подтверждено.</span>
                <button
                  type="button"
                  className="button"
                  onClick={async () => {
                    try {
                      await onLink(row.offerIds);
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  <Link2 size={14} />
                  Подтвердить связь
                </button>
              </>
            )}
            {row.status === "linked" && (
              <>
                <span>Карточки связаны с нашим товаром.</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={onUnlink}
                >
                  <Unlink size={13} />
                  Разъединить
                </button>
              </>
            )}
            {row.status !== "review" && (
              <button
                type="button"
                className="text-button"
                onClick={() => setLinking((v) => !v)}
              >
                Добавить карточку
              </button>
            )}
          </div>
          {linking && (
            <LinkPicker
              catalog={catalog}
              row={row}
              onLink={onLink}
              onClose={() => setLinking(false)}
            />
          )}
        </section>
      </div>
      {children && (
        <section className="catalog-product-analytics">{children}</section>
      )}
      {error && (
        <p className="catalog-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="product-dialog-footer">
        <p>
          Изменения сохраняются на этом устройстве. Общего серверного каталога и
          API-подключений пока нет.
        </p>
        <div className="product-dialog-actions">
          <button type="button" className="button" onClick={onClose}>
            Закрыть
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={save}
          >
            {busy ? "Сохраняем…" : "Сохранить карточку"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
