// Part of the Money In pop-up: search a ticket and mark it as collected.

import { useState } from "react";
import { pounds } from "../utils/money.js";

// Collecting a ticket: find it by its number and mark it as collected (and paid, if it wasn't yet).
// ticketKind is "dry-cleaning-tickets" or "service-wash-tickets".
export default function CollectTicket({ ticketKind, descriptionName }) {
  const [ticketNumber, setTicketNumber] = useState("");
  const [ticket, setTicket] = useState(null);
  const [message, setMessage] = useState(null);

  return (
    <>
      <form
        className="search-row"
        onSubmit={async (e) => {
          e.preventDefault();
          setTicket(null);
          setMessage(null);
          const response = await fetch(`/api/${ticketKind}/${ticketNumber}`);
          const data = await response.json();
          if (response.ok) {
            setTicket(data);
          } else {
            setMessage(data.error);
          }
        }}
      >
        <input
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          placeholder="Ticket number"
          required
          value={ticketNumber}
          // Only whole numbers
          onKeyDown={(e) => {
            if ([".", ",", "e", "E", "-", "+"].includes(e.key)) {
              e.preventDefault();
            }
          }}
          onChange={(e) => setTicketNumber(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {ticket && (
        <div className="found-ticket">
          <p>
            <strong>Ticket {ticket.id}</strong>: {ticket.customer_name},{" "}
            {ticket.phone_number}
          </p>
          <p>{ticket[descriptionName]}</p>
          <p>
            {pounds(ticket.price)} ·{" "}
            {ticket.paid
              ? "Paid"
              : ticket.deposit > 0
                ? `Deposit ${pounds(ticket.deposit)}, ${pounds(ticket.price - ticket.deposit)} owed`
                : "Not paid yet"}{" "}
            ·{" "}
            {ticket.cancelled
              ? "Cancelled"
              : ticket.collected
                ? "Collected"
                : "Not collected"}
          </p>
          {!ticket.collected && !ticket.cancelled && (
            <button
              className="confirm-button"
              onClick={async () => {
                const wasPaid = ticket.paid === 1;
                const response = await fetch(
                  `/api/${ticketKind}/${ticket.id}/collect`,
                  { method: "POST" },
                );
                const data = await response.json();
                if (!response.ok) {
                  setMessage(data.error);
                  return;
                }
                setTicket(data);
                setMessage(
                  wasPaid
                    ? `Ticket ${data.id} is now collected.`
                    : `Ticket ${data.id} is now collected and paid. ${pounds(data.price - (data.deposit || 0))} added to today's total.`,
                );
              }}
            >
              {/* Unpaid tickets are paid when they're collected */}
              {ticket.paid
                ? "Mark as collected"
                : `Mark as collected and paid ${pounds(ticket.price - (ticket.deposit || 0))}`}
            </button>
          )}
        </div>
      )}

      {message && <p className="money-in-message">{message}</p>}
    </>
  );
}
