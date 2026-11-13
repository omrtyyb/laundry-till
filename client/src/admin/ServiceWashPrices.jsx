// Admin → Price list → Service wash: the load sizes picked on a service wash ticket, each with
// a lowest and highest price (e.g. Small load £14–£16). Staff can charge anything inside the
// range. Removed sizes disappear from the till but stay on old tickets.
// Every change is saved in the Edit history.

import { useEffect, useState } from "react";
import { priceText } from "../utils/priceText.js";

const EMPTY = { name: "", price_min: "", price_max: "" };

// The name and the two price boxes, used when adding or editing a load size
function LoadSizeBoxes({ size, onChange }) {
  const box = (field, label) => (
    <label className="price-box">
      {label}
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        required
        value={size[field]}
        onChange={(e) => onChange({ ...size, [field]: e.target.value })}
      />
    </label>
  );
  return (
    <>
      <div className="staff-add">
        <input
          type="text"
          placeholder="Load size, e.g. Small load"
          required
          value={size.name}
          onChange={(e) => onChange({ ...size, name: e.target.value })}
        />
      </div>
      <div className="price-boxes">
        {box("price_min", "From £")}
        {box("price_max", "to £")}
      </div>
    </>
  );
}

export default function ServiceWashPrices() {
  const [sizes, setSizes] = useState(null);
  const [newSize, setNewSize] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    fetch("/api/admin/service-wash-prices")
      .then((response) => response.json())
      .then((result) => setSizes(result));

  useEffect(() => {
    load();
  }, []);

  // Sends a change to the server, then shows the result and reloads the list
  const send = async (url, method, body, successText) => {
    setMessage(null);
    setError(null);
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error);
      return false;
    }
    setMessage(successText);
    load();
    return true;
  };

  // The prices are typed as text; the server wants numbers
  const asNumbers = (size) => ({
    name: size.name,
    price_min: Number(size.price_min),
    price_max: Number(size.price_max),
  });

  if (sizes === null) return <p>Loading…</p>;

  return (
    <section className="report">
      <h2>Service wash prices</h2>
      <p className="report-note">
        Load sizes shown on a service wash ticket. Staff pick one and can charge
        any price from "from" to "to".
      </p>

      {error && <p className="takings-error">{error}</p>}
      {message && <p className="money-in-message">{message}</p>}

      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              <th>Load size</th>
              <th>Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sizes.map((size) =>
              editing?.id === size.id ? (
                <tr key={size.id}>
                  <td colSpan="3">
                    <form
                      className="price-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const saved = await send(
                          "/api/admin/service-wash-prices/" + size.id,
                          "PUT",
                          asNumbers(editing),
                          `${editing.name.trim()} saved.`,
                        );
                        if (saved) setEditing(null);
                      }}
                    >
                      <LoadSizeBoxes size={editing} onChange={setEditing} />
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
                <tr key={size.id} className={size.active ? "" : "removed"}>
                  <td>
                    {size.name}
                    {!size.active && " (removed)"}
                  </td>
                  <td>{priceText(size.price_min, size.price_max)}</td>
                  <td className="row-actions">
                    {size.active ? (
                      <>
                        <button
                          className="sort-button"
                          onClick={() => setEditing({ ...size })}
                        >
                          Edit
                        </button>
                        <button
                          className="sort-button danger-button"
                          onClick={() =>
                            send(
                              "/api/admin/service-wash-prices/" + size.id,
                              "DELETE",
                              null,
                              `${size.name} removed from the till.`,
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
                            `/api/admin/service-wash-prices/${size.id}/restore`,
                            "POST",
                            null,
                            `${size.name} is back on the till.`,
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
            "/api/admin/service-wash-prices",
            "POST",
            asNumbers(newSize),
            `${newSize.name.trim()} added.`,
          );
          if (added) setNewSize(EMPTY);
        }}
      >
        <h3>Add a load size</h3>
        <LoadSizeBoxes size={newSize} onChange={setNewSize} />
        <div className="form-actions">
          <button type="submit">Add load size</button>
        </div>
      </form>
    </section>
  );
}
