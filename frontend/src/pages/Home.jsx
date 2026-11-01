import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { Card, ErrorBox, Loading, ProgressBar, StatusBadge } from "../components/ui";
import { DoseActions, SessionActions } from "../components/DoseActions";
import ReminderSetup from "../components/ReminderSetup";
import DashboardCharts from "../components/DashboardCharts";
import { useAuth } from "../hooks/useAuth";
import { SLOT_ICON, cap, fmtDate, fmtMl, fmtShortDate, fmtTime } from "../utils/format";
import { useToast } from "../hooks/useToast";

const WATER_BTNS = [50, 100, 150, 200, 250, 500];

function slotSummary(items) {
  const slots = {};
  items.forEach((i) => (slots[i.slot] = [...(slots[i.slot] || []), i]));
  return ["morning", "afternoon", "evening", "night"].filter((s) => slots[s]).map((s) => {
    const list     = slots[s];
    const allDone  = list.every((i) => i.status === "Taken");
    const allClosed = list.every((i) => i.status === "Taken" || i.status === "Skipped");
    const anyDue   = list.some((i) => i.state === "due");
    return {
      slot: s,
      label: allDone ? "✓ Taken" : allClosed ? "Skipped" : anyDue ? "⏰ Pending" : "⏳ Upcoming",
    };
  });
}

export default function Home() {
  const { data: d, loading, error, reload } = useFetch("/api/dashboard", { interval: 60000 });
  const { isAdmin } = useAuth();

  if (!d) return error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />;

  const { medicines: m, water, walking, respirometer: r, next_appointment: appt, low_stock: low } = d;
  const dueDoses   = m.items.filter((i) => i.state === "due");
  const nextDose   = m.next;
  const dueSession = r.items.find((i) => i.state === "due");
  const lastTaken  = [...m.items].filter((i) => i.taken_time).sort((a, b) => b.taken_time.localeCompare(a.taken_time))[0];

  // Display names (passed from backend greeting)
  const greeting  = d.greeting;
  const firstName = (d.name || "").split(" ")[0];

  return (
    <>
      <h1 style={{ marginBottom: "1rem" }}>{greeting}, {firstName}! 👋</h1>
      {error && <ErrorBox message={error} />}
      <ReminderSetup />

      {/* ── Admin overview stats ──────────────────── */}
      {isAdmin && (
        <section className="stats-banner" aria-label="Overview">
          <div className="stat-tile">
            <div className="stat-label">Medicines today</div>
            <div className="stat-value">{m.taken} / {m.total}</div>
          </div>
          <div className={`stat-tile ${low.length ? "warn" : ""}`}>
            <div className="stat-label">Low stock alerts</div>
            <div className="stat-value">{low.length}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Water today</div>
            <div className="stat-value" style={{ fontSize: "1.2rem" }}>{fmtMl(water.total_ml)}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Recent activity</div>
            <div className="stat-value small">
              {lastTaken ? `${lastTaken.medicine_name} at ${fmtTime(lastTaken.taken_time)}` : "Nothing yet"}
            </div>
          </div>
        </section>
      )}

      {/* ── Low stock alert ───────────────────────── */}
      {low.length > 0 && (
        <div className="alert alert-warn" role="alert">
          <strong>⚠️ Medicine alert</strong>
          {low.map((i) => <p key={i.medicine_id}>{i.alert}</p>)}
        </div>
      )}

      {/* ── Today's summary card ──────────────────── */}
      <Card icon="📋" title="Today's Summary">
        <div className="tiles">
          <div className="tile">
            <b>💊 {m.taken}/{m.total}</b>
            <span>Medicines</span>
          </div>
          <div className="tile">
            <b>💧 {fmtMl(water.total_ml)}</b>
            <span>Water</span>
          </div>
          <div className="tile">
            <b>🚶 {walking.total_minutes}m</b>
            <span>{walking.total_km} km</span>
          </div>
          <div className="tile">
            <b>🫁 {r.completed}/{r.total}</b>
            <span>Breathing</span>
          </div>
        </div>
        {appt && (
          <div className="row">
            <span>🏥 Next appointment</span>
            <strong>{appt.purpose || appt.department || "Visit"} — {fmtShortDate(appt.date)}</strong>
          </div>
        )}
      </Card>

      {/* ── Medicines card ────────────────────────── */}
      <Card icon="💊" title="Medicines" to="/medicines">
        <p className="big">{m.taken} of {m.total} <small>doses completed</small></p>
        {m.total === 0 && <p className="muted">No medicines are scheduled today.</p>}
        <div className="row" style={{ flexWrap: "wrap" }}>
          {slotSummary(m.items).map((s) => (
            <span key={s.slot}>{SLOT_ICON[s.slot]} {cap(s.slot)}: <strong>{s.label}</strong></span>
          ))}
        </div>
        {dueDoses.length > 0 ? (
          dueDoses.map((dose) => (
            <div key={dose.log_id} className="stack" style={{ marginTop: ".8rem" }}>
              <div>
                <strong>{dose.medicine_name}</strong> <StatusBadge state={dose.state} />
                <div className="muted">{dose.dosage} · {fmtTime(dose.scheduled_time)}</div>
              </div>
              <DoseActions dose={dose} onDone={reload} />
            </div>
          ))
        ) : nextDose ? (
          <p style={{ marginTop: ".6rem" }}>
            Next: <strong>{nextDose.medicine_name}</strong> at <strong>{fmtTime(nextDose.scheduled_time)}</strong>
          </p>
        ) : m.total > 0 ? (
          <p className="muted">All of today's medicines are recorded. 👍</p>
        ) : null}
      </Card>

      {/* ── Water card ────────────────────────────── */}
      <Card icon="💧" title="Water" to="/water">
        <p className="big">{fmtMl(water.total_ml)} <small>/ {fmtMl(water.target_ml)}</small></p>
        <ProgressBar value={water.total_ml} max={water.target_ml} label="Water progress" />
        <QuickWater onDone={reload} />
      </Card>

      {/* ── Walking card ──────────────────────────── */}
      <Card icon="🚶" title="Walking" to="/walking">
        <p className="big">{walking.total_minutes} <small>minutes</small> · {walking.total_km} <small>km</small></p>
        {walking.target_minutes > 0 && (
          <ProgressBar value={walking.total_minutes} max={walking.target_minutes} label="Walking progress" />
        )}
        <Link
          className="btn btn-outline"
          style={{ display: "block", textAlign: "center", textDecoration: "none", lineHeight: "40px", marginTop: ".6rem" }}
          to="/walking?add=1"
        >
          + Add Walking Session
        </Link>
      </Card>

      {/* ── Respirometer card ─────────────────────── */}
      <Card icon="🫁" title="Respirometer" to="/respirometer">
        {r.total === 0 ? (
          <p className="muted">No sessions are scheduled.</p>
        ) : (
          <>
            <p className="big">{r.completed} / {r.total} <small>sessions today</small></p>
            {r.next && <p>Next session: <strong>{fmtTime(r.next.scheduled_time)}</strong></p>}
            {dueSession && <SessionActions session={dueSession} onDone={reload} />}
          </>
        )}
      </Card>

      {/* ── Appointment card ──────────────────────── */}
      <Card icon="🏥" title="Appointments" to="/appointments">
        {appt ? (
          <div>
            <p className="big" style={{ fontSize: "1.3rem" }}>{appt.purpose || appt.department || "Appointment"}</p>
            <p><strong>{fmtDate(appt.date)}</strong><br />{fmtTime(appt.time)}</p>
            {appt.doctor   && <p>Doctor: {appt.doctor}</p>}
            {appt.hospital && <p>Hospital: {appt.hospital}</p>}
            {appt.notes    && <p className="muted">{appt.notes}</p>}
          </div>
        ) : (
          <p className="muted">No upcoming appointments.</p>
        )}
      </Card>

      {/* ── Analytics charts ──────────────────────── */}
      <DashboardCharts today={d} isAdmin={isAdmin} />

      {/* ── Medicine Stock ────────────────────────── */}
      <Card icon="📦" title="Medicine Stock" tone={low.length ? "warn" : undefined}>
        <StockList />
      </Card>
    </>
  );
}

/* ── Water quick-add (+50 to +500 ml) ───────────────────────── */
function QuickWater({ onDone }) {
  const toast   = useToast();
  const busyRef = useRef(false);   // prevents double-clicks across buttons
  const [activeMl, setActiveMl] = useState(null);

  const add = async (ml) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setActiveMl(ml);
    try {
      await api("/api/water", { method: "POST", body: { amount_ml: ml } });
      toast(`💧 +${ml} ml added`);
      onDone();
    } catch (e) {
      toast("Unable to save. Please try again.", "error");
    } finally {
      busyRef.current = false;
      setActiveMl(null);
    }
  };

  return (
    <>
      <div className="water-btn-grid">
        {WATER_BTNS.map((ml) => (
          <button
            key={ml}
            className="water-btn"
            disabled={activeMl !== null}
            onClick={() => add(ml)}
            aria-label={`Add ${ml} ml`}
          >
            {activeMl === ml ? "…" : `+${ml} ml`}
          </button>
        ))}
      </div>
      <div style={{ marginTop: ".5rem" }}>
        <Link
          className="btn btn-outline btn-small"
          to="/water?custom=1"
          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
        >
          Custom amount
        </Link>
      </div>
    </>
  );
}

/* ── Stock list ──────────────────────────────────────────────── */
function StockList() {
  const { data, error, loading } = useFetch("/api/inventory");
  if (loading && !data) return <Loading />;
  if (error && !data)  return <p className="muted">{error}</p>;
  if (!data.items.length) return <p className="muted">No medicines added yet.</p>;
  return data.items.map((i) => (
    <div className="row" key={i.medicine_id}>
      <span>{i.medicine_name}</span>
      <strong>{i.current_stock} tablets {i.state !== "ok" && "⚠️"}</strong>
    </div>
  ));
}
