// Admin → Products to sell: the buttons on the till's "Sell Soap & Softener" screen
// (soap, softener, bags...), each with its price. Removed products disappear from the till
// but old sales keep their name and price. Every change is saved in the Edit history.

import { useEffect, useState } from "react";
import { pounds } from "../utils/money.js";
import { loadJson, request } from "../utils/api.js";

const EMPTY = { name: "", price: "" };

// The name and price boxes, used when adding or editing a product
function ProductBoxes({ product, onChange }) {
  return (
    <>
      <div className="staff-add">
        <input
          type="text"
          placeholder="Product, e.g. Fabric softener"
          maxLength={40}
          required
          value={product.name}
          onChange={(e) => onChange({ ...product, name: e.target.value })}
        />
      </div>
      <div className="price-boxes">
        <label className="price-box">
          Price £
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            required
            value={product.price}
            onChange={(e) => onChange({ ...product, price: e.target.value })}
          />
        </label>
      </div>
    </>
  );
}

export default function ProductPrices() {
  const [products, setProducts] = useState(null);
  const [newProduct, setNewProduct] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    loadJson("/api/admin/products")
      .then((result) => setProducts(result));

  useEffect(() => {
    load();
  }, []);

  // Sends a change to the server, then shows the result and reloads the list
  const send = async (url, method, body, successText) => {
    setMessage(null);
    setError(null);
    const { ok, data: result } = await request(url, { method, body });
    if (!ok) {
      setError(result.error);
      return false;
    }
    setMessage(successText);
    load();
    return true;
  };

  // The price is typed as text; the server wants a number
  const asNumbers = (product) => ({ name: product.name, price: Number(product.price) });

  if (products === null) return <p>Loading…</p>;

  return (
    <section className="report">
      <h2>Products to sell</h2>
      <p className="report-note">
        The buttons on the till's Sell Soap &amp; Softener screen. Changing a price only
        changes new sales; old sales keep the price they were sold at.
      </p>

      {error && <p className="takings-error">{error}</p>}
      {message && <p className="money-in-message">{message}</p>}

      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan="3">No products yet. Add one below.</td>
              </tr>
            )}
            {products.map((product) =>
              editing?.id === product.id ? (
                <tr key={product.id}>
                  <td colSpan="3">
                    <form
                      className="price-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const saved = await send(
                          "/api/admin/products/" + product.id,
                          "PUT",
                          asNumbers(editing),
                          `${editing.name.trim()} saved.`,
                        );
                        if (saved) setEditing(null);
                      }}
                    >
                      <ProductBoxes product={editing} onChange={setEditing} />
                      <div className="form-actions">
                        <button type="button" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                        <button type="submit">Save</button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={product.id} className={product.active ? "" : "removed"}>
                  <td>
                    {product.name}
                    {!product.active && " (removed)"}
                  </td>
                  <td>{pounds(product.price)}</td>
                  <td className="row-actions">
                    {product.active ? (
                      <>
                        <button
                          className="sort-button"
                          onClick={() => setEditing({ ...product, price: String(product.price) })}
                        >
                          Edit
                        </button>
                        <button
                          className="sort-button danger-button"
                          onClick={() =>
                            send(
                              "/api/admin/products/" + product.id,
                              "DELETE",
                              null,
                              `${product.name} removed from the till.`,
                            )
                          }
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <button
                        className="sort-button"
                        onClick={() =>
                          send(
                            `/api/admin/products/${product.id}/restore`,
                            "POST",
                            null,
                            `${product.name} is back on the till.`,
                          )
                        }
                      >
                        Bring back
                      </button>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <form
        className="price-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const added = await send(
            "/api/admin/products",
            "POST",
            asNumbers(newProduct),
            `${newProduct.name.trim()} added to the till.`,
          );
          if (added) setNewProduct(EMPTY);
        }}
      >
        <h3>Add a product</h3>
        <ProductBoxes product={newProduct} onChange={setNewProduct} />
        <div className="form-actions">
          <button type="submit">Add product</button>
        </div>
      </form>
    </section>
  );
}
