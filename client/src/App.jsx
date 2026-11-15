// The whole app: shows the till screen, or the admin area when Admin is pressed.
// Staff use the till freely; the admin area asks for the admin password.
//
// Where things live:
//   till/        the till screen and its pop-up forms
//   admin/       the admin page and its reports
//   components/  parts used by both: number pad, pop-up frame, messages, printing bar
//   utils/       small helpers for dates, money, printing and talking to the server
//   styles/      the CSS, split by area and loaded in order from styles/index.css

import { useState } from "react";
import TillPage from "./till/TillPage.jsx";
import AdminArea from "./admin/AdminArea.jsx";
import NumberPad from "./components/NumberPad.jsx";
import Toast from "./components/Toast.jsx";
import PrintingBar from "./components/PrintingBar.jsx";

function App() {
  // Which screen is showing: "till" or "admin"
  const [page, setPage] = useState("till");

  return (
    <>
      {page === "admin" ? (
        <AdminArea onBack={() => setPage("till")} />
      ) : (
        <TillPage onOpenAdmin={() => setPage("admin")} />
      )}
      {/* The on-screen number pad, shown on touchscreens when a number box is tapped */}
      <NumberPad />
      {/* Short "saved" / "could not save" messages that disappear after 2 seconds */}
      <Toast />
      {/* A thin moving line at the bottom of the screen while printing */}
      <PrintingBar />
    </>
  );
}

export default App;
