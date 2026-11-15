// End-of-day card and cash: enter the card machine total, confirm, edit later.
// Shown at the bottom of the Day summary.

import { useState } from "react";
import { pounds } from "../utils/money.js";
import { request } from "../utils/api.js";

// At the end of the day the admin reads the card machine and enters the card total.
// The rest of the day's money is cash. After a confirmation step it is saved
// in the daily_takings table. The admin can edit the card amount later.
export default function TakingsForm({ date, dayTotal, saved: savedAtStart }) {
  const [saved, setSaved] = useState(savedAtStart);
  const [card, setCard] = useState("");
  // true while changing the card amount of a day that was already saved
  const [editing, setEditing] = useState(false);
  // true while the "Are you sure?" step is showing
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  // Already saved for this day: show the numbers, with an Edit button
  if (saved && !editing) {
    return (
      <section className="takings">
        <h2>Card and cash (saved)</h2>
        <div className="summary-row card">
          <span>Card</span>
          <span>{pounds(saved.card_total)}</span>
        </div>
        <div className="summary-row cash">
          <span>Cash</span>
          <span>{pounds(saved.cash_total)}</span>
        </div>
        <div className="summary-row">
          <span>Day total</span>
          <span>{pounds(saved.day_total)}</span>
        </div>
        <div className="form-actions">
          <span className="takings-message">
            Saved on {saved.saved_at.slice(0, 16)}
          </span>
          <button
            onClick={() => {
              setCard(String(saved.card_total));
              setError(null);
              setEditing(true);
            }}
          >
            Edit card amount
          </button>
        </div>
      </section>
    );
  }

  const cash = dayTotal - Number(card || 0);

  return (
    <form
      className="takings"
      onSubmit={async (e) => {
        e.preventDefault();

        // First press of Save: ask the admin to check the numbers
        if (!confirming) {
          setConfirming(true);
          return;
        }

        // Second press (Confirm): save it. A new day is added (POST),
        // an already saved day has its card amount changed (PUT).
        const url = editing ? "/api/daily-takings/" + date : "/api/daily-takings";
        const { ok, data } = await request(url, {
          method: editing ? "PUT" : "POST",
          body: { date, card_total: Number(card) },
        });
        if (ok) {
          setSaved(data);
          setEditing(false);
          setConfirming(false);
        } else {
          setError(data.error);
          setConfirming(false);
        }
      }}
    >
      <h2>{editing ? "Edit card amount" : "Card and cash"}</h2>
      <label>
        Card machine total (£)
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          inputMode="decimal"
          required
          value={card}
          // Can't edit the amount while confirming it
          disabled={confirming}
          // Block keys that don't belong in an amount
          onKeyDown={(e) => {
            if (["e", "E", "-", "+"].includes(e.key)) {
              e.preventDefault();
            }
          }}
          // Keep at most two digits after the decimal point
          onChange={(e) => {
            const [whole, pence] = e.target.value.split(".");
            setCard(
              pence && pence.length > 2
                ? whole + "." + pence.slice(0, 2)
                : e.target.value,
            );
          }}
        />
      </label>
      <div className="summary-row cash">
        <span>Cash (the rest)</span>
        <span>{pounds(cash)}</span>
      </div>
      {error && <p className="takings-error">{error}</p>}
      {confirming ? (
        <div className="confirm-box">
          <p>
            Save card {pounds(Number(card))}, cash {pounds(cash)} and day total{" "}
            {pounds(dayTotal)} for this day?
          </p>
          <div className="form-actions">
            <button type="button" onClick={() => setConfirming(false)}>
              Go back
            </button>
            <button type="submit" className="confirm-button">
              Confirm
            </button>
          </div>
        </div>
      ) : (
        <div className="form-actions">
          {editing && (
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
          <button type="submit">Save</button>
        </div>
      )}
    </form>
  );
}
