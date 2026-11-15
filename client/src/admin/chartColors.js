// Colours for the four kinds of income and for till spending, shared by the
// Admin charts. They are the same strong colours as --dry-cleaning, --service-wash,
// --products, --machine-coins and --spending in styles/01-base.css, so each kind looks the same
// on the till, in the lists and in the charts. Change both together.

// In the order they are stacked in the bars, bottom to top
export const CHART_PARTS = [
  { key: "dryCleaning", label: "Dry cleaning", color: "#7c3aed" },
  { key: "serviceWash", label: "Service wash", color: "#0891b2" },
  { key: "products", label: "Product sales", color: "#16a34a" },
  { key: "machineCoins", label: "Machine coins", color: "#2563eb" },
];

export const SPENDING_COLOR = "#d97706";
