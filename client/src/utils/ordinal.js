// 1 → "1st", 2 → "2nd", 10 → "10th", 22 → "22nd"
export function ordinal(n) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
  return n + suffix;
}
