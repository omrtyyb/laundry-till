// Money helpers shared by the whole server.
// Round to pennies so adding up decimals doesn't leave tiny leftovers
export const round = (amount) => Math.round(amount * 100) / 100
// "£12.50", for messages and the edit history
export const pounds = (amount) => `£${amount.toFixed(2)}`
