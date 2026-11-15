// The scrollable "Till activity" list on the right of the till screen.

import { useEffect, useState } from "react";
import { formatTime } from "../utils/dates.js";
import ActivityDetails from "./ActivityDetails.jsx";
import { loadJson } from "../utils/api.js";

// A ticket's status for the list. Collecting always means it's paid too.
function ticketStatus(ticket) {
  if (ticket.cancelled) return "cancelled";
  if (ticket.collected) return "paid and collected";
  const paid = ticket.paid ? "paid" : "not paid";
  if (ticket.ready_at) return `READY${ticket.rack_slot ? ", slot " + ticket.rack_slot : ""}, ${paid}`;
  return `${paid}, not collected`;
}

// Sidebar listing everything that happened at the till since the last closed day.
// Clicking a row opens its full details. The search box at the top finds any
// dry cleaning or service wash ticket by name or ticket id, from any day.
export default function ActivitySidebar({ refreshKey }) {
  const [activity, setActivity] = useState([]);
  // The row that was clicked, shown in a pop-up (null when closed)
  const [openRow, setOpenRow] = useState(null);
  // What is typed in the search box, and the tickets it found
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);

  const loadActivity = () =>
    loadJson("/api/till-activity")
      .then((data) => setActivity(data));

  // openIfOne: open the ticket straight away when exactly one is found (Enter in the box)
  const runSearch = (text, openIfOne = false) =>
    loadJson("/api/tickets/search?q=" + encodeURIComponent(text))
      .then((data) => {
        setResults(data);
        if (openIfOne && data.length === 1) setOpenRow(data[0]);
      });

  // Load the list when the page opens, and again whenever refreshKey changes
  useEffect(() => {
    loadActivity();
  }, [refreshKey]);

  // Search as the user types
  useEffect(() => {
    if (search.trim() !== "") runSearch(search.trim());
  }, [search]);

  const searching = search.trim() !== "";

  return (
    <aside className="activity-sidebar">
      {/* Clicking the heading clears the search and shows the activity list again */}
      <h2>
        <button
          type="button"
          className="activity-heading"
          onClick={() => setSearch("")}
          title="Show the till activity list"
        >
          Till activity
        </button>
      </h2>
      <input
        type="search"
        className="activity-search"
        placeholder="Search or scan ticket: name, id or tag (123-2)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        // Enter opens the ticket if only one was found. A barcode scanner types the
        // ticket's barcode (D123 / S123) and presses Enter itself, so scanning a printed
        // ticket opens it.
        onKeyDown={(e) => {
          if (e.key === "Enter" && search.trim() !== "") runSearch(search.trim(), true);
        }}
      />

      {searching ? (
        <ul>
          {results.length === 0 && (
            <p className="activity-empty">No tickets found.</p>
          )}
          {results.map((ticket) => (
            <li
              key={ticket.type + ticket.id}
              className={
                "activity-row " +
                ticket.type +
                (ticket.cancelled ? " cancelled" : "")
              }
              onClick={() => setOpenRow(ticket)}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setOpenRow(ticket)}
            >
              <span className="activity-text">
                {ticket.type === "dryCleaning"
                  ? "Dry cleaning"
                  : "Service wash"}
                : {ticket.customer_name}
              </span>
              <span className="activity-details">
                £{ticket.price.toFixed(2)}{" "}
                {ticket.paid
                  ? "paid"
                  : ticket.deposit > 0
                    ? `· deposit £${ticket.deposit.toFixed(2)}, £${(ticket.price - ticket.deposit).toFixed(2)} owed`
                    : "not paid"}{" "}
                · {formatTime(ticket.created_at)}
              </span>
              <span className="activity-id">
                {"status: " + ticketStatus(ticket)}
              </span>
              <span className="activity-id">
                id: {ticket.id}
                {ticket.piece ? ` · tag ${ticket.id}-${ticket.piece}, piece ${ticket.piece} of ${ticket.number_of_pieces}` : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          {activity.length === 0 && (
            <p className="activity-empty">Nothing yet. Ready for a new day.</p>
          )}
          <ul>
            {/* Numbered for the screen only: the oldest entry is 1, the newest has the highest number */}
            {activity.map((row, index) => (
              <li
                key={row.type + row.id}
                // Cancelled tickets get the "cancelled" colour
                className={
                  "activity-row " +
                  row.type +
                  // Money from the washers and dryers is saved as a sale, but has its own colour
                  (row.description?.includes("Washers Dryers Coins")
                    ? " machineCoins"
                    : "") +
                  (row.cancelled ? " cancelled" : "")
                }
                onClick={() => setOpenRow(row)}
                // Keyboard users can open it with Enter too
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setOpenRow(row)}
              >
                <span className="activity-text">
                  {activity.length - index}. {row.description}
                </span>
                <span className="activity-details">
                  £{row.amount.toFixed(2)}
                  {row.paid === 1 && " paid"}
                  {row.paid === 0 &&
                    (row.deposit > 0
                      ? ` · deposit £${row.deposit.toFixed(2)}, £${(row.amount - row.deposit).toFixed(2)} owed`
                      : " not paid")}{" "}
                  · {formatTime(row.created_at)}
                  {/* The worker who made it (or collected it, for collected rows) */}
                  {row.staff_name && ` · ${row.staff_name}`}
                </span>
                {/* Tickets show whether they've been paid and collected, and their real
                ticket number, used to find them in Money In */}
                {row.collected !== null && (
                  <span className="activity-id">
                    {"status: " + ticketStatus(row)}
                  </span>
                )}
                {row.collected !== null && (
                  <span className="activity-id">id: {row.id}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {openRow && (
        <ActivityDetails
          row={openRow}
          onClose={() => setOpenRow(null)}
          // Reload the list (and the search results) after a ticket is paid, collected or cancelled
          onChanged={() => {
            loadActivity();
            if (searching) runSearch(search.trim());
          }}
        />
      )}
    </aside>
  );
}
