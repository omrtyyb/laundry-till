// Small helpers for days, dates and times, shared by the till and admin screens.

// Days in the order JavaScript's getDay() counts them (Sunday is 0)
export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// The pickup day suggested on a new ticket: three days from today
export function defaultPickupDay() {
  const today = new Date().getDay();
  return DAYS[(today + 3) % 7];
}

// Turn "2026-10-24 15:30:00" into "3:30pm", adding the date if it wasn't today
export function formatTime(createdAt) {
  const date = new Date(createdAt.replace(" ", "T"));
  const time = date
    .toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(" ", "");
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday ? time : date.toLocaleDateString("en-GB") + " " + time;
}

// Today's date as "2026-10-24", in the shop's local time
export function todayString() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// This month as "2026-10", in the shop's local time
export function thisMonthString() {
  return todayString().slice(0, 7);
}

// "2026-10" becomes "October 2026"
export function monthName(month) {
  return new Date(month + "-01T12:00:00").toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

// "2026-10-24" becomes "Sat 24 Oct"
export function shortDayName(date) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
