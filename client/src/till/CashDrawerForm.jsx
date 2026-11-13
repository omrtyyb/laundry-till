// Pop-up for the till's "Cash Drawer" button:
//   - Morning: the opening float, the change put in the drawer (suggests what was left in last night)
//   - Closing: count the cash, either as one total or note by note, type the card machine total
//     (unless the day was already closed in Admin) and how much is left in for tomorrow.
// The count is "blind": what the drawer should hold, and any difference, are shown only after
// the count is saved, so the count isn't nudged towards the expected number.

import { useEffect, useState } from "react";
import { pounds } from "../utils/money.js";
import { showToast } from "../utils/toast.js";
import Overlay from "../Overlay.jsx";

// "0.5" becomes "50p", "20" becomes "£20"
const coinLabel = (value) => (value >= 1 ? `£${value}` : `${Math.round(value * 100)}p`);

// A money box that only takes pounds and pence
function MoneyInput({ value, onChange, ...rest }) {
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      inputMode="decimal"
      placeholder="0.00"
      value={value}
      onKeyDown={(e) => ["e", "E", "-", "+"].includes(e.key) && e.preventDefault()}
      onChange={(e) => {
        const [whole, pence] = e.target.value.split(".");
        onChange(pence && pence.length > 2 ? whole + "." + pence.slice(0, 2) : e.target.value);
      }}
      {...rest}
    />
  );
}

// The result of a count: float + cash taken = should hold, counted, difference, banked.
// Also used in Admin → Day summary.
export function CashResult({ drawer }) {
  const diff = drawer.difference;
  return (
    <div className="cash-result">
      <div className="summary-row">
        <span>Opening float</span>
        <span>{drawer.opening_float === null ? "–" : pounds(drawer.opening_float)}</span>
      </div>
      <div className="summary-row">
        <span>+ Cash taken today</span>
        <span>{drawer.cash_taken === null ? "card amount not saved yet" : pounds(drawer.cash_taken)}</span>
      </div>
      <div className="summary-row">
        <span>= Should be in the drawer</span>
        <span>{drawer.should_hold === null ? "–" : pounds(drawer.should_hold)}</span>
      </div>
      <div className="summary-row">
        <span>Counted</span>
        <span>{drawer.counted === null ? "Not counted yet" : pounds(drawer.counted)}</span>
      </div>
      {diff !== null && (
        <div className={"summary-row cash-diff " + (diff === 0 ? "ok" : "off")}>
          <span>Difference</span>
          <span>
            {diff === 0 ? "£0.00 ✓ matches" : diff < 0 ? `−${pounds(-diff)} short` : `+${pounds(diff)} over`}
          </span>
        </div>
      )}
      {drawer.left_in !== null && (
        <div className="summary-row sub-row">
          <span>Left in for tomorrow</span>
          <span>{pounds(drawer.left_in)}</span>
        </div>
      )}
      {drawer.banked !== null && (
        <div className="summary-row sub-row">
          <span>Taken out to bank</span>
          <span>{pounds(drawer.banked)}</span>
        </div>
      )}
      {drawer.note && <p className="report-note">Note: {drawer.note}</p>}
      {drawer.counted_at && (
        <p className="report-note">
          Counted {drawer.counted_at.slice(11, 16)}
          {drawer.counted_by_name ? ` by ${drawer.counted_by_name}` : ""}
          {drawer.float_by_name ? ` · float by ${drawer.float_by_name}` : ""}
        </p>
      )}
    </div>
  );
}

export default function CashDrawerForm({ onClose }) {
  const [drawer, setDrawer] = useState(null);
  const [floatAmount, setFloatAmount] = useState("");
  const [editingFloat, setEditingFloat] = useState(false);
  // Counting: one total, or note by note
  const [byCoins, setByCoins] = useState(false);
  const [counted, setCounted] = useState("");
  const [coins, setCoins] = useState({});
  const [card, setCard] = useState("");
  const [leftIn, setLeftIn] = useState("");
  const [note, setNote] = useState("");
  const [counting, setCounting] = useState(false);
  const [error, setError] = useState(null);

  const load = () =>
    fetch("/api/cash-drawer")
      .then((response) => response.json())
      .then((data) => {
        setDrawer(data);
        const start = data.opening_float ?? data.suggested_float;
        setFloatAmount(start === null ? "" : String(start));
        setLeftIn(start === null ? "" : String(start));
        setCounting(data.count === null);
      });

  useEffect(() => {
    load();
  }, []);

  if (drawer === null) {
    return (
      <Overlay onClose={onClose}>
        <div className="ticket-form cash-drawer">
          <p>Loading…</p>
        </div>
      </Overlay>
    );
  }

  const coinTotal =
    Math.round(
      drawer.denominations.reduce((sum, value) => sum + value * (Number(coins[value]) || 0), 0) * 100,
    ) / 100;
  const total = byCoins ? coinTotal : Number(counted || 0);

  const post = async (url, body) => {
    setError(null);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error);
      return null;
    }
    return data;
  };

  const saveFloat = async () => {
    if (floatAmount === "") return setError("Please enter the float");
    if (await post("/api/cash-drawer/float", { amount: Number(floatAmount) })) {
      showToast(`Opening float ${pounds(Number(floatAmount))} saved`);
      setEditingFloat(false);
      load();
    }
  };

  const saveCount = async (e) => {
    e.preventDefault();
    const breakdown = byCoins
      ? Object.fromEntries(
          drawer.denominations.filter((v) => Number(coins[v]) > 0).map((v) => [String(v), Number(coins[v])]),
        )
      : null;
    const body = { counted: total, left_in: Number(leftIn || 0), note };
    if (breakdown) body.breakdown = breakdown;
    if (drawer.opening_float === null) body.opening_float = Number(floatAmount || 0);
    if (!drawer.card_saved) body.card_total = Number(card || 0);
    const result = await post("/api/cash-drawer/count", body);
    if (result) {
      showToast("Cash count saved");
      load();
    }
  };

  const floatSet = drawer.opening_float !== null;

  return (
    <Overlay onClose={onClose}>
      <div className="ticket-form cash-drawer">
        <h2>Cash Drawer</h2>
        {error && <p className="takings-error">{error}</p>}

        <h3>Morning: opening float</h3>
        {floatSet && !editingFloat ? (
          <div className="form-actions">
            <span>
              <strong>{pounds(drawer.opening_float)}</strong> in the drawer this morning
              {drawer.float_by_name ? ` (${drawer.float_by_name})` : ""}
            </span>
            <button type="button" onClick={() => setEditingFloat(true)}>
              Change
            </button>
          </div>
        ) : (
          <>
            <label>
              Cash in the drawer at the start of the day (change)
              <MoneyInput value={floatAmount} onChange={setFloatAmount} />
              {drawer.suggested_float !== null && (
                <small>Last night {pounds(drawer.suggested_float)} was left in.</small>
              )}
            </label>
            <div className="form-actions">
              <button type="button" className="confirm-button" onClick={saveFloat}>
                Save float
              </button>
            </div>
          </>
        )}

        <h3>Closing: count the cash</h3>
        {!counting ? (
          <>
            <CashResult drawer={drawer.count} />
            <div className="form-actions">
              <button type="button" onClick={() => setCounting(true)}>
                Count again
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={saveCount} className="cash-count-form">
            <div className="cash-count-mode">
              <button type="button" className={byCoins ? "" : "chosen"} onClick={() => setByCoins(false)}>
                One total
              </button>
              <button type="button" className={byCoins ? "chosen" : ""} onClick={() => setByCoins(true)}>
                Notes &amp; coins
              </button>
            </div>
            {byCoins ? (
              <div className="coin-grid">
                {drawer.denominations.map((value) => (
                  <label key={value}>
                    {coinLabel(value)} ×
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={coins[value] ?? ""}
                      onKeyDown={(e) => ["e", "E", "-", "+", "."].includes(e.key) && e.preventDefault()}
                      onChange={(e) => setCoins({ ...coins, [value]: e.target.value })}
                    />
                  </label>
                ))}
                <p className="coin-total">
                  Counted: <strong>{pounds(coinTotal)}</strong>
                </p>
              </div>
            ) : (
              <label>
                Cash counted in the drawer
                <MoneyInput value={counted} onChange={setCounted} required />
              </label>
            )}
            {!floatSet && (
              <label>
                This morning's float (no float was saved today)
                <MoneyInput value={floatAmount} onChange={setFloatAmount} required />
              </label>
            )}
            {!drawer.card_saved && (
              <label>
                Card machine total for today
                <MoneyInput value={card} onChange={setCard} required />
                <small>Saving the count also closes the day with this card amount.</small>
              </label>
            )}
            <label>
              Cash left in for tomorrow
              <MoneyInput value={leftIn} onChange={setLeftIn} required />
              <small>The rest ({pounds(Math.max(0, total - Number(leftIn || 0)))}) is taken out to bank.</small>
            </label>
            <label>
              Note (optional)
              <input type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="form-actions">
              {drawer.count && (
                <button type="button" onClick={() => setCounting(false)}>
                  Back
                </button>
              )}
              <button type="submit">Save count</button>
            </div>
          </form>
        )}

        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Overlay>
  );
}
