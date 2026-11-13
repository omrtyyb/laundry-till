// How a price or a price range is written in the edit history
// "£13.00" or "£13.00–£20.00"
export const priceText = (min, max) => (min === max ? `£${min.toFixed(2)}` : `£${min.toFixed(2)}–£${max.toFixed(2)}`)
