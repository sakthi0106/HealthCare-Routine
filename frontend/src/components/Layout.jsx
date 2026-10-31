import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import useReminders from "../hooks/useReminders";
import AIChat from "./AIChat";
import { Disclaimer } from "./ui";
import Icon from "./Icon";
import { fmtDate, todayISO } from "../utils/format";

const FATHER_NAV = [
  ["/", "home", "Home"], ["/medicines", "pill", "Pills"], ["/water", "droplet", "Water"],
  ["/walking", "footprints", "Walk"], ["/respirometer", "wind", "Breathe"], ["/appointments", "stethoscope", "Doctor"],
];
const ADMIN_NAV = [
  ["/", "home", "Home"], ["/admin/medicines", "pill", "Medicines"], ["/admin/inventory", "package", "Stock"],
  ["/admin/appointments", "calendar", "Visits"], ["/admin/reports", "bar-chart", "Reports"], ["/admin/settings", "sliders", "Settings"],
];

export default function Layout() {
  const { isAdmin, logout } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const { banners, dismiss } = useReminders();
  const nav = isAdmin ? ADMIN_NAV : FATHER_NAV;

  // Light glass look is the default for everyone; the 🌙 Dark button switches (and remembers the choice).
  const [theme, setTheme] = useState(() => localStorage.getItem("fhc_theme") || "light");
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem("fhc_theme", next);
    setTheme(next);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <strong>Family Health Companion</strong>
          <div className="topbar-date">{fmtDate(todayISO(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
        <div className="topbar-right">
          {isAdmin && <span className="badge badge-info">Family</span>}
          <button className="btn btn-ghost btn-small" onClick={toggleTheme} aria-label="Switch between dark and light look">
            <Icon name={theme === "dark" ? "sun" : "moon"} size={18} /> {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button className="btn btn-ghost btn-small" onClick={logout}>Sign out</button>
        </div>
      </header>

      <nav className="nav" aria-label="Main">
        {nav.map(([to, icon, label]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon" aria-hidden="true"><Icon name={icon} size={26} /></span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <main className="main">
        {banners.slice(0, 3).map((b) => (
          <div className="alert alert-warn banner" key={b.id} role="alert">
            <div>
              <strong>{b.title}</strong>
              <p>{b.message}</p>
            </div>
            <button className="btn btn-small btn-outline" onClick={() => dismiss(b.id)}>OK</button>
          </div>
        ))}
        <Outlet />
        <Disclaimer />
      </main>

      <button className="fab" onClick={() => setChatOpen(true)} aria-label="Open AI Assistant">
        <span aria-hidden="true">🤖</span> Ask
      </button>
      {chatOpen && <AIChat onClose={() => setChatOpen(false)} />}
    </div>
  );
}
