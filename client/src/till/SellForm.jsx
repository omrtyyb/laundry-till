// Pop-up for selling products (soap, softener, bags...) or any "Other" item.
// Opened by the "Sell Soap & Softener" button on the till.

import { useEffect, useState } from "react";
import { showToast } from "../utils/toast.js";
import Overlay from "../components/Overlay.jsx";
import { loadJson, request } from "../utils/api.js";

// Selling screen: first pick a product (or "Other item"), then enter how many
export default function SellForm({ onClose }) {
  const [products, setProducts] = useState([]);
  // The product being sold, "other" for a typed-in item, or null while choosing
  const [selected, setSelected] = useState(null);

  // Load the product list from the server when the screen opens
  useEffect(() => {
    loadJson("/api/products")
      .then((data) => setProducts(data));
  }, []);

  if (selected === null) {
    return (
      <Overlay onClose={onClose}>
        <div className="ticket-form products">
          <h2>Sell</h2>
          <div className="product-buttons">
            {products.map((product) => (
              <button key={product.id} onClick={() => setSelected(product)}>
                {product.name}
                <span>£{product.price.toFixed(2)}</span>
              </button>
            ))}
            <button onClick={() => setSelected("other")}>
              Other item
              <span>Type it in</span>
            </button>
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </Overlay>
    );
  }

  const isOther = selected === "other";

  return (
    <Overlay onClose={onClose}>
      <form
        className="ticket-form products"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.target);
          const quantity = Number(form.get("quantity"));

          const sale = isOther
            ? {
                item_name: form.get("item_name"),
                unit_price: Number(form.get("unit_price")),
                quantity,
              }
            : { product_id: selected.id, quantity };

          // Send the sale to the server to be saved
          const { ok, data } = await request("/api/sales", { method: "POST", body: sale });

          if (!ok) {
            showToast("Could not save the sale: " + data.error, "error");
            return;
          }

          const total = (data.quantity * data.unit_price).toFixed(2);
          showToast(
            `Sold ${data.quantity} x ${data.item_name}, total £${total}`,
          );
          onClose();
        }}
      >
        <h2>{isOther ? "Sell other item" : `Sell ${selected.name}`}</h2>
        {isOther ? (
          <>
            <label>
              What is the item?
              <input type="text" name="item_name" required />
            </label>
            <label>
              Price for one (£)
              <input
                type="number"
                name="unit_price"
                min="0"
                step="0.01"
                placeholder="0.00"
                inputMode="decimal"
                required
                // Block keys that don't belong in a price
                onKeyDown={(e) => {
                  if (["e", "E", "-", "+"].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                // Keep at most two digits after the decimal point
                onInput={(e) => {
                  const [pounds, pence] = e.target.value.split(".");
                  if (pence && pence.length > 2) {
                    e.target.value = pounds + "." + pence.slice(0, 2);
                  }
                }}
              />
            </label>
          </>
        ) : (
          <p>£{selected.price.toFixed(2)} each</p>
        )}
        <label>
          How many
          <input
            type="number"
            name="quantity"
            min="1"
            step="1"
            defaultValue="1"
            inputMode="numeric"
            required
            // Only allow whole numbers: block the decimal point and similar keys
            onKeyDown={(e) => {
              if ([".", ",", "e", "E", "-", "+"].includes(e.key)) {
                e.preventDefault();
              }
            }}
          />
        </label>
        <div className="form-actions">
          <button type="button" onClick={() => setSelected(null)}>
            Back
          </button>
          <button type="submit">Sell</button>
        </div>
      </form>
    </Overlay>
  );
}
