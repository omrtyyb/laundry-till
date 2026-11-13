// Admin → Tickets → Ticket summary: every dry cleaning or service wash ticket made between
// two dates and times, with each ticket's id, clothes (or load) details, pieces and price,
// and the total pieces and money at the end. Paid or not doesn't matter; cancelled tickets
// are left out. "Export as PDF" downloads the same summary.

import { useEffect, useState } from "react";
import { pounds } from "../utils/money.js";
import { todayString } from "../utils/dates.js";

const KINDS = [
  { id: "dryCleaning", label: "Dry cleaning" },
  { id: "serviceWash", label: "Service wash" },
];

// Now, as the date and time boxes want it, e.g. "2026-10-26T17:40"
function nowForBox() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${todayString()}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// "2026-10-26 09:05:12" becomes "26 Oct, 09:05"
function shortWhen(time) {
  return (
    new Date(time.slice(0, 10) + "T12:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    }) +
    ", " +
    time.slice(11, 16)
  );
}

export default function TicketSummary() {
  const [kind, setKind] = useState("dryCleaning");
  // From the start of today until now, to begin with
  const [from, setFrom] = useState(todayString() + "T00:00");
  const [to, setTo] = useState(nowForBox());
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const query = new URLSearchParams({ kind, from, to }).toString();

  // Load the summary again whenever the kind or the times change
  useEffect(() => {
    let current = true;
    fetch("/api/reports/ticket-summary?" + query).then(async (response) => {
      const data = await response.json();
      if (!current) return;
      if (response.ok) {
        setSummary(data);
        setError(null);
      } else {
        setSummary(null);
        setError(data.error);
      }
    });
    return () => {
      current = false;
    };
  }, [query]);

  const isDryCleaning = kind === "dryCleaning";

  return (
    <section className="report">
      <div className="report-controls">
        {KINDS.map((item) => (
          <button
            key={item.id}
            className={
              "sort-button " + item.id + (kind === item.id ? " active" : "")
            }
            onClick={() => setKind(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="summary-times">
        <label>
          From
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Until
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <a
          className="download-button"
          href={"/api/reports/ticket-summary-pdf?" + query}
          download
        >
          Export as PDF
        </a>
      </div>

      {error && <p className="takings-error">{error}</p>}

      {summary && (
        <>
          <div className="report-cards">
            <div className="report-card">
              <span>Tickets</span>
              <strong>{summary.totals.tickets}</strong>
            </div>
            {isDryCleaning && (
              <div className="report-card">
                <span>Pieces</span>
                <strong>{summary.totals.pieces}</strong>
              </div>
            )}
            <div className="report-card">
              <span>Total money</span>
              <strong>{pounds(summary.totals.money)}</strong>
            </div>
          </div>

          {summary.tickets.length === 0 ? (
            <p>No tickets in this time.</p>
          ) : (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Ticket id</th>
                    <th>Made</th>
                    <th>Customer</th>
                    <th>{isDryCleaning ? "Clothes details" : "Load details"}</th>
                    {isDryCleaning && <th>Pieces</th>}
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>{ticket.id}</td>
                      <td>{shortWhen(ticket.created_at)}</td>
                      <td>{ticket.customer_name}</td>
                      <td className="wrap">{ticket.description}</td>
                      {isDryCleaning && <td>{ticket.pieces}</td>}
                      <td>{pounds(ticket.price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan={3}>
                      Total: {summary.totals.tickets} tickets
                    </td>
                    <td></td>
                    {isDryCleaning && <td>{summary.totals.pieces}</td>}
                    <td>{pounds(summary.totals.money)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
