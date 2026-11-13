// The "Money In" pop-up: collect a dry cleaning or service wash ticket,
// or record machine coins. Opened by the "Money In" button on the till.

import { useState } from "react";
import CollectTicket from "./CollectTicket.jsx";
import CollectMachineMoney from "./CollectMachineMoney.jsx";
import Overlay from "../Overlay.jsx";

// The Money In pop-up: choose what is being collected, then fill in that part
export default function MoneyInForm({ onClose }) {
  const [collection, setCollection] = useState("dryCleaning");

  return (
    <Overlay onClose={onClose}>
      {/* The band on top takes the colour of what is being collected */}
      <div
        className={
          "ticket-form " +
          (collection === "machines" ? "machineCoins" : collection)
        }
      >
        <h2>Money In</h2>
        <label>
          What are you collecting?
          <select
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
          >
            <option value="dryCleaning">Collection dry clean</option>
            <option value="serviceWash">Collection service wash</option>
            <option value="machines">Collection laundry machines</option>
          </select>
        </label>

        {/* key makes each choice start with an empty form */}
        {collection === "dryCleaning" && (
          <CollectTicket
            key="dryCleaning"
            ticketKind="dry-cleaning-tickets"
            descriptionName="clothes_description"
          />
        )}
        {collection === "serviceWash" && (
          <CollectTicket
            key="serviceWash"
            ticketKind="service-wash-tickets"
            descriptionName="load_description"
          />
        )}
        {collection === "machines" && <CollectMachineMoney />}

        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Overlay>
  );
}
