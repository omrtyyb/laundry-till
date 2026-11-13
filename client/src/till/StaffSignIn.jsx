// Pop-up where a worker picks their name and types their PIN, so the till knows
// who is making each ticket, sale or refund. The PIN is checked by the server.

import { useEffect, useState } from "react";
import Overlay from "../Overlay.jsx";

export default function StaffSignIn({ onSignedIn, onClose }) {
  const [workers, setWorkers] = useState([]);
  // The worker whose name was picked, or null while choosing
  const [chosen, setChosen] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/staff")
      .then((response) => response.json())
      .then((data) => setWorkers(data));
  }, []);

  return (
    <Overlay onClose={onClose}>
      {chosen === null ? (
        <div className="ticket-form">
          <h2>Who is working?</h2>
          <div className="product-buttons">
            {workers.map((worker) => (
              <button key={worker.id} onClick={() => setChosen(worker)}>
                {worker.name}
              </button>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <form
          className="ticket-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const response = await fetch("/api/staff/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ staff_id: chosen.id, pin }),
            });
            const data = await response.json();
            if (response.ok) {
              onSignedIn(data.staff);
            } else {
              setError(data.error);
              setPin("");
            }
          }}
        >
          <h2>Hi {chosen.name}</h2>
          <label>
            Your PIN
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              required
              maxLength={6}
              value={pin}
              // Digits only
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          {error && <p className="takings-error">{error}</p>}
          <div className="form-actions">
            <button
              type="button"
              onClick={() => {
                setChosen(null);
                setPin("");
                setError(null);
              }}
            >
              Back
            </button>
            <button type="submit">Sign in</button>
          </div>
        </form>
      )}
    </Overlay>
  );
}
