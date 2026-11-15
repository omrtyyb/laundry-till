// Admin "Customers": everyone who has had a ticket, found by name or phone number. Choosing one
// opens their profile: totals, a note the admin keeps about them (e.g. "No starch"), and every
// ticket they've had, newest first, with Edit to change a ticket.
// Customers are grouped by phone number (or by name when no real number was given), see
// server/lib/customers.js.

import { useEffect, useState } from "react";
import { pounds } from "../utils/money.js";
import { showToast } from "../utils/toast.js";
import TicketEditor from "./TicketEditor.jsx";
import { ordinal } from "../utils/ordinal.js";
import { loadJson, request } from "../utils/api.js";

const dateText = (createdAt) =>
  createdAt
    ? new Date(createdAt.replace(" ", "T")).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

// A ticket's state in a few words
function ticketState(ticket) {
  if (ticket.cancelled) return "Cancelled";
  if (ticket.collected) return ticket.paid ? "Collected" : "Collected, not paid";
  if (ticket.ready_at) return ticket.paid ? "Ready, paid" : "Ready, not paid";
  return ticket.paid ? "In the shop, paid" : "In the shop";
}

// One kind of ticket in the customers list: "3 · £45.00", or — when none
const kindCell = (kind) => (kind.visits ? `${kind.visits} · ${pounds(kind.spent)}` : "—");

// The two kinds of ticket, with the names shown on the page
const KINDS = [
  ["dryCleaning", "Dry cleaning"],
  ["serviceWash", "Service wash"],
];

export default function Customers() {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState(null);
  // The key of the customer whose profile is open, e.g. "p:07700900123"
  const [openKey, setOpenKey] = useState(null);

  useEffect(() => {
    let current = true;
    loadJson("/api/admin/customers?q=" + encodeURIComponent(search))
      .then((result) => current && setCustomers(result));
    return () => {
      current = false;
    };
  }, [search, openKey]);

  if (openKey) {
    return <CustomerProfile customerKey={openKey} onBack={() => setOpenKey(null)} />;
  }

  return (
    <section className="report">
      <h2>Customers</h2>
      <input
        type="search"
        className="activity-search ticket-search"
        placeholder="Find a customer: name or phone number"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {customers === null ? (
        <p>Loading…</p>
      ) : customers.length === 0 ? (
        <p>No customers found.</p>
      ) : (
        <div className="report-table-wrap">
          <table className="report-table clickable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Tickets</th>
                <th>Dry cleaning</th>
                <th>Service wash</th>
                <th>Spent</th>
                <th>Still to pay</th>
                <th>Last visit</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.key} onClick={() => setOpenKey(customer.key)}>
                  <td>
                    {customer.name}
                    {customer.note && <span className="customer-has-note" title={customer.note}> 📝</span>}
                  </td>
                  <td>{customer.phone || "—"}</td>
                  <td>{customer.visits}</td>
                  <td>{kindCell(customer.dryCleaning)}</td>
                  <td>{kindCell(customer.serviceWash)}</td>
                  <td>{pounds(customer.spent)}</td>
                  <td>{customer.owed > 0 ? pounds(customer.owed) : "—"}</td>
                  <td>{dateText(customer.last_visit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="report-note">
        Tickets with the same phone number belong to one customer. Tickets without a real phone
        number are grouped by name. Click a customer to see their profile and every order.
      </p>
    </section>
  );
}

function CustomerProfile({ customerKey, onBack }) {
  const [customer, setCustomer] = useState(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(null);
  const [saves, setSaves] = useState(0);
  // Which tickets the order history shows: "all", "dryCleaning" or "serviceWash"
  const [show, setShow] = useState("all");

  useEffect(() => {
    loadJson("/api/admin/customers/" + encodeURIComponent(customerKey))
      .then((result) => {
        setCustomer(result);
        setNote(result.note || "");
      });
  }, [customerKey, saves]);

  const saveNote = async () => {
    const url = `/api/admin/customers/${encodeURIComponent(customerKey)}/note`;
    const { ok, data: result } = await request(url, {
      method: "PUT",
      body: { note },
    });
    if (!ok) return showToast(result.error, "error");
    setCustomer({ ...customer, note: result.note });
    showToast("Note saved");
  };

  if (customer === null) return <p>Loading…</p>;
  if (customer.error) return <p>{customer.error}</p>;

  return (
    <section className="report">
      <div className="customer-profile-head">
        <button className="sort-button" onClick={onBack}>
          ← All customers
        </button>
        <h2>{customer.name}</h2>
        <p className="report-note">
          {customer.phone || "No phone number"}
          {customer.other_names.length > 0 && <> · also given as {customer.other_names.join(", ")}</>}
          {" · "}customer since {dateText(customer.first_visit)}
        </p>
      </div>

      <div className="report-cards">
        <div className="report-card">
          <span>Tickets</span>
          <strong>{customer.visits}</strong>
        </div>
        <div className="report-card">
          <span>Spent</span>
          <strong>{pounds(customer.spent)}</strong>
        </div>
        <div className={"report-card" + (customer.owed > 0 ? " owed" : "")}>
          <span>Still to pay</span>
          <strong>{pounds(customer.owed)}</strong>
        </div>
      </div>

      <div className="customer-kinds">
        {KINDS.map(([kind, label]) => (
          <div key={kind} className={"customer-kind " + kind}>
            <span className={"kind-tag " + kind}>{label}</span>
            <dl>
              <dt>Tickets</dt>
              <dd>{customer[kind].visits}</dd>
              <dt>Spent</dt>
              <dd>{pounds(customer[kind].spent)}</dd>
              <dt>Still to pay</dt>
              <dd>{pounds(customer[kind].owed)}</dd>
              <dt>In the shop</dt>
              <dd>{customer[kind].in_shop}</dd>
              <dt>Last visit</dt>
              <dd>{dateText(customer[kind].last_visit) || "—"}</dd>
            </dl>
          </div>
        ))}
      </div>

      {["dryCleaning", "serviceWash"].some((kind) => customer.loyalty?.[kind]?.active) && (
        <div className="customer-loyalty">
          {[
            ["dryCleaning", "dry cleaning"],
            ["serviceWash", "service wash"],
          ].map(([kind, label]) => {
            const status = customer.loyalty[kind];
            if (!status?.active) return null;
            return (
              <p key={kind}>
                <span className={"kind-tag " + kind}>Loyalty</span>{" "}
                {status.due
                  ? `${status.percent}% off is due on their next ${label} ticket (their ${ordinal(status.every)}).`
                  : `${status.count} of ${status.every - 1} ${label} tickets so far · ${status.toGo} more until ${status.percent}% off.`}
              </p>
            );
          })}
        </div>
      )}

      <label className="customer-note">
        Note about this customer (only seen in Admin)
        <textarea
          rows={2}
          maxLength={1000}
          placeholder="e.g. No starch on shirts, prefers a text when ready"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {note.trim() !== (customer.note || "") && (
        <div className="form-actions">
          <button onClick={saveNote}>Save note</button>
        </div>
      )}

      <div className="report-controls">
        {[["all", "All tickets"], ...KINDS].map(([id, label]) => (
          <button
            key={id}
            className={"sort-button " + id + (show === id ? " active" : "")}
            onClick={() => setShow(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <h3>
        Order history
        {(show === "all" ? customer : customer[show]).in_shop > 0 && (
          <span className="report-note"> · {(show === "all" ? customer : customer[show]).in_shop} still in the shop</span>
        )}
      </h3>
      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              <th></th>
              <th>No.</th>
              <th>Kind</th>
              <th>Date</th>
              <th>Details</th>
              <th>Price</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {customer.tickets.filter((ticket) => show === "all" || ticket.type === show).map((ticket) => (
              <tr key={ticket.type + ticket.id} className={ticket.cancelled ? "cancelled-row" : ""}>
                <td>
                  <button className="sort-button" onClick={() => setEditing({ kind: ticket.type, id: ticket.id })}>
                    Edit
                  </button>
                </td>
                <td>{ticket.id}</td>
                <td>
                  <span className={"kind-tag " + ticket.type}>
                    {ticket.type === "dryCleaning" ? "Dry cleaning" : "Service wash"}
                  </span>
                </td>
                <td>{dateText(ticket.created_at)}</td>
                <td>
                  {ticket.description}
                  {ticket.pieces ? ` (${ticket.pieces} ${ticket.pieces === 1 ? "piece" : "pieces"})` : ""}
                </td>
                <td>
                  {pounds(ticket.price)}
                  {ticket.loyalty_percent && (
                    <small className="loyalty-given"> {ticket.loyalty_percent}% loyalty</small>
                  )}
                </td>
                <td>{ticketState(ticket)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
