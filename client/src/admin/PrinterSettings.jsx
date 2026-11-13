// Admin "Printer": which receipt printer the shop has, how it's connected, and what is
// printed at the top and bottom of every receipt (with a preview), and how garment tags look. Choosing a model fills
// in its paper width, letters per line and cutter; any of them can still be changed.

import { useEffect, useState } from "react";
import { showToast } from "../utils/toast.js";
import { sendToPrinter } from "../utils/print.js";

// Breaks text into lines no longer than width letters, at spaces where possible
// (the same way the server lays out the receipt)
function wrap(text, width) {
  const out = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word;
    while (rest.length > width) {
      if (line) out.push(line), (line = "");
      out.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    if (!line) line = rest;
    else if (line.length + 1 + rest.length <= width) line += " " + rest;
    else out.push(line), (line = rest);
  }
  out.push(line);
  return out;
}

// What the top and bottom of a receipt will look like on this paper width, with a
// made-up ticket in the middle. Updates as the admin types.
function ReceiptPreview({ settings }) {
  const chars = Number(settings.chars) || 32;
  const centre = (text, width = chars) =>
    text
      .split("\n")
      .flatMap((line) => (line.trim() ? wrap(line.trim(), width) : [""]))
      .map((piece) => " ".repeat(Math.floor((width - piece.length) / 2)) + piece);
  const divider = "-".repeat(chars);
  const row = (left, right) => left + " ".repeat(Math.max(1, chars - left.length - right.length)) + right;
  const top = [
    ...(settings.shop_name
      ? centre(settings.shop_name, Math.floor(chars / 2)).map((text) => ({ text, big: true }))
      : []),
    ...(settings.header_text ? centre(settings.header_text).map((text) => ({ text })) : []),
  ];
  const lines = [
    ...top,
    ...(top.length ? [{ text: divider }] : []),
    { text: centre("DRY CLEANING")[0], bold: true },
    { text: centre("Ticket No. 123")[0], bold: true },
    { text: divider },
    { text: row("Shirt x2", "£7.00") },
    { text: row("TOTAL", "£7.00"), bold: true },
    { text: divider },
    ...(settings.footer ? [{ text: "" }, ...centre(settings.footer).map((text) => ({ text }))] : []),
  ];
  return (
    <div className="receipt-preview-wrap">
      <span className="report-note">How it will look ({settings.paper}mm paper)</span>
      <div className="receipt-preview" style={{ width: `${chars}ch` }}>
        {lines.map((line, index) => (
          <div
            key={index}
            className={(line.big ? "big " : "") + (line.bold ? "bold" : "")}
          >
            {line.text || "\u00a0"}
          </div>
        ))}
      </div>
    </div>
  );
}

// What the garment tags will look like for a made-up ticket with 5 pieces. The server lays
// them out (the same way it prints them), so the preview matches the paper.
function TagPreview({ settings }) {
  const [strips, setStrips] = useState(null);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/printer/tag-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        });
        const data = await response.json();
        if (current) setStrips(response.ok ? data.strips : null);
      } catch {
        if (current) setStrips(null);
      }
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [settings]);
  const chars = Number(settings.chars) || 32;
  return (
    <div className="receipt-preview-wrap">
      <span className="report-note">How the tags will look (5 pieces, {settings.paper}mm paper)</span>
      {!strips && <span className="report-note">No preview: check the printer settings above.</span>}
      {strips &&
        strips.map((rows, s) => (
          <div key={s} className="receipt-preview" style={{ width: `${chars}ch` }}>
            {rows.map((row, i) => (
              <div key={i} className={(row.big ? "big " : "") + (row.bold ? "bold" : "")}>
                {row.text || "\u00a0"}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

export default function PrinterSettings() {
  const [settings, setSettings] = useState(null);
  const [models, setModels] = useState([]);
  const [codePages, setCodePages] = useState([]);
  const [queues, setQueues] = useState([]);
  const [error, setError] = useState(null);
  const [printing, setPrinting] = useState(false);

  const load = async () => {
    const response = await fetch("/api/admin/printer");
    const data = await response.json();
    setSettings(data.settings);
    setModels(data.models);
    setCodePages(data.codePages);
    setQueues(data.queues);
  };

  useEffect(() => {
    load();
  }, []);

  if (!settings) return <section className="report">Loading…</section>;

  const set = (key, value) => setSettings({ ...settings, [key]: value });

  const chooseModel = (id) => {
    const model = models.find((m) => m.id === id);
    setSettings({
      ...settings,
      model: id,
      paper: model.paper,
      chars: model.chars,
      cut: model.cut,
      // "Any other printer" always uses the print window; leaving it goes back to USB
      connection: id === "browser" ? "browser" : settings.connection === "browser" ? "usb" : settings.connection,
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    const response = await fetch("/api/admin/printer", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await response.json();
    if (response.ok) {
      setSettings(data.settings);
      showToast("Printer settings saved");
    } else {
      setError(data.error);
    }
  };

  const testPrint = async () => {
    setError(null);
    setPrinting(true);
    if (await sendToPrinter("/api/admin/printer/test", settings)) {
      if (settings.connection !== "browser") showToast("Test page sent to the printer");
    }
    setPrinting(false);
  };

  const testTags = async () => {
    setError(null);
    setPrinting(true);
    if (await sendToPrinter("/api/admin/printer/test-tags", settings)) {
      if (settings.connection !== "browser") showToast("Test tags sent to the printer");
    }
    setPrinting(false);
  };

  return (
    <section className="report">
      <h2>Printer</h2>
      <form className="ticket-form security-form" onSubmit={save}>
        <h3>Receipt printer</h3>
        <label>
          Printer model
          <select value={settings.model} onChange={(e) => chooseModel(e.target.value)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        {settings.connection !== "browser" && (
          <label>
            Connected by
            <select value={settings.connection} onChange={(e) => set("connection", e.target.value)}>
              <option value="usb">USB cable</option>
              <option value="network">Network or Wi-Fi</option>
            </select>
          </label>
        )}

        {settings.connection === "usb" && (
          <label>
            USB printer
            <select value={settings.queue} onChange={(e) => set("queue", e.target.value)}>
              <option value="">Choose…</option>
              {/* Keep a saved printer in the list even if it's switched off right now */}
              {[...new Set([...queues, settings.queue].filter(Boolean))].map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
            <small>
              {queues.length === 0 && "No printers found on this computer. "}
              Plug the printer in and add it in System Settings → Printers & Scanners, then{" "}
              <button type="button" className="link-button" onClick={load}>
                look again
              </button>
              .
            </small>
          </label>
        )}

        {settings.connection === "network" && (
          <>
            <label>
              Printer IP address
              <input
                placeholder="e.g. 192.168.1.50"
                value={settings.ip}
                onChange={(e) => set("ip", e.target.value)}
              />
              <small>Most receipt printers print their IP address if you hold the feed button while switching on.</small>
            </label>
            <label>
              Port
              <input type="number" value={settings.port} onChange={(e) => set("port", e.target.value)} />
            </label>
          </>
        )}

        <label>
          Paper width
          <select value={settings.paper} onChange={(e) => set("paper", Number(e.target.value))}>
            <option value={58}>58mm</option>
            <option value={80}>80mm</option>
          </select>
        </label>
        <label>
          Letters per line
          <input type="number" min={24} max={64} value={settings.chars} onChange={(e) => set("chars", e.target.value)} />
          <small>Usually 32 on 58mm paper and 48 on 80mm. Check with a test print.</small>
        </label>

        {settings.connection !== "browser" && (
          <>
            <label>
              Paper cut
              <select value={settings.cut} onChange={(e) => set("cut", e.target.value)}>
                <option value="partial">Cut, leaving a small join (most printers)</option>
                <option value="full">Cut right through</option>
                <option value="none">No cutter: tear off by hand</option>
              </select>
            </label>
            <label>
              Blank lines at the end
              <input
                type="number"
                min={0}
                max={10}
                value={settings.feed_lines}
                onChange={(e) => set("feed_lines", e.target.value)}
              />
            </label>
            <label>
              Character set
              <select value={settings.code_page} onChange={(e) => set("code_page", Number(e.target.value))}>
                {codePages.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <small>Only change this if £ prints as a different symbol.</small>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.open_drawer}
                onChange={(e) => set("open_drawer", e.target.checked)}
              />
              Open the cash drawer after printing (drawer plugged into the printer)
            </label>
          </>
        )}

        <h3>Tickets</h3>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.print_new_tickets}
            onChange={(e) => set("print_new_tickets", e.target.checked)}
          />
          Print a ticket as soon as it's saved
        </label>
        <label>
          Copies of each ticket
          <select value={settings.ticket_copies} onChange={(e) => set("ticket_copies", Number(e.target.value))}>
            <option value={1}>1: for the customer</option>
            <option value={2}>2: for the customer, and a shop copy to keep with the clothes</option>
          </select>
        </label>
        <h3>Garment tags</h3>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.print_garment_tags}
            onChange={(e) => set("print_garment_tags", e.target.checked)}
          />
          With a new dry cleaning ticket, also print small tags to cut out and pin to each piece
        </label>
        <div className="receipt-custom">
          <div className="receipt-custom-boxes">
            <label>
              Style
              <select value={settings.tag_style} onChange={(e) => set("tag_style", e.target.value)}>
                <option value="grid">Grid: side by side in boxes (least paper)</option>
                <option value="list">List: one line per piece</option>
                <option value="separate">Separate: each tag cut on its own</option>
              </select>
            </label>
            {settings.tag_style === "grid" && (
              <label>
                Tags across the paper
                <select value={settings.tag_across} onChange={(e) => set("tag_across", Number(e.target.value))}>
                  <option value={0}>Automatic (2 on 58mm, 3 on 80mm)</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
                <small>If the boxes would be too narrow, fewer are printed across.</small>
              </label>
            )}
            <label>
              Customer's name
              <select value={settings.tag_name} onChange={(e) => set("tag_name", e.target.value)}>
                <option value="full">Full name</option>
                <option value="surname">Surname only, in capitals</option>
                <option value="first">First name only</option>
                <option value="none">No name</option>
              </select>
            </label>
            <span className="report-note">Every tag has its own number, like 123-2 (ticket 123, piece 2). Also show:</span>
            {[
              ["tag_count", "How many pieces, like (2/5)"],
              ["tag_item", "The item, like Shirt (when price list items were picked for every piece)"],
              ["tag_ready", "The ready day"],
              ["tag_phone", "The last 4 digits of the phone number"],
              ...(settings.tag_style !== "grid" ? [["tag_big_number", "The number in big letters"]] : []),
            ].map(([key, label]) => (
              <label key={key} className="checkbox-label">
                <input type="checkbox" checked={settings[key]} onChange={(e) => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
            <div className="form-actions">
              <button type="button" onClick={testTags} disabled={printing}>
                Test print tags
              </button>
            </div>
          </div>
          <TagPreview settings={settings} />
        </div>

        <h3>Customise the receipt</h3>
        <div className="receipt-custom">
          <div className="receipt-custom-boxes">
            <label>
              Shop name (printed big at the very top)
              <input
                value={settings.shop_name}
                placeholder="e.g. Rainbow Dry Cleaners"
                onChange={(e) => set("shop_name", e.target.value)}
              />
            </label>
            <label>
              Top of the receipt, under the name
              <textarea
                rows={4}
                value={settings.header_text}
                placeholder={"Anything you like, one line each, e.g.\n12 High Street, London\nTel: 020 1234 5678\nOpen 8am–8pm, 7 days"}
                onChange={(e) => set("header_text", e.target.value)}
              />
            </label>
            <label>
              Bottom of the receipt
              <textarea
                rows={4}
                value={settings.footer}
                placeholder={"e.g.\nThank you!\n12 High Street, London\nTel: 020 1234 5678"}
                onChange={(e) => set("footer", e.target.value)}
              />
            </label>
            <p className="report-note">
              Each line is printed in the middle of the paper. Long lines move onto the next
              line. Leave a line empty for a gap.
            </p>
          </div>
          <ReceiptPreview settings={settings} />
        </div>

        {error && <p className="takings-error">{error}</p>}
        <div className="form-actions">
          <button type="button" onClick={testPrint} disabled={printing}>
            {printing ? "Printing…" : "Test print"}
          </button>
          <button type="submit">Save</button>
        </div>
      </form>
      <p className="report-note">
        Test print uses the settings on screen, so you can try them before saving.
      </p>
    </section>
  );
}
