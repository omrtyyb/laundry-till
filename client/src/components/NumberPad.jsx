// On-screen number pad for touchscreen tills.
//
// It works with every number box in the app without changing them: when a box
// marked inputMode="numeric" (whole numbers) or inputMode="decimal" (money) gets
// focus on a touchscreen, the pad slides up from the bottom and its keys type into
// that box. The computer's own on-screen keyboard is kept away for these boxes.
//
// When is it shown? On touchscreens that are wider than a phone. Phones already
// show their own number keyboard, so the pad stays hidden there.
// To force it on or off on one computer, open the browser console and run
//   localStorage.numberPad = "on"   (or "off", or delete it to go back to automatic)

import { useEffect, useRef, useState } from "react";

function padWanted() {
  try {
    const choice = localStorage.getItem("numberPad");
    if (choice === "on") return true;
    if (choice === "off") return false;
  } catch {
    // Storage blocked: fall back to automatic
  }
  return window.matchMedia("(any-pointer: coarse) and (min-width: 701px)")
    .matches;
}

// Which kind of number a box takes: "numeric" (whole), "decimal" (money), or null
function padKind(element) {
  if (!(element instanceof HTMLInputElement)) return null;
  // While the pad is open the box's inputMode is "none"; its real kind is kept here
  const kind = element.dataset.padKind || element.inputMode;
  return kind === "numeric" || kind === "decimal" ? kind : null;
}

// Puts text into the box the same way typing would, so the forms notice the change
function typeInto(element, text) {
  // A type="number" box can't hold "12." yet, so it gets "12" until the next digit
  const value =
    element.type === "number" && text.endsWith(".") ? text.slice(0, -1) : text;
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  ).set;
  setValue.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

export default function NumberPad() {
  // The number box being typed into, or null when the pad is hidden
  const [target, setTarget] = useState(null);
  // What has been typed so far (can end in "." while typing money)
  const [text, setText] = useState("");
  const targetRef = useRef(null);

  useEffect(() => {
    const onFocus = (event) => {
      const element = event.target;
      const kind = padKind(element);
      if (!kind || !padWanted()) return;
      // Keep the computer's own keyboard away while the pad is used
      element.dataset.padKind = kind;
      element.inputMode = "none";
      targetRef.current = element;
      setTarget(element);
      setText(element.value);
      // Once the form has moved up for the pad, make sure the box is still in view
      setTimeout(() => element.scrollIntoView({ block: "nearest" }), 50);
    };
    const onBlur = (event) => {
      const element = event.target;
      if (element !== targetRef.current) return;
      element.inputMode = element.dataset.padKind;
      delete element.dataset.padKind;
      targetRef.current = null;
      setTarget(null);
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
    };
  }, []);

  // Moves the open form up so the pad doesn't cover it
  useEffect(() => {
    document.body.classList.toggle("number-pad-open", target !== null);
  }, [target]);

  if (target === null) {
    return null;
  }

  const kind = target.dataset.padKind;
  const label =
    target.closest("label")?.firstChild?.textContent?.trim() ||
    target.placeholder ||
    "Number";

  const press = (key) => {
    let next = text;
    if (key === "⌫") {
      next = text.slice(0, -1);
    } else if (key === ".") {
      // Only money has a decimal point, and only one of them
      if (kind !== "decimal" || text.includes(".")) return;
      next = (text === "" ? "0" : text) + ".";
    } else {
      // At most 2 digits after the decimal point
      const [, pence] = text.split(".");
      if (pence !== undefined && pence.length >= 2) return;
      // Respect a box's maximum length, e.g. a PIN of up to 6 digits
      if (target.maxLength > 0 && text.length >= target.maxLength) return;
      next = text + key;
    }
    setText(next);
    typeInto(target, next);
  };

  // preventDefault on pointer down keeps the focus (and the pad) on the number box
  const keepFocus = (event) => event.preventDefault();

  return (
    <div
      className="number-pad"
      onPointerDown={keepFocus}
      onMouseDown={keepFocus}
    >
      <div className="number-pad-display">
        <span>{label}</span>
        <strong>
          {target.type === "password" ? "•".repeat(text.length) : text || " "}
        </strong>
      </div>
      <div className="number-pad-keys">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={key === "." && kind !== "decimal" ? "unused" : ""}
            disabled={key === "." && kind !== "decimal"}
            onClick={() => press(key)}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="number-pad-actions">
        <button
          type="button"
          onClick={() => {
            setText("");
            typeInto(target, "");
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className="confirm-button"
          onClick={() => target.blur()}
        >
          Done
        </button>
      </div>
    </div>
  );
}
