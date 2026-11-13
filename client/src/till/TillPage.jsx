// The till screen: the six big buttons, the pop-ups they open,
// the activity list on the right, and which worker is signed in.

import { useEffect, useState } from "react";
import {
  WasherIcon,
  DryCleaningIcon,
  SoapIcon,
  SpendCoinIcon,
  TicketIcon,
  CashDrawerIcon,
} from "./TillIcons.jsx";
import TicketForm from "./TicketForm.jsx";
import { TICKET_TYPES } from "./ticketTypes.js";
import SellForm from "./SellForm.jsx";
import SpendForm from "./SpendForm.jsx";
import MoneyInForm from "./MoneyInForm.jsx";
import ActivitySidebar from "./ActivitySidebar.jsx";
import StaffSignIn from "./StaffSignIn.jsx";
import CashDrawerForm from "./CashDrawerForm.jsx";

export default function TillPage({ onOpenAdmin }) {
  const [showSellForm, setShowSellForm] = useState(false);
  const [showSpendForm, setShowSpendForm] = useState(false);
  const [showMoneyInForm, setShowMoneyInForm] = useState(false);
  const [showCashDrawer, setShowCashDrawer] = useState(false);
  // Which ticket form is open: "dryCleaning", "serviceWash", or null for none
  const [openForm, setOpenForm] = useState(null);
  // Goes up by one whenever a form closes, so the sidebar reloads its list
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshSidebar = () => setRefreshKey((key) => key + 1);

  // The worker signed in on this till ({ id, name } or null), and whether signing in
  // is needed (only once the admin has added workers)
  const [staff, setStaff] = useState(null);
  const [staffRequired, setStaffRequired] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  // What to open once the worker has signed in, e.g. the dry cleaning form
  const [afterSignIn, setAfterSignIn] = useState(null);

  useEffect(() => {
    fetch("/api/staff/session")
      .then((response) => response.json())
      .then((data) => {
        setStaff(data.staff);
        setStaffRequired(data.staffRequired);
      });
  }, []);

  // Runs a till button's action, asking the worker to sign in first if needed
  const asStaff = (action) => () => {
    if (staffRequired && !staff) {
      setAfterSignIn(() => action);
      setShowSignIn(true);
    } else {
      action();
    }
  };

  const signOut = async () => {
    await fetch("/api/staff/logout", { method: "POST" });
    setStaff(null);
  };

  return (
    <main className="till">
      <header>
        <button onClick={onOpenAdmin}>Admin</button>
        <h1>Till</h1>
        {staffRequired && (
          <div className="staff-bar">
            {staff ? (
              <>
                <span>
                  Working: <strong>{staff.name}</strong>
                </span>
                <button onClick={signOut}>Sign out</button>
              </>
            ) : (
              <button
                className="confirm-button"
                onClick={() => setShowSignIn(true)}
              >
                Sign in
              </button>
            )}
          </div>
        )}
      </header>
      <div className="till-body">
        <div className="till-buttons">
          <button
            className="dry-cleaning"
            onClick={asStaff(() => setOpenForm("dryCleaning"))}
          >
            <DryCleaningIcon />
            Generate-Dry Cleaning Ticket
          </button>
          <button
            className="service-wash"
            onClick={asStaff(() => setOpenForm("serviceWash"))}
          >
            <TicketIcon />
            Generate-Service Wash Ticket
          </button>
          <button
            className="soap"
            onClick={asStaff(() => setShowSellForm(true))}
          >
            <SoapIcon />
            Sell Soap &amp; Softener
          </button>
          <button
            className="spend-coin"
            onClick={asStaff(() => setShowSpendForm(true))}
          >
            <SpendCoinIcon />
            Spend Coin from Till
          </button>

          <button
            className="coin-in"
            onClick={asStaff(() => setShowMoneyInForm(true))}
          >
            <WasherIcon />
            Money In: Dry Clean, Service Wash &amp; Machine Money
          </button>
          <button
            className="cash-drawer-button"
            onClick={asStaff(() => setShowCashDrawer(true))}
          >
            <CashDrawerIcon />
            Cash Drawer: Morning Float &amp; End of Day Count
          </button>
        </div>
        <ActivitySidebar refreshKey={refreshKey} />
      </div>

      {openForm && (
        <TicketForm
          ticketType={TICKET_TYPES[openForm]}
          onClose={() => {
            setOpenForm(null);
            refreshSidebar();
          }}
        />
      )}

      {showSellForm && (
        <SellForm
          onClose={() => {
            setShowSellForm(false);
            refreshSidebar();
          }}
        />
      )}

      {showSpendForm && (
        <SpendForm
          onClose={() => {
            setShowSpendForm(false);
            refreshSidebar();
          }}
        />
      )}

      {showMoneyInForm && (
        <MoneyInForm
          onClose={() => {
            setShowMoneyInForm(false);
            refreshSidebar();
          }}
        />
      )}

      {showCashDrawer && (
        <CashDrawerForm
          onClose={() => {
            setShowCashDrawer(false);
            refreshSidebar();
          }}
        />
      )}

      {showSignIn && (
        <StaffSignIn
          onSignedIn={(worker) => {
            setStaff(worker);
            setShowSignIn(false);
            // Open whatever button was pressed before signing in
            if (afterSignIn) afterSignIn();
            setAfterSignIn(null);
          }}
          onClose={() => {
            setShowSignIn(false);
            setAfterSignIn(null);
          }}
        />
      )}
    </main>
  );
}
