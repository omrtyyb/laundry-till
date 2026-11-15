// Admin → Tickets → Dry cleaning / Service wash: every ticket of one kind in a table,
// newest first. The Date, Price, Paid and Collected headings sort the list; pressing
// the same heading again goes back to newest first. Edit opens the ticket to change it.

import { useEffect, useState } from "react";
import { pounds } from "../utils/money.js";
import { loadJson } from "../utils/api.js";

// "2026-10-24 15:30:12" becomes "24 Oct 2026, 3:30pm"
function shortDateTime(text) {
  const date = new Date(text.replace(" ", "T"));
  return (
    date.toLocaleDateString("en-GB", {
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

// How each sort puts tickets in order
const SORTS = {
  oldest: (a, b) => a.created_at.localeCompare(b.created_at), // oldest first
  price: (a, b) => b.price - a.price, // highest price first
  paid: (a, b) => a.paid - b.paid, // not paid first, then paid
  // not collected first, then collected, cancelled last
  collected: (a, b) => a.cancelled - b.cancelled || a.collected - b.collected,
};

// kind is "dryCleaning" or "serviceWash"
export default function TicketList({ kind, onEdit }) {
  const [tickets, setTickets] = useState(null);
  const [sortBy, setSortBy] = useState(null);

  useEffect(() => {
    loadJson("/api/admin/tickets?kind=" + kind)
      .then((data) => setTickets(data));
  }, [kind]);

  if (tickets === null) return <p>Loading…</p>;

  const isDryCleaning = kind === "dryCleaning";
  const shown = sortBy ? [...tickets].sort(SORTS[sortBy]) : tickets;
  const notPaid = tickets.filter((t) => !t.paid && !t.cancelled).length;
  const notCollected = tickets.filter(
    (t) => !t.collected && !t.cancelled,
  ).length;

  // A heading that sorts the list; pressing it again goes back to newest first
  const sortButton = (key, label) => (
    <button
      className={"sort-button" + (sortBy === key ? " active" : "")}
      onClick={() => setSortBy(sortBy === key ? null : key)}
    >
      {label} {sortBy === key ? "▼" : "↕"}
    </button>
  );

  return (
    <section className="report">
      <div className="report-cards">
        <div className="report-card">
          <span>Tickets</span>
          <strong>{tickets.length}</strong>
        </div>
        <div className="report-card owed">
          <span>Not paid in full</span>
          <strong>{notPaid}</strong>
        </div>
        <div className="report-card overdue">
          <span>Not collected</span>
          <strong>{notCollected}</strong>
        </div>
      </div>

      {tickets.length === 0 ? (
        <p>No tickets yet.</p>
      ) : (
        <div className="report-table-wrap">
          <table className="report-table all-tickets">
            <thead>
              <tr>
                <th></th>
                <th>id</th>
                <th>{sortButton("oldest", "Date")}</th>
                <th>Name</th>
                <th>Phone</th>
                <th>{isDryCleaning ? "Clothes" : "Load"}</th>
                {isDryCleaning && <th>Pieces</th>}
                <th>{sortButton("price", "Price")}</th>
                <th>{sortButton("paid", "Paid")}</th>
                <th>{sortButton("collected", "Collected")}</th>
                <th>Made by</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((ticket) => (
                <tr
                  key={ticket.id}
                  className={ticket.cancelled ? "cancelled-row" : ""}
                >
                  {/* First, so it's always in view even when the table scrolls sideways */}
                  <td>
                    <button
                      className="sort-button"
                      onClick={() => onEdit(kind, ticket.id)}
                    >
                      Edit
                    </button>
                  </td>
                  <td>{ticket.id}</td>
                  <td>{shortDateTime(ticket.created_at)}</td>
                  <td>{ticket.customer_name}</td>
                  <td>{ticket.phone_number}</td>
                  <td className="wrap">
                    {isDryCleaning
                      ? ticket.clothes_description
                      : ticket.load_description}
                  </td>
                  {isDryCleaning && <td>{ticket.number_of_pieces}</td>}
                  <td>{pounds(ticket.price)}</td>
                  <td>
                    {ticket.paid
                      ? "Paid"
                      : ticket.deposit > 0
                        ? `Deposit ${pounds(ticket.deposit)}, ${pounds(ticket.price - ticket.deposit)} owed`
                        : "Not paid"}
                  </td>
                  <td>
                    {ticket.cancelled
                      ? "Cancelled"
                      : ticket.collected
                        ? "Collected " + shortDateTime(ticket.collected_at)
                        : "Not collected"}
                  </td>
                  <td>{ticket.made_by || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
