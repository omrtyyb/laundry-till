// Printing receipts. The server prints straight to a receipt printer; when the printer is set
// to "Any other printer" it sends back the receipt's rows instead, and this opens the normal
// print window with them.
//   await sendToPrinter("/api/admin/printer/test", settings)   -> true if it printed

import JsBarcode from "jsbarcode";
import { showToast } from "./toast.js";
import { request } from "./api.js";

// How many print jobs are on their way. PrintingBar.jsx shows a thin moving line at the
// bottom of the screen while this is above 0; each change is sent as a "printing" event.
let printing = 0;
function setPrinting(change) {
  printing += change;
  window.dispatchEvent(new CustomEvent("printing", { detail: printing }));
}

// Asks the server to print. Shows a red message and returns false if it couldn't.
export async function sendToPrinter(url, body) {
  setPrinting(+1);
  try {
    const { ok, data } = await request(url, { method: "POST", body: body || {} });
    if (!ok) {
      showToast(`Could not print: ${data.error}`, "error");
      return false;
    }
    if (data.browser) printInBrowser(data);
    return true;
  } catch {
    showToast("Could not print: the till server is not answering", "error");
    return false;
  } finally {
    setPrinting(-1);
  }
}

const escapeHtml = (text) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// A Code 128 barcode as an SVG, as wide as the printer would draw it (bars about 0.25mm on
// 58mm paper, 0.375mm on 80mm), with no number under it. Same as the receipt printer's own.
function barcodeSvg(value, paper) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, { format: "CODE128", width: 2, height: 64, displayValue: false, margin: 0 });
  const dots = parseFloat(svg.getAttribute("width")); // 1 unit = 1 printer dot (8 dots per mm)
  const mm = (dots / 8) * (paper === 58 ? 1 : 1.5);
  svg.setAttribute("viewBox", `0 0 ${dots} 64`);
  svg.setAttribute("style", `display:block;margin:0 auto;width:${mm}mm;height:8mm`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  return svg.outerHTML;
}

// Prints the rows ({ text, bold, big }, or { barcode }) through the browser's print window, on a page as
// wide as the receipt paper. The letters are sized so a full line fits across the paper.
function printInBrowser({ rows, paper, chars }) {
  const printable = paper === 58 ? 48 : 72; // mm the printer can reach on that paper
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${paper}mm auto; margin: 0; }
    body { margin: 0; padding: 2mm ${(paper - printable) / 2}mm; font-family: "Courier New", monospace;
           font-size: ${(printable / chars / 0.6).toFixed(2)}mm; line-height: 1.25; color: #000; }
    div { white-space: pre; }
    .bold { font-weight: bold; }
    .big { font-size: 2em; font-weight: bold; }
    .barcode { text-align: center; line-height: 0; padding: 1mm 0; }
  </style></head><body>${rows
    .map((row) => {
      if (row.barcode) return `<div class="barcode">${barcodeSvg(row.barcode, paper)}</div>`;
      const classes = [row.bold && "bold", row.big && "big"].filter(Boolean).join(" ");
      return `<div class="${classes}">${escapeHtml(row.text) || "&nbsp;"}</div>`;
    })
    .join("")}</body></html>`;

  // A hidden frame, so the till screen stays as it is
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  frame.contentDocument.open();
  frame.contentDocument.write(html);
  frame.contentDocument.close();
  frame.contentWindow.onafterprint = () => frame.remove();
  setTimeout(() => frame.contentWindow.print(), 50);
}
