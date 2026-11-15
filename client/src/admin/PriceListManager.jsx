// Admin "Price list": the dry cleaning items and their Dry clean and Press only prices.
// A price range (e.g. Long coat £13–£20) has a lowest and a highest price; for a single
// price both are the same. Removed items disappear from the till but stay on old tickets.
// Every change is saved in the Edit history.

import { useEffect, useState } from "react";
import { priceText } from "../utils/priceText.js";
import { loadJson, request } from "../utils/api.js";

const EMPTY = {
  category: "Everyday",
  name: "",
  clean_min: "",
  clean_max: "",
  press_min: "",
  press_max: "",
};

// The four price boxes used when adding or editing an item
function PriceBoxes({ item, onChange }) {
  const box = (field, label) => (
    <label className="price-box">
      {label}
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        required
        value={item[field]}
        onChange={(e) => onChange({ ...item, [field]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="price-boxes">
      {box("clean_min", "Dry clean from £")}
      {box("clean_max", "to £")}
      {box("press_min", "Press from £")}
      {box("press_max", "to £")}
    </div>
  );
}

export default function PriceListManager() {
  const [data, setData] = useState(null);
  const [newItem, setNewItem] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    loadJson("/api/admin/price-list")
      .then((result) => setData(result));

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

  // The prices are typed as text; the server wants numbers
  const asNumbers = (item) => ({
    ...item,
    clean_min: Number(item.clean_min),
    clean_max: Number(item.clean_max),
    press_min: Number(item.press_min),
    press_max: Number(item.press_max),
  });

  if (data === null) return <p>Loading…</p>;

  return (
    <section className="report">
      <h2>Price list</h2>
      <p className="report-note">
        Dry cleaning items shown on the till. For a single price, put the same
        amount in "from" and "to"; for a range like £13–£20, staff type the
        price when they add the item. Changes are saved in the Edit history.
      </p>

      <form
        className="price-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const added = await send(
            "/api/admin/price-list",
            "POST",
            asNumbers(newItem),
            `${newItem.name.trim()} added.`,
          );
          if (added) setNewItem(EMPTY);
        }}
      >
        <h3>Add an item</h3>
        <div className="staff-add">
          <select
            value={newItem.category}
            onChange={(e) =>
              setNewItem({ ...newItem, category: e.target.value })
            }
          >
            {data.categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Item name"
            required
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          />
        </div>
        <PriceBoxes item={newItem} onChange={setNewItem} />
        <div className="form-actions">
          <button type="submit">Add item</button>
        </div>
      </form>

      {error && <p className="takings-error">{error}</p>}
      {message && <p className="money-in-message">{message}</p>}

      {data.categories.map((category) => (
        <div key={category}>
          <h3>{category}</h3>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Dry clean</th>
                  <th>Press only</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items
                  .filter((item) => item.category === category)
                  .map((item) =>
                    editing?.id === item.id ? (
                      <tr key={item.id}>
                        <td colSpan="4">
                          <form
                            className="price-form"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const saved = await send(
                                "/api/admin/price-list/" + item.id,
                                "PUT",
                                asNumbers(editing),
                                `${editing.name.trim()} saved.`,
                              );
                              if (saved) setEditing(null);
                            }}
                          >
                            <div className="staff-add">
                              <select
                                value={editing.category}
                                onChange={(e) =>
                                  setEditing({
                                    ...editing,
                                    category: e.target.value,
                                  })
                                }
                              >
                                {data.categories.map((c) => (
                                  <option key={c}>{c}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                required
                                value={editing.name}
                                onChange={(e) =>
                                  setEditing({
                                    ...editing,
                                    name: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <PriceBoxes item={editing} onChange={setEditing} />
                            <div className="form-actions">
                              <button
                                type="button"
                                onClick={() => setEditing(null)}
                              >
                                Cancel
                              </button>
                              <button type="submit">Save</button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={item.id}
                        className={item.active ? "" : "removed"}
                      >
                        {/* Long names wrap, so the Edit and Remove buttons stay in view */}
                        <td className="wrap">
                          {item.name}
                          {!item.active && " (removed)"}
                        </td>
                        <td>{priceText(item.clean_min, item.clean_max)}</td>
                        <td>{priceText(item.press_min, item.press_max)}</td>
                        <td className="row-actions">
                          {item.active ? (
                            <>
                              <button
                                className="sort-button"
                                onClick={() => setEditing({ ...item })}
                              >
                                Edit
                              </button>
                              <button
                                className="sort-button danger-button"
                                onClick={() =>
                                  send(
                                    "/api/admin/price-list/" + item.id,
                                    "DELETE",
                                    null,
                                    `${item.name} removed from the till.`,
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
                                  `/api/admin/price-list/${item.id}/restore`,
                                  "POST",
                                  null,
                                  `${item.name} is back on the till.`,
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
        </div>
      ))}
    </section>
  );
}
