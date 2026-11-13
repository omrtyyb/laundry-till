// Suggestions under the Name and Phone number boxes on a new ticket: customers seen
// before whose name or phone matches what has been typed. Each shows both the name and
// the phone number, so staff can check it's the same person before picking it.

import { shortDayName } from "../utils/dates.js";

export default function CustomerSuggestions({ customers, onPick }) {
  if (customers.length === 0) return null;

  return (
    <ul className="customer-suggestions">
      {customers.map((customer) => (
        <li key={customer.customer_name + customer.phone_number}>
          <button
            type="button"
            // Picking a customer fills in both their name and phone number
            onClick={() => onPick(customer)}
          >
            <strong>{customer.customer_name}</strong>
            <span>{customer.phone_number}</span>
            <small>
              {customer.tickets} ticket{customer.tickets === 1 ? "" : "s"} ·
              last {shortDayName(customer.last_visit.slice(0, 10))}
            </small>
          </button>
        </li>
      ))}
    </ul>
  );
}
