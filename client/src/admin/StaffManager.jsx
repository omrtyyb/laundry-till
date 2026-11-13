// Admin "Staff": add shop workers with a PIN, rename them, change their PIN,
// and remove or bring back workers. Removed workers can't sign in on the till,
// but their names stay on the tickets and sales they made.

import { useEffect, useState } from "react";

// Keep only digits, at most 6
const digitsOnly = (text) => text.replace(/\D/g, "").slice(0, 6);

export default function StaffManager() {
  const [workers, setWorkers] = useState(null);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  // The worker being edited: { id, name, pin } or null
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const loadWorkers = () =>
    fetch("/api/admin/staff")
      .then((response) => response.json())
      .then((data) => setWorkers(data));

  useEffect(() => {
    loadWorkers();
  }, []);

  // Sends a change to the server, then shows its result and reloads the list
  const send = async (url, method, body, successText) => {
    setMessage(null);
    setError(null);
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error);
      return false;
    }
    setMessage(successText);
    loadWorkers();
    return true;
  };

  if (workers === null) {
    return <p>Loading…</p>;
  }

  return (
    <section className="report">
      <h2>Staff</h2>
      <p className="report-note">
        Workers pick their name and type their PIN on the till, so every ticket,
        sale and refund shows who made it. Until at least one worker is added,
        the till works without names.
      </p>

      <form
        className="staff-add"
        onSubmit={async (e) => {
          e.preventDefault();
          const added = await send(
            "/api/admin/staff",
            "POST",
            { name: newName, pin: newPin },
            `${newName.trim()} added.`,
          );
          if (added) {
            setNewName("");
            setNewPin("");
          }
        }}
      >
        <input
          type="text"
          placeholder="Name"
          required
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          placeholder="PIN (4-6 digits)"
          required
          minLength={4}
          value={newPin}
          onChange={(e) => setNewPin(digitsOnly(e.target.value))}
        />
        <button type="submit">Add worker</button>
      </form>

      {error && <p className="takings-error">{error}</p>}
      {message && <p className="money-in-message">{message}</p>}

      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {workers.length === 0 && (
              <tr>
                <td colSpan="3">No workers yet.</td>
              </tr>
            )}
            {workers.map((worker) =>
              editing?.id === worker.id ? (
                // Editing this worker: new name and/or new PIN
                <tr key={worker.id}>
                  <td colSpan="3">
                    <form
                      className="staff-add"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const changes = { name: editing.name };
                        // Only send a PIN if one was typed
                        if (editing.pin) changes.pin = editing.pin;
                        const saved = await send(
                          "/api/admin/staff/" + worker.id,
                          "PUT",
                          changes,
                          editing.pin
                            ? `${editing.name.trim()} saved with a new PIN.`
                            : `${editing.name.trim()} saved.`,
                        );
                        if (saved) setEditing(null);
                      }}
                    >
                      <input
                        type="text"
                        required
                        value={editing.name}
                        onChange={(e) =>
                          setEditing({ ...editing, name: e.target.value })
                        }
                      />
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        placeholder="New PIN (leave empty to keep)"
                        minLength={4}
                        value={editing.pin}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            pin: digitsOnly(e.target.value),
                          })
                        }
                      />
                      <button type="button" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                      <button type="submit">Save</button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={worker.id} className={worker.active ? "" : "removed"}>
                  <td>{worker.name}</td>
                  <td>{worker.active ? "Active" : "Removed"}</td>
                  <td className="row-actions">
                    {worker.active ? (
                      <>
                        <button
                          className="sort-button"
                          onClick={() =>
                            setEditing({
                              id: worker.id,
                              name: worker.name,
                              pin: "",
                            })
                          }
                        >
                          Edit name / PIN
                        </button>
                        <button
                          className="sort-button danger-button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove ${worker.name}? They won't be able to sign in.`,
                              )
                            ) {
                              send(
                                "/api/admin/staff/" + worker.id,
                                "DELETE",
                                null,
                                `${worker.name} removed.`,
                              );
                            }
                          }}
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <button
                        className="sort-button"
                        onClick={() =>
                          send(
                            `/api/admin/staff/${worker.id}/restore`,
                            "POST",
                            null,
                            `${worker.name} is back.`,
                          )
                        }
                      >
                        Bring back
                      </button>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
