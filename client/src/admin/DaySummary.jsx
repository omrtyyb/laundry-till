// Admin report: one day's totals, chosen with a date picker.

import { useEffect, useState } from "react";
import { todayString } from "../utils/dates.js";
import { pounds } from "../utils/money.js";
import TakingsForm from "./TakingsForm.jsx";
import { CashResult } from "../till/CashDrawerForm.jsx";
import { request } from "../utils/api.js";

// Admin "Day summary": the totals for one day, chosen with the date picker.
// startDate is the day to show first (today if not given).
export default function DaySummary({ startDate }) {
  const [date, setDate] = useState(startDate || todayString());
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  // Load the totals for the chosen date, and again whenever the date changes
  useEffect(() => {
    request("/api/daily-summary?date=" + date).then(({ ok, data }) => {
      if (ok) {
        setSummary(data);
      } else {
        setError(data.error);
      }
    });
  }, [date]);

  return (
    <>
      <label className="date-picker">
        Show totals for
        <input
          type="date"
          value={date}
          max={todayString()}
          // Ignore an emptied box, so there is always a date chosen
          onChange={(e) => {
            if (!e.target.value) return;
            // Clear the old totals while the new day loads
            setSummary(null);
            setError(null);
            setDate(e.target.value);
          }}
        />
      </label>

      {error ? (
        <p>{error}</p>
      ) : summary === null ? (
        <p>Loading…</p>
      ) : (
        <section className="summary">
          <h2>
            {date === todayString()
              ? "Today's totals"
              : "Totals for " + new Date(date).toLocaleDateString("en-GB")}
          </h2>
          <div className="summary-row income dryCleaning">
            <span>Dry cleaning (paid)</span>
            <span>{pounds(summary.dryCleaning)}</span>
          </div>
          <div className="summary-row income serviceWash">
            <span>Service washes (paid)</span>
            <span>{pounds(summary.serviceWash)}</span>
          </div>
          <div className="summary-row income products">
            <span>Product sales</span>
            <span>{pounds(summary.sales)}</span>
          </div>
          {summary.salesByItem.map((item) => (
            <div className="summary-row sub-row" key={item.item_name}>
              <span>
                {item.item_name} × {item.quantity}
              </span>
              <span>{pounds(item.total)}</span>
            </div>
          ))}
          <div className="summary-row spending">
            <span>Spent from the till</span>
            <span>−{pounds(summary.spending)}</span>
          </div>
          <div className="summary-row day-total">
            <span>Total for the day</span>
            <span>{pounds(summary.dayTotal)}</span>
          </div>
          <TakingsForm
            // A new date starts a fresh form with that day's saved numbers
            key={date}
            date={date}
            dayTotal={summary.dayTotal}
            saved={summary.takings}
          />
          {/* The opening float and end of day count, saved at the till's Cash Drawer button */}
          <section className="takings">
            <h2>Cash drawer</h2>
            {summary.cashDrawer ? (
              <CashResult drawer={summary.cashDrawer} />
            ) : (
              <p className="report-note">No float or cash count was saved at the till for this day.</p>
            )}
          </section>
        </section>
      )}
    </>
  );
}
