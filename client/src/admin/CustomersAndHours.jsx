// Admin report: the top 10 customers by money spent (matched by phone number),
// and how many tickets are made in each hour of the day.

import { useEffect, useState } from "react";
import { shortDayName } from "../utils/dates.js";
import { pounds } from "../utils/money.js";
import { loadJson } from "../utils/api.js";

export default function CustomersAndHours() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    loadJson("/api/reports/customers")
      .then((data) => setReport(data));
  }, []);

  if (report === null) {
    return <p>Loading…</p>;
  }

  // Only show the hours from the first to the last one that had tickets, e.g. 8am to 8pm
  const busy = report.hours.filter((item) => item.count > 0);
  const hours = busy.length
    ? report.hours.slice(busy[0].hour, busy[busy.length - 1].hour + 1)
    : [];
  const most = Math.max(1, ...hours.map((item) => item.count));
  const hourLabel = (hour) =>
    hour === 0
      ? "12am"
      : hour < 12
        ? `${hour}am`
        : hour === 12
          ? "12pm"
          : `${hour - 12}pm`;

  // Chart size in SVG units; it stretches to the width of the page
  const width = 900;
  const height = 240;
  const bottom = 28;
  const slot = hours.length ? width / hours.length : width;
  const barWidth = Math.min(40, slot * 0.6);

  return (
    <section className="report">
      <h2>Top customers</h2>
      <p className="report-note">
        Matched by phone number. Only paid tickets count towards money spent.
      </p>
      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Tickets</th>
              <th>Spent</th>
              <th>Last visit</th>
            </tr>
          </thead>
          <tbody>
            {report.customers.map((customer, index) => (
              <tr key={customer.phone_number}>
                <td>{index + 1}</td>
                <td>{customer.customer_name}</td>
                <td>{customer.phone_number}</td>
                <td>{customer.visits}</td>
                <td>
                  <strong>{pounds(customer.spent)}</strong>
                </td>
                <td>{shortDayName(customer.last_visit.slice(0, 10))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Busiest hours</h2>
      <p className="report-note">
        How many tickets were made in each hour of the day, all days added
        together.
      </p>
      {hours.length === 0 ? (
        <p>No tickets yet.</p>
      ) : (
        <svg
          className="days-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Tickets made in each hour of the day"
        >
          {hours.map((item, index) => {
            const barHeight = ((height - bottom - 24) * item.count) / most;
            const x = index * slot + (slot - barWidth) / 2;
            const y = height - bottom - barHeight;
            return (
              <g key={item.hour}>
                <title>
                  {hourLabel(item.hour)}: {item.count} ticket
                  {item.count === 1 ? "" : "s"}
                </title>
                {item.count > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="3"
                    fill="#2a78d6"
                  />
                )}
                {/* The number of tickets above each bar */}
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  className="axis-label middle"
                >
                  {item.count}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={height - 8}
                  className="axis-label middle"
                >
                  {hourLabel(item.hour)}
                </text>
              </g>
            );
          })}
          <line
            x1="0"
            x2={width}
            y1={height - bottom}
            y2={height - bottom}
            className="zero-line"
          />
        </svg>
      )}
    </section>
  );
}
