// The dark background behind every pop-up. Clicking the background (outside the box)
// or pressing Escape calls onClose, so any pop-up can be closed the same way.
//
//   <Overlay onClose={onClose}>
//     <div className="ticket-form">...</div>
//   </Overlay>
//
// A click only counts when it both starts and ends on the background, so selecting
// text in a box and letting go outside it doesn't close the pop-up. If one pop-up
// opens on top of another, Escape closes only the top one.

import { useEffect, useRef } from "react";

// The open pop-ups, oldest first: only the last one answers Escape
const openOverlays = [];

export default function Overlay({ onClose, children }) {
  const pressedOnBackground = useRef(false);
  // Always call the latest onClose, without re-adding the key listener each time
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const me = {};
    openOverlays.push(me);
    const onKey = (e) => {
      if (e.key === "Escape" && openOverlays.at(-1) === me) {
        e.preventDefault();
        closeRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      openOverlays.splice(openOverlays.indexOf(me), 1);
    };
  }, []);

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        pressedOnBackground.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedOnBackground.current && e.target === e.currentTarget) {
          closeRef.current?.();
        }
        pressedOnBackground.current = false;
      }}
    >
      {children}
    </div>
  );
}
