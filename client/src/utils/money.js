// Shows money amounts the same way everywhere in the app.

// 12.5 becomes "£12.50", and -19.59 becomes "−£19.59"
export function pounds(amount) {
  return (amount < 0 ? "−£" : "£") + Math.abs(amount).toFixed(2);
}
