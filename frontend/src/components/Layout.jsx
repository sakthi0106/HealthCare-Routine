import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import useReminders from "../hooks/useReminders";
import AIChat from "./AIChat";
import { Disclaimer, Modal, Field } from "./ui";
import Icon from "./Icon";
import { api } from "../services/api";
import { fmtDate, todayISO } from "../utils/format";
import { useToast } from "../hooks/useToast";
import useFetch from "../hooks/useFetch";

const FATHER_NAV = [
  ["/",              "home",         "Home"],
  ["/medicines",     "pill",         "Pills"],
  ["/water",         "droplet",      "Water"],
  ["/walking",       "footprints",   "Walk"],
  ["/respirometer",  "wind",         "Breathe"],
  ["/appointments",  "stethoscope",  "Doctor"],
  ["/medical-reports","file-text",   "Reports"],
];
const ADMIN_NAV = [
  ["/",                   "home",       "Home"],
  ["/admin/medicines",    "pill",       "Medicines"],
  ["/admin/inventory",    "package",    "Stock"],
  ["/admin/appointments", "calendar",   "Visits"],
  ["/admin/reports",      "bar-chart",  "Reports"],
  ["/medical-reports",    "file-text",  "Med Files"],
  ["/admin/settings",     "sliders",    "Settings"],
];

export default function Layout() {
  const { isAdmin, logout } = useAuth();
  const toast = useToast();
  const [chatOpen, setChatOpen]       = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { banners, dismiss }          = useReminders();
  const nav = isAdmin ? ADMIN_NAV : FATHER_NAV;

  // Theme toggle
  const [theme, setTheme] = useState(() => localStorage.getItem("fhc_theme") || "light");
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem("fhc_theme", next);
    setTheme(next);
  };

  // Display name from settings
  const settingsRes = useFetch("/api/settings");
  const settings = settingsRes.data;
  const rawName   = settings?.father_name || "";
  const adminName = settings?.admin_name  || "Dhanushkumar A";
  const displayName = isAdmin
    ? adminName
    : (rawName || "Ayyamperumal E");
  const initials = displayName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="app">
      {/* ── Top Bar ───────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-icon">🏥</div>
          <div>
            <strong>Family Health Companion</strong>
            <div className="topbar-date">
              {fmtDate(todayISO(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
        </div>

        <div className="topbar-right">
          {isAdmin && <span className="badge badge-info">Admin</span>}

          <button
            className="profile-btn"
            onClick={() => setProfileOpen(true)}
            aria-label="Open profile"
          >
            <div className="profile-avatar">{initials}</div>
            <span className="small" style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName.split(" ")[0]}
            </span>
          </button>

          <button
            className="btn btn-ghost btn-small"
            onClick={toggleTheme}
            aria-label="Switch theme"
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
          </button>

          <button className="btn btn-ghost btn-small" onClick={logout}>Sign out</button>
        </div>
      </header>

      {/* ── Bottom / Side Nav ─────────────────────── */}
      <nav className="nav" aria-label="Main">
        {nav.map(([to, icon, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true"><Icon name={icon} size={24} /></span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Main content ──────────────────────────── */}
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

      {/* ── AI Chat FAB ───────────────────────────── */}
      <button className="fab" onClick={() => setChatOpen(true)} aria-label="Open AI Assistant">
        <span aria-hidden="true">🤖</span> Ask AI
      </button>
      {chatOpen && <AIChat onClose={() => setChatOpen(false)} />}

      {/* ── Profile Modal ─────────────────────────── */}
      {profileOpen && (
        <ProfileModal
          isAdmin={isAdmin}
          displayName={displayName}
          initials={initials}
          settings={settings}
          onClose={() => { setProfileOpen(false); settingsRes.reload(); }}
        />
      )}
    </div>
  );
}

/* ── Profile / Edit Name Modal ───────────────────────────────── */
function ProfileModal({ isAdmin, displayName, initials, settings, onClose }) {
  const toast = useToast();
  const nameKey = isAdmin ? "admin_name" : "father_name";
  const [name, setName] = useState(displayName);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: { values: { ...settings, [nameKey]: name.trim() } },
      });
      toast("Display name updated ✓");
      onClose();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="My Profile" onClose={onClose}>
      <div className="profile-modal-header">
        <div className="profile-modal-avatar">{initials}</div>
        <div style={{ textAlign: "center" }}>
          <strong style={{ fontSize: "1.05rem" }}>{displayName}</strong>
          <div className="small muted">{isAdmin ? "Administrator" : "Patient"}</div>
        </div>
      </div>

      <Field label="Display Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoFocus
          placeholder="Enter your name"
        />
      </Field>

      <button
        className="btn btn-block"
        disabled={busy || !name.trim() || name.trim() === displayName}
        onClick={save}
      >
        {busy ? "Saving…" : "Save Name"}
      </button>
    </Modal>
  );
}
