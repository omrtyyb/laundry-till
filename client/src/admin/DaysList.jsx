// Admin report: one row per day of a month with its total, card and cash.
// Past days that had takings but were never closed are flagged.
// Clicking a row opens that day in the Day summary.

import { useEffect, useState } from "react";
import { shortDayName, thisMonthString, todayString } from "../utils/dates.js";
import { pounds } from "../utils/money.js";
import MonthPicker from "./MonthPicker.jsx";

export default function DaysList({ onOpenDay }) {
  const [month, setMonth] = useState(thisMonthString());
  const [report, setReport] = useState(null);

  useEffect(() => {
    fetch("/api/reports/days?month=" + month)
      .then((response) => response.json())
      .then((data) => setReport(data));
  }, [month]);

  const notClosed = report?.days
    ? report.days.filter((day) => day.needsClosing).length
    : 0;

  return (
    <section className="report">
      <h2>Days list: card &amp; cash check</h2>
      <MonthPicker
        month={month}
        onChange={(value) => {
          setReport(null);
          setMonth(value);
        }}
      />

      {report === null || report.days === undefined ? (
        <p>Loading…</p>
      ) : (
        <>
          {notClosed > 0 ? (
            <p className="report-warning">
              {notClosed} day{notClosed === 1 ? " was" : "s were"} never closed,
              so the card amount is missing. Click a day to open it and enter
              the card total.
            </p>
          ) : (
            <p className="report-note">
              Every past day with takings is closed.
            </p>
          )}

          <div className="report-table-wrap">
            <table className="report-table clickable">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Day total</th>
                  <th>Tickets</th>
                  <th>Card</th>
                  <th>Cash</th>
                  <th>Cash count</th>
                  <th>Closed?</th>
                </tr>
              </thead>
              <tbody>
                {report.days.map((day) => (
                  <tr
                    key={day.date}
                    className={day.needsClosing ? "flagged" : ""}
                    onClick={() => onOpenDay(day.date)}
                    title="Open this day"
                  >
                    <td>{shortDayName(day.date)}</td>
                    <td>{pounds(day.dayTotal)}</td>
                    <td>{day.tickets}</td>
                    <td>{day.card === null ? "–" : pounds(day.card)}</td>
                    <td>{day.cash === null ? "–" : pounds(day.cash)}</td>
                    {/* counted - what the drawer should hold: green if it matched, red if not */}
                    <td>
                      {day.cashDifference === null ? (
                        "–"
                      ) : day.cashDifference === 0 ? (
                        <span className="cash-diff-text ok">✓ matched</span>
                      ) : (
                        <span className="cash-diff-text off">
                          {day.cashDifference < 0
                            ? `−${pounds(-day.cashDifference)} short`
                            : `+${pounds(day.cashDifference)} over`}
                        </span>
                      )}
                    </td>
                    <td>
                      {day.closed ? (
                        "✓ Closed"
                      ) : day.needsClosing ? (
                        <span className="badge warning">Not closed</span>
                      ) : day.date === todayString() ? (
                        "Open today"
                      ) : (
                        "No takings"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
