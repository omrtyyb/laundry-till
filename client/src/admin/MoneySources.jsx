// Admin report: where the money comes from, as each kind of income's share (%)
// of a chosen day, week or month.

import { useEffect, useState } from "react";
import { shortDayName, todayString } from "../utils/dates.js";
import { pounds } from "../utils/money.js";
import { CHART_PARTS } from "./chartColors.js";

const PERIODS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export default function MoneySources() {
  const [period, setPeriod] = useState("week");
  const [date, setDate] = useState(todayString());
  const [report, setReport] = useState(null);

  useEffect(() => {
    fetch(`/api/reports/share?period=${period}&date=${date}`)
      .then((response) => response.json())
      .then((data) => setReport(data));
  }, [period, date]);

  // The colour and label for each part the server sends back
  const partInfo = (key) => CHART_PARTS.find((part) => part.key === key);

  return (
    <section className="report">
      <h2>Where the money comes from</h2>

      <div className="report-controls">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            className={"sort-button" + (period === item.id ? " active" : "")}
            onClick={() => setPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}
        <label className="date-picker small">
          {period === "week"
            ? "Week ending"
            : period === "month"
              ? "Month of"
              : "Day"}
          <input
            type="date"
            value={date}
            max={todayString()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
      </div>

      {report === null || report.parts === undefined ? (
        <p>Loading…</p>
      ) : (
        <>
          <p className="report-note">
            {report.from === report.to
              ? shortDayName(report.from)
              : `${shortDayName(report.from)} to ${shortDayName(report.to)}`}{" "}
            · money in {pounds(report.income)}
          </p>

          {report.income === 0 ? (
            <p>No money came in during this time.</p>
          ) : (
            <>
              {/* One long bar split into each kind's share */}
              <div className="share-bar">
                {report.parts
                  .filter((part) => part.amount > 0)
                  .map((part) => (
                    <div
                      key={part.key}
                      className="share-part"
                      style={{
                        width: part.percent + "%",
                        background: partInfo(part.key).color,
                      }}
                      title={`${partInfo(part.key).label}: ${part.percent}% (${pounds(part.amount)})`}
                    >
                      {/* Only write the % inside parts wide enough to fit it */}
                      {part.percent >= 8 && <span>{part.percent}%</span>}
                    </div>
                  ))}
              </div>

              <div className="summary">
                {report.parts.map((part) => (
                  <div className="summary-row share-row" key={part.key}>
                    <span>
                      <i
                        className="swatch"
                        style={{ background: partInfo(part.key).color }}
                      />{" "}
                      {partInfo(part.key).label}
                    </span>
                    <span>
                      <strong>{part.percent}%</strong> · {pounds(part.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
