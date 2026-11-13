// A thin moving line along the bottom of the screen while a ticket is being printed.
// sendToPrinter() in utils/print.js says when printing starts and ends with "printing"
// events. Jobs that finish almost at once (e.g. no printer set up) don't show it, so the
// line doesn't flicker.

import { useEffect, useState } from "react";

const SHOW_AFTER_MS = 200;

export default function PrintingBar() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let timer;
    const onPrinting = (event) => {
      clearTimeout(timer);
      if (event.detail > 0) timer = setTimeout(() => setBusy(true), SHOW_AFTER_MS);
      else setBusy(false);
    };
    window.addEventListener("printing", onPrinting);
    return () => {
      window.removeEventListener("printing", onPrinting);
      clearTimeout(timer);
    };
  }, []);

  if (!busy) return null;
  return (
    <div className="printing-bar" role="status" aria-label="Printing">
      <span />
    </div>
  );
}
