// Picking items from the price list on a dry cleaning ticket.
// Choose Dry clean or Press only, then tap items; + and − change how many.
// Items with a price range (e.g. Long coat £13–£20) ask for the price first,
// and only accept a price inside the range.
//
// lines is the list of picked items; onChange gets the new list, e.g.
// [{ price_list_id: 2, name: "Shirt", service: "clean", quantity: 2, unit_price: 3.5 }]

import { useEffect, useState } from "react";
import { pounds } from "../utils/money.js";
import { priceText } from "../utils/priceText.js";
import { loadJson } from "../utils/api.js";

const SERVICE_NAMES = { clean: "dry clean", press: "press only" };

export default function PriceListPicker({ lines, onChange }) {
  const [priceList, setPriceList] = useState(null);
  const [service, setService] = useState("clean");
  const [search, setSearch] = useState("");
  // An item with a price range, waiting for staff to type its price
  const [askingPrice, setAskingPrice] = useState(null);
  const [rangePrice, setRangePrice] = useState("");
  const [rangeError, setRangeError] = useState(null);

  useEffect(() => {
    loadJson("/api/price-list")
      .then((data) => setPriceList(data));
  }, []);

  if (priceList === null) {
    return <p>Loading the price list…</p>;
  }

  // The lowest and highest price of an item for the chosen service
  const range = (item) =>
    service === "clean"
      ? [item.clean_min, item.clean_max]
      : [item.press_min, item.press_max];

  // Adds one of an item at a price; the same item, service and price just counts up
  const addLine = (item, unitPrice) => {
    const same = lines.find(
      (line) =>
        line.price_list_id === item.id &&
        line.service === service &&
        line.unit_price === unitPrice,
    );
    if (same) {
      onChange(
        lines.map((line) =>
          line === same ? { ...line, quantity: line.quantity + 1 } : line,
        ),
      );
    } else {
      onChange([
        ...lines,
        {
          price_list_id: item.id,
          name: item.name,
          service,
          quantity: 1,
          unit_price: unitPrice,
        },
      ]);
    }
  };

  const tapItem = (item) => {
    const [min, max] = range(item);
    if (min === max) {
      addLine(item, min);
    } else {
      // A range: ask for the price, starting at the lowest
      setAskingPrice(item);
      setRangePrice(min.toFixed(2));
      setRangeError(null);
    }
  };

  const addRangeItem = () => {
    const [min, max] = range(askingPrice);
    const value = Math.round(Number(rangePrice) * 100) / 100;
    if (!rangePrice || Number.isNaN(value) || value < min || value > max) {
      setRangeError(
        `Please enter a price between ${pounds(min)} and ${pounds(max)}`,
      );
      return;
    }
    addLine(askingPrice, value);
    setAskingPrice(null);
  };

  const changeQuantity = (changed, by) =>
    onChange(
      lines
        .map((line) =>
          line === changed ? { ...line, quantity: line.quantity + by } : line,
        )
        .filter((line) => line.quantity > 0),
    );

  // Easy searching: capitals, spaces, dashes and other marks don't matter, the words
  // can be in any order, and "piece", "pieces" and "pcs" all mean "pc".
  // So "2 piece", "2-pc" and "suit 2" all find "2pc suit".
  const simple = (text) =>
    text
      .toLowerCase()
      // only whole words, so the "pcs" in "3pc suit" isn't changed
      .replace(/(pieces|piece|pcs)\b/g, "pc")
      .replace(/[^a-z0-9]/g, "");
  const searchWords = search.split(/\s+/).map(simple).filter(Boolean);
  const shown = priceList.items.filter((item) => {
    const name = simple(item.name);
    return searchWords.every((word) => name.includes(word));
  });

  return (
    <div className="price-picker">
      <div className="report-controls">
        {["clean", "press"].map((kind) => (
          <button
            key={kind}
            type="button"
            className={"sort-button" + (service === kind ? " active" : "")}
            onClick={() => setService(kind)}
          >
            {kind === "clean" ? "Dry clean" : "Press only"}
          </button>
        ))}
        <input
          type="search"
          className="price-search"
          placeholder="Find an item"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Asking the price for an item with a range */}
      {askingPrice && (
        <div className="confirm-box">
          <p>
            <strong>{askingPrice.name}</strong> ({SERVICE_NAMES[service]}):
            enter a price between {pounds(range(askingPrice)[0])} and{" "}
            {pounds(range(askingPrice)[1])}
          </p>
          <div className="range-quick">
            {[
              range(askingPrice)[0],
              Math.round(
                ((range(askingPrice)[0] + range(askingPrice)[1]) / 2) * 100,
              ) / 100,
              range(askingPrice)[1],
            ].map((value) => (
              <button
                key={value}
                type="button"
                className="sort-button"
                onClick={() => setRangePrice(value.toFixed(2))}
              >
                {pounds(value)}
              </button>
            ))}
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              aria-label="Price for this item (£)"
              value={rangePrice}
              onChange={(e) => {
                const [whole, pence] = e.target.value.split(".");
                setRangePrice(
                  pence && pence.length > 2
                    ? whole + "." + pence.slice(0, 2)
                    : e.target.value,
                );
              }}
            />
          </div>
          {rangeError && <p className="takings-error">{rangeError}</p>}
          <div className="form-actions">
            <button type="button" onClick={() => setAskingPrice(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="confirm-button"
              onClick={addRangeItem}
            >
              Add item
            </button>
          </div>
        </div>
      )}

      <div className="price-groups">
        {priceList.categories.map((category) => {
          const items = shown.filter((item) => item.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category}>
              <h4>{category}</h4>
              <div className="price-items">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => tapItem(item)}
                  >
                    <span>{item.name}</span>
                    <small>{priceText(...range(item))}</small>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <p>No items match.</p>}
      </div>

      {/* The items picked so far */}
      {lines.length > 0 && (
        <ul className="picked-items">
          {lines.map((line) => (
            <li key={line.price_list_id + line.service + line.unit_price}>
              <span>
                {line.quantity} × {line.name}{" "}
                <small>
                  ({SERVICE_NAMES[line.service]}, {pounds(line.unit_price)}{" "}
                  each)
                </small>
              </span>
              <strong>{pounds(line.quantity * line.unit_price)}</strong>
              <span className="picked-buttons">
                <button
                  type="button"
                  className="sort-button"
                  aria-label="One less"
                  onClick={() => changeQuantity(line, -1)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="sort-button"
                  aria-label="One more"
                  onClick={() => changeQuantity(line, 1)}
                >
                  +
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
