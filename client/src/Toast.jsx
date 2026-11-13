// Small messages that pop up for 2 seconds and go away on their own, e.g.
// "Ticket number 12 saved" (green) or "Could not save the ticket: ..." (red).
//
// Messages are sent with showToast() from utils/toast.js; the <Toast /> in App.jsx shows them.

import { useEffect, useState } from "react";

const SHOW_FOR_MS = 2000;

export default function Toast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let timer;
    const onToast = (event) => {
      setToast(event.detail);
      // A new message restarts the 2 seconds
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), SHOW_FOR_MS);
    };
    window.addEventListener("toast", onToast);
    return () => {
      window.removeEventListener("toast", onToast);
      clearTimeout(timer);
    };
  }, []);

  if (toast === null) return null;

  return (
    <div className={"toast " + toast.kind} role="status">
      {toast.message}
    </div>
  );
}
