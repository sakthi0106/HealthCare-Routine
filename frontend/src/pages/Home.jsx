import { useState } from "react";
import { Link } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { Card, ErrorBox, Loading, ProgressBar, StatusBadge } from "../components/ui";
import { DoseActions, SessionActions } from "../components/DoseActions";
import ReminderSetup from "../components/ReminderSetup";
import { SLOT_ICON, cap, fmtDate, fmtMl, fmtShortDate, fmtTime } from "../utils/format";

function slotSummary(items) {
  const slots = {};
  items.forEach((i) => (slots[i.slot] = [...(slots[i.slot] || []), i]));
  return ["morning", "afternoon", "evening", "night"].filter((s) => slots[s]).map((s) => {
    const list = slots[s];
    const allDone = list.every((i) => i.status === "Taken");
    const allClosed = list.every((i) => i.status === "Taken" || i.status === "Skipped");
    const anyDue = list.some((i) => i.state === "due");
    return { slot: s, label: allDone ? "✓ Taken" : allClosed ? "Skipped" : anyDue ? "⏰ Pending" : "⏳ Upcoming" };
  });
}

export default function Home() {
  const { data: d, loading, error, reload } = useFetch("/api/dashboard", { interval: 60000 });

  if (!d) return error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />;

  const { medicines: m, water, walking, respirometer: r, next_appointment: appt, low_stock: low } = d;
  const dueDoses = m.items.filter((i) => i.state === "due");
  const nextDose = m.next;
  const dueSession = r.items.find((i) => i.state === "due");

  return (
    <>
      <h1>{d.greeting}, {d.name}!</h1>
      {error && <ErrorBox message={error} />}
      <ReminderSetup />

      {low.length > 0 && (
        <div className="alert alert-warn" role="alert">
          <strong>⚠️ Medicine alert</strong>
          {low.map((i) => <p key={i.medicine_id}>{i.alert}</p>)}
        </div>
      )}

      <Card icon="📋" title="Today's Summary">
        <div className="row"><span>💊 Medicines</span><strong>{m.taken} / {m.total} completed</strong></div>
        <div className="row"><span>💧 Water</span><strong>{fmtMl(water.total_ml)}</strong></div>
        <div className="row"><span>🚶 Walking</span><strong>{walking.total_minutes} min | {walking.total_km} km</strong></div>
        <div className="row"><span>🫁 Respirometer</span><strong>{r.completed} / {r.total} completed</strong></div>
        <div className="row">
          <span>🏥 Next appointment</span>
          <strong>{appt ? `${appt.purpose || appt.department || "Visit"} — ${fmtShortDate(appt.date)}` : "None"}</strong>
        </div>
        <div className="row">
          <span>💊 Medicine alerts</span>
          <strong>{low.length ? `${low.length} medicine${low.length > 1 ? "s" : ""} running low` : "None"}</strong>
        </div>
      </Card>

      <Card icon="💊" title="Medicines" to="/medicines">
        <p className="big">{m.taken} of {m.total} <small>medicines completed</small></p>
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
          <p style={{ marginTop: ".6rem" }}>Next medicine: <strong>{nextDose.medicine_name}</strong> at <strong>{fmtTime(nextDose.scheduled_time)}</strong></p>
        ) : m.total > 0 ? (
          <p className="muted">All of today's medicines are recorded. 👍</p>
        ) : null}
      </Card>

      <Card icon="💧" title="Water" to="/water">
        <p className="big">{fmtMl(water.total_ml)} <small>/ {fmtMl(water.target_ml)}</small></p>
        <ProgressBar value={water.total_ml} max={water.target_ml} label="Water progress" />
        <QuickWater onDone={reload} />
      </Card>

      <Card icon="🚶" title="Walking" to="/walking">
        <p className="big">{walking.total_minutes} <small>minutes</small> · {walking.total_km} <small>km</small></p>
        {walking.target_minutes > 0 && <ProgressBar value={walking.total_minutes} max={walking.target_minutes} label="Walking progress" />}
        <Link className="btn btn-block" style={{ display: "block", textAlign: "center", textDecoration: "none", lineHeight: "40px" }} to="/walking?add=1">+ Add Walking</Link>
      </Card>

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

      <Card icon="🏥" title="Appointments" to="/appointments">
        {appt ? (
          <div>
            <p className="big" style={{ fontSize: "1.3rem" }}>{appt.purpose || appt.department || "Appointment"}</p>
            <p><strong>{fmtDate(appt.date)}</strong><br />{fmtTime(appt.time)}</p>
            {appt.doctor && <p>Doctor: {appt.doctor}</p>}
            {appt.hospital && <p>Hospital: {appt.hospital}</p>}
            {appt.notes && <p className="muted">{appt.notes}</p>}
          </div>
        ) : (
          <p className="muted">No upcoming appointments.</p>
        )}
      </Card>

      <Card icon="📦" title="Medicine Stock" tone={low.length ? "warn" : undefined}>
        <StockList />
      </Card>
    </>
  );
}

function QuickWater({ onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const add = async (ml) => {
    setBusy(true);
    setErr("");
    try {
      await api("/api/water", { method: "POST", body: { amount_ml: ml } });
      onDone();
    } catch (e) {
      setErr("Unable to save your water entry. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="btn-row">
        <button className="btn" disabled={busy} onClick={() => add(250)}>+250 ml</button>
        <button className="btn" disabled={busy} onClick={() => add(500)}>+500 ml</button>
        <Link className="btn btn-outline" style={{ textDecoration: "none", textAlign: "center", lineHeight: "40px" }} to="/water?custom=1">Custom</Link>
      </div>
      {err && <p className="alert alert-danger" style={{ marginTop: ".5rem" }}>{err}</p>}
    </>
  );
}

function StockList() {
  const { data, error, loading } = useFetch("/api/inventory");
  if (loading && !data) return <Loading />;
  if (error && !data) return <p className="muted">{error}</p>;
  if (!data.items.length) return <p className="muted">No medicines added yet.</p>;
  return data.items.map((i) => (
    <div className="row" key={i.medicine_id}>
      <span>{i.medicine_name}</span>
      <strong>{i.current_stock} tablets {i.state !== "ok" && "⚠️"}</strong>
    </div>
  ));
}
