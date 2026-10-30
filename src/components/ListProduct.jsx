import CopyValue from "./CopyValue.jsx";

export default function ListProduct({ name, sku, article, photo, onOpen }) {
  return (
    <div className="list-product">
      {photo}
      <div className="list-product-details">
        <button type="button" className="product-button" onClick={onOpen}>
          <span className="product-name">{name}</span>
        </button>
        <div className="list-product-identifiers">
          <span>SKU</span>
          <CopyValue value={sku} label="SKU Ozon" />
          {article && (
            <>
              <span>·</span>
              <CopyValue value={article} label="артикул продавца" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
