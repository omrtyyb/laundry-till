// Admin report: bar chart of the last 7 or 30 days.

import { useEffect, useRef, useState } from "react";
import { pounds } from "../utils/money.js";
import { CHART_PARTS, SPENDING_COLOR } from "./chartColors.js";

// Admin "Last 7 / 30 days chart": one bar per day, split by where the money came from
export default function DaysChart() {
  const [numberOfDays, setNumberOfDays] = useState(7);
  const [days, setDays] = useState(null);
  // The day under the mouse, shown in the box under the chart
  const [hovered, setHovered] = useState(null);
  const [showTable, setShowTable] = useState(false);
  // The small label next to the mouse when pointing at one coloured part of a bar
  const [tip, setTip] = useState(null);
  const chartBox = useRef(null);

  useEffect(() => {
    fetch("/api/daily-chart?days=" + numberOfDays)
      .then((response) => response.json())
      .then((data) => setDays(data));
  }, [numberOfDays]);

  if (days === null) {
    return <p>Loading…</p>;
  }

  // Chart size in SVG units; it stretches to the width of the page
  const width = 900;
  const height = 360;
  const left = 64; // room for the £ labels
  const top = 16;
  const bottom = 40; // room for the day labels

  // The highest income and the most spending decide the scale
  const income = (day) =>
    CHART_PARTS.reduce((sum, part) => sum + day[part.key], 0);
  const maxUp = Math.max(
    10,
    ...days.map(income),
    ...days.map((day) => day.weekBeforeTotal),
  );
  const maxDown = Math.max(0, ...days.map((day) => day.spending));
  const plotHeight = height - top - bottom;
  const scale = plotHeight / (maxUp + maxDown);
  const zeroY = top + maxUp * scale; // where £0 is
  const y = (amount) => zeroY - amount * scale;

  const slot = (width - left) / days.length;
  const barWidth = Math.min(48, slot * 0.6);
  const barX = (index) => left + index * slot + (slot - barWidth) / 2;
  const centerX = (index) => left + index * slot + slot / 2;

  // Up to four £ lines above zero, at round amounts like £50, £100, £250
  const step =
    [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find(
      (size) => size * 4 >= maxUp,
    ) || 10000;
  const gridLines = [1, 2, 3, 4].map((n) => n * step).filter((v) => v <= maxUp);

  const dayLabel = (date) => {
    const d = new Date(date + "T12:00:00");
    return numberOfDays === 7
      ? d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })
      : String(d.getDate());
  };

  const linePoints = days
    .map((day, index) => `${centerX(index)},${y(day.weekBeforeTotal)}`)
    .join(" ");

  const shown = hovered === null ? null : days[hovered];

  // Put the small label just beside the mouse, inside the chart box
  const showTip = (event, text) => {
    const box = chartBox.current.getBoundingClientRect();
    const mouseX = event.clientX - box.left;
    // Near the right edge, show the label on the left of the mouse instead
    const onLeft = mouseX > box.width - 200;
    setTip({
      text,
      x: onLeft ? mouseX - 14 : mouseX + 14,
      y: event.clientY - box.top + 14,
      onLeft,
    });
  };
  const hideTip = () => setTip(null);

  return (
    <section className="report">
      <h2>Last {numberOfDays} days</h2>

      <div className="report-controls">
        {[7, 30].map((n) => (
          <button
            key={n}
            className={"sort-button" + (numberOfDays === n ? " active" : "")}
            onClick={() => {
              setHovered(null);
              setNumberOfDays(n);
            }}
          >
            {n} days
          </button>
        ))}
        <button
          className="sort-button"
          onClick={() => setShowTable(!showTable)}
        >
          {showTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      <div className="chart-legend">
        {CHART_PARTS.map((part) => (
          <span key={part.key}>
            <i style={{ background: part.color }} /> {part.label}
          </span>
        ))}
        <span>
          <i style={{ background: SPENDING_COLOR }} /> Till spending (below the
          line)
        </span>
        <span>
          <i className="legend-line" /> Day total, same day the week before
        </span>
      </div>

      {showTable ? (
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Day</th>
                {CHART_PARTS.map((part) => (
                  <th key={part.key}>{part.label}</th>
                ))}
                <th>Spending</th>
                <th>Day total</th>
                <th>Week before</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date}>
                  <td>
                    {new Date(day.date + "T12:00:00").toLocaleDateString(
                      "en-GB",
                      { weekday: "short", day: "numeric", month: "short" },
                    )}
                  </td>
                  {CHART_PARTS.map((part) => (
                    <td key={part.key}>{pounds(day[part.key])}</td>
                  ))}
                  <td>−{pounds(day.spending)}</td>
                  <td>
                    <strong>{pounds(day.dayTotal)}</strong>
                  </td>
                  <td>{pounds(day.weekBeforeTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="chart-box" ref={chartBox}>
            <svg
              className="days-chart"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`Takings for each of the last ${numberOfDays} days`}
              onMouseLeave={() => {
                setHovered(null);
                hideTip();
              }}
            >
              {/* £ grid lines and labels */}
              {gridLines.map((value) => (
                <g key={value}>
                  <line
                    x1={left}
                    x2={width}
                    y1={y(value)}
                    y2={y(value)}
                    className="grid-line"
                  />
                  <text
                    x={left - 8}
                    y={y(value) + 4}
                    className="axis-label end"
                  >
                    £{value}
                  </text>
                </g>
              ))}

              {days.map((day, index) => {
                // Stack the income parts upwards from £0, leaving a 2px gap between them
                let stackTop = 0;
                return (
                  <g
                    key={day.date}
                    className={hovered === index ? "bar hovered" : "bar"}
                    onMouseEnter={() => setHovered(index)}
                  >
                    {/* An invisible full-height area, so the whole column reacts to the mouse */}
                    <rect
                      x={left + index * slot}
                      y={top}
                      width={slot}
                      height={plotHeight}
                      fill="transparent"
                    />
                    {CHART_PARTS.map((part) => {
                      const value = day[part.key];
                      if (value <= 0) return null;
                      const y1 = y(stackTop + value);
                      const h = Math.max(1, value * scale - 2);
                      stackTop += value;
                      return (
                        <rect
                          key={part.key}
                          x={barX(index)}
                          y={y1}
                          width={barWidth}
                          height={h}
                          rx="3"
                          fill={part.color}
                          onMouseMove={(e) =>
                            showTip(e, `${part.label}: ${pounds(value)}`)
                          }
                          onMouseLeave={hideTip}
                        />
                      );
                    })}
                    {day.spending > 0 && (
                      <rect
                        x={barX(index)}
                        y={zeroY + 2}
                        width={barWidth}
                        height={Math.max(1, day.spending * scale - 2)}
                        rx="3"
                        fill={SPENDING_COLOR}
                        onMouseMove={(e) =>
                          showTip(e, `Spending: −${pounds(day.spending)}`)
                        }
                        onMouseLeave={hideTip}
                      />
                    )}
                    <text
                      x={centerX(index)}
                      y={height - bottom + 22}
                      className="axis-label middle"
                    >
                      {dayLabel(day.date)}
                    </text>
                  </g>
                );
              })}

              {/* The £0 line */}
              <line
                x1={left}
                x2={width}
                y1={zeroY}
                y2={zeroY}
                className="zero-line"
              />
              <text x={left - 8} y={zeroY + 4} className="axis-label end">
                £0
              </text>

              {/* The week-before line, drawn on top of the bars */}
              <polyline points={linePoints} className="week-before-line" />
              {days.map((day, index) => (
                <circle
                  key={day.date}
                  cx={centerX(index)}
                  cy={y(day.weekBeforeTotal)}
                  r="5"
                  className="week-before-dot"
                  onMouseEnter={() => setHovered(index)}
                  onMouseMove={(e) =>
                    showTip(e, `Week before: ${pounds(day.weekBeforeTotal)}`)
                  }
                  onMouseLeave={hideTip}
                />
              ))}
            </svg>
            {tip && (
              <div
                className="chart-tip"
                style={{
                  left: tip.x,
                  top: tip.y,
                  transform: tip.onLeft ? "translateX(-100%)" : "none",
                }}
              >
                {tip.text}
              </div>
            )}
          </div>

          <div className="chart-details">
            {shown === null ? (
              <span>Point at a day to see its numbers.</span>
            ) : (
              <>
                <strong>
                  {new Date(shown.date + "T12:00:00").toLocaleDateString(
                    "en-GB",
                    { weekday: "long", day: "numeric", month: "long" },
                  )}
                </strong>
                {CHART_PARTS.map((part) => (
                  <span key={part.key}>
                    <i style={{ background: part.color }} /> {part.label}{" "}
                    {pounds(shown[part.key])}
                  </span>
                ))}
                <span>
                  <i style={{ background: SPENDING_COLOR }} /> Spending −
                  {pounds(shown.spending)}
                </span>
                <span>
                  Day total <strong>{pounds(shown.dayTotal)}</strong> (week
                  before {pounds(shown.weekBeforeTotal)})
                </span>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
