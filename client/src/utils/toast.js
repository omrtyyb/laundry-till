// Shows a 2-second pop-up message (see Toast.jsx). Use it anywhere in the app:
//   showToast("Ticket number 12 saved")          green
//   showToast("Could not save: ...", "error")    red
export function showToast(message, kind = "success") {
  window.dispatchEvent(new CustomEvent("toast", { detail: { message, kind } }));
}
