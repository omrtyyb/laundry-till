// The Admin page: a menu of reports on the left, the chosen report on the right.

import { useEffect, useState } from "react";
import DaySummary from "./DaySummary.jsx";
import TicketsSection from "./TicketsSection.jsx";
import DaysChart from "./DaysChart.jsx";
import MonthlySummary from "./MonthlySummary.jsx";
import MoneySources from "./MoneySources.jsx";
import DaysList from "./DaysList.jsx";
import CustomersAndHours from "./CustomersAndHours.jsx";
import SecuritySettings from "./SecuritySettings.jsx";
import StaffManager from "./StaffManager.jsx";
import EditHistory from "./EditHistory.jsx";
import PriceListManager from "./PriceListManager.jsx";
import ServiceWashPrices from "./ServiceWashPrices.jsx";
import ProductPrices from "./ProductPrices.jsx";
import PrinterSettings from "./PrinterSettings.jsx";
import Backups from "./Backups.jsx";
import Customers from "./Customers.jsx";
import LoyaltyRewards from "./LoyaltyRewards.jsx";
import ExcelExport from "./ExcelExport.jsx";

// The reports in the Admin sidebar, in menu order
const ADMIN_SECTIONS = [
  { id: "day", label: "Day summary" },
  { id: "tickets", label: "Tickets" },
  { id: "customerProfiles", label: "Customers" },
  { id: "loyalty", label: "Loyalty rewards" },
  { id: "chart", label: "Last 7 / 30 days chart" },
  { id: "month", label: "Monthly summary" },
  { id: "share", label: "Where the money comes from" },
  { id: "days", label: "Days list: card & cash check" },
  { id: "customers", label: "Top customers & busiest hours" },
  { id: "excel", label: "Export to Excel" },
  { id: "prices", label: "Price list" },
  { id: "products", label: "Products to sell" },
  { id: "history", label: "Edit history" },
  { id: "staff", label: "Staff" },
  { id: "printer", label: "Printer" },
  { id: "backups", label: "Backups" },
  { id: "security", label: "Security" },
];

// Admin page: a sidebar to choose a report, and the chosen report next to it
// onLoggedOut is called after Log out, or when the log-in runs out
export default function AdminPage({ onBack, onLoggedOut }) {
  const [section, setSection] = useState("day");
  // The day the Day summary opens on; the Days list changes it when a row is clicked
  const [dayToShow, setDayToShow] = useState(null);

  // Every minute, check the log-in is still valid (it ends after 12 hours)
  useEffect(() => {
    const timer = setInterval(async () => {
      const response = await fetch("/api/admin/session");
      const data = await response.json();
      if (!data.loggedIn) onLoggedOut();
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [onLoggedOut]);

  const logOut = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    onLoggedOut();
  };

  return (
    <main className="admin">
      <header>
        {/* Going back to the till also logs the admin out, so staff can't get in after */}
        <button
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            onBack();
          }}
        >
          Back
        </button>
        <h1>Admin</h1>
        <button className="log-out" onClick={logOut}>
          Log out
        </button>
      </header>

      <div className="admin-body">
        <nav className="admin-menu">
          {ADMIN_SECTIONS.map((item) => (
            <button
              key={item.id}
              className={item.id === section ? "selected" : ""}
              onClick={() => {
                // Choosing Day summary from the menu always opens on today
                if (item.id === "day") setDayToShow(null);
                setSection(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="admin-content">
          {section === "day" && (
            // key makes the Day summary start again on the newly chosen day
            <DaySummary key={dayToShow} startDate={dayToShow} />
          )}
          {section === "tickets" && <TicketsSection />}
          {section === "customerProfiles" && <Customers />}
          {section === "loyalty" && <LoyaltyRewards />}
          {section === "chart" && <DaysChart />}
          {section === "month" && <MonthlySummary />}
          {section === "share" && <MoneySources />}
          {section === "days" && (
            <DaysList
              onOpenDay={(date) => {
                setDayToShow(date);
                setSection("day");
              }}
            />
          )}
          {section === "customers" && <CustomersAndHours />}
          {section === "excel" && <ExcelExport />}
          {section === "prices" && (
            <>
              <ServiceWashPrices />
              <PriceListManager />
            </>
          )}
          {section === "products" && <ProductPrices />}
          {section === "history" && <EditHistory />}
          {section === "staff" && <StaffManager />}
          {section === "printer" && <PrinterSettings />}
          {section === "backups" && <Backups />}
          {section === "security" && <SecuritySettings />}
        </div>
      </div>
    </main>
  );
}
