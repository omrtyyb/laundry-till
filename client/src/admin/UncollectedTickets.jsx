// Admin report: tickets still in the shop, with overdue ones highlighted, how long each has
// been waiting, and a free WhatsApp reminder for each (a final "will be given to charity"
// notice once it has waited the charity days, 90).

import { useEffect, useState } from "react";
import { pounds } from "../utils/money.js";
import { showToast } from "../utils/toast.js";

// The "waiting at least" filters, in days
const FILTERS = [
  [0, "All"],
  [14, "2+ weeks"],
  [28, "4+ weeks"],
];

// Admin "Uncollected tickets": every ticket still in the shop, oldest first.
// Tickets past their pickup day are highlighted so staff know whom to call.
export default function UncollectedTickets({ onEdit }) {
  const [data, setData] = useState(null);
  // How the table is sorted: null (oldest first), "type", "price" or "paid"
  const [sortBy, setSortBy] = useState(null);
  // Only show tickets waiting at least this many days (0: all)
  const [minDays, setMinDays] = useState(0);

  const load = () =>
    fetch("/api/uncollected-tickets")
      .then((response) => response.json())
      .then((result) => setData(result));

  useEffect(() => {
    load();
  }, []);

  // Opens WhatsApp with a reminder (or the final notice) typed in, and records it.
  // The tab is opened first, so the browser doesn't block it.
  const remind = async (ticket, final) => {
    const tab = window.open("", "_blank");
    try {
      const response = await fetch(`/api/uncollected-tickets/${ticket.type}/${ticket.id}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ final }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (tab) tab.location.href = result.link;
      else window.location.href = result.link;
      load();
    } catch (e) {
      tab?.close();
      showToast(`Could not open WhatsApp: ${e.message || "the till server is not answering"}`, "error");
    }
  };

  if (data === null) {
    return <p>Loading…</p>;
  }

  const overdueCount = data.tickets.filter((ticket) => ticket.overdue).length;

  // Pressing a column sorts by it; pressing it again goes back to oldest first
  const toggleSort = (column) => setSortBy(sortBy === column ? null : column);

  // The server sends tickets oldest first. Sort a copy, so that order is kept for later.
  const charityDays = data.charityDays || 90;
  const filters = [...FILTERS, [charityDays, `${charityDays}+ days`]];
  const tickets = data.tickets.filter((ticket) => ticket.days_waiting >= minDays);
  if (sortBy === "price") {
    tickets.sort((a, b) => b.price - a.price); // highest price first
  } else if (sortBy === "type") {
    // dry cleaning first, then service wash; each group stays oldest first
    tickets.sort((a, b) => a.type.localeCompare(b.type));
  } else if (sortBy === "paid") {
    tickets.sort((a, b) => a.paid - b.paid); // not paid first, then paid
  }
  const shortDate = (text) =>
    new Date(text.slice(0, 10)).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });

  return (
    <section className="report">
      <h2>Uncollected tickets</h2>

      <div className="report-cards">
        <div className="report-card">
          <span>Still in the shop</span>
          <strong>{data.tickets.length}</strong>
        </div>
        <div className="report-card overdue">
          <span>Past pickup day</span>
          <strong>{overdueCount}</strong>
        </div>
        <div className="report-card owed">
          <span>Money still owed</span>
          <strong>{pounds(data.owed)}</strong>
        </div>
      </div>

      <div className="waiting-filters">
        <span>Waiting:</span>
        {filters.map(([days, label]) => (
          <button
            key={days}
            className={"sort-button" + (minDays === days ? " active" : "")}
            onClick={() => setMinDays(days)}
          >
            {label} ({data.tickets.filter((t) => t.days_waiting >= days).length})
          </button>
        ))}
      </div>
      <p className="report-note">
        Waiting counts from the day a ticket was marked ready, or its pickup day. Reminders open
        WhatsApp with the message typed in; after {charityDays} days the button sends a final
        notice saying the items will be given to charity if not collected within a week.
      </p>

      {tickets.length === 0 ? (
        <p>{data.tickets.length === 0 ? "Every ticket has been collected." : "No tickets have waited that long."}</p>
      ) : (
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th></th>
                <th>id</th>
                <th>
                  <button
                    className={
                      "sort-button" + (sortBy === "type" ? " active" : "")
                    }
                    onClick={() => toggleSort("type")}
                  >
                    Type {sortBy === "type" ? "▼" : "↕"}
                  </button>
                </th>
                <th>Name</th>
                <th>Phone</th>
                <th>Brought in</th>
                <th>Pickup</th>
                <th>Waiting</th>
                <th>Reminder</th>
                <th>
                  <button
                    className={
                      "sort-button" + (sortBy === "price" ? " active" : "")
                    }
                    onClick={() => toggleSort("price")}
                  >
                    Price {sortBy === "price" ? "▼" : "↕"}
                  </button>
                </th>
                <th>
                  <button
                    className={
                      "sort-button" + (sortBy === "paid" ? " active" : "")
                    }
                    onClick={() => toggleSort("paid")}
                  >
                    Paid {sortBy === "paid" ? "▼" : "↕"}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr
                  key={ticket.type + ticket.id}
                  className={ticket.overdue ? "overdue" : ""}
                >
                  {/* First, so it's always in view even when the table scrolls sideways */}
                  <td>
                    <button
                      className="sort-button"
                      onClick={() => onEdit(ticket.type, ticket.id)}
                    >
                      Edit
                    </button>
                  </td>
                  <td>{ticket.id}</td>
                  <td>
                    <span className={"kind-tag " + ticket.type}>
                      {ticket.type === "dryCleaning"
                        ? "Dry cleaning"
                        : "Service wash"}
                    </span>
                  </td>
                  <td>{ticket.customer_name}</td>
                  <td>{ticket.phone_number}</td>
                  <td>{shortDate(ticket.created_at)}</td>
                  <td>
                    {ticket.pickup_time} {shortDate(ticket.pickup_date)}
                    {ticket.overdue && <span className="badge">Overdue</span>}
                  </td>
                  <td>
                    {ticket.days_waiting} day{ticket.days_waiting === 1 ? "" : "s"}
                    {ticket.rack_slot ? ` · slot ${ticket.rack_slot}` : ""}
                  </td>
                  <td className="reminder-cell">
                    <button
                      className="sort-button whatsapp-button"
                      onClick={() => remind(ticket, ticket.days_waiting >= charityDays)}
                    >
                      {ticket.days_waiting >= charityDays ? "Final notice" : "Remind"}
                    </button>
                    {ticket.reminder_count > 0 && (
                      <small>
                        {ticket.reminder_count} sent, last {shortDate(ticket.reminded_at)}
                        {ticket.final_notice_at ? ` · final notice ${shortDate(ticket.final_notice_at)}` : ""}
                      </small>
                    )}
                  </td>
                  <td>{pounds(ticket.price)}</td>
                  <td>
                    {ticket.paid
                      ? "Paid"
                      : ticket.deposit > 0
                        ? `Deposit ${pounds(ticket.deposit)}, ${pounds(ticket.price - ticket.deposit)} owed`
                        : "Not paid"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
