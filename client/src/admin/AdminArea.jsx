// Decides what pressing Admin shows: the password screen, or the Admin page once logged in.
// The server remembers the log-in with a cookie for 12 hours.

import { useEffect, useState } from "react";
import AdminLogin from "./AdminLogin.jsx";
import AdminPage from "./AdminPage.jsx";
import { loadJson } from "../utils/api.js";

export default function AdminArea({ onBack }) {
  // null while asking the server, then { loggedIn, passwordSet }
  const [session, setSession] = useState(null);

  const checkSession = () =>
    loadJson("/api/admin/session")
      .then((data) => setSession(data));

  useEffect(() => {
    checkSession();
  }, []);

  if (session === null) {
    return <p>Loading…</p>;
  }

  if (!session.loggedIn) {
    return (
      <AdminLogin
        passwordSet={session.passwordSet}
        onLoggedIn={checkSession}
        onBack={onBack}
      />
    );
  }

  return (
    <AdminPage
      onBack={onBack}
      // After logging out, or when the 12 hours run out, show the password screen again
      onLoggedOut={checkSession}
    />
  );
}
