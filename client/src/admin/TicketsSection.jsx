// Admin → Tickets: a search box to find any ticket by number or name, and four tabs.
// Uncollected tickets (still in the shop), and every dry cleaning or service wash ticket
// in a sortable list. Pressing Edit on a ticket opens TicketEditor to change anything on it,
// and the dry cleaning and service wash tabs have a button to make a new ticket.
// Ticket summary lists the tickets between two dates and times, and exports them as a PDF.

import { useEffect, useState } from "react";
import UncollectedTickets from "./UncollectedTickets.jsx";
import TicketList from "./TicketList.jsx";
import TicketEditor from "./TicketEditor.jsx";
import TicketSummary from "./TicketSummary.jsx";
import TicketForm from "../till/TicketForm.jsx";
import { TICKET_TYPES } from "../till/ticketTypes.js";
import { pounds } from "../utils/money.js";

const TABS = [
  { id: "uncollected", label: "Uncollected tickets" },
  { id: "dryCleaning", label: "Dry cleaning tickets" },
  { id: "serviceWash", label: "Service wash tickets" },
  { id: "ticketSummary", label: "Ticket summary" },
];

// A ticket's state in a few words, for the search results
function ticketState(ticket) {
  if (ticket.cancelled) return "Cancelled";
  return (
    (ticket.paid ? "Paid" : "Not paid") +
    ", " +
    (ticket.collected ? "collected" : "not collected")
  );
}

export default function TicketsSection() {
  const [tab, setTab] = useState("uncollected");
  // What is typed in the search box, and the tickets it found
  const [search, setSearch] = useState("");
  const [found, setFound] = useState([]);
  // The ticket being edited, e.g. { kind: "dryCleaning", id: 12 }
  const [editing, setEditing] = useState(null);
  // The kind of new ticket being made, e.g. "dryCleaning", or null
  const [adding, setAdding] = useState(null);
  // Goes up after each save, so the lists and search load again
  const [saves, setSaves] = useState(0);

  useEffect(() => {
    const text = search.trim();
    if (text === "") return setFound([]);
    let current = true;
    fetch("/api/tickets/search?q=" + encodeURIComponent(text))
      .then((response) => response.json())
      .then((tickets) => current && setFound(tickets));
    return () => {
      current = false;
    };
  }, [search, saves]);

  const edit = (kind, id) => setEditing({ kind, id });

  return (
    <section className="report">
      <h2>Tickets</h2>

      <input
        type="search"
        className="activity-search ticket-search"
        placeholder="Find a ticket to edit: number or customer name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {search.trim() !== "" && (
        <div className="report-table-wrap">
          {found.length === 0 ? (
            <p>No tickets found.</p>
          ) : (
            <table className="report-table">
              <tbody>
                {found.map((ticket) => (
                  <tr
                    key={ticket.type + ticket.id}
                    className={ticket.cancelled ? "cancelled-row" : ""}
                  >
                    <td>
                      <button
                        className="sort-button"
                        onClick={() => edit(ticket.type, ticket.id)}
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
                    <td>{ticket.created_at.slice(0, 10)}</td>
                    <td>{pounds(ticket.price)}</td>
                    <td>{ticketState(ticket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="report-controls">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={
              "sort-button " + item.id + (tab === item.id ? " active" : "")
            }
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(tab === "dryCleaning" || tab === "serviceWash") && (
        <div className="form-actions new-ticket-actions">
          <button className="confirm-button" onClick={() => setAdding(tab)}>
            New {tab === "dryCleaning" ? "dry cleaning" : "service wash"}{" "}
            ticket
          </button>
        </div>
      )}

      {/* key starts each list fresh, with its own sorting, and reloads it after a save */}
      {tab === "uncollected" && (
        <UncollectedTickets key={saves} onEdit={edit} />
      )}
      {(tab === "dryCleaning" || tab === "serviceWash") && (
        <TicketList key={tab + saves} kind={tab} onEdit={edit} />
      )}
      {tab === "ticketSummary" && <TicketSummary />}

      {adding && (
        <TicketForm
          ticketType={{
            ...TICKET_TYPES[adding],
            apiUrl: "/api/admin/tickets/" + adding,
            printUrl: TICKET_TYPES[adding].apiUrl,
          }}
          onClose={() => {
            setAdding(null);
            setSaves(saves + 1);
          }}
        />
      )}

      {editing && (
        <TicketEditor
          kind={editing.kind}
          id={editing.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setSaves(saves + 1);
          }}
        />
      )}
    </section>
  );
}
