// Admin "Edit history": every ticket cancel and refund, and every card amount saved or
// changed, with who did it and when. Newest first. Entries can't be changed or deleted.

import { useEffect, useState } from "react";

// "2026-10-25 21:10:05" becomes "Sun 25 Oct 2026, 9:10pm"
function when(text) {
  const date = new Date(text.replace(" ", "T"));
  return (
    date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    ", " +
    date
      .toLocaleTimeString("en-GB", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .replace(" ", "")
  );
}

export default function EditHistory() {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    fetch("/api/admin/history")
      .then((response) => response.json())
      .then((data) => setHistory(data));
  }, []);

  if (history === null) {
    return <p>Loading…</p>;
  }

  return (
    <section className="report">
      <h2>Edit history</h2>
      <p className="report-note">
        Every ticket cancel and refund, and every card amount saved or changed,
        with who did it and when. Newest first. These records can't be changed
        or deleted.
      </p>

      {history.length === 0 ? (
        <p>Nothing has been cancelled or changed yet.</p>
      ) : (
        <div className="report-table-wrap">
          <table className="report-table history-table">
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th>Details</th>
                <th>Who</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td>{when(entry.created_at)}</td>
                  <td>
                    <strong>{entry.action}</strong>
                  </td>
                  <td>{entry.details}</td>
                  <td>{entry.done_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
