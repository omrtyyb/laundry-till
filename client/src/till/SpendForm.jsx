// Pop-up for money taken out of the till (description + amount).
// Opened by the "Spend Coin from Till" button.

import { showToast } from "../utils/toast.js";
import Overlay from "../Overlay.jsx";

// Form for money taken out of the till
export default function SpendForm({ onClose }) {
  return (
    <Overlay onClose={onClose}>
      <form
        className="ticket-form spending"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.target);

          // Send the spending to the server to be saved
          const response = await fetch("/api/till-spending", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: form.get("description"),
              amount: Number(form.get("amount")),
            }),
          });
          const data = await response.json();

          if (!response.ok) {
            showToast("Could not save: " + data.error, "error");
            return;
          }

          showToast(
            `Saved: £${data.amount.toFixed(2)} for ${data.description}`,
          );
          onClose();
        }}
      >
        <h2>Spend Coin from Till</h2>
        <label>
          Description
          <input type="text" name="description" required />
        </label>
        <label>
          Amount (£)
          <input
            type="number"
            name="amount"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            inputMode="decimal"
            required
            // Block keys that don't belong in an amount
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
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">Save</button>
        </div>
      </form>
    </Overlay>
  );
}
