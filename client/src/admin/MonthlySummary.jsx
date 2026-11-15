// Admin report: one month's totals, tickets, best and worst day, and card vs cash,
// with a button to download the month as a PDF.

import { useEffect, useState } from "react";
import { monthName, shortDayName, thisMonthString } from "../utils/dates.js";
import { pounds } from "../utils/money.js";
import { CHART_PARTS } from "./chartColors.js";
import MonthPicker from "./MonthPicker.jsx";
import { request } from "../utils/api.js";

export default function MonthlySummary() {
  const [month, setMonth] = useState(thisMonthString());
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  // Load the chosen month, and again whenever the month changes
  useEffect(() => {
    request("/api/reports/month?month=" + month).then(({ ok, data }) => {
      if (ok) {
        setReport(data);
      } else {
        setError(data.error);
      }
    });
  }, [month]);

  return (
    <section className="report">
      <h2>Monthly summary</h2>
      <div className="report-controls">
        <MonthPicker
          month={month}
          onChange={(value) => {
            // Clear the old month while the new one loads
            setReport(null);
            setError(null);
            setMonth(value);
          }}
        />
        {/* Downloads this month as a PDF: a summary page, then a table of every day */}
        <a
          className="download-button"
          href={"/api/reports/month-pdf?month=" + month}
          download={`laundry-till-${month}.pdf`}
        >
          Download PDF
        </a>
      </div>

      {error ? (
        <p>{error}</p>
      ) : report === null ? (
        <p>Loading…</p>
      ) : (
        <>
          <h3>{monthName(report.month)}</h3>

          <div className="report-cards">
            <div className="report-card">
              <span>Money in</span>
              <strong>{pounds(report.totals.income)}</strong>
            </div>
            <div className="report-card overdue">
              <span>Spent from the till</span>
              <strong>−{pounds(report.totals.spending)}</strong>
            </div>
            <div className="report-card dark">
              <span>Total for the month</span>
              <strong>{pounds(report.totals.total)}</strong>
            </div>
          </div>

          <div className="summary">
            {CHART_PARTS.map((part) => (
              <div className={"summary-row income " + part.key} key={part.key}>
                <span>
                  <i className="swatch" style={{ background: part.color }} />{" "}
                  {part.label}
                </span>
                <span>{pounds(report.totals[part.key])}</span>
              </div>
            ))}
          </div>

          <div className="report-cards">
            <div className="report-card">
              <span>Tickets made</span>
              <strong>{report.tickets.count}</strong>
              <small>
                {report.tickets.dryCleaning} dry cleaning ·{" "}
                {report.tickets.serviceWash} service wash
              </small>
            </div>
            <div className="report-card">
              <span>Average ticket price</span>
              <strong>{pounds(report.tickets.averagePrice)}</strong>
            </div>
            <div className="report-card">
              <span>Days with takings</span>
              <strong>{report.activeDays}</strong>
            </div>
          </div>

          <div className="report-cards two">
            <div className="report-card good">
              <span>Best day</span>
              {report.bestDay ? (
                <>
                  <strong>{pounds(report.bestDay.total)}</strong>
                  <small>{shortDayName(report.bestDay.date)}</small>
                </>
              ) : (
                <strong>–</strong>
              )}
            </div>
            <div className="report-card">
              <span>Worst day</span>
              {report.worstDay ? (
                <>
                  <strong>{pounds(report.worstDay.total)}</strong>
                  <small>{shortDayName(report.worstDay.date)}</small>
                </>
              ) : (
                <strong>–</strong>
              )}
            </div>
          </div>

          <h3>Card and cash</h3>
          <div className="summary">
            <div className="summary-row card">
              <span>Card</span>
              <span>{pounds(report.takings.card)}</span>
            </div>
            <div className="summary-row cash">
              <span>Cash</span>
              <span>{pounds(report.takings.cash)}</span>
            </div>
          </div>
          {/* Card and cash only exist for days the admin closed, so say how many that is */}
          <p className="report-note">
            From the {report.takings.closedDays} closed day
            {report.takings.closedDays === 1 ? "" : "s"} out of{" "}
            {report.activeDays} days with takings. Days that weren't closed have
            no card amount, so they aren't counted here.
          </p>
        </>
      )}
    </section>
  );
}
