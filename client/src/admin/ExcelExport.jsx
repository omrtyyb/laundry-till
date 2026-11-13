// Admin "Export to Excel": downloads an Excel file of everything between two dates, with a
// sheet each for daily money, dry cleaning tickets, service wash tickets, sales, till spending
// and customers (see server/reports/excelExport.js).

import { useState } from "react";
import { todayString } from "../utils/dates.js";
import { showToast } from "../utils/toast.js";

const pad = (n) => String(n).padStart(2, "0");
const dateString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Ready-made date ranges for the buttons above the date boxes
function quickRanges() {
  const now = new Date();
  const today = todayString();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  return [
    ["Today", today, today],
    ["This week", dateString(monday), today],
    ["This month", today.slice(0, 8) + "01", today],
    ["Last month", dateString(lastMonthStart), dateString(lastMonthEnd)],
    ["This year", today.slice(0, 5) + "01-01", today],
  ];
}

const SHEETS = [
  ["Daily money", "each day's money from dry cleaning, service wash, products and machines, till spending, the day total, card and cash"],
  ["Dry cleaning", "every ticket made, with prices, discounts, deposits, paid and collected"],
  ["Service wash", "the same for service wash tickets"],
  ["Sales", "every product sold and the machine money"],
  ["Till spending", "money taken out of the till"],
  ["Customers", "each customer's tickets and money in those dates"],
];

export default function ExcelExport() {
  const today = todayString();
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [downloading, setDownloading] = useState(false);

  const download = async (e) => {
    e.preventDefault();
    setDownloading(true);
    try {
      const response = await fetch(`/api/reports/excel?from=${from}&to=${to}`);
      if (!response.ok) throw new Error((await response.json()).error);
      // Save the file with the name the server gave it
      const name =
        response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || "laundry-till.xlsx";
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
      showToast("Excel file downloaded");
    } catch (err) {
      showToast(err.message || "The till server is not answering", "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="report">
      <h2>Export to Excel</h2>
      <p className="report-note">
        Download everything between two dates as an Excel file. It opens in Excel, Numbers or
        Google Sheets.
      </p>
      <div className="report-controls">
        {quickRanges().map(([label, start, end]) => (
          <button
            key={label}
            type="button"
            className={"sort-button" + (from === start && to === end ? " active" : "")}
            onClick={() => {
              setFrom(start);
              setTo(end);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <form className="excel-export-form" onSubmit={download}>
        <label>
          From
          <input type="date" required max={to} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" required min={from} max={today} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="submit" className="confirm-button" disabled={downloading}>
          {downloading ? "Making the file…" : "Download Excel file"}
        </button>
      </form>
      <h3>What's in the file</h3>
      <ul className="excel-sheets">
        {SHEETS.map(([name, about]) => (
          <li key={name}>
            <strong>{name}:</strong> {about}
          </li>
        ))}
      </ul>
      <p className="report-note">Each sheet has totals at the bottom and filter buttons on every column.</p>
    </section>
  );
}
