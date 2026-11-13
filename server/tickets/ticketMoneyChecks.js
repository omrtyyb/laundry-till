// Checks shared by the new dry cleaning and new service wash ticket routes.
import { round } from '../lib/money.js'

// Checks the discount and deposit on a new ticket. fullPrice is the price before the discount.
// Returns { error } or { price } (the price after the discount, which is what the ticket saves).
export function checkDiscountAndDeposit({ fullPrice, discount, deposit, paid }) {
  // A discount comes off the price; the ticket saves the price after the discount
  if (typeof discount !== 'number' || !(discount >= 0)) {
    return { error: 'The discount must be £0 or more' }
  }
  if (discount > fullPrice) {
    return { error: 'The discount can’t be more than the price' }
  }
  const price = round(fullPrice - discount)

  // A deposit is part of the price paid now; a fully paid ticket has no deposit
  if (typeof deposit !== 'number' || deposit < 0) {
    return { error: 'The deposit must be £0 or more' }
  }
  if (!paid && deposit > 0 && deposit >= price) {
    return { error: 'The deposit must be less than the price. If it is all paid, tick Paid instead.' }
  }
  return { price }
}
