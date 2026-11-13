// Pop-up form for a new dry cleaning or service wash ticket.
// Opened by the two "Generate ... Ticket" buttons on the till, and by "New ticket" in Admin → Tickets.

import { useEffect, useRef, useState } from "react";
import { priceText } from "../utils/priceText.js";
import { defaultPickupDay } from "../utils/dates.js";
import CustomerSuggestions from "./CustomerSuggestions.jsx";
import PriceListPicker from "./PriceListPicker.jsx";
import { showToast } from "../utils/toast.js";
import { sendToPrinter } from "../utils/print.js";
import { pounds } from "../utils/money.js";
import Overlay from "../Overlay.jsx";
import LoyaltyOffer from "./LoyaltyOffer.jsx";

// ticketType is one of the settings in ticketTypes.js
export default function TicketForm({ ticketType, onClose }) {
  const nameBox = useRef(null);
  const phoneBox = useRef(null);
  // Customers matching what's typed, and which box they're shown under
  const [suggestions, setSuggestions] = useState([]);
  const [suggestFor, setSuggestFor] = useState(null);
  const timer = useRef(null);
  // Price, Paid and Deposit are followed here to show how much is still owed
  const [price, setPrice] = useState("");
  const [paidNow, setPaidNow] = useState(false);
  const [deposit, setDeposit] = useState("");
  // Service wash: the load sizes from the price list, and the one picked
  const [loadSizes, setLoadSizes] = useState([]);
  const [loadSize, setLoadSize] = useState(null);
  useEffect(() => {
    if (!ticketType.hasLoadSizes) return;
    fetch("/api/service-wash-prices")
      .then((response) => response.json())
      .then((sizes) => setLoadSizes(sizes));
  }, [ticketType.hasLoadSizes]);
  // Picking a load size fills in its lowest price; it can be raised up to its highest
  const pickLoadSize = (size) => {
    setLoadSize(size);
    priceBox.current.value = size.price_min.toFixed(2);
    setPrice(size.price_min.toFixed(2));
  };
  // Money taken off the price, £0 unless the customer is given a discount
  const [discount, setDiscount] = useState("0");
  // Whether the Discount box is in pounds ("£") or a percentage of the price ("%")
  const [discountUnit, setDiscountUnit] = useState("%");
  // Items picked from the price list (dry cleaning), and the boxes they fill in
  const [lines, setLines] = useState([]);
  const descriptionBox = useRef(null);
  const piecesBox = useRef(null);
  const priceBox = useRef(null);

  // Picking items fills in the description, number of pieces and price.
  // Staff can still change them by hand afterwards.
  const pickItems = (newLines) => {
    setLines(newLines);
    if (newLines.length === 0) return;
    const total = newLines.reduce(
      (sum, line) => sum + line.quantity * line.unit_price,
      0,
    );
    const pieces = newLines.reduce((sum, line) => sum + line.quantity, 0);
    descriptionBox.current.value = newLines
      .map(
        (line) =>
          `${line.quantity} × ${line.name}${line.service === "press" ? " (press only)" : ""}`,
      )
      .join(", ");
    if (piecesBox.current) piecesBox.current.value = pieces;
    priceBox.current.value = total.toFixed(2);
    setPrice(total.toFixed(2));
  };
  // The loyalty reward (Admin → Loyalty rewards): where this customer stands, and whether
  // the worker chose to give the reward on this ticket. Ticked by default when it's due.
  const [loyalty, setLoyalty] = useState(null);
  const [giveLoyalty, setGiveLoyalty] = useState(false);
  const loyaltyTimer = useRef(null);
  const checkLoyalty = () => {
    clearTimeout(loyaltyTimer.current);
    loyaltyTimer.current = setTimeout(async () => {
      const name = nameBox.current.value.trim();
      const phone = phoneBox.current.value.trim();
      if (!name || !phone) return setLoyalty(null);
      const response = await fetch(
        `/api/loyalty/status?kind=${ticketType.kind}&name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`,
      );
      const status = response.ok ? await response.json() : null;
      setLoyalty(status);
      setGiveLoyalty(Boolean(status?.due));
    }, 400);
  };
  // The discount box in pounds: 20 in "%" on a £45.50 ticket is £9.10
  const discountPounds =
    discountUnit === "%"
      ? Math.round(Number(price || 0) * Math.min(100, Number(discount || 0))) / 100
      : Number(discount || 0);
  const loyaltyOff =
    giveLoyalty && loyalty?.due
      ? Math.round(Number(price || 0) * loyalty.percent) / 100
      : 0;
  const afterDiscount = Math.max(
    0,
    Number(price || 0) - discountPounds - loyaltyOff,
  );
  const owed = Math.max(0, afterDiscount - Number(deposit || 0));

  // Look up matching customers a moment after typing stops in Name or Phone number
  const lookUp = (field, text) => {
    clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const response = await fetch(
        "/api/customers/suggest?q=" + encodeURIComponent(text.trim()),
      );
      setSuggestions(await response.json());
      setSuggestFor(field);
    }, 200);
  };

  // Fill in both boxes from a picked customer
  const pickCustomer = (customer) => {
    nameBox.current.value = customer.customer_name;
    phoneBox.current.value = customer.phone_number;
    setSuggestions([]);
    checkLoyalty();
  };

  return (
    <Overlay onClose={onClose}>
      <form
        className={"ticket-form " + ticketType.kind}
        onSubmit={async (e) => {
          e.preventDefault();
          if (ticketType.hasLoadSizes && !loadSize) {
            showToast("Please choose the load size", "error");
            return;
          }
          const form = new FormData(e.target);

          const ticket = {
            customer_name: form.get("customer_name"),
            phone_number: form.get("phone_number"),
            [ticketType.descriptionName]: form.get(ticketType.descriptionName),
            pickup_time: form.get("pickup_time"),
            // Price in pounds, e.g. 12.50
            price: Number(form.get("price")),
            // true when the Paid box is ticked
            paid: form.get("paid") === "on",
            // Taken off the price by the server
            // In pounds, also when the Discount box is in %
            discount: discountPounds,
            // The loyalty reward, when due and the worker chose to give it (the server works out the money off)
            loyalty: Boolean(giveLoyalty && loyalty?.due),
          };
          if (ticketType.hasLoadSizes) ticket.load_size_id = loadSize.id;
          if (ticketType.hasNumberOfPieces) {
            ticket.number_of_pieces = Number(form.get("number_of_pieces"));
          }
          // Money taken now towards the price; the rest is paid on collection
          if (ticketType.hasPriceList) {
            ticket.items = lines.map((line) => ({
              price_list_id: line.price_list_id,
              service: line.service,
              quantity: line.quantity,
              unit_price: line.unit_price,
            }));
          }
          if (ticketType.hasDeposit && !ticket.paid) {
            ticket.deposit = Number(form.get("deposit") || 0);
          }

          // Send the ticket to the server to be saved
          const response = await fetch(ticketType.apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ticket),
          });
          const data = await response.json();

          if (!response.ok) {
            showToast("Could not save the ticket: " + data.error, "error");
            return;
          }

          showToast(
            data.deposit > 0
              ? `Ticket number ${data.id} saved · deposit ${pounds(data.deposit)}, ${pounds(data.price - data.deposit)} still owed`
              : `Ticket number ${data.id} saved`,
          );
          onClose();
          // Print the customer's ticket (skipped if no printer is set up in Admin → Printer)
          sendToPrinter(
            `${ticketType.printUrl || ticketType.apiUrl}/${data.id}/print`,
            { auto: true },
          );
        }}
      >
        <h2>{ticketType.title}</h2>
        <label>
          Name
          <input
            type="text"
            name="customer_name"
            autoComplete="off"
            required
            ref={nameBox}
            onInput={(e) => {
              lookUp("name", e.target.value);
              checkLoyalty();
            }}
          />
        </label>
        {suggestFor === "name" && (
          <CustomerSuggestions customers={suggestions} onPick={pickCustomer} />
        )}
        <label>
          Phone number
          <input
            type="tel"
            name="phone_number"
            // numeric opens the number pad on touchscreens
            inputMode="numeric"
            autoComplete="off"
            required
            ref={phoneBox}
            onInput={(e) => {
              lookUp("phone", e.target.value);
              checkLoyalty();
            }}
          />
        </label>
        {suggestFor === "phone" && (
          <CustomerSuggestions customers={suggestions} onPick={pickCustomer} />
        )}
        {ticketType.hasPriceList && (
          <>
            <h3>Items</h3>
            <PriceListPicker lines={lines} onChange={pickItems} />
          </>
        )}
        {ticketType.hasLoadSizes && (
          <>
            <h3>Load size</h3>
            <div className="price-items">
              {loadSizes.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  className={loadSize?.id === size.id ? "active" : ""}
                  onClick={() => pickLoadSize(size)}
                >
                  <span>{size.name}</span>
                  <small>{priceText(size.price_min, size.price_max)}</small>
                </button>
              ))}
            </div>
          </>
        )}
        <label>
          {ticketType.descriptionLabel}
          <textarea
            name={ticketType.descriptionName}
            rows="3"
            required
            ref={descriptionBox}
          />
        </label>
        {ticketType.hasNumberOfPieces && (
          <label>
            Number of pieces
            <input
              type="number"
              name="number_of_pieces"
              ref={piecesBox}
              min="1"
              step="1"
              inputMode="numeric"
              required
              // Only allow whole numbers: block the decimal point and similar keys
              onKeyDown={(e) => {
                if ([".", ",", "e", "E", "-", "+"].includes(e.key)) {
                  e.preventDefault();
                }
              }}
            />
          </label>
        )}
        <label>
          Pickup time
          <select name="pickup_time" required defaultValue={defaultPickupDay()}>
            <option value="" disabled>
              Choose a day
            </option>
            <option>Monday</option>
            <option>Tuesday</option>
            <option>Wednesday</option>
            <option>Thursday</option>
            <option>Friday</option>
            <option>Saturday</option>
            <option>Sunday</option>
          </select>
        </label>
        <label>
          Price (£)
          <input
            type="number"
            name="price"
            ref={priceBox}
            // A service wash price must stay inside the load size's range
            min={loadSize ? loadSize.price_min : 0}
            max={loadSize ? loadSize.price_max : undefined}
            step="0.01"
            placeholder="0.00"
            inputMode="decimal"
            required
            // Block keys that don't belong in a price
            onKeyDown={(e) => {
              if (["e", "E", "-", "+"].includes(e.key)) {
                e.preventDefault();
              }
            }}
            // Keep at most two digits after the decimal point, e.g. 12.555 becomes 12.55
            onInput={(e) => {
              const [whole, pence] = e.target.value.split(".");
              if (pence && pence.length > 2) {
                e.target.value = whole + "." + pence.slice(0, 2);
              }
              setPrice(e.target.value);
            }}
          />
        </label>
        <div className="discount-field">
          <label>
            Discount ({discountUnit === "%" ? "% off the price" : "£ off the price"})
            <input
              type="number"
              name="discount"
              min="0"
              max={discountUnit === "%" ? 100 : undefined}
              step="0.01"
              inputMode="decimal"
              value={discount}
              // Block keys that don't belong in an amount
              onKeyDown={(e) => {
                if (["e", "E", "-", "+"].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              // Keep at most two digits after the decimal point
              onChange={(e) => {
                const [whole, pence] = e.target.value.split(".");
                setDiscount(
                  pence && pence.length > 2
                    ? whole + "." + pence.slice(0, 2)
                    : e.target.value,
                );
              }}
            />
          </label>
          {/* Choose whether the number is a percentage or pounds */}
          <div className="discount-unit">
            {["%", "£"].map((unit) => (
              <button
                key={unit}
                type="button"
                className={"sort-button" + (discountUnit === unit ? " active" : "")}
                onClick={() => setDiscountUnit(unit)}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>
        {discountUnit === "%" && discountPounds > 0 && (
          <p className="owed-note">
            {Number(discount)}% off = <strong>{pounds(discountPounds)}</strong>
          </p>
        )}
        <LoyaltyOffer
          status={loyalty}
          label={ticketType.kind === "dryCleaning" ? "dry cleaning" : "service wash"}
          give={giveLoyalty}
          onGive={setGiveLoyalty}
          fullPrice={Number(price || 0)}
        />
        {(discountPounds > 0 || loyaltyOff > 0) && (
          <p className="owed-note">
            Price after discount: <strong>{pounds(afterDiscount)}</strong>
          </p>
        )}
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="paid"
            onChange={(e) => setPaidNow(e.target.checked)}
          />
          Paid in full
        </label>
        {/* Part of the price can be paid now, the rest on collection */}
        {ticketType.hasDeposit && !paidNow && (
          <>
            <label>
              Deposit paid now (£), optional
              <input
                type="number"
                name="deposit"
                min="0"
                step="0.01"
                placeholder="0.00"
                inputMode="decimal"
                // Block keys that don't belong in an amount
                onKeyDown={(e) => {
                  if (["e", "E", "-", "+"].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                // Keep at most two digits after the decimal point
                onInput={(e) => {
                  const [whole, pence] = e.target.value.split(".");
                  if (pence && pence.length > 2) {
                    e.target.value = whole + "." + pence.slice(0, 2);
                  }
                  setDeposit(e.target.value);
                }}
              />
            </label>
            {Number(deposit) > 0 && (
              <p className="owed-note">
                Still owed on collection: <strong>{pounds(owed)}</strong>
              </p>
            )}
          </>
        )}
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">Generate Ticket</button>
        </div>
      </form>
    </Overlay>
  );
}
