// A month box (e.g. "October 2026") used by the monthly Admin reports.
// Future months can't be picked.

import { thisMonthString } from "../utils/dates.js";

export default function MonthPicker({ month, onChange }) {
  return (
    <label className="date-picker">
      Month
      <input
        type="month"
        value={month}
        max={thisMonthString()}
        // Ignore an emptied box, so there is always a month chosen
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
    </label>
  );
}
