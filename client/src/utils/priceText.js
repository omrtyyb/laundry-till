// Shows a price list price: "£6.50", or a range like "£13.00–£20.00"
import { pounds } from "./money.js";

export function priceText(min, max) {
  return min === max ? pounds(min) : `${pounds(min)}–${pounds(max)}`;
}
