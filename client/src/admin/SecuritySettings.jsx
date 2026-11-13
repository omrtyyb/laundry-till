// Admin "Security": change the admin password. Needs the current password.
// Other browsers that were logged in are logged out; this one stays logged in.

import { useState } from "react";

const MIN_LENGTH = 8;

export default function SecuritySettings() {
  const [current, setCurrent] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [again, setAgain] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  return (
    <section className="report">
      <h2>Security</h2>
      <form
        className="ticket-form security-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setMessage(null);
          setError(null);
          if (newPassword !== again) {
            setError("The two new passwords are different");
            return;
          }
          const response = await fetch("/api/admin/change-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              current_password: current,
              new_password: newPassword,
            }),
          });
          const data = await response.json();
          if (response.ok) {
            setMessage(
              "Password changed. Any other browser logged in as admin has been logged out.",
            );
            setCurrent("");
            setNewPassword("");
            setAgain("");
          } else {
            setError(data.error);
          }
        }}
      >
        <h3>Change admin password</h3>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label>
          New password (at least {MIN_LENGTH} characters)
          <input
            type="password"
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <label>
          New password again
          <input
            type="password"
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
        </label>
        {error && <p className="takings-error">{error}</p>}
        {message && <p className="money-in-message">{message}</p>}
        <div className="form-actions">
          <button type="submit">Change password</button>
        </div>
      </form>
      <p className="report-note">
        Forgot the password? On the shop PC, open the server folder and run{" "}
        <code>npm run set-password</code> to set a new one.
      </p>
    </section>
  );
}
