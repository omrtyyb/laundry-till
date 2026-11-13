// Part of the Money In pop-up: record coins taken from the washers and dryers.

import { useState } from "react";
import { pounds } from "../utils/money.js";

// Money from the washers and dryers: saved as a sale called "Washers Dryers Coins"
export default function CollectMachineMoney() {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState(null);

  return (
    <form
      className="search-row"
      onSubmit={async (e) => {
        e.preventDefault();
        const response = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_name: "Washers Dryers Coins",
            unit_price: Number(amount),
            quantity: 1,
          }),
        });
        const data = await response.json();
        if (response.ok) {
          setMessage(`Saved ${pounds(data.unit_price)} of machine coins.`);
          setAmount("");
        } else {
          setMessage("Could not save: " + data.error);
        }
      }}
    >
      <input
        type="number"
        min="0.01"
        step="0.01"
        inputMode="decimal"
        placeholder="Amount (£)"
        required
        value={amount}
        // Block keys that don't belong in an amount
        onKeyDown={(e) => {
          if (["e", "E", "-", "+"].includes(e.key)) {
            e.preventDefault();
          }
        }}
        // Keep at most two digits after the decimal point
        onChange={(e) => {
          const [whole, pence] = e.target.value.split(".");
          setAmount(
            pence && pence.length > 2
              ? whole + "." + pence.slice(0, 2)
              : e.target.value,
          );
        }}
      />
      <button type="submit">Confirm</button>
      {message && <p className="money-in-message">{message}</p>}
    </form>
  );
}
