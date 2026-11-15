// Pop-up with the full details of one item clicked in the till's activity list.
// It loads the item fresh from the server, so it shows the latest paid/collected state.
// Dry cleaning and service wash tickets can be marked as paid, or paid and collected, here,
// and tickets made today can be cancelled.

import { useEffect, useState } from "react";
import { pounds } from "../utils/money.js";
import { todayString } from "../utils/dates.js";
import { sendToPrinter } from "../utils/print.js";
import { showToast } from "../utils/toast.js";
import Overlay from "../components/Overlay.jsx";
import { request } from "../utils/api.js";

// Where to load each kind of row from, and its title. isTicket marks the ones that can be cancelled.
const SOURCES = {
  dryCleaning: {
    url: "/api/dry-cleaning-tickets/",
    title: "Dry cleaning ticket",
    isTicket: true,
  },
  dryCleaningCollected: {
    url: "/api/dry-cleaning-tickets/",
    title: "Dry cleaning ticket",
    isTicket: true,
  },
  serviceWash: {
    url: "/api/service-wash-tickets/",
    title: "Service wash ticket",
    isTicket: true,
  },
  serviceWashCollected: {
    url: "/api/service-wash-tickets/",
    title: "Service wash ticket",
    isTicket: true,
  },
  sale: { url: "/api/sales/", title: "Sale" },
  spending: { url: "/api/till-spending/", title: "Till spending" },
};

// "2026-10-24 15:30:12" becomes "Sat 24 Oct 2026, 3:30pm"
function dateAndTime(text) {
  if (!text) return "–";
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

// The lines to show for each kind of item, as [label, value] pairs
function detailLines(type, item) {
  if (type === "sale") {
    return [
      ["Item", item.item_name],
      ["How many", item.quantity],
      ["Price for one", pounds(item.unit_price)],
      ["Total", pounds(item.quantity * item.unit_price)],
      ["Sold", dateAndTime(item.created_at)],
      ["Sold by", item.made_by || "–"],
    ];
  }
  if (type === "spending") {
    return [
      ["What for", item.description],
      ["Amount", "−" + pounds(item.amount)],
      ["When", dateAndTime(item.created_at)],
      ["By", item.made_by || "–"],
    ];
  }
  // Dry cleaning or service wash ticket
  const lines = [
    ["Ticket id", item.id],
    ["Name", item.customer_name],
    ["Phone", item.phone_number],
    item.clothes_description !== undefined
      ? ["Clothes", item.clothes_description]
      : ["Load", item.load_description],
  ];
  if (item.load_size) lines.push(["Load size", item.load_size]);
  if (item.number_of_pieces !== undefined) {
    lines.push(["Number of pieces", item.number_of_pieces]);
  }
  lines.push(
    ["Pickup day", item.pickup_time],
    ["Price", pounds(item.price)],
    item.discount > 0
      ? ["Discount", pounds(item.discount) + " off " + pounds(item.price + item.discount)]
      : null,
    item.deposit > 0
      ? ["Deposit", pounds(item.deposit) + ", " + dateAndTime(item.created_at)]
      : null,
    item.refunded > 0
      ? ["Given back", pounds(item.refunded) + ", " + dateAndTime(item.cancelled_at)]
      : null,
    [
      "Paid",
      item.paid
        ? "Yes, " + dateAndTime(item.paid_at)
        : item.deposit > 0
          ? `${pounds(item.price - item.deposit)} still owed`
          : "Not paid yet",
    ],
    item.ready_at
      ? ["Ready", "Yes, " + dateAndTime(item.ready_at) + (item.rack_slot ? ` · slot ${item.rack_slot}` : "")]
      : item.collected || item.cancelled
        ? null
        : ["Ready", "Not ready yet"],
    [
      "Collected",
      item.collected
        ? "Yes, " + dateAndTime(item.collected_at)
        : "Not collected yet",
    ],
    ["Brought in", dateAndTime(item.created_at)],
    ["Ticket made by", item.made_by || "–"],
  );
  if (item.paid_by_name) {
    lines.push(["Payment taken by", item.paid_by_name]);
  }
  if (item.collected) {
    lines.push(["Collected by", item.collected_by_name || "–"]);
  }
  if (item.cancelled) {
    lines.push(["Cancelled", "Yes, " + dateAndTime(item.cancelled_at)]);
    lines.push(["Cancelled by", item.cancelled_by_name || "–"]);
  }
  // Leave out lines that don't apply, e.g. Deposit when there was none
  return lines.filter(Boolean);
}

// onChanged is called after a ticket is paid, collected or cancelled, so the activity list reloads
export default function ActivityDetails({ row, onClose, onChanged }) {
  const [item, setItem] = useState(null);
  const [error, setError] = useState(null);
  // true while the "Are you sure?" step for cancelling is showing
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [message, setMessage] = useState(null);
  // true while the "Mark as ready" box (rack or slot number) is showing
  const [markingReady, setMarkingReady] = useState(false);
  const [slot, setSlot] = useState("");
  const source = SOURCES[row.type];
  // The colour of the pop-up: the same as the row's kind (see the colours in styles/01-base.css)
  const colour = row.type.startsWith("dryCleaning")
    ? "dryCleaning"
    : row.type.startsWith("serviceWash")
      ? "serviceWash"
      : row.type === "sale"
        ? "products"
        : "spending";

  // A ticket can be cancelled only on the day it was made, and not once collected or cancelled
  const canCancel =
    source.isTicket &&
    item !== null &&
    !item.cancelled &&
    !item.collected &&
    item.created_at.slice(0, 10) === todayString();

  // A ticket can be collected until it has been collected or cancelled
  const canCollect =
    source.isTicket && item !== null && !item.cancelled && !item.collected;
  // An unpaid ticket can be paid now and collected later
  const canPay = canCollect && !item.paid;
  // What is still to pay: the price, less any deposit
  const owed = item ? item.price - (item.deposit || 0) : 0;

  // Opens WhatsApp in a chat with the customer, with a message typed in; staff press send.
  // message is "receipt" or "ready" (your order is ready to collect). beforeOpening, if given,
  // runs first (e.g. marking the ticket ready). The new tab is opened straight away, before
  // asking the server, so the browser doesn't block it.
  const sendOnWhatsApp = async (message, beforeOpening) => {
    const tab = window.open("", "_blank");
    try {
      if (beforeOpening && !(await beforeOpening())) {
        tab?.close();
        return;
      }
      const query = message === "ready" ? "?message=ready" : "";
      const { ok, data } = await request(source.url + row.id + "/whatsapp" + query);
      if (!ok) throw new Error(data.error);
      if (tab) tab.location.href = data.link;
      else window.location.href = data.link;
      setMessage(
        (message === "ready" ? "Marked as ready. " : "") + "WhatsApp opened. Check the message and press send.",
      );
    } catch (e) {
      tab?.close();
      showToast(`Could not open WhatsApp: ${e.message || "the till server is not answering"}`, "error");
    }
  };

  // Marks the ticket ready to collect, hanging in the slot typed (or none). Returns true if saved.
  const markReady = async () => {
    const { ok, data } = await request(source.url + row.id + "/ready", {
      method: "POST",
      body: { slot },
    });
    if (!ok) {
      setMessage(data.error);
      return false;
    }
    setItem(data);
    setMarkingReady(false);
    onChanged();
    return true;
  };

  // Mark the ticket as paid; the customer collects it later
  const payTicket = async () => {
    const { ok, data } = await request(source.url + row.id + "/pay", { method: "POST" });
    if (!ok) {
      setMessage(data.error);
      return;
    }
    setItem(data);
    setMessage(
      `Ticket marked as paid. ${pounds(owed)} added to today's total.`,
    );
    onChanged();
  };

  // Mark the ticket as collected; if it wasn't paid yet, it is paid now too
  const collectTicket = async () => {
    const wasPaid = item.paid === 1;
    const { ok, data } = await request(source.url + row.id + "/collect", { method: "POST" });
    if (!ok) {
      setMessage(data.error);
      return;
    }
    setItem(data);
    setMessage(
      wasPaid
        ? "Ticket marked as collected."
        : `Ticket marked as collected and paid. ${pounds(data.price - (data.deposit || 0))} added to today's total.`,
    );
    onChanged();
  };

  const cancelTicket = async () => {
    const { ok, data } = await request(source.url + row.id + "/cancel", { method: "POST" });
    setConfirmingCancel(false);
    if (!ok) {
      setMessage(data.error);
      return;
    }
    setItem(data.ticket);
    setMessage(
      data.refunded > 0
        ? `Ticket cancelled. Give the customer ${pounds(data.refunded)}; it was taken off today's ${source.title.split(" ticket")[0].toLowerCase()} money.`
        : "Ticket cancelled. It wasn't paid, so there is nothing to give back.",
    );
    onChanged();
  };

  useEffect(() => {
    request(source.url + row.id).then(({ ok, data }) => {
      if (ok) setItem(data);
      else setError(data.error);
    });
  }, [source.url, row.id]);

  return (
    <Overlay onClose={onClose}>
      <div
        className={"ticket-form " + colour}
       
      >
        <h2>{source.title}</h2>
        {error ? (
          <p>{error}</p>
        ) : item === null ? (
          <p>Loading…</p>
        ) : (
          <dl className="details-list">
            {detailLines(row.type, item).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* Dry cleaning: the items picked from the price list */}
        {item?.items?.length > 0 && (
          <>
            <h3>Items</h3>
            <ul className="ticket-items-list">
              {item.items.map((line) => (
                <li key={line.id}>
                  {line.quantity} × {line.item_name}
                  {line.service === "press" ? " (press only)" : ""} ·{" "}
                  {pounds(line.unit_price)} each
                </li>
              ))}
            </ul>
          </>
        )}

        {message && <p className="money-in-message">{message}</p>}

        {markingReady && (
          <div className="confirm-box">
            <label>
              Rack or slot where it hangs (you can leave it empty)
              <input
                autoFocus
                maxLength={20}
                value={slot}
                placeholder="e.g. 14 or B3"
                onChange={(e) => setSlot(e.target.value)}
              />
            </label>
            <div className="form-actions">
              <button type="button" className="whatsapp-button" onClick={() => sendOnWhatsApp("ready", markReady)}>
                {item.ready_at ? "Save and send WhatsApp" : "Ready and send WhatsApp"}
              </button>
              <button
                type="button"
                className="confirm-button"
                onClick={async () => {
                  if (await markReady()) setMessage(item.ready_at ? "Slot changed." : "Marked as ready.");
                }}
              >
                Save without a message
              </button>
              <button type="button" onClick={() => setMarkingReady(false)}>
                Back
              </button>
            </div>
          </div>
        )}

        {confirmingCancel ? (
          <div className="confirm-box">
            <p>
              Cancel ticket {item.id}?
              {item.paid
                ? ` The customer gets ${pounds(item.price)} back, taken off today's ${source.title.split(" ticket")[0].toLowerCase()} money.`
                : item.deposit > 0
                  ? ` The customer gets their ${pounds(item.deposit)} deposit back, taken off today's ${source.title.split(" ticket")[0].toLowerCase()} money.`
                  : " It wasn't paid, so no money is given back."}
            </p>
            <div className="form-actions">
              <button type="button" onClick={() => setConfirmingCancel(false)}>
                Go back
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={cancelTicket}
              >
                Yes, cancel ticket
              </button>
            </div>
          </div>
        ) : (
          <div className="action-grid">
            {canPay && (
              <button
                type="button"
                className="confirm-button"
                onClick={payTicket}
              >
                Mark as paid {pounds(owed)}
              </button>
            )}
            {canCollect && (
              <button
                type="button"
                className="confirm-button"
                onClick={collectTicket}
              >
                {item.paid
                  ? "Mark as collected"
                  : `Mark as paid and collected ${pounds(owed)}`}
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                className="danger-button"
                onClick={() => setConfirmingCancel(true)}
              >
                Cancel ticket
              </button>
            )}
            {source.isTicket && item !== null && (
              <button
                type="button"
                onClick={async () => {
                  if (await sendToPrinter(source.url + row.id + "/print")) setMessage("Ticket sent to the printer.");
                }}
              >
                Print ticket
              </button>
            )}
            {canCollect && !markingReady && (
              <button
                type="button"
                onClick={() => {
                  setSlot(item.rack_slot || "");
                  setMarkingReady(true);
                }}
              >
                {item.ready_at ? "Change slot" : "Mark as ready"}
              </button>
            )}
            {canCollect && item.ready_at && !markingReady && (
              <button type="button" className="whatsapp-button" onClick={() => sendOnWhatsApp("ready")}>
                Send "ready" on WhatsApp
              </button>
            )}
            {source.isTicket && item !== null && (
              <button type="button" className="whatsapp-button" onClick={() => sendOnWhatsApp("receipt")}>
                Send receipt on WhatsApp
              </button>
            )}
            {source.url === "/api/dry-cleaning-tickets/" && item !== null && (
              <button
                type="button"
                onClick={async () => {
                  if (await sendToPrinter(source.url + row.id + "/print", { tagsOnly: true }))
                    setMessage("Garment tags sent to the printer.");
                }}
              >
                Print garment tags
              </button>
            )}
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </Overlay>
  );
}
