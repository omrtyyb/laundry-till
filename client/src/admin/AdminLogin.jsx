// The password screen shown before the Admin page. The password is checked by the
// server; this screen only sends it.

import { useState } from "react";
import { request } from "../utils/api.js";

export default function AdminLogin({ passwordSet, onLoggedIn, onBack }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  return (
    <main className="admin">
      <header>
        <button onClick={onBack}>Back</button>
        <h1>Admin</h1>
      </header>

      <form
        className="ticket-form login-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const { ok, data } = await request("/api/admin/login", {
            method: "POST",
            body: { password },
          });
          if (ok) {
            onLoggedIn();
          } else {
            setError(data.error);
            setPassword("");
          }
        }}
      >
        <h2>Admin log in</h2>
        {!passwordSet && (
          <p className="report-warning">
            No admin password has been set yet. On the shop PC, open the server
            folder and run <code>npm run set-password</code>.
          </p>
        )}
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="takings-error">{error}</p>}
        <div className="form-actions">
          <button type="submit">Log in</button>
        </div>
      </form>
    </main>
  );
}
