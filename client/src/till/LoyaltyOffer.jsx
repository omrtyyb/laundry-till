// On the new ticket form: where the customer stands with the loyalty reward for this kind of
// ticket (set in Admin → Loyalty rewards). When the reward is due, a box lets the worker
// choose to give it; otherwise a short line says how many tickets to go.
// Nothing is shown when no reward is switched on, or before the name and phone are filled in.

import { pounds } from "../utils/money.js";
import { ordinal } from "../admin/LoyaltyRewards.jsx";

// status comes from /api/loyalty/status; give and onGive are the worker's choice;
// fullPrice is the price before any discount, to show the money off
export default function LoyaltyOffer({ status, label, give, onGive, fullPrice }) {
  if (!status?.active) return null;
  if (!status.due) {
    return (
      <p className="loyalty-progress">
        Loyalty: {status.count} of {status.every - 1} {label} tickets so far · {status.toGo}{" "}
        more until {status.percent}% off
      </p>
    );
  }
  const amount = Math.round(fullPrice * status.percent) / 100;
  return (
    <div className="loyalty-offer">
      <strong>
        🎉 Loyalty reward: this is their {ordinal(status.every)} {label} ticket, so they can have{" "}
        {status.percent}% off.
      </strong>
      <label className="checkbox-label">
        <input type="checkbox" checked={give} onChange={(e) => onGive(e.target.checked)} />
        Give the {status.percent}% discount{fullPrice > 0 ? ` (${pounds(amount)} off)` : ""}
      </label>
      {!give && <small>Not given now: it will be offered again on their next {label} ticket.</small>}
    </div>
  );
}
