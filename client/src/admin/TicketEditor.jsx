// Admin → Tickets: pop-up to change anything on one dry cleaning or service wash ticket:
// customer, description, pieces, pickup day, price, discount, deposit, paid / collected / cancelled,
// and the dry cleaning items. Cancelling a paid ticket can give the money back from the till.
// Saving writes the change to the edit history.

import { useEffect, useState } from "react";
import { pounds } from "../utils/money.js";
import { showToast } from "../utils/toast.js";
import { priceText } from "../utils/priceText.js";
import Overlay from "../Overlay.jsx";

const PICKUP_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const LOAD_URLS = {
  dryCleaning: "/api/dry-cleaning-tickets/",
  serviceWash: "/api/service-wash-tickets/",
};

// kind is "dryCleaning" or "serviceWash"; onSaved is called after a successful save
export default function TicketEditor({ kind, id, onClose, onSaved }) {
  const isDryCleaning = kind === "dryCleaning";
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  // What the customer had paid before any change here: given back if the ticket is cancelled
  const [paidSoFar, setPaidSoFar] = useState(0);
  const [wasCancelled, setWasCancelled] = useState(false);
  // Service wash: the load sizes on the price list, to pick from
  const [loadSizes, setLoadSizes] = useState([]);
  useEffect(() => {
    if (isDryCleaning) return;
    fetch("/api/service-wash-prices")
      .then((response) => response.json())
      .then((sizes) => setLoadSizes(sizes));
  }, [isDryCleaning]);

  // Load the ticket fresh, and fill the boxes with what's on it now
  useEffect(() => {
    fetch(LOAD_URLS[kind] + id).then(async (response) => {
      const ticket = await response.json();
      if (!response.ok) return setError(ticket.error);
      setPaidSoFar(ticket.paid ? ticket.price : ticket.deposit || 0);
      setWasCancelled(!!ticket.cancelled);
      setForm({
        customer_name: ticket.customer_name,
        phone_number: ticket.phone_number,
        description: isDryCleaning
          ? ticket.clothes_description
          : ticket.load_description,
        number_of_pieces: String(ticket.number_of_pieces ?? ""),
        pickup_time: ticket.pickup_time,
        load_size: ticket.load_size || "",
        // The price box shows the price before any discount
        price: (ticket.price + (ticket.discount || 0)).toFixed(2),
        discount: (ticket.discount || 0).toFixed(2),
        deposit: (ticket.deposit || 0).toFixed(2),
        paid: !!ticket.paid,
        collected: !!ticket.collected,
        cancelled: !!ticket.cancelled,
        refund: true,
        created_at: ticket.created_at,
        items: (ticket.items || []).map((item) => ({
          price_list_id: item.price_list_id,
          item_name: item.item_name,
          service: item.service,
          quantity: String(item.quantity),
          unit_price: item.unit_price.toFixed(2),
        })),
      });
    });
  }, [kind, id, isDryCleaning]);

  const set = (field, value) => setForm({ ...form, [field]: value });
  const setItem = (index, field, value) =>
    set(
      "items",
      form.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );

  const itemsTotal = form
    ? form.items.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
        0,
      )
    : 0;
  const itemsPieces = form
    ? form.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    : 0;

  // Ticking Cancelled on a ticket the customer has paid for offers to give the money back
  const canRefund = !!form?.cancelled && !wasCancelled && paidSoFar > 0;

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const body = {
      customer_name: form.customer_name,
      phone_number: form.phone_number,
      description: form.description,
      pickup_time: form.pickup_time,
      price: Number(form.price),
      discount: Number(form.discount || 0),
      deposit: Number(form.deposit || 0),
      paid: form.paid,
      collected: form.collected,
      cancelled: form.cancelled,
      refund: canRefund && form.refund,
    };
    if (!isDryCleaning) body.load_size = form.load_size;
    if (isDryCleaning) {
      body.number_of_pieces = Number(form.number_of_pieces);
      body.items = form.items.map((item) => ({
        price_list_id: item.price_list_id,
        item_name: item.item_name,
        service: item.service,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      }));
    }
    const response = await fetch(`/api/admin/tickets/${kind}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      showToast("Could not save the ticket: " + data.error, "error");
      return;
    }
    showToast(`Ticket number ${id} saved`, "success");
    onSaved();
  }

  return (
    <Overlay onClose={onClose}>
      <form
        className={"ticket-form ticket-editor " + kind}
       
        onSubmit={save}
      >
        <h2>
          Edit {isDryCleaning ? "dry cleaning" : "service wash"} ticket {id}
        </h2>
        {error ? (
          <p>{error}</p>
        ) : form === null ? (
          <p>Loading…</p>
        ) : (
          <>
            <p className="editor-note">Made {form.created_at}</p>
            <label>
              Name
              <input
                value={form.customer_name}
                onChange={(e) => set("customer_name", e.target.value)}
                required
              />
            </label>
            <label>
              Phone number
              <input
                value={form.phone_number}
                onChange={(e) => set("phone_number", e.target.value)}
                required
              />
            </label>
            <label>
              {isDryCleaning ? "Clothes description" : "Load description"}
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                required
              />
            </label>

            {isDryCleaning && (
              <>
                <h3>Items</h3>
                {form.items.length === 0 && (
                  <p className="editor-note">No items on this ticket.</p>
                )}
                {form.items.map((item, index) => (
                  <div className="editor-item" key={index}>
                    <input
                      aria-label="Item"
                      placeholder="Item"
                      value={item.item_name}
                      onChange={(e) =>
                        setItem(index, "item_name", e.target.value)
                      }
                      required
                    />
                    <select
                      aria-label="Service"
                      value={item.service}
                      onChange={(e) => setItem(index, "service", e.target.value)}
                    >
                      <option value="clean">Dry clean</option>
                      <option value="press">Press only</option>
                    </select>
                    <input
                      aria-label="How many"
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) =>
                        setItem(index, "quantity", e.target.value)
                      }
                      required
                    />
                    <input
                      aria-label="Price for one"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) =>
                        setItem(index, "unit_price", e.target.value)
                      }
                      required
                    />
                    <button
                      type="button"
                      aria-label="Remove item"
                      onClick={() =>
                        set(
                          "items",
                          form.items.filter((_, i) => i !== index),
                        )
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="form-actions editor-item-actions">
                  <button
                    type="button"
                    onClick={() =>
                      set("items", [
                        ...form.items,
                        {
                          price_list_id: null,
                          item_name: "",
                          service: "clean",
                          quantity: "1",
                          unit_price: "0.00",
                        },
                      ])
                    }
                  >
                    Add item
                  </button>
                  {form.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          price: itemsTotal.toFixed(2),
                          number_of_pieces: String(itemsPieces),
                        })
                      }
                    >
                      Use items total ({pounds(itemsTotal)}, {itemsPieces}{" "}
                      pieces)
                    </button>
                  )}
                </div>
                <label>
                  Number of pieces
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.number_of_pieces}
                    onChange={(e) => set("number_of_pieces", e.target.value)}
                    required
                  />
                </label>
              </>
            )}

            {!isDryCleaning && (
              <label>
                Load size
                <select
                  value={form.load_size}
                  onChange={(e) => set("load_size", e.target.value)}
                >
                  <option value="">None</option>
                  {/* Keep a size that has since been removed from the price list */}
                  {form.load_size &&
                    !loadSizes.some((size) => size.name === form.load_size) && (
                      <option>{form.load_size}</option>
                    )}
                  {loadSizes.map((size) => (
                    <option key={size.id} value={size.name}>
                      {size.name} ({priceText(size.price_min, size.price_max)})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Pickup day
              <select
                value={form.pickup_time}
                onChange={(e) => set("pickup_time", e.target.value)}
              >
                {PICKUP_DAYS.map((day) => (
                  <option key={day}>{day}</option>
                ))}
              </select>
            </label>
            <div className="editor-row">
              <label>
                Price (£)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  required
                />
              </label>
              <label>
                Discount (£)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount}
                  onChange={(e) => set("discount", e.target.value)}
                />
              </label>
              <label>
                Deposit (£)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.deposit}
                  onChange={(e) => set("deposit", e.target.value)}
                />
              </label>
            </div>

            {Number(form.discount) > 0 && (
              <p className="editor-note">
                Price after discount:{" "}
                {pounds(Math.max(0, form.price - form.discount))}
              </p>
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.paid}
                onChange={(e) => set("paid", e.target.checked)}
              />
              Paid
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.collected}
                onChange={(e) => set("collected", e.target.checked)}
              />
              Collected
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.cancelled}
                onChange={(e) => set("cancelled", e.target.checked)}
              />
              Cancelled
            </label>
            {canRefund && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.refund}
                  onChange={(e) => set("refund", e.target.checked)}
                />
                Give {pounds(paidSoFar)} back (taken off{" "}
                {isDryCleaning ? "dry cleaning" : "service wash"} money)
              </label>
            )}
            <p className="editor-note">
              Ticking Paid or Collected records it as happening now.
            </p>
          </>
        )}

        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
          {form && (
            <button type="submit" className="confirm-button" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          )}
        </div>
      </form>
    </Overlay>
  );
}
