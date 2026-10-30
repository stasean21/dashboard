import { Store, LayoutGrid } from "lucide-react";
import Select from "./Select.jsx";

export const marketplaces = {
  all: { name: "Общий", mark: null },
  ozon: { name: "Ozon", mark: "OZON" },
  wb: { name: "Wildberries", mark: "WB" },
  yandex: { name: "Яндекс Маркет", mark: "Я" },
};

export function savedMarketplace() {
  try {
    const value = localStorage.getItem("formula.marketplace");
    return Object.hasOwn(marketplaces, value) ? value : "ozon";
  } catch {
    return "ozon";
  }
}

const options = Object.entries(marketplaces).map(([value, { name, mark }]) => ({
  value,
  label: (
    <span className="marketplace-option-label">
      <span className="marketplace-mark" aria-hidden="true">
        {mark || <LayoutGrid size={16} />}
      </span>
      {name}
    </span>
  ),
}));

export default function MarketplaceSwitcher({ value, onChange }) {
  const Icon = value === "all" ? LayoutGrid : Store;
  return (
    <Select
      label="Маркетплейс"
      value={value}
      onChange={onChange}
      options={options}
      className="marketplace-select"
      renderValue={() => (
        <span className="marketplace-value">
          <span className="marketplace-store" aria-hidden="true">
            <Icon size={15} />
          </span>
          {marketplaces[value].name}
        </span>
      )}
    />
  );
}

export function MarketplaceEmpty({ name, section, onOzon }) {
  return (
    <section className="card marketplace-empty">
      <span className="marketplace-empty-icon" aria-hidden="true">
        <Store size={26} />
      </span>
      <h2>Данные {name} ещё не загружены</h2>
      <p>
        Отчёты этой площадки пока не подключены.
        <br />
        Раздел «{section}» появится после добавления данных.
      </p>
      <button className="button primary" onClick={onOzon}>
        Перейти в Ozon
      </button>
    </section>
  );
}
